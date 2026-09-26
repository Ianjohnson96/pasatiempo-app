"use client";

import "@/app/globals.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/hub/next";

// Staff sign-in for every Pasatiempo app. Signs in via Supabase Auth; each app
// then checks what this person may do there (lib/hub/access.ts).
export default function StaffLogin({ notice }: { notice?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(safeNext(new URLSearchParams(window.location.search).get("next")) ?? "/admin");
    router.refresh();
  }

  return (
    <main className="wrap" style={{ maxWidth: 420 }}>
      <p className="eyebrow">Pasatiempo</p>
      <h1>Staff sign in</h1>
      {notice && <p style={{ color: "#e8887b", marginTop: 16 }}>{notice}</p>}
      <form onSubmit={onSubmit} style={{ marginTop: 24 }}>
        <label style={{ display: "block", marginBottom: 12 }}>
          <div style={{ color: "var(--muted)", marginBottom: 6 }}>Email</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
        <label style={{ display: "block", marginBottom: 20 }}>
          <div style={{ color: "var(--muted)", marginBottom: 6 }}>Password</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
        {error && (
          <p style={{ color: "#e8887b", marginTop: 0 }}>{error}</p>
        )}
        <button type="submit" disabled={busy} style={buttonStyle}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p style={{ marginTop: 16 }}>
          <Link href="/forgot" style={{ color: "var(--muted)" }}>Forgot your password?</Link>
        </p>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--ink)",
  fontSize: 16,
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 10,
  border: "none",
  background: "var(--accent)",
  color: "#1a1205",
  fontWeight: 600,
  fontSize: 16,
  cursor: "pointer",
};
