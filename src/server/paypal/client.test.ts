import { describe, expect, it } from "vitest";
import { createPayPalClient, PayPalError } from "./client";
import { centsToValue, valueToCents } from "./money";

type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown };

/** A fake PayPal: answers the token call, then replays the queued responses in order. */
function fakePayPal(queue: { status: number; body?: unknown; headers?: Record<string, string> }[], opts: { expiresIn?: number } = {}) {
  const calls: Call[] = [];
  let tokens = 0;
  const fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    const headers = (init.headers ?? {}) as Record<string, string>;
    const raw = init.body;
    const body = typeof raw === "string" && headers["Content-Type"] === "application/json" ? JSON.parse(raw) : raw;
    calls.push({ url, method: init.method ?? "GET", headers, body });
    if (url.endsWith("/v1/oauth2/token")) {
      tokens++;
      return Response.json({ access_token: `token-${tokens}`, expires_in: opts.expiresIn ?? 32400 });
    }
    const next = queue.shift();
    if (!next) throw new Error(`Unexpected call ${init.method} ${url}`);
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), { status: next.status, headers: next.headers });
  }) as typeof globalThis.fetch;
  return { fetch, calls, tokenCount: () => tokens };
}

function client(fake: ReturnType<typeof fakePayPal>, clock = { t: 0 }) {
  return createPayPalClient({ clientId: "id", clientSecret: "secret", fetch: fake.fetch, now: () => clock.t, sleep: async () => {} });
}

const authorization = { id: "AUTH-1", status: "CREATED", amount: { currency_code: "USD", value: "800.00" }, expiration_time: "2026-11-05T10:00:00Z" };

describe("money", () => {
  it("formats cents the way PayPal wants", () => {
    expect(centsToValue(80000)).toBe("800.00");
    expect(centsToValue(5)).toBe("0.05");
    expect(centsToValue(123456)).toBe("1234.56");
    expect(valueToCents("800.00")).toBe(80000);
    expect(valueToCents("12.5")).toBe(1250);
    expect(valueToCents("7")).toBe(700);
  });

  it("refuses fractions of a cent and negative amounts", () => {
    expect(() => centsToValue(10.5)).toThrow(RangeError);
    expect(() => centsToValue(-1)).toThrow(RangeError);
    expect(() => valueToCents("1.234")).toThrow(RangeError);
  });
});

describe("access token", () => {
  it("sends client credentials once and reuses the token", async () => {
    const fake = fakePayPal([{ status: 200, body: authorization }, { status: 200, body: authorization }]);
    const pp = client(fake);
    await pp.getAuthorization("AUTH-1");
    await pp.getAuthorization("AUTH-1");
    expect(fake.tokenCount()).toBe(1);
    const tokenCall = fake.calls[0];
    expect(tokenCall.url).toBe("https://api-m.sandbox.paypal.com/v1/oauth2/token");
    expect(tokenCall.headers.Authorization).toBe(`Basic ${Buffer.from("id:secret").toString("base64")}`);
    expect(tokenCall.body).toBe("grant_type=client_credentials");
    expect(fake.calls[1].headers.Authorization).toBe("Bearer token-1");
  });

  it("refreshes a minute before the token expires", async () => {
    const clock = { t: 0 };
    const fake = fakePayPal([{ status: 200, body: authorization }, { status: 200, body: authorization }], { expiresIn: 3600 });
    const pp = client(fake, clock);
    await pp.getAuthorization("AUTH-1");
    clock.t = (3600 - 59) * 1000;
    await pp.getAuthorization("AUTH-1");
    expect(fake.tokenCount()).toBe(2);
    expect(fake.calls.at(-1)?.headers.Authorization).toBe("Bearer token-2");
  });

  it("gets a new token and retries once when PayPal says 401", async () => {
    const fake = fakePayPal([{ status: 401, body: { name: "AUTHENTICATION_FAILURE" } }, { status: 200, body: authorization }]);
    const auth = await client(fake).getAuthorization("AUTH-1");
    expect(auth.cents).toBe(80000);
    expect(fake.tokenCount()).toBe(2);
  });

  it("surfaces a bad client secret as a PayPalError", async () => {
    const fetch = (async () => Response.json({ error: "invalid_client", error_description: "Client Authentication failed" }, { status: 401 })) as typeof globalThis.fetch;
    const pp = createPayPalClient({ clientId: "id", clientSecret: "wrong", fetch });
    await expect(pp.getAccessToken()).rejects.toMatchObject({ status: 401, name: "invalid_client" });
  });
});

