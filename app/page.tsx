"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AlertsDrawer from "@/components/AlertsDrawer";
import Board from "@/components/Board";
import EmergencyBanner from "@/components/EmergencyBanner";
import { BoardSkeleton, ErrorPanel, FirstRunPanel } from "@/components/EmptyStates";
import RepoDrawer, { type BackfillState } from "@/components/RepoDrawer";
import Toasts, { type Toast } from "@/components/Toasts";
import TopBar from "@/components/TopBar";
import {
  addRepository,
  ApiError,
  clearSampleData,
  fetchAlerts,
  fetchDigest,
  fetchRepositories,
  loadSampleData,
  moveRelease,
  patchRepository,
  removeRepository,
  runBackfill,
  runSync,
  submitFeedback,
} from "@/lib/client";
import { filterReleases } from "@/lib/search";
import type {
  AlertsView,
  DigestFilter,
  DigestResponse,
  FeedbackInput,
  Release,
  Repository,
  Tier,
  TriageColumn,
} from "@/lib/types";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

export default function DashboardPage() {
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; status: number } | null>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DigestFilter>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertsView | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [backfill, setBackfill] = useState<BackfillState>({ running: false, done: 0, remaining: null });
  const [toasts, setToasts] = useState<Toast[]>([]);

  const searchRef = useRef<HTMLInputElement>(null);
  const toastId = useRef(0);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const closeAlerts = useCallback(() => setAlertsOpen(false), []);

  // The Alerts panel's state also drives the little status dot on its top-bar button, so load it
  // up front — separately from the digest, so a problem here never blanks the board.
  const loadAlerts = useCallback(async () => {
    try {
      setAlerts(await fetchAlerts());
      setAlertsError(null);
    } catch (error) {
      setAlertsError(errorMessage(error));
    }
  }, []);

  // ---- notifications -------------------------------------------------------
  const dismissToast = useCallback((id: number) => setToasts((current) => current.filter((t) => t.id !== id)), []);

  const notify = useCallback(
    (kind: Toast["kind"], message: string) => {
      const id = ++toastId.current;
      setToasts((current) => [...current.slice(-3), { id, kind, message }]);
      setTimeout(() => dismissToast(id), kind === "error" ? 9000 : 4500);
    },
    [dismissToast],
  );

  // ---- data ----------------------------------------------------------------
  const load = useCallback(async () => {
    try {
      const [nextDigest, nextRepos] = await Promise.all([fetchDigest(), fetchRepositories()]);
      setDigest(nextDigest);
      setRepos(nextRepos);
      setLoadError(null);
    } catch (error) {
      setLoadError({
        message: errorMessage(error),
        status: error instanceof ApiError ? error.status : 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadAlerts();
  }, [load, loadAlerts]);

  // Emergencies are visible from the browser tab too.
  const emergencyCount = (digest?.releases ?? []).filter(
    (r) => r.emergencyAt && r.triageColumn === "Immediate Triage",
  ).length;
  const baseTitle = useRef<string | null>(null);
  useEffect(() => {
    baseTitle.current ??= document.title;
    document.title = emergencyCount > 0 ? `(${emergencyCount}) 🚨 ${baseTitle.current}` : baseTitle.current;
  }, [emergencyCount]);

  // "/" jumps to the search box, like GitHub.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ---- derived -------------------------------------------------------------
  const releases = digest?.releases;
  const visible = useMemo(
    () => (releases ? filterReleases(releases, query, filter) : []),
    [releases, query, filter],
  );
  const counts = useMemo(() => {
    const open = (releases ?? []).filter((r) => r.triageColumn !== "Archived / Cleaned");
    return {
      critical: open.filter((r) => r.triageColumn === "Immediate Triage").length,
      security: open.filter((r) => r.isSecurityFix).length,
      breaking: open.filter((r) => r.isBreakingChange).length,
    };
  }, [releases]);

  // ---- actions -------------------------------------------------------------
  async function handleSync() {
    if (!repos.some((repo) => repo.isActive)) {
      notify("info", "Add a repository first — there is nothing to sync yet.");
      return;
    }
    setSyncing(true);
    try {
      const report = await runSync();
      await load();
      const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
      let summary = `Synced ${plural(report.reposProcessed, "repo")} · ${plural(report.inserted, "new release")}`;
      if (report.escalated > 0) summary += ` · ${plural(report.escalated, "emergency alert")} sent to Slack`;
      const failed = report.results.find((result) => result.error);
      if (failed) {
        summary += ` · ${plural(report.reposWithErrors, "repo")} with errors — ${failed.repoName}: ${failed.error}`;
      }
      notify(failed ? "error" : "success", summary);
    } catch (error) {
      notify("error", errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  const handleMove = useCallback(
    async (release: Release, column: TriageColumn) => {
      const previous = release.triageColumn;
      const apply = (to: TriageColumn) =>
        setDigest((current) =>
          current
            ? { ...current, releases: current.releases.map((r) => (r.id === release.id ? { ...r, triageColumn: to } : r)) }
            : current,
        );
      apply(column); // optimistic
      try {
        await moveRelease(release.id, column);
      } catch (error) {
        apply(previous);
        notify("error", `Couldn't move ${release.repoName} ${release.versionTag}: ${errorMessage(error)}`);
      }
    },
    [notify],
  );

  /**
   * Loads older history. The server does one batch per repository per call, so loop until
   * nothing is left — or until two calls in a row make no progress (e.g. Gemini rate limits).
   */
  async function handleBackfill(days: number) {
    setBackfill({ running: true, done: 0, remaining: null });
    let done = 0;
    let stalled = 0;
    let remaining = 0;
    let problem: string | undefined;
    try {
      for (let batch = 0; batch < 60; batch++) {
        const report = await runBackfill(days);
        done += report.inserted;
        remaining = report.remaining;
        problem = report.results.find((result) => result.error)?.error;
        setBackfill({ running: true, done, remaining });
        await load();
        if (remaining === 0) break;
        stalled = report.inserted === 0 ? stalled + 1 : 0;
        if (stalled >= 2) break;
      }
      if (remaining === 0) {
        notify("success", `Backfill complete — ${done} release${done === 1 ? "" : "s"} added`);
      } else {
        notify("error", `Backfill paused with ${remaining} left${problem ? ` — ${problem}` : ""}. Run it again to continue.`);
      }
    } catch (error) {
      notify("error", `Backfill stopped after ${done} release${done === 1 ? "" : "s"}: ${errorMessage(error)}`);
    } finally {
      setBackfill({ running: false, done, remaining: null });
    }
  }

  /** Logs a correction; the server returns the re-classified card, which may change column. */
  const handleFeedback = useCallback(
    async (release: Release, input: Omit<FeedbackInput, "releaseId">) => {
      const updated = await submitFeedback({ releaseId: release.id, ...input }); // throws → inline in the panel
      setDigest((current) =>
        current
          ? { ...current, releases: current.releases.map((r) => (r.id === updated.id ? updated : r)) }
          : current,
      );
      notify(
        "success",
        `Correction logged for ${release.repoName} ${release.versionTag} — Gemini will use it to calibrate future releases.`,
      );
    },
    [notify],
  );

  async function handleAddRepo(input: { repoName: string; category: string; tier: Tier }) {
    const repository = await addRepository(input); // throws → shown inline in the drawer
    notify("success", `Now tracking ${repository.repoName}`);
    try {
      const report = await runSync(repository.id);
      const result = report.results[0];
      if (result?.error) notify("error", `${repository.repoName}: ${result.error}`);
      else notify("info", `${repository.repoName}: ${result?.inserted ?? 0} release(s) analysed`);
    } catch (error) {
      notify("error", `Added ${repository.repoName}, but its first sync failed: ${errorMessage(error)}`);
    }
    await load();
  }

  async function handlePatchRepo(id: number, patch: { category?: string; tier?: Tier; isActive?: boolean }) {
    try {
      await patchRepository(id, patch);
      await load();
    } catch (error) {
      notify("error", errorMessage(error));
    }
  }

  async function handleRemoveRepo(repo: Repository) {
    try {
      await removeRepository(repo.id);
      notify("success", `Stopped tracking ${repo.repoName}`);
      await load();
    } catch (error) {
      notify("error", errorMessage(error));
    }
  }

  async function handleLoadSample() {
    setLoadingSample(true);
    try {
      const result = await loadSampleData();
      notify("success", `Loaded ${result.repositories} repositories and ${result.releases} sample releases`);
      await load();
    } catch (error) {
      notify("error", errorMessage(error));
    } finally {
      setLoadingSample(false);
    }
  }

  async function handleClearSample() {
    try {
      const result = await clearSampleData();
      notify("success", `Removed ${result.removed} sample release${result.removed === 1 ? "" : "s"}`);
      await load();
    } catch (error) {
      notify("error", errorMessage(error));
    }
  }

  // ---- render --------------------------------------------------------------
  const filtering = query.trim() !== "" || filter !== "all";
  const firstRun = digest !== null && repos.length === 0;

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <TopBar
        searchRef={searchRef}
        query={query}
        onQueryChange={setQuery}
        filter={filter}
        onFilterChange={setFilter}
        reposMonitored={digest?.stats.reposMonitored ?? null}
        criticalCount={digest ? counts.critical : null}
        securityCount={counts.security}
        breakingCount={counts.breaking}
        lastSyncedAt={digest?.stats.lastSyncedAt ?? null}
        syncing={syncing}
        onSync={handleSync}
        onOpenRepos={() => setDrawerOpen(true)}
        onOpenAlerts={() => {
          setAlertsOpen(true);
          void loadAlerts(); // always show current settings when the panel opens
        }}
        emailActive={alerts ? alerts.email.active : null}
      />

      <EmergencyBanner releases={digest?.releases ?? []} />

      <main className="flex min-h-0 flex-1 flex-col p-4">
        {loading ? (
          <BoardSkeleton />
        ) : loadError && !digest ? (
          <ErrorPanel
            message={loadError.message}
            status={loadError.status}
            onRetry={() => {
              setLoading(true);
              void load();
            }}
          />
        ) : firstRun ? (
          <FirstRunPanel
            onAddRepo={() => setDrawerOpen(true)}
            onLoadSample={handleLoadSample}
            loadingSample={loadingSample}
          />
        ) : (
          <Board
            releases={visible}
            filtering={filtering}
            onMove={handleMove}
            onFeedback={handleFeedback}
            onNotify={notify}
          />
        )}
      </main>

      {drawerOpen && (
        <RepoDrawer
          onClose={closeDrawer}
          repos={repos}
          backfill={backfill}
          onBackfill={handleBackfill}
          sampleReleaseCount={digest?.stats.sampleReleaseCount ?? 0}
          onAdd={handleAddRepo}
          onPatch={handlePatchRepo}
          onRemove={handleRemoveRepo}
          onLoadSample={handleLoadSample}
          onClearSample={handleClearSample}
        />
      )}

      {alertsOpen && (
        <AlertsDrawer
          onClose={closeAlerts}
          view={alerts}
          loadError={alerts ? null : alertsError}
          onViewChange={setAlerts}
          onRetry={() => void loadAlerts()}
        />
      )}

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
