import { authorize } from "@/lib/auth";
import { collections } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const denied = await authorize(request);
  if (denied) return denied;

  const { key } = await params;
  const collection = collections.find((entry) => entry.key === key);
  if (!collection) {
    return Response.json(
      { ok: false, error: "collection_not_found", available: collections.map((entry) => entry.key) },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

  return Response.json({
    ok: true,
    collection: { key: collection.key, name: collection.name, kind: collection.kind, count: collection.count },
    page: { limit, offset, returned: collection.items.slice(offset, offset + limit).length },
    items: collection.items.slice(offset, offset + limit),
  });
}
