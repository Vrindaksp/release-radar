"use client";

import type { RefObject } from "react";
import { Bell, FolderGit2, LoaderCircle, Radar, RefreshCw, Search, X } from "lucide-react";
import { timeAgo } from "@/lib/format";
import type { DigestFilter } from "@/lib/types";
import { btnSecondary, focusRing } from "./ui";

interface TopBarProps {
  searchRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  filter: DigestFilter;
  onFilterChange: (filter: DigestFilter) => void;
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
  /** Whether email alerts are switched on and deliverable; null while unknown. */
  emailActive: boolean | null;
}

const FILTERS: { value: DigestFilter; label: string }[] = [
  { value: "security", label: "Security Only" },
  { value: "breaking", label: "Breaking Changes" },
  { value: "all", label: "All Releases" },
];

export default function TopBar(props: TopBarProps) {
  const { query, filter, syncing } = props;
  const counts: Record<DigestFilter, number | null> = {
    security: props.securityCount,
    breaking: props.breakingCount,
    all: null,
  };

  return (
    <header className="shrink-0 border-b border-white/10 bg-zinc-950/85 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-950/50">
            <Radar className="size-5" aria-hidden />
          </span>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">Release Radar</h1>
            <p className="text-xs text-zinc-400">Weekly open-source digest</p>
          </div>
        </div>

        <div className="relative order-last w-full min-w-0 sm:order-none sm:w-auto sm:max-w-xl sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <input
            ref={props.searchRef}
            type="search"
            value={query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") props.onQueryChange("");
            }}
            placeholder="Ask My Digest… e.g. CVE, stripe, pooling"
            aria-label="Ask My Digest — search releases"
            className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900 pr-16 pl-9 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors hover:border-white/20 focus:border-indigo-400/70 focus:outline-2 focus:outline-offset-0 focus:outline-indigo-400/25 [&::-webkit-search-cancel-button]:hidden"
          />
          <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
            {query ? (
              <button
                type="button"
                onClick={() => props.onQueryChange("")}
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

        <div className="ml-auto flex flex-wrap items-center gap-2">
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
                  onClick={() => props.onFilterChange(value)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-[10px] px-1.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors sm:px-2.5 ${focusRing} ${
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

          <button type="button" onClick={props.onSync} disabled={syncing} className={`${btnSecondary} h-9 px-3 text-xs`}>
            {syncing ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            {syncing ? "Syncing…" : "Sync now"}
          </button>
          <button
            type="button"
            onClick={props.onOpenAlerts}
            className={`${btnSecondary} relative h-9 px-3 text-xs`}
            title={props.emailActive ? "Emergency email alerts are on" : "Set up emergency email alerts"}
          >
            <Bell className="size-3.5" aria-hidden />
            Alerts
            {props.emailActive !== null && (
              <span
                aria-label={props.emailActive ? "Email alerts on" : "Email alerts off"}
                className={`size-1.5 rounded-full ${props.emailActive ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-zinc-500"}`}
              />
            )}
          </button>
          <button type="button" onClick={props.onOpenRepos} className={`${btnSecondary} h-9 px-3 text-xs`}>
            <FolderGit2 className="size-3.5" aria-hidden />
            Manage repos
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-white/5 bg-zinc-900/40 px-4 py-1.5 text-xs">
        <p className="flex items-center gap-2 font-medium text-zinc-300" role="status">
          <span className="font-mono font-semibold tabular-nums text-zinc-100">{props.reposMonitored ?? "–"}</span>
          {props.reposMonitored === 1 ? "Repo Monitored" : "Repos Monitored"}
          <span aria-hidden className="text-zinc-500">
            •
          </span>
          {props.criticalCount === null ? (
            <span className="text-zinc-400">awaiting data</span>
          ) : props.criticalCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-red-300">
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-red-400" />
              </span>
              {props.criticalCount} Critical {props.criticalCount === 1 ? "Action" : "Actions"} Required
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
              <span className="size-2 rounded-full bg-emerald-400" aria-hidden />
              No critical actions
            </span>
          )}
        </p>
        <p className="text-zinc-400">
          {props.lastSyncedAt ? `Last sync ${timeAgo(props.lastSyncedAt)}` : "Not synced yet"} · Mondays 12:00 UTC
        </p>
      </div>
    </header>
  );
}
