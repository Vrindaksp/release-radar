import { db } from "./db";
import { HttpError } from "./errors";
import { getRelease } from "./releases";
import { defaultColumnFor } from "./triage";
import type {
  CalibrationExample,
  ClassificationSnapshot,
  EffortScore,
  FeedbackEntry,
  FeedbackInput,
  Release,
  SecuritySeverity,
  Tier,
} from "./types";

/**
 * AI feedback tuning loop.
 *
 * 1. Keerthi corrects a card (severity / breaking / noise / effort).
 * 2. `submitFeedback` logs the before/after in `release_feedback` and applies the
 *    correction to the card (moving it between columns if the new flags warrant).
 * 3. `loadCalibrationExamples` replays the most recent corrections — same
 *    repository first — inside the next Gemini prompt, so the model learns what
 *    counts as noise / breaking / critical *for this team* and alert fatigue drops.
 */

type Row = Record<string, unknown>;

const EXCERPT_CHARS = 400;
/** How many past corrections are replayed per analysis (keeps the prompt small). */
const CALIBRATION_LIMIT = 6;

const excerpt = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, EXCERPT_CHARS);

const snapshot = (row: Row, prefix: "ai" | "corrected"): ClassificationSnapshot => ({
  securitySeverity: String(row[`${prefix}_security_severity`]) as SecuritySeverity,
  isBreakingChange: Boolean(row[`${prefix}_is_breaking_change`]),
  isNoise: Boolean(row[`${prefix}_is_noise`]),
  effortScore: String(row[`${prefix}_effort_score`]) as EffortScore,
});

/**
 * Records a correction and applies it to the release. Fields left out of
 * `input` keep their current value; at least one must actually change.
 */
export async function submitFeedback(input: FeedbackInput): Promise<Release> {
  const sql = await db();
  const rows = await sql`
    select r.id, r.ai_source, r.raw_notes, r.gemini_summary, r.is_breaking_change, r.is_noise,
           r.effort_score, r.security_severity, p.repo_name, p.tier
      from releases r join repositories p on p.id = r.repository_id
     where r.id = ${input.releaseId}`;
  const row = rows[0];
  if (!row) throw new HttpError(404, "Release not found.");
  if (row.ai_source === "seed") {
    throw new HttpError(400, "Sample releases are fictional and can't be used to tune Gemini.");
  }

  const before: ClassificationSnapshot = {
    securitySeverity: String(row.security_severity) as SecuritySeverity,
    isBreakingChange: Boolean(row.is_breaking_change),
    isNoise: Boolean(row.is_noise),
    effortScore: String(row.effort_score) as EffortScore,
  };
  const after: ClassificationSnapshot = {
    securitySeverity: input.securitySeverity ?? before.securitySeverity,
    isBreakingChange: input.isBreakingChange ?? before.isBreakingChange,
    isNoise: input.isNoise ?? before.isNoise,
    effortScore: input.effortScore ?? before.effortScore,
  };
  const isSecurityFix = after.securitySeverity !== "none";

  // Marking something a security fix / breaking change implicitly un-marks "noise".
  if (input.isNoise === undefined && (isSecurityFix || after.isBreakingChange)) after.isNoise = false;
  if (after.isNoise && (isSecurityFix || after.isBreakingChange)) {
    throw new HttpError(400, "A release with a security fix or breaking change can't also be routine noise.");
  }
  if (JSON.stringify(before) === JSON.stringify(after)) {
    throw new HttpError(400, "No changes to submit — adjust at least one field.");
  }

  const note = input.note?.trim() ? input.note.trim().slice(0, 280) : null;
  const notesExcerpt = excerpt(typeof row.raw_notes === "string" && row.raw_notes ? row.raw_notes : String(row.gemini_summary));

  // Log first: the correction is the valuable part, even if the card update fails.
  await sql`
    insert into release_feedback (
      release_id, repo_name, version_tag, tier, notes_excerpt,
      ai_security_severity, ai_is_breaking_change, ai_is_noise, ai_effort_score, ai_summary,
      corrected_security_severity, corrected_is_breaking_change, corrected_is_noise, corrected_effort_score,
      note
    )
    select r.id, p.repo_name, r.version_tag, p.tier, ${notesExcerpt},
           ${before.securitySeverity}, ${before.isBreakingChange}, ${before.isNoise}, ${before.effortScore}, r.gemini_summary,
           ${after.securitySeverity}, ${after.isBreakingChange}, ${after.isNoise}, ${after.effortScore},
           ${note}
      from releases r join repositories p on p.id = r.repository_id
     where r.id = ${input.releaseId}`;

  // Apply it. A card still sitting where the AI put it is re-homed; one Keerthi
  // already moved by hand (e.g. archived) stays put.
  const column = defaultColumnFor({ isSecurityFix, isBreakingChange: after.isBreakingChange, isNoise: after.isNoise });
  await sql`
    update releases set
      is_security_fix    = ${isSecurityFix},
      security_severity  = ${after.securitySeverity}::text,
      security_impact    = case when ${after.securitySeverity}::text = 'none' then 'Low' else security_impact end,
      is_breaking_change = ${after.isBreakingChange},
      is_noise           = ${after.isNoise},
      effort_score       = ${after.effortScore},
      user_corrected     = true,
      triage_column      = case when triage_column = default_column then ${column}::text else triage_column end,
      default_column     = ${column}::text
    where id = ${input.releaseId}`;

  const updated = await getRelease(input.releaseId);
  if (!updated) throw new HttpError(404, "Release not found.");
  return updated;
}

/** Most recent corrections, newest first. */
export async function listFeedback(limit = 50): Promise<FeedbackEntry[]> {
  const sql = await db();
  const rows = await sql`select * from release_feedback order by created_at desc, id desc limit ${limit}`;
  return rows.map((row) => ({
    id: Number(row.id),
    repoName: String(row.repo_name),
    versionTag: String(row.version_tag),
    tier: Number(row.tier) as Tier,
    ai: snapshot(row, "ai"),
    corrected: snapshot(row, "corrected"),
    note: (row.note as string | null) ?? null,
    createdAt: new Date(row.created_at as string | Date).toISOString(),
  }));
}

/**
 * Past corrections to show Gemini before it analyses a release for `repoName`:
 * that repository's corrections first, then the most recent ones overall.
 */
export async function loadCalibrationExamples(repoName: string, limit = CALIBRATION_LIMIT): Promise<CalibrationExample[]> {
  const sql = await db();
  const rows = await sql`
    select * from release_feedback
     order by (lower(repo_name) = lower(${repoName})) desc, created_at desc, id desc
     limit ${limit}`;
  return rows.map((row) => ({
    repoName: String(row.repo_name),
    versionTag: String(row.version_tag),
    notesExcerpt: String(row.notes_excerpt),
    ai: snapshot(row, "ai"),
    corrected: snapshot(row, "corrected"),
    note: (row.note as string | null) ?? null,
  }));
}
