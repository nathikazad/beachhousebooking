import { describe, expect, it } from "vitest";
import {
  bookingListCurrentDateBoundary,
  shouldCenterBookingListOnCurrentDate,
} from "./bookingListDateWindow";

describe("booking list date window", () => {
  it("keeps a property-only filter centered around the current date", () => {
    expect(
      shouldCenterBookingListOnCurrentDate({
        checkIn: null,
        properties: ["Bluehouse"],
      })
    ).toBe(true);
  });

  it("uses the selected date when a check-in filter is present", () => {
    expect(
      shouldCenterBookingListOnCurrentDate({
        checkIn: "2026-08-15T00:00:00.000Z",
      })
    ).toBe(false);
  });

  it("does not center a bounded range or month around today", () => {
    expect(
      shouldCenterBookingListOnCurrentDate({
        dateMode: "range",
        dateFrom: "2026-08-01",
        dateTo: "2026-08-31",
      })
    ).toBe(false);
    expect(
      shouldCenterBookingListOnCurrentDate({
        dateMode: "month",
        dateMonth: 8,
        dateYear: 2026,
      })
    ).toBe(false);
  });

  it("preserves all-date behavior for a text search", () => {
    expect(
      shouldCenterBookingListOnCurrentDate({ checkIn: null }, "Darsyanaa")
    ).toBe(false);
  });

  it("places the split two days before the current date", () => {
    const now = new Date("2026-07-31T10:00:00.000Z");
    const boundary = new Date(bookingListCurrentDateBoundary(now));

    expect(now.getTime() - boundary.getTime()).toBe(2 * 24 * 60 * 60 * 1000);
  });
});
