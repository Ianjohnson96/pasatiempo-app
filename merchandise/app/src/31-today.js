/* ---------- Today ----------
   The first page: four tiles on how the shop is doing, the decisions worth making this week, sales and receiving
   room by month (both click through), checklists that are due, and orders due in. Each part stands on its own, so a
   part with no data yet (no month-end upload, no orders) doesn't blank the rest. */
function todayTile(lab, v, d, spark, x, go){
  const a = go ? ` data-go="${esc(go)}" tabindex="0" role="link" aria-label="${esc(lab)}: open ${esc(pageLabel(parseGo(go).tab))}"` : '';
  return `<div class="tile"${a}><div class="lab">${lab}</div><div class="v">${v}</div>${d ? `<div class="d">${d}</div>` : ''}${spark ? `<div class="spk">${spark}</div>` : ''}${x ? `<div class="x">${x}</div>` : ''}</div>`;
}
/* This fiscal year's receiving room, whichever year the Budget page is showing: left to buy through this month,
   for the whole year, month by month, and the month it turns positive. */
function todayRoom(){
  return withPlan('cur', () => {
    const S = stats(), {w, room, com} = roomSeries(S), left = w.map((_, j) => room[j] - com[j]);
    const m = w.includes(THIS_MONTH) ? THIS_MONTH : THIS_MONTH < w[0] ? w[0] : w[w.length - 1], i = w.indexOf(m);
    const o = left.findIndex((v, j) => j > i && v > 0);
    return {fy: PLAN.fy, m, now: left[i], year: left[left.length - 1], left, opens: o > 0 ? w[o] : null, chart: roomChart(S)};
  });
}
function todayTiles(a, R){
  const s = a && a.shop, sp = a ? anaSpr(a) : null, none = 'After the next month-end upload';
  const roomD = R.now < 0 ? (R.opens ? `Over plan until ${monthShort(R.opens)}` : `Over plan all of ${R.fy}`) : `left to buy through ${monthShort(R.m)}`;
  const big = a ? a.cats.slice(0, 8) : [];
  return `<section class="tiles" aria-label="How the shop is doing">
    ${todayTile('Sales, last 12 months', s ? moneyK(s.t12) : '—', s ? (s.growth == null ? 'retail' : aDelta(s.growth) + ' growth') : none,
      s ? chSpark(s.series.map((v, i) => i >= a.first ? v : null).slice(-12), {w: 160, h: 30}) : '', 'Retail sales by month. Open Trends & rounds.', 'trends')}
    ${todayTile('Gross margin', s ? aPct(s.gm) : '—', s ? `${moneyK(s.gp)} earned` : none,
      big.length ? chSparkBars(big.map(c => c.gm || 0), {w: 160, h: 30, title: 'Margin in the ' + big.length + ' biggest categories'}) : '', s ? `Bars: margin in the ${big.length} biggest categories. ${aGrade(grade('gm', s.gm, SHOPSEG))}` : '', 'scorecard')}
    ${todayTile(`Room to buy, ${R.fy}`, `<span class="${R.now < 0 ? 'neg' : ''}">${moneyK(R.now)}</span>`, roomD,
      chSpark(R.left, {w: 160, h: 30}), `${moneyK(R.year)} for the whole year, after what's committed. Open Budget & open-to-buy.`, 'overview')}
    ${todayTile('Sales per round', sp && sp.spr != null ? money2(sp.spr) : '—', sp ? (sp.sprNow && sp.sprLY ? aDelta(sp.sprNow / sp.sprLY - 1) + ' on a year earlier' : `${int(sp.rounds)} rounds`) : none,
      sp ? chSpark(sp.pr.slice(-12).map(p => p.spr), {w: 160, h: 30}) : '', 'Retail sales ÷ rounds played, by month.', 'trends')}
  </section>`;
}
// Checklists on the reporting calendar that are due or overdue (78-reports.js). Shown here instead of the due bar.
function todayChecklists(){
  const al = rptAlerts(); if (!al.length) return '';
  const late = al.some(x => x.status === 'overdue');
  const sku = al.some(x => x.p.cadence === 'monthly' && x.p.due === RPT.today && !((CHECKS[x.p.key] || {}).items || {}).sku);
  return `<section class="panel"><header><h2>${late ? 'Overdue' : 'Due now'}</h2><span style="display:flex;gap:8px;flex-wrap:wrap">${upNeeded(al) ? '<button class="btn sm primary" type="button" data-tab="monthend">Upload reports</button>' : ''}<button class="btn sm" type="button" data-tab="monthend">Open the checklists</button></span></header>
    <ul class="items">${al.map(x => `<li class="item ${x.status === 'overdue' ? 'crit' : 'warn'}"><div class="stripe"></div><div class="body"><div class="t">${esc(x.p.label)} <span class="rstat ${x.status}">${esc(rptWhen(x))}</span></div><div class="d">${x.left} of ${x.p.items.length} still to tick off</div></div><div class="side"></div></li>`).join('')}</ul>
    ${sku ? '<div class="note"><b>Run the SKU Analysis today:</b> on-hand can\'t be recreated later.</div>' : ''}</section>`;
}
// Open orders that are late or due this month (77-receiving.js rcvOf), late first.
function todayDue(){
  const due = POS.filter(isOpen).map(p => ({p, st: rcvOf(p)})).filter(x => x.st === 'due' || x.st === 'late')
    .sort((x, y) => (x.st === 'late' ? 0 : 1) - (y.st === 'late' ? 0 : 1) || String(x.p.deliveryMonth).localeCompare(String(y.p.deliveryMonth)) || onOrder(y.p) - onOrder(x.p));
  const tot = due.reduce((a, x) => a + onOrder(x.p), 0), show = due.slice(0, 8);
  return `<section class="panel"><header><h2>Late or due this month</h2><button class="btn ghost sm" type="button" data-tab="receiving">Receiving</button></header>
    ${due.length ? `<div class="note" style="padding-bottom:4px">${due.length} order${due.length === 1 ? '' : 's'} late or due in ${monthFull(THIS_MONTH)}, ${money(tot)} still to come. Click one to open it.</div>
    <div class="tbl"><table class="mini rt duetbl" style="min-width:0"><thead><tr><th>Order</th><th>Expected</th><th class="r">Still to come</th></tr></thead><tbody class="click">${show.map(({p, st}) =>
      `<tr data-po="${esc(p.id)}" tabindex="0"><td class="wrapv"><b>PO ${esc(p.poNumber)}</b> · ${esc(vendorName(p))}</td><td data-l="Expected">${monthLabel(p.deliveryMonth)} <span class="rstat ${st === 'late' ? 'overdue' : 'due'}">${st === 'late' ? 'Late' : 'Due'}</span></td><td data-l="Still to come" class="r num">${money(onOrder(p))}</td></tr>`).join('')}</tbody></table></div>
    ${due.length > show.length ? `<div class="note">…and ${due.length - show.length} more on the Receiving page.</div>` : ''}`
    : `<div class="note">Nothing is late or due in ${monthFull(THIS_MONTH)}.</div>`}</section>`;
}
function renderToday(S){
  const a = anaNow(), R = todayRoom(), d = topDecisions(S, 6);
  const paneW = ($('#pane') || {}).clientWidth || 900, one = typeof matchMedia === 'function' && matchMedia('(max-width:1100px)').matches;
  const w = Math.max(280, Math.round(one ? paneW : (paneW - 18) * 1.35 / 2.35) - 38);
  $('#pane').innerHTML = `<div class="astack">
    ${a ? `<div class="noprint" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:12.5px;color:var(--muted)">Sales data through ${monthLabel(a.through)}. Growth compares ${anaCmpText(a)}.</span><button class="btn sm" type="button" data-print="1">Print this page</button></div>` : ''}
    ${todayChecklists()}
    ${todayTiles(a, R)}
    <div class="tgrid">
      ${a ? anaSalesCard(a, {w, go: 'trends'}) : '<section class="ccard"><h3>Sales by month</h3><div class="cs">Appears after the next month-end upload: it needs the category and subcategory report the upload builds.</div></section>'}
      <section class="panel"><header><h2>Most important this week</h2><button class="btn ghost sm" type="button" data-tab="attention">See the full list</button></header>
        <ul class="items">${d.length ? d.map(decisionHtml).join('') : '<li class="item good"><div class="stripe"></div><div class="body"><div class="t">Nothing needs attention.</div></div></li>'}</ul></section>
    </div>
    <div class="tgrid">
      <section class="panel"><header><h2>Receiving room by month</h2><span class="lab">${esc(R.fy)} · cumulative, all categories</span></header>${R.chart}</section>
      ${todayDue()}
    </div></div>`;
}
