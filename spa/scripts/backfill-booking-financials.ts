import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import {
  LegacyFinancialBookingRow,
  PreparedFinancialMigration,
  prepareFinancialMigration,
  summarizeFinancialMigrations,
} from "../src/utils/lib/financialMigration";
import { replaceFinancialRecordBatch } from "../src/utils/lib/financialPersistence";

loadEnvConfig(process.cwd());

function readBatchSize(): number {
  const argument = process.argv.find((value) =>
    value.startsWith("--batch-size=")
  );
  const parsed = argument ? Number(argument.split("=")[1]) : 100;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 100;
}

async function lockLegacyBookings(
  client: Client,
  bookingIds: number[]
): Promise<Set<number>> {
  const { rows } = await client.query<{
    id: string | number;
    encoding_version: number;
  }>(
    `
    SELECT
      id,
      coalesce(
        nullif(
          json[array_upper(json, 1)] ->> 'encodingVersion',
          ''
        )::integer,
        1
      ) AS encoding_version
    FROM public.bookings
    WHERE id = ANY($1::bigint[])
    FOR UPDATE`,
    [bookingIds]
  );

  return new Set(
    rows
      .filter((row) => row.encoding_version < 2)
      .map((row) => Number(row.id))
  );
}

async function verifyAppliedCounts(
  client: Client,
  prepared: PreparedFinancialMigration[]
): Promise<void> {
  const expected = summarizeFinancialMigrations(prepared);
  const bookingIds = prepared.map((booking) => booking.bookingId);
  const { rows } = await client.query<{
    cost_items: string;
    tax_items: string;
    payments: string;
    deposits: string;
    total_cost: string;
    tax: string;
    paid: string;
  }>(
    `
    SELECT
      (
        SELECT count(*) FROM public.booking_cost_items
        WHERE booking_id = ANY($1::bigint[]) AND item_type = 'cost'
      ) AS cost_items,
      (
        SELECT count(*) FROM public.booking_cost_items
        WHERE booking_id = ANY($1::bigint[]) AND item_type = 'tax'
      ) AS tax_items,
      (
        SELECT count(*) FROM public.booking_payments
        WHERE booking_id = ANY($1::bigint[])
      ) AS payments,
      (
        SELECT count(*) FROM public.booking_security_deposits
        WHERE booking_id = ANY($1::bigint[])
      ) AS deposits,
      (
        SELECT coalesce(sum(amount), 0)
        FROM public.booking_cost_items
        WHERE booking_id = ANY($1::bigint[]) AND item_type = 'cost'
      ) AS total_cost,
      (
        SELECT coalesce(sum(amount), 0)
        FROM public.booking_cost_items
        WHERE booking_id = ANY($1::bigint[]) AND item_type = 'tax'
      ) AS tax,
      (
        SELECT coalesce(sum(amount), 0)
        FROM public.booking_payments
        WHERE booking_id = ANY($1::bigint[])
      ) AS paid`,
    [bookingIds]
  );

  const actual = rows[0];
  const mismatches = [
    ["cost items", expected.costItems, Number(actual.cost_items)],
    ["tax items", expected.taxItems, Number(actual.tax_items)],
    ["payments", expected.payments, Number(actual.payments)],
    ["deposits", expected.deposits, Number(actual.deposits)],
  ].filter(([, expectedCount, actualCount]) => expectedCount !== actualCount);

  if (mismatches.length > 0) {
    throw new Error(
      `Backfill verification failed: ${JSON.stringify(mismatches)}`
    );
  }

  const amountMismatches = [
    ["total cost", expected.totalCost, Number(actual.total_cost)],
    ["tax", expected.tax, Number(actual.tax)],
    ["paid", expected.paid, Number(actual.paid)],
  ].filter(
    ([, expectedAmount, actualAmount]) =>
      Math.abs(Number(expectedAmount) - Number(actualAmount)) >= 0.005
  );

  if (amountMismatches.length > 0) {
    throw new Error(
      `Backfill amount verification failed: ${JSON.stringify(
        amountMismatches
      )}`
    );
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const verify = process.argv.includes("--verify");
  const skipMalformed = process.argv.includes("--skip-malformed");
  const batchSize = readBatchSize();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows } = await client.query<LegacyFinancialBookingRow>(
      `
      SELECT id, properties, json
      FROM public.bookings
      WHERE coalesce(
        nullif(
          json[array_upper(json, 1)] ->> 'encodingVersion',
          ''
        )::integer,
        1
      ) < 2
      ORDER BY id`
    );
    const prepared = rows.map(prepareFinancialMigration);
    const issues = prepared.flatMap((booking) => booking.issues);
    const blockingIssues = issues.filter(
      (issue) => issue.severity === "error"
    );
    const summary = summarizeFinancialMigrations(prepared);

    if (apply && blockingIssues.length > 0 && !skipMalformed) {
      throw new Error(
        `Refusing to apply with ${blockingIssues.length} blocking migration issue(s). ` +
          "Review the dry-run output or pass --skip-malformed explicitly."
      );
    }

    if (apply) {
      for (let index = 0; index < prepared.length; index += batchSize) {
        const batch = prepared.slice(index, index + batchSize);
        await client.query("BEGIN");
        try {
          const legacyBookingIds = await lockLegacyBookings(
            client,
            batch.map((booking) => booking.bookingId)
          );
          const applied = batch.filter((booking) =>
            legacyBookingIds.has(booking.bookingId)
          );
          await replaceFinancialRecordBatch(
            client,
            applied.map((booking) => ({
              bookingId: booking.bookingId,
              financials: booking.financials,
            }))
          );
          if (applied.length > 0) {
            await verifyAppliedCounts(client, applied);
          }
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    }

    if (verify && !apply) {
      await verifyAppliedCounts(client, prepared);
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : verify ? "verify" : "dry-run",
          summary,
          issues,
        },
        null,
        2
      )
    );

    if (blockingIssues.length > 0 && !skipMalformed) {
      process.exitCode = 2;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
