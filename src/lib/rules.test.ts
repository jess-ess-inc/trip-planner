import { describe, expect, it } from "vitest";
import { charlestonTrip } from "@/data/charleston";
import { availText, canPlace, reason } from "./availability";
import { dayInfo, tripDays } from "./dates";
import { distanceText, walkMinutes } from "./geo";
import { holidaysDuring } from "./holidays";
import { initials } from "./travelers";
import type { Placement } from "./types";

const card = (id: string) => charlestonTrip.cards.find((c) => c.id === id)!;
const none: Record<string, Placement> = {};

describe("trip days", () => {
  it("runs from check-in through check-out", () => {
    const days = tripDays("2026-12-26", "2026-12-30");
    expect(days.map((d) => d.short + " " + d.dd)).toEqual(["Sat 26", "Sun 27", "Mon 28", "Tue 29", "Wed 30"]);
  });
});

describe("availability rules", () => {
  const mon = dayInfo("2026-12-28"), sat = dayInfo("2026-12-26");

  it("blocks a place on its closed weekday, with a reason", () => {
    expect(canPlace(none, card("zerogeorge"), mon, "dinner")).toBe(false);
    expect(reason(none, card("zerogeorge"), mon, "dinner")).toBe("Not offered Mon");
    expect(canPlace(none, card("zerogeorge"), sat, "dinner")).toBe(true);
  });

  it("keeps meal slots for dining cards only", () => {
    expect(canPlace(none, card("sumter"), sat, "lunch")).toBe(false);
    expect(reason(none, card("sumter"), sat, "lunch")).toBe("Dining picks only");
    expect(reason(none, card("verns"), sat, "evening")).toBe("Meals only");
  });

  it("limits date-bound cards to their dates", () => {
    expect(canPlace(none, card("choc"), sat, "afternoon")).toBe(true);
    expect(canPlace(none, card("choc"), mon, "afternoon")).toBe(false);
    expect(canPlace(none, card("arrive"), sat, "afternoon")).toBe(true);
    expect(canPlace(none, card("arrive"), mon, "afternoon")).toBe(false);
  });

  it("blocks the same card twice in one slot", () => {
    const placed = { p1: { card: "fig", date: sat.iso, slot: "dinner" as const, who: {}, at: 1 } };
    expect(canPlace(placed, card("fig"), sat, "dinner")).toBe(false);
    expect(reason(placed, card("fig"), sat, "dinner")).toBe("Already here");
  });

  it("keeps the Edmund's Oast highlights out of its weekday rules", () => {
    const c = card("edmunds");
    expect(Object.keys(c.byDow!).every((k) => /^\d$/.test(k))).toBe(true);
    expect(c.stars?.length).toBeGreaterThan(0);
    expect(availText(c, tripDays("2026-12-26", "2026-12-30"))).toBe("Sat 26, Sun 27, Tue 29, Wed 30 · Afternoon / Evening");
  });
});

describe("distances", () => {
  const bennett: [number, number] = [32.7866, -79.9369];
  it("uses straight-line × 1.25 at 80 m a minute", () => {
    // Bennett → Lewis Barbecue is about 2.5 km straight-line.
    expect(walkMinutes(bennett, [32.80866, -79.94664])).toBeGreaterThan(25);
  });
  it("switches to an approximate drive past 25 minutes", () => {
    expect(distanceText(bennett, { lat: 32.80866, lon: -79.94664 })).toMatch(/^about \d+ min drive \(approx\.\)$/);
    expect(distanceText(bennett, { lat: 32.7878, lon: -79.9378 })).toMatch(/^\d+ min walk$/);
  });
});

describe("holidays", () => {
  it("flags the week after Christmas", () => {
    expect(holidaysDuring("2026-12-26", "2026-12-30")).toEqual(["the Christmas–New Year's holiday week"]);
  });
  it("stays quiet for an ordinary week", () => {
    expect(holidaysDuring("2027-03-10", "2027-03-14")).toEqual([]);
  });
});

describe("traveler initials", () => {
  it("stay unique", () => {
    const ts = [{ id: "a", name: "Traveler 1" }, { id: "b", name: "Traveler 2" }, { id: "c", name: "Maria" }, { id: "d", name: "Mike" }];
    expect(initials(ts)).toEqual({ a: "T1", b: "T2", c: "M1", d: "M2" });
  });
});
