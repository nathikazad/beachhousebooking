import { describe, expect, it } from "vitest";
import { BookingDB, Property } from "./bookingType";
import { BookingReadRow, bookingReadResult } from "./bookingRead";

function currentBooking(): BookingDB {
  return {
    bookingId: 42,
    bookingType: "Stay",
    client: { name: "Direct read", phone: "9999999999" },
    numberOfGuests: 2,
    notes: "",
    properties: [Property.Castle],
    status: "Confirmed",
    startDateTime: "2026-08-01T10:00:00.000Z",
    endDateTime: "2026-08-02T10:00:00.000Z",
    events: [],
    costs: [],
    payments: [],
    totalCost: 0,
    paid: 0,
    outstanding: 0,
    tax: 0,
    afterTaxTotal: 0,
    paymentMethod: "Cash",
    starred: false,
    securityDeposit: {
      originalSecurityAmount: 0,
      paymentMethod: "Cash",
      amountReturned: 0,
    },
    createdDateTime: "2026-07-01T10:00:00.000Z",
    createdBy: { id: "user-1", name: "Tester" },
    updatedDateTime: "2026-07-01T10:00:00.000Z",
    updatedBy: { id: "user-1", name: "Tester" },
    encodingVersion: 2,
  };
}

describe("direct booking read hydration", () => {
  it("hydrates normalized financial rows onto the latest booking", () => {
    const row: BookingReadRow = {
      id: 42,
      history: [currentBooking()],
      history_count: 3,
      cost_items: [
        {
          id: 1,
          property: "castle",
          event_id: null,
          item_type: "cost",
          name: "Stay",
          amount: "1000",
        },
        {
          id: 2,
          property: "castle",
          event_id: null,
          item_type: "tax",
          name: "GST",
          amount: "180",
        },
      ],
      payments: [
        {
          id: 3,
          amount: "500",
          payment_method: "Cash",
          payment_date: "2026-07-02T10:00:00.000Z",
          received_by: null,
          details: {},
        },
      ],
      security_deposit: null,
    };

    const result = bookingReadResult(row);

    expect(result.historyCount).toBe(3);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]).toMatchObject({
      bookingId: 42,
      totalCost: 1000,
      tax: 180,
      afterTaxTotal: 1180,
      paid: 500,
      outstanding: 680,
    });
    expect(result.history[0].costs[0]).toMatchObject({
      name: "Stay",
      amount: 1000,
      property: Property.Castle,
    });
  });

  it("keeps legacy JSON financials when no normalized rows exist", () => {
    const legacy = {
      ...currentBooking(),
      encodingVersion: 1 as const,
      totalCost: 700,
      outstanding: 700,
    };
    const result = bookingReadResult({
      id: 43,
      history: [legacy],
      history_count: 1,
      cost_items: [],
      payments: [],
      security_deposit: null,
    });

    expect(result.history[0].totalCost).toBe(700);
  });
});
