// Men's Club Invitational — everything the page says, as data.
//
// BLANK SLATE. Every list below is empty and every unknown is null. The page
// already has all of its tabs and sections; anything still empty shows a
// "coming soon" state that says what will appear there. Add the real details
// here as the committee settles them and the page picks them up — no markup
// to touch. (Photos live in /public/invitational/img.)

export type TabKey =
  | "home"
  | "schedule"
  | "flights"
  | "format"
  | "field"
  | "wagering"
  | "prizes"
  | "info";

// ---- The event ------------------------------------------------------------

export const EVENT = {
  name: "Men's Club Invitational",
  year: 2027,
  /** First day of play as "YYYY-MM-DD". Set it and the home page starts a countdown. */
  startDate: null as string | null,
  /** How the dates read in the hero, e.g. "June 12 & 13, 2027". */
  datesLabel: null as string | null,
  /** One line under the title, e.g. "Two days of better-ball at MacKenzie's masterpiece". */
  tagline: null as string | null,
  /** Short name of the format for the facts strip, e.g. "Better Ball". */
  format: null as string | null,
  /** Entry deadline for the facts strip, e.g. "May 1". */
  entryDeadline: null as string | null,
  /** Where meals and the awards are held, e.g. "MacKenzie Room". */
  venue: null as string | null,
};

// ---- Schedule -------------------------------------------------------------

export interface ScheduleItem {
  time: string; // "7:30 AM"
  title: string; // "Breakfast"
  note?: string; // "MacKenzie Room"
}
export interface ScheduleDay {
  day: string; // "Friday"
  date: string; // "June 12"
  tag?: string; // "Round One"
  items: ScheduleItem[];
}
export const SCHEDULE: ScheduleDay[] = [];

// ---- Teams, flights and pairings -----------------------------------------

export interface Team {
  /** Member first, then guest(s). */
  players: string[];
  /** Combined handicap or index, as it should read. */
  hcp?: string;
  /** Guest's home club, or anything else worth a line. */
  note?: string;
}
/** Everyone entered. Shown on The Field tab. */
export const FIELD: Team[] = [];

export interface Pairing {
  time: string; // "8:00 AM"
  hole?: string; // "1st tee" / "Shotgun · 7A"
  teams: string[]; // "Smith / Jones"
}
export interface Flight {
  name: string; // "Championship Flight"
  teams: Team[];
  pairings?: Pairing[];
}
export const FLIGHTS: Flight[] = [];

// ---- Format, wagering, prizes -------------------------------------------

/** A titled block of paragraphs (Format and Wagering tabs). */
export interface Copy {
  heading: string;
  body: string[];
}
export const FORMAT: Copy[] = [];
export const WAGERING: Copy[] = [];

export interface Prize {
  name: string;
  award: string;
  big?: boolean;
}
export interface PrizeGroup {
  heading: string;
  prizes: Prize[];
}
export const PRIZES: PrizeGroup[] = [];

// ---- Player information --------------------------------------------------
// The headings are here already so the Info tab has its shape; fill in the
// bodies. A card with an empty body says "details coming soon".

export type InfoIcon = "entry" | "guest" | "dress" | "range" | "cart" | "bed";
export interface InfoItem {
  heading: string;
  icon: InfoIcon;
  body: string[];
}
export const INFO: InfoItem[] = [
  { heading: "Entry & Registration", icon: "entry", body: [] },
  { heading: "Guest Policy", icon: "guest", body: [] },
  { heading: "Dress Code", icon: "dress", body: [] },
  { heading: "Practice & Range", icon: "range", body: [] },
  { heading: "Caddies & Carts", icon: "cart", body: [] },
  { heading: "Lodging & Travel", icon: "bed", body: [] },
];

// ---- People ---------------------------------------------------------------

export const CONTACTS = [
  { name: "Ken Woods", role: "Director of Golf", phone: "(831) 459-9159" },
  { name: "Chris Ingram", role: "Head Golf Professional", phone: "(831) 459-9155" },
];

