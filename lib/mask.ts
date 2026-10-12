import { createHash } from "node:crypto";

/**
 * The dashboard is reachable without a login, so recipient addresses are never sent to the
 * browser in full: the UI sees a masked form and an opaque id to refer to it.
 */

/** "keerthi@gmail.com" → "k•••••@gmail.com" (the domain stays readable). */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf("@");
  if (at < 1) return "•••";
  const local = address.slice(0, at);
  return `${local[0]}${"•".repeat(Math.min(Math.max(local.length - 1, 2), 6))}${address.slice(at)}`;
}

/** Masks every email address inside free text (e.g. a provider's error message). */
export function maskEmailsIn(text: string): string {
  return text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (match) => maskEmail(match));
}

/** A stable opaque id for an address, so the UI can ask to remove one without knowing it. */
export function emailId(address: string): string {
  return createHash("sha256").update(address.trim().toLowerCase()).digest("hex").slice(0, 12);
}
