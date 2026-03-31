import pg from "pg";
import { normalizeGroceryName } from "../lib/grocery-normalization.ts";

process.loadEnvFile?.(".env");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error("DATABASE_URL is not set");

const { Client } = pg;
const client = new Client({ connectionString });

async function main() {
  await client.connect();
  const { rows } = await client.query("select id, name from grocery_items");

  let updated = 0;

  for (const row of rows) {
    const normalizedName = normalizeGroceryName(row.name);

    if (!normalizedName || normalizedName === row.name) {
      continue;
    }

    await client.query("update grocery_items set name = $1 where id = $2", [
      normalizedName,
      row.id,
    ]);

    updated += 1;
  }

  console.log(`Normalized ${updated} grocery item${updated === 1 ? "" : "s"}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
