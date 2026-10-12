"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, ArrowLeft, ArrowRight, ArrowUp, ExternalLink, Eye, Lightbulb, Ticket, Undo2, X } from "lucide-react";
import { actionForDrag, DECK_ACTIONS, leaning, tally, type DeckAction } from "@/lib/deck";
import { copyToClipboard, timeAgo } from "@/lib/format";
import { buildTicket } from "@/lib/ticket";
import { whyHere } from "@/lib/triage";
import type { Release, TriageColumn } from "@/lib/types";
import { BreakingBadge, EffortPill, EmergencyBadge, SecurityBadge, TierBadge, VersionTag } from "./Badges";
import Confetti from "./Confetti";
import { btnPrimary, focusRing } from "./ui";

interface SwipeDeckProps {
  /** The urgent list, dealt out in this order. A snapshot: it does not change as cards are moved. */
  queue: Release[];
  onMove: (release: Release, column: TriageColumn) => void | Promise<void>;
  onNotify: (kind: "success" | "error" | "info", message: string) => void;
  onClose: () => void;
}

interface Played {
  release: Release;
  action: DeckAction;
}

const FLY_MS = 260;

const STAMPS: Record<DeckAction, { text: string; classes: string; place: string }> = {
  archive: { text: "Yeet", classes: "border-zinc-200 text-zinc-100", place: "top-6 right-5 rotate-[10deg]" },
  watch: { text: "Watch 👀", classes: "border-ice text-ice", place: "top-6 left-5 -rotate-[10deg]" },
  ticket: { text: "Ticket 🎫", classes: "border-acid text-acid", place: "bottom-24 left-1/2 -translate-x-1/2 -rotate-[4deg]" },
};

/**
 * Swipe triage: the urgent list as a deck of cards. Drag a card (or use the buttons / arrow keys):
 * left archives it, right moves it to the watchlist, up copies a ticket and moves on. Clearing the
 * deck earns confetti. Every move is undoable with Z.
 */
