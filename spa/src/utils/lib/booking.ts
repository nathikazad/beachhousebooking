
import { User } from "./auth";

import { addToCalendar, deleteCalendarEvents } from "./calendar/calendarLogic";
import { BookingDB, BookingForm, convertIndianTimeToUTC } from "./bookingType";
import { createBooking, fetchBooking, findBookingConflicts, updateBooking } from "./db";
import { query } from "./helper";
import {
  BookingConflict,
  BookingConflictError,
  formatBookingConflictMessage,
} from "./occupancy";
import { validateBookingFinancials } from "./financials";

function capitalizeString(str: string): string {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

// return boolean and error if double booking is detected
export async function checkForDoubleBooking(booking: BookingDB): Promise<{
  doubleBooking: boolean;
  conflicts: BookingConflict[];
  error?: string;
}> {
  const conflicts = await findBookingConflicts(booking);
  return {
    doubleBooking: conflicts.length > 0,
    conflicts,
    error:
      conflicts.length > 0
        ? formatBookingConflictMessage(conflicts)
        : undefined,
  };
}

export async function mutateBookingState(booking: BookingForm, user: User): Promise<number> {
  let newBooking: BookingDB = {
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
  }
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

  if (newBooking.status == "Confirmed" || newBooking.status == "Preconfirmed") {
    const { doubleBooking, conflicts } = await checkForDoubleBooking(newBooking);
    if (doubleBooking) {
      throw new BookingConflictError(conflicts);
    }
  }

  if(newBooking.bookingId) {
    console.log("mutateBookingState modify booking")
    await addToCalendar(newBooking);

    try {
      await modifyExistingBooking(newBooking);
    } catch (error) {
      return await throwFriendlyConstraintConflict(error, newBooking);
    }
    return newBooking.bookingId
  } else {
    console.log("mutateBookingState create booking")
    await addToCalendar(newBooking);
    try {
      return await createBooking(newBooking, user.displayName ?? user.id);
    } catch (error) {
      return await throwFriendlyConstraintConflict(error, newBooking);
    }
  }
}

async function throwFriendlyConstraintConflict(
  error: unknown,
  booking: BookingDB
): Promise<never> {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23P01"
  ) {
    const conflicts = await findBookingConflicts(booking);
    if (conflicts.length > 0) {
      throw new BookingConflictError(conflicts);
    }
  }

  throw error;
}

async function modifyExistingBooking(newBooking: BookingDB) {
  if (!newBooking.bookingId) {
    throw new Error("Booking ID is required");
  }
  let bookings = await fetchBooking(newBooking.bookingId!);
  let oldBooking = bookings[bookings.length - 1];
  newBooking.createdBy = oldBooking.createdBy;

  bookings.push(newBooking);
  await updateBooking(bookings, newBooking.bookingId!);
}

export async function deleteBooking(bookingId: number) {
  // first fetch
  let bookings = await query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  if (bookings.length === 0) {
    throw new Error("Booking not found");
  }
  let lastIndexOfJson = bookings[0].json.length - 1;
  let booking = bookings[0].json[lastIndexOfJson] as BookingDB;
  await deleteCalendarEvents(booking)
  await query('DELETE FROM bookings WHERE id = $1', [bookingId]);
}
