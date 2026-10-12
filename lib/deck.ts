import { compareReleases } from "./triage";
import type { Release, TriageColumn } from "./types";

/** What you can do with a card in swipe triage. */
export type DeckAction = "archive" | "watch" | "ticket";

export const DECK_ACTIONS: Record<DeckAction, { label: string; column: TriageColumn | null }> = {
  archive: { label: "Archive", column: "Archived / Cleaned" },
  watch: { label: "Watch", column: "Watchlist Radar" },
  // Copies a ticket and moves on; the release stays in Immediate Triage until it is dealt with.
  ticket: { label: "Ticket", column: null },
};

/** How far (px) a card has to travel before letting go commits to an action. */
export const SWIPE_THRESHOLD = 110;

/** The urgent list, most urgent first: what swipe triage deals out. */
export function deckQueue(releases: readonly Release[]): Release[] {
  return releases.filter((release) => release.triageColumn === "Immediate Triage").sort(compareReleases);
}

export interface Lean {
  action: DeckAction;
  /** 0 → just started dragging, 1 → far enough to commit. */
  strength: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Which action a drag is heading towards. Left archives, right watches, up copies a ticket; the
 * stronger axis wins, and dragging down does nothing.
 */
export function leaning(dx: number, dy: number, threshold = SWIPE_THRESHOLD): Lean | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (dy < 0 && ay > ax) return { action: "ticket", strength: clamp01(ay / threshold) };
  if (ax > 0 && ax >= ay) return { action: dx < 0 ? "archive" : "watch", strength: clamp01(ax / threshold) };
  return null;
}

/** The action committed by letting go at (dx, dy), or null if the card should spring back. */
export function actionForDrag(dx: number, dy: number, threshold = SWIPE_THRESHOLD): DeckAction | null {
  const lean = leaning(dx, dy, threshold);
  return lean && lean.strength >= 1 ? lean.action : null;
}

export type DeckTally = Record<DeckAction, number>;

export function tally(actions: readonly DeckAction[]): DeckTally {
  const result: DeckTally = { archive: 0, watch: 0, ticket: 0 };
  for (const action of actions) result[action]++;
  return result;
}
