import type { Metadata } from "next";
import { LatestCard } from "@/components/cards";
import { SectionHead } from "@/components/ui";
import { latest } from "@/lib/catalog";

export const metadata: Metadata = { title: "Latest imports" };

export default function LatestPage() {
  return (
    <div className="shell" style={{ paddingTop: 34 }}>
      <SectionHead
        kicker={`Latest imports · ${latest.length} titles`}
        title="Latest titles"
        description="The complete latest-imports grid: poster with hover backdrop, quality badge, view counter, language tag, star rating and synopsis."
      />
      <div className="grid-latest">
        {latest.map((item) => (
          <LatestCard key={`${item.slug}-${item.year}`} item={item} />
        ))}
      </div>
    </div>
  );
}
