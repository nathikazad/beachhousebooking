import { describe, expect, it } from "vitest";

import { BookingDB, Property } from "../bookingType";
import {
  desiredCalendarEvents,
  needsCalendarSync,
  removeMarkedEvents,
} from "./calendarSyncModel";

function booking(): BookingDB {
  return {
    bookingId: 42,
    bookingType: "Stay",
    client: { name: "Candidate", phone: "123" },
    numberOfGuests: 2,
    notes: "Original",
    properties: [Property.Castle],
    status: "Confirmed",
    startDateTime: "2026-08-01T08:30:00.000Z",
    endDateTime: "2026-08-01T17:30:00.000Z",
    events: [],
    costs: [],
    totalCost: 10000,
    payments: [],
    paymentMethod: "Cash",
    starred: false,
    paid: 0,
    outstanding: 10000,
    afterTaxTotal: 10000,
    tax: 0,
    securityDeposit: {
      originalSecurityAmount: 0,
      paymentMethod: "Cash",
      dateReturned: undefined,
      amountReturned: 0,
    },
    calendarIds: { [Property.Castle]: "existing-google-id" },
    clientViewId: "view-42",
    encodingVersion: 2,
    createdDateTime: "2026-01-01T00:00:00.000Z",
    createdBy: { id: "creator", name: "Creator" },
    updatedDateTime: "2026-01-01T00:00:00.000Z",
    updatedBy: { id: "creator", name: "Creator" },
  };
}

describe("Calendar synchronization model", () => {
  it("does not synchronize notes-only or audit-metadata-only edits", () => {
    const previous = booking();
    const desired = {
      ...previous,
      notes: "Changed",
      updatedDateTime: "2026-01-02T00:00:00.000Z",
      updatedBy: { id: "editor", name: "Editor" },
    };

    expect(needsCalendarSync(previous, desired)).toBe(false);
  });

  it("synchronizes changes visible in the Calendar description", () => {
    const previous = booking();
    const desired = {
      ...previous,
      payments: [
        {
          paymentId: 1,
          amount: 1000,
          paymentMethod: "Cash" as const,
          dateTime: "2026-07-01T00:00:00.000Z",
        },
      ],
    };

    expect(needsCalendarSync(previous, desired)).toBe(true);
  });

  it("builds one desired Calendar entry per property with the legacy ID", () => {
    const entries = desiredCalendarEvents(booking());

    expect(entries).toEqual([
      expect.objectContaining({
        eventKey: "stay",
        property: Property.Castle,
        legacyCalendarId: "existing-google-id",
      }),
    ]);
  });

  it("removes marked events before database persistence", () => {
    const eventBooking: BookingDB = {
      ...booking(),
      bookingType: "Event",
      properties: [],
      events: [
        {
          eventId: 10,
          eventName: "Keep",
          notes: "",
          properties: [Property.Castle],
          startDateTime: "2026-08-01T08:30:00.000Z",
          endDateTime: "2026-08-01T10:30:00.000Z",
          numberOfGuests: 2,
          finalCost: 1000,
          costs: [],
          djService: false,
          valetService: false,
          kitchenService: false,
          overNightStay: false,
          overNightGuests: 0,
          markForDeletion: false,
        },
        {
          eventId: 11,
          eventName: "Remove",
          notes: "",
          properties: [Property.Castle],
          startDateTime: "2026-08-01T11:30:00.000Z",
          endDateTime: "2026-08-01T12:30:00.000Z",
          numberOfGuests: 2,
          finalCost: 1000,
          costs: [],
          djService: false,
          valetService: false,
          kitchenService: false,
          overNightStay: false,
          overNightGuests: 0,
          markForDeletion: true,
        },
      ],
    };

    expect(removeMarkedEvents(eventBooking).events).toHaveLength(1);
    expect(removeMarkedEvents(eventBooking).events[0].eventId).toBe(10);
  });
});
