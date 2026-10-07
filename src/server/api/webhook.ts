// PayPal webhooks: verify with PayPal, store once per event id, then apply.

import { eq } from "drizzle-orm";
import type { Services } from "../app";
import { webhookEvents } from "../db/schema";

type PayPalEvent = {
  id: string;
  event_type: string;
  resource?: Record<string, unknown> & { id?: string; invoice_id?: string; status?: string; custom_id?: string };
};

export type WebhookResult = { status: number; body: Record<string, unknown> };

/** Captures and holds point back to a milestone through our invoice id and PayPal's ids. */
async function apply(s: Services, event: PayPalEvent) {
  const r = event.resource ?? {};
  const svc = s.milestones;
  switch (event.event_type) {
    case "PAYMENT.CAPTURE.COMPLETED":
    case "PAYMENT.CAPTURE.DECLINED":
    case "PAYMENT.CAPTURE.DENIED": {
      if (!r.invoice_id || !r.id) return { applied: false };
      const status = event.event_type === "PAYMENT.CAPTURE.COMPLETED" ? "COMPLETED" : event.event_type.endsWith("DECLINED") ? "DECLINED" : "DENIED";
      return svc.reconcileCapture({ invoiceId: r.invoice_id, captureId: r.id, status });
    }
    case "PAYMENT.CAPTURE.REFUNDED":
    case "PAYMENT.CAPTURE.REVERSED":
    case "PAYMENT.AUTHORIZATION.VOIDED": {
      const captureId = event.event_type === "PAYMENT.AUTHORIZATION.VOIDED" ? undefined : (r.id as string | undefined);
      const authorizationId = event.event_type === "PAYMENT.AUTHORIZATION.VOIDED" ? r.id : undefined;
      const id = (r.custom_id as string | undefined) ?? (await svc.findByPayPalId({ authorizationId, captureId }));
      const type = { "PAYMENT.CAPTURE.REFUNDED": "refunded", "PAYMENT.CAPTURE.REVERSED": "reversed", "PAYMENT.AUTHORIZATION.VOIDED": "hold_voided" }[event.event_type]!;
      return { applied: id ? await svc.notePayPalEvent(id, type, { paypalId: r.id, eventId: event.id }) : false };
    }
    case "CUSTOMER.DISPUTE.CREATED":
    case "CUSTOMER.DISPUTE.UPDATED":
    case "CUSTOMER.DISPUTE.RESOLVED": {
      const tx = (r.disputed_transactions as { seller_transaction_id?: string; invoice_number?: string }[] | undefined)?.[0];
      const id = await svc.findByPayPalId({ captureId: tx?.seller_transaction_id });
      const type = `dispute_${event.event_type.split(".").at(-1)!.toLowerCase()}`;
      return { applied: id ? await svc.notePayPalEvent(id, type, { disputeId: r.dispute_id, reason: r.reason, status: r.status, eventId: event.id }) : false };
    }
    default:
      return { applied: false };
  }
}

export async function handleWebhook(s: Services, headers: Headers, rawBody: string): Promise<WebhookResult> {
  let event: PayPalEvent;
  try {
    event = JSON.parse(rawBody) as PayPalEvent;
  } catch {
    return { status: 400, body: { error: "Body is not JSON" } };
  }
  if (!event?.id || !event.event_type) return { status: 400, body: { error: "Not a PayPal event" } };

  let verified = false;
  if (s.paypalClient) {
    if (!s.webhookId) return { status: 503, body: { error: "PAYPAL_WEBHOOK_ID is not set" } };
    verified = await s.paypalClient.verifyWebhookSignature({ webhookId: s.webhookId, headers, event });
    if (!verified) return { status: 401, body: { error: "Signature check failed" } };
  }

  await s.db
    .insert(webhookEvents)
    .values({ id: event.id, eventType: event.event_type, resourceId: event.resource?.id ?? null, verified, payload: event as unknown as Record<string, unknown> })
    .onConflictDoNothing();
  const [stored] = await s.db.select().from(webhookEvents).where(eq(webhookEvents.id, event.id));
  if (stored?.processedAt) return { status: 200, body: { duplicate: true } };

  const result = await apply(s, event);
  await s.db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.id, event.id));
  return { status: 200, body: { ok: true, ...result } };
}
