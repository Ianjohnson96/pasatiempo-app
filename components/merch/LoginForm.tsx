"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Sign in to the merchandise program with the email and password the owner set
// up on the People & data page.
export default function LoginForm({ denied }: { denied: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    denied ? "This account doesn't have access to the Merchandise Program. Ask the owner to add you." : null,
  );
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setError(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
      return;
    }
    const base = window.location.pathname.startsWith("/merch") ? "/merch" : "";
    window.location.assign(base || "/");
  }

  return (
    <main className="m-narrow">
      <p className="m-kicker">Pasatiempo Pro Shop</p>
      <h1>Merchandise Program</h1>
      <p className="m-sub">Sign in with the email and password the shop set up for you.</p>
      <form className="m-card" onSubmit={onSubmit}>
        {error && <p className="m-error">{error}</p>}
        <label className="m-field">
          <span>Email</span>
          <input className="m-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="m-field">
          <span>Password</span>
          <input className="m-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="m-btn primary block" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="m-note" style={{ marginBottom: 0 }}>Forgot your password? Ask the owner to set a new one.</p>
      </form>
    </main>
  );
}
