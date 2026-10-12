import { ConfigError, HttpError } from "./errors";
import { deliverEmergencyAlert, evaluateEscalation } from "./escalation";
import { loadCalibrationExamples } from "./feedback";
import { analyzeRelease, isGeminiConfigured, type ReleaseAnalysis } from "./gemini";
import { fetchReleases, type GitHubRelease } from "./github";
import { cachedVersionTags, insertRelease, recordEmergency } from "./releases";
import { getRepository, listRepositories, markSynced } from "./repos";
import { getAlertEmailSettings, resolveEmailRecipients } from "./settings";
import type { IngestReport, IngestSource, Repository, RepoIngestResult, TriageColumn } from "./types";

/** How far back a routine (weekly) run looks. */
export const DEFAULT_WINDOW_DAYS = 7;
/** A repository that has never been synced looks further back so it isn't empty. */
const FIRST_SYNC_WINDOW_DAYS = 30;
/** Cap on new releases analysed per repository per routine run (bounds Gemini usage). */
const MAX_NEW_PER_REPO = 8;
/** A backfill works through history in batches this size per repository per request. */
const BACKFILL_BATCH = 10;
/**
 * Releases older than this are history, not news: they go straight to the archive
 * (searchable, restorable) instead of flooding Immediate Triage with stale items.
 */
const HISTORY_AFTER_DAYS = 30;
/** Repositories processed in parallel. */
const CONCURRENCY = 3;

const DAY_MS = 86_400_000;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Whether a GitHub release belongs on the board. Drafts never do. Tier 1
 * (critical-path) repos track stable releases only; evaluation tools (tier 2/3)
 * also surface release candidates, since that's what's being evaluated.
 */
export function shouldTrackRelease(repo: Pick<Repository, "tier">, release: GitHubRelease): boolean {
  if (release.draft || !release.published_at) return false;
  return repo.tier !== 1 || !release.prerelease;
}

const ARCHIVE: TriageColumn = "Archived / Cleaned";
const isHistory = (release: GitHubRelease) => Date.parse(release.published_at!) < Date.now() - HISTORY_AFTER_DAYS * DAY_MS;

export interface ProcessOutcome {
  /** False if the release was already cached (e.g. a webhook redelivery). */
  inserted: boolean;
  /** True if an emergency Slack alert was sent. */
  escalated: boolean;
  releaseId: number | null;
}

/**
 * The single ingestion path shared by the weekly poll, manual sync and the
 * GitHub webhook: Gemini analysis (calibrated by past corrections) → cache in
 * Neon, tagged for triage → emergency escalation check.
 *
 * Throws if Gemini fails after retries, in which case nothing is cached and the
 * next poll retries the release.
 */
export async function processRelease(
  repo: Repository,
  release: GitHubRelease,
  source: IngestSource,
): Promise<ProcessOutcome> {
  // Tuning must never block ingestion: if the feedback table is unreachable, analyse without it.
  const examples = await loadCalibrationExamples(repo.repoName).catch(() => []);
  const analysis = await analyzeRelease({
    repoName: repo.repoName,
    category: repo.category,
    tier: repo.tier,
    versionTag: release.tag_name,
    releaseName: release.name,
    body: release.body,
    examples,
  });
  const releaseId = await insertRelease({
    repositoryId: repo.id,
    githubReleaseId: release.id,
    versionTag: release.tag_name,
    releaseName: release.name,
    htmlUrl: release.html_url,
    rawNotes: release.body,
    publishedAt: release.published_at!,
    analysis,
    ingestSource: source,
    startColumn: isHistory(release) ? ARCHIVE : undefined,
  });
  if (releaseId === null) return { inserted: false, escalated: false, releaseId: null };

  const escalated = await escalateIfNeeded(repo, release, analysis, releaseId, source);
  return { inserted: true, escalated, releaseId };
}

/**
 * The rule engine check. Runs only for newly inserted rows, so a redelivered
 * webhook can never page the team twice, and the rule's age window keeps
 * backfilled history from alerting. Firing always records an emergency (which
 * drives the dashboard banner); external channels (Slack / ntfy) are best-effort
 * and a failure is recorded on the release rather than thrown — it is already saved.
 * Returns true if at least one external channel delivered.
 */
