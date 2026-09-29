/* ---------- Summary and Analysis pages ----------
   Summary (the one-page view), Scorecard, Spend per round, Trends and Stuck money. Measures come from 17-metrics.js
   over assort/current (ASSORT), charts from 16-charts.js. Brands (74-brands.js) sits in the same section. */
let ANA = null, ANA_KEY = null;
const AN = {open: new Set(), level: 'cats'};
function anaNow(){
  // Redo the analysis when the upload, a subcategory's name or a category's name changes.
  const key = ASSORT ? [ASSORT.at || '', SUBCATS.map(s => s.id + ':' + s.name).join(','), BASE ? Object.values(BASE.cats || {}).map(c => c.name).join(',') : ''].join('|') : null;
  if (key !== ANA_KEY){
    ANA_KEY = key;
    const names = Object.fromEntries(Object.entries((BASE && BASE.cats) || (PLAN && PLAN.cats) || {}).map(([k, v]) => [k, v.name]));
    ANA = analyze(ASSORT, names, Object.fromEntries(SUBCATS.map(s => [s.id, s.name])));
  }
  return ANA;
}
const aPct = v => v == null ? '—' : Math.round(v * 100) + '%';
const aChg = v => v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(Math.round(v * 100)) + '%';
const aX = (v, d = 1) => v == null ? '—' : v.toFixed(d);
const aWk = v => v == null ? '—' : Math.round(v) + '';
const aDelta = v => v == null ? '' : `<span class="${v >= 0 ? 'up' : 'dn'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(v * 100))}%</span>`;
const GRADE_TXT = {good: '✓ Within guideline', near: '~ Near guideline', bad: '! Outside guideline'};
const aGrade = g => g ? `<span class="gr ${g}">${GRADE_TXT[g]}</span>` : '';
const aHeat = g => g ? ` class="r num h-${g}" title="${GRADE_TXT[g].slice(2)}"` : ' class="r num"';
const mLab = m => monthShort(m) + ' ' + m.slice(2, 4);
// Growth compares only months that have a year-earlier month in the data (17-metrics.js); say which.
function anaCmpText(a){
  if (!a.cmpMonths) return 'not available until there is a year of data';
  if (a.cmpMonths >= 12) return 'the last 12 months against the 12 before';
  return `${monthShort(a.cmpFrom)}–${monthShort(a.through || a.months[a.months.length - 1])} against the same months a year earlier`;
}
const anaTile = (lab, v, sub, extra = '', x = '') => `<div class="tile"><div class="lab">${lab}</div><div class="v">${v}</div>${sub ? `<div class="d">${sub}</div>` : ''}${extra}${x ? `<div class="x">${x}</div>` : ''}</div>`;
const anaEmpty = () => `<section class="panel"><div class="note" style="font-size:14px">The analysis appears after the next month-end upload${isAdmin ? ', or press <b>Update brands</b> on the Brands page' : ''}. It needs the category and subcategory report the upload builds.</div></section>`;
const anaBench = () => `<div class="bench"><b>Rules of thumb</b> (general guidelines for a private-club pro shop, not the club's own targets): ${[BENCH.agedPct, BENCH.md, BENCH.wks, BENCH.gmroi, BENCH.turns, BENCH.gm].map(b => b.text).join(' · ')}. Sales are at retail and stock at cost. Special orders in 640 are left out; special orders filed in a category count in its sales but not in its stock, turns, weeks or GMROI.</div>`;
function anaSugList(list, empty){
  if (!list.length) return `<div class="note">${empty || 'Nothing stands out against the rules of thumb.'}</div>`;
  return `<ul class="sug">${list.map(x => `<li><span class="t">${esc(x.title)}</span><span class="i">${moneyK(x.impact)}<small>${x.kind === 'short' ? 'sales at risk' : x.kind === 'md' ? 'given away' : 'of stock'}</small></span>
    <span class="w">${esc(x.why)}${x.also.length ? ' Also: ' + x.also.map(esc).join(' ') : ''}</span><span class="a">→ ${esc(x.action)}</span></li>`).join('')}</ul>`;
}
const SHOPSEG = 'accessories';   // shop-wide grades use the middle of the three segments' bars
// Sales per round over the last 12 months with rounds, and the same months a year earlier.
function anaSpr(a){
  const pr = perRound(a, BASE && BASE.rounds), by = Object.fromEntries(pr.map(p => [p.month, p]));
  const ok = pr.slice(-12).filter(p => p.rounds > 0 && p.sales != null);
  const prev = p => by[(+p.month.slice(0, 4) - 1) + p.month.slice(4)];
  const both = ok.filter(p => { const q = prev(p); return q && q.rounds > 0 && q.sales != null; });
  const S = x => x.reduce((t, p) => t + p.sales, 0), R = x => x.reduce((t, p) => t + p.rounds, 0), Mb = x => x.reduce((t, p) => t + (p.member || 0), 0);
  const lyRows = both.map(prev);
  return {pr, ok, spr: R(ok) ? S(ok) / R(ok) : null, sprNow: R(both) ? S(both) / R(both) : null, sprLY: R(lyRows) ? S(lyRows) / R(lyRows) : null,
    perMember: Mb(ok) ? S(ok) / Mb(ok) : null, rounds: R(ok), roundsLY: R(lyRows), roundsNow: R(both)};
}
// The chart's figures as a table, for reading exactly, printing or a screen reader.
const anaNumbers = (head, rows) => `<details class="tview"><summary>Show the numbers</summary><div class="atbl"><table class="mini" style="min-width:0"><thead><tr>${head.map((h, i) => `<th class="${i ? 'r' : ''}"><span class="h">${esc(h)}</span></th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'r num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
const badOf = c => ['agedPct', 'gmroi', 'md', 'wks', 'gm'].filter(k => grade(k, c[k], c.seg, c.cat) === 'bad');
const BADNAME = {agedPct: 'aged stock', gmroi: 'GMROI', md: 'markdowns', wks: 'weeks of supply', gm: 'margin'};

