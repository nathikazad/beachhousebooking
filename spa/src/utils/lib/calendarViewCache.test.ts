import { beforeEach, describe, expect, it } from "vitest";

import { BookingDB } from "./bookingType";
import {
  calendarViewCacheKey,
  clearCalendarViewCache,
  markCalendarViewCacheStale,
  readCalendarViewCache,
  refreshCalendarViewCache,
} from "./calendarViewCache";

function booking(id: number): BookingDB {
  return { bookingId: id } as BookingDB;
}

describe("calendar view cache", () => {
  beforeEach(() => {
    clearCalendarViewCache();
  });

  it("keys entries by month", () => {
    expect(calendarViewCacheKey(new Date(2026, 7, 1))).toBe("2026-08");
  });

  it("stores fresh data and protects it from caller mutation", async () => {
    const key = calendarViewCacheKey(new Date(2026, 7, 1));
    const result = await refreshCalendarViewCache(key, async () => [booking(1)]);

    result.bookings.push(booking(2));
    expect(readCalendarViewCache(key)).toEqual([booking(1)]);
  });

  it("reports whether background data actually changed", async () => {
    const key = calendarViewCacheKey(new Date(2026, 7, 1));

    await expect(
      refreshCalendarViewCache(key, async () => [booking(1)])
    ).resolves.toMatchObject({ changed: true });
    await expect(
      refreshCalendarViewCache(key, async () => [booking(1)])
    ).resolves.toMatchObject({ changed: false });
    await expect(
      refreshCalendarViewCache(key, async () => [booking(1), booking(2)])
    ).resolves.toMatchObject({ changed: true });
  });

  it("deduplicates concurrent refreshes for the same month", async () => {
    const key = calendarViewCacheKey(new Date(2026, 7, 1));
    let resolve!: (bookings: BookingDB[]) => void;
    let calls = 0;
    const loader = () => {
      calls += 1;
      return new Promise<BookingDB[]>((done) => {
        resolve = done;
      });
    };

    const first = refreshCalendarViewCache(key, loader);
    const second = refreshCalendarViewCache(key, loader);
    resolve([booking(1)]);

    await Promise.all([first, second]);
    expect(calls).toBe(1);
  });

  it("marks cached data stale without deleting what can be rendered", async () => {
    const key = calendarViewCacheKey(new Date(2026, 7, 1));
    await refreshCalendarViewCache(key, async () => [booking(1)]);

    markCalendarViewCacheStale();

    expect(readCalendarViewCache(key)).toEqual([booking(1)]);
  });
});
