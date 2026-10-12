/**
 * Shared class strings for the dark theme, so inputs, buttons and surfaces look the same
 * everywhere. Neutrals are Tailwind's zinc scale; the accent is acid lime (see globals.css).
 */

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acid";

/** Text inputs and selects. */
export const inputClass =
  "w-full rounded-xl border border-white/10 bg-zinc-900 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors hover:border-white/20 focus:border-acid/70 focus:outline-2 focus:outline-acid/25 disabled:cursor-not-allowed disabled:opacity-60";

/** The one loud button: acid lime with black text. */
export const btnPrimary = `inline-flex items-center justify-center gap-2 rounded-xl bg-acid font-bold text-zinc-950 shadow-[0_6px_22px_-8px_rgba(200,255,77,0.65)] transition-all hover:-translate-y-px hover:brightness-105 active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${focusRing}`;

export const btnSecondary = `inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-800 font-semibold text-zinc-100 ring-1 ring-white/10 ring-inset transition-all hover:bg-zinc-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const iconBtn = `inline-flex items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100 ${focusRing}`;

/** A raised surface (cards inside drawers). */
export const surface = "rounded-2xl border border-white/10 bg-zinc-900/70";

/** A slide-over drawer's panel. */
export const drawerPanel =
  "animate-slide-in relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-zinc-950 shadow-2xl shadow-black/60";

export const drawerHeader = "flex items-center justify-between gap-3 border-b border-white/10 bg-zinc-950 px-5 py-4";

export const drawerBackdrop = "animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-[2px]";
