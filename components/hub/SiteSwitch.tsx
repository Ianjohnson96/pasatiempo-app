"use client";

import { useState, useTransition } from "react";
import { setSiteEnabled } from "@/lib/hub/actions";
import type { SiteKey } from "@/lib/hub/apps";

// Super admin: take a public site offline (visitors see "not available") or bring it back.
export default function SiteSwitch({ site, enabled }: { site: SiteKey; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function flip() {
    const next = !on;
    if (!next && !confirm("Take this site offline? Visitors will see a 'not available' page until you switch it back on.")) return;
    start(async () => {
      const r = await setSiteEnabled(site, next);
      if (r.ok) {
        setOn(next);
        setError(null);
      } else setError(r.error);
    });
  }
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button type="button" className={"btn small " + (on ? "secondary" : "danger")} onClick={flip} disabled={pending} aria-pressed={on}>
        {pending ? "Saving…" : on ? "Public site: on" : "Public site: off"}
      </button>
      {error && <span style={{ color: "var(--danger)", fontSize: 12 }}>{error}</span>}
    </span>
  );
}
