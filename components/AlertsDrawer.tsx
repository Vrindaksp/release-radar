"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CircleCheck, Info, LoaderCircle, Mail, Plus, Send, Siren, X } from "lucide-react";
import { sendTestEmail, updateAlerts } from "@/lib/client";
import { timeAgo } from "@/lib/format";
import type { AlertsView } from "@/lib/types";
import { btnPrimary, btnSecondary, drawerBackdrop, drawerHeader, drawerPanel, focusRing, iconBtn, inputClass, surface } from "./ui";

interface AlertsDrawerProps {
  onClose: () => void;
  /** null while the first load is still in flight. */
  view: AlertsView | null;
  loadError: string | null;
  onViewChange: (view: AlertsView) => void;
  onRetry: () => void;
}

const message = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

/**
 * Where emergency alerts go. The dashboard banner is always on; email (via Resend) is switched on
 * here, with its recipients and a one-click test. Slack / ntfy are server-side extras, shown for
 * information. Addresses arrive masked — this page has no login.
 */
export default function AlertsDrawer({ onClose, view, loadError, onViewChange, onRetry }: AlertsDrawerProps) {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState<null | "toggle" | "add" | "remove" | "test">(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const email = view?.email;
  const ready = Boolean(email?.available);

  async function change(kind: "toggle" | "add" | "remove", payload: Parameters<typeof updateAlerts>[0]) {
    setBusy(kind);
    setFormError(null);
    setTestResult(null);
    try {
      onViewChange(await updateAlerts(payload));
      if (kind === "add") setAddress("");
    } catch (error) {
      setFormError(message(error));
    } finally {
      setBusy(null);
    }
  }

  async function submitAddress(event: React.FormEvent) {
    event.preventDefault();
    if (!address.trim() || busy) return;
    await change("add", { addRecipient: address.trim() });
    inputRef.current?.focus();
  }

  async function test() {
    setBusy("test");
    setFormError(null);
    setTestResult(null);
    try {
      const result = await sendTestEmail();
      setTestResult({ ok: true, text: `Test email sent to ${result.sent} recipient${result.sent === 1 ? "" : "s"}. Check your inbox (and spam).` });
      if (email) onViewChange({ ...(view as AlertsView), email: { ...email, lastTestAt: result.lastTestAt } });
    } catch (error) {
      setTestResult({ ok: false, text: message(error) });
    } finally {
      setBusy(null);
    }
  }

  const canTest = ready && email!.enabled && email!.recipients.length > 0 && busy === null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className={drawerBackdrop} onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-labelledby="alerts-title" className={drawerPanel}>
        <header className={drawerHeader}>
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/25 ring-inset">
              <Bell className="size-4" aria-hidden />
            </span>
            <div>
              <h2 id="alerts-title" className="text-sm font-semibold text-zinc-100">
                Emergency alerts
              </h2>
              <p className="text-xs text-zinc-400">How Release Radar reaches you when it can&apos;t wait</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`${iconBtn} p-1.5`}>
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="thin-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {/* Always on */}
          <section className={`${surface} flex items-start gap-3 p-4`}>
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-300 ring-1 ring-red-400/25 ring-inset">
              <Siren className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-100">Dashboard banner</h3>
                <Pill tone="green">Always on</Pill>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                A red banner and a <span className="font-mono">(1) 🚨</span> browser-tab prefix appear the moment a
                critical security fix lands, until you triage it. Nothing to set up.
              </p>
            </div>
          </section>

          {/* Email */}
          <section aria-labelledby="email-title" className={`${surface} space-y-4 p-4`}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/25 ring-inset">
                <Mail className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3 id="email-title" className="text-sm font-semibold text-zinc-100">
                  Email
                </h3>
                <p className="text-xs text-zinc-400">Sent through Resend</p>
              </div>
              {email &&
                (ready ? (
                  <Pill tone={email.active ? "green" : "grey"}>{email.active ? "On" : "Off"}</Pill>
                ) : (
                  <Pill tone="amber">Not set up</Pill>
                ))}
            </div>

            {!view && !loadError && (
              <p className="flex items-center gap-2 text-xs text-zinc-400" role="status">
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Loading…
              </p>
            )}
            {loadError && (
              <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200 ring-1 ring-red-400/30 ring-inset">
                {loadError}{" "}
                <button type="button" onClick={onRetry} className={`font-semibold underline ${focusRing}`}>
                  Try again
                </button>
              </p>
            )}

            {email && (
              <>
                {!ready && (
                  <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-400/25 ring-inset">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Email isn&apos;t set up on the server yet — it needs a Resend API key (RESEND_API_KEY).
                  </p>
                )}

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200" id="email-switch-label">
                      Email me when it fires
                    </p>
                    <p className="text-xs text-zinc-400">Critical, high-impact security fixes only.</p>
                  </div>
                  <Switch
                    checked={email.enabled}
                    disabled={!ready || busy !== null}
                    labelledBy="email-switch-label"
                    onChange={(next) => change("toggle", { enabled: next })}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-zinc-300">Send alerts to</p>
                  {email.recipients.length === 0 ? (
                    <p className="text-xs text-zinc-400">No recipients yet — add an address below.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {email.recipients.map((recipient) => (
                        <li
                          key={recipient.id}
                          className="inline-flex items-center gap-1 rounded-full bg-zinc-800 py-1 pr-1 pl-3 text-xs text-zinc-100 ring-1 ring-white/10 ring-inset"
                        >
                          <span className="font-mono">{recipient.masked}</span>
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => change("remove", { removeRecipient: recipient.id })}
                            aria-label={`Remove ${recipient.masked}`}
                            className={`${iconBtn} size-5 rounded-full`}
                          >
                            <X className="size-3" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <form onSubmit={submitAddress} className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="email"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="you@example.com"
                      aria-label="Add an email address"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={!ready || email.recipients.length >= email.maxRecipients}
                      className={`${inputClass} h-9 min-w-0 flex-1 px-3`}
                    />
                    <button
                      type="submit"
                      disabled={!ready || !address.trim() || busy !== null || email.recipients.length >= email.maxRecipients}
                      className={`${btnPrimary} h-9 shrink-0 px-3 text-sm`}
                    >
                      {busy === "add" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                      Add
                    </button>
                  </form>
                  {formError && (
                    <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200 ring-1 ring-red-400/30 ring-inset">
                      {formError}
                    </p>
                  )}
                  <p className="text-[11px] text-zinc-400">
                    Up to {email.maxRecipients} addresses. They&apos;re shown masked here — this page has no login.
                  </p>
                </div>

                <div className="space-y-2 border-t border-white/10 pt-4">
                  <button type="button" onClick={test} disabled={!canTest} className={`${btnSecondary} h-9 w-full text-sm`}>
                    {busy === "test" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                    {busy === "test" ? "Sending…" : "Send test email"}
                  </button>
                  {testResult && (
                    <p
                      role={testResult.ok ? "status" : "alert"}
                      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ring-1 ring-inset ${
                        testResult.ok
                          ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/25"
                          : "bg-red-500/10 text-red-200 ring-red-400/30"
                      }`}
                    >
                      {testResult.ok && <CircleCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
                      {testResult.text}
                    </p>
                  )}
                  {!testResult && email.lastTestAt && (
                    <p className="text-[11px] text-zinc-400">Last test sent {timeAgo(email.lastTestAt)}.</p>
                  )}
                  <p className="text-[11px] leading-relaxed text-zinc-400">
                    Sent from <span className="font-mono text-zinc-300">{email.sender}</span>. Until a domain is verified at
                    resend.com/domains, Resend only delivers to the email address of the Resend account itself.
                  </p>
                </div>
              </>
            )}
          </section>

          {/* The rule */}
          {view && (
            <section className={`${surface} p-4`}>
              <h3 className="text-sm font-semibold text-zinc-100">When does it fire?</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                When Gemini rates a release a security fix of <strong className="text-zinc-200">{view.rule.minSeverity}</strong>{" "}
                severity (or worse) with <strong className="text-zinc-200">{view.rule.minImpact}</strong> impact (or worse),
                published in the last {view.rule.maxAgeHours} hours — so it never waits for the Monday digest, and old
                releases loaded by a backfill never trigger it.
              </p>
            </section>
          )}

          {/* Other channels */}
          {view && (
            <section className={`${surface} p-4`}>
              <h3 className="text-sm font-semibold text-zinc-100">Other channels</h3>
              <p className="mt-1 text-xs text-zinc-400">Optional, configured on the server.</p>
              <ul className="mt-3 space-y-2 text-xs">
                <li className="flex items-center justify-between gap-2 text-zinc-300">
                  Slack webhook <Pill tone={view.channels.slack ? "green" : "grey"}>{view.channels.slack ? "Connected" : "Not configured"}</Pill>
                </li>
                <li className="flex items-center justify-between gap-2 text-zinc-300">
                  ntfy push notifications <Pill tone={view.channels.ntfy ? "green" : "grey"}>{view.channels.ntfy ? "Connected" : "Not configured"}</Pill>
                </li>
              </ul>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

function Pill({ tone, children }: { tone: "green" | "grey" | "amber"; children: React.ReactNode }) {
  const styles = {
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30",
    grey: "bg-zinc-700/40 text-zinc-300 ring-white/10",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-400/30",
  }[tone];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${styles}`}>
      {children}
    </span>
  );
}

function Switch({
  checked,
  disabled,
  labelledBy,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  labelledBy: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${
        checked ? "bg-violet-500" : "bg-zinc-700"
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`}
      />
    </button>
  );
}
