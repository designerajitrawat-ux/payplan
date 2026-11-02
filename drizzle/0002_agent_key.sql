ALTER TABLE "agent_mandates" ADD COLUMN "agent_key_hash" text;--> statement-breakpoint
ALTER TABLE "agent_mandates" ADD CONSTRAINT "agent_mandates_agent_key_hash_unique" UNIQUE("agent_key_hash");