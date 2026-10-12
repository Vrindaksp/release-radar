"use client";

import { Archive, Radar, Siren, type LucideIcon } from "lucide-react";
import type { FeedbackInput, Release, TriageColumn } from "@/lib/types";
import ReleaseCard from "./ReleaseCard";

interface ColumnMeta {
  column: TriageColumn;
  subtitle: string;
  empty: string;
  icon: LucideIcon;
  bar: string;
  iconStyle: string;
  count: string;
}

const COLUMNS: ColumnMeta[] = [
  {
    column: "Immediate Triage",
    subtitle: "Security patches & breaking updates that need action now",
    empty: "Nothing urgent — no security fixes or breaking changes waiting.",
    icon: Siren,
    bar: "bg-gradient-to-r from-red-500/80 via-orange-500/50 to-transparent",
    iconStyle: "bg-red-500/15 text-red-300 ring-red-400/25",
    count: "bg-red-500/20 text-red-200 ring-red-400/30",
  },
  {
    column: "Watchlist Radar",
    subtitle: "Evaluation cadence & routine new releases",
    empty: "No routine releases on the radar this week.",
    icon: Radar,
    bar: "bg-gradient-to-r from-sky-500/80 via-indigo-500/50 to-transparent",
    iconStyle: "bg-sky-500/15 text-sky-300 ring-sky-400/25",
    count: "bg-sky-500/20 text-sky-200 ring-sky-400/30",
  },
  {
    column: "Archived / Cleaned",
    subtitle: "Processed, dismissed, or noise filtered by Gemini",
    empty: "Archived and auto-cleaned releases will show up here.",
    icon: Archive,
    bar: "bg-gradient-to-r from-zinc-500/70 via-zinc-600/40 to-transparent",
    iconStyle: "bg-zinc-500/15 text-zinc-300 ring-white/10",
    count: "bg-zinc-500/20 text-zinc-200 ring-white/15",
  },
];

/** Most urgent first: security, then breaking, then critical-path tier, then newest. */
function compareReleases(a: Release, b: Release): number {
  return (
    Number(b.isSecurityFix) - Number(a.isSecurityFix) ||
    Number(b.isBreakingChange) - Number(a.isBreakingChange) ||
    a.tier - b.tier ||
    Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  );
}

interface BoardProps {
  releases: Release[];
  filtering: boolean;
  onMove: (release: Release, column: TriageColumn) => void;
  onFeedback: (release: Release, input: Omit<FeedbackInput, "releaseId">) => Promise<void>;
  onNotify: (kind: "success" | "error", message: string) => void;
}

export default function Board({ releases, filtering, onMove, onFeedback, onNotify }: BoardProps) {
  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-3">
      {COLUMNS.map((meta) => {
        const items = releases.filter((release) => release.triageColumn === meta.column).sort(compareReleases);
        const Icon = meta.icon;
        return (
          <section
            key={meta.column}
            aria-label={meta.column}
            className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-zinc-900/40 ring-1 ring-white/10"
          >
            <div className={`h-0.5 shrink-0 ${meta.bar}`} aria-hidden />
            <header className="flex shrink-0 items-start gap-3 px-4 pt-3.5 pb-2.5">
              <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${meta.iconStyle}`}>
                <Icon className="size-4.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-100">
                  {meta.column}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ${meta.count}`}
                    aria-label={`${items.length} items`}
                  >
                    {items.length}
                  </span>
                </h2>
                <p className="text-xs text-zinc-400">{meta.subtitle}</p>
              </div>
            </header>

            <div className="thin-scroll min-h-0 flex-1 space-y-3 px-3 pt-1 pb-3 lg:overflow-y-auto">
              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-400">
                  {filtering ? "No releases match the current search / filter." : meta.empty}
                </p>
              ) : (
                items.map((release) => (
                  <ReleaseCard
                    key={release.id}
                    release={release}
                    onMove={onMove}
                    onFeedback={onFeedback}
                    onNotify={onNotify}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
