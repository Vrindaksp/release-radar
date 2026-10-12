import { HttpError } from "@/lib/errors";
import { fail, json, parseId } from "@/lib/http";
import { getReleaseNotes } from "@/lib/releases";

export const dynamic = "force-dynamic";

/** GET /api/releases/:id/notes — the original GitHub release notes behind a summary (plain text, capped). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    const result = await getReleaseNotes(id);
    if (!result) throw new HttpError(404, "Release not found.");
    return json(result);
  } catch (error) {
    return fail(error);
  }
}