/* ---------- Summary ---------- */
function renderSummaryPage(){
  const a = anaNow(); if (!a) return $('#pane').innerHTML = anaEmpty();
  const s = a.shop, n = a.months.length, sug = suggest(a), sp = anaSpr(a);
  const labs = a.months.slice(n - 12).map(mLab);
  const ty = s.series.slice(n - 12), ly = s.series.slice(n - 24, n - 12).map((v, i) => n - 24 + i >= a.first ? v : null);
  $('#pane').innerHTML = `<div class="astack">
    <div class="noprint" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:12.5px;color:var(--muted)">Data through ${monthLabel(a.through)}. Growth compares ${anaCmpText(a)}.</span><button class="btn sm" type="button" data-print="1">Print this page</button></div>
    <section class="tiles" aria-label="Headline figures">
      ${anaTile('Sales, last 12 months', moneyK(s.t12), s.growth == null ? '' : aDelta(s.growth) + ' growth', '', 'Retail sales, with special orders filed in a category.')}
      ${anaTile('Gross margin', aPct(s.gm), `${moneyK(s.gp)} earned`, aGrade(grade('gm', s.gm, SHOPSEG)))}
      ${anaTile('Stock turns', aX(s.turns), `${aWk(s.wks)} weeks of supply`, aGrade(grade('turns', s.turns, SHOPSEG)))}
      ${anaTile('GMROI', aX(s.gmroi, 2), 'margin per $1 of stock', aGrade(grade('gmroi', s.gmroi, SHOPSEG)))}
      ${anaTile('Aged stock', aPct(s.agedPct), `${moneyK(s.aged)} unsold 12+ months`, aGrade(grade('agedPct', s.agedPct, SHOPSEG)))}
      ${anaTile('Sales per round', sp.spr == null ? '—' : money2(sp.spr), sp.sprNow && sp.sprLY ? aDelta(sp.sprNow / sp.sprLY - 1) + ' on a year earlier' : `${int(sp.rounds)} rounds`, '', 'Retail sales ÷ rounds played.')}
    </section>
    <section class="ccard"><h3>Sales by month</h3><div class="cs">The last 12 months against the same months a year earlier.</div>
      ${chLegend([{name: 'This year', k: 1}, {name: 'A year earlier', k: 'ly'}])}
      ${chBars({labels: labs, series: [{name: 'This year', values: ty, k: 1}, {name: 'A year earlier', values: ly, k: 'ly'}], label: 'Sales by month, this year against a year earlier',
        tips: i => `This year: ${money(ty[i])} · A year earlier: ${ly[i] == null ? '—' : money(ly[i])}${ly[i] ? ' · Change: ' + aChg(ty[i] / ly[i] - 1) : ''}`})}
      ${anaNumbers(['Month', 'This year', 'A year earlier', 'Change'], labs.map((l, i) => [l, money(ty[i]), ly[i] == null ? '—' : money(ly[i]), ly[i] ? aChg(ty[i] / ly[i] - 1) : '—']))}</section>
    <section class="panel"><header><h2>Category health</h2><span class="lab">Graded on margin, markdowns, weeks, GMROI and aged stock</span></header>
      <div class="health">${a.cats.map(c => { const b = badOf(c), h = b.length >= 2 ? 'bad' : b.length ? 'near' : 'good';
        return `<button type="button" class="h-${h}" data-anaopen="${esc(c.cat)}" title="${b.length ? 'Outside the rule of thumb on ' + b.map(k => BADNAME[k]).join(', ') : 'Within the rules of thumb'}"><span class="n">${esc(c.name)}</span><span class="s">${moneyK(c.t12)} · ${aChg(c.growth)}</span><span class="s">${b.length ? b.length + ' to fix' : 'healthy'}</span></button>`; }).join('')}</div></section>
    <section class="panel"><header><h2>Top suggestions</h2><span class="lab">${sug.length} in all · ranked by dollars</span></header>${anaSugList(sug.slice(0, 5))}
      ${sug.length > 5 ? `<div class="note noprint"><button class="btn sm" type="button" data-tab="scorecard">All suggestions on the scorecard</button> <button class="btn sm" type="button" data-tab="stuck">Stuck money</button></div>` : ''}</section>
    ${anaBench()}</div>`;
}

