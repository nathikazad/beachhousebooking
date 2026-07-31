import { describe, expect, it } from "vitest";
import { BookingDB } from "../utils/lib/bookingType";
import { sortBookingsForTable } from "./BookingListTable";

function booking(
  bookingId: number,
  startDateTime: string,
  createdDateTime: string
): BookingDB {
  return { bookingId, startDateTime, createdDateTime } as BookingDB;
}

describe("sortBookingsForTable", () => {
  const bookings = [
    booking(2, "2026-08-02T00:00:00Z", "2026-07-01T00:00:00Z"),
    booking(1, "2026-08-01T00:00:00Z", "2026-07-02T00:00:00Z"),
  ];

  it("shows bookings by earliest check-in first", () => {
    expect(
      sortBookingsForTable(bookings, "bookings").map((item) => item.bookingId)
    ).toEqual([1, 2]);
  });

  it("shows logs by newest creation first", () => {
    expect(
      sortBookingsForTable(bookings, "logs").map((item) => item.bookingId)
    ).toEqual([1, 2]);
  });
});
