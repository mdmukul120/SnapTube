import type { Metadata } from "next";
import { CataloguePage } from "@/components/catalogue-page";
import { collections } from "@/lib/catalog";

export const metadata: Metadata = { title: "Games" };

export default function GamesPage() {
  const games = collections.find((collection) => collection.key === "games");
  return (
    <CataloguePage
      kicker="Games · repacks & releases"
      title="PC releases and repacks"
      description="FitGirl and DODI repacks, RUNE releases and the newest AAA drops from the source Games shelf."
      items={games?.items ?? []}
      action={{ href: "/collection/games", label: "Full shelf →" }}
    />
  );
}