/* ---------- Scorecard ---------- */
function anaRow(M, isSub, open){
  const g = k => grade(k, M[k], M.seg || SHOPSEG, M.cat);
  const first = isSub ? `<td>${esc(M.name)}</td>` : `<td><span class="caret" aria-hidden="true">▸</span>${esc(M.name)} <span style="color:var(--faint);font-weight:400;font-size:11.5px">${M.subs.length}</span></td>`;
  return `<tr class="${isSub ? 'asub' : 'acat' + (open ? ' open' : '')}" ${isSub ? '' : `data-anacat="${esc(M.cat)}" tabindex="0" aria-expanded="${open}"`}>${first}
    <td class="r num">${money(M.t12)}</td><td class="r num ${M.growth == null ? '' : M.growth >= 0 ? 'up' : 'dn'}">${aChg(M.growth)}</td><td class="r num ${M.trend3 == null ? '' : M.trend3 >= 0 ? 'up' : 'dn'}">${aChg(M.trend3)}</td>
    <td><div class="sharebar" title="Sales ${aPct(M.share)} · stock ${aPct(M.stockShare)}"><i class="sb-s" style="width:${Math.min(100, M.share * 250)}%"></i><i class="sb-o" style="width:${Math.min(100, M.stockShare * 250)}%"></i></div><span class="num" style="font-size:11px;color:var(--muted)">${aPct(M.share)} / ${aPct(M.stockShare)}</span></td>
    <td${aHeat(g('gm'))}>${aPct(M.gm)}</td><td${aHeat(g('md'))}>${aPct(M.md)}</td><td${aHeat(g('turns'))}>${aX(M.turns)}</td><td${aHeat(g('gmroi'))}>${aX(M.gmroi, 2)}</td>
    <td${aHeat(g('wks'))}>${aWk(M.wks)}</td><td${aHeat(g('agedPct'))}>${aPct(M.agedPct)}</td><td class="r num">${money(M.oh)}</td><td class="sp">${chSpark(M.series.map((v, i) => i >= ANA.first ? v : null), {w: 96, h: 24})}</td></tr>`;
}
function renderScorecard(){
  const a = anaNow(); if (!a) return $('#pane').innerHTML = anaEmpty();
  const subs = a.cats.flatMap(c => c.subs), pts = (AN.level === 'subs' ? subs.filter(m => m.t12 >= 3000) : a.cats).filter(m => m.growth != null && m.gmroi != null);
  const two = subs.filter(m => badOf(m).length >= 2).length, top3 = a.cats.slice(0, 3).reduce((t, c) => t + c.share, 0);
  const sug = suggest(a).filter(x => x.page === 'scorecard');
  $('#pane').innerHTML = `<div class="astack">
    <section class="tiles">
      ${anaTile('Categories', a.cats.length, `${subs.length} subcategories`)}
      ${anaTile('Top 3 categories', aPct(top3), 'of all sales', '', a.cats.slice(0, 3).map(c => esc(c.name)).join(', '))}
      ${anaTile('Shop GMROI', aX(a.shop.gmroi, 2), 'margin per $1 of stock', aGrade(grade('gmroi', a.shop.gmroi, SHOPSEG)))}
      ${anaTile('Lines to fix', two, 'subcategories outside 2+ rules of thumb')}
    </section>
    <section class="ccard"><h3>Growth against return on stock</h3><div class="cs">Each bubble is a ${AN.level === 'subs' ? 'subcategory (over $3k of sales)' : 'category'}, sized by sales. Growth compares ${anaCmpText(a)}. The dashed lines are no growth and a GMROI of 2.</div>
      <div class="subnav" style="margin:0 0 10px"><button type="button" class="snav" data-analevel="cats" aria-pressed="${AN.level === 'cats'}">Categories</button><button type="button" class="snav" data-analevel="subs" aria-pressed="${AN.level === 'subs'}">Subcategories</button></div>
      ${chScatter({points: pts.map(m => ({x: m.growth, y: m.gmroi, r: m.t12, label: m.name, k: AN.level === 'subs' ? 2 : 1,
        cvt: m.sub ? m.catName + ' › ' + m.name : m.name, cv: `Sales ${moneyK(m.t12)} · Growth ${aChg(m.growth)} · GMROI ${aX(m.gmroi, 2)} · Weeks ${aWk(m.wks)}`, attrs: ` data-anaopen="${esc(m.cat)}" tabindex="0" role="button"`})),
        xFmt: aChg, yFmt: v => v.toFixed(1), xRef: 0, yRef: 2, xClamp: [-0.6, 1.2], quads: ['Harvest', 'Grow', 'Exit or fix', 'Fix the margin'], xName: 'Growth', yName: 'GMROI', label: 'Growth against GMROI'})}
      <div class="cs" style="margin:6px 0 0"><b>Grow</b>: growing and earning, so give it budget. <b>Harvest</b>: earning but flat, so keep it lean. <b>Fix the margin</b>: selling more but earning little on the stock. <b>Exit or fix</b>: neither.</div></section>
    <section class="panel"><header><h2>Categories and subcategories</h2><span style="display:flex;gap:8px;align-items:center"><span class="lab">Tap a category to open it</span><button class="btn sm" type="button" data-anaall="1">${AN.open.size >= a.cats.length ? 'Close all' : 'Open all'}</button></span></header>
      <div class="atbl"><table style="min-width:1140px"><thead><tr><th><span class="h">Category</span></th><th class="r"><span class="h">Sales, 12 mo</span></th><th class="r"><span class="h">Growth</span></th><th class="r"><span class="h">Last 3 mo</span></th><th><span class="h">Share: sales / stock</span></th><th class="r"><span class="h">Margin</span></th><th class="r"><span class="h">Markdowns</span></th><th class="r"><span class="h">Turns</span></th><th class="r"><span class="h">GMROI</span></th><th class="r"><span class="h">Weeks</span></th><th class="r"><span class="h">Aged</span></th><th class="r"><span class="h">On hand</span></th><th><span class="h">24 months</span></th></tr></thead>
      <tbody>${a.cats.map(c => { const o = AN.open.has(c.cat); return anaRow(c, false, o) + (o ? c.subs.map(s => anaRow(s, true)).join('') : ''); }).join('')}
      ${anaRow(a.shop, true).replace('<tr class="asub"', '<tr class="tot"')}</tbody></table></div>
      <div class="note">Shaded cells are graded against the rules of thumb: green within, amber close, red outside. The blue bar is the share of sales, the orange bar the share of stock; orange longer than blue means the stock is heavier than the sales.</div></section>
    <section class="panel"><header><h2>Suggestions</h2><span class="lab">${sug.length} · ranked by dollars</span></header>${anaSugList(sug)}</section>
    ${anaBench()}</div>`;
}

