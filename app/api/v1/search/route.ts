import { authorize } from "@/lib/auth";
import { search, trending } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(Number(url.searchParams.get("limit") || 24), 60);

  if (!query) {
    return Response.json({
      ok: true,
      query: "",
      hint: "pass ?q=<title fragment>",
      fallback: trending(limit).map((item) => ({ slug: item.slug, kind: item.kind, title: item.title })),
    });
  }

  const results = search(query, limit);
  return Response.json({
    ok: true,
    query,
    count: results.length,
    results: results.map((item) => ({
      slug: item.slug,
      kind: item.kind,
      title: item.title,
      year: item.year,
      language: item.language,
      quality: item.quality,
      views: item.views,
      poster: item.poster,
      href: `/${item.kind === "series" ? "series" : item.kind === "game" ? "games" : "movies"}/${item.slug}`,
    })),
  });
}
