"use client";

import { useCallback, useEffect, useState } from "react";
import type { Team } from "@/lib/mhi/teams";

const TABS: [string, string][] = [
  ["home", "Home"],
  ["flights", "Flights"],
  ["schedule", "Schedule"],
  ["formats", "Formats"],
  ["contests", "Contests"],
  ["horserace", "Horse Race"],
  ["parimutuel", "Parimutuel"],
];

const TITLES: Record<string, string> = {
  home: "Marion Hollins Invitational 2026",
  schedule: "Schedule",
  flights: "Flights",
  formats: "Formats",
  horserace: "The Horse Race",
  parimutuel: "Parimutuel Betting",
  contests: "Contests & Prizes",
};

const HR_LABEL: Record<string, string> = {
  green1: "Green 1",
  green2: "Green 2",
  combo: "Combo",
};

// Tournament (overall event) flights are named by tee selection.
const FLIGHT_LABEL: Record<string, string> = {
  "1": "Green Tee 1st Flight",
  "2": "Green Tee 2nd Flight",
  "3": "Combo Tee Flight",
};

// Handicap indexes: plus handicaps are stored negative (e.g. -1.4 → "+1.4").
function fmtIndex(v: number | null): string {
  if (v === null) return "";
  return v < 0 ? "+" + Math.abs(v).toFixed(1) : v.toFixed(1);
}

function Horseshoe({ size = 26 }: { size?: number }) {
  return (
    <svg className="horseshoe" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 2.5C4 4 3 6.5 3 9.5 3 15 7 20 12 21c5-1 9-6 9-11.5 0-3-1-5.5-3-7l-1.6 1.2C18 5 18.8 7 18.8 9.5c0 4.2-3 8-6.8 8.8-3.8-.8-6.8-4.6-6.8-8.8C5.2 7 6 5 7.6 3.7L6 2.5z" />
    </svg>
  );
}

