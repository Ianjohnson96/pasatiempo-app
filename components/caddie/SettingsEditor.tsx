"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCaddieSettings, type SettingsInput } from "@/lib/caddie/actions";

// The Caddie Program's rules, in the shop's words rather than the database's.
//
// Every line reads as a sentence — "caddies see jobs up to 14 days ahead" —
// because the person changing it is thinking about the yard, not about a key
// called horizon_days. Rates and the waterfall keep their own screens.

export interface TextingStatus {
  /** The Twilio keys are in the environment. */
  configured: boolean;
  fromNumber: string | null;
  /** What to paste into Twilio as the incoming-message webhook. */
  webhookUrl: string;
  /** The public terms page the carrier registration asks for. */
  termsUrl: string;
  optedIn: number;
  active: number;
}

export default function SettingsEditor({
  initial,
  alertRecipients,
  mailReady,
  texting,
}: {
  initial: SettingsInput;
  /** Who drop alerts already reach, from the access list. */
  alertRecipients: string[];
  /** Whether outgoing email is configured at all. */
  mailReady: boolean;
  texting: TextingStatus;
}) {
  const router = useRouter();
  const [s, setS] = useState<SettingsInput>(initial);
  const [saving, start] = useTransition();
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const set = <K extends keyof SettingsInput>(k: K, v: SettingsInput[K]) =>
    setS((p) => ({ ...p, [k]: v }));
  const setR = <K extends keyof SettingsInput["release"]>(k: K, v: SettingsInput["release"][K]) =>
    setS((p) => ({ ...p, release: { ...p.release, [k]: v } }));

  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  const r = s.release;

  return (
    <div style={{ display: "grid", gap: 18, marginTop: 14 }}>
      {note && <p className={note.kind === "ok" ? "notice ok" : "notice err"}>{note.text}</p>}

      <Section
        title="Fair share"
        help="The record of who has worked what and earned what, and who is next up. Switching it off hides the tab; the history underneath is kept, so switching it back on loses nothing."
      >
        <Toggle
          on={s.fairShareEnabled}
          onChange={(v) => set("fairShareEnabled", v)}
          label="Use Fair share"
          hint="Next-up first refusal below depends on it — with Fair share off there is no next-up, so first refusal is off too."
        />
      </Section>

      <Section
        title="When jobs open up"
        help="Applies to jobs posted to the job board. An offer you send a caddie directly, and Call all, always go out straight away."
      >
        <Toggle
          on={r.enabled}
          onChange={(v) => setR("enabled", v)}
          label="Hold new jobs until a set release time"
          hint="Everyone sees tomorrow's work at the same moment, instead of whoever happens to be watching their phone."
        />
        <Line dim={!r.enabled}>
          Release jobs
          <select
            value={r.daysBefore}
            disabled={!r.enabled}
            onChange={(e) => setR("daysBefore", Number(e.target.value))}
            style={input}
          >
            <option value={0}>the morning of</option>
            <option value={1}>the day before</option>
            <option value={2}>2 days before</option>
            <option value={3}>3 days before</option>
            <option value={7}>a week before</option>
          </select>
          at
          <input
            type="time"
            value={r.time}
            disabled={!r.enabled}
            onChange={(e) => setR("time", e.target.value)}
            style={{ ...input, width: 120 }}
          />
        </Line>

        <Line>
          Caddies see jobs up to
          <Num value={r.horizonDays} onChange={(v) => setR("horizonDays", v)} min={0} max={365} />
          days ahead
          <span className="muted" style={{ fontSize: 12 }}>
            (0 = no limit)
          </span>
        </Line>

        <Toggle
          on={r.priorityEnabled && s.fairShareEnabled}
          disabled={!s.fairShareEnabled}
          onChange={(v) => setR("priorityEnabled", v)}
          label="Next-up gets first refusal on jobs booked well ahead"
          hint={
            s.fairShareEnabled
              ? "Whoever is furthest behind on the Fair share list is offered the job alone first, with a notification. If they don't take it, it opens to everyone."
              : "Needs Fair share switched on — that list is how next-up is decided."
          }
        />
        <Line dim={!r.priorityEnabled || !s.fairShareEnabled}>
          For jobs at least
          <Num
            value={r.priorityMinLeadHours}
            disabled={!r.priorityEnabled}
            onChange={(v) => setR("priorityMinLeadHours", v)}
            min={1}
            max={336}
          />
          hours away, next-up has
          <Num
            value={r.priorityMinutes}
            disabled={!r.priorityEnabled}
            onChange={(v) => setR("priorityMinutes", v)}
            min={5}
            max={240}
          />
          minutes before it opens to everyone
        </Line>
      </Section>

      <Section
        title="Hand-backs"
        help="How a dropped loop is judged on the Jobs tab and in Fair share. Nothing here penalises a caddie automatically — it records, and you decide."
      >
        <Line>
          A hand-back is <strong>late</strong> inside
          <Num value={s.dropLateHours} onChange={(v) => set("dropLateHours", v)} min={1} max={336} />
          hours of the tee time, and <strong>same day</strong> inside
          <Num value={s.dropSameDayHours} onChange={(v) => set("dropSameDayHours", v)} min={1} max={48} />
          hours
        </Line>

        <Toggle
          on={s.claimLimit > 0}
          onChange={(v) => set("claimLimit", v ? 3 : 0)}
          label="Limit how many loops one caddie can hold from the job board"
          hint="Stops one caddie claiming everything and handing it back later. Offers you send are never counted. Off unless you need it."
        />
        <Line dim={s.claimLimit === 0}>
          At most
          <Num
            value={s.claimLimit}
            disabled={s.claimLimit === 0}
            onChange={(v) => set("claimLimit", Math.max(1, v))}
            min={1}
            max={20}
          />
          upcoming loops at once
        </Line>

        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 14 }}>
            When a caddie hands a loop back, the shop is emailed.
          </div>
          {!mailReady && (
            <p className="notice err" style={{ margin: "8px 0 0" }}>
              Email isn&apos;t set up for this app yet, so these alerts can&apos;t go out. It needs
              the SMTP settings in Vercel — the same mailbox the password reset emails use.
            </p>
          )}
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Always goes to the Caddie Program admins:{" "}
            {alertRecipients.length ? alertRecipients.join(", ") : "none set up yet"}.
          </div>
          <label style={{ display: "block", marginTop: 8, fontSize: 13 }}>
            Also send to (the shop inbox, the starter…)
            <textarea
              value={s.dropAlertEmails}
              onChange={(e) => set("dropAlertEmails", e.target.value)}
              rows={2}
              placeholder="proshop@pasatiempo.com"
              style={{ ...input, display: "block", width: "100%", marginTop: 4, fontFamily: "inherit" }}
            />
          </label>
        </div>
      </Section>

      <Section
        title="Texting"
        help="Texts go out alongside app alerts, only to caddies who switched texts on from their own phone. A caddie answers an offer by replying Y or N."
      >
        {!texting.configured ? (
          <p className="notice warn" style={{ margin: 0 }}>
            Not connected yet. Texting needs a Twilio number and three settings in Vercel:{" "}
            <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code> and{" "}
            <code>TWILIO_FROM_NUMBER</code>. Caddies can already sign up; nothing is sent until
            this is connected and switched on.
          </p>
        ) : (
          <p className="notice ok" style={{ margin: 0 }}>
            Connected to Twilio{texting.fromNumber ? ` — texts come from ${texting.fromNumber}` : ""}.
          </p>
        )}

        <div className="muted" style={{ fontSize: 13 }}>
          {texting.optedIn} of {texting.active} active caddies have switched texts on.
        </div>

        <Toggle
          on={s.smsEnabled}
          onChange={(v) => set("smsEnabled", v)}
          label="Send texts"
          hint={
            texting.configured
              ? "Leave this off until Twilio has approved the number for sending — texts sent before then are blocked by the carriers."
              : "Can be switched on now; nothing is sent until Twilio is connected."
          }
        />
        <div style={{ display: "grid", gap: 8, paddingLeft: 28, opacity: s.smsEnabled ? 1 : 0.5 }}>
          <Toggle
            on={s.sms.offers}
            disabled={!s.smsEnabled}
            onChange={(v) => set("sms", { ...s.sms, offers: v })}
            label="Offers"
            hint="An offer sent to a caddie by name, by tier, or as next-up. They can reply Y to take it."
          />
          <Toggle
            on={s.sms.reminders}
            disabled={!s.smsEnabled}
            onChange={(v) => set("sms", { ...s.sms, reminders: v })}
            label="Reminders"
            hint="The day-before reminder of a loop they've accepted."
          />
          <Toggle
            on={s.sms.board}
            disabled={!s.smsEnabled}
            onChange={(v) => set("sms", { ...s.sms, board: v })}
            label="Job board posts"
            hint="Every job posted to everyone, and Call all. Off is usually right: a text to the whole roster for every job is how people start replying STOP."
          />
        </div>

        <details style={{ fontSize: 13 }}>
          <summary style={{ cursor: "pointer" }}>For the Twilio setup</summary>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            <div>
              Incoming-message webhook (HTTP POST):
              <code style={{ display: "block", wordBreak: "break-all", marginTop: 2 }}>
                {texting.webhookUrl}
              </code>
            </div>
            <div>
              Terms and opt-in page for the registration:
              <code style={{ display: "block", wordBreak: "break-all", marginTop: 2 }}>
                {texting.termsUrl}
              </code>
            </div>
          </div>
        </details>
      </Section>

      <Section title="Offers">
        <Line>
          An offer to one caddie lasts
          <Num value={s.offerExpiryMinutes} onChange={(v) => set("offerExpiryMinutes", v)} min={5} max={1440} />
          minutes; a blast to many lasts
          <Num
            value={s.broadcastExpiryMinutes}
            onChange={(v) => set("broadcastExpiryMinutes", v)}
            min={5}
            max={1440}
          />
          minutes
        </Line>
        <Line>
          Don&apos;t book a caddie within
          <Num value={s.overlapGuardHours} onChange={(v) => set("overlapGuardHours", v)} min={1} max={12} />
          hours of another loop they&apos;re on
        </Line>
      </Section>

      <Section title="Reminders and closing out">
        <Line>
          Remind a caddie
          <Num value={s.reminderHoursBefore} onChange={(v) => set("reminderHoursBefore", v)} min={1} max={72} />
          hours before their loop
        </Line>
        <Line>
          Mark a loop as played
          <Num value={s.completeAfterHours} onChange={(v) => set("completeAfterHours", v)} min={1} max={48} />
          hours after its tee time
        </Line>
      </Section>

      <Section title="Sign-in">
        <Line>
          Sign-in links last
          <Num value={s.inviteDays} onChange={(v) => set("inviteDays", v)} min={1} max={60} />
          days; once in, a caddie stays signed in for
          <Num value={s.sessionDays} onChange={(v) => set("sessionDays", v)} min={7} max={365} />
          days
        </Line>
        <Line>
          Caddies plan their availability
          <Num value={s.availabilityMonths} onChange={(v) => set("availabilityMonths", v)} min={1} max={12} />
          months ahead
        </Line>
      </Section>

      <div style={{ display: "flex", gap: 10, alignItems: "center", position: "sticky", bottom: 12 }}>
        <button
          className="btn"
          disabled={saving || !dirty}
          onClick={() =>
            start(async () => {
              setNote(null);
              const res = await saveCaddieSettings(s);
              if (res.ok) {
                setNote({ kind: "ok", text: "Settings saved." });
                router.refresh();
              } else {
                setNote({ kind: "err", text: res.error });
              }
            })
          }
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {dirty && !saving && (
          <button className="btn ghost small" onClick={() => setS(initial)}>
            Discard changes
          </button>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  help,
  children,
}: {
  title: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <h3 className="section-title" style={{ marginTop: 0 }}>
        {title}
      </h3>
      {help && (
        <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          {help}
        </p>
      )}
      <div style={{ display: "grid", gap: 12, marginTop: 10 }}>{children}</div>
    </section>
  );
}

/** A setting written as a sentence, with its inputs inline. */
function Line({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
        fontSize: 15,
        opacity: dim ? 0.5 : 1,
      }}
    >
      {children}
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
  hint,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 4 }}
      />
      <span>
        <strong style={{ fontSize: 15 }}>{label}</strong>
        {hint && (
          <span className="muted" style={{ display: "block", fontSize: 13 }}>
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

function Num({
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ ...input, width: 78 }}
    />
  );
}

const input: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--ink)",
  fontSize: 15,
};
