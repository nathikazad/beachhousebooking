import { describe, expect, it } from "vitest";
import { Property } from "./bookingType";
import {
  availableCheckInAuditYears,
  buildCheckInAuditRow,
  getCurrentCheckInAuditPeriod,
  rowsForCheckInAuditTab,
  rowsForCheckInAuditPeriod,
  summarizeCheckInAuditRows,
  summarizeCheckInPayments,
} from "./checkInAudit";

describe("summarizeCheckInPayments", () => {
  it("uses the earliest payment as advance and combines all later payments", () => {
    const summary = summarizeCheckInPayments([
      {
        id: 3,
        amount: 2000,
        paymentDate: "2026-07-20T10:00:00.000Z",
      },
      {
        id: 1,
        amount: 5000,
        paymentDate: "2026-06-01T10:00:00.000Z",
      },
      {
        id: 2,
        amount: 3000,
        paymentDate: "2026-07-10T10:00:00.000Z",
      },
    ]);

    expect(summary).toEqual({
      advanceAmount: 5000,
      advanceReceivedDate: "2026-06-01T10:00:00.000Z",
      remainingPaymentAmount: 5000,
      remainingPaymentReceivedDate: "2026-07-20T10:00:00.000Z",
    });
  });

  it("uses payment id to make equal-date ordering deterministic", () => {
    const summary = summarizeCheckInPayments([
      {
        id: 2,
        amount: 2000,
        paymentDate: "2026-06-01T10:00:00.000Z",
      },
      {
        id: 1,
        amount: 1000,
        paymentDate: "2026-06-01T10:00:00.000Z",
      },
    ]);

    expect(summary.advanceAmount).toBe(1000);
    expect(summary.remainingPaymentAmount).toBe(2000);
  });

  it("returns zero amounts and blank dates when no payment exists", () => {
    expect(summarizeCheckInPayments([])).toEqual({
      advanceAmount: 0,
      advanceReceivedDate: null,
      remainingPaymentAmount: 0,
      remainingPaymentReceivedDate: null,
    });
  });
});

describe("summarizeCheckInAuditRows", () => {
  it("sums the displayed tax and total amounts", () => {
    expect(
      summarizeCheckInAuditRows([
        { tax: 180, total: 1180 },
        { tax: 72.5, total: 572.5 },
      ])
    ).toEqual({ tax: 252.5, total: 1752.5 });
  });

  it("returns zero totals when there are no rows", () => {
    expect(summarizeCheckInAuditRows([])).toEqual({
      tax: 0,
      total: 0,
    });
  });
});

