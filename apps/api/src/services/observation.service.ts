import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { findNearestTree } from './dedup.service';
import { isOnCooldown, checkAndSetCooldown } from './cooldown.service';
import { createTree, incrementTreeStats } from './tree.service';
import { ConflictError, NotFoundError } from '../utils/errors';
import { addProcessingJob } from '../jobs/queue';
import { findZoneForPoint, incrementZoneTreeCount } from './zone.service';
import { checkAndCreateBountyClaim } from './bounty.service';

interface InspectionInput {
  conditionRating?: string;
  crownDieback?: boolean;
  trunkDefects?: { cavity: boolean; crack: boolean; lean: boolean };
  riskFlag?: boolean;
  maintenanceFlag?: string;
  locationType?: string;
  siteType?: string;
  overheadUtilityConflict?: boolean;
  sidewalkDamage?: boolean;
  mulchSoilCondition?: string;
  nearestAddress?: string;
}

interface CreateObservationInput {
  userId: string;
  latitude: number;
  longitude: number;
  gpsAccuracyMeters: number;
  photos: Array<{ photoType: string; storageKey: string }>;
  notes?: string;
  inspection?: InspectionInput;
  skipAi?: boolean;
}

export async function createObservation(input: CreateObservationInput) {
  const { userId, latitude, longitude, gpsAccuracyMeters, photos, notes, inspection, skipAi } = input;

  // 1. Deduplication: find nearby tree
  const nearbyTree = await findNearestTree(longitude, latitude);

  let treeId: string;
  let isNewTree = false;

  if (nearbyTree) {
    // Check cooldown
    if (isOnCooldown(nearbyTree.cooldownUntil)) {
      throw new ConflictError('Tree is on cooldown', {
        cooldownUntil: nearbyTree.cooldownUntil,
        treeId: nearbyTree.id,
      });
    }
    treeId = nearbyTree.id;
    // Update tree stats
    await incrementTreeStats(treeId);
  } else {
    // Create new tree
    const newTree = await createTree(latitude, longitude);
    treeId = newTree.id;
    isNewTree = true;
  }

  // 1b. Auto-assign contract zone via spatial lookup
  const zoneId = await findZoneForPoint(longitude, latitude);
  if (zoneId) {
    // Assign tree to zone if not already assigned
    const currentTree = await db
      .select({ contractZoneId: schema.trees.contractZoneId })
      .from(schema.trees)
      .where(eq(schema.trees.id, treeId))
      .limit(1);

    if (currentTree[0] && !currentTree[0].contractZoneId) {
      await db
        .update(schema.trees)
        .set({ contractZoneId: zoneId, updatedAt: new Date() })
        .where(eq(schema.trees.id, treeId));
      await incrementZoneTreeCount(zoneId);
    }
  }

  // 2. Create observation (with inspection data if provided)
  const [observation] = await db
    .insert(schema.observations)
    .values({
      treeId,
      userId,
      latitude,
      longitude,
      gpsAccuracyMeters,
      status: 'pending_upload',
      notes: notes || null,
      ...(inspection ? {
        conditionRating: inspection.conditionRating || null,
        crownDieback: inspection.crownDieback ?? null,
        trunkDefects: inspection.trunkDefects || null,
        riskFlag: inspection.riskFlag ?? null,
        maintenanceFlag: inspection.maintenanceFlag || null,
        locationType: inspection.locationType || null,
        siteType: inspection.siteType || null,
        overheadUtilityConflict: inspection.overheadUtilityConflict ?? null,
        sidewalkDamage: inspection.sidewalkDamage ?? null,
        mulchSoilCondition: inspection.mulchSoilCondition || null,
        nearestAddress: inspection.nearestAddress || null,
      } : {}),
    })
    .returning();

  // 3. Create photo records
  for (const photo of photos) {
    await db.insert(schema.photos).values({
      observationId: observation.id,
      photoType: photo.photoType,
      storageKey: photo.storageKey,
      storageUrl: `${process.env.S3_PUBLIC_URL || ''}/${photo.storageKey}`,
    });
  }

  // 3b. Propagate inspection data to tree record
  if (inspection) {
    const treeInspectionUpdates: Record<string, unknown> = { updatedAt: new Date() };
    if (inspection.conditionRating) treeInspectionUpdates.conditionRating = inspection.conditionRating;
    if (inspection.crownDieback !== undefined) treeInspectionUpdates.crownDieback = inspection.crownDieback;
    if (inspection.trunkDefects) treeInspectionUpdates.trunkDefects = inspection.trunkDefects;
    if (inspection.riskFlag !== undefined) treeInspectionUpdates.riskFlag = inspection.riskFlag;
    if (inspection.maintenanceFlag) treeInspectionUpdates.maintenanceFlag = inspection.maintenanceFlag;
    if (inspection.locationType) treeInspectionUpdates.locationType = inspection.locationType;
    if (inspection.siteType) treeInspectionUpdates.siteType = inspection.siteType;
    if (inspection.overheadUtilityConflict !== undefined) treeInspectionUpdates.overheadUtilityConflict = inspection.overheadUtilityConflict;
    if (inspection.sidewalkDamage !== undefined) treeInspectionUpdates.sidewalkDamage = inspection.sidewalkDamage;
    if (inspection.mulchSoilCondition) treeInspectionUpdates.mulchSoilCondition = inspection.mulchSoilCondition;
    if (inspection.nearestAddress) treeInspectionUpdates.nearestAddress = inspection.nearestAddress;
    await db.update(schema.trees).set(treeInspectionUpdates).where(eq(schema.trees.id, treeId));
  }

  // 4. Check and potentially set cooldown
  await checkAndSetCooldown(treeId);

  // 5. Queue for AI processing or skip
  let finalStatus: 'pending_ai' | 'pending_review';
  if (skipAi) {
    // Skip AI pipeline — go straight to pending_review
    finalStatus = 'pending_review';
    await db
      .update(schema.observations)
      .set({ status: 'pending_review', updatedAt: new Date() })
      .where(eq(schema.observations.id, observation.id));
  } else {
    // Queue for processing (moves to pending_ai)
    finalStatus = 'pending_ai';
    await addProcessingJob(observation.id);
    await db
      .update(schema.observations)
      .set({ status: 'pending_ai', updatedAt: new Date() })
      .where(eq(schema.observations.id, observation.id));
  }

  // 7. Check for active bounties and auto-create claim
  let bountyClaim: { bountyId: string; bountyTitle: string; amountCents: number } | null = null;
  try {
    bountyClaim = await checkAndCreateBountyClaim(
      treeId,
      observation.id,
      userId,
      longitude,
      latitude
    );
  } catch {
    // Non-fatal: bounty claim failure shouldn't block observation
  }

  // Fetch the tree data to return
  const tree = await db
    .select()
    .from(schema.trees)
    .where(eq(schema.trees.id, treeId))
    .limit(1);

  return {
    observation: { ...observation, status: finalStatus },
    tree: tree[0],
    isNewTree,
    bountyClaim,
  };
}

