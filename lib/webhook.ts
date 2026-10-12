import { createHmac, timingSafeEqual } from "node:crypto";
import type { GitHubRelease } from "./github";

/**
 * GitHub webhook helpers: signature verification and payload extraction.
 * (The route handler lives in app/api/webhook/github/route.ts.)
 */

/**
 * Verifies GitHub's `X-Hub-Signature-256` header (`sha256=<hex HMAC of the raw
 * body>`) in constant time. Must be given the *raw* request body.
 */
export function verifySignature(secret: string, rawBody: string, header: string | null): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Release actions that put a release in front of users. */
const ACTIONS = new Set(["published", "released"]);

export type ParsedReleaseEvent =
  | { kind: "release"; repoName: string; release: GitHubRelease }
  | { kind: "ignored"; reason: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Extracts the bits of a `release` webhook payload that matter — tag, title,
 * notes, flags — and rejects anything malformed. Only the release object goes
 * to Gemini, not the whole payload: the rest (sender, repo metadata, URLs) is
 * noise that would only cost tokens and widen the prompt-injection surface.
 */
export function parseReleaseEvent(payload: unknown): ParsedReleaseEvent {
  if (!isObject(payload)) return { kind: "ignored", reason: "payload is not a JSON object" };
  if (typeof payload.action !== "string" || !ACTIONS.has(payload.action)) {
    return { kind: "ignored", reason: `release action "${String(payload.action)}" is not a publication` };
  }
  const repo = payload.repository;
  const release = payload.release;
  if (!isObject(repo) || typeof repo.full_name !== "string") {
    return { kind: "ignored", reason: "payload has no repository.full_name" };
  }
  if (
    !isObject(release) ||
    typeof release.id !== "number" ||
    typeof release.tag_name !== "string" ||
    !release.tag_name ||
    typeof release.html_url !== "string" ||
    typeof release.published_at !== "string" ||
    Number.isNaN(Date.parse(release.published_at))
  ) {
    return { kind: "ignored", reason: "payload has no usable release object" };
  }
  return {
    kind: "release",
    repoName: repo.full_name,
    release: {
      id: release.id,
      tag_name: release.tag_name,
      name: typeof release.name === "string" ? release.name : null,
      html_url: release.html_url,
      body: typeof release.body === "string" ? release.body : null,
      draft: release.draft === true,
      prerelease: release.prerelease === true,
      published_at: release.published_at,
    },
  };
}
