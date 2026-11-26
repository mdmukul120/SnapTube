# CRICFy TV — Web preview

A responsive web companion inspired by the attached CRICFy TV decompiled Android package. The repository now contains a working React/Vite interface for discovering channels, organizing a watchlist, managing authorized playback sources, and viewing clearly labelled fixture previews.

## Run locally

```bash
npm install
npm run dev
```

Vite serves on port `5173`. Create a production bundle with:

```bash
npm run build
```

## Included

- Responsive dashboard, navigation, channel search and sport filters
- English/Bangla interface toggle
- Browser-local favourites and channel management
- Player for direct HLS (`.m3u8`), MP4 and WebM sources
- Sample fixture cards that do not claim to be live or confirmed

## Playback and data notes

The attached `.txt` file is actually a ZIP archive containing decompiled APK analysis, not the original Android project source. The web preview does **not** copy the APK's third-party lookup endpoints, stream-extraction code, embedded credentials, or third-party stream links. Add only direct sources you own or are licensed to distribute. The player does not bypass DRM or access controls, and an HLS/video host must allow this site through CORS.

Channels and favourites are stored in this browser's local storage. This is a front-end prototype, not a secure multi-user admin system. Before production, connect a licensed fixture/content provider and an authenticated server-side channel-management service; do not place private provider keys or long-lived signed URLs in browser code.
