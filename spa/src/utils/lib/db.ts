import {
    BookingDB,
    BookingForm,
    Employee,
    Payment,
    getProperties,
    convertPropertiesForDb,
} from "./bookingType";
import { query, QueryExecutor, withTransaction } from "./helper";
import {
    BookingConflict,
    BookingOccupancyInput,
    BookingOccupancyStatus,
    normalizeBookingToOccupancies,
} from "./occupancy";
import { AuditedBookingConflict } from "./conflictAudit";
import {
    BookingFinancialRecords,
    calculateFinancialTotals,
    extractBookingFinancials,
    hydrateBookingFinancials,
    propertyFromDatabaseValue,
    stripFinancialData,
    shouldUseLegacyFinancials,
    validateBookingFinancials,
} from "./financials";
import { replaceFinancialRecords } from "./financialPersistence";
import {
    CheckInAuditDatabaseRow,
    CheckInAuditRow,
    buildCheckInAuditRow,
} from "./checkInAudit";

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

async function replaceBookingFinancials(
    executor: QueryExecutor,
    bookingId: number,
    booking: BookingDB
) {
    await replaceFinancialRecords(
        executor,
        bookingId,
        extractBookingFinancials(booking)
    );
}

async function fetchBookingFinancials(
    bookingId: number
): Promise<BookingFinancialRecords> {
    const [costItems, payments, deposits] = await Promise.all([
        query(
            `
            SELECT id, property, event_id, item_type, name, amount
            FROM public.booking_cost_items
            WHERE booking_id = $1
            ORDER BY id`,
            [bookingId]
        ),
        query(
            `
            SELECT id, amount, payment_method, payment_date, received_by, details
            FROM public.booking_payments
            WHERE booking_id = $1
            ORDER BY payment_date, id`,
            [bookingId]
        ),
        query(
            `
            SELECT amount, payment_method, amount_returned, date_returned
            FROM public.booking_security_deposits
            WHERE booking_id = $1`,
            [bookingId]
        ),
    ]);

    const deposit = deposits[0];
    return {
        costItems: costItems.map((item: {
            id: string | number;
            property: string | null;
            event_id: string | number | null;
            item_type: "cost" | "tax";
            name: string;
            amount: string | number;
        }) => ({
            id: Number(item.id),
            bookingId,
            property: propertyFromDatabaseValue(item.property),
            eventId:
                item.event_id === null ? undefined : Number(item.event_id),
            itemType: item.item_type,
            name: item.name,
            amount: Number(item.amount),
        })),
        payments: payments.map((payment: {
            id: string | number;
            amount: string | number;
            payment_method: Payment["paymentMethod"];
            payment_date: string | Date;
            received_by: Employee | null;
            details: Record<string, string>;
        }) => ({
            id: Number(payment.id),
            bookingId,
            amount: Number(payment.amount),
            paymentMethod: payment.payment_method,
            paymentDate: toISOString(payment.payment_date),
            receivedBy: payment.received_by ?? undefined,
            details: payment.details ?? {},
        })),
        securityDeposit: deposit
            ? {
                bookingId,
                amount: Number(deposit.amount),
                paymentMethod: deposit.payment_method,
                amountReturned: Number(deposit.amount_returned),
                dateReturned: deposit.date_returned
                    ? toISOString(deposit.date_returned)
                    : undefined,
            }
            : null,
    };
}