/* ---------- Spend per round ---------- */
function renderRounds(){
  const a = anaNow(); if (!a) return $('#pane').innerHTML = anaEmpty();
  const sp = anaSpr(a), last = sp.pr.slice(-12), byS = sp.ok.slice().sort((x, y) => y.spr - x.spr), best = byS[0], worst = byS[byS.length - 1];
  if (!sp.ok.length) return $('#pane').innerHTML = `<section class="panel"><div class="note">Rounds haven't been loaded yet. They come with the month-end upload.</div></section>`;
  const labs = last.map(p => mLab(p.month));
  $('#pane').innerHTML = `<div class="astack">
    <section class="tiles">
      ${anaTile('Sales per round', money2(sp.spr), sp.sprNow && sp.sprLY ? `${aDelta(sp.sprNow / sp.sprLY - 1)} · ${money2(sp.sprLY)} a year earlier` : '', '', `Over the ${sp.ok.length} months with rounds.`)}
      ${anaTile('Sales per member round', sp.perMember == null ? '—' : money2(sp.perMember), 'all retail sales ÷ member rounds', '', 'What the shop takes for every member round.')}
      ${anaTile('Rounds', int(sp.rounds), sp.roundsLY ? aDelta(sp.roundsNow / sp.roundsLY - 1) + ' on the same months' : '')}
      ${anaTile('Best month', best ? mLab(best.month) : '—', best ? money2(best.spr) + ' a round' : '', '', worst && worst !== best ? `Weakest: ${mLab(worst.month)}, ${money2(worst.spr)} a round.` : '')}
    </section>
    <section class="ccard"><h3>Sales per round by month</h3><div class="cs">Retail sales divided by all rounds played, against the same month a year earlier.</div>
      ${chLegend([{name: 'This year', k: 1}, {name: 'A year earlier', k: 'ly', dash: true}])}
      ${chLine({labels: labs, series: [{name: 'This year', values: last.map(p => p.spr), k: 1}, {name: 'A year earlier', values: last.map(p => p.sprLY), k: 'ly', dash: true}], fmt: v => '$' + Math.round(v), label: 'Sales per round by month'})}</section>
    <section class="ccard"><h3>Rounds by type</h3><div class="cs">Who played each month.</div>
      ${chLegend([{name: 'Member', k: 1}, {name: 'Guest', k: 2}, {name: 'Public', k: 3}, {name: 'Other (events, comps)', k: 'ly'}])}
      ${chStack({labels: labs, series: [{name: 'Member', values: last.map(p => p.member || 0), k: 1}, {name: 'Guest', values: last.map(p => p.guest || 0), k: 2}, {name: 'Public', values: last.map(p => p.public || 0), k: 3},
        {name: 'Other', values: last.map(p => Math.max(0, (p.rounds || 0) - (p.member || 0) - (p.guest || 0) - (p.public || 0))), k: 'ly'}], label: 'Rounds by type'})}</section>
    <section class="panel"><header><h2>Month by month</h2></header><div class="atbl"><table style="min-width:720px"><thead><tr><th><span class="h">Month</span></th><th class="r"><span class="h">Rounds</span></th><th class="r"><span class="h">Member</span></th><th class="r"><span class="h">Guest</span></th><th class="r"><span class="h">Public</span></th><th class="r"><span class="h">Other</span></th><th class="r"><span class="h">Sales</span></th><th class="r"><span class="h">Per round</span></th><th class="r"><span class="h">A year earlier</span></th><th class="r"><span class="h">Change</span></th></tr></thead>
      <tbody>${last.slice().reverse().map(p => `<tr><td>${monthLabel(p.month)}</td><td class="r num">${p.rounds == null ? '—' : int(p.rounds)}</td><td class="r num">${p.member == null ? '—' : int(p.member)}</td><td class="r num">${p.guest == null ? '—' : int(p.guest)}</td><td class="r num">${p.public == null ? '—' : int(p.public)}</td><td class="r num">${p.rounds == null ? '—' : int(Math.max(0, p.rounds - (p.member || 0) - (p.guest || 0) - (p.public || 0)))}</td><td class="r num">${p.sales == null ? '—' : money(p.sales)}</td><td class="r num">${p.spr == null ? '—' : money2(p.spr)}</td><td class="r num">${p.sprLY == null ? '—' : money2(p.sprLY)}</td><td class="r num ${p.spr && p.sprLY ? (p.spr >= p.sprLY ? 'up' : 'dn') : ''}">${p.spr && p.sprLY ? aChg(p.spr / p.sprLY - 1) : '—'}</td></tr>`).join('')}</tbody></table></div></section>
    ${anaBench()}</div>`;
}

