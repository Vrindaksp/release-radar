"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, FlaskConical, FolderGit2, History, LoaderCircle, Pause, Play, Plus, Trash2, X } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { TIER_LABELS, TIERS, type Repository, type Tier } from "@/lib/types";
import { btnPrimary, btnSecondary, drawerBackdrop, drawerHeader, drawerPanel, focusRing, iconBtn, inputClass, surface } from "./ui";

const CATEGORY_SUGGESTIONS = [
  "Payment Gateway",
  "Authentication",
  "Security Library",
  "Evaluation Tool",
  "Infrastructure",
  "Database",
];

export interface BackfillState {
  running: boolean;
  /** Releases analysed so far in the current backfill. */
  done: number;
  /** Releases still waiting, once the first batch has reported. */
  remaining: number | null;
}

const BACKFILL_RANGES = [
  { days: 90, label: "Last 90 days" },
  { days: 180, label: "Last 6 months" },
  { days: 365, label: "Last year" },
];

interface RepoDrawerProps {
  onClose: () => void;
  repos: Repository[];
  backfill: BackfillState;
  onBackfill: (days: number) => void;
  sampleReleaseCount: number;
  onAdd: (input: { repoName: string; category: string; tier: Tier }) => Promise<void>;
  onPatch: (id: number, patch: { category?: string; tier?: Tier; isActive?: boolean }) => Promise<void>;
  onRemove: (repo: Repository) => Promise<void>;
  onLoadSample: () => Promise<void>;
  onClearSample: () => Promise<void>;
}

const message = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

