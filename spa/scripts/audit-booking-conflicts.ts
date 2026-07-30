import { loadEnvConfig } from "@next/env";
import { Client } from "pg";

loadEnvConfig(process.cwd());

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const includeHistorical = !process.argv.includes("--upcoming");

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows } = await client.query(
      `
      SELECT *
      FROM public.audit_booking_conflicts($1::boolean, now())`,
      [includeHistorical]
    );

    console.log(
      JSON.stringify(
        {
          scope: includeHistorical ? "all" : "upcoming",
          conflictCount: rows.length,
          conflicts: rows,
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
