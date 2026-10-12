"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Flag,
  Info,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  PencilLine,
} from "lucide-react";
import { fetchReleaseNotes } from "@/lib/client";
import { copyToClipboard, timeAgo } from "@/lib/format";
import { buildTicket } from "@/lib/ticket";
import { restoreColumnFor, whyHere } from "@/lib/triage";
import type { FeedbackInput, Release, TriageColumn } from "@/lib/types";
import {
  BreakingBadge,
  EffortPill,
  EmergencyBadge,
  LiveBadge,
  SampleBadge,
  SecurityBadge,
  TierBadge,
  VersionTag,
} from "./Badges";
import FeedbackPanel from "./FeedbackPanel";
import { focusRing, iconBtn } from "./ui";

interface ReleaseCardProps {
  release: Release;
  onMove: (release: Release, column: TriageColumn) => void;
  onFeedback: (release: Release, input: Omit<FeedbackInput, "releaseId">) => Promise<void>;
  onNotify: (kind: "success" | "error", message: string) => void;
}

function accentFor(release: Release): string {
  if (release.triageColumn === "Archived / Cleaned") return "border-l-zinc-600";
  if (release.isSecurityFix) return "border-l-hot";
  if (release.isBreakingChange) return "border-l-amber-400";
  return "border-l-ice";
}

/** The spotlight under the pointer (see .glow-card in globals.css) follows the cursor across the card. */
function trackPointer(event: React.PointerEvent<HTMLElement>) {
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--mx", `${event.clientX - box.left}px`);
  event.currentTarget.style.setProperty("--my", `${event.clientY - box.top}px`);
}

type NotesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; text: string | null; truncated: boolean }
  | { status: "error"; message: string };

