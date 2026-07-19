import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pasatiempo Golf Club — Events & Tournaments",
};

// Public hub landing for the umbrella's root. Each section also has (or will
// have) its own domain; this is the friendly front door for the bare URL.
export default function Home() {
  const cardStyle: React.CSSProperties = {
    display: "block",
    textDecoration: "none",
    color: "inherit",
  };
  return (
    <main className="container narrow" style={{ paddingTop: 56 }}>
      <p className="eyebrow">Pasatiempo Golf Club</p>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Events &amp; Tournaments</h1>
      <p className="lead">Where would you like to go?</p>

      <div style={{ display: "grid", gap: 16 }}>
        <Link href="/events" className="card" style={cardStyle}>
          <div className="ev-title" style={{ fontSize: 19 }}>
            Event Planner →
          </div>
          <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
            Sign up for club events and clinics. Open the private link you were
            sent to register.
          </p>
        </Link>

        <Link href="/mhi" className="card" style={cardStyle}>
          <div className="ev-title" style={{ fontSize: 19 }}>
            Marion Hollins Invitational →
          </div>
          <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
            Tournament information — schedule, flights, formats, the Horse Race,
            and contests.
          </p>
        </Link>

        <a href="/sombrero" className="card" style={cardStyle}>
          <div className="ev-title" style={{ fontSize: 19 }}>
            El Sombrero →
          </div>
          <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
            Men&apos;s Club event information — schedule, format, and details.
          </p>
        </a>
      </div>

      <p style={{ marginTop: 28, fontSize: 13 }}>
        <Link href="/admin" style={{ color: "var(--muted)" }}>
          Staff sign in →
        </Link>
      </p>
    </main>
  );
}
