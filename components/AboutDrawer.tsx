"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, CircleHelp, ExternalLink, X } from "lucide-react";
import type { AlertsView } from "@/lib/types";
import { drawerBackdrop, drawerHeader, drawerPanel, focusRing, iconBtn, surface } from "./ui";

interface AboutDrawerProps {
  onClose: () => void;
  /** The live emergency rule, so the text matches what the server actually does. null until it has loaded. */
  rule: AlertsView["rule"] | null;
  /** Closes this panel and starts the guided tour again. */
  onReplayTour: () => void;
}

const REPO_URL = "https://github.com/Vrindaksp/release-radar";

const STEPS: { title: string; body: (rule: AboutDrawerProps["rule"]) => React.ReactNode }[] = [
  {
    title: "Collect",
    body: () => (
      <>
        Every Monday at 12:00 UTC (or when you press Sync now) it reads the newest GitHub releases of each repo you track.
        A GitHub webhook can also push a release the moment it is published.
      </>
    ),
  },
  {
    title: "Analyse",
    body: () => (
      <>
        Gemini Flash reads each new release&apos;s notes and returns a short summary, the key changes, whether it is a
        security fix (with severity and impact) or a breaking change, whether it is routine noise, and the effort to adopt
        it. Each release is analysed once and cached.
      </>
    ),
  },
  {
    title: "Triage",
    body: () => (
      <>
        Fixed rules, not the AI, pick the list: a security fix or breaking change goes to Immediate Triage, anything else
        to Watchlist Radar, and pure noise to the Archive. Nothing is ever deleted.
      </>
    ),
  },
  {
    title: "Escalate",
    body: (rule) => (
      <>
        A {rule ? rule.minSeverity : "critical"}-severity, {rule ? rule.minImpact.toLowerCase() : "high"}-impact security
        fix published in the last {rule ? rule.maxAgeHours : 72} hours does not wait for the digest: it raises the red
        banner and sends an email.
      </>
    ),
  },
  {
    title: "Learn",
    body: () => (
      <>
        Press &ldquo;Wrong severity?&rdquo; on a card to correct it. Your corrections are saved and shown to Gemini as
        worked examples on later releases, so it calibrates to your judgement.
      </>
    ),
  },
];

const SECTION_TITLE = "text-xs font-semibold tracking-wider text-violet-300 uppercase";

const ROLES: { who: string; does: string }[] = [
  { who: "Gemini", does: "Reads the release text and proposes the summary, the flags and the ratings." },
  { who: "The rules", does: "Decide which list a release lands in and when an alert fires. They are deterministic and the same every time." },
  { who: "You", does: "Move, archive and correct cards. The final call on every release is yours." },
];

const LIMITS = [
  "It reads GitHub release notes only, not issues, pull requests, commits or advisory databases. A project that publishes no notes can look quiet.",
  "Gemini can get a classification wrong. Open a card's original release notes to check, and correct it if needed. When Gemini returns nothing usable, a keyword fallback is used and the card says so.",
  "Weekly polling is not real time. Only repos with the webhook set up are reported the moment a release is published (that needs admin rights on the repo).",
  "Email goes through Resend's test sender, so it only reaches the Resend account owner's address until a domain is verified.",
  "There is no sign-in, so anyone with the link can see and triage the digest. Setting DASHBOARD_PASSWORD on the server locks it behind a password.",
  "Free-tier limits apply. If Gemini rate-limits, a backfill pauses and can be re-run to continue.",
];

const SHORTCUTS: [string, string][] = [
  ["/", "Search"],
  ["1 2 3", "Switch list"],
  ["S", "Swipe triage"],
  ["?", "This panel"],
  ["Esc", "Close a panel"],
];

/** "How it works": the pipeline, who decides what, and where it falls short. */
export default function AboutDrawer({ onClose, rule, onReplayTour }: AboutDrawerProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className={drawerBackdrop} onClick={onClose} aria-hidden />
      <aside ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="about-title" className={`${drawerPanel} focus:outline-none`}>
        <header className={drawerHeader}>
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/25 ring-inset">
              <CircleHelp className="size-4" aria-hidden />
            </span>
            <div>
              <h2 id="about-title" className="text-sm font-semibold text-zinc-100">
                How Release Radar works
              </h2>
              <p className="text-xs text-zinc-400">What it does, who decides what, and where it falls short</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`${iconBtn} p-1.5`}>
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="thin-scroll min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <button
            type="button"
            onClick={onReplayTour}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-acid/10 px-4 py-3 text-left text-sm font-bold text-acid ring-1 ring-acid/40 transition-colors ring-inset hover:bg-acid hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acid"
          >
            Take the guided tour again
            <ArrowRight className="size-4" aria-hidden />
          </button>

          <section aria-labelledby="about-pipeline">
            <h3 id="about-pipeline" className={SECTION_TITLE}>
              From release to list
            </h3>
            <ol className="mt-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < STEPS.length - 1 && <span aria-hidden className="absolute top-7 bottom-0 left-3 w-px bg-white/10" />}
                  <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-500/15 font-mono text-xs font-semibold text-violet-200 ring-1 ring-violet-400/30 ring-inset">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    <strong className="font-semibold text-zinc-100">{step.title}.</strong> {step.body(rule)}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="about-roles">
            <h3 id="about-roles" className={SECTION_TITLE}>
              Roles
            </h3>
            <dl className={`${surface} mt-3 divide-y divide-white/10`}>
              {ROLES.map((row) => (
                <div key={row.who} className="grid grid-cols-[5.5rem_1fr] gap-3 px-4 py-3 text-sm">
                  <dt className="font-semibold text-zinc-100">{row.who}</dt>
                  <dd className="leading-relaxed text-zinc-400">{row.does}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="about-limits">
            <h3 id="about-limits" className={SECTION_TITLE}>
              Where it falls short
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-400 marker:text-zinc-600">
              {LIMITS.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="about-keys">
            <h3 id="about-keys" className={SECTION_TITLE}>
              Keyboard
            </h3>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-400">
              {SHORTCUTS.map(([keys, what]) => (
                <li key={keys} className="flex items-center gap-2">
                  <kbd className="rounded border border-white/15 bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">{keys}</kbd>
                  {what}
                </li>
              ))}
            </ul>
          </section>

          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 rounded text-sm font-medium text-violet-300 underline-offset-2 hover:underline ${focusRing}`}
          >
            Source code and setup guide
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </aside>
    </div>
  );
}
