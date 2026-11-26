import type { Metadata } from "next";
import { CataloguePage } from "@/components/catalogue-page";
import { collections } from "@/lib/catalog";

export const metadata: Metadata = { title: "Series" };

export default function SeriesPage() {
  const series = collections.find((collection) => collection.key === "tv");
  return (
    <CataloguePage
      kicker="TV Shows · season & episode counters"
      title="Series worth a binge"
      description="Reality giants, K-dramas, Indian talk shows and big-budget fantasy — with the season/episode badges from the source grid."
      items={series?.items ?? []}
      action={{ href: "/top/series", label: "Top series →" }}
    />
  );
}
