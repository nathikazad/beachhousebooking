import { BookingDB, Property, getProperties } from "./bookingType";
import {
  readAllOfflineBookings,
  readOfflineBookingView,
  writeOfflineBookingView,
} from "./offlineBookingStore";
import { bookingListDateBounds } from "./bookingListFilters";
import { bookingListCurrentDateBoundary } from "./bookingListDateWindow";

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
  void writeOfflineBookingView(`list:${key}`, bookings).catch(() => undefined);
}

export async function readPersistentBookingListCache(
  key: string
): Promise<BookingDB[] | null> {
  let stored: BookingDB[] | null = null;
  try {
    stored = await readOfflineBookingView(`list:${key}`);
  } catch {
    return null;
  }
  const bookings = stored ?? (await queryFullOfflineBookingStore(key));
  if (bookings) bookingListCache.set(key, structuredClone(bookings));
  return bookings;
}

async function queryFullOfflineBookingStore(
  key: string
): Promise<BookingDB[] | null> {
  const separator = key.indexOf(":");
  if (separator < 0) return null;
  const list = key.slice(0, separator);
  let parameters: Record<string, any>;
  try {
    parameters = JSON.parse(key.slice(separator + 1));
  } catch {
    return null;
  }

  let bookings = await readAllOfflineBookings();
  if (bookings.length === 0) return null;
  const filters = parameters.filters ?? {};
  const search = String(parameters.searchText ?? "").trim().toLocaleLowerCase();
  if (search) {
    bookings = bookings.filter(
      (booking) =>
        booking.client.name.toLocaleLowerCase().includes(search) ||
        booking.client.phone.toLocaleLowerCase().includes(search)
    );
  }

  const dateField = list === "logs" ? "createdTime" : "checkIn";
  const bounds = search ? null : bookingListDateBounds(filters, dateField);
  if (bounds) {
    const field: "createdDateTime" | "startDateTime" =
      list === "logs" ? "createdDateTime" : "startDateTime";
    bookings = bookings.filter((booking) => {
      const value = booking[field];
      return value >= bounds.start && value < bounds.end;
    });
  }
  if (filters.properties?.length) {
    bookings = bookings.filter((booking) =>
      filters.properties.every((property: string) =>
        getProperties(booking).includes(property as Property)
      )
    );
  }
  if (filters.starred) bookings = bookings.filter((booking) => booking.starred);
  if (filters.paymentPending) {
    bookings = bookings.filter((booking) => booking.outstanding > 0);
  }

  if (list === "logs") {
    if (filters.status) {
      bookings = bookings.filter(
        (booking) =>
          booking.status.toLocaleLowerCase() ===
          String(filters.status).toLocaleLowerCase()
      );
    }
    if (filters.createdBy) {
      bookings = bookings.filter(
        (booking) => booking.createdBy?.name === filters.createdBy
      );
    }
    bookings.sort(
      (first, second) =>
        new Date(second.createdDateTime).getTime() -
        new Date(first.createdDateTime).getTime()
    );
    if (!bounds) bookings = bookings.slice(0, Number(parameters.numOfBookings ?? 7) + 1);
  } else {
    bookings = bookings.filter(
      (booking) => booking.status.toLocaleLowerCase() === "confirmed"
    );
    bookings.sort(
      (first, second) =>
        new Date(first.startDateTime).getTime() -
        new Date(second.startDateTime).getTime()
    );
    if (!bounds && !search) {
      const boundary = bookingListCurrentDateBoundary();
      const backwardCount = Number(parameters.numOfBookingsBackward ?? 0);
      const older = backwardCount > 0
        ? bookings
            .filter((booking) => booking.startDateTime < boundary)
            .slice(-backwardCount)
        : [];
      const newer = bookings
        .filter((booking) => booking.startDateTime >= boundary)
        .slice(0, Number(parameters.numOfBookingsForward ?? 7) + 1);
      bookings = [...older, ...newer];
    }
  }
  return bookings;
}

export function invalidateBookingListCache(): void {
  bookingListCache.clear();
}
