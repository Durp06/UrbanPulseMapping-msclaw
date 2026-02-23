-- Level 1 Tree Inspection columns for trees table
ALTER TABLE "trees" ADD COLUMN "condition_rating" varchar(20);
--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "height_estimate_m" double precision;
--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "canopy_spread_m" double precision;
--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "crown_dieback" boolean;
--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "trunk_defects" jsonb;
--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "location_type" varchar(50);
--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "nearest_address" varchar(500);
--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "site_type" varchar(50);
--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "overhead_utility_conflict" boolean;
--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "maintenance_flag" varchar(20);
--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "sidewalk_damage" boolean;
--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "vacant_planting_site" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "land_use_type" varchar(100);
--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "mulch_soil_condition" varchar(100);
--> statement-breakpoint
ALTER TABLE "trees" ADD COLUMN "risk_flag" boolean;
--> statement-breakpoint
-- Level 1 Tree Inspection columns for observations table
ALTER TABLE "observations" ADD COLUMN "condition_rating" varchar(20);
--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "height_estimate_m" double precision;
--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "canopy_spread_m" double precision;
--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "crown_dieback" boolean;
--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "trunk_defects" jsonb;
--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "location_type" varchar(50);
--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "site_type" varchar(50);
--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "overhead_utility_conflict" boolean;
--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "maintenance_flag" varchar(20);
--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "sidewalk_damage" boolean;
--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "mulch_soil_condition" varchar(100);
--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "risk_flag" boolean;
--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "nearest_address" varchar(500);
