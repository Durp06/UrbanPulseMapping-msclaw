import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  await sql`DELETE FROM photos`;
  await sql`DELETE FROM observations`;
  await sql`DELETE FROM trees`;
  await sql`DELETE FROM bounty_claims`;
  await sql`DELETE FROM bounties`;
  await sql`DELETE FROM contract_zones`;
  await sql`DELETE FROM contracts`;
  console.log('Cleared all data');
  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
