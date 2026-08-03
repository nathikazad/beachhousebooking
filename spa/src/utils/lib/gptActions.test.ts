import { describe, expect, it, vi } from "vitest";
import { QueryExecutor } from "./helper";
import {
  getGptBusinessMetrics,
  getGptEventSchedule,
  GptActionInputError,
  searchGptBookings,
} from "./gptActions";

function executorReturning(rows: Record<string, unknown>[]) {
  return {
    query: vi.fn(async () => ({ rows })),
  } as unknown as QueryExecutor;
}

describe("GPT action services", () => {
  it("calculates monthly metrics through the shared query executor", async () => {
    const executor = executorReturning([
      {
        inquiries: "4",
        confirmed_bookings: "2",
        confirmed_subtotal: "100000",
        confirmed_tax: "18000",
        confirmed_gross: "118000",
        confirmed_outstanding: "38000",
        cash_collected: "80000",
        confirmed_check_in_value: "59000",
      },
    ]);

    await expect(
      getGptBusinessMetrics({ month: 8, year: 2026, employee: "thejas" }, executor)
    ).resolves.toMatchObject({
      employee: "Thejas",
      inquiries: 4,
      confirmedBookings: 2,
      conversionRatePercent: 50,
      confirmedGrossValue: 118000,
      cashCollected: 80000,
      currency: "INR",
    });
  });

  it("uses parameters for booking filters", async () => {
    const executor = executorReturning([]);
    await searchGptBookings(
      { client: "O'Brien", employee: "Indhu", limit: 5 },
      executor
    );
    expect(executor.query).toHaveBeenCalledOnce();
    expect(executor.query).toHaveBeenCalledWith(
      expect.stringContaining("ILIKE '%' || $1::text || '%'"),
      ["O'Brien", "Indhu", 5]
    );
  });

  it("rejects invalid dates instead of rolling them into another month", async () => {
    await expect(
      getGptEventSchedule({ date: "2026-02-31" }, executorReturning([]))
    ).rejects.toBeInstanceOf(GptActionInputError);
  });

  it("rejects unsupported runtime filters", async () => {
    await expect(
      searchGptBookings(
        { bookingType: "Wedding" as "Event" },
        executorReturning([])
      )
    ).rejects.toThrow("bookingType must be Stay or Event");
  });
});
