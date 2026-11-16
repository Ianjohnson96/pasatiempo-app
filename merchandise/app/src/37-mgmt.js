/* ---------- management report ----------
   One page for the General Manager and the Director of Golf (Home -> Management report), made to print on one
   Letter sheet: sales against plan and last year, margin, stock against plan, the open-to-buy, spend per round,
   the categories, and what to watch. Every figure comes from the same place as the page that shows it in full:
   the forecast (70-forecast.js), budgets (20-engine.js, 10-core.js), the analysis (17-metrics.js) and the weekly
   numbers (36-weekly.js). */
function mgmtData(){
  const a = anaNow(), fy = curFY(), P = PLANS.cur, cats = catsAll().filter(c => c !== '640' && P.cats[c] && P.cats[c].plan != null);
  const closed = fyMonths(fy).filter(k => monthStatus(k) === 'actual');
  const catYtd = c => sum(closed, k => ENG.S[c][k]), ytd = sum(catsAll(), catYtd), ytdLY = sum(closed, monthLY);
  const gp = sum(catsAll(), c => catYtd(c) * num(BASE.cats[c].gm));
  const adj = ADJS[adjKey(P)] || [], used = committedIn(P);
  const budget = sum(cats, c => P.cats[c] && P.cats[c].plan != null ? P.cats[c].plan + sum(adj.filter(x => x.cat === c), x => x.amount) : 0);
  const committed = sum(cats, c => num(used[c]));
  const onOrder = ledger(POS, P).filter(e => e.cat !== '640').reduce((t, e) => t + num(e.open), 0);
  const p = latestPulse(), w = p && p.date > BASE.asOf ? pulseView(p) : null;
  return {a, fy, P, closed, ytd, ytdLY, gm: ytd ? gp / ytd : null, fc: fySales(fy), fcLY: lySales(fy), w,
    onHand: sum(Object.values(INV.cats), c => c.cost), yearEnd: sum(cats, c => num(P.cats[c].target)),
    budget, committed, left: budget - committed, onOrder, spr: a ? anaSpr(a) : null, watch: a ? suggest(a).slice(0, 4) : [],
    cats: catsAll().filter(c => c !== '640').map(c => { const v = BASE.cats[c], am = a ? a.cats.find(x => x.cat === c) : null, y = catYtd(c), l = sum(closed, k => lastYear(v, k));
      return {c, name: v.name, ytd: y, chg: l ? y / l - 1 : null, gm: v.gm, oh: num((INV.cats[c] || {}).cost), wks: am ? am.wks : null, call: P.cats[c] ? P.cats[c].call : null}; })
      .sort((x, y) => y.ytd - x.ytd)};
}
function renderMgmt(){
  if (!BASE || !ENG) return $('#pane').innerHTML = `<section class="panel"><div class="note">The report appears after the first month-end upload.</div></section>`;
  const d = mgmtData(), fyL = fyLabel(d.fy), lastM = d.closed[d.closed.length - 1];
  const chg = (x, y) => y ? aDelta(x / y - 1) : '—';
  const ms = fyMonths(d.fy), ty = ms.map(k => monthStatus(k) === 'actual' ? monthTotal(k) : null), fc = ms.map(k => monthStatus(k) === 'actual' ? null : monthTotal(k)), ly = ms.map(monthLY);
  const callTxt = c => c ? CALLTXT[c] || c : '';
  $('#pane').innerHTML = `<div class="mgmt">
    <div class="noprint" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px"><span style="font-size:12.5px;color:var(--muted)">For the General Manager and the Director of Golf. Prints on one Letter page.</span><button class="btn sm" type="button" data-print="1">Print</button></div>
    <header class="mg-head"><div><div class="lab">Pasatiempo Pro Shop</div><h2>Merchandise report · ${fyL}</h2></div>
      <div class="mg-asof">Month-end data as of <b>${dateLabel(BASE.asOf)}</b>${d.w ? `<br>Weekly sales through <b>${dateLabel(d.w.p.date)}</b>` : ''}<br>Printed ${dateLabel(todayISO)}</div></header>
    <section class="tiles mg-tiles" aria-label="Headline figures">
      ${anaTile(`Sales, ${fyL} to date`, moneyK(d.ytd), `${chg(d.ytd, d.ytdLY)} on last year`, '', d.closed.length ? `${monthShort(d.closed[0])}–${monthShort(lastM)}, closed months. Retail, special orders included.` : 'No month closed yet.')}
      ${d.w ? anaTile(`${monthFull(d.w.m)} to date`, moneyK(d.w.mtd), `${vsTxt(d.w.mtd, d.w.planMtd)} plan · ${vsTxt(d.w.mtd, d.w.lyMtd)} last year`, '', `Through ${dateLabel(d.w.p.date)}, from the weekly Daily Sales Report.`)
        : anaTile(`${fyL} forecast`, moneyK(d.fc), `${chg(d.fc, d.fcLY)} on last year`, '', 'Closed months plus the forecast for the rest of the year.')}
      ${anaTile('Gross margin', d.gm == null ? '—' : aPct(d.gm), `${fyL} to date`, d.gm == null ? '' : aGrade(grade('gm', d.gm, SHOPSEG)), 'Realized margin from the cost & margin report, weighted by sales.')}
      ${anaTile('Inventory at cost', moneyK(d.onHand), d.a ? `${aWk(d.a.shop.wks)} weeks of supply` : '', d.a ? aGrade(grade('wks', d.a.shop.wks, SHOPSEG)) : '', `On hand ${dateLabel(INV.asOf)}, special orders waiting for members included. Weeks = how long it lasts at the last 12 months' pace; the plan steers to ${moneyK(d.yearEnd)} of shelf stock by ${dateLabel(d.P.window.to + '-30')}.`)}
      ${anaTile('Aged stock', d.a ? aPct(d.a.shop.agedPct) : '—', d.a ? `${moneyK(d.a.shop.aged)} unsold 12+ months` : '', d.a ? aGrade(grade('agedPct', d.a.shop.agedPct, SHOPSEG)) : '', 'Stock at cost with no sale in a year.')}
      ${anaTile(`${fyL} buying budget left`, moneyK(d.left), `of ${moneyK(d.budget)} · ${moneyK(d.onOrder)} on order`, '', 'Open-to-buy at cost for the year, less orders due or received in it, with budget changes. Special orders aren\'t budgeted.')}
    </section>
    <div class="mg-two">
      <section class="ccard"><h3>Sales by month, ${fyL}</h3><div class="cs">Actual, then forecast, against last year.</div>
        ${chLegend([{name: 'Actual', k: 1}, {name: 'Forecast', k: 2}, {name: 'Last year', k: 'ly'}])}
        ${chBars({labels: ms.map(monthShort), series: [{name: 'Actual', values: ty, k: 1}, {name: 'Forecast', values: fc, k: 2}, {name: 'Last year', values: ly, k: 'ly'}], h: 170, w: 470, label: `Sales by month, ${fyL}`,
          tips: i => `${monthLabel(ms[i])}: ${money(ty[i] != null ? ty[i] : fc[i])} ${ty[i] != null ? 'actual' : 'forecast'} · last year ${money(ly[i])}`})}
        ${d.spr && d.spr.spr != null ? `<div class="cs" style="margin-top:6px"><b>Sales per round</b> ${money2(d.spr.spr)}${d.spr.sprNow && d.spr.sprLY ? ` · ${aDelta(d.spr.sprNow / d.spr.sprLY - 1)} on a year earlier` : ''} · ${int(d.spr.rounds)} rounds in the last 12 months</div>` : ''}</section>
      <section class="panel"><header><h2>What to watch</h2><span class="lab">Largest dollars first</span></header>
        ${d.watch.length ? `<ol class="mg-watch">${d.watch.map(s => `<li><b>${esc(s.title)}</b> ${esc(s.why)} <span class="mg-do">${esc(s.action)}.</span></li>`).join('')}</ol>` : '<div class="note">Nothing outside the rules of thumb.</div>'}</section>
    </div>
    <section class="panel"><header><h2>Categories</h2><span class="lab">${fyL} to date · largest first</span></header>
      <table class="mini mg-cats"><thead><tr><th>Category</th><th class="r">Sales</th><th class="r">vs last year</th><th class="r">Margin</th><th class="r">On hand</th><th class="r">Weeks</th><th>Buying</th></tr></thead>
      <tbody>${d.cats.map(x => `<tr><td>${esc(x.name)}</td><td class="r num">${moneyK(x.ytd)}</td><td class="r num">${x.chg == null ? '—' : aChg(x.chg)}</td><td class="r num">${aPct(x.gm)}</td><td class="r num">${moneyK(x.oh)}</td><td class="r num ${x.wks == null ? '' : x.wks >= 999 ? (x.oh ? 'neg' : '') : offBench('wks', x.wks)}">${x.wks == null ? '—' : x.wks >= 999 ? 'none sold' : Math.round(x.wks)}</td><td>${esc(callTxt(x.call))}</td></tr>`).join('')}</tbody></table></section>
    <div class="mg-foot">Sales at retail; inventory and budgets at cost. Fiscal year May 1 – April 30. Weeks = weeks of supply at the last 12 months' pace. Buying: Buy = room in the budget; Replenish = replace what sells; Stop = the year's stock is already covered. From the Pro Shop Merchandise Program.</div>
  </div>`;
}
