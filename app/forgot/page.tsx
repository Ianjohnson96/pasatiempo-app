"use client";

import "@/app/globals.css";
import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/hub/password";

// Staff password reset: request an email with a link to set a new password.
export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await requestPasswordReset(email);
    setBusy(false);
    setSent(true);
  }

  return (
    <main className="wrap" style={{ maxWidth: 420 }}>
      <p className="eyebrow">Pasatiempo</p>
      <h1>Reset your password</h1>
      {sent ? (
        <>
          <p className="lead">If {email} has a Pasatiempo staff sign-in, a reset link is on its way. It works once and expires after an hour.</p>
          <p style={{ color: "var(--muted)" }}>Nothing arrived after a few minutes? Check spam, or ask the person who runs your app to set a new password for you.</p>
          <p><Link href="/login">Back to sign in</Link></p>
        </>
      ) : (
        <form onSubmit={onSubmit} style={{ marginTop: 24 }}>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>Enter the email you sign in with. We&apos;ll send a link to set a new password.</p>
          <label style={{ display: "block", marginBottom: 20 }}>
            <div style={{ color: "var(--muted)", marginBottom: 6 }}>Email</div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
          </label>
          <button type="submit" disabled={busy} style={buttonStyle}>
            {busy ? "Sending…" : "Email me a reset link"}
          </button>
          <p style={{ marginTop: 16 }}><Link href="/login">Back to sign in</Link></p>
        </form>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--ink)", fontSize: 16 };
const buttonStyle: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#1a1205", fontWeight: 600, fontSize: 16, cursor: "pointer" };
