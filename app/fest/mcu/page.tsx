import type { Metadata } from "next";
import { Rail } from "@/components/cards";
import { SectionHead, Icon } from "@/components/ui";
import { allItems, data } from "@/lib/catalog";
import { Filterable } from "./filterable";

export const metadata: Metadata = { title: "MCU Fest" };

export default function FestPage() {
  const wall = data.fest.posterWall;
  const picks = [...allItems].sort((a, b) => b.views - a.views).slice(0, 18);

  return (
    <div className="shell" style={{ paddingTop: 30 }}>
      <div className="fest">
        <div className="fest-copy">
          <span className="chip chip-acc">Before December 18</span>
          <h1 className="fest-title">
            MCU <em>Fest</em>
          </h1>
          <p style={{ margin: 0, color: "var(--fg-1)", fontSize: 15, maxWidth: "46ch" }}>
            The entire Marvel story again, from the beginning — the source site&apos;s 49-title marathon shelf, re-cut
            into a fresh lane with a live countdown to <em style={{ color: "var(--acc)", fontStyle: "normal" }}>Avengers: Doomsday</em>.
          </p>
          <div className="countdown">
            {[["22", "days"], ["07", "hrs"], ["41", "min"]].map(([value, label]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 22, flexWrap: "wrap" }}>
            <a className="btn btn-primary" href="#shelf">
              Open the shelf <Icon name="arrow" size={13} />
            </a>
            <a className="btn btn-ghost" href="/movies">All movies</a>
          </div>
        </div>
        <div className="fest-lanes" aria-hidden>
          <div className="fest-lane">
            {[...wall.slice(0, 12), ...wall.slice(0, 12)].map((src, index) => (
              <img key={`l1-${index}`} src={src} alt="" loading="lazy" />
            ))}
          </div>
          <div className="fest-lane" data-dir="rev">
            {[...wall.slice(12, 24), ...wall.slice(12, 24)].map((src, index) => (
              <img key={`l2-${index}`} src={src} alt="" loading="lazy" />
            ))}
          </div>
        </div>
      </div>

      <div id="shelf" className="section">
        <SectionHead
          kicker="Marathon shelf"
          title="49 movies & series, one place"
          description="Filter the shelf by lane — every card keeps its quality badge and view counter."
        />
        <Filterable items={picks} />
      </div>

      <div className="section">
        <SectionHead kicker="Also on the wall" title="Poster wall" />
        <Rail items={picks.slice(0, 14)} />
      </div>
    </div>
  );
}
