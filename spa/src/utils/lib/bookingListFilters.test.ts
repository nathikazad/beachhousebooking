import { describe, expect, it } from "vitest";
import {
  bookingListDateBounds,
  bookingListDateFilterLabel,
  hasInvalidBookingListDateFilter,
  isBoundedBookingList,
} from "./bookingListFilters";

describe("booking list date bounds", () => {
  it("turns an inclusive date range into India-time exclusive bounds", () => {
    expect(
      bookingListDateBounds(
        {
          dateMode: "range",
          dateFrom: "2026-07-01",
          dateTo: "2026-07-31",
        },
        "checkIn"
      )
    ).toEqual({
      start: "2026-06-30T18:30:00.000Z",
      end: "2026-07-31T18:30:00.000Z",
    });
  });

  it("turns month/year into first-day exclusive-next-month bounds", () => {
    expect(
      bookingListDateBounds(
        { dateMode: "month", dateMonth: 2, dateYear: 2028 },
        "createdTime"
      )
    ).toEqual({
      start: "2028-01-31T18:30:00.000Z",
      end: "2028-02-29T18:30:00.000Z",
    });
  });

  it("does not treat incomplete or reversed ranges as bounded", () => {
    expect(
      isBoundedBookingList(
        { dateMode: "range", dateFrom: "2026-07-10" },
        "checkIn"
      )
    ).toBe(false);
    expect(
      isBoundedBookingList(
        {
          dateMode: "range",
          dateFrom: "2026-07-10",
          dateTo: "2026-07-01",
        },
        "checkIn"
      )
    ).toBe(false);
  });

  it("marks incomplete date selections invalid before applying", () => {
    expect(
      hasInvalidBookingListDateFilter({
        dateMode: "range",
        dateFrom: "2026-07-10",
      })
    ).toBe(true);
    expect(
      hasInvalidBookingListDateFilter({
        dateMode: "month",
        dateMonth: 7,
        dateYear: 2026,
      })
    ).toBe(false);
  });

  it("formats a selected month for filter chips", () => {
    expect(
      bookingListDateFilterLabel({
        dateMode: "month",
        dateMonth: 7,
        dateYear: 2026,
      })
    ).toBe("July 2026");
  });
});
