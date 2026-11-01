"use client";

import { useEffect, useMemo, useState } from "react";
import type { GuideKey, Placement, Traveler, Trip } from "@/lib/types";
import { nights, rangeText, tripDays } from "@/lib/dates";
import { SLOT } from "@/lib/slots";
import { distanceText, walkMinutes, type LatLon } from "@/lib/geo";
import { holidaysDuring } from "@/lib/holidays";
import { load, save } from "@/lib/storage";
import { MAX_TRAVELERS, newTraveler } from "@/lib/travelers";
import { sourceLabel } from "@/lib/sources";
import { useReducedMotion } from "@/lib/hooks";
import Hotels, { type Costs } from "./Hotels";
import DiningGuide from "./DiningGuide";
import Planner from "./Planner";
import SchematicMap from "./SchematicMap";
import { SimpleGuide } from "./Guide";

const ACT_TABS = { tours: "Tours & classes", history: "History & museums", drinks: "Drinks", sweets: "Sweet stops" };
const SHOP_TABS = { gifts: "Gifts & jewelry", fashion: "Fashion", home: "Antiques & home", books: "Books", market: "Sweets & markets" };

const JUMPS: { id: string; label: string; guide?: GuideKey }[] = [
  { id: "hotels", label: "Hotels" },
  { id: "activities", label: "Things to do", guide: "acts" },
  { id: "dining", label: "Dining", guide: "dining" },
  { id: "shopping", label: "Shopping", guide: "shops" },
  { id: "plan", label: "Planner" },
];

type Placements = Record<string, Placement>;

