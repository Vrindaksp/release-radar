"use client";

import { Siren } from "lucide-react";
import type { Release } from "@/lib/types";
import { focusRing } from "./ui";

const MAX_LISTED = 3;

/**
 * Pinned above the board whenever a critical, high-impact security fix is still
 * sitting in Immediate Triage. It needs no external service: it is the always-on
 * part of the emergency escalation. Triage the card (archive / move it) and the
 * banner clears.
 */
export default function EmergencyBanner({ releases, onJump }: { releases: Release[]; onJump: (release: Release) => void }) {
  const urgent = releases.filter((r) => r.emergencyAt && r.triageColumn === "Immediate Triage");
  if (urgent.length === 0) return null;

  // Switching to the Immediate Triage tab (if needed) and scrolling to the card is the page's job.
  const jump = (release: Release) => onJump(release);

  return (
    <div
      role="alert"
      className="shrink-0 border-b border-red-500/40 bg-gradient-to-r from-red-950 via-red-950/80 to-zinc-950 px-4 py-2 text-sm text-red-50"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <p className="flex items-center gap-2 font-semibold">
          <Siren className="size-4 animate-pulse text-red-300" aria-hidden />
          Emergency: {urgent.length} critical security {urgent.length === 1 ? "release needs" : "releases need"} immediate
          action
        </p>
        <ul className="flex flex-wrap items-center gap-1.5">
          {urgent.slice(0, MAX_LISTED).map((release) => (
            <li key={release.id}>
              <button
                type="button"
                onClick={() => jump(release)}
                title={release.geminiSummary}
                className={`rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs font-semibold text-red-50 ring-1 ring-white/15 ring-inset transition-colors hover:bg-white/20 ${focusRing}`}
              >
                {release.repoName} {release.versionTag}
              </button>
            </li>
          ))}
          {urgent.length > MAX_LISTED && <li className="text-xs font-medium text-red-200">+{urgent.length - MAX_LISTED} more</li>}
        </ul>
      </div>
    </div>
  );
}
