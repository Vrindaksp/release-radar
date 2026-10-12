import { BellOff, BellRing, FlaskConical, ShieldAlert, Siren, TriangleAlert, Zap } from "lucide-react";
import { effortLabel } from "@/lib/triage";
import type { EffortScore, SecuritySeverity, Tier } from "@/lib/types";

/*
 * Informational badges use translucent tints with a thin inset ring. The two that mean "look at
 * this" (Security, Breaking) are stickers instead: solid, bold, black text, a hair off-level.
 */
const STICKER =
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold tracking-wide text-zinc-950 uppercase shadow-[0_2px_0_0_rgba(0,0,0,0.55)] transition-transform hover:rotate-0";

/** Monospace version chip, e.g. v2.4.1 */
export function VersionTag({ tag }: { tag: string }) {
  return (
    <span className="inline-flex max-w-full items-center truncate rounded-md bg-zinc-800 px-1.5 py-0.5 font-mono text-xs font-semibold text-zinc-100 ring-1 ring-white/10 ring-inset">
      {tag}
    </span>
  );
}

const EFFORT_STYLES: Record<EffortScore, { pill: string; dot: string }> = {
  Low: { pill: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25", dot: "bg-emerald-400" },
  Medium: { pill: "bg-amber-500/10 text-amber-300 ring-amber-400/25", dot: "bg-amber-400" },
  High: { pill: "bg-rose-500/10 text-rose-300 ring-rose-400/25", dot: "bg-rose-400" },
};

/** Effort Score pill: Low / Med / High. */
export function EffortPill({ effort }: { effort: EffortScore }) {
  const style = EFFORT_STYLES[effort];
  return (
    <span
      title={`Estimated effort to adopt: ${effort}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.pill}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden />
      <span className="text-[10px] font-semibold tracking-wide uppercase opacity-80">Effort</span>
      {effortLabel(effort)}
    </span>
  );
}

/** The worse the rating, the brighter the sticker: critical gets a white outline and a glow. */
const SEVERITY_STYLES: Record<SecuritySeverity, string> = {
  none: "bg-hot/80",
  low: "bg-hot/80",
  moderate: "bg-hot/90",
  high: "bg-hot",
  critical: "bg-hot ring-2 ring-white/80 shadow-[0_0_14px_rgba(255,92,151,0.7)]",
};

/** Security flag, with Gemini's severity rating alongside (e.g. "Security · critical"). */
export function SecurityBadge({ severity }: { severity: SecuritySeverity }) {
  return (
    <span
      title={severity === "none" ? "Security fix" : `Security fix — ${severity} severity`}
      className={`${STICKER} -rotate-1 ${SEVERITY_STYLES[severity]}`}
    >
      <ShieldAlert className="size-3" aria-hidden />
      Security
      {severity !== "none" && <span className="font-bold">· {severity}</span>}
    </span>
  );
}

/** Arrived through the GitHub webhook rather than the weekly poll. */
export function LiveBadge() {
  return (
    <span
      title="Received in real time through the GitHub webhook"
      className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-300 uppercase ring-1 ring-emerald-400/30 ring-inset"
    >
      <Zap className="size-3" aria-hidden />
      Live
    </span>
  );
}

/**
 * The emergency rule fired. Shows how far the alert got: delivered to an external
 * channel (email / Slack / ntfy), failed on a configured channel, or dashboard-only.
 */
export function EmergencyBadge({
  emergencyAt,
  escalatedAt,
  error,
}: {
  emergencyAt: string | null;
  escalatedAt: string | null;
  error: string | null;
}) {
  if (!emergencyAt && !escalatedAt && !error) return null;
  if (escalatedAt) {
    return (
      <span
        title={`Emergency alert delivered at ${new Date(escalatedAt).toLocaleString()}${error ? ` (another channel failed: ${error})` : ""}`}
        className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-rose-300 uppercase ring-1 ring-rose-400/30 ring-inset"
      >
        <BellRing className="size-3" aria-hidden />
        Alert sent
      </span>
    );
  }
  if (error) {
    return (
      <span
        title={`A configured alert channel did not deliver: ${error}`}
        className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-red-300 uppercase ring-1 ring-red-400/50 ring-inset"
      >
        <BellOff className="size-3" aria-hidden />
        Alert failed
      </span>
    );
  }
  return (
    <span
      title="Critical, high-impact security fix — flagged in the emergency banner (no email or push channel is switched on)"
      className="inline-flex items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase"
    >
      <Siren className="size-3" aria-hidden />
      Emergency
    </span>
  );
}

export function BreakingBadge() {
  return (
    <span className={`${STICKER} rotate-1 bg-amber-400`}>
      <TriangleAlert className="size-3" aria-hidden />
      Breaking
    </span>
  );
}

export function SampleBadge() {
  return (
    <span
      title="Fictional sample data from db/seed.json — not a real release"
      className="inline-flex items-center gap-1 rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-violet-300 uppercase ring-1 ring-violet-400/30 ring-inset"
    >
      <FlaskConical className="size-3" aria-hidden />
      Sample
    </span>
  );
}

const TIER_STYLES: Record<Tier, string> = {
  1: "bg-violet-500/20 text-violet-200 ring-violet-400/30",
  2: "bg-sky-500/15 text-sky-300 ring-sky-400/25",
  3: "bg-zinc-700/50 text-zinc-300 ring-white/10",
};

const TIER_TITLES: Record<Tier, string> = {
  1: "Tier 1 — critical-path dependency",
  2: "Tier 2 — evaluation / watch",
  3: "Tier 3 — low priority",
};

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span
      title={TIER_TITLES[tier]}
      className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ring-1 ring-inset ${TIER_STYLES[tier]}`}
    >
      T{tier}
    </span>
  );
}
