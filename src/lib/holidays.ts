// A small US holiday list for curation rule 8. A full multi-country calendar comes with the
// recommendation engine; this covers the dates that most often change hours.

interface Window {
  name: string;
  start: string;
  end: string;
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The nth weekday (0 = Sunday) of a month; n = -1 for the last. */
function nthDow(y: number, m: number, dow: number, n: number): number {
  if (n > 0) {
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    return 1 + ((dow - first + 7) % 7) + (n - 1) * 7;
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lastDow = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
  return lastDay - ((lastDow - dow + 7) % 7);
}

function windows(y: number): Window[] {
  const thanks = nthDow(y, 11, 4, 4);
  return [
    { name: "New Year's Day", start: iso(y, 1, 1), end: iso(y, 1, 1) },
    { name: "Memorial Day", start: iso(y, 5, nthDow(y, 5, 1, -1)), end: iso(y, 5, nthDow(y, 5, 1, -1)) },
    { name: "the Fourth of July", start: iso(y, 7, 4), end: iso(y, 7, 4) },
    { name: "Labor Day", start: iso(y, 9, nthDow(y, 9, 1, 1)), end: iso(y, 9, nthDow(y, 9, 1, 1)) },
    { name: "Thanksgiving", start: iso(y, 11, thanks), end: iso(y, 11, thanks + 1) },
    { name: "the Christmas–New Year's holiday week", start: iso(y, 12, 24), end: iso(y, 12, 31) },
  ];
}

/** The holidays a trip overlaps, if any. */
export function holidaysDuring(checkIn: string, checkOut: string): string[] {
  const years = new Set([Number(checkIn.slice(0, 4)), Number(checkOut.slice(0, 4))]);
  const hits: string[] = [];
  years.forEach((y) => windows(y).forEach((w) => {
    if (w.start <= checkOut && w.end >= checkIn && !hits.includes(w.name)) hits.push(w.name);
  }));
  return hits;
}
