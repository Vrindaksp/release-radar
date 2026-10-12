"use client";

import { useState } from "react";
import { TAB_SLUGS } from "@/lib/tabs";
import { TRIAGE_COLUMNS, type FeedbackInput, type Release, type TriageColumn } from "@/lib/types";
import ReleaseCard from "./ReleaseCard";
import { TAB_META } from "./Tabs";
import { btnSecondary } from "./ui";

const PAGE_SIZE = 30;

const COPY: Record<TriageColumn, { subtitle: string; empty: string }> = {
  "Immediate Triage": {
    subtitle: "Security patches & breaking updates that need action now",
    empty: "Nothing urgent — no security fixes or breaking changes waiting.",
  },
  "Watchlist Radar": {
    subtitle: "Evaluation cadence & routine new releases",
    empty: "No routine releases on the radar this week.",
  },
  "Archived / Cleaned": {
    subtitle: "Processed, dismissed, or noise filtered by Gemini — plus backfilled history",
    empty: "Archived and auto-cleaned releases will show up here.",
  },
};

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
  /** The tab being shown. */
  tab: TriageColumn;
  /** Releases after search / filter, across all tabs. */
  releases: Release[];
  counts: Record<TriageColumn, number>;
  filtering: boolean;
  onTabChange: (tab: TriageColumn) => void;
  onMove: (release: Release, column: TriageColumn) => void;
  onFeedback: (release: Release, input: Omit<FeedbackInput, "releaseId">) => Promise<void>;
  onNotify: (kind: "success" | "error", message: string) => void;
}

/** The panel for the active tab: one comfortable, two-column-on-desktop list of cards. */
export default function Board({ tab, releases, counts, filtering, onTabChange, onMove, onFeedback, onNotify }: BoardProps) {
  const items = releases.filter((release) => release.triageColumn === tab).sort(compareReleases);
  const meta = TAB_META[tab];
  const Icon = meta.icon;
  // When a search / filter leaves this tab empty (or short), point at where the matches are.
  const elsewhere = TRIAGE_COLUMNS.filter((column) => column !== tab && counts[column] > 0);

  return (
    <div role="tabpanel" id="board-panel" aria-labelledby={`tab-${TAB_SLUGS[tab]}`} className="mx-auto w-full max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-2.5">
          <Icon className="size-4 text-zinc-400" aria-hidden />
          <h2 className="text-base font-semibold text-zinc-100">{tab}</h2>
        </div>
        <p className="text-sm text-zinc-400">{COPY[tab].subtitle}</p>
      </div>

      {filtering && elsewhere.length > 0 && items.length > 0 && (
        <p className="-mt-2 mb-4 text-xs text-zinc-400">
          Also matching in{" "}
          {elsewhere.map((column, index) => (
            <span key={column}>
              {index > 0 && ", "}
              <button type="button" onClick={() => onTabChange(column)} className="font-medium text-indigo-300 underline-offset-2 hover:underline">
                {column} ({counts[column]})
              </button>
            </span>
          ))}
        </p>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
          <p className="text-sm text-zinc-300">{filtering ? "No releases match the current search / filter here." : COPY[tab].empty}</p>
          {filtering && elsewhere.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {elsewhere.map((column) => (
                <button key={column} type="button" onClick={() => onTabChange(column)} className={`${btnSecondary} h-8 px-3 text-xs`}>
                  {counts[column]} in {column}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Re-keyed per tab + result set, so paging restarts whenever what's shown changes.
        <CardList key={`${tab}|${filtering}`} items={items} onMove={onMove} onFeedback={onFeedback} onNotify={onNotify} />
      )}
    </div>
  );
}

function CardList({
  items,
  onMove,
  onFeedback,
  onNotify,
}: {
  items: Release[];
  onMove: BoardProps["onMove"];
  onFeedback: BoardProps["onFeedback"];
  onNotify: BoardProps["onNotify"];
}) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const shown = items.slice(0, limit);
  const remaining = items.length - shown.length;

  return (
    <>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {shown.map((release) => (
          <ReleaseCard key={release.id} release={release} onMove={onMove} onFeedback={onFeedback} onNotify={onNotify} />
        ))}
      </div>
      {remaining > 0 && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <p className="text-xs text-zinc-400">
            Showing {shown.length} of {items.length}
          </p>
          <button type="button" onClick={() => setLimit((current) => current + PAGE_SIZE)} className={`${btnSecondary} h-9 px-4 text-sm`}>
            Show {Math.min(PAGE_SIZE, remaining)} more
          </button>
        </div>
      )}
    </>
  );
}
