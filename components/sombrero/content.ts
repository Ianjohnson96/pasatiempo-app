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
  max-width:1200px;margin:0 auto;padding:12px 22px;
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
  font-family:var(--disp);font-weight:600;text-transform:uppercase;letter-spacing:.12em;
  font-size:14px;color:var(--ink-soft);padding:9px 11px 7px;border-bottom:2px solid transparent;
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
/* Grid items default to min-width:auto, so a panel wrapping a wide table
   (e.g. the Horserace elimination table's mobile min-width) refuses to shrink
   and overflows the page on phones. Let them shrink; .tablewrap scrolls. */
.grid>*{min-width:0;}
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

.tablewrap{overflow-x:auto;margin:12px 0;-webkit-overflow-scrolling:touch;}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums;}
th,td{padding:11px 16px;text-align:left;border-bottom:1px solid var(--line);}
@media (max-width:600px){th,td{padding:9px 10px;}table{font-size:15px;}.tablewrap table{min-width:360px;}}
thead th{font-family:var(--disp);text-transform:uppercase;letter-spacing:.14em;font-size:13px;color:var(--gold);font-weight:600;border-bottom:2px solid var(--gold);}
tbody tr:last-child td{border-bottom:none;}
td.num,th.num{text-align:right;}
.hs{font-family:var(--disp);font-size:15px;color:var(--green);font-weight:600;text-transform:uppercase;letter-spacing:.08em;}

.fmt-nine{padding:16px 0;border-top:1px solid var(--line);}
.fmt-nine:first-child{border-top:none;padding-top:2px;}
.fmt-nine .nl{font-family:var(--disp);font-weight:600;font-size:20px;color:var(--claret);}
.chip{display:inline-block;font-family:var(--disp);font-weight:600;text-transform:uppercase;letter-spacing:.1em;font-size:12px;color:var(--gold);border:1px solid var(--gold);padding:3px 12px;margin-top:6px;border-radius:2px;}

/* --- Flight rosters & pairings --- */
.flightgrid{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:20px;}
@media (max-width:900px){.flightgrid{grid-template-columns:1fr;}}
.flightcard{background:var(--panel);border:1px solid var(--rule);box-shadow:var(--shadow);padding:22px 24px;}
.fc-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;border-bottom:2px solid var(--gold);padding-bottom:9px;margin-bottom:4px;}
.fc-n{font-family:var(--disp);font-weight:600;text-transform:uppercase;letter-spacing:.1em;font-size:21px;color:var(--green);}
.fc-m{font-family:var(--disp);font-size:14px;color:var(--gold);text-transform:uppercase;letter-spacing:.12em;white-space:nowrap;}
.fc-team{display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:baseline;padding:9px 0;border-bottom:1px dotted var(--line);}
.fc-team:last-of-type{border-bottom:none;}
.fc-seed{font-family:var(--disp);font-weight:700;font-size:15px;color:var(--gold);text-align:center;}
.fc-p{font-size:15.5px;line-height:1.45;}
.fc-p .idx{color:var(--ink-soft);font-size:13.5px;}
.fc-c{font-family:var(--disp);font-weight:600;font-size:18px;color:var(--claret);font-variant-numeric:tabular-nums;}
.fc-holes{margin-top:14px;padding-top:12px;border-top:1px solid var(--rule);}
.fc-hl{font-family:var(--disp);text-transform:uppercase;letter-spacing:.16em;font-size:11.5px;color:var(--gold);font-weight:600;margin-bottom:7px;}
.fc-hrow{display:grid;grid-template-columns:1fr auto;gap:10px;font-size:14.5px;padding:4px 0;}
.fc-hrow .mt{color:var(--ink-soft);font-style:italic;}
.fc-hrow .hh{font-family:var(--disp);font-weight:600;color:var(--green);font-variant-numeric:tabular-nums;letter-spacing:.04em;}

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

.heritage{align-items:center;}
.coursefacts{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--rule);border:1px solid var(--rule);margin-top:34px;}
.coursefacts>div{background:var(--panel);padding:20px 14px;text-align:center;}
.coursefacts .cf-n{font-family:var(--disp);font-size:30px;color:var(--green);line-height:1;font-weight:600;}
.coursefacts .cf-l{font-family:var(--disp);text-transform:uppercase;letter-spacing:.16em;font-size:11px;color:var(--gold);margin-top:8px;}
.coursefacts .cf-s{font-size:12.5px;color:var(--ink-soft);font-style:italic;margin-top:5px;line-height:1.4;}
@media (max-width:760px){.coursefacts{grid-template-columns:1fr 1fr;}}
.histphoto{background:var(--panel);border:1px solid var(--rule);padding:10px;box-shadow:var(--shadow);}
.histphoto img{width:100%;height:auto;display:block;filter:saturate(1.03) contrast(1.02);}
.histphoto .cap{display:block;text-align:center;font-family:var(--disp);font-style:italic;font-size:14px;color:var(--ink-soft);padding:9px 6px 3px;}
.heritage h4:first-child{margin-top:0;}

