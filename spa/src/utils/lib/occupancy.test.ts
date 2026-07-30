import { describe, expect, it } from "vitest";
import { BookingForm, Property } from "./bookingType";
import {
  OccupancyNormalizationError,
  formatBookingConflictMessage,
  normalizeBookingToOccupancies,
} from "./occupancy";

function booking(overrides: Partial<BookingForm> = {}): BookingForm {
  return {
    bookingType: "Stay",
    client: { name: "Guest", phone: "123" },
    numberOfGuests: 2,
    notes: "",
    properties: [Property.Castle],
    status: "Confirmed",
    startDateTime: "2026-06-25T08:30:00.000Z",
    endDateTime: "2026-06-25T17:30:00.000Z",
    events: [],
    costs: [],
    totalCost: 0,
    payments: [],
    paymentMethod: "Cash",
    starred: false,
    paid: 0,
    outstanding: 0,
    afterTaxTotal: 0,
    tax: 0,
    securityDeposit: {
      originalSecurityAmount: 0,
      paymentMethod: "Cash",
      dateReturned: undefined,
      amountReturned: 0,
    },
    createdDateTime: undefined,
    ...overrides,
  };
}

describe("normalizeBookingToOccupancies", () => {
  it("creates one Stay occupancy per unique property", () => {
    const result = normalizeBookingToOccupancies(
      booking({
        properties: [Property.Castle, Property.LeChalet, Property.Castle],
      })
    );

    expect(result).toEqual([
      {
        eventKey: "stay",
        eventName: "Stay",
        property: "castle",
        startsAt: "2026-06-25T08:30:00.000Z",
        endsAt: "2026-06-25T17:30:00.000Z",
        status: "confirmed",
      },
      {
        eventKey: "stay",
        eventName: "Stay",
        property: "lechalet",
        startsAt: "2026-06-25T08:30:00.000Z",
        endsAt: "2026-06-25T17:30:00.000Z",
        status: "confirmed",
      },
    ]);
  });

  it("uses each active Event period and ignores deleted events", () => {
    const result = normalizeBookingToOccupancies(
      booking({
        bookingType: "Event",
        properties: [],
        events: [
          {
            eventId: 99,
            eventName: "Wedding",
            notes: "",
            startDateTime: "2026-08-01T10:00:00.000Z",
            endDateTime: "2026-08-01T12:00:00.000Z",
            numberOfGuests: 50,
            properties: [Property.MeadowLane, Property.Castle],
            valetService: false,
            djService: false,
            kitchenService: false,
            overNightStay: false,
            overNightGuests: 0,
            markForDeletion: false,
            costs: [],
            finalCost: 0,
          },
          {
            eventId: 100,
            eventName: "Deleted event",
            notes: "",
            startDateTime: "2026-08-01T13:00:00.000Z",
            endDateTime: "2026-08-01T14:00:00.000Z",
            numberOfGuests: 10,
            properties: [Property.Castle],
            valetService: false,
            djService: false,
            kitchenService: false,
            overNightStay: false,
            overNightGuests: 0,
            markForDeletion: true,
            costs: [],
            finalCost: 0,
          },
        ],
      })
    );

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.property)).toEqual([
      "meadowlane",
      "castle",
    ]);
    expect(result.every((item) => item.eventKey === "event-99")).toBe(true);
  });

  it("does not create inventory occupancy for non-blocking statuses", () => {
    expect(
      normalizeBookingToOccupancies(booking({ status: "Quotation" }))
    ).toEqual([]);
  });

  it("rejects invalid or reversed periods", () => {
    expect(() =>
      normalizeBookingToOccupancies(
        booking({
          startDateTime: "2026-06-25T17:30:00.000Z",
          endDateTime: "2026-06-25T08:30:00.000Z",
        })
      )
    ).toThrow(OccupancyNormalizationError);
  });
});

describe("formatBookingConflictMessage", () => {
  it("identifies every conflicting reservation and overlap in IST", () => {
    const message = formatBookingConflictMessage([
      {
        bookingId: 3046,
        clientName: "Ganga",
        status: "confirmed",
        eventKey: "stay",
        eventName: "Stay",
        property: "castle",
        existingStartsAt: "2026-06-25T08:30:00.000Z",
        existingEndsAt: "2026-06-26T17:30:00.000Z",
        overlapStartsAt: "2026-06-25T08:30:00.000Z",
        overlapEndsAt: "2026-06-25T17:30:00.000Z",
      },
      {
        bookingId: 4000,
        clientName: "Second guest",
        status: "preconfirmed",
        eventKey: "event-10",
        eventName: "Reception",
        property: "lechalet",
        existingStartsAt: "2026-06-25T09:00:00.000Z",
        existingEndsAt: "2026-06-25T10:00:00.000Z",
        overlapStartsAt: "2026-06-25T09:00:00.000Z",
        overlapEndsAt: "2026-06-25T10:00:00.000Z",
      },
    ]);

    expect(message).toContain("2 existing reservation periods");
    expect(message).toContain("Ganga");
    expect(message).toContain("booking #3046");
    expect(message).toContain("Second guest");
    expect(message).toContain("Le Chalet");
    expect(message).toContain("25 Jun 2026, 2:00 pm");
  });
});
