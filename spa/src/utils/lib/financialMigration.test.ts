import { describe, expect, it } from "vitest";
import {
  LegacyFinancialBookingRow,
  prepareFinancialMigration,
  summarizeFinancialMigrations,
} from "./financialMigration";
import { BookingDB, Property } from "./bookingType";

function legacyBooking(overrides: Partial<BookingDB> = {}): BookingDB {
  return {
    bookingId: 10,
    bookingType: "Event",
    client: { name: "Migration", phone: "123" },
    numberOfGuests: 4,
    notes: "",
    properties: [Property.Castle],
    status: "Confirmed",
    startDateTime: "2026-08-01T10:00:00.000Z",
    endDateTime: "2026-08-01T12:00:00.000Z",
    events: [
      {
        eventId: 99,
        eventName: "Reception",
        notes: "",
        startDateTime: "2026-08-01T10:00:00.000Z",
        endDateTime: "2026-08-01T12:00:00.000Z",
        numberOfGuests: 4,
        properties: [Property.Castle],
        valetService: false,
        djService: false,
        kitchenService: false,
        overNightStay: false,
        overNightGuests: 0,
        markForDeletion: false,
        costs: [{ name: "Venue", amount: 5000 }],
        finalCost: 5000,
      },
    ],
    costs: [{ name: "Cleaning", amount: 500 }],
    totalCost: 5500,
    payments: [
      {
        paymentId: 1,
        amount: 2000,
        paymentMethod: "Bank transfert",
        dateTime: "2026-07-01T10:00:00.000Z",
        receivedBy: { id: "user-1", name: "Tester" },
      },
    ],
    paymentMethod: "Cash",
    starred: false,
    paid: 2000,
    outstanding: 4490,
    tax: 990,
    afterTaxTotal: 6490,
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
    ...overrides,
  };
}

function row(
  properties: string[] | string | null,
  booking = legacyBooking()
): LegacyFinancialBookingRow {
  return { id: 10, properties, json: [booking] };
}

