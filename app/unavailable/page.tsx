import "../globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Not available — Pasatiempo Golf Club",
  robots: { index: false, follow: false },
};

// Shown in place of a public site the super admin has switched off
// (hub.sites; the proxy rewrites to this page).
export default function Unavailable() {
  return (
    <main className="container narrow" style={{ paddingTop: 72 }}>
      <p className="eyebrow">Pasatiempo Golf Club</p>
      <h1 style={{ fontSize: 30, marginBottom: 8 }}>This page isn&apos;t available right now</h1>
      <p className="lead">Please check back soon, or contact the golf shop for details.</p>
    </main>
  );
}
