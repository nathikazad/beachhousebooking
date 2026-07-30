import { useRouter } from "next/router";
import {
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  DoubleBookingAuditResponse,
  formatPairConflictMessage,
} from "@/utils/lib/conflictAudit";
import {
  bookingPreviewHref,
  DOUBLE_BOOKING_AUDIT_RETURN_PATH,
} from "@/utils/lib/bookingNavigation";
import {
  readDoubleBookingAuditCache,
  writeDoubleBookingAuditCache,
} from "@/utils/lib/doubleBookingAuditCache";
import {
  displayProperty,
  formatInIndianTime,
} from "@/utils/lib/occupancy";
import { supabase } from "@/utils/supabase/client";

function displayStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function displayEventName(eventName: string): string {
  return eventName === "Stay" ? "Stay" : `Event: ${eventName}`;
}

export default function DoubleBookingsPage() {
  const router = useRouter();
  const initialAudit = useRef(readDoubleBookingAuditCache());
  const [audit, setAudit] = useState<DoubleBookingAuditResponse | null>(
    initialAudit.current
  );
  const [loading, setLoading] = useState(initialAudit.current === null);
  const [error, setError] = useState("");

  const loadDoubleBookings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Please sign in again to view double bookings.");
      }

      const response = await fetch("/api/booking-conflicts", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load double bookings.");
      }

      writeDoubleBookingAuditCache(data);
      setAudit(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load double bookings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialAudit.current) {
      loadDoubleBookings();
    }
  }, [loadDoubleBookings]);

  const openBooking = (
    event: MouseEvent<HTMLAnchorElement>,
    bookingId: number
  ) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    router.push({
      pathname: `/protected/booking/${bookingId}`,
      query: {
        returnTo: DOUBLE_BOOKING_AUDIT_RETURN_PATH,
      },
    });
  };

  return (
    <div className="flex w-full flex-col gap-5 pb-8 laptop-up:px-10">
      <div className="flex h-[72px] items-center gap-3">
        <button
          aria-label="Back to settings"
          className="flex h-10 w-10 items-center justify-center rounded-full"
          onClick={() => router.push("/protected/settings")}
          type="button"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="flex-1 text-lg font-bold leading-6">
          Double bookings
        </h1>
        <button
          aria-label="Refresh double bookings"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#BEBEBE]"
          disabled={loading}
          onClick={loadDoubleBookings}
          type="button"
        >
          <span
            className={`material-symbols-outlined ${
              loading ? "animate-spin" : ""
            }`}
          >
            refresh
          </span>
        </button>
      </div>

      {loading && !audit ? (
        <div className="flex min-h-48 items-center justify-center">
          <span className="loader-spinner"></span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-error bg-red-50 p-4">
          <p className="text-sm text-error">{error}</p>
          <button
            className="mt-3 rounded-lg border border-error px-4 py-2 text-sm font-bold text-error"
            onClick={loadDoubleBookings}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : null}

      {audit && !error ? (
        <>
          <div className="rounded-xl bg-[#F4F4F4] p-4">
            <p className="font-bold">
              {audit.conflictPeriodCount === 0
                ? "No upcoming double bookings"
                : `${audit.conflictPeriodCount} conflicting ${
                    audit.conflictPeriodCount === 1 ? "period" : "periods"
                  } in ${audit.conflictGroupCount} ${
                    audit.conflictGroupCount === 1 ? "group" : "groups"
                  }`}
            </p>
            <p className="mt-1 text-xs text-typo_light-200">
              Last checked {formatInIndianTime(audit.generatedAt)}
            </p>
          </div>

          {audit.groups.length === 0 ? (
            <div className="rounded-xl border border-[#BEBEBE] p-6 text-center">
              <span className="material-symbols-outlined text-4xl text-green-600">
                event_available
              </span>
              <p className="mt-2 font-bold">Everything is clear</p>
              <p className="mt-1 text-sm text-typo_light-200">
                Supabase found no current or future overlapping reservations.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {audit.groups.map((group) => (
                <section
                  className="overflow-hidden rounded-xl border border-error"
                  key={group.id}
                >
                  <div className="bg-red-50 p-4">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-error">
                        warning
                      </span>
                      <div>
                        <h2 className="font-bold text-error">
                          {displayProperty(group.property)}
                        </h2>
                        <p className="mt-1 text-sm">{group.message}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 p-4">
                    <div className="grid gap-3 laptop-up:grid-cols-2">
                      {group.bookings.map((booking) => (
                        <a
                          className="rounded-xl border border-[#BEBEBE] p-4 text-inherit hover:no-underline"
                          href={bookingPreviewHref(booking.bookingId)}
                          key={booking.bookingId}
                          onClick={(event) =>
                            openBooking(event, booking.bookingId)
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold">{booking.clientName}</p>
                              <p className="text-sm text-link">
                                Booking #{booking.bookingId}
                              </p>
                            </div>
                            <span className="rounded-full bg-[#F4F4F4] px-2 py-1 text-xs">
                              {displayStatus(booking.status)}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-col gap-2">
                            {booking.periods.map((period) => (
                              <div
                                className="text-xs text-typo_light-200"
                                key={`${period.bookingId}:${period.eventKey}`}
                              >
                                <p className="font-bold text-inherit">
                                  {displayEventName(period.eventName)}
                                </p>
                                <p>
                                  {formatInIndianTime(period.startsAt)} to{" "}
                                  {formatInIndianTime(period.endsAt)}
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 flex items-center gap-1 text-sm font-bold text-link">
                            <span>Open booking</span>
                            <span className="material-symbols-outlined text-base">
                              arrow_forward
                            </span>
                          </div>
                        </a>
                      ))}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold">Why this conflicts</h3>
                      <ul className="mt-2 flex list-none flex-col gap-2 p-0">
                        {group.conflicts.map((conflict, index) => (
                          <li
                            className="rounded-lg bg-[#F4F4F4] p-3 text-xs"
                            key={`${conflict.firstBooking.bookingId}:${conflict.firstBooking.eventKey}:${conflict.secondBooking.bookingId}:${conflict.secondBooking.eventKey}:${index}`}
                          >
                            {formatPairConflictMessage(conflict)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
