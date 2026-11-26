import manifest from "@/data/source-manifest.json";
import { features, apiAuth } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public discovery document: what the API exposes and how to authenticate. */
export async function GET() {
  return Response.json({
    ok: true,
    name: "CTGMovies Public API",
    version: "v1",
    auth: {
      step1: {
        method: "POST",
        path: "/api/v1/auth/token",
        headers: { [apiAuth.keyHeader]: "<public api key>" },
        returns: "short-lived HMAC-signed bearer token",
      },
      step2: {
        headers: { [apiAuth.tokenHeader]: "Bearer <token>", [apiAuth.keyHeader]: "<public api key>" },
        note: "both headers are validated on every data request",
      },
      ttlSeconds: apiAuth.tokenTtlSeconds,
      strictMode: features.strictAuth,
    },
    endpoints: [
      { method: "GET", path: "/api/v1/catalog", summary: "shelves, taxonomy, stats, trending" },
      { method: "GET", path: "/api/v1/collections/:key", summary: "one collection, paged with limit/offset" },
      { method: "GET", path: "/api/v1/titles/:kind/:slug", summary: "single title record" },
      { method: "GET", path: "/api/v1/search?q=", summary: "full-text search across the snapshot" },
      { method: "GET", path: "/api/v1/trending?limit=&live=1", summary: "view-counter ranking, optional TMDB passthrough" },
      { method: "GET", path: "/api/v1/meta", summary: "this document" },
    ],
    source: {
      url: manifest.source.url,
      framework: manifest.source.framework,
      bundles: manifest.stats.scripts,
      stylesheets: manifest.stats.styles,
      cachedImages: manifest.imageCacheCount,
      routesIndexed: manifest.routes.length,
    },
  });
}