/* ---------- Trends ---------- */
function renderTrends(){
  const a = anaNow(); if (!a) return $('#pane').innerHTML = anaEmpty();
  const sea = seasonality(a), top = sea.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).slice(0, 3).map(x => x[1]).sort((x, y) => x - y);
  const labs = a.months.slice(a.first).map(mLab), shop = a.shop.series.slice(a.first);
  const sug = suggest(a).filter(x => x.page === 'trends');
  $('#pane').innerHTML = `<div class="astack">
    <section class="ccard"><h3>Shop sales, month by month</h3><div class="cs">Retail sales for the months in the data${a.first ? ` (it starts in ${monthLabel(a.months[a.first])})` : ''}.</div>
      ${chLine({labels: labs, series: [{name: 'Sales', values: shop, k: 1}], label: 'Shop sales by month'})}</section>
    <section class="ccard"><h3>When the shop sells</h3><div class="cs">Each month's share of the last 12 months' sales. Busiest: ${top.map(i => MFULL[i]).join(', ')}. Have that stock landing a month ahead, so order for ${top.map(i => MN[(i + 11) % 12]).join(', ')} delivery.</div>
      ${chBars({labels: MN, series: [{name: 'Share of the year', values: sea, k: 1}], fmt: v => Math.round(v * 100) + '%', label: 'Seasonality'})}
      ${anaNumbers(['Month', 'Share of the year'], MN.map((m, i) => [MFULL[i], (sea[i] * 100).toFixed(1) + '%']))}</section>
    <section class="panel"><header><h2>By category</h2><span class="lab">Growth compares ${esc(anaCmpText(a))}</span></header>
      <div class="health">${a.cats.map(c => `<button type="button" data-anaopen="${esc(c.cat)}" title="Open ${esc(c.name)} on the scorecard"><span class="n">${esc(c.name)}</span><span class="s">${moneyK(c.t12)} · <span class="${c.growth == null ? '' : c.growth >= 0 ? 'up' : 'dn'}">${aChg(c.growth)}</span> · ${aPct(c.share)} of sales</span>${chSpark(c.series.map((v, i) => i >= a.first ? v : null), {w: 150, h: 34})}</button>`).join('')}</div></section>
    <section class="panel"><header><h2>Falling lines</h2><span class="lab">${sug.length}</span></header>${anaSugList(sug, 'No subcategory is down 25% or more with stock behind it.')}</section>
    ${anaBench()}</div>`;
}

