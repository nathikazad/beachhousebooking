import { BookingDB } from "./bookingType";

const bookingListCache = new Map<string, BookingDB[]>();

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, item]) => [key, stableValue(item)])
    );
  }
  return value;
}

export function bookingListCacheKey(
  list: "bookings" | "logs",
  parameters: Record<string, unknown>
): string {
  return `${list}:${JSON.stringify(stableValue(parameters))}`;
}

export function readBookingListCache(key: string): BookingDB[] | null {
  const bookings = bookingListCache.get(key);
  return bookings ? structuredClone(bookings) : null;
}

export function writeBookingListCache(
  key: string,
  bookings: BookingDB[]
): void {
  bookingListCache.set(key, structuredClone(bookings));
}

export function invalidateBookingListCache(): void {
  bookingListCache.clear();
}
