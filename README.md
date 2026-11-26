# CTGMovies — fresh build

A complete, redesigned rebuild of **[ctgmovies.com](https://ctgmovies.com/)** — “Your Own World of Entertainment”.
The archived Next.js page (`index3.html`, 1.2 MB) was scanned end to end, every collection / spotlight / fest / genre
module was parsed into structured data, and the whole catalogue was re-implemented as a new Next.js 16 App Router
project with a documented auth-key + auth-token API. Deployed on Vercel.

---

## 1. What was scanned

| Signal | Finding in the source document |
| --- | --- |
| Entry point | `https://ctgmovies.com/` · 1.22 MB HTML snapshot (RSC flight payload included) |
| Framework | Next.js App Router with streamed React Server Components |
| Stylesheets | 3 hashed CSS bundles + inline `<style>` modules for the fest lanes |
| Client JS | 17 async chunks (`webpack`, `main-app`, `layout`, `page`, `(auth)/layout`, …) |
| Images | 195 `/imgcache/<sha>.webp` derivatives of TMDB posters + a `data-fallback` error handler |
| Design tokens | `--color-acc:#ffbf00`, ink surfaces `#0b1424`, hairline `--color-line`, Bricolage / Hind display stack |
| Content model | Hero spotlight deck · featured rail · 7 collection rails · MCU fest wall · genre/decade/language chips · latest-imports grid · mirror banner |
| Access control | No keys in the payload — playback is gated behind the Cinemax account |

Everything above is reproduced in `/analysis` inside the app, together with the full chunk list
(`data/source-manifest.json`).

## 2. What was extracted

`scripts/extract-catalog.py` turns the snapshot into `data/catalog.json`:

* **7 collections** — English, Hindi, South Indian, Asian, European, TV Shows, Games (14 294 titles by source count)
* **130 collection cards** — poster, quality badge, view counter, year
* **32 latest imports** — poster + hover backdrop, language ribbon, star rating, synopsis, view count
* **1 spotlight** + **5 featured titles** (hero deck)
* **90-poster MCU fest wall**
* **13 genre chips**, 4 decades, language filters, collection IDs

## 3. Routes

```
/                        home — hero deck, fest strip, 7 rails, latest grid, genre bento
/movies /series /games /anime
/movies/[slug] /series/[slug] /games/[slug] /anime/[slug]
/collection/[key]       7 generated shelves
/genre/[slug]           13 generated genre streams
/top  /top/movies  /top/series
/latest  /search?q=  /fest/mcu  /analysis
```

## 4. API — auth key + auth token

Two-step handshake, HMAC-SHA256 signed, stateless (works on every Vercel runtime).

```bash
# 1 · mint a token with your API key
curl -s -X POST https://<deployment>/api/v1/auth/token \
  -H "x-api-key: $NEXT_PUBLIC_BFF_API_KEY"

# { "ok": true, "tokenType": "Bearer", "token": "<payload>.<hmac>", "ttl": 900, "scope": [...] }

# 2 · call any data endpoint with key + token
curl -s https://<deployment>/api/v1/collections/english?limit=20 \
  -H "x-api-key: $NEXT_PUBLIC_BFF_API_KEY" \
  -H "authorization: Bearer <token>"
```

| Method | Path | Returns |
| --- | --- | --- |
| `POST` | `/api/v1/auth/token` | auth token (requires API key) |
| `POST` | `/api/v1/auth/session` | token bootstrap / reuse |
| `GET` | `/api/v1/catalog` | shelves, taxonomy, stats, trending |
| `GET` | `/api/v1/collections/:key` | one collection, `limit` / `offset` paging |
| `GET` | `/api/v1/titles/:kind/:slug` | single title record |
| `GET` | `/api/v1/search?q=` | full-text search |
| `GET` | `/api/v1/trending?limit=&live=1` | view-counter ranking, optional TMDB passthrough |
| `GET` | `/api/v1/meta` | discovery document |

Errors: `401 invalid_api_key`, `401 unauthorized` (missing/expired token), `404 *_not_found`, `405 method_not_allowed`.
Every response carries `Access-Control-Allow-Origin: *` and `Cache-Control: no-store` on the auth routes.

A live playground on `/analysis` mints a token and runs four example requests against the deployment itself.

## 5. Environment

Copy `.env.example` → `.env.local` (or add the values in Vercel):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_BFF_API_KEY` | public API key used by the browser playground (default `ctg-live-public-key`) |
| `API_SIGNING_SECRET` | HMAC secret for auth tokens — **set in production** |
| `API_TOKEN_TTL` | token lifetime, seconds (default `900`) |
| `API_PARTNER_KEYS` | comma list of extra accepted keys |
| `API_STRICT_AUTH` | `1` = reject unknown keys |
| `TMDB_API_KEY` / `TMDB_READ_TOKEN` | enables live TMDB passthrough (`?live=1`) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | optional view counters / watchlists |
| `SITE_URL` | canonical origin for metadata + sitemap |

## 6. Local development

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build
npm run extract        # re-parse the snapshot -> data/catalog.json
```

## 7. Deploy

`vercel.json` pins the framework preset, build command and CORS headers, so a plain `vercel --prod`
(or the Git integration on `main`) is enough. Set `API_SIGNING_SECRET` and `SITE_URL` in the project
before the first production deploy.

---

Catalogue metadata belongs to the original rights holders; this build only re-presents the archived
public listing for the CTGMovies project.
