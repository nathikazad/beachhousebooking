import {
  Property,
  convertStringOnlyToProperty,
} from "./bookingType";

export const CHECK_IN_AUDIT_TABS = [
  {
    id: "blue-glass",
    label: "Blue + Glass",
    properties: [Property.Bluehouse, Property.Glasshouse],
  },
  {
    id: "meadow-lane",
    label: "Meadow Lane",
    properties: [Property.MeadowLane],
  },
  {
    id: "le-chalet",
    label: "Le Chalet",
    properties: [Property.LeChalet],
  },
  {
    id: "villa-armati",
    label: "Villa Armati",
    properties: [Property.VillaArmati],
  },
  {
    id: "castle",
    label: "Castle",
    properties: [Property.Castle],
  },
] as const;

export type CheckInAuditTabId =
  (typeof CHECK_IN_AUDIT_TABS)[number]["id"];

export const CHECK_IN_AUDIT_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export interface CheckInAuditPeriod {
  month: number;
  year: number;
}

export interface CheckInAuditPayment {
  id: number;
  amount: number;
  paymentDate: string;
}

export interface CheckInAuditDatabaseRow {
  booking_id: string | number;
  check_in: string | Date;
  client_name: string;
  properties: string[] | string | null;
  tax: string | number | null;
  total: string | number | null;
  payments: Array<{
    id: string | number;
    amount: string | number;
    paymentDate: string | Date;
  }> | null;
}

export interface CheckInAuditRow {
  bookingId: number;
  checkInDate: string;
  clientName: string;
  properties: Property[];
  advanceAmount: number;
  advanceReceivedDate: string | null;
  remainingPaymentAmount: number;
  remainingPaymentReceivedDate: string | null;
  tax: number;
  total: number;
}

function parseDatabaseProperties(
  value: string[] | string | null
): Property[] {
  const names = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value
          .replace(/^\{|\}$/g, "")
          .split(",")
          .map((property) => property.replace(/^"|"$/g, ""))
          .filter(Boolean)
      : [];

  return names.flatMap((name) => {
    try {
      return [convertStringOnlyToProperty(name)];
    } catch {
      return [];
    }
  });
}

export function summarizeCheckInPayments(
  payments: CheckInAuditPayment[]
): Pick<
  CheckInAuditRow,
  | "advanceAmount"
  | "advanceReceivedDate"
  | "remainingPaymentAmount"
  | "remainingPaymentReceivedDate"
> {
  const ordered = [...payments].sort((first, second) => {
    const dateDifference =
      new Date(first.paymentDate).getTime() -
      new Date(second.paymentDate).getTime();
    return dateDifference || first.id - second.id;
  });
  const [advance, ...remaining] = ordered;

  return {
    advanceAmount: advance?.amount ?? 0,
    advanceReceivedDate: advance?.paymentDate ?? null,
    remainingPaymentAmount: remaining.reduce(
      (total, payment) => total + payment.amount,
      0
    ),
    remainingPaymentReceivedDate:
      remaining[remaining.length - 1]?.paymentDate ?? null,
  };
}

export function buildCheckInAuditRow(
  row: CheckInAuditDatabaseRow
): CheckInAuditRow {
  const payments = (row.payments ?? []).map((payment) => ({
    id: Number(payment.id),
    amount: Number(payment.amount),
    paymentDate:
      payment.paymentDate instanceof Date
        ? payment.paymentDate.toISOString()
        : payment.paymentDate,
  }));

  return {
    bookingId: Number(row.booking_id),
    checkInDate:
      row.check_in instanceof Date
        ? row.check_in.toISOString()
        : row.check_in,
    clientName: row.client_name,
    properties: parseDatabaseProperties(row.properties),
    ...summarizeCheckInPayments(payments),
    tax: Number(row.tax ?? 0),
    total: Number(row.total ?? 0),
  };
}

export function rowsForCheckInAuditTab(
  rows: CheckInAuditRow[],
  tabId: CheckInAuditTabId
): CheckInAuditRow[] {
  const tab = CHECK_IN_AUDIT_TABS.find(({ id }) => id === tabId);
  if (!tab) return [];

  const properties = new Set<Property>(tab.properties);
  return rows.filter((row) =>
    row.properties.some((property) => properties.has(property))
  );
}

export function getCheckInAuditPeriod(
  value: string | Date
): CheckInAuditPeriod {
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).formatToParts(new Date(value));
  const month = Number(
    parts.find(({ type }) => type === "month")?.value
  );
  const year = Number(
    parts.find(({ type }) => type === "year")?.value
  );

  return { month, year };
}

export function getCurrentCheckInAuditPeriod(
  now = new Date()
): CheckInAuditPeriod {
  return getCheckInAuditPeriod(now);
}

export function rowsForCheckInAuditPeriod(
  rows: CheckInAuditRow[],
  period: CheckInAuditPeriod
): CheckInAuditRow[] {
  return rows
    .filter((row) => {
      const rowPeriod = getCheckInAuditPeriod(row.checkInDate);
      return (
        rowPeriod.month === period.month &&
        rowPeriod.year === period.year
      );
    })
    .sort((first, second) => {
      const dateDifference =
        new Date(first.checkInDate).getTime() -
        new Date(second.checkInDate).getTime();
      return dateDifference || first.bookingId - second.bookingId;
    });
}

export function availableCheckInAuditYears(
  rows: CheckInAuditRow[],
  currentYear: number
): number[] {
  return Array.from(
    new Set([
      currentYear,
      ...rows.map((row) => getCheckInAuditPeriod(row.checkInDate).year),
    ])
  ).sort((first, second) => second - first);
}

export function formatCheckInAuditDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export function formatCheckInAuditMoney(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}
