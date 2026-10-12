import { db } from "./db";
import type { Repository, Tier } from "./types";

type Row = Record<string, unknown>;

const iso = (value: unknown): string | null =>
  value == null ? null : new Date(value as string | number | Date).toISOString();

export function mapRepository(row: Row): Repository {
  const repoName = String(row.repo_name);
  return {
    id: Number(row.id),
    repoName,
    category: String(row.category),
    tier: Number(row.tier) as Tier,
    isActive: Boolean(row.is_active),
    description: (row.description as string | null) ?? null,
    htmlUrl: (row.html_url as string | null) ?? `https://github.com/${repoName}`,
    lastSyncedAt: iso(row.last_synced_at),
    lastSyncError: (row.last_sync_error as string | null) ?? null,
    createdAt: iso(row.created_at)!,
  };
}

export async function listRepositories(): Promise<Repository[]> {
  const sql = await db();
  const rows = await sql`select * from repositories order by tier, lower(repo_name)`;
  return rows.map(mapRepository);
}

export async function getRepository(id: number): Promise<Repository | null> {
  const sql = await db();
  const rows = await sql`select * from repositories where id = ${id}`;
  return rows[0] ? mapRepository(rows[0]) : null;
}

/** An *active* repository by "owner/repo" (case-insensitive) — used to match webhook payloads. */
export async function findActiveRepository(repoName: string): Promise<Repository | null> {
  const sql = await db();
  const rows = await sql`
    select * from repositories where lower(repo_name) = lower(${repoName}) and is_active`;
  return rows[0] ? mapRepository(rows[0]) : null;
}

export interface NewRepository {
  repoName: string;
  category: string;
  tier: Tier;
  description: string | null;
  htmlUrl: string;
}

/** Inserts a repository. Returns null if it is already tracked (case-insensitive). */
export async function createRepository(input: NewRepository): Promise<Repository | null> {
  const sql = await db();
  const rows = await sql`
    insert into repositories (repo_name, category, tier, description, html_url)
    values (${input.repoName}, ${input.category}, ${input.tier}, ${input.description}, ${input.htmlUrl})
    on conflict (lower(repo_name)) do nothing
    returning *`;
  return rows[0] ? mapRepository(rows[0]) : null;
}

export interface RepositoryPatch {
  category?: string;
  tier?: Tier;
  isActive?: boolean;
}

/** Applies only the provided fields. Returns null if the repository doesn't exist. */
export async function updateRepository(id: number, patch: RepositoryPatch): Promise<Repository | null> {
  const sql = await db();
  const rows = await sql`
    update repositories set
      category  = coalesce(${patch.category ?? null}, category),
      tier      = coalesce(${patch.tier ?? null}::smallint, tier),
      is_active = coalesce(${patch.isActive ?? null}::boolean, is_active)
    where id = ${id}
    returning *`;
  return rows[0] ? mapRepository(rows[0]) : null;
}

/** Deletes a repository; its cached releases go with it (ON DELETE CASCADE). */
export async function deleteRepository(id: number): Promise<boolean> {
  const sql = await db();
  const rows = await sql`delete from repositories where id = ${id} returning id`;
  return rows.length > 0;
}

export async function markSynced(id: number, error: string | null): Promise<void> {
  const sql = await db();
  await sql`update repositories set last_synced_at = now(), last_sync_error = ${error} where id = ${id}`;
}
