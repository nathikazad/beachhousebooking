import { BookingDB, BookingForm } from "./lib/bookingType";
import {
  BookingCacheSource,
  BookingHistorySnapshot,
  invalidateBookingHistoryCache,
  loadLatestBookingCached,
  loadBookingHistoryCached,
} from "./lib/bookingHistoryCache";
import { BookingReadRow, bookingReadResult } from "./lib/bookingRead";
import { invalidateCheckInAuditCache } from "./lib/checkInAuditCache";
import { invalidateDoubleBookingAuditCache } from "./lib/doubleBookingAuditCache";
import { invalidateBookingListCache } from "./lib/bookingListCache";
import { markCalendarViewCacheStale } from "./lib/calendarViewCache";
import { supabase } from "./supabase/client";

export const monthConvertFromNumber: Record<number, string> = {
  1: "january",
  2: "february",
  3: "march",
  4: "april",
  5: "may",
  6: "june",
  7: "july",
  8: "august",
  9: "september",
  10: "october",
  11: "november",
  12: "december"
};
export const createBooking = async (bookingForm: BookingForm) => {
  console.log('Creating booking: ', bookingForm)
  let sesh = await supabase.auth.getSession()
  let token = sesh.data.session?.access_token;
  let bookingId: string | null = null;
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const body = JSON.stringify(bookingForm);
    const response = await fetch(`${apiUrl}/api/booking`, {
      method: "POST",
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: body
    });
    const data = await response.json();
    bookingId = data.bookingId;
    console.log('Response from POST function:', data);
    if (data.error) {
      return Promise.reject({ msg: data.message, error: true })
    }
    if (bookingId) {
      invalidateBookingHistoryCache(Number(bookingId));
    }
    invalidateCheckInAuditCache();
    invalidateDoubleBookingAuditCache();
    invalidateBookingListCache();
    markCalendarViewCacheStale();
    return bookingId;

  } catch (error) {
    console.error('Error calling POST function:', error);

  }
  return bookingId;
}

export async function getBookingHistory(
  identifier: { bookingId: number } | { clientViewId: string }
): Promise<BookingDB[]> {
  if ("bookingId" in identifier) {
    return loadBookingHistoryCached(identifier.bookingId, () =>
      fetchDirectBookingRead(
        "booking_history_details",
        identifier.bookingId
      ).then((snapshot) => snapshot.history)
    );
  }

  return fetchBookingHistory(identifier, true).then(
    (snapshot) => snapshot.history
  );
}

export async function getLatestBookingHistory(
  identifier: { bookingId: number } | { clientViewId: string }
): Promise<BookingHistorySnapshot> {
  if ("bookingId" in identifier) {
    const startedAt = performance.now();
    let cacheSource: BookingCacheSource = "network";
    let supabaseMs = 0;
    let hydrateMs = 0;
    let payloadBytes = 0;

    try {
      const snapshot = await loadLatestBookingCached(
        identifier.bookingId,
        async () => {
          const result = await fetchDirectBookingRead(
            "booking_current_details",
            identifier.bookingId
          );
          supabaseMs = result.queryMs;
          payloadBytes = result.payloadBytes;
          hydrateMs = result.hydrateMs;
          return {
            history: result.history,
            historyCount: result.historyCount,
          };
        },
        (source) => {
          cacheSource = source;
        }
      );

      scheduleBookingReadPerformanceLog({
        bookingId: identifier.bookingId,
        cacheSource,
        totalMs: performance.now() - startedAt,
        supabaseMs,
        hydrateMs,
        payloadBytes,
        success: true,
      });
      return snapshot;
    } catch (error) {
      scheduleBookingReadPerformanceLog({
        bookingId: identifier.bookingId,
        cacheSource,
        totalMs: performance.now() - startedAt,
        supabaseMs,
        hydrateMs,
        payloadBytes,
        success: false,
        errorCode:
          typeof error === "object" && error && "code" in error
            ? String(error.code)
            : undefined,
      });
      throw error;
    }
  }

  return fetchBookingHistory(identifier, false);
}

type BookingReadView =
  | "booking_current_details"
  | "booking_history_details";

async function fetchDirectBookingRead(
  view: BookingReadView,
  bookingId: number
): Promise<
  BookingHistorySnapshot & {
    queryMs: number;
    payloadBytes: number;
    hydrateMs: number;
  }
