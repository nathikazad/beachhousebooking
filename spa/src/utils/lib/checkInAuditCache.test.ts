import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CheckInAuditResponse,
  invalidateCheckInAuditCache,
  loadCheckInAuditCached,
  readCheckInAuditCache,
} from "./checkInAuditCache";

const audit: CheckInAuditResponse = {
  generatedAt: "2026-07-30T10:00:00.000Z",
  rows: [],
};

describe("check-in audit cache", () => {
  beforeEach(() => {
    invalidateCheckInAuditCache();
  });

  it("reuses the audit when returning from an unchanged booking", async () => {
    const loader = vi.fn(async () => audit);

    await loadCheckInAuditCached(loader);
    await loadCheckInAuditCached(loader);

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("deduplicates simultaneous audit requests", async () => {
    let resolveLoader:
      | ((response: CheckInAuditResponse) => void)
      | undefined;
    const loader = vi.fn(
      () =>
        new Promise<CheckInAuditResponse>((resolve) => {
          resolveLoader = resolve;
        })
    );

    const first = loadCheckInAuditCached(loader);
    const second = loadCheckInAuditCached(loader);
    resolveLoader?.(audit);

    await expect(first).resolves.toEqual(audit);
    await expect(second).resolves.toEqual(audit);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("reloads only after booking mutation invalidation", async () => {
    const loader = vi.fn(async () => audit);

    await loadCheckInAuditCached(loader);
    invalidateCheckInAuditCache();
    await loadCheckInAuditCached(loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("allows Refresh to replace the cache explicitly", async () => {
    const refreshed = {
      ...audit,
      generatedAt: "2026-07-30T11:00:00.000Z",
    };
    const loader = vi
      .fn<() => Promise<CheckInAuditResponse>>()
      .mockResolvedValueOnce(audit)
      .mockResolvedValueOnce(refreshed);

    await loadCheckInAuditCached(loader);
    await loadCheckInAuditCached(loader, true);

    expect(loader).toHaveBeenCalledTimes(2);
    expect(readCheckInAuditCache()?.generatedAt).toBe(
      refreshed.generatedAt
    );
  });

  it("returns clones so consumers cannot mutate the cached audit", async () => {
    const loaded = await loadCheckInAuditCached(async () => audit);
    loaded.generatedAt = "changed";

    expect(readCheckInAuditCache()?.generatedAt).toBe(audit.generatedAt);
  });
});
