import { db } from "./db";
import type { ReleaseAnalysis } from "./gemini";
import { defaultColumnFor } from "./triage";
import {
  TRIAGE_COLUMNS,
  type AiSource,
  type DashboardStats,
  type EffortScore,
  type IngestSource,
  type Release,
  type SecurityImpact,
  type SecuritySeverity,
  type Tier,
  type TriageColumn,
} from "./types";

type Row = Record<string, unknown>;

export const isColumn = (value: unknown): value is TriageColumn =>
  typeof value === "string" && (TRIAGE_COLUMNS as readonly string[]).includes(value);

function toStringArray(value: unknown): string[] {
  const parsed = typeof value === "string" ? safeParse(value) : value;
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

/** Only ever link out to GitHub; anything else stored in the DB is ignored. */
function safeGitHubUrl(url: unknown, fallback: string): string {
  return typeof url === "string" && /^https:\/\/github\.com\//i.test(url) ? url : fallback;
}

export function mapRelease(row: Row): Release {
  const repoName = String(row.repo_name);
  const aiSource = String(row.ai_source) as AiSource;
  const fallbackUrl =
    aiSource === "seed"
      ? `https://github.com/${repoName}/releases`
      : `https://github.com/${repoName}/releases/tag/${encodeURIComponent(String(row.version_tag))}`;
  return {
    id: Number(row.id),
    repositoryId: Number(row.repository_id),
    repoName,
    category: String(row.category),
    tier: Number(row.tier) as Tier,
    versionTag: String(row.version_tag),
    releaseName: (row.release_name as string | null) ?? null,
    htmlUrl: safeGitHubUrl(row.html_url, fallbackUrl),
    publishedAt: new Date(row.published_at as string | Date).toISOString(),
    geminiSummary: String(row.gemini_summary),
    highlights: toStringArray(row.highlights),
    recommendedAction: (row.recommended_action as string | null) || null,
    advisoryIds: toStringArray(row.advisory_ids),
    effortScore: String(row.effort_score) as EffortScore,
    isSecurityFix: Boolean(row.is_security_fix),
    securitySeverity: String(row.security_severity) as SecuritySeverity,
    securityImpact: String(row.security_impact) as SecurityImpact,
    isBreakingChange: Boolean(row.is_breaking_change),
    isNoise: Boolean(row.is_noise),
    triageColumn: row.triage_column as TriageColumn,
    defaultColumn: row.default_column as TriageColumn,
    aiSource,
    ingestSource: row.ingest_source === "webhook" ? "webhook" : "poll",
    userCorrected: Boolean(row.user_corrected),
    emergencyAt: row.emergency_at ? new Date(row.emergency_at as string | Date).toISOString() : null,
    escalatedAt: row.escalated_at ? new Date(row.escalated_at as string | Date).toISOString() : null,
    escalationError: (row.escalation_error as string | null) ?? null,
    isSample: aiSource === "seed",
  };
}

// raw_notes is cached for reference but deliberately not sent to the browser.
export const RELEASE_COLUMNS = `
  r.id, r.repository_id, r.version_tag, r.release_name, r.html_url, r.published_at,
  r.gemini_summary, r.highlights, r.recommended_action, r.advisory_ids, r.effort_score,
  r.is_security_fix, r.security_severity, r.security_impact, r.is_breaking_change, r.is_noise,
  r.ai_source, r.ingest_source, r.user_corrected, r.emergency_at, r.escalated_at, r.escalation_error,
  r.default_column, r.triage_column,
  p.repo_name, p.category, p.tier`;

/**
 * Everything the board shows: all open items (Immediate / Watchlist) from active
 * repositories, plus a year of the archive (which is where backfilled history lives).
 */
export async function listReleases(): Promise<Release[]> {
  const sql = await db();
  const rows = await sql.query(
    `select ${RELEASE_COLUMNS}
       from releases r
       join repositories p on p.id = r.repository_id
      where p.is_active
        and (r.triage_column <> 'Archived / Cleaned' or r.published_at > now() - interval '365 days')
      order by r.published_at desc
      limit 800`,
  );
  return (rows as Row[]).map(mapRelease);
}

export async function getStats(): Promise<DashboardStats> {
  const sql = await db();
  const [row] = await sql`
    select
      (select count(*)::int from repositories where is_active)  as repos_monitored,
      (select max(last_synced_at) from repositories)            as last_synced_at,
      count(*) filter (where r.triage_column = 'Immediate Triage')::int                            as immediate_count,
      count(*) filter (where r.is_security_fix and r.triage_column <> 'Archived / Cleaned')::int   as security_count,
      count(*) filter (where r.is_breaking_change and r.triage_column <> 'Archived / Cleaned')::int as breaking_count,
      count(*) filter (where r.ai_source = 'seed')::int                                            as sample_count
    from releases r
    join repositories p on p.id = r.repository_id
    where p.is_active`;
  return {
    reposMonitored: Number(row.repos_monitored),
    immediateCount: Number(row.immediate_count),
    securityCount: Number(row.security_count),
    breakingCount: Number(row.breaking_count),
    sampleReleaseCount: Number(row.sample_count),
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at as string | Date).toISOString() : null,
  };
}

