// Ported El Sombrero page content (images extracted to /public/sombrero/img).
// Trusted, static markup — rendered via dangerouslySetInnerHTML; tabs driven by React.
/* eslint-disable */
export const BODY = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>El Sombrero 2026 — Pasatiempo Men's Club</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&display=swap');

:root{
  --bg:#f1e9d5; --panel:#fbf6ea; --panel-2:#f5eeda;
  --ink:#173121; --ink-soft:#4d5541;
  --green:#163c28; --green-deep:#0e2417;
  --gold:#a7802e; --gold-bright:#c19a45;
  --claret:#7c3a2c;
  --rule:#d6c491; --line:#e6dbba;
  --hero-veil:linear-gradient(180deg,rgba(9,22,14,.30) 0%,rgba(9,22,14,.12) 32%,rgba(9,22,14,.55) 100%);
  --band-veil:linear-gradient(180deg,rgba(9,22,14,.42),rgba(9,22,14,.52));
  --shadow:0 18px 44px -24px rgba(15,36,23,.55);
  --disp:'Cormorant Garamond',Georgia,'Times New Roman',serif;
  --body:Georgia,'Cambria','Times New Roman',serif;
}
*{box-sizing:border-box;}
html{background:var(--bg);scroll-behavior:smooth;}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto;}}
body{
  margin:0;background:var(--bg);color:var(--ink);
  font-family:var(--body);font-size:17px;line-height:1.66;
  -webkit-font-smoothing:antialiased;
}
img{max-width:100%;display:block;}
a{color:var(--claret);text-underline-offset:3px;text-decoration-color:var(--gold);}
a:focus-visible,button:focus-visible{outline:2px solid var(--gold-bright);outline-offset:3px;}

.eyebrow{
  font-family:var(--disp);font-weight:600;text-transform:uppercase;
  letter-spacing:.34em;font-size:14px;color:var(--gold);
}
.rule-orn{display:flex;align-items:center;justify-content:center;gap:14px;color:var(--gold);}
.rule-orn::before,.rule-orn::after{content:"";height:1px;width:min(120px,22vw);background:linear-gradient(90deg,transparent,var(--gold));}
.rule-orn::after{background:linear-gradient(90deg,var(--gold),transparent);}

header.site{
  position:sticky;top:0;z-index:50;
  background:color-mix(in srgb,var(--bg) 90%,transparent);
  backdrop-filter:saturate(1.1) blur(8px);
  border-bottom:1px solid var(--line);
}
.brandbar{
  max-width:1120px;margin:0 auto;padding:12px 22px;
  display:flex;align-items:center;gap:16px;justify-content:space-between;
}
.brand{display:flex;align-items:center;gap:13px;text-decoration:none;color:inherit;flex:none;background:none;border:none;cursor:pointer;font:inherit;}
.brand img{width:42px;height:auto;filter:drop-shadow(0 1px 1px rgba(0,0,0,.15));}
.brand .bt1{font-family:var(--disp);font-weight:600;letter-spacing:.2em;text-transform:uppercase;font-size:15px;line-height:1;color:var(--green);}
.brand .bt2{font-family:var(--disp);font-style:italic;font-size:14px;color:var(--ink-soft);letter-spacing:.02em;}
nav.tabs{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;}
nav.tabs::-webkit-scrollbar{display:none;}
nav.tabs button{
  appearance:none;border:none;background:none;cursor:pointer;white-space:nowrap;
  font-family:var(--disp);font-weight:600;text-transform:uppercase;letter-spacing:.18em;
  font-size:14px;color:var(--ink-soft);padding:9px 15px 7px;border-bottom:2px solid transparent;
  transition:color .2s,border-color .2s;
}
nav.tabs button:hover{color:var(--ink);}
nav.tabs button[aria-current="true"]{color:var(--claret);border-bottom-color:var(--gold);}
@media (max-width:860px){
  .brandbar{flex-direction:column;gap:10px;padding:11px 14px 0;}
  nav.tabs{width:100%;justify-content:flex-start;border-top:1px solid var(--line);padding-top:4px;}
}

