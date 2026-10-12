/**
 * Postgres schema, applied idempotently on the first request after a cold start
 * (see lib/db.ts). Every statement is `IF NOT EXISTS`, so it is safe to run on
 * every deploy. db/schema.sql is a copy of this DDL for running by hand in the
 * Neon SQL editor — keep the two in sync.
 *
 * Table / column names follow the seed dataset in db/seed.json.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `create table if not exists repositories (
    id              bigint generated always as identity primary key,
    repo_name       text        not null,                 -- "owner/repo"
    category        text        not null default 'Uncategorized',
    tier            smallint    not null default 2 check (tier between 1 and 3),
    is_active       boolean     not null default true,
    description     text,
    html_url        text,
    last_synced_at  timestamptz,
    last_sync_error text,
    created_at      timestamptz not null default now()
  )`,

  // GitHub names are case-insensitive, so uniqueness is too.
  `create unique index if not exists repositories_repo_name_key
     on repositories (lower(repo_name))`,

  `create table if not exists releases (
    id                 bigint generated always as identity primary key,
    repository_id      bigint      not null references repositories (id) on delete cascade,
    github_release_id  bigint,
    version_tag        text        not null,
    release_name       text,
    html_url           text,
    raw_notes          text,                              -- cached GitHub release body
    published_at       timestamptz not null,

    -- Gemini Flash output
    gemini_summary     text        not null,
    highlights         jsonb       not null default '[]'::jsonb,
    recommended_action text,
    advisory_ids       jsonb       not null default '[]'::jsonb,
    effort_score       text        not null default 'Low'
                         check (effort_score in ('Low', 'Medium', 'High')),
    is_security_fix    boolean     not null default false,
    is_breaking_change boolean     not null default false,
    is_noise           boolean     not null default false,
    ai_source          text        not null default 'gemini'
                         check (ai_source in ('gemini', 'heuristic', 'seed')),

    -- Triage state. default_column is what the AI suggested; triage_column is
    -- where the card currently sits after Keerthi moves / dismisses it.
    default_column     text        not null
                         check (default_column in ('Immediate Triage', 'Watchlist Radar', 'Archived / Cleaned')),
    triage_column      text        not null
                         check (triage_column in ('Immediate Triage', 'Watchlist Radar', 'Archived / Cleaned')),
    triaged_at         timestamptz,

    created_at         timestamptz not null default now(),
    unique (repository_id, version_tag)
  )`,

  `create index if not exists releases_board_idx
     on releases (triage_column, published_at desc)`,

  // ---- v2 (additive): webhook ingestion, severity, emergency escalation, feedback ----
  `alter table releases
     add column if not exists ingest_source     text    not null default 'poll'
       check (ingest_source in ('poll', 'webhook')),
     add column if not exists security_severity text    not null default 'none'
       check (security_severity in ('none', 'low', 'moderate', 'high', 'critical')),
     add column if not exists security_impact   text    not null default 'Low'
       check (security_impact in ('Low', 'Medium', 'High')),
     add column if not exists user_corrected    boolean not null default false,
     add column if not exists emergency_at      timestamptz,
     add column if not exists escalated_at      timestamptz,
     add column if not exists escalation_error  text`,

  // Rows written before severity existed: a flagged security fix is at least "high".
  `update releases set security_severity = 'high'
    where is_security_fix and security_severity = 'none'`,

  // Keerthi's corrections to Gemini's classification. Denormalised on purpose so
  // the log survives even if the repository (and its releases) are later removed.
  `create table if not exists release_feedback (
    id                         bigint generated always as identity primary key,
    release_id                 bigint references releases (id) on delete set null,
    repo_name                  text        not null,
    version_tag                text        not null,
    tier                       smallint    not null default 2,
    notes_excerpt              text        not null default '',
    ai_security_severity       text        not null,
    ai_is_breaking_change      boolean     not null,
    ai_is_noise                boolean     not null,
    ai_effort_score            text        not null,
    ai_summary                 text,
    corrected_security_severity  text      not null,
    corrected_is_breaking_change boolean   not null,
    corrected_is_noise           boolean   not null,
    corrected_effort_score       text      not null,
    note                       text,
    created_at                 timestamptz not null default now()
  )`,

  // Small key/value store for settings edited in the UI (e.g. alert email recipients).
  `create table if not exists settings (
    key        text        primary key,
    value      jsonb       not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
  )`,

  `create index if not exists release_feedback_recent_idx
     on release_feedback (created_at desc)`,
];
