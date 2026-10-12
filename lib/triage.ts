import type { EffortScore, TriageColumn } from "./types";

/**
 * Where a freshly analysed release lands on the board:
 *   security fix / breaking change → Immediate Triage
 *   pure routine noise              → Archived / Cleaned
 *   everything else                 → Watchlist Radar
 */
export function defaultColumnFor(flags: {
  isSecurityFix: boolean;
  isBreakingChange: boolean;
  isNoise: boolean;
}): TriageColumn {
  if (flags.isSecurityFix || flags.isBreakingChange) return "Immediate Triage";
  if (flags.isNoise) return "Archived / Cleaned";
  return "Watchlist Radar";
}

/** Where "Restore" sends an archived card. */
export function restoreColumnFor(defaultColumn: TriageColumn): TriageColumn {
  return defaultColumn === "Archived / Cleaned" ? "Watchlist Radar" : defaultColumn;
}

/** "Medium" is stored in full; the UI pill shows the compact "Med". */
export function effortLabel(effort: EffortScore): string {
  return effort === "Medium" ? "Med" : effort;
}
