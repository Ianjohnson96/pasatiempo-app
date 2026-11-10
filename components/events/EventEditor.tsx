"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { saveEvent } from "@/lib/events/actions";
import RichTextField from "@/components/events/RichTextField";
import QuestionBuilder from "@/components/events/QuestionBuilder";
import TypeTiles from "@/components/events/editor/TypeTiles";
import EditorSteps from "@/components/events/editor/EditorSteps";
import {
  PreviewOverlay,
  PreviewPanel,
} from "@/components/events/editor/EditorPreview";
import { formatSlot } from "@/lib/events/format";
import {
  buildEventInput,
  crossesTournamentBoundary,
  editorError,
  previewEvent,
  typeRules,
  type EditorState,
} from "@/lib/events/editor";
import type {
  CustomField,
  EventRec,
  EventType,
  RosterStyle,
  ScheduleMode,
  Slot,
} from "@/lib/events/types";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function tmpId() {
  return "tmp_" + Math.random().toString(36).slice(2, 10);
}
// mirror of lib/ids.slugify (can't import — that module pulls in node:crypto)
function slugPreview(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// true once hydrated: the preview formats dates in the browser's time zone, so
// it renders on the client only.
const noopSubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function SectionHead({
  n,
  title,
  sub,
}: {
  n: number;
  title: string;
  sub: string;
}) {
  return (
    <header className="editor-sec-head">
      <span className="editor-sec-num" aria-hidden>
        {n}
      </span>
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
    </header>
  );
}

export default function EventEditor({
  event,
  registrationCount = 0,
}: {
  event?: EventRec;
  // sign-ups already on the event; any at all lock the Tournament boundary
  registrationCount?: number;
}) {
  const router = useRouter();
  const editing = !!event;
  const hydrated = useHydrated();

  const [title, setTitle] = useState(event?.title ?? "");
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [type, setType] = useState<EventType>(event?.type ?? "dinner");
  const [description, setDescription] = useState(event?.description ?? "");
  const [info, setInfo] = useState(event?.info ?? "");
  const [location, setLocation] = useState(event?.location ?? "");

  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(
    event?.scheduleMode ?? (event?.type === "clinic" ? "slots" : "single"),
  );
  const [startsAt, setStartsAt] = useState(toLocalInput(event?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(event?.endsAt ?? null));
  const [allowMultiSlot, setAllowMultiSlot] = useState(
    event?.allowMultiSlot ?? false,
  );
  const [slotsPrompt, setSlotsPrompt] = useState(event?.slotsPrompt ?? "");
  const [slots, setSlots] = useState<Slot[]>(event?.slots ?? []);

  const [hasCapacity, setHasCapacity] = useState(event?.capacity != null);
  const [capacity, setCapacity] = useState(String(event?.capacity ?? 50));
  const [waitlistEnabled, setWaitlistEnabled] = useState(
    event?.waitlistEnabled ?? true,
  );
  const [hasRosterLimit, setHasRosterLimit] = useState(
    event?.rosterLimit != null,
  );
  const [rosterLimit, setRosterLimit] = useState(
    String(event?.rosterLimit ?? 20),
  );

  const [allowGuests, setAllowGuests] = useState(event?.allowGuests ?? true);
  const [maxGuests, setMaxGuests] = useState(String(event?.maxGuests ?? 3));
  const [collectGuestNames, setCollectGuestNames] = useState(
    event?.collectGuestNames ?? true,
  );

  const [inviteOnly, setInviteOnly] = useState(event?.inviteOnly ?? false);
  const [allowlistText, setAllowlistText] = useState(
    (event?.allowlist ?? []).join("\n"),
  );
  const [inviteOnlyMessage, setInviteOnlyMessage] = useState(
    event?.inviteOnlyMessage ?? "",
  );

  const [pricingEnabled, setPricingEnabled] = useState(
    event?.pricingEnabled ?? false,
  );
  const [pricing, setPricing] = useState(event?.pricing ?? "");

  const [fields, setFields] = useState<CustomField[]>(event?.customFields ?? []);

  const [showRoster, setShowRoster] = useState(event?.showRoster ?? false);
  const [rosterStyle, setRosterStyle] = useState<RosterStyle>(
    event?.rosterStyle ?? "first_initial",
  );

  const [managersText, setManagersText] = useState(
    (event?.managers ?? []).join("\n"),
  );

  const [status, setStatus] = useState(event?.status ?? "open");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const closePreview = useCallback(() => setPreviewOpen(false), []);

  // recurring generator state
  const [genDate, setGenDate] = useState("");
  const [genStart, setGenStart] = useState("18:00");
  const [genEnd, setGenEnd] = useState("");
  const [genWeeks, setGenWeeks] = useState("4");
  const [genCap, setGenCap] = useState("");

  const rules = typeRules(type);
  const isSlots = rules.slots && scheduleMode === "slots";

  const state: EditorState = {
    title,
    slug,
    type,
    description,
    info,
    location,
    scheduleMode,
    startsAt,
    endsAt,
    allowMultiSlot,
    slotsPrompt,
    slots,
    hasCapacity,
    capacity,
    waitlistEnabled,
    hasRosterLimit,
    rosterLimit,
    allowGuests,
    maxGuests,
    collectGuestNames,
    inviteOnly,
    allowlistText,
    inviteOnlyMessage,
    pricingEnabled,
    pricing,
    fields,
    showRoster,
    rosterStyle,
    managersText,
    status,
  };

  // The preview lags a keystroke behind under load rather than slowing typing.
  const deferred = useDeferredValue(state);
  const preview = useMemo(
    () => previewEvent(buildEventInput(deferred)),
    [deferred],
  );
  const publicHref = event ? `/events/e/${event.slug}` : null;

  // ---- slots ----
  function addSlot() {
    setSlots((s) => [
      ...s,
      { id: tmpId(), date: "", startTime: "", endTime: "", label: "", note: "", capacity: null },
    ]);
  }
  function updSlot(id: string, patch: Partial<Slot>) {
    setSlots((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function rmSlot(id: string) {
    setSlots((s) => s.filter((x) => x.id !== id));
  }
  function generateWeekly() {
    if (!genDate) {
      setError("Pick a start date for the recurring series.");
      return;
    }
    setError("");
    const [y, m, d] = genDate.split("-").map(Number);
    const base = new Date(y, m - 1, d);
    const weeks = Math.max(1, Math.min(52, parseInt(genWeeks, 10) || 1));
    const cap = genCap ? Math.max(1, parseInt(genCap, 10)) : null;
    const made: Slot[] = [];
    for (let i = 0; i < weeks; i++) {
      const dt = new Date(base);
      dt.setDate(base.getDate() + i * 7);
      made.push({
        id: tmpId(),
        date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
        startTime: genStart,
        endTime: genEnd,
        label: "",
        note: "",
        capacity: cap,
      });
    }
    setSlots((s) => [...s, ...made]);
    setAllowMultiSlot(true);
  }

  async function submit() {
    setError("");
    const problem = editorError(state);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    const input = buildEventInput(state, event?.id);
    try {
      const res = await saveEvent(input);
      if (!res.ok) {
        setError(res.error);
        setSaving(false);
        return;
      }
      router.push(`/admin/events/${res.event.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the event.");
      setSaving(false);
    }
  }

  // Teams and single registrants are stored differently, so once anyone has
  // signed up the type can't cross the Tournament line (the server checks too).
  const typeLocked = editing && registrationCount > 0;

  return (
    <div className="editor-shell">
      <EditorSteps />

      <div className="editor-main">
        {/* 1. Details */}
        <section id="details" className="card editor-section">
          <SectionHead
            n={1}
            title="Details"
            sub="What kind of event it is, and what members read first."
          />
          <div className="field">
            <label>Type</label>
            <TypeTiles
              value={type}
              onChange={setType}
              isDisabled={
                typeLocked && event
                  ? (t) => crossesTournamentBoundary(event.type, t)
                  : undefined
              }
              describedBy={typeLocked ? "type-lock-note" : undefined}
            />
            {typeLocked && (
              <div id="type-lock-note" className="hint" style={{ marginTop: 8 }}>
                Switching to or from Tournament isn&apos;t possible once people
                have signed up.
              </div>
            )}
          </div>
          <div className="field">
            <label>
              Title <span className="req">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                rules.tournament
                  ? "e.g. Member-Guest Invitational"
                  : "e.g. Member Twilight Dinner"
              }
            />
          </div>
          <div className="field">
            <label>Custom link {editing ? "" : "(optional)"}</label>
            <div className="hint">
              The web address people use to register. Letters, numbers and
              hyphens only.
            </div>
            <div
              className="sharebox"
              style={{ borderStyle: "solid", background: "#fff" }}
            >
              <span className="muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                …/events/e/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={editing ? "" : "auto-generated if left blank"}
                style={{ border: "none", boxShadow: "none", padding: "4px 6px" }}
              />
            </div>
            {slug.trim() && (
              <div className="hint" style={{ marginTop: 6 }}>
                Your link will be <strong>…/events/e/{slugPreview(slug)}</strong>
              </div>
            )}
          </div>
          <div className="field">
            <label>Description</label>
            <div className="hint">
              Shown at the top of the registration page. Menu, agenda, what to
              bring, etc.
            </div>
            <RichTextField
              value={description}
              onChange={setDescription}
              placeholder="Tell guests what to expect…"
            />
          </div>
          <div className="field">
            <label>What to know (optional)</label>
            <div className="hint">
              Shown as its own section on the page — what to bring, dress code,
              parking, arrival time, etc.
            </div>
            <RichTextField
              value={info}
              onChange={setInfo}
              placeholder="e.g. Arrive 15 minutes early. Soft spikes required. Balls provided."
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. The Hollins House"
            />
          </div>
        </section>

        {/* 2. Schedule */}
        <section id="schedule" className="card editor-section">
          <SectionHead
            n={2}
            title="Schedule"
            sub={
              rules.tournament
                ? "One date, and how many teams can enter."
                : "When it happens and how many people can come."
            }
          />
          {rules.scheduleSwitch && (
            <div className="seg" style={{ marginBottom: 16 }}>
              <label className={`segbtn ${scheduleMode === "single" ? "on" : ""}`}>
                <input
                  type="radio"
                  name="smode"
                  checked={scheduleMode === "single"}
                  onChange={() => setScheduleMode("single")}
                />
                One date / time
              </label>
              <label className={`segbtn ${scheduleMode === "slots" ? "on" : ""}`}>
                <input
                  type="radio"
                  name="smode"
                  checked={scheduleMode === "slots"}
                  onChange={() => setScheduleMode("slots")}
                />
                Multiple dates / time slots
              </label>
            </div>
          )}

          {!isSlots ? (
            <>
              <div className="row">
                <div className="field">
                  <label>Starts</label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Ends (optional)</label>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </div>
              </div>
              <label className="check" style={{ marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={hasCapacity}
                  onChange={(e) => setHasCapacity(e.target.checked)}
                />
                <span>
                  <span className="ck-label">{rules.capacityToggle}</span>
                  <br />
                  <span className="ck-hint">{rules.capacityHint}</span>
                </span>
              </label>
              {hasCapacity && (
                <div className="row" style={{ marginBottom: 12 }}>
                  <div className="field" style={{ marginBottom: 0, maxWidth: 200 }}>
                    <label htmlFor="ev-capacity">{rules.capacityLabel}</label>
                    <input
                      id="ev-capacity"
                      type="number"
                      min={1}
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="hint" style={{ marginTop: -4 }}>
                Each slot has its own date, time and capacity — the SignUpGenius
                style. Use the generator for a recurring series, or add slots one
                at a time.
              </p>

              <div className="field">
                <label>Instruction above the dates (optional)</label>
                <div className="hint">
                  Shown to registrants right above the date picker.
                </div>
                <input
                  type="text"
                  value={slotsPrompt}
                  onChange={(e) => setSlotsPrompt(e.target.value)}
                  placeholder="e.g. Please choose all the dates you can attend"
                />
              </div>

              {/* recurring generator */}
              <div className="editor-generator">
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  ↻ Generate a recurring weekly series
                </div>
                <div className="builder-row">
                  <input
                    type="date"
                    value={genDate}
                    onChange={(e) => setGenDate(e.target.value)}
                    title="First date"
                  />
                  <input
                    type="time"
                    value={genStart}
                    onChange={(e) => setGenStart(e.target.value)}
                    title="Start time"
                  />
                  <input
                    type="time"
                    value={genEnd}
                    onChange={(e) => setGenEnd(e.target.value)}
                    title="End time (optional)"
                  />
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={genWeeks}
                    onChange={(e) => setGenWeeks(e.target.value)}
                    placeholder="# weeks"
                    style={{ maxWidth: 90 }}
                    title="Number of weeks"
                  />
                  <input
                    type="number"
                    min={1}
                    value={genCap}
                    onChange={(e) => setGenCap(e.target.value)}
                    placeholder="Spots ea."
                    style={{ maxWidth: 100 }}
                    title="Capacity per date"
                  />
                  <button
                    type="button"
                    className="btn small"
                    onClick={generateWeekly}
                  >
                    Generate
                  </button>
                </div>
              </div>

              {slots.map((s) => (
                <div key={s.id} className="editor-slot">
                  <div className="builder-row" style={{ marginBottom: 6 }}>
                    <input
                      type="date"
                      value={s.date ?? ""}
                      onChange={(e) => updSlot(s.id, { date: e.target.value })}
                      title="Date"
                    />
                    <input
                      type="time"
                      value={s.startTime}
                      onChange={(e) => updSlot(s.id, { startTime: e.target.value })}
                      title="Start"
                    />
                    <input
                      type="time"
                      value={s.endTime}
                      onChange={(e) => updSlot(s.id, { endTime: e.target.value })}
                      title="End"
                    />
                    <input
                      type="text"
                      value={s.label}
                      onChange={(e) => updSlot(s.id, { label: e.target.value })}
                      placeholder="Label (optional)"
                      style={{ flex: 2 }}
                    />
                    <input
                      type="number"
                      min={1}
                      value={s.capacity ?? ""}
                      onChange={(e) =>
                        updSlot(s.id, {
                          capacity: e.target.value
                            ? Math.max(1, parseInt(e.target.value, 10))
                            : null,
                        })
                      }
                      placeholder="Spots"
                      style={{ maxWidth: 90 }}
                    />
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={() => rmSlot(s.id)}
                      aria-label="Remove slot"
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    type="text"
                    value={s.note ?? ""}
                    maxLength={80}
                    onChange={(e) => updSlot(s.id, { note: e.target.value })}
                    placeholder="Short note — what we're doing this session (e.g. Chipping & bunkers)"
                  />
                  <div className="hint" style={{ marginTop: 4 }}>
                    {(s.note ?? "").length}/80 — shown in the middle of the schedule
                  </div>
                </div>
              ))}
              <button type="button" className="btn secondary small" onClick={addSlot}>
                + Add a slot
              </button>
              {slots.length > 0 && (
                <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>
                  {slots.map((s) => formatSlot(s)).slice(0, 3).join("  •  ")}
                  {slots.length > 3 ? `  • +${slots.length - 3} more` : ""}
                </p>
              )}

              <div className="divider" />
              <label className="check" style={{ marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={allowMultiSlot}
                  onChange={(e) => setAllowMultiSlot(e.target.checked)}
                />
                <span>
                  <span className="ck-label">
                    Let people sign up for more than one
                  </span>
                  <br />
                  <span className="ck-hint">
                    On for a recurring series (pick the dates you&apos;ll attend);
                    off to choose exactly one.
                  </span>
                </span>
              </label>
            </>
          )}

          {rules.rosterCap && (
            <>
              <label className="check" style={{ marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={hasRosterLimit}
                  onChange={(e) => setHasRosterLimit(e.target.checked)}
                />
                <span>
                  <span className="ck-label">Cap the total program roster</span>
                  <br />
                  <span className="ck-hint">
                    Limits how many <strong>different people</strong> can enroll
                    across the whole event. Someone who signs up counts once no
                    matter how many dates they pick, and can still add more dates
                    after the cap is hit — but new people are turned away when
                    it&apos;s full. Separate from the per-date spots above.
                  </span>
                </span>
              </label>
              {hasRosterLimit && (
                <div className="row" style={{ marginBottom: 12 }}>
                  <div className="field" style={{ marginBottom: 0, maxWidth: 200 }}>
                    <label>Max people on roster</label>
                    <input
                      type="number"
                      min={1}
                      value={rosterLimit}
                      onChange={(e) => setRosterLimit(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <label className="check">
            <input
              type="checkbox"
              checked={waitlistEnabled}
              onChange={(e) => setWaitlistEnabled(e.target.checked)}
            />
            <span>
              <span className="ck-label">Enable waitlist when full</span>
              <br />
              <span className="ck-hint">
                {rules.tournament
                  ? "Extra teams are collected as a waitlist instead of being turned away."
                  : "Extra sign-ups are collected as a waitlist instead of being turned away."}
              </span>
            </span>
          </label>
        </section>

        {/* 3. Players & Questions */}
        <section id="questions" className="card editor-section">
          <SectionHead
            n={3}
            title="Players & Questions"
            sub={
              rules.tournament
                ? "Every entry is a Member + Guest team. Add anything else you need to ask."
                : "Guests, and anything else you want to ask."
            }
          />
          {rules.guests && (
            <div className="editor-block">
              <h3 className="editor-sub">Guests</h3>
              <label className="check" style={{ marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={allowGuests}
                  onChange={(e) => setAllowGuests(e.target.checked)}
                />
                <span>
                  <span className="ck-label">Allow registrants to bring guests</span>
                  <br />
                  <span className="ck-hint">
                    Each guest counts toward the capacity.
                  </span>
                </span>
              </label>
              {allowGuests && (
                <>
                  <div className="row" style={{ marginBottom: 12 }}>
                    <div className="field" style={{ marginBottom: 0, maxWidth: 260 }}>
                      <label>Max additional guests per registration</label>
                      <input
                        type="number"
                        min={1}
                        value={maxGuests}
                        onChange={(e) => setMaxGuests(e.target.value)}
                      />
                    </div>
                  </div>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={collectGuestNames}
                      onChange={(e) => setCollectGuestNames(e.target.checked)}
                    />
                    <span className="ck-label">Ask for each guest&apos;s name</span>
                  </label>
                </>
              )}
            </div>
          )}
          <div className="editor-block">
            <h3 className="editor-sub">Questions</h3>
            <p className="hint" style={{ marginTop: -4 }}>
              {rules.tournament
                ? "Shirt size, dietary notes, cart preference — ask each player, or the team once."
                : "Meal choice, dietary notes, skill level — anything else you want to ask."}
            </p>
            <QuestionBuilder
              fields={fields}
              onChange={setFields}
              tournament={rules.tournament}
            />
          </div>
        </section>

        {/* 4. Pricing */}
        <section id="pricing" className="card editor-section">
          <SectionHead
            n={4}
            title="Pricing"
            sub="An optional price list on the event page. Sign-ups stay free."
          />
          <label className="check" style={{ marginBottom: pricingEnabled ? 12 : 0 }}>
            <input
              type="checkbox"
              checked={pricingEnabled}
              onChange={(e) => setPricingEnabled(e.target.checked)}
            />
            <span>
              <span className="ck-label">Show a pricing section</span>
              <br />
              <span className="ck-hint">
                Displays a Pricing block on the event page. (Sign-ups stay free —
                this is for display only.)
              </span>
            </span>
          </label>
          {pricingEnabled && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Pricing details</label>
              <div className="hint">
                One item per line, e.g. &quot;Members — $40&quot; / &quot;Guests —
                $55&quot;. Add any notes about how to pay.
              </div>
              <textarea
                value={pricing}
                onChange={(e) => setPricing(e.target.value)}
                placeholder={"Members — $40\nGuests — $55\nBilled to your member account"}
              />
            </div>
          )}
        </section>

        {/* 5. Roster */}
        <section id="roster" className="card editor-section">
          <SectionHead
            n={5}
            title="Roster"
            sub="Whether members can see who's coming."
          />
          <label className="check" style={{ marginBottom: showRoster ? 12 : 0 }}>
            <input
              type="checkbox"
              checked={showRoster}
              onChange={(e) => setShowRoster(e.target.checked)}
            />
            <span>
              <span className="ck-label">Show the roster on the public page</span>
              <br />
              <span className="ck-hint">
                Let registrants see who else has signed up. Off keeps it private
                (only you see it).
              </span>
            </span>
          </label>
          {showRoster && (
            <div className="field" style={{ marginBottom: 0, maxWidth: 320 }}>
              <label>How names appear</label>
              <select
                value={rosterStyle}
                onChange={(e) => setRosterStyle(e.target.value as RosterStyle)}
              >
                <option value="first_initial">First name + last initial</option>
                <option value="first_last">Full name</option>
                <option value="count_only">Just a count (no names)</option>
              </select>
            </div>
          )}
        </section>

        {/* 6. Access */}
        <section id="access" className="card editor-section">
          <SectionHead n={6} title="Access" sub="Who is allowed to register." />
          <label className="check" style={{ marginBottom: inviteOnly ? 12 : 0 }}>
            <input
              type="checkbox"
              checked={inviteOnly}
              onChange={(e) => setInviteOnly(e.target.checked)}
            />
            <span>
              <span className="ck-label">Invite-only (email allowlist)</span>
              <br />
              <span className="ck-hint">
                Only the email addresses you list can register, even if the link
                is forwarded.
              </span>
            </span>
          </label>
          {inviteOnly && (
            <>
              <div className="field">
                <label>Allowed emails</label>
                <div className="hint">One per line (or comma-separated).</div>
                <textarea
                  value={allowlistText}
                  onChange={(e) => setAllowlistText(e.target.value)}
                  placeholder={"jane@example.com\njohn@example.com"}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Message when someone isn&apos;t on the list (optional)</label>
                <div className="hint">
                  Shown to anyone who tries to register with an email that
                  isn&apos;t on your list. Leave blank for the default.
                </div>
                <textarea
                  value={inviteOnlyMessage}
                  onChange={(e) => setInviteOnlyMessage(e.target.value)}
                  placeholder="e.g. This event is for Men's Club members only. Questions? Call the pro shop at (831) 459-9155."
                />
              </div>
            </>
          )}
        </section>

        {/* 7. Publish */}
        <section id="publish" className="card editor-section">
          <SectionHead
            n={7}
            title="Publish"
            sub="Whether sign-ups are open, and who else can manage the event."
          />
          <div className="field" style={{ maxWidth: 360 }}>
            <label htmlFor="ev-status">Status</label>
            <select
              id="ev-status"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "draft" | "open" | "closed")
              }
            >
              <option value="open">Open — accepting sign-ups</option>
              <option value="draft">Draft — link works only for you</option>
              <option value="closed">Closed — no new sign-ups</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Co-managers</label>
            <div className="hint">
              One email per line. They&apos;ll be able to manage this event once
              logins are turned on (after deploy).
            </div>
            <textarea
              value={managersText}
              onChange={(e) => setManagersText(e.target.value)}
              placeholder={"colleague@pasatiempo.com"}
            />
          </div>
        </section>

        {/* the one save */}
        <div className="editor-savebar">
          {error && (
            <div className="notice err" role="alert">
              {error}
            </div>
          )}
          <div className="editor-savebar-row">
            <span className="editor-savebar-note">
              All sections save together.
            </span>
            <button
              type="button"
              className="btn secondary editor-preview-btn"
              onClick={() => setPreviewOpen(true)}
            >
              Preview
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => router.back()}
              disabled={saving}
            >
              Cancel
            </button>
            <button className="btn" onClick={submit} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create event"}
            </button>
          </div>
        </div>
      </div>

      {hydrated && <PreviewPanel event={preview} publicHref={publicHref} />}
      {hydrated && previewOpen && (
        <PreviewOverlay
          event={preview}
          publicHref={publicHref}
          onClose={closePreview}
        />
      )}
    </div>
  );
}
