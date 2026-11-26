import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CataloguePage } from "@/components/catalogue-page";
import { allItems, taxonomy } from "@/lib/catalog";

export function generateStaticParams() {
  return taxonomy.decades.map((decade) => ({ decade }));
}

export async function generateMetadata({ params }: { params: Promise<{ decade: string }> }): Promise<Metadata> {
  const { decade } = await params;
  return { title: `${decade} releases` };
}

export default async function DecadePage({ params }: { params: Promise<{ decade: string }> }) {
  const { decade } = await params;
  if (!taxonomy.decades.includes(decade)) notFound();
  const start = Number(decade.slice(0, 4));
  const items = allItems.filter((item) => {
    const year = Number(item.year);
    return year >= start && year < start + 10;
  });

  return (
    <CataloguePage
      kicker={`Decade · ${decade}`}
      title={`${decade} in the archive`}
      description={`Every title from ${start} to ${start + 9} that carries a year stamp — the same decade chips the source navigation exposed.`}
      items={items}
      action={{ href: "/top", label: "All charts →" }}
    />
  );
}
