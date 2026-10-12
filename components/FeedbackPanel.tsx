"use client";

import { useId, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { effortLabel } from "@/lib/triage";
import {
  EFFORT_SCORES,
  SECURITY_SEVERITIES,
  type EffortScore,
  type FeedbackInput,
  type Release,
  type SecuritySeverity,
} from "@/lib/types";
import { btnPrimary, focusRing, inputClass } from "./ui";

const SEVERITY_LABELS: Record<SecuritySeverity, string> = {
  none: "Not a security fix",
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical",
};

interface FeedbackPanelProps {
  release: Release;
  onSubmit: (input: Omit<FeedbackInput, "releaseId">) => Promise<void>;
  onCancel: () => void;
}

/**
 * Inline "this classification is wrong" form. Pre-filled with Gemini's answer;
 * only the fields Keerthi changes are sent. The correction is logged to Neon and
 * replayed to Gemini as a calibration example on future analyses.
 */
export default function FeedbackPanel({ release, onSubmit, onCancel }: FeedbackPanelProps) {
  const id = useId();
  const [severity, setSeverity] = useState<SecuritySeverity>(release.securitySeverity);
  const [breaking, setBreaking] = useState(release.isBreakingChange);
  const [noise, setNoise] = useState(release.isNoise);
  const [effort, setEffort] = useState<EffortScore>(release.effortScore);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flagged = severity !== "none" || breaking;
  const changed =
    severity !== release.securitySeverity ||
    breaking !== release.isBreakingChange ||
    (!flagged && noise !== release.isNoise) ||
    effort !== release.effortScore;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!changed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        securitySeverity: severity,
        isBreakingChange: breaking,
        isNoise: flagged ? false : noise,
        effortScore: effort,
        note: note.trim() || undefined,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save the correction.");
      setSubmitting(false);
    }
  }

  const fieldClass = `${inputClass} h-8 px-2 text-xs`;

  return (
    <form
      onSubmit={submit}
      aria-label={`Correct the classification of ${release.repoName} ${release.versionTag}`}
      className="animate-rise-in space-y-3 rounded-lg border border-violet-400/25 bg-violet-500/10 p-3 text-xs text-zinc-300"
    >
      <p className="font-semibold text-zinc-100">What did Gemini get wrong?</p>

      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
        <label htmlFor={`${id}-sev`} className="font-medium text-zinc-300">
          Security
        </label>
        <select
          id={`${id}-sev`}
          value={severity}
          onChange={(event) => setSeverity(event.target.value as SecuritySeverity)}
          className={fieldClass}
        >
          {SECURITY_SEVERITIES.map((value) => (
            <option key={value} value={value}>
              {SEVERITY_LABELS[value]}
            </option>
          ))}
        </select>

        <span className="font-medium text-zinc-300" id={`${id}-effort`}>
          Effort
        </span>
        <div role="group" aria-labelledby={`${id}-effort`} className="flex gap-1">
          {EFFORT_SCORES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={effort === value}
              onClick={() => setEffort(value)}
              className={`h-8 flex-1 rounded-lg border text-xs font-semibold transition-colors ${focusRing} ${
                effort === value
                  ? "border-violet-400/60 bg-violet-600 text-white"
                  : "border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {effortLabel(value)}
            </button>
          ))}
        </div>

        <span className="font-medium text-zinc-300">Flags</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={breaking} onChange={(event) => setBreaking(event.target.checked)} className="size-3.5 accent-violet-500" />
            Breaking change
          </label>
          <label className={`inline-flex items-center gap-1.5 ${flagged ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={flagged ? false : noise}
              disabled={flagged}
              onChange={(event) => setNoise(event.target.checked)}
              className="size-3.5 accent-violet-500"
            />
            Just routine noise
          </label>
        </div>
      </div>

      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={280}
        placeholder="Why? (optional — this helps tune Gemini)"
        aria-label="Reason for the correction"
        className={fieldClass}
      />

      {error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-2.5 py-2 text-red-200 ring-1 ring-red-400/30 ring-inset">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-400">Logged and used to calibrate future analyses.</p>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className={`h-8 rounded-lg px-2.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10 ${focusRing}`}
          >
            Cancel
          </button>
          <button type="submit" disabled={!changed || submitting} className={`${btnPrimary} h-8 px-3 text-xs`}>
            {submitting && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
            Log correction
          </button>
        </div>
      </div>
    </form>
  );
}
