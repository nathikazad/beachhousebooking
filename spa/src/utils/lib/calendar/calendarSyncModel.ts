import { calendar_v3 } from "googleapis";
import format from "date-fns/format";

import {
  BookingDB,
  Event,
  getCalendarKey,
  Property,
} from "../bookingType";

export interface CalendarSyncPayload {
  previousBooking: BookingDB | null;
  desiredBooking: BookingDB | null;
}

export interface DesiredCalendarEvent {
  eventKey: string;
  property: Property;
  calendarKey: string;
  eventData: calendar_v3.Schema$Event;
  legacyCalendarId?: string;
}

export interface KnownCalendarEvent {
  eventKey: string;
  property: Property;
  calendarEventId: string;
}

function eventKey(event: Event, index: number): string {
  return event.eventId ? `event-${event.eventId}` : `event-index-${index}`;
}

function eventDescription(booking: BookingDB, event: Event): string {
  return `
      Last Modified By: ${booking.updatedBy.name}
      Last Modified Date: ${format(new Date(`${booking.updatedDateTime || ""}`), "iii LLL d, hh:mmaa")}
      ${booking.bookingType === "Event" ? `Event Amount: ${event.finalCost}\n` : ""}
      Total Amount: ${booking.tax ? booking.afterTaxTotal : booking.totalCost}
      Payment Method: ${booking.paymentMethod}
      Paid Amount: ${booking.payments.reduce((total, payment) => total + payment.amount, 0)}
    `;
}

function desiredEventData(
  booking: BookingDB,
  event: Event,
  property: Property
): calendar_v3.Schema$Event {
  const numberOfGuests =
    booking.bookingType === "Stay"
      ? booking.numberOfGuests
      : event.numberOfGuests;
  const eventName = event.eventName === "Stay" ? "" : event.eventName;

  return {
    summary: `${booking.client.name}(${numberOfGuests} pax)${eventName}`,
    description: eventDescription(booking, event),
    location: property,
    start: { dateTime: event.startDateTime },
    end: { dateTime: event.endDateTime },
    colorId: booking.status === "Preconfirmed" ? "5" : null,
  };
}

function stayEvent(booking: BookingDB): Event {
  return {
    ...booking,
    finalCost: booking.totalCost,
    djService: false,
    eventName: "Stay",
    valetService: false,
    kitchenService: false,
    overNightStay: false,
    overNightGuests: 0,
    markForDeletion: false,
  };
}

export function desiredCalendarEvents(
  booking: BookingDB | null
): DesiredCalendarEvent[] {
  if (
    !booking ||
    (booking.status !== "Confirmed" && booking.status !== "Preconfirmed")
  ) {
    return [];
  }

  const events =
    booking.bookingType === "Stay" ? [stayEvent(booking)] : booking.events;

  return events.flatMap((event, index) => {
    if (event.markForDeletion) {
      return [];
    }

    const key = booking.bookingType === "Stay" ? "stay" : eventKey(event, index);
    return event.properties.map((property) => ({
      eventKey: key,
      property,
      calendarKey: getCalendarKey(property),
      eventData: desiredEventData(booking, event, property),
      legacyCalendarId: event.calendarIds?.[property],
    }));
  });
}

export function knownCalendarEvents(
  booking: BookingDB | null
): KnownCalendarEvent[] {
  if (!booking) {
    return [];
  }

  if (booking.bookingType === "Stay") {
    return Object.entries(booking.calendarIds ?? {}).map(
      ([property, calendarEventId]) => ({
        eventKey: "stay",
        property: property as Property,
        calendarEventId,
      })
    );
  }

  return booking.events.flatMap((event, index) =>
    Object.entries(event.calendarIds ?? {}).map(
      ([property, calendarEventId]) => ({
        eventKey: eventKey(event, index),
        property: property as Property,
        calendarEventId,
      })
    )
  );
}

function calendarProjection(booking: BookingDB | null) {
  return desiredCalendarEvents(booking)
    .map(({ eventKey, property, eventData }) => ({
      eventKey,
      property,
      summary: eventData.summary,
      description: eventData.description
        ?.replace(/Last Modified By:.*\n/, "")
        .replace(/Last Modified Date:.*\n/, ""),
      start: eventData.start?.dateTime,
      end: eventData.end?.dateTime,
      colorId: eventData.colorId,
    }))
    .sort((left, right) =>
      `${left.eventKey}:${left.property}`.localeCompare(
        `${right.eventKey}:${right.property}`
      )
    );
}

export function needsCalendarSync(
  previousBooking: BookingDB | null,
  desiredBooking: BookingDB | null
): boolean {
  return (
    JSON.stringify(calendarProjection(previousBooking)) !==
    JSON.stringify(calendarProjection(desiredBooking))
  );
}

export function removeMarkedEvents(booking: BookingDB): BookingDB {
  if (booking.bookingType !== "Event") {
    return booking;
  }

  return {
    ...booking,
    events: booking.events.filter((event) => !event.markForDeletion),
  };
}

