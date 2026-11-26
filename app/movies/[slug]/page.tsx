import type { Metadata } from "next";
import { DetailView, NotFoundView } from "@/components/detail";
import { allItems, findItem } from "@/lib/catalog";

const LANE = "movies";
const KIND = "movie";

export function generateStaticParams() {
  return allItems.filter((item) => item.kind === KIND).map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = findItem(KIND, slug);
  return {
    title: item ? `${item.title} (${item.year})` : "Not found",
    description: item?.description?.slice(0, 180) ?? undefined,
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = findItem(KIND, slug);
  if (!item) return <NotFoundView label={slug.replace(/-/g, " ")} />;
  return <DetailView item={item} />;
}
