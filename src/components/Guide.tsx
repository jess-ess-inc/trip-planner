"use client";

import { useState } from "react";
import type { Card } from "@/lib/types";
import type { DayInfo } from "@/lib/dates";
import { slotsText } from "@/lib/availability";
import { distanceText, type LatLon } from "@/lib/geo";
import GuideCard from "./GuideCard";

export interface Tab {
  k: string;
  label: string;
}

interface ToggleProps {
  id: string;
  name: string;
  count: string;
  open: boolean;
  onToggle: () => void;
}

/** The "Open the … guide" button. */
export function GuideToggle({ id, name, count, open, onToggle }: ToggleProps) {
  return (
    <button type="button" className="dine-toggle" aria-expanded={open} aria-controls={id} onClick={onToggle}>
      <span>{(open ? "Close the " : "Open the ") + name}</span> <span className="dine-count">{count}</span>
    </button>
  );
}

export function FilterTabs({ tabs, value, onChange, label, className = "filters" }: { tabs: Tab[]; value: string; onChange: (k: string) => void; label: string; className?: string }) {
  return (
    <div className={className} role="group" aria-label={label}>
      {tabs.map((t) => (
        <button type="button" key={t.k} aria-pressed={value === t.k} onClick={() => onChange(t.k)}>{t.label}</button>
      ))}
    </div>
  );
}

/** Only the tabs whose category has at least one card, plus "All". */
export function tabsFor(cards: Card[], labels: Record<string, string>): Tab[] {
  const present = new Set(cards.flatMap((c) => c.cats ?? []));
  return [{ k: "all", label: "All" }, ...Object.entries(labels).filter(([k]) => present.has(k)).map(([k, label]) => ({ k, label }))];
}

export function HolidayNote({ holidays, range }: { holidays: string[]; range: string }) {
  if (!holidays.length) return null;
  return (
    <aside className="plan-note">
      <strong>Check holiday hours.</strong> Your trip overlaps {holidays.join(" and ")}. Many places close or shorten hours, so confirm {range} before booking.
    </aside>
  );
}

interface GridProps {
  cards: Card[];
  days: DayInfo[];
  hub: LatLon;
  showWhen?: boolean;
  onAdd: (id: string) => void;
}

export function CardGrid({ cards, days, hub, showWhen, onAdd }: GridProps) {
  return (
    <div className="dines">
      {cards.map((c) => (
        <GuideCard key={c.id} c={c} fits={slotsText(c, days)} distance={distanceText(hub, c)} showWhen={showWhen} onAdd={onAdd} />
      ))}
    </div>
  );
}

interface SimpleGuideProps extends Omit<GridProps, "cards"> {
  sectionId: string;
  eyebrow: string;
  title: string;
  intro: string;
  name: string;
  countNoun: string;
  cards: Card[];
  tabLabels: Record<string, string>;
  open: boolean;
  onToggle: () => void;
  holidays: string[];
  range: string;
}

/** Activity and shopping guides: a collapsible grid of cards with category tabs. */
export function SimpleGuide({ sectionId, eyebrow, title, intro, name, countNoun, cards, tabLabels, open, onToggle, holidays, range, ...grid }: SimpleGuideProps) {
  const [tab, setTab] = useState("all");
  const shown = cards.filter((c) => tab === "all" || (c.cats ?? []).includes(tab));
  return (
    <section id={sectionId}>
      <div className="wrap">
        <div className="stack prose">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{intro}</p>
        </div>
        <GuideToggle id={sectionId + "-body"} name={name} count={`${cards.length} ${countNoun}`} open={open} onToggle={onToggle} />
        <div id={sectionId + "-body"} hidden={!open}>
          <HolidayNote holidays={holidays} range={range} />
          <FilterTabs tabs={tabsFor(cards, tabLabels)} value={tab} onChange={setTab} label={"Filter " + countNoun} />
          <CardGrid cards={shown} {...grid} />
        </div>
      </div>
    </section>
  );
}
