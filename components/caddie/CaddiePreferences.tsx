"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveMyPreferences, setMyTexts } from "@/lib/caddie/actions";
import {
  LOOP_TYPES,
  SMS_CONSENT_TEXT,
  type JobPrefs,
  type LoopType,
} from "@/lib/caddie/types";

// What a caddie would rather not be offered, and whether they want texts.
//
// Phrased as "happy to take", all ticked, because nearly everyone takes
// anything: the caddie only has to untick the exception. Nothing here stops an
// offer reaching them — it moves them down the shop's list for that kind of
// loop, and the page says so, so nobody thinks they have opted out of work.

const WHAT_IT_IS: Record<LoopType, string> = {
  "Single Bag": "One player, one bag.",
  "Double Bag": "Two bags, one on each shoulder.",
  "Forecaddie 1-2": "Walking ahead for one or two players; no bags.",
  "Forecaddie 3-4": "Walking ahead for a three- or foursome.",
};

export default function CaddiePreferences({
  prefs,
  phone,
  textsOn,
  textsLive,
}: {
  prefs: JobPrefs;
  phone: string | null;
  textsOn: boolean;
  /** The shop has texting switched on and connected. */
  textsLive: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [avoid, setAvoid] = useState<LoopType[]>(prefs.avoid);
  const [note, setNoteText] = useState(prefs.note);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [number, setNumber] = useState(phone ? formatPhone(phone) : "");
  const [agreed, setAgreed] = useState(false);

  const dirty =
    note.trim() !== prefs.note ||
    avoid.length !== prefs.avoid.length ||
    avoid.some((t) => !prefs.avoid.includes(t));

  const toggle = (t: LoopType) =>
    setAvoid((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));

  return (
    <main className="container narrow" style={{ maxWidth: 520, paddingTop: 24, paddingBottom: 48 }}>
      <Link href="/caddie" className="muted" style={{ fontSize: 14 }}>
        ← Back
      </Link>
      <h1 style={{ fontSize: 24, margin: "10px 0 4px" }}>Your preferences</h1>

      {msg && (
        <p className={msg.kind === "ok" ? "notice ok" : "notice err"} style={{ marginTop: 12 }}>
          {msg.text}
        </p>
      )}

      {/* ---- Jobs ---------------------------------------------------------- */}
      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>
          Jobs you&apos;re happy to take
        </h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Untick anything you&apos;d rather not do. You&apos;ll still see those jobs, and the shop
          can still ask you — you just won&apos;t be first in line for them.
        </p>

        <div style={{ display: "grid", gap: 4, marginTop: 10 }}>
          {LOOP_TYPES.map((t) => {
            const happy = !avoid.includes(t);
            return (
              <label
                key={t}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 4px",
                  borderBottom: "1px solid var(--line)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={happy}
                  onChange={() => toggle(t)}
                  style={{ width: 22, height: 22, flex: "0 0 auto" }}
                />
                <span>
                  <strong style={{ fontSize: 16 }}>{t}</strong>
                  <span className="muted" style={{ display: "block", fontSize: 13 }}>
                    {WHAT_IT_IS[t]}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <label style={{ display: "block", marginTop: 14, fontSize: 14 }}>
          Anything else the shop should know
          <textarea
            value={note}
            onChange={(e) => setNoteText(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="e.g. mornings only on weekdays"
            style={{ ...input, display: "block", width: "100%", marginTop: 6, fontFamily: "inherit" }}
          />
        </label>

        <button
          className="btn"
          style={{ width: "100%", marginTop: 14 }}
          disabled={busy || !dirty}
          onClick={() =>
            start(async () => {
              setMsg(null);
              const res = await saveMyPreferences({ avoid, note });
              if (res.ok) {
                setMsg({ kind: "ok", text: "Saved. The shop can see your preferences." });
                router.refresh();
              } else {
                setMsg({ kind: "err", text: res.error });
              }
            })
          }
        >
          {busy ? "Saving…" : "Save preferences"}
        </button>
      </section>

      {/* ---- Texts --------------------------------------------------------- */}
      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>
          Text messages
        </h2>

        {textsOn ? (
          <>
            <p style={{ fontSize: 15, marginTop: 6 }}>
              Texts are on{phone ? ` to ${formatPhone(phone)}` : ""}. Reply <strong>Y</strong> to an
              offer to take it or <strong>N</strong> to pass.
            </p>
            {!textsLive && (
              <p className="muted" style={{ fontSize: 13 }}>
                The Pro Shop hasn&apos;t started sending texts yet. They&apos;ll begin once it does.
              </p>
            )}
            <button
              className="btn secondary"
              style={{ width: "100%", marginTop: 10 }}
              disabled={busy}
              onClick={() =>
                start(async () => {
                  setMsg(null);
                  const res = await setMyTexts({ on: false, phone: "", agreed: false });
                  if (res.ok) {
                    setMsg({ kind: "ok", text: "Texts are off. You'll still get app alerts." });
                    router.refresh();
                  } else {
                    setMsg({ kind: "err", text: res.error });
                  }
                })
              }
            >
              Turn texts off
            </button>
          </>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Get job offers and reminders by text, and answer an offer by replying Y or N — no
              need to open the app.
              {!textsLive && " The Pro Shop hasn't started sending texts yet; you can sign up now."}
            </p>

            <label style={{ display: "block", marginTop: 10, fontSize: 14 }}>
              Mobile number
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="831 459 9155"
                style={{ ...input, display: "block", width: "100%", marginTop: 6 }}
              />
            </label>

            <label
              style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 12, cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ width: 22, height: 22, flex: "0 0 auto", marginTop: 2 }}
              />
              <span style={{ fontSize: 13, lineHeight: 1.5 }}>{SMS_CONSENT_TEXT}</span>
            </label>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              <Link href="/caddie/texts">Texting terms and privacy</Link>
            </div>

            <button
              className="btn"
              style={{ width: "100%", marginTop: 12 }}
              disabled={busy || !agreed || !number.trim()}
              onClick={() =>
                start(async () => {
                  setMsg(null);
                  const res = await setMyTexts({ on: true, phone: number, agreed });
                  if (res.ok) {
                    setMsg({
                      kind: "ok",
                      text: res.value.confirmed
                        ? "You're signed up. We've sent you a text to confirm."
                        : "You're signed up. Texts will start once the Pro Shop switches them on.",
                    });
                    setAgreed(false);
                    router.refresh();
                  } else {
                    setMsg({ kind: "err", text: res.error });
                  }
                })
              }
            >
              Text me job offers
            </button>
          </>
        )}
      </section>
    </main>
  );
}

function formatPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--ink)",
  fontSize: 16,
};
