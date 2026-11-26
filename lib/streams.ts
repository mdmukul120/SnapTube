/**
 * Stream resolution.
 *
 * Playback never talks to a third-party CDN directly from the page: the browser
 * asks `/api/v1/play/:kind/:slug` (auth key + token) and the server decides what
 * is playable. Three layers, in priority order:
 *
 *  1. `STREAM_BASE_URL`  — your own HLS/CDN template, e.g.
 *                          https://cdn.example.com/{kind}/{slug}/master.m3u8
 *  2. `PLAYBACK_SOURCES` — JSON map of per-title URLs:
 *                          {"janata-bar":["https://cdn/x/master.m3u8"]}
 *  3. Demo reel          — public sample streams so the player is always live.
 */

export type PlaySource = {
  url: string;
  type: "hls" | "mp4" | "webm";
  quality: string;
  label: string;
  note?: string;
};

const DEMO_REEL: PlaySource[] = [
  {
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    type: "hls",
    quality: "auto",
    label: "Adaptive HLS",
    note: "demo · Big Buck Bunny (Mux test stream)",
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    type: "mp4",
    quality: "720p",
    label: "720p MP4",
    note: "demo · Big Buck Bunny",
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    type: "mp4",
    quality: "720p",
    label: "720p MP4",
    note: "demo · Elephants Dream",
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    type: "mp4",
    quality: "1080p",
    label: "1080p MP4",
    note: "demo · For Bigger Blazes",
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    type: "mp4",
    quality: "1080p",
    label: "1080p MP4",
    note: "demo · Sintel",
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    type: "mp4",
    quality: "1080p",
    label: "1080p MP4",
    note: "demo · Tears of Steel",
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
    type: "mp4",
    quality: "1080p",
    label: "1080p MP4",
    note: "demo · Subaru Outback",
  },
];

function parseMap(raw: string | undefined): Record<string, string[]> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, string[]>;
  } catch {
    /* ignore malformed config */
  }
  return {};
}

function typeOf(url: string): PlaySource["type"] {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".m3u8")) return "hls";
  if (clean.endsWith(".webm")) return "webm";
  return "mp4";
}

function labelOf(url: string): string {
  const match = url.match(/(\d{3,4}p)/i);
  return match ? match[1].toLowerCase() : "source";
}

export function resolveSources(kind: string, slug: string): { sources: PlaySource[]; mode: "cdn" | "map" | "demo" } {
  const base = process.env.STREAM_BASE_URL;
  const map = parseMap(process.env.PLAYBACK_SOURCES);

  const mapped = map[slug] ?? map[`${kind}/${slug}`] ?? [];
  if (mapped.length) {
    return {
      mode: "map",
      sources: mapped.map((url) => ({
        url,
        type: typeOf(url),
        quality: labelOf(url),
        label: labelOf(url),
      })),
    };
  }

  if (base) {
    const root = base.replace(/\/$/, "");
    const url = root
      .replace("{kind}", kind)
      .replace("{slug}", slug)
      .replace("{name}", slug);
    const hls = url.includes(".m3u8") ? url : `${url}/master.m3u8`;
    return {
      mode: "cdn",
      sources: [
        { url: hls, type: "hls", quality: "auto", label: "Auto (HLS)" },
        { url: url.includes(".m3u8") ? url.replace("master.m3u8", "720p.m3u8") : `${url}/720p.m3u8`, type: "hls", quality: "720p", label: "720p" },
        { url: url.includes(".m3u8") ? url.replace("master.m3u8", "1080p.m3u8") : `${url}/1080p.m3u8`, type: "hls", quality: "1080p", label: "1080p" },
      ],
    };
  }

  // Deterministic rotation so each title starts on a different demo reel entry.
  const seed = [...slug].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const start = seed % DEMO_REEL.length;
  const rotated = [...DEMO_REEL.slice(start), ...DEMO_REEL.slice(0, start)];
  return { mode: "demo", sources: rotated };
}

export function isConfigured(): boolean {
  return Boolean(process.env.STREAM_BASE_URL || process.env.PLAYBACK_SOURCES);
}
