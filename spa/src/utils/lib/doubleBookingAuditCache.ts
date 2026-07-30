import { DoubleBookingAuditResponse } from "./conflictAudit";

const AUDIT_CACHE_TTL_MS = 5 * 60 * 1000;

let auditCache:
  | {
      cachedAt: number;
      data: DoubleBookingAuditResponse;
    }
  | undefined;

export function readDoubleBookingAuditCache(): DoubleBookingAuditResponse | null {
  if (!auditCache || Date.now() - auditCache.cachedAt >= AUDIT_CACHE_TTL_MS) {
    auditCache = undefined;
    return null;
  }

  return auditCache.data;
}

export function writeDoubleBookingAuditCache(
  data: DoubleBookingAuditResponse
): void {
  auditCache = {
    cachedAt: Date.now(),
    data,
  };
}

export function invalidateDoubleBookingAuditCache(): void {
  auditCache = undefined;
}
