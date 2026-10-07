// Builds the app's services once per server process.

import { createDb, type Db } from "./db/client";
import { createMilestoneService, type MilestoneService, type PaymentGateway } from "./milestones/service";
import { createPayPalClient, type PayPalClient } from "./paypal/client";
import { createSimulatedPayPal } from "./paypal/simulated";
import { judgeFromEnv, type Judge } from "./verifier/judge";
import type { CheckerOptions } from "./verifier/run";
import { signerFromEnv } from "./signing";

export type PayPalMode = "sandbox" | "live" | "simulated";

export type Services = {
  db: Db;
  database: "postgres" | "embedded";
  paypalMode: PayPalMode;
  paypal: PaymentGateway;
  /** Only the real client can check webhook signatures. */
  paypalClient?: PayPalClient;
  /** Only in simulated mode: stands in for the client approving on PayPal. */
  simulated?: ReturnType<typeof createSimulatedPayPal>;
  milestones: MilestoneService;
  webhookId?: string;
  judge: Judge;
  /** Settings for the checker's real tests. */
  checker: CheckerOptions;
  /** Buttons that end a review or fix window early, so the demo does not take days. */
  demoControls: boolean;
};

/**
 * Real PayPal (sandbox) whenever keys are set. Without keys, a simulated PayPal that keeps its
 * state in this process, so the app still runs locally; every screen says so.
 */
export async function buildServices(env: Record<string, string | undefined> = process.env): Promise<Services> {
  const db = await createDb(env);
  const database = env.DATABASE_URL ? "postgres" : "embedded";
  const checker: CheckerOptions = { pagespeedKey: env.PAGESPEED_API_KEY, allowPrivate: env.NODE_ENV !== "production" || env.ALLOW_PRIVATE_URLS === "1" };
  const common = { db, database, judge: judgeFromEnv(env), checker, demoControls: env.DEMO_TIME_CONTROLS !== "off" } as const;
  const signer = signerFromEnv(env);
  if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_ENV !== "simulated") {
    const paypalMode = env.PAYPAL_ENV === "live" ? "live" : "sandbox";
    const paypalClient = createPayPalClient({ clientId: env.PAYPAL_CLIENT_ID, clientSecret: env.PAYPAL_CLIENT_SECRET, env: paypalMode });
    return { ...common, paypalMode, paypal: paypalClient, paypalClient, milestones: createMilestoneService({ db, paypal: paypalClient, signer }), webhookId: env.PAYPAL_WEBHOOK_ID };
  }
  const simulated = createSimulatedPayPal();
  return { ...common, paypalMode: "simulated", paypal: simulated.gateway, simulated, milestones: createMilestoneService({ db, paypal: simulated.gateway, signer }) };
}

const holder = globalThis as unknown as { __payplanServices?: Promise<Services> };

/** Kept on globalThis so hot reloads in development reuse one database connection. */
export function services(): Promise<Services> {
  holder.__payplanServices ??= buildServices().catch((error: unknown) => {
    holder.__payplanServices = undefined;
    throw error;
  });
  return holder.__payplanServices;
}
