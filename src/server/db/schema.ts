// Postgres schema (Neon in production, PGlite in tests and local runs without a database).
// Money is stored as integer cents. PayPal ids are stored next to every money move so the
// app can always be reconciled against PayPal.

import { sql } from "drizzle-orm";
import { boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const milestoneStatus = pgEnum("milestone_status", ["awaiting_funding", "funded", "verifying", "awaiting_decision", "fix_window", "appealed", "released", "closed"]);
export const approvalMode = pgEnum("approval_mode", ["client", "agent"]);
export const evidenceType = pgEnum("evidence_type", ["url", "image", "pdf", "github", "text"]);
export const checkKind = pgEnum("check_kind", ["automatic", "ai"]);
export const moneyMoveKind = pgEnum("money_move_kind", ["authorization", "capture", "void", "reauthorization"]);
export const moneyMoveStatus = pgEnum("money_move_status", ["pending", "completed", "failed"]);
export const actor = pgEnum("actor", ["client", "freelancer", "agent", "system", "paypal"]);
export const agentOutcome = pgEnum("agent_outcome", ["released", "handed_to_client"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

export type CriterionResultJson = {
  criterionId: string;
  verdict: "pass" | "fail" | "review";
  confidence: number;
  evidence: string;
  reason: string;
};

export type AgentCheckJson = { label: string; detail: string; ok: boolean };

export type PayPalErrorJson = { status?: number; name?: string; issue?: string; debugId?: string; message: string };

export const milestones = pgTable(
  "milestones",
  {
    id: text("id").primaryKey(),
    /** The browser workspace that created it. Until sign-in exists, a workspace can act as both sides. */
    workspaceId: text("workspace_id").notNull(),
    /** Short number people can say out loud ("M-1051"). */
    number: serial("number").notNull().unique(),
    title: text("title").notNull(),
    brief: text("brief").notNull().default(""),
    clientName: text("client_name").notNull(),
    clientEmail: text("client_email").notNull(),
    freelancerName: text("freelancer_name").notNull(),
    freelancerEmail: text("freelancer_email").notNull(),
    freelancerLocation: text("freelancer_location").notNull().default(""),
    /** The freelancer's PayPal: the order names it as payee, so captures land there directly. */
    freelancerPaypalEmail: text("freelancer_paypal_email"),
    boughtByAgent: boolean("bought_by_agent").notNull().default(false),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    reviewWindowHours: integer("review_window_hours").notNull(),
    fixWindowHours: integer("fix_window_hours").notNull().default(72),
    /** SHA-256 of the agreed spec. Both sides see it; any change to the spec changes it. */
    specHash: text("spec_hash").notNull(),
    status: milestoneStatus("status").notNull().default("awaiting_funding"),
    approval: approvalMode("approval").notNull().default("client"),
    paypalOrderId: text("paypal_order_id").unique(),
    paypalAuthorizationId: text("paypal_authorization_id").unique(),
    authorizationExpiresAt: ts("authorization_expires_at"),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    fundedAt: ts("funded_at"),
    verifyStartedAt: ts("verify_started_at"),
    decisionDueAt: ts("decision_due_at"),
    fixDueAt: ts("fix_due_at"),
    appealReason: text("appeal_reason"),
    appealedAt: ts("appealed_at"),
    /** Bumped on every change; used to reject stale writes. */
    version: integer("version").notNull().default(0),
  },
  (t) => [index("milestones_workspace_idx").on(t.workspaceId), index("milestones_status_idx").on(t.status), index("milestones_client_email_idx").on(t.clientEmail), index("milestones_freelancer_email_idx").on(t.freelancerEmail)],
);

export const criteria = pgTable(
  "criteria",
  {
    id: text("id").primaryKey(),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestones.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    weight: integer("weight").notNull(),
    mustPass: boolean("must_pass").notNull().default(false),
    evidence: evidenceType("evidence").notNull(),
    check: checkKind("check").notNull(),
  },
  (t) => [uniqueIndex("criteria_milestone_position_idx").on(t.milestoneId, t.position)],
);

export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestones.id, { onDelete: "cascade" }),
    attempt: integer("attempt").notNull(),
    url: text("url").notNull().default(""),
    prLink: text("pr_link").notNull().default(""),
    files: jsonb("files").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    note: text("note").notNull().default(""),
    submittedAt: ts("submitted_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("submissions_milestone_attempt_idx").on(t.milestoneId, t.attempt)],
);

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestones.id, { onDelete: "cascade" }),
    attempt: integer("attempt").notNull(),
    results: jsonb("results").$type<CriterionResultJson[]>().notNull(),
    /** Which model and prompt produced the verdicts, for the audit trail. */
    model: text("model").notNull(),
    verifiedAt: ts("verified_at").notNull(),
    /** SHA-256 of the signed payload. Also the report's public id (/r/<hash>). */
    reportHash: text("report_hash").notNull().unique(),
    /** Exactly what was signed: canonical JSON of this object. */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    /** Ed25519 signature (base64) and the fingerprint of the key that made it. */
    signature: text("signature").notNull().default(""),
    signerKeyId: text("signer_key_id").notNull().default(""),
  },
  (t) => [uniqueIndex("reports_milestone_attempt_idx").on(t.milestoneId, t.attempt)],
);

