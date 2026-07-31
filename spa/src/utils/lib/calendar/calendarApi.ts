import { google, calendar_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Property, getCalendarKey } from '../bookingType';

let calendarClient: calendar_v3.Calendar | undefined;

function getCalendar() {
  if (calendarClient) {
    return calendarClient;
  }

  const client: JWT = new JWT({
    email: process.env.CALENDAR_EMAIL,
    key: process.env.CALENDAR_KEY,
    scopes: [ // set the right scope
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],

  });
  calendarClient = google.calendar({ version: 'v3', auth: client as any });
  return calendarClient;
}

export async function insertEvent(calendarId: string, event: calendar_v3.Schema$Event): Promise<string> {
  const resp = await getCalendar().events.insert({
    calendarId: calendarId,
    requestBody: event,
  });
  return resp.data.id!
}

export async function listEvents(property: Property, minTime: string, maxTime: string): Promise<calendar_v3.Schema$Event[]> {
  const res = await getCalendar().events.list({
    calendarId: getCalendarKey(property),
    timeMin: minTime,
    timeMax: maxTime,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return res.data.items ?? [];
}

export async function patchEvent(calendarId: string, eventId: string, event: calendar_v3.Schema$Event): Promise<void> {
  await getCalendar().events.patch({
    calendarId: calendarId,
    eventId: eventId,
    requestBody: event
  });

}

export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  await getCalendar().events.delete({
    calendarId: calendarId,
    eventId: eventId
  });
}

export function isCalendarEventMissing(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as {
    code?: number;
    response?: { status?: number };
  };
  const status = candidate.response?.status ?? candidate.code;
  return status === 404 || status === 410;
}

export function isCalendarEventAlreadyExists(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as {
    code?: number;
    response?: { status?: number };
  };
  const status = candidate.response?.status ?? candidate.code;
  return status === 409;
}
