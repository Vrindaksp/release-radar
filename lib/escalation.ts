import { createHash, randomUUID } from "node:crypto";
import { ConfigError } from "./errors";
import { maskEmailsIn } from "./mask";
import type { ReleaseAnalysis } from "./gemini";
import {
  SECURITY_IMPACTS,
  SECURITY_SEVERITIES,
  type IngestSource,
  type SecurityImpact,
  type SecuritySeverity,
  type Tier,
} from "./types";

/**
 * Real-time emergency escalation.
 *
 * During ingestion (webhook *and* poll) every newly analysed release is run
 * through `evaluateEscalation`. If Gemini rates it a critical security fix with
 * high impact, alerts go out immediately — by email (Resend), ntfy push and/or Slack if
 * configured, and always to the dashboard banner — instead of waiting for the
 * Monday-morning digest.
 *
 * Thresholds (all optional env vars; defaults implement the "critical + high
 * impact" rule):
 *   ESCALATION_MIN_SEVERITY   low | moderate | high | critical   (default critical)
 *   ESCALATION_MIN_IMPACT     Low | Medium | High                (default High)
 *   ESCALATION_MAX_TIER       1 | 2 | 3 — only repos at or above this priority (default 3 = all)
 *   ESCALATION_MAX_AGE_HOURS  ignore releases older than this    (default 72)
 */

export interface EscalationConfig {
  minSeverity: Exclude<SecuritySeverity, "none">;
  minImpact: SecurityImpact;
  maxTier: Tier;
  maxAgeHours: number;
}

export interface EscalationCandidate {
  analysis: Pick<ReleaseAnalysis, "isSecurityFix" | "securitySeverity" | "securityImpact" | "source">;
  tier: Tier;
  publishedAt: string;
}

export interface EscalationDecision {
  escalate: boolean;
  /** Why it fired — or, when it didn't, the first rule that stopped it. */
  reasons: string[];
}

export function loadEscalationConfig(env: NodeJS.ProcessEnv = process.env): EscalationConfig {
  const severity = (env.ESCALATION_MIN_SEVERITY ?? "").toLowerCase();
  const impact = SECURITY_IMPACTS.find((value) => value.toLowerCase() === (env.ESCALATION_MIN_IMPACT ?? "").toLowerCase());
  const tier = Number(env.ESCALATION_MAX_TIER);
  const age = Number(env.ESCALATION_MAX_AGE_HOURS);
  return {
    minSeverity: (["low", "moderate", "high", "critical"] as const).find((value) => value === severity) ?? "critical",
    minImpact: impact ?? "High",
    maxTier: ([1, 2, 3] as const).find((value) => value === tier) ?? 3,
    maxAgeHours: Number.isFinite(age) && age > 0 ? age : 72,
  };
}

const severityRank = (value: SecuritySeverity) => SECURITY_SEVERITIES.indexOf(value);
const impactRank = (value: SecurityImpact) => SECURITY_IMPACTS.indexOf(value);

/**
 * The rule engine: pure and deterministic, so the decision is easy to audit.
 * Every condition must hold for a release to page the team.
 */
export function evaluateEscalation(
  candidate: EscalationCandidate,
  config: EscalationConfig = loadEscalationConfig(),
  now = Date.now(),
): EscalationDecision {
  const { analysis, tier, publishedAt } = candidate;

  if (analysis.source !== "gemini") {
    return { escalate: false, reasons: ["not rated by Gemini (keyword fallback never pages)"] };
  }
  if (!analysis.isSecurityFix) return { escalate: false, reasons: ["not a security fix"] };
  if (severityRank(analysis.securitySeverity) < severityRank(config.minSeverity)) {
    return {
      escalate: false,
      reasons: [`severity ${analysis.securitySeverity} is below the ${config.minSeverity} threshold`],
    };
  }
  if (impactRank(analysis.securityImpact) < impactRank(config.minImpact)) {
    return {
      escalate: false,
      reasons: [`impact ${analysis.securityImpact} is below the ${config.minImpact} threshold`],
    };
  }
  if (tier > config.maxTier) {
    return { escalate: false, reasons: [`tier ${tier} is outside the escalation scope (tier ≤ ${config.maxTier})`] };
  }
  const ageHours = (now - Date.parse(publishedAt)) / 3_600_000;
  if (!(ageHours <= config.maxAgeHours)) {
    return {
      escalate: false,
      reasons: [`published ${Math.round(ageHours)}h ago — older than the ${config.maxAgeHours}h escalation window`],
    };
  }
  return {
    escalate: true,
    reasons: [
      `${analysis.securitySeverity} severity security fix`,
      `${analysis.securityImpact} impact`,
      `tier ${tier} repository`,
    ],
  };
}

