import { db } from "./db";
import { emailRecipients } from "./escalation";

/**
 * Alert email settings edited in the dashboard ("Alerts" panel). They are stored in Neon so a
 * change takes effect immediately, with no redeploy. Until someone saves them once, the
 * server's ALERT_EMAIL_TO environment variable is used.
 */
export interface AlertEmailSettings {
  enabled: boolean;
  recipients: string[];
  /** When the last "Send test email" was attempted (drives a short cooldown). */
  lastTestAt: string | null;
}

const KEY = "alert_email";
export const MAX_RECIPIENTS = 5;

/** null = never saved from the UI, so the environment default applies. */
export async function getAlertEmailSettings(): Promise<AlertEmailSettings | null> {
  const sql = await db();
  const rows = await sql`select value from settings where key = ${KEY}`;
  if (!rows[0]) return null;
  const raw = (typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value) as Partial<AlertEmailSettings>;
  return {
    enabled: raw.enabled !== false,
    recipients: Array.isArray(raw.recipients) ? raw.recipients.filter((x): x is string => typeof x === "string") : [],
    lastTestAt: typeof raw.lastTestAt === "string" ? raw.lastTestAt : null,
  };
}

export async function saveAlertEmailSettings(settings: AlertEmailSettings): Promise<void> {
  const sql = await db();
  await sql`
    insert into settings (key, value, updated_at)
    values (${KEY}, ${JSON.stringify(settings)}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

/**
 * Who gets the emergency email. Saved settings win (and can switch email off); with none saved
 * it falls back to the server's ALERT_EMAIL_TO.
 */
export function resolveEmailRecipients(settings: AlertEmailSettings | null, env: NodeJS.ProcessEnv = process.env): string[] {
  if (!settings) return emailRecipients(env);
  return settings.enabled ? settings.recipients : [];
}

/** The settings as they currently stand, materialised from the env default if none are saved. */
export function effectiveSettings(settings: AlertEmailSettings | null, env: NodeJS.ProcessEnv = process.env): AlertEmailSettings {
  return settings ?? { enabled: emailRecipients(env).length > 0, recipients: emailRecipients(env), lastTestAt: null };
}
