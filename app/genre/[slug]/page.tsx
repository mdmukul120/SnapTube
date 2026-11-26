import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CataloguePage } from "@/components/catalogue-page";
import { byGenre, taxonomy } from "@/lib/catalog";

export function generateStaticParams() {
  return taxonomy.genres.map((genre) => ({ slug: genre.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const genre = taxonomy.genres.find((entry) => entry.slug === slug);
  return { title: genre ? `${genre.name} movies & series` : "Genre" };
}

export default async function GenrePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const genre = taxonomy.genres.find((entry) => entry.slug === slug);
  if (!genre) notFound();
  const items = byGenre(slug);

  return (
    <CataloguePage
      kicker={`Genre stream · ${genre.name}`}
      title={`${genre.name} picks`}
      description={`Every ${genre.name.toLowerCase()} chip from the source navigation is its own route here, seeded deterministically from the full archive so each stream differs.`}
      items={items}
      activeGenre={slug}
      action={{ href: "/movies", label: "All movies →" }}
    />
  );
}
