import { describe, expect, it, vi } from "vitest";
import { Property } from "./bookingType";
import {
  replaceFinancialRecordBatch,
  replaceFinancialRecords,
} from "./financialPersistence";

function executor() {
  const query = vi.fn(
    async (_text: string, _params?: unknown[]) => ({ rows: [] })
  );
  return { query };
}

const financials = {
  costItems: [
    {
      property: Property.Castle,
      itemType: "cost" as const,
      name: "Rent",
      amount: 1000,
    },
    {
      property: undefined,
      itemType: "tax" as const,
      name: "Tax",
      amount: 180,
    },
  ],
  payments: [
    {
      amount: 500,
      paymentMethod: "Bank transfert" as const,
      paymentDate: "2026-07-01T10:00:00.000Z",
      details: { bankAccount: "HDFC Current" },
    },
  ],
  securityDeposit: {
    amount: 1000,
    paymentMethod: "Cash" as const,
    amountReturned: 0,
  },
};

describe("replaceFinancialRecords", () => {
  it("deletes the previous financial set before inserting its replacement", async () => {
    const database = executor();

    await replaceFinancialRecords(database, 42, financials);

    expect(database.query).toHaveBeenNthCalledWith(
      1,
      "DELETE FROM public.booking_cost_items WHERE booking_id = $1",
      [42]
    );
    expect(database.query).toHaveBeenNthCalledWith(
      2,
      "DELETE FROM public.booking_payments WHERE booking_id = $1",
      [42]
    );
    expect(database.query).toHaveBeenNthCalledWith(
      3,
      "DELETE FROM public.booking_security_deposits WHERE booking_id = $1",
      [42]
    );
  });

  it("preserves legacy null properties and flexible payment details", async () => {
    const database = executor();

    await replaceFinancialRecords(database, 42, financials);

    const costPayload = JSON.parse(
      database.query.mock.calls[3][1]?.[1] as string
    );
    const paymentPayload = JSON.parse(
      database.query.mock.calls[4][1]?.[1] as string
    );

    expect(costPayload).toEqual([
      expect.objectContaining({ property: "castle", item_type: "cost" }),
      expect.objectContaining({ property: null, item_type: "tax" }),
    ]);
    expect(paymentPayload[0].details).toEqual({
      bankAccount: "HDFC Current",
    });
  });

  it("is idempotent because every run replaces the booking's complete set", async () => {
    const database = executor();

    await replaceFinancialRecords(database, 42, financials);
    await replaceFinancialRecords(database, 42, financials);

    expect(database.query).toHaveBeenCalledTimes(12);
    expect(database.query.mock.calls.slice(0, 6)).toEqual(
      database.query.mock.calls.slice(6, 12)
    );
  });
});

describe("replaceFinancialRecordBatch", () => {
  it("replaces a complete batch with bulk statements", async () => {
    const database = executor();

    await replaceFinancialRecordBatch(database, [
      { bookingId: 42, financials },
      {
        bookingId: 43,
        financials: {
          costItems: [
            {
              property: Property.Bluehouse,
              itemType: "cost",
              name: "Cleaning",
              amount: 250,
            },
          ],
          payments: [],
          securityDeposit: null,
        },
      },
    ]);

    expect(database.query).toHaveBeenNthCalledWith(
      1,
      "DELETE FROM public.booking_cost_items WHERE booking_id = ANY($1::bigint[])",
      [[42, 43]]
    );
    const costPayload = JSON.parse(
      database.query.mock.calls[3][1]?.[0] as string
    );
    expect(costPayload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          booking_id: 42,
          property: "castle",
        }),
        expect.objectContaining({
          booking_id: 43,
          property: "bluehouse",
        }),
      ])
    );
    expect(database.query).toHaveBeenCalledTimes(6);
  });

  it("does nothing for an empty batch", async () => {
    const database = executor();

    await replaceFinancialRecordBatch(database, []);

    expect(database.query).not.toHaveBeenCalled();
  });
});
