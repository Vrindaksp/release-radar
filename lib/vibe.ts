import type { DigestSummary } from "./digest";

/** How the digest feels right now. Drives the headline, the sticker and the colour of the page glow. */
export type Vibe = "calm" | "busy" | "sus" | "fire";

export interface VibeInfo {
  vibe: Vibe;
  /** A big sticker next to the headline. */
  emoji: string;
  headline: string;
  sub: string;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Worst thing first: an emergency beats a security fix, which beats a pile of breaking changes,
 * which beats nothing. Pure, so the mood is easy to test and never depends on the UI.
 */
export function vibeFor(summary: Pick<DigestSummary, "urgent" | "security" | "emergencies">): VibeInfo {
  if (summary.emergencies > 0) {
    return {
      vibe: "fire",
      emoji: "💀",
      headline: "Patch now. No cap.",
      sub: `${count(summary.emergencies, "critical fix", "critical fixes")} can't wait for Monday.`,
    };
  }
  if (summary.security > 0) {
    return {
      vibe: "sus",
      emoji: "🚨",
      headline: "Okay, this is a bit sus.",
      sub: `${count(summary.security, "security fix", "security fixes")} waiting on you.`,
    };
  }
  if (summary.urgent > 0) {
    return {
      vibe: "busy",
      emoji: "🫠",
      headline: "Lowkey busy.",
      sub: `${count(summary.urgent, "thing", "things")} to look at. Nothing scary.`,
    };
  }
  return {
    vibe: "calm",
    emoji: "✨",
    headline: "Immaculate vibes.",
    sub: "Nothing's on fire. Go touch grass.",
  };
}
