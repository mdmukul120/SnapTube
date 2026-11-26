import { Icon, SectionHead } from "./ui";
import { PosterCard, Rail } from "./cards";
import type { CatalogItem } from "@/lib/config";
import { allItems, collections, findItem, stats } from "@/lib/catalog";

export function DetailView({ item }: { item: CatalogItem }) {
  const siblings = allItems
    .filter((entry) => entry.kind === item.kind && entry.slug !== item.slug)
    .slice(0, 14);
  const owner = collections.find((collection) =>
    collection.items.some((entry) => entry.slug === item.slug && entry.kind === item.kind),
  );
  const kindLabel =
    item.kind === "series" ? "Series" : item.kind === "game" ? "Game" : item.kind === "anime" ? "Anime" : "Movie";

  return (
    <div className="shell">
      <div className="detail-hero">
        {item.backdrop || item.poster ? (
          <div className="detail-bg" aria-hidden>
            <img src={item.backdrop || item.poster} alt="" />
          </div>
        ) : null}
        <div className="detail-veil" aria-hidden />
        <div className="detail-inner">
          <div className="detail-poster">
            {item.poster ? <img src={item.poster} alt={item.title} /> : null}
          </div>
          <div>
            <span className="kicker">{kindLabel} · {item.quality}</span>
            <h1 className="detail-title">{item.title}</h1>
            <div className="chips">
              <span className="chip chip-acc">{item.quality}</span>
              <span className="chip">{item.year}</span>
              <span className="chip">{kindLabel}</span>
              {item.language ? <span className="chip">{item.language}</span> : null}
              {item.rating ? <span className="chip">★ {item.rating.toFixed(1)}</span> : null}
              {owner ? <span className="chip">{owner.name}</span> : null}
            </div>
            {item.description ? <p className="prose" style={{ marginTop: 18 }}>{item.description}</p> : null}

            <div className="meta-grid">
              <div className="meta-cell">
                <span>Views</span>
                <strong>{item.views.toLocaleString("en-US")}</strong>
              </div>
              <div className="meta-cell">
                <span>Quality</span>
                <strong>{item.quality.split(" ")[0]}</strong>
              </div>
              <div className="meta-cell">
                <span>Year</span>
                <strong>{item.year || "—"}</strong>
              </div>
              <div className="meta-cell">
                <span>Rating</span>
                <strong>{item.rating ? item.rating.toFixed(1) : "—"}</strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
              <a className="btn btn-primary" href="#player">
                <Icon name="play" size={13} /> Watch now
              </a>
              <a className="btn btn-ghost" href={`/search?q=${encodeURIComponent(item.title.split(" ")[0])}`}>
                More like this
              </a>
              <a className="btn btn-ghost" href="/movies">
                Back to catalogue
              </a>
            </div>
          </div>
        </div>
      </div>

      <div id="player" className="player">
        <span className="chip chip-live">
          <Icon name="shield" size={11} /> Secure stream placeholder
        </span>
        <h3>The player is wired, not loaded</h3>
        <p>
          Sign in with a {item.kind === "game" ? "Cinemax game" : "Cinemax"} account to unlock the 1080p source. This
          rebuilt front-end keeps the same access rule as the archive: the play request is issued through the
          authenticated API, never from the browser.
        </p>
      </div>

      <div className="section">
        <SectionHead kicker="Same lane" title="You may also like" action={{ href: "/movies", label: "Browse all →" }} />
        <Rail items={siblings} />
      </div>
    </div>
  );
}

export function NotFoundView({ label }: { label: string }) {
  const suggestions = [...allItems].sort((a, b) => b.views - a.views).slice(0, 10);
  return (
    <div className="shell" style={{ paddingTop: 44 }}>
      <span className="kicker">404 · not in the archive</span>
      <h1 className="display" style={{ fontSize: "clamp(34px,6vw,64px)", margin: "14px 0 10px" }}>
        “{label}” isn’t here.
      </h1>
      <p className="prose">
        The snapshot holds {stats.titles.toLocaleString("en-US")} catalogue entries; this slug was not among the ones
        crawled. Try one of the most-watched titles instead.
      </p>
      <div style={{ marginTop: 30 }}>
        <Rail items={suggestions} />
      </div>
      <div style={{ marginTop: 26 }}>
        <a className="btn btn-primary" href="/">Back home</a>
      </div>
    </div>
  );
}

export function findBySlug(kind: string, slug: string) {
  return findItem(kind, slug) ?? null;
}

export function RelatedGrid({ items }: { items: CatalogItem[] }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 18 }}>
      {items.map((item) => (
        <PosterCard key={`${item.kind}-${item.slug}`} item={item} />
      ))}
    </div>
  );
}
