"use client";

import { useMemo } from "react";
import { ArrowUpRight, CalendarClock, CircleHelp, FolderGit2, History, Layers, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";
import { nextScheduledSync, type DigestSummary } from "@/lib/digest";
import { timeAgo } from "@/lib/format";
import type { DigestFilter, TriageColumn } from "@/lib/types";
import type { VibeInfo } from "@/lib/vibe";
import { useCountUp } from "./useCountUp";
import { btnPrimary, focusRing } from "./ui";

interface VibeCheckProps {
  summary: DigestSummary;
  vibe: VibeInfo;
  reposMonitored: number;
  lastSyncedAt: string | null;
  /** Active repositories whose last sync failed. */
  failingRepos: number;
  filter: DigestFilter;
  /** A security / breaking chip: show only those, in Immediate Triage. */
  onFilter: (filter: DigestFilter) => void;
  onOpenTab: (tab: TriageColumn) => void;
  onOpenRepos: () => void;
  onOpenAbout: () => void;
  onStartDeck: () => void;
}

const runTime = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The top of the page: one big, human sentence about how the digest feels right now (and a button
 * that turns the urgent list into a swipeable deck), three tiles that open each list, and the
 * health of the pipeline behind it.
 */
export default function VibeCheck({
  summary,
  vibe,
  reposMonitored,
  lastSyncedAt,
  failingRepos,
  filter,
  onFilter,
  onOpenTab,
  onOpenRepos,
  onOpenAbout,
  onStartDeck,
}: VibeCheckProps) {
  const next = useMemo(() => nextScheduledSync(), []);
  const { urgent, watching, security, breaking, newThisWeek, carriedOver, releasesThisWeek, noiseThisWeek } = summary;

  return (
    <section aria-label="Vibe check" className="mx-auto mb-6 grid w-full max-w-6xl gap-3 lg:grid-cols-[1.7fr_1fr]">
      <div data-tour="vibe" className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 p-5 sm:p-7">
        {/* The mood, as light: its colour follows data-vibe on <html>. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-16 size-80 rounded-full blur-3xl"
          style={{ background: "rgb(var(--ar) var(--ag) var(--ab) / 0.26)" }}
        />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-xs font-bold tracking-[0.22em] text-zinc-400 uppercase">Vibe check</p>
            <button
              type="button"
              onClick={onOpenAbout}
              aria-label="How it works"
              className={`inline-flex shrink-0 items-center gap-1 rounded text-xs font-medium whitespace-nowrap text-zinc-400 transition-colors hover:text-zinc-100 ${focusRing}`}
            >
              <CircleHelp className="size-3.5" aria-hidden />
              <span className="sm:hidden">Help</span>
              <span className="hidden sm:inline">How it works</span>
            </button>
          </div>

          <div className="mt-4 flex items-start gap-4 sm:gap-5">
            <span aria-hidden className="animate-wiggle text-5xl leading-none select-none sm:text-7xl">
              {vibe.emoji}
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-3xl leading-[1.04] font-extrabold tracking-tight text-zinc-50 sm:text-5xl">{vibe.headline}</h2>
              <p className="mt-2 text-sm text-zinc-300 sm:text-base">{vibe.sub}</p>
            </div>
          </div>

          {(security > 0 || breaking > 0) && (
            <div className="mt-5 flex flex-wrap gap-2">
              {security > 0 && (
                <Chip tone="hot" pressed={filter === "security"} onClick={() => onFilter(filter === "security" ? "all" : "security")}>
                  {security} security
                </Chip>
              )}
              {breaking > 0 && (
                <Chip tone="amber" pressed={filter === "breaking"} onClick={() => onFilter(filter === "breaking" ? "all" : "breaking")}>
                  {breaking} breaking
                </Chip>
              )}
            </div>
          )}

          {urgent > 0 && (
            <div data-tour="swipe" className="mt-6">
              <button type="button" onClick={onStartDeck} className={`${btnPrimary} h-12 px-6 text-base`}>
                <Layers className="size-5" aria-hidden />
                Start swiping
                <span className="rounded-md bg-zinc-950/15 px-1.5 py-0.5 text-sm tabular-nums">{urgent}</span>
              </button>
              <p className="mt-2 text-xs text-zinc-400">
                Clear the urgent list like a deck of cards. Press <kbd className="rounded border border-white/15 bg-zinc-800 px-1 font-mono text-[11px] text-zinc-200">S</kbd>
              </p>
            </div>
          )}
        </div>
      </div>

      <div data-tour="tiles" className="grid grid-cols-3 gap-3 lg:grid-cols-1">
        <StatTile tone="hot" label="Needs action" value={urgent} onClick={() => onOpenTab("Immediate Triage")} />
        <StatTile tone="ice" label="Watching" value={watching} onClick={() => onOpenTab("Watchlist Radar")} />
        <StatTile
          tone="zinc"
          label="Noise this week"
          title="Routine releases from the last 7 days that Gemini filtered out. They sit in the Archive, nothing is deleted."
          value={noiseThisWeek}
          onClick={() => onOpenTab("Archived / Cleaned")}
        />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-white/10 bg-zinc-900/40 px-5 py-4 text-xs text-zinc-400 sm:grid-cols-4 lg:col-span-2">
        <Fact icon={FolderGit2} label="Tracking">
          {plural(reposMonitored, "repo")} · {plural(releasesThisWeek, "release")} this week
        </Fact>
        <Fact icon={RefreshCw} label="Last sync">
          {lastSyncedAt ? timeAgo(lastSyncedAt) : "not yet"}
        </Fact>
        <Fact icon={CalendarClock} label="Next auto-sync">
          {runTime.format(next)}
        </Fact>
        {carriedOver > 0 ? (
          <Fact
            icon={History}
            label="Carried over"
            title="Urgent releases stay in Immediate Triage until you act on them, so a security fix never ages out of the list."
          >
            {carriedOver} of {urgent} urgent {carriedOver === 1 ? "is" : "are"} from earlier weeks
            {newThisWeek > 0 ? ` (${newThisWeek} new)` : ""}
          </Fact>
        ) : (
          <Fact icon={History} label="Carried over">
            nothing old is lingering
          </Fact>
        )}
        {failingRepos > 0 && (
          <div className="col-span-2 sm:col-span-4">
            <button
              type="button"
              onClick={onOpenRepos}
              className={`inline-flex items-center gap-1.5 rounded font-semibold text-amber-300 underline decoration-amber-300/40 underline-offset-2 transition-colors hover:text-amber-200 ${focusRing}`}
            >
              <TriangleAlert className="size-3.5" aria-hidden />
              {plural(failingRepos, "repo")} couldn&apos;t be checked
            </button>
          </div>
        )}
      </dl>
    </section>
  );
}

const TILE_TONES = {
  hot: "border-hot/35 bg-gradient-to-br from-hot/25 via-hot/5 to-zinc-900/60 text-pink-50",
  ice: "border-ice/30 bg-gradient-to-br from-ice/20 via-ice/5 to-zinc-900/60 text-cyan-50",
  zinc: "border-white/10 bg-zinc-900/60 text-zinc-100",
};

/** A big number that opens its list. */
function StatTile({
  tone,
  label,
  value,
  title,
  onClick,
}: {
  tone: keyof typeof TILE_TONES;
  label: string;
  value: number;
  title?: string;
  onClick: () => void;
}) {
  const shown = useCountUp(value);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={`${value} ${label}. Open the list.`}
      className={`group relative flex flex-col items-start gap-1 overflow-hidden rounded-3xl border p-4 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] lg:flex-row lg:items-center lg:gap-4 ${focusRing} ${TILE_TONES[tone]}`}
    >
      <span aria-hidden className="font-display text-4xl leading-none font-extrabold tabular-nums sm:text-5xl lg:min-w-[3.5rem]">
        {shown}
      </span>
      <span aria-hidden className="text-xs leading-tight font-semibold opacity-90 sm:text-sm">
        {label}
      </span>
      <ArrowUpRight
        className="absolute top-3 right-3 size-4 opacity-50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 lg:top-1/2 lg:-translate-y-1/2 lg:group-hover:-translate-y-[60%]"
        aria-hidden
      />
    </button>
  );
}

function Fact({ icon: Icon, label, title, children }: { icon: LucideIcon; label: string; title?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2" title={title}>
      <Icon className="mt-0.5 size-3.5 shrink-0 text-zinc-500" aria-hidden />
      <div>
        <dt className="text-[11px] tracking-wide text-zinc-400 uppercase">{label}</dt>
        <dd className="text-zinc-300">{children}</dd>
      </div>
    </div>
  );
}

const CHIP_TONES = {
  hot: { idle: "bg-hot/15 text-pink-100 ring-hot/40 hover:bg-hot/25", on: "bg-hot text-zinc-950 ring-white/70" },
  amber: { idle: "bg-amber-400/15 text-amber-100 ring-amber-300/40 hover:bg-amber-400/25", on: "bg-amber-400 text-zinc-950 ring-white/70" },
};

/** A count that doubles as a filter: press to show only those, press again to clear. */
function Chip({ tone, pressed, onClick, children }: { tone: keyof typeof CHIP_TONES; pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  const style = CHIP_TONES[tone];
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-bold ring-1 transition-all ring-inset active:scale-[0.96] ${focusRing} ${pressed ? style.on : style.idle}`}
    >
      {children}
    </button>
  );
}
