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
      polygon: `ST_Multi(ST_GeomFromText('POLYGON((-97.7538 30.2661, -97.7520 30.2642, -97.7480 30.2629, -97.7443 30.2612, -97.7422 30.2586, -97.7412 30.2553, -97.7397 30.2532, -97.7371 30.2512, -97.7360 30.2506, -97.7362 30.2519, -97.7369 30.2550, -97.7373 30.2575, -97.7372 30.2591, -97.7357 30.2630, -97.7344 30.2667, -97.7330 30.2705, -97.7316 30.2745, -97.7349 30.2756, -97.7361 30.2790, -97.7392 30.2810, -97.7427 30.2819, -97.7466 30.2841, -97.7498 30.2839, -97.7519 30.2837, -97.7508 30.2819, -97.7504 30.2806, -97.7510 30.2793, -97.7509 30.2779, -97.7502 30.2764, -97.7513 30.2754, -97.7516 30.2747, -97.7521 30.2740, -97.7513 30.2728, -97.7509 30.2715, -97.7512 30.2686, -97.7516 30.2676, -97.7529 30.2673, -97.7535 30.2668, -97.7538 30.2661))', 4326))`,
    },
    {
      identifier: '78702',
      displayName: '78702 - East Austin',
      status: 'active',
      progress: 22,
      treeTarget: 300,
      polygon: `ST_Multi(ST_GeomFromText('POLYGON((-97.7373 30.2583, -97.7362 30.2514, -97.7360 30.2506, -97.7344 30.2502, -97.7328 30.2494, -97.7259 30.2471, -97.7226 30.2468, -97.7171 30.2491, -97.7102 30.2505, -97.7021 30.2502, -97.6998 30.2474, -97.6956 30.2455, -97.6913 30.2452, -97.6913 30.2568, -97.6934 30.2597, -97.6945 30.2624, -97.6955 30.2656, -97.6967 30.2696, -97.6984 30.2747, -97.7003 30.2769, -97.7021 30.2797, -97.7070 30.2821, -97.7085 30.2818, -97.7153 30.2808, -97.7232 30.2795, -97.7281 30.2786, -97.7300 30.2785, -97.7314 30.2749, -97.7344 30.2667, -97.7357 30.2630, -97.7373 30.2583))', 4326))`,
    },
    {
      identifier: '78704',
      displayName: '78704 - South Austin',
      status: 'active',
      progress: 67,
      treeTarget: 250,
      polygon: `ST_Multi(ST_GeomFromText('POLYGON((-97.8024 30.2447, -97.7993 30.2383, -97.7979 30.2355, -97.7931 30.2318, -97.7888 30.2298, -97.7846 30.2278, -97.7814 30.2275, -97.7734 30.2276, -97.7697 30.2262, -97.7648 30.2214, -97.7577 30.2179, -97.7541 30.2162, -97.7514 30.2163, -97.7490 30.2165, -97.7440 30.2163, -97.7438 30.2191, -97.7454 30.2213, -97.7475 30.2233, -97.7448 30.2278, -97.7413 30.2338, -97.7384 30.2387, -97.7359 30.2428, -97.7350 30.2454, -97.7354 30.2480, -97.7360 30.2506, -97.7371 30.2512, -97.7422 30.2586, -97.7443 30.2612, -97.7480 30.2629, -97.7545 30.2650, -97.7599 30.2672, -97.7624 30.2664, -97.7694 30.2641, -97.7780 30.2629, -97.7843 30.2595, -97.7848 30.2578, -97.7877 30.2565, -97.7917 30.2549, -97.7961 30.2526, -97.7965 30.2500, -97.7967 30.2481, -97.7942 30.2480, -97.7911 30.2472, -97.7889 30.2455, -97.7893 30.2427, -97.7922 30.2418, -97.7942 30.2432, -97.7964 30.2445, -97.8001 30.2453, -97.8024 30.2447))', 4326))`,
    },
    {
      identifier: '78741',
      displayName: '78741 - Southeast Austin',
      status: 'upcoming',
      progress: 0,
      treeTarget: 350,
      polygon: `ST_Multi(ST_GeomFromText('POLYGON((-97.7519 30.2156, -97.7492 30.2152, -97.7407 30.2146, -97.7357 30.2142, -97.7280 30.2143, -97.7194 30.2134, -97.7125 30.2124, -97.7096 30.2107, -97.7065 30.2117, -97.7033 30.2121, -97.6999 30.2121, -97.6965 30.2132, -97.6949 30.2132, -97.6918 30.2160, -97.6899 30.2169, -97.6880 30.2192, -97.6848 30.2212, -97.6833 30.2223, -97.6797 30.2233, -97.6766 30.2223, -97.6771 30.2228, -97.6795 30.2245, -97.6825 30.2297, -97.6828 30.2310, -97.6845 30.2345, -97.6890 30.2418, -97.6911 30.2442, -97.6913 30.2452, -97.6956 30.2455, -97.6998 30.2474, -97.7021 30.2502, -97.7102 30.2505, -97.7171 30.2491, -97.7226 30.2468, -97.7259 30.2471, -97.7328 30.2494, -97.7356 30.2505, -97.7360 30.2506, -97.7358 30.2498, -97.7350 30.2454, -97.7413 30.2338, -97.7475 30.2233, -97.7438 30.2191, -97.7440 30.2163, -97.7519 30.2156))', 4326))`,
    },
    {
      identifier: '78745',
      displayName: '78745 - South Manchaca',
      status: 'upcoming',
      progress: 0,
      treeTarget: 400,
      polygon: `ST_Multi(ST_GeomFromText('POLYGON((-97.8488 30.1977, -97.8376 30.1930, -97.8305 30.1900, -97.8254 30.1903, -97.8196 30.1873, -97.8153 30.1855, -97.8095 30.1856, -97.8037 30.1857, -97.7963 30.1856, -97.7937 30.1849, -97.7912 30.1832, -97.7862 30.1833, -97.7820 30.1834, -97.7849 30.1742, -97.7904 30.1707, -97.7886 30.1672, -97.7862 30.1671, -97.7810 30.1750, -97.7763 30.1821, -97.7717 30.1890, -97.7664 30.1958, -97.7619 30.2013, -97.7586 30.2054, -97.7549 30.2108, -97.7527 30.2144, -97.7519 30.2156, -97.7541 30.2162, -97.7577 30.2179, -97.7648 30.2214, -97.7697 30.2237, -97.7700 30.2257, -97.7734 30.2276, -97.7814 30.2275, -97.7846 30.2278, -97.7888 30.2298, -97.7931 30.2318, -97.7979 30.2355, -97.7993 30.2383, -97.8024 30.2447, -97.8046 30.2437, -97.8076 30.2412, -97.8081 30.2405, -97.8082 30.2385, -97.8057 30.2375, -97.8073 30.2356, -97.8063 30.2340, -97.8067 30.2327, -97.8035 30.2324, -97.8035 30.2316, -97.8071 30.2316, -97.8115 30.2330, -97.8180 30.2326, -97.8207 30.2335, -97.8231 30.2298, -97.8262 30.2276, -97.8290 30.2238, -97.8282 30.2176, -97.8305 30.2138, -97.8342 30.2113, -97.8335 30.2094, -97.8359 30.2056, -97.8378 30.2041, -97.8386 30.2012, -97.8412 30.2005, -97.8435 30.2019, -97.8455 30.2018, -97.8475 30.1993, -97.8488 30.1977))', 4326))`,
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
      linestring: `ST_GeomFromText('LINESTRING(-97.7453 30.2630, -97.7465 30.2600, -97.7478 30.2575, -97.7490 30.2565, -97.7497 30.2540, -97.7504 30.2485, -97.7518 30.2430, -97.7530 30.2390, -97.7550 30.2350)', 4326)`,
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
      linestring: `ST_GeomFromText('LINESTRING(-97.7535 30.2700, -97.7545 30.2670, -97.7555 30.2655, -97.7560 30.2630, -97.7570 30.2605, -97.7577 30.2570, -97.7585 30.2540)', 4326)`,
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
      linestring: `ST_GeomFromText('LINESTRING(-97.7453 30.2630, -97.7420 30.2622, -97.7380 30.2615, -97.7340 30.2610, -97.7300 30.2607, -97.7270 30.2604, -97.7230 30.2600)', 4326)`,
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
