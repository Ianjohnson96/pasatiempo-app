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