/* ---------- Stuck money ---------- */
function renderStuck(){
  const a = anaNow(); if (!a) return $('#pane').innerHTML = anaEmpty();
  const st = stuckMoney(a), T = (x, k) => x.reduce((t, y) => t + y[k], 0);
  const over = T(st.overstock, 'excess'), aged = T(st.aged, 'aged'), cash = T(st.markdown, 'cashAt30');
  const byCat = a.cats.map(c => ({c, over: (st.overstock.find(x => x.M.cat === c.cat) || {excess: 0}).excess, aged: c.aged})).filter(x => x.over || x.aged).sort((x, y) => (y.over + y.aged) - (x.over + x.aged));
  const mx = Math.max(1, ...byCat.map(x => Math.max(x.over, x.aged)));
  const bar = (v, k) => `<i style="display:block;height:8px;border-radius:0 4px 4px 0;width:${v / mx * 100}%;background:var(--c${k})"></i>`;
  const sug = suggest(a).filter(x => x.page === 'stuck');
  $('#pane').innerHTML = `<div class="astack">
    <section class="tiles">
      ${anaTile('Over the 16-week target', moneyK(over), 'stock above 16 weeks of sales', '', 'At cost, by category.')}
      ${anaTile('Aged stock', moneyK(aged), aPct(a.shop.agedPct) + ' of stock unsold 12+ months', aGrade(grade('agedPct', a.shop.agedPct, SHOPSEG)))}
      ${anaTile('Cash from a 30% markdown', moneyK(cash), 'if the aged stock sold at 30% off', '', 'Retail value of the aged stock less 30%.')}
      ${anaTile('Lines to reorder', st.reorder.length, 'under 4 weeks of supply and selling')}
    </section>
    <section class="panel"><header><h2>Where it's stuck</h2><span class="lab">At cost</span></header>
      <div style="padding:10px 16px 0">${chLegend([{name: 'Over the 16-week target', k: 2}, {name: 'Aged 12+ months', k: 1}])}</div>
      <div class="atbl"><table style="min-width:640px"><thead><tr><th><span class="h">Category</span></th><th class="r"><span class="h">On hand</span></th><th class="r"><span class="h">Weeks</span></th><th class="r"><span class="h">Over target</span></th><th class="r"><span class="h">Aged</span></th><th style="width:34%"><span class="h">&nbsp;</span></th></tr></thead>
      <tbody>${byCat.map(x => `<tr class="acat" data-anaopen="${esc(x.c.cat)}"><td>${esc(x.c.name)}</td><td class="r num">${money(x.c.oh)}</td><td${aHeat(grade('wks', x.c.wks, x.c.seg))}>${aWk(x.c.wks)}</td><td class="r num">${money(x.over)}</td><td class="r num">${money(x.aged)}</td><td><div style="display:grid;gap:3px" data-cvt="${esc(x.c.name)}" data-cv="Over target: ${money(x.over)} · Aged: ${money(x.aged)}">${bar(x.over, 2)}${bar(x.aged, 1)}</div></td></tr>`).join('')}</tbody></table></div></section>
    <section class="panel"><header><h2>Suggestions</h2><span class="lab">${sug.length} · ranked by dollars</span></header>${anaSugList(sug)}</section>
    <div class="ccols">
      <section class="panel"><header><h2>Markdown candidates</h2><span class="lab">Aged stock by subcategory</span></header><div class="atbl"><table style="min-width:480px"><thead><tr><th><span class="h">Subcategory</span></th><th class="r"><span class="h">Aged</span></th><th class="r"><span class="h">Aged share</span></th><th class="r"><span class="h">Cash at 30% off</span></th></tr></thead>
        <tbody>${st.markdown.slice(0, 15).map(x => `<tr><td>${esc(x.M.catName)} › ${esc(x.M.name)}</td><td class="r num">${money(x.M.aged)}</td><td${aHeat(grade('agedPct', x.M.agedPct, x.M.seg))}>${aPct(x.M.agedPct)}</td><td class="r num">${money(x.cashAt30)}</td></tr>`).join('') || '<tr><td colspan="4">No aged stock.</td></tr>'}</tbody></table></div></section>
      <section class="panel"><header><h2>Reorder candidates</h2><span class="lab">Under 4 weeks of supply</span></header><div class="atbl"><table style="min-width:420px"><thead><tr><th><span class="h">Subcategory</span></th><th class="r"><span class="h">Sales, 12 mo</span></th><th class="r"><span class="h">Weeks</span></th><th class="r"><span class="h">Growth</span></th></tr></thead>
        <tbody>${st.reorder.map(M => `<tr><td>${esc(M.catName)} › ${esc(M.name)}</td><td class="r num">${money(M.t12)}</td><td class="r num dn">${aWk(M.wks)}</td><td class="r num">${aChg(M.growth)}</td></tr>`).join('') || '<tr><td colspan="4">Nothing is running out.</td></tr>'}</tbody></table></div></section>
    </div>
    <section class="panel"><header><h2>Oldest stock</h2><span class="lab">Items unsold for 12+ months, largest first</span></header><div class="atbl"><table style="min-width:720px"><thead><tr><th><span class="h">SKU</span></th><th><span class="h">Item</span></th><th><span class="h">Subcategory</span></th><th class="r"><span class="h">On hand</span></th><th class="r"><span class="h">At cost</span></th><th><span class="h">Last sold</span></th></tr></thead>
      <tbody>${st.agedSkus.slice(0, 30).map(t => { const c = a.cats.find(x => x.cat === t.cat), sb = c && c.subs.find(x => x.sub === (t.sub || ''));
        return `<tr><td class="num">${esc(t.sku)}</td><td>${esc(t.desc)}</td><td>${esc(c ? c.name : t.cat)}${sb ? ' › ' + esc(sb.name) : ''}</td><td class="r num">${int(num(t.oh))}</td><td class="r num">${money(num(t.value))}</td><td>${esc(t.last || 'never')}</td></tr>`; }).join('') || '<tr><td colspan="6">No aged items.</td></tr>'}</tbody></table></div></section>
    ${anaBench()}</div>`;
}

document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-anaopen],[data-anacat],[data-analevel],[data-anaall],[data-print]'); if (!t) return;
  const d = t.dataset;
  if (d.print) return window.print();
  if (d.anacat){ AN.open.has(d.anacat) ? AN.open.delete(d.anacat) : AN.open.add(d.anacat); return render(); }
  if (d.anaopen){ AN.open.add(d.anaopen); TAB = 'scorecard'; try { localStorage.setItem('ob.tab2', TAB); } catch (_) {} render();
    return setTimeout(() => document.querySelector(`tr[data-anacat="${CSS.escape(d.anaopen)}"]`)?.scrollIntoView({block: 'center'}), 0); }
  if (d.analevel){ AN.level = d.analevel; return render(); }
  if (d.anaall){ const a = anaNow(); if (!a) return; if (AN.open.size >= a.cats.length) AN.open.clear(); else a.cats.forEach(c => AN.open.add(c.cat)); return render(); }
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('tr[data-anacat]')){ e.preventDefault(); e.target.click(); } });