describe("orders and authorizations", () => {
  it("creates an AUTHORIZE order with the milestone id and returns the approve link", async () => {
    const fake = fakePayPal([
      {
        status: 201,
        body: { id: "ORDER-1", status: "PAYER_ACTION_REQUIRED", links: [{ rel: "self", href: "x" }, { rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1" }] },
      },
    ]);
    const order = await client(fake).createAuthorizeOrder({ cents: 80000, description: "Landing page for Northwind", customId: "m-1042", invoiceId: "PP-1042", returnUrl: "https://payplan.test/m/m-1042/fund", requestId: "fund-m-1042" });
    expect(order).toEqual({ id: "ORDER-1", status: "PAYER_ACTION_REQUIRED", approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1" });
    const call = fake.calls[1];
    expect(call.url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders");
    expect(call.headers["PayPal-Request-Id"]).toBe("fund-m-1042");
    expect(call.headers.Prefer).toBe("return=representation");
    expect(call.body).toMatchObject({
      intent: "AUTHORIZE",
      purchase_units: [{ custom_id: "m-1042", reference_id: "m-1042", invoice_id: "PP-1042", amount: { currency_code: "USD", value: "800.00" } }],
      payment_source: { paypal: { experience_context: { return_url: "https://payplan.test/m/m-1042/fund", shipping_preference: "NO_SHIPPING" } } },
    });
  });

  it("names the freelancer's PayPal as the payee, so captures never pass through the platform", async () => {
    const fake = fakePayPal([{ status: 201, body: { id: "ORDER-3", status: "CREATED", links: [] } }]);
    await client(fake).createAuthorizeOrder({ cents: 100000, description: "x", customId: "m-1", payeeEmail: "riya@business.example.com" });
    expect(fake.calls[1].body).toMatchObject({ purchase_units: [{ payee: { email_address: "riya@business.example.com" } }] });
  });

  it("falls back to the older approve link", async () => {
    const fake = fakePayPal([{ status: 201, body: { id: "ORDER-2", status: "CREATED", links: [{ rel: "approve", href: "https://approve" }] } }]);
    const order = await client(fake).createAuthorizeOrder({ cents: 100, description: "x", customId: "m-1" });
    expect(order.approveUrl).toBe("https://approve");
  });

  it("authorizes an approved order and reads the hold", async () => {
    const fake = fakePayPal([{ status: 201, body: { id: "ORDER-1", purchase_units: [{ payments: { authorizations: [authorization] } }] } }]);
    const auth = await client(fake).authorizeOrder("ORDER-1", "auth-m-1042");
    expect(auth).toEqual({ id: "AUTH-1", status: "CREATED", cents: 80000, expirationTime: "2026-11-05T10:00:00Z" });
    expect(fake.calls[1].url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-1/authorize");
  });

  it("captures part of a hold without closing it", async () => {
    const fake = fakePayPal([{ status: 201, body: { id: "CAP-1", status: "COMPLETED", amount: { currency_code: "USD", value: "600.00" }, final_capture: false } }]);
    const cap = await client(fake).captureAuthorization("AUTH-1", { cents: 60000, finalCapture: false, invoiceId: "PP-1042-1", noteToPayer: "3 of 4 criteria met", requestId: "release-m-1042-1" });
    expect(cap).toEqual({ id: "CAP-1", status: "COMPLETED", cents: 60000, finalCapture: false });
    const call = fake.calls[1];
    expect(call.url).toBe("https://api-m.sandbox.paypal.com/v2/payments/authorizations/AUTH-1/capture");
    expect(call.headers["PayPal-Request-Id"]).toBe("release-m-1042-1");
    expect(call.body).toEqual({ amount: { currency_code: "USD", value: "600.00" }, final_capture: false, invoice_id: "PP-1042-1", note_to_payer: "3 of 4 criteria met" });
  });

  it("voids the rest of a hold (204, no body)", async () => {
    const fake = fakePayPal([{ status: 204 }]);
    await expect(client(fake).voidAuthorization("AUTH-1", "void-m-1042")).resolves.toBeUndefined();
    expect(fake.calls[1].url).toBe("https://api-m.sandbox.paypal.com/v2/payments/authorizations/AUTH-1/void");
  });

  it("reauthorizes a hold", async () => {
    const fake = fakePayPal([{ status: 201, body: { ...authorization, id: "AUTH-2" } }]);
    const auth = await client(fake).reauthorizeAuthorization("AUTH-1", { cents: 80000, requestId: "reauth-m-1042" });
    expect(auth.id).toBe("AUTH-2");
  });
});

describe("errors and retries", () => {
  it("turns a 422 into a PayPalError with the issue and debug id", async () => {
    const fake = fakePayPal([
      {
        status: 422,
        body: { name: "UNPROCESSABLE_ENTITY", message: "The requested action could not be performed.", debug_id: "dbg-123", details: [{ issue: "AUTHORIZATION_ALREADY_CAPTURED", description: "Authorization has been previously captured." }] },
      },
    ]);
    const err = await client(fake)
      .captureAuthorization("AUTH-1", { cents: 100, finalCapture: true, requestId: "r" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PayPalError);
    expect(err).toMatchObject({ status: 422, name: "UNPROCESSABLE_ENTITY", issue: "AUTHORIZATION_ALREADY_CAPTURED", debugId: "dbg-123" });
  });

  it("retries a 503 with the same idempotency key", async () => {
    const fake = fakePayPal([{ status: 503, body: {} }, { status: 201, body: { id: "CAP-1", status: "COMPLETED", amount: { value: "1.00" } } }]);
    await client(fake).captureAuthorization("AUTH-1", { cents: 100, finalCapture: true, requestId: "release-1" });
    const captures = fake.calls.filter((c) => c.url.endsWith("/capture"));
    expect(captures).toHaveLength(2);
    expect(captures.map((c) => c.headers["PayPal-Request-Id"])).toEqual(["release-1", "release-1"]);
  });

  it("gives up after three tries", async () => {
    const fake = fakePayPal([{ status: 500 }, { status: 500 }, { status: 500, body: { name: "INTERNAL_SERVER_ERROR", message: "boom" } }]);
    await expect(client(fake).getAuthorization("AUTH-1")).rejects.toMatchObject({ status: 500, name: "INTERNAL_SERVER_ERROR" });
  });

  it("adds an idempotency key to every POST even when none is given", async () => {
    const fake = fakePayPal([{ status: 201, body: { id: "O", status: "CREATED", links: [] } }]);
    await client(fake).createAuthorizeOrder({ cents: 100, description: "x", customId: "m-1" });
    expect(fake.calls[1].headers["PayPal-Request-Id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("webhooks, disputes", () => {
  it("verifies a webhook signature with PayPal", async () => {
    const fake = fakePayPal([{ status: 200, body: { verification_status: "SUCCESS" } }, { status: 200, body: { verification_status: "FAILURE" } }]);
    const pp = client(fake);
    const headers = new Headers({
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.sandbox.paypal.com/cert",
      "paypal-transmission-id": "tid",
      "paypal-transmission-sig": "sig",
      "paypal-transmission-time": "2026-10-07T10:00:00Z",
    });
    const event = { id: "WH-1", event_type: "PAYMENT.CAPTURE.COMPLETED" };
    expect(await pp.verifyWebhookSignature({ webhookId: "WEBHOOK-1", headers, event })).toBe(true);
    expect(fake.calls[1].body).toEqual({
      auth_algo: "SHA256withRSA",
      cert_url: "https://api.sandbox.paypal.com/cert",
      transmission_id: "tid",
      transmission_sig: "sig",
      transmission_time: "2026-10-07T10:00:00Z",
      webhook_id: "WEBHOOK-1",
      webhook_event: event,
    });
    expect(await pp.verifyWebhookSignature({ webhookId: "WEBHOOK-1", headers, event })).toBe(false);
  });

  it("uploads dispute evidence as multipart", async () => {
    const fake = fakePayPal([{ status: 200, body: { links: [] } }]);
    await client(fake).provideDisputeEvidence("PP-D-1", { notes: "Signed acceptance report", file: { name: "report.pdf", data: new Blob(["%PDF"], { type: "application/pdf" }) } });
    const call = fake.calls[1];
    expect(call.url).toBe("https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-1/provide-evidence");
    expect(call.body).toBeInstanceOf(FormData);
    expect(call.headers["Content-Type"]).toBeUndefined();
  });
});
