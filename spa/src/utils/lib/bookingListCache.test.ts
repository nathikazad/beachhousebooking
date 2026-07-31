import { beforeEach, describe, expect, it } from "vitest";
import {
  bookingListCacheKey,
  invalidateBookingListCache,
  readBookingListCache,
  writeBookingListCache,
} from "./bookingListCache";
import { BookingDB } from "./bookingType";

describe("booking list navigation cache", () => {
  beforeEach(() => {
    invalidateBookingListCache();
  });

  it("uses a stable key for equivalent filter objects", () => {
    expect(
      bookingListCacheKey("bookings", {
        search: "Azad",
        filters: { starred: true, checkIn: null },
      })
    ).toBe(
      bookingListCacheKey("bookings", {
        filters: { checkIn: null, starred: true },
        search: "Azad",
      })
    );
  });

  it("restores cached rows without sharing mutable references", () => {
    const key = bookingListCacheKey("logs", { pageSize: 7 });
    const rows = [
      {
        bookingId: 42,
        client: { name: "Cached" },
      } as BookingDB,
    ];
    writeBookingListCache(key, rows);

    const cached = readBookingListCache(key)!;
    cached[0].client.name = "Changed";

    expect(readBookingListCache(key)?.[0].client.name).toBe("Cached");
  });

  it("clears booking and log rows after a mutation", () => {
    const bookingKey = bookingListCacheKey("bookings", {});
    const logKey = bookingListCacheKey("logs", {});
    writeBookingListCache(bookingKey, [{} as BookingDB]);
    writeBookingListCache(logKey, [{} as BookingDB]);

    invalidateBookingListCache();

    expect(readBookingListCache(bookingKey)).toBeNull();
    expect(readBookingListCache(logKey)).toBeNull();
  });
});
