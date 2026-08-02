import { describe, expect, it } from "vitest";
import { canSeeReportsAndAudits } from "./restrictedSettings";

describe("restricted settings visibility", () => {
  it.each(["Nishtar", "Rafica", " rafica "])(
    "shows reports and audits to %s",
    (displayName) => {
      expect(canSeeReportsAndAudits(displayName)).toBe(true);
    }
  );

  it.each(["Indhu", "Thejas", "Yasmeen", undefined, null])(
    "hides reports and audits from %s",
    (displayName) => {
      expect(canSeeReportsAndAudits(displayName)).toBe(false);
    }
  );
});
