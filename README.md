# CRICFy TV — web adaptation

A responsive web companion inspired by the supplied CRICFy TV APK decompilation. It brings together channel browsing, browser-local favourites, fixture previews, provider-backed scores, and a direct HLS/video player. See [the archive review](docs/apk-review.md) for what could—and could not—be recovered from the obfuscated APK.

## Run locally

```bash
npm install
npm run dev
```

The Vite development server also mounts the server-side API handlers under `/api/*`. To connect your own authorized provider locally, copy `.env.example` to `.env.local` and fill in its values. Do not commit `.env.local`.

```bash
npm test
npm run build
```

## Sports data API configuration

The app calls same-origin endpoints, keeping provider credentials out of the browser bundle:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/channels` | Provider channel catalogue and optional direct stream sources |
| `GET /api/fixtures` | Match/event schedule |
| `GET /api/scores` | Score cards |

Set these as **server-side** environment variables in Vercel Project Settings → Environment Variables (or in an ignored local `.env.local`):

| Variable | Description |
| --- | --- |
| `CRICFY_API_BASE_URL` | HTTPS base URL for an API provider you are authorized to use, e.g. `https://api.example.com/v1` |
| `CRICFY_API_KEY` | Provider API key; never expose it to client code |
| `CRICFY_API_KEY_HEADER` | Optional header name; defaults to `Authorization` |
| `CRICFY_API_KEY_PREFIX` | Optional value prefix; defaults to `Bearer` for `Authorization`, otherwise empty |
| `CRICFY_CHANNELS_PATH` | Relative path for channels; defaults to `channels` |
| `CRICFY_FIXTURES_PATH` | Relative path for fixtures; defaults to `fixtures` |
| `CRICFY_SCORES_PATH` | Relative path for scores; defaults to `scores` |

For a custom header, for example, use `CRICFY_API_KEY_HEADER=X-Api-Key` and leave the prefix empty. The API paths may include non-sensitive provider query parameters but must remain relative to the configured base URL; never put credentials into a path or query string. After adding/changing Vercel variables, redeploy so the serverless functions receive them.

No provider was specified with the APK, so there is no real sports API or key configured in this repository. Without a key/base URL, endpoints return `{ "configured": false, "items": [] }`; the site remains usable and labels its fixture cards as samples. Once configured, the adapter accepts either a JSON array or common envelopes such as `items`, `channels`, `fixtures`, `events`, `scores`, `matches`, `results`, `response`, and `data`.

### Supported response fields

- **Channels:** `id`, `name`/`title`, `category`/`sport`, `subtitle`/`description`, `streamUrl`/`url`, and optional `streams` or `links` containing `{ "name": "Backup", "url": "https://…/backup.m3u8" }` entries.
- **Fixtures/scores:** `id`, `sport`, `home`/`homeTeam`/`teams.home`, `away`/`awayTeam`/`teams.away`, optional team `name`/`code`/`flag`, `homeScore`/`awayScore` (or `scores`/`goals`), `status`, `startsAt`/`date`, and `competition`/`league`.

Responses are normalized to allowlisted fields. Upstream errors return a generic 502 without including provider response bodies or secrets. These are public, same-origin read endpoints: only configure data that may be shown publicly. Provider channel stream URLs are delivered to the browser for playback, so only use direct streams you are licensed to distribute to web clients; do not put private credentials or long-lived signed URLs into a public catalogue. The player accepts direct HTTPS HLS (`.m3u8`), MP4, or WebM URLs, requires the media host to permit CORS, and does not scrape streams or bypass DRM/access controls.

## Included

- Responsive sports dashboard, channel search, and sport filters
- English/Bangla interface toggle
- Provider-backed channel, fixture, and score endpoints with server-side API-key handling
- Multiple provider-supplied stream choices and browser Picture-in-Picture where supported
- Browser-local channel edits/favourites; provider data is not copied into local storage
- Clearly labelled sample fixture cards when no schedule provider is configured
- HLS playback through native browser support or HLS.js, plus MP4/WebM playback

## Data and licensing notes

The supplied APK inventory is not a verified API specification. The web app does not copy its third-party lookup URLs, embedded keys, stream-extraction logic, or third-party playback links. See [docs/apk-review.md](docs/apk-review.md). Channel edits and favourites are stored in browser local storage, not on a server, so this is not a multi-user admin system.
