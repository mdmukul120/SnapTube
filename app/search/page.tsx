import type { Metadata } from "next";
import { SectionHead, Icon } from "@/components/ui";
import { LatestCard, PosterCard } from "@/components/cards";
import { allItems, search, trending, taxonomy } from "@/lib/catalog";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query ? search(query, 40) : [];

  return (
    <div className="shell" style={{ paddingTop: 34 }}>
      <SectionHead
        kicker="Search"
        title={query ? `Results for “${query}”` : "Find any title"}
        description={`Full-text search across ${allItems.length} indexed catalogue entries — title, year and language.`}
      />
      <form className="search-box" action="/search" method="get">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Try “Koffee”, “Janata Bar”, “2026”, “Hindi”…"
          aria-label="Search titles"
          autoFocus
        />
        <button className="btn btn-primary" type="submit">
          <Icon name="search" size={13} /> Search
        </button>
      </form>

      <div className="chip-rail" style={{ marginTop: 16 }}>
        {taxonomy.genres.slice(0, 8).map((genre) => (
          <a className="pill" key={genre.slug} href={`/genre/${genre.slug}`}>
            {genre.name}
          </a>
        ))}
      </div>

      {query ? (
        results.length ? (
          <div className="grid-latest" style={{ marginTop: 28 }}>
            {results.map((item) => (
              <LatestCard key={`${item.kind}-${item.slug}`} item={item} />
            ))}
          </div>
        ) : (
          <div className="empty" style={{ marginTop: 28 }}>
            No matches for “{query}”. The snapshot may not include this title.
          </div>
        )
      ) : (
        <div className="section">
          <SectionHead kicker="Popular right now" title="Trending searches" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 18 }}>
            {trending(12).map((item) => (
              <PosterCard key={`${item.kind}-${item.slug}`} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
