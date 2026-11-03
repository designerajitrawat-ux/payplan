// PayPal webhooks: verify with PayPal, store once per event id, then apply.

import { eq } from "drizzle-orm";
import type { Services } from "../app";
import { webhookEvents } from "../db/schema";
import { errorJson } from "../milestones/service";
import { reportPdf } from "../reports/pdf";

type PayPalEvent = {
  id: string;
  event_type: string;
  resource?: Record<string, unknown> & { id?: string; invoice_id?: string; status?: string; custom_id?: string };
};

export type WebhookResult = { status: number; body: Record<string, unknown> };

/**
 * A dispute opened on one of our captures reached us: answer it through the Disputes API with the
 * signed acceptance report as a PDF. A dispute on the freelancer's own PayPal account never reaches
 * PayPlan; there the freelancer attaches the same PDF in PayPal's Resolution Center.
 */
async function sendEvidence(s: Services, milestoneId: string, disputeId: string) {
  if (!s.paypalClient) return false;
  const report = await s.milestones.latestVerifiedReport(milestoneId);
  if (!report?.valid) return false;
  const pdf = reportPdf(report, `${s.appUrl ?? ""}/r/${report.reportHash}`);
  try {
    await s.paypalClient.provideDisputeEvidence(disputeId, {
      notes: "The client and freelancer agreed these acceptance criteria before any money moved. The attached report, signed by PayPlan, shows what was checked, the evidence, and the share PayPal captured for the criteria that passed.",
      file: { name: `payplan-report-${report.reportHash.slice(0, 8)}.pdf`, data: new Blob([Buffer.from(pdf)], { type: "application/pdf" }) },
    });
    await s.milestones.notePayPalEvent(milestoneId, "dispute_evidence_sent", { disputeId, reportHash: report.reportHash });
    return true;
  } catch (error) {
    await s.milestones.notePayPalEvent(milestoneId, "dispute_evidence_failed", { disputeId, ...errorJson(error) });
    return false;
  }
}

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
      const applied = id ? await svc.notePayPalEvent(id, type, { disputeId: r.dispute_id, reason: r.reason, status: r.status, eventId: event.id }) : false;
      const evidenceSent = id && event.event_type === "CUSTOMER.DISPUTE.CREATED" && typeof r.dispute_id === "string" ? await sendEvidence(s, id, r.dispute_id) : false;
      return { applied, evidenceSent };
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
