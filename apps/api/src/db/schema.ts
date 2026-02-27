import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  doublePrecision,
  integer,
  boolean,
  jsonb,
  index,
  pgEnum,
  date,
  real,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const observationStatusEnum = pgEnum('observation_status', [
  'pending_upload',
  'pending_ai',
  'pending_review',
  'verified',
  'rejected',
]);

export const contractStatusEnum = pgEnum('contract_status', [
  'draft',
  'active',
  'completed',
  'cancelled',
]);

export const zoneTypeEnum = pgEnum('zone_type', [
  'zip_code',
  'street_corridor',
]);

export const zoneStatusEnum = pgEnum('zone_status', [
  'active',
  'completed',
  'paused',
  'upcoming',
]);

export const userRoleEnum = pgEnum('user_role', [
  'user',
  'developer',
  'admin',
]);

export const bountyStatusEnum = pgEnum('bounty_status', [
  'draft',
  'active',
  'paused',
  'completed',
  'expired',
]);

export const bountyClaimStatusEnum = pgEnum('bounty_claim_status', [
  'pending',
  'approved',
  'paid',
  'rejected',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseUid: varchar('firebase_uid', { length: 128 }).notNull().unique(),
  email: varchar('email', { length: 255 }),
  displayName: varchar('display_name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const contracts = pgTable('contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  municipalityName: varchar('municipality_name', { length: 200 }).notNull(),
  contractName: varchar('contract_name', { length: 300 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: contractStatusEnum('status').default('draft').notNull(),
  totalBudget: doublePrecision('total_budget'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const contractZones = pgTable(
  'contract_zones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contractId: uuid('contract_id')
      .references(() => contracts.id)
      .notNull(),
    zoneType: zoneTypeEnum('zone_type').notNull(),
    zoneIdentifier: varchar('zone_identifier', { length: 100 }).notNull(),
    displayName: varchar('display_name', { length: 200 }).notNull(),
    // geometry and centerline are managed via raw SQL (PostGIS)
    bufferMeters: integer('buffer_meters').default(50).notNull(),
    startCrossStreet: varchar('start_cross_street', { length: 200 }),
    endCrossStreet: varchar('end_cross_street', { length: 200 }),
    corridorName: varchar('corridor_name', { length: 200 }),
    status: zoneStatusEnum('status').default('upcoming').notNull(),
    progressPercentage: real('progress_percentage').default(0).notNull(),
    treeTargetCount: integer('tree_target_count'),
    treesMappedCount: integer('trees_mapped_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    contractIdx: index('contract_zones_contract_idx').on(table.contractId),
    statusIdx: index('contract_zones_status_idx').on(table.status),
    zoneTypeIdx: index('contract_zones_type_idx').on(table.zoneType),
  })
);

export const trees = pgTable(
  'trees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    speciesCommon: varchar('species_common', { length: 200 }),
    speciesScientific: varchar('species_scientific', { length: 200 }),
    speciesGenus: varchar('species_genus', { length: 200 }),
    speciesConfidence: doublePrecision('species_confidence'),
    conditionStructural: varchar('condition_structural', { length: 50 }),
    conditionLeaf: varchar('condition_leaf', { length: 50 }),
    healthStatus: varchar('health_status', { length: 50 }),
    healthConfidence: doublePrecision('health_confidence'),
    observations: text('observations'),
    estimatedDbhCm: doublePrecision('estimated_dbh_cm'),
    estimatedDbhIn: doublePrecision('estimated_dbh_in'),
    estimatedHeightM: doublePrecision('estimated_height_m'),
    estimatedHeightFt: doublePrecision('estimated_height_ft'),
    estimatedCrownWidthM: doublePrecision('estimated_crown_width_m'),
    estimatedCrownWidthFt: doublePrecision('estimated_crown_width_ft'),
    numStems: integer('num_stems').default(1),
    observationCount: integer('observation_count').default(0).notNull(),
    uniqueObserverCount: integer('unique_observer_count').default(0).notNull(),
    lastObservedAt: timestamp('last_observed_at'),
    cooldownUntil: timestamp('cooldown_until'),
    verificationTier: varchar('verification_tier', { length: 20 }).default('unverified'),
    contractZoneId: uuid('contract_zone_id').references(() => contractZones.id),
    // Level 1 inspection fields
    conditionRating: varchar('condition_rating', { length: 20 }),
    heightEstimateM: doublePrecision('height_estimate_m'),
    canopySpreadM: doublePrecision('canopy_spread_m'),
    crownDieback: boolean('crown_dieback'),
    trunkDefects: jsonb('trunk_defects'),
    locationType: varchar('location_type', { length: 50 }),
    nearestAddress: varchar('nearest_address', { length: 500 }),
    siteType: varchar('site_type', { length: 50 }),
    overheadUtilityConflict: boolean('overhead_utility_conflict'),
    maintenanceFlag: varchar('maintenance_flag', { length: 20 }),
    sidewalkDamage: boolean('sidewalk_damage'),
    vacantPlantingSite: boolean('vacant_planting_site').default(false).notNull(),
    landUseType: varchar('land_use_type', { length: 100 }),
    mulchSoilCondition: varchar('mulch_soil_condition', { length: 100 }),
    riskFlag: boolean('risk_flag'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    locationIdx: index('trees_location_idx').using('gist', sql`location`),
    cooldownIdx: index('trees_cooldown_idx').on(table.cooldownUntil),
    contractZoneIdx: index('trees_contract_zone_idx').on(table.contractZoneId),
  })
);

export const observations = pgTable(
  'observations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    treeId: uuid('tree_id').references(() => trees.id),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    gpsAccuracyMeters: doublePrecision('gps_accuracy_meters'),
    status: observationStatusEnum('status').default('pending_upload').notNull(),
    aiSpeciesResult: text('ai_species_result'),
    aiHealthResult: text('ai_health_result'),
    aiMeasurementResult: text('ai_measurement_result'),
    notes: text('notes'),
    // Level 1 inspection fields
    conditionRating: varchar('condition_rating', { length: 20 }),
    heightEstimateM: doublePrecision('height_estimate_m'),
    canopySpreadM: doublePrecision('canopy_spread_m'),
    crownDieback: boolean('crown_dieback'),
    trunkDefects: jsonb('trunk_defects'),
    locationType: varchar('location_type', { length: 50 }),
    siteType: varchar('site_type', { length: 50 }),
    overheadUtilityConflict: boolean('overhead_utility_conflict'),
    maintenanceFlag: varchar('maintenance_flag', { length: 20 }),
    sidewalkDamage: boolean('sidewalk_damage'),
    mulchSoilCondition: varchar('mulch_soil_condition', { length: 100 }),
    riskFlag: boolean('risk_flag'),
    nearestAddress: varchar('nearest_address', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    treeIdx: index('observations_tree_idx').on(table.treeId),
    userIdx: index('observations_user_idx').on(table.userId),
    statusIdx: index('observations_status_idx').on(table.status),
  })
);

export const photos = pgTable('photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  observationId: uuid('observation_id')
    .references(() => observations.id)
    .notNull(),
  photoType: varchar('photo_type', { length: 20 }).notNull(),
  storageKey: varchar('storage_key', { length: 500 }).notNull(),
  storageUrl: text('storage_url'),
  widthPx: integer('width_px'),
  heightPx: integer('height_px'),
  fileSizeBytes: integer('file_size_bytes'),
  mimeType: varchar('mime_type', { length: 50 }),
  capturedAt: timestamp('captured_at'),
  deviceModel: varchar('device_model', { length: 100 }),
  osVersion: varchar('os_version', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const bounties = pgTable(
  'bounties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatorId: uuid('creator_id')
      .references(() => users.id)
      .notNull(),
    contractZoneId: uuid('contract_zone_id').references(() => contractZones.id),
    title: varchar('title', { length: 300 }).notNull(),
    description: text('description').notNull(),
    zoneType: zoneTypeEnum('zone_type').notNull(),
    zoneIdentifier: varchar('zone_identifier', { length: 100 }).notNull(),
    // geometry is managed via raw SQL (PostGIS MultiPolygon, nullable)
    bountyAmountCents: integer('bounty_amount_cents').notNull(),
    bonusThreshold: integer('bonus_threshold'),
    bonusAmountCents: integer('bonus_amount_cents'),
    totalBudgetCents: integer('total_budget_cents').notNull(),
    spentCents: integer('spent_cents').default(0).notNull(),
    status: bountyStatusEnum('status').default('draft').notNull(),
    startsAt: timestamp('starts_at').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    treeTargetCount: integer('tree_target_count').notNull(),
    treesCompleted: integer('trees_completed').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    creatorIdx: index('bounties_creator_idx').on(table.creatorId),
    statusIdx: index('bounties_status_idx').on(table.status),
    contractZoneIdx: index('bounties_contract_zone_idx').on(table.contractZoneId),
  })
);

export const bountyClaims = pgTable(
  'bounty_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bountyId: uuid('bounty_id')
      .references(() => bounties.id)
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    treeId: uuid('tree_id')
      .references(() => trees.id)
      .notNull(),
    observationId: uuid('observation_id')
      .references(() => observations.id)
      .notNull(),
    amountCents: integer('amount_cents').notNull(),
    status: bountyClaimStatusEnum('status').default('pending').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    bountyIdx: index('bounty_claims_bounty_idx').on(table.bountyId),
    userIdx: index('bounty_claims_user_idx').on(table.userId),
    treeIdx: index('bounty_claims_tree_idx').on(table.treeId),
    observationIdx: index('bounty_claims_observation_idx').on(table.observationId),
  })
);