/** Slide-over for adding / removing / re-prioritising tracked repositories. */
export default function RepoDrawer(props: RepoDrawerProps) {
  const { onClose, repos } = props;
  const [repoName, setRepoName] = useState("");
  const [category, setCategory] = useState("");
  const [tier, setTier] = useState<Tier>(2);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [backfillDays, setBackfillDays] = useState(180);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!repoName.trim() || adding) return;
    setAdding(true);
    setFormError(null);
    try {
      await props.onAdd({ repoName: repoName.trim(), category: category.trim(), tier });
      setRepoName("");
    } catch (error) {
      setFormError(message(error));
    } finally {
      setAdding(false);
    }
  }

  async function runSample(action: () => Promise<void>) {
    setSampleBusy(true);
    try {
      await action();
    } finally {
      setSampleBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className={drawerBackdrop} onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-labelledby="repo-drawer-title" className={drawerPanel}>
        <header className={drawerHeader}>
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/25 ring-inset">
              <FolderGit2 className="size-4" aria-hidden />
            </span>
            <div>
              <h2 id="repo-drawer-title" className="text-sm font-semibold text-zinc-100">
                Tracked repositories
              </h2>
              <p className="text-xs text-zinc-400">
                {repos.length} total · {repos.filter((repo) => repo.isActive).length} active
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`${iconBtn} p-1.5`}>
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <form onSubmit={submit} className="space-y-3 border-b border-white/10 px-5 py-4">
          <label className="block text-xs font-semibold text-zinc-300" htmlFor="repo-input">
            Add a GitHub repository
          </label>
          <input
            id="repo-input"
            ref={inputRef}
            value={repoName}
            onChange={(event) => setRepoName(event.target.value)}
            placeholder="owner/repo or https://github.com/owner/repo"
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} h-10 px-3 font-mono placeholder:font-sans`}
          />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              list="category-suggestions"
              placeholder="Category (e.g. Payment Gateway)"
              aria-label="Category"
              maxLength={60}
              className={`${inputClass} h-9 min-w-0 px-3`}
            />
            <datalist id="category-suggestions">
              {CATEGORY_SUGGESTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <select
              value={tier}
              onChange={(event) => setTier(Number(event.target.value) as Tier)}
              aria-label="Priority tier"
              className={`${inputClass} h-9 w-auto px-2`}
            >
              {TIERS.map((value) => (
                <option key={value} value={value}>
                  {TIER_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          {formError && (
            <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200 ring-1 ring-red-400/30 ring-inset">
              {formError}
            </p>
          )}
          <button type="submit" disabled={adding || !repoName.trim()} className={`${btnPrimary} h-9 w-full text-sm`}>
            {adding ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            {adding ? "Adding & analysing releases…" : "Track repository"}
          </button>
        </form>

        <section aria-labelledby="backfill-title" className="space-y-2.5 border-b border-white/10 px-5 py-4">
          <div className="flex items-start gap-2.5">
            <History className="mt-0.5 size-4 shrink-0 text-zinc-400" aria-hidden />
            <div>
              <h3 id="backfill-title" className="text-xs font-semibold text-zinc-300">
                Backfill history
              </h3>
              <p className="text-xs text-zinc-400">
                Load older releases for every active repo. Anything older than 30 days is filed in{" "}
                <em>Archived / Cleaned</em> — searchable, never alerting.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={backfillDays}
              onChange={(event) => setBackfillDays(Number(event.target.value))}
              disabled={props.backfill.running}
              aria-label="How far back to backfill"
              className={`${inputClass} h-9 min-w-0 flex-1 px-2`}
            >
              {BACKFILL_RANGES.map((range) => (
                <option key={range.days} value={range.days}>
                  {range.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => props.onBackfill(backfillDays)}
              disabled={props.backfill.running || !repos.some((repo) => repo.isActive)}
              className={`${btnSecondary} h-9 shrink-0 px-3 text-sm`}
            >
              {props.backfill.running && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
              {props.backfill.running ? "Backfilling…" : "Backfill"}
            </button>
          </div>
          {props.backfill.running && (
            <p role="status" className="text-xs text-zinc-300">
              {props.backfill.done} analysed
              {props.backfill.remaining !== null ? ` · ${props.backfill.remaining} to go` : " · starting…"}
            </p>
          )}
        </section>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {repos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-400">
              No repositories yet. Add one above — no code changes needed.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {repos.map((repo) => (
                <RepoRow key={repo.id} repo={repo} onPatch={props.onPatch} onRemove={props.onRemove} />
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
          <p className="flex items-center gap-1.5 text-xs text-zinc-400">
            <FlaskConical className="size-3.5 text-violet-300" aria-hidden />
            {props.sampleReleaseCount > 0
              ? `${props.sampleReleaseCount} fictional sample release${props.sampleReleaseCount === 1 ? "" : "s"} loaded`
              : "Sample data from db/seed.json"}
          </p>
          <button
            type="button"
            disabled={sampleBusy}
            onClick={() => runSample(props.sampleReleaseCount > 0 ? props.onClearSample : props.onLoadSample)}
            className={`${btnSecondary} h-8 shrink-0 px-2.5 text-xs`}
          >
            {sampleBusy && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
            {props.sampleReleaseCount > 0 ? "Remove sample releases" : "Load sample data"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function RepoRow({
  repo,
  onPatch,
  onRemove,
}: {
  repo: Repository;
  onPatch: RepoDrawerProps["onPatch"];
  onRemove: RepoDrawerProps["onRemove"];
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  const quietField =
    "h-8 rounded-md border border-transparent bg-zinc-800/70 px-2 text-xs text-zinc-200 transition-colors hover:border-white/15 focus:border-indigo-400/70 focus:bg-zinc-800 focus:outline-2 focus:outline-indigo-400/25";

  return (
    <li className={`${surface} p-3 transition-opacity ${repo.isActive ? "" : "opacity-60"} ${busy ? "pointer-events-none opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex max-w-full items-center gap-1 rounded font-mono text-sm font-semibold text-zinc-100 transition-colors hover:text-indigo-300 hover:underline ${focusRing}`}
          >
            <span className="truncate">{repo.repoName}</span>
            <ExternalLink className="size-3 shrink-0 text-zinc-500" aria-hidden />
          </a>
          {repo.description && <p className="truncate text-xs text-zinc-400">{repo.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => run(() => onPatch(repo.id, { isActive: !repo.isActive }))}
            aria-label={repo.isActive ? `Pause ${repo.repoName}` : `Resume ${repo.repoName}`}
            title={repo.isActive ? "Pause tracking (keeps history)" : "Resume tracking"}
            className={`${iconBtn} p-1.5`}
          >
            {repo.isActive ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Remove ${repo.repoName}`}
            title="Remove repository"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-500/15 hover:text-red-300 focus-visible:outline-2 focus-visible:outline-red-400"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <input
          key={repo.category}
          defaultValue={repo.category}
          aria-label={`Category for ${repo.repoName}`}
          maxLength={60}
          onBlur={(event) => {
            const next = event.target.value.trim();
            if (next && next !== repo.category) void run(() => onPatch(repo.id, { category: next }));
            else event.target.value = repo.category;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className={`${quietField} min-w-0`}
        />
        <select
          value={repo.tier}
          onChange={(event) => run(() => onPatch(repo.id, { tier: Number(event.target.value) as Tier }))}
          aria-label={`Tier for ${repo.repoName}`}
          className={`${quietField} px-1.5`}
        >
          {TIERS.map((value) => (
            <option key={value} value={value}>
              {TIER_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-1.5 text-[11px] text-zinc-400">
        {!repo.isActive ? "Paused" : repo.lastSyncedAt ? `Synced ${timeAgo(repo.lastSyncedAt)}` : "Not synced yet"}
      </p>
      {repo.lastSyncError && (
        <p className="mt-1 line-clamp-2 text-[11px] text-red-300" title={repo.lastSyncError}>
          {repo.lastSyncError}
        </p>
      )}

      {confirming && (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-red-500/10 px-2.5 py-2 ring-1 ring-red-400/30 ring-inset">
          <p className="text-xs text-red-200">Remove and delete its cached releases?</p>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={`rounded-md px-2 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 ${focusRing}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => run(() => onRemove(repo))}
              className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-red-300"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
