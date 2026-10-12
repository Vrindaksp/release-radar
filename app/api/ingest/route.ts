import { timingSafeEqual } from "node:crypto";
import { ConfigError, HttpError } from "@/lib/errors";
import { fail, json, parseId, readJson } from "@/lib/http";
import { DEFAULT_WINDOW_DAYS, runIngestion } from "@/lib/ingest";

export const dynamic = "force-dynamic";
// Ingestion fans out to GitHub + Gemini; give it room (Vercel clamps to the plan's limit).
export const maxDuration = 300;

/** Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. */
function authorizeCron(request: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new ConfigError("CRON_SECRET is not set; refusing to run the scheduled ingest unauthenticated.");
    }
    return; // local development
  }
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(401, "Unauthorized.");
  }
}

/** A routine sync looks back at most 90 days; a backfill may reach a full year. */
function parseDays(raw: unknown, max = 90): number {
  if (raw === undefined || raw === null || raw === "") return DEFAULT_WINDOW_DAYS;
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > max) {
    throw new HttpError(400, `days must be an integer from 1 to ${max}.`);
  }
  return days;
}

/**
 * GET /api/ingest[?days=7] — the weekly cron entry point (see vercel.json:
 * Mondays 12:00 UTC). Protected by CRON_SECRET.
 */
export async function GET(request: Request) {
  try {
    authorizeCron(request);
    const days = parseDays(new URL(request.url).searchParams.get("days"));
    return json(await runIngestion({ days }));
  } catch (error) {
    return fail(error);
  }
}

/**
 * POST /api/ingest  { repositoryId?, days?, backfill? } — manual sync from the dashboard.
 *
 * With `backfill: true` it loads older release history (up to 365 days) in batches of
 * 10 per repository per call; call again while `remaining` in the response is above 0.
 * Backfilled releases older than 30 days go to the archive and never trigger alerts.
 *
 * Idempotent: only releases that are not cached yet reach Gemini. The route sits behind
 * the dashboard password (proxy.ts).
 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const repositoryId = body.repositoryId === undefined ? undefined : parseId(String(body.repositoryId));
    if (body.backfill !== undefined && typeof body.backfill !== "boolean") {
      throw new HttpError(400, "backfill must be a boolean.");
    }
    const backfill = body.backfill === true;
    return json(await runIngestion({ days: parseDays(body.days, backfill ? 365 : 90), repositoryId, backfill }));
  } catch (error) {
    return fail(error);
  }
}
