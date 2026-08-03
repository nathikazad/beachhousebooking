import { BookingDB, getProperties } from "./bookingType";
import { groupBookingConflicts } from "./conflictAudit";
import { fetchLatestBooking, fetchUpcomingBookingConflicts } from "./db";
import { QueryExecutor, query } from "./helper";
import { displayProperty } from "./occupancy";

export const GPT_ACTION_TIME_ZONE = "Asia/Kolkata";
export const GPT_ACTION_EMPLOYEES = [
  "Indhu",
  "Thejas",
  "Yasmeen",
  "Rafica",
] as const;
export const GPT_ACTION_PROPERTIES = [
  "bluehouse",
  "glasshouse",
  "meadowlane",
  "lechalet",
  "villaarmati",
  "castle",
] as const;

export type GptActionEmployee = (typeof GPT_ACTION_EMPLOYEES)[number];
export type GptActionProperty = (typeof GPT_ACTION_PROPERTIES)[number];
export type GptBookingStatus =
  | "inquiry"
  | "quotation"
  | "preconfirmed"
  | "confirmed";

export class GptActionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GptActionInputError";
  }
}

function finiteNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function validateDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new GptActionInputError(`${label} must use YYYY-MM-DD format.`);
  }
  const parsed = new Date(`${value}T00:00:00+05:30`);
  const [year, month, day] = value.split("-").map(Number);
  const normalized = new Intl.DateTimeFormat("en-CA", {
    timeZone: GPT_ACTION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
  if (
    Number.isNaN(parsed.getTime()) ||
    normalized !==
      `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  ) {
    throw new GptActionInputError(`${label} is not a valid date.`);
  }
  return value;
}

function currentIndianMonth(now: Date): { month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: GPT_ACTION_TIME_ZONE,
    month: "numeric",
    year: "numeric",
  }).formatToParts(now);
  return {
    month: Number(parts.find((part) => part.type === "month")?.value),
    year: Number(parts.find((part) => part.type === "year")?.value),
  };
}

function canonicalEmployee(value?: string): GptActionEmployee | undefined {
  if (!value) return undefined;
  const employee = GPT_ACTION_EMPLOYEES.find(
    (candidate) => candidate.toLowerCase() === value.toLowerCase()
  );
  if (!employee) {
    throw new GptActionInputError(
      `employee must be one of: ${GPT_ACTION_EMPLOYEES.join(", ")}.`
    );
  }
  return employee;
}

function canonicalProperty(value?: string): GptActionProperty | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().replace(/\s/g, "");
  const property = GPT_ACTION_PROPERTIES.find(
    (candidate) => candidate === normalized
  );
  if (!property) {
    throw new GptActionInputError(`Unknown property: ${value}.`);
  }
  return property;
}

export interface GptBusinessMetricsInput {
  month?: number;
  year?: number;
  employee?: string;
  property?: string;
  now?: Date;
}

export interface GptBusinessMetrics {
  period: {
    month: number;
    year: number;
    timeZone: typeof GPT_ACTION_TIME_ZONE;
  };
  employee?: GptActionEmployee;
  property?: string;
  inquiries: number;
  confirmedBookings: number;
  conversionRatePercent: number;
  confirmedSubtotal: number;
  confirmedTax: number;
  confirmedGrossValue: number;
  outstandingOnNewConfirmedBookings: number;
  cashCollected: number;
  confirmedCheckInValue: number;
  currency: "INR";
}

export async function getGptBusinessMetrics(
  input: GptBusinessMetricsInput = {},
  executor?: QueryExecutor
): Promise<GptBusinessMetrics> {
  const current = currentIndianMonth(input.now ?? new Date());
  const month = input.month ?? current.month;
  const year = input.year ?? current.year;
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new GptActionInputError("month must be an integer from 1 to 12.");
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new GptActionInputError("year must be an integer from 2000 to 2100.");
  }
  const employee = canonicalEmployee(input.employee);
  const property = canonicalProperty(input.property);

  const rows = await query(
    `
      WITH bounds AS (
        SELECT
          make_timestamptz($1::integer, $2::integer, 1, 0, 0, 0, '${GPT_ACTION_TIME_ZONE}') AS starts_at,
          make_timestamptz($1::integer, $2::integer, 1, 0, 0, 0, '${GPT_ACTION_TIME_ZONE}')
            + interval '1 month' AS ends_at
      ),
      booking_metrics AS (
        SELECT
          count(*) AS inquiries,
          count(*) FILTER (WHERE booking.status = 'confirmed') AS confirmed_bookings,
          coalesce(sum(booking.total_cost) FILTER (WHERE booking.status = 'confirmed'), 0) AS confirmed_subtotal,
          coalesce(sum(booking.tax) FILTER (WHERE booking.status = 'confirmed'), 0) AS confirmed_tax,
          coalesce(sum(booking.after_tax_total) FILTER (WHERE booking.status = 'confirmed'), 0) AS confirmed_gross,
          coalesce(sum(booking.outstanding) FILTER (WHERE booking.status = 'confirmed'), 0) AS confirmed_outstanding
        FROM public.bookings booking
        CROSS JOIN bounds
        WHERE booking.created_at >= bounds.starts_at
          AND booking.created_at < bounds.ends_at
          AND ($3::text IS NULL OR lower(booking.email) = lower($3::text))
          AND ($4::text IS NULL OR $4::public.property = ANY(booking.properties))
      ),
      payment_metrics AS (
        SELECT coalesce(sum(payment.amount), 0) AS cash_collected
        FROM public.booking_payments payment
        JOIN public.bookings booking ON booking.id = payment.booking_id
        CROSS JOIN bounds
        WHERE payment.payment_date >= bounds.starts_at
          AND payment.payment_date < bounds.ends_at
          AND ($3::text IS NULL OR lower(booking.email) = lower($3::text))
          AND ($4::text IS NULL OR $4::public.property = ANY(booking.properties))
      ),
      check_in_metrics AS (
        SELECT coalesce(sum(booking.after_tax_total), 0) AS confirmed_check_in_value
        FROM public.bookings booking
        CROSS JOIN bounds
        WHERE booking.status = 'confirmed'
          AND booking.check_in >= bounds.starts_at
          AND booking.check_in < bounds.ends_at
          AND ($3::text IS NULL OR lower(booking.email) = lower($3::text))
          AND ($4::text IS NULL OR $4::public.property = ANY(booking.properties))
      )
      SELECT *
      FROM booking_metrics, payment_metrics, check_in_metrics`,
    [year, month, employee ?? null, property ?? null],
    executor
  );
  const row = rows[0] ?? {};
  const inquiries = finiteNumber(row.inquiries);
  const confirmedBookings = finiteNumber(row.confirmed_bookings);

  return {
    period: { month, year, timeZone: GPT_ACTION_TIME_ZONE },
    ...(employee ? { employee } : {}),
    ...(property ? { property: displayProperty(property) } : {}),
    inquiries,
    confirmedBookings,
    conversionRatePercent:
      inquiries === 0 ? 0 : Number(((confirmedBookings / inquiries) * 100).toFixed(1)),
    confirmedSubtotal: finiteNumber(row.confirmed_subtotal),
    confirmedTax: finiteNumber(row.confirmed_tax),
    confirmedGrossValue: finiteNumber(row.confirmed_gross),
    outstandingOnNewConfirmedBookings: finiteNumber(row.confirmed_outstanding),
    cashCollected: finiteNumber(row.cash_collected),
    confirmedCheckInValue: finiteNumber(row.confirmed_check_in_value),
    currency: "INR",
  };
}

export interface GptBookingSearchInput {
  client?: string;
  employee?: string;
  status?: string;
  bookingType?: "Stay" | "Event";
  property?: string;
  from?: string;
  to?: string;
  dateBasis?: "created" | "checkIn";
  outstandingOnly?: boolean;
  limit?: number;
}

export async function searchGptBookings(
  input: GptBookingSearchInput,
  executor?: QueryExecutor
) {
  if (
    input.bookingType !== undefined &&
    input.bookingType !== "Stay" &&
    input.bookingType !== "Event"
  ) {
    throw new GptActionInputError("bookingType must be Stay or Event.");
  }
  if (
    input.dateBasis !== undefined &&
    input.dateBasis !== "created" &&
    input.dateBasis !== "checkIn"
  ) {
    throw new GptActionInputError("dateBasis must be created or checkIn.");
  }
  const conditions: string[] = [];
  const params: unknown[] = [];
  const addParam = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (input.client) {
    const ref = addParam(input.client.trim());
    conditions.push(`booking.client_name ILIKE '%' || ${ref}::text || '%'`);
  }
  const employee = canonicalEmployee(input.employee);
  if (employee) {
    const ref = addParam(employee);
    conditions.push(`lower(booking.email) = lower(${ref}::text)`);
  }
  if (input.status) {
    const allowed: GptBookingStatus[] = [
      "inquiry",
      "quotation",
      "preconfirmed",
      "confirmed",
    ];
    const status = input.status.toLowerCase() as GptBookingStatus;
    if (!allowed.includes(status)) {
      throw new GptActionInputError(`status must be one of: ${allowed.join(", ")}.`);
    }
    conditions.push(`booking.status = ${addParam(status)}::public.status`);
  }
  if (input.bookingType) {
    conditions.push(
      `booking.json[array_upper(booking.json, 1)]->>'bookingType' = ${addParam(input.bookingType)}::text`
    );
  }
  if (input.property) {
    const databaseProperty = canonicalProperty(input.property)!;
    conditions.push(
      `${addParam(databaseProperty)}::public.property = ANY(booking.properties)`
    );
  }
  const dateColumn = input.dateBasis === "checkIn" ? "booking.check_in" : "booking.created_at";
  if (input.from) {
    const ref = addParam(validateDate(input.from, "from"));
    conditions.push(
      `${dateColumn} >= (${ref}::date::timestamp AT TIME ZONE '${GPT_ACTION_TIME_ZONE}')`
    );
  }
  if (input.to) {
    const ref = addParam(validateDate(input.to, "to"));
    conditions.push(
      `${dateColumn} < (${ref}::date::timestamp AT TIME ZONE '${GPT_ACTION_TIME_ZONE}')`
    );
  }
  if (input.outstandingOnly) conditions.push("booking.outstanding > 0");

  const limit = input.limit ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new GptActionInputError("limit must be an integer from 1 to 50.");
  }
  const limitRef = addParam(limit);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await query(
    `
      SELECT
        booking.id,
        booking.client_name,
        booking.status,
        booking.properties::text[] AS properties,
        booking.check_in,
        booking.check_out,
        booking.created_at,
        booking.updated_at,
        booking.email AS created_by,
        booking.json[array_upper(booking.json, 1)]->>'bookingType' AS booking_type,
        booking.total_cost,
        booking.tax,
        booking.after_tax_total,
        booking.paid,
        booking.outstanding
      FROM public.bookings booking
      ${where}
      ORDER BY ${dateColumn} DESC NULLS LAST, booking.id DESC
      LIMIT ${limitRef}::integer`,
    params,
    executor
  );

  return {
    filters: { ...input, employee },
    count: rows.length,
    bookings: rows.map((row) => ({
      bookingId: finiteNumber(row.id),
      clientName: row.client_name,
      status: row.status,
      bookingType: row.booking_type,
      properties: (row.properties ?? []).map(displayProperty),
      checkIn: row.check_in ? isoString(row.check_in) : null,
      checkOut: row.check_out ? isoString(row.check_out) : null,
      createdAt: row.created_at ? isoString(row.created_at) : null,
      updatedAt: row.updated_at ? isoString(row.updated_at) : null,
      createdBy: row.created_by,
      financials: {
        subtotal: finiteNumber(row.total_cost),
        tax: finiteNumber(row.tax),
        grossValue: finiteNumber(row.after_tax_total),
        paid: finiteNumber(row.paid),
        outstanding: finiteNumber(row.outstanding),
        currency: "INR" as const,
      },
    })),
  };
}

export function gptBookingDetailsFromBooking(booking: BookingDB) {
  return {
    bookingId: booking.bookingId,
    clientName: booking.client.name,
    bookingType: booking.bookingType,
    status: booking.status,
    properties: getProperties(booking),
    checkIn: booking.startDateTime,
    checkOut: booking.endDateTime,
    numberOfGuests: booking.numberOfGuests,
    createdAt: booking.createdDateTime,
    createdBy: booking.createdBy?.name,
    updatedAt: booking.updatedDateTime,
    updatedBy: booking.updatedBy?.name,
    referral: booking.refferral,
    events: (booking.events ?? [])
      .filter((event) => !event.markForDeletion)
      .map((event) => ({
        eventId: event.eventId,
        eventName: event.eventName,
        startsAt: event.startDateTime,
        endsAt: event.endDateTime,
        properties: event.properties,
        numberOfGuests: event.numberOfGuests,
      })),
    financials: {
      subtotal: finiteNumber(booking.totalCost),
      tax: finiteNumber(booking.tax),
      grossValue: finiteNumber(booking.afterTaxTotal),
      paid: finiteNumber(booking.paid),
      outstanding: finiteNumber(booking.outstanding),
      currency: "INR" as const,
    },
    payments: (booking.payments ?? []).map((payment) => ({
      amount: finiteNumber(payment.amount),
      date: payment.dateTime,
      method: payment.paymentMethod,
    })),
    securityDeposit: booking.securityDeposit
      ? {
          amountReceived: finiteNumber(
            booking.securityDeposit.originalSecurityAmount
          ),
          method: booking.securityDeposit.paymentMethod,
          amountReturned: finiteNumber(booking.securityDeposit.amountReturned),
          dateReturned: booking.securityDeposit.dateReturned ?? null,
        }
      : null,
  };
}

export async function getGptBookingDetails(
  bookingId: number,
  executor?: QueryExecutor
) {
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    throw new GptActionInputError("bookingId must be a positive integer.");
  }
  const result = await fetchLatestBooking(bookingId, executor);
  const booking = result.history[result.history.length - 1];
  if (!booking) throw new Error("Booking not found");
  return gptBookingDetailsFromBooking(booking);
}

function eventGuestCount(snapshot: BookingDB, eventKey: string): number | null {
  if (eventKey === "stay") return finiteNumber(snapshot.numberOfGuests);
  const id = eventKey.match(/^event-(\d+)$/)?.[1];
  if (id) {
    return (
      snapshot.events?.find((event) => String(event.eventId) === id)
        ?.numberOfGuests ?? null
    );
  }
  const index = eventKey.match(/^event-index-(\d+)$/)?.[1];
  return index === undefined
    ? null
    : snapshot.events?.[Number(index)]?.numberOfGuests ?? null;
}

export async function getGptEventSchedule(
  input: { date: string; includeStays?: boolean },
  executor?: QueryExecutor
) {
  const date = validateDate(input.date, "date");
  const rows = await query(
    `
      WITH bounds AS (
        SELECT
          $1::date::timestamp AT TIME ZONE '${GPT_ACTION_TIME_ZONE}' AS starts_at,
          ($1::date + 1)::timestamp AT TIME ZONE '${GPT_ACTION_TIME_ZONE}' AS ends_at
      )
      SELECT
        occupancy.booking_id,
        booking.client_name,
        occupancy.status,
        occupancy.event_key,
        occupancy.event_name,
        array_agg(DISTINCT occupancy.property::text ORDER BY occupancy.property::text) AS properties,
        min(occupancy.starts_at) AS starts_at,
        max(occupancy.ends_at) AS ends_at,
        booking.json[array_upper(booking.json, 1)] AS snapshot,
        booking.after_tax_total,
        booking.paid,
        booking.outstanding
      FROM public.booking_occupancies occupancy
      JOIN public.bookings booking ON booking.id = occupancy.booking_id
      CROSS JOIN bounds
      WHERE occupancy.starts_at < bounds.ends_at
        AND occupancy.ends_at > bounds.starts_at
        AND ($2::boolean OR occupancy.event_key <> 'stay')
      GROUP BY
        occupancy.booking_id,
        booking.client_name,
        occupancy.status,
        occupancy.event_key,
        occupancy.event_name,
        snapshot,
        booking.after_tax_total,
        booking.paid,
        booking.outstanding
      ORDER BY min(occupancy.starts_at), occupancy.booking_id, occupancy.event_key`,
    [date, input.includeStays ?? false],
    executor
  );

  return {
    date,
    timeZone: GPT_ACTION_TIME_ZONE,
    count: rows.length,
    events: rows.map((row) => {
      const snapshot = row.snapshot as BookingDB;
      return {
        bookingId: finiteNumber(row.booking_id),
        clientName: row.client_name,
        kind: row.event_key === "stay" ? "stay" : "event",
        eventName: row.event_name,
        status: row.status,
        startsAt: isoString(row.starts_at),
        endsAt: isoString(row.ends_at),
        properties: (row.properties ?? []).map(displayProperty),
        numberOfGuests: eventGuestCount(snapshot, row.event_key),
        financials: {
          grossValue: finiteNumber(row.after_tax_total),
          paid: finiteNumber(row.paid),
          outstanding: finiteNumber(row.outstanding),
          currency: "INR" as const,
        },
      };
    }),
  };
}

export async function getGptConflictSummary(executor?: QueryExecutor) {
  const conflicts = await fetchUpcomingBookingConflicts(executor);
  const groups = groupBookingConflicts(conflicts);
  return {
    generatedAt: new Date().toISOString(),
    conflictPeriodCount: conflicts.length,
    conflictGroupCount: groups.length,
    groups,
  };
}
