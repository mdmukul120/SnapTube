import type { Metadata } from "next";
import { CataloguePage } from "@/components/catalogue-page";
import { collections } from "@/lib/catalog";

export const metadata: Metadata = { title: "Anime" };

export default function AnimePage() {
  const asian = collections.find((collection) => collection.key === "asian");
  return (
    <CataloguePage
      kicker="Anime · Asian shelf cut"
      title="Anime & Asian cinema"
      description="The anime lane is derived from the Asian shelf plus the Japanese-language imports pulled from the latest-imports grid."
      items={asian?.items ?? []}
      action={{ href: "/genre/animation", label: "Animation genre →" }}
    />
  );
}
