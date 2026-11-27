import Icon from "@/components/events/Icon";
import CalendarMenu from "./CalendarMenu";
import ManageLink from "./ManageLink";
import ShareButton from "./ShareButton";
import { pageSettings } from "@/lib/events/page-settings";
import { mapUrl } from "@/lib/events/public-page";
import type { Cta } from "@/lib/events/public-page";
import type { EventRec } from "@/lib/events/types";
import type { WindowNote } from "@/lib/events/signup-window";

// The sign-up page's hero: the chosen photo at its focal point, the title and
// the main button. Shared with the editor preview.
export default function PublicHero({
  event,
  hero,
  cta,
  whenLine,
  note = null,
}: {
  event: EventRec;
  hero: { src: string; focus: { x: number; y: number } } | null;
  cta: Cta;
  whenLine: string;
  note?: WindowNote | null; // "Sign-ups close …", from lib/events/signup-window
}) {
  const settings = pageSettings(event);
  // "plain" sets the title on the look's colour band, with no photo
  const photo = settings.heroStyle === "plain" ? null : hero;
  return (
    <section
      className={`pub-hero hero-${settings.heroStyle}${photo ? " has-img" : ""}`}
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="pub-hero-photo"
          src={photo.src}
          alt=""
          fetchPriority="high"
          style={{ objectPosition: `${photo.focus.x}% ${photo.focus.y}%` }}
        />
      )}
      <div className="hero-inner reveal">
        <span className="kicker">{settings.kicker}</span>
        <h1>{event.title}</h1>
        <hr className="hairline" />
        <div className="hero-meta">
          <span>
            <Icon name="calendar" className="ico" />
            {whenLine}
          </span>
          {event.location && (
            <a
              className="hero-map"
              href={mapUrl(event.location) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="pin" className="ico" />
              {event.location}
              <span className="sr-only"> (opens a map)</span>
            </a>
          )}
        </div>
        <div className="hero-actions">
          <CtaButton cta={cta} id="hero-cta" className="btn gold" />
          <CalendarMenu event={event} />
          <ShareButton title={event.title} />
        </div>
        {note && <p className={`hero-window tone-${note.tone}`}>{note.text}</p>}
        {event.status === "open" && <ManageLink tournament={event.type === "tournament"} />}
      </div>
    </section>
  );
}

/** The page's main action as a link: to the form, or to the event's contact. */
export function CtaButton({
  cta,
  id,
  className,
}: {
  cta: Cta;
  id?: string;
  className: string;
}) {
  if (cta.kind === "none") return null;
  if (cta.kind === "contact")
    return (
      <a id={id} href={`mailto:${cta.email}`} className={className}>
        Contact {cta.name}
      </a>
    );
  return (
    <a id={id} href="#register" className={className}>
      {cta.label}
    </a>
  );
}
