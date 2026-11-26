import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CataloguePage } from "@/components/catalogue-page";
import { collections } from "@/lib/catalog";

export function generateStaticParams() {
  return collections.map((collection) => ({ key: collection.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const collection = collections.find((entry) => entry.key === key);
  return { title: collection ? collection.name : "Collection" };
}

export default async function CollectionPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const collection = collections.find((entry) => entry.key === key);
  if (!collection) notFound();

  return (
    <CataloguePage
      kicker={`Collection · ${collection.count.toLocaleString("en-US")} titles`}
      title={collection.name}
      description={`The full ${collection.name} shelf, re-cut from the archived ctgmovies.com collection rail. ${collection.items.length} titles carry complete poster, quality and view metadata.`}
      items={collection.items}
      action={{ href: "/movies", label: "All movies →" }}
    />
  );
}
