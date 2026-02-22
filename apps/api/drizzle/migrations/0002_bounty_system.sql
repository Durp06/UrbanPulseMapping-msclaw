DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('user', 'developer', 'admin');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."bounty_status" AS ENUM('draft', 'active', 'paused', 'completed', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."bounty_claim_status" AS ENUM('pending', 'approved', 'paid', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bounties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"contract_zone_id" uuid,
	"title" varchar(300) NOT NULL,
	"description" text NOT NULL,
	"zone_type" "zone_type" NOT NULL,
	"zone_identifier" varchar(100) NOT NULL,
	"bounty_amount_cents" integer NOT NULL,
	"bonus_threshold" integer,
	"bonus_amount_cents" integer,
	"total_budget_cents" integer NOT NULL,
	"spent_cents" integer DEFAULT 0 NOT NULL,
	"status" "bounty_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"tree_target_count" integer NOT NULL,
	"trees_completed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bounty_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bounty_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"tree_id" uuid NOT NULL,
	"observation_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "bounty_claim_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bounties" ADD COLUMN "geometry" geometry(MultiPolygon, 4326);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bounties" ADD CONSTRAINT "bounties_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bounties" ADD CONSTRAINT "bounties_contract_zone_id_contract_zones_id_fk" FOREIGN KEY ("contract_zone_id") REFERENCES "public"."contract_zones"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bounty_claims" ADD CONSTRAINT "bounty_claims_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bounty_claims" ADD CONSTRAINT "bounty_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bounty_claims" ADD CONSTRAINT "bounty_claims_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bounty_claims" ADD CONSTRAINT "bounty_claims_observation_id_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bounties_creator_idx" ON "bounties" USING btree ("creator_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bounties_status_idx" ON "bounties" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bounties_contract_zone_idx" ON "bounties" USING btree ("contract_zone_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bounties_geometry_idx" ON "bounties" USING gist ("geometry");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bounty_claims_bounty_idx" ON "bounty_claims" USING btree ("bounty_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bounty_claims_user_idx" ON "bounty_claims" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bounty_claims_tree_idx" ON "bounty_claims" USING btree ("tree_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bounty_claims_observation_idx" ON "bounty_claims" USING btree ("observation_id");
