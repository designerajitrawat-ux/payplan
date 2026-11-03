// PayPal REST client for the server. Covers exactly what PayPlan moves money with:
// Orders v2 (AUTHORIZE), Payments v2 (capture, void, reauthorize), webhook signature checks
// and dispute evidence. Uses fetch only, so it runs on Vercel and in tests.

import { randomUUID } from "node:crypto";
import { amount, valueToCents, type Currency } from "./money";

export type PayPalEnv = "sandbox" | "live";

export type PayPalConfig = {
  clientId: string;
  clientSecret: string;
  env?: PayPalEnv;
  /** Injected in tests. */
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const BASE: Record<PayPalEnv, string> = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

/** A PayPal API error with the fields support asks for (name, issue, debug id). */
export class PayPalError extends Error {
  constructor(
    readonly status: number,
    readonly name: string,
    message: string,
    readonly issue: string | undefined,
    readonly debugId: string | undefined,
    readonly details: { issue?: string; description?: string; field?: string }[] = [],
  ) {
    super(message);
  }
}

type RequestOptions = {
  json?: unknown;
  form?: FormData;
  /** Idempotency key. The same key never moves money twice. */
  requestId?: string;
  headers?: Record<string, string>;
};

type Link = { href: string; rel: string; method?: string };

export type AuthorizeOrderInput = {
  cents: number;
  currency?: Currency;
  description: string;
  /** Our milestone id, echoed back by PayPal in webhooks. */
  customId: string;
  invoiceId?: string;
  /** Pay a specific merchant directly (multiparty); omit to pay the platform account. */
  payeeMerchantId?: string;
  /** The freelancer's PayPal: captures land there directly, never in the platform's account. */
  payeeEmail?: string;
  returnUrl?: string;
  cancelUrl?: string;
  requestId?: string;
};

export type Authorization = {
  id: string;
  status: string;
  cents: number;
  expirationTime?: string;
};

export type Capture = { id: string; status: string; cents: number; finalCapture: boolean };

export function createPayPalClient(config: PayPalConfig) {
  const env = config.env ?? "sandbox";
  const base = BASE[env];
  const doFetch = config.fetch ?? fetch;
  const now = config.now ?? Date.now;
  const sleep = config.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let token: { value: string; expiresAt: number } | null = null;

  /** Sandbox tokens last about 8 hours; refresh a minute early so a long job never uses a stale one. */
  async function getAccessToken(force = false): Promise<string> {
    if (!force && token && token.expiresAt - 60_000 > now()) return token.value;
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const res = await doFetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
    if (!res.ok || !body.access_token) {
      throw new PayPalError(res.status, body.error ?? "AUTHENTICATION_FAILURE", body.error_description ?? "Could not get a PayPal access token", undefined, res.headers.get("paypal-debug-id") ?? undefined);
    }
    token = { value: body.access_token, expiresAt: now() + (body.expires_in ?? 0) * 1000 };
    return token.value;
  }

  async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const requestId = opts.requestId ?? (method === "POST" ? randomUUID() : undefined);
    let refreshed = false;
    // Retries are safe because POSTs carry an idempotency key: PayPal replays the first result.
    for (let attempt = 0; ; attempt++) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${await getAccessToken()}`,
        Prefer: "return=representation",
        ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
        ...opts.headers,
      };
      let body: BodyInit | undefined;
      if (opts.json !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(opts.json);
      } else if (opts.form) {
        body = opts.form;
      }
      const res = await doFetch(`${base}${path}`, { method, headers, body });

      if (res.status === 401 && !refreshed) {
        refreshed = true;
        await getAccessToken(true);
        continue;
      }
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        await sleep(400 * 2 ** attempt);
        continue;
      }

      const text = await res.text();
      const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!res.ok) {
        const details = (data.details as PayPalError["details"]) ?? [];
        throw new PayPalError(
          res.status,
          (data.name as string) ?? "UNKNOWN_ERROR",
          (data.message as string) ?? `PayPal returned HTTP ${res.status}`,
          details[0]?.issue,
          (data.debug_id as string) ?? res.headers.get("paypal-debug-id") ?? undefined,
          details,
        );
      }
      return data as T;
    }
  }

  const findLink = (links: Link[] | undefined, ...rels: string[]) => links?.find((l) => rels.includes(l.rel))?.href;

  function toAuthorization(a: { id: string; status: string; amount: { value: string }; expiration_time?: string }): Authorization {
    return { id: a.id, status: a.status, cents: valueToCents(a.amount.value), expirationTime: a.expiration_time };
  }

  return {
    env,
    getAccessToken,

    /** Creates an order the client approves on PayPal. Money is only held after authorizeOrder. */
    async createAuthorizeOrder(input: AuthorizeOrderInput) {
      const order = await request<{ id: string; status: string; links?: Link[] }>("POST", "/v2/checkout/orders", {
        requestId: input.requestId,
        json: {
          intent: "AUTHORIZE",
          purchase_units: [
            {
              reference_id: input.customId,
              custom_id: input.customId,
              invoice_id: input.invoiceId,
              description: input.description.slice(0, 127),
              amount: amount(input.cents, input.currency),
              ...(input.payeeMerchantId ? { payee: { merchant_id: input.payeeMerchantId } } : input.payeeEmail ? { payee: { email_address: input.payeeEmail } } : {}),
            },
          ],
          // "Continue", not "Pay Now": approving only places a hold. No shipping for a service.
          payment_source: {
            paypal: {
              experience_context: {
                user_action: "CONTINUE",
                shipping_preference: "NO_SHIPPING",
                ...(input.returnUrl ? { return_url: input.returnUrl, cancel_url: input.cancelUrl ?? input.returnUrl } : {}),
              },
            },
          },
        },
      });
      return { id: order.id, status: order.status, approveUrl: findLink(order.links, "payer-action", "approve") };
    },

    /** After the client approves: turns the order into an authorization hold on their PayPal. */
    async authorizeOrder(orderId: string, requestId?: string): Promise<Authorization> {
      const order = await request<{ purchase_units: { payments: { authorizations: Parameters<typeof toAuthorization>[0][] } }[] }>(
        "POST",
        `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`,
        { requestId, json: {} },
      );
      const auth = order.purchase_units[0]?.payments?.authorizations?.[0];
      if (!auth) throw new PayPalError(500, "NO_AUTHORIZATION", "PayPal did not return an authorization", undefined, undefined);
      return toAuthorization(auth);
    },

    async getAuthorization(authorizationId: string): Promise<Authorization> {
      return toAuthorization(await request("GET", `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}`));
    },

    /** Captures part (or the rest) of a hold. finalCapture=true releases whatever is left. */
    async captureAuthorization(authorizationId: string, input: { cents: number; finalCapture: boolean; invoiceId?: string; noteToPayer?: string; requestId: string; currency?: Currency }): Promise<Capture> {
      const c = await request<{ id: string; status: string; amount: { value: string }; final_capture?: boolean }>(
        "POST",
        `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`,
        {
          requestId: input.requestId,
          json: {
            amount: amount(input.cents, input.currency),
            final_capture: input.finalCapture,
            invoice_id: input.invoiceId,
            note_to_payer: input.noteToPayer?.slice(0, 255),
          },
        },
      );
      return { id: c.id, status: c.status, cents: valueToCents(c.amount.value), finalCapture: c.final_capture ?? input.finalCapture };
    },

    /** Releases what is left of a hold back to the client. */
    async voidAuthorization(authorizationId: string, requestId: string): Promise<void> {
      await request("POST", `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`, { requestId });
    },

    /** Extends a hold (allowed once, from day 4 to day 29 after authorization). */
    async reauthorizeAuthorization(authorizationId: string, input: { cents: number; requestId: string; currency?: Currency }): Promise<Authorization> {
      return toAuthorization(
        await request("POST", `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/reauthorize`, {
          requestId: input.requestId,
          json: { amount: amount(input.cents, input.currency) },
        }),
      );
    },

    /** Asks PayPal whether a webhook really came from PayPal. Never trust an unverified event. */
    async verifyWebhookSignature(input: { webhookId: string; headers: Headers | Record<string, string | undefined>; event: unknown }): Promise<boolean> {
      const get = (name: string) => (input.headers instanceof Headers ? input.headers.get(name) : input.headers[name] ?? input.headers[name.toLowerCase()]) ?? undefined;
      const res = await request<{ verification_status: string }>("POST", "/v1/notifications/verify-webhook-signature", {
        json: {
          auth_algo: get("paypal-auth-algo"),
          cert_url: get("paypal-cert-url"),
          transmission_id: get("paypal-transmission-id"),
          transmission_sig: get("paypal-transmission-sig"),
          transmission_time: get("paypal-transmission-time"),
          webhook_id: input.webhookId,
          webhook_event: input.event,
        },
      });
      return res.verification_status === "SUCCESS";
    },

    /** Sends the signed acceptance report as dispute evidence (PDF, under 10 MB). */
    async provideDisputeEvidence(disputeId: string, input: { notes: string; file: { name: string; data: Blob } }) {
      const form = new FormData();
      form.append("input", new Blob([JSON.stringify({ evidences: [{ evidence_type: "PROOF_OF_FULFILLMENT", notes: input.notes.slice(0, 2000) }] })], { type: "application/json" }));
      form.append("file1", input.file.data, input.file.name);
      return request<{ links?: Link[] }>("POST", `/v1/customer/disputes/${encodeURIComponent(disputeId)}/provide-evidence`, { form });
    },
  };
}

export type PayPalClient = ReturnType<typeof createPayPalClient>;

/** The app's client, from environment variables. Throws a clear message when setup is missing. */
export function payPalFromEnv(env: Record<string, string | undefined> = process.env): PayPalClient {
  const missing = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"].filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing ${missing.join(", ")}. See docs/sandbox-setup-steps.md.`);
  const mode = env.PAYPAL_ENV === "live" ? "live" : "sandbox";
  return createPayPalClient({ clientId: env.PAYPAL_CLIENT_ID!, clientSecret: env.PAYPAL_CLIENT_SECRET!, env: mode });
}
