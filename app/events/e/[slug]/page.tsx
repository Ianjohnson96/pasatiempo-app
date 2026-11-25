import Link from "next/link";
import { notFound } from "next/navigation";
import Gallery from "@/components/events/Gallery";
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
import { formatSlot, rosterName } from "@/lib/events/format";
import { ctaState } from "@/lib/events/public-page";
import { eventContact, resolveHero, resolveLogo, themeVars } from "@/lib/events/theme";
import PublicNav from "@/components/events/public/PublicNav";
import PublicHero from "@/components/events/public/PublicHero";
import FactsStrip, {
  factsFor,
  rosterMeter,
  spotsMeter,
  whenLineFor,
} from "@/components/events/public/FactsStrip";
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

  const rosterFull = rosterAvail.full;
  const cta = ctaState(event, seats, rosterFull);
  const contact = eventContact(event);
  const look = themeVars(event.theme);
  const hero = resolveHero(event.theme, event.photos);

  // A price line reads as "item — amount" when it has a dash separator; the
  // two halves are set apart with a dotted leader. Anything else stays whole.
  const priceParts = (line: string): [string, string] | null => {
    const m = line.match(/^(.*\S)\s+[—–]\s+(\S.*)$/);
    return m ? [m[1], m[2]] : null;
  };

  return (
    <main
      className="pub"
      data-look={event.theme?.preset ?? "clubhouse"}
      style={look.vars as React.CSSProperties}
    >
      <PublicNav logo={resolveLogo(event.theme)} />

      <PublicHero
        event={event}
        hero={hero}
        cta={cta}
        whenLine={whenLineFor(event)}
      />

      <div className="pub-body">
        <FactsStrip
          facts={factsFor(event)}
          spots={spotsMeter(event, eventAvail)}
          roster={rosterMeter(event, rosterAvail)}
        />

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
                  <div
                    className={`price-line split${parts[1].length <= 14 ? " short" : ""}`}
                    key={i}
                  >
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
                dates below; otherwise please email {contact.name} at{" "}
                <a href={`mailto:${contact.email}`}>{contact.email}</a>{" "}
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
