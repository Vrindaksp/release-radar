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
  Flag,
  Lightbulb,
  PencilLine,
} from "lucide-react";
import { copyToClipboard, timeAgo } from "@/lib/format";
import { buildTicket } from "@/lib/ticket";
import { restoreColumnFor } from "@/lib/triage";
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
  if (release.isSecurityFix) return "border-l-red-500";
  if (release.isBreakingChange) return "border-l-orange-500";
  return "border-l-sky-500";
}

export default function ReleaseCard({ release, onMove, onFeedback, onNotify }: ReleaseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const archived = release.triageColumn === "Archived / Cleaned";
  const hasDetails = release.highlights.length > 0 || Boolean(release.recommendedAction);
  // Sample rows are fictional — logging corrections for them would poison the tuning data.
  const canCorrect = !release.isSample;

  async function handleCopy() {
    try {
      await copyToClipboard(buildTicket(release));
      setCopied(true);
      onNotify("success", `Ticket for ${release.repoName} ${release.versionTag} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify("error", "Couldn't access the clipboard — check browser permissions.");
    }
  }

  return (
    <article
      id={`release-${release.id}`}
      tabIndex={-1}
      className={`animate-rise-in rounded-xl border border-l-4 border-white/10 bg-zinc-900 shadow-lg shadow-black/30 transition-colors hover:border-white/20 hover:bg-zinc-900 focus:outline-none ${accentFor(release)} ${archived ? "bg-zinc-900/60" : ""}`}
    >
      <div className="space-y-3 p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <a
              href={release.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`block truncate rounded text-sm font-semibold text-zinc-100 transition-colors hover:text-indigo-300 hover:underline ${focusRing}`}
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
              className="inline-flex items-center gap-1 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[11px] font-medium text-indigo-300 ring-1 ring-indigo-400/30 ring-inset"
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
                  {expanded ? "Hide details" : "Key changes & recommended action"}
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
                  className={`inline-flex shrink-0 items-center gap-1 rounded text-xs font-medium text-zinc-400 transition-colors hover:text-indigo-300 ${focusRing}`}
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
                {release.recommendedAction && (
                  <p className="flex items-start gap-1.5 font-medium text-zinc-100">
                    <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-300" aria-hidden />
                    {release.recommendedAction}
                  </p>
                )}
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

      <footer className="flex flex-wrap items-center gap-1.5 rounded-b-xl border-t border-white/10 bg-black/20 px-3 py-2.5">
        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex min-w-0 flex-[1_1_15rem] items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors ${focusRing} ${
            copied ? "bg-emerald-600" : "bg-indigo-600 shadow-indigo-950/60 hover:bg-indigo-500"
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

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={`${iconBtn} size-8 shrink-0`}>
      {children}
    </button>
  );
}
