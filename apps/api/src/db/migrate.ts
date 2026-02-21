import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main() {
  const connectionString = process.env.DATABASE_URL!;
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  console.log('Migrations complete!');

  // Run PostGIS setup
  console.log('Setting up PostGIS...');
  await client`CREATE EXTENSION IF NOT EXISTS postgis`;

  // Add geography column if it doesn't exist
  await client`
    DO $$ BEGIN
      ALTER TABLE trees ADD COLUMN IF NOT EXISTS location geography(Point, 4326);
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;
  `;

  // Create or replace the trigger function
  await client`
    CREATE OR REPLACE FUNCTION update_tree_location()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;

  // Create trigger if it doesn't exist
  await client`
    DO $$ BEGIN
      CREATE TRIGGER trees_location_trigger
      BEFORE INSERT OR UPDATE OF latitude, longitude ON trees
      FOR EACH ROW EXECUTE FUNCTION update_tree_location();
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `;

  // Create spatial index if it doesn't exist
  await client`
    CREATE INDEX IF NOT EXISTS trees_location_gist_idx ON trees USING GIST (location);
  `;

  // Update existing rows
  await client`
    UPDATE trees SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    WHERE location IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;
  `;

  console.log('PostGIS setup complete!');

  // Contract zones PostGIS columns
  console.log('Setting up contract_zones PostGIS columns...');

  await client`
    DO $$ BEGIN
      ALTER TABLE contract_zones ADD COLUMN IF NOT EXISTS geometry geometry(MultiPolygon, 4326);
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;
  `;

  await client`
    DO $$ BEGIN
      ALTER TABLE contract_zones ADD COLUMN IF NOT EXISTS centerline geometry(LineString, 4326);
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;
  `;

  await client`
    CREATE INDEX IF NOT EXISTS contract_zones_geometry_gist_idx
    ON contract_zones USING GIST (geometry);
  `;

  console.log('Contract zones PostGIS columns ready!');

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
