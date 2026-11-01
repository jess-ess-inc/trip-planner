"use client";

import type { Hotel } from "@/lib/types";

const ROWS: { k: string; label: string }[] = [
  { k: "feel", label: "The feel" },
  { k: "spa", label: "Spa" },
  { k: "rooftop", label: "Rooftop or bar" },
  { k: "food", label: "Food & drink" },
  { k: "pool", label: "Pool" },
  { k: "recognition", label: "Recognition" },
];

const BAR_COLORS = ["var(--muted)", "var(--accent-deep)", "var(--alert)", "var(--leaf)", "var(--gold)"];

export interface Costs {
  rooms: number;
  nights: number;
  taxPct: number;
  rates: Record<string, number>;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

interface Props {
  hotels: Hotel[];
  baseline: number;
  costs: Costs;
  setCosts: (c: Costs) => void;
}

function NumField({ id, label, value, onChange, step = 1, max, className }: { id: string; label: string; value: number; onChange: (v: number) => void; step?: number; max?: number; className?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className={className} type="number" min="0" max={max} step={step} inputMode="decimal" value={Number.isFinite(value) && value > 0 ? value : ""}
        onChange={(e) => { const v = parseFloat(e.target.value); onChange(Number.isFinite(v) && v > 0 ? v : 0); }} />
    </div>
  );
}

export default function Hotels({ hotels, baseline, costs, setCosts }: Props) {
  const base = hotels[baseline];
  const nights = Math.max(1, costs.nights || 1);
  const mult = nights * Math.max(1, costs.rooms || 1) * (1 + (costs.taxPct || 0) / 100);
  const totals = hotels.map((h) => (costs.rates[h.id] || 0) * mult);
  const max = Math.max(...totals, 1);
  const baseTotal = totals[baseline];
  const others = hotels.map((h, i) => ({ h, i })).filter(({ i }) => i !== baseline);

  return (
    <section id="hotels">
      <div className="wrap">
        <div className="stack prose">
          <p className="eyebrow">Side by side</p>
          <h2>Compare the hotels</h2>
          <p>{base.name} is the baseline; the other columns are the alternatives. Type in the nightly rates you see on each hotel&apos;s booking page, and the calculator below does the math.</p>
        </div>

        <div className="table-scroll">
          <table>
            <colgroup>
              <col />
              {hotels.map((h, i) => <col key={h.id} className={i === baseline ? "" : "up"} />)}
            </colgroup>
            <thead>
              <tr>
                <th scope="col"><span className="eyebrow">Hotel</span></th>
                {hotels.map((h, i) => (
                  <th scope="col" key={h.id} className={i === baseline ? "base-col" : ""}>
                    {h.name}
                    <small>{[i === baseline ? "Baseline" : "", h.sub].filter(Boolean).join(" · ")}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.k}>
                  <th scope="row">{r.label}</th>
                  {hotels.map((h) => (h.rows[r.k] ? <td key={h.id}>{h.rows[r.k]}</td> : <td key={h.id} className="no">{r.k === "recognition" ? "—" : "None"}</td>))}
                </tr>
              ))}
              <tr>
                <th scope="row">Your nightly rate</th>
                {hotels.map((h) => (costs.rates[h.id] ? <td key={h.id} className="rate">{fmt(costs.rates[h.id])} / night</td> : <td key={h.id} className="no">Type it in below</td>))}
              </tr>
            </tbody>
          </table>
        </div>

        <form className="calc" onSubmit={(e) => e.preventDefault()} aria-labelledby="calc-title">
          <fieldset>
            <legend id="calc-title">What each option costs</legend>
            <NumField id="n-rooms" label="Rooms" value={costs.rooms} max={10} onChange={(v) => setCosts({ ...costs, rooms: Math.round(v) })} />
            <NumField id="n-nights" label="Nights" value={costs.nights} max={30} onChange={(v) => setCosts({ ...costs, nights: Math.round(v) })} />
            {hotels.map((h) => (
              <NumField key={h.id} id={"r-" + h.id} label={h.name + ", per night"} value={costs.rates[h.id] || 0} step={10} onChange={(v) => setCosts({ ...costs, rates: { ...costs.rates, [h.id]: v } })} />
            ))}
            <NumField id="n-tax" label="Estimated room tax, %" className="pct" value={costs.taxPct} step={0.5} max={40} onChange={(v) => setCosts({ ...costs, taxPct: v })} />
            <p className="fine">The rates start with examples from the original trip. Replace them with live rates for your dates. Totals include the estimated room tax.</p>
          </fieldset>
          <div className="result" aria-live="polite">
            {hotels.map((h, i) => (
              <div className="bar-row" key={h.id}>
                <div className="label"><span>{h.name}</span><span className="data">{fmt(totals[i])}</span></div>
                <div className="bar"><span style={{ width: (totals[i] / max) * 100 + "%", background: BAR_COLORS[Math.min(i, BAR_COLORS.length - 1)] }} /></div>
              </div>
            ))}
            <p className="diff">
              {others.map(({ h, i }, j) => {
                const d = totals[i] - baseTotal;
                return (
                  <span key={h.id}>
                    {j > 0 && " "}
                    {h.name} {d >= 0 ? "adds" : "saves"} <strong>{fmt(Math.abs(d))}</strong> {d >= 0 ? "to" : "on"} the whole trip ({fmt(Math.abs(d) / nights)} a night).
                  </span>
                );
              })}
            </p>
          </div>
        </form>

        <h3 className="pc-title">Pros &amp; cons</h3>
        <div className="pc">
          {hotels.map((h) => (
            <div className="pc-col" key={h.id}>
              <h3>{h.name}</h3>
              <ul>
                {h.pros.map((p) => <li className="plus" key={p}>{p}</li>)}
                {h.cons.map((p) => <li className="minus" key={p}>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
