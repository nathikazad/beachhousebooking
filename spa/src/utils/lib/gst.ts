import { BookingForm, Cost } from "./bookingType";

export const DEFAULT_GST_REFERENCE_PERCENTAGE = 18;
export const MAX_GST_REFERENCE_PERCENTAGE = 18;

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateGstReferenceAmount(
  totalCost: number,
  percentage: number
): number {
  if (!Number.isFinite(totalCost) || !Number.isFinite(percentage)) {
    return 0;
  }

  const boundedPercentage = Math.min(
    MAX_GST_REFERENCE_PERCENTAGE,
    Math.max(0, percentage)
  );
  return roundMoney((Math.max(0, totalCost) * boundedPercentage) / 100);
}

export function setSingleBookingTaxAmount(
  costs: Cost[],
  amount: number
): Cost[] {
  const existingTax = costs.find((cost) => cost.itemType === "tax");
  const safeAmount =
    Number.isFinite(amount) && amount >= 0 ? roundMoney(amount) : 0;

  return [
    ...costs.filter((cost) => cost.itemType !== "tax"),
    {
      ...(existingTax?.costId === undefined
        ? {}
        : { costId: existingTax.costId }),
      name: "GST",
      amount: safeAmount,
      itemType: "tax",
    },
  ];
}

export function normalizeBookingTax<T extends BookingForm>(booking: T): T {
  const taxFromItems = (booking.costs ?? [])
    .filter((cost) => cost.itemType === "tax")
    .reduce((sum, cost) => sum + cost.amount, 0);
  const tax =
    Number.isFinite(booking.tax) && (booking.tax ?? 0) >= 0
      ? roundMoney(booking.tax ?? 0)
      : roundMoney(Math.max(0, taxFromItems));

  return {
    ...booking,
    costs: setSingleBookingTaxAmount(booking.costs ?? [], tax),
    events: booking.events.map((event) => ({
      ...event,
      costs: event.costs.filter((cost) => cost.itemType !== "tax"),
    })),
    tax,
    afterTaxTotal: booking.totalCost + tax,
    outstanding: booking.totalCost + tax - booking.paid,
  };
}
