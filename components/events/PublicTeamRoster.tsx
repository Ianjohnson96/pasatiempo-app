import type { TeamLine } from "@/lib/events/cards";

// Public "Teams entered" block. Takes display names only (teamLines), so
// nothing private (email, GHIN, answers) can be serialised into the page.
// Each name carries its role, so it's clear who is the member and who the guest.
export default function PublicTeamRoster({
  teams,
  countOnly,
  capacity,
}: {
  teams: TeamLine[];
  countOnly: boolean;
  capacity: number | null; // null when the event hides its spots left
}) {
  return (
    <section className="pub-section reveal stacked">
      <p className="sec-eyebrow">The field</p>
      <h2>
        Teams entered &middot; {teams.length}
        {capacity != null && <span className="tr-of"> of {capacity}</span>}
      </h2>
      <div style={{ marginTop: 14 }}>
        {teams.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Be the first to sign up!
          </p>
        ) : countOnly ? (
          <p style={{ margin: 0 }}>
            <strong>{teams.length}</strong> {teams.length === 1 ? "team" : "teams"}
          </p>
        ) : (
          <ol className="team-roster">
            {teams.map((t, i) => (
              <li key={i}>
                <span className="tr-n">{i + 1}</span>
                <span className="tr-team">
                  <span className="tr-player">
                    {t.member}
                    <span className="tr-role">Member</span>
                  </span>
                  {t.guest && (
                    <>
                      <span className="tr-amp" aria-hidden="true">
                        &amp;
                      </span>
                      <span className="tr-player">
                        {t.guest}
                        <span className="tr-role guest">Guest</span>
                      </span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
