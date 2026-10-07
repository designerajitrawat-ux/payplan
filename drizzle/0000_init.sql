CREATE TYPE "public"."actor" AS ENUM('client', 'freelancer', 'agent', 'system', 'paypal');--> statement-breakpoint
CREATE TYPE "public"."agent_outcome" AS ENUM('released', 'handed_to_client');--> statement-breakpoint
CREATE TYPE "public"."approval_mode" AS ENUM('client', 'agent');--> statement-breakpoint
CREATE TYPE "public"."check_kind" AS ENUM('automatic', 'ai');--> statement-breakpoint
CREATE TYPE "public"."evidence_type" AS ENUM('url', 'image', 'pdf', 'github', 'text');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('awaiting_funding', 'funded', 'verifying', 'awaiting_decision', 'fix_window', 'appealed', 'released', 'closed');--> statement-breakpoint
CREATE TYPE "public"."money_move_kind" AS ENUM('authorization', 'capture', 'void', 'reauthorization');--> statement-breakpoint
CREATE TYPE "public"."money_move_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "agent_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"milestone_id" text NOT NULL,
	"report_attempt" integer NOT NULL,
	"outcome" "agent_outcome" NOT NULL,
	"amount_cents" integer NOT NULL,
	"checks" jsonb NOT NULL,
	"decided_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_mandates" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"owner_name" text NOT NULL,
	"name" text NOT NULL,
	"per_milestone_limit_cents" integer NOT NULL,
	"min_confidence" double precision NOT NULL,
	"release_verified" boolean DEFAULT true NOT NULL,
	"fund_milestones" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_mandates_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "criteria" (
	"id" text PRIMARY KEY NOT NULL,
	"milestone_id" text NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"weight" integer NOT NULL,
	"must_pass" boolean DEFAULT false NOT NULL,
	"evidence" "evidence_type" NOT NULL,
	"check" "check_kind" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"milestone_id" text NOT NULL,
	"actor" "actor" NOT NULL,
	"type" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"number" serial NOT NULL,
	"title" text NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"client_name" text NOT NULL,
	"client_email" text NOT NULL,
	"freelancer_name" text NOT NULL,
	"freelancer_email" text NOT NULL,
	"freelancer_location" text DEFAULT '' NOT NULL,
	"freelancer_paypal_email" text,
	"bought_by_agent" boolean DEFAULT false NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"review_window_hours" integer NOT NULL,
	"fix_window_hours" integer DEFAULT 72 NOT NULL,
	"spec_hash" text NOT NULL,
	"status" "milestone_status" DEFAULT 'awaiting_funding' NOT NULL,
	"approval" "approval_mode" DEFAULT 'client' NOT NULL,
	"paypal_order_id" text,
	"paypal_authorization_id" text,
	"authorization_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"funded_at" timestamp with time zone,
	"verify_started_at" timestamp with time zone,
	"decision_due_at" timestamp with time zone,
	"fix_due_at" timestamp with time zone,
	"appeal_reason" text,
	"appealed_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "milestones_number_unique" UNIQUE("number"),
	CONSTRAINT "milestones_paypal_order_id_unique" UNIQUE("paypal_order_id"),
	CONSTRAINT "milestones_paypal_authorization_id_unique" UNIQUE("paypal_authorization_id")
);
--> statement-breakpoint
CREATE TABLE "money_moves" (
	"id" serial PRIMARY KEY NOT NULL,
	"milestone_id" text NOT NULL,
	"kind" "money_move_kind" NOT NULL,
	"status" "money_move_status" DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"request_id" text NOT NULL,
	"final_capture" boolean,
	"invoice_id" text,
	"paypal_id" text,
	"note" text DEFAULT '' NOT NULL,
	"error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "money_moves_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"milestone_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"results" jsonb NOT NULL,
	"model" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"report_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"milestone_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"pr_link" text DEFAULT '' NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"resource_id" text,
	"verified" boolean NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criteria" ADD CONSTRAINT "criteria_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_moves" ADD CONSTRAINT "money_moves_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_decisions_milestone_idx" ON "agent_decisions" USING btree ("milestone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "criteria_milestone_position_idx" ON "criteria" USING btree ("milestone_id","position");--> statement-breakpoint
CREATE INDEX "events_milestone_at_idx" ON "events" USING btree ("milestone_id","at");--> statement-breakpoint
CREATE INDEX "milestones_workspace_idx" ON "milestones" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "milestones_status_idx" ON "milestones" USING btree ("status");--> statement-breakpoint
CREATE INDEX "milestones_client_email_idx" ON "milestones" USING btree ("client_email");--> statement-breakpoint
CREATE INDEX "milestones_freelancer_email_idx" ON "milestones" USING btree ("freelancer_email");--> statement-breakpoint
CREATE INDEX "money_moves_milestone_idx" ON "money_moves" USING btree ("milestone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_milestone_attempt_idx" ON "reports" USING btree ("milestone_id","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_milestone_attempt_idx" ON "submissions" USING btree ("milestone_id","attempt");