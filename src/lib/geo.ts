import type { Card } from "./types";

export type LatLon = [number, number];

export function meters(a: LatLon, b: LatLon): number {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Curation rule 6: straight-line distance × 1.25, at 80 m a minute. */
export function walkMinutes(from: LatLon, to: LatLon): number {
  return Math.max(1, Math.round((meters(from, to) * 1.25) / 80));
}

export const WALK_LIMIT = 25;

/** Rough drive time: roads ~1.4× straight-line, ~30 km/h in town, plus 5 minutes to park. */
export function driveMinutes(from: LatLon, to: LatLon): number {
  const km = (meters(from, to) * 1.4) / 1000;
  return Math.max(5, Math.round((km / 30) * 60 + 5));
}

export function distanceText(from: LatLon, c: Pick<Card, "lat" | "lon" | "drive" | "misc">): string {
  if (c.lat == null || c.lon == null) return c.drive ?? (c.misc ? "At the hotel" : "");
  const to: LatLon = [c.lat, c.lon];
  const m = walkMinutes(from, to);
  if (m <= WALK_LIMIT) return m + " min walk";
  return "about " + driveMinutes(from, to) + " min drive (approx.)";
}
