import { describe, expect, it } from "vitest";
import { BookingForm, Property, defaultForm } from "./bookingType";
import {
  calculateGstPercentage,
  normalizeBookingTax,
  setSingleBookingTaxAmount,
} from "./gst";

describe("GST helpers", () => {
  it("calculates the GST percentage from the entered amount", () => {
    expect(calculateGstPercentage(10_000, 900)).toBe(9);
    expect(calculateGstPercentage(3_000, 1_000)).toBe(33.33);
    expect(calculateGstPercentage(0, 900)).toBe(0);
    expect(calculateGstPercentage(10_000, -1)).toBe(0);
  });

  it("keeps exactly one booking-level tax item", () => {
    const costs = setSingleBookingTaxAmount(
      [
        {
          name: "Rent",
          amount: 50_000,
          itemType: "cost",
          property: Property.Bluehouse,
        },
        {
          costId: 11,
          name: "GST 18%",
          amount: 9_000,
          itemType: "tax",
          property: Property.Bluehouse,
        },
        {
          costId: 12,
          name: "Duplicate tax",
          amount: 100,
          itemType: "tax",
          property: Property.Glasshouse,
        },
      ],
      7_500
    );

    expect(costs.filter((cost) => cost.itemType === "tax")).toEqual([
      {
        costId: 11,
        name: "GST",
        amount: 7_500,
        itemType: "tax",
      },
    ]);
    expect(costs[0]).toMatchObject({ name: "Rent", amount: 50_000 });
  });

  it("always creates a zero-value tax item and updates totals", () => {
    const source: BookingForm = {
      ...defaultForm(),
      totalCost: 5_000,
      paid: 1_000,
      tax: 0,
      costs: [
        {
          name: "Rent",
          amount: 5_000,
          itemType: "cost",
          property: Property.Castle,
        },
      ],
      events: [
        {
          eventId: 1,
          eventName: "Test event",
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
          finalCost: 0,
          costs: [
            {
              name: "Legacy event tax",
              amount: 10,
              itemType: "tax",
            },
          ],
        },
      ],
    };
    const normalized = normalizeBookingTax(source);

    expect(normalized.costs.filter((cost) => cost.itemType === "tax")).toEqual([
      {
        name: "GST",
        amount: 0,
        itemType: "tax",
      },
    ]);
    expect(normalized.afterTaxTotal).toBe(5_000);
    expect(normalized.outstanding).toBe(4_000);
    expect(normalized.events[0].costs).toEqual([]);
  });
});
