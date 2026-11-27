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
// Checklists on the reporting calendar that are due or overdue (78-reports.js): one line, so they don't push the
// shop's numbers off the first screen. The list itself is on Upload & close.
function todayChecklists(){
  const al = rptAlerts(); if (!al.length) return '';
  const late = al.filter(x => x.status === 'overdue').length;
  const sku = al.some(x => x.p.cadence === 'monthly' && x.p.due === RPT.today && !((CHECKS[x.p.key] || {}).items || {}).sku);
  const head = late ? `${late} checklist${late === 1 ? '' : 's'} overdue` + (al.length > late ? `, ${al.length - late} due` : '') : `${al.length} checklist${al.length === 1 ? '' : 's'} due`;
  return `<section class="chkline ${late ? 'late' : ''}" aria-label="Checklists"><b>${head}</b>
    <span class="names">${al.map(x => `${esc(x.p.label)} (${x.left} left)`).join(' · ')}</span>
    <span style="display:flex;gap:8px;flex-wrap:wrap">${upNeeded(al) ? '<button class="btn sm primary" type="button" data-tab="monthend">Upload reports</button>' : ''}<button class="btn sm" type="button" data-tab="monthend">Open the checklists</button></span>
    ${sku ? '<span style="flex-basis:100%"><b>Run the SKU Analysis today:</b> on-hand cannot be recreated later.</span>' : ''}</section>`;
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
/** Home's three lines, one per phase: what's left to buy, what's arriving, how it's selling. null before the first
    upload. Each is plain text; the page links each to its page. */
function homeLines(S){
  if (!S || !BASE || !PLANS.cur) return null;
  // Home always describes this fiscal year, whichever year the Budget page is showing
  const R = todayRoom(), buy = withPlan('cur', () => PAGE_VERDICT.overview(stats()));
  let due = 0, late = 0, inRoom = 0, roomV = 0;
  for (const p of POS){ const st = rcvOf(p); if (st === 'due') due++; else if (st === 'late') late++; else if (st === 'arrived'){ inRoom++; roomV += storeRoomOf(p); } }
  const toMatch = receivingQueue().toMatch.length;
  const arr = [toMatch ? `${toMatch} log row${toMatch === 1 ? '' : 's'} to match` : '', due ? `${due} order${due === 1 ? '' : 's'} due this month` : 'nothing due this month', late ? `${late} late` : '', inRoom ? `${inRoom} in the store room (${money(roomV)}), not in Jonas yet` : ''].filter(Boolean);
  const a = anaNow(), s = a && a.shop;
  const selling = s ? `${moneyK(s.t12)} sold in the last 12 months${s.growth == null ? '' : `, ${s.growth >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(s.growth * 100))}% on a year earlier`}; margin ${aPct(s.gm)}${grade('gm', s.gm, SHOPSEG) === 'bad' ? ', below the guideline' : ''}.`
    : 'Sales show after the next month-end upload.';
  return {buy: buy ? buy.text : `${moneyK(R.year)} left to buy in ${R.fy}.`, buyTone: buy ? buy.tone : 'ok', arriving: (s => s[0].toUpperCase() + s.slice(1))(arr.join(' · ')) + '.', arrivingTone: late ? 'act' : inRoom || toMatch ? 'watch' : 'ok', selling, sellingTone: s && s.growth != null && s.growth < 0 ? 'watch' : 'ok'};
}
function renderToday(S){
  const a = anaNow(), L = homeLines(S), d = topDecisions(S, 5);
  const paneW = ($('#pane') || {}).clientWidth || 900, one = typeof matchMedia === 'function' && matchMedia('(max-width:1100px)').matches;
  const w = Math.max(280, Math.round(one ? paneW : (paneW - 18) * 1.35 / 2.35) - 38);
  const line = (lab, text, tone, go) => `<button type="button" class="homeline ${tone}" data-go="${go}"><span class="hl">${lab}</span><span class="ht">${esc(text)}</span></button>`;
  const R = L ? todayRoom() : null;
  $('#pane').innerHTML = `<div class="astack">
    ${a ? `<div class="noprint" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:12.5px;color:var(--muted)">Sales data through ${monthLabel(a.through)}. Growth compares ${anaCmpText(a)}.</span><button class="btn sm" type="button" data-print="1">Print this page</button></div>` : ''}
    ${todayChecklists()}
    ${L ? `<section class="homelines" aria-label="The shop at a glance">${line('Buy', L.buy, L.buyTone, 'overview')}${line('Arriving', L.arriving, L.arrivingTone, 'receiving')}${line('Selling', L.selling, L.sellingTone, 'trends')}</section>`
      : '<section class="panel"><div class="note">Home fills in after the first month-end upload.</div></section>'}
    <div class="tgrid">
      <section class="panel"><header><h2>This week's decisions</h2><button class="btn ghost sm" type="button" data-tab="actions">See all actions</button></header>
        <ul class="items">${d.length ? d.map(decisionHtml).join('') : '<li class="item good"><div class="stripe"></div><div class="body"><div class="t">Nothing needs attention.</div></div></li>'}</ul></section>
      ${a ? anaSalesCard(a, {w, go: 'trends'}) : '<section class="ccard"><h3>Sales by month</h3><div class="cs">Appears after the next month-end upload: it needs the category and subcategory report the upload builds.</div></section>'}
    </div>
    <div class="tgrid">
      ${R ? `<section class="panel"><header><h2>Receiving room by month</h2><span class="lab">${esc(R.fy)} · cumulative, all categories</span></header>${R.chart}</section>` : ''}
      ${todayDue()}
    </div></div>`;
}