footer.site{background:var(--green-deep);color:#e9dfc4;margin-top:60px;padding:52px 22px 40px;text-align:center;}
footer.site .crest{width:118px;margin:0 auto 20px;background:#f4eedd;border-radius:10px;padding:16px 22px;box-shadow:0 10px 26px -14px rgba(0,0,0,.6);}
footer.site h4{color:#e7c877;}
footer.site .contacts{display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:640px;margin:22px auto 0;}
@media (max-width:560px){footer.site .contacts{grid-template-columns:1fr;}}
footer.site .cn{font-family:var(--disp);font-size:22px;color:#f4eedd;}
footer.site .cr{font-style:italic;font-size:14px;color:#b9c3a6;margin-bottom:6px;}
footer.site .committee{display:flex;flex-wrap:wrap;justify-content:center;gap:18px 30px;max-width:780px;margin:16px auto 0;}
footer.site .committee>div{min-width:150px;padding:0 4px;}
footer.site .committee .cn{font-size:19px;}
footer.site .committee .cr{margin-bottom:0;color:#c8d0b6;}
footer.site .committee .lead-role{color:#e7c877;}
@media (max-width:520px){footer.site .committee{gap:16px 22px;}footer.site .committee>div{min-width:132px;}}
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
      <div class="eyebrow">Pasatiempo Men's Club &middot; Member-Member</div>
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
      <p class="lead center" style="margin:18px auto 0;">Two days of two-man match play, meals both days, and a Friday alternate-shot side event, all building to Saturday's four-hole Horserace — a sudden-death alternate-shot showdown that crowns the champions of El Sombrero.</p>
    </div>
  </section>

  <section class="block tight">
    <div class="wrap">
      <div class="facts">
        <div><div class="k">The Rounds</div><div class="v">Aug 14 &amp; 15</div><div class="n">Friday &amp; Saturday</div></div>
        <div><div class="k">Format</div><div class="v">Match Play</div><div class="n">2-man teams, 2nd ball tiebreak</div></div>
        <div><div class="k">Friday Extra</div><div class="v">Alternate Shot</div><div class="n">Optional 9-hole side event</div></div>
        <div><div class="k">The Clubhouse</div><div class="v">MacKenzie Room</div><div class="n">All meals, both days</div></div>
      </div>
    </div>
  </section>

  <!-- Quote band (replaces heritage feature) -->
  <div class="histband">
    <div class="bg" style="background-image:url('/sombrero/img/img3.avif')"></div>
    <div class="veil"></div>
    <div class="inner">
      <div class="q">&ldquo;Nine flights, eleven horses, and one Pasatiempo &mdash; that's El Sombrero.&rdquo;</div>
      <div class="a">El Sombrero &middot; Pasatiempo Men's Club</div>
    </div>
  </div>

  <!-- Heritage / Pasatiempo history -->
  <section class="block">
    <div class="wrap">
      <div class="center">
        <div class="rule-orn"><span class="eyebrow" style="color:var(--gold);">Since 1929</span></div>
        <h3 style="margin:14px 0 8px;">MacKenzie's Masterpiece</h3>
        <p class="lead center" style="margin:0 auto 30px;">The El Sombrero is played over one of the finest works of the game's most storied architect &mdash; Dr. Alister MacKenzie's Pasatiempo, a course he considered among his very best and made his home until the end of his life.</p>
      </div>
      <div class="grid g2 heritage">
        <div class="histphoto">
          <img src="/sombrero/img/mackenzie-portrait.jpg" alt="Dr. Alister MacKenzie, golf course architect, early 1900s" loading="lazy">
          <span class="cap">Dr. Alister MacKenzie &middot; Library of Congress</span>
        </div>
        <div>
          <h4>The Architect</h4>
          <p><strong>Dr. Alister MacKenzie</strong> &mdash; the Scottish-trained surgeon turned golf architect behind <strong>Cypress Point</strong>, <strong>Augusta National</strong>, and <strong>Royal Melbourne</strong> &mdash; carried the naturalistic, strategic style he first honed as a WWI camouflage expert to the hills above Santa Cruz.</p>
          <p>Of all his courses, he settled here: MacKenzie built a home along the sixth fairway and lived it until his death in <strong>1934</strong>. Pasatiempo, many believe, was the design closest to his heart.</p>
        </div>
      </div>
      <div class="grid g2 heritage" style="margin-top:26px;">
        <div>
          <h4>The Course</h4>
          <p>Opened in <strong>1929</strong>, the routing climbs from the clubhouse into the hills and tumbles back down through some of the boldest greens and most dramatic bunkering in American golf. The closing stretch &mdash; capped by a par-4 regarded among the world's greatest &mdash; asks every bit of nerve and strategy MacKenzie prized.</p>
          <p>Decades of restoration have returned his original contours, cross-bunkers, and sprawling sand to their intended scale &mdash; the same test the field takes on each year for the El Sombrero.</p>
          <h4 style="margin-top:22px;">A Champion's Vision</h4>
          <p>The club was commissioned by <strong>Marion Hollins</strong>, the 1921 U.S. Women's Amateur champion who brought MacKenzie to Santa Cruz and named it <em>Pasatiempo</em> &mdash; Spanish for &ldquo;pastime.&rdquo;</p>
        </div>
        <div class="histphoto">
          <img src="/sombrero/img/course-green.jpg" alt="Terraced MacKenzie bunkering guarding a green at Pasatiempo" loading="lazy">
          <span class="cap">Terraced bunkers guarding a MacKenzie green</span>
        </div>
      </div>

      <div class="grid g2 heritage" style="margin-top:26px;">
        <div class="histphoto">
          <img src="/sombrero/img/course-bunkers.jpg" alt="Cascading MacKenzie bunkers at Pasatiempo Golf Club" loading="lazy">
          <span class="cap">Cascading sand &mdash; a MacKenzie signature</span>
        </div>
        <div>
          <h4>The Bunkering</h4>
          <p>Nothing gives Pasatiempo away faster than its sand. MacKenzie's bunkers sprawl and finger their way into the fairways with ragged, wind-blown edges &mdash; built to look as though the land made them, not a crew with shovels.</p>
          <p>They are as strategic as they are beautiful: each one asks a question off the tee and again on the approach, rewarding the player who picks a line and commits to it &mdash; exactly the sort of decision match play punishes and rewards.</p>
        </div>
      </div>

      <div class="coursefacts">
        <div><div class="cf-n">1929</div><div class="cf-l">Opened</div><div class="cf-s">September 8th</div></div>
        <div><div class="cf-n">18</div><div class="cf-l">MacKenzie Holes</div><div class="cf-s">His California home course</div></div>
        <div><div class="cf-n">6th</div><div class="cf-l">The Doctor's Fairway</div><div class="cf-s">Where he lived until 1934</div></div>
        <div><div class="cf-n">16th</div><div class="cf-l">The Famous One</div><div class="cf-s">Among the world's great par-4s</div></div>
      </div>
    </div>
  </section>

  <!-- Course panorama band -->
  <div class="histband" style="height:420px;">
    <div class="bg" style="background-image:url('/sombrero/img/course-wide.jpg')"></div>
    <div class="veil"></div>
    <div class="inner">
      <div class="q">&ldquo;The chief object of every golf course architect worth his salt is to imitate the beauties of nature so closely as to make his work indistinguishable from nature itself.&rdquo;</div>
      <div class="a">Dr. Alister MacKenzie &middot; Golf Architecture, 1920</div>
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
          <p>Nine flights, two big flights, and the path to the Horserace.</p>
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
          <div class="day-h"><div class="dn">Friday</div><div class="dd">August 14th</div><div class="dtag">Matches 1 &amp; 2 + Alternate Shot</div></div>
          <div class="day-events">
            <div class="evt"><div class="t">7:45 AM</div><div class="d"><strong>Practice facility opens.</strong></div></div>
            <div class="evt"><div class="t">7:45&ndash;9:30 AM</div><div class="d"><strong>Registration, Pari-Mutuel, Tee Prize pick-up &amp; breakfast.</strong><div class="sub">MacKenzie Bar &amp; Grill. All optional cash buy-ins and pari-mutuel wagers are collected here &mdash; before the first match tees off.</div></div></div>
            <div class="evt"><div class="t">9:30&ndash;12 PM</div><div class="d"><strong>Shotgun &mdash; 1st Nine-Hole Match.</strong></div></div>
            <div class="evt"><div class="t">12&ndash;12:30 PM</div><div class="d"><strong>Break &amp; snacks</strong> &mdash; build-your-own box lunch.</div></div>
            <div class="evt"><div class="t">12:30&ndash;3 PM</div><div class="d"><strong>Shotgun &mdash; 2nd Nine-Hole Match.</strong></div></div>
            <div class="evt"><div class="t">3&ndash;3:30 PM</div><div class="d"><strong>Break &amp; snacks.</strong></div></div>
            <div class="evt"><div class="t">4:15&ndash;6:15 PM</div><div class="d"><strong>Optional Two-Man Alternate Shot.</strong><div class="sub">Field split into two big flights, one on each nine. The top three teams on each side split the cash pool; the low team on each side qualifies for Saturday's Horserace.</div></div></div>
            <div class="evt"><div class="t">6:15&ndash;???</div><div class="d"><strong>BBQ Chicken Dinner.</strong></div></div>
          </div>
        </div>
        <div class="day">
          <div class="day-h"><div class="dn">Saturday</div><div class="dd">August 15th</div><div class="dtag">Matches 3 &amp; 4 + the Horserace</div></div>
          <div class="day-events">
            <div class="evt"><div class="t">8:00 AM</div><div class="d"><strong>Practice facility opens &amp; continental breakfast.</strong></div></div>
            <div class="evt"><div class="t">9:30&ndash;12 PM</div><div class="d"><strong>Shotgun &mdash; 3rd Nine-Hole Match.</strong></div></div>
            <div class="evt"><div class="t">12&ndash;12:30 PM</div><div class="d"><strong>Break &amp; snacks</strong> &mdash; box lunch pick-up.</div></div>
            <div class="evt"><div class="t">12:30&ndash;3 PM</div><div class="d"><strong>Shotgun &mdash; 4th Nine-Hole Match.</strong><div class="sub">Paired off flight standings &mdash; 1st plays 2nd, 3rd plays 4th. Flight winners determined after this match.</div></div></div>
            <div class="evt"><div class="t">3:15 PM</div><div class="d"><strong>Taco Buffet opens.</strong></div></div>
            <div class="evt"><div class="t">4:15&ndash;???</div><div class="d"><strong>Horse Race Championship</strong>, followed by the <strong>Awards Presentation</strong>.<div class="sub">Taco Buffet &mdash; MacKenzie Bar &amp; Grill.</div></div></div>
          </div>
        </div>
      </div>
      <p class="fine center" style="margin-top:22px;">All food and beverage served out of The MacKenzie Bar &amp; Grill. Flights, hole assignments and pairings are now posted on the <strong>Flights</strong> tab, with the full Alternate Shot and Horserace rules on their own tabs. This information will <strong>not</strong> be handed out at Friday check-in &mdash; please print or save it if you'd like it handy during the event.</p>
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
          <h3>Flights &amp; Big Flights</h3>
          <p>The 36 teams are split into <strong>nine flights of four</strong>, seeded by combined handicap index. Those nine flights are then grouped into <strong>two big flights</strong>. The two levels play for different money &mdash; worth knowing which prize you're chasing.</p>

          <h4 style="margin-top:22px;">Your Flight &mdash; Four Teams</h4>
          <p>Round-robin match play against the other three teams in your flight. This decides your <strong>flight winner and runner-up</strong> ($150 and $50) and who advances to the Horserace.</p>

          <h4 style="margin-top:22px;">Your Big Flight &mdash; Flights 1&ndash;5 or 6&ndash;9</h4>
          <p>Every team in your big flight competes on <strong>total points</strong> for the day money and the overall payouts. That is <em>one</em> pool across the whole big flight &mdash; there is no separate day-money pot for each individual flight.</p>
          <ul class="clean">
            <li><strong>Flights 1&ndash;5</strong> &mdash; the lower-index big flight, 20 teams</li>
            <li><strong>Flights 6&ndash;9</strong> &mdash; the higher-index big flight, 16 teams</li>
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
      <p>Thirty-six teams, nine flights of four, seeded by combined handicap index. All matches are played from the <strong>White tees</strong>. Each flight plays a <strong>round-robin</strong> &mdash; you meet all three of the other teams in your flight.</p>

      <div class="panel plain" style="margin-top:18px;">
        <div class="eyebrow">The Rotation &mdash; Same in Every Flight</div>
        <h3 style="font-size:24px;">Who You Play, and When</h3>
        <p style="margin-top:6px;">Teams below are numbered <strong>1&ndash;4</strong> by seed within each flight. The first three matches are a full round robin &mdash; you meet all three of the other teams &mdash; and the rotation is identical across all nine flights. Find your flight card for your hole assignments.</p>
        <div class="tablewrap">
          <table>
            <thead><tr><th>Match</th><th>Tee Time</th><th>First Hole Listed</th><th>Second Hole Listed</th></tr></thead>
            <tbody>
              <tr><td class="hs">1st</td><td>Fri, Aug 14 &middot; 9:30 AM</td><td>Seed 1 vs 4</td><td>Seed 2 vs 3</td></tr>
              <tr><td class="hs">2nd</td><td>Fri, Aug 14 &middot; 12:30 PM</td><td>Seed 4 vs 2</td><td>Seed 1 vs 3</td></tr>
              <tr><td class="hs">3rd</td><td>Sat, Aug 15 &middot; 9:30 AM</td><td>Seed 1 vs 2</td><td>Seed 3 vs 4</td></tr>
              <tr><td class="hs">4th</td><td>Sat, Aug 15 &middot; 12:30 PM</td><td><strong>1st vs 2nd</strong> in flight</td><td><strong>3rd vs 4th</strong> in flight</td></tr>
            </tbody>
          </table>
        </div>
        <div class="chip">The 4th Match Is Different</div>
        <p style="margin-top:10px;">Saturday afternoon's final match is <strong>not</strong> part of the round robin &mdash; it is paired off the <strong>standings in your flight</strong> after three matches. The flight leader plays the second-place team, and third plays fourth. Standings, pairings and hole assignments for the 4th match will be posted on site Saturday.</p>
      </div>

      <div class="flightgrid">

        <div class="flightcard">
          <div class="fc-head"><div class="fc-n">Flight 1</div><div class="fc-m">2.6 &ndash; 7.9</div></div>
          <div class="fc-team"><span class="fc-seed">1</span><span class="fc-p">Tyler Doyle <span class="idx">(+0.3)</span> &amp; Shawn Medved <span class="idx">(2.9)</span></span><span class="fc-c">2.6</span></div>
          <div class="fc-team"><span class="fc-seed">2</span><span class="fc-p">Randy Reed <span class="idx">(0.0)</span> &amp; Dennis Ventry Jr. <span class="idx">(4.4)</span></span><span class="fc-c">4.4</span></div>
          <div class="fc-team"><span class="fc-seed">3</span><span class="fc-p">Joshua Lutz <span class="idx">(4.6)</span> &amp; Ned Nix <span class="idx">(2.7)</span></span><span class="fc-c">7.3</span></div>
          <div class="fc-team"><span class="fc-seed">4</span><span class="fc-p">Scott Smith <span class="idx">(0.7)</span> &amp; Naiming Fu <span class="idx">(7.2)</span></span><span class="fc-c">7.9</span></div>
          <div class="fc-holes"><div class="fc-hl">Hole Assignments</div>
            <div class="fc-hrow"><span class="mt">Match 1 &middot; Fri 9:30 AM</span><span class="hh">1A &middot; 1B</span></div>
            <div class="fc-hrow"><span class="mt">Match 2 &middot; Fri 12:30 PM</span><span class="hh">10 &middot; 11</span></div>
            <div class="fc-hrow"><span class="mt">Match 3 &middot; Sat 9:30 AM</span><span class="hh">1A &middot; 1B</span></div>
          </div>
        </div>

        <div class="flightcard">
          <div class="fc-head"><div class="fc-n">Flight 2</div><div class="fc-m">8.6 &ndash; 13.7</div></div>
          <div class="fc-team"><span class="fc-seed">1</span><span class="fc-p">Matthew Miller <span class="idx">(2.6)</span> &amp; Russell Kingon <span class="idx">(6.0)</span></span><span class="fc-c">8.6</span></div>
          <div class="fc-team"><span class="fc-seed">2</span><span class="fc-p">Byron Finney <span class="idx">(3.4)</span> &amp; Dave Fawcett <span class="idx">(5.2)</span></span><span class="fc-c">8.6</span></div>
          <div class="fc-team"><span class="fc-seed">3</span><span class="fc-p">Ron Kaminski <span class="idx">(9.6)</span> &amp; Giuliano Kaminski <span class="idx">(+0.6)</span></span><span class="fc-c">9.0</span></div>
          <div class="fc-team"><span class="fc-seed">4</span><span class="fc-p">Paul Grossi <span class="idx">(8.1)</span> &amp; Steven Yoshioka <span class="idx">(5.6)</span></span><span class="fc-c">13.7</span></div>
          <div class="fc-holes"><div class="fc-hl">Hole Assignments</div>
            <div class="fc-hrow"><span class="mt">Match 1 &middot; Fri 9:30 AM</span><span class="hh">2 &middot; 3</span></div>
            <div class="fc-hrow"><span class="mt">Match 2 &middot; Fri 12:30 PM</span><span class="hh">12A &middot; 12B</span></div>
            <div class="fc-hrow"><span class="mt">Match 3 &middot; Sat 9:30 AM</span><span class="hh">2 &middot; 3</span></div>
          </div>
        </div>

        <div class="flightcard">
          <div class="fc-head"><div class="fc-n">Flight 3</div><div class="fc-m">13.9 &ndash; 15.9</div></div>
          <div class="fc-team"><span class="fc-seed">1</span><span class="fc-p">Gregg Bargas <span class="idx">(3.7)</span> &amp; David Cook <span class="idx">(10.2)</span></span><span class="fc-c">13.9</span></div>
          <div class="fc-team"><span class="fc-seed">2</span><span class="fc-p">John Airey <span class="idx">(7.5)</span> &amp; Brian Sherer <span class="idx">(6.4)</span></span><span class="fc-c">13.9</span></div>
          <div class="fc-team"><span class="fc-seed">3</span><span class="fc-p">Stu Hurvitz <span class="idx">(6.3)</span> &amp; Todd Turowski <span class="idx">(8.5)</span></span><span class="fc-c">14.8</span></div>
          <div class="fc-team"><span class="fc-seed">4</span><span class="fc-p">Korsen Yu <span class="idx">(8.4)</span> &amp; Oscar De la Rosa <span class="idx">(7.5)</span></span><span class="fc-c">15.9</span></div>
          <div class="fc-holes"><div class="fc-hl">Hole Assignments</div>
            <div class="fc-hrow"><span class="mt">Match 1 &middot; Fri 9:30 AM</span><span class="hh">4 &middot; 5</span></div>
            <div class="fc-hrow"><span class="mt">Match 2 &middot; Fri 12:30 PM</span><span class="hh">13 &middot; 14</span></div>
            <div class="fc-hrow"><span class="mt">Match 3 &middot; Sat 9:30 AM</span><span class="hh">4 &middot; 5</span></div>
          </div>
        </div>

        <div class="flightcard">
          <div class="fc-head"><div class="fc-n">Flight 4</div><div class="fc-m">16.7 &ndash; 18.1</div></div>
          <div class="fc-team"><span class="fc-seed">1</span><span class="fc-p">Bob Cayton <span class="idx">(6.5)</span> &amp; Craig Viau <span class="idx">(10.2)</span></span><span class="fc-c">16.7</span></div>
          <div class="fc-team"><span class="fc-seed">2</span><span class="fc-p">Dan Pereyra <span class="idx">(7.3)</span> &amp; Jeff Fraser <span class="idx">(9.6)</span></span><span class="fc-c">16.9</span></div>
          <div class="fc-team"><span class="fc-seed">3</span><span class="fc-p">Michael Zaballos <span class="idx">(8.1)</span> &amp; Rob Born <span class="idx">(9.7)</span></span><span class="fc-c">17.8</span></div>
          <div class="fc-team"><span class="fc-seed">4</span><span class="fc-p">Jack Yao <span class="idx">(9.7)</span> &amp; Daniel Busch <span class="idx">(8.4)</span></span><span class="fc-c">18.1</span></div>
          <div class="fc-holes"><div class="fc-hl">Hole Assignments</div>
            <div class="fc-hrow"><span class="mt">Match 1 &middot; Fri 9:30 AM</span><span class="hh">6 &middot; 7</span></div>
            <div class="fc-hrow"><span class="mt">Match 2 &middot; Fri 12:30 PM</span><span class="hh">15 &middot; 16</span></div>
            <div class="fc-hrow"><span class="mt">Match 3 &middot; Sat 9:30 AM</span><span class="hh">6 &middot; 7</span></div>
          </div>
        </div>

        <div class="flightcard">
          <div class="fc-head"><div class="fc-n">Flight 5</div><div class="fc-m">18.3 &ndash; 19.3</div></div>
          <div class="fc-team"><span class="fc-seed">1</span><span class="fc-p">Lauren Gagnier <span class="idx">(5.7)</span> &amp; John Mandella <span class="idx">(12.6)</span></span><span class="fc-c">18.3</span></div>
          <div class="fc-team"><span class="fc-seed">2</span><span class="fc-p">Curtiss Smith <span class="idx">(12.6)</span> &amp; Ben Aslan <span class="idx">(6.3)</span></span><span class="fc-c">18.9</span></div>
          <div class="fc-team"><span class="fc-seed">3</span><span class="fc-p">Drew Achabal <span class="idx">(5.6)</span> &amp; Mark Luthman <span class="idx">(13.5)</span></span><span class="fc-c">19.1</span></div>
          <div class="fc-team"><span class="fc-seed">4</span><span class="fc-p">Blake Douglas <span class="idx">(9.1)</span> &amp; Todd Shaffer <span class="idx">(10.2)</span></span><span class="fc-c">19.3</span></div>
          <div class="fc-holes"><div class="fc-hl">Hole Assignments</div>
            <div class="fc-hrow"><span class="mt">Match 1 &middot; Fri 9:30 AM</span><span class="hh">8 &middot; 9</span></div>
            <div class="fc-hrow"><span class="mt">Match 2 &middot; Fri 12:30 PM</span><span class="hh">17 &middot; 18</span></div>
            <div class="fc-hrow"><span class="mt">Match 3 &middot; Sat 9:30 AM</span><span class="hh">8 &middot; 9</span></div>
          </div>
        </div>

        <div class="flightcard">
          <div class="fc-head"><div class="fc-n">Flight 6</div><div class="fc-m">20.1 &ndash; 22.0</div></div>
          <div class="fc-team"><span class="fc-seed">1</span><span class="fc-p">Frank Rosales <span class="idx">(12.8)</span> &amp; Matt Romig <span class="idx">(7.3)</span></span><span class="fc-c">20.1</span></div>
          <div class="fc-team"><span class="fc-seed">2</span><span class="fc-p">Richard Pearce <span class="idx">(10.7)</span> &amp; Eric Takahashi <span class="idx">(10.4)</span></span><span class="fc-c">21.1</span></div>
          <div class="fc-team"><span class="fc-seed">3</span><span class="fc-p">Mark Collishaw <span class="idx">(6.8)</span> &amp; Stephen McGillin <span class="idx">(14.7)</span></span><span class="fc-c">21.5</span></div>
          <div class="fc-team"><span class="fc-seed">4</span><span class="fc-p">Sage Turowski <span class="idx">(11.8)</span> &amp; Gregory Rajala <span class="idx">(10.2)</span></span><span class="fc-c">22.0</span></div>
          <div class="fc-holes"><div class="fc-hl">Hole Assignments</div>
            <div class="fc-hrow"><span class="mt">Match 1 &middot; Fri 9:30 AM</span><span class="hh">10 &middot; 11</span></div>
            <div class="fc-hrow"><span class="mt">Match 2 &middot; Fri 12:30 PM</span><span class="hh">1 &middot; 2</span></div>
            <div class="fc-hrow"><span class="mt">Match 3 &middot; Sat 9:30 AM</span><span class="hh">10 &middot; 11</span></div>
          </div>
        </div>

        <div class="flightcard">
          <div class="fc-head"><div class="fc-n">Flight 7</div><div class="fc-m">22.9 &ndash; 26.0</div></div>
          <div class="fc-team"><span class="fc-seed">1</span><span class="fc-p">Brad Smith <span class="idx">(15.7)</span> &amp; Mathieu Fidiam <span class="idx">(7.2)</span></span><span class="fc-c">22.9</span></div>
          <div class="fc-team"><span class="fc-seed">2</span><span class="fc-p">Yukon Cherng <span class="idx">(11.5)</span> &amp; Karuna Cayton <span class="idx">(12.0)</span></span><span class="fc-c">23.5</span></div>
          <div class="fc-team"><span class="fc-seed">3</span><span class="fc-p">Greg Muller <span class="idx">(6.9)</span> &amp; Ken Grohe <span class="idx">(18.3)</span></span><span class="fc-c">25.2</span></div>
          <div class="fc-team"><span class="fc-seed">4</span><span class="fc-p">Mike Masunaga <span class="idx">(14.7)</span> &amp; Mark Casey <span class="idx">(11.3)</span></span><span class="fc-c">26.0</span></div>
          <div class="fc-holes"><div class="fc-hl">Hole Assignments</div>
            <div class="fc-hrow"><span class="mt">Match 1 &middot; Fri 9:30 AM</span><span class="hh">12 &middot; 13</span></div>
            <div class="fc-hrow"><span class="mt">Match 2 &middot; Fri 12:30 PM</span><span class="hh">4 &middot; 5</span></div>
            <div class="fc-hrow"><span class="mt">Match 3 &middot; Sat 9:30 AM</span><span class="hh">12 &middot; 13</span></div>
          </div>
        </div>

        <div class="flightcard">
          <div class="fc-head"><div class="fc-n">Flight 8</div><div class="fc-m">26.5 &ndash; 31.6</div></div>
          <div class="fc-team"><span class="fc-seed">1</span><span class="fc-p">Daniel Wallis <span class="idx">(9.0)</span> &amp; Marte Formico <span class="idx">(17.5)</span></span><span class="fc-c">26.5</span></div>
          <div class="fc-team"><span class="fc-seed">2</span><span class="fc-p">Tom Evenson <span class="idx">(18.3)</span> &amp; Rob Selvi <span class="idx">(8.3)</span></span><span class="fc-c">26.6</span></div>
          <div class="fc-team"><span class="fc-seed">3</span><span class="fc-p">Rob Buntz <span class="idx">(14.2)</span> &amp; James Jackson <span class="idx">(13.1)</span></span><span class="fc-c">27.3</span></div>
          <div class="fc-team"><span class="fc-seed">4</span><span class="fc-p">Charlie Verutti <span class="idx">(14.1)</span> &amp; Steve Yates <span class="idx">(17.5)</span></span><span class="fc-c">31.6</span></div>
          <div class="fc-holes"><div class="fc-hl">Hole Assignments</div>
            <div class="fc-hrow"><span class="mt">Match 1 &middot; Fri 9:30 AM</span><span class="hh">14 &middot; 15</span></div>
            <div class="fc-hrow"><span class="mt">Match 2 &middot; Fri 12:30 PM</span><span class="hh">6 &middot; 7</span></div>
            <div class="fc-hrow"><span class="mt">Match 3 &middot; Sat 9:30 AM</span><span class="hh">14 &middot; 15</span></div>
          </div>
        </div>

        <div class="flightcard">
          <div class="fc-head"><div class="fc-n">Flight 9</div><div class="fc-m">34.3 &ndash; 40.1</div></div>
          <div class="fc-team"><span class="fc-seed">1</span><span class="fc-p">Donald Finn <span class="idx">(19.3)</span> &amp; Patrick Ellington <span class="idx">(15.0)</span></span><span class="fc-c">34.3</span></div>
          <div class="fc-team"><span class="fc-seed">2</span><span class="fc-p">Michael Rose <span class="idx">(15.4)</span> &amp; Mike Aymar <span class="idx">(21.3)</span></span><span class="fc-c">36.7</span></div>
          <div class="fc-team"><span class="fc-seed">3</span><span class="fc-p">Richard Battaglia <span class="idx">(16.1)</span> &amp; Kyle Sather <span class="idx">(22.3)</span></span><span class="fc-c">38.4</span></div>
          <div class="fc-team"><span class="fc-seed">4</span><span class="fc-p">Sahaj Grewall <span class="idx">(21.6)</span> &amp; Jeet Harika <span class="idx">(18.5)</span></span><span class="fc-c">40.1</span></div>
          <div class="fc-holes"><div class="fc-hl">Hole Assignments</div>
            <div class="fc-hrow"><span class="mt">Match 1 &middot; Fri 9:30 AM</span><span class="hh">17 &middot; 18</span></div>
            <div class="fc-hrow"><span class="mt">Match 2 &middot; Fri 12:30 PM</span><span class="hh">8 &middot; 9</span></div>
            <div class="fc-hrow"><span class="mt">Match 3 &middot; Sat 9:30 AM</span><span class="hh">17 &middot; 18</span></div>
          </div>
        </div>

      </div>

      <p class="fine center" style="margin-top:26px;">Flights 1&ndash;5 open on the front nine Friday morning; Flights 6&ndash;9 open on the back. Please print or save this page &mdash; hole assignments will <strong>not</strong> be handed out at Friday check-in. Questions? See your golf professional.</p>
    </div>
  </section>
</section>

<!-- ============================ FORMAT ============================ -->
<section class="view" id="format" role="tabpanel">
  <div class="band"><div class="bg" style="background-image:url('/sombrero/img/img5.avif')"></div><div class="veil"></div>
    <div class="inner"><div class="eyebrow">How the Field Is Divided &amp; Played</div><h2>Format</h2></div></div>
  <section class="block">
    <div class="wrap">
      <p class="lead">A two-man <strong>Member-Member</strong> played as <strong>match play within your flight</strong>. The field is broken into <strong>nine flights of four teams</strong>, set by the combined indexes of the partners. The first three matches are a full round robin; the fourth is paired off your flight standings. <strong>Eleven teams</strong> reach Saturday afternoon's Horserace &mdash; the winner of each of the nine flights, plus two from Friday's optional Alternate Shot.</p>

      <div class="panel" style="margin-top:30px;">
        <div class="eyebrow">Both Days</div>
        <h3>Best Ball, Second Ball Breaks the Tie</h3>
        <ul class="clean">
          <li>The format is the <strong>best ball of partners</strong>, with the <strong>second ball breaking the tie</strong> &mdash; spinning off the low handicap in the foursome.</li>
          <li><strong>One point</strong> is awarded for winning each hole, and an <strong>additional point</strong> for winning the match.</li>
          <li>Halved holes are worth <strong>&frac12; point each</strong>.</li>
          <li>Shotgun start, match play within your own flight across four nine-hole matches over the two days &mdash; the <strong>first three a full round robin</strong>, the <strong>fourth paired off your flight standings</strong> (1st plays 2nd, 3rd plays 4th).</li>
        </ul>
      </div>

      <h4 style="margin-top:36px;">The Four Nine-Hole Matches</h4>
      <p>Every match is Match Play Best Ball Net; the second ball breaks the tie on any given hole. <strong>100% of that day's index</strong> is used.</p>
      <div class="tablewrap">
        <table>
          <thead><tr><th>Match</th><th>Tee Time</th><th>Index</th><th>Flights 1&ndash;5</th><th>Flights 6&ndash;9</th></tr></thead>
          <tbody>
            <tr><td class="hs">1st</td><td>Fri, Aug 14 &middot; 9:30 AM</td><td>100% Aug 14</td><td>Front nine</td><td>Back nine</td></tr>
            <tr><td class="hs">2nd</td><td>Fri, Aug 14 &middot; 12:30 PM</td><td>100% Aug 14</td><td>Back nine</td><td>Front nine</td></tr>
            <tr><td class="hs">3rd</td><td>Sat, Aug 15 &middot; 9:30 AM</td><td>100% Aug 15</td><td>Front nine</td><td>Back nine</td></tr>
            <tr><td class="hs">4th</td><td>Sat, Aug 15 &middot; 12:30 PM</td><td>100% Aug 15</td><td>Back nine</td><td>Front nine</td></tr>
          </tbody>
        </table>
      </div>

      <p class="fine">The 4th match is <strong>paired off your flight standings</strong> after three matches &mdash; 1st plays 2nd, 3rd plays 4th. Hole assignments for that match are posted on site Saturday.</p>

      <h4 style="margin-top:36px;">Policies</h4>
      <div class="grid g2">
        <div class="panel">
          <h3 style="font-size:24px;">Injury or Withdrawal</h3>
          <p>If a player can't start or continue due to injury, illness, or other unforeseen circumstance, their partner is encouraged to play on as a one-person team &mdash; no substitute or replacement player is permitted.</p>
          <ul class="clean">
            <li>Play continues as traditional best ball; each team counts the lowest score of its available players on every hole.</li>
            <li>If a team fails to begin, or the whole team withdraws before completing the 5th hole, the opposing two-player team earns <strong>6 points</strong>.</li>
            <li>If a player withdraws after the 6th hole has begun, the two-player team's maximum is the points it holds at that point, plus the hole in play if they win it &mdash; provided they have 5 or more points (otherwise they are capped at 6). With 5 or more points, the bonus match point is also awarded.</li>
            <li>There is no maximum number of points for a single-player team.</li>
          </ul>
        </div>
        <div class="panel">
          <h3 style="font-size:24px;">Showing Up Late &amp; Ties</h3>
          <p><strong>Late starts:</strong> a team that misses the start of a match forfeits each hole missed. If one player is present, they may play until their partner arrives. If neither shows, the Injury policy applies.</p>
          <div class="chip">Flight Ties</div>
          <p style="margin-top:10px;">If a flight is tied after the fourth match, a <strong>chip-off</strong> between a member of each team determines who advances to the Horserace.</p>
        </div>
      </div>

      <p class="fine center" style="margin-top:24px;">Flights, hole assignments and pairings are now posted on the <strong>Flights</strong> tab. Please silence cell phones during play; use is limited to the parking lots and clubhouse area before and after your round.</p>
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
            <li><strong>Both players hit a tee shot.</strong> Once you select which tee shot to play, the player who did <em>not</em> hit that drive plays the next shot &mdash; then partners alternate shots until the ball is holed.</li>
            <li>A minimum of <strong>three drives must be used by each player</strong> over the 9-hole competition.</li>
            <li>Team handicap uses <strong>50%</strong> of the combined nine-hole indexes of the partners on your designated nine holes.</li>
          </ul>
          <p class="fine" style="margin-top:10px;">The field is split into <strong>two big flights</strong> &mdash; one on each nine of the golf course.</p>
        </div>
        <div class="panel">
          <h3>Opting In &mdash; and the Horserace</h3>
          <p><strong>If we don't hear otherwise, we'll assume you and your partner are in</strong> &mdash; just let us know before you go out for your second match Friday if you'd like to opt out. This is optional and does <strong>not</strong> affect your standing in your flight.</p>
          <div class="chip">Bonus Qualification</div>
          <p style="margin-top:10px;">The <strong>low team from each side</strong> of the course in the Alternate Shot automatically qualifies for Saturday's Horserace &mdash; a way in <em>without</em> winning your flight.</p>
        </div>
      </div>

      <h4 style="margin-top:36px;">Optional Cash Pool</h4>
      <div class="panel plain">
        <div class="prize"><span class="nm big">Alternate Shot Pool</span><span class="aw">$40 per team</span></div>
        <p class="fine" style="margin-top:8px;">Pays the top three teams on each side of the course. Cash only, collected at Friday registration.</p>
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
          <p class="fine">Team handicap = 50% of combined team total. The lowest-handicap team is stroked off, with handicap priority given in the order above &mdash; Hole #1 (1), Hole #7 (2), Hole #8 (3), Hole #9 (4).</p>
          <div class="chip">Order of Play</div>
          <p style="margin-top:10px;">Before teeing off on the 1st hole, each team selects the player who hits the <strong>initial tee shot</strong>. Partners alternate from that point forward until the competition is complete.</p>
        </div>
        <div class="panel">
          <h3>The Chip-Off</h3>
          <ul class="clean">
            <li>Ties on any hole are settled by a chip-off. The chipper is the player who did <strong>not</strong> hole the team's last putt on that hole.</li>
            <li>For a chip to qualify, the ball must come to rest on the <strong>putting surface</strong>.</li>
            <li>Taking part in a chip-off does not affect the normal alternate-shot order.</li>
            <li>If tied after Hole #9, a chip-off decides the champion. If both balls miss the green, the chip-off repeats from the same spot.</li>
          </ul>
          <p style="margin-top:10px;"><strong>The eventual winner of the Horserace gets their entry fee back!</strong></p>
        </div>
      </div>

      <h4 style="margin-top:36px;">Horserace Purse</h4>
      <div class="panel plain">
        <div class="prize"><span class="nm big">Winner</span><span class="aw">$600</span></div>
        <div class="prize"><span class="nm big">Runner-up</span><span class="aw">$350</span></div>
        <div class="prize"><span class="nm">3rd place</span><span class="aw">$200</span></div>
        <div class="prize"><span class="nm">Other three teams from the winning team's flight</span><span class="aw">$50 per team</span></div>
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
          <p>Details and sign-in instructions for Homestretch will be sent in a separate email shortly. Cash for both the pools and pari-mutuel wagers is collected in person at registration.</p>
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

      <p class="fine" style="margin-top:14px;">All payouts below are <strong>per team</strong>, paid in cash.</p>
      <p style="margin-top:10px;">The <strong>Day Money</strong> and <strong>Overall Payouts</strong> below are contested across the two <strong>big flights</strong> &mdash; <strong>Flights 1&ndash;5</strong> as one pool and <strong>Flights 6&ndash;9</strong> as another &mdash; on total points. They are <em>not</em> awarded flight by flight. Each of the nine individual flights pays its own winner and runner-up separately; see <em>Flight Winners &amp; Runners-Up</em>.</p>

      <h4 style="margin-top:30px;">Day Money</h4>
      <div class="grid g2">
        <div class="panel">
          <div class="eyebrow">Day 1 &mdash; Friday</div>
          <div class="prize"><span class="nm big">Most points, flights 1&ndash;5 overall</span><span class="aw">$100</span></div>
          <div class="prize"><span class="nm big">Most points, flights 6&ndash;9 overall</span><span class="aw">$100</span></div>
          <div class="prize"><span class="nm">2nd most points, flights 1&ndash;5 overall</span><span class="aw">$50</span></div>
          <div class="prize"><span class="nm">2nd most points, flights 6&ndash;9 overall</span><span class="aw">$50</span></div>
        </div>
        <div class="panel">
          <div class="eyebrow">Day 2 &mdash; Saturday</div>
          <div class="prize"><span class="nm big">Most points, flights 1&ndash;5 overall</span><span class="aw">$100</span></div>
          <div class="prize"><span class="nm big">Most points, flights 6&ndash;9 overall</span><span class="aw">$100</span></div>
          <div class="prize"><span class="nm">2nd most points, flights 1&ndash;5 overall</span><span class="aw">$50</span></div>
          <div class="prize"><span class="nm">2nd most points, flights 6&ndash;9 overall</span><span class="aw">$50</span></div>
        </div>
      </div>

      <div class="grid g2" style="margin-top:22px;">
        <div class="panel">
          <div class="eyebrow">Tournament Overall</div>
          <h3 style="font-size:24px;">Overall Payouts</h3>
          <div class="prize"><span class="nm big">Most points, flights 1&ndash;5</span><span class="aw">$300</span></div>
          <div class="prize"><span class="nm big">Most points, flights 6&ndash;9</span><span class="aw">$300</span></div>
          <div class="prize"><span class="nm">Flights 1&ndash;5 &mdash; runner-up</span><span class="aw">$200</span></div>
          <div class="prize"><span class="nm">Flights 6&ndash;9 &mdash; runner-up</span><span class="aw">$200</span></div>
          <div class="prize"><span class="nm">Flights 1&ndash;5 &mdash; 3rd place</span><span class="aw">$100</span></div>
          <div class="prize"><span class="nm">Flights 6&ndash;9 &mdash; 3rd place</span><span class="aw">$100</span></div>
        </div>
        <div class="panel">
          <div class="eyebrow">Each of the Nine Flights</div>
          <h3 style="font-size:24px;">Flight Winners &amp; Runners-Up</h3>
          <div class="prize"><span class="nm big">1st place</span><span class="aw">$150</span></div>
          <div class="prize"><span class="nm">2nd place</span><span class="aw">$50</span></div>
          <p class="fine" style="margin-top:10px;">Each of the nine flight winners also earns a place in Saturday afternoon's Horserace.</p>
        </div>
      </div>

      <div class="grid g2" style="margin-top:22px;">
        <div class="panel">
          <div class="eyebrow">Saturday Afternoon</div>
          <h3 style="font-size:24px;">Horserace Purse</h3>
          <div class="prize"><span class="nm big">Winner</span><span class="aw">$600</span></div>
          <div class="prize"><span class="nm big">Runner-up</span><span class="aw">$350</span></div>
          <div class="prize"><span class="nm">3rd place</span><span class="aw">$200</span></div>
          <div class="prize"><span class="nm">Other three teams from the winning team's flight</span><span class="aw">$50 each</span></div>
          <p class="fine" style="margin-top:10px;">The Horserace champion also gets their entry fee back.</p>
        </div>
        <div class="panel">
          <div class="eyebrow">Optional Buy-Ins</div>
          <h3 style="font-size:24px;">Hole-in-One &amp; Most Points</h3>
          <div class="prize"><span class="nm">Hole-in-One pool</span><span class="aw">$20 of the $40</span></div>
          <div class="prize"><span class="nm">Most points over the entire field</span><span class="aw">$20 of the $40</span></div>
          <p class="fine" style="margin-top:10px;">If no ace is made, the closest shot on any Closest-to-the-Pin contest Friday or Saturday wins <strong>$400</strong>. Most-points ties are broken by matches won over the two days. See the Wagering tab for full details.</p>
        </div>
      </div>

      <div class="panel" style="margin-top:22px;text-align:center;">
        <h3 style="margin-bottom:6px;">Something to Play For, All Weekend</h3>
        <p class="lead center" style="margin:0 auto;">Closest-to-the-pin, flight money, big-flight money, and the Horserace purse &mdash; there's cash on the line from the first tee shot Friday to the final chip-off Saturday.</p>
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
  <div class="rule-orn" style="margin-top:40px;"><span class="eyebrow" style="color:#e7c877;">Tournament Committee</span></div>
  <div class="committee">
    <div><div class="cn">Tyler Doyle</div><div class="cr lead-role">Men's Club President</div></div>
    <div><div class="cn">Stu Hurvitz</div><div class="cr lead-role">Vice President</div></div>
    <div><div class="cn">Ken Woods</div><div class="cr">PGA Director of Golf</div></div>
    <div><div class="cn">Tommy Dembski</div><div class="cr">Board Member</div></div>
    <div><div class="cn">Mark Collishaw</div><div class="cr">Board Member</div></div>
  </div>
  <p class="legacy" style="margin-top:22px;">The El Sombrero &mdash; the Pasatiempo Men's Club's premier Member-Member of the season.</p>
  <p class="fine">Pasatiempo Golf Club &middot; Santa Cruz, California</p>
</footer>



</body>
</html>`;
