import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookingDB, Property } from "../bookingType";

const mocks = vi.hoisted(() => ({
  deleteEvent: vi.fn(),
  insertEvent: vi.fn(),
  patchEvent: vi.fn(),
}));

vi.mock("./calendarApi", () => ({
  deleteEvent: mocks.deleteEvent,
  insertEvent: mocks.insertEvent,
  patchEvent: mocks.patchEvent,
  isCalendarEventMissing: (error: { code?: number }) =>
    error?.code === 404 || error?.code === 410,
  isCalendarEventAlreadyExists: (error: { code?: number }) =>
    error?.code === 409,
}));

import {
  deterministicCalendarEventId,
  mapWithConcurrency,
  synchronizeCalendarInBackground,
} from "./calendarBackgroundSync";

function booking(calendarId?: string): BookingDB {
  return {
    bookingId: 42,
    bookingType: "Stay",
    client: { name: "Candidate", phone: "123" },
    numberOfGuests: 2,
    notes: "",
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
    calendarIds: calendarId
      ? { [Property.Castle]: calendarId }
      : {},
    clientViewId: "view-42",
    encodingVersion: 2,
    createdDateTime: "2026-01-01T00:00:00.000Z",
    createdBy: { id: "creator", name: "Creator" },
    updatedDateTime: "2026-01-01T00:00:00.000Z",
    updatedBy: { id: "creator", name: "Creator" },
  };
}

describe("background Calendar synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.patchEvent.mockResolvedValue(undefined);
    mocks.insertEvent.mockImplementation(async (_calendar, event) => event.id);
  });

  it("patches a legacy event directly without fetching it", async () => {
    await synchronizeCalendarInBackground(
      42,
      booking("google-old"),
      { ...booking("google-old"), totalCost: 12000, afterTaxTotal: 12000 }
    );

    expect(mocks.patchEvent).toHaveBeenCalledOnce();
    expect(mocks.patchEvent.mock.calls[0][1]).toBe("google-old");
    expect(mocks.insertEvent).not.toHaveBeenCalled();
  });

  it("uses deterministic IDs for new events", async () => {
    await synchronizeCalendarInBackground(42, null, booking());

    const expectedId = deterministicCalendarEventId(
      42,
      "stay",
      Property.Castle
    );
    expect(mocks.insertEvent.mock.calls[0][1].id).toBe(expectedId);
  });

  it("patches the deterministic event on later updates without storing its ID", async () => {
    await synchronizeCalendarInBackground(
      42,
      booking(),
      { ...booking(), totalCost: 12000, afterTaxTotal: 12000 }
    );

    expect(mocks.patchEvent.mock.calls[0][1]).toBe(
      deterministicCalendarEventId(42, "stay", Property.Castle)
    );
    expect(mocks.insertEvent).not.toHaveBeenCalled();
  });

  it("inserts a replacement when a direct patch reports a missing event", async () => {
    mocks.patchEvent.mockRejectedValueOnce({ code: 404 });

    await synchronizeCalendarInBackground(
      42,
      booking("missing-event"),
      booking("missing-event")
    );

    expect(mocks.insertEvent).toHaveBeenCalledOnce();
  });

  it("deletes a deterministic event when a booking stops blocking Calendar", async () => {
    await synchronizeCalendarInBackground(
      42,
      booking(),
      { ...booking(), status: "Inquiry" }
    );

    expect(mocks.deleteEvent.mock.calls[0][1]).toBe(
      deterministicCalendarEventId(42, "stay", Property.Castle)
    );
  });

  it("does not delete a legacy event reused under a newly assigned event key", async () => {
    const previous = {
      ...booking(),
      bookingType: "Event" as const,
      properties: [],
      events: [
        {
          eventName: "Reception",
          notes: "",
          properties: [Property.Castle],
          startDateTime: "2026-08-01T08:30:00.000Z",
          endDateTime: "2026-08-01T17:30:00.000Z",
          numberOfGuests: 2,
          finalCost: 10000,
          costs: [],
          djService: false,
          valetService: false,
          kitchenService: false,
          overNightStay: false,
          overNightGuests: 0,
          markForDeletion: false,
          calendarIds: { [Property.Castle]: "legacy-event" },
        },
      ],
    };
    const desired = {
      ...previous,
      events: [{ ...previous.events[0], eventId: 123 }],
    };

    await synchronizeCalendarInBackground(42, previous, desired);

    expect(mocks.patchEvent.mock.calls[0][1]).toBe("legacy-event");
    expect(mocks.deleteEvent).not.toHaveBeenCalled();
  });

  it("limits parallel Google operations", async () => {
    let active = 0;
    let maximum = 0;

    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active++;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active--;
      return value;
    });

    expect(maximum).toBe(2);
  });
});

