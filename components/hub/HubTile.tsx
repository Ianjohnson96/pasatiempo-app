import Image from "next/image";
import Link from "next/link";

// One app on the staff dashboard, as a photographed card. Styles are in
// app/hub.css.
//
// The whole card is clickable, but only the title is actually a link: its
// ::after is stretched over the card (.hub-tile-link). A tile may hold the
// super admin's site switch, and a button nested inside a link is invalid HTML
// that swallows its clicks — so the controls sit above the stretch instead.

export interface HubTileProps {
  /** Position among the tiles actually shown; staggers the arrival. */
  index: number;
  href: string;
  /** Full page load (another app with its own styles). */
  hard?: boolean;
  /** Opens in a new tab — the public sites, so the dashboard stays put. */
  external?: boolean;
  title: string;
  desc: string;
  tag: string;
  staffTag?: boolean;
  img: string;
  /** Where the eye should land when the photo is cropped to the card. */
  focus?: string;
  badge?: React.ReactNode;
  stats?: { num: number; lbl: string }[];
  meta?: React.ReactNode;
  cta: string;
  controls?: React.ReactNode;
}

export default function HubTile({
  index,
  href,
  hard,
  external,
  title,
  desc,
  tag,
  staffTag,
  img,
  focus,
  badge,
  stats,
  meta,
  cta,
  controls,
}: HubTileProps) {
  const link = external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="hub-tile-link">
      {title}
    </a>
  ) : hard ? (
    <a href={href} className="hub-tile-link">
      {title}
    </a>
  ) : (
    <Link href={href} className="hub-tile-link">
      {title}
    </Link>
  );

  return (
    <article className="hub-tile" style={{ "--i": index } as React.CSSProperties}>
      <div className="hub-tile-media">
        <Image
          src={img}
          alt=""
          fill
          sizes="(max-width: 720px) 100vw, (max-width: 1100px) 50vw, 360px"
          className="hub-tile-img"
          style={focus ? { objectPosition: focus } : undefined}
        />
        <span className={staffTag ? "hub-tag staff" : "hub-tag"}>{tag}</span>
      </div>

      <div className="hub-tile-body">
        <div className="hub-tile-head">
          <h3 className="hub-tile-title">{link}</h3>
          {badge && <span className="hub-tile-badges">{badge}</span>}
        </div>
        <p className="hub-tile-desc">{desc}</p>

        {stats && stats.length > 0 && (
          <div className="hub-stats">
            {stats.map((s) => (
              <div key={s.lbl} className="hub-stat">
                <div className="num">{s.num}</div>
                <div className="lbl">{s.lbl}</div>
              </div>
            ))}
          </div>
        )}

        {meta && <p className="hub-meta">{meta}</p>}

        <div className="hub-tile-foot">
          <span className="hub-tile-cta">
            {cta}
            {external ? " ↗" : ""}{" "}
            {!external && (
              <span className="arrow" aria-hidden>
                →
              </span>
            )}
          </span>
          {controls && <div className="hub-tile-controls">{controls}</div>}
        </div>
      </div>
    </article>
  );
}
