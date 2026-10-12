"use client";

import { useMemo } from "react";
import {
  CalendarClock,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  FolderGit2,
  History,
  RefreshCw,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { nextScheduledSync, summarizeDigest } from "@/lib/digest";
import { timeAgo } from "@/lib/format";
import type { DigestFilter, Release, TriageColumn } from "@/lib/types";
import { focusRing } from "./ui";

interface DigestSummaryProps {
  /** Every release in the digest, before search / filter. */
  releases: Release[];
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
}

const runTime = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * "Digest status": what is open right now as a donut (urgent vs. routine), a legend whose rows jump
 * to each list, and the health of the pipeline behind it (what was scanned, when it last and next syncs).
 */
export default function DigestSummary({
  releases,
  reposMonitored,
  lastSyncedAt,
  failingRepos,
  filter,
  onFilter,
  onOpenTab,
  onOpenRepos,
  onOpenAbout,
}: DigestSummaryProps) {
  const summary = useMemo(() => summarizeDigest(releases), [releases]);
  const next = useMemo(() => nextScheduledSync(), []);
  const { urgent, watching, security, breaking, newThisWeek, carriedOver, releasesThisWeek, noiseThisWeek } = summary;

  return (
    <section
      aria-label="Digest status"
      className="mx-auto mb-6 w-full max-w-6xl rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/[0.09] via-zinc-900/70 to-zinc-900/70 p-5 shadow-lg shadow-black/20 sm:p-6"
    >
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-5 sm:gap-x-8 lg:grid-cols-[auto_1fr_17rem]">
        <Donut urgent={urgent} watching={watching} />

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold whitespace-nowrap text-zinc-100">Open right now</h2>
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
          <ul className="mt-2 space-y-1">
            <li>
              <LegendRow dot="bg-red-400" label="Needs action" count={urgent} onClick={() => onOpenTab("Immediate Triage")} />
              {(security > 0 || breaking > 0) && (
                <div className="flex flex-wrap gap-2 pt-1 pb-2 pl-7">
                  {security > 0 && (
                    <Chip tone="red" pressed={filter === "security"} onClick={() => onFilter(filter === "security" ? "all" : "security")}>
                      {security} security
                    </Chip>
                  )}
                  {breaking > 0 && (
                    <Chip tone="orange" pressed={filter === "breaking"} onClick={() => onFilter(filter === "breaking" ? "all" : "breaking")}>
                      {breaking} breaking
                    </Chip>
                  )}
                </div>
              )}
            </li>
            <li>
              <LegendRow dot="bg-sky-400" label="Watching" count={watching} onClick={() => onOpenTab("Watchlist Radar")} />
            </li>
            <li>
              <LegendRow
                dot="bg-zinc-500"
                label="Noise this week"
                count={noiseThisWeek}
                title="Routine releases from the last 7 days that Gemini filtered out. They sit in the Archive, nothing is deleted."
                onClick={() => onOpenTab("Archived / Cleaned")}
              />
            </li>
          </ul>
        </div>

        <dl className="col-span-2 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-4 text-xs text-zinc-400 sm:grid-cols-4 lg:col-span-1 lg:grid-cols-1 lg:gap-y-2.5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <Fact icon={FolderGit2} label="Tracking">
            {plural(reposMonitored, "repo")} · {plural(releasesThisWeek, "release")} this week
          </Fact>
          <Fact icon={RefreshCw} label="Last sync">
            {lastSyncedAt ? timeAgo(lastSyncedAt) : "not yet"}
          </Fact>
          <Fact icon={CalendarClock} label="Next auto-sync">
            {runTime.format(next)}
          </Fact>
          {carriedOver > 0 && (
            <Fact
              icon={History}
              label="Carried over"
              title="Urgent releases stay in Immediate Triage until you act on them, so a security fix never ages out of the list."
            >
              {carriedOver} of {urgent} urgent {carriedOver === 1 ? "is" : "are"} from earlier weeks
              {newThisWeek > 0 ? ` (${newThisWeek} new)` : ""}
            </Fact>
          )}
          {failingRepos > 0 && (
            <div>
              <button
                type="button"
                onClick={onOpenRepos}
                className={`inline-flex items-center gap-1.5 rounded font-medium text-amber-300 underline decoration-amber-300/40 underline-offset-2 transition-colors hover:text-amber-200 ${focusRing}`}
              >
                <TriangleAlert className="size-3.5" aria-hidden />
                {plural(failingRepos, "repo")} couldn&apos;t be checked
              </button>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}

/** One row of the legend: a coloured dot, the label, the count; the whole row opens that list. */
function LegendRow({
  dot,
  label,
  count,
  title,
  onClick,
}: {
  dot: string;
  label: string;
  count: number;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5 sm:gap-3 ${focusRing}`}
    >
      <span className={`size-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm text-zinc-300 group-hover:text-zinc-100">{label}</span>
      <span className="text-sm font-semibold text-zinc-50 tabular-nums">{count}</span>
      <ChevronRight className="hidden size-4 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-300 sm:block" aria-hidden />
    </button>
  );
}

function Fact({
  icon: Icon,
  label,
  title,
  children,
}: {
  icon: LucideIcon;
  label: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2" title={title}>
      <Icon className="mt-0.5 size-3.5 shrink-0 text-zinc-500" aria-hidden />
      <div>
        <dt className="text-[11px] tracking-wide text-zinc-500 uppercase">{label}</dt>
        <dd className="text-zinc-300">{children}</dd>
      </div>
    </div>
  );
}

const CHIP_TONES = {
  red: { idle: "bg-red-500/10 text-red-200 ring-red-400/30 hover:bg-red-500/20", on: "bg-red-500/25 text-red-100 ring-red-300/60" },
  orange: { idle: "bg-orange-500/10 text-orange-200 ring-orange-400/30 hover:bg-orange-500/20", on: "bg-orange-500/25 text-orange-100 ring-orange-300/60" },
};

/** A count that doubles as a filter: press to show only those, press again to clear. */
function Chip({
  tone,
  pressed,
  onClick,
  children,
}: {
  tone: keyof typeof CHIP_TONES;
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const style = CHIP_TONES[tone];
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-md px-2 py-0.5 text-xs font-semibold ring-1 transition-colors ring-inset ${focusRing} ${pressed ? style.on : style.idle}`}
    >
      {children}
    </button>
  );
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Open releases as a ring: urgent (red) and routine (blue). The centre says how many need action. */
function Donut({ urgent, watching }: { urgent: number; watching: number }) {
  const total = urgent + watching;
  const urgentLength = total ? (urgent / total) * CIRCUMFERENCE : 0;
  const watchingLength = total ? (watching / total) * CIRCUMFERENCE : 0;
  const gap = urgent > 0 && watching > 0 ? 2.5 : 0; // a hair of space between the two arcs
  const arc = (length: number, offset: number, colour: string) => (
    <circle
      cx="50"
      cy="50"
      r={RADIUS}
      fill="none"
      strokeWidth="9"
      className={colour}
      strokeDasharray={`${Math.max(length - gap, 0)} ${CIRCUMFERENCE}`}
      strokeDashoffset={-offset}
    />
  );
  return (
    <div
      role="img"
      aria-label={`${urgent} of ${total} open releases need action`}
      className="relative size-28 shrink-0 sm:size-40"
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="9" className="stroke-zinc-800" />
        {watching > 0 && arc(watchingLength, urgentLength, "stroke-sky-400")}
        {urgent > 0 && arc(urgentLength, 0, "stroke-red-400")}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {urgent > 0 ? (
          <>
            <span className="text-4xl leading-none font-semibold text-zinc-50 tabular-nums sm:text-5xl">{urgent}</span>
            <span className="mt-1 text-[10px] font-medium tracking-wider text-zinc-400 uppercase sm:text-[11px]">
              <span className="sm:hidden">urgent</span>
              <span className="hidden sm:inline">need action</span>
            </span>
          </>
        ) : (
          <>
            <CircleCheck className="size-7 text-emerald-400 sm:size-8" aria-hidden />
            <span className="mt-1 text-[10px] font-medium tracking-wider text-zinc-400 uppercase sm:text-[11px]">all clear</span>
          </>
        )}
      </div>
    </div>
  );
}
