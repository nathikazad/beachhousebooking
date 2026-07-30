import { QueryExecutor } from "./helper";

const EVENT_PROPERTY_CTE = `
  WITH raw_event_properties AS (
    SELECT
      booking.id AS booking_id,
      nullif(event.value ->> 'eventId', '')::bigint AS event_id,
      lower(replace(event.value -> 'properties' ->> 0, ' ', '')) AS property
    FROM public.bookings booking
    CROSS JOIN LATERAL jsonb_array_elements(
      coalesce(
        (booking.json[array_upper(booking.json, 1)] -> 'events')::jsonb,
        '[]'::jsonb
      )
    ) event(value)
    WHERE jsonb_typeof(event.value -> 'properties') = 'array'
      AND jsonb_array_length(event.value -> 'properties') = 1
      AND nullif(event.value ->> 'eventId', '') IS NOT NULL
      AND event.value ->> 'markForDeletion' IS DISTINCT FROM 'true'
  ),
  event_properties AS (
    SELECT
      booking_id,
      event_id,
      min(property) AS property
    FROM raw_event_properties
    WHERE property IN (
      'bluehouse',
      'glasshouse',
      'meadowlane',
      'lechalet',
      'villaarmati',
      'castle'
    )
    GROUP BY booking_id, event_id
    HAVING count(DISTINCT property) = 1
  )`;

export interface EventCostPropertyBackfillSummary {
  rows: number;
  bookings: number;
  events: number;
  amount: number;
}

interface SummaryRow {
  rows: string | number;
  bookings: string | number;
  events: string | number;
  amount: string | number;
}

function parseSummary(row?: SummaryRow): EventCostPropertyBackfillSummary {
  return {
    rows: Number(row?.rows ?? 0),
    bookings: Number(row?.bookings ?? 0),
    events: Number(row?.events ?? 0),
    amount: Number(row?.amount ?? 0),
  };
}

export async function auditSinglePropertyEventCosts(
  client: QueryExecutor
): Promise<EventCostPropertyBackfillSummary> {
  const { rows } = await client.query(
    `${EVENT_PROPERTY_CTE}
    SELECT
      count(*) AS rows,
      count(DISTINCT cost.booking_id) AS bookings,
      count(DISTINCT (cost.booking_id, cost.event_id)) AS events,
      coalesce(sum(cost.amount), 0) AS amount
    FROM public.booking_cost_items cost
    JOIN event_properties event
      USING (booking_id, event_id)
    WHERE cost.property IS NULL
      AND cost.item_type = 'cost'`
  );

  return parseSummary(rows[0] as SummaryRow | undefined);
}

export async function assignSinglePropertyEventCosts(
  client: QueryExecutor
): Promise<EventCostPropertyBackfillSummary> {
  const { rows } = await client.query(
    `${EVENT_PROPERTY_CTE},
    updated AS (
      UPDATE public.booking_cost_items cost
      SET property = event.property::public.property
      FROM event_properties event
      WHERE cost.booking_id = event.booking_id
        AND cost.event_id = event.event_id
        AND cost.property IS NULL
        AND cost.item_type = 'cost'
      RETURNING cost.booking_id, cost.event_id, cost.amount
    )
    SELECT
      count(*) AS rows,
      count(DISTINCT booking_id) AS bookings,
      count(DISTINCT (booking_id, event_id)) AS events,
      coalesce(sum(amount), 0) AS amount
    FROM updated`
  );

  return parseSummary(rows[0] as SummaryRow | undefined);
}

export async function repairSinglePropertyEventCosts(
  client: QueryExecutor
): Promise<EventCostPropertyBackfillSummary> {
  const expected = await auditSinglePropertyEventCosts(client);
  const updated = await assignSinglePropertyEventCosts(client);

  if (
    updated.rows !== expected.rows ||
    updated.bookings !== expected.bookings ||
    updated.events !== expected.events ||
    Math.abs(updated.amount - expected.amount) >= 0.005
  ) {
    throw new Error(
      `Event cost property repair changed an unexpected scope: ${JSON.stringify({
        expected,
        updated,
      })}`
    );
  }

  const remaining = await auditSinglePropertyEventCosts(client);
  if (remaining.rows !== 0) {
    throw new Error(
      `Event cost property repair left ${remaining.rows} deterministic row(s) unassigned.`
    );
  }

  return updated;
}

