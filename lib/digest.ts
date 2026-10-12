import type { Release } from "./types";

/** The "this week" window the status panel talks about. */
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The weekly cron in vercel.json ("0 12 * * 1"): Mondays, 12:00 UTC. */
export const SYNC_WEEKDAY_UTC = 1;
export const SYNC_HOUR_UTC = 12;

export interface DigestSummary {
  /** Waiting in Immediate Triage: security fixes and breaking changes that need action. */
  urgent: number;
  /** Waiting in Watchlist Radar: routine releases to keep an eye on. */
  watching: number;
  /** Of the urgent list, how many are security fixes / breaking changes (a card can be both). */
  security: number;
  breaking: number;
  /** Urgent items published this week vs. earlier. Urgent items never age out of the list. */
  newThisWeek: number;
  carriedOver: number;
  /** Releases published in the last 7 days, whatever list they sit in. */
  releasesThisWeek: number;
  /** Of those, how many Gemini judged to be routine noise (kept in the Archive, never deleted). */
  noiseThisWeek: number;
}

/**
 * Numbers behind the status panel. "Urgent" is state, not a time window: a release stays in
 * Immediate Triage until someone acts on it, so a security fix from three weeks ago still counts,
 * and is reported separately as carried over.
 */
export function summarizeDigest(releases: readonly Release[], now = Date.now()): DigestSummary {
  const since = now - WEEK_MS;
  const inWindow = (release: Release) => Date.parse(release.publishedAt) >= since;
  const urgent = releases.filter((release) => release.triageColumn === "Immediate Triage");
  const recent = releases.filter(inWindow);
  return {
    urgent: urgent.length,
    watching: releases.filter((release) => release.triageColumn === "Watchlist Radar").length,
    security: urgent.filter((release) => release.isSecurityFix).length,
    breaking: urgent.filter((release) => release.isBreakingChange).length,
    newThisWeek: urgent.filter(inWindow).length,
    carriedOver: urgent.filter((release) => !inWindow(release)).length,
    releasesThisWeek: recent.length,
    noiseThisWeek: recent.filter((release) => release.isNoise).length,
  };
}

/** The next time the weekly cron runs, strictly after `now`. */
export function nextScheduledSync(now = Date.now()): Date {
  const today = new Date(now);
  const todayRun = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), SYNC_HOUR_UTC);
  const daysAhead = (SYNC_WEEKDAY_UTC - today.getUTCDay() + 7) % 7;
  let next = todayRun + daysAhead * 86_400_000;
  if (next <= now) next += WEEK_MS;
  return new Date(next);
}