export async function getObservationById(id: string) {
  const obs = await db
    .select()
    .from(schema.observations)
    .where(eq(schema.observations.id, id))
    .limit(1);

  if (obs.length === 0) throw new NotFoundError('Observation');

  const obsPhotos = await db
    .select()
    .from(schema.photos)
    .where(eq(schema.photos.observationId, id));

  return { ...obs[0], photos: obsPhotos };
}

export async function updateObservationAIResult(
  id: string,
  aiResult: {
    species: { common: string; scientific: string; genus?: string; confidence: number } | null;
    health: {
      conditionStructural?: string;
      conditionLeaf?: string;
      status?: string;
      confidence: number;
      observations?: string[];
      notes?: string[];
      issues?: string[];
    } | null;
    measurements: {
      dbhCm: number;
      dbhIn?: number;
      heightM: number;
      heightFt?: number;
      crownWidthM?: number | null;
      crownWidthFt?: number | null;
      numStems?: number;
    } | null;
    heightEstimateM?: number | null;
    canopySpreadM?: number | null;
    crownDieback?: boolean | null;
    trunkDefects?: { cavity: boolean; crack: boolean; lean: boolean } | null;
    riskFlag?: boolean | null;
    mulchSoilCondition?: string | null;
    sidewalkDamage?: boolean | null;
  }
) {
  const obs = await db
    .select()
    .from(schema.observations)
    .where(eq(schema.observations.id, id))
    .limit(1);

  if (obs.length === 0) throw new NotFoundError('Observation');

  // Build observation update with AI results
  const obsUpdates: Record<string, unknown> = {
    aiSpeciesResult: aiResult.species ? JSON.stringify(aiResult.species) : null,
    aiHealthResult: aiResult.health ? JSON.stringify(aiResult.health) : null,
    aiMeasurementResult: aiResult.measurements
      ? JSON.stringify(aiResult.measurements)
      : null,
    status: 'pending_review',
    updatedAt: new Date(),
  };

  // Level 1 AI fields on observation
  if (aiResult.heightEstimateM !== undefined) obsUpdates.heightEstimateM = aiResult.heightEstimateM;
  if (aiResult.canopySpreadM !== undefined) obsUpdates.canopySpreadM = aiResult.canopySpreadM;
  if (aiResult.crownDieback !== undefined) obsUpdates.crownDieback = aiResult.crownDieback;
  if (aiResult.trunkDefects !== undefined) obsUpdates.trunkDefects = aiResult.trunkDefects;
  if (aiResult.riskFlag !== undefined) obsUpdates.riskFlag = aiResult.riskFlag;
  if (aiResult.mulchSoilCondition !== undefined) obsUpdates.mulchSoilCondition = aiResult.mulchSoilCondition;
  if (aiResult.sidewalkDamage !== undefined) obsUpdates.sidewalkDamage = aiResult.sidewalkDamage;

  await db
    .update(schema.observations)
    .set(obsUpdates)
    .where(eq(schema.observations.id, id));

  // Update parent tree if AI confidence exceeds existing
  if (obs[0].treeId) {
    const tree = await db
      .select()
      .from(schema.trees)
      .where(eq(schema.trees.id, obs[0].treeId))
      .limit(1);

    if (tree.length > 0) {
      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (
        aiResult.species &&
        (tree[0].speciesConfidence === null ||
          aiResult.species.confidence > tree[0].speciesConfidence)
      ) {
        updates.speciesCommon = aiResult.species.common;
        updates.speciesScientific = aiResult.species.scientific;
        if (aiResult.species.genus) updates.speciesGenus = aiResult.species.genus;
        updates.speciesConfidence = aiResult.species.confidence;
      }

      if (
        aiResult.health &&
        (tree[0].healthConfidence === null ||
          aiResult.health.confidence > tree[0].healthConfidence)
      ) {
        if (aiResult.health.conditionStructural) updates.conditionStructural = aiResult.health.conditionStructural;
        if (aiResult.health.conditionLeaf) updates.conditionLeaf = aiResult.health.conditionLeaf;
        if (aiResult.health.status) updates.healthStatus = aiResult.health.status;
        updates.healthConfidence = aiResult.health.confidence;
        if (aiResult.health.observations) updates.observations = JSON.stringify(aiResult.health.observations);
      }

      if (aiResult.measurements) {
        updates.estimatedDbhCm = aiResult.measurements.dbhCm;
        if (aiResult.measurements.dbhIn) updates.estimatedDbhIn = aiResult.measurements.dbhIn;
        updates.estimatedHeightM = aiResult.measurements.heightM;
        if (aiResult.measurements.heightFt) updates.estimatedHeightFt = aiResult.measurements.heightFt;
        if (aiResult.measurements.crownWidthM !== undefined) updates.estimatedCrownWidthM = aiResult.measurements.crownWidthM;
        if (aiResult.measurements.crownWidthFt !== undefined) updates.estimatedCrownWidthFt = aiResult.measurements.crownWidthFt;
        if (aiResult.measurements.numStems) updates.numStems = aiResult.measurements.numStems;
      }

      // Level 1 AI-estimated fields on tree
      if (aiResult.heightEstimateM !== undefined) updates.heightEstimateM = aiResult.heightEstimateM;
      if (aiResult.canopySpreadM !== undefined) updates.canopySpreadM = aiResult.canopySpreadM;
      if (aiResult.crownDieback !== undefined) updates.crownDieback = aiResult.crownDieback;
      if (aiResult.trunkDefects !== undefined) updates.trunkDefects = aiResult.trunkDefects;
      if (aiResult.riskFlag !== undefined) updates.riskFlag = aiResult.riskFlag;
      if (aiResult.mulchSoilCondition !== undefined) updates.mulchSoilCondition = aiResult.mulchSoilCondition;
      if (aiResult.sidewalkDamage !== undefined) updates.sidewalkDamage = aiResult.sidewalkDamage;

      await db
        .update(schema.trees)
        .set(updates)
        .where(eq(schema.trees.id, obs[0].treeId));
    }
  }

  return { success: true };
}
