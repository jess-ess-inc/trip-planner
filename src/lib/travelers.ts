import type { Traveler } from "./types";

export const MAX_TRAVELERS = 8;

export function newTraveler(existing: Traveler[]): Traveler {
  let n = 1;
  while (existing.some((t) => t.name === "Traveler " + n)) n++;
  return { id: "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: "Traveler " + n };
}

/** Short initials that stay unique within the group: "Maria" → "M", "Traveler 2" → "T2". */
export function initials(travelers: Traveler[]): Record<string, string> {
  const base = (name: string) => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "?";
    return (words[0][0] + (words[1] ? words[1][0] : "")).toUpperCase();
  };
  const out: Record<string, string> = {};
  const seen: Record<string, number> = {};
  travelers.forEach((t) => {
    const b = base(t.name);
    seen[b] = (seen[b] ?? 0) + 1;
  });
  const used: Record<string, number> = {};
  travelers.forEach((t) => {
    const b = base(t.name);
    if (seen[b] === 1) out[t.id] = b;
    else {
      used[b] = (used[b] ?? 0) + 1;
      out[t.id] = b.slice(0, 1) + used[b];
    }
  });
  return out;
}

/** Each traveler gets one of eight theme colors, in order. */
export function colorVar(index: number): string {
  return `var(--p${(index % MAX_TRAVELERS) + 1})`;
}
