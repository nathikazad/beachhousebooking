import { describe, expect, it, vi } from "vitest";
import {
  assignBluehouseGlasshouseCosts,
  assignSinglePropertyEventCosts,
  auditBluehouseGlasshouseCosts,
  auditSinglePropertyEventCosts,
  repairBluehouseGlasshouseCosts,
  repairSinglePropertyEventCosts,
} from "./eventCostPropertyBackfill";
import { QueryExecutor } from "./helper";

function executorWith(
  ...results: Array<{
    rows: Array<Record<string, string | number>>;
  }>
): QueryExecutor {
  return {
    query: vi.fn().mockImplementation(() => {
      const result = results.shift();
      if (!result) throw new Error("Unexpected query");
      return Promise.resolve(result);
    }),
  };
}

const candidate = {
  rows: "9",
  bookings: "1",
  events: "2",
  amount: "388000",
};

describe("single-property event cost repair", () => {
  it("audits only null cost rows joined to one-property events", async () => {
    const client = executorWith({ rows: [candidate] });

    await expect(auditSinglePropertyEventCosts(client)).resolves.toEqual({
      rows: 9,
      bookings: 1,
      events: 2,
      amount: 388000,
    });

    const sql = vi.mocked(client.query).mock.calls[0][0];
    expect(sql).toContain("jsonb_array_length(event.value -> 'properties') = 1");
    expect(sql).toContain("cost.property IS NULL");
    expect(sql).toContain("cost.item_type = 'cost'");
    expect(sql).toContain("markForDeletion");
  });

  it("only updates previously unassigned cost rows", async () => {
    const client = executorWith({ rows: [candidate] });

    await assignSinglePropertyEventCosts(client);

    const sql = vi.mocked(client.query).mock.calls[0][0];
    expect(sql).toContain("SET property = event.property::public.property");
    expect(sql).toContain("cost.property IS NULL");
    expect(sql).toContain("cost.item_type = 'cost'");
  });

  it("verifies the updated scope and that the repair is complete", async () => {
    const client = executorWith(
      { rows: [candidate] },
      { rows: [candidate] },
      {
        rows: [{ rows: "0", bookings: "0", events: "0", amount: "0" }],
      }
    );

    await expect(repairSinglePropertyEventCosts(client)).resolves.toEqual({
      rows: 9,
      bookings: 1,
      events: 2,
      amount: 388000,
    });
    expect(client.query).toHaveBeenCalledTimes(3);
  });

  it("rejects an update whose affected scope differs from the audit", async () => {
    const client = executorWith(
      { rows: [candidate] },
      {
        rows: [
          {
            ...candidate,
            rows: "8",
            amount: "358000",
          },
        ],
      }
    );

    await expect(repairSinglePropertyEventCosts(client)).rejects.toThrow(
      "unexpected scope"
    );
    expect(client.query).toHaveBeenCalledTimes(2);
  });
});

describe("Bluehouse and Glasshouse cost repair", () => {
  it("selects null costs for exact two-property events and bookings", async () => {
    const client = executorWith({ rows: [candidate] });

    await auditBluehouseGlasshouseCosts(client);

    const sql = vi.mocked(client.query).mock.calls[0][0];
    expect(sql).toContain(
      "event.properties = ARRAY['bluehouse', 'glasshouse']::text[]"
    );
    expect(sql).toContain("cardinality(booking.properties) = 2");
    expect(sql).toContain("cost.event_id IS NULL");
    expect(sql).toContain("cost.property IS NULL");
    expect(sql).toContain("cost.item_type = 'cost'");
  });

  it("assigns candidates to Bluehouse without overwriting assigned rows", async () => {
    const client = executorWith({ rows: [candidate] });

    await assignBluehouseGlasshouseCosts(client);

    const sql = vi.mocked(client.query).mock.calls[0][0];
    expect(sql).toContain(
      "SET property = 'bluehouse'::public.property"
    );
    expect(sql).toContain("cost.property IS NULL");
    expect(sql).toContain("cost.item_type = 'cost'");
  });

  it("verifies the complete affected scope", async () => {
    const client = executorWith(
      { rows: [candidate] },
      { rows: [candidate] },
      {
        rows: [{ rows: "0", bookings: "0", events: "0", amount: "0" }],
      }
    );

    await expect(repairBluehouseGlasshouseCosts(client)).resolves.toEqual({
      rows: 9,
      bookings: 1,
      events: 2,
      amount: 388000,
    });
    expect(client.query).toHaveBeenCalledTimes(3);
  });
});
