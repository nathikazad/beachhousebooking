import {
  getOfflineSyncStatus,
  subscribeOfflineStatus,
} from "@/utils/lib/offlineBookingStore";
import { useEffect, useState } from "react";

export default function OfflineStatus() {
  const [online, setOnline] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    const refresh = () => {
      setOnline(navigator.onLine);
      void getOfflineSyncStatus().then((status) =>
        setLastSyncedAt(status.lastSyncedAt)
      );
    };
    refresh();
    return subscribeOfflineStatus(refresh);
  }, []);

  if (online) return null;

  return (
    <div className="sticky top-0 z-40 bg-amber-100 px-3 py-2 text-center text-xs font-bold text-amber-900">
      Offline — showing saved data
      {lastSyncedAt
        ? ` from ${new Date(lastSyncedAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })}`
        : ""}
    </div>
  );
}
