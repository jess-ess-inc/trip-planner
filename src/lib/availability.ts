import type { Card, Placement, SlotKey } from "./types";
import { SLOT, SLOTS } from "./slots";
import type { DayInfo } from "./dates";

const MEAL_SLOTS: SlotKey[] = ["breakfast", "lunch", "dinner"];

/** The slots a card can go in on one day, before meal rules. */
export function slotsFor(c: Card, day: DayInfo): SlotKey[] {
  if (c.dates && !c.dates.includes(day.iso)) return [];
  if (c.byDow) return c.byDow[day.dow] ?? [];
  return c.slots ?? [];
}

/** Meal slots take dining cards only, and dining cards only go in meal slots. */
function mealOk(c: Card, slot: SlotKey): boolean {
  return (c.kind === "eat") === MEAL_SLOTS.includes(slot);
}

export function isDup(placements: Record<string, Placement>, cardId: string, date: string, slot: SlotKey, exceptPid?: string): boolean {
  return Object.entries(placements).some(([pid, p]) => pid !== exceptPid && p.card === cardId && p.date === date && p.slot === slot);
}

export function canPlace(placements: Record<string, Placement>, c: Card, day: DayInfo, slot: SlotKey, exceptPid?: string): boolean {
  return mealOk(c, slot) && slotsFor(c, day).includes(slot) && !isDup(placements, c.id, day.iso, slot, exceptPid);
}

/** Why a card can't go in a slot. */
export function reason(placements: Record<string, Placement>, c: Card, day: DayInfo, slot: SlotKey, exceptPid?: string): string {
  if (isDup(placements, c.id, day.iso, slot, exceptPid)) return "Already here";
  const meal = !!SLOT[slot].meal;
  if (c.kind === "eat" && !meal) return "Meals only";
  if (c.kind !== "eat" && meal) return "Dining picks only";
  const sl = slotsFor(c, day);
  if (!sl.length) return "Not offered " + day.short;
  return SLOTS.filter((s) => sl.includes(s.k)).map((s) => s.label).join(" / ") + " only";
}

/** "Sat 26, Tue 29 · Dinner" or "Any day · Morning / Afternoon" */
export function availText(c: Card, days: DayInfo[]): string {
  const open = days.filter((d) => slotsFor(c, d).length);
  const set = new Set<SlotKey>();
  open.forEach((d) => slotsFor(c, d).forEach((s) => set.add(s)));
  const dayTxt = !open.length ? "Not offered on these dates" : open.length === days.length ? "Any day" : open.map((d) => d.short + " " + d.dd).join(", ");
  const slotTxt = SLOTS.filter((s) => set.has(s.k)).map((s) => s.label).join(" / ");
  return slotTxt ? dayTxt + " · " + slotTxt : dayTxt;
}

/** Just the slots, for cards open every day. */
export function slotsText(c: Card, days: DayInfo[]): string {
  if (c.byDow || c.dates) return availText(c, days);
  return SLOTS.filter((s) => (c.slots ?? []).includes(s.k)).map((s) => s.label).join(" / ");
}

export function isEdge(c: Card, days: DayInfo[]): boolean {
  return days.some((d) => {
    const sl = slotsFor(c, d);
    return sl.includes("early") || sl.includes("late");
  });
}