async function hydrateLatestBooking(
    bookingId: number,
    history: BookingDB[]
): Promise<BookingDB[]> {
    if (history.length === 0) return history;

    const financials = await fetchBookingFinancials(bookingId);
    const currentIndex = history.length - 1;
    const latest = history[currentIndex];
    if (shouldUseLegacyFinancials(latest, financials)) {
        return history;
    }

    return history.map((booking, index) =>
        index === currentIndex
            ? hydrateBookingFinancials(
                { ...booking, bookingId },
                financials
            )
            : booking.encodingVersion >= 2
                ? hydrateBookingFinancials(
                    { ...booking, bookingId },
                    {
                        costItems: [],
                        payments: [],
                        securityDeposit: null,
                    }
                )
                : booking
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
    validateBookingFinancials(booking);
    const totals = calculateFinancialTotals(extractBookingFinancials(booking));

    return withTransaction(async (client) => {
        const { rows } = await client.query(`
            INSERT INTO bookings(email, json, client_name, client_phone_number, referred_by, status, properties, check_in, check_out, created_at, updated_at, starred, total_cost, paid, outstanding, tax, after_tax_total, client_view_id)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING id`,
            [
                name,
                [stripFinancialData(booking)],
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
                totals.totalCost,
                totals.paid,
                totals.outstanding,
                totals.tax,
                totals.afterTaxTotal,
                booking.clientViewId!
            ]);
        const bookingId = Number(rows[0].id);
        await replaceBookingOccupancies(client, bookingId, booking);
        await replaceBookingFinancials(client, bookingId, booking);
        return bookingId;
    });
}

export async function updateBooking(booking: BookingDB[], id: number) {
    const lastBooking = booking[booking.length - 1];
    validateBookingFinancials(lastBooking, true);
    const totals = calculateFinancialTotals(
        extractBookingFinancials(lastBooking)
    );
    const persistedHistory = booking.map((snapshot) =>
        snapshot.encodingVersion >= 2
            ? stripFinancialData(snapshot)
            : snapshot
    );

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
                persistedHistory,
                lastBooking.client.name,
                lastBooking.client.phone,
                lastBooking.refferral,
                lastBooking.status.toLocaleLowerCase(),
                convertPropertiesForDb(getProperties(lastBooking)),
                lastBooking.updatedDateTime,
                lastBooking.startDateTime,
                lastBooking.endDateTime,
                lastBooking.starred ?? false,
                totals.totalCost,
                totals.paid,
                totals.outstanding,
                totals.tax,
                totals.afterTaxTotal,
                lastBooking.clientViewId,
                lastBooking.createdDateTime
            ]);
        await replaceBookingOccupancies(client, id, lastBooking);
        await replaceBookingFinancials(client, id, lastBooking);
    });
}

export async function fetchBooking(id: number): Promise<BookingDB[]> {
    const result = await query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (result.length === 0) {
        throw new Error("Booking not found");
    }
    return hydrateLatestBooking(id, result[0].json ?? []);
}

export async function fetchBookingByClientViewId(
    clientViewId: string
): Promise<BookingDB[]> {
    const result = await query(
        "SELECT id, json FROM bookings WHERE client_view_id = $1",
        [clientViewId]
    );
    if (result.length === 0) {
        throw new Error("Booking not found");
    }

    return hydrateLatestBooking(Number(result[0].id), result[0].json ?? []);
}

export async function fetchCheckInAudit(): Promise<CheckInAuditRow[]> {
    const rows = await query(
        `
        SELECT
          booking.id AS booking_id,
          booking.check_in,
          booking.client_name,
          booking.properties,
          totals.tax,
          totals.after_tax_total AS total,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', payment.id,
                'amount', payment.amount,
                'paymentDate', payment.payment_date
              )
              ORDER BY payment.payment_date, payment.id
            ) FILTER (WHERE payment.id IS NOT NULL),
            '[]'::jsonb
          ) AS payments
        FROM public.bookings booking
        LEFT JOIN public.booking_financial_totals totals
          ON totals.booking_id = booking.id
        LEFT JOIN public.booking_payments payment
          ON payment.booking_id = booking.id
        WHERE booking.status = 'confirmed'
          AND booking.check_in IS NOT NULL
        GROUP BY
          booking.id,
          booking.check_in,
          booking.client_name,
          booking.properties,
          totals.tax,
          totals.after_tax_total
        ORDER BY booking.check_in DESC, booking.id DESC`
    );

    return (rows as CheckInAuditDatabaseRow[]).map(buildCheckInAuditRow);
}
