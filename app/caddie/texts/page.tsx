import "@/app/globals.css";
import type { Metadata } from "next";
import { SMS_CONSENT_TEXT } from "@/lib/caddie/types";

// The public description of the caddie text programme.
//
// Public on purpose (see isCaddiePublicPath in proxy.ts): the carriers review
// a texting programme by reading its terms and seeing how people opt in, and
// the opt-in itself sits behind a caddie's sign-in where a reviewer cannot
// reach it. So the wording a caddie agrees to is reproduced here verbatim.

export const metadata: Metadata = {
  title: "Caddie Text Messages — Pasatiempo",
};

export default function CaddieTextTermsPage() {
  return (
    <main className="container narrow" style={{ maxWidth: 640, paddingTop: 40, paddingBottom: 56 }}>
      <p className="eyebrow">Pasatiempo Golf Club</p>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Caddie text messages</h1>
      <p className="lead">
        Pasatiempo Golf Club texts the independent caddies on its roster about caddie work: job
        offers, and reminders of loops they have accepted.
      </p>

      <h2 className="section-title">Who gets texts</h2>
      <p>
        Only caddies on the Pasatiempo roster who switch texts on themselves, in the caddie portal,
        after signing in with the link the Pro Shop gives them. Nobody is signed up by the club on
        their behalf, and agreeing to texts is not a condition of working.
      </p>

      <h2 className="section-title">How to sign up</h2>
      <p>
        In the caddie portal, a caddie opens <strong>Preferences</strong>, enters their mobile
        number, ticks a box next to the following statement, and taps{" "}
        <strong>Text me job offers</strong>:
      </p>
      <blockquote
        style={{
          margin: "10px 0",
          padding: "10px 14px",
          borderLeft: "3px solid var(--accent)",
          background: "var(--panel)",
          fontSize: 14,
        }}
      >
        {SMS_CONSENT_TEXT}
      </blockquote>
      <p>A confirmation text is sent straight away.</p>

      {/* A faithful, inert copy of the sign-up form. The real one needs a
          caddie's sign-in, and the carrier's reviewer needs to see it. */}
      <p className="muted" style={{ fontSize: 13, marginTop: 18, marginBottom: 6 }}>
        This is the sign-up form as caddies see it on their phone:
      </p>
      <div
        className="card"
        aria-label="Example of the caddie text sign-up form"
        style={{ maxWidth: 420, pointerEvents: "none" }}
      >
        <div className="section-title" style={{ marginTop: 0 }}>
          Text messages
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Get job offers and reminders by text, and answer an offer by replying Y or N — no need
          to open the app.
        </p>
        <div style={{ fontSize: 14, marginTop: 10 }}>Mobile number</div>
        <input
          disabled
          value="(831) 555-0123"
          readOnly
          style={{
            display: "block",
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--line)",
            background: "var(--panel)",
            color: "var(--ink)",
            fontSize: 16,
          }}
        />
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 12 }}>
          <input type="checkbox" disabled style={{ width: 22, height: 22, flex: "0 0 auto", marginTop: 2 }} />
          <span style={{ fontSize: 13, lineHeight: 1.5 }}>{SMS_CONSENT_TEXT}</span>
        </div>
        <div style={{ fontSize: 12, marginTop: 6, textDecoration: "underline" }}>
          Texting terms and privacy
        </div>
        <div
          className="btn"
          style={{ display: "block", textAlign: "center", marginTop: 12, opacity: 0.6 }}
        >
          Text me job offers
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
          The box starts unticked, and the button does nothing until it is ticked.
        </p>
      </div>

      <h2 className="section-title">What we send</h2>
      <ul>
        <li>A job offer: the date, tee time, party name and type of loop.</li>
        <li>A reminder the day before a loop the caddie has accepted.</li>
        <li>Replies to the caddie&apos;s own texts, such as confirming a loop they took.</li>
      </ul>
      <p>
        Message frequency varies with the tee sheet — usually a few a week, more in the busy
        season. Message and data rates may apply. No marketing messages are sent.
      </p>

      <h2 className="section-title">Replying</h2>
      <ul>
        <li>
          <strong>Y</strong> takes the job offered, <strong>N</strong> passes on it.
        </li>
        <li>
          <strong>STOP</strong> stops all texts at once. <strong>START</strong> turns them back on.
        </li>
        <li>
          <strong>HELP</strong> for help, or contact the Pasatiempo Golf Club Pro Shop.
        </li>
      </ul>

      <h2 className="section-title">Privacy</h2>
      <p>
        Mobile numbers and texting consent are used only to send the messages described here. They
        are not shared with or sold to third parties or affiliates for marketing purposes. Texts are
        delivered through our messaging provider, Twilio, which handles them only to deliver them.
      </p>
    </main>
  );
}