export interface CommitteeMember {
  name: string;
  role: string;
}
export const COMMITTEE: CommitteeMember[] = [];

// ---- Tabs -----------------------------------------------------------------
// Page structure: the label in the nav, the photo and heading at the top of
// each tab, the line on its home-page card, and what its "coming soon" state
// promises.

export interface TabMeta {
  key: TabKey;
  label: string;
  eyebrow: string;
  title: string;
  photo: string;
  /** CSS object-position for the photo crop. */
  focus: string;
  blurb: string;
  coming: string[];
}

const IMG = "/invitational/img/";

export const TABS: TabMeta[] = [
  {
    key: "home",
    label: "Home",
    eyebrow: "Pasatiempo Men's Club",
    title: "Men's Club Invitational",
    photo: IMG + "hero.avif",
    focus: "center 55%",
    blurb: "",
    coming: [],
  },
  {
    key: "schedule",
    label: "Schedule",
    eyebrow: "Day by Day",
    title: "Schedule of Events",
    photo: IMG + "schedule.avif",
    focus: "center 55%",
    blurb: "Arrivals, tee times, meals and the evening events — every day of the Invitational.",
    coming: ["Arrival & practice round", "Tee times for each round", "Meals & receptions", "Awards ceremony"],
  },
  {
    key: "flights",
    label: "Flights",
    eyebrow: "Pairings & Tee Times",
    title: "Flights",
    photo: IMG + "aerial.avif",
    focus: "center 50%",
    blurb: "Which flight you're in, who you play, and when you go off.",
    coming: ["Flight assignments", "Pairings for each round", "Starting holes & tee times"],
  },
  {
    key: "format",
    label: "Format",
    eyebrow: "How It's Played",
    title: "Format of Play",
    photo: IMG + "formats.avif",
    focus: "center 60%",
    blurb: "The competition, the handicap allowances, and how ties are settled.",
    coming: ["Competition format", "Handicap allowances", "Tiebreakers", "Local rules"],
  },
  {
    key: "field",
    label: "The Field",
    eyebrow: "This Year's Teams",
    title: "The Field",
    photo: IMG + "sixteenth.jpg",
    focus: "center 55%",
    blurb: "Every team entered in this year's Invitational.",
    coming: ["Team entries", "Handicaps", "Guests' home clubs"],
  },
  {
    key: "wagering",
    label: "Wagering",
    eyebrow: "Optional Games",
    title: "Wagering",
    photo: IMG + "bunkers-green.avif",
    focus: "center 45%",
    blurb: "The optional buy-ins, the side games, and how the pools pay out.",
    coming: ["Optional buy-ins", "Side games", "How payouts work"],
  },
  {
    key: "prizes",
    label: "Prizes",
    eyebrow: "Something to Play For",
    title: "Prizes & Payouts",
    photo: IMG + "course-green.jpg",
    focus: "center 60%",
    blurb: "Overall champions, flight winners, and the on-course contests.",
    coming: ["Overall champions", "Flight prizes", "Closest-to-the-pin & long drive"],
  },
  {
    key: "info",
    label: "Info",
    eyebrow: "Before You Arrive",
    title: "Player Information",
    photo: IMG + "clubhouse-green.jpg",
    focus: "center 50%",
    blurb: "Entry, guests, dress code, the range, lodging — and who to call.",
    coming: [],
  },
];

export const TAB_KEYS = TABS.map((t) => t.key);

export function isTab(v: string): v is TabKey {
  return (TAB_KEYS as string[]).includes(v);
}

/** Has anything been posted on this tab yet? Drives the "coming soon" badges. */
export function isPosted(tab: TabKey): boolean {
  switch (tab) {
    case "home":
      return true;
    case "schedule":
      return SCHEDULE.length > 0;
    case "flights":
      return FLIGHTS.length > 0;
    case "format":
      return FORMAT.length > 0;
    case "field":
      return FIELD.length > 0;
    case "wagering":
      return WAGERING.length > 0;
    case "prizes":
      return PRIZES.length > 0;
    case "info":
      return INFO.some((i) => i.body.length > 0);
  }
}
