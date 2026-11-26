"use client";

import { useState, useSyncExternalStore } from "react";
import { sendTestEmail, type EventInput } from "@/lib/events/actions";
import { sampleEmail } from "@/lib/events/registration-email";
import { WORDING_LIMITS, type EventTheme } from "@/lib/events/theme";
import type { EventRec } from "@/lib/events/types";

const noSubscribe = () => () => {};

// The editor's "Email" section: the confirmation email's own words, beside a
// preview of exactly what a member will receive (built by the same code that
// sends it, with a made-up member).
export default function EmailSection({
  preview,
  theme,
  onTheme,
  testInput,
}: {
  preview: EventRec; // the event as the editor has it now, unsaved changes included
  theme: EventTheme | null;
  onTheme: (t: EventTheme) => void;
  testInput?: () => EventInput; // the editor's form, for "Send me a test"; absent = no button
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function sendTest() {
    if (!testInput) return;
    setSending(true);
    setResult(null);
    try {
      const res = await sendTestEmail(testInput());
      setResult(
        res.ok
          ? { ok: true, text: `Sent to ${res.to}. It may take a minute to arrive.` }
          : { ok: false, text: res.error },
      );
    } catch {
      setResult({ ok: false, text: "The test email didn't send. Please try again." });
    } finally {
      setSending(false);
    }
  }
  const t: EventTheme = theme ?? { preset: "clubhouse" };
  // blank means "use the usual words"
  const set = (patch: Partial<EventTheme>) => onTheme({ ...t, ...patch });
  const words = (v: string) => (v.trim() ? v : undefined);
  const team = preview.type === "tournament";

  // the site's address for the sample link: known in the browser, blank on the server
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );
  const pageUrl = origin && preview.slug ? `${origin}/events/e/${preview.slug}` : null;

  const mail = sampleEmail(preview, pageUrl);
  const [view, setView] = useState<"designed" | "text">("designed");
  const title = preview.title.trim() || "Your event";

  return (
    <div className="email-edit">
      <div className="email-fields">
        <div className="field">
          <label htmlFor="em-subject">Subject</label>
          <input
            id="em-subject"
            value={t.emailSubject ?? ""}
            maxLength={WORDING_LIMITS.emailSubject}
            placeholder={team ? `${title}: your team entry` : `${title}: you're registered`}
            onChange={(e) => set({ emailSubject: words(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="em-intro">Opening line</label>
          <textarea
            id="em-intro"
            rows={2}
            value={t.emailIntro ?? ""}
            maxLength={WORDING_LIMITS.emailIntro}
            placeholder={team ? "Your team is confirmed." : `You're registered for ${title}.`}
            onChange={(e) => set({ emailIntro: words(e.target.value) })}
          />
        </div>
        <div className="field">
          <label htmlFor="em-thanks">Message</label>
          <textarea
            id="em-thanks"
            rows={3}
            value={t.thankYou ?? ""}
            maxLength={WORDING_LIMITS.thankYou}
            placeholder="Optional, e.g. Jackets suggested; the bar opens at 6."
            onChange={(e) => set({ thankYou: words(e.target.value) })}
          />
          <p className="hint">Also shown on the &ldquo;You&apos;re registered&rdquo; screen.</p>
        </div>
        <div className="field">
          <label htmlFor="em-signoff">Sign-off</label>
          <input
            id="em-signoff"
            value={t.emailSignOff ?? ""}
            maxLength={WORDING_LIMITS.emailSignOff}
            placeholder="Optional, e.g. — The Men's Club"
            onChange={(e) => set({ emailSignOff: words(e.target.value) })}
          />
        </div>
        <p className="hint">
          Leave a box blank for the usual words, shown in grey. The date, place,
          {team ? " team, " : " party, "}answers, change-or-cancel link and
          contact are filled in for each person. Waitlisted sign-ups get the
          standard waitlist email.
        </p>
      </div>

      <figure className="email-preview" aria-label="Preview of the confirmation email">
        <figcaption>Preview · what {team ? "the member" : "a member"} receives</figcaption>
        <div className="ep-mail">
          <div className="ep-mail-head">
            <div>
              <span>To</span>
              {mail.to}
            </div>
            <div>
              <span>Subject</span>
              <strong>{mail.subject}</strong>
            </div>
          </div>
          {view === "designed" ? (
            // the real email, as sent; sandboxed so nothing in it can run or navigate
            <iframe
              className="ep-mail-frame"
              title="Confirmation email preview"
              sandbox=""
              srcDoc={mail.html}
            />
          ) : (
            <div className="ep-mail-body">{mail.text}</div>
          )}
        </div>
        <div className="ep-mail-switch" role="group" aria-label="Preview as">
          {(["designed", "text"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              className={view === v ? "on" : ""}
              onClick={() => setView(v)}
            >
              {v === "designed" ? "Designed" : "Plain text"}
            </button>
          ))}
          <span className="hint">Email programs that don&apos;t show designs get the plain text.</span>
        </div>
        {testInput && (
          <div className="email-test">
            <button
              type="button"
              className="btn secondary small"
              onClick={sendTest}
              disabled={sending}
            >
              {sending ? "Sending…" : "Send me a test"}
            </button>
            <span className="hint">Only to you, as it reads now. Nothing is saved.</span>
          </div>
        )}
        {result && (
          <p className={result.ok ? "email-test-ok" : "field-err"} role="status">
            {result.text}
          </p>
        )}
      </figure>
    </div>
  );
}
