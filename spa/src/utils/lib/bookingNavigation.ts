export const DOUBLE_BOOKING_AUDIT_RETURN_PATH =
  "/protected/settings/double-bookings";

export function bookingPreviewHref(bookingId: number): string {
  const query = new URLSearchParams({
    id: String(bookingId),
    returnTo: DOUBLE_BOOKING_AUDIT_RETURN_PATH,
  });

  return `/protected/booking/%5Bid%5D?${query.toString()}`;
}