/** Moves a card between columns (triage). Returns null if the release doesn't exist. */
export async function setTriageColumn(id: number, column: TriageColumn): Promise<Release | null> {
  const sql = await db();
  const updated = await sql`
    update releases set triage_column = ${column}, triaged_at = now()
    where id = ${id}
    returning id`;
  if (!updated[0]) return null;
  return getRelease(id);
}

/** Version tags already cached for a repository — these are never re-analysed. */
export async function cachedVersionTags(repositoryId: number): Promise<Set<string>> {
  const sql = await db();
  const rows = await sql`select version_tag from releases where repository_id = ${repositoryId}`;
  return new Set(rows.map((row) => String(row.version_tag)));
}

/** Whether a release tag is already cached for the repository. */
export async function releaseExists(repositoryId: number, versionTag: string): Promise<boolean> {
  const sql = await db();
  const rows = await sql`
    select 1 from releases where repository_id = ${repositoryId} and version_tag = ${versionTag}`;
  return rows.length > 0;
}

export interface NewRelease {
  repositoryId: number;
  githubReleaseId: number;
  versionTag: string;
  releaseName: string | null;
  htmlUrl: string;
  rawNotes: string | null;
  publishedAt: string;
  analysis: ReleaseAnalysis;
  ingestSource: IngestSource;
  /** Force the starting column (backfilled history goes straight to the archive). */
  startColumn?: TriageColumn;
}

/**
 * Caches an analysed release and tags it for triage. Returns the new row id, or
 * null if (repository, tag) already existed — e.g. a webhook redelivery, or a
 * webhook racing the weekly poll. `default_column` always records the AI's
 * suggestion, so "Restore" works even for archived history.
 */
export async function insertRelease(input: NewRelease): Promise<number | null> {
  const sql = await db();
  const { analysis } = input;
  const defaultColumn = defaultColumnFor(analysis);
  const column = input.startColumn ?? defaultColumn;
  const rows = await sql`
    insert into releases (
      repository_id, github_release_id, version_tag, release_name, html_url, raw_notes, published_at,
      gemini_summary, highlights, recommended_action, advisory_ids, effort_score,
      is_security_fix, security_severity, security_impact, is_breaking_change, is_noise,
      ai_source, ingest_source, default_column, triage_column
    ) values (
      ${input.repositoryId}, ${input.githubReleaseId}, ${input.versionTag}, ${input.releaseName},
      ${input.htmlUrl}, ${input.rawNotes}, ${input.publishedAt},
      ${analysis.summary}, ${JSON.stringify(analysis.highlights)}::jsonb, ${analysis.recommendedAction},
      ${JSON.stringify(analysis.advisoryIds)}::jsonb, ${analysis.effort},
      ${analysis.isSecurityFix}, ${analysis.securitySeverity}, ${analysis.securityImpact},
      ${analysis.isBreakingChange}, ${analysis.isNoise},
      ${analysis.source}, ${input.ingestSource}, ${defaultColumn}, ${column}
    )
    on conflict (repository_id, version_tag) do nothing
    returning id`;
  return rows[0] ? Number(rows[0].id) : null;
}

/**
 * Records that the emergency rule fired for a release (this alone puts it in the
 * dashboard's emergency banner) and how external delivery went: `delivered` if at
 * least one channel (Slack / ntfy) got it through, `error` if a configured channel failed.
 */
export async function recordEmergency(id: number, outcome: { delivered: boolean; error: string | null }): Promise<void> {
  const sql = await db();
  await sql`
    update releases set
      emergency_at = coalesce(emergency_at, now()),
      escalated_at = case when ${outcome.delivered}::boolean then now() else null end,
      escalation_error = ${outcome.error}::text
    where id = ${id}`;
}

export async function getRelease(id: number): Promise<Release | null> {
  const sql = await db();
  const rows = await sql.query(
    `select ${RELEASE_COLUMNS} from releases r join repositories p on p.id = r.repository_id where r.id = $1`,
    [id],
  );
  return rows[0] ? mapRelease(rows[0] as Row) : null;
}
