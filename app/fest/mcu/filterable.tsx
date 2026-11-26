"use client";

import { useMemo, useState } from "react";
import { PosterCard } from "@/components/cards";
import type { CatalogItem } from "@/lib/config";

const filters = [
  { key: "all", label: "All" },
  { key: "movie", label: "Movies" },
  { key: "series", label: "Series" },
  { key: "game", label: "Games" },
];

export function Filterable({ items }: { items: CatalogItem[] }) {
  const [active, setActive] = useState("all");
  const visible = useMemo(
    () => (active === "all" ? items : items.filter((item) => item.kind === active)),
    [active, items],
  );

  return (
    <div>
      <div className="chip-rail" style={{ marginBottom: 20 }}>
        {filters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            className="pill"
            data-active={active === filter.key}
            onClick={() => setActive(filter.key)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {visible.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 18 }}>
          {visible.map((item) => (
            <PosterCard key={`${item.kind}-${item.slug}`} item={item} />
          ))}
        </div>
      ) : (
        <div className="empty">Nothing in this lane.</div>
      )}
    </div>
  );
}
