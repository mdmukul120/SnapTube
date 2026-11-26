import { FestBanner, Hero, MirrorNotice } from "@/components/hero";
import { LatestCard, PosterCard, Rail } from "@/components/cards";
import { SectionHead, Icon } from "@/components/ui";
import { collections, latest, stats, taxonomy, trending, byGenre, data } from "@/lib/catalog";

export default function HomePage() {
  const topGenres = taxonomy.genres.slice(0, 6);

  return (
    <>
      <Hero />

      <section className="section" style={{ marginTop: 40 }}>
        <div className="shell">
          <MirrorNotice />
        </div>
      </section>

      <FestBanner />

      <section className="section" style={{ marginTop: 40 }}>
        <div className="shell">
          <SectionHead
            kicker="Editorial picks"
            title="Featured this week"
            description="Hand-picked from the archive — the five titles the source site pinned to its spotlight rail."
            action={{ href: "/movies", label: "All titles →" }}
          />
          <div className="rail">
            {data.featured.map((entry) => (
              <PosterCard
                key={entry.slug}
                item={{
                  slug: entry.slug,
                  title: entry.title,
                  year: entry.year,
                  kind: entry.kind,
                  quality: entry.quality,
                  views: entry.views,
                  rating: entry.rating,
                  poster: entry.poster,
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="stat-row">
            <div className="stat">
              <b>{stats.titles.toLocaleString("en-US")}</b>
              <span>title entries</span>
            </div>
            <div className="stat">
              <b>{stats.collections}</b>
              <span>collections</span>
            </div>
            <div className="stat">
              <b>{stats.genres}</b>
              <span>genre streams</span>
            </div>
            <div className="stat">
              <b>{data.latest.length}</b>
              <span>latest imports</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHead
            kicker="Trending now"
            title="Most watched on the mirror"
            description="Ranked by the view counters carried over from the archived page."
            action={{ href: "/top", label: "Top charts →" }}
          />
          <Rail items={trending(14)} />
        </div>
      </section>

      {collections.map((collection) => (
        <section className="section" key={collection.key}>
          <div className="shell">
            <SectionHead
              kicker={`Collection · ${collection.count.toLocaleString("en-US")} titles`}
              title={collection.name}
              action={{ href: `/collection/${collection.key}`, label: "All →" }}
            />
            <Rail items={collection.items} />
          </div>
        </section>
      ))}

      <section className="section">
        <div className="shell">
          <SectionHead
            kicker="LATEST IMPORTS"
            title="Latest titles"
            description="The newest additions, straight from the source site's latest-imports grid — poster, backdrop, synopsis and view count intact."
            action={{ href: "/latest", label: "See all →" }}
          />
          <div className="grid-latest">
            {latest.map((item) => (
              <LatestCard key={`${item.slug}-${item.year}`} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHead
            kicker="Browse by mood"
            title="Genre streams"
            description="Every genre chip from the source navigation, wired to its own filtered page."
          />
          <div className="bento">
            {topGenres.map((genre) => (
              <a className="bento-tile" key={genre.slug} href={`/genre/${genre.slug}`}>
                <b>{genre.name}</b>
                <small>{byGenre(genre.slug, 100).length}+ picks</small>
              </a>
            ))}
            <a className="bento-tile" href="/top">
              <b>Top 100</b>
              <small>All-time charts</small>
            </a>
            <a className="bento-tile" href="/analysis">
              <b>API</b>
              <small>Auth key + token docs</small>
            </a>
            {taxonomy.decades.map((decade) => (
              <a className="bento-tile" key={decade} href={`/decade/${decade}`}>
                <b>{decade}</b>
                <small>Decade shelf</small>
              </a>
            ))}
            <a className="bento-tile" href="/language/hindi">
              <b>हिंदी</b>
              <small>Hindi shelf</small>
            </a>
            <a className="bento-tile" href="/language/south-indian">
              <b>South</b>
              <small>South Indian shelf</small>
            </a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHead kicker="How it works" title="Fresh code, same catalogue" />
          <div className="bento">
            <div className="bento-tile span-2">
              <div>
                <span className="kicker">01 · Scan</span>
                <p style={{ margin: "10px 0 0", color: "var(--fg-2)", fontSize: 13 }}>
                  The archived markup is parsed by <code style={{ color: "var(--acc)" }}>scripts/extract-catalog.py</code> —
                  collections, spotlight, fest wall, genres, languages and decades all land in
                  <code style={{ color: "var(--acc)" }}> data/catalog.json</code>.
                </p>
              </div>
            </div>
            <div className="bento-tile span-2">
              <div>
                <span className="kicker">02 · Serve</span>
                <p style={{ margin: "10px 0 0", color: "var(--fg-2)", fontSize: 13 }}>
                  Next.js App Router renders every route as a static server component; the
                  <code style={{ color: "var(--acc)" }}> /api/v1</code> layer adds signed auth tokens and live upstream
                  passthrough.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="panel" style={{ padding: "26px 24px", display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ minWidth: 260, flex: 1 }}>
              <span className="kicker">Open API</span>
              <h2 className="display" style={{ fontSize: "clamp(24px,3vw,34px)", margin: "10px 0 6px" }}>
                Auth key + signed auth token, documented.
              </h2>
              <p style={{ margin: 0, color: "var(--fg-2)", fontSize: 13 }}>
                Hands-on with the endpoint contract, error codes and the Supabase wiring.
              </p>
            </div>
            <a className="btn btn-primary" href="/analysis">
              Read the analysis <Icon name="arrow" size={13} />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
