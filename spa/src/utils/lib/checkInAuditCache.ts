import { CheckInAuditRow } from "./checkInAudit";
import { readOfflineDocument, writeOfflineDocument } from "./offlineBookingStore";

const OFFLINE_KEY = "audit:check-in";

export interface CheckInAuditResponse {
  generatedAt: string;
  rows: CheckInAuditRow[];
}

type CheckInAuditLoader = () => Promise<CheckInAuditResponse>;

let auditCache: CheckInAuditResponse | undefined;
let auditRequest: Promise<CheckInAuditResponse> | undefined;
let cacheGeneration = 0;

function cloneAudit(audit: CheckInAuditResponse): CheckInAuditResponse {
  return structuredClone(audit);
}

export function readCheckInAuditCache(): CheckInAuditResponse | null {
  return auditCache ? cloneAudit(auditCache) : null;
}

export async function readPersistentCheckInAuditCache(): Promise<CheckInAuditResponse | null> {
  const stored = await readOfflineDocument<CheckInAuditResponse>(OFFLINE_KEY).catch(
    () => null
  );
  if (stored) auditCache = cloneAudit(stored);
  return stored;
}

export function invalidateCheckInAuditCache(): void {
  cacheGeneration += 1;
  auditCache = undefined;
  auditRequest = undefined;
}

export async function loadCheckInAuditCached(
  loader: CheckInAuditLoader,
  force = false
): Promise<CheckInAuditResponse> {
  if (!force && auditCache) {
    return cloneAudit(auditCache);
  }
  if (!force && auditRequest) {
    return auditRequest.then(cloneAudit);
  }

  const requestGeneration = cacheGeneration;
  const request = loader()
    .then((audit) => {
      if (requestGeneration === cacheGeneration) {
        auditCache = cloneAudit(audit);
        void writeOfflineDocument(OFFLINE_KEY, audit).catch(() => undefined);
      }
      return audit;
    })
    .finally(() => {
      if (auditRequest === request) {
        auditRequest = undefined;
      }
    });

  auditRequest = request;
  return request.then(cloneAudit);
}