const BLUEHOUSE_GLASSHOUSE_CTE = `
  WITH event_property_sets AS (
    SELECT
      booking.id AS booking_id,
      nullif(event.value ->> 'eventId', '')::bigint AS event_id,
      array_agg(
        DISTINCT lower(replace(property.value, ' ', ''))
        ORDER BY lower(replace(property.value, ' ', ''))
      ) AS properties
    FROM public.bookings booking
    CROSS JOIN LATERAL jsonb_array_elements(
      coalesce(
        (booking.json[array_upper(booking.json, 1)] -> 'events')::jsonb,
        '[]'::jsonb
      )
    ) event(value)
    CROSS JOIN LATERAL jsonb_array_elements_text(
      coalesce(event.value -> 'properties', '[]'::jsonb)
    ) property(value)
    WHERE nullif(event.value ->> 'eventId', '') IS NOT NULL
      AND event.value ->> 'markForDeletion' IS DISTINCT FROM 'true'
    GROUP BY
      booking.id,
      nullif(event.value ->> 'eventId', '')::bigint
  ),
  event_candidates AS (
    SELECT cost.id, cost.booking_id, cost.event_id, cost.amount
    FROM public.booking_cost_items cost
    JOIN event_property_sets event
      USING (booking_id, event_id)
    WHERE event.properties = ARRAY['bluehouse', 'glasshouse']::text[]
      AND cost.property IS NULL
      AND cost.item_type = 'cost'
  ),
  booking_candidates AS (
    SELECT cost.id, cost.booking_id, cost.event_id, cost.amount
    FROM public.booking_cost_items cost
    JOIN public.bookings booking
      ON booking.id = cost.booking_id
    WHERE cost.event_id IS NULL
      AND cost.property IS NULL
      AND cost.item_type = 'cost'
      AND cardinality(booking.properties) = 2
      AND booking.properties @> ARRAY[
        'bluehouse',
        'glasshouse'
      ]::public.property[]
  ),
  candidates AS (
    SELECT * FROM event_candidates
    UNION ALL
    SELECT * FROM booking_candidates
  )`;

export async function auditBluehouseGlasshouseCosts(
  client: QueryExecutor
): Promise<EventCostPropertyBackfillSummary> {
  const { rows } = await client.query(
    `${BLUEHOUSE_GLASSHOUSE_CTE}
    SELECT
      count(*) AS rows,
      count(DISTINCT booking_id) AS bookings,
      count(DISTINCT event_id) AS events,
      coalesce(sum(amount), 0) AS amount
    FROM candidates`
  );

  return parseSummary(rows[0] as SummaryRow | undefined);
}

export async function assignBluehouseGlasshouseCosts(
  client: QueryExecutor
): Promise<EventCostPropertyBackfillSummary> {
  const { rows } = await client.query(
    `${BLUEHOUSE_GLASSHOUSE_CTE},
    updated AS (
      UPDATE public.booking_cost_items cost
      SET property = 'bluehouse'::public.property
      FROM candidates candidate
      WHERE cost.id = candidate.id
        AND cost.property IS NULL
        AND cost.item_type = 'cost'
      RETURNING cost.booking_id, cost.event_id, cost.amount
    )
    SELECT
      count(*) AS rows,
      count(DISTINCT booking_id) AS bookings,
      count(DISTINCT event_id) AS events,
      coalesce(sum(amount), 0) AS amount
    FROM updated`
  );

  return parseSummary(rows[0] as SummaryRow | undefined);
}

export async function repairBluehouseGlasshouseCosts(
  client: QueryExecutor
): Promise<EventCostPropertyBackfillSummary> {
  const expected = await auditBluehouseGlasshouseCosts(client);
  const updated = await assignBluehouseGlasshouseCosts(client);

  if (
    updated.rows !== expected.rows ||
    updated.bookings !== expected.bookings ||
    updated.events !== expected.events ||
    Math.abs(updated.amount - expected.amount) >= 0.005
  ) {
    throw new Error(
      `Bluehouse/Glasshouse cost repair changed an unexpected scope: ${JSON.stringify({
        expected,
        updated,
      })}`
    );
  }

  const remaining = await auditBluehouseGlasshouseCosts(client);
  if (remaining.rows !== 0) {
    throw new Error(
      `Bluehouse/Glasshouse cost repair left ${remaining.rows} eligible row(s) unassigned.`
    );
  }

  return updated;
}
