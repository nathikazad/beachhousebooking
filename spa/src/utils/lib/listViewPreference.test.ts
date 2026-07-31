import { describe, expect, it } from "vitest";
import {
  listViewPreferenceKey,
  normalizeListViewMode,
} from "./listViewPreference";

describe("list view preference", () => {
  it("uses separate persistent keys for bookings and logs", () => {
    expect(listViewPreferenceKey("bookings")).not.toBe(
      listViewPreferenceKey("logs")
    );
  });

  it("accepts table and safely defaults all other values to cell", () => {
    expect(normalizeListViewMode("table")).toBe("table");
    expect(normalizeListViewMode("cell")).toBe("cell");
    expect(normalizeListViewMode("unknown")).toBe("cell");
    expect(normalizeListViewMode(null)).toBe("cell");
  });
});
