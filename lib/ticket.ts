import { formatDate } from "./format";
import { TIER_LABELS, type Release } from "./types";

/**
 * Renders a release as a paste-ready ticket (works in Jira, Linear, GitHub
 * Issues, Slack — plain markdown, no integration needed).
 */
export function buildTicket(release: Release): string {
  const prefix = release.isSecurityFix
    ? "[Security]"
    : release.isBreakingChange
      ? "[Breaking]"
      : release.tier === 1
        ? "[Upgrade]"
        : "[Evaluate]";

  const flags = [release.isSecurityFix && "SECURITY FIX", release.isBreakingChange && "BREAKING CHANGE"].filter(
    Boolean,
  );

  const lines = [
    `${prefix} ${release.repoName} → ${release.versionTag}`,
    "",
    `Impact: ${release.geminiSummary}`,
    `Flags: ${flags.length ? flags.join(" · ") : "none"}`,
    `Effort: ${release.effortScore}`,
    `Priority: ${TIER_LABELS[release.tier]} (${release.category})`,
    `Published: ${formatDate(release.publishedAt)}`,
  ];
  if (release.advisoryIds.length) lines.push(`Advisories: ${release.advisoryIds.join(", ")}`);
  if (release.highlights.length) {
    lines.push("", "Key changes:", ...release.highlights.map((item) => `- ${item}`));
  }
  if (release.recommendedAction) lines.push("", `Recommended action: ${release.recommendedAction}`);
  lines.push("", `Release notes: ${release.htmlUrl}`);
  if (release.isSample) lines.push("", "(Sample data — not a real release.)");
  return lines.join("\n");
}
