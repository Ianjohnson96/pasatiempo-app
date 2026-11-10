// Public "Teams entered" block. Takes pre-formatted strings only, so nothing
// private (email, GHIN, answers) can be serialised into the page.
export default function PublicTeamRoster({
  teams,
  countOnly,
}: {
  teams: string[];
  countOnly: boolean;
}) {
  return (
    <section className="pub-section reveal stacked">
      <p className="sec-eyebrow">The field</p>
      <h2>Teams entered &middot; {teams.length}</h2>
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
                <span>{t}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
