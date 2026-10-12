import { HttpError } from "@/lib/errors";
import { listFeedback, submitFeedback } from "@/lib/feedback";
import { fail, json, parseId, readJson } from "@/lib/http";
import { EFFORT_SCORES, SECURITY_SEVERITIES, type FeedbackInput } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/feedback
 *   { releaseId, securitySeverity?, isBreakingChange?, isNoise?, effortScore?, note? }
 * Logs Keerthi's correction to Gemini's classification, applies it to the card,
 * and returns the updated release. Omitted fields are left unchanged.
 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const input: FeedbackInput = { releaseId: parseId(String(body.releaseId ?? "")) };

    if (body.securitySeverity !== undefined) {
      if (!(SECURITY_SEVERITIES as readonly unknown[]).includes(body.securitySeverity)) {
        throw new HttpError(400, `securitySeverity must be one of: ${SECURITY_SEVERITIES.join(", ")}.`);
      }
      input.securitySeverity = body.securitySeverity as FeedbackInput["securitySeverity"];
    }
    if (body.effortScore !== undefined) {
      if (!(EFFORT_SCORES as readonly unknown[]).includes(body.effortScore)) {
        throw new HttpError(400, `effortScore must be one of: ${EFFORT_SCORES.join(", ")}.`);
      }
      input.effortScore = body.effortScore as FeedbackInput["effortScore"];
    }
    for (const flag of ["isBreakingChange", "isNoise"] as const) {
      if (body[flag] !== undefined) {
        if (typeof body[flag] !== "boolean") throw new HttpError(400, `${flag} must be a boolean.`);
        input[flag] = body[flag] as boolean;
      }
    }
    if (body.note !== undefined) {
      if (typeof body.note !== "string") throw new HttpError(400, "note must be a string.");
      input.note = body.note;
    }

    return json({ release: await submitFeedback(input) });
  } catch (error) {
    return fail(error);
  }
}

/** GET /api/feedback[?limit=50] — the correction log, newest first. */
export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get("limit");
    const limit = raw === null ? 50 : Number(raw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new HttpError(400, "limit must be an integer from 1 to 200.");
    }
    return json({ feedback: await listFeedback(limit) });
  } catch (error) {
    return fail(error);
  }
}
