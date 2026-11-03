// An in-memory stand-in for PayPal with the same rules that matter to PayPlan: idempotency
// keys replay the first result, captures can never exceed the hold, a voided or fully captured
// hold takes no more captures. Used by tests, and by local runs that have no sandbox keys.

import { PayPalError, type AuthorizeOrderInput } from "./client";
import type { PaymentGateway } from "../milestones/service";

type Hold = { orderId: string; amount: number; captured: number; closed: boolean; reauthorized?: boolean };
type Failure = { method: keyof PaymentGateway; error: Error; afterPayPalActs: boolean };

// Shared by every instance: PayPal ids are unique everywhere, so simulated ones must be too.
let seq = 1000;

export function createSimulatedPayPal() {
  const replies = new Map<string, unknown>();
  const orders = new Map<string, { cents: number; approved: boolean }>();
  const holds = new Map<string, Hold>();
  const calls: { method: keyof PaymentGateway; requestId?: string; args: unknown[] }[] = [];
  const failures: Failure[] = [];

  const nextId = (prefix: string) => `${prefix}-SIM${++seq}`;

  /** Runs `act` once per idempotency key, like PayPal-Request-Id does. */
  async function call<T>(method: keyof PaymentGateway, requestId: string, args: unknown[], act: () => T): Promise<T> {
    calls.push({ method, requestId, args });
    const i = failures.findIndex((f) => f.method === method);
    const failure = i >= 0 ? failures.splice(i, 1)[0] : undefined;
    if (failure && !failure.afterPayPalActs) throw failure.error;
    const result = replies.has(requestId) ? (replies.get(requestId) as T) : act();
    replies.set(requestId, result);
    if (failure) throw failure.error;
    return result;
  }

  const unprocessable = (issue: string, description: string) =>
    new PayPalError(422, "UNPROCESSABLE_ENTITY", "The requested action could not be performed.", issue, `sim-${seq}`, [{ issue, description }]);

  const gateway: PaymentGateway = {
    createAuthorizeOrder: (input: AuthorizeOrderInput) =>
      call("createAuthorizeOrder", input.requestId ?? nextId("REQ"), [input], () => {
        const id = nextId("ORDER");
        orders.set(id, { cents: input.cents, approved: false });
        return { id, status: "PAYER_ACTION_REQUIRED", approveUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${id}` };
      }),

    authorizeOrder: (orderId: string, requestId?: string) =>
      call("authorizeOrder", requestId ?? nextId("REQ"), [orderId], () => {
        const order = orders.get(orderId);
        if (!order) throw new PayPalError(404, "RESOURCE_NOT_FOUND", "The specified resource does not exist.", "INVALID_RESOURCE_ID", `sim-${seq}`);
        if (!order.approved) throw unprocessable("ORDER_NOT_APPROVED", "Payer has not yet approved the Order for payment.");
        const id = nextId("AUTH");
        holds.set(id, { orderId, amount: order.cents, captured: 0, closed: false });
        return { id, status: "CREATED", cents: order.cents, expirationTime: new Date(Date.now() + 29 * 86_400_000).toISOString() };
      }),

    captureAuthorization: (authorizationId, input) =>
      call("captureAuthorization", input.requestId, [authorizationId, input], () => {
        const hold = holds.get(authorizationId);
        if (!hold) throw new PayPalError(404, "RESOURCE_NOT_FOUND", "The specified resource does not exist.", "INVALID_RESOURCE_ID", `sim-${seq}`);
        if (hold.closed) throw unprocessable("AUTHORIZATION_ALREADY_CAPTURED", "Authorization has been previously captured or voided.");
        if (hold.captured + input.cents > hold.amount) throw unprocessable("MAX_CAPTURE_AMOUNT_EXCEEDED", "Capture amount exceeds allowable limit.");
        hold.captured += input.cents;
        if (input.finalCapture) hold.closed = true;
        return { id: nextId("CAP"), status: "COMPLETED", cents: input.cents, finalCapture: input.finalCapture };
      }),

    voidAuthorization: (authorizationId, requestId) =>
      call("voidAuthorization", requestId, [authorizationId], () => {
        const hold = holds.get(authorizationId);
        if (!hold) throw new PayPalError(404, "RESOURCE_NOT_FOUND", "The specified resource does not exist.", "INVALID_RESOURCE_ID", `sim-${seq}`);
        if (hold.closed) throw unprocessable("AUTHORIZATION_ALREADY_CAPTURED", "Authorization has been previously captured or voided.");
        hold.closed = true;
      }),

    reauthorizeAuthorization: (authorizationId, input) =>
      call("reauthorizeAuthorization", input.requestId, [authorizationId, input], () => {
        const hold = holds.get(authorizationId);
        if (!hold) throw new PayPalError(404, "RESOURCE_NOT_FOUND", "The specified resource does not exist.", "INVALID_RESOURCE_ID", `sim-${seq}`);
        if (hold.closed) throw unprocessable("AUTHORIZATION_ALREADY_CAPTURED", "Authorization has been previously captured or voided.");
        if (hold.reauthorized) throw unprocessable("REAUTHORIZATION_NOT_ALLOWED", "A reauthorized payment cannot be reauthorized again.");
        if (input.cents > hold.amount - hold.captured) throw unprocessable("MAX_AUTHORIZATION_AMOUNT_EXCEEDED", "Reauthorization amount exceeds what is left.");
        // PayPal answers with a new authorization; captures and voids move to it.
        hold.closed = true;
        const id = nextId("AUTH");
        holds.set(id, { orderId: hold.orderId, amount: input.cents, captured: 0, closed: false, reauthorized: true });
        return { id, status: "CREATED", cents: input.cents, expirationTime: new Date(Date.now() + 29 * 86_400_000).toISOString() };
      }),
  };

  return {
    gateway,
    calls,
    holds,
    /** What the client does on PayPal's approval page. */
    approve(orderId: string) {
      const order = orders.get(orderId);
      if (order) order.approved = true;
    },
    /** Makes the next call to `method` fail. With afterPayPalActs, PayPal does the work but the reply is lost. */
    failNext(method: keyof PaymentGateway, error: Error, afterPayPalActs = false) {
      failures.push({ method, error, afterPayPalActs });
    },
  };
}
