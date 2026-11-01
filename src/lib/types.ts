export type SlotKey = "early" | "breakfast" | "morning" | "lunch" | "afternoon" | "dinner" | "evening" | "late";
export type CardKind = "do" | "eat" | "shop";
export type GuideKey = "acts" | "dining" | "shops";

/** One recommendation. The guide, the map and the planner all draw from the same card. */
export interface Card {
  id: string;
  kind: CardKind;
  title: string;
  /** Short timing line, e.g. "Leaves 5 pm, about 3 hours". */
  when?: string;
  area?: string;
  addr?: string;
  lat?: number;
  lon?: number;
  /** Cuisine for restaurants, type for activities and shops. */
  cuisine?: string;
  /** Price level or cost, only when a source gives it. */
  price?: string;
  badges?: string[];
  /** 1–2 highlights. */
  stars?: string[];
  /** The "Heads up" line. */
  con?: string;
  /** Primary source. */
  link?: string;
  slots?: SlotKey[];
  /** ISO dates the card is limited to. */
  dates?: string[];
  /** Slots per weekday (0 = Sunday). A weekday that's missing means closed. */
  byDow?: Partial<Record<number, SlotKey[]>>;
  /** Guide filter tabs. */
  cats?: string[];
  interests?: string[];
  /** "No booking needed". */
  misc?: boolean;
  /** "Confirm days when booking". */
  check?: boolean;
  /** Which guide shows it. Cards without one are planner-only. */
  guide?: GuideKey;
  /** Fallback distance text for places without coordinates. */
  drive?: string;
}

export interface Hotel {
  id: string;
  name: string;
  sub?: string;
  lat: number;
  lon: number;
  /** Values for the comparison table, keyed by row id. Missing means "None". */
  rows: Record<string, string>;
  /** Nightly rate the traveler typed in. */
  rate?: number;
  pros: string[];
  cons: string[];
}

export interface Sight {
  name: string;
  lat: number;
  lon: number;
}

export interface Street {
  name: string;
  pts: [number, number][];
  label: [number, number];
}

export interface Traveler {
  id: string;
  name: string;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  region: string;
  /** ISO dates. Days run from check-in through check-out. */
  checkIn: string;
  checkOut: string;
  /** Index into hotels of the baseline the others are compared against. */
  baseline: number;
  hotels: Hotel[];
  roomTaxPct: number;
  cards: Card[];
  sights: Sight[];
  streets: Street[];
}

export interface Placement {
  card: string;
  date: string;
  slot: SlotKey;
  who: Record<string, boolean>;
  at: number;
}
