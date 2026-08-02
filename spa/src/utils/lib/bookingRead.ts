import { BookingDB, Employee, Payment } from "./bookingType";
import {
  BookingFinancialRecords,
  hydrateBookingFinancials,
  propertyFromDatabaseValue,
  shouldUseLegacyFinancials,
} from "./financials";

export interface BookingReadRow {
  id: string | number;
  history: BookingDB[];
  history_count: string | number;
  cost_items: Array<{
    id: string | number;
    property: string | null;
    event_id: string | number | null;
    item_type: "cost" | "tax";
    name: string;
    amount: string | number;
  }>;
  payments: Array<{
    id: string | number;
    amount: string | number;
    payment_method: Payment["paymentMethod"];
    payment_date: string | Date;
    received_by: Employee | null;
    details: Record<string, string>;
  }>;
  security_deposit: {
    amount: string | number;
    payment_method: Payment["paymentMethod"];
    amount_returned: string | number;
    date_returned: string | Date | null;
  } | null;
}

export interface BookingReadResult {
  history: BookingDB[];
  historyCount: number;
}

function toISOString(value: string | Date): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function bookingFinancialsFromRow(
  bookingId: number,
  row: BookingReadRow,
): BookingFinancialRecords {
  const deposit = row.security_deposit;
  return {
    costItems: row.cost_items.map((item) => ({
      id: Number(item.id),
      bookingId,
      property: propertyFromDatabaseValue(item.property),
      eventId: item.event_id === null ? undefined : Number(item.event_id),
      itemType: item.item_type,
      name: item.name,
      amount: Number(item.amount),
    })),
    payments: row.payments.map((payment) => ({
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

function hydrateLatestBooking(
  bookingId: number,
  history: BookingDB[],
  financials: BookingFinancialRecords,
): BookingDB[] {
  if (history.length === 0) return history;

  const currentIndex = history.length - 1;
  const latest = history[currentIndex];
  if (shouldUseLegacyFinancials(latest, financials)) {
    return history;
  }

  return history.map((booking, index) =>
    index === currentIndex
      ? hydrateBookingFinancials({ ...booking, bookingId }, financials)
      : booking.encodingVersion >= 2
        ? hydrateBookingFinancials(
            { ...booking, bookingId },
            { costItems: [], payments: [], securityDeposit: null },
          )
        : booking,
  );
}

export function bookingReadResult(row: BookingReadRow): BookingReadResult {
  const bookingId = Number(row.id);
  const history = row.history ?? [];
  const financials = bookingFinancialsFromRow(bookingId, row);

  return {
    history: hydrateLatestBooking(bookingId, history, financials),
    historyCount: Number(row.history_count),
  };
}
