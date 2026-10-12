import { HttpError } from "@/lib/errors";
import { fail, json, parseId, readJson } from "@/lib/http";
import { deleteRepository, updateRepository, type RepositoryPatch } from "@/lib/repos";
import { TIERS, type Tier } from "@/lib/types";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/repos/:id  { category?, tier?, isActive? } */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const id = parseId((await params).id);
    const body = await readJson(request);
    const patch: RepositoryPatch = {};

    if (body.category !== undefined) {
      if (typeof body.category !== "string" || !body.category.trim()) {
        throw new HttpError(400, "category must be a non-empty string.");
      }
      patch.category = body.category.trim().slice(0, 60);
    }
    if (body.tier !== undefined) {
      if (!(TIERS as readonly unknown[]).includes(body.tier)) throw new HttpError(400, "tier must be 1, 2 or 3.");
      patch.tier = body.tier as Tier;
    }
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") throw new HttpError(400, "isActive must be a boolean.");
      patch.isActive = body.isActive;
    }
    if (Object.keys(patch).length === 0) throw new HttpError(400, "Nothing to update.");

    const repository = await updateRepository(id, patch);
    if (!repository) throw new HttpError(404, "Repository not found.");
    return json({ repository });
  } catch (error) {
    return fail(error);
  }
}

/** DELETE /api/repos/:id — stop tracking and drop its cached releases. */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const id = parseId((await params).id);
    if (!(await deleteRepository(id))) throw new HttpError(404, "Repository not found.");
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
