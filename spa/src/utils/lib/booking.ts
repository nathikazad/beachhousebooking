
import { User } from "./auth";

import { BookingDB, BookingForm, convertIndianTimeToUTC } from "./bookingType";
import {
  createBooking,
  fetchLatestBooking,
  findBookingConflicts,
  updateBooking,
} from "./db";
import { QueryExecutor, withTransaction } from "./helper";
import {
  BookingConflict,
  BookingConflictError,
  formatBookingConflictMessage,
} from "./occupancy";
import { validateBookingFinancials } from "./financials";
import { normalizeBookingTax } from "./gst";
import {
  needsCalendarSync,
  removeMarkedEvents,
} from "./calendar/calendarSyncModel";

export interface CalendarSyncPlan {
  bookingId: number;
  previousBooking: BookingDB | null;
  desiredBooking: BookingDB | null;
}

export interface BookingMutationResult {
  bookingId: number;
  calendarSync?: CalendarSyncPlan;
}

export interface BookingMutationOptions {
  executor?: QueryExecutor;
  recordTiming?: (name: string, duration: number) => void;
}

async function timed<T>(
  name: string,
  options: BookingMutationOptions,
  operation: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    options.recordTiming?.(name, performance.now() - startedAt);
  }
}

function capitalizeString(str: string): string {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

// return boolean and error if double booking is detected
export async function checkForDoubleBooking(
  booking: BookingDB,
  executor?: QueryExecutor
): Promise<{
  doubleBooking: boolean;
  conflicts: BookingConflict[];
  error?: string;
}> {
  const conflicts = await findBookingConflicts(booking, executor);
  return {
    doubleBooking: conflicts.length > 0,
    conflicts,
    error:
      conflicts.length > 0
        ? formatBookingConflictMessage(conflicts)
        : undefined,
  };
}

export async function mutateBookingState(
  booking: BookingForm,
  user: User,
  options: BookingMutationOptions = {}
): Promise<BookingMutationResult> {
  let newBooking: BookingDB = removeMarkedEvents(normalizeBookingTax({
    ...booking,
    startDateTime: booking.startDateTime!,
    endDateTime: booking.endDateTime!,
    client: {
      ...booking.client,
      name: capitalizeString(booking.client.name)
    },
    encodingVersion: 2,
    createdDateTime: (booking as BookingDB).createdDateTime ? convertIndianTimeToUTC((booking as BookingDB).createdDateTime) : new Date().toISOString(),
    createdBy: {
      id: user.id,
      name: user.displayName || "Anonymous",
    },
    updatedDateTime: new Date().toISOString(),
    updatedBy: {
      id: user.id,
      name: user.displayName || "Anonymous",
    },
    payments: booking.payments.map(payment => {
      return {
        ...payment,
        receivedBy: payment.receivedBy || {
          id: user.id,
          name: user.displayName || "Anonymous",
        },
        dateTime: payment.dateTime || new Date().toISOString()
      }
    })
  }));
  // TODO: add ids after booking id is generated, to reduce chance of collission
  for (let event of newBooking.events) {
    event.eventId = event.eventId || Math.floor(Math.random() * 1000000);
    for (let cost of event.costs) {
      cost.costId = cost.costId || Math.floor(Math.random() * 1000000);
    }
  }
  for (let payment of newBooking.payments) {
    payment.paymentId = payment.paymentId || Math.floor(Math.random() * 1000000);
  }
  if (newBooking.clientViewId === undefined) {
    newBooking.clientViewId = Math.floor(Math.random() * 1000000).toString();
  }
  validateBookingFinancials(newBooking, Boolean(newBooking.bookingId));

  let previousBooking: BookingDB | null = null;
  if (newBooking.bookingId) {
    const latest = await timed("booking_read", options, () =>
      fetchLatestBooking(newBooking.bookingId!, options.executor)
    );
    previousBooking = latest.history[latest.history.length - 1];
    newBooking.createdBy = previousBooking.createdBy;
  }

  if (newBooking.status == "Confirmed" || newBooking.status == "Preconfirmed") {
    const { doubleBooking, conflicts } = await timed("conflicts", options, () =>
      checkForDoubleBooking(newBooking, options.executor)
    );
    if (doubleBooking) {
      throw new BookingConflictError(conflicts);
    }
  }

  if(newBooking.bookingId) {
    console.log("mutateBookingState modify booking")
    try {
      await timed("database_write", options, () =>
        updateBooking(
          newBooking,
          newBooking.bookingId!,
          options.executor
        )
      );
    } catch (error) {
      await throwFriendlyConstraintConflict(
        error,
        newBooking,
        options.executor
      );
    }
    return {
      bookingId: newBooking.bookingId,
      calendarSync: needsCalendarSync(previousBooking, newBooking)
        ? {
            bookingId: newBooking.bookingId,
            previousBooking,
            desiredBooking: newBooking,
          }
        : undefined,
    };
  } else {
    console.log("mutateBookingState create booking")
    try {
      const bookingId = await timed("database_write", options, () =>
        createBooking(
          newBooking,
          user.displayName ?? user.id,
          options.executor
        )
      );
      return {
        bookingId,
        calendarSync: needsCalendarSync(null, newBooking)
          ? {
              bookingId,
              previousBooking: null,
              desiredBooking: newBooking,
            }
          : undefined,
      };
    } catch (error) {
      return await throwFriendlyConstraintConflict(
        error,
        newBooking,
        options.executor
      );
    }
  }
}

async function throwFriendlyConstraintConflict(
  error: unknown,
  booking: BookingDB,
  executor?: QueryExecutor
): Promise<never> {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23P01"
  ) {
    const conflicts = await findBookingConflicts(booking, executor);
    if (conflicts.length > 0) {
      throw new BookingConflictError(conflicts);
    }
  }

  throw error;
}

export async function deleteBooking(
  bookingId: number,
  executor?: QueryExecutor
): Promise<CalendarSyncPlan> {
  return withTransaction(async (client) => {
    const latest = await fetchLatestBooking(bookingId, client);
    const booking = latest.history[latest.history.length - 1];
    await client.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
    return {
      bookingId,
      previousBooking: booking,
      desiredBooking: null,
    };
  }, executor);
}
