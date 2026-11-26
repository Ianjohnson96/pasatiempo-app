"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import EmailSection from "@/components/events/editor/EmailSection";
import { saveEmailWording } from "@/lib/events/actions";
import { EMAIL_WORD_KEYS, type EmailWords, type EventTheme } from "@/lib/events/theme";
import type { EventRec } from "@/lib/events/types";

const wordsOf = (t: EventTheme | null): EmailWords =>
  Object.fromEntries(EMAIL_WORD_KEYS.map((k) => [k, t?.[k] ?? ""]));

// The confirmation email on the Manage page: the same boxes and live
// preview as the editor's Email section, saved on their own.
export default function EmailCard({ event }: { event: EventRec }) {
  const router = useRouter();
  const [theme, setTheme] = useState<EventTheme | null>(event.theme);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const saved = JSON.stringify(wordsOf(event.theme));
  const dirty = JSON.stringify(wordsOf(theme)) !== saved;

  async function save() {
    setSaving(true);
    setNote(null);
    try {
      const res = await saveEmailWording(event.id, wordsOf(theme));
      if (res.ok) {
        setNote({ ok: true, text: "Saved. New sign-ups get this email." });
        router.refresh();
      } else setNote({ ok: false, text: res.error });
    } catch {
      setNote({ ok: false, text: "Could not save the email. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card email-card" aria-labelledby="email-card-title">
      <div className="email-card-head">
        <div>
          <h3 id="email-card-title" className="reg-title">
            Confirmation email
          </h3>
          <p className="hint" style={{ margin: "4px 0 0" }}>
            What members receive when they sign up. Edit it here before anyone does.
          </p>
        </div>
      </div>

      <EmailSection
        preview={{ ...event, theme }}
        theme={theme}
        onTheme={(t) => {
          setTheme(t);
          setNote(null);
        }}
      />

      <div className="email-card-actions">
        <button type="button" className="btn" onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save email"}
        </button>
        {dirty && !saving && (
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              setTheme(event.theme);
              setNote(null);
            }}
          >
            Undo changes
          </button>
        )}
        {note && (
          <span className={note.ok ? "email-test-ok" : "field-err"} role="status">
            {note.text}
          </span>
        )}
        {!note && dirty && <span className="hint">Unsaved changes</span>}
      </div>
    </section>
  );
}
