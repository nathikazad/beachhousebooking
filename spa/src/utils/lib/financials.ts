import {
  BookingDB,
  Cost,
  Employee,
  Payment,
  Property,
  getProperties,
} from "./bookingType";

export type FinancialItemType = "cost" | "tax";

export interface BookingCostItemRecord {
  id?: number;
  bookingId?: number;
  property?: Property;
  eventId?: number;
  itemType: FinancialItemType;
  name: string;
  amount: number;
}

export interface BookingPaymentRecord {
  id?: number;
  bookingId?: number;
  amount: number;
  paymentMethod: Payment["paymentMethod"];
  paymentDate: string;
  receivedBy?: Employee;
  details: Record<string, string>;
}

export interface BookingSecurityDepositRecord {
  bookingId?: number;
  amount: number;
  paymentMethod: Payment["paymentMethod"];
  amountReturned: number;
  dateReturned?: string;
}

export interface BookingFinancialRecords {
  costItems: BookingCostItemRecord[];
  payments: BookingPaymentRecord[];
  securityDeposit: BookingSecurityDepositRecord | null;
}

export interface BookingFinancialTotals {
  totalCost: number;
  tax: number;
  afterTaxTotal: number;
  paid: number;
  outstanding: number;
}

export interface BookingSummaryRow {
  id: string | number;
  json: BookingDB[];
  total_cost?: string | number;
  tax?: string | number;
  after_tax_total?: string | number;
  paid?: string | number;
  outstanding?: string | number;
}

const propertyByDatabaseValue: Record<string, Property> = {
  bluehouse: Property.Bluehouse,
  glasshouse: Property.Glasshouse,
  meadowlane: Property.MeadowLane,
  lechalet: Property.LeChalet,
  villaarmati: Property.VillaArmati,
  castle: Property.Castle,
};

export function propertyFromDatabaseValue(
  value: string | null | undefined
): Property | undefined {
  if (!value) return undefined;
  return propertyByDatabaseValue[value.replace(/\s/g, "").toLowerCase()];
}

function itemType(cost: Cost): FinancialItemType {
  return cost.itemType === "tax" ? "tax" : "cost";
}

export function calculateFinancialTotals(
  records: Pick<BookingFinancialRecords, "costItems" | "payments">
): BookingFinancialTotals {
  const totalCost = records.costItems
    .filter((item) => item.itemType === "cost")
    .reduce((total, item) => total + item.amount, 0);
  const tax = records.costItems
    .filter((item) => item.itemType === "tax")
    .reduce((total, item) => total + item.amount, 0);
  const paid = records.payments.reduce(
    (total, payment) => total + payment.amount,
    0
  );
  const afterTaxTotal = totalCost + tax;

  return {
    totalCost,
    tax,
    afterTaxTotal,
    paid,
    outstanding: afterTaxTotal - paid,
  };
}

export function extractBookingFinancials(
  booking: BookingDB
): BookingFinancialRecords {
  const bookingItems: BookingCostItemRecord[] = (booking.costs ?? []).map(
    (cost) => ({
      id: cost.costId,
      bookingId: booking.bookingId,
      property: cost.property,
      itemType: itemType(cost),
      name: cost.name,
      amount: cost.amount,
    })
  );

  const eventItems = (booking.events ?? [])
    .filter((event) => !event.markForDeletion)
    .flatMap((event) =>
      (event.costs ?? []).map(
        (cost): BookingCostItemRecord => ({
          id: cost.costId,
          bookingId: booking.bookingId,
          property: cost.property,
          eventId: event.eventId,
          itemType: itemType(cost),
          name: cost.name,
          amount: cost.amount,
        })
      )
    );

  const payments = (booking.payments ?? []).map(
    (payment): BookingPaymentRecord => ({
      id: payment.paymentId,
      bookingId: booking.bookingId,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.dateTime,
      receivedBy: payment.receivedBy,
      details: payment.details ?? {},
    })
  );

  const deposit = booking.securityDeposit;
  const securityDeposit =
    deposit &&
    (deposit.originalSecurityAmount !== 0 ||
      deposit.amountReturned !== 0 ||
      Boolean(deposit.dateReturned))
      ? {
          bookingId: booking.bookingId,
          amount: deposit.originalSecurityAmount,
          paymentMethod: deposit.paymentMethod,
          amountReturned: deposit.amountReturned,
          dateReturned: deposit.dateReturned || undefined,
        }
      : null;

  return {
    costItems: [...bookingItems, ...eventItems],
    payments,
    securityDeposit,
  };
}

