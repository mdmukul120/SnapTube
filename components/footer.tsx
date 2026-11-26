import { data, stats, taxonomy } from "@/lib/catalog";
import { features, site } from "@/lib/config";
import { Logo } from "./ui";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-grid">
          <div className="footer-col">
            <Logo />
            <p style={{ margin: "14px 0 0", color: "var(--fg-3)", fontSize: 12.5, maxWidth: "34ch", lineHeight: 1.7 }}>
              A fresh build of the {site.name} archive: {stats.titles.toLocaleString("en-US")} titles, {stats.collections}{" "}
              collections, {stats.genres} genre streams. Same catalogue, new skin, documented API.
            </p>
            <div style={{ display: "flex", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
              <span className="chip chip-acc">API v1</span>
              <span className="chip">{features.liveUpstream ? "Live upstream" : "Snapshot mode"}</span>
              <span className="chip">{features.supabase ? "Supabase on" : "Supabase standby"}</span>
            </div>
          </div>

          <div className="footer-col">
            <h4>Catalogue</h4>
            <ul>
              <li><a href="/movies">Movies</a></li>
              <li><a href="/series">Series</a></li>
              <li><a href="/games">Games</a></li>
              <li><a href="/anime">Anime</a></li>
              <li><a href="/fest/mcu">MCU Fest</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Collections</h4>
            <ul>
              {data.collections.slice(0, 5).map((collection) => (
                <li key={collection.key}>
                  <a href={`/collection/${collection.key}`}>{collection.name}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-col">
            <h4>Genres</h4>
            <ul>
              {taxonomy.genres.slice(0, 5).map((genre) => (
                <li key={genre.slug}>
                  <a href={`/genre/${genre.slug}`}>{genre.name}</a>
                </li>
              ))}
              <li><a href="/language/english">English</a></li>
              <li><a href="/analysis">Site &amp; API analysis</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {site.years}. {site.name} · All rights reserved.</span>
          <span>Mirror · {site.mirror}</span>
          <span>Built for Vercel · Next.js App Router</span>
        </div>
      </div>
    </footer>
  );
}
