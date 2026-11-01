const PUBLISHERS: [string, string][] = [
  ["guide.michelin.com", "Michelin Guide"],
  ["theinfatuation.com", "The Infatuation"],
  ["resy.com", "Resy"],
  ["charlestoncitypaper.com", "City Paper"],
  ["postandcourier.com", "Post and Courier"],
  ["islands.com", "Islands"],
  ["thelocalpalate.com", "The Local Palate"],
  ["biteofthebest.com", "Bite of the Best"],
  ["oysterlink.com", "OysterLink"],
  ["hotelsabovepar.com", "Hotels Above Par"],
  ["charlestonmag.com", "Charleston Magazine"],
  ["fodors.com", "Fodor's"],
  ["gardenandgun.com", "Garden & Gun"],
  ["nps.gov", "National Park Service"],
  ["viator.com", "Viator"],
  ["historictours.com", "Old Town Trolley"],
  ["undergrounddonuttour.com", "Tour page"],
  ["thebettervacation.com", "The Better Vacation"],
  ["travelnoire.com", "Travel Noire"],
  ["visit-historic-charleston.com", "Historic Charleston"],
  ["ownerrez.com", "Brewery guide"],
];

/** Label a source link by its publication, e.g. "Michelin Guide". */
export function sourceLabel(url: string): string {
  const host = (url.match(/^https?:\/\/([^/]+)/) ?? [])[1] ?? "";
  for (const [domain, name] of PUBLISHERS) if (host === domain || host.endsWith("." + domain)) return name;
  return "Website";
}
