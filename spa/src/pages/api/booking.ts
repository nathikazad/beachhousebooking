import { BookingForm } from '@/utils/lib/bookingType';
import {
  CalendarSyncPlan,
  deleteBooking,
  mutateBookingState,
} from '@/utils/lib/booking';
import { BookingConflictError } from '@/utils/lib/occupancy';
import { NextApiRequest, NextApiResponse } from 'next';
import { fetchUser, verifyAndGetPayload } from '@/utils/lib/auth';
import {
  fetchBooking,
  fetchBookingByClientViewId,
  fetchLatestBooking,
  fetchLatestBookingByClientViewId,
} from "@/utils/lib/db";
import { withDatabaseClient } from "@/utils/lib/helper";
import { synchronizeCalendarInBackground } from "@/utils/lib/calendar/calendarBackgroundSync";
import { waitUntil } from "@vercel/functions";

export const config = {
  maxDuration: 59,
};


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  switch (req.method) {
  case 'GET':
    await handleGet(req, res);
    break;
  case 'POST':
    await handlePost(req, res);
    break;
  case 'DELETE':
    await handleDelete(req, res);
    break;
  default:
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  const startedAt = performance.now();
  const timings: Array<{ name: string; duration: number }> = [];

  const sendHistory = (
    history: Awaited<ReturnType<typeof fetchBooking>>,
    historyCount: number
  ) => {
    const serializationStartedAt = performance.now();
    const payload = JSON.stringify({ history, historyCount });
    timings.push({
      name: "serialize",
      duration: performance.now() - serializationStartedAt,
    });
    timings.push({
      name: "total",
      duration: performance.now() - startedAt,
    });
    res.setHeader(
      "Server-Timing",
      timings
        .map(({ name, duration }) => `${name};dur=${duration.toFixed(1)}`)
        .join(", ")
    );
    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(payload);
  };

  try {
    const { bookingId, clientViewId } = req.query;
    const includeHistory = req.query.includeHistory === "true";

    if (typeof clientViewId === "string") {
      const databaseStartedAt = performance.now();
      const result = includeHistory
        ? {
            history: await fetchBookingByClientViewId(clientViewId),
            historyCount: 0,
          }
        : await fetchLatestBookingByClientViewId(clientViewId);
      if (includeHistory) {
        result.historyCount = result.history.length;
      }
      timings.push({
        name: "database",
        duration: performance.now() - databaseStartedAt,
      });
      const publicHistory = result.history.map((booking) => ({
        ...booking,
        payments: (booking.payments ?? []).map((payment) => {
          const { details: _details, ...publicPayment } = payment;
          return publicPayment;
        }),
      }));
      return sendHistory(publicHistory, result.historyCount);
    }

    const authStartedAt = performance.now();
    await verifyAndGetPayload(req);
    timings.push({
      name: "auth",
      duration: performance.now() - authStartedAt,
    });
    if (typeof bookingId !== "string" || !Number.isInteger(Number(bookingId))) {
      return res.status(400).json({
        error: "INVALID_BOOKING_ID",
        message: "A valid booking ID is required.",
      });
    }

    const databaseStartedAt = performance.now();
    const result = includeHistory
      ? {
          history: await fetchBooking(Number(bookingId)),
          historyCount: 0,
        }
      : await fetchLatestBooking(Number(bookingId));
    if (includeHistory) {
      result.historyCount = result.history.length;
    }
    timings.push({
      name: "database",
      duration: performance.now() - databaseStartedAt,
    });
    return sendHistory(result.history, result.historyCount);
  } catch (error) {
    res.setHeader(
      "Server-Timing",
      `total;dur=${(performance.now() - startedAt).toFixed(1)}`
    );
    const message =
      error instanceof Error ? error.message : "Unable to load booking.";
    const status = message === "Booking not found" ? 404 : 401;
    return res.status(status).json({
      error: status === 404 ? "BOOKING_NOT_FOUND" : "UNAUTHORIZED",
      message,
    });
  }
};

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  const startedAt = performance.now();
  const timings: Array<{ name: string; duration: number }> = [];
  const recordTiming = (name: string, duration: number) => {
    timings.push({ name, duration });
  };

  try {
    const authStartedAt = performance.now();
    const payload = await verifyAndGetPayload(req);
    recordTiming("auth", performance.now() - authStartedAt);
    const booking: BookingForm = JSON.parse(req.body);
    const mutation = await withDatabaseClient(async (client) => {
      const userStartedAt = performance.now();
      const user = await fetchUser(payload.sub, client);
      recordTiming("user", performance.now() - userStartedAt);
      return mutateBookingState(booking, user, {
        executor: client,
        recordTiming,
      });
    });
    scheduleCalendarSync(mutation.calendarSync);
    recordTiming("total", performance.now() - startedAt);
    setServerTiming(res, timings);
    res.status(200).json({ bookingId: mutation.bookingId });
  } catch (error) {
    recordTiming("total", performance.now() - startedAt);
    setServerTiming(res, timings);
    console.error('Error creating booking:', error);
    if (error instanceof BookingConflictError) {
      return res.status(409).json({
        error: "BOOKING_CONFLICT",
        message: error.message,
        conflicts: error.conflicts,
      });
    }
    return res.status(500).json({ error: "Error creating booking", message: (error as Error).message });
  }
}

const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
  const startedAt = performance.now();
  console.log('Delete request');
  try {
    const payload = await verifyAndGetPayload(req);
    const { bookingId } = JSON.parse(req.body)
    console.log('Booking id:', bookingId);
    const calendarSync = await withDatabaseClient(async (client) => {
      await fetchUser(payload.sub, client);
      return deleteBooking(bookingId, client);
    });
    scheduleCalendarSync(calendarSync);
    res.setHeader(
      "Server-Timing",
      `total;dur=${(performance.now() - startedAt).toFixed(1)}`
    );
    res.status(200).json({ message: "Booking deleted" });
  } catch (error) {
    res.setHeader(
      "Server-Timing",
      `total;dur=${(performance.now() - startedAt).toFixed(1)}`
    );
    console.error('Error deleting booking:', error);
    return res.status(500).json({ error: "Error deleting booking", message: (error as Error).message });
  }
}

function scheduleCalendarSync(plan: CalendarSyncPlan | undefined) {
  if (!plan) return;

  waitUntil(
    Promise.resolve()
      .then(() =>
        synchronizeCalendarInBackground(
          plan.bookingId,
          plan.previousBooking,
          plan.desiredBooking
        )
      )
      .catch((error) => {
        console.error("Background Google Calendar synchronization failed", {
          bookingId: plan.bookingId,
          error,
        });
      })
  );
}

function setServerTiming(
  res: NextApiResponse,
  timings: Array<{ name: string; duration: number }>
) {
  res.setHeader(
    "Server-Timing",
    timings
      .map(({ name, duration }) => `${name};dur=${duration.toFixed(1)}`)
      .join(", ")
  );
}
