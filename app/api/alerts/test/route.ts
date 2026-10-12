import { buildEmailMessage, sendEmailAlert } from "@/lib/escalation";
import { ConfigError, HttpError } from "@/lib/errors";
import { fail, json } from "@/lib/http";
import { maskEmailsIn } from "@/lib/mask";
import { effectiveSettings, getAlertEmailSettings, saveAlertEmailSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Minimum gap between test emails — the endpoint is reachable without a login. */
const COOLDOWN_MS = 30_000;

/**
 * POST /api/alerts/test — sends a clearly labelled test email to the saved recipients (never to
 * an address supplied in the request), so "does email actually reach me?" is one click.
 */
export async function POST() {
  try {
    if (!process.env.RESEND_API_KEY?.trim()) {
      throw new ConfigError("Email isn't set up on the server yet (RESEND_API_KEY is missing).");
    }
    const settings = effectiveSettings(await getAlertEmailSettings());
    if (!settings.enabled || settings.recipients.length === 0) {
      throw new HttpError(400, "Turn email alerts on and add a recipient first.");
    }
    const wait = settings.lastTestAt ? COOLDOWN_MS - (Date.now() - Date.parse(settings.lastTestAt)) : 0;
    if (wait > 0) throw new HttpError(429, `Please wait ${Math.ceil(wait / 1000)}s before sending another test.`);

    // Record the attempt first, so a failing provider can't be hammered either.
    const lastTestAt = new Date().toISOString();
    await saveAlertEmailSettings({ ...settings, lastTestAt });

    const message = buildEmailMessage(
      {
        repoName: "release-radar",
        versionTag: "delivery check",
        tier: 1,
        category: "Test",
        summary: "This is a test from the Alerts panel. If you can read it, emergency emails will reach you.",
        securitySeverity: "critical",
        securityImpact: "High",
        advisoryIds: [],
        recommendedAction: "Nothing to do — no real release triggered this.",
        htmlUrl: "https://github.com/",
        ingestSource: "poll",
        reasons: ["test email"],
        test: true,
      },
      process.env,
      settings.recipients,
    );
    if (!message) throw new HttpError(400, "Add a recipient first.");

    try {
      await sendEmailAlert(message);
    } catch (error) {
      // Provider errors can echo addresses back; sendEmailAlert masks them, but be defensive.
      throw new HttpError(502, maskEmailsIn((error as Error).message));
    }
    return json({ sent: settings.recipients.length, lastTestAt });
  } catch (error) {
    return fail(error);
  }
}
