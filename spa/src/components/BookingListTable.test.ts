import { describe, expect, it } from "vitest";
import { BookingDB } from "../utils/lib/bookingType";
import { Property } from "../utils/lib/bookingType";
import {
  abbreviateTableProperties,
  firstTableName,
  formatCompactTableDate,
  sortBookingsForTable,
} from "./BookingListTable";

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

describe("compact booking table values", () => {
  it("drops the year from compact dates", () => {
    expect(formatCompactTableDate("2026-08-02T00:00:00Z")).toBe("02 Aug");
  });

  it("uses only the first client name", () => {
    expect(firstTableName("  Darsyanaa Guest Name ")).toBe("Darsyanaa");
  });

  it.each([
    ["Mr Nishtar Guest", "Nishtar"],
    ["Dr. Rafica Guest", "Rafica"],
    ["Mrs. Dr. Darsyanaa Guest", "Darsyanaa"],
  ])("skips titles in %s", (name, expected) => {
    expect(firstTableName(name)).toBe(expected);
  });

  it("abbreviates every property", () => {
    expect(
      abbreviateTableProperties([
        Property.Bluehouse,
        Property.Glasshouse,
        Property.Castle,
        Property.MeadowLane,
        Property.LeChalet,
        Property.VillaArmati,
      ])
    ).toBe("BH, GH, C, ML, LC, VA");
  });
});
