import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Rail } from "@/components/cards";
import { SectionHead } from "@/components/ui";
import { allItems } from "@/lib/catalog";

const allowed = ["movies", "series"] as const;

export function generateStaticParams() {
  return allowed.map((kind) => ({ kind }));
}

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const { kind } = await params;
  return { title: kind === "series" ? "Top series" : "Top movies" };
}

export default async function TopKindPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!allowed.includes(kind as (typeof allowed)[number])) notFound();
  const want = kind === "series" ? "series" : "movie";
  const items = [...allItems]
    .filter((item) => item.kind === want)
    .sort((a, b) => b.views - a.views)
    .slice(0, 30);

  return (
    <div className="shell" style={{ paddingTop: 34 }}>
      <SectionHead
        kicker="Charts · ranked"
        title={want === "series" ? "Top series" : "Top movies"}
        description="Thirty most-watched entries in this lane, ranked by the archived view counter."
        action={{ href: "/top", label: "All charts →" }}
      />
      <Rail items={items} />
    </div>
  );
}
