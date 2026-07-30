import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import {
  auditBluehouseGlasshouseCosts,
  repairBluehouseGlasshouseCosts,
} from "../src/utils/lib/eventCostPropertyBackfill";

loadEnvConfig(process.cwd());

async function main() {
  const apply = process.argv.includes("--apply");
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    if (!apply) {
      const summary = await auditBluehouseGlasshouseCosts(client);
      console.log(JSON.stringify({ mode: "dry-run", summary }, null, 2));
      return;
    }

    await client.query("BEGIN");
    try {
      const summary = await repairBluehouseGlasshouseCosts(client);
      await client.query("COMMIT");
      console.log(JSON.stringify({ mode: "apply", summary }, null, 2));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
