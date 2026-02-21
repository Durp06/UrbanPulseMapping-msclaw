DO $$ BEGIN
 CREATE TYPE "public"."observation_status" AS ENUM('pending_upload', 'pending_ai', 'pending_review', 'verified', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid,
	"user_id" uuid NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"gps_accuracy_meters" double precision,
	"status" "observation_status" DEFAULT 'pending_upload' NOT NULL,
	"ai_species_result" text,
	"ai_health_result" text,
	"ai_measurement_result" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"observation_id" uuid NOT NULL,
	"photo_type" varchar(20) NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"storage_url" text,
	"width_px" integer,
	"height_px" integer,
	"file_size_bytes" integer,
	"mime_type" varchar(50),
	"captured_at" timestamp,
	"device_model" varchar(100),
	"os_version" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"species_common" varchar(200),
	"species_scientific" varchar(200),
	"species_confidence" double precision,
	"health_status" varchar(50),
	"health_confidence" double precision,
	"estimated_dbh_cm" double precision,
	"estimated_height_m" double precision,
	"observation_count" integer DEFAULT 0 NOT NULL,
	"unique_observer_count" integer DEFAULT 0 NOT NULL,
	"last_observed_at" timestamp,
	"cooldown_until" timestamp,
	"verification_tier" varchar(20) DEFAULT 'unverified',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firebase_uid" varchar(128) NOT NULL,
	"email" varchar(255),
	"display_name" varchar(100),
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "observations" ADD CONSTRAINT "observations_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "observations" ADD CONSTRAINT "observations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "photos" ADD CONSTRAINT "photos_observation_id_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "observations_tree_idx" ON "observations" USING btree ("tree_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "observations_user_idx" ON "observations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "observations_status_idx" ON "observations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trees_cooldown_idx" ON "trees" USING btree ("cooldown_until");