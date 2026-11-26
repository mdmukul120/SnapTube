import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CataloguePage } from "@/components/catalogue-page";
import { allItems, collections, taxonomy } from "@/lib/catalog";

const LABELS: Record<string, string> = {
  english: "English",
  hindi: "Hindi",
  punjabi: "Punjabi",
  telugu: "Telugu",
  tamil: "Tamil",
  japanese: "Japanese",
  korean: "Korean",
  indonesian: "Indonesian",
};

const KEYS = [...new Set([...taxonomy.languages, ...collections.map((collection) => collection.key)])].filter(
  (key) => LABELS[key] || key === "south-indian",
);

export function generateStaticParams() {
  return KEYS.map((code) => ({ code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return { title: `${LABELS[code] ?? code} titles` };
}

export default async function LanguagePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!KEYS.includes(code)) notFound();

  const label = LABELS[code] ?? code;
  const shelf = collections.find((collection) => collection.key === code);
  const items =
    shelf?.items ??
    allItems.filter((item) => (item.language ?? "").toLowerCase().includes(code === "south-indian" ? "telugu" : code));

  return (
    <CataloguePage
      kicker={`Language · ${label}`}
      title={`${label} titles`}
      description={`The ${label} language filter from the source navigation, rebuilt as its own route with the collection shelf plus every matching late import.`}
      items={items}
      action={{ href: "/movies", label: "All movies →" }}
    />
  );
}
