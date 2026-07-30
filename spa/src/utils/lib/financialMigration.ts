import {
  BookingDB,
  Payment,
  Property,
} from "./bookingType";
import {
  BookingCostItemRecord,
  BookingFinancialRecords,
  BookingPaymentRecord,
  BookingSecurityDepositRecord,
  calculateFinancialTotals,
  propertyFromDatabaseValue,
} from "./financials";

export interface LegacyFinancialBookingRow {
  id: string | number;
  properties: string[] | string | null;
  json: BookingDB[] | null;
}

export interface FinancialMigrationIssue {
  bookingId: number;
  path: string;
  severity: "warning" | "error";
  message: string;
}

export interface PreparedFinancialMigration {
  bookingId: number;
  financials: BookingFinancialRecords;
  issues: FinancialMigrationIssue[];
}

function legacyProperties(
  properties: string[] | string | null
): Property[] {
  const propertyValues = Array.isArray(properties)
    ? properties
    : typeof properties === "string"
      ? properties
          .replace(/^\{|\}$/g, "")
          .split(",")
          .map((property) => property.replace(/^"|"$/g, ""))
          .filter(Boolean)
      : [];
  return Array.from(
    new Set(
      propertyValues
        .map(propertyFromDatabaseValue)
        .filter((property): property is Property => Boolean(property))
    )
  );
}

function legacyProperty(
  properties: string[] | string | null
): Property | undefined {
  const uniqueProperties = legacyProperties(properties);
  return uniqueProperties.length === 1 ? uniqueProperties[0] : undefined;
}

function legacyCostProperty(
  properties: string[] | string | null
): Property | undefined {
  const uniqueProperties = legacyProperties(properties);
  if (uniqueProperties.length === 1) return uniqueProperties[0];

  const isBluehouseAndGlasshouse =
    uniqueProperties.length === 2 &&
    uniqueProperties.includes(Property.Bluehouse) &&
    uniqueProperties.includes(Property.Glasshouse);

  return isBluehouseAndGlasshouse ? Property.Bluehouse : undefined;
}

