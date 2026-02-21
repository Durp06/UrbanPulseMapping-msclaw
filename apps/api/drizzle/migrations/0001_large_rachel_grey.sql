DO $$ BEGIN
 CREATE TYPE "public"."contract_status" AS ENUM('draft', 'active', 'completed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."zone_status" AS ENUM('active', 'completed', 'paused', 'upcoming');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."zone_type" AS ENUM('zip_code', 'street_corridor');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"zone_type" "zone_type" NOT NULL,
	"zone_identifier" varchar(100) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"buffer_meters" integer DEFAULT 50 NOT NULL,
	"start_cross_street" varchar(200),
	"end_cross_street" varchar(200),
	"corridor_name" varchar(200),
	"status" "zone_status" DEFAULT 'upcoming' NOT NULL,
	"progress_percentage" real DEFAULT 0 NOT NULL,
	"tree_target_count" integer,
	"trees_mapped_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_name" varchar(200) NOT NULL,
	"contract_name" varchar(300) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "contract_status" DEFAULT 'draft' NOT NULL,
	"total_budget" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "contract_zone_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contract_zones" ADD CONSTRAINT "contract_zones_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_zones_contract_idx" ON "contract_zones" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_zones_status_idx" ON "contract_zones" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_zones_type_idx" ON "contract_zones" USING btree ("zone_type");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trees" ADD CONSTRAINT "trees_contract_zone_id_contract_zones_id_fk" FOREIGN KEY ("contract_zone_id") REFERENCES "public"."contract_zones"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trees_contract_zone_idx" ON "trees" USING btree ("contract_zone_id");