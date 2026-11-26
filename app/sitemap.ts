import type { MetadataRoute } from "next";
import { allItems, collections, taxonomy } from "@/lib/catalog";
import { site } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.origin.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes = [
    "",
    "/movies",
    "/series",
    "/games",
    "/anime",
    "/latest",
    "/top",
    "/top/movies",
    "/top/series",
    "/search",
    "/fest/mcu",
    "/analysis",
  ].map((path) => ({ url: `${base}${path}`, lastModified: now, changeFrequency: "daily" as const, priority: path === "" ? 1 : 0.8 }));

  const collectionRoutes = collections.map((collection) => ({
    url: `${base}/collection/${collection.key}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const genreRoutes = taxonomy.genres.map((genre) => ({
    url: `${base}/genre/${genre.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const decadeRoutes = taxonomy.decades.map((decade) => ({
    url: `${base}/decade/${decade}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  const languageRoutes = ["english", "hindi", "south-indian"].map((code) => ({
    url: `${base}/language/${code}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  const titleRoutes = allItems.map((item) => {
    const lane = item.kind === "series" ? "series" : item.kind === "game" ? "games" : item.kind === "anime" ? "anime" : "movies";
    return {
      url: `${base}/${lane}/${item.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    };
  });

  return [...staticRoutes, ...collectionRoutes, ...genreRoutes, ...decadeRoutes, ...languageRoutes, ...titleRoutes];
}
