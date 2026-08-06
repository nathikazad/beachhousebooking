import { bookingSummaryFromRow } from "./financials";
import { BookingDB } from "./bookingType";

const DATABASE_NAME = "beach-house-booking-offline";
const DATABASE_VERSION = 2;
const BOOKINGS_STORE = "bookings";
const VIEWS_STORE = "views";
const HISTORIES_STORE = "histories";
const META_STORE = "meta";
const DOCUMENTS_STORE = "documents";
const STATUS_EVENT = "beachhouse-offline-status";

let activeUserId: string | null = null;

export interface OfflineSyncStatus {
  lastSyncedAt: number | null;
  bookingCount: number;
}

interface StoredBooking {
  id: string;
  userId: string;
  bookingId: number;
  booking: BookingDB;
}

interface StoredView {
  id: string;
  userId: string;
  key: string;
  bookings: BookingDB[];
  syncedAt: number;
}

interface StoredHistory {
  id: string;
  userId: string;
  bookingId: number;
  history: BookingDB[];
  historyCount: number;
  syncedAt: number;
}

interface StoredMeta extends OfflineSyncStatus {
  id: string;
  userId: string;
}

interface StoredDocument<T = unknown> {
  id: string;
  userId: string;
  key: string;
  value: T;
  syncedAt: number;
}

export function setOfflineDataUser(userId: string | null): void {
  activeUserId = userId;
  emitStatusChanged();
}

export function getOfflineDataUser(): string | null {
  return activeUserId;
}

export async function readOfflineBookingView(
  key: string
): Promise<BookingDB[] | null> {
  const userId = await resolveUserId();
  if (!userId) return null;
  const entry = await getRecord<StoredView>(VIEWS_STORE, scopedId(userId, key));
  return entry ? structuredClone(entry.bookings) : null;
}

export async function writeOfflineBookingView(
  key: string,
  bookings: BookingDB[]
): Promise<void> {
  const userId = await resolveUserId();
  if (!userId) return;
  const cloned = structuredClone(bookings);
  await Promise.all([
    putRecord(VIEWS_STORE, {
      id: scopedId(userId, key),
      userId,
      key,
      bookings: cloned,
      syncedAt: Date.now(),
    } satisfies StoredView),
    upsertOfflineBookings(cloned, false),
  ]);
  await recordSuccessfulSync();
}

export async function readOfflineBooking(
  bookingId: number
): Promise<BookingDB | null> {
  const userId = await resolveUserId();
  if (!userId) return null;
  const entry = await getRecord<StoredBooking>(
    BOOKINGS_STORE,
    scopedId(userId, bookingId)
  );
  return entry ? structuredClone(entry.booking) : null;
}

export async function readAllOfflineBookings(): Promise<BookingDB[]> {
  const userId = await resolveUserId();
  if (!userId) return [];
  const entries = await getAllRecords<StoredBooking>(BOOKINGS_STORE);
  return entries
    .filter((entry) => entry.userId === userId)
    .map((entry) => structuredClone(entry.booking));
}

export async function readOfflineBookingHistory(
  bookingId: number
): Promise<{ history: BookingDB[]; historyCount: number } | null> {
  const userId = await resolveUserId();
  if (!userId) return null;
  const entry = await getRecord<StoredHistory>(
    HISTORIES_STORE,
    scopedId(userId, bookingId)
  );
  if (entry) {
    return {
      history: structuredClone(entry.history),
      historyCount: entry.historyCount,
    };
  }
  const booking = await readOfflineBooking(bookingId);
  return booking ? { history: [booking], historyCount: 1 } : null;
}

export async function writeOfflineBookingHistory(
  bookingId: number,
  history: BookingDB[],
  historyCount = history.length
): Promise<void> {
  const userId = await resolveUserId();
  if (!userId) return;
  await putRecord(HISTORIES_STORE, {
    id: scopedId(userId, bookingId),
    userId,
    bookingId,
    history: structuredClone(history),
    historyCount,
    syncedAt: Date.now(),
  } satisfies StoredHistory);
  const latest = history[history.length - 1];
  if (latest) await upsertOfflineBookings([latest], false);
  await recordSuccessfulSync();
}

export async function removeOfflineBooking(bookingId: number): Promise<void> {
  const userId = await resolveUserId();
  if (!userId) return;
  await Promise.all([
    deleteRecord(BOOKINGS_STORE, scopedId(userId, bookingId)),
    deleteRecord(HISTORIES_STORE, scopedId(userId, bookingId)),
    clearUserStore(VIEWS_STORE, userId),
  ]);
}

