import { authorize } from "@/lib/auth";
import { collections, data, stats, taxonomy, trending } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await authorize(request);
  if (denied) return denied;

  // Strip card payloads to keep the summary light.
  const shelves = collections.map((collection) => ({
    key: collection.key,
    name: collection.name,
    kind: collection.kind,
    count: collection.count,
    cards: collection.items.length,
    href: `/collection/${collection.key}`,
  }));

  return Response.json(
    {
      ok: true,
      version: "v1",
      generatedAt: new Date().toISOString(),
      site: data.site,
      stats,
      shelves,
      taxonomy: {
        genres: taxonomy.genres,
        decades: taxonomy.decades,
        languages: taxonomy.languages,
      },
      trending: trending(8).map((item) => ({
        slug: item.slug,
        kind: item.kind,
        title: item.title,
        year: item.year,
        views: item.views,
      })),
    },
    { headers: { "cache-control": "private, max-age=30" } },
  );
}
