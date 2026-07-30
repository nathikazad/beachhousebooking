import { BookingDB } from "./bookingType";

type BookingHistoryLoader = () => Promise<BookingDB[]>;

const bookingHistoryCache = new Map<number, BookingDB[]>();
const bookingHistoryRequests = new Map<number, Promise<BookingDB[]>>();

function cloneHistory(history: BookingDB[]): BookingDB[] {
  return structuredClone(history);
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
}

export function invalidateBookingHistoryCache(bookingId: number): void {
  bookingHistoryCache.delete(bookingId);
  bookingHistoryRequests.delete(bookingId);
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
}
