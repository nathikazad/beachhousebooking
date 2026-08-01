import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bookingListCacheKey,
  invalidateBookingListCache,
  readBookingListCache,
  writeBookingListCache,
} from "./lib/bookingListCache";
import {
  clearBookingHistoryCache,
} from "./lib/bookingHistoryCache";
import { BookingDB, BookingForm } from "./lib/bookingType";
import {
  calendarViewCacheKey,
  clearCalendarViewCache,
  readCalendarViewCache,
  refreshCalendarViewCache,
} from "./lib/calendarViewCache";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("./supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

import {
  createBooking,
  getLatestBookingHistory,
} from "./serverCommunicator";

describe("booking list cache invalidation", () => {
  const cacheKey = bookingListCacheKey("bookings", {});

  beforeEach(() => {
    invalidateBookingListCache();
    clearBookingHistoryCache();
    clearCalendarViewCache();
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "token" } },
    });
    vi.unstubAllGlobals();
  });

  it("keeps list rows cached after a read-only booking view", async () => {
    writeBookingListCache(cacheKey, [{} as BookingDB]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          history: [{} as BookingDB],
          historyCount: 1,
        }),
      })
    );

    await getLatestBookingHistory({ bookingId: 42 });

    expect(readBookingListCache(cacheKey)).toHaveLength(1);
  });

  it("clears list rows but retains calendar data after a successful create or update", async () => {
    const calendarKey = calendarViewCacheKey(new Date(2026, 7, 1));
    writeBookingListCache(cacheKey, [{} as BookingDB]);
    await refreshCalendarViewCache(calendarKey, async () => [
      { bookingId: 41 } as BookingDB,
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ bookingId: "42" }),
      })
    );

    await createBooking({} as BookingForm);

    expect(readBookingListCache(cacheKey)).toBeNull();
    expect(readCalendarViewCache(calendarKey)).toEqual([
      { bookingId: 41 } as BookingDB,
    ]);
  });
});
