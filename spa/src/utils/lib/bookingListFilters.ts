import { Property } from "./bookingType";

export type DateFilterMode = "range" | "month";

export interface Filter {
  checkIn?: string | null;
  createdTime?: string | null;
  dateMode?: DateFilterMode | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  dateMonth?: number | null;
  dateYear?: number | null;
  properties?: Property[] | null;
  starred?: boolean | null;
  paymentPending?: boolean | null;
  status?: "Inquiry" | "Quotation" | "Confirmed" | null;
  createdBy?: "Indhu" | "Thejas" | "Yasmeen" | "Rafica" | null;
}

export interface BookingListDateBounds {
  start: string;
  end: string;
}

function indiaDate(value: string): Date {
  return new Date(`${value}T00:00:00+05:30`);
}

function nextIndiaDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1) - 5.5 * 60 * 60 * 1000);
}

export function bookingListDateBounds(
  filters: Filter,
  legacyField: "checkIn" | "createdTime"
): BookingListDateBounds | null {
  if (
    filters.dateMode === "range" &&
    filters.dateFrom &&
    filters.dateTo
  ) {
    const start = indiaDate(filters.dateFrom);
    const end = nextIndiaDate(filters.dateTo);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return null;
    }
    return { start: start.toISOString(), end: end.toISOString() };
  }

  if (
    filters.dateMode === "month" &&
    filters.dateMonth &&
    filters.dateYear
  ) {
    const start = new Date(
      Date.UTC(filters.dateYear, filters.dateMonth - 1, 1) -
        5.5 * 60 * 60 * 1000
    );
    const end = new Date(
      Date.UTC(filters.dateYear, filters.dateMonth, 1) -
        5.5 * 60 * 60 * 1000
    );
    return { start: start.toISOString(), end: end.toISOString() };
  }

  const legacyDate = filters[legacyField];
  if (legacyDate) {
    const date = new Date(legacyDate);
    if (Number.isNaN(date.getTime())) return null;
    const localDate = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    return {
      start: indiaDate(localDate).toISOString(),
      end: nextIndiaDate(localDate).toISOString(),
    };
  }

  return null;
}

export function isBoundedBookingList(
  filters: Filter,
  legacyField: "checkIn" | "createdTime"
): boolean {
  return bookingListDateBounds(filters, legacyField) !== null;
}

export function hasInvalidBookingListDateFilter(filters: Filter): boolean {
  if (!filters.dateMode) return false;
  if (filters.dateMode === "range") {
    return (
      !filters.dateFrom ||
      !filters.dateTo ||
      bookingListDateBounds(filters, "checkIn") === null
    );
  }
  return !filters.dateMonth || !filters.dateYear;
}

export function clearBookingListDateFilter(filters: Filter): Filter {
  return {
    ...filters,
    checkIn: null,
    createdTime: null,
    dateMode: null,
    dateFrom: null,
    dateTo: null,
    dateMonth: null,
    dateYear: null,
  };
}

export function bookingListDateFilterLabel(filters: Filter): string | null {
  if (
    filters.dateMode === "range" &&
    filters.dateFrom &&
    filters.dateTo
  ) {
    return `${filters.dateFrom} – ${filters.dateTo}`;
  }
  if (
    filters.dateMode === "month" &&
    filters.dateMonth &&
    filters.dateYear
  ) {
    return new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(
      new Date(
        Date.UTC(filters.dateYear, filters.dateMonth - 1, 15, 12)
      )
    );
  }
  return null;
}
