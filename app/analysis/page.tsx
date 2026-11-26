import type { Metadata } from "next";
import { SectionHead, Icon } from "@/components/ui";
import manifest from "@/data/source-manifest.json";
import { collections, data, latest, stats, taxonomy } from "@/lib/catalog";
import { apiAuth, features, site, supabaseConfig, upstream } from "@/lib/config";
import { ApiPlayground } from "./playground";

export const metadata: Metadata = { title: "Site & API analysis" };

const fileCount = 1 + 1 + 4 + 6 + 9; // pages, components, lib, api routes, data+scripts

export default function AnalysisPage() {
  const categories = [
    ["app/page.tsx", "Home — spotlight hero, fest strip, 7 collection rails, latest grid"],
    ["app/movies|series|games|anime", "Lane indexes with genre rail + grid"],
    ["app/[lane]/[slug]", "Dynamic title detail with meta grid + player shell"],
    ["app/collection/[key]", "Per-collection shelf (7 generated)"],
    ["app/genre/[slug]", "13 generated genre streams"],
    ["app/top, app/top/[kind]", "Charts + per-lane rankings"],
    ["app/latest, app/search, app/fest/mcu", "Latest imports, search, franchise"],
  ];

  return (
    <div className="shell" style={{ paddingTop: 34 }}>
      <SectionHead
        kicker="Code analysis"
        title="What the source site is, and what we rebuilt"
        description="A crawl-level read of ctgmovies.com: framework, bundle graph, design tokens, data shape — and the fresh Next.js implementation that replaces it."
      />

      <div className="stat-row">
        <div className="stat">
          <b>{manifest.source.framework.replace("Next.js ", "")}</b>
          <span>source framework</span>
        </div>
        <div className="stat">
          <b>{manifest.stats.scripts}</b>
          <span>JS chunks in payload</span>
        </div>
        <div className="stat">
          <b>{manifest.imageCacheCount}</b>
          <span>cached webp posters</span>
        </div>
        <div className="stat">
          <b>{manifest.routes.length}</b>
          <span>internal routes</span>
        </div>
      </div>

      <div className="section">
        <SectionHead kicker="01 · Scan" title="Source document analysis" />
        <div className="panel" style={{ padding: "20px 22px" }}>
          <table className="simple">
            <thead>
              <tr>
                <th>Signal</th>
                <th>Finding</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Entry point</td><td><code>{manifest.source.url}</code> · HTML snapshot {Math.round(manifest.source.bytes / 1024)} KB</td></tr>
              <tr><td>Framework</td><td>{manifest.source.framework} with React Server Components and streamed flight payloads</td></tr>
              <tr><td>Stylesheets</td><td>{manifest.stats.styles} hashed CSS bundles + inline <code>&lt;style&gt;</code> modules for the fest lanes</td></tr>
              <tr><td>Client chunks</td><td>{manifest.stats.scripts} async chunks (webpack runtime, main-app, page, layout, auth layout)</td></tr>
              <tr><td>Image strategy</td><td>{manifest.imageCacheCount} <code>/imgcache/*.webp</code> derivatives of TMDB posters + <code>data-fallback</code> handler</td></tr>
              <tr><td>Design tokens</td><td><code>--color-acc:#ffbf00</code>, ink surfaces <code>#0b1424</code>, hairline <code>--color-line</code>, Bricolage/Hind display stack</td></tr>
              <tr><td>Content model</td><td>Collection rails · featured deck · spotlight · latest imports · fest wall · genre/decade/language chips</td></tr>
              <tr><td>Access control</td><td>No public API keys in the payload — every play request is gated behind the Cinemax account</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <SectionHead
          kicker="01b · Bundle graph"
          title="Every JavaScript chunk path in the source payload"
          description="Pulled verbatim from the archived document unescaped JSON — useful when diffing the old bundle graph against this build."
        />
        <div className="panel" style={{ padding: "18px 20px" }}>
          <table className="simple">
            <thead>
              <tr><th>#</th><th>Chunk path</th><th>Kind</th></tr>
            </thead>
            <tbody>
              {manifest.javascript.map((chunk, index) => (
                <tr key={chunk}>
                  <td style={{ color: "var(--fg-3)" }}>{String(index + 1).padStart(2, "0")}</td>
                  <td><code>{chunk}</code></td>
                  <td>{chunk.includes("/app/") ? "route chunk" : chunk.includes("webpack") ? "runtime" : "shared vendor"}</td>
                </tr>
              ))}
              {manifest.stylesheets.map((sheet, index) => (
                <tr key={sheet}>
                  <td style={{ color: "var(--fg-3)" }}>{String(manifest.javascript.length + index + 1).padStart(2, "0")}</td>
                  <td><code>{sheet}</code></td>
                  <td>stylesheet</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <SectionHead kicker="02 · Rebuild" title="File map of this deployment" />
        <div className="panel" style={{ padding: "20px 22px" }}>
          <table className="simple">
            <thead>
              <tr><th>Path</th><th>Role</th></tr>
            </thead>
            <tbody>
              {categories.map(([path, role]) => (
                <tr key={path}>
                  <td><code>{path}</code></td>
                  <td>{role}</td>
                </tr>
              ))}
              <tr><td><code>lib/auth.ts</code></td><td>HMAC-SHA256 token mint/verify + API-key gate used by every route</td></tr>
              <tr><td><code>lib/catalog.ts</code></td><td>Catalogue access layer: snapshot first, TMDB passthrough second</td></tr>
              <tr><td><code>scripts/extract-catalog.py</code></td><td>Parser that turns the archived HTML into <code>data/catalog.json</code></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <SectionHead
          kicker="03 · Contract"
          title="API endpoint, auth key & auth token"
          description="Two-step handshake. The key identifies the caller, the signed token authorises the request and expires automatically."
        />
        <div className="code">
{`# 1 — mint a token with your API key
curl -s -X POST ${site.origin}/api/v1/auth/token \\
  -H "${apiAuth.keyHeader}: $NEXT_PUBLIC_BFF_API_KEY"

# { "ok": true, "token": "<payload>.<hmac>", "ttl": ${apiAuth.tokenTtlSeconds}, "scope": [...] }

# 2 — call any data endpoint with key + token
curl -s ${site.origin}/api/v1/collections/english?limit=20 \\
  -H "${apiAuth.keyHeader}: $NEXT_PUBLIC_BFF_API_KEY" \\
  -H "${apiAuth.tokenHeader}: Bearer <token>"`}
        </div>
        <div style={{ marginTop: 16 }}>
          <ApiPlayground />
        </div>
      </div>

      <div className="section">
        <SectionHead kicker="04 · Environment" title="Runtime wiring" />
        <div className="panel" style={{ padding: "20px 22px" }}>
          <table className="simple">
            <thead>
              <tr><th>Variable</th><th>Purpose</th><th>State</th></tr>
            </thead>
            <tbody>
              <tr><td><code>NEXT_PUBLIC_BFF_API_KEY</code></td><td>Public API key shipped to the browser</td><td>{apiAuth.bffKey ? "set" : "default"}</td></tr>
              <tr><td><code>API_SIGNING_SECRET</code></td><td>HMAC secret for auth tokens</td><td>{apiAuth.signingSecret ? "set" : "dev fallback"}</td></tr>
              <tr><td><code>API_PARTNER_KEYS</code></td><td>Comma list of accepted partner keys</td><td>{apiAuth.partnerKeys.length || "—"}</td></tr>
              <tr><td><code>API_TOKEN_TTL</code></td><td>Token lifetime in seconds</td><td>{apiAuth.tokenTtlSeconds}</td></tr>
              <tr><td><code>TMDB_API_KEY / TMDB_READ_TOKEN</code></td><td>Live metadata passthrough</td><td>{features.liveUpstream ? "live" : "snapshot only"}</td></tr>
              <tr><td><code>SUPABASE_URL / SUPABASE_ANON_KEY</code></td><td>View counters, watchlists</td><td>{features.supabase ? "connected" : "standby"}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <SectionHead kicker="05 · Catalogue" title="Data extracted from the snapshot" />
        <div className="bento">
          <div className="bento-tile">
            <b>{stats.titles.toLocaleString("en-US")}</b>
            <small>titles across shelves</small>
          </div>
          <div className="bento-tile">
            <b>{latest.length}</b>
            <small>latest imports parsed</small>
          </div>
          <div className="bento-tile">
            <b>{collections.length}</b>
            <small>collections</small>
          </div>
          <div className="bento-tile">
            <b>{taxonomy.genres.length}</b>
            <small>genre streams</small>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <table className="simple">
            <thead>
              <tr><th>Collection</th><th>Kind</th><th>Source count</th><th>Cards captured</th></tr>
            </thead>
            <tbody>
              {collections.map((collection) => (
                <tr key={collection.key}>
                  <td><a href={`/collection/${collection.key}`} style={{ color: "var(--acc)" }}>{collection.name}</a></td>
                  <td>{collection.kind}</td>
                  <td>{collection.count.toLocaleString("en-US")}</td>
                  <td>{collection.items.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a className="btn btn-primary" href="/api/v1/meta">
            Open the live manifest <Icon name="arrow" size={13} />
          </a>
          <a className="btn btn-ghost" href="/api/v1/catalog">
            /api/v1/catalog
          </a>
        </div>
        <p style={{ marginTop: 14, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--fg-3)" }}>
          mirror {site.mirror} · upstream {(upstream.apiKey || upstream.readToken) ? "tmdb" : "snapshot"} · supabase{" "}
          {supabaseConfig.url ? "on" : "off"} · {data.collections.length} shelves · {fileCount} core files
        </p>
      </div>
    </div>
  );
}
