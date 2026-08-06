"use client"
import { useRouter } from "next/router";
import { supabase } from '@/utils/supabase/client';
import { useEffect, useState } from "react";
import LoadingButton from "@/components/ui/LoadingButton";
import { canSeeReportsAndAudits } from "@/utils/lib/restrictedSettings";
import {
  clearOfflineDataForCurrentUser,
  getOfflineSyncStatus,
  hardSyncOfflineBookings,
  OfflineSyncStatus,
  subscribeOfflineStatus,
} from "@/utils/lib/offlineBookingStore";
import { invalidateBookingListCache } from "@/utils/lib/bookingListCache";
import { clearCalendarViewCache } from "@/utils/lib/calendarViewCache";
import { clearBookingHistoryCache } from "@/utils/lib/bookingHistoryCache";



export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus>({
    lastSyncedAt: null,
    bookingCount: 0,
  });
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let user = session?.user ?? null;
      if (navigator.onLine) {
        const verified = await supabase.auth.getUser();
        user = verified.data.user ?? user;
      }
      setUser(user);
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const refresh = () => void getOfflineSyncStatus().then(setSyncStatus);
    refresh();
    return subscribeOfflineStatus(refresh);
  }, []);

  const hardSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const status = await hardSyncOfflineBookings();
      invalidateBookingListCache();
      clearCalendarViewCache();
      clearBookingHistoryCache();
      setSyncStatus(status);
      setSyncMessage(`${status.bookingCount} bookings saved for offline viewing.`);
    } catch (error) {
      setSyncMessage(
        error instanceof Error ? error.message : "Unable to sync offline data."
      );
    } finally {
      setSyncing(false);
    }
  };

  const signOut = async () => {
    await clearOfflineDataForCurrentUser();
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  const showReportsAndAudits = canSeeReportsAndAudits(
    user.user_metadata?.display_name
  );

  return (
    <div className="flex flex-col gap-5 !select-none laptop-up:px-10">
      <div className="flex items-center h-[72px]">
        <h1 className="text-lg font-bold leading-6 w-full text-center">
          Settings
        </h1>
        <span
          className="material-symbols-filled text-2xl cursor-pointer"
          onClick={signOut}
        >
          logout
        </span>
      </div>
      <div className="flex flex-col ">
        <div className="flex flex-col ">
          <h3 className="subheading !my-0">Username </h3>
          <h3 className="label_text text-link !my-0">
            {user.user_metadata.display_name}
          </h3>
          <hr className="!my-4 !border-[#BEBEBE]" />
        </div>
        <div className="flex flex-col ">
          <h3 className="subheading !my-0">Phone Number </h3>
          <h3 className="label_text text-link !my-0">{user.phone}</h3>
          <hr className="!my-4 !border-[#BEBEBE]" />
        </div>
        {showReportsAndAudits ? (
          <>
            <LoadingButton
              className=" border-[1px] border-typo_light-200  text-typo_light-200  w-full py-2 px-4 rounded-lg mb-4"
              onClick={() => router.push("/protected/reports")}
            >
              <span className={` material-symbols-outlined text-typo_light-200 `}>
                auto_graph
              </span>

              <span>Reports</span>
            </LoadingButton>
            <LoadingButton
              className="mb-4 w-full rounded-lg border-[1px] border-typo_light-200 px-4 py-2 text-typo_light-200"
              onClick={() => router.push("/protected/reports/employees")}
            >
              <span className="material-symbols-outlined text-typo_light-200">
                groups
              </span>
              <span>Employee Reports</span>
            </LoadingButton>
            <LoadingButton
              className="mb-4 w-full rounded-lg border-[1px] border-selectedButton px-4 py-2 text-selectedButton"
              onClick={() =>
                router.push("/protected/settings/check-in-audit")
              }
            >
              <span className="material-symbols-outlined text-selectedButton">
                fact_check
              </span>
              <span>Check-in audit</span>
            </LoadingButton>
            <LoadingButton
              className="border-[1px] border-error text-error w-full py-2 px-4 rounded-lg mb-4"
              onClick={() => router.push("/protected/settings/double-bookings")}
            >
              <span className="material-symbols-outlined text-error">
                event_busy
              </span>
              <span>Double bookings</span>
            </LoadingButton>
          </>
        ) : null}
        <div className="mb-4 rounded-lg border border-typo_light-100 p-3">
          <div className="mb-3">
            <h3 className="subheading !my-0">Offline data</h3>
            <p className="mt-1 text-xs text-typo_light-200">
              Save the latest bookings on this device for viewing without internet.
            </p>
            <p className="mt-1 text-xs text-typo_light-200">
              {syncStatus.lastSyncedAt
                ? `${syncStatus.bookingCount} bookings · Last synced ${new Date(
                    syncStatus.lastSyncedAt
                  ).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}`
                : "Not synced on this device yet"}
            </p>
            {syncMessage ? (
              <p className="mt-2 text-xs text-typo_dark-200">{syncMessage}</p>
            ) : null}
          </div>
          <LoadingButton
            className="w-full rounded-lg border border-selectedButton px-4 py-2 text-selectedButton"
            onClick={() => void hardSync()}
            loading={syncing}
          >
            <span className="material-symbols-outlined text-selectedButton">
              sync
            </span>
            <span>Hard sync offline data</span>
          </LoadingButton>
        </div>
        <LoadingButton
          className=" border-[1px] border-error text-error w-full py-2 px-4 rounded-lg"
          onClick={signOut}
        >
          Logout
        </LoadingButton>
      </div>
    </div>
  );
}
