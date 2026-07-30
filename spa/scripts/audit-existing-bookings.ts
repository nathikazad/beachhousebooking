import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

loadEnvConfig(process.cwd());

function outputPath(): string {
  const argument = process.argv.find((value) => value.startsWith("--output="));
  return argument
    ? path.resolve(argument.slice("--output=".length))
    : path.resolve(
        process.cwd(),
        "../supabase/audits/output/booking-conflicts.json"
      );
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const sqlPath = path.resolve(
    process.cwd(),
    "../supabase/audits/pre_migration_booking_conflicts.sql"
  );
  const sql = await readFile(sqlPath, "utf8");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows } = await client.query(sql);
    const report = {
      generatedAt: new Date().toISOString(),
      scope: "confirmed-and-preconfirmed",
      conflictPeriods: rows.length,
      conflictingBookingPairs: new Set(
        rows.map(
          (row) => `${row.first_booking_id}:${row.second_booking_id}`
        )
      ).size,
      upcomingConflictPeriods: rows.filter((row) => !row.historical).length,
      conflicts: rows,
    };
    const destination = outputPath();
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(
      JSON.stringify(
        {
          output: destination,
          conflictPeriods: report.conflictPeriods,
          conflictingBookingPairs: report.conflictingBookingPairs,
          upcomingConflictPeriods: report.upcomingConflictPeriods,
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
