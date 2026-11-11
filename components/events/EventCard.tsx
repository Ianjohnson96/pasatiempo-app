import Link from "next/link";
import CopyLink from "@/components/events/CopyLink";
import Icon from "@/components/events/Icon";
import TypeIcon from "@/components/events/TypeIcon";
import { dateBoxParts, fillLabel, fillPercent } from "@/lib/events/cards";
import { formatWhen, TYPE_LABEL } from "@/lib/events/format";
import type { EventRec } from "@/lib/events/types";

// One event on the admin list: type stripe + icon, date box, title and status,
// a fill bar, the waitlist count, and the link / View / Manage actions.
export default function EventCard({
  ev,
  taken,
  waitlist,
}: {
  ev: EventRec;
  taken: number;
  waitlist: number;
}) {
  const box = dateBoxParts(ev, ev.slots);
  const when =
    ev.scheduleMode === "slots"
      ? ev.slots.length === 1
        ? "1 session"
        : `${ev.slots.length} sessions`
      : formatWhen(ev.startsAt, ev.endsAt);
  const pct = fillPercent(taken, ev.capacity);
  return (
    <article className="evcard" data-type={ev.type}>
      <span className="evcard-stripe" aria-hidden />
      <div className="evcard-body">
        <div className="evcard-top">
          <div className="datebox" aria-label={box ? `${box.month} ${box.day}` : "Date to be decided"}>
            {box ? (
              <>
                <span className="datebox-mo">{box.month}</span>
                <span className="datebox-day">{box.day}</span>
              </>
            ) : (
              <span className="datebox-tbd">TBD</span>
            )}
          </div>
          <div className="evcard-main">
            <div className="evcard-title">
              <Link href={`/admin/events/${ev.id}`} className="ev-title">
                {ev.title}
              </Link>
              <span className={`badge ${ev.status}`}>{ev.status}</span>
            </div>
            <div className="ev-meta">
              <span className="evcard-type">
                <TypeIcon type={ev.type} size={14} />
                {TYPE_LABEL[ev.type]}
              </span>
              <span>{when}</span>
              {ev.location && (
                <span>
                  <Icon name="pin" />
                  {ev.location}
                </span>
              )}
              {ev.inviteOnly && (
                <span>
                  <Icon name="lock" />
                  Invite-only
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="fillbar-wrap">
          <div className="fillbar-text">
            <span>{fillLabel(ev, taken, ev.capacity)}</span>
            {waitlist > 0 && (
              <span className="fillbar-wait">{waitlist} on waitlist</span>
            )}
          </div>
          {ev.capacity != null && (
            <div
              className="fillbar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label="Filled"
            >
              <span style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>

        <div className="evcard-actions">
          <div className="evcard-link">
            <CopyLink slug={ev.slug} compact />
          </div>
          <a
            href={`/events/e/${ev.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn secondary small"
          >
            View
            <Icon name="external" />
          </a>
          <Link href={`/admin/events/${ev.id}`} className="btn secondary small">
            Manage
          </Link>
        </div>
      </div>
    </article>
  );
}
