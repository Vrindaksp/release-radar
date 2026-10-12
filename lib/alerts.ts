import { channelStatus, emailSender, loadEscalationConfig } from "./escalation";
import { emailId, maskEmail } from "./mask";
import { MAX_RECIPIENTS, effectiveSettings, type AlertEmailSettings } from "./settings";
import type { AlertsView } from "./types";

/**
 * The Alerts panel's view of the world. Pure: give it the saved settings (or null) and the
 * environment. Addresses are masked and referred to by opaque id — the dashboard has no login,
 * so full addresses never reach the browser.
 */
export function buildAlertsView(saved: AlertEmailSettings | null, env: NodeJS.ProcessEnv = process.env): AlertsView {
  const settings = effectiveSettings(saved, env);
  const status = channelStatus(env);
  const rule = loadEscalationConfig(env);
  return {
    email: {
      available: status.email,
      active: status.email && settings.enabled && settings.recipients.length > 0,
      enabled: settings.enabled,
      source: saved ? "settings" : "server",
      recipients: settings.recipients.map((address) => ({ id: emailId(address), masked: maskEmail(address) })),
      maxRecipients: MAX_RECIPIENTS,
      sender: emailSender(env),
      lastTestAt: settings.lastTestAt,
    },
    channels: { slack: status.slack, ntfy: status.ntfy },
    rule: { minSeverity: rule.minSeverity, minImpact: rule.minImpact, maxAgeHours: rule.maxAgeHours },
  };
}
