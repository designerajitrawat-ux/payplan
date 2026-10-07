ALTER TABLE "reports" ADD COLUMN "payload" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "signature" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "signer_key_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_report_hash_unique" UNIQUE("report_hash");