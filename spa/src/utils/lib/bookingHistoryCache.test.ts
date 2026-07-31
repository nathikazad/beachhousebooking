import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearBookingHistoryCache,
  invalidateBookingHistoryCache,
  loadLatestBookingCached,
  loadBookingHistoryCached,
  readBookingHistoryCache,
} from "./bookingHistoryCache";
import { BookingDB, Property } from "./bookingType";

function booking(name = "Original"): BookingDB {
  return {
    bookingId: 42,
    bookingType: "Stay",
    client: { name, phone: "123" },
    numberOfGuests: 2,
    notes: "",
    properties: [Property.Castle],
    status: "Confirmed",
    startDateTime: "2026-08-01T10:00:00.000Z",
    endDateTime: "2026-08-02T10:00:00.000Z",
    events: [],
    costs: [],
    totalCost: 1000,
    payments: [],
    paymentMethod: "Cash",
    starred: false,
    paid: 0,
    outstanding: 1000,
    tax: 0,
    afterTaxTotal: 1000,
    securityDeposit: {
      originalSecurityAmount: 0,
      paymentMethod: "Cash",
      amountReturned: 0,
      dateReturned: undefined,
    },
    createdDateTime: "2026-07-01T10:00:00.000Z",
    createdBy: { id: "user-1", name: "Tester" },
    updatedDateTime: "2026-07-01T10:00:00.000Z",
    updatedBy: { id: "user-1", name: "Tester" },
    encodingVersion: 2,
  };
}

describe("booking history cache", () => {
  beforeEach(() => {
    clearBookingHistoryCache();
  });

  it("loads a booking only once across detail and edit reads", async () => {
    const loader = vi.fn(async () => [booking()]);

    await loadBookingHistoryCached(42, loader);
    await loadBookingHistoryCached(42, loader);

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("deduplicates simultaneous mobile and desktop requests", async () => {
    let resolveLoader: ((history: BookingDB[]) => void) | undefined;
    const loader = vi.fn(
      () =>
        new Promise<BookingDB[]>((resolve) => {
          resolveLoader = resolve;
        })
    );

    const mobileRequest = loadBookingHistoryCached(42, loader);
    const desktopRequest = loadBookingHistoryCached(42, loader);
    resolveLoader?.([booking()]);

    await expect(mobileRequest).resolves.toHaveLength(1);
    await expect(desktopRequest).resolves.toHaveLength(1);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("deduplicates simultaneous latest-version requests", async () => {
    const loader = vi.fn(async () => ({
      history: [booking("Latest")],
      historyCount: 4,
    }));

    const mobileRequest = loadLatestBookingCached(42, loader);
    const desktopRequest = loadLatestBookingCached(42, loader);

    await expect(mobileRequest).resolves.toMatchObject({
      historyCount: 4,
    });
    await expect(desktopRequest).resolves.toMatchObject({
      historyCount: 4,
    });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("serves the latest version from a complete cached history", async () => {
    await loadBookingHistoryCached(42, async () => [
      booking("Original"),
      booking("Latest"),
    ]);
    const latestLoader = vi.fn();

    const result = await loadLatestBookingCached(42, latestLoader);

    expect(result.history).toHaveLength(1);
    expect(result.history[0].client.name).toBe("Latest");
    expect(result.historyCount).toBe(2);
    expect(latestLoader).not.toHaveBeenCalled();
  });

  it("fetches complete history after caching only the latest version", async () => {
    await loadLatestBookingCached(42, async () => ({
      history: [booking("Latest")],
      historyCount: 3,
    }));
    const historyLoader = vi.fn(async () => [
      booking("Original"),
      booking("Second"),
      booking("Latest"),
    ]);

    const result = await loadBookingHistoryCached(42, historyLoader);

    expect(result).toHaveLength(3);
    expect(historyLoader).toHaveBeenCalledTimes(1);
  });

  it("returns clones so unsaved edits cannot change cached details", async () => {
    const editHistory = await loadBookingHistoryCached(
      42,
      async () => [booking()]
    );
    editHistory[0].client.name = "Unsaved edit";

    expect(readBookingHistoryCache(42)?.[0].client.name).toBe(
      "Original"
    );
  });

  it("reloads after a successful mutation invalidates the booking", async () => {
    const loader = vi
      .fn<() => Promise<BookingDB[]>>()
      .mockResolvedValueOnce([booking()])
      .mockResolvedValueOnce([booking("Updated")]);

    await loadBookingHistoryCached(42, loader);
    invalidateBookingHistoryCache(42);
    const refreshed = await loadBookingHistoryCached(42, loader);

    expect(loader).toHaveBeenCalledTimes(2);
    expect(refreshed[0].client.name).toBe("Updated");
  });

  it("does not cache a failed request", async () => {
    const loader = vi
      .fn<() => Promise<BookingDB[]>>()
      .mockRejectedValueOnce(new Error("Network failed"))
      .mockResolvedValueOnce([booking()]);

    await expect(loadBookingHistoryCached(42, loader)).rejects.toThrow(
      "Network failed"
    );
    await expect(loadBookingHistoryCached(42, loader)).resolves.toHaveLength(
      1
    );
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
