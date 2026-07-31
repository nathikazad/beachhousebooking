import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingDB, Property } from "./bookingType";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  transactionQuery: vi.fn(),
}));

vi.mock("./helper", () => ({
  query: mocks.query,
  withTransaction: vi.fn(async (callback) =>
    callback({ query: mocks.transactionQuery })
  ),
}));

import { fetchBooking, fetchLatestBooking, updateBooking } from "./db";

function booking(name: string): BookingDB {
  return {
    bookingId: 42,
    bookingType: "Stay",
    client: { name, phone: "123" },
    numberOfGuests: 2,
    notes: "",
    properties: [Property.Castle],
    status: "Confirmed",
    startDateTime: "2026-08-01T10:00:00.000Z",
    endDateTime: "2026-08-02T10:00:00.000Z",
    events: [],
    costs: [],
    totalCost: 0,
    payments: [],
    paymentMethod: "Cash",
    starred: false,
    paid: 0,
    outstanding: 0,
    tax: 0,
    afterTaxTotal: 0,
    securityDeposit: {
      originalSecurityAmount: 0,
      paymentMethod: "Cash",
      amountReturned: 0,
      dateReturned: undefined,
    },
    createdDateTime: "2026-07-01T10:00:00.000Z",
    createdBy: { id: "user-1", name: "Tester" },
    updatedDateTime: "2026-07-01T10:00:00.000Z",
    updatedBy: { id: "user-1", name: "Tester" },
    encodingVersion: 2,
  };
}

function databaseRow(history: BookingDB[], historyCount = history.length) {
  return {
    id: "42",
    history,
    history_count: String(historyCount),
    cost_items: [
      {
        id: "10",
        property: "castle",
        event_id: null,
        item_type: "cost",
        name: "Venue",
        amount: "1500",
      },
    ],
    payments: [
      {
        id: "20",
        amount: "500",
        payment_method: "Cash",
        payment_date: "2026-07-15T10:00:00.000Z",
        received_by: null,
        details: {},
      },
    ],
    security_deposit: null,
  };
}

describe("booking reads", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.transactionQuery.mockReset();
    mocks.transactionQuery.mockResolvedValue({ rows: [] });
  });

  it("appends one snapshot instead of resending the complete history", async () => {
    const latest = booking("Latest");

    await updateBooking(latest, 42, undefined);

    const updateCall = mocks.transactionQuery.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE bookings")
    );
    expect(updateCall?.[0]).toContain("json = array_append");
    expect(JSON.parse(updateCall?.[1][1])).toMatchObject({
      client: { name: "Latest" },
    });
  });

  it("loads and hydrates the latest booking with one query", async () => {
    mocks.query.mockResolvedValue([
      databaseRow([booking("Latest")], 4),
    ]);

    const result = await fetchLatestBooking(42);

    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0][1]).toEqual([42, false]);
    expect(result.historyCount).toBe(4);
    expect(result.history).toHaveLength(1);
    expect(result.history[0].costs).toEqual([
      expect.objectContaining({
        name: "Venue",
        amount: 1500,
        property: Property.Castle,
      }),
    ]);
    expect(result.history[0].paid).toBe(500);
  });

  it("requests complete history through the same single query", async () => {
    mocks.query.mockResolvedValue([
      databaseRow([booking("Original"), booking("Latest")]),
    ]);

    const history = await fetchBooking(42);

    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0][1]).toEqual([42, true]);
    expect(history).toHaveLength(2);
    expect(history[1].client.name).toBe("Latest");
  });
});