> {
  const queryStartedAt = performance.now();
  const { data, error } = await supabase
    .from(view)
    .select("id,history,history_count,cost_items,payments,security_deposit")
    .eq("id", bookingId)
    .maybeSingle();
  const queryMs = performance.now() - queryStartedAt;

  if (error) throw error;
  if (!data) throw new Error("Booking not found");

  const payloadBytes = new TextEncoder().encode(JSON.stringify(data)).byteLength;
  const hydrateStartedAt = performance.now();
  const snapshot = bookingReadResult(data as unknown as BookingReadRow);

  return {
    ...snapshot,
    queryMs,
    payloadBytes,
    hydrateMs: performance.now() - hydrateStartedAt,
  };
}

export interface BookingReadPerformance {
  bookingId: number;
  cacheSource: BookingCacheSource;
  totalMs: number;
  supabaseMs: number;
  hydrateMs: number;
  payloadBytes: number;
  success: boolean;
  errorCode?: string;
}

export function bookingReadPerformancePath(
  metric: BookingReadPerformance,
  browserSessionId: string,
): string {
  const observableMetric = [
    `b${metric.bookingId}`,
    `c${metric.cacheSource}`,
    `t${metric.totalMs.toFixed(1)}`,
    `s${metric.supabaseMs.toFixed(1)}`,
    `h${metric.hydrateMs.toFixed(1)}`,
    `p${Math.round(metric.payloadBytes)}`,
    metric.success ? "ok" : "error",
    `x${browserSessionId.slice(0, 8)}`,
  ].join("-");
  return `/api/client-performance/${observableMetric}`;
}

const recentBookingReadMetrics = new Map<string, number>();

function scheduleBookingReadPerformanceLog(
  metric: BookingReadPerformance
): void {
  if (process.env.NODE_ENV === "test" || typeof window === "undefined") {
    return;
  }
  if (metric.cacheSource === "inflight") return;

  const metricKey = `${metric.bookingId}:${metric.cacheSource}:${metric.success}`;
  const now = performance.now();
  const previous = recentBookingReadMetrics.get(metricKey);
  if (previous !== undefined && now - previous < 250) return;
  recentBookingReadMetrics.set(metricKey, now);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      void logBookingReadPerformance(metric);
    });
  });
}

async function logBookingReadPerformance(
  metric: BookingReadPerformance
): Promise<void> {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;

    const browserSessionId = getBrowserSessionId();
    await fetch(bookingReadPerformancePath(metric, browserSessionId), {
      method: "POST",
      keepalive: true,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "booking_read_performance",
        browserSessionId,
        ...metric,
      }),
    });
  } catch (error) {
    console.warn("Unable to record booking read performance", error);
  }
}

function getBrowserSessionId(): string {
  const key = "booking-performance-session-id";
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

async function fetchBookingHistory(
  identifier: { bookingId: number } | { clientViewId: string },
  includeHistory: boolean
): Promise<BookingHistorySnapshot> {
  const query = new URLSearchParams(
    "bookingId" in identifier
      ? { bookingId: String(identifier.bookingId) }
      : { clientViewId: identifier.clientViewId }
  );
  if (includeHistory) {
    query.set("includeHistory", "true");
  }
  const headers: HeadersInit = {};

  if ("bookingId" in identifier) {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      throw new Error("Please sign in again to view this booking.");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api/booking?${query.toString()}`, {
    cache: "no-store",
    headers,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to load booking.");
  }

  return {
    history: data.history,
    historyCount: Number(data.historyCount ?? data.history.length),
  };
}

export const deleteBooking = async (bookingId: number) => {
  console.log('Deleting booking id: ', bookingId)
  let sesh = await supabase.auth.getSession()
  let token = sesh.data.session?.access_token;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/booking`, {
      method: "DELETE",
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ bookingId })
    });
    if (response.ok) {
      invalidateBookingHistoryCache(bookingId);
      invalidateCheckInAuditCache();
      invalidateDoubleBookingAuditCache();
      invalidateBookingListCache();
      markCalendarViewCacheStale();
    }
    console.log('Deleted id: ', bookingId);

  } catch (error) {
    console.error('Error calling GET function:', error);
  }
}
export const getDateAvailability = async (properties: string, month: number,year:number,bookingId?:number) => {
  let sesh = await supabase.auth.getSession()
  let token = sesh.data.session?.access_token;
  
  console.log('Fetching dates for propreties: ', properties,' month: ',month,' year : ',year);

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'; 
    const response = await fetch(`${apiUrl}/api/calendar?properties=${properties}&month=${monthConvertFromNumber[month]}&year=${year}${bookingId?'&bookingId='+bookingId:''}`, {
      method: "GET",
      headers: {
        'Authorization': `Bearer ${token}`
      },

    });
    const data = await response.json();
   return data

  } catch (error) {
    console.error('Error calling GET function:', error);
  }
}
