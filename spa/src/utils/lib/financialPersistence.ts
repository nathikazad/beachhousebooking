import { BookingFinancialRecords } from "./financials";

export interface FinancialQueryExecutor {
  query: (
    text: string,
    params?: unknown[]
  ) => Promise<{ rows: unknown[] }>;
}

export async function replaceFinancialRecords(
  executor: FinancialQueryExecutor,
  bookingId: number,
  financials: BookingFinancialRecords
): Promise<void> {
  await executor.query(
    "DELETE FROM public.booking_cost_items WHERE booking_id = $1",
    [bookingId]
  );
  await executor.query(
    "DELETE FROM public.booking_payments WHERE booking_id = $1",
    [bookingId]
  );
  await executor.query(
    "DELETE FROM public.booking_security_deposits WHERE booking_id = $1",
    [bookingId]
  );

  if (financials.costItems.length > 0) {
    await executor.query(
      `
      INSERT INTO public.booking_cost_items (
        booking_id,
        property,
        event_id,
        item_type,
        name,
        amount
      )
      SELECT
        $1,
        item.property::public.property,
        item.event_id,
        item.item_type,
        item.name,
        item.amount
      FROM jsonb_to_recordset($2::jsonb) AS item(
        property text,
        event_id bigint,
        item_type text,
        name text,
        amount numeric
      )`,
      [
        bookingId,
        JSON.stringify(
          financials.costItems.map((item) => ({
            property: item.property
              ? item.property.toLowerCase().replace(/\s/g, "")
              : null,
            event_id: item.eventId ?? null,
            item_type: item.itemType,
            name: item.name,
            amount: item.amount,
          }))
        ),
      ]
    );
  }

  if (financials.payments.length > 0) {
    await executor.query(
      `
      INSERT INTO public.booking_payments (
        booking_id,
        amount,
        payment_method,
        payment_date,
        received_by,
        details
      )
      SELECT
        $1,
        payment.amount,
        payment.payment_method,
        payment.payment_date,
        payment.received_by,
        payment.details
      FROM jsonb_to_recordset($2::jsonb) AS payment(
        amount numeric,
        payment_method text,
        payment_date timestamptz,
        received_by jsonb,
        details jsonb
      )`,
      [
        bookingId,
        JSON.stringify(
          financials.payments.map((payment) => ({
            amount: payment.amount,
            payment_method: payment.paymentMethod,
            payment_date: payment.paymentDate,
            received_by: payment.receivedBy ?? null,
            details: payment.details,
          }))
        ),
      ]
    );
  }

  if (financials.securityDeposit) {
    const deposit = financials.securityDeposit;
    await executor.query(
      `
      INSERT INTO public.booking_security_deposits (
        booking_id,
        amount,
        payment_method,
        amount_returned,
        date_returned
      )
      VALUES ($1, $2, $3, $4, $5)`,
      [
        bookingId,
        deposit.amount,
        deposit.paymentMethod,
        deposit.amountReturned,
        deposit.dateReturned ?? null,
      ]
    );
  }
}
