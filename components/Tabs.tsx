"use client";

import { useRef } from "react";
import { Archive, Radar, Siren, type LucideIcon } from "lucide-react";
import { TAB_SLUGS } from "@/lib/tabs";
import { TRIAGE_COLUMNS, type TriageColumn } from "@/lib/types";
import { focusRing } from "./ui";

interface TabMeta {
  icon: LucideIcon;
  /** Shown on narrow screens, where the full name would not fit. */
  short: string;
  /** Colour of the active underline and the count pill. */
  indicator: string;
  count: string;
}

export const TAB_META: Record<TriageColumn, TabMeta> = {
  "Immediate Triage": {
    icon: Siren,
    short: "Immediate",
    indicator: "bg-red-400",
    count: "bg-red-500/20 text-red-200 ring-red-400/30",
  },
  "Watchlist Radar": {
    icon: Radar,
    short: "Watchlist",
    indicator: "bg-sky-400",
    count: "bg-sky-500/20 text-sky-200 ring-sky-400/30",
  },
  "Archived / Cleaned": {
    icon: Archive,
    short: "Archive",
    indicator: "bg-zinc-400",
    count: "bg-zinc-500/20 text-zinc-200 ring-white/15",
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
    <div role="tablist" aria-label="Release lists" className="thin-scroll flex min-w-0 overflow-x-auto">
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
            className={`relative inline-flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors sm:px-4 ${focusRing} ${
              selected ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-100"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            <span className="sm:hidden">{meta.short}</span>
            <span className="hidden sm:inline">{column}</span>
            {counts && (
              <span
                aria-hidden
                className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ${
                  selected ? meta.count : "bg-zinc-800 text-zinc-300 ring-white/10"
                }`}
              >
                {counts[column]}
              </span>
            )}
            {selected && <span aria-hidden className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full ${meta.indicator}`} />}
          </button>
        );
      })}
    </div>
  );
}
