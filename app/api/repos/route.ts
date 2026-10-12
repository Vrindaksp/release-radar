import { HttpError } from "@/lib/errors";
import { fetchRepoMeta, parseRepoName } from "@/lib/github";
import { fail, json, readJson } from "@/lib/http";
import { createRepository, listRepositories } from "@/lib/repos";
import { TIERS, type Tier } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/repos — every tracked repository. */
export async function GET() {
  try {
    return json({ repositories: await listRepositories() });
  } catch (error) {
    return fail(error);
  }
}

/**
 * POST /api/repos  { repoName: "owner/repo" | GitHub URL, category?, tier? }
 * Verifies the repository exists on GitHub, then starts tracking it.
 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);

    const repoName = typeof body.repoName === "string" ? parseRepoName(body.repoName) : null;
    if (!repoName) {
      throw new HttpError(400, 'Enter a repository as "owner/repo" or a github.com URL.');
    }

    const tier = body.tier === undefined ? 2 : body.tier;
    if (!(TIERS as readonly unknown[]).includes(tier)) {
      throw new HttpError(400, "tier must be 1, 2 or 3.");
    }
    const category =
      typeof body.category === "string" && body.category.trim()
        ? body.category.trim().slice(0, 60)
        : "Uncategorized";

    const meta = await fetchRepoMeta(repoName); // 404 if it doesn't exist
    const repository = await createRepository({
      repoName: meta.fullName,
      category,
      tier: tier as Tier,
      description: meta.description,
      htmlUrl: meta.htmlUrl,
    });
    if (!repository) throw new HttpError(409, `${meta.fullName} is already being tracked.`);
    return json({ repository }, 201);
  } catch (error) {
    return fail(error);
  }
}
