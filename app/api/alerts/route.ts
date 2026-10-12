import { buildAlertsView } from "@/lib/alerts";
import { EMAIL_PATTERN } from "@/lib/escalation";
import { HttpError } from "@/lib/errors";
import { fail, json, readJson } from "@/lib/http";
import { emailId } from "@/lib/mask";
import {
  MAX_RECIPIENTS,
  effectiveSettings,
  getAlertEmailSettings,
  saveAlertEmailSettings,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

/** GET /api/alerts — email alert settings (addresses masked) and which channels the server supports. */
export async function GET() {
  try {
    return json(buildAlertsView(await getAlertEmailSettings()));
  } catch (error) {
    return fail(error);
  }
}

/**
 * PUT /api/alerts  { enabled?, addRecipient?, removeRecipient? }
 * `addRecipient` is a full address; `removeRecipient` is the opaque id from GET. Returns the new view.
 */
export async function PUT(request: Request) {
  try {
    const body = await readJson(request);
    const { enabled, addRecipient, removeRecipient } = body;
    if (enabled === undefined && addRecipient === undefined && removeRecipient === undefined) {
      throw new HttpError(400, "Nothing to change.");
    }
    if (enabled !== undefined && typeof enabled !== "boolean") throw new HttpError(400, "enabled must be a boolean.");

    const settings = effectiveSettings(await getAlertEmailSettings());
    const next = { ...settings, recipients: [...settings.recipients] };
    if (enabled !== undefined) next.enabled = enabled;

    if (addRecipient !== undefined) {
      const address = typeof addRecipient === "string" ? addRecipient.trim() : "";
      if (address.length > 254 || !EMAIL_PATTERN.test(address)) {
        throw new HttpError(400, "That doesn't look like a valid email address.");
      }
      if (!next.recipients.some((existing) => existing.toLowerCase() === address.toLowerCase())) {
        if (next.recipients.length >= MAX_RECIPIENTS) {
          throw new HttpError(400, `You can add up to ${MAX_RECIPIENTS} recipients.`);
        }
        next.recipients.push(address);
        next.enabled = enabled ?? true; // adding someone implies they want alerts
      }
    }

    if (removeRecipient !== undefined) {
      const index = typeof removeRecipient === "string" ? next.recipients.findIndex((a) => emailId(a) === removeRecipient) : -1;
      if (index === -1) throw new HttpError(404, "Recipient not found.");
      next.recipients.splice(index, 1);
    }

    await saveAlertEmailSettings(next);
    return json(buildAlertsView(next));
  } catch (error) {
    return fail(error);
  }
}
