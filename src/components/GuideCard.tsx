import type { Card } from "@/lib/types";
import { sourceLabel } from "@/lib/sources";

export function badgeClass(b: string): string {
  if (/Michelin|Fodor/.test(b)) return "badge mich";
  if (/Beard|Garden & Gun/.test(b)) return "badge beard";
  return "badge";
}

export function SourceLink({ url }: { url?: string }) {
  if (!url) return <span />;
  return (
    <a className="dine-link" href={url} target="_blank" rel="noopener noreferrer">
      {sourceLabel(url)} ↗
    </a>
  );
}

export function Stars({ c, className = "star" }: { c: Card; className?: string }) {
  return (
    <>
      {(c.stars ?? []).map((s) => (
        <p className={className} key={s}>
          <b aria-hidden="true">★</b> {s}
        </p>
      ))}
    </>
  );
}

interface Props {
  c: Card;
  fits: string;
  distance: string;
  showWhen?: boolean;
  onAdd: (id: string) => void;
}

export default function GuideCard({ c, fits, distance, showWhen, onAdd }: Props) {
  const meta = [c.cuisine, c.area].filter(Boolean).join(" · ");
  return (
    <article className={"dine" + (c.kind === "shop" ? " shop" : "")}>
      <h3>{c.title}</h3>
      <p className="dine-meta">
        {meta}
        {c.price && <> · <span className="data">{c.price}</span></>}
        {distance && <> · {distance}</>}
      </p>
      {showWhen && c.when && <p className="when">{c.when}</p>}
      {!!c.badges?.length && (
        <div className="badges">
          {c.badges.map((b) => <span className={badgeClass(b)} key={b}>{b}</span>)}
        </div>
      )}
      <Stars c={c} />
      {c.con && <p className="con">Heads up: {c.con}</p>}
      {c.check && <p className="tc-check">Confirm days when booking</p>}
      <p className="dine-fits">{fits}</p>
      {!!c.interests?.length && (
        <div className="tags">
          {c.interests.map((i) => <span className="tag int" key={i}>{i}</span>)}
        </div>
      )}
      <div className="dine-foot-row">
        <SourceLink url={c.link} />
        <button type="button" className="dine-add" onClick={() => onAdd(c.id)}>Add to plan</button>
      </div>
    </article>
  );
}
