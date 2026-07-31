import { useEffect, useState } from "react";
import {
  BookingListKind,
  ListViewMode,
  readListViewPreference,
  subscribeToListViewPreference,
  writeListViewPreference,
} from "./lib/listViewPreference";

export function useListViewPreference(
  list: BookingListKind
): [ListViewMode, (mode: ListViewMode) => void] {
  const [mode, setMode] = useState<ListViewMode>("cell");

  useEffect(() => {
    setMode(readListViewPreference(list));
    return subscribeToListViewPreference(list, setMode);
  }, [list]);

  const updateMode = (nextMode: ListViewMode) => {
    setMode(nextMode);
    writeListViewPreference(list, nextMode);
  };

  return [mode, updateMode];
}
