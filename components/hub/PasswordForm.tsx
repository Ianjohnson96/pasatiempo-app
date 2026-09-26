"use client";

import "@/app/globals.css";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { recordOwnPasswordChange } from "@/lib/hub/password";

export default function PasswordForm({ email, fromReset }: { email: string; fromReset: boolean }) {
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
    await recordOwnPasswordChange(fromReset);
    setPw("");
    setPw2("");
    setMsg({ ok: true, text: "Password changed. Use it next time you sign in." });
  }

  return (
    <main className="wrap" style={{ maxWidth: 420 }}>
      <p className="eyebrow">Pasatiempo</p>
      <h1>{fromReset ? "Set a new password" : "Change your password"}</h1>
      <p style={{ color: "var(--muted)" }}>Signed in as {email}</p>
      <form onSubmit={onSubmit} style={{ marginTop: 20 }}>
        {msg && <p style={{ color: msg.ok ? "var(--accent)" : "#e8887b", marginTop: 0 }}>{msg.text}</p>}
        <label style={{ display: "block", marginBottom: 12 }}>
          <div style={{ color: "var(--muted)", marginBottom: 6 }}>New password</div>
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required style={inputStyle} />
        </label>
        <label style={{ display: "block", marginBottom: 20 }}>
          <div style={{ color: "var(--muted)", marginBottom: 6 }}>Type it again</div>
          <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required style={inputStyle} />
        </label>
        <button type="submit" disabled={busy} style={buttonStyle}>
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
      <p style={{ marginTop: 18 }}><Link href="/admin">Go to the dashboard</Link></p>
    </main>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--ink)", fontSize: 16 };
const buttonStyle: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#1a1205", fontWeight: 600, fontSize: 16, cursor: "pointer" };
