"use client";

import { useEffect, useRef, useState } from "react";
import type { Card, Placement, SlotKey, Traveler } from "@/lib/types";
import type { DayInfo } from "@/lib/dates";
import { SLOT, SLOTS, type SlotInfo } from "@/lib/slots";
import { availText, canPlace, isEdge, reason } from "@/lib/availability";
import { colorVar, initials, MAX_TRAVELERS } from "@/lib/travelers";
import { MOBILE_QUERY, useMediaQuery, useReducedMotion } from "@/lib/hooks";

type Placements = Record<string, Placement>;

interface Props {
  cards: Card[];
  cardById: Record<string, Card>;
  days: DayInfo[];
  travelers: Traveler[];
  placements: Placements;
  setPlacements: (fn: (p: Placements) => Placements) => void;
  addTraveler: () => void;
  renameTraveler: (id: string, name: string) => void;
  removeTraveler: (id: string) => void;
  /** The card being placed by tapping, shared with the guides' "Add to plan" buttons. */
  pick: string | null;
  setPick: (id: string | null) => void;
}

type TrayFilter = "all" | "do" | "eat" | "shop" | "edge" | "misc";
const TRAY_TABS: { k: TrayFilter; label: string }[] = [
  { k: "all", label: "All" },
  { k: "do", label: "Things to do" },
  { k: "eat", label: "Dining" },
  { k: "shop", label: "Shopping" },
  { k: "edge", label: "Early & late" },
  { k: "misc", label: "No booking needed" },
];

interface Drag {
  card: string;
  pid?: string;
}

/** "A", "A and B", "A, B and C" */
const listNames = (names: string[]) => (names.length < 3 ? names.join(" and ") : names.slice(0, -1).join(", ") + " and " + names[names.length - 1]);

