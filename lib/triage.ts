import type { EffortScore, Release, Tier, TriageColumn } from "./types";

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

const TIER_REASON: Record<Tier, string> = {
  1: "Tier 1 critical-path dependency",
  2: "Tier 2 evaluation / watch",
  3: "Tier 3 low priority",
};

/**
 * One plain-language line saying why a release is where it is, built only from the stored
 * classification (nothing is guessed): "Critical-severity security fix · high impact · Tier 1 ...".
 */
export function whyHere(
  release: Pick<
    Release,
    "isSecurityFix" | "securitySeverity" | "securityImpact" | "isBreakingChange" | "isNoise" | "tier"
  >,
): string {
  const facts: string[] = [];
  if (release.isSecurityFix) {
    const severity = release.securitySeverity;
    facts.push(severity === "none" ? "Security fix" : `${severity[0].toUpperCase()}${severity.slice(1)}-severity security fix`);
    facts.push(`${release.securityImpact.toLowerCase()} impact`);
  }
  if (release.isBreakingChange) facts.push(release.isSecurityFix ? "also a breaking change" : "Breaking change");
  if (facts.length === 0) facts.push(release.isNoise ? "Routine release, filtered as noise" : "Routine release");
  facts.push(TIER_REASON[release.tier]);
  return facts.join(" · ");
}

/** "Medium" is stored in full; the UI pill shows the compact "Med". */
export function effortLabel(effort: EffortScore): string {
  return effort === "Medium" ? "Med" : effort;
}
