"use client";

import { FlaskConical, FolderGit2, LoaderCircle, Plug, RotateCw } from "lucide-react";
import { btnPrimary, btnSecondary } from "./ui";

export function BoardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl" aria-busy="true" aria-label="Loading digest">
      <div className="mb-4 h-5 w-72 max-w-full animate-pulse rounded bg-zinc-800" />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((card) => (
          <div key={card} className="space-y-3 rounded-xl border border-l-4 border-white/10 border-l-zinc-700 bg-zinc-900 p-4">
            <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-800" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-zinc-800" />
            <div className="h-3 w-full animate-pulse rounded bg-zinc-800" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shown when /api/releases fails — most often a missing DATABASE_URL on first run. */
export function ErrorPanel({ message, status, onRetry }: { message: string; status: number; onRetry: () => void }) {
  const setup = status === 503;
  return (
    <div className="mx-auto my-10 w-full max-w-xl rounded-2xl border border-red-400/25 bg-zinc-900/80 p-6 shadow-xl shadow-black/40">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-300 ring-1 ring-red-400/25 ring-inset">
          <Plug className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-100">{setup ? "Setup needed" : "Couldn't load the digest"}</h2>
          <p className="mt-1 text-sm break-words text-zinc-300">{message}</p>
          {setup && (
            <p className="mt-2 text-xs text-zinc-400">
              See <code className="rounded bg-zinc-800 px-1 font-mono text-zinc-200">.env.example</code> for the variables this
              app needs, then restart the dev server.
            </p>
          )}
          <button type="button" onClick={onRetry} className={`${btnSecondary} mt-4 px-3 py-2 text-xs`}>
            <RotateCw className="size-3.5" aria-hidden />
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shown when no repositories are tracked yet. */
export function FirstRunPanel({
  onAddRepo,
  onLoadSample,
  loadingSample,
}: {
  onAddRepo: () => void;
  onLoadSample: () => void;
  loadingSample: boolean;
}) {
  return (
    <div className="mx-auto my-10 w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-900/70 p-8 text-center shadow-xl shadow-black/40">
      <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/25 ring-inset">
        <FolderGit2 className="size-6" aria-hidden />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-zinc-100">No repositories tracked yet</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Add the GitHub repositories you care about. Release Radar pulls their releases every Monday, filters out the
        noise with Gemini Flash, and sorts what&apos;s left onto the board.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <button type="button" onClick={onAddRepo} className={`${btnPrimary} px-4 py-2 text-sm`}>
          <FolderGit2 className="size-4" aria-hidden />
          Add a repository
        </button>
        <button type="button" onClick={onLoadSample} disabled={loadingSample} className={`${btnSecondary} px-4 py-2 text-sm`}>
          {loadingSample ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <FlaskConical className="size-4 text-violet-300" aria-hidden />
          )}
          Load sample data
        </button>
      </div>
    </div>
  );
}
