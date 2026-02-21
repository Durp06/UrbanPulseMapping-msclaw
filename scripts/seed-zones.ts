import 'dotenv/config';
import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL!;

async function seed() {
  const client = postgres(DB_URL, { max: 1 });

  console.log('Seeding contract zones...');

  // Ensure dev user exists
  const devUserId = '00000000-0000-0000-0000-000000000001';
  await client`
    INSERT INTO users (id, firebase_uid, email, display_name)
    VALUES (${devUserId}, 'dev-user-123', 'dev@urbanpulse.test', 'Dev User')
    ON CONFLICT (firebase_uid) DO NOTHING
  `;

  // 1. Create contract
  const [contract] = await client`
    INSERT INTO contracts (municipality_name, contract_name, start_date, end_date, status, total_budget)
    VALUES (
      'City of Austin',
      'Austin Urban Canopy Inventory 2026',
      '2026-01-01',
      '2026-12-31',
      'active',
      450000.00
    )
    RETURNING id
  `;
  const contractId = contract.id;
  console.log(`Created contract: ${contractId}`);

  // 2. Create zip code zones with approximate polygon boundaries
  const zipZones = [
    {
      identifier: '78701',
      displayName: '78701 - Downtown Austin',
      status: 'active',
      progress: 45,
      treeTarget: 200,
      // Downtown Austin approximate bounds
      polygon: `ST_Multi(ST_GeomFromText('POLYGON((-97.7550 30.2600, -97.7300 30.2600, -97.7300 30.2780, -97.7550 30.2780, -97.7550 30.2600))', 4326))`,
    },
    {
      identifier: '78702',
      displayName: '78702 - East Austin',
      status: 'active',
      progress: 22,
      treeTarget: 300,
      polygon: `ST_Multi(ST_GeomFromText('POLYGON((-97.7300 30.2550, -97.7050 30.2550, -97.7050 30.2800, -97.7300 30.2800, -97.7300 30.2550))', 4326))`,
    },
    {
      identifier: '78704',
      displayName: '78704 - South Austin',
      status: 'active',
      progress: 67,
      treeTarget: 250,
      polygon: `ST_Multi(ST_GeomFromText('POLYGON((-97.7700 30.2300, -97.7350 30.2300, -97.7350 30.2550, -97.7700 30.2550, -97.7700 30.2300))', 4326))`,
    },
    {
      identifier: '78741',
      displayName: '78741 - Southeast Austin',
      status: 'upcoming',
      progress: 0,
      treeTarget: 350,
      polygon: `ST_Multi(ST_GeomFromText('POLYGON((-97.7350 30.2100, -97.7050 30.2100, -97.7050 30.2400, -97.7350 30.2400, -97.7350 30.2100))', 4326))`,
    },
    {
      identifier: '78745',
      displayName: '78745 - South Manchaca',
      status: 'upcoming',
      progress: 0,
      treeTarget: 400,
      polygon: `ST_Multi(ST_GeomFromText('POLYGON((-97.8100 30.1900, -97.7700 30.1900, -97.7700 30.2200, -97.8100 30.2200, -97.8100 30.1900))', 4326))`,
    },
  ];

  for (const zone of zipZones) {
    await client.unsafe(`
      INSERT INTO contract_zones (
        contract_id, zone_type, zone_identifier, display_name,
        geometry, status, progress_percentage, tree_target_count
      )
      VALUES (
        '${contractId}', 'zip_code', '${zone.identifier}', '${zone.displayName}',
        ${zone.polygon},
        '${zone.status}', ${zone.progress}, ${zone.treeTarget}
      )
    `);
    console.log(`  Created zip zone: ${zone.identifier}`);
  }

  // 3. Create street corridor zones as buffered linestrings
  const corridorZones = [
    {
      identifier: 's-congress-ave',
      displayName: 'S Congress Ave Corridor',
      corridorName: 'S Congress Ave',
      startCross: 'Cesar Chavez St',
      endCross: 'Oltorf St',
      status: 'active',
      progress: 55,
      treeTarget: 150,
      bufferMeters: 50,
      // S Congress Ave from Cesar Chavez to Oltorf
      linestring: `ST_GeomFromText('LINESTRING(-97.7465 30.2620, -97.7470 30.2560, -97.7475 30.2500, -97.7480 30.2440, -97.7485 30.2380)', 4326)`,
    },
    {
      identifier: 'lamar-blvd',
      displayName: 'Lamar Blvd Corridor',
      corridorName: 'Lamar Blvd',
      startCross: '5th St',
      endCross: 'Barton Springs Rd',
      status: 'active',
      progress: 31,
      treeTarget: 120,
      bufferMeters: 50,
      // Lamar Blvd from 5th St to Barton Springs
      linestring: `ST_GeomFromText('LINESTRING(-97.7550 30.2700, -97.7555 30.2640, -97.7560 30.2580, -97.7565 30.2520, -97.7570 30.2470)', 4326)`,
    },
    {
      identifier: 'e-cesar-chavez',
      displayName: 'E Cesar Chavez Corridor',
      corridorName: 'E Cesar Chavez St',
      startCross: 'Congress Ave',
      endCross: 'Chicon St',
      status: 'upcoming',
      progress: 0,
      treeTarget: 100,
      bufferMeters: 50,
      // E Cesar Chavez from Congress to Chicon
      linestring: `ST_GeomFromText('LINESTRING(-97.7465 30.2620, -97.7400 30.2618, -97.7340 30.2615, -97.7280 30.2613, -97.7220 30.2610)', 4326)`,
    },
  ];

  for (const zone of corridorZones) {
    await client.unsafe(`
      INSERT INTO contract_zones (
        contract_id, zone_type, zone_identifier, display_name,
        centerline, geometry,
        buffer_meters, corridor_name, start_cross_street, end_cross_street,
        status, progress_percentage, tree_target_count
      )
      VALUES (
        '${contractId}', 'street_corridor', '${zone.identifier}', '${zone.displayName}',
        ${zone.linestring},
        ST_Multi(ST_Buffer(${zone.linestring}::geography, ${zone.bufferMeters})::geometry),
        ${zone.bufferMeters}, '${zone.corridorName}', '${zone.startCross}', '${zone.endCross}',
        '${zone.status}', ${zone.progress}, ${zone.treeTarget}
      )
    `);
    console.log(`  Created corridor zone: ${zone.identifier}`);
  }

  // 4. Generate random tree points inside each zone using PostGIS
  const zones = await client`SELECT id, display_name, status FROM contract_zones WHERE contract_id = ${contractId}`;

  for (const zone of zones) {
    // 50-200 random trees per zone
    const treeCount = zone.status === 'upcoming'
      ? Math.floor(Math.random() * 50) + 50
      : Math.floor(Math.random() * 150) + 50;

    await client.unsafe(`
      INSERT INTO trees (latitude, longitude, species_common, species_scientific,
        species_confidence, health_status, health_confidence,
        estimated_dbh_cm, estimated_height_m,
        observation_count, unique_observer_count, last_observed_at,
        verification_tier, contract_zone_id)
      SELECT
        ST_Y(pt) AS latitude,
        ST_X(pt) AS longitude,
        (ARRAY['Live Oak', 'Pecan', 'Cedar Elm', 'Bald Cypress', 'Texas Red Oak', 'Hackberry'])[floor(random()*6)+1],
        (ARRAY['Quercus virginiana', 'Carya illinoinensis', 'Ulmus crassifolia', 'Taxodium distichum', 'Quercus buckleyi', 'Celtis laevigata'])[floor(random()*6)+1],
        random() * 0.4 + 0.6,
        (ARRAY['healthy', 'fair', 'poor'])[floor(random()*3)+1],
        random() * 0.3 + 0.7,
        random() * 80 + 10,
        random() * 18 + 3,
        floor(random()*4)+1,
        floor(random()*3)+1,
        NOW() - (random() * interval '90 days'),
        (ARRAY['unverified', 'ai_verified', 'community_verified'])[floor(random()*3)+1],
        '${zone.id}'
      FROM (
        SELECT (ST_Dump(ST_GeneratePoints(geometry, ${treeCount}))).geom AS pt
        FROM contract_zones
        WHERE id = '${zone.id}'
      ) AS points
    `);
    console.log(`  Generated ${treeCount} trees for zone: ${zone.display_name}`);
  }

  // 5. Create observations for trees in active zones
  await client`
    INSERT INTO observations (tree_id, user_id, latitude, longitude, gps_accuracy_meters, status, created_at)
    SELECT
      t.id,
      ${devUserId},
      t.latitude + (random() - 0.5) * 0.00001,
      t.longitude + (random() - 0.5) * 0.00001,
      random() * 12 + 2,
      'pending_ai',
      t.last_observed_at
    FROM trees t
    JOIN contract_zones cz ON t.contract_zone_id = cz.id
    WHERE cz.status = 'active'
  `;
  console.log('  Created observations for trees in active zones');

  // 6. Update trees_mapped_count on each zone
  await client`
    UPDATE contract_zones
    SET trees_mapped_count = (
      SELECT COUNT(*) FROM trees WHERE trees.contract_zone_id = contract_zones.id
    )
  `;
  console.log('  Updated trees_mapped_count on zones');

  // Summary
  const summary = await client`
    SELECT
      cz.display_name,
      cz.zone_type,
      cz.status,
      cz.progress_percentage,
      cz.trees_mapped_count,
      cz.tree_target_count
    FROM contract_zones cz
    WHERE cz.contract_id = ${contractId}
    ORDER BY cz.zone_type, cz.zone_identifier
  `;

  console.log('\n=== Seed Summary ===');
  for (const row of summary) {
    console.log(
      `  ${row.display_name}: ${row.status} | ${row.progress_percentage}% | ${row.trees_mapped_count}/${row.tree_target_count} trees`
    );
  }

  const totalTrees = await client`SELECT COUNT(*) as count FROM trees WHERE contract_zone_id IS NOT NULL`;
  console.log(`\nTotal trees in zones: ${totalTrees[0].count}`);

  await client.end();
  console.log('\nDone!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
