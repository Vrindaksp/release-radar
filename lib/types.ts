/**
 * Shared domain types. These are imported by both server (API routes, ingestion)
 * and client (dashboard components), so keep this file free of server-only code.
 */

/** The three board columns. The exact strings are stored in Postgres. */
export const TRIAGE_COLUMNS = [
  "Immediate Triage",
  "Watchlist Radar",
  "Archived / Cleaned",
] as const;
export type TriageColumn = (typeof TRIAGE_COLUMNS)[number];

export const EFFORT_SCORES = ["Low", "Medium", "High"] as const;
export type EffortScore = (typeof EFFORT_SCORES)[number];

/** Gemini's rating of a security fix, lowest to highest. "none" = not a security fix. */
export const SECURITY_SEVERITIES = ["none", "low", "moderate", "high", "critical"] as const;
export type SecuritySeverity = (typeof SECURITY_SEVERITIES)[number];

/** How exposed a typical production deployment is to the vulnerability being fixed. */
export const SECURITY_IMPACTS = ["Low", "Medium", "High"] as const;
export type SecurityImpact = (typeof SECURITY_IMPACTS)[number];

/** 1 = critical-path dependency, 2 = evaluation / watch, 3 = low priority. */
export const TIERS = [1, 2, 3] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Record<Tier, string> = {
  1: "Tier 1 · Critical path",
  2: "Tier 2 · Evaluate",
  3: "Tier 3 · Low priority",
};

export type AiSource = "gemini" | "heuristic" | "seed";
/** How a release reached us: the weekly/manual poll, or a live GitHub webhook. */
export type IngestSource = "poll" | "webhook";

export interface Repository {
  id: number;
  repoName: string; // "owner/repo"
  category: string;
  tier: Tier;
  isActive: boolean;
  description: string | null;
  htmlUrl: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

export interface Release {
  id: number;
  repositoryId: number;
  repoName: string;
  category: string;
  tier: Tier;
  versionTag: string;
  releaseName: string | null;
  htmlUrl: string;
  publishedAt: string;
  geminiSummary: string;
  highlights: string[];
  recommendedAction: string | null;
  advisoryIds: string[];
  effortScore: EffortScore;
  isSecurityFix: boolean;
  securitySeverity: SecuritySeverity;
  securityImpact: SecurityImpact;
  isBreakingChange: boolean;
  isNoise: boolean;
  triageColumn: TriageColumn;
  /** Column the AI originally suggested — used when restoring from the archive. */
  defaultColumn: TriageColumn;
  aiSource: AiSource;
  ingestSource: IngestSource;
  /** True once Keerthi has corrected Gemini's classification via the feedback button. */
  userCorrected: boolean;
  /** When the emergency rule fired (critical + high-impact security fix). Shown as a dashboard banner. */
  emergencyAt: string | null;
  /** When at least one external alert channel (Slack / ntfy) delivered it. */
  escalatedAt: string | null;
  /** Why an alert channel that is configured failed to deliver. */
  escalationError: string | null;
  /** True for rows loaded from db/seed.json rather than GitHub. */
  isSample: boolean;
}

export interface DashboardStats {
  reposMonitored: number;
  immediateCount: number;
  securityCount: number;
  breakingCount: number;
  sampleReleaseCount: number;
  lastSyncedAt: string | null;
}

export interface DigestResponse {
  releases: Release[];
  stats: DashboardStats;
}

export interface RepoIngestResult {
  repoName: string;
  fetched: number;
  inserted: number;
  escalated: number;
  /** Releases in the window still waiting to be analysed (a backfill runs in batches). */
  remaining: number;
  error?: string;
}

export interface IngestReport {
  startedAt: string;
  finishedAt: string;
  reposProcessed: number;
  inserted: number;
  escalated: number;
  /** Sum of per-repo `remaining` — call again until this reaches 0. */
  remaining: number;
  reposWithErrors: number;
  results: RepoIngestResult[];
}

export type DigestFilter = "all" | "security" | "breaking";

// ---- AI feedback loop --------------------------------------------------------

/** The parts of a classification Keerthi can correct. */
export interface ClassificationSnapshot {
  securitySeverity: SecuritySeverity;
  isBreakingChange: boolean;
  isNoise: boolean;
  effortScore: EffortScore;
}

/** POST /api/feedback. Omitted fields are left unchanged. */
export interface FeedbackInput {
  releaseId: number;
  securitySeverity?: SecuritySeverity;
  isBreakingChange?: boolean;
  isNoise?: boolean;
  effortScore?: EffortScore;
  note?: string;
}

export interface FeedbackEntry {
  id: number;
  repoName: string;
  versionTag: string;
  tier: Tier;
  ai: ClassificationSnapshot;
  corrected: ClassificationSnapshot;
  note: string | null;
  createdAt: string;
}

/** A past correction, replayed to Gemini as a calibration example. */
export interface CalibrationExample {
  repoName: string;
  versionTag: string;
  notesExcerpt: string;
  ai: ClassificationSnapshot;
  corrected: ClassificationSnapshot;
  note: string | null;
}

// ---- Alerts panel -----------------------------------------------------------------

/** What GET/PUT /api/alerts return. Addresses are masked: the dashboard has no login. */
export interface AlertsView {
  email: {
    /** The server has a RESEND_API_KEY, so email can be sent at all. */
    available: boolean;
    /** Email alerts are switched on and at least one recipient is set. */
    active: boolean;
    enabled: boolean;
    /** "settings" once saved from the panel, "server" while the ALERT_EMAIL_TO default applies. */
    source: "settings" | "server";
    recipients: { id: string; masked: string }[];
    maxRecipients: number;
    sender: string;
    lastTestAt: string | null;
  };
  /** Other server-side channels, booleans only. */
  channels: { slack: boolean; ntfy: boolean };
  rule: { minSeverity: string; minImpact: string; maxAgeHours: number };
}