/**
 * Every PayPal money move. A row is written as "pending" with its PayPal-Request-Id before
 * PayPal is called, so a retry after a crash reuses the same key and can never move money twice.
 */
export const moneyMoves = pgTable(
  "money_moves",
  {
    id: serial("id").primaryKey(),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestones.id, { onDelete: "cascade" }),
    kind: moneyMoveKind("kind").notNull(),
    status: moneyMoveStatus("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull(),
    requestId: text("request_id").notNull().unique(),
    finalCapture: boolean("final_capture"),
    invoiceId: text("invoice_id"),
    paypalId: text("paypal_id"),
    note: text("note").notNull().default(""),
    error: jsonb("error").$type<PayPalErrorJson>(),
    createdAt: createdAt(),
    completedAt: ts("completed_at"),
  },
  (t) => [index("money_moves_milestone_idx").on(t.milestoneId)],
);

/** What the client's AI agent may do. One per workspace; the PayPal hold stays the hard ceiling. */
export const agentMandates = pgTable("agent_mandates", {
  id: serial("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().unique(),
  ownerName: text("owner_name").notNull(),
  name: text("name").notNull(),
  perMilestoneLimitCents: integer("per_milestone_limit_cents").notNull(),
  minConfidence: doublePrecision("min_confidence").notNull(),
  releaseVerified: boolean("release_verified").notNull().default(true),
  fundMilestones: boolean("fund_milestones").notNull().default(false),
  /** SHA-256 of the key the client's own agent sends to the MCP endpoint. The key itself is shown once. */
  agentKeyHash: text("agent_key_hash").unique(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const agentDecisions = pgTable(
  "agent_decisions",
  {
    id: serial("id").primaryKey(),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestones.id, { onDelete: "cascade" }),
    reportAttempt: integer("report_attempt").notNull(),
    outcome: agentOutcome("outcome").notNull(),
    amountCents: integer("amount_cents").notNull(),
    checks: jsonb("checks").$type<AgentCheckJson[]>().notNull(),
    decidedAt: ts("decided_at").notNull(),
  },
  (t) => [index("agent_decisions_milestone_idx").on(t.milestoneId)],
);

/** The activity timeline both sides see. */
export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    milestoneId: text("milestone_id")
      .notNull()
      .references(() => milestones.id, { onDelete: "cascade" }),
    actor: actor("actor").notNull(),
    type: text("type").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    at: ts("at").notNull(),
  },
  (t) => [index("events_milestone_at_idx").on(t.milestoneId, t.at)],
);

/** PayPal webhooks, keyed by PayPal's event id so a redelivered event is processed once. */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  resourceId: text("resource_id"),
  verified: boolean("verified").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  receivedAt: createdAt(),
  processedAt: ts("processed_at"),
});

export type MilestoneRow = typeof milestones.$inferSelect;
export type CriterionRow = typeof criteria.$inferSelect;
export type SubmissionRow = typeof submissions.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;
export type MoneyMoveRow = typeof moneyMoves.$inferSelect;
export type AgentMandateRow = typeof agentMandates.$inferSelect;
export type AgentDecisionRow = typeof agentDecisions.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type MilestoneStatus = (typeof milestoneStatus.enumValues)[number];
