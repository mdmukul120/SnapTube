# CRICFy TV APK archive review

## What was reviewed

The supplied `CRICFy TV_decompiled.txt` is a ZIP archive of APK extraction/decompilation output, not an Android Studio source project. It contains an `original/` resource/bytecode tree and a `decoded/` analysis tree. The archive has 2,028 entries; the embedded APK report describes package `com.cricfytv.sports`, version 7.5 (version code 55), with two DEX files, about 9,941 classes, 78,689 methods, 65,214 strings, 613 images, 34 native libraries, 22 permissions, and 10 activities.

The APK is heavily R8-obfuscated. The included pseudo-Java explicitly reconstructs signatures rather than method bodies, and many resource filenames are opaque IDs. There are no screenshots or clear, named screen-layout assets in the archive, so a pixel-exact reconstruction is not verifiable from this input alone. The web adaptation follows the recoverable navigation and feature vocabulary, rather than claiming a byte-for-byte or screenshot match.

## Recoverable screen and feature map

Decoded binding/class names and app-specific string resources indicate these areas:

- Home, channel catalogue, favourites, playlists, live-event categories, and event cards.
- Cricket and football score views, including related channels.
- A player with alternate stream choices, a direct stream-URL entry flow, quality/audio selection, lower-quality playback for slow connections, and a floating-player option.
- Notification/alert screens and a web/content view.

These labels are evidence of UI concepts, not proof that every feature was enabled, reliable, or backed by a stable public API. The current web app implements the recoverable public-facing flows with a responsive sports dashboard, channel catalogue, favourites, fixture and score views, a direct HLS/video player, optional provider-supplied alternate URLs, and browser Picture-in-Picture when supported. HLS.js uses adaptive playback when available; a separate manual quality/audio-track selector is not exposed in this web version.

## Network and rights findings

The embedded report counts 44 URL-like strings across 33 domains and 60 endpoint-like strings. That inventory mixes app references with Android/media SDK, analytics, advertising, Firebase, documentation, and third-party content services. A string in a decompilation is not an API contract, an authorization grant, or evidence that an endpoint remains operational. The web app deliberately does **not** reuse extracted third-party lookup URLs, embedded keys, stream-extraction behavior, or stream links.

The APK's own disclaimer says it does not stream channels itself and that third-party websites provide links. Accordingly, the web app accepts only direct HTTPS HLS/MP4/WebM sources that the operator is authorized to distribute and play. It does not scrape, resolve, decrypt, or bypass DRM/access controls. A media host must allow browser playback through CORS.

## Web API integration added

Three same-origin GET endpoints are now implemented:

- `/api/channels`
- `/api/fixtures`
- `/api/scores`

They use server-side `CRICFY_*` environment variables, normalize provider responses to a small allowlisted schema, reject insecure playback URLs, time out upstream calls, cap JSON responses, and never return the API key. The React UI fetches these endpoints and falls back to clearly labelled sample fixtures when no schedule provider is configured. Channel/favourite edits remain in browser local storage; provider feeds are not written there.

The API provider has **not** been specified yet, so no real sports provider or credentials are configured. Set an authorized provider in Vercel's server-side environment variables using `.env.example` and the contract in the README, or provide its documentation/schema for a provider-specific adapter. Never use a `VITE_`-prefixed variable for a private key.