export default function SwipeDeck({ queue, onMove, onNotify, onClose }: SwipeDeckProps) {
  const [index, setIndex] = useState(0);
  const [played, setPlayed] = useState<Played[]>([]);
  const [drag, setDrag] = useState({ dx: 0, dy: 0, active: false });
  const [flying, setFlying] = useState<{ action: DeckAction; x: number; y: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const origin = useRef<{ x: number; y: number } | null>(null);
  const latest = useRef({ dx: 0, dy: 0 });
  const busy = useRef(false);
  const reduced = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const finished = index >= queue.length;

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const resetDrag = useCallback(() => {
    latest.current = { dx: 0, dy: 0 };
    setDrag({ dx: 0, dy: 0, active: false });
  }, []);

  const commit = useCallback(
    async (action: DeckAction) => {
      if (busy.current || index >= queue.length) return;
      busy.current = true;
      const release = queue[index];
      if (action === "ticket") {
        try {
          await copyToClipboard(buildTicket(release));
        } catch {
          onNotify("error", "Couldn't reach the clipboard. Check your browser permissions.");
          busy.current = false;
          resetDrag();
          return;
        }
        onNotify("success", `Ticket for ${release.repoName} ${release.versionTag} copied. Go be a hero 🦸`);
      }
      const reach = Math.max(window.innerWidth, window.innerHeight) + 240;
      setFlying({ action, x: action === "archive" ? -reach : action === "watch" ? reach : 0, y: action === "ticket" ? -reach : 0 });
      navigator.vibrate?.(14);
      window.setTimeout(
        () => {
          setFlying(null);
          resetDrag();
          setIndex((value) => value + 1);
          setPlayed((list) => [...list, { release, action }]);
          const column = DECK_ACTIONS[action].column;
          if (column) void onMove(release, column);
          const left = queue.length - index - 1;
          setAnnouncement(
            `${action === "archive" ? "Archived" : action === "watch" ? "Moved to watchlist" : "Ticket copied for"} ${release.repoName} ${release.versionTag}. ${left} left.`,
          );
          busy.current = false;
        },
        reduced.current ? 0 : FLY_MS,
      );
    },
    [index, queue, onMove, onNotify, resetDrag],
  );

  const undo = useCallback(() => {
    if (busy.current || played.length === 0) return;
    const last = played[played.length - 1];
    setPlayed((list) => list.slice(0, -1));
    setIndex((value) => value - 1);
    if (DECK_ACTIONS[last.action].column) void onMove(last.release, "Immediate Triage");
    setAnnouncement(`Undid ${last.release.repoName} ${last.release.versionTag}.`);
  }, [played, onMove]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const byKey: Record<string, DeckAction> = { ArrowLeft: "archive", ArrowRight: "watch", ArrowUp: "ticket" };
      if (event.key === "Escape") {
        onClose();
      } else if (byKey[event.key]) {
        event.preventDefault();
        void commit(byKey[event.key]);
      } else if (event.key === "z" || event.key === "Z") {
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, undo, onClose]);

  // ---- dragging --------------------------------------------------------------------------
  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (busy.current || (event.target as HTMLElement).closest("a, button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = { x: event.clientX, y: event.clientY };
    latest.current = { dx: 0, dy: 0 };
    setDrag({ dx: 0, dy: 0, active: true });
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!origin.current) return;
    latest.current = { dx: event.clientX - origin.current.x, dy: event.clientY - origin.current.y };
    setDrag({ ...latest.current, active: true });
  }

  function onPointerEnd() {
    if (!origin.current) return;
    origin.current = null;
    const action = actionForDrag(latest.current.dx, latest.current.dy);
    if (action) void commit(action);
    else resetDrag();
  }

  // ---- render ----------------------------------------------------------------------------
  const counts = tally(played.map((entry) => entry.action));
  const lean = flying ? { action: flying.action, strength: 1 } : drag.active ? leaning(drag.dx, drag.dy) : null;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Swipe triage"
      className="animate-fade-in fixed inset-0 z-[55] flex flex-col bg-zinc-950/85 backdrop-blur-md focus:outline-none"
    >
      <header className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pt-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-extrabold tracking-tight text-zinc-50">Swipe triage</p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <div className="h-full rounded-full bg-acid transition-[width] duration-300" style={{ width: `${(Math.min(index, queue.length) / queue.length) * 100}%` }} />
          </div>
        </div>
        <span className="text-xs font-semibold text-zinc-400 tabular-nums">
          {Math.min(index + 1, queue.length)} / {queue.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close swipe triage (Esc)"
          className={`rounded-full p-2 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white ${focusRing}`}
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {finished ? (
        <Finished counts={counts} total={queue.length} onUndo={undo} onClose={onClose} />
      ) : (
        <>
          <div className="flex flex-1 items-center justify-center px-4 py-4">
            <div className="relative h-[min(60vh,31rem)] w-[min(92vw,26rem)]">
              {queue
                .slice(index, index + 3)
                .map((release, offset) => ({ release, offset }))
                .reverse()
                .map(({ release, offset }) => {
                  const top = offset === 0;
                  let transform = `translateY(${offset * 14}px) scale(${1 - offset * 0.05})`;
                  let transition = "transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1.1), opacity 300ms";
                  if (top && flying) {
                    transform = `translate(${flying.x}px, ${flying.y}px) rotate(${flying.x === 0 ? 0 : flying.x > 0 ? 22 : -22}deg)`;
                    transition = reduced.current ? "none" : `transform ${FLY_MS}ms ease-in, opacity ${FLY_MS}ms`;
                  } else if (top && drag.active) {
                    transform = `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx / 18}deg)`;
                    transition = "none";
                  }
                  return (
                    <div
                      key={release.id}
                      aria-hidden={!top}
                      inert={!top}
                      onPointerDown={top ? onPointerDown : undefined}
                      onPointerMove={top ? onPointerMove : undefined}
                      onPointerUp={top ? onPointerEnd : undefined}
                      onPointerCancel={top ? onPointerEnd : undefined}
                      style={{ transform, transition, opacity: top && flying ? 0 : 1 - offset * 0.2, touchAction: "none", zIndex: 10 - offset }}
                      className={`absolute inset-0 select-none ${top ? "cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      <DeckCard release={release} />
                      {top &&
                        (Object.keys(STAMPS) as DeckAction[]).map((action) => {
                          const stamp = STAMPS[action];
                          const strength = lean && lean.action === action ? lean.strength : 0;
                          return (
                            <span
                              key={action}
                              aria-hidden
                              style={{ opacity: strength, transform: `scale(${0.8 + strength * 0.25})` }}
                              className={`pointer-events-none absolute rounded-xl border-4 bg-zinc-950/70 px-3 py-1 font-display text-2xl font-extrabold tracking-wider uppercase ${stamp.classes} ${stamp.place}`}
                            >
                              {stamp.text}
                            </span>
                          );
                        })}
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="mx-auto w-full max-w-xl px-4 pb-6">
            <div className="flex items-start justify-center gap-5 sm:gap-8">
              <ControlButton label="Archive" hint={<ArrowLeft className="size-3" />} tone="border-zinc-500/60 text-zinc-100 hover:bg-white/10" onClick={() => void commit("archive")}>
                <Archive className="size-6" aria-hidden />
              </ControlButton>
              <ControlButton label="Ticket" hint={<ArrowUp className="size-3" />} tone="border-acid/70 text-acid hover:bg-acid/15" onClick={() => void commit("ticket")} big>
                <Ticket className="size-7" aria-hidden />
              </ControlButton>
              <ControlButton label="Watch" hint={<ArrowRight className="size-3" />} tone="border-ice/70 text-ice hover:bg-ice/15" onClick={() => void commit("watch")}>
                <Eye className="size-6" aria-hidden />
              </ControlButton>
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-zinc-400">
              <button
                type="button"
                onClick={undo}
                disabled={played.length === 0}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold transition-colors enabled:hover:bg-white/10 enabled:hover:text-white disabled:opacity-40 ${focusRing}`}
              >
                <Undo2 className="size-3.5" aria-hidden />
                Undo <kbd className="rounded border border-white/15 bg-zinc-800 px-1 font-mono text-[11px]">Z</kbd>
              </button>
              <span className="hidden sm:inline">Drag the card, or use the arrow keys</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ControlButton({
  label,
  hint,
  tone,
  big,
  onClick,
  children,
}: {
  label: string;
  hint: React.ReactNode;
  tone: string;
  big?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`flex items-center justify-center rounded-full border-2 bg-zinc-900/80 shadow-lg shadow-black/40 transition-all hover:-translate-y-0.5 active:scale-90 ${big ? "size-[4.5rem]" : "size-16"} ${tone} ${focusRing}`}
      >
        {children}
      </button>
      <span className="flex items-center gap-1 text-xs font-semibold text-zinc-300">
        {label}
        <span aria-hidden className="text-zinc-500">
          {hint}
        </span>
      </span>
    </div>
  );
}

/** One card in the deck: the essentials of a release, big enough to read in a glance. */
function DeckCard({ release }: { release: Release }) {
  const edge = release.isSecurityFix
    ? "border-hot/60 shadow-[0_0_44px_-14px_rgba(255,92,151,0.6)]"
    : release.isBreakingChange
      ? "border-amber-300/50 shadow-[0_0_44px_-14px_rgba(251,191,36,0.45)]"
      : "border-white/15";
  return (
    <article className={`flex h-full flex-col gap-3 overflow-hidden rounded-[2rem] border-2 bg-zinc-900 p-5 shadow-2xl shadow-black/60 sm:p-6 ${edge}`}>
      <header className="flex items-center justify-between gap-2 text-xs text-zinc-400">
        <span className="flex min-w-0 items-center gap-1.5">
          <TierBadge tier={release.tier} />
          <span className="truncate">{release.category}</span>
        </span>
        <time dateTime={release.publishedAt} className="shrink-0">
          {timeAgo(release.publishedAt)}
        </time>
      </header>

      <h3 className="font-display text-2xl leading-tight font-extrabold tracking-tight break-words text-zinc-50 sm:text-3xl">{release.repoName}</h3>

      <div className="flex flex-wrap items-center gap-1.5">
        <VersionTag tag={release.versionTag} />
        {release.isSecurityFix && <SecurityBadge severity={release.securitySeverity} />}
        {release.isBreakingChange && <BreakingBadge />}
        <EmergencyBadge emergencyAt={release.emergencyAt} escalatedAt={release.escalatedAt} error={release.escalationError} />
      </div>

      <p className="line-clamp-5 text-base leading-relaxed text-zinc-100 sm:text-lg">{release.geminiSummary}</p>

      {release.recommendedAction && (
        <p className="flex items-start gap-2 rounded-2xl bg-white/[0.06] p-3 text-sm leading-relaxed text-zinc-100">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-acid" aria-hidden />
          <span className="line-clamp-3">{release.recommendedAction}</span>
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <EffortPill effort={release.effortScore} />
        <a
          href={release.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white ${focusRing}`}
        >
          GitHub
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>
      <p className="text-[11px] leading-snug text-zinc-400">{whyHere(release)}</p>
    </article>
  );
}

/** The end of the deck. If nothing is still open: inbox zero, with confetti. */
function Finished({ counts, total, onUndo, onClose }: { counts: ReturnType<typeof tally>; total: number; onUndo: () => void; onClose: () => void }) {
  const cleared = counts.ticket === 0;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      {cleared && <Confetti />}
      <span aria-hidden className="animate-pop-in text-7xl sm:text-8xl">
        {cleared ? "🎉" : "🙌"}
      </span>
      <h2 className="animate-pop-in font-display text-5xl font-extrabold tracking-tight text-zinc-50 sm:text-6xl">{cleared ? "Inbox zero." : "That's the deck."}</h2>
      <p className="max-w-sm text-base text-zinc-300">
        {cleared
          ? total === 1
            ? "One down. Nothing urgent is waiting. Go touch grass 🌱"
            : `${total} down. Nothing urgent is waiting. Go touch grass 🌱`
          : `${counts.ticket === 1 ? "1 ticket was" : `${counts.ticket} tickets were`} copied. Those releases stay in Immediate Triage until you archive them.`}
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-2 text-sm font-semibold">
        <li className="rounded-full bg-white/10 px-3 py-1 text-zinc-100">{counts.archive} archived</li>
        <li className="rounded-full bg-ice/15 px-3 py-1 text-cyan-100">{counts.watch} watching</li>
        <li className="rounded-full bg-acid/15 px-3 py-1 text-lime-100">{counts.ticket} ticketed</li>
      </ul>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={onClose} className={`${btnPrimary} h-12 px-6 text-base`}>
          Back to the board
        </button>
        <button type="button" onClick={onUndo} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white ${focusRing}`}>
          <Undo2 className="size-4" aria-hidden />
          Undo last
        </button>
      </div>
    </div>
  );
}
