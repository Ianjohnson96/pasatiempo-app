// Public landing for the Event Planner section (events custom domain root).
// Individual events are reached by their private link: /events/e/<slug>.
export default function EventsHome() {
  return (
    <main className="container narrow" style={{ textAlign: "center", paddingTop: 80 }}>
      <p className="eyebrow">Pasatiempo Golf Club</p>
      <h1 style={{ fontSize: 34 }}>Events</h1>
      <p className="lead" style={{ margin: "0 auto" }}>
        Events are shared by private link. If you received one, open it to sign
        up. Otherwise, check with the club for the event you&apos;re looking
        for.
      </p>
    </main>
  );
}
