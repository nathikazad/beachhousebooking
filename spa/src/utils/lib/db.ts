import { BookingDB, BookingForm, getProperties, convertPropertiesForDb } from "./bookingType";
import { query, QueryExecutor, withTransaction } from "./helper";
import {
    BookingConflict,
    BookingOccupancyInput,
    BookingOccupancyStatus,
    normalizeBookingToOccupancies,
} from "./occupancy";
import { AuditedBookingConflict } from "./conflictAudit";

function toISOString(value: string | Date): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function replaceBookingOccupancies(
    executor: QueryExecutor,
    bookingId: number,
    booking: BookingDB
) {
    const occupancies = normalizeBookingToOccupancies(booking);

    await executor.query(
        "DELETE FROM public.booking_occupancies WHERE booking_id = $1",
        [bookingId]
    );

    if (occupancies.length === 0) {
        return;
    }

    await executor.query(
        `
        INSERT INTO public.booking_occupancies(
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
            bookingId,
            JSON.stringify(
                occupancies.map((occupancy) => ({
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

export async function findBookingConflicts(
    booking: BookingDB
): Promise<BookingConflict[]> {
    const occupancies: BookingOccupancyInput[] =
        normalizeBookingToOccupancies(booking);

    if (occupancies.length === 0) {
        return [];
    }

    const rows = await query(
        `
        SELECT *
        FROM public.find_booking_conflicts($1::jsonb, $2::bigint)`,
        [JSON.stringify(occupancies), booking.bookingId ?? null]
    );

    return rows.map(
        (row: {
            conflict_booking_id: string | number;
            client_name: string;
            conflict_status: BookingOccupancyStatus;
            event_key: string;
            event_name: string;
            property: string;
            existing_starts_at: string | Date;
            existing_ends_at: string | Date;
            overlap_starts_at: string | Date;
            overlap_ends_at: string | Date;
        }): BookingConflict => ({
            bookingId: Number(row.conflict_booking_id),
            clientName: row.client_name,
            status: row.conflict_status,
            eventKey: row.event_key,
            eventName: row.event_name,
            property: row.property,
            existingStartsAt: toISOString(row.existing_starts_at),
            existingEndsAt: toISOString(row.existing_ends_at),
            overlapStartsAt: toISOString(row.overlap_starts_at),
            overlapEndsAt: toISOString(row.overlap_ends_at),
        })
    );
}

export async function fetchUpcomingBookingConflicts(): Promise<
    AuditedBookingConflict[]
> {
    const rows = await query(
        `
        SELECT *
        FROM public.audit_booking_conflicts(false, now())`
    );

    return rows.map(
        (row: {
            first_booking_id: string | number;
            first_client_name: string;
            first_status: BookingOccupancyStatus;
            first_event_key: string;
            first_event_name: string;
            first_starts_at: string | Date;
            first_ends_at: string | Date;
            second_booking_id: string | number;
            second_client_name: string;
            second_status: BookingOccupancyStatus;
            second_event_key: string;
            second_event_name: string;
            second_starts_at: string | Date;
            second_ends_at: string | Date;
            property: string;
            overlap_starts_at: string | Date;
            overlap_ends_at: string | Date;
        }): AuditedBookingConflict => ({
            firstBooking: {
                bookingId: Number(row.first_booking_id),
                clientName: row.first_client_name,
                status: row.first_status,
                eventKey: row.first_event_key,
                eventName: row.first_event_name,
                startsAt: toISOString(row.first_starts_at),
                endsAt: toISOString(row.first_ends_at),
            },
            secondBooking: {
                bookingId: Number(row.second_booking_id),
                clientName: row.second_client_name,
                status: row.second_status,
                eventKey: row.second_event_key,
                eventName: row.second_event_name,
                startsAt: toISOString(row.second_starts_at),
                endsAt: toISOString(row.second_ends_at),
            },
            property: row.property,
            overlapStartsAt: toISOString(row.overlap_starts_at),
            overlapEndsAt: toISOString(row.overlap_ends_at),
        })
    );
}

export async function createBooking(booking: BookingDB, name: string): Promise<number> {
    return withTransaction(async (client) => {
        const { rows } = await client.query(`
            INSERT INTO bookings(email, json, client_name, client_phone_number, referred_by, status, properties, check_in, check_out, created_at, updated_at, starred, total_cost, paid, outstanding, tax, after_tax_total, client_view_id)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING id`,
            [
                name,
                [booking],
                booking.client.name,
                booking.client.phone,
                booking.refferral,
                booking.status.toLocaleLowerCase(),
                convertPropertiesForDb(getProperties(booking)),
                booking.startDateTime,
                booking.endDateTime,
                booking.createdDateTime,
                booking.updatedDateTime,
                booking.starred ?? false,
                booking.totalCost ?? 0,
                booking.paid ?? 0,
                booking.outstanding ?? 0,
                booking.tax ?? 0,
                booking.afterTaxTotal ?? 0,
                booking.clientViewId!
            ]);
        const bookingId = Number(rows[0].id);
        await replaceBookingOccupancies(client, bookingId, booking);
        return bookingId;
    });
}

export async function updateBooking(booking: BookingDB[], id: number) {
    const lastBooking = booking[booking.length - 1];

    await withTransaction(async (client) => {
        await client.query(`
          UPDATE bookings
            SET
              json = $2,
              client_name = $3,
              client_phone_number = $4,
              referred_by = $5,
              status = $6,
              properties = $7,
              updated_at = $8,
              check_in = $9,
              check_out = $10,
              starred = $11,
              total_cost = $12,
              paid = $13,
              outstanding = $14,
              tax = $15,
              after_tax_total = $16,
              client_view_id = $17,
              created_at = $18
            WHERE id = $1`,
            [id,
                booking,
                lastBooking.client.name,
                lastBooking.client.phone,
                lastBooking.refferral,
                lastBooking.status.toLocaleLowerCase(),
                convertPropertiesForDb(getProperties(lastBooking)),
                lastBooking.updatedDateTime,
                lastBooking.startDateTime,
                lastBooking.endDateTime,
                lastBooking.starred ?? false,
                lastBooking.totalCost ?? 0,
                lastBooking.paid ?? 0,
                lastBooking.outstanding ?? 0,
                lastBooking.tax ?? 0,
                lastBooking.afterTaxTotal ?? 0,
                lastBooking.clientViewId,
                lastBooking.createdDateTime
            ]);
        await replaceBookingOccupancies(client, id, lastBooking);
    });
}

export async function fetchBooking(id: number): Promise<BookingDB[]> {
    const result = await query('SELECT * FROM bookings WHERE id = $1', [id]);
    return result[0].json;
}