export function validateBookingFinancials(
  booking: BookingDB,
  allowLegacyUnassigned = false
): void {
  const financials = extractBookingFinancials(booking);
  const { costItems } = financials;
  const unassigned = costItems.filter(
    (item) =>
      !item.property && !(allowLegacyUnassigned && item.id !== undefined)
  );

  if (unassigned.length > 0) {
    const names = unassigned.map((item) => item.name || "Unnamed item");
    throw new Error(
      `Select a property for every cost and tax item: ${names.join(", ")}.`
    );
  }

  const bookingProperties = new Set(getProperties(booking));
  const eventProperties = new Map(
    (booking.events ?? []).map((event) => [
      event.eventId,
      new Set(event.properties ?? []),
    ])
  );
  const invalidProperty = costItems.find((item) => {
    if (!item.property) return false;
    const allowedProperties =
      item.eventId === undefined
        ? bookingProperties
        : eventProperties.get(item.eventId);
    return !allowedProperties?.has(item.property);
  });
  if (invalidProperty) {
    throw new Error(
      `${invalidProperty.property} is not selected for ${
        invalidProperty.name || "this financial item"
      }.`
    );
  }

  const invalidCost = costItems.find(
    (item) => !Number.isFinite(item.amount) || item.amount < 0
  );
  if (invalidCost) {
    throw new Error(
      `Enter a valid amount for ${invalidCost.name || "every cost item"}.`
    );
  }

  const invalidPayment = financials.payments.find(
    (payment) =>
      !Number.isFinite(payment.amount) ||
      payment.amount < 0 ||
      !payment.paymentDate ||
      Number.isNaN(new Date(payment.paymentDate).getTime())
  );
  if (invalidPayment) {
    throw new Error("Every payment requires a valid amount and date.");
  }

  const deposit = financials.securityDeposit;
  if (
    deposit &&
    (!Number.isFinite(deposit.amount) ||
      deposit.amount < 0 ||
      !Number.isFinite(deposit.amountReturned) ||
      deposit.amountReturned < 0)
  ) {
    throw new Error("Security deposit amounts cannot be negative.");
  }
}

export function stripFinancialData(booking: BookingDB): BookingDB {
  const {
    costs: _costs,
    payments: _payments,
    securityDeposit: _securityDeposit,
    totalCost: _totalCost,
    tax: _tax,
    afterTaxTotal: _afterTaxTotal,
    paid: _paid,
    outstanding: _outstanding,
    ...bookingWithoutFinancials
  } = booking;

  return {
    ...bookingWithoutFinancials,
    events: (booking.events ?? []).map((event) => {
      const {
        costs: _eventCosts,
        finalCost: _eventFinalCost,
        ...eventWithoutFinancials
      } = event;
      return eventWithoutFinancials;
    }),
  } as BookingDB;
}

export function hydrateBookingFinancials(
  booking: BookingDB,
  financials: BookingFinancialRecords
): BookingDB {
  const bookingCosts: Cost[] = financials.costItems
    .filter((item) => item.eventId === undefined)
    .map((item) => ({
      costId: item.id,
      name: item.name,
      amount: item.amount,
      property: item.property,
      itemType: item.itemType,
    }));

  const events = (booking.events ?? []).map((event) => {
    const eventCosts: Cost[] = financials.costItems
      .filter((item) => item.eventId === event.eventId)
      .map((item) => ({
        costId: item.id,
        name: item.name,
        amount: item.amount,
        property: item.property,
        itemType: item.itemType,
      }));

    return {
      ...event,
      costs: eventCosts,
      finalCost: eventCosts
        .filter((cost) => itemType(cost) === "cost")
        .reduce((total, cost) => total + cost.amount, 0),
    };
  });

  const payments: Payment[] = financials.payments.map((payment) => ({
    paymentId: payment.id,
    amount: payment.amount,
    paymentMethod: payment.paymentMethod,
    dateTime: payment.paymentDate,
    receivedBy: payment.receivedBy,
    details: payment.details,
  }));

  const totals = calculateFinancialTotals(financials);
  const deposit = financials.securityDeposit;

  return {
    ...booking,
    costs: bookingCosts,
    events,
    payments,
    securityDeposit: deposit
      ? {
          originalSecurityAmount: deposit.amount,
          paymentMethod: deposit.paymentMethod,
          amountReturned: deposit.amountReturned,
          dateReturned: deposit.dateReturned,
        }
      : {
          originalSecurityAmount: 0,
          paymentMethod: "Cash",
          amountReturned: 0,
          dateReturned: undefined,
        },
    ...totals,
  };
}

export function bookingSummaryFromRow(row: BookingSummaryRow): BookingDB {
  const latest = row.json[row.json.length - 1];
  if (!latest) {
    throw new Error(`Booking ${row.id} has no JSON history.`);
  }

  return {
    ...latest,
    bookingId: Number(row.id),
    costs: latest.costs ?? [],
    payments: latest.payments ?? [],
    securityDeposit: latest.securityDeposit ?? {
      originalSecurityAmount: 0,
      paymentMethod: "Cash",
      amountReturned: 0,
      dateReturned: undefined,
    },
    events: (latest.events ?? []).map((event) => ({
      ...event,
      costs: event.costs ?? [],
      finalCost: event.finalCost ?? 0,
    })),
    totalCost: Number(row.total_cost ?? latest.totalCost ?? 0),
    tax: Number(row.tax ?? latest.tax ?? 0),
    afterTaxTotal: Number(
      row.after_tax_total ?? latest.afterTaxTotal ?? 0
    ),
    paid: Number(row.paid ?? latest.paid ?? 0),
    outstanding: Number(row.outstanding ?? latest.outstanding ?? 0),
  };
}

export function shouldUseLegacyFinancials(
  booking: BookingDB,
  financials: BookingFinancialRecords
): boolean {
  return (
    Number(booking.encodingVersion ?? 1) < 2 &&
    financials.costItems.length === 0 &&
    financials.payments.length === 0 &&
    financials.securityDeposit === null
  );
}
