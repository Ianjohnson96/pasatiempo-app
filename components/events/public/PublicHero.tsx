import Icon from "@/components/events/Icon";
import { TYPE_LABEL } from "@/lib/events/format";
import type { Cta } from "@/lib/events/public-page";
import type { EventRec } from "@/lib/events/types";

// The sign-up page's hero: the chosen photo at its focal point, the title and
// the main button. Shared with the editor preview.
export default function PublicHero({
  event,
  hero,
  cta,
  whenLine,
}: {
  event: EventRec;
  hero: { src: string; focus: { x: number; y: number } } | null;
  cta: Cta;
  whenLine: string;
}) {
  return (
    <section className={`pub-hero ${hero ? "has-img" : ""}`}>
      {hero && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="pub-hero-photo"
          src={hero.src}
          alt=""
          fetchPriority="high"
          style={{ objectPosition: `${hero.focus.x}% ${hero.focus.y}%` }}
        />
      )}
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
        <CtaButton cta={cta} id="hero-cta" className="btn gold" />
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
