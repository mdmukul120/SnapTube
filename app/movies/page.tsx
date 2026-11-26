import type { Metadata } from "next";
import { CataloguePage } from "@/components/catalogue-page";
import { collections } from "@/lib/catalog";

export const metadata: Metadata = { title: "Movies" };

export default function MoviesPage() {
  const movieCollections = collections.filter((collection) => collection.kind === "movie");
  const items = movieCollections.flatMap((collection) => collection.items);

  return (
    <CataloguePage
      kicker={`Movies · ${movieCollections.length} language collections`}
      title="Every movie in the archive"
      description="English, Hindi, South Indian, Asian and European shelves merged into one grid — quality badges and view counters preserved."
      items={items}
      action={{ href: "/top/movies", label: "Top movies →" }}
    />
  );
}