export default function EventSite({ teams }: { teams: Team[] }) {
  const [tab, setTab] = useState("home");

  const go = useCallback((next: string, push = true) => {
    const t = TABS.some(([id]) => id === next) ? next : "home";
    setTab(t);
    if (push && typeof window !== "undefined" && window.location.hash !== "#" + t) {
      window.history.pushState({ tab: t }, "", "#" + t);
    }
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    const initial = (window.location.hash || "#home").slice(1);
    go(initial, false);
    const onPop = () => go((window.location.hash || "#home").slice(1), false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [go]);

  useEffect(() => {
    document.title =
      (tab === "home" ? TITLES.home : TITLES[tab] + " — Marion Hollins Invitational") +
      " · Pasatiempo";
  }, [tab]);

  const cls = (id: string) => "view" + (tab === id ? " active" : "");

  // Group teams by tournament flight for the Flights tab.
  const flightsPresent = teams.length > 0;
  const flightOrder: (number | null)[] = [1, 2, 3, null];
  const groups = flightOrder
    .map((f) => ({
      flight: f,
      label: f === null ? "Additional Teams" : FLIGHT_LABEL[String(f)] ?? `Flight ${f}`,
      teams: teams.filter((t) => (t.flight ?? null) === f),
    }))
    .filter((g) => g.teams.length > 0);

  return (
    <>
      <header className="site">
        <div className="brandbar">
          <button className="brand" onClick={() => go("home")} aria-label="Marion Hollins Invitational — Home">
            <img src="/mhi/images/emblem.png" alt="Pasatiempo Golf Club crest" width={42} />
            <span>
              <span className="bt1">Marion Hollins Invitational</span>
              <br />
              <span className="bt2">Pasatiempo Golf Club · 2026</span>
            </span>
          </button>
          <nav className="tabs" role="tablist" aria-label="Sections">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                role="tab"
                onClick={() => go(id)}
                aria-current={tab === id ? "true" : "false"}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main>
        {/* ===== HOME ===== */}
        <section className={cls("home")} id="home" role="tabpanel">
          <div className="hero">
            <div className="bg bg-hero" />
            <div className="veil" />
            <div className="inner">
              <div className="eyebrow">Pasatiempo Golf Club · Since 1929</div>
              <h1>
                Marion Hollins
                <br />
                Invitational
              </h1>
              <div className="tagline">&ldquo;The Race is On&rdquo;</div>
              <div className="dates">
                <span>August 4 &amp; 5, 2026</span>
              </div>
            </div>
            <div className="scrollcue" aria-hidden="true">
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}>
                <path d="M12 4v14M6 12l6 6 6-6" />
              </svg>
            </div>
          </div>

          <section className="block">
            <div className="wrap narrow center">
              <div className="rule-orn">
                <Horseshoe />
              </div>
              <p className="lead lead-lg">
                Welcome, players. Everything you need for two days of great golf, friendly competition, and a little
                horse race &mdash; gathered in one place. Below you&rsquo;ll find the weekend at a glance; use the tabs
                above for your schedule, flights, formats, the Horse Race, and contests.
              </p>
            </div>
          </section>

          <section className="block tight">
            <div className="wrap">
              <div className="facts">
                <div>
                  <div className="k">Practice Round</div>
                  <div className="v">Aug 3</div>
                  <div className="n">1:00 PM tee times &amp; on</div>
                </div>
                <div>
                  <div className="k">The Rounds</div>
                  <div className="v">Aug 4 &amp; 5</div>
                  <div className="n">Tuesday &amp; Wednesday</div>
                </div>
                <div>
                  <div className="k">Shotgun Start</div>
                  <div className="v">9:00 AM</div>
                  <div className="n">Check-in &amp; breakfast 7:30</div>
                </div>
                <div>
                  <div className="k">The Clubhouse</div>
                  <div className="v">Hollins House</div>
                  <div className="n">Breakfast &amp; lunch each day</div>
                </div>
              </div>
            </div>
          </section>

          <section className="block">
            <div className="wrap">
              <div className="feature">
                <div className="portrait-stack">
                  <figure className="portrait">
                    <img src="/mhi/images/mh-portrait.avif" alt="Formal portrait of Marion Hollins, c. 1922" />
                    <figcaption>Marion Hollins, c.&nbsp;1922</figcaption>
                  </figure>
                  <figure className="portrait">
                    <img src="/mhi/images/mh-swing.avif" alt="Marion Hollins mid golf swing, 1916" />
                    <figcaption>On the tee, 1916</figcaption>
                  </figure>
                </div>
                <div>
                  <div className="eyebrow">The Woman Behind the Weekend</div>
                  <h3>Marion Hollins</h3>
                  <p>
                    National champion, horsewoman, and visionary, <strong>Marion Hollins</strong> (1892&ndash;1944) won
                    the 1921 U.S. Women&rsquo;s Amateur and went on to become one of golf&rsquo;s great builders. In 1929
                    she founded <strong>Pasatiempo Golf Club</strong>, commissioning Dr.&nbsp;Alister MacKenzie to route
                    the course she envisioned in the Santa Cruz hills.
                  </p>
                  <p>
                    On Opening Day &mdash; September 8, 1929 &mdash; more than 2,000 spectators followed her around the
                    course alongside Bobby Jones, Glenna Collett, and Cyril Tolley. Her instinct for great golfing ground
                    also helped inspire the 16th at Cypress Point and shaped the land that became Augusta National.
                  </p>
                  <p>
                    Beyond the golf course, she was an accomplished equestrienne and polo player, and one of the few
                    women of her era with the standing to commission championship courses on her own terms. That same
                    boldness &mdash; competitive, generous, and utterly unafraid &mdash; is what this invitational
                    honors every August.
                  </p>

                  <h4>Milestones</h4>
                  <ul className="timeline">
                    <li>
                      <span className="yr">1892</span>
                      <span className="yr-text">Marion Hollins is born, into a family with deep ties to Long Island golf and horse racing.</span>
                    </li>
                    <li>
                      <span className="yr">1921</span>
                      <span className="yr-text">Wins the U.S. Women&rsquo;s Amateur, the top title in women&rsquo;s golf.</span>
                    </li>
                    <li>
                      <span className="yr">1926</span>
                      <span className="yr-text">Her feel for the land helps shape the par-3 16th at Cypress Point &mdash; still one of golf&rsquo;s most photographed holes.</span>
                    </li>
                    <li>
                      <span className="yr">1929</span>
                      <span className="yr-text">Founds Pasatiempo Golf Club, commissioning Dr.&nbsp;Alister MacKenzie to design the course.</span>
                    </li>
                    <li>
                      <span className="yr">Sept 8, 1929</span>
                      <span className="yr-text">Opening Day &mdash; over 2,000 spectators watch her play alongside Bobby Jones, Glenna Collett, and Cyril Tolley.</span>
                    </li>
                    <li>
                      <span className="yr">1944</span>
                      <span className="yr-text">Marion Hollins passes away, leaving behind some of golf&rsquo;s most celebrated ground.</span>
                    </li>
                  </ul>

                  <div className="pullquote">
                    A champion in a man&rsquo;s world &mdash; this invitational carries her name, and her spirit of bold,
                    joyful competition.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="histband scenic">
            <div className="bg bg-home-quote" />
            <div className="veil" />
            <div className="inner">
              <div className="q">
                &ldquo;Grab your guests for two days of great golf, friendly competition, and a little horse race.&rdquo;
              </div>
              <div className="a">In the tradition of Marion Hollins</div>
            </div>
          </div>

          <section className="block">
            <div className="wrap center">
              <div className="eyebrow">Find Your Way Around</div>
              <h3 className="mb26">The Weekend, Section by Section</h3>
              <div className="navcards">
                <button className="navcard" onClick={() => go("schedule")}>
                  <div className="ni">
                    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}>
                      <rect x={3} y={4.5} width={18} height={16} rx={1.5} />
                      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
                    </svg>
                  </div>
                  <h4>Schedule</h4>
                  <p>The full three-day timeline &mdash; practice round, both tournament rounds, the Horse Race, and awards.</p>
                </button>
                <button className="navcard" onClick={() => go("flights")}>
                  <div className="ni">
                    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}>
                      <path d="M4 20V5l7 3 9-4v13l-9 4-7-3z" />
                      <path d="M11 8v13" />
                    </svg>
                  </div>
                  <h4>Flights</h4>
                  <p>Tournament flights and the Horse Race flights, with the holes each flight plays.</p>
                </button>
                <button className="navcard" onClick={() => go("formats")}>
                  <div className="ni">
                    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}>
                      <path d="M12 3v9l6 3" />
                      <circle cx={12} cy={12} r={9} />
                    </svg>
                  </div>
                  <h4>Formats</h4>
                  <p>Day-by-day formats, Net Stableford scoring, handicap allowances, and scramble rules.</p>
                </button>
                <button className="navcard" onClick={() => go("horserace")}>
                  <div className="ni">
                    <Horseshoe />
                  </div>
                  <h4>Horse Race</h4>
                  <p>The knockout alternate-shot race &mdash; shot order, elimination, chip-offs, and the Championship hole.</p>
                </button>
                <button className="navcard" onClick={() => go("parimutuel")}>
                  <div className="ni">
                    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}>
                      <circle cx={12} cy={12} r={8.5} />
                      <path d="M12 7v10M9.5 9.2h3.2a1.8 1.8 0 0 1 0 3.6H9.8" />
                    </svg>
                  </div>
                  <h4>Parimutuel</h4>
                  <p>Wager on the race &mdash; Win, Place &amp; Show, house rules, and how the pool pays out.</p>
                </button>
                <button className="navcard" onClick={() => go("contests")}>
                  <div className="ni">
                    <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}>
                      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
                      <path d="M5 4H3v2a3 3 0 0 0 3 3M19 4h2v2a3 3 0 0 1-3 3M9 20h6M12 13v7" />
                    </svg>
                  </div>
                  <h4>Contests</h4>
                  <p>Closest-to-the-pin, the full prize list, and the Horse Race payouts.</p>
                </button>
              </div>
            </div>
          </section>
        </section>

        {/* ===== SCHEDULE ===== */}
        <section className={cls("schedule")} id="schedule" role="tabpanel">
          <div className="band">
            <div className="bg bg-schedule" />
            <div className="veil" />
            <div className="inner">
              <div className="eyebrow">Three Days at Pasatiempo</div>
              <h2>Schedule of Events</h2>
            </div>
          </div>
          <section className="block">
            <div className="wrap">
              <div className="panel plain">
                <div className="day">
                  <div className="day-h">
                    <div className="dn">Monday</div>
                    <div className="dd">August 3rd</div>
                    <div className="dtag">Practice Day</div>
                  </div>
                  <div className="day-events">
                    <div className="evt">
                      <div className="t">1:00 PM</div>
                      <div className="d">
                        <strong>Free practice round</strong> &mdash; tee times from 1:00 PM and on.
                        <div className="sub">Grab your guests and get a look at the course before the competition begins.</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="day">
                  <div className="day-h">
                    <div className="dn">Tuesday</div>
                    <div className="dd">August 4th</div>
                    <div className="dtag">Round 1 &amp; the Horse Race</div>
                  </div>
                  <div className="day-events">
                    <div className="evt">
                      <div className="t">7:30 AM</div>
                      <div className="d"><strong>Check-in &amp; breakfast</strong> at the Hollins House.</div>
                    </div>
                    <div className="evt">
                      <div className="t">9:00 AM</div>
                      <div className="d">
                        <strong>Shotgun start &mdash; Round 1.</strong>
                        <div className="sub">Front 9: Step Aside Scramble &nbsp;·&nbsp; Back 9: Two Best Balls of the Foursome.</div>
                      </div>
                    </div>
                    <div className="evt">
                      <div className="t">After golf</div>
                      <div className="d"><strong>Lunch</strong> provided for all players.</div>
                    </div>
                    <div className="evt">
                      <div className="t">After lunch</div>
                      <div className="d">
                        <strong>The Horse Race</strong> &mdash; 4-person alternate shot elimination.
                        <div className="sub">Parimutuel betting for players and spectators; drinks on course at holes 1, 3 &amp; 5.</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="day">
                  <div className="day-h">
                    <div className="dn">Wednesday</div>
                    <div className="dd">August 5th</div>
                    <div className="dtag">Round 2 &amp; Awards</div>
                  </div>
                  <div className="day-events">
                    <div className="evt">
                      <div className="t">7:30 AM</div>
                      <div className="d"><strong>Check-in &amp; breakfast</strong> at the Hollins House.</div>
                    </div>
                    <div className="evt">
                      <div className="t">9:00 AM</div>
                      <div className="d">
                        <strong>Shotgun start &mdash; Round 2.</strong>
                        <div className="sub">Front 9: Two Best Balls of the Foursome &nbsp;·&nbsp; Back 9: Scramble.</div>
                      </div>
                    </div>
                    <div className="evt">
                      <div className="t">After golf</div>
                      <div className="d">
                        <strong>Lunch &amp; Awards Ceremony.</strong>
                        <div className="sub">Champions crowned, prizes presented, and Horse Race betting payouts claimed.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="fine center mt22">
                Both tournament rounds use a 9:00&nbsp;AM shotgun start. Aggregate Net Stableford scoring across both days
                decides the champions.
              </p>
            </div>
          </section>
        </section>

        {/* ===== FLIGHTS ===== */}
        <section className={cls("flights")} id="flights" role="tabpanel">
          <div className="band">
            <div className="bg bg-flights" />
            <div className="veil" />
            <div className="inner">
              <div className="eyebrow">How the Field Is Divided</div>
              <h2>Flights</h2>
            </div>
          </div>
          <section className="block">
            <div className="wrap">
              <p className="lead">
                Teams of four &mdash; each Pasatiempo member with one to three guests &mdash; are grouped two ways: into{" "}
                <strong>tournament flights</strong> for the two-day competition, and into <strong>Horse Race flights</strong>{" "}
                for Tuesday&rsquo;s after-lunch showdown. All groupings are set by team handicap index.
              </p>

              <div className="grid g2 mt30">
                <div className="panel">
                  <div className="eyebrow">Two-Day Competition</div>
                  <h3>Tournament Flights</h3>
                  <p>
                    The field is split into three flights. Every flight plays for its own low-net prizes &mdash; first,
                    second, and third &mdash; in addition to the overall Low Gross and Low Net awards contested across
                    the whole field.
                  </p>
                  <ul className="clean">
                    <li><strong>Green Tee 1st Flight</strong> &mdash; plays the Green tees</li>
                    <li><strong>Green Tee 2nd Flight</strong> &mdash; plays the Green tees</li>
                    <li><strong>Combo Tee Flight</strong> &mdash; plays the Green/Hollins Combo tees</li>
                  </ul>
                </div>
                <div className="panel">
                  <div className="eyebrow">Tuesday After Lunch</div>
                  <h3>Horse Race Flights</h3>
                  <p>
                    For the Horse Race, teams are flighted and each flight plays a designated set of three holes before
                    its winner advances to the Championship hole.
                  </p>
                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Flight</th>
                          <th>Holes Played</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td className="hs">Green Flight 1</td><td>5, 6 &amp; 7</td></tr>
                        <tr><td className="hs">Combo Flight</td><td>3, 4 &amp; 5</td></tr>
                        <tr><td className="hs">Green Flight 2</td><td>1, 2 &amp; 3</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="fine">Flight winners meet on Hole 9 for the Championship Final. Full rules are on the Horse Race tab.</p>
                </div>
              </div>

              <h4 className="mt40">Teams &amp; Pairings</h4>
              {flightsPresent ? (
                <>
                  <p className="fine">Team and player indexes per the latest club report — final adjustments may occur before play.</p>
                  {groups.map((g) => (
                    <div className="flight-group" key={g.label}>
                      <h4>{g.label}</h4>
                      <div className="teamgrid">
                        {g.teams.map((t) => (
                          <div className="teamcard" key={t.id}>
                            <div className="tname">
                              <span>{t.name || "Team"}</span>
                              {t.teamIndex !== null ? (
                                <span className="hrtag">{fmtIndex(t.teamIndex)}</span>
                              ) : (
                                t.horseRaceFlight &&
                                HR_LABEL[t.horseRaceFlight] && (
                                  <span className="hrtag">{HR_LABEL[t.horseRaceFlight]}</span>
                                )
                              )}
                            </div>
                            <ul>
                              {t.players.map((p, i) => (
                                <li key={i}>
                                  {p.name}
                                  {p.index !== null && <span className="pidx"> ({fmtIndex(p.index)})</span>}
                                  {!p.isMember && <span className="guest"> · guest</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="tba">
                  <span className="big">🏆&nbsp; Team rosters &amp; flight assignments</span>
                  Pairings, flight placements, and Horse Race post positions will be posted here once finalized. Check back
                  closer to the event &mdash; and see your golf professional with any questions.
                </div>
              )}
            </div>
          </section>
        </section>

        {/* ===== FORMATS ===== */}
        <section className={cls("formats")} id="formats" role="tabpanel">
          <div className="band">
            <div className="bg bg-formats" />
            <div className="veil" />
            <div className="inner">
              <div className="eyebrow">How Each Round Is Played</div>
              <h2>Formats</h2>
            </div>
          </div>
          <section className="block">
            <div className="wrap">
              <p className="lead">
                Both days are played as <strong>Net Stableford</strong>, and your team&rsquo;s two-day aggregate decides
                the standings. Each round pairs two different nine-hole formats.
              </p>

              <div className="grid g2 mt30">
                <div className="panel">
                  <div className="eyebrow">Day 1 · Tuesday, Aug 4</div>
                  <h3>Round One</h3>
                  <div className="fmt-nine">
                    <div className="nl">Front 9 &mdash; Step Aside Scramble</div>
                    <div><span className="chip">Handicap 25 / 20 / 15 / 10%</span></div>
                    <ul className="plainlist">
                      <li>All players tee off; the team selects the best drive.</li>
                      <li>The player whose shot is chosen <em>steps aside</em> for the next shot; repeat to the green.</li>
                      <li>On the green, the selected putter sits out the first round of putts; the other three each putt. Each round of putts is one team stroke until holed.</li>
                    </ul>
                  </div>
                  <div className="fmt-nine">
                    <div className="nl">Back 9 &mdash; Two Best Balls</div>
                    <div><span className="chip">85% of course handicap</span></div>
                    <ul className="plainlist">
                      <li>Everyone plays their own ball; the team records the <strong>two best net scores</strong> per hole.</li>
                    </ul>
                  </div>
                </div>
                <div className="panel">
                  <div className="eyebrow">Day 2 · Wednesday, Aug 5</div>
                  <h3>Round Two</h3>
                  <div className="fmt-nine">
                    <div className="nl">Front 9 &mdash; Two Best Balls</div>
                    <div><span className="chip">85% of course handicap</span></div>
                    <ul className="plainlist">
                      <li>Everyone plays their own ball; the team records the <strong>two best net scores</strong> per hole.</li>
                    </ul>
                  </div>
                  <div className="fmt-nine">
                    <div className="nl">Back 9 &mdash; Scramble</div>
                    <div><span className="chip">Handicap 25 / 20 / 15 / 10%</span></div>
                    <ul className="plainlist">
                      <li>All four tee off; the team plays from the best shot &mdash; repeated to the green.</li>
                      <li>A minimum of one drive per player must be used over the nine.</li>
                      <li>On the green, all four putt from the selected spot; each round of putts is one team stroke until holed.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid g2 mt22">
                <div className="panel">
                  <h3>Net Stableford Scoring</h3>
                  <p>Points are earned per hole against your net score. Play the whole field&rsquo;s aggregate &mdash; the more birdies, the better.</p>
                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Net Score on Hole</th>
                          <th className="num">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td>Net Bogey</td><td className="num">1</td></tr>
                        <tr><td>Net Par</td><td className="num">2</td></tr>
                        <tr><td>Net Birdie</td><td className="num">3</td></tr>
                        <tr><td>Net Eagle</td><td className="num">4</td></tr>
                        <tr><td>Net Double Eagle (Albatross)</td><td className="num">5</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="fine">Pace of play: this is a Stableford event &mdash; if you&rsquo;re worse than a net bogey, pick up and move to the next hole.</p>
                </div>
                <div className="panel">
                  <h3>Scramble Rules</h3>
                  <ul className="clean">
                    <li>Selected shots may be played within <strong>one club length</strong> of the chosen ball, no closer to the hole.</li>
                    <li>You may move the ball between cuts of grass &mdash; but <strong>never onto the putting green</strong>, and <strong>never out of a penalty area or bunker</strong> (a ball that lies in a bunker or penalty area must be played from there).</li>
                    <li>On the greens, place within <strong>one putter-head</strong> of the selected putt, no nearer the hole.</li>
                  </ul>
                  <h4>Tees</h4>
                  <p>Choose the <strong>Green Tees</strong> or the <strong>Green/Hollins Combo Tees</strong>. All players in a group must play from the same tees.</p>
                </div>
              </div>
              <p className="fine center mt22">
                Formats reflect the official Hollins Invitational rules; the final 2026 rules sheet distributed at check-in governs play.
              </p>
            </div>
          </section>
        </section>

        {/* ===== HORSE RACE ===== */}
        <section className={cls("horserace")} id="horserace" role="tabpanel">
          <div className="band">
            <div className="bg bg-horserace" />
            <div className="veil" />
            <div className="inner">
              <div className="eyebrow">Tuesday, After Lunch</div>
              <h2>The Horse Race</h2>
            </div>
          </div>
          <section className="block">
            <div className="wrap">
              <p className="lead">
                The signature event of the Invitational: a knockout <strong>4-person alternate shot</strong> race where
                teams are eliminated hole by hole until a champion is crowned. Flight winners gallop to a single
                Championship hole &mdash; and the gallery bets on the outcome (see the{" "}
                <a href="#parimutuel" onClick={(e) => { e.preventDefault(); go("parimutuel"); }}>Parimutuel</a> tab).
              </p>

              <div className="grid g2 mt30">
                <div className="panel">
                  <h3>How the Race Runs</h3>
                  <ul className="clean">
                    <li>Each team sets its <strong>shot order before the first tee</strong> &mdash; and it&rsquo;s locked for the whole race. If Player&nbsp;3 holes the putt and the team advances, Player&nbsp;4 tees off next.</li>
                    <li>Teams are grouped into three flights, each playing its own set of three holes.</li>
                    <li>One or more teams are <strong>eliminated at the end of every hole</strong>; counts per flight are announced before the race.</li>
                    <li>After three holes, <strong>one winner from each flight</strong> advances to the Championship Final on <strong>Hole 9</strong>.</li>
                    <li>It&rsquo;s a <strong>handicapped</strong> race based on each team&rsquo;s total index &mdash; every team has a fair shot.</li>
                  </ul>
                </div>
                <div className="panel">
                  <h3>The Chip-Off</h3>
                  <p>Ties for elimination are settled by a chip-off:</p>
                  <ul className="clean">
                    <li>The player next in rotation after the one who just holed out hits the chip.</li>
                    <li>A tee toss by the attending pro decides who chips first; waiting players turn their backs so they can&rsquo;t see the other team&rsquo;s chip.</li>
                    <li>A ball on the green beats a ball off the green; closest to the hole advances.</li>
                  </ul>
                  <h4>Championship Final</h4>
                  <p>The three flight winners meet on Hole 9. A final chip-off, if needed, settles 1st (<em>Win</em>), 2nd (<em>Place</em>) and 3rd (<em>Show</em>).</p>
                </div>
              </div>

              <div className="grid g2 mt22">
                <div className="panel">
                  <div className="eyebrow">Flights &amp; Assigned Holes</div>
                  <h3>Who Plays Where</h3>
                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Flight</th>
                          <th>Holes Played</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td className="hs">Green Flight 1</td><td>5, 6 &amp; 7</td></tr>
                        <tr><td className="hs">Combo Flight</td><td>3, 4 &amp; 5</td></tr>
                        <tr><td className="hs">Green Flight 2</td><td>1, 2 &amp; 3</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="fine">All three flight winners converge on Hole 9 for the final.</p>
                </div>
                <div className="panel">
                  <div className="eyebrow">Prize Pool</div>
                  <h3>Racing for the Purse</h3>
                  <div className="prize"><span className="nm big">Champion</span><span className="aw">1st place &mdash; 70% of the buy-in</span></div>
                  <div className="prize"><span className="nm big">Runner-Up</span><span className="aw">2nd place &mdash; 30% of the buy-in</span></div>
                  <p className="fine mt12">The Horse Race pays the last two teams standing. Parimutuel betting payouts are separate &mdash; see the next tab.</p>
                </div>
              </div>

              <div className="histband scenic mt34">
                <div className="bg bg-horserace" />
                <div className="veil" />
                <div className="inner">
                  <div className="q">&ldquo;Two days of great golf, friendly competition &mdash; and a little horse race.&rdquo;</div>
                  <div className="a">Drinks on course at holes 1, 3 &amp; 5</div>
                </div>
              </div>
            </div>
          </section>
        </section>

        {/* ===== PARIMUTUEL ===== */}
        <section className={cls("parimutuel")} id="parimutuel" role="tabpanel">
          <div className="band">
            <div className="bg bg-parimutuel" />
            <div className="veil" />
            <div className="inner">
              <div className="eyebrow">Just Like the Track</div>
              <h2>Parimutuel Betting</h2>
            </div>
          </div>
          <section className="block">
            <div className="wrap">
              <p className="lead">
                Wager on the Horse Race just as you would at the track. Players and spectators alike may bet on any team
                entered &mdash; then cheer them home.
              </p>

              <div className="center mt24">
                <div className="eyebrow">Three Ways to Bet</div>
                <h3>Win, Place &amp; Show</h3>
              </div>
              <div className="betgrid">
                <div className="betcard"><div className="wps">Win</div><div className="big">1st</div><div className="cap">Your team finishes first at the Championship hole.</div></div>
                <div className="betcard"><div className="wps">Place</div><div className="big">2nd</div><div className="cap">Your team finishes first or second.</div></div>
                <div className="betcard"><div className="wps">Show</div><div className="big">3rd</div><div className="cap">Your team finishes in the top three.</div></div>
              </div>

              <div className="grid g2 mt12">
                <div className="panel">
                  <h3>House Rules</h3>
                  <ul className="clean">
                    <li>Minimum bet <strong>$5</strong> · maximum bet <strong>$20</strong>. You may make several different bets.</li>
                    <li>All betting is in <strong>cash</strong> &mdash; correct change encouraged.</li>
                    <li>You&rsquo;ll receive a <strong>ticket</strong> showing your bets; present it to claim your winnings.</li>
                    <li>One team from each flight reaches the final hole &mdash; place your bets accordingly.</li>
                  </ul>
                </div>
                <div className="panel">
                  <h3>Paying Out</h3>
                  <p>The pool is divided among the winning tickets after the Championship hole is decided. Odds move with the money &mdash; the more that&rsquo;s wagered on a team, the shorter the return.</p>
                  <p>Payouts are <strong>announced at lunch on Day&nbsp;2</strong> and are separate from the Horse Race prize purse.</p>
                  <p className="fine">Betting is all in good fun and in support of the day&rsquo;s festivities. Cash only.</p>
                </div>
              </div>
            </div>
          </section>
        </section>

        {/* ===== CONTESTS ===== */}
        <section className={cls("contests")} id="contests" role="tabpanel">
          <div className="band">
            <div className="bg bg-contests" />
            <div className="veil" />
            <div className="inner">
              <div className="eyebrow">Prizes &amp; Bragging Rights</div>
              <h2>Contests &amp; Prizes</h2>
            </div>
          </div>
          <section className="block">
            <div className="wrap">
              <div className="grid g2">
                <div className="panel">
                  <div className="eyebrow">Two-Day Aggregate</div>
                  <h3>Tournament Prizes</h3>
                  <div className="prize"><span className="nm big">Overall Low Gross</span><span className="aw">Over the field</span></div>
                  <div className="prize"><span className="nm big">Overall Low Net</span><span className="aw">Over the field</span></div>
                  <div className="prize"><span className="nm">Green Tee 1st Flight &mdash; Low Net</span><span className="aw">1st · 2nd · 3rd</span></div>
                  <div className="prize"><span className="nm">Green Tee 2nd Flight &mdash; Low Net</span><span className="aw">1st · 2nd · 3rd</span></div>
                  <div className="prize"><span className="nm">Combo Tee Flight &mdash; Low Net</span><span className="aw">1st · 2nd · 3rd</span></div>
                </div>
                <div className="panel">
                  <div className="eyebrow">On the Course &amp; At the Race</div>
                  <h3>Contests &amp; the Race</h3>
                  <div className="prize"><span className="nm big">Closest to the Pin</span><span className="aw">Multiple holes, each day</span></div>
                  <div className="prize"><span className="nm">Horse Race &mdash; Champion</span><span className="aw">1st place, 70% of the buy-in</span></div>
                  <div className="prize"><span className="nm">Horse Race &mdash; Runner-Up</span><span className="aw">2nd place, 30% of the buy-in</span></div>
                  <div className="prize"><span className="nm">Parimutuel Payouts</span><span className="aw">Win / Place / Show</span></div>
                  <p className="fine mt14">The Horse Race pays the last two teams standing; betting payouts are announced at Day&nbsp;2 lunch.</p>
                </div>
              </div>

              <div className="panel mt22 center">
                <div className="rule-orn mb26">
                  <Horseshoe size={24} />
                </div>
                <h3 className="mb6">Every Day, Something to Play For</h3>
                <p className="lead center">
                  Low gross, low net, flight honors, closest-to-the-pin on designated holes, and the thrill of the Horse
                  Race &mdash; there&rsquo;s a prize and a story waiting on nearly every hole.
                </p>
              </div>
            </div>
          </section>
        </section>
      </main>

      <footer className="site">
        <img className="crest" src="/mhi/images/logo.png" alt="Pasatiempo Golf Club logo" />
        <div className="eyebrow">Questions? Contact Us</div>
        <div className="contacts">
          <div>
            <div className="cn">Ann Campbell</div>
            <div className="cr">Tournament Committee</div>
            <div>(831) 206-0827</div>
            <div><a href="mailto:amcampbell3247@gmail.com">amcampbell3247@gmail.com</a></div>
          </div>
          <div>
            <div className="cn">Ian Johnson</div>
            <div className="cr">Pasatiempo 1st Assistant Golf Professional</div>
            <div>(831) 459-9151</div>
            <div><a href="mailto:Ijohnson@pasatiempo.com">Ijohnson@pasatiempo.com</a></div>
          </div>
        </div>
        <p className="legacy">
          The Marion Hollins Invitational honors the legacy of Marion Hollins &mdash; champion golfer, horsewoman, and
          founder of Pasatiempo Golf Club in 1929.
        </p>
        <p className="fine">Pasatiempo Golf Club · Hollins House · Santa Cruz, California</p>
      </footer>
    </>
  );
}