export default function TripPage({ trip }: { trip: Trip }) {
  const days = useMemo(() => tripDays(trip.checkIn, trip.checkOut), [trip.checkIn, trip.checkOut]);
  const cardById = useMemo(() => Object.fromEntries(trip.cards.map((c) => [c.id, c])), [trip.cards]);
  const range = rangeText(trip.checkIn, trip.checkOut);
  const holidays = holidaysDuring(trip.checkIn, trip.checkOut);
  const reduceMotion = useReducedMotion();
  const key = (k: string) => `tp:${trip.id}:${k}`;

  const [loaded, setLoaded] = useState(false);
  const [travelers, setTravelers] = useState<Traveler[]>([{ id: "t1", name: "Traveler 1" }]);
  const [placements, setPlacementsState] = useState<Placements>({});
  const [hubId, setHubId] = useState(trip.hotels[trip.baseline]?.id ?? "");
  const [guides, setGuides] = useState<Record<GuideKey, boolean>>({ acts: false, dining: false, shops: false });
  const [costs, setCosts] = useState<Costs>({
    rooms: 1,
    nights: nights(trip.checkIn, trip.checkOut),
    taxPct: trip.roomTaxPct,
    rates: Object.fromEntries(trip.hotels.map((h) => [h.id, h.rate ?? 0])),
  });
  const [pick, setPick] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  // Load what this device remembers, dropping anything that no longer fits the trip.
  useEffect(() => {
    const ts = load<Traveler[]>(key("travelers"), []);
    if (Array.isArray(ts) && ts.length) setTravelers(ts.slice(0, MAX_TRAVELERS).filter((t) => t && typeof t.id === "string" && typeof t.name === "string"));
    const raw = load<Placements>(key("placements"), {});
    const isoSet = new Set(days.map((d) => d.iso));
    const clean: Placements = {};
    Object.entries(raw ?? {}).forEach(([pid, p]) => {
      if (p && cardById[p.card] && isoSet.has(p.date) && SLOT[p.slot]) clean[pid] = { card: p.card, date: p.date, slot: p.slot, at: Number(p.at) || 0, who: p.who && typeof p.who === "object" ? p.who : {} };
    });
    setPlacementsState(clean);
    const hub = load<string>(key("hub"), "");
    if (trip.hotels.some((h) => h.id === hub)) setHubId(hub);
    setGuides((g) => ({ ...g, ...load<Partial<Record<GuideKey, boolean>>>(key("guides"), {}) }));
    const c = load<Costs | null>(key("costs"), null);
    if (c && typeof c === "object" && c.rates) setCosts((cur) => ({ ...cur, ...c, rates: { ...cur.rates, ...c.rates } }));
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  useEffect(() => { if (loaded) save(key("travelers"), travelers); }, [loaded, travelers]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (loaded) save(key("placements"), placements); }, [loaded, placements]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (loaded) save(key("hub"), hubId); }, [loaded, hubId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (loaded) save(key("guides"), guides); }, [loaded, guides]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (loaded) save(key("costs"), costs); }, [loaded, costs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Highlight the jump-bar link for the section in the middle of the screen.
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setCurrent(en.target.id); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    JUMPS.forEach((j) => { const el = document.getElementById(j.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  const setPlacements = (fn: (p: Placements) => Placements) => setPlacementsState(fn);
  const hub = trip.hotels.find((h) => h.id === hubId) ?? trip.hotels[0];
  const hubLL: LatLon = [hub.lat, hub.lon];

  function addTraveler() {
    if (travelers.length >= MAX_TRAVELERS) return;
    const t = newTraveler(travelers);
    setTravelers([...travelers, t]);
    // Someone joining the trip is going to everything already planned until they untick it.
    setPlacementsState((p) => Object.fromEntries(Object.entries(p).map(([pid, v]) => [pid, { ...v, who: { ...v.who, [t.id]: true } }])));
  }
  function renameTraveler(id: string, name: string) {
    setTravelers((ts) => ts.map((t) => (t.id === id ? { ...t, name } : t)));
  }
  function removeTraveler(id: string) {
    if (travelers.length <= 1) return;
    setTravelers(travelers.filter((t) => t.id !== id));
    setPlacementsState((p) => Object.fromEntries(Object.entries(p).map(([pid, v]) => {
      const who = { ...v.who };
      delete who[id];
      return [pid, { ...v, who }];
    })));
  }

  function jump(e: React.MouseEvent, j: (typeof JUMPS)[number]) {
    e.preventDefault();
    if (j.guide) setGuides((g) => ({ ...g, [j.guide!]: true }));
    requestAnimationFrame(() => document.getElementById(j.id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }));
  }

  function addFromGuide(id: string) {
    document.getElementById("plan")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    setPick(id);
  }

  const guideCards = (g: GuideKey) => trip.cards.filter((c) => c.guide === g);
  const toggle = (g: GuideKey) => setGuides((cur) => ({ ...cur, [g]: !cur[g] }));
  const sights = [...trip.sights].sort((a, b) => walkMinutes(hubLL, [a.lat, a.lon]) - walkMinutes(hubLL, [b.lat, b.lon]));

  // Sources, grouped by link.
  const sources = new Map<string, string[]>();
  trip.cards.forEach((c) => { if (c.link) sources.set(c.link, [...(sources.get(c.link) ?? []), c.title]); });

  const shared = { days, hub: hubLL, holidays, range, onAdd: addFromGuide };

  return (
    <>
      <header className="hero">
        <div className="wrap">
          <p className="eyebrow">{trip.destination}, {trip.region} · {range}</p>
          <h1>{trip.destination} <span>{trip.name}</span></h1>
          <p className="lede">Where to stay, what to do, where to eat and shop, and a day-by-day plan everyone can shape.</p>
          <div className="dates">
            <span className="chip">{range}</span>
            <span className="chip">{nights(trip.checkIn, trip.checkOut)} nights</span>
            <span className="chip">{travelers.length} {travelers.length === 1 ? "traveler" : "travelers"}</span>
          </div>
        </div>
      </header>

      <nav className="jump" aria-label="Jump to a section">
        <div className="wrap jump-in">
          {JUMPS.map((j) => (
            <a key={j.id} href={"#" + j.id} aria-current={current === j.id ? "true" : undefined} onClick={(e) => jump(e, j)}>{j.label}</a>
          ))}
        </div>
      </nav>

      <main>
        <section id="location">
          <div className="wrap">
            <div className="stack prose">
              <p className="eyebrow">Location</p>
              <h2>Where everything is</h2>
              <p>Walking times throughout the guides are measured from your hotel. Past about {25} minutes on foot, they switch to an approximate drive time.</p>
            </div>
            <label className="hub-pick">
              Distances from
              <select value={hub.id} onChange={(e) => setHubId(e.target.value)}>
                {trip.hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </label>
            <div className="map-box">
              <SchematicMap ariaLabel={`Schematic map of ${trip.destination} with the hotels and key sights`} hub={hubLL} hubHotelId={hub.id} hotels={trip.hotels} streets={trip.streets}
                pins={sights.map((s, i) => ({ id: s.name, n: i + 1, lat: s.lat, lon: s.lon, label: s.name }))} pinClass="mpin sight" />
            </div>
            <p className="fine" style={{ marginTop: 10 }}>Schematic, not to scale. Positions and walking times are approximate.</p>
            <div className="walk-list" aria-label={`Approximate walking times from ${hub.name}`}>
              {sights.map((s, i) => (
                <div key={s.name}><span><span className="num">{i + 1}</span>{s.name}</span><span className="data">{distanceText(hubLL, s)}</span></div>
              ))}
            </div>
          </div>
        </section>

        <Hotels hotels={trip.hotels} baseline={trip.baseline} costs={costs} setCosts={setCosts} />

        <SimpleGuide sectionId="activities" eyebrow="Activity guide" title="What to do" name="activity guide" countNoun="ideas"
          intro="Things to do during your dates, each with the source that recommends it. Times and prices come from the booking pages; confirm them when booking. Each one is also a card in the planner below."
          cards={guideCards("acts")} tabLabels={ACT_TABS} open={guides.acts} onToggle={() => toggle("acts")} showWhen {...shared} />

        <DiningGuide cards={guideCards("dining")} hubHotelId={hub.id} hotels={trip.hotels} streets={trip.streets} open={guides.dining} onToggle={() => toggle("dining")} {...shared} />

        <SimpleGuide sectionId="shopping" eyebrow="Shopping guide" title="Where to shop" name="shopping guide" countNoun="shops"
          intro="Shops recommended by Fodor's and Garden & Gun, most of them a short walk from the hotels."
          cards={guideCards("shops")} tabLabels={SHOP_TABS} open={guides.shops} onToggle={() => toggle("shops")} {...shared} />

        <Planner cards={trip.cards} cardById={cardById} days={days} travelers={travelers} placements={placements} setPlacements={setPlacements}
          addTraveler={addTraveler} renameTraveler={renameTraveler} removeTraveler={removeTraveler} pick={pick} setPick={setPick} />

        <footer className="wrap sources">
          <p className="eyebrow">Sources</p>
          <ul>
            {[...sources.entries()].map(([url, titles]) => (
              <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{sourceLabel(url)}: {titles.join(", ")}</a></li>
            ))}
          </ul>
        </footer>
      </main>
    </>
  );
}