export async function hardSyncOfflineBookings(): Promise<OfflineSyncStatus> {
  const userId = await resolveUserId();
  if (!userId) throw new Error("Please sign in again before syncing.");
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("You are offline. Connect to the internet and try again.");
  }

  const pageSize = 1000;
  const rows: any[] = [];
  const { supabase } = await import("../supabase/client");
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("bookings")
      .select()
      .order("id", { ascending: true })
      .range(start, start + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) break;
  }

  const bookings = rows.map(bookingSummaryFromRow);
  await upsertOfflineBookings(bookings, true);
  await clearUserStore(VIEWS_STORE, userId);
  const status = { lastSyncedAt: Date.now(), bookingCount: bookings.length };
  await writeStatus(status);
  return status;
}

export async function getOfflineSyncStatus(): Promise<OfflineSyncStatus> {
  const userId = await resolveUserId();
  if (!userId) return { lastSyncedAt: null, bookingCount: 0 };
  const status = await getRecord<StoredMeta>(META_STORE, userId);
  return status
    ? { lastSyncedAt: status.lastSyncedAt, bookingCount: status.bookingCount }
    : { lastSyncedAt: null, bookingCount: 0 };
}

export async function readOfflineDocument<T>(key: string): Promise<T | null> {
  const userId = await resolveUserId();
  if (!userId) return null;
  const entry = await getRecord<StoredDocument<T>>(
    DOCUMENTS_STORE,
    scopedId(userId, key)
  );
  return entry ? structuredClone(entry.value) : null;
}

export async function writeOfflineDocument<T>(
  key: string,
  value: T
): Promise<void> {
  const userId = await resolveUserId();
  if (!userId) return;
  await putRecord(DOCUMENTS_STORE, {
    id: scopedId(userId, key),
    userId,
    key,
    value: structuredClone(value),
    syncedAt: Date.now(),
  } satisfies StoredDocument<T>);
  await recordSuccessfulSync();
}

export async function clearOfflineDataForCurrentUser(): Promise<void> {
  const userId = await resolveUserId();
  if (!userId) return;
  await Promise.all([
    clearUserStore(BOOKINGS_STORE, userId),
    clearUserStore(VIEWS_STORE, userId),
    clearUserStore(HISTORIES_STORE, userId),
    clearUserStore(DOCUMENTS_STORE, userId),
    deleteRecord(META_STORE, userId),
  ]);
  emitStatusChanged();
}

export function subscribeOfflineStatus(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(STATUS_EVENT, listener);
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener(STATUS_EVENT, listener);
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

async function upsertOfflineBookings(
  bookings: BookingDB[],
  replace: boolean
): Promise<void> {
  const userId = await resolveUserId();
  if (!userId) return;
  if (replace) await clearUserStore(BOOKINGS_STORE, userId);
  await putRecords(
    BOOKINGS_STORE,
    bookings
      .filter((booking) => Number.isFinite(booking.bookingId))
      .map((booking) => ({
        id: scopedId(userId, booking.bookingId!),
        userId,
        bookingId: booking.bookingId!,
        booking: structuredClone(booking),
      } satisfies StoredBooking))
  );
}

async function recordSuccessfulSync(): Promise<void> {
  const current = await getOfflineSyncStatus();
  await writeStatus({ ...current, lastSyncedAt: Date.now() });
}

async function writeStatus(status: OfflineSyncStatus): Promise<void> {
  const userId = await resolveUserId();
  if (!userId) return;
  await putRecord(META_STORE, { id: userId, userId, ...status } satisfies StoredMeta);
  emitStatusChanged();
}

function emitStatusChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(STATUS_EVENT));
}

function scopedId(userId: string, key: string | number): string {
  return `${userId}:${key}`;
}

async function resolveUserId(): Promise<string | null> {
  if (activeUserId) return activeUserId;
  if (typeof window === "undefined") return null;
  try {
    const { supabase } = await import("../supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    activeUserId = session?.user.id ?? null;
  } catch {
    return null;
  }
  return activeUserId;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const store of [
        BOOKINGS_STORE,
        VIEWS_STORE,
        HISTORIES_STORE,
        META_STORE,
        DOCUMENTS_STORE,
      ]) {
        if (!database.objectStoreNames.contains(store)) {
          const objectStore = database.createObjectStore(store, { keyPath: "id" });
          objectStore.createIndex("userId", "userId", { unique: false });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getRecord<T>(storeName: string, id: string): Promise<T | null> {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).get(id);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function getAllRecords<T>(storeName: string): Promise<T[]> {
  const database = await openDatabase();
  if (!database) return [];
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve((request.result as T[]) ?? []);
    request.onerror = () => reject(request.error);
  });
}

async function putRecord(storeName: string, value: unknown): Promise<void> {
  return putRecords(storeName, [value]);
}

async function putRecords(storeName: string, values: unknown[]): Promise<void> {
  if (values.length === 0) return;
  const database = await openDatabase();
  if (!database) return;
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    values.forEach((value) => store.put(value));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function deleteRecord(storeName: string, id: string): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function clearUserStore(storeName: string, userId: string): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const index = transaction.objectStore(storeName).index("userId");
    const request = index.openKeyCursor(IDBKeyRange.only(userId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      transaction.objectStore(storeName).delete(cursor.primaryKey);
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
