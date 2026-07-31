import { BookingDB } from "./bookingType";

type BookingHistoryLoader = () => Promise<BookingDB[]>;
export interface BookingHistorySnapshot {
  history: BookingDB[];
  historyCount: number;
}
type LatestBookingLoader = () => Promise<BookingHistorySnapshot>;

const bookingHistoryCache = new Map<number, BookingDB[]>();
const bookingHistoryRequests = new Map<number, Promise<BookingDB[]>>();
const latestBookingCache = new Map<number, BookingHistorySnapshot>();
const latestBookingRequests = new Map<
  number,
  Promise<BookingHistorySnapshot>
>();

function cloneHistory(history: BookingDB[]): BookingDB[] {
  return structuredClone(history);
}

function cloneSnapshot(
  snapshot: BookingHistorySnapshot
): BookingHistorySnapshot {
  return structuredClone(snapshot);
}

export function readBookingHistoryCache(
  bookingId: number
): BookingDB[] | null {
  const history = bookingHistoryCache.get(bookingId);
  return history ? cloneHistory(history) : null;
}

export function writeBookingHistoryCache(
  bookingId: number,
  history: BookingDB[]
): void {
  bookingHistoryCache.set(bookingId, cloneHistory(history));
  const latest = history[history.length - 1];
  if (latest) {
    latestBookingCache.set(bookingId, {
      history: [structuredClone(latest)],
      historyCount: history.length,
    });
  }
}

export function invalidateBookingHistoryCache(bookingId: number): void {
  bookingHistoryCache.delete(bookingId);
  bookingHistoryRequests.delete(bookingId);
  latestBookingCache.delete(bookingId);
  latestBookingRequests.delete(bookingId);
}

export async function loadLatestBookingCached(
  bookingId: number,
  loader: LatestBookingLoader
): Promise<BookingHistorySnapshot> {
  const fullHistory = readBookingHistoryCache(bookingId);
  if (fullHistory) {
    return {
      history: [fullHistory[fullHistory.length - 1]],
      historyCount: fullHistory.length,
    };
  }

  const cached = latestBookingCache.get(bookingId);
  if (cached) return cloneSnapshot(cached);

  const existingRequest = latestBookingRequests.get(bookingId);
  if (existingRequest) {
    return existingRequest.then(cloneSnapshot);
  }

  const request = loader()
    .then((snapshot) => {
      latestBookingCache.set(bookingId, cloneSnapshot(snapshot));
      return latestBookingCache.get(bookingId)!;
    })
    .finally(() => {
      latestBookingRequests.delete(bookingId);
    });

  latestBookingRequests.set(bookingId, request);
  return request.then(cloneSnapshot);
}

export async function loadBookingHistoryCached(
  bookingId: number,
  loader: BookingHistoryLoader
): Promise<BookingDB[]> {
  const cached = readBookingHistoryCache(bookingId);
  if (cached) return cached;

  const existingRequest = bookingHistoryRequests.get(bookingId);
  if (existingRequest) {
    return existingRequest.then(cloneHistory);
  }

  const request = loader()
    .then((history) => {
      writeBookingHistoryCache(bookingId, history);
      return bookingHistoryCache.get(bookingId)!;
    })
    .finally(() => {
      bookingHistoryRequests.delete(bookingId);
    });

  bookingHistoryRequests.set(bookingId, request);
  return request.then(cloneHistory);
}

export function clearBookingHistoryCache(): void {
  bookingHistoryCache.clear();
  bookingHistoryRequests.clear();
  latestBookingCache.clear();
  latestBookingRequests.clear();
}
