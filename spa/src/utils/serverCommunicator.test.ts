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
  maybeSingle: vi.fn(),
}));

vi.mock("./supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: mocks.maybeSingle,
        })),
      })),
    })),
  },
}));

import {
  createBooking,
  getBookingHistory,
  getLatestBookingHistory,
} from "./serverCommunicator";

describe("booking list cache invalidation", () => {
  const cacheKey = bookingListCacheKey("bookings", {});

  beforeEach(() => {
    vi.clearAllMocks();
    invalidateBookingListCache();
    clearBookingHistoryCache();
    clearCalendarViewCache();
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "token" } },
    });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: 42,
        history: [{} as BookingDB],
        history_count: 1,
        cost_items: [],
        payments: [],
        security_deposit: null,
      },
      error: null,
    });
    vi.unstubAllGlobals();
  });

  it("keeps list rows cached after a read-only booking view", async () => {
    writeBookingListCache(cacheKey, [{} as BookingDB]);
    await getLatestBookingHistory({ bookingId: 42 });

    expect(readBookingListCache(cacheKey)).toHaveLength(1);
    expect(mocks.maybeSingle).toHaveBeenCalledOnce();
  });

  it("loads authenticated booking history directly from Supabase", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 42,
        history: [{} as BookingDB, {} as BookingDB],
        history_count: 2,
        cost_items: [],
        payments: [],
        security_deposit: null,
      },
      error: null,
    });

    const history = await getBookingHistory({ bookingId: 42 });

    expect(history).toHaveLength(2);
    expect(mocks.maybeSingle).toHaveBeenCalledOnce();
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