.view{display:none;animation:fade .5s ease both;}
.view.active{display:block;}
@keyframes fade{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
@media (prefers-reduced-motion:reduce){.view{animation:none;}}
.wrap{max-width:1000px;margin:0 auto;padding:0 22px;}
.narrow{max-width:820px;}

.hero{position:relative;min-height:70vh;display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;}
.hero .bg{position:absolute;inset:0;background-size:cover;background-position:center 42%;}
.hero .veil{position:absolute;inset:0;background:var(--hero-veil);}
.hero .inner{position:relative;z-index:2;color:#f4eedd;padding:64px 22px;max-width:900px;}
.hero .eyebrow{color:#e7c877;}
.hero h1{
  font-family:var(--disp);font-weight:600;text-transform:uppercase;
  font-size:clamp(44px,8.5vw,104px);line-height:.95;letter-spacing:.02em;
  margin:.18em 0 .06em;text-wrap:balance;text-shadow:0 2px 26px rgba(0,0,0,.5);
}
.hero .tagline{font-family:var(--disp);font-style:italic;font-weight:500;font-size:clamp(22px,4vw,38px);color:#f0d99a;text-shadow:0 2px 18px rgba(0,0,0,.55);margin:.1em 0 .3em;}
.hero .dates{font-family:var(--disp);text-transform:uppercase;letter-spacing:.28em;font-size:clamp(14px,2vw,18px);margin-top:18px;}
.hero .dates span{display:inline-block;border-top:1px solid rgba(240,217,154,.6);border-bottom:1px solid rgba(240,217,154,.6);padding:9px 22px;}
.scrollcue{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:3;color:#f0d99a;opacity:.85;}

.band{position:relative;height:280px;display:flex;align-items:flex-end;overflow:hidden;}
.band .bg{position:absolute;inset:0;background-size:cover;background-position:center 45%;}
.band .veil{position:absolute;inset:0;background:var(--band-veil);}
.band .inner{position:relative;z-index:2;color:#f4eedd;padding:0 22px 30px;max-width:1000px;margin:0 auto;width:100%;}
.band .eyebrow{color:#e7c877;}
.band h2{font-family:var(--disp);font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:clamp(34px,6vw,60px);margin:.05em 0 0;text-shadow:0 2px 20px rgba(0,0,0,.5);line-height:1;}
@media (max-width:600px){.band{height:220px;}}

section.block{padding:52px 0;}
section.block.tight{padding:36px 0;}
.lead{font-size:20px;color:var(--ink-soft);max-width:70ch;}
h3{font-family:var(--disp);font-weight:600;font-size:30px;color:var(--green);letter-spacing:.01em;margin:0 0 .2em;text-wrap:balance;}
h4{font-family:var(--disp);font-weight:600;text-transform:uppercase;letter-spacing:.16em;font-size:16px;color:var(--gold);margin:26px 0 8px;}
.center{text-align:center;}
.center .lead{margin-left:auto;margin-right:auto;}

.panel{
  background:var(--panel);border:1px solid var(--rule);
  box-shadow:inset 0 0 0 1px var(--panel),inset 0 0 0 6px color-mix(in srgb,var(--gold) 22%,var(--panel)),var(--shadow);
  padding:32px 34px;
}
.panel.plain{box-shadow:var(--shadow);}
@media (max-width:600px){.panel{padding:24px 20px;}}

.grid{display:grid;gap:22px;}
.g2{grid-template-columns:1fr 1fr;}
.g3{grid-template-columns:repeat(3,1fr);}
@media (max-width:820px){.g2,.g3{grid-template-columns:1fr;}}

ul.clean{list-style:none;padding:0;margin:12px 0;}
ul.clean li{padding:8px 0 8px 30px;position:relative;border-bottom:1px solid var(--line);}
ul.clean li:last-child{border-bottom:none;}
ul.clean li::before{content:"";position:absolute;left:4px;top:16px;width:9px;height:9px;border:1.5px solid var(--gold);transform:rotate(45deg);}
ul.plainlist{margin:10px 0;padding-left:22px;}
ul.plainlist li{margin:5px 0;}

.fine{font-size:14px;font-style:italic;color:var(--ink-soft);}

.facts{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--rule);background:var(--panel);}
.facts>div{padding:22px 18px;text-align:center;}
.facts>div+div{border-left:1px solid var(--line);}
.facts .k{font-family:var(--disp);text-transform:uppercase;letter-spacing:.2em;font-size:12px;color:var(--gold);font-weight:600;margin-bottom:7px;}
.facts .v{font-family:var(--disp);font-size:24px;color:var(--ink);line-height:1.1;}
.facts .n{font-size:13px;color:var(--ink-soft);font-style:italic;margin-top:4px;}
@media (max-width:760px){.facts{grid-template-columns:1fr 1fr;}.facts>div:nth-child(odd){border-left:none;}.facts>div:nth-child(n+3){border-top:1px solid var(--line);}}

.pullquote{font-family:var(--disp);font-style:italic;font-size:26px;line-height:1.4;color:var(--green);border-left:3px solid var(--gold);padding-left:22px;margin:26px 0;}

.day{display:grid;grid-template-columns:200px 1fr;gap:30px;padding:30px 0;}
.day+.day{border-top:1px solid var(--rule);}
.day-h{text-align:right;}
.day-h .dn{font-family:var(--disp);font-weight:600;font-size:30px;color:var(--green);text-transform:uppercase;line-height:1;}
.day-h .dd{font-family:var(--disp);font-size:19px;color:var(--ink);}
.day-h .dtag{font-style:italic;color:var(--ink-soft);font-size:14px;margin-top:6px;}
.evt{display:grid;grid-template-columns:130px 1fr;gap:16px;padding:10px 0;border-bottom:1px dotted var(--line);}
.evt:last-child{border-bottom:none;}
.evt .t{font-family:var(--disp);font-weight:600;font-size:18px;color:var(--claret);font-variant-numeric:tabular-nums;letter-spacing:.02em;}
.evt .d strong{color:var(--ink);}
.evt .d .sub{color:var(--ink-soft);font-style:italic;font-size:14.5px;}
@media (max-width:760px){.day{grid-template-columns:1fr;gap:12px;}.day-h{text-align:left;}.evt{grid-template-columns:104px 1fr;gap:12px;}}

.tablewrap{overflow-x:auto;margin:12px 0;}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;}
th,td{padding:11px 16px;text-align:left;border-bottom:1px solid var(--line);}
thead th{font-family:var(--disp);text-transform:uppercase;letter-spacing:.14em;font-size:13px;color:var(--gold);font-weight:600;border-bottom:2px solid var(--gold);}
tbody tr:last-child td{border-bottom:none;}
td.num,th.num{text-align:right;}
.hs{font-family:var(--disp);font-size:15px;color:var(--green);font-weight:600;text-transform:uppercase;letter-spacing:.08em;}

.fmt-nine{padding:16px 0;border-top:1px solid var(--line);}
.fmt-nine:first-child{border-top:none;padding-top:2px;}
.fmt-nine .nl{font-family:var(--disp);font-weight:600;font-size:20px;color:var(--claret);}
.chip{display:inline-block;font-family:var(--disp);font-weight:600;text-transform:uppercase;letter-spacing:.1em;font-size:12px;color:var(--gold);border:1px solid var(--gold);padding:3px 12px;margin-top:6px;border-radius:2px;}

.prize{display:flex;justify-content:space-between;gap:18px;align-items:baseline;padding:11px 0;border-bottom:1px dotted var(--line);}
.prize:last-child{border-bottom:none;}
.prize .nm{font-family:var(--disp);font-size:20px;color:var(--ink);}
.prize .nm.big{color:var(--green);font-weight:600;}
.prize .aw{font-style:italic;color:var(--ink-soft);text-align:right;font-size:15px;}

.betgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin:14px 0;}
@media (max-width:700px){.betgrid{grid-template-columns:1fr;}}
.betcard{background:var(--panel-2);border:1px solid var(--rule);padding:22px;text-align:center;}
.betcard .wps{font-family:var(--disp);font-weight:700;text-transform:uppercase;letter-spacing:.16em;color:var(--claret);font-size:15px;}
.betcard .big{font-family:var(--disp);font-size:34px;color:var(--green);line-height:1.1;margin:6px 0;}
.betcard .cap{font-size:13.5px;color:var(--ink-soft);font-style:italic;}

.navcards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
@media (max-width:820px){.navcards{grid-template-columns:1fr;}}
.navcard{appearance:none;text-align:left;cursor:pointer;background:var(--panel);border:1px solid var(--rule);padding:24px;transition:transform .2s,box-shadow .2s;box-shadow:var(--shadow);color:inherit;font:inherit;}
.navcard:hover{transform:translateY(-3px);}
.navcard .ni{color:var(--gold);margin-bottom:10px;}
.navcard h4{margin:0 0 6px;color:var(--green);}
.navcard p{margin:0;font-size:15px;color:var(--ink-soft);}

.tba{border:1px dashed var(--gold);background:var(--panel-2);text-align:center;padding:34px 22px;font-style:italic;color:var(--ink-soft);}
.tba .big{font-family:var(--disp);font-style:normal;font-size:22px;color:var(--ink);display:block;margin-bottom:8px;letter-spacing:.02em;}

.histband{position:relative;height:320px;overflow:hidden;display:flex;align-items:center;justify-content:center;text-align:center;margin:8px 0;}
.histband .bg{position:absolute;inset:0;background-size:cover;background-position:center 55%;}
.histband .veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(9,22,14,.5),rgba(9,22,14,.6));}
.histband .inner{position:relative;z-index:2;color:#f4eedd;padding:22px;max-width:760px;}
.histband .q{font-family:var(--disp);font-style:italic;font-size:clamp(22px,3.6vw,34px);line-height:1.4;text-shadow:0 2px 16px rgba(0,0,0,.5);}
.histband .a{font-family:var(--disp);text-transform:uppercase;letter-spacing:.22em;font-size:13px;color:#e7c877;margin-top:16px;}

footer.site{background:var(--green-deep);color:#e9dfc4;margin-top:60px;padding:52px 22px 40px;text-align:center;}
footer.site .crest{width:118px;margin:0 auto 20px;background:#f4eedd;border-radius:10px;padding:16px 22px;box-shadow:0 10px 26px -14px rgba(0,0,0,.6);}
footer.site h4{color:#e7c877;}
footer.site .contacts{display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:640px;margin:22px auto 0;}
@media (max-width:560px){footer.site .contacts{grid-template-columns:1fr;}}
footer.site .cn{font-family:var(--disp);font-size:22px;color:#f4eedd;}
footer.site .cr{font-style:italic;font-size:14px;color:#b9c3a6;margin-bottom:6px;}
footer.site a{color:#e7c877;}
footer.site .legacy{max-width:60ch;margin:26px auto 0;font-size:15px;color:#c8d0b6;line-height:1.6;}
footer.site .fine{color:#9fac8c;margin-top:24px;font-size:13px;}
</style>

<header class="site">
  <div class="brandbar">
    <button class="brand" data-tab="home" aria-label="El Sombrero — Home">
      <img src="/sombrero/img/img1.png" alt="Pasatiempo palm and sombrero mark">
      <span>
        <span class="bt1">El Sombrero</span><br>
        <span class="bt2">Pasatiempo Men's Club &middot; 2026</span>
      </span>
    </button>
    <nav class="tabs" role="tablist" aria-label="Sections">
      <button data-tab="home" role="tab">Home</button>
      <button data-tab="schedule" role="tab">Schedule</button>
      <button data-tab="flights" role="tab">Flights</button>
      <button data-tab="format" role="tab">Format</button>
      <button data-tab="altshot" role="tab">Alternate Shot</button>
      <button data-tab="horserace" role="tab">Horse Race</button>
      <button data-tab="wagering" role="tab">Wagering</button>
      <button data-tab="prizes" role="tab">Prizes</button>
    </nav>
  </div>
</header>

<main>

<!-- ============================ HOME ============================ -->
<section class="view" id="home" role="tabpanel">
  <div class="hero">
    <div class="bg" style="background-image:url('/sombrero/img/img2.avif')"></div>
    <div class="veil"></div>
    <div class="inner">
      <div class="eyebrow">Pasatiempo Men's Club &middot; 7th Annual</div>
      <h1>El Sombrero</h1>
      <div class="tagline">&ldquo;Find a Partner &amp; Ride 'Til the Horserace&rdquo;</div>
      <div class="dates"><span>August 14 &amp; 15, 2026</span></div>
    </div>
    <div class="scrollcue" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 4v14M6 12l6 6 6-6"/></svg>
    </div>
  </div>

  <section class="block">
    <div class="wrap narrow center">
      <div class="rule-orn"><span class="eyebrow" style="color:var(--gold);">The Men's Club's Premier Event</span></div>
      <p class="lead center" style="margin:18px auto 0;">Two days of two-man match play, hosted food and beverage, and a Friday alternate-shot side event, all building to Saturday's four-hole Horserace — a sudden-death alternate-shot showdown that crowns the champions of El Sombrero.</p>
    </div>
  </section>

  <section class="block tight">
    <div class="wrap">
      <div class="facts">
        <div><div class="k">The Rounds</div><div class="v">Aug 14 &amp; 15</div><div class="n">Friday &amp; Saturday</div></div>
        <div><div class="k">Format</div><div class="v">Match Play</div><div class="n">2-man teams, 2nd ball tiebreak</div></div>
        <div><div class="k">Friday Extra</div><div class="v">Alternate Shot</div><div class="n">Optional 9-hole side event</div></div>
        <div><div class="k">The Clubhouse</div><div class="v">MacKenzie Room</div><div class="n">All meals &amp; hosted drinks</div></div>
      </div>
    </div>
  </section>

  <!-- Quote band (replaces heritage feature) -->
  <div class="histband">
    <div class="bg" style="background-image:url('/sombrero/img/img3.avif')"></div>
    <div class="veil"></div>
    <div class="inner">
      <div class="q">&ldquo;Nine flights, eleven horses, one hole nine finish &mdash; that's El Sombrero.&rdquo;</div>
      <div class="a">The 7th Annual El Sombrero</div>
    </div>
  </div>

  <!-- Nav cards -->
  <section class="block">
    <div class="wrap center">
      <div class="eyebrow">Find Your Way Around</div>
      <h3 style="margin-bottom:26px;">The Weekend, Section by Section</h3>
      <div class="navcards">
        <button class="navcard" data-tab="schedule">
          <div class="ni"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M8 3v4M16 3v4M3 10h18"/></svg></div>
          <h4>Schedule</h4>
          <p>Breakfast through dinner, both days &mdash; every tee time and every meal.</p>
        </button>
        <button class="navcard" data-tab="flights">
          <div class="ni"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4v16M4 4h13l-2 3 2 3H4"/></svg></div>
          <h4>Flights</h4>
          <p>Nine flights, two overall sweeps, and the path to the Horserace.</p>
        </button>
        <button class="navcard" data-tab="format">
          <div class="ni"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div>
          <h4>Format</h4>
          <p>Two-man match play, flights, and how the field is divided.</p>
        </button>
        <button class="navcard" data-tab="altshot">
          <div class="ni"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20 L20 4M4 4h6v6"/></svg></div>
          <h4>Alternate Shot</h4>
          <p>Friday's optional nine &mdash; and how it can punch your ticket to the Horserace.</p>
        </button>
        <button class="navcard" data-tab="horserace">
          <div class="ni"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19h16M6 19V9l4-5 4 5v10M10 12h4"/></svg></div>
          <h4>Horse Race</h4>
          <p>Eleven teams, four holes, one champion &mdash; Saturday afternoon.</p>
        </button>
        <button class="navcard" data-tab="wagering">
          <div class="ni"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8"/><path d="M9.5 15a2.5 2.5 0 0 0 5 0c0-3-5-2-5-5a2.5 2.5 0 0 1 5 0"/></svg></div>
          <h4>Wagering</h4>
          <p>Optional cash games, plus pari-mutuel betting through Homestretch.</p>
        </button>
        <button class="navcard" data-tab="prizes">
          <div class="ni"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 21h8M12 17v4M6 4h12v3a6 6 0 0 1-12 0V4Z"/><path d="M6 6H3v2a4 4 0 0 0 4 4M18 6h3v2a4 4 0 0 1-4 4"/></svg></div>
          <h4>Prizes</h4>
          <p>Closest-to-the-pin, flight money, and the full Horserace purse.</p>
        </button>
      </div>
    </div>
  </section>
</section>

<!-- ============================ SCHEDULE ============================ -->
<section class="view" id="schedule" role="tabpanel">
  <div class="band"><div class="bg" style="background-image:url('/sombrero/img/img4.avif')"></div><div class="veil"></div>
    <div class="inner"><div class="eyebrow">Two Days at Pasatiempo</div><h2>Schedule of Events</h2></div></div>
  <section class="block">
    <div class="wrap">
      <div class="panel plain">
        <div class="day">
          <div class="day-h"><div class="dn">Friday</div><div class="dd">August 14th</div><div class="dtag">Round 1 &amp; Alternate Shot</div></div>
          <div class="day-events">
            <div class="evt"><div class="t">7:45 AM</div><div class="d"><strong>Continental breakfast</strong> begins.<div class="sub">Made-to-Order breakfast (burrito, sandwich, or the MacKenzie breakfast; vegetarian available) served 7:45&ndash;8:45 AM.</div></div></div>
            <div class="evt"><div class="t">Shotgun</div><div class="d"><strong>Round 1 &mdash; Match Play.</strong><div class="sub">Two-man teams, second ball breaks ties.</div></div></div>
            <div class="evt"><div class="t">12&ndash;12:45 PM</div><div class="d"><strong>Lunch</strong> &mdash; wraps, sandwiches, fruit, chips &amp; cookies.</div></div>
            <div class="evt"><div class="t">Afternoon</div><div class="d"><strong>Optional 9-hole Alternate Shot</strong> after the 2nd match.<div class="sub">27 holes played Friday for those who opt in &mdash; assumed in unless you tell us otherwise.</div></div></div>
            <div class="evt"><div class="t">3:15&ndash;4 PM</div><div class="d"><strong>Snacks</strong> between rounds.</div></div>
            <div class="evt"><div class="t">5:30&ndash;6:30 PM</div><div class="d"><strong>Hosted bar.</strong></div></div>
            <div class="evt"><div class="t">6:30&ndash;8 PM</div><div class="d"><strong>Dinner</strong> &mdash; BBQ + dessert.</div></div>
          </div>
        </div>
        <div class="day">
          <div class="day-h"><div class="dn">Saturday</div><div class="dd">August 15th</div><div class="dtag">Round 2 &amp; the Horserace</div></div>
          <div class="day-events">
            <div class="evt"><div class="t">7:45 AM</div><div class="d"><strong>Continental &amp; Made-to-Order breakfast</strong>, 7:45&ndash;8:45 AM.</div></div>
            <div class="evt"><div class="t">Shotgun</div><div class="d"><strong>Round 2 &mdash; Match Play.</strong><div class="sub">Flight winners determined after the 4th match.</div></div></div>
            <div class="evt"><div class="t">12&ndash;12:45 PM</div><div class="d"><strong>Lunch</strong> &mdash; wings &amp; veggies.</div></div>
            <div class="evt"><div class="t">3:15&ndash;4 PM</div><div class="d"><strong>Snacks</strong> between rounds.</div></div>
            <div class="evt"><div class="t">3&ndash;4 PM</div><div class="d"><strong>Hosted bar</strong>, prior to the Horserace.</div></div>
            <div class="evt"><div class="t">After golf</div><div class="d"><strong>The Horserace</strong> &mdash; 11 teams, 4-hole alternate shot elimination for the championship.</div></div>
            <div class="evt"><div class="t">3:15&ndash;7 PM</div><div class="d"><strong>Dinner</strong> &mdash; full taco spread.</div></div>
          </div>
        </div>
      </div>
      <p class="fine center" style="margin-top:22px;">Hosted beer &amp; wine all day, both days. All food and beverage served out of The MacKenzie Room. Times and menus follow last year's format and will be confirmed closer to the event.</p>
    </div>
  </section>
</section>

<!-- ============================ FLIGHTS ============================ -->
<section class="view" id="flights" role="tabpanel">
  <div class="band"><div class="bg" style="background-image:url('/sombrero/img/img5.avif')"></div><div class="veil"></div>
    <div class="inner"><div class="eyebrow">How the Field Is Divided</div><h2>Flights</h2></div></div>
  <section class="block">
    <div class="wrap">
      <div class="grid g2" style="margin-top:10px;">
        <div class="panel">
          <div class="eyebrow">Two-Day Competition</div>
          <h3>Tournament Flights</h3>
          <p>The field of two-man teams is divided into <strong>nine flights</strong> by team handicap. Every flight plays for its own daily and tournament money, and the flights are grouped into two overall sweeps for the biggest prizes.</p>
          <ul class="clean">
            <li><strong>Flights 1&ndash;5</strong> &mdash; lower-index teams, own overall sweep</li>
            <li><strong>Flights 6&ndash;9</strong> &mdash; higher-index teams, own overall sweep</li>
          </ul>
        </div>
        <div class="panel">
          <div class="eyebrow">Saturday, After the 4th Match</div>
          <h3>Path to the Horserace</h3>
          <p>Eleven teams punch their ticket to Saturday's Horserace:</p>
          <ul class="clean">
            <li><strong>9 flight winners</strong> &mdash; one from each of the nine tournament flights</li>
            <li><strong>2 Alternate Shot qualifiers</strong> &mdash; the low team from each side of the course in Friday's optional Alternate Shot</li>
          </ul>
          <p class="fine">See the Horse Race tab for how the 11 teams play down to a champion.</p>
        </div>
      </div>

      <h4 style="margin-top:36px;">Teams &amp; Pairings</h4>
      <div class="tba">
        <span class="big">Flight assignments &amp; pairings</span>
        Pairings and flight placements will be posted here once finalized. Check back closer to the event &mdash; and see your golf professional with any questions.
      </div>
    </div>
  </section>
</section>

<!-- ============================ FORMAT ============================ -->
<section class="view" id="format" role="tabpanel">
  <div class="band"><div class="bg" style="background-image:url('/sombrero/img/img5.avif')"></div><div class="veil"></div>
    <div class="inner"><div class="eyebrow">How the Field Is Divided &amp; Played</div><h2>Format</h2></div></div>
  <section class="block">
    <div class="wrap">
      <p class="lead">If we reach at least <strong>36 teams</strong>, the format is two-man match play with the second ball breaking ties, shotgun start both days. Fewer than 36 teams signed up and the format may change.</p>

      <div class="panel" style="margin-top:30px;max-width:640px;margin-left:auto;margin-right:auto;">
        <div class="eyebrow">Both Days</div>
        <h3>Match Play</h3>
        <ul class="clean">
          <li>Two-man teams compete head-to-head; the better ball of the team wins the hole.</li>
          <li>If the match is tied, the <strong>second ball</strong> (the team's other score) breaks the tie.</li>
          <li>Shotgun start both days.</li>
          <li>Top-performing twosomes in each flight are eligible for daily and tournament prize money.</li>
        </ul>
      </div>
      <p class="fine center" style="margin-top:22px;">See the Flights tab for how the nine flights and overall sweeps work.</p>
    </div>
  </section>
</section>

<!-- ============================ ALTERNATE SHOT ============================ -->
<section class="view" id="altshot" role="tabpanel">
  <div class="band"><div class="bg" style="background-image:url('/sombrero/img/img6.avif')"></div><div class="veil"></div>
    <div class="inner"><div class="eyebrow">Friday Afternoon</div><h2>Alternate Shot</h2></div></div>
  <section class="block">
    <div class="wrap">
      <p class="lead">An optional 9-hole alternate shot competition, played Friday afternoon after the second match (27 holes total for those who play it). It does <strong>not</strong> affect your flight standing in the main event.</p>

      <div class="grid g2" style="margin-top:30px;">
        <div class="panel">
          <h3>How It's Played</h3>
          <ul class="clean">
            <li>Team handicap uses <strong>50%</strong> of the combined 9-hole indexes for your designated holes.</li>
            <li>Before the round, each team assigns one player to odd-numbered holes and the other to even-numbered holes &mdash; that assignment holds all round.</li>
            <li>Partners alternate shots until the team holes out; the pre-assigned player always hits the next tee shot, regardless of who finished the prior hole.</li>
          </ul>
        </div>
        <div class="panel">
          <h3>Opting In &mdash; and the Horserace</h3>
          <p><strong>If we don't hear otherwise, we'll assume you and your partner are in</strong> &mdash; just let us know before your second match Friday if you'd like to opt out.</p>
          <div class="chip">Bonus Qualification</div>
          <p style="margin-top:10px;">The <strong>low team from each side</strong> of the course in the Alternate Shot automatically qualifies for Saturday's Horserace &mdash; even without winning a flight.</p>
        </div>
      </div>

      <h4 style="margin-top:36px;">Optional Cash Pool</h4>
      <div class="panel plain">
        <div class="prize"><span class="nm big">Alternate Shot Pool</span><span class="aw">$40 per team</span></div>
        <p class="fine" style="margin-top:8px;">Pays the top three teams on each side of the course. Cash only, collected at registration.</p>
      </div>
    </div>
  </section>
</section>

<!-- ============================ HORSE RACE ============================ -->
<section class="view" id="horserace" role="tabpanel">
  <div class="band"><div class="bg" style="background-image:url('/sombrero/img/img7.avif')"></div><div class="veil"></div>
    <div class="inner"><div class="eyebrow">Saturday Afternoon</div><h2>The Horserace</h2></div></div>
  <section class="block">
    <div class="wrap">
      <p class="lead">Once flight winners are determined after Saturday's 4th match, <strong>eleven teams</strong> &mdash; the nine flight winners plus the two Alternate Shot side-winners &mdash; play a 4-hole alternate shot elimination to crown the champions.</p>

      <div class="grid g2" style="margin-top:30px;">
        <div class="panel">
          <h3>The Elimination</h3>
          <div class="tablewrap">
            <table>
              <thead><tr><th>Hole</th><th class="num">Teams Eliminated</th></tr></thead>
              <tbody>
                <tr><td class="hs">Hole #1</td><td class="num">3</td></tr>
                <tr><td class="hs">Hole #7</td><td class="num">3</td></tr>
                <tr><td class="hs">Hole #8</td><td class="num">2</td></tr>
                <tr><td class="hs">Hole #9</td><td class="num">Final 3 &mdash; play for the championship</td></tr>
              </tbody>
            </table>
          </div>
          <p class="fine">Team handicap = 50% of combined team total. The lowest-handicap team is stroked off, with handicap priority given in the order above.</p>
        </div>
        <div class="panel">
          <h3>The Chip-Off</h3>
          <ul class="clean">
            <li>Ties on any hole are settled by a chip-off. The chipper is the player who did <strong>not</strong> hole the team's last putt on that hole.</li>
            <li>For a chip to qualify, the ball must come to rest on the <strong>putting surface</strong>.</li>
            <li>Team members who participate in a chip-off does not affect the normal alternate-shot order.</li>
            <li>If tied after Hole #9, a chip-off decides the champion. If both balls miss the green, the chip-off repeats from the same spot.</li>
          </ul>
          <p style="margin-top:10px;"><strong>The eventual winner of the Horserace gets their entry fee back!</strong></p>
        </div>
      </div>

      <h4 style="margin-top:36px;">Horserace Purse</h4>
      <div class="panel plain">
        <div class="prize"><span class="nm big">Winner</span><span class="aw">$800</span></div>
        <div class="prize"><span class="nm big">Runner-up</span><span class="aw">$500</span></div>
        <div class="prize"><span class="nm">3rd place</span><span class="aw">$300</span></div>
        <div class="prize"><span class="nm">Each other team from the winning team's flight</span><span class="aw">$100 per team</span></div>
      </div>

      <div class="histband" style="margin-top:34px;">
        <div class="bg" style="background-image:url('/sombrero/img/img7.avif')"></div>
        <div class="veil"></div>
        <div class="inner"><div class="q">&ldquo;Three holes to survive, one hole to win it all.&rdquo;</div><div class="a">Saturday, after the 4th match</div></div>
      </div>
    </div>
  </section>
</section>

<!-- ============================ WAGERING ============================ -->
<section class="view" id="wagering" role="tabpanel">
  <div class="band"><div class="bg" style="background-image:url('/sombrero/img/img8.avif')"></div><div class="veil"></div>
    <div class="inner"><div class="eyebrow">Optional, All in Good Fun</div><h2>Wagering &amp; Cash Games</h2></div></div>
  <section class="block">
    <div class="wrap">
      <p class="lead">Beyond flight and Horserace money, there are a couple of optional ways to get in on the action &mdash; cash pools at registration, and online pari-mutuel wagering on the Horserace itself.</p>

      <div class="center" style="margin-top:24px;"><div class="eyebrow">Cash Buy-Ins</div><h3>At Registration</h3></div>
      <div class="betgrid">
        <div class="betcard"><div class="wps">Hole-in-One &amp; Most Points</div><div class="big">$40</div><div class="cap">$20 to the Hole-in-One pool (split if multiple aces; if none, closest-to-the-pin on any par-3 over both days wins $400). $20 to the team with the most points over the whole field across both days (ties broken by matches won).</div></div>
        <div class="betcard"><div class="wps">Alternate Shot Pool</div><div class="big">$40</div><div class="cap">Pays the top three teams on each side of the course in Friday's optional Alternate Shot.</div></div>
      </div>
      <p class="fine center">$80 gets a team into both pools, or play one, the other, or neither &mdash; entirely optional, cash only.</p>

      <div class="grid g2" style="margin-top:30px;">
        <div class="panel">
          <h3>Pari-Mutuel Wagering</h3>
          <p>Get in on the wagering fun through <strong>Homestretch</strong>, an online pari-mutuel betting platform you can use from your computer or phone to study the field and place your bets ahead of time.</p>
          <ul class="clean">
            <li>Cash for your wagers is still collected in person before the first match.</li>
            <li>All wagers must be placed, and all cash collected, before the first match tees off Friday morning.</li>
          </ul>
        </div>
        <div class="panel">
          <h3>Questions on Wagering?</h3>
          <p>Details and sign-in instructions for Homestretch will be sent in a separate email closer to the event. Cash for both the pools and pari-mutuel wagers is collected in person at registration.</p>
          <p class="fine" style="margin-top:10px;">Studying up from home beats a snap decision on the first tee.</p>
        </div>
      </div>
    </div>
  </section>
</section>

<!-- ============================ PRIZES ============================ -->
<section class="view" id="prizes" role="tabpanel">
  <div class="band"><div class="bg" style="background-image:url('/sombrero/img/img9.avif')"></div><div class="veil"></div>
    <div class="inner"><div class="eyebrow">Cash, Every Day</div><h2>Prizes &amp; Payouts</h2></div></div>
  <section class="block">
    <div class="wrap">

      <div class="panel plain">
        <div class="prize"><span class="nm big">Closest to the Pin</span><span class="aw">$50 per hole, per day &mdash; all 5 par-3s</span></div>
      </div>

      <h4 style="margin-top:36px;">Flight Money (Per Team)</h4>
      <div class="grid g2">
        <div class="panel">
          <div class="eyebrow">Day 1</div>
          <div class="prize"><span class="nm">Most points, each flight</span><span class="aw">$50</span></div>
          <div class="prize"><span class="nm">Most points, flights 1&ndash;5 overall</span><span class="aw">$200</span></div>
          <div class="prize"><span class="nm">Most points, flights 6&ndash;9 overall</span><span class="aw">$200</span></div>
        </div>
        <div class="panel">
          <div class="eyebrow">Day 2</div>
          <div class="prize"><span class="nm">Most points, each flight</span><span class="aw">$50</span></div>
          <div class="prize"><span class="nm">Most points, flights 1&ndash;5</span><span class="aw">$200</span></div>
          <div class="prize"><span class="nm">Most points, flights 6&ndash;9</span><span class="aw">$200</span></div>
        </div>
      </div>

      <div class="grid g2" style="margin-top:22px;">
        <div class="panel">
          <div class="eyebrow">Tournament Overall</div>
          <div class="prize"><span class="nm big">Most points, flights 1&ndash;5</span><span class="aw">$300</span></div>
          <div class="prize"><span class="nm big">Most points, flights 6&ndash;9</span><span class="aw">$300</span></div>
          <div class="prize"><span class="nm">Flights 1&ndash;5 &mdash; runner-up</span><span class="aw">$200</span></div>
          <div class="prize"><span class="nm">Flights 6&ndash;9 &mdash; runner-up</span><span class="aw">$200</span></div>
          <div class="prize"><span class="nm">Flights 1&ndash;5 &mdash; 3rd place</span><span class="aw">$150</span></div>
          <div class="prize"><span class="nm">Flights 6&ndash;9 &mdash; 3rd place</span><span class="aw">$150</span></div>
        </div>
        <div class="panel">
          <div class="eyebrow">Saturday Afternoon</div>
          <h3 style="font-size:24px;">Horserace Purse</h3>
          <div class="prize"><span class="nm big">Winner</span><span class="aw">$800</span></div>
          <div class="prize"><span class="nm big">Runner-up</span><span class="aw">$500</span></div>
          <div class="prize"><span class="nm">3rd place</span><span class="aw">$300</span></div>
          <div class="prize"><span class="nm">Other 3 teams from winner's flight</span><span class="aw">$100 each</span></div>
          <p class="fine" style="margin-top:10px;">The Horserace champion also gets their entry fee back.</p>
        </div>
      </div>

      <div class="panel" style="margin-top:22px;text-align:center;">
        <h3 style="margin-bottom:6px;">Something to Play For, All Weekend</h3>
        <p class="lead center" style="margin:0 auto;">Closest-to-the-pin, flight money, tournament sweeps, and the Horserace purse &mdash; there's cash on the line from the first tee shot Friday to the final chip-off Saturday.</p>
      </div>
    </div>
  </section>
</section>

</main>

<footer class="site">
  <img class="crest" src="/sombrero/img/img10.png" alt="Pasatiempo Golf Club">
  <div class="eyebrow" style="color:#e7c877;">Questions? Contact Us</div>
  <div class="contacts">
    <div><div class="cn">Ken Woods</div><div class="cr">Director of Golf</div><div>(831) 459-9159</div></div>
    <div><div class="cn">Chris Ingram</div><div class="cr">Head Golf Professional</div><div>(831) 459-9155</div></div>
  </div>
  <p class="legacy">The 7th Annual El Sombrero &mdash; the Pasatiempo Men's Club's premier event of the season.</p>
  <p class="fine">Pasatiempo Golf Club &middot; Santa Cruz, California</p>
</footer>



</body>
</html>`;
