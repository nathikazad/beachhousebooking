export type BookingListKind = "bookings" | "logs";
export type ListViewMode = "cell" | "table";

const VIEW_CHANGE_EVENT = "beachhousebooking:list-view-change";

export function listViewPreferenceKey(list: BookingListKind): string {
  return `beachhousebooking:${list}:view`;
}

export function normalizeListViewMode(value: string | null): ListViewMode {
  return value === "table" ? "table" : "cell";
}

export function readListViewPreference(list: BookingListKind): ListViewMode {
  if (typeof window === "undefined") return "cell";
  return normalizeListViewMode(
    window.localStorage.getItem(listViewPreferenceKey(list))
  );
}

export function writeListViewPreference(
  list: BookingListKind,
  mode: ListViewMode
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(listViewPreferenceKey(list), mode);
  window.dispatchEvent(
    new CustomEvent(VIEW_CHANGE_EVENT, { detail: { list, mode } })
  );
}

export function subscribeToListViewPreference(
  list: BookingListKind,
  onChange: (mode: ListViewMode) => void
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handleChange = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.list === list) onChange(normalizeListViewMode(detail.mode));
  };
  window.addEventListener(VIEW_CHANGE_EVENT, handleChange);
  return () => window.removeEventListener(VIEW_CHANGE_EVENT, handleChange);
}
