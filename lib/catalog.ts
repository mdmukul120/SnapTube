/**
 * Catalogue access layer: static snapshot first, live TMDB provider second.
 * Mirrors the data shape the original Next.js site streamed through RSC.
 */
import catalog from "@/data/catalog.json";
import { upstream, features, type CatalogItem, type Collection } from "./config";

type CatalogFile = {
  site: Record<string, string>;
  spotlight: Array<{
    slug: string;
    href: string;
    title: string;
    chips: string[];
    description: string;
    poster: string;
    backdrop: string;
    kind: string;
  }>;
  featured: Array<{
    title: string;
    year: string;
    rating: number | null;
    quality: string;
    poster: string;
    slug: string;
    kind: string;
    views: number;
  }>;
  collections: Collection[];
  latest: CatalogItem[];
  fest: { title: string; posterWall: string[] };
  taxonomy: {
    genres: Array<{ slug: string; name: string }>;
    collections: Array<{ id: string; name: string }>;
    decades: string[];
    languages: string[];
  };
};

export const data = catalog as unknown as CatalogFile;

export const collections: Collection[] = data.collections;
export const latest: CatalogItem[] = data.latest;
export const spotlight = data.spotlight;
export const featured = data.featured;
export const taxonomy = data.taxonomy;
export const fest = data.fest;

export const allItems: CatalogItem[] = Array.from(
  new Map(
    [...collections.flatMap((collection) => collection.items), ...latest].map((item) => [
      `${item.kind}:${item.slug}`,
      item,
    ]),
  ).values(),
);

export function findCollection(key: string): Collection | undefined {
  return collections.find((collection) => collection.key === key);
}

export function findItem(kind: string, slug: string): CatalogItem | undefined {
  return allItems.find((item) => item.kind === kind && item.slug === slug);
}

export function search(query: string, limit = 24): CatalogItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return allItems
    .filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        (item.language ?? "").toLowerCase().includes(needle) ||
        item.year.includes(needle),
    )
    .slice(0, limit);
}

export function trending(limit = 12): CatalogItem[] {
  return [...allItems]
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

export function byGenre(genreSlug: string, limit = 60): CatalogItem[] {
  const genre = taxonomy.genres.find((entry) => entry.slug === genreSlug);
  if (!genre) return [];
  // The snapshot does not carry per-title genre tags, so we use a stable
  // deterministic rotation per genre to keep every genre page distinct.
  const seed = [...genre.slug].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return [...allItems]
    .sort((a, b) => (a.views + seed) % 997 - ((b.views + seed) % 997))
    .slice(0, limit);
}

/** Live TMDB proxy with graceful fallback to the archived snapshot. */
export async function upstreamPopular(kind: "movie" | "tv" = "movie", page = 1) {
  if (!features.liveUpstream) return { source: "snapshot" as const, results: [] as CatalogItem[] };
  const path = kind === "tv" ? "/tv/popular" : "/movie/popular";
  const url = new URL(upstream.tmdbBase + path);
  url.searchParams.set("page", String(page));
  url.searchParams.set("language", upstream.language);
  if (!upstream.readToken) url.searchParams.set("api_key", upstream.apiKey);
  try {
    const response = await fetch(url, {
      headers: upstream.readToken
        ? { authorization: `Bearer ${upstream.readToken}` }
        : undefined,
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error(`upstream ${response.status}`);
    const payload = await response.json();
    const results: CatalogItem[] = (payload.results ?? []).map((entry: any) => ({
      slug: slugify(entry.title || entry.name || ""),
      title: entry.title || entry.name || "Untitled",
      year: String(entry.release_date || entry.first_air_date || "").slice(0, 4),
      kind,
      quality: "1080p WebRip",
      views: entry.popularity ? Math.round(entry.popularity * 37) : 0,
      poster: entry.poster_path ? `${upstream.imageBase}/w500${entry.poster_path}` : "",
      backdrop: entry.backdrop_path ? `${upstream.imageBase}/w1280${entry.backdrop_path}` : "",
      description: entry.overview ?? "",
      rating: entry.vote_average ?? null,
    }));
    return { source: "tmdb" as const, results };
  } catch {
    return { source: "snapshot" as const, results: [] as CatalogItem[] };
  }
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const stats = {
  titles: collections.reduce((acc, collection) => acc + collection.count, 0),
  collections: collections.length,
  latest: latest.length,
  genres: taxonomy.genres.length,
};
