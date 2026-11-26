import type { Metadata } from "next";
import { Rail } from "@/components/cards";
import { SectionHead } from "@/components/ui";
import { allItems, trending } from "@/lib/catalog";

export const metadata: Metadata = { title: "Top charts" };

export default function TopPage() {
  const ranked = [...allItems].sort((a, b) => b.views - a.views);
  const movies = ranked.filter((item) => item.kind === "movie").slice(0, 20);
  const series = ranked.filter((item) => item.kind === "series").slice(0, 20);

  return (
    <div className="shell" style={{ paddingTop: 34 }}>
      <SectionHead
        kicker="Charts · all-time"
        title="Top of the archive"
        description="Ordered by the view counter each title carries in the archived snapshot — the closest thing the source site had to a popularity signal."
      />
      <h3 className="display" style={{ fontSize: 24, margin: "10px 0 16px" }}>Overall</h3>
      <Rail items={trending(20)} />
      <h3 className="display" style={{ fontSize: 24, margin: "34px 0 16px" }}>Movies</h3>
      <Rail items={movies} />
      <h3 className="display" style={{ fontSize: 24, margin: "34px 0 16px" }}>Series</h3>
      <Rail items={series} />
      <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
        <a className="btn btn-ghost" href="/top/movies">Top movies →</a>
        <a className="btn btn-ghost" href="/top/series">Top series →</a>
        <a className="btn btn-ghost" href="/latest">Latest imports →</a>
      </div>
    </div>
  );
}