// ---- Slack ---------------------------------------------------------------------

export interface AlertContext {
  repoName: string;
  versionTag: string;
  tier: Tier;
  category: string;
  summary: string;
  securitySeverity: SecuritySeverity;
  securityImpact: SecurityImpact;
  advisoryIds: string[];
  recommendedAction: string | null;
  htmlUrl: string;
  ingestSource: IngestSource;
  reasons: string[];
  /** A delivery check from the Alerts panel: sent with a clearly different heading and subject. */
  test?: boolean;
}

export interface SlackMessage {
  text: string;
  blocks: unknown[];
}

/** Slack mrkdwn treats & < > as control characters; release notes are untrusted text. */
export const slackEscape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Optional `@here` / `@channel` / user-group / user mention; anything else is ignored. */
function mention(env: NodeJS.ProcessEnv): string {
  const value = env.SLACK_MENTION?.trim() ?? "";
  return /^<(!here|!channel|!subteam\^[A-Z0-9]+|@[A-Z0-9]+)>$/.test(value) ? value : "";
}

function dashboardUrl(env: NodeJS.ProcessEnv): string | null {
  const explicit = env.APP_URL?.trim();
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit.replace(/\/+$/, "");
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel}` : null;
}

export function buildSlackMessage(ctx: AlertContext, env: NodeJS.ProcessEnv = process.env): SlackMessage {
  const ping = mention(env);
  const title = `${ctx.repoName} ${ctx.versionTag}`;
  const link = /^https:\/\/github\.com\//i.test(ctx.htmlUrl)
    ? `<${ctx.htmlUrl}|${slackEscape(title)}>`
    : slackEscape(title);
  const dashboard = dashboardUrl(env);
  // `text` is what notifications show, and Slack parses mrkdwn there too — escape it as well.
  const fallback = `:rotating_light: EMERGENCY — critical security release: ${slackEscape(title)} — ${slackEscape(clip(ctx.summary, 200))}`;

  const fields = [
    { type: "mrkdwn", text: `*Severity*\n${ctx.securitySeverity.toUpperCase()}` },
    { type: "mrkdwn", text: `*Impact*\n${ctx.securityImpact}` },
    { type: "mrkdwn", text: `*Priority*\nTier ${ctx.tier} · ${slackEscape(clip(ctx.category, 60))}` },
    {
      type: "mrkdwn",
      text: `*Advisories*\n${ctx.advisoryIds.length ? ctx.advisoryIds.map(slackEscape).join(", ") : "none listed"}`,
    },
  ];

  const blocks: unknown[] = [
    { type: "header", text: { type: "plain_text", text: ":rotating_light: Emergency: critical security release", emoji: true } },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${ping ? `${ping} ` : ""}*${link}*\n${slackEscape(clip(ctx.summary, 600))}`,
      },
    },
    { type: "section", fields },
  ];
  if (ctx.recommendedAction) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Recommended action*\n${slackEscape(clip(ctx.recommendedAction, 600))}` },
    });
  }
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: [
          `Triggered by rule: ${slackEscape(ctx.reasons.join(", "))}`,
          `received via ${ctx.ingestSource === "webhook" ? "GitHub webhook" : "scheduled sync"}`,
          dashboard ? `<${dashboard}|Open Release Radar>` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    ],
  });

  return { text: ping ? `${ping} ${fallback}` : fallback, blocks };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POSTs to an alert channel, retrying network errors, 429 and 5xx. The channel
 * URL is a secret (Slack webhook URL, ntfy topic), so it is never put in an error message.
 */
async function postWithRetry(label: string, url: string, init: RequestInit): Promise<void> {
  const attempts = 3;
  let lastError = "unknown error";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { ...init, method: "POST", signal: AbortSignal.timeout(10_000) });
      if (response.ok) return;
      const detail = (await response.text()).slice(0, 120);
      // Providers sometimes echo addresses back ("you can only send to x@y.com"); never pass them on unmasked.
      lastError = `${label} rejected the alert (HTTP ${response.status}${detail ? `: ${maskEmailsIn(detail)}` : ""})`;
      if (response.status !== 429 && response.status < 500) break; // permanent: bad URL / payload
      const retryAfter = Number(response.headers.get("retry-after"));
      if (attempt < attempts) await sleep(retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : 500 * 2 ** (attempt - 1));
    } catch (error) {
      lastError = `Could not reach ${label}: ${(error as Error).message}`;
      if (attempt < attempts) await sleep(500 * 2 ** (attempt - 1));
    }
  }
  throw new Error(lastError);
}

/** Posts to the Slack incoming webhook (SLACK_WEBHOOK_URL). */
export async function sendSlackAlert(message: SlackMessage, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const url = env.SLACK_WEBHOOK_URL;
  if (!url) {
    throw new ConfigError("SLACK_WEBHOOK_URL is not set — the emergency alert could not be sent.");
  }
  await postWithRetry("Slack", url, { headers: { "Content-Type": "application/json" }, body: JSON.stringify(message) });
}

// ---- ntfy.sh (push notifications, no account needed) ------------------------------

export interface NtfyMessage {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * ntfy is configured by NTFY_TOPIC (and optionally NTFY_SERVER, default https://ntfy.sh).
 * There are no accounts: whoever knows the topic name can subscribe, so make it long and random.
 */
export function ntfyTarget(env: NodeJS.ProcessEnv = process.env): string | null {
  const topic = env.NTFY_TOPIC?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(topic)) return null;
  const server = (env.NTFY_SERVER?.trim() || "https://ntfy.sh").replace(/\/+$/, "");
  return /^https?:\/\//i.test(server) ? `${server}/${topic}` : null;
}

/** HTTP header values must be plain ASCII. */
const ascii = (text: string) => text.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();

export function buildNtfyMessage(ctx: AlertContext, env: NodeJS.ProcessEnv = process.env): NtfyMessage | null {
  const url = ntfyTarget(env);
  if (!url) return null;
  const dashboard = dashboardUrl(env);
  const headers: Record<string, string> = {
    Title: ascii(`EMERGENCY: critical security release - ${ctx.repoName} ${ctx.versionTag}`).slice(0, 120),
    Priority: "urgent",
    Tags: "rotating_light,lock",
  };
  if (/^https:\/\/github\.com\//i.test(ctx.htmlUrl)) headers.Click = ctx.htmlUrl;
  if (dashboard) headers.Actions = ascii(`view, Open Release Radar, ${dashboard}`);

  const lines = [
    clip(ctx.summary, 400),
    "",
    `Severity: ${ctx.securitySeverity.toUpperCase()} | Impact: ${ctx.securityImpact} | Tier ${ctx.tier} (${clip(ctx.category, 40)})`,
  ];
  if (ctx.advisoryIds.length) lines.push(`Advisories: ${ctx.advisoryIds.join(", ")}`);
  if (ctx.recommendedAction) lines.push(`Action: ${clip(ctx.recommendedAction, 300)}`);
  return { url, headers, body: lines.join("\n") };
}

export async function sendNtfyAlert(message: NtfyMessage): Promise<void> {
  await postWithRetry("ntfy", message.url, { headers: message.headers, body: message.body });
}

// ---- Email via Resend ----------------------------------------------------------------

export interface EmailMessage {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  /** Stable per release, so a retried request can never send the email twice. */
  idempotencyKey: string;
}

export const EMAIL_PATTERN =/^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;
const DEFAULT_FROM = "Release Radar <onboarding@resend.dev>";

/** The From header: ALERT_EMAIL_FROM when it is well-formed, otherwise Resend's sandbox sender. */
export function emailSender(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.ALERT_EMAIL_FROM?.trim() ?? "";
  return /^[^<>\r\n]*<[^\s@<>]+@[^\s@<>]+>$|^[^\s@<>]+@[^\s@<>]+$/.test(raw) ? raw : DEFAULT_FROM;
}

/** Recipients from ALERT_EMAIL_TO (comma-separated); invalid addresses are dropped. */
export function emailRecipients(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.ALERT_EMAIL_TO ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter((address) => EMAIL_PATTERN.test(address))
    .slice(0, 20);
}

/** Email is on when there is both a RESEND_API_KEY and at least one valid recipient. */
export function emailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim()) && emailRecipients(env).length > 0;
}

/** Plain HTML escaping — release text is untrusted and ends up inside an HTML email. */
export const htmlEscape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Subjects are a single header line: no control characters, bounded length. */
const oneLine = (text: string) => text.replace(/[\x00-\x1F\x7F]+/g, " ").replace(/\s+/g, " ").trim();

export function buildEmailMessage(
  ctx: AlertContext,
  env: NodeJS.ProcessEnv = process.env,
  /** Recipients saved in the dashboard; when omitted, ALERT_EMAIL_TO is used. */
  recipients?: string[],
): EmailMessage | null {
  const to = recipients ?? emailRecipients(env);
  if (to.length === 0) return null;
  const heading = ctx.test ? "TEST ALERT — delivery check" : "EMERGENCY — critical security release";

  const from = emailSender(env);

  const title = `${ctx.repoName} ${ctx.versionTag}`;
  const releaseUrl = /^https:\/\/github\.com\//i.test(ctx.htmlUrl) ? ctx.htmlUrl : null;
  const dashboard = dashboardUrl(env);
  const rows: [string, string][] = [
    ["Severity", ctx.securitySeverity.toUpperCase()],
    ["Impact", ctx.securityImpact],
    ["Priority", `Tier ${ctx.tier} · ${clip(ctx.category, 60)}`],
    ["Advisories", ctx.advisoryIds.length ? ctx.advisoryIds.join(", ") : "none listed"],
  ];

  const text = [
    `${heading}: ${title}`,
    "",
    clip(ctx.summary, 600),
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...(ctx.recommendedAction ? ["", `Recommended action: ${clip(ctx.recommendedAction, 600)}`] : []),
    "",
    ...(releaseUrl ? [`Release notes: ${releaseUrl}`] : []),
    ...(dashboard ? [`Dashboard: ${dashboard}`] : []),
    "",
    `Triggered by rule: ${ctx.reasons.join(", ")} — received via ${ctx.ingestSource === "webhook" ? "GitHub webhook" : "scheduled sync"}.`,
  ].join("\n");

  const link = (url: string, label: string) =>
    `<a href="${htmlEscape(url)}" style="color:#4338ca">${htmlEscape(label)}</a>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="background:${ctx.test ? "#334155" : "#b91c1c"};color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-weight:700;letter-spacing:.02em">${ctx.test ? "&#9989;" : "&#128680;"} ${htmlEscape(heading)}</div>
  <div style="background:#fff;padding:20px 18px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:0">
    <p style="margin:0 0 4px;font-size:18px;font-weight:700">${releaseUrl ? link(releaseUrl, title) : htmlEscape(title)}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">${htmlEscape(clip(ctx.summary, 600))}</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      ${rows.map(([label, value]) => `<tr><td style="padding:6px 0;color:#64748b;width:110px">${htmlEscape(label)}</td><td style="padding:6px 0;font-weight:600">${htmlEscape(value)}</td></tr>`).join("\n      ")}
    </table>
    ${ctx.recommendedAction ? `<p style="margin:16px 0 0;padding:12px;background:#fef9c3;border-radius:8px;font-size:14px"><strong>Recommended action:</strong> ${htmlEscape(clip(ctx.recommendedAction, 600))}</p>` : ""}
    <p style="margin:18px 0 0;font-size:14px">${releaseUrl ? link(releaseUrl, "Release notes") : ""}${releaseUrl && dashboard ? " &nbsp;·&nbsp; " : ""}${dashboard ? link(dashboard, "Open Release Radar") : ""}</p>
    <p style="margin:18px 0 0;font-size:12px;color:#94a3b8">Triggered by rule: ${htmlEscape(ctx.reasons.join(", "))} — received via ${ctx.ingestSource === "webhook" ? "GitHub webhook" : "scheduled sync"}.</p>
  </div>
