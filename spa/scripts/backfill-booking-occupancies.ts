import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import { BookingDB } from "../src/utils/lib/bookingType";
import {
  BookingOccupancyInput,
  normalizeBookingToOccupancies,
} from "../src/utils/lib/occupancy";

loadEnvConfig(process.cwd());

interface BookingRow {
  id: string | number;
  json: BookingDB[];
}

interface PreparedBooking {
  bookingId: number;
  occupancies: BookingOccupancyInput[];
}

interface MigrationIssue {
  bookingId: number;
  message: string;
}

function readBatchSize(): number {
  const argument = process.argv.find((value) => value.startsWith("--batch-size="));
  const parsed = argument ? Number(argument.split("=")[1]) : 100;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 100;
}

async function replaceOccupancies(
  client: Client,
  prepared: PreparedBooking
): Promise<void> {
  await client.query(
    "DELETE FROM public.booking_occupancies WHERE booking_id = $1",
    [prepared.bookingId]
  );

  if (prepared.occupancies.length === 0) {
    return;
  }

  await client.query(
    `
    INSERT INTO public.booking_occupancies (
      booking_id,
      event_key,
      event_name,
      property,
      starts_at,
      ends_at,
      status
    )
    SELECT
      $1,
      occupancy.event_key,
      occupancy.event_name,
      occupancy.property::public.property,
      occupancy.starts_at,
      occupancy.ends_at,
      occupancy.status::public.status
    FROM jsonb_to_recordset($2::jsonb) AS occupancy(
      event_key text,
      event_name text,
      property text,
      starts_at timestamptz,
      ends_at timestamptz,
      status text
    )`,
    [
      prepared.bookingId,
      JSON.stringify(
        prepared.occupancies.map((occupancy) => ({
          event_key: occupancy.eventKey,
          event_name: occupancy.eventName,
          property: occupancy.property,
          starts_at: occupancy.startsAt,
          ends_at: occupancy.endsAt,
          status: occupancy.status,
        }))
      ),
    ]
  );
}

async function main() {
  const apply = process.argv.includes("--apply");
  const batchSize = readBatchSize();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows } = await client.query<BookingRow>(
      "SELECT id, json FROM public.bookings ORDER BY id"
    );

    const prepared: PreparedBooking[] = [];
    const issues: MigrationIssue[] = [];

    for (const row of rows) {
      const bookingId = Number(row.id);
      const latest = row.json?.[row.json.length - 1];

      if (!latest) {
        issues.push({ bookingId, message: "Booking has no JSON history." });
        continue;
      }

      try {
        prepared.push({
          bookingId,
          occupancies: normalizeBookingToOccupancies({
            ...latest,
            bookingId,
          }),
        });
      } catch (error) {
        issues.push({
          bookingId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (apply) {
      for (let index = 0; index < prepared.length; index += batchSize) {
        const batch = prepared.slice(index, index + batchSize);
        await client.query("BEGIN");
        try {
          for (const booking of batch) {
            await replaceOccupancies(client, booking);
          }
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    }

    const occupancyCount = prepared.reduce(
      (total, booking) => total + booking.occupancies.length,
      0
    );

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          bookingRows: rows.length,
          preparedBookings: prepared.length,
          occupancyRows: occupancyCount,
          skippedBookings: issues.length,
          issues,
        },
        null,
        2
      )
    );

    if (issues.length > 0) {
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
