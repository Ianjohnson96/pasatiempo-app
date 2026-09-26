"use client";

import { useState } from "react";

interface Bundle {
  kind: string;
  note?: string;
  docs: Record<string, unknown>;
}

// Owner page: load a month-end data file (built by merchandise/pipeline/refresh.py).
export default function DataLoader({ base, peopleHref }: { base: string; peopleHref: string | null }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    setMsg(null);
    setBundle(null);
    if (!file) return;
    try {
      const b = JSON.parse(await file.text()) as Bundle;
      if (b.kind !== "pasatiempo-merch-bundle" || !b.docs) throw new Error();
      setBundle(b);
    } catch {
      setMsg({ ok: false, text: "That file isn't a Merchandise Program data file." });
    }
  }

  async function load() {
    if (!bundle) return;
    setBusy(true);
    const r = await fetch(base + "/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bundle) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: j.error || "That didn't load." });
    setBundle(null);
    setMsg({ ok: true, text: `Loaded ${j.loaded} documents. Open the program to see the update.` });
  }

  const groups = bundle
    ? Object.entries(
        Object.keys(bundle.docs).reduce<Record<string, number>>((a, p) => ((a[p.split("/")[0]] = (a[p.split("/")[0]] || 0) + 1), a), {}),
      )
    : [];

  return (
    <main className="m-wrap">
      <div className="m-top">
        <div>
          <p className="m-kicker">Merchandise Program</p>
          <h1>Month-end data</h1>
        </div>
        <a className="m-btn" href={base || "/"}>← Back to the program</a>
      </div>

      <section className="m-card">
        <h2>Load month-end data</h2>
        <p className="m-note" style={{ marginTop: 0 }}>
          Load a Merchandise Program data file (.json): the forecast base, stock, suggestions and brand scorecard. It replaces those parts of the program. Orders, vendors, counts, budget changes and brand calls are never touched.
        </p>
        {msg && <p className={msg.ok ? "m-ok" : "m-error"}>{msg.text}</p>}
        <input type="file" accept=".json,application/json" onChange={(e) => pick(e.target.files?.[0])} />
        {bundle && (
          <div style={{ marginTop: 14 }}>
            {bundle.note && <p style={{ margin: "0 0 6px" }}><b>{bundle.note}</b></p>}
            <p className="m-note" style={{ margin: "0 0 12px" }}>
              {Object.keys(bundle.docs).length} documents: {groups.map(([g, n]) => `${g} ${n}`).join(" · ")}
            </p>
            <button className="m-btn primary" type="button" disabled={busy} onClick={load}>{busy ? "Loading…" : "Load it"}</button>
          </div>
        )}
      </section>

      {peopleHref && (
        <section className="m-card">
          <h2>Who can open the program</h2>
          <p className="m-note" style={{ margin: "0 0 12px" }}>
            People and their access are managed in one place for every Pasatiempo app.
          </p>
          <a className="m-btn" href={peopleHref}>People &amp; access →</a>
        </section>
      )}
    </main>
  );
}
