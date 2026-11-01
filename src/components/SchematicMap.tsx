"use client";

import type { Hotel, Street } from "@/lib/types";
import type { LatLon } from "@/lib/geo";

export interface MapPin {
  id: string;
  n: number;
  lat: number;
  lon: number;
  label: string;
}

interface Props {
  ariaLabel: string;
  hub: LatLon;
  hubHotelId?: string;
  hotels: Hotel[];
  streets: Street[];
  pins: MapPin[];
  /** Walk-ring radii in minutes, drawn around the hub. */
  rings?: number[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  pinClass?: string;
}

const WIDTH = 640;
const PIN_GAP = 23;

/**
 * A simple schematic map (north up, not to scale for streets). A real tiled map replaces this in a later
 * milestone; the projection, rings and pin layout carry over.
 */
export default function SchematicMap({ ariaLabel, hub, hubHotelId, hotels, streets, pins, rings = [10, 20], selected, onSelect, pinClass = "mpin" }: Props) {
  const pts: LatLon[] = [hub, ...hotels.map((h) => [h.lat, h.lon] as LatLon), ...pins.map((p) => [p.lat, p.lon] as LatLon)];
  const lats = pts.map((p) => p[0]), lons = pts.map((p) => p[1]);
  const cos = Math.cos((hub[0] * Math.PI) / 180);
  let lat0 = Math.max(...lats), lat1 = Math.min(...lats), lon0 = Math.min(...lons), lon1 = Math.max(...lons);
  const padLat = Math.max(0.003, (lat0 - lat1) * 0.1), padLon = Math.max(0.003, (lon1 - lon0) * 0.1);
  lat0 += padLat; lat1 -= padLat; lon0 -= padLon; lon1 += padLon;
  const wDeg = (lon1 - lon0) * cos, hDeg = lat0 - lat1;
  const k = WIDTH / Math.max(wDeg, hDeg * 0.9);
  const W = Math.round(wDeg * k), H = Math.round(hDeg * k);
  const proj = (lat: number, lon: number): [number, number] => [(lon - lon0) * cos * k, (lat0 - lat) * k];
  const ringR = (min: number) => ((min * 80) / 1.25 / 111000) * k;
  const h = proj(hub[0], hub[1]);

  // Nudge overlapping pins outward along a spiral so every number stays tappable.
  const placed: [number, number][] = [];
  const laid = pins.map((p) => {
    const [px, py] = proj(p.lat, p.lon);
    let x = px, y = py, step = 0;
    while (placed.some((q) => Math.hypot(q[0] - x, q[1] - y) < PIN_GAP) && step < 40) {
      step++;
      const ang = step * 2.4, r = 12 + step * 2.6;
      x = px + Math.cos(ang) * r;
      y = py + Math.sin(ang) * r;
    }
    placed.push([x, y]);
    return { ...p, x, y };
  });

  const line = (ps: [number, number][]) => ps.map((p) => proj(p[0], p[1]).map((v) => v.toFixed(1)).join(",")).join(" ");
  const key = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(id); }
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} xmlns="http://www.w3.org/2000/svg" fontFamily="Karla, Arial, sans-serif">
      <rect x="0" y="0" width={W} height={H} rx="8" fill="var(--bg)" />
      {streets.map((s) => (
        <polyline key={s.name} points={line(s.pts)} fill="none" stroke="var(--line)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {streets.map((s) => {
        const q = proj(s.label[0], s.label[1]);
        return <text key={s.name + "-l"} x={q[0].toFixed(0)} y={(q[1] + 16).toFixed(0)} fill="var(--muted)" fontSize="11">{s.name}</text>;
      })}
      {rings.map((m) => (
        <g key={m}>
          <circle cx={h[0].toFixed(1)} cy={h[1].toFixed(1)} r={ringR(m).toFixed(1)} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 6" />
          <text x={(h[0] - ringR(m) * 0.71).toFixed(0)} y={(h[1] + ringR(m) * 0.71 + 14).toFixed(0)} textAnchor="end" fill="var(--accent-deep)" fontSize="11" fontFamily="IBM Plex Mono, monospace">{m} min</text>
        </g>
      ))}
      {hotels.map((ho, i) => {
        const q = proj(ho.lat, ho.lon);
        const right = i % 2 === 0;
        return (
          <g key={ho.id}>
            <rect className={"smap-hotel" + (ho.id === hubHotelId ? " on" : "")} x={(q[0] - 6).toFixed(1)} y={(q[1] - 6).toFixed(1)} width="12" height="12" rx="2" />
            <text x={(q[0] + (right ? 12 : -12)).toFixed(0)} y={(q[1] + (i === 2 ? 16 : -8)).toFixed(0)} textAnchor={right ? "start" : "end"} fill="var(--ink)" fontSize="12" fontWeight="700">{ho.name}</text>
          </g>
        );
      })}
      {laid.map((p) => (
        <g key={p.id} className={pinClass + (selected === p.id ? " on" : "")} tabIndex={onSelect ? 0 : undefined} role={onSelect ? "button" : undefined} aria-label={`${p.n}. ${p.label}`} onClick={onSelect ? () => onSelect(p.id) : undefined} onKeyDown={onSelect ? (e) => key(e, p.id) : undefined}>
          <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="11" />
          <text x={p.x.toFixed(1)} y={p.y.toFixed(1)}>{p.n}</text>
        </g>
      ))}
      <text x={W - 10} y="20" textAnchor="end" fill="var(--muted)" fontSize="11">N ↑</text>
    </svg>
  );
}
