"use client";

import { useState } from "react";

const examples = [
  { label: "Catalog", path: "/api/v1/catalog" },
  { label: "Collection", path: "/api/v1/collections/english?limit=5" },
  { label: "Search", path: "/api/v1/search?q=janata" },
  { label: "Trending", path: "/api/v1/trending?limit=5" },
];

export function ApiPlayground() {
  const [output, setOutput] = useState<string>("// run a request to see the JSON response");
  const [busy, setBusy] = useState<string | null>(null);

  async function run(path: string) {
    setBusy(path);
    setOutput("// requesting…");
    try {
      const key = process.env.NEXT_PUBLIC_BFF_API_KEY || "ctg-live-public-key";
      const tokenResponse = await fetch("/api/v1/auth/token", {
        method: "POST",
        headers: { "x-api-key": key },
      });
      const tokenPayload = await tokenResponse.json();
      const response = await fetch(path, {
        headers: { "x-api-key": key, authorization: `Bearer ${tokenPayload.token}` },
      });
      const json = await response.json();
      setOutput(JSON.stringify(json, null, 2).slice(0, 2600));
    } catch (error) {
      setOutput(`// request failed: ${(error as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel" style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {examples.map((example) => (
          <button
            key={example.path}
            type="button"
            className="pill"
            onClick={() => run(example.path)}
            disabled={busy !== null}
            data-active={busy === example.path}
          >
            {example.label}
          </button>
        ))}
      </div>
      <div className="code" style={{ maxHeight: 320, overflow: "auto" }}>
        {output}
      </div>
    </div>
  );
}
