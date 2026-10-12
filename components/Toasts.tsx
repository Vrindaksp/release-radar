"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { focusRing } from "./ui";

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
  /** Optional one-click follow-up, e.g. "Undo". */
  action?: { label: string; onClick: () => void };
}

const STYLES = {
  success: { box: "border-emerald-400/30 bg-emerald-950/90 text-emerald-50", icon: CircleCheck, tint: "text-emerald-300" },
  error: { box: "border-red-400/30 bg-red-950/90 text-red-50", icon: CircleAlert, tint: "text-red-300" },
  info: { box: "border-white/15 bg-zinc-900/95 text-zinc-100", icon: Info, tint: "text-indigo-300" },
} as const;

export default function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const style = STYLES[toast.kind];
        const Icon = style.icon;
        return (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={`animate-rise-in pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm shadow-2xl shadow-black/50 backdrop-blur ${style.box}`}
          >
            <Icon className={`mt-0.5 size-4 shrink-0 ${style.tint}`} aria-hidden />
            <p className="min-w-0 flex-1 break-words">{toast.message}</p>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action!.onClick();
                  onDismiss(toast.id);
                }}
                className={`shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-white ring-1 ring-white/15 ring-inset transition-colors hover:bg-white/20 ${focusRing}`}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className={`rounded p-0.5 opacity-70 transition-opacity hover:opacity-100 ${focusRing}`}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
