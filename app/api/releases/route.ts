import { fail, json } from "@/lib/http";
import { getStats, listReleases } from "@/lib/releases";
import type { DigestResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/releases — the digest: every board card plus the header counters. */
export async function GET() {
  try {
    const [releases, stats] = await Promise.all([listReleases(), getStats()]);
    return json<DigestResponse>({ releases, stats });
  } catch (error) {
    return fail(error);
  }
}
