/**
 * CTGMovies — central runtime configuration.
 *
 * Every secret is read from the environment (Vercel project env vars) and is
 * never shipped to the browser. Client code only ever talks to the
 * same-origin `/api/v1/*` surface, which enforces the auth key / auth token
 * handshake described in `lib/auth.ts`.
 */

const env = process.env;

export const site = {
  name: "CTGMovies",
  tagline: "Your Own World of Entertainment",
  mirror: "mobile.ctgmovies.com",
  origin: env.SITE_URL || "https://ctgmovies.vercel.app",
  years: "2016-2026",
  locale: "en",
} as const;

/** Upstream catalogue provider (TMDB is the metadata source the source site uses). */
export const upstream = {
  tmdbBase: env.TMDB_API_BASE || "https://api.themoviedb.org/3",
  apiKey: env.TMDB_API_KEY ?? "",
  readToken: env.TMDB_READ_TOKEN ?? "",
  imageBase: env.TMDB_IMAGE_BASE || "https://image.tmdb.org/t/p",
  language: env.TMDB_LANGUAGE || "en-US",
  region: env.TMDB_REGION || "US",
} as const;

/** Supabase is optional — used for view counters, watchlists and search telemetry. */
export const supabaseConfig = {
  url: env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  anonKey: env.SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  serviceKey: env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  table: env.SUPABASE_VIEWS_TABLE || "title_views",
} as const;

/** Auth key / token handshake used by the public API. */
export const apiAuth = {
  keyHeader: "x-api-key",
  tokenHeader: "authorization",
  signingSecret: env.API_SIGNING_SECRET ?? "",
  bffKey: env.NEXT_PUBLIC_BFF_API_KEY ?? "ctg-live-public-key",
  tokenTtlSeconds: Number(env.API_TOKEN_TTL || 900),
  /** Optional static keys for partner integrations. */
  partnerKeys: (env.API_PARTNER_KEYS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
} as const;

export const features = {
  liveUpstream: Boolean(upstream.apiKey || upstream.readToken),
  supabase: Boolean(supabaseConfig.url && supabaseConfig.anonKey),
  strictAuth: env.API_STRICT_AUTH === "1",
} as const;

export type CatalogItem = {
  slug: string;
  href?: string;
  title: string;
  year: string;
  kind: string;
  language?: string;
  quality: string;
  views: number;
  poster: string;
  thumb?: string;
  backdrop?: string;
  description?: string;
  rating?: number | null;
  /** Source-site accent pair used for the language ribbon on the latest grid. */
  accent?: string;
  onAccent?: string;
};

export type Collection = {
  key: string;
  name: string;
  label: string;
  kind: string;
  count: number;
  items: CatalogItem[];
};
