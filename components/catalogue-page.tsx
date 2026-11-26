import { GenreRail, PosterCard } from "./cards";
import { SectionHead } from "./ui";
import type { CatalogItem } from "@/lib/config";
import { taxonomy } from "@/lib/catalog";

export function CataloguePage({
  kicker,
  title,
  description,
  items,
  activeGenre,
  action,
}: {
  kicker: string;
  title: string;
  description: string;
  items: CatalogItem[];
  activeGenre?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="shell" style={{ paddingTop: 34 }}>
      <SectionHead kicker={kicker} title={title} description={description} action={action} />
      <div style={{ margin: "0 0 24px" }}>
        <GenreRail genres={taxonomy.genres} active={activeGenre} />
      </div>
      {items.length ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 18,
          }}
        >
          {items.map((item) => (
            <PosterCard key={`${item.kind}-${item.slug}-${item.quality}`} item={item} />
          ))}
        </div>
      ) : (
        <div className="empty">No titles in this stream yet.</div>
      )}
      <p
        style={{
          marginTop: 26,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--fg-3)",
        }}
      >
        {items.length} titles rendered · snapshot catalogue
      </p>
    </div>
  );
}