async function escalateIfNeeded(
  repo: Repository,
  release: GitHubRelease,
  analysis: ReleaseAnalysis,
  releaseId: number,
  source: IngestSource,
): Promise<boolean> {
  const decision = evaluateEscalation({ analysis, tier: repo.tier, publishedAt: release.published_at! });
  if (!decision.escalate) return false;

  // Recipients chosen in the dashboard's Alerts panel win; if that lookup fails, fall back to the
  // server's ALERT_EMAIL_TO rather than losing the alert.
  const saved = await getAlertEmailSettings().catch(() => null);

  let outcome: Awaited<ReturnType<typeof deliverEmergencyAlert>>;
  try {
    outcome = await deliverEmergencyAlert(
      {
        repoName: repo.repoName,
        versionTag: release.tag_name,
        tier: repo.tier,
        category: repo.category,
        summary: analysis.summary,
        securitySeverity: analysis.securitySeverity,
        securityImpact: analysis.securityImpact,
        advisoryIds: analysis.advisoryIds,
        recommendedAction: analysis.recommendedAction,
        htmlUrl: release.html_url,
        ingestSource: source,
        reasons: decision.reasons,
      },
      process.env,
      { emailRecipients: resolveEmailRecipients(saved) },
    );
  } catch (error) {
    outcome = { configured: [], delivered: [], failures: [(error as Error).message] };
  }

  const error = outcome.failures.length ? outcome.failures.join("; ").slice(0, 300) : null;
  if (error) console.error(`[escalation] alert for ${repo.repoName} ${release.tag_name} failed: ${error}`);
  if (outcome.configured.length === 0) {
    console.warn(`[escalation] ${repo.repoName} ${release.tag_name} is an emergency but no alert channel is configured (dashboard banner only)`);
  }
  await recordEmergency(releaseId, { delivered: outcome.delivered.length > 0, error }).catch(() => undefined);
  return outcome.delivered.length > 0;
}

async function ingestRepository(repo: Repository, days: number, backfill: boolean): Promise<RepoIngestResult> {
  const result: RepoIngestResult = { repoName: repo.repoName, fetched: 0, inserted: 0, escalated: 0, remaining: 0 };
  try {
    // A backfill reads GitHub's maximum page (the 100 most recent releases).
    const releases = await fetchReleases(repo.repoName, backfill ? 100 : 20);
    const windowDays = backfill || repo.lastSyncedAt ? days : Math.max(days, FIRST_SYNC_WINDOW_DAYS);
    const since = Date.now() - windowDays * DAY_MS;

    const inWindow = releases.filter(
      (release) => shouldTrackRelease(repo, release) && Date.parse(release.published_at!) >= since,
    );
    result.fetched = inWindow.length;

    const cached = await cachedVersionTags(repo.id);
    const pending = inWindow.filter((release) => !cached.has(release.tag_name));
    // GitHub lists newest first. Take the newest batch, analyse it oldest-first so
    // partial failures leave no gaps; a backfill picks up the next batch on its next call.
    const fresh = pending.slice(0, backfill ? BACKFILL_BATCH : MAX_NEW_PER_REPO).reverse();

    const failures: string[] = [];
    for (const release of fresh) {
      try {
        const outcome = await processRelease(repo, release, "poll");
        if (outcome.inserted) result.inserted++;
        if (outcome.escalated) result.escalated++;
      } catch (error) {
        // Not cached, so the next run retries it.
        failures.push(`${release.tag_name}: ${(error as Error).message}`);
      }
    }
    // Anything that failed (or was over the batch cap) is still uncached, so it stays pending.
    result.remaining = pending.length - result.inserted;
    if (failures.length > 0) {
      result.error = `${failures.length} release(s) not analysed — ${failures[0]}`;
    }
  } catch (error) {
    result.error = (error as Error).message;
  }
  await markSynced(repo.id, result.error ?? null);
  return result;
}

/**
 * Fetches recent GitHub releases for every active repository (or a single one),
 * passes each new release through Gemini Flash, and caches the structured result
 * in Neon. Idempotent: releases already cached are skipped without calling Gemini.
 */
export async function runIngestion(
  options: { days?: number; repositoryId?: number; backfill?: boolean } = {},
): Promise<IngestReport> {
  if (!isGeminiConfigured()) {
    throw new ConfigError("GEMINI_API_KEY is not set. Add it to .env.local (or the Vercel project's environment variables).");
  }
  const startedAt = new Date().toISOString();
  const days = options.days ?? DEFAULT_WINDOW_DAYS;

  let repos: Repository[];
  if (options.repositoryId !== undefined) {
    const repo = await getRepository(options.repositoryId);
    if (!repo) throw new HttpError(404, "Repository not found.");
    repos = [repo];
  } else {
    repos = (await listRepositories()).filter((repo) => repo.isActive);
  }

  const results = await mapWithConcurrency(repos, CONCURRENCY, (repo) => ingestRepository(repo, days, options.backfill === true));
  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    reposProcessed: results.length,
    inserted: results.reduce((sum, r) => sum + r.inserted, 0),
    escalated: results.reduce((sum, r) => sum + r.escalated, 0),
    remaining: results.reduce((sum, r) => sum + r.remaining, 0),
    reposWithErrors: results.filter((r) => r.error).length,
    results,
  };
}
