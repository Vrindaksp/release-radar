import { after } from "next/server";
import { ConfigError, HttpError } from "@/lib/errors";
import { fail, json } from "@/lib/http";
import { processRelease, shouldTrackRelease } from "@/lib/ingest";
import { releaseExists } from "@/lib/releases";
import { findActiveRepository } from "@/lib/repos";
import { parseReleaseEvent, verifySignature } from "@/lib/webhook";

export const dynamic = "force-dynamic";
// The Gemini analysis + Slack alert run after the 202 response; give them room.
export const maxDuration = 60;

/**
 * POST /api/webhook/github — GitHub `release` webhook.
 *
 * Setup (repo or org → Settings → Webhooks → Add webhook):
 *   Payload URL   https://<your-app>/api/webhook/github
 *   Content type  application/json
 *   Secret        the value of GITHUB_WEBHOOK_SECRET
 *   Events        "Releases" only
 *
 * The request is authenticated by HMAC signature, validated, and acknowledged
 * with 202 immediately (GitHub gives up after 10 seconds); the Gemini analysis,
 * Neon write and emergency-escalation check then run in the background via
 * `after()`. If that background work fails, nothing is cached and the next
 * scheduled/manual sync picks the release up — the webhook only makes it faster.
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      throw new ConfigError("GITHUB_WEBHOOK_SECRET is not set; refusing to accept unauthenticated webhooks.");
    }

    const rawBody = await request.text(); // signature is computed over the exact bytes
    if (!verifySignature(secret, rawBody, request.headers.get("x-hub-signature-256"))) {
      throw new HttpError(401, "Invalid webhook signature.");
    }

    const event = request.headers.get("x-github-event");
    if (event === "ping") return json({ ok: true, message: "pong" });
    if (event !== "release") return json({ ok: true, ignored: `event "${event}" is not handled` });

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new HttpError(400, "Payload is not valid JSON.");
    }

    const parsed = parseReleaseEvent(payload);
    if (parsed.kind === "ignored") return json({ ok: true, ignored: parsed.reason });

    const repo = await findActiveRepository(parsed.repoName);
    if (!repo) return json({ ok: true, ignored: `${parsed.repoName} is not a tracked repository` });
    if (!shouldTrackRelease(repo, parsed.release)) {
      return json({ ok: true, ignored: "draft, or a prerelease of a tier 1 repository" });
    }
    if (await releaseExists(repo.id, parsed.release.tag_name)) {
      return json({ ok: true, ignored: "release is already cached" });
    }

    const delivery = request.headers.get("x-github-delivery");
    after(async () => {
      try {
        const outcome = await processRelease(repo, parsed.release, "webhook");
        console.log(
          `[webhook] ${repo.repoName} ${parsed.release.tag_name} delivery=${delivery}: ` +
            `${outcome.inserted ? "cached" : "already cached"}${outcome.escalated ? ", emergency alert sent" : ""}`,
        );
      } catch (error) {
        console.error(
          `[webhook] ${repo.repoName} ${parsed.release.tag_name} delivery=${delivery} failed: ${(error as Error).message}`,
        );
      }
    });
    return json({ ok: true, accepted: `${repo.repoName} ${parsed.release.tag_name}` }, 202);
  } catch (error) {
    return fail(error);
  }
}
