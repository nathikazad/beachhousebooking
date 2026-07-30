import { describe, expect, it } from "vitest";
import { Property } from "./bookingType";
import {
  availableCheckInAuditYears,
  buildCheckInAuditRow,
  getCurrentCheckInAuditPeriod,
  rowsForCheckInAuditTab,
  rowsForCheckInAuditPeriod,
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

describe("check-in audit rows", () => {
  it("normalizes database values and custom enum arrays", () => {
    const row = buildCheckInAuditRow({
      booking_id: "42",
      check_in: "2026-08-01T10:00:00.000Z",
      client_name: "Audit guest",
      properties: "{bluehouse,glasshouse}",
      tax: "180",
      total: "1180",
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

  it("filters check-ins by month and year in India time", () => {
    const rows = [
      {
        bookingId: 1,
        checkInDate: "2026-07-31T20:00:00.000Z",
        clientName: "August in India",
        properties: [Property.Castle],
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
