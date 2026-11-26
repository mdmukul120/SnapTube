import { Icon } from "./ui";
import type { CatalogItem } from "@/lib/config";

export function formatViews(views: number): string {
  if (views >= 1000) return `${(views / 1000).toFixed(views >= 10000 ? 0 : 1)}k`;
  return String(views);
}

export function itemHref(item: CatalogItem): string {
  const lane =
    item.kind === "series" ? "series" : item.kind === "game" ? "games" : item.kind === "anime" ? "anime" : "movies";
  return `/${lane}/${item.slug}`;
}

export function PosterCard({ item, showYear = true }: { item: CatalogItem; showYear?: boolean }) {
  return (
    <a className="card" href={itemHref(item)}>
      <div className="card-frame">
        {item.poster ? <img src={item.poster} alt={item.title} loading="lazy" /> : null}
        {item.backdrop ? (
          <img className="backdrop" src={item.backdrop} alt="" aria-hidden loading="lazy" />
        ) : null}
        <span className="card-quality">{item.quality}</span>
        {item.language ? (
          <span
            className="latest-lang"
            style={{ background: item.accent ?? "#0369a1", color: item.onAccent ?? "#f0f9ff", borderColor: item.onAccent ?? "#f0f9ff" }}
          >
            {item.language}
          </span>
        ) : null}
        <span className="card-views">
          <Icon name="eye" size={11} />
          {formatViews(item.views)}
        </span>
        <span className="card-play" aria-hidden>
          <span>
            <Icon name="play" size={16} />
          </span>
        </span>
      </div>
      <div className="card-meta">
        <div className="card-title">{item.title}</div>
        <div className="card-sub">
          {showYear && item.year ? <b>{item.year}</b> : null}
          {item.language ? <span>{item.language}</span> : null}
        </div>
      </div>
    </a>
  );
}

export function Rail({ items }: { items: CatalogItem[] }) {
  return (
    <div className="rail">
      {items.map((item) => (
        <PosterCard key={`${item.kind}-${item.slug}-${item.quality}`} item={item} />
      ))}
    </div>
  );
}

export function LatestCard({ item }: { item: CatalogItem }) {
  const kindLabel =
    item.kind === "series" ? "SERIES" : item.kind === "game" ? "GAME" : item.kind === "anime" ? "ANIME" : "MOVIE";
  return (
    <a className="latest-card" href={itemHref(item)}>
      <div className="latest-poster">
        {item.poster ? <img src={item.poster} alt={item.title} loading="lazy" /> : null}
        {item.backdrop ? (
          <img className="backdrop" src={item.backdrop} alt="" aria-hidden loading="lazy" />
        ) : null}
        <span className="card-quality">{item.quality}</span>
        {item.language ? (
          <span
            className="latest-lang"
            style={{ background: item.accent ?? "#0369a1", color: item.onAccent ?? "#f0f9ff", borderColor: item.onAccent ?? "#f0f9ff" }}
          >
            {item.language}
          </span>
        ) : null}
        <span className="card-views">
          <Icon name="eye" size={11} />
          {item.views.toLocaleString("en-US")}
        </span>
      </div>
      <div className="latest-body">
        <span className="latest-kind">{kindLabel} · {item.language || "English"}</span>
        <h3 className="latest-title">
          {item.title} <span>({item.year})</span>
        </h3>
        {item.description ? <p className="latest-desc">{item.description}</p> : null}
        <div className="latest-foot">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Icon name="star" size={10} />
            {item.rating ? item.rating.toFixed(1) : "—"}
          </span>
          <span>{item.quality.split(" ")[0]}</span>
        </div>
      </div>
    </a>
  );
}

export function GenreRail({ genres, active }: { genres: Array<{ slug: string; name: string }>; active?: string }) {
  return (
    <div className="chip-rail">
      <a className="pill" href="/movies" data-active={!active}>
        <Icon name="grid" size={12} /> All
      </a>
      {genres.map((genre) => (
        <a
          key={genre.slug}
          className="pill"
          href={`/genre/${genre.slug}`}
          data-active={active === genre.slug}
        >
          {genre.name}
        </a>
      ))}
    </div>
  );
}
