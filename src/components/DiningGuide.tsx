"use client";

import { useRef, useState } from "react";
import type { Card, Hotel, Street } from "@/lib/types";
import type { DayInfo } from "@/lib/dates";
import { distanceText, walkMinutes, type LatLon } from "@/lib/geo";
import { CardGrid, FilterTabs, GuideToggle, HolidayNote, tabsFor } from "./Guide";
import { SourceLink, Stars } from "./GuideCard";
import SchematicMap from "./SchematicMap";

const TAB_LABELS: Record<string, string> = {
  hotel: "At the hotels",
  michelin: "Michelin",
  beard: "James Beard",
  classic: "Local classics",
  new: "New & buzzy",
  drinks: "Drinks",
};

interface Props {
  cards: Card[];
  days: DayInfo[];
  hub: LatLon;
  hubHotelId: string;
  hotels: Hotel[];
  streets: Street[];
  open: boolean;
  onToggle: () => void;
  onAdd: (id: string) => void;
  holidays: string[];
  range: string;
}

export default function DiningGuide({ cards, days, hub, hubHotelId, hotels, streets, open, onToggle, onAdd, holidays, range }: Props) {
  const [tab, setTab] = useState("all");
  const [view, setView] = useState<"map" | "list">("map");
  const [selected, setSelected] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const shown = cards.filter((c) => tab === "all" || (c.cats ?? []).includes(tab));
  const onMap = shown.filter((c) => c.lat != null && c.lon != null).sort((a, b) => walkMinutes(hub, [a.lat!, a.lon!]) - walkMinutes(hub, [b.lat!, b.lon!]));
  const rest = shown.filter((c) => c.lat == null || c.lon == null);
  const items = [...onMap.map((c, i) => ({ c, n: i + 1 as number | null })), ...rest.map((c) => ({ c, n: null }))];

  const select = (id: string, fromPin: boolean) => {
    setSelected((cur) => (cur === id && !fromPin ? null : id));
    if (fromPin) {
      requestAnimationFrame(() => {
        const li = listRef.current?.querySelector<HTMLElement>(`li[data-id="${id}"]`);
        if (li && listRef.current) listRef.current.scrollTop = li.offsetTop - listRef.current.offsetTop - 8;
      });
    }
  };

  return (
    <section id="dining">
      <div className="wrap">
        <div className="stack prose">
          <p className="eyebrow">Dining guide</p>
          <h2>Where to eat</h2>
          <p>Restaurants with real critical recognition, from Michelin and the James Beard Foundation to the local food press, plus the easy options at the hotel.</p>
        </div>
        <GuideToggle id="dining-body" name="dining guide" count={`${cards.length} places`} open={open} onToggle={onToggle} />
        <div id="dining-body" hidden={!open}>
          <HolidayNote holidays={holidays} range={range} />
          <div className="dine-bar">
            <div className="seg" role="group" aria-label="View">
              <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>Map</button>
              <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
            </div>
          </div>
          <FilterTabs tabs={tabsFor(cards, TAB_LABELS)} value={tab} onChange={setTab} label="Filter restaurants" className="filters dine-tabs" />
          {view === "map" ? (
            <div className="dmap">
              <div className="dmap-figure">
                <SchematicMap ariaLabel="Map of restaurants around the hotels" hub={hub} hubHotelId={hubHotelId} hotels={hotels} streets={streets} pins={onMap.map((c, i) => ({ id: c.id, n: i + 1, lat: c.lat!, lon: c.lon!, label: c.title }))} selected={selected} onSelect={(id) => select(id, true)} />
                <p className="fine">Approximate positions. North is up; the dashed rings are about 10 and 20 minutes&apos; walk from your hotel.</p>
              </div>
              <ol className="dmap-list" ref={listRef}>
                {items.map(({ c, n }) => {
                  const on = selected === c.id;
                  return (
                    <li key={c.id} data-id={c.id} tabIndex={0} className={on ? "on" : ""} aria-expanded={on}
                      onClick={(e) => { if (!(e.target as HTMLElement).closest("a, button")) select(c.id, false); }}
                      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); select(c.id, false); } }}>
                      <span className="dl-num" style={n ? undefined : { background: "var(--alert)" }}>{n ?? "–"}</span>
                      <span className="dl-name">{c.title}<span className="dl-sub">{[c.cuisine, c.addr || c.area].filter(Boolean).join(" · ")}</span></span>
                      <span className="dl-walk">{distanceText(hub, c)}</span>
                      {on && (
                        <div className="dl-detail">
                          <Stars c={c} />
                          {c.con && <span className="con">Heads up: {c.con}</span>}
                          <span className="dl-actions">
                            <SourceLink url={c.link} />
                            <button type="button" className="dine-add" onClick={() => onAdd(c.id)}>Add to plan</button>
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <CardGrid cards={shown} days={days} hub={hub} onAdd={onAdd} />
          )}
        </div>
      </div>
    </section>
  );
}
