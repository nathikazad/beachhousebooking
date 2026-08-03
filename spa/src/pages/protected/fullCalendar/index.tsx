import BaseCalendar from "@/components/BaseCalendar";
import { getEventsFromBooking } from "@/utils/calendarHelpers";
import { bookingSummaryFromRow } from "@/utils/lib/financials";
import {
  BookingDB,
  CalendarCell,
  convertStringToProperty,
  Property,
} from "@/utils/lib/bookingType";
import {
  calendarViewCacheKey,
  readCalendarViewCache,
  refreshCalendarViewCache,
} from "@/utils/lib/calendarViewCache";
import { supabase } from "@/utils/supabase/client";
import format from "date-fns/format";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const FullCalendar = () => {
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<BookingDB[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | "all">(
    "all"
  );
  const monthDate = useRef(new Date());
  const activeCacheKey = useRef("");

  const refreshCalendar = useCallback(async (date: Date) => {
    monthDate.current = date;
    const key = calendarViewCacheKey(date);
    activeCacheKey.current = key;
    const cached = readCalendarViewCache(key);

    if (cached) {
      setBookings(cached);
      setLoading(false);
    } else {
      setBookings([]);
      setLoading(true);
    }

    try {
      const result = await refreshCalendarViewCache(key, () =>
        fetchCalendarBookings(date)
      );
      if (activeCacheKey.current !== key) return;

      if (!cached || result.changed) {
        setBookings(result.bookings);
      }
    } catch (error) {
      console.error("Unable to refresh calendar", error);
    } finally {
      if (activeCacheKey.current === key) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshCalendar(monthDate.current);
  }, [refreshCalendar]);

  const bookingsList = useMemo<CalendarCell[]>(
    () => getEventsFromBooking(bookings, selectedProperty),
    [bookings, selectedProperty]
  );

  return (
    <div className="h-full flex items-start justify-center w-full laptop-up:h-auto mobile-up:px-10">
      <div className="w-full">
        <div className="flex items-center h-[72px]">
          <h1 className="text-lg font-bold leading-6 w-full text-center">
            Calendar
          </h1>
        </div>
        <div>
          <select
            name="properties"
            id="properties"
            className="my-2 w-full h-10 border-[1px] border-typo_dark-100 rounded-sm px-3"
            value={selectedProperty}
            onChange={(event) =>
              setSelectedProperty(convertStringToProperty(event.target.value))
            }
          >
            <option value="all">All</option>
            <option value={Property.Bluehouse}>{Property.Bluehouse}</option>
            <option value={Property.MeadowLane}>{Property.MeadowLane}</option>
            <option value={Property.Glasshouse}>{Property.Glasshouse}</option>
            <option value={Property.VillaArmati}>{Property.VillaArmati}</option>
            <option value={Property.LeChalet}>{Property.LeChalet}</option>
            <option value={Property.Castle}>{Property.Castle}</option>
          </select>
        </div>
        <BaseCalendar
          loading={loading}
          onMonthChange={(date) => void refreshCalendar(date)}
          bookingsList={bookingsList}
        />
      </div>
    </div>
  );
};

async function fetchCalendarBookings(date: Date): Promise<BookingDB[]> {
  const month = format(date, "yyyy-MM");
  const nextMonth = format(
    new Date(date.getFullYear(), date.getMonth() + 1),
    "yyyy-MM"
  );
  const { data, error } = await supabase
    .from("bookings")
    .select()
    .gte("check_out", `${month}-01T00:00:00.000Z`)
    .lt("check_in", `${nextMonth}-01T00:00:00.000Z`)
    .in("status", ["confirmed", "preconfirmed"]);

  if (error) throw error;

  return (data ?? [])
    .map(bookingSummaryFromRow)
    .sort(
      (first, second) =>
        (second.bookingId ?? 0) - (first.bookingId ?? 0)
    );
}

export default FullCalendar;
