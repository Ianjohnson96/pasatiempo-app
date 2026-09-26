"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AccountForm({ base }: { base: string }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setMsg({ ok: false, text: "Use at least 8 characters." });
    if (pw !== pw2) return setMsg({ ok: false, text: "The two passwords don't match." });
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setPw("");
    setPw2("");
    setMsg({ ok: true, text: "Password changed." });
  }

  return (
    <main className="m-narrow">
      <p className="m-kicker">Merchandise Program</p>
      <h1>Change your password</h1>
      <p className="m-sub">
        <a href={base || "/"}>← Back to the program</a>
      </p>
      <form className="m-card" onSubmit={onSubmit}>
        {msg && <p className={msg.ok ? "m-ok" : "m-error"}>{msg.text}</p>}
        <label className="m-field">
          <span>New password</span>
          <input className="m-input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        </label>
        <label className="m-field">
          <span>Type it again</span>
          <input className="m-input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
        </label>
        <button className="m-btn primary block" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </main>
  );
}
