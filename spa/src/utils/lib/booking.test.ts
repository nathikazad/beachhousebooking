import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingForm, Property } from "./bookingType";
import { BookingConflictError } from "./occupancy";

const mocks = vi.hoisted(() => ({
  addToCalendar: vi.fn(),
  createBooking: vi.fn(),
  deleteCalendarEvents: vi.fn(),
  fetchBooking: vi.fn(),
  findBookingConflicts: vi.fn(),
  query: vi.fn(),
  updateBooking: vi.fn(),
}));

vi.mock("./calendar/calendarLogic", () => ({
  addToCalendar: mocks.addToCalendar,
  deleteCalendarEvents: mocks.deleteCalendarEvents,
}));

vi.mock("./db", () => ({
  createBooking: mocks.createBooking,
  fetchBooking: mocks.fetchBooking,
  findBookingConflicts: mocks.findBookingConflicts,
  updateBooking: mocks.updateBooking,
}));

vi.mock("./helper", () => ({
  query: mocks.query,
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
    mocks.addToCalendar.mockImplementation(async (booking) => booking);
    mocks.createBooking.mockResolvedValue(42);
  });

  it("stops before Calendar and persistence and returns every Supabase conflict", async () => {
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
    expect(mocks.addToCalendar).not.toHaveBeenCalled();
    expect(mocks.createBooking).not.toHaveBeenCalled();
  });

  it("continues to Calendar and persistence when Supabase reports no conflicts", async () => {
    mocks.findBookingConflicts.mockResolvedValue([]);

    await expect(
      mutateBookingState(confirmedStay(), {
        id: "user-1",
        displayName: "Tester",
      })
    ).resolves.toBe(42);

    expect(mocks.addToCalendar).toHaveBeenCalledOnce();
    expect(mocks.createBooking).toHaveBeenCalledOnce();
  });
});

describe("deleteBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteCalendarEvents.mockResolvedValue(undefined);
  });

  it("does not resolve until the SQL deletion has completed", async () => {
    let completeSqlDelete!: (rows: unknown[]) => void;
    const pendingSqlDelete = new Promise<unknown[]>((resolve) => {
      completeSqlDelete = resolve;
    });

    mocks.query
      .mockResolvedValueOnce([
        {
          json: [{ ...confirmedStay(), bookingId: 2794 }],
        },
      ])
      .mockReturnValueOnce(pendingSqlDelete);

    let deletionResolved = false;
    const deletion = deleteBooking(2794).then(() => {
      deletionResolved = true;
    });

    await vi.waitFor(() => {
      expect(mocks.query).toHaveBeenNthCalledWith(
        2,
        "DELETE FROM bookings WHERE id = $1",
        [2794]
      );
    });
    await Promise.resolve();

    expect(deletionResolved).toBe(false);

    completeSqlDelete([]);
    await deletion;

    expect(deletionResolved).toBe(true);
  });
});
