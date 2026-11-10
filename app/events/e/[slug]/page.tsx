import Link from "next/link";
import { notFound } from "next/navigation";
import Gallery from "@/components/events/Gallery";
import Icon from "@/components/events/Icon";
import ManageRegistration from "@/components/events/ManageRegistration";
import PublicTeamRoster from "@/components/events/PublicTeamRoster";
import RichText from "@/components/events/RichText";
import RegistrationForm, {
  type SeatInfo,
} from "@/components/events/RegistrationForm";
import {
  availability,
  rosterAvailability,
  getEventBySlug,
  registrationsFor,
} from "@/lib/events/data";
import { formatSlot, formatWhen, rosterName, TYPE_LABEL } from "@/lib/events/format";
import { teamLines } from "@/lib/events/cards";
import { publicEvent } from "@/lib/events/map";

export const dynamic = "force-dynamic";

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const regs = await registrationsFor(event.id);
  const eventAvail = availability(event, regs);
  const rosterAvail = rosterAvailability(event, regs);
  const seats: SeatInfo = {
    remaining: eventAvail.remaining,
    full: eventAvail.full,
    slots: event.slots.map((s) => {
      const a = availability(event, regs, s.id);
      return { id: s.id, remaining: a.remaining, full: a.full };
    }),
  };

  const open = event.status === "open";
  const confirmed = regs.filter((r) => r.status === "confirmed");
  const goingCount = confirmed.reduce((n, r) => n + Math.max(1, r.partySize), 0);
  const isSlots = event.scheduleMode === "slots";

  // Tournament roster: pre-formatted "<member> & <guest>" strings only, so no
  // email, GHIN or answer can reach the page. Confirmed teams only.
  const teams = teamLines(regs, event.rosterStyle);

  const whenLine = isSlots
    ? event.slots.length === 1
      ? formatSlot(event.slots[0])
      : `${event.slots.length} sessions`
    : formatWhen(event.startsAt, event.endsAt);

  // Facts bar entries
  const facts: { lbl: string; val: React.ReactNode }[] = [];
  if (isSlots) {
    facts.push({ lbl: "Sessions", val: `${event.slots.length} dates` });
    const firstDated = event.slots.find((s) => s.date);
    if (firstDated) facts.push({ lbl: "Starts", val: formatSlot(firstDated) });
  } else if (event.startsAt) {
    const d = new Date(event.startsAt);
    facts.push({
      lbl: "Date",
      val: d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    const end = event.endsAt
      ? new Date(event.endsAt).toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        })
      : "";
    facts.push({ lbl: "Time", val: end ? `${time} – ${end}` : time });
  }
  if (event.location) facts.push({ lbl: "Where", val: event.location });

  // spots fact (single-date only; slots show per-date in the schedule)
  let spotsFact: { text: string; pct: number | null } | null = null;
  if (!isSlots) {
    if (event.capacity == null) spotsFact = { text: "Open registration", pct: null };
    else {
      const pct = Math.min(
        100,
        Math.round((eventAvail.taken / event.capacity) * 100),
      );
      // A tournament's capacity is in teams, not people.
      spotsFact = {
        text:
          event.type === "tournament"
            ? eventAvail.full
              ? "Full"
              : `${eventAvail.remaining} of ${event.capacity} teams left`
            : eventAvail.full
              ? "Full — waitlist open"
              : `${eventAvail.remaining} of ${event.capacity} spots left`,
        pct,
      };
    }
  }

  // Program roster fact (shown for both single and multi-date events).
  let rosterFact: { text: string; pct: number; full: boolean } | null = null;
  if (event.rosterLimit != null) {
    rosterFact = {
      text: rosterAvail.full
        ? "Roster full"
        : `${rosterAvail.remaining} of ${event.rosterLimit} spots open`,
      pct: Math.min(
        100,
        Math.round((rosterAvail.count / event.rosterLimit) * 100),
      ),
      full: rosterAvail.full,
    };
  }

  const heroImg = event.photos[0];
  const heroStyle = heroImg
    ? { backgroundImage: `url(${heroImg})` }
    : undefined;

  // A price line reads as "item — amount" when it has a dash separator; the
  // two halves are set apart with a dotted leader. Anything else stays whole.
  const priceParts = (line: string): [string, string] | null => {
    const m = line.match(/^(.*\S)\s+[—–]\s+(\S.*)$/);
    return m ? [m[1], m[2]] : null;
  };

  return (
    <main className="pub">
      <nav className="pub-nav">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-full.png" alt="Pasatiempo Golf Club" />
      </nav>

      <section className={`pub-hero ${heroImg ? "has-img" : ""}`}>
        <div className="pub-hero-photo" style={heroStyle} aria-hidden="true" />
        <div className="hero-inner reveal">
          <span className="kicker">{TYPE_LABEL[event.type]}</span>
          <h1>{event.title}</h1>
          <hr className="hairline" />
          <div className="hero-meta">
            <span>
              <Icon name="calendar" className="ico" />
              {whenLine}
            </span>
            {event.location && (
              <span>
                <Icon name="pin" className="ico" />
                {event.location}
              </span>
            )}
          </div>
          {open && (
            <a href="#register" className="btn gold">
              Register now
            </a>
          )}
        </div>
      </section>

      <div className="pub-body">
        {facts.length > 0 && (
          <div className="facts reveal">
            {facts.map((f, i) => (
              <div className="fact" key={i}>
                <div className="lbl">{f.lbl}</div>
                <div className="val">{f.val}</div>
              </div>
            ))}
            {spotsFact && (
              <div className="fact">
                <div className="lbl">Availability</div>
                <div className="val">
                  <small>{spotsFact.text}</small>
                </div>
                {spotsFact.pct != null && (
                  <div className="spots-bar">
                    <span style={{ width: `${spotsFact.pct}%` }} />
                  </div>
                )}
              </div>
            )}
            {rosterFact && (
              <div className="fact">
                <div className="lbl">Program roster</div>
                <div className="val">
                  <small style={rosterFact.full ? { color: "var(--danger)" } : undefined}>
                    {rosterFact.text}
                  </small>
                </div>
                <div className="spots-bar">
                  <span style={{ width: `${rosterFact.pct}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {event.description && (
          <section className="pub-section reveal">
            <p className="sec-eyebrow">Overview</p>
            <h2>About this event</h2>
            <RichText text={event.description} className="prose" />
          </section>
        )}

        {event.info && (
          <section className="pub-section reveal">
            <p className="sec-eyebrow">Particulars</p>
            <h2>What you need to know</h2>
            <RichText text={event.info} className="prose" />
          </section>
        )}

        {event.pricingEnabled && event.pricing && (
          <section className="pub-section reveal">
            <p className="sec-eyebrow">Entry fees</p>
            <h2>Pricing</h2>
            <div className="pricing-card">
              {event.pricing.split("\n").map((line, i) => {
                if (!line.trim()) return null;
                const parts = priceParts(line.trim());
                return parts ? (
                  <div className="price-line split" key={i}>
                    <span className="pl-item">{parts[0]}</span>
                    <span className="pl-leader" aria-hidden="true" />
                    <span className="pl-amt">{parts[1]}</span>
                  </div>
                ) : (
                  <div className="price-line" key={i}>
                    {line}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {isSlots && event.slots.length > 1 && (
          <section className="pub-section reveal">
            <p className="sec-eyebrow">Calendar</p>
            <h2>Schedule</h2>
            <div style={{ marginTop: 12 }}>
              {event.slots.map((s) => {
                const a = availability(event, regs, s.id);
                const going = confirmed.filter((r) => r.slotIds.includes(s.id));
                const seats = going.reduce(
                  (n, r) => n + Math.max(1, r.partySize),
                  0,
                );
                return (
                  <div className="sched-item" key={s.id}>
                    <div className="sched-row">
                      <span className="sr-date">{formatSlot(s)}</span>
                      {s.note && <span className="sr-note">{s.note}</span>}
                      <span className={`sr-status ${a.full ? "full" : ""}`}>
                        {a.capacity == null
                          ? "Open"
                          : a.full
                            ? "Full"
                            : `${a.remaining} spots left`}
                      </span>
                    </div>
                    {event.showRoster && (
                      <div className="sr-attending">
                        {seats === 0 ? (
                          <span className="muted">No sign-ups yet</span>
                        ) : event.rosterStyle === "count_only" ? (
                          <span className="muted">{seats} attending</span>
                        ) : (
                          <>
                            <span className="sr-attending-lbl">
                              {seats} attending:
                            </span>
                            {going.map((r) => (
                              <span className="chip sm" key={r.id}>
                                {rosterName(r.name, event.rosterStyle)}
                                {r.partySize > 1 ? ` +${r.partySize - 1}` : ""}
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {event.photos.length > 1 && (
          <section className="pub-section reveal">
            <p className="sec-eyebrow">Photographs</p>
            <h2>Gallery</h2>
            <div style={{ marginTop: 14 }}>
              <Gallery photos={event.photos} mode={event.galleryMode} />
            </div>
          </section>
        )}

        {event.status === "draft" && (
          <div className="notice warn" style={{ marginTop: 28 }}>
            This event is a <strong>draft</strong> and isn&apos;t open for
            registration yet.
          </div>
        )}
        {event.status === "closed" && (
          <div className="notice err" style={{ marginTop: 28 }}>
            Registration for this event is <strong>closed</strong>.
          </div>
        )}

        {open && <div className="ornament" aria-hidden="true" />}

        {open && (
          <section className="pub-section reveal stacked" id="register">
            <p className="sec-eyebrow">Registration</p>
            <h2>Register</h2>
            {rosterAvail.full && (
              <div className="notice warn" style={{ marginTop: 14 }}>
                The program roster is <strong>full</strong> — new sign-ups are
                closed. If you&apos;re already on the roster you can still add
                dates below; otherwise please email Ian Johnson at{" "}
                <a href="mailto:Ijohnson@pasatiempo.com">
                  Ijohnson@pasatiempo.com
                </a>{" "}
                to be added to a waiting list.
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <RegistrationForm event={publicEvent(event)} seats={seats} />
            </div>
          </section>
        )}

        {open && <ManageRegistration event={publicEvent(event)} />}

        {event.showRoster && !isSlots && event.type === "tournament" && (
          <PublicTeamRoster
            teams={teams}
            countOnly={event.rosterStyle === "count_only"}
          />
        )}

        {event.showRoster && !isSlots && event.type !== "tournament" && (
          <section className="pub-section reveal">
            <p className="sec-eyebrow">The roster</p>
            <h2>Who&apos;s coming · {goingCount}</h2>
            <div style={{ marginTop: 14 }}>
              {goingCount === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  Be the first to sign up!
                </p>
              ) : event.rosterStyle === "count_only" ? (
                <p style={{ margin: 0 }}>
                  <strong>{goingCount}</strong> registered so far.
                </p>
              ) : (
                <div className="roster">
                  {confirmed.map((r) => (
                    <span className="chip" key={r.id}>
                      {rosterName(r.name, event.rosterStyle)}
                      {r.partySize > 1 ? ` +${r.partySize - 1}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <footer className="pub-foot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.png" alt="" />
        <div className="est">Pasatiempo Golf Club · Est. 1929</div>
        <Link className="foot-admin" href="/admin/events">
          Pasatiempo staff — manage events →
        </Link>
      </footer>
    </main>
  );
}
