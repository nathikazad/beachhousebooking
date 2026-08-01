import format from "date-fns/format";

import { BookingDB } from "./bookingType";

interface CalendarCacheEntry {
  bookings: BookingDB[];
}

export interface CalendarRefreshResult {
  bookings: BookingDB[];
  changed: boolean;
}

const entries = new Map<string, CalendarCacheEntry>();
const requests = new Map<string, Promise<CalendarRefreshResult>>();
let generation = 0;

export function calendarViewCacheKey(date: Date): string {
  return format(date, "yyyy-MM");
}

export function readCalendarViewCache(key: string): BookingDB[] | null {
  const entry = entries.get(key);
  return entry ? structuredClone(entry.bookings) : null;
}

export function markCalendarViewCacheStale(): void {
  generation += 1;
  requests.clear();
}

export function clearCalendarViewCache(): void {
  generation += 1;
  entries.clear();
  requests.clear();
}

export async function refreshCalendarViewCache(
  key: string,
  loader: () => Promise<BookingDB[]>
): Promise<CalendarRefreshResult> {
  const existingRequest = requests.get(key);
  if (existingRequest) {
    return existingRequest.then(cloneRefreshResult);
  }

  const cached = entries.get(key)?.bookings;
  const requestGeneration = generation;
  const request = loader()
    .then((bookings) => {
      const normalized = structuredClone(bookings);
      const changed = !cached || !sameBookings(cached, normalized);

      if (requestGeneration === generation) {
        entries.set(key, {
          bookings: structuredClone(normalized),
        });
      }

      return { bookings: normalized, changed };
    })
    .finally(() => {
      if (requests.get(key) === request) {
        requests.delete(key);
      }
    });

  requests.set(key, request);
  return request.then(cloneRefreshResult);
}

function sameBookings(first: BookingDB[], second: BookingDB[]): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function cloneRefreshResult(
  result: CalendarRefreshResult
): CalendarRefreshResult {
  return {
    bookings: structuredClone(result.bookings),
    changed: result.changed,
  };
}
