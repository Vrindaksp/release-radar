"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TOUR_STEPS } from "@/lib/tour";
import { btnPrimary, btnSecondary, focusRing } from "./ui";

const PAD = 8; // breathing room around the spotlighted element
const GAP = 14; // between the spotlight and the tooltip
const MARGIN = 16; // minimum distance from the screen edge
const WIDTH = 360;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Placement {
  box: Box | null;
  tip: { top: number; left: number; width: number };
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high));

/** Height of whatever stays pinned to the top while scrolling (the header, or just the tab strip on phones). */
function stickyInset(): number {
  for (let node = document.querySelector("[role=tablist]"); node; node = node.parentElement) {
    if (getComputedStyle(node).position === "sticky") return node.getBoundingClientRect().height;
  }
  return 0;
}

/**
 * A guided tour, like the "how it works" flow when you join a design app: a spotlight glides from one
 * part of the page to the next with a short explanation beside it. It can be skipped at any point
 * (button, Esc), and the arrow keys move between steps.
 */
export default function Tour({ onClose }: { onClose: () => void }) {
  // Steps whose target isn't on the page right now are left out (e.g. swiping when nothing is urgent).
  const steps = useMemo(() => TOUR_STEPS.filter((step) => step.target === null || document.querySelector(step.target)), []);
  const [index, setIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const tipRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const reduced = useRef(false);

  const step = steps[index];
  const first = index === 0;
  const last = index === steps.length - 1;

  const next = useCallback(() => (last ? onClose() : setIndex((value) => value + 1)), [last, onClose]);
  const back = useCallback(() => setIndex((value) => Math.max(0, value - 1)), []);

  /** Works out where the spotlight and the tooltip go for the current step. */
  const layout = useCallback(() => {
    const target = step.target ? document.querySelector<HTMLElement>(step.target) : null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const narrow = vw < 640;
    const width = narrow ? vw - MARGIN * 2 : Math.min(WIDTH, vw - MARGIN * 2);
    const height = tipRef.current?.offsetHeight ?? 240;

    if (!target) {
      setPlacement({ box: null, tip: { top: clamp((vh - height) / 2, MARGIN, vh - height - MARGIN), left: (vw - width) / 2, width } });
      return;
    }
    const rect = target.getBoundingClientRect();
    const box = { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };
    if (narrow) {
      // Phones: the tooltip is docked to the bottom and the page is scrolled so the target sits above it.
      setPlacement({ box, tip: { top: vh - height - MARGIN, left: MARGIN, width } });
      return;
    }
    const left = clamp(box.left + box.width / 2 - width / 2, MARGIN, vw - width - MARGIN);
    const bigTarget = box.height > vh * 0.55;
    let top: number;
    if (!bigTarget && box.top + box.height + GAP + height <= vh - MARGIN) top = box.top + box.height + GAP;
    else if (!bigTarget && box.top - GAP - height >= MARGIN) top = box.top - GAP - height;
    else top = vh - height - MARGIN * 1.5; // nowhere beside it: float over the lower part of the screen
    setPlacement({ box, tip: { top, left, width } });
  }, [step]);

  // Scroll the target into a comfortable spot, then (re)measure while the scroll settles.
  useEffect(() => {
    const behavior: ScrollBehavior = reduced.current ? "auto" : "smooth";
    const target = step.target ? document.querySelector<HTMLElement>(step.target) : null;
    if (!target || step.scroll === "top") {
      window.scrollTo({ top: 0, behavior });
    } else {
      const narrow = window.innerWidth < 640;
      const dock = narrow ? (tipRef.current?.offsetHeight ?? 240) + MARGIN * 2 : MARGIN;
      const top = stickyInset();
      const available = window.innerHeight - top - dock;
      const rect = target.getBoundingClientRect();
      const delta = rect.height >= available ? rect.top - (top + 12) : rect.top + rect.height / 2 - (top + available / 2);
      window.scrollBy({ top: delta, behavior });
    }
    layout();
    const timers = [window.setTimeout(layout, 140), window.setTimeout(layout, 420)];
    return () => timers.forEach(window.clearTimeout);
  }, [step, layout]);

  // Keyboard focus follows the tour: onto the main button of each step. (The tooltip is hidden until it
  // has been measured, and hidden elements can't take focus, hence the `placed` dependency.)
  const placed = placement !== null;
  useEffect(() => {
    if (placed) primaryRef.current?.focus({ preventScroll: true });
  }, [placed, index]);

  // The tooltip glides between steps, but must appear in place the first time instead of flying in
  // from the corner, so the glide is only switched on once it has been placed.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!placed) return;
    const frame = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(frame);
  }, [placed]);

  useEffect(() => {
    let frame = 0;
    const remeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    };
    window.addEventListener("scroll", remeasure, true);
    window.addEventListener("resize", remeasure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", remeasure, true);
      window.removeEventListener("resize", remeasure);
    };
  }, [layout]);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the tour scrolls the page itself
    return () => {
      document.body.style.overflow = overflow;
      window.scrollTo({ top: 0 });
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, onClose]);

  /** Keeps Tab inside the tooltip while the tour is open. */
  function trapTab(event: React.KeyboardEvent) {
    if (event.key !== "Tab") return;
    const items = [...(tipRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])];
    if (items.length === 0) return;
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    if (event.shiftKey && document.activeElement === firstItem) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault();
      firstItem.focus();
    }
  }

  const glide = reduced.current ? "none" : "top 0.38s cubic-bezier(0.2, 0.8, 0.2, 1), left 0.38s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.38s cubic-bezier(0.2, 0.8, 0.2, 1), height 0.38s cubic-bezier(0.2, 0.8, 0.2, 1)";
  const box = placement?.box ?? null;

  return (
    <div className="fixed inset-0 z-[80]">
      {/* Catches clicks so the page underneath can't be used mid-tour; dims the page when nothing is spotlit. */}
      <div aria-hidden className={`absolute inset-0 transition-colors duration-300 ${box ? "" : "bg-zinc-950/80 backdrop-blur-sm"}`} />

      {box && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-3xl ring-2 ring-acid"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow: "0 0 0 100vmax rgba(9, 9, 11, 0.8), 0 0 30px 2px rgba(200, 255, 77, 0.35)",
            transition: glide,
          }}
        />
      )}

      <div
        ref={tipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        onKeyDown={trapTab}
        style={{
          top: placement?.tip.top ?? 0,
          left: placement?.tip.left ?? 0,
          width: placement?.tip.width ?? WIDTH,
          visibility: placement ? "visible" : "hidden",
          transition: reduced.current || !armed ? "none" : "top 0.38s cubic-bezier(0.2, 0.8, 0.2, 1), left 0.38s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
        className="absolute rounded-3xl border border-white/15 bg-zinc-900 p-5 shadow-2xl shadow-black/70"
      >
        <p className="font-display text-[11px] font-bold tracking-[0.2em] text-acid uppercase" aria-live="polite">
          {first ? "Quick tour" : `${index + 1} of ${steps.length}`}
        </p>
        <h2 id="tour-title" className="mt-1.5 font-display text-2xl leading-tight font-extrabold tracking-tight text-zinc-50">
          {step.title}
        </h2>
        <p id="tour-body" className="mt-2 text-sm leading-relaxed text-zinc-300">
          {step.body}
        </p>

        <div className="mt-4 flex items-center gap-1.5" aria-hidden>
          {steps.map((entry, position) => (
            <span
              key={entry.id}
              className={`h-1.5 rounded-full transition-all ${position === index ? "w-5 bg-acid" : position < index ? "w-1.5 bg-acid/50" : "w-1.5 bg-white/20"}`}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full px-3 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white ${focusRing}`}
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {!first && (
              <button type="button" onClick={back} aria-label="Previous step" className={`${btnSecondary} size-10`}>
                <ArrowLeft className="size-4" aria-hidden />
              </button>
            )}
            <button ref={primaryRef} type="button" onClick={next} className={`${btnPrimary} h-10 px-4 text-sm`}>
              {first ? "Show me around" : last ? "Let's go" : "Next"}
              {!last && <ArrowRight className="size-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
