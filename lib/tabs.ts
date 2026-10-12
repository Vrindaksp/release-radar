import { TRIAGE_COLUMNS, type Release, type TriageColumn } from "./types";

/** The three board columns are shown as tabs; each has a short, URL-friendly slug. */
export const TAB_SLUGS: Record<TriageColumn, string> = {
  "Immediate Triage": "immediate",
  "Watchlist Radar": "watchlist",
  "Archived / Cleaned": "archive",
};

export const DEFAULT_TAB: TriageColumn = "Immediate Triage";

/** "#watchlist" → "Watchlist Radar"; null for anything that isn't a tab. */
export function tabFromHash(hash: string): TriageColumn | null {
  const slug = hash.replace(/^#/, "").trim().toLowerCase();
  return TRIAGE_COLUMNS.find((column) => TAB_SLUGS[column] === slug) ?? null;
}

export const hashForTab = (tab: TriageColumn) => `#${TAB_SLUGS[tab]}`;

/** How many of the given releases sit in each tab. */
export function countByColumn(releases: Pick<Release, "triageColumn">[]): Record<TriageColumn, number> {
  const counts = Object.fromEntries(TRIAGE_COLUMNS.map((column) => [column, 0])) as Record<TriageColumn, number>;
  for (const release of releases) counts[release.triageColumn] += 1;
  return counts;
}
