/* ---------- one category's page (#category:<code>) ----------
   Stage 3 (spec 2026-11-22-merch-phase2): how a category is doing and what to do about it, on one page. Every figure
   comes from the functions the other pages use (anaNow, stats, seasonBudget, stuckMoney, arrivalBarHtml), so they agree.
   CATSEL is the category shown; goTab('category', code) sets it (90-io.js). */
let CATSEL = null;
/** The code if it is a category in the plan or the analysis, else null (a stale link opens All categories). */
function catPageTarget(code){
  const c = String(code == null ? '' : code);
  if (!c) return null;
  if (PLAN && PLAN.cats && PLAN.cats[c]) return c;
  const a = typeof anaNow === 'function' ? anaNow() : null;
  return a && a.cats.some(x => x.cat === c) ? c : null;
}
/** Everything the page shows for one category. sales and margin are null without a sales analysis row (a new code,
    Special Orders); budget is null outside the open-to-buy. Left to buy is the Budget page's whole-year figure. */
function catPageData(code, S){
  const a = anaNow(), c = a ? a.cats.find(x => x.cat === code) : null, p = PLAN && PLAN.cats ? PLAN.cats[code] : null;
  const inv = (INV && INV.cats && INV.cats[code]) || {cost: 0, aged: 0}, oh = c ? c.oh : num(inv.cost);
  let sales = null;
  if (c){
    const n = c.series.length, ty = c.series.slice(Math.max(0, n - 12)), ly = c.series.slice(Math.max(0, n - 24), Math.max(0, n - 12));
    while (ly.length < ty.length) ly.unshift(null);
    sales = {t12: c.t12, growth: c.growth, ty, ly, labels: a.months.slice(Math.max(0, n - 12)).map(mLab)};
  }
  const wks = c ? c.wks : catWeeks(code, shelfCost(code, inv.cost));
  return {
    code, name: (c && c.name) || CAT(code).name, role: roleOf(code), cat: c, sales,
    stock: {oh, wks, wksTarget: p && p.wos ? wosNum(p.wosEff || p.wos) : null, aged: c ? c.aged : num(inv.aged), agedPct: c ? c.agedPct : null},
    margin: c ? {gm: c.gm, gmroi: c.gmroi} : null,
    budget: S && p && inOTB(code) ? {budget: seasonBudget(code), committed: S.cm(code, LAST()), left: roomThrough(code, LAST()) - S.cm(code, LAST())} : null,
    orders: POS.filter(o => isOpen(o) && (o.cat === code || (o.lines || []).some(l => l.cat === code)))
      .sort((x, y) => String(x.deliveryMonth).localeCompare(String(y.deliveryMonth))),
    markdown: a ? stuckMoney(a).markdown.filter(x => x.M.cat === code).slice(0, 10).map(x => ({sub: x.M.name, aged: x.M.aged, agedPct: x.M.agedPct, seg: x.M.seg, cashAt30: x.cashAt30})) : [],
    actions: S ? actionsFor(S, code) : []
  };
}
function renderCategory(S){
  if (!BASE || !CATSEL){ $('#pane').innerHTML = '<section class="panel"><div class="note" style="font-size:14px">A category\'s page appears after the first month-end upload.</div></section>'; return; }
  const d = catPageData(CATSEL, S), c = d.cat, g = k => c ? grade(k, c[k], c.seg, c.cat) : null;
  const sales = d.sales;
  const chart = sales ? `<section class="ccard"><h3>Sales by month</h3><div class="cs">The last 12 months against the same months a year earlier, at retail.</div>
      ${chLegend([{name: 'Last 12 months', k: 1}, {name: 'A year earlier', k: 'ly', dash: true}])}
      ${chLine({labels: sales.labels, series: [{name: 'Last 12 months', values: sales.ty, k: 1}, {name: 'A year earlier', values: sales.ly, k: 'ly', dash: true}], label: d.name + ' sales by month'})}
      ${anaNumbers(['Month', 'Sales', 'A year earlier'], sales.labels.map((l, i) => [l, money(num(sales.ty[i])), sales.ly[i] == null ? '—' : money(sales.ly[i])]))}</section>` : '';
  const acts = `<section class="panel"><header><h2>Actions</h2><span class="lab">${d.actions.length} · biggest dollars first</span></header>
    <ul class="items">${d.actions.length ? d.actions.map(decisionHtml).join('') : `<li class="item good"><div class="stripe"></div><div class="body"><div class="t">Nothing to do in ${esc(d.name)}.</div></div></li>`}</ul></section>`;
  const subs = c && c.subs.length ? `<section class="panel"><header><h2>Subcategories</h2><span class="lab">${c.subs.length}</span></header>
    <div class="atbl"><table style="min-width:1140px"><thead><tr><th><span class="h">Subcategory</span></th><th class="r"><span class="h">Sales, 12 mo</span></th><th class="r"><span class="h">Growth</span></th><th class="r"><span class="h">Last 3 mo</span></th><th><span class="h">Share: sales / stock</span></th><th class="r"><span class="h">Margin</span></th><th class="r"><span class="h">Markdowns</span></th><th class="r"><span class="h">Turns</span></th><th class="r"><span class="h">GMROI</span></th><th class="r"><span class="h">Weeks</span></th><th class="r"><span class="h">Aged</span></th><th class="r"><span class="h">On hand</span></th><th class="sp"><span class="h">24 months</span></th></tr></thead>
    <tbody>${c.subs.map(s => anaRow(s, true)).join('')}</tbody></table></div></section>` : '';
  const orders = `<section class="panel"><header><h2>Open orders</h2><span class="lab">${d.orders.length}</span></header>${d.orders.length ? `<div class="tbl"><table class="mini rt" style="min-width:0"><thead><tr><th>Order</th><th>Delivery</th><th class="r">Still to come</th></tr></thead><tbody class="click">${d.orders.map(p =>
    `<tr data-po="${esc(p.id)}" tabindex="0"><td class="wrapv"><b>PO ${esc(p.poNumber)}</b> · ${esc(vendorName(p))}</td><td data-l="Delivery">${monthLabel(p.deliveryMonth)}${rcvOf(p) === 'late' ? ' <span class="rstat overdue">Late</span>' : ''}</td><td data-l="Still to come" class="r num">${money(onOrder(p))}${arrivalBarHtml(p)}</td></tr>`).join('')}</tbody></table></div>`
    : `<div class="note">No open orders in ${esc(d.name)}.</div>`}</section>`;
  const md = d.markdown.length ? `<section class="panel"><header><h2>Markdown candidates</h2><span class="lab">Aged stock by subcategory</span></header><div class="atbl"><table style="min-width:480px"><thead><tr><th><span class="h">Subcategory</span></th><th class="r"><span class="h">Aged</span></th><th class="r"><span class="h">Aged share</span></th><th class="r"><span class="h">Cash at 30% off</span></th></tr></thead>
    <tbody>${d.markdown.map(x => `<tr><td>${esc(x.sub)}</td><td class="r num">${money(x.aged)}</td><td${aHeat(grade('agedPct', x.agedPct, x.seg))}>${aPct(x.agedPct)}</td><td class="r num">${money(x.cashAt30)}</td></tr>`).join('')}</tbody></table></div></section>` : '';
  const b = d.budget, seg = c && c.seg ? SEGS[c.seg] : null;
  $('#pane').innerHTML = `<div class="astack">
    <div class="subhead"><h2>${esc(d.name)} <span class="rolepill" title="${esc(d.role.judge)}">${esc(d.role.name)}</span></h2><span>Category ${esc(d.code)}</span></div>
    <section class="tiles">
      ${anaTile('Sales, 12 months', sales ? money(sales.t12) : '—', sales && sales.growth != null ? `${aChg(sales.growth)} on the year before` : '')}
      ${anaTile('Weeks of supply', d.stock.wks != null ? aWk(d.stock.wks) : '—', d.stock.wksTarget != null ? `target ${d.stock.wksTarget}` : '', aGrade(g('wks')))}
      ${anaTile('Margin', d.margin ? aPct(d.margin.gm) : '—', d.margin ? `GMROI ${aX(d.margin.gmroi, 2)}` : '', aGrade(g('gmroi')))}
      ${anaTile('Aged stock', money(d.stock.aged), d.stock.agedPct != null ? `${aPct(d.stock.agedPct)} of ${money(d.stock.oh)} on hand unsold 12+ months` : '', aGrade(g('agedPct')))}
      ${anaTile('Left to buy', b ? `<span class="${b.left < 0 ? 'neg' : ''}">${money(b.left)}</span>` : '—', b ? `of a ${money(b.budget)} ${esc(PLAN.fy)} budget` : 'not in the open-to-buy')}
    </section>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" type="button" data-cat="${esc(d.code)}">Budget details</button>${seg ? `<button class="btn ghost sm" type="button" data-tab="brands">Brands in ${esc(seg.toLowerCase())}</button>` : ''}</div>
    ${acts}${chart}${subs}${orders}${md}</div>`;
  fillPeople();
}
