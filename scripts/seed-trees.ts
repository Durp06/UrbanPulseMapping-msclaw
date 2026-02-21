import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../apps/api/src/db/schema';

const AUSTIN_CENTER = { lat: 30.2672, lng: -97.7431 };
const SPREAD = 0.01; // ~1km spread

function randomOffset() {
  return (Math.random() - 0.5) * 2 * SPREAD;
}

function randomDate(daysBack: number) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  return d;
}

const SPECIES = [
  { common: 'Live Oak', scientific: 'Quercus virginiana' },
  { common: 'Pecan', scientific: 'Carya illinoinensis' },
  { common: 'Cedar Elm', scientific: 'Ulmus crassifolia' },
  { common: 'Bald Cypress', scientific: 'Taxodium distichum' },
  { common: 'Texas Red Oak', scientific: 'Quercus buckleyi' },
  { common: null, scientific: null }, // Unknown species
];

const HEALTH_STATUSES = ['healthy', 'fair', 'poor', 'dead', null];
const TIERS = ['unverified', 'ai_verified', 'community_verified', 'expert_verified'];

async function seed() {
  const connectionString = process.env.DATABASE_URL!;
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  console.log('Seeding database...');

  // Create dev user if not exists
  const devUserId = '00000000-0000-0000-0000-000000000001';
  try {
    await db.insert(schema.users).values({
      id: devUserId,
      firebaseUid: 'dev-user-123',
      email: 'dev@urbanpulse.test',
      displayName: 'Dev User',
    });
    console.log('Created dev user');
  } catch {
    console.log('Dev user already exists');
  }

  // Seed 50 trees
  for (let i = 0; i < 50; i++) {
    const lat = AUSTIN_CENTER.lat + randomOffset();
    const lng = AUSTIN_CENTER.lng + randomOffset();
    const species = SPECIES[Math.floor(Math.random() * SPECIES.length)];
    const health = HEALTH_STATUSES[Math.floor(Math.random() * HEALTH_STATUSES.length)];
    const tier = TIERS[Math.floor(Math.random() * TIERS.length)];
    const obsCount = Math.floor(Math.random() * 5) + 1;
    const uniqueObservers = Math.min(obsCount, Math.floor(Math.random() * 4) + 1);

    // Some trees on cooldown
    let cooldownUntil: Date | null = null;
    if (uniqueObservers >= 3 && Math.random() > 0.5) {
      cooldownUntil = new Date();
      cooldownUntil.setDate(cooldownUntil.getDate() + Math.floor(Math.random() * 90));
    }

    const [tree] = await db
      .insert(schema.trees)
      .values({
        latitude: lat,
        longitude: lng,
        speciesCommon: species.common,
        speciesScientific: species.scientific,
        speciesConfidence: species.common ? Math.random() * 0.5 + 0.5 : null,
        healthStatus: health,
        healthConfidence: health ? Math.random() * 0.5 + 0.5 : null,
        estimatedDbhCm: Math.random() * 100 + 10,
        estimatedHeightM: Math.random() * 20 + 3,
        observationCount: obsCount,
        uniqueObserverCount: uniqueObservers,
        lastObservedAt: randomDate(30),
        cooldownUntil,
        verificationTier: tier,
      })
      .returning();

    // Create observation(s) for each tree
    for (let j = 0; j < Math.min(obsCount, 2); j++) {
      const status =
        tier === 'unverified'
          ? 'pending_ai'
          : tier === 'ai_verified'
          ? 'pending_review'
          : 'verified';

      const [obs] = await db
        .insert(schema.observations)
        .values({
          treeId: tree.id,
          userId: devUserId,
          latitude: lat + (Math.random() - 0.5) * 0.00001,
          longitude: lng + (Math.random() - 0.5) * 0.00001,
          gpsAccuracyMeters: Math.random() * 15 + 2,
          status: status as any,
          createdAt: randomDate(60),
        })
        .returning();

      // Create placeholder photo records
      const photoTypes = ['full_tree_angle1', 'full_tree_angle2', 'bark_closeup'];
      for (const photoType of photoTypes) {
        await db.insert(schema.photos).values({
          observationId: obs.id,
          photoType,
          storageKey: `seed/${tree.id}/${photoType}.jpg`,
          storageUrl: null,
        });
      }
    }

    process.stdout.write('.');
  }

  console.log('\nSeeded 50 trees with observations and photos');

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
