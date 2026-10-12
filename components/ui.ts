/**
 * Shared class strings for the dark theme, so inputs, buttons and surfaces look the same
 * everywhere. Neutrals are Tailwind's zinc scale; accent is indigo.
 */

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

/** Text inputs and selects. */
export const inputClass =
  "w-full rounded-lg border border-white/10 bg-zinc-900 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors hover:border-white/20 focus:border-indigo-400/70 focus:outline-2 focus:outline-indigo-400/25 disabled:cursor-not-allowed disabled:opacity-60";

export const btnPrimary = `inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 font-semibold text-white shadow-sm shadow-indigo-950/60 transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const btnSecondary = `inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-800 font-semibold text-zinc-100 ring-1 ring-white/10 ring-inset transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const iconBtn = `inline-flex items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100 ${focusRing}`;

/** A raised surface (cards inside drawers). */
export const surface = "rounded-xl border border-white/10 bg-zinc-900/70";

/** A slide-over drawer's panel. */
export const drawerPanel =
  "animate-slide-in relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-zinc-950 shadow-2xl shadow-black/60";

export const drawerHeader = "flex items-center justify-between gap-3 border-b border-white/10 bg-zinc-950 px-5 py-4";

export const drawerBackdrop = "animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-[2px]";
