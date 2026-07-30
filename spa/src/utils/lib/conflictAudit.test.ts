import { describe, expect, it } from "vitest";
import {
  AuditedBookingConflict,
  AuditedBookingPeriod,
  formatPairConflictMessage,
  groupBookingConflicts,
} from "./conflictAudit";

function period(
  bookingId: number,
  clientName: string,
  eventKey = "stay",
  startsAt = "2026-08-01T08:00:00.000Z",
  endsAt = "2026-08-01T14:00:00.000Z"
): AuditedBookingPeriod {
  return {
    bookingId,
    clientName,
    status: "confirmed",
    eventKey,
    eventName: eventKey === "stay" ? "Stay" : eventKey,
    startsAt,
    endsAt,
  };
}

function conflict(
  firstBooking: AuditedBookingPeriod,
  secondBooking: AuditedBookingPeriod,
  overlapStartsAt: string,
  overlapEndsAt: string,
  property = "castle"
): AuditedBookingConflict {
  return {
    firstBooking,
    secondBooking,
    property,
    overlapStartsAt,
    overlapEndsAt,
  };
}

describe("groupBookingConflicts", () => {
  it("groups connected pairwise conflicts and exposes every booking once", () => {
    const first = period(10, "First guest");
    const second = period(20, "Second guest");
    const third = period(30, "Third guest");

    const groups = groupBookingConflicts([
      conflict(
        first,
        second,
        "2026-08-01T10:00:00.000Z",
        "2026-08-01T12:00:00.000Z"
      ),
      conflict(
        second,
        third,
        "2026-08-01T11:00:00.000Z",
        "2026-08-01T13:00:00.000Z"
      ),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].bookings.map((booking) => booking.bookingId)).toEqual([
      10, 20, 30,
    ]);
    expect(groups[0].message).toContain(
      "3 reservations are involved in connected overlaps at Castle"
    );
    expect(groups[0].overlapStartsAt).toBe("2026-08-01T10:00:00.000Z");
    expect(groups[0].overlapEndsAt).toBe("2026-08-01T13:00:00.000Z");
  });

  it("keeps separate properties and back-to-back conflict periods apart", () => {
    const bookings = [
      period(10, "First"),
      period(20, "Second"),
      period(30, "Third"),
      period(40, "Fourth"),
    ];

    const groups = groupBookingConflicts([
      conflict(
        bookings[0],
        bookings[1],
        "2026-08-01T10:00:00.000Z",
        "2026-08-01T12:00:00.000Z"
      ),
      conflict(
        bookings[2],
        bookings[3],
        "2026-08-01T12:00:00.000Z",
        "2026-08-01T13:00:00.000Z"
      ),
      conflict(
        bookings[0],
        bookings[2],
        "2026-08-01T10:30:00.000Z",
        "2026-08-01T11:30:00.000Z",
        "lechalet"
      ),
    ]);

    expect(groups).toHaveLength(3);
    expect(groups.map((group) => group.property)).toEqual([
      "castle",
      "lechalet",
      "castle",
    ]);
  });

  it("keeps multiple event periods under one navigable booking", () => {
    const firstEvent = period(10, "Event guest", "Ceremony");
    const secondEvent = period(10, "Event guest", "Reception");
    const second = period(20, "Second guest");
    const third = period(30, "Third guest");

    const [group] = groupBookingConflicts([
      conflict(
        firstEvent,
        second,
        "2026-08-01T10:00:00.000Z",
        "2026-08-01T12:00:00.000Z"
      ),
      conflict(
        secondEvent,
        third,
        "2026-08-01T11:00:00.000Z",
        "2026-08-01T13:00:00.000Z"
      ),
    ]);

    expect(group.bookings).toHaveLength(3);
    expect(
      group.bookings.find((booking) => booking.bookingId === 10)?.periods
    ).toHaveLength(2);
  });
});

describe("formatPairConflictMessage", () => {
  it("names both bookings and the exact overlap period", () => {
    const message = formatPairConflictMessage(
      conflict(
        period(101, "Alice"),
        period(202, "Bob"),
        "2026-08-01T10:00:00.000Z",
        "2026-08-01T12:00:00.000Z"
      )
    );

    expect(message).toContain("booking #101 (Alice)");
    expect(message).toContain("booking #202 (Bob)");
    expect(message).toContain("1 Aug 2026, 3:30 pm");
    expect(message).toContain("1 Aug 2026, 5:30 pm");
  });
});
