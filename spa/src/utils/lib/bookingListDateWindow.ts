export interface BookingListDateFilters {
  checkIn?: string | null;
  dateMode?: "range" | "month" | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  dateMonth?: number | null;
  dateYear?: number | null;
  properties?: unknown;
  starred?: boolean | null;
  paymentPending?: boolean | null;
}

export function shouldCenterBookingListOnCurrentDate(
  filters: BookingListDateFilters,
  searchText?: string
): boolean {
  const hasRange =
    filters.dateMode === "range" &&
    !!filters.dateFrom &&
    !!filters.dateTo;
  const hasMonth =
    filters.dateMode === "month" &&
    !!filters.dateMonth &&
    !!filters.dateYear;
  return !searchText && !filters.checkIn && !hasRange && !hasMonth;
}

export function bookingListCurrentDateBoundary(now = new Date()): string {
  const boundary = new Date(now);
  boundary.setDate(boundary.getDate() - 2);
  return boundary.toISOString();
}
