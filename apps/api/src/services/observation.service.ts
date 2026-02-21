import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { findNearestTree } from './dedup.service';
import { isOnCooldown, checkAndSetCooldown } from './cooldown.service';
import { createTree, incrementTreeStats } from './tree.service';
import { ConflictError, NotFoundError } from '../utils/errors';
import { addProcessingJob } from '../jobs/queue';
import { findZoneForPoint, incrementZoneTreeCount } from './zone.service';

interface CreateObservationInput {
  userId: string;
  latitude: number;
  longitude: number;
  gpsAccuracyMeters: number;
  photos: Array<{ photoType: string; storageKey: string }>;
  notes?: string;
}

export async function createObservation(input: CreateObservationInput) {
  const { userId, latitude, longitude, gpsAccuracyMeters, photos, notes } = input;

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

  // 2. Create observation
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

  // 4. Check and potentially set cooldown
  await checkAndSetCooldown(treeId);

  // 5. Queue for processing (moves to pending_ai)
  await addProcessingJob(observation.id);

  // 6. Update status to pending_ai
  await db
    .update(schema.observations)
    .set({ status: 'pending_ai', updatedAt: new Date() })
    .where(eq(schema.observations.id, observation.id));

  // Fetch the tree data to return
  const tree = await db
    .select()
    .from(schema.trees)
    .where(eq(schema.trees.id, treeId))
    .limit(1);

  return {
    observation: { ...observation, status: 'pending_ai' as const },
    tree: tree[0],
    isNewTree,
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
    species: { common: string; scientific: string; confidence: number } | null;
    health: { status: string; confidence: number; issues: string[] } | null;
    measurements: { dbhCm: number; heightM: number } | null;
  }
) {
  const obs = await db
    .select()
    .from(schema.observations)
    .where(eq(schema.observations.id, id))
    .limit(1);

  if (obs.length === 0) throw new NotFoundError('Observation');

  // Update observation
  await db
    .update(schema.observations)
    .set({
      aiSpeciesResult: aiResult.species ? JSON.stringify(aiResult.species) : null,
      aiHealthResult: aiResult.health ? JSON.stringify(aiResult.health) : null,
      aiMeasurementResult: aiResult.measurements
        ? JSON.stringify(aiResult.measurements)
        : null,
      status: 'pending_review',
      updatedAt: new Date(),
    })
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
        updates.speciesConfidence = aiResult.species.confidence;
      }

      if (
        aiResult.health &&
        (tree[0].healthConfidence === null ||
          aiResult.health.confidence > tree[0].healthConfidence)
      ) {
        updates.healthStatus = aiResult.health.status;
        updates.healthConfidence = aiResult.health.confidence;
      }

      if (aiResult.measurements) {
        updates.estimatedDbhCm = aiResult.measurements.dbhCm;
        updates.estimatedHeightM = aiResult.measurements.heightM;
      }

      await db
        .update(schema.trees)
        .set(updates)
        .where(eq(schema.trees.id, obs[0].treeId));
    }
  }

  return { success: true };
}
