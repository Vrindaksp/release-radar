"use client";

import { useRef } from "react";
import { Archive, Radar, Siren, type LucideIcon } from "lucide-react";
import { TAB_SLUGS } from "@/lib/tabs";
import { TRIAGE_COLUMNS, type TriageColumn } from "@/lib/types";
import { focusRing } from "./ui";

interface TabMeta {
  icon: LucideIcon;
  /** Shown below the desktop breakpoint, where the full name would not fit. */
  short: string;
  /** Colour of the count pill while the tab is not selected. */
  count: string;
}

export const TAB_META: Record<TriageColumn, TabMeta> = {
  "Immediate Triage": {
    icon: Siren,
    short: "Immediate",
    count: "bg-hot/20 text-pink-200 ring-hot/40",
  },
  "Watchlist Radar": {
    icon: Radar,
    short: "Watchlist",
    count: "bg-ice/15 text-cyan-200 ring-ice/30",
  },
  "Archived / Cleaned": {
    icon: Archive,
    short: "Archive",
    count: "bg-zinc-800 text-zinc-300 ring-white/10",
  },
};

interface TabsProps {
  active: TriageColumn;
  /** null while the first digest is loading. */
  counts: Record<TriageColumn, number> | null;
  onChange: (tab: TriageColumn) => void;
}

/**
 * The board's three lists as an accessible tab bar (WAI-ARIA tabs pattern): arrow keys / Home / End
 * move between tabs, only the active tab is in the tab order, and the panel is `#board-panel`.
 */
export default function Tabs({ active, counts, onChange }: TabsProps) {
  const refs = useRef<Partial<Record<TriageColumn, HTMLButtonElement | null>>>({});

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const last = TRIAGE_COLUMNS.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    const target = TRIAGE_COLUMNS[next];
    onChange(target);
    refs.current[target]?.focus();
  }

  return (
    <div role="tablist" aria-label="Release lists" className="thin-scroll flex min-w-0 gap-1.5 overflow-x-auto px-1 py-2">
      {TRIAGE_COLUMNS.map((column, index) => {
        const meta = TAB_META[column];
        const Icon = meta.icon;
        const selected = column === active;
        return (
          <button
            key={column}
            ref={(node) => {
              refs.current[column] = node;
            }}
            type="button"
            role="tab"
            id={`tab-${TAB_SLUGS[column]}`}
            aria-selected={selected}
            aria-controls="board-panel"
            aria-label={counts ? `${column}, ${counts[column]} ${counts[column] === 1 ? "release" : "releases"}` : column}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(column)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`relative inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-bold whitespace-nowrap sm:px-3.5 transition-all active:scale-[0.97] ${focusRing} ${
              selected ? "bg-zinc-50 text-zinc-950 shadow-lg shadow-black/40" : "text-zinc-300 hover:bg-white/10 hover:text-zinc-50"
            }`}
          >
            <Icon className="hidden size-4 sm:block" aria-hidden />
            <span className="lg:hidden">{meta.short}</span>
            <span className="hidden lg:inline">{column}</span>
            {counts && (
              <span
                aria-hidden
                className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ${
                  selected ? "bg-zinc-950 text-zinc-50 ring-zinc-950" : meta.count
                }`}
              >
                {counts[column]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
