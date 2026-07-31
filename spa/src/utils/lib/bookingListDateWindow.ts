export interface BookingListDateFilters {
  checkIn?: string | null;
  properties?: unknown;
  starred?: boolean | null;
  paymentPending?: boolean | null;
}

export function shouldCenterBookingListOnCurrentDate(
  filters: BookingListDateFilters,
  searchText?: string
): boolean {
  return !searchText && !filters.checkIn;
}

export function bookingListCurrentDateBoundary(now = new Date()): string {
  const boundary = new Date(now);
  boundary.setDate(boundary.getDate() - 2);
  return boundary.toISOString();
}
