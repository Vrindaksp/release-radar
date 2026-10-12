"use client";

import type { RefObject } from "react";
import { Bell, CircleHelp, FolderGit2, LoaderCircle, Radar, RefreshCw, Search, X } from "lucide-react";
import { timeAgo } from "@/lib/format";
import type { DigestFilter, TriageColumn } from "@/lib/types";
import Tabs from "./Tabs";
import { btnSecondary, focusRing } from "./ui";

interface TopBarProps {
  searchRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  filter: DigestFilter;
  onFilterChange: (filter: DigestFilter) => void;
  tab: TriageColumn;
  /** Per-tab counts of what is currently shown (after search / filter); null while loading. */
  tabCounts: Record<TriageColumn, number> | null;
  onTabChange: (tab: TriageColumn) => void;
  reposMonitored: number | null;
  /** null until the first digest has loaded. */
  criticalCount: number | null;
  securityCount: number;
  breakingCount: number;
  lastSyncedAt: string | null;
  syncing: boolean;
  onSync: () => void;
  onOpenRepos: () => void;
  onOpenAlerts: () => void;
  onOpenAbout: () => void;
  /** Whether email alerts are switched on and deliverable; null while unknown. */
  emailActive: boolean | null;
}

const FILTERS: { value: DigestFilter; label: string }[] = [
  { value: "security", label: "Security Only" },
  { value: "breaking", label: "Breaking Changes" },
  { value: "all", label: "All Releases" },
];

/** Width shared with the board below so everything lines up. */
const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/**
 * Two rows: (1) identity + status, search and actions; (2) the three lists as tabs, with the filter.
 *
 * Tablet and up, the header is one sticky block. On a phone it dissolves (`display: contents`) so row 1
 * scrolls away and only the tab strip stays pinned — the header alone would take a third of the screen.
 */
export default function TopBar(props: TopBarProps) {
  return (
    <header className="contents md:sticky md:top-0 md:z-30 md:block md:border-b md:border-white/10 md:bg-zinc-950/90 md:backdrop-blur">
      <div className="max-md:bg-zinc-950/90">
        <div className={`${CONTAINER} flex flex-wrap items-center gap-x-4 gap-y-3 pt-3 pb-2`}>
          <Brand
            reposMonitored={props.reposMonitored}
            criticalCount={props.criticalCount}
          />
          <SearchBox searchRef={props.searchRef} query={props.query} onQueryChange={props.onQueryChange} />
          <Actions {...props} />
        </div>
      </div>

      <div className="max-md:sticky max-md:top-0 max-md:z-30 max-md:border-b max-md:border-white/10 max-md:bg-zinc-950/95 max-md:backdrop-blur">
        <div className={`${CONTAINER} flex flex-wrap items-end justify-between gap-x-4`}>
          <div className="max-w-full min-w-0">
            <Tabs active={props.tab} counts={props.tabCounts} onChange={props.onTabChange} />
          </div>
          <FilterGroup
            filter={props.filter}
            onChange={props.onFilterChange}
            securityCount={props.securityCount}
            breakingCount={props.breakingCount}
          />
        </div>
      </div>
    </header>
  );
}

