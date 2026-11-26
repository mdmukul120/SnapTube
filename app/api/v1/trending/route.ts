import { authorize } from "@/lib/auth";
import { trending } from "@/lib/catalog";
import { upstreamPopular } from "@/lib/catalog";
import { features } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 12), 48);
  const live = url.searchParams.get("live") === "1" && features.liveUpstream;

  if (live) {
    const upstream = await upstreamPopular((url.searchParams.get("kind") as "movie" | "tv") || "movie");
    if (upstream.results.length) {
      return Response.json({ ok: true, source: "tmdb", items: upstream.results.slice(0, limit) });
    }
  }

  return Response.json({
    ok: true,
    source: "snapshot",
    items: trending(limit),
  });
}
