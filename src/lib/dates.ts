export interface DayInfo {
  iso: string;
  dow: number;
  day: string;
  short: string;
  /** "Dec 26" */
  md: string;
  /** "26" */
  dd: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dayInfo(iso: string): DayInfo {
  const d = parse(iso);
  const dow = d.getUTCDay();
  return {
    iso,
    dow,
    day: DAY_NAMES[dow],
    short: DAY_NAMES[dow].slice(0, 3),
    md: MONTHS[d.getUTCMonth()] + " " + d.getUTCDate(),
    dd: String(d.getUTCDate()),
  };
}

/** Every day from check-in through check-out, inclusive. */
export function tripDays(checkIn: string, checkOut: string): DayInfo[] {
  const out: DayInfo[] = [];
  const end = parse(checkOut).getTime();
  for (let t = parse(checkIn).getTime(); t <= end && out.length < 31; t += 86400000) {
    out.push(dayInfo(toIso(new Date(t))));
  }
  return out;
}

export function nights(checkIn: string, checkOut: string): number {
  return Math.max(1, Math.round((parse(checkOut).getTime() - parse(checkIn).getTime()) / 86400000));
}

/** "Dec 26–30, 2026" or "Dec 30, 2026 – Jan 2, 2027" */
export function rangeText(checkIn: string, checkOut: string): string {
  const a = parse(checkIn), b = parse(checkOut);
  const ya = a.getUTCFullYear(), yb = b.getUTCFullYear();
  const ma = MONTHS[a.getUTCMonth()], mb = MONTHS[b.getUTCMonth()];
  if (ya !== yb) return `${ma} ${a.getUTCDate()}, ${ya} – ${mb} ${b.getUTCDate()}, ${yb}`;
  if (ma !== mb) return `${ma} ${a.getUTCDate()} – ${mb} ${b.getUTCDate()}, ${ya}`;
  return `${ma} ${a.getUTCDate()}–${b.getUTCDate()}, ${ya}`;
}
