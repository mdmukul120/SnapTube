import { featured, spotlight, data, stats } from "@/lib/catalog";
import { Icon } from "./ui";

/** Hero: editorial split with a stacked poster deck driven by the spotlight rail. */
/** The archive addresses series as /tv/<slug>; this build serves them under /series. */
function laneHref(href: string | undefined, kind?: string): string {
  if (!href) return "/movies";
  if (href.startsWith("/tv/")) return href.replace("/tv/", "/series/");
  if (href.startsWith("/movies/") || href.startsWith("/series/") || href.startsWith("/games/") || href.startsWith("/anime/")) {
    return href;
  }
  return kind === "series" ? `/series/${href.replace(/^\//, "")}` : `/movies/${href.replace(/^\//, "")}`;
}

export function Hero() {
  const lead = spotlight[0];
  const leadHref = laneHref(lead?.href, lead?.kind);
  const deck = [
    lead,
    ...featured.slice(1, 4).map((entry) => ({
      slug: entry.slug,
      href: `/${entry.kind === "series" ? "series" : "movies"}/${entry.slug}`,
      title: entry.title,
      chips: [entry.year, entry.quality, entry.rating ? `★ ${entry.rating}` : "New"],
      description: "",
      poster: entry.poster,
      backdrop: "",
      kind: entry.kind,
    })),
  ];

  return (
    <section className="hero">
      <div className="shell">
        <div className="hero-grid">
          <div>
            <span className="kicker">Spotlight · Volume 01</span>
            <h1 className="hero-title">{lead?.title ?? "CTGMovies"}</h1>
            <div className="chips" style={{ marginBottom: 18 }}>
              {(lead?.chips ?? ["1080p WebRip", "2022", "SERIES"]).map((chip) => (
                <span className="chip chip-acc" key={chip}>
                  {chip}
                </span>
              ))}
            </div>
            <p className="hero-desc">
              {lead?.description ||
                "A rebuilt, fully redesigned home for the CTGMovies archive — every collection, franchise and late import from the source site, re-scanned and re-cut."}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a className="btn btn-primary" href={`${leadHref}#player`}>
                <Icon name="play" size={13} /> Watch now
              </a>
              <a className="btn btn-ghost" href="/movies">
                Browse catalogue
              </a>
              <a className="btn btn-ghost" href="/analysis">
                Site analysis
              </a>
            </div>
            <div className="hero-progress" aria-hidden>
              {deck.map((_, index) => (
                <button key={index} type="button" data-active={index === 0} tabIndex={-1} />
              ))}
            </div>
          </div>

          <div className="hero-stage">
            {deck.map((entry, index) => (
              <a
                key={`${entry.slug}-${index}`}
                className="hero-poster"
                data-pos={index > 3 ? 3 : index}
                href={laneHref(entry.href, entry.kind)}
                aria-label={entry.title}
              >
                {entry.poster ? <img src={entry.poster} alt={entry.title} /> : null}
              </a>
            ))}
            <div className="hero-badge">
              <strong>{stats.titles.toLocaleString("en-US")}</strong>
              <span>titles indexed</span>
            </div>
          </div>
        </div>
      </div>

      <div className="marquee" aria-hidden>
        <div className="marquee-track">
          {[0, 1].map((pass) => (
            <div key={pass} style={{ display: "flex", gap: 34 }}>
              {data.collections.map((collection) => (
                <span key={`${pass}-${collection.key}`}>
                  <i />
                  {collection.name} <b>{collection.count.toLocaleString("en-US")}</b>
                </span>
              ))}
              <span>
                <i />
                Genre streams <b>{data.taxonomy.genres.length}</b>
              </span>
              <span>
                <i />
                Latest imports <b>{data.latest.length}</b>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Fest promo strip: MCU wall + countdown, rebuilt from the source module. */
export function FestBanner() {
  const wall = data.fest.posterWall;
  const laneA = wall.slice(0, Math.ceil(wall.length / 2));
  const laneB = wall.slice(Math.ceil(wall.length / 2));

  return (
    <section className="section" style={{ marginTop: 46 }}>
      <div className="shell">
        <div className="fest">
          <div className="fest-copy">
            <span className="chip chip-acc">Before December 18</span>
            <h2 className="fest-title">
              MCU <em>Fest</em>
            </h2>
            <p style={{ margin: "0 0 6px", color: "var(--fg-1)", fontSize: 15, maxWidth: "42ch" }}>
              The entire Marvel story again, from the beginning.
            </p>
            <p style={{ margin: 0, color: "var(--fg-3)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>
              Avengers: Doomsday hits theaters in
            </p>
            <div className="countdown">
              {[
                ["22", "days"],
                ["07", "hrs"],
                ["41", "min"],
              ].map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 22, flexWrap: "wrap" }}>
              <a className="btn btn-primary" href="/fest/mcu">
                Go to the fest <Icon name="arrow" size={13} />
              </a>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-3)" }}>
                49 movies &amp; series in one place
              </span>
            </div>
          </div>
          <a className="fest-lanes" href="/fest/mcu" aria-label="Open MCU fest">
            <div className="fest-lane">
              {[...laneA, ...laneA].map((src, index) => (
                <img key={`a-${index}`} src={src} alt="" loading="lazy" aria-hidden />
              ))}
            </div>
            <div className="fest-lane" data-dir="rev">
              {[...laneB, ...laneB].map((src, index) => (
                <img key={`b-${index}`} src={src} alt="" loading="lazy" aria-hidden />
              ))}
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}

/** Mirror notice — kept from the original site, restyled. */
export function MirrorNotice() {
  return (
    <div className="notice">
      <div style={{ display: "grid", placeItems: "center", width: 52, height: 52, borderRadius: 14, background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc)", flexShrink: 0 }}>
        <Icon name="shield" size={22} />
      </div>
      <div className="notice-copy">
        <h3>মোবাইল ডাটায় সাইট খুলছে না?</h3>
        <p>
          কিছু মোবাইল অপারেটরে ctgmovies.com খুলছে না। মোবাইল ডাটায় ব্যবহার করুন{" "}
          <strong style={{ color: "var(--acc)" }}>mobile.ctgmovies.com</strong> — একই সাইট, একই অ্যাকাউন্ট।
          লিংকটি সেভ বা বুকমার্ক করে রাখুন।
        </p>
      </div>
      <a className="btn btn-primary" href={`https://${data.site.mirror}`} target="_blank" rel="noopener noreferrer">
        {data.site.mirror}
      </a>
    </div>
  );
}
