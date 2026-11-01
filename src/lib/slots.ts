import type { SlotKey } from "./types";

export interface SlotInfo {
  k: SlotKey;
  label: string;
  meal?: boolean;
}

export const SLOTS: SlotInfo[] = [
  { k: "early", label: "Early morning" },
  { k: "breakfast", label: "Breakfast", meal: true },
  { k: "morning", label: "Morning" },
  { k: "lunch", label: "Lunch", meal: true },
  { k: "afternoon", label: "Afternoon" },
  { k: "dinner", label: "Dinner", meal: true },
  { k: "evening", label: "Evening" },
  { k: "late", label: "Late night" },
];

export const SLOT = Object.fromEntries(SLOTS.map((s) => [s.k, s])) as Record<SlotKey, SlotInfo>;