</div></body></html>`;

  return {
    from,
    to,
    subject: ctx.test
      ? "✅ Release Radar test alert — your emergency emails are working"
      : oneLine(`🚨 EMERGENCY: critical security release — ${title}`).slice(0, 150),
    text,
    html,
    // A real alert is idempotent per release; a test must always send, so it gets a fresh key.
    idempotencyKey: ctx.test
      ? `radar-test-${randomUUID()}`
      : `radar-${createHash("sha256").update(`${ctx.repoName}@${ctx.versionTag}`).digest("hex").slice(0, 40)}`,
  };
}

/** Sends through Resend (https://resend.com/docs/api-reference/emails/send-email). */
export async function sendEmailAlert(message: EmailMessage, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const key = env.RESEND_API_KEY?.trim();
  if (!key) throw new ConfigError("RESEND_API_KEY is not set — the emergency email could not be sent.");
  await postWithRetry("Resend", "https://api.resend.com/emails", {
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": message.idempotencyKey,
    },
    body: JSON.stringify({ from: message.from, to: message.to, subject: message.subject, text: message.text, html: message.html }),
  });
}

// ---- delivery ----------------------------------------------------------------------

export interface DeliveryOutcome {
  /** Channels that are configured. Empty means the alert is dashboard-only. */
  configured: string[];
  delivered: string[];
  /** One entry per configured channel that failed. */
  failures: string[];
}

/**
 * Sends the emergency alert to every configured channel (email via Resend, ntfy and/or
 * Slack), in parallel; one failing never blocks the other. With no channel configured it
 * returns an empty outcome — the release still appears in the dashboard's
 * emergency banner, which needs no setup.
 */
export async function deliverEmergencyAlert(
  ctx: AlertContext,
  env: NodeJS.ProcessEnv = process.env,
  options: {
    /** Email recipients saved in the dashboard. When omitted, ALERT_EMAIL_TO is used. */
    emailRecipients?: string[];
  } = {},
): Promise<DeliveryOutcome> {
  const jobs: { name: string; run: () => Promise<void> }[] = [];
  if (env.SLACK_WEBHOOK_URL) jobs.push({ name: "Slack", run: () => sendSlackAlert(buildSlackMessage(ctx, env), env) });
  const ntfy = buildNtfyMessage(ctx, env);
  if (ntfy) jobs.push({ name: "ntfy", run: () => sendNtfyAlert(ntfy) });
  const recipients = options.emailRecipients ?? emailRecipients(env);
  const email = env.RESEND_API_KEY?.trim() && recipients.length > 0 ? buildEmailMessage(ctx, env, recipients) : null;
  if (email) jobs.push({ name: "Email", run: () => sendEmailAlert(email, env) });

  const settled = await Promise.allSettled(jobs.map((job) => job.run()));
  const outcome: DeliveryOutcome = { configured: jobs.map((job) => job.name), delivered: [], failures: [] };
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") outcome.delivered.push(jobs[index].name);
    else outcome.failures.push((result.reason as Error).message);
  });
  return outcome;
}

/** Which alert channels the *server* has credentials for (booleans only — never the secrets). */
export function channelStatus(env: NodeJS.ProcessEnv = process.env): { email: boolean; slack: boolean; ntfy: boolean } {
  return {
    email: Boolean(env.RESEND_API_KEY?.trim()),
    slack: Boolean(env.SLACK_WEBHOOK_URL?.trim()),
    ntfy: ntfyTarget(env) !== null,
  };
}
