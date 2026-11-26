import { authorize } from "@/lib/auth";
import { findItem } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; slug: string }> },
) {
  const denied = await authorize(request);
  if (denied) return denied;

  const { kind, slug } = await params;
  const item = findItem(kind, slug);
  if (!item) {
    return Response.json({ ok: false, error: "title_not_found", kind, slug }, { status: 404 });
  }
  return Response.json({ ok: true, title: item });
}