describe("check-in audit rows", () => {
  it("normalizes database values and custom enum arrays", () => {
    const row = buildCheckInAuditRow({
      booking_id: "42",
      check_in: "2026-08-01T10:00:00.000Z",
      client_name: "Audit guest",
      properties: "{bluehouse,glasshouse}",
      booking_type: "Event",
      tax: "180",
      total: "1180",
      cost_items: [
        { property: "bluehouse", amount: "600" },
        { property: "glasshouse", amount: "400" },
      ],
      payments: [
        {
          id: "9",
          amount: "500",
          paymentDate: "2026-07-01T10:00:00.000Z",
        },
      ],
    });

    expect(row).toMatchObject({
      bookingId: 42,
      properties: [Property.Bluehouse, Property.Glasshouse],
      bookingType: "Event",
      multiple: true,
      totalCost: 1000,
      advanceAmount: 500,
      tax: 180,
      total: 1180,
    });
  });

  it("places multi-property bookings in each relevant tab only once", () => {
    const rows = [
      {
        bookingId: 42,
        checkInDate: "2026-08-01T10:00:00.000Z",
        clientName: "Audit guest",
        properties: [
          Property.Bluehouse,
          Property.Glasshouse,
          Property.Castle,
        ],
        bookingType: "Event" as const,
        multiple: true,
        propertyCosts: {
          [Property.Bluehouse]: 300,
          [Property.Glasshouse]: 200,
          [Property.Castle]: 500,
        },
        unallocatedCost: 0,
        totalCost: 1000,
        advanceAmount: 0,
        advanceReceivedDate: null,
        remainingPaymentAmount: 0,
        remainingPaymentReceivedDate: null,
        tax: 0,
        total: 1000,
      },
    ];

    expect(rowsForCheckInAuditTab(rows, "blue-glass")).toHaveLength(1);
    expect(rowsForCheckInAuditTab(rows, "castle")).toHaveLength(1);
    expect(rowsForCheckInAuditTab(rows, "meadow-lane")).toHaveLength(0);
  });

  it("allocates booking-level amounts by attributed property costs", () => {
    const row = buildCheckInAuditRow({
      booking_id: 42,
      check_in: "2026-08-01T10:00:00.000Z",
      client_name: "Split guest",
      properties: "{bluehouse,castle}",
      booking_type: "Stay",
      tax: 180,
      total: 1180,
      cost_items: [
        { property: "bluehouse", amount: 250 },
        { property: "castle", amount: 750 },
      ],
      payments: [
        {
          id: 1,
          amount: 400,
          paymentDate: "2026-06-01T10:00:00.000Z",
        },
        {
          id: 2,
          amount: 200,
          paymentDate: "2026-07-01T10:00:00.000Z",
        },
      ],
    });

    expect(rowsForCheckInAuditTab([row], "blue-glass")[0]).toMatchObject({
      advanceAmount: 100,
      remainingPaymentAmount: 50,
      tax: 45,
      total: 295,
    });
    expect(rowsForCheckInAuditTab([row], "castle")[0]).toMatchObject({
      advanceAmount: 300,
      remainingPaymentAmount: 150,
      tax: 135,
      total: 885,
    });
  });

  it("shows legacy null costs in the unallocated tab", () => {
    const row = buildCheckInAuditRow({
      booking_id: 42,
      check_in: "2026-08-01T10:00:00.000Z",
      client_name: "Legacy guest",
      properties: "{bluehouse,castle}",
      booking_type: "Event",
      tax: 100,
      total: 1100,
      cost_items: [
        { property: "bluehouse", amount: 600 },
        { property: null, amount: 400 },
      ],
      payments: [
        {
          id: 1,
          amount: 500,
          paymentDate: "2026-06-01T10:00:00.000Z",
        },
      ],
    });

    expect(rowsForCheckInAuditTab([row], "unallocated")[0]).toMatchObject({
      advanceAmount: 200,
      tax: 40,
      total: 440,
    });
    expect(rowsForCheckInAuditTab([row], "castle")[0]).toMatchObject({
      advanceAmount: 0,
      tax: 0,
      total: 0,
    });
  });

  it("filters check-ins by month and year in India time", () => {
    const rows = [
      {
        bookingId: 1,
        checkInDate: "2026-07-31T20:00:00.000Z",
        clientName: "August in India",
        properties: [Property.Castle],
        bookingType: "Stay" as const,
        multiple: false,
        propertyCosts: { [Property.Castle]: 1000 },
        unallocatedCost: 0,
        totalCost: 1000,
        advanceAmount: 0,
        advanceReceivedDate: null,
        remainingPaymentAmount: 0,
        remainingPaymentReceivedDate: null,
        tax: 0,
        total: 1000,
      },
      {
        bookingId: 2,
        checkInDate: "2026-07-31T10:00:00.000Z",
        clientName: "July in India",
        properties: [Property.Castle],
        bookingType: "Stay" as const,
        multiple: false,
        propertyCosts: { [Property.Castle]: 1000 },
        unallocatedCost: 0,
        totalCost: 1000,
        advanceAmount: 0,
        advanceReceivedDate: null,
        remainingPaymentAmount: 0,
        remainingPaymentReceivedDate: null,
        tax: 0,
        total: 1000,
      },
    ];

    expect(
      rowsForCheckInAuditPeriod(rows, { month: 8, year: 2026 }).map(
        (row) => row.bookingId
      )
    ).toEqual([1]);
  });

  it("orders the selected month by earliest check-in first", () => {
    const rows = [
      {
        bookingId: 3,
        checkInDate: "2026-08-20T10:00:00.000Z",
        clientName: "Later",
        properties: [Property.Castle],
        bookingType: "Stay" as const,
        multiple: false,
        propertyCosts: { [Property.Castle]: 1000 },
        unallocatedCost: 0,
        totalCost: 1000,
        advanceAmount: 0,
        advanceReceivedDate: null,
        remainingPaymentAmount: 0,
        remainingPaymentReceivedDate: null,
        tax: 0,
        total: 1000,
      },
      {
        bookingId: 2,
        checkInDate: "2026-08-01T10:00:00.000Z",
        clientName: "Earlier",
        properties: [Property.Castle],
        bookingType: "Stay" as const,
        multiple: false,
        propertyCosts: { [Property.Castle]: 1000 },
        unallocatedCost: 0,
        totalCost: 1000,
        advanceAmount: 0,
        advanceReceivedDate: null,
        remainingPaymentAmount: 0,
        remainingPaymentReceivedDate: null,
        tax: 0,
        total: 1000,
      },
    ];

    expect(
      rowsForCheckInAuditPeriod(rows, { month: 8, year: 2026 }).map(
        (row) => row.bookingId
      )
    ).toEqual([2, 3]);
  });

  it("defaults to the current month and year in India time", () => {
    expect(
      getCurrentCheckInAuditPeriod(
        new Date("2026-12-31T20:00:00.000Z")
      )
    ).toEqual({ month: 1, year: 2027 });
  });

  it("builds descending year options from the available bookings", () => {
    const rows = [
      {
        bookingId: 1,
        checkInDate: "2024-01-01T10:00:00.000Z",
        clientName: "Older",
        properties: [Property.Castle],
        bookingType: "Stay" as const,
        multiple: false,
        propertyCosts: { [Property.Castle]: 1000 },
        unallocatedCost: 0,
        totalCost: 1000,
        advanceAmount: 0,
        advanceReceivedDate: null,
        remainingPaymentAmount: 0,
        remainingPaymentReceivedDate: null,
        tax: 0,
        total: 1000,
      },
      {
        bookingId: 2,
        checkInDate: "2027-01-01T10:00:00.000Z",
        clientName: "Future",
        properties: [Property.Castle],
        bookingType: "Stay" as const,
        multiple: false,
        propertyCosts: { [Property.Castle]: 1000 },
        unallocatedCost: 0,
        totalCost: 1000,
        advanceAmount: 0,
        advanceReceivedDate: null,
        remainingPaymentAmount: 0,
        remainingPaymentReceivedDate: null,
        tax: 0,
        total: 1000,
      },
    ];

    expect(availableCheckInAuditYears(rows, 2026)).toEqual([
      2027, 2026, 2024,
    ]);
  });
});
