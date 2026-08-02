const restrictedSettingsUsers = new Set(["nishtar", "rafica"]);

export function canSeeReportsAndAudits(
  displayName: string | null | undefined
): boolean {
  return restrictedSettingsUsers.has(displayName?.trim().toLowerCase() ?? "");
}
