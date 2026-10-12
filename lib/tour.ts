/**
 * The guided tour: what it says, and which part of the page each step points at.
 *
 * It runs on every visit, for everyone (nothing is remembered between visits), and can always be
 * skipped. Steps whose target isn't on the page right now (for example "swipe" when nothing is urgent)
 * are left out when the tour starts.
 */
export interface TourStep {
  id: string;
  /** CSS selector of the element to spotlight, or null for a centred card. */
  target: string | null;
  title: string;
  body: string;
  /** "top" scrolls to the top of the page first; "view" only scrolls as far as needed. */
  scroll: "top" | "view";
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Welcome to Release Radar 👋",
    body: "Your open-source dependencies ship new releases every week. Release Radar reads them, flags what matters and files the rest. Here's a 30-second tour.",
    scroll: "top",
  },
  {
    id: "vibe",
    target: '[data-tour="vibe"]',
    title: "Start with the vibe check",
    body: "One glance tells you if anything needs you. The emoji, the headline and even the glow behind the page change with how urgent things are.",
    scroll: "view",
  },
  {
    id: "swipe",
    target: '[data-tour="swipe"]',
    title: "Clear the urgent stuff by swiping",
    body: "Start swiping turns the urgent list into a deck. Left archives, right watches, up copies a ticket, and Z undoes. Clear the whole deck for a surprise 🎉",
    scroll: "view",
  },
  {
    id: "tiles",
    target: '[data-tour="tiles"]',
    title: "Tap a number to open its list",
    body: "Needs action, Watching and this week's noise. Each tile jumps straight to the right list.",
    scroll: "view",
  },
  {
    id: "tabs",
    target: '[data-tour="tabs"]',
    title: "Three lists, one at a time",
    body: "Immediate Triage holds security fixes and breaking changes. Watchlist Radar is routine stuff to keep an eye on. Archive is noise and history. Keys 1, 2 and 3 switch lists.",
    scroll: "top",
  },
  {
    id: "search",
    target: '[data-tour="search"]',
    title: "Ask My Digest",
    body: "Search any repo, version, CVE id or keyword. Press / to jump here from anywhere.",
    scroll: "top",
  },
  {
    id: "card",
    target: "#board-panel article",
    title: "Every card tells you what to do",
    body: "See why it's here, the recommended action and the effort. Copy a ready-made ticket in one click, read the original release notes, or hit Wrong severity? to teach the AI.",
    scroll: "view",
  },
  {
    id: "alerts",
    target: '[data-tour="alerts"]',
    title: "Critical stuff finds you",
    body: "A critical, high-impact security fix raises the red banner and emails you straight away. Choose who gets the email here.",
    scroll: "top",
  },
  {
    id: "repos",
    target: '[data-tour="repos"]',
    title: "Make it yours",
    body: "Add the repos you care about, say how important each one is, or load a year of history.",
    scroll: "top",
  },
  {
    id: "done",
    target: null,
    title: "You're all set ✨",
    body: "Press ? any time for the full how-it-works guide. You can replay this tour from there too. Now go clear that inbox.",
    scroll: "top",
  },
];
