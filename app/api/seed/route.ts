import { fail, json } from "@/lib/http";
import { clearSampleReleases, loadSeedData } from "@/lib/seed";

export const dynamic = "force-dynamic";

/** POST /api/seed — load the sample repositories + releases from db/seed.json (idempotent). */
export async function POST() {
  try {
    return json(await loadSeedData());
  } catch (error) {
    return fail(error);
  }
}

/** DELETE /api/seed — remove the fictional sample releases again. */
export async function DELETE() {
  try {
    return json({ removed: await clearSampleReleases() });
  } catch (error) {
    return fail(error);
  }
}
