import { authorize } from "@/lib/auth";
import { findItem } from "@/lib/catalog";
import { isConfigured, resolveSources } from "@/lib/streams";

/** `/movies/x`, `/movie/x` and `movie` all map onto the catalogue's `movie` kind. */
const KINDS: Record<string, string> = {
  movie: "movie",
  movies: "movie",
  film: "movie",
  series: "series",
  tv: "series",
  tvshows: "series",
  game: "game",
  games: "game",
  anime: "anime",
};

function normaliseKind(raw: string): string {
  return KINDS[raw.toLowerCase()] ?? raw.toLowerCase();
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const denied = await authorize(request);
  if (denied) return denied;

  const { path } = await params;
  const [rawKind, slug] = path ?? [];
  if (!rawKind || !slug) {
    return Response.json({ ok: false, error: "missing_kind_or_slug" }, { status: 400 });
  }

  const kind = normaliseKind(rawKind);
  const item = findItem(kind, slug);
  const { sources, mode } = resolveSources(kind, slug);

  return Response.json(
    {
      ok: true,
      mode,
      configured: isConfigured(),
      title: item
        ? {
            slug: item.slug,
            title: item.title,
            year: item.year,
            kind: item.kind,
            quality: item.quality,
            poster: item.poster,
            backdrop: item.backdrop ?? item.poster,
            description: item.description ?? "",
          }
        : { slug, title: slug.replace(/-/g, " "), kind },
      sources,
      subtitles: [],
      expiresIn: 900,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