const newPid = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export default function Planner({ cards, cardById, days, travelers, placements, setPlacements, addTraveler, renameTraveler, removeTraveler, pick, setPick }: Props) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const reduceMotion = useReducedMotion();
  const [trayFilter, setTrayFilter] = useState<TrayFilter>("all");
  const [slotPick, setSlotPick] = useState<{ date: string; slot: SlotKey } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(days[0]?.iso ?? null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const daysRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLElement>(null);

  const dayByIso = Object.fromEntries(days.map((d) => [d.iso, d]));
  const inits = initials(travelers);
  const sheetOpen = !!slotPick && isMobile;

  const active: Drag | null = drag ?? (pick ? { card: pick } : null);
  const activeCard = active ? cardById[active.card] : null;

  function toast(msg: string) {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2800);
  }

  const fits = (c: Card, d: DayInfo, slot: SlotKey, exceptPid?: string) => canPlace(placements, c, d, slot, exceptPid);
  const fitsDay = (c: Card, d: DayInfo, exceptPid?: string) => SLOTS.filter((s) => fits(c, d, s.k, exceptPid)).length;

  // When a pick starts (here or from a guide), open a day where it fits, then bring a slot into view on phones.
  useEffect(() => {
    if (!pick) return;
    const c = cardById[pick];
    if (!c) return;
    setSlotPick(null);
    const current = days.find((d) => d.iso === openDay);
    if (!current || !fitsDay(c, current)) {
      const first = days.find((d) => fitsDay(c, d));
      if (first) setOpenDay(first.iso);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);

  useEffect(() => {
    if (!pick || !isMobile) return;
    const el = daysRef.current?.querySelector(".pslot.ok");
    el?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }, [pick, openDay, isMobile, reduceMotion]);

  // The bottom sheet locks page scroll while it's open.
  useEffect(() => {
    if (!sheetOpen) return;
    document.documentElement.style.overflow = "hidden";
    if (trayRef.current) trayRef.current.scrollTop = 0;
    return () => { document.documentElement.style.overflow = ""; };
  }, [sheetOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPick(null); setSlotPick(null); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setPick]);

  // ---- changes ----
  function addPlacement(cardId: string, date: string, slot: SlotKey) {
    const who = Object.fromEntries(travelers.map((t) => [t.id, true]));
    setPlacements((p) => ({ ...p, [newPid()]: { card: cardId, date, slot, who, at: Date.now() } }));
    setOpenDay(date);
    toast(`Added ${cardById[cardId].title} to ${dayByIso[date].day} ${SLOT[slot].label.toLowerCase()}.`);
  }
  function movePlacement(pid: string, date: string, slot: SlotKey) {
    setPlacements((p) => (p[pid] && (p[pid].date !== date || p[pid].slot !== slot) ? { ...p, [pid]: { ...p[pid], date, slot } } : p));
  }
  function setWho(pid: string, tid: string, val: boolean) {
    setPlacements((p) => (p[pid] ? { ...p, [pid]: { ...p[pid], who: { ...p[pid].who, [tid]: val } } } : p));
  }
  function removePlacement(pid: string) {
    setPlacements((p) => {
      const next = { ...p };
      delete next[pid];
      return next;
    });
  }

  // ---- picking ----
  function chooseCard(id: string) {
    const c = cardById[id];
    if (slotPick) {
      const d = dayByIso[slotPick.date];
      if (!fits(c, d, slotPick.slot)) { toast(`${c.title}: ${reason(placements, c, d, slotPick.slot)}.`); return; }
      const target = slotPick;
      setSlotPick(null);
      addPlacement(id, target.date, target.slot);
      return;
    }
    setPick(pick === id ? null : id);
  }

  function tapSlot(date: string, slot: SlotKey) {
    if (!pick) {
      setSlotPick((cur) => (cur && cur.date === date && cur.slot === slot ? null : { date, slot }));
      return;
    }
    const c = cardById[pick], d = dayByIso[date];
    if (fits(c, d, slot)) {
      setPick(null);
      addPlacement(c.id, date, slot);
    } else {
      toast(`${c.title}: ${reason(placements, c, d, slot)}.`);
    }
  }

  // ---- drag and drop ----
  function onDrop(e: React.DragEvent, d: DayInfo, slot: SlotKey) {
    e.preventDefault();
    const a = drag;
    setDrag(null);
    setOver(null);
    if (!a) return;
    const c = cardById[a.card];
    if (!fits(c, d, slot, a.pid)) return;
    if (a.pid) movePlacement(a.pid, d.iso, slot);
    else addPlacement(a.card, d.iso, slot);
  }

  // ---- tray ----
  const trayCards = cards.filter((c) => {
    if (slotPick) return fits(c, dayByIso[slotPick.date], slotPick.slot);
    if (trayFilter === "edge") return isEdge(c, days);
    if (trayFilter === "misc") return !!c.misc;
    return trayFilter === "all" || c.kind === trayFilter;
  });

  const bySlot: Record<string, string[]> = {};
  Object.entries(placements).forEach(([pid, p]) => { (bySlot[p.date + "|" + p.slot] ??= []).push(pid); });

  return (
    <section id="plan">
      <div className="wrap">
        <div className="stack prose">
          <p className="eyebrow">Build the days</p>
          <h2>Full days (with room to breathe)</h2>
          <p>Every slot starts empty. Tap a slot to see only the cards that fit it, then tap one to add it. You can also drag a card from the list into a slot. Tap a day&apos;s name to open or close it, and cards only fit the days and times they&apos;re actually offered.</p>
        </div>
        <aside className="plan-note">
          <strong>Choose your own adventure.</strong> Each day runs from an early-morning slot to a late-night one. Put more than one card in a slot when people want to split up, then tap the initials on each card to mark who&apos;s going. Drag a placed card to move it, or tap × to take it out. Leave a slot empty to keep it free.
        </aside>
        <div className="ptoolbar">
          <div className="travelers" aria-label="Who's going">
            {travelers.map((t, i) => (
              <span className="trav" key={t.id} style={{ ["--c" as string]: colorVar(i) }}>
                <i className="dot" aria-hidden="true">{inits[t.id]}</i>
                <input aria-label={`Traveler ${i + 1} name`} value={t.name} maxLength={30} onChange={(e) => renameTraveler(t.id, e.target.value)} />
                {travelers.length > 1 && <button type="button" className="trav-x" aria-label={`Remove ${t.name}`} onClick={() => removeTraveler(t.id)}>×</button>}
              </span>
            ))}
            <button type="button" className="trav-add" onClick={addTraveler} disabled={travelers.length >= MAX_TRAVELERS}>+ Add traveler</button>
          </div>
          <p className="pstatus" data-s="local" aria-live="polite">Saved on this device only. Shareable edit and view links come in a later step.</p>
        </div>

        <div className={"planner" + (active ? " is-placing" : "") + (sheetOpen ? " sheet-open" : "")}>
          <aside className="ptray" aria-label="Cards to add to the plan" ref={trayRef}>
            <h3>Cards</h3>
            <div className="tray-filter" role="group" aria-label="Show cards">
              {TRAY_TABS.map((t) => (
                <button type="button" key={t.k} aria-pressed={trayFilter === t.k} onClick={() => { setTrayFilter(t.k); setSlotPick(null); }}>{t.label}</button>
              ))}
            </div>
            <p className="fine" id="tray-note">Activities go in morning, afternoon and evening slots. Dining picks go in breakfast, lunch and dinner.</p>
            {slotPick && (
              <div className="tray-for">
                <span>Cards for {dayByIso[slotPick.date].short} {dayByIso[slotPick.date].dd}, {SLOT[slotPick.slot].label.toLowerCase()}. Tap one to add it.</span>
                <button type="button" onClick={() => setSlotPick(null)}>{isMobile ? "Close" : "Show all cards"}</button>
              </div>
            )}
            <div className="tray-list">
              {!trayCards.length && <p className="fine">Nothing fits this slot yet. Leave it free, or pick another slot.</p>}
              {trayCards.map((c) => (
                <div key={c.id} className={"tcard " + c.kind} role="button" tabIndex={0} draggable aria-pressed={pick === c.id}
                  onClick={() => chooseCard(c.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chooseCard(c.id); } }}
                  onDragStart={(e) => {
                    setPick(null);
                    setSlotPick(null);
                    setDrag({ card: c.id });
                    e.dataTransfer.effectAllowed = "copy";
                    try { e.dataTransfer.setData("text/plain", c.id); } catch { /* some browsers refuse */ }
                  }}
                  onDragEnd={() => { setDrag(null); setOver(null); }}>
                  <span className="tc-title">{c.title}</span>
                  <span className="tc-avail">{availText(c, days)}</span>
                  {c.when && <span className="tc-when">{c.when}</span>}
                  {(c.stars ?? []).map((s) => <span className="tc-star" key={s}><b aria-hidden="true">★</b> {s}</span>)}
                  {c.con && <span className="tc-con">Heads up: {c.con}</span>}
                  {c.check && <span className="tc-check">Confirm days when booking</span>}
                  {!!c.interests?.length && <span className="tags">{c.interests.map((i) => <span className="tag int" key={i}>{i}</span>)}</span>}
                </div>
              ))}
            </div>
          </aside>

          <div className="pdays" aria-label="Trip days" ref={daysRef}>
            {days.map((d) => {
              const open = d.iso === openDay;
              const n = SLOTS.reduce((t, s) => t + (bySlot[d.iso + "|" + s.k]?.length ?? 0), 0);
              let sum = n ? `${n} ${n === 1 ? "plan" : "plans"}` : "Nothing yet";
              if (!open && activeCard) {
                const f = fitsDay(activeCard, d, active?.pid);
                sum = f ? `Fits ${f} ${f === 1 ? "slot" : "slots"} · tap to open` : "Doesn't fit this day";
              }
              return (
                <article className={"pday" + (open ? " open" : "")} key={d.iso}>
                  <h3 className="pday-head">
                    <button type="button" className="pday-btn" aria-expanded={open}
                      onClick={() => setOpenDay(open ? null : d.iso)}
                      onDragEnter={() => { if (drag && !open) setOpenDay(d.iso); }}>
                      <span className="pd-name">{d.day}</span>
                      <span className="when">{d.md}</span>
                      <span className="pd-sum">{sum}</span>
                    </button>
                  </h3>
                  {open && (
                    <div className="pslots">
                      {SLOTS.map((s) => (
                        <Slot key={s.k} d={d} s={s} pids={bySlot[d.iso + "|" + s.k] ?? []}
                          placements={placements} cardById={cardById} travelers={travelers} inits={inits}
                          activeCard={activeCard} active={active} isDrag={!!drag} pick={pick}
                          selected={!!slotPick && slotPick.date === d.iso && slotPick.slot === s.k}
                          over={over === d.iso + "|" + s.k}
                          onTap={() => tapSlot(d.iso, s.k)}
                          onDragOver={(e) => {
                            if (!drag || !fits(cardById[drag.card], d, s.k, drag.pid)) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = drag.pid ? "move" : "copy";
                            setOver(d.iso + "|" + s.k);
                          }}
                          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
                          onDrop={(e) => onDrop(e, d, s.k)}
                          onItemDragStart={(e, pid) => {
                            setPick(null);
                            setDrag({ card: placements[pid].card, pid });
                            e.dataTransfer.effectAllowed = "move";
                            try { e.dataTransfer.setData("text/plain", pid); } catch { /* some browsers refuse */ }
                          }}
                          onItemDragEnd={() => { setDrag(null); setOver(null); }}
                          onRemove={removePlacement} onWho={setWho} />
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {pick && cardById[pick] && (
        <div className="ppick">
          <span>Placing <b>{cardById[pick].title}</b>. Tap a highlighted slot.</span>
          <button type="button" onClick={() => setPick(null)}>Cancel</button>
        </div>
      )}
      {toastMsg && <div className="ptoast" role="status">{toastMsg}</div>}
      {sheetOpen && <div className="psheet-bg" onClick={() => setSlotPick(null)} />}
    </section>
  );
}

interface SlotProps {
  d: DayInfo;
  s: SlotInfo;
  pids: string[];
  placements: Placements;
  cardById: Record<string, Card>;
  travelers: Traveler[];
  inits: Record<string, string>;
  activeCard: Card | null;
  active: Drag | null;
  isDrag: boolean;
  pick: string | null;
  selected: boolean;
  over: boolean;
  onTap: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  onItemDragStart: (e: React.DragEvent, pid: string) => void;
  onItemDragEnd: () => void;
  onRemove: (pid: string) => void;
  onWho: (pid: string, tid: string, val: boolean) => void;
}

function Slot({ d, s, pids, placements, cardById, travelers, inits, activeCard, active, isDrag, pick, selected, over, onTap, onDragOver, onDragLeave, onDrop, onItemDragStart, onItemDragEnd, onRemove, onWho }: SlotProps) {
  const ids = [...pids].sort((a, b) => (placements[a].at || 0) - (placements[b].at || 0));
  const counts: Record<string, number> = {};
  ids.forEach((pid) => travelers.forEach((t) => { if (placements[pid].who[t.id]) counts[t.id] = (counts[t.id] ?? 0) + 1; }));
  const clash = travelers.filter((t) => (counts[t.id] ?? 0) > 1).map((t) => t.name || "Someone");

  const ok = activeCard ? canPlace(placements, activeCard, d, s.k, active?.pid) : false;
  const hint = activeCard ? (ok ? (isDrag ? "Drop here" : "Tap to add") : reason(placements, activeCard, d, s.k, active?.pid)) : "";
  const cls = ["pslot", s.meal ? "meal" : "", selected ? "sel" : "", s.k === "early" || s.k === "late" ? "edge" : "", activeCard ? (ok ? "ok" : "no") : "", over ? "over" : ""].filter(Boolean).join(" ");

  return (
    <div className={cls} tabIndex={ok && pick ? 0 : -1} aria-label={`${d.day} ${s.label}`}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest(".pi-x")) return;
        if (t.closest(".pitem") && (!pick || t.closest("label, input, button"))) return;
        onTap();
      }}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); onTap(); } }}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div className="ps-head"><span className="ps-label">{s.label}</span><span className="ps-hint">{hint}</span></div>
      {ids.map((pid) => {
        const p = placements[pid], c = cardById[p.card];
        const anyone = travelers.some((t) => p.who[t.id]);
        return (
          <div className={"pitem " + c.kind} key={pid} draggable onDragStart={(e) => onItemDragStart(e, pid)} onDragEnd={onItemDragEnd}>
            <div className="pi-top">
              <span className="pi-title">{c.title}</span>
              <button type="button" className="pi-x" aria-label={"Remove " + c.title} onClick={() => onRemove(pid)}>×</button>
            </div>
            <div className="pi-who">
              {travelers.map((t, i) => {
                const on = !!p.who[t.id];
                return (
                  <label key={t.id} className={"who" + (on && (counts[t.id] ?? 0) > 1 ? " clash" : "")} title={t.name} style={{ ["--c" as string]: colorVar(i) }}>
                    <input type="checkbox" checked={on} onChange={(e) => onWho(pid, t.id, e.target.checked)} aria-label={`${t.name} going to ${c.title}`} />
                    <span aria-hidden="true">{inits[t.id]}</span>
                  </label>
                );
              })}
              {!anyone && <span className="pi-none">No one yet</span>}
            </div>
          </div>
        );
      })}
      {!ids.length && <p className="ps-empty">{s.meal ? "Tap to see dining picks" : "Tap to see what fits"}</p>}
      {!!clash.length && <p className="ps-warn">{listNames(clash)}{clash.length > 1 ? " are each" : " is"} down for two things here</p>}
    </div>
  );
}