/** Logo, name, and the "N Repos Monitored • M Critical Actions Required" status line. */
function Brand({ reposMonitored, criticalCount }: { reposMonitored: number | null; criticalCount: number | null }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-950/50">
        <Radar className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 leading-tight">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100">Release Radar</h1>
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-400" role="status">
          <span className="font-mono font-semibold text-zinc-200 tabular-nums">{reposMonitored ?? "–"}</span>
          {reposMonitored === 1 ? "Repo Monitored" : "Repos Monitored"}
          <span aria-hidden className="text-zinc-400">
            •
          </span>
          {criticalCount === null ? (
            <span>awaiting data</span>
          ) : criticalCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-red-300">
              <span className="relative flex size-1.5" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-red-400" />
              </span>
              {criticalCount} Critical {criticalCount === 1 ? "Action" : "Actions"} Required
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
              No critical actions
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

/** "Ask My Digest": live search across repo, version, summary, CVE ids… (press / to focus). */
function SearchBox({
  searchRef,
  query,
  onQueryChange,
}: Pick<TopBarProps, "searchRef" | "query" | "onQueryChange">) {
  return (
    <div className="relative order-last w-full min-w-0 lg:order-none lg:w-auto lg:max-w-md lg:flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" aria-hidden />
      <input
        ref={searchRef}
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onQueryChange("");
        }}
        placeholder="Ask My Digest… e.g. CVE, stripe, pooling"
        aria-label="Ask My Digest — search releases"
        className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900 pr-16 pl-9 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors hover:border-white/20 focus:border-indigo-400/70 focus:outline-2 focus:outline-offset-0 focus:outline-indigo-400/25 [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className={`rounded p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100 ${focusRing}`}
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : (
          <kbd className="hidden rounded border border-white/15 bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400 sm:block">
            /
          </kbd>
        )}
      </div>
    </div>
  );
}

/** Sync / Alerts / Manage repos / How it works. Icon-only until a wide desktop. */
function Actions(props: TopBarProps) {
  const lastSync = props.lastSyncedAt ? `Last sync ${timeAgo(props.lastSyncedAt)}` : "Not synced yet";
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={props.onSync}
        disabled={props.syncing}
        aria-label={props.syncing ? "Syncing" : "Sync now"}
        title={`${lastSync} · syncs automatically Mondays 12:00 UTC`}
        className={`${btnSecondary} h-9 px-3 text-xs`}
      >
        {props.syncing ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
        <span className="hidden xl:inline">{props.syncing ? "Syncing…" : "Sync now"}</span>
      </button>
      <button
        type="button"
        onClick={props.onOpenAlerts}
        aria-label="Alerts"
        title={props.emailActive ? "Emergency email alerts are on" : "Set up emergency email alerts"}
        className={`${btnSecondary} relative h-9 px-3 text-xs`}
      >
        <Bell className="size-3.5" aria-hidden />
        <span className="hidden xl:inline">Alerts</span>
        {props.emailActive !== null && (
          <span
            aria-label={props.emailActive ? "Email alerts on" : "Email alerts off"}
            className={`size-1.5 rounded-full ${props.emailActive ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-zinc-500"}`}
          />
        )}
      </button>
      <button type="button" onClick={props.onOpenRepos} aria-label="Manage repos" title="Manage repos" className={`${btnSecondary} h-9 px-3 text-xs`}>
        <FolderGit2 className="size-3.5" aria-hidden />
        <span className="hidden xl:inline">Manage repos</span>
      </button>
      <button
        type="button"
        onClick={props.onOpenAbout}
        aria-label="How it works"
        title="How it works (?)"
        className={`${btnSecondary} h-9 px-3 text-xs max-sm:hidden`}
      >
        <CircleHelp className="size-3.5" aria-hidden />
        <span className="hidden xl:inline">How it works</span>
      </button>
    </div>
  );
}

/** Security Only / Breaking Changes / All Releases, with live counts of open items. */
function FilterGroup({
  filter,
  onChange,
  securityCount,
  breakingCount,
}: {
  filter: DigestFilter;
  onChange: (filter: DigestFilter) => void;
  securityCount: number;
  breakingCount: number;
}) {
  const counts: Record<DigestFilter, number | null> = { security: securityCount, breaking: breakingCount, all: null };
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div
        role="group"
        aria-label="Filter releases"
        className="thin-scroll flex max-w-full overflow-x-auto rounded-xl bg-zinc-900 p-0.5 ring-1 ring-white/10 ring-inset"
      >
        {FILTERS.map(({ value, label }) => {
          const active = filter === value;
          const count = counts[value];
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(value)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors sm:px-2.5 ${focusRing} ${
                active ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {label}
              {count !== null && count > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[10px] leading-4 font-bold tabular-nums ring-1 ring-inset ${
                    value === "security"
                      ? "bg-red-500/20 text-red-200 ring-red-400/30"
                      : "bg-orange-500/20 text-orange-200 ring-orange-400/30"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
