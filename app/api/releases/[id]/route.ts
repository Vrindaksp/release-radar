import { HttpError } from "@/lib/errors";
import { fail, json, parseId, readJson } from "@/lib/http";
import { isColumn, setTriageColumn } from "@/lib/releases";

export const dynamic = "force-dynamic";

/** PATCH /api/releases/:id  { triageColumn } — move a card between columns. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    const body = await readJson(request);
    if (!isColumn(body.triageColumn)) {
      throw new HttpError(400, "triageColumn must be one of: Immediate Triage, Watchlist Radar, Archived / Cleaned.");
    }
    const release = await setTriageColumn(id, body.triageColumn);
    if (!release) throw new HttpError(404, "Release not found.");
    return json({ release });
  } catch (error) {
    return fail(error);
  }
}