export default function ReleaseCard({ release, onMove, onFeedback, onNotify }: ReleaseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState<NotesState>({ status: "idle" });
  const archived = release.triageColumn === "Archived / Cleaned";
  // Sample rows are fictional: there are no original notes to show, and logging corrections for
  // them would poison the tuning data.
  const canCorrect = !release.isSample;
  const canShowNotes = !release.isSample;
  // On open cards the recommended action is always visible; archived ones keep it in the details.
  const inlineAction = !archived && release.recommendedAction;
  const hasDetails = release.highlights.length > 0 || (archived && Boolean(release.recommendedAction)) || canShowNotes;

  /** Original GitHub notes are fetched the first time they're asked for, then kept. */
  async function loadNotes() {
    if (notes.status === "loading" || notes.status === "ready") return;
    setNotes({ status: "loading" });
    try {
      const result = await fetchReleaseNotes(release.id);
      setNotes({ status: "ready", text: result.notes, truncated: result.truncated });
    } catch (error) {
      setNotes({ status: "error", message: error instanceof Error ? error.message : "Couldn't load the notes." });
    }
  }

  async function handleCopy() {
    try {
      await copyToClipboard(buildTicket(release));
      setCopied(true);
      onNotify("success", `Ticket for ${release.repoName} ${release.versionTag} copied. Go be a hero 🦸`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify("error", "Couldn't access the clipboard — check browser permissions.");
    }
  }

  return (
    <article
      id={`release-${release.id}`}
      tabIndex={-1}
      onPointerMove={trackPointer}
      className={`glow-card animate-rise-in rounded-2xl border border-l-4 border-white/10 bg-zinc-900 shadow-lg shadow-black/30 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-xl hover:shadow-black/50 focus:outline-none ${accentFor(release)} ${archived ? "bg-zinc-900/60" : ""}`}
    >
      <div className="space-y-3 p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <a
              href={release.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`block truncate rounded font-display text-lg leading-tight font-extrabold tracking-tight text-zinc-50 transition-colors hover:text-acid ${focusRing}`}
              title={`${release.repoName} — open release on GitHub`}
            >
              {release.repoName}
            </a>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
              <TierBadge tier={release.tier} />
              <span className="truncate">{release.category}</span>
            </div>
          </div>
          <time
            dateTime={release.publishedAt}
            title={new Date(release.publishedAt).toLocaleString()}
            className="shrink-0 pt-0.5 text-xs text-zinc-400"
          >
            {timeAgo(release.publishedAt)}
          </time>
        </header>

        <div className="flex flex-wrap items-center gap-1.5">
          <VersionTag tag={release.versionTag} />
          {release.isSecurityFix && <SecurityBadge severity={release.securitySeverity} />}
          {release.isBreakingChange && <BreakingBadge />}
          <EmergencyBadge emergencyAt={release.emergencyAt} escalatedAt={release.escalatedAt} error={release.escalationError} />
          {release.ingestSource === "webhook" && <LiveBadge />}
          {release.isSample && <SampleBadge />}
        </div>

        <p className="text-sm leading-relaxed text-zinc-300">{release.geminiSummary}</p>

        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-zinc-400">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <span className="font-medium text-zinc-300">Why it&apos;s here:</span> {whyHere(release)}
          </span>
        </p>

        {inlineAction && (
          <div className="flex gap-2.5 rounded-r-lg border-l-2 border-violet-400/70 bg-violet-500/[0.08] py-2 pr-3 pl-3">
            <ListChecks className="mt-0.5 size-4 shrink-0 text-violet-300" aria-hidden />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-violet-300 uppercase">Recommended action</p>
              <p className="mt-0.5 text-sm leading-relaxed text-zinc-100">{inlineAction}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <EffortPill effort={release.effortScore} />
          {release.advisoryIds.map((id) => (
            <span
              key={id}
              className="rounded bg-red-500/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-red-300 ring-1 ring-red-400/25 ring-inset"
            >
              {id}
            </span>
          ))}
          {release.userCorrected && (
            <span
              title="You corrected Gemini's classification of this release"
              className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-[11px] font-medium text-violet-300 ring-1 ring-violet-400/30 ring-inset"
            >
              <PencilLine className="size-3" aria-hidden />
              corrected
            </span>
          )}
          {release.aiSource === "heuristic" && (
            <span
              title="Gemini returned nothing usable for this release, so keyword rules were used instead."
              className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-300 ring-1 ring-white/10 ring-inset"
            >
              keyword fallback
            </span>
          )}
        </div>

        {(hasDetails || canCorrect) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              {hasDetails ? (
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  aria-expanded={expanded}
                  className={`inline-flex items-center gap-1 rounded text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-100 ${focusRing}`}
                >
                  <ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
                  {expanded ? "Hide details" : canShowNotes ? "Key changes & original notes" : "Key changes"}
                </button>
              ) : (
                <span />
              )}
              {canCorrect && (
                <button
                  type="button"
                  onClick={() => setCorrecting((value) => !value)}
                  aria-expanded={correcting}
                  title="Tell Gemini it got the severity, effort or flags wrong"
                  className={`inline-flex shrink-0 items-center gap-1 rounded text-xs font-medium text-zinc-400 transition-colors hover:text-violet-300 ${focusRing}`}
                >
                  <Flag className="size-3" aria-hidden />
                  Wrong severity?
                </button>
              )}
            </div>
            {expanded && (
              <div className="space-y-2 rounded-lg bg-black/30 p-3 text-xs text-zinc-300 ring-1 ring-white/10 ring-inset">
                {release.highlights.length > 0 && (
                  <ul className="list-disc space-y-1 pl-4 marker:text-zinc-500">
                    {release.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                {archived && release.recommendedAction && (
                  <p className="flex items-start gap-1.5 font-medium text-zinc-100">
                    <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-300" aria-hidden />
                    {release.recommendedAction}
                  </p>
                )}
                {canShowNotes && <OriginalNotes state={notes} onLoad={loadNotes} />}
              </div>
            )}
            {correcting && (
              <FeedbackPanel
                release={release}
                onCancel={() => setCorrecting(false)}
                onSubmit={async (input) => {
                  await onFeedback(release, input);
                  setCorrecting(false);
                }}
              />
            )}
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-1.5 rounded-b-2xl border-t border-white/10 bg-black/20 px-3 py-2.5">
        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex min-w-0 flex-[1_1_15rem] items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold ring-1 transition-all ring-inset active:scale-[0.97] ${focusRing} ${
            copied ? "bg-emerald-500 text-zinc-950 ring-emerald-300" : "bg-acid/10 text-acid ring-acid/40 hover:bg-acid hover:text-zinc-950"
          }`}
        >
          {copied ? <Check className="size-3.5 shrink-0" aria-hidden /> : <Copy className="size-3.5 shrink-0" aria-hidden />}
          <span className="truncate">{copied ? "Copied!" : "Copy Release Note / Create Ticket"}</span>
        </button>

        {release.triageColumn === "Immediate Triage" && (
          <IconButton label="Move to Watchlist" onClick={() => onMove(release, "Watchlist Radar")}>
            <Eye className="size-4" aria-hidden />
          </IconButton>
        )}
        {release.triageColumn === "Watchlist Radar" && (
          <IconButton label="Escalate to Immediate Triage" onClick={() => onMove(release, "Immediate Triage")}>
            <ArrowUpFromLine className="size-4" aria-hidden />
          </IconButton>
        )}
        {archived ? (
          <IconButton label="Restore to board" onClick={() => onMove(release, restoreColumnFor(release.defaultColumn))}>
            <ArchiveRestore className="size-4" aria-hidden />
          </IconButton>
        ) : (
          <IconButton label="Mark as done — archive" onClick={() => onMove(release, "Archived / Cleaned")}>
            <Archive className="size-4" aria-hidden />
          </IconButton>
        )}
        <a
          href={release.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open release on GitHub"
          title="Open release on GitHub"
          className={`${iconBtn} size-8 shrink-0`}
        >
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </footer>
    </article>
  );
}

/**
 * "Check it yourself": the release notes exactly as GitHub published them, fetched on first open.
 * Rendered as plain text (never HTML), because anyone can write a release.
 */
function OriginalNotes({ state, onLoad }: { state: NotesState; onLoad: () => void }) {
  const [open, setOpen] = useState(false);

  function toggle() {
    if (!open) onLoad();
    setOpen((value) => !value);
  }

  return (
    <div className="border-t border-white/10 pt-2 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded font-medium text-zinc-300 transition-colors hover:text-zinc-100 ${focusRing}`}
      >
        <FileText className="size-3.5" aria-hidden />
        {open ? "Hide original release notes" : "Show original release notes"}
      </button>
      {open && (
        <div className="mt-2">
          {state.status === "loading" && (
            <p className="flex items-center gap-1.5 text-zinc-400" role="status">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              Loading the original notes…
            </p>
          )}
          {state.status === "error" && (
            <p className="text-red-300" role="alert">
              {state.message}{" "}
              <button type="button" onClick={onLoad} className={`rounded underline underline-offset-2 ${focusRing}`}>
                Try again
              </button>
            </p>
          )}
          {state.status === "ready" &&
            (state.text === null ? (
              <p className="text-zinc-400">No release notes were saved for this release.</p>
            ) : (
              <>
                <pre className="thin-scroll max-h-64 overflow-auto rounded-md bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap text-zinc-300 ring-1 ring-white/10 ring-inset">
                  {state.text}
                </pre>
                {state.truncated && <p className="mt-1 text-zinc-400">Long notes are cut off here. Open the release on GitHub for the rest.</p>}
              </>
            ))}
        </div>
      )}
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={`${iconBtn} size-8 shrink-0`}>
      {children}
    </button>
  );
}
