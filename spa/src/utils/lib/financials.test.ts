import { describe, expect, it } from "vitest";
import {
  calculateFinancialTotals,
  bookingSummaryFromRow,
  extractBookingFinancials,
  hydrateBookingFinancials,
  stripFinancialData,
  shouldUseLegacyFinancials,
  validateBookingFinancials,
} from "./financials";
import { BookingDB, Property } from "./bookingType";

function booking(): BookingDB {
  return {
    bookingId: 42,
    bookingType: "Event",
    client: { name: "Financial test", phone: "123" },
    numberOfGuests: 10,
    notes: "",
    properties: [Property.Castle, Property.Bluehouse],
    status: "Confirmed",
    startDateTime: "2026-08-01T10:00:00.000Z",
    endDateTime: "2026-08-01T12:00:00.000Z",
    events: [
      {
        eventId: 100,
        eventName: "Reception",
        notes: "",
        startDateTime: "2026-08-01T10:00:00.000Z",
        endDateTime: "2026-08-01T12:00:00.000Z",
        numberOfGuests: 10,
        properties: [Property.Castle],
        valetService: false,
        djService: false,
        kitchenService: false,
        overNightStay: false,
        overNightGuests: 0,
        markForDeletion: false,
        costs: [
          {
            costId: 2,
            name: "Venue",
            amount: 5000,
            property: Property.Castle,
          },
        ],
        finalCost: 5000,
      },
    ],
    costs: [
      {
        costId: 1,
        name: "GST",
        amount: 900,
        property: Property.Castle,
        itemType: "tax",
      },
    ],
    totalCost: 5000,
    payments: [
      {
        paymentId: 3,
        amount: 2000,
        paymentMethod: "Bank transfert",
        dateTime: "2026-07-01T10:00:00.000Z",
        details: { bankAccount: "HDFC Current" },
      },
    ],
    paymentMethod: "Cash",
    starred: false,
    paid: 2000,
    outstanding: 3900,
    tax: 900,
    afterTaxTotal: 5900,
    securityDeposit: {
      originalSecurityAmount: 1000,
      paymentMethod: "Cash",
      amountReturned: 0,
      dateReturned: undefined,
    },
    createdDateTime: "2026-07-01T10:00:00.000Z",
    createdBy: { id: "user-1", name: "Tester" },
    updatedDateTime: "2026-07-01T10:00:00.000Z",
    updatedBy: { id: "user-1", name: "Tester" },
    encodingVersion: 1,
  };
}

describe("booking financial transformation", () => {
  it("extracts booking, event, payment, and deposit records", () => {
    const records = extractBookingFinancials(booking());

    expect(records.costItems).toMatchObject([
      expect.objectContaining({
        id: 1,
        itemType: "tax",
      }),
      expect.objectContaining({
        id: 2,
        itemType: "cost",
        eventId: 100,
      }),
    ]);
    expect(records.payments[0]).toMatchObject({
      id: 3,
      details: { bankAccount: "HDFC Current" },
    });
    expect(records.securityDeposit).toMatchObject({ amount: 1000 });
  });

  it("calculates totals exclusively from normalized records", () => {
    const totals = calculateFinancialTotals(extractBookingFinancials(booking()));

    expect(totals).toEqual({
      totalCost: 5000,
      tax: 900,
      afterTaxTotal: 5900,
      paid: 2000,
      outstanding: 3900,
    });
  });

  it("removes all financial values from a new JSON snapshot", () => {
    const stripped = stripFinancialData(booking()) as unknown as Record<
      string,
      unknown
    >;
    const strippedEvent = (
      stripped.events as Array<Record<string, unknown>>
    )[0];

    expect(stripped).not.toHaveProperty("costs");
    expect(stripped).not.toHaveProperty("payments");
    expect(stripped).not.toHaveProperty("securityDeposit");
    expect(stripped).not.toHaveProperty("totalCost");
    expect(stripped).not.toHaveProperty("tax");
    expect(stripped).not.toHaveProperty("afterTaxTotal");
    expect(stripped).not.toHaveProperty("paid");
    expect(stripped).not.toHaveProperty("outstanding");
    expect(strippedEvent).not.toHaveProperty("costs");
    expect(strippedEvent).not.toHaveProperty("finalCost");
  });

  it("hydrates the current snapshot from normalized records", () => {
    const source = booking();
    const records = extractBookingFinancials(source);
    const hydrated = hydrateBookingFinancials(
      stripFinancialData(source),
      records
    );

    expect(hydrated.costs).toMatchObject(source.costs);
    expect(hydrated.events[0].costs).toMatchObject(
      source.events[0].costs
    );
    expect(hydrated.payments).toEqual(source.payments);
    expect(hydrated.securityDeposit).toEqual(source.securityDeposit);
    expect(hydrated.outstanding).toBe(3900);
  });

  it("requires a property for every new cost and tax item", () => {
    const source = booking();
    source.costs.push({
      name: "Unassigned tax",
      amount: 100,
      itemType: "tax",
    });

    expect(() => validateBookingFinancials(source)).toThrow(
      "Select a property"
    );
  });

  it("allows an existing legacy item to remain unassigned", () => {
    const source = booking();
    source.costs.push({
      costId: 999,
      name: "Legacy shared cost",
      amount: 100,
    });

    expect(() =>
      validateBookingFinancials(source, true)
    ).not.toThrow();
  });

  it("rejects a payment without a valid date before persistence", () => {
    const source = booking();
    source.payments[0].dateTime = "";

    expect(() => validateBookingFinancials(source)).toThrow(
      "Every payment requires a valid amount and date."
    );
  });

  it("rejects a cost assigned outside its booking or event properties", () => {
    const source = booking();
    source.events[0].costs[0].property = Property.Bluehouse;

    expect(() => validateBookingFinancials(source)).toThrow(
      "Bluehouse is not selected for Venue."
    );
  });

  it("hydrates list and calendar totals from booking table columns", () => {
    const source = stripFinancialData(booking());
    const summary = bookingSummaryFromRow({
      id: 42,
      json: [source],
      total_cost: "5000",
      tax: "900",
      after_tax_total: "5900",
      paid: "2000",
      outstanding: "3900",
    });

    expect(summary).toMatchObject({
      bookingId: 42,
      totalCost: 5000,
      tax: 900,
      afterTaxTotal: 5900,
      paid: 2000,
      outstanding: 3900,
    });
  });

  it("falls back to version-1 JSON only when no normalized rows exist", () => {
    const legacy = booking();
    legacy.encodingVersion = 1;
    const emptyFinancials = {
      costItems: [],
      payments: [],
      securityDeposit: null,
    };

    expect(shouldUseLegacyFinancials(legacy, emptyFinancials)).toBe(true);
    expect(
      shouldUseLegacyFinancials(
        { ...legacy, encodingVersion: 2 },
        emptyFinancials
      )
    ).toBe(false);
    expect(
      shouldUseLegacyFinancials(legacy, extractBookingFinancials(legacy))
    ).toBe(false);
  });
});
