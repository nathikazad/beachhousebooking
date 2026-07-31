import { createHash } from "node:crypto";

import {
  getCalendarKey,
  Property,
} from "../bookingType";
import {
  desiredCalendarEvents,
  DesiredCalendarEvent,
  knownCalendarEvents,
} from "./calendarSyncModel";
import {
  deleteEvent,
  insertEvent,
  isCalendarEventAlreadyExists,
  isCalendarEventMissing,
  patchEvent,
} from "./calendarApi";
import { BookingDB } from "../bookingType";

interface CalendarEventReference {
  eventKey: string;
  property: Property;
  calendarEventId: string;
}

function referenceKey(eventKey: string, property: Property): string {
  return `${eventKey}:${property}`;
}

export function deterministicCalendarEventId(
  bookingId: number,
  eventKey: string,
  property: Property
): string {
  const digest = createHash("sha256")
    .update(`${bookingId}:${eventKey}:${property}`)
    .digest("hex");
  return `bh${digest}`;
}

async function insertDeterministicEvent(
  bookingId: number,
  event: DesiredCalendarEvent
): Promise<string> {
  const calendarEventId = deterministicCalendarEventId(
    bookingId,
    event.eventKey,
    event.property
  );
  const eventData = {
    ...event.eventData,
    id: calendarEventId,
  };

  try {
    return await insertEvent(event.calendarKey, eventData);
  } catch (error) {
    if (!isCalendarEventAlreadyExists(error)) {
      throw error;
    }
    await patchEvent(event.calendarKey, calendarEventId, event.eventData);
    return calendarEventId;
  }
}

export async function synchronizeCalendarInBackground(
  bookingId: number,
  previousBooking: BookingDB | null,
  desiredBooking: BookingDB | null
): Promise<void> {
  const previousDesired = desiredCalendarEvents(previousBooking);
  const desired = desiredCalendarEvents(desiredBooking);
  const known = new Map<string, CalendarEventReference>();

  for (const event of previousDesired) {
    known.set(referenceKey(event.eventKey, event.property), {
      eventKey: event.eventKey,
      property: event.property,
      calendarEventId:
        event.legacyCalendarId ??
        deterministicCalendarEventId(
          bookingId,
          event.eventKey,
          event.property
        ),
    });
  }

  for (const reference of [
    ...knownCalendarEvents(previousBooking),
    ...knownCalendarEvents(desiredBooking),
  ]) {
    known.set(referenceKey(reference.eventKey, reference.property), reference);
  }

  const desiredKeys = new Set(
    desired.map((event) => referenceKey(event.eventKey, event.property))
  );
  const resultingReferences = await mapWithConcurrency(
    desired,
    4,
    async (event): Promise<CalendarEventReference> => {
      const key = referenceKey(event.eventKey, event.property);
      const existingId =
        known.get(key)?.calendarEventId ?? event.legacyCalendarId;
      let calendarEventId = existingId;

      if (existingId) {
        try {
          await patchEvent(event.calendarKey, existingId, event.eventData);
        } catch (error) {
          if (!isCalendarEventMissing(error)) {
            throw error;
          }
          calendarEventId = await insertDeterministicEvent(bookingId, event);
        }
      } else {
        calendarEventId = await insertDeterministicEvent(bookingId, event);
      }

      return {
        eventKey: event.eventKey,
        property: event.property,
        calendarEventId: calendarEventId!,
      };
    }
  );

  const desiredCalendarIds = new Set(
    resultingReferences.map((reference) => reference.calendarEventId)
  );
  const obsolete = Array.from(known.values()).filter(
    (reference) =>
      !desiredKeys.has(referenceKey(reference.eventKey, reference.property)) &&
      !desiredCalendarIds.has(reference.calendarEventId)
  );

  await mapWithConcurrency(obsolete, 4, async (reference) => {
    try {
      await deleteEvent(
        getCalendarKey(reference.property),
        reference.calendarEventId
      );
    } catch (error) {
      if (!isCalendarEventMissing(error)) {
        throw error;
      }
    }
  });
}

export async function mapWithConcurrency<Input, Output>(
  values: Input[],
  concurrency: number,
  mapper: (value: Input) => Promise<Output>
): Promise<Output[]> {
  const output = new Array<Output>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      output[index] = await mapper(values[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(concurrency, 1), values.length) },
      worker
    )
  );
  return output;
}

