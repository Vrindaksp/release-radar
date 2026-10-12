import seed from "@/db/seed.json";
import { db } from "./db";
import { defaultColumnFor } from "./triage";
import {
  EFFORT_SCORES,
  TIERS,
  TRIAGE_COLUMNS,
  type EffortScore,
  type SecurityImpact,
  type SecuritySeverity,
  type Tier,
  type TriageColumn,
} from "./types";

/**
 * Loads the sample dataset from db/seed.json so the board renders immediately.
 * Idempotent (ON CONFLICT DO NOTHING). Sample releases are tagged ai_source =
 * 'seed' so the UI can label them and they can be removed again — they are
 * fictional and must not be mistaken for real advisories.
 */
export async function loadSeedData(): Promise<{ repositories: number; releases: number }> {
  const sql = await db();
  let repositories = 0;
  let releases = 0;

  for (const repo of seed.seed_repositories) {
    const tier = (TIERS as readonly number[]).includes(repo.tier) ? (repo.tier as Tier) : 2;
    const rows = await sql`
      insert into repositories (repo_name, category, tier, is_active, html_url)
      values (${repo.repo_name}, ${repo.category}, ${tier}, ${repo.is_active}, ${`https://github.com/${repo.repo_name}`})
      on conflict (lower(repo_name)) do nothing
      returning id`;
    repositories += rows.length;
  }

  for (const release of seed.seed_releases) {
    const effort: EffortScore = (EFFORT_SCORES as readonly string[]).includes(release.effort_score)
      ? (release.effort_score as EffortScore)
      : "Low";
    const column: TriageColumn = (TRIAGE_COLUMNS as readonly string[]).includes(release.triage_column)
      ? (release.triage_column as TriageColumn)
      : defaultColumnFor({
          isSecurityFix: release.is_security_fix,
          isBreakingChange: release.is_breaking_change,
          isNoise: false,
        });
    // The seed predates severity ratings: derive plausible ones from its own wording.
    const severity: SecuritySeverity = !release.is_security_fix
      ? "none"
      : /critical/i.test(release.gemini_summary)
        ? "critical"
        : "high";
    const impact: SecurityImpact = release.is_security_fix ? "High" : "Low";
    const rows = await sql`
      insert into releases (
        repository_id, version_tag, published_at, gemini_summary, effort_score,
        is_security_fix, security_severity, security_impact, is_breaking_change,
        ai_source, default_column, triage_column
      )
      select p.id, ${release.version_tag}, ${release.published_at}::timestamptz, ${release.gemini_summary},
             ${effort}, ${release.is_security_fix}::boolean, ${severity}, ${impact},
             ${release.is_breaking_change}::boolean,
             'seed', ${column}, ${column}
        from repositories p
       where lower(p.repo_name) = lower(${release.repo_name})
      on conflict (repository_id, version_tag) do nothing
      returning id`;
    releases += rows.length;
  }

  return { repositories, releases };
}

/** Removes the fictional sample releases (the sample repositories are kept). */
export async function clearSampleReleases(): Promise<number> {
  const sql = await db();
  const rows = await sql`delete from releases where ai_source = 'seed' returning id`;
  return rows.length;
}
