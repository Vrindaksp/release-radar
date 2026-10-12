import type { DigestFilter, Release } from "./types";

/** Everything a release can be searched by, lower-cased once per call. */
function haystack(release: Release): string {
  return [
    release.repoName,
    release.category,
    release.versionTag,
    release.geminiSummary,
    release.highlights.join(" "),
    release.recommendedAction ?? "",
    release.advisoryIds.join(" "),
    release.isSecurityFix ? "security" : "",
    release.isBreakingChange ? "breaking" : "",
    `effort ${release.effortScore}`,
    release.triageColumn,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * "Ask My Digest": applies the Security / Breaking toggle, then keeps releases
 * matching every whitespace-separated search term (case-insensitive).
 */
export function filterReleases(releases: Release[], query: string, filter: DigestFilter): Release[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return releases.filter((release) => {
    if (filter === "security" && !release.isSecurityFix) return false;
    if (filter === "breaking" && !release.isBreakingChange) return false;
    if (terms.length === 0) return true;
    const text = haystack(release);
    return terms.every((term) => text.includes(term));
  });
}
