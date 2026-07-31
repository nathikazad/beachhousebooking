import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingForm, Property } from "./bookingType";
import { BookingConflictError } from "./occupancy";

const mocks = vi.hoisted(() => ({
  createBooking: vi.fn(),
  fetchLatestBooking: vi.fn(),
  findBookingConflicts: vi.fn(),
  updateBooking: vi.fn(),
  transactionQuery: vi.fn(),
}));

vi.mock("./db", () => ({
  createBooking: mocks.createBooking,
  fetchLatestBooking: mocks.fetchLatestBooking,
  findBookingConflicts: mocks.findBookingConflicts,
  updateBooking: mocks.updateBooking,
}));

vi.mock("./helper", () => ({
  withTransaction: vi.fn(async (callback) =>
    callback({ query: mocks.transactionQuery })
  ),
}));

import { deleteBooking, mutateBookingState } from "./booking";

function confirmedStay(): BookingForm {
  return {
    bookingType: "Stay",
    client: { name: "Candidate", phone: "123" },
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
  };
}

describe("mutateBookingState conflict validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createBooking.mockResolvedValue(42);
  });

  it("stops before persistence and returns every Supabase conflict", async () => {
    mocks.findBookingConflicts.mockResolvedValue([
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
        clientName: "Another guest",
        status: "preconfirmed",
        eventKey: "event-1",
        eventName: "Reception",
        property: "castle",
        existingStartsAt: "2026-06-25T09:00:00.000Z",
        existingEndsAt: "2026-06-25T10:00:00.000Z",
        overlapStartsAt: "2026-06-25T09:00:00.000Z",
        overlapEndsAt: "2026-06-25T10:00:00.000Z",
      },
    ]);

    const promise = mutateBookingState(confirmedStay(), {
      id: "user-1",
      displayName: "Tester",
    });

    await expect(promise).rejects.toMatchObject({
      name: "BookingConflictError",
      conflicts: expect.arrayContaining([
        expect.objectContaining({ bookingId: 3046 }),
        expect.objectContaining({ bookingId: 4000 }),
      ]),
    });
    await expect(promise).rejects.toBeInstanceOf(BookingConflictError);
    expect(mocks.createBooking).not.toHaveBeenCalled();
  });

  it("persists and returns a background Calendar plan when there are no conflicts", async () => {
    mocks.findBookingConflicts.mockResolvedValue([]);

    await expect(
      mutateBookingState(confirmedStay(), {
        id: "user-1",
        displayName: "Tester",
      })
    ).resolves.toMatchObject({
      bookingId: 42,
      calendarSync: {
        bookingId: 42,
        previousBooking: null,
        desiredBooking: expect.any(Object),
      },
    });

    expect(mocks.createBooking).toHaveBeenCalledWith(
      expect.any(Object),
      "Tester",
      undefined
    );
  });

  it("stops before persistence when a new financial item has no property", async () => {
    const booking = confirmedStay();
    booking.costs = [{ name: "Rent", amount: 1000 }];

    await expect(
      mutateBookingState(booking, {
        id: "user-1",
        displayName: "Tester",
      })
    ).rejects.toThrow("Select a property");

    expect(mocks.createBooking).not.toHaveBeenCalled();
  });

  it("does not return a Calendar plan when only non-calendar fields changed", async () => {
    const previous = {
      ...confirmedStay(),
      bookingId: 42,
      notes: "Before",
      createdBy: { id: "creator", name: "Creator" },
      updatedBy: { id: "creator", name: "Creator" },
      createdDateTime: "2026-01-01T00:00:00.000Z",
      updatedDateTime: "2026-01-01T00:00:00.000Z",
      encodingVersion: 2 as const,
      clientViewId: "view-42",
    };
    mocks.fetchLatestBooking.mockResolvedValue({
      history: [previous],
      historyCount: 1,
    });
    mocks.findBookingConflicts.mockResolvedValue([]);
    mocks.updateBooking.mockResolvedValue(undefined);

    const result = await mutateBookingState(
      { ...previous, notes: "After" },
      { id: "user-1", displayName: "Tester" }
    );

    expect(mocks.updateBooking).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "After" }),
      42,
      undefined
    );
    expect(result).toMatchObject({ bookingId: 42 });
    expect(result.calendarSync).toBeUndefined();
  });
});

describe("deleteBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchLatestBooking.mockResolvedValue({
      history: [{ ...confirmedStay(), bookingId: 2794 }],
      historyCount: 1,
    });
  });

  it("returns a Calendar deletion plan after SQL deletion", async () => {
    mocks.transactionQuery.mockResolvedValue({ rows: [] });

    const plan = await deleteBooking(2794);

    expect(mocks.transactionQuery).toHaveBeenCalledWith(
      "DELETE FROM bookings WHERE id = $1",
      [2794]
    );
    expect(plan).toEqual({
      bookingId: 2794,
      previousBooking: expect.objectContaining({ bookingId: 2794 }),
      desiredBooking: null,
    });
  });
});
