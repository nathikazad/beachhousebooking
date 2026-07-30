import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  invalidateDoubleBookingAuditCache,
  readDoubleBookingAuditCache,
  writeDoubleBookingAuditCache,
} from "./doubleBookingAuditCache";
import { DoubleBookingAuditResponse } from "./conflictAudit";

const audit: DoubleBookingAuditResponse = {
  generatedAt: "2026-07-30T10:00:00.000Z",
  conflictPeriodCount: 0,
  conflictGroupCount: 0,
  groups: [],
};

describe("double booking audit cache", () => {
  beforeEach(() => {
    vi.useRealTimers();
    invalidateDoubleBookingAuditCache();
  });

  it("reuses a recent audit when returning from read-only booking details", () => {
    writeDoubleBookingAuditCache(audit);

    expect(readDoubleBookingAuditCache()).toBe(audit);
  });

  it("refetches after a booking mutation invalidates the cache", () => {
    writeDoubleBookingAuditCache(audit);
    invalidateDoubleBookingAuditCache();

    expect(readDoubleBookingAuditCache()).toBeNull();
  });

  it("expires an audit after five minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T10:00:00.000Z"));
    writeDoubleBookingAuditCache(audit);
    vi.setSystemTime(new Date("2026-07-30T10:05:00.000Z"));

    expect(readDoubleBookingAuditCache()).toBeNull();
  });
});
