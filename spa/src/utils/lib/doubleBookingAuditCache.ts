import { DoubleBookingAuditResponse } from "./conflictAudit";
import { readOfflineDocument, writeOfflineDocument } from "./offlineBookingStore";

const OFFLINE_KEY = "audit:double-bookings";

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
  void writeOfflineDocument(OFFLINE_KEY, data).catch(() => undefined);
}

export async function readPersistentDoubleBookingAuditCache(): Promise<DoubleBookingAuditResponse | null> {
  const stored = await readOfflineDocument<DoubleBookingAuditResponse>(OFFLINE_KEY).catch(
    () => null
  );
  if (stored) {
    auditCache = { cachedAt: Date.now(), data: stored };
  }
  return stored;
}

export function invalidateDoubleBookingAuditCache(): void {
  auditCache = undefined;
}