describe("prepareFinancialMigration", () => {
  it("assigns every cost and tax item when the booking has one property", () => {
    const result = prepareFinancialMigration(row(["castle"]));

    expect(result.issues).toEqual([]);
    expect(result.financials.costItems).toEqual([
      expect.objectContaining({
        name: "Cleaning",
        amount: 500,
        property: Property.Castle,
        itemType: "cost",
      }),
      expect.objectContaining({
        name: "Venue",
        amount: 5000,
        property: Property.Castle,
        eventId: 99,
        itemType: "cost",
      }),
      expect.objectContaining({
        name: "Tax",
        amount: 990,
        property: Property.Castle,
        itemType: "tax",
      }),
    ]);
  });

  it("parses the custom Postgres enum array representation", () => {
    const result = prepareFinancialMigration(row("{castle}"));

    expect(
      result.financials.costItems.every(
        (item) => item.property === Property.Castle
      )
    ).toBe(true);
  });

  it("leaves cost and tax properties null for multi-property bookings", () => {
    const result = prepareFinancialMigration(
      row(["castle", "bluehouse"])
    );

    expect(result.financials.costItems).toHaveLength(3);
    expect(result.financials.costItems).toEqual([
      expect.objectContaining({
        name: "Cleaning",
        property: undefined,
      }),
      expect.objectContaining({
        name: "Venue",
        property: Property.Castle,
      }),
      expect.objectContaining({
        name: "Tax",
        property: undefined,
      }),
    ]);
  });

  it("leaves an event cost unassigned when that event has multiple properties", () => {
    const booking = legacyBooking();
    booking.events[0].properties = [Property.Castle, Property.Bluehouse];
    const result = prepareFinancialMigration(
      row(["castle", "bluehouse"], booking)
    );

    expect(
      result.financials.costItems.find((item) => item.name === "Venue")
        ?.property
    ).toBeUndefined();
  });

  it("defaults Bluehouse and Glasshouse costs to Bluehouse but leaves tax unassigned", () => {
    const booking = legacyBooking({
      properties: [Property.Bluehouse, Property.Glasshouse],
    });
    booking.events[0].properties = [
      Property.Bluehouse,
      Property.Glasshouse,
    ];
    const result = prepareFinancialMigration(
      row(["bluehouse", "glasshouse"], booking)
    );

    expect(result.financials.costItems).toEqual([
      expect.objectContaining({
        name: "Cleaning",
        property: Property.Bluehouse,
      }),
      expect.objectContaining({
        name: "Venue",
        property: Property.Bluehouse,
      }),
      expect.objectContaining({
        name: "Tax",
        property: undefined,
      }),
    ]);
  });

  it("still uses a single event property when the booking has no property", () => {
    const result = prepareFinancialMigration(row([]));

    expect(result.financials.costItems).toEqual([
      expect.objectContaining({
        name: "Cleaning",
        property: undefined,
      }),
      expect.objectContaining({
        name: "Venue",
        property: Property.Castle,
      }),
      expect.objectContaining({
        name: "Tax",
        property: undefined,
      }),
    ]);
  });

  it("creates tax as its own item and preserves event association", () => {
    const result = prepareFinancialMigration(row(["castle"]));
    const eventCost = result.financials.costItems.find(
      (item) => item.name === "Venue"
    );
    const tax = result.financials.costItems.find(
      (item) => item.itemType === "tax"
    );

    expect(eventCost?.eventId).toBe(99);
    expect(tax).toMatchObject({
      name: "Tax",
      amount: 990,
    });
    expect(tax?.eventId).toBeUndefined();
  });

  it("migrates payments with empty flexible details and meaningful deposits", () => {
    const result = prepareFinancialMigration(row(["castle"]));

    expect(result.financials.payments).toEqual([
      expect.objectContaining({
        amount: 2000,
        paymentMethod: "Bank transfert",
        paymentDate: "2026-07-01T10:00:00.000Z",
        details: {},
      }),
    ]);
    expect(result.financials.securityDeposit).toMatchObject({
      amount: 1000,
      paymentMethod: "Cash",
      amountReturned: 0,
    });
  });

  it("preserves existing unstructured payment details", () => {
    const booking = legacyBooking({
      payments: [
        {
          paymentId: 1,
          amount: 2000,
          paymentMethod: "Bank transfert",
          dateTime: "2026-07-01T10:00:00.000Z",
          details: {
            bankAccount: "HDFC Current",
            reference: "TX-123",
          },
        },
      ],
    });

    const result = prepareFinancialMigration(row(["castle"], booking));

    expect(result.financials.payments[0].details).toEqual({
      bankAccount: "HDFC Current",
      reference: "TX-123",
    });
  });

  it("skips invalid amounts and reports their exact JSON path", () => {
    const booking = legacyBooking({
      costs: [
        { name: "Valid", amount: 100 },
        { name: "Broken", amount: undefined as unknown as number },
      ],
      events: [],
      tax: 0,
      payments: [],
    });

    const result = prepareFinancialMigration(row(["castle"], booking));

    expect(result.financials.costItems).toHaveLength(1);
    expect(result.issues).toContainEqual({
      bookingId: 10,
      path: "costs[1].amount",
      severity: "error",
      message: "Cost amount is missing or invalid.",
    });
  });

  it("replaces a blank legacy name but records the repair", () => {
    const booking = legacyBooking({
      costs: [{ name: "   ", amount: 100 }],
      events: [],
      tax: 0,
      payments: [],
    });

    const result = prepareFinancialMigration(row(["castle"], booking));

    expect(result.financials.costItems[0].name).toBe(
      "Unnamed legacy cost"
    );
    expect(result.issues[0].path).toBe("costs[0].name");
    expect(result.issues[0].severity).toBe("warning");
  });

  it("reports malformed payment, tax, and deposit values as blocking issues", () => {
    const booking = legacyBooking({
      tax: "broken" as unknown as number,
      payments: [
        {
          paymentId: 1,
          amount: 200,
          paymentMethod: "Cash",
          dateTime: "not-a-date",
        },
      ],
      securityDeposit: {
        originalSecurityAmount: "broken" as unknown as number,
        paymentMethod: "Cash",
        amountReturned: 0,
        dateReturned: undefined,
      },
    });

    const result = prepareFinancialMigration(row(["castle"], booking));

    expect(result.financials.payments).toEqual([]);
    expect(result.financials.securityDeposit).toBeNull();
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "tax",
          severity: "error",
        }),
        expect.objectContaining({
          path: "payments[0].dateTime",
          severity: "error",
        }),
        expect.objectContaining({
          path: "securityDeposit.originalSecurityAmount",
          severity: "error",
        }),
      ])
    );
  });

  it("reports a booking with no JSON history", () => {
    const result = prepareFinancialMigration({
      id: 12,
      properties: ["castle"],
      json: [],
    });

    expect(result.financials).toEqual({
      costItems: [],
      payments: [],
      securityDeposit: null,
    });
    expect(result.issues).toEqual([
      expect.objectContaining({
        bookingId: 12,
        path: "json",
        severity: "error",
      }),
    ]);
  });

  it("uses only the latest JSON snapshot", () => {
    const result = prepareFinancialMigration({
      id: 10,
      properties: ["castle"],
      json: [
        legacyBooking({ costs: [{ name: "Old", amount: 1 }] }),
        legacyBooking({ costs: [{ name: "Current", amount: 2 }] }),
      ],
    });

    expect(result.financials.costItems.map((item) => item.name)).toEqual([
      "Current",
      "Venue",
      "Tax",
    ]);
  });
});

describe("summarizeFinancialMigrations", () => {
  it("reconciles row counts and financial totals", () => {
    const prepared = [
      prepareFinancialMigration(row(["castle"])),
      prepareFinancialMigration({
        ...row(["castle", "bluehouse"]),
        id: 11,
      }),
    ];

    expect(summarizeFinancialMigrations(prepared)).toMatchObject({
      bookingRows: 2,
      costItems: 4,
      taxItems: 2,
      unassignedItems: 2,
      payments: 2,
      deposits: 2,
      totalCost: 11000,
      tax: 1980,
      paid: 4000,
      warnings: 0,
      errors: 0,
    });
  });
});
