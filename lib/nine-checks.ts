/**
 * The Nine Checks (MESA "Claude Basics" deck): does this idea deserve to be built?
 *
 *   Kill switches: any No means don't build it.            (01 problem, 02 workflow, 03 input)
 *   Sizing:        any No means build something smaller.   (04 output, 05 impact, 08 ROI)
 *   Boundary:      any No means put a human exactly there. (06 failure risk, 07 judgment, 09 owner)
 *
 * This file is the single source for the slide image (docs/nine-checks.png), the README table and the
 * "Does this deserve to be built?" section of the How it works panel.
 */

export type CheckGroup = "kill" | "sizing" | "boundary";

export interface NineCheck {
  /** 1-9, as numbered on the slide (the groups are not in numerical order). */
  n: number;
  group: CheckGroup;
  question: string;
  /** The slide-style answer, after "YES". */
  answer: string;
  /** What in the build backs the answer up. */
  evidence: string;
  /** The honest weak spot: what is not yet proven or not yet enforced. */
  gap: string;
}

export const CHECK_GROUPS: Record<CheckGroup, { title: string; rule: string }> = {
  kill: { title: "Kill switches", rule: "Any No means: don't build it." },
  sizing: { title: "Sizing", rule: "Any No means: build something smaller." },
  boundary: { title: "Boundary", rule: "Any No means: put a human exactly here." },
};

/** In the order the slide shows them: 01 02 03 | 04 05 08 | 06 07 09. */
export const NINE_CHECKS: readonly NineCheck[] = [
  {
    n: 1,
    group: "kill",
    question: "Problem real?",
    answer: "a senior engineer, a stack of dependencies, and security fixes buried in changelog noise every week.",
    evidence: "Keerthi (senior fintech engineer) tracks tier-1 to tier-3 repos; each release is a wall of text where the one line that matters is easy to miss.",
    gap: "The persona is the course brief's, not a measured survey of real users.",
  },
  {
    n: 2,
    group: "kill",
    question: "Workflow repeated?",
    answer: "every week, every repo, every release: the same read, sort and decide routine.",
    evidence: "A Vercel cron runs every Monday 12:00 UTC (GET /api/ingest); the GitHub webhook handles releases in between.",
    gap: "Release volume varies a lot between repos, so some weeks have almost nothing to triage.",
  },
  {
    n: 3,
    group: "kill",
    question: "Input available?",
    answer: "GitHub publishes release notes through a public API, and the repo list is Keerthi's own.",
    evidence: "lib/github.ts reads /repos/{owner}/{repo}/releases with a token; Gemini only needs plain text. 116 real releases were analysed in production.",
    gap: "Release notes only: issues, pull requests, commits and advisory databases are not read, and a repo that writes no notes looks quiet.",
  },
  {
    n: 4,
    group: "sizing",
    question: "Output valuable?",
    answer: "a ranked board: what to act on, why, how big the job is, plus a ready-to-paste ticket.",
    evidence: "Three lists (Immediate Triage, Watchlist Radar, Archive), severity and impact ratings, an effort score, a recommended action and Copy Release Note / Create Ticket.",
    gap: "Value depends on Gemini's classification being right, which is why the original notes are one click away.",
  },
  {
    n: 5,
    group: "sizing",
    question: "Impact measurable?",
    answer: "time to triage, alert latency from publish to email, and how often Gemini has to be corrected.",
    evidence: "Timestamps are stored (published_at, emergency_at, escalated_at, triaged_at) and every correction is logged in release_feedback.",
    gap: "The data is collected but no before/after baseline has been measured yet.",
  },
  {
    n: 8,
    group: "sizing",
    question: "ROI worth it?",
    answer: "hours to build, free tiers throughout, a Flash-class model, and it runs weekly with nobody watching.",
    evidence: "Neon, Vercel, GitHub API, Resend and Gemini Flash are all on free or near-free plans; Flash was chosen because a wrong answer costs a retry, not trust (deck's model-choice framework).",
    gap: "Free-tier limits (Gemini rate limits, Resend's sandbox sender) cap how far it scales without paying.",
  },
  {
    n: 6,
    group: "boundary",
    question: "Failure risk OK?",
    answer: "it only reads and advises. The worst case is a late decision, never a changed repo.",
    evidence: "The app never writes to GitHub: no auto-upgrade, no auto-merge. Nothing is deleted (noise goes to the Archive) and Show original release notes is one click.",
    gap: "A missed critical CVE costs more than a bad movie pick, so the human gate (triage, Wrong severity?, emergency email) matters; Gemini is not yet scored on a fixed test set.",
  },
  {
    n: 7,
    group: "boundary",
    question: "Judgment protected?",
    answer: "Gemini proposes, fixed rules place the card, Keerthi decides.",
    evidence: "Rules (lib/triage.ts) choose the list and the emergency rule; the user moves, archives and corrects cards, and corrections calibrate future prompts.",
    gap: "Gemini's noise flag does move a card into the Archive without asking, so the Noise this week tile exists to keep that visible.",
  },
  {
    n: 9,
    group: "boundary",
    question: "Owner clear?",
    answer: "Keerthi owns the repo list, the tiers and every final call; maintainers own the source text.",
    evidence: "Repos, tiers and alert recipients are set in the Manage repos and Alerts panels; the original notes are shown as published.",
    gap: "The dashboard has no sign-in (by design, for review), so anyone with the link can triage. DASHBOARD_PASSWORD locks it.",
  },
];

/** The two ideas the slide uses to show a check doing its job: each is killed by a named check. */
export const KILLED_IDEAS: readonly { idea: string; killedBy: string; because: string }[] = [
  {
    idea: "Auto-merge the patch the moment a security release lands.",
    killedBy: "06 + 07",
    because: "Changing production code is not free to undo, and the engineer must make that call. The algorithm narrows; the human chooses.",
  },
  {
    idea: "Hide anything Gemini calls noise, for good.",
    killedBy: "07",
    because: "A confident model can be wrong. Archive it, show the count, let the human restore it.",
  },
];
