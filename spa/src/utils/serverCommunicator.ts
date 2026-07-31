import { BookingDB, BookingForm } from "./lib/bookingType";
import {
  BookingHistorySnapshot,
  invalidateBookingHistoryCache,
  loadLatestBookingCached,
  loadBookingHistoryCached,
} from "./lib/bookingHistoryCache";
import { invalidateCheckInAuditCache } from "./lib/checkInAuditCache";
import { invalidateDoubleBookingAuditCache } from "./lib/doubleBookingAuditCache";
import { invalidateBookingListCache } from "./lib/bookingListCache";
import { supabase } from "./supabase/client";

export const monthConvertFromNumber: Record<number, string> = {
  1: "january",
  2: "february",
  3: "march",
  4: "april",
  5: "may",
  6: "june",
  7: "july",
  8: "august",
  9: "september",
  10: "october",
  11: "november",
  12: "december"
};
export const createBooking = async (bookingForm: BookingForm) => {
  console.log('Creating booking: ', bookingForm)
  let sesh = await supabase.auth.getSession()
  let token = sesh.data.session?.access_token;
  let bookingId: string | null = null;
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const body = JSON.stringify(bookingForm);
    const response = await fetch(`${apiUrl}/api/booking`, {
      method: "POST",
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: body
    });
    const data = await response.json();
    bookingId = data.bookingId;
    console.log('Response from POST function:', data);
    if (data.error) {
      return Promise.reject({ msg: data.message, error: true })
    }
    if (bookingId) {
      invalidateBookingHistoryCache(Number(bookingId));
    }
    invalidateCheckInAuditCache();
    invalidateDoubleBookingAuditCache();
    invalidateBookingListCache();
    return bookingId;

  } catch (error) {
    console.error('Error calling POST function:', error);

  }
  return bookingId;
}

export async function getBookingHistory(
  identifier: { bookingId: number } | { clientViewId: string }
): Promise<BookingDB[]> {
  if ("bookingId" in identifier) {
    return loadBookingHistoryCached(identifier.bookingId, () =>
      fetchBookingHistory(identifier, true).then(
        (snapshot) => snapshot.history
      )
    );
  }

  return fetchBookingHistory(identifier, true).then(
    (snapshot) => snapshot.history
  );
}

export async function getLatestBookingHistory(
  identifier: { bookingId: number } | { clientViewId: string }
): Promise<BookingHistorySnapshot> {
  if ("bookingId" in identifier) {
    return loadLatestBookingCached(identifier.bookingId, () =>
      fetchBookingHistory(identifier, false)
    );
  }

  return fetchBookingHistory(identifier, false);
}

async function fetchBookingHistory(
  identifier: { bookingId: number } | { clientViewId: string },
  includeHistory: boolean
): Promise<BookingHistorySnapshot> {
  const query = new URLSearchParams(
    "bookingId" in identifier
      ? { bookingId: String(identifier.bookingId) }
      : { clientViewId: identifier.clientViewId }
  );
  if (includeHistory) {
    query.set("includeHistory", "true");
  }
  const headers: HeadersInit = {};

  if ("bookingId" in identifier) {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      throw new Error("Please sign in again to view this booking.");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api/booking?${query.toString()}`, {
    cache: "no-store",
    headers,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to load booking.");
  }

  return {
    history: data.history,
    historyCount: Number(data.historyCount ?? data.history.length),
  };
}

export const deleteBooking = async (bookingId: number) => {
  console.log('Deleting booking id: ', bookingId)
  let sesh = await supabase.auth.getSession()
  let token = sesh.data.session?.access_token;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/booking`, {
      method: "DELETE",
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ bookingId })
    });
    if (response.ok) {
      invalidateBookingHistoryCache(bookingId);
      invalidateCheckInAuditCache();
      invalidateDoubleBookingAuditCache();
      invalidateBookingListCache();
    }
    console.log('Deleted id: ', bookingId);

  } catch (error) {
    console.error('Error calling GET function:', error);
  }
}
export const getDateAvailability = async (properties: string, month: number,year:number,bookingId?:number) => {
  let sesh = await supabase.auth.getSession()
  let token = sesh.data.session?.access_token;
  
  console.log('Fetching dates for propreties: ', properties,' month: ',month,' year : ',year);

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'; 
    const response = await fetch(`${apiUrl}/api/calendar?properties=${properties}&month=${monthConvertFromNumber[month]}&year=${year}${bookingId?'&bookingId='+bookingId:''}`, {
      method: "GET",
      headers: {
        'Authorization': `Bearer ${token}`
      },

    });
    const data = await response.json();
   return data

  } catch (error) {
    console.error('Error calling GET function:', error);
  }
}
