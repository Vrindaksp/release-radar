const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 days ago", "yesterday", "just now". */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  for (const [unit, size] of UNITS) {
    if (abs >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return relative.format(Math.round(seconds / 60), "minute");
}

/** "9 Oct 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Copies text to the clipboard, with a fallback for non-secure contexts. */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // fall through to the legacy path
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(area);
  if (!ok) throw new Error("Copy failed");
}