function readAmount(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function migrateCost(
  bookingId: number,
  rawCost: unknown,
  path: string,
  property: Property | undefined,
  issues: FinancialMigrationIssue[],
  eventId?: number
): BookingCostItemRecord | null {
  if (!rawCost || typeof rawCost !== "object") {
    issues.push({
      bookingId,
      path,
      severity: "error",
      message: "Cost item is not an object.",
    });
    return null;
  }

  const cost = rawCost as Record<string, unknown>;
  const amount = readAmount(cost.amount);
  if (amount === null) {
    issues.push({
      bookingId,
      path: `${path}.amount`,
      severity: "error",
      message: "Cost amount is missing or invalid.",
    });
    return null;
  }

  const rawName = typeof cost.name === "string" ? cost.name.trim() : "";
  const name = rawName || "Unnamed legacy cost";
  if (!rawName) {
    issues.push({
      bookingId,
      path: `${path}.name`,
      severity: "warning",
      message: "Cost name was blank and was replaced.",
    });
  }

  return {
    property,
    eventId,
    itemType: "cost",
    name,
    amount,
  };
}

function migratePayment(
  bookingId: number,
  rawPayment: unknown,
  path: string,
  issues: FinancialMigrationIssue[]
): BookingPaymentRecord | null {
  if (!rawPayment || typeof rawPayment !== "object") {
    issues.push({
      bookingId,
      path,
      severity: "error",
      message: "Payment is not an object.",
    });
    return null;
  }

  const payment = rawPayment as Record<string, unknown>;
  const amount = readAmount(payment.amount);
  if (amount === null) {
    issues.push({
      bookingId,
      path: `${path}.amount`,
      severity: "error",
      message: "Payment amount is missing or invalid.",
    });
    return null;
  }

  if (
    typeof payment.dateTime !== "string" ||
    Number.isNaN(new Date(payment.dateTime).getTime())
  ) {
    issues.push({
      bookingId,
      path: `${path}.dateTime`,
      severity: "error",
      message: "Payment date is missing or invalid.",
    });
    return null;
  }

  const details =
    payment.details &&
    typeof payment.details === "object" &&
    !Array.isArray(payment.details)
      ? Object.fromEntries(
          Object.entries(payment.details as Record<string, unknown>)
            .filter(([, value]) => typeof value === "string")
            .map(([key, value]) => [key, value as string])
        )
      : {};

  return {
    amount,
    paymentMethod:
      typeof payment.paymentMethod === "string"
        ? (payment.paymentMethod as Payment["paymentMethod"])
        : "Cash",
    paymentDate: payment.dateTime,
    receivedBy:
      payment.receivedBy && typeof payment.receivedBy === "object"
        ? (payment.receivedBy as Payment["receivedBy"])
        : undefined,
    details,
  };
}

function migrateDeposit(
  bookingId: number,
  rawDeposit: unknown,
  issues: FinancialMigrationIssue[]
): BookingSecurityDepositRecord | null {
  if (!rawDeposit || typeof rawDeposit !== "object") {
    return null;
  }

  const deposit = rawDeposit as Record<string, unknown>;
  const hasAmount = deposit.originalSecurityAmount !== undefined;
  const hasAmountReturned = deposit.amountReturned !== undefined;
  const amount = readAmount(deposit.originalSecurityAmount);
  const amountReturned = readAmount(deposit.amountReturned);

  if (hasAmount && amount === null) {
    issues.push({
      bookingId,
      path: "securityDeposit.originalSecurityAmount",
      severity: "error",
      message: "Security deposit amount is invalid.",
    });
    return null;
  }

  if (hasAmountReturned && amountReturned === null) {
    issues.push({
      bookingId,
      path: "securityDeposit.amountReturned",
      severity: "error",
      message: "Returned security deposit amount is invalid.",
    });
    return null;
  }

  const normalizedAmount = amount ?? 0;
  const normalizedAmountReturned = amountReturned ?? 0;
  const dateReturned =
    typeof deposit.dateReturned === "string" && deposit.dateReturned
      ? deposit.dateReturned
      : undefined;

  if (
    normalizedAmount === 0 &&
    normalizedAmountReturned === 0 &&
    !dateReturned
  ) {
    return null;
  }

  if (
    dateReturned &&
    Number.isNaN(new Date(dateReturned).getTime())
  ) {
    issues.push({
      bookingId,
      path: "securityDeposit.dateReturned",
      severity: "warning",
      message: "Deposit return date is invalid and was omitted.",
    });
  }

  return {
    amount: normalizedAmount,
    paymentMethod:
      typeof deposit.paymentMethod === "string"
        ? (deposit.paymentMethod as Payment["paymentMethod"])
        : "Cash",
    amountReturned: normalizedAmountReturned,
    dateReturned:
      dateReturned && !Number.isNaN(new Date(dateReturned).getTime())
        ? dateReturned
        : undefined,
  };
}

export function prepareFinancialMigration(
  row: LegacyFinancialBookingRow
): PreparedFinancialMigration {
  const bookingId = Number(row.id);
  const issues: FinancialMigrationIssue[] = [];
  const latest = row.json?.[row.json.length - 1];

  if (!latest) {
    return {
      bookingId,
      financials: {
        costItems: [],
        payments: [],
        securityDeposit: null,
      },
      issues: [
        {
          bookingId,
          path: "json",
          severity: "error",
          message: "Booking has no JSON history.",
        },
      ],
    };
  }

  const property = legacyProperty(row.properties);
  const costProperty = legacyCostProperty(row.properties);
  const costItems: BookingCostItemRecord[] = [];

  (Array.isArray(latest.costs) ? latest.costs : []).forEach((cost, index) => {
    const migrated = migrateCost(
      bookingId,
      cost,
      `costs[${index}]`,
      costProperty,
      issues
    );
    if (migrated) costItems.push(migrated);
  });

  (Array.isArray(latest.events) ? latest.events : []).forEach(
    (event, eventIndex) => {
      const eventProperty = legacyCostProperty(event.properties ?? null);
      (Array.isArray(event.costs) ? event.costs : []).forEach(
        (cost, costIndex) => {
          const migrated = migrateCost(
            bookingId,
            cost,
            `events[${eventIndex}].costs[${costIndex}]`,
            eventProperty ?? property,
            issues,
            event.eventId
          );
          if (migrated) costItems.push(migrated);
        }
      );
    }
  );

  const rawTax = (latest as unknown as Record<string, unknown>).tax;
  const tax = readAmount(rawTax);
  if (
    rawTax !== undefined &&
    rawTax !== null &&
    rawTax !== "" &&
    tax === null
  ) {
    issues.push({
      bookingId,
      path: "tax",
      severity: "error",
      message: "Tax amount is invalid.",
    });
  }
  if (tax !== null && tax > 0) {
    costItems.push({
      property,
      itemType: "tax",
      name: "Tax",
      amount: tax,
    });
  }

  const payments = (Array.isArray(latest.payments) ? latest.payments : [])
    .map((payment, index) =>
      migratePayment(
        bookingId,
        payment,
        `payments[${index}]`,
        issues
      )
    )
    .filter(
      (payment): payment is BookingPaymentRecord => payment !== null
    );

  const securityDeposit = migrateDeposit(
    bookingId,
    latest.securityDeposit,
    issues
  );

  return {
    bookingId,
    financials: {
      costItems,
      payments,
      securityDeposit,
    },
    issues,
  };
}

export function summarizeFinancialMigrations(
  prepared: PreparedFinancialMigration[]
) {
  const roundMoney = (amount: number) =>
    Math.round((amount + Number.EPSILON) * 100) / 100;

  return prepared.reduce(
    (summary, booking) => {
      const totals = calculateFinancialTotals(booking.financials);
      summary.bookingRows += 1;
      summary.costItems += booking.financials.costItems.filter(
        (item) => item.itemType === "cost"
      ).length;
      summary.taxItems += booking.financials.costItems.filter(
        (item) => item.itemType === "tax"
      ).length;
      summary.unassignedItems += booking.financials.costItems.filter(
        (item) => !item.property
      ).length;
      summary.payments += booking.financials.payments.length;
      summary.deposits += booking.financials.securityDeposit ? 1 : 0;
      summary.totalCost = roundMoney(summary.totalCost + totals.totalCost);
      summary.tax = roundMoney(summary.tax + totals.tax);
      summary.paid = roundMoney(summary.paid + totals.paid);
      summary.warnings += booking.issues.filter(
        (issue) => issue.severity === "warning"
      ).length;
      summary.errors += booking.issues.filter(
        (issue) => issue.severity === "error"
      ).length;
      return summary;
    },
    {
      bookingRows: 0,
      costItems: 0,
      taxItems: 0,
      unassignedItems: 0,
      payments: 0,
      deposits: 0,
      totalCost: 0,
      tax: 0,
      paid: 0,
      warnings: 0,
      errors: 0,
    }
  );
}
