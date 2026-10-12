import { NextResponse } from "next/server";
import { GeminiError, GitHubError, HttpError } from "./errors";

/** JSON success response. */
export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Maps any thrown value onto a JSON error response. */
export function fail(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof GitHubError) {
    const status = error.status === 404 ? 404 : error.status === 429 ? 429 : 502;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (error instanceof GeminiError) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  console.error("[api] unexpected error", error);
  const detail =
    process.env.NODE_ENV !== "production" && error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: detail }, { status: 500 });
}

/** Reads a JSON object body, or throws a 400. Empty bodies yield `{}`. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  throw new HttpError(400, "Request body must be a JSON object.");
}

/** Parses a positive integer route parameter, or throws a 400. */
export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, "Invalid id.");
  return id;
}
