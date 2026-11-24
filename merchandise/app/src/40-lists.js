/* ---------- orders tab ---------- */
const vendorOf = p => VENDORS.find(v => v.id === p.vendorId);
const vendorName = p => (vendorOf(p) || {}).name || p.vendorName || p.vendor || '—';
const subName = id => (SUBCATS.find(s => s.id === id) || {}).name || '';
const COLS = [{k:'poNumber',l:'PO #'},{k:'vendor',l:'Vendor'},{k:'cat',l:'Category'},{k:'items',l:'Items'},{k:'deliveryMonth',l:'Delivery'},{k:'cancelDate',l:'Cancel by'},{k:'cost',l:'Cost',r:1},{k:'open',l:'Still to come',r:1},{k:'status',l:'Status'}];  // who entered an order is in its drawer
function sortVal(p, k){ if (k === 'open') return onOrder(p); if (k === 'cost') return poTotal(p); if (k === 'items') return poUnits(p); if (k === 'vendor') return vendorName(p).toLowerCase(); if (k === 'cat') return CAT(p.cat).name; return String(p[k] || ''); }
function rowFlag(p){ if (!isOpen(p)) return ''; if (p.status === 'hold') return 'flag-hold';
  if (p.cancelDate && p.cancelDate < todayISO) return 'flag-crit';
  if ((p.cancelDate && daysBetween(todayISO, p.cancelDate) <= 14) || (p.deliveryMonth && p.deliveryMonth < THIS_MONTH)) return 'flag-warn'; return ''; }
function itemsSummary(p){
  if (!p.lines || !p.lines.length) return num(p.units) ? `${int(num(p.units))} units` : '<span style="color:var(--faint)">total only</span>';
  const subs = [...new Set(p.lines.map(l => subName(l.sub)).filter(Boolean))];
  return `${int(poUnits(p))} units<span class="sm">${esc(subs.slice(0,2).join(', '))}${subs.length > 2 ? ' +' + (subs.length - 2) : ''}</span>`;
}
function catSummary(p){
  const cats = [...new Set((p.lines && p.lines.length ? p.lines.map(l => l.cat || p.cat) : [p.cat]))];
  return cats.length > 1 ? `${cats.length} categories<span class="sm">${esc(cats.map(c => CAT(c).name).join(', ').slice(0,40))}</span>` : `${esc(CAT(cats[0]).name)}<span class="sm">${esc(cats[0])}</span>`;
}
// Orders are grouped by vendor record, or by the typed name when an order has no vendor record.
const vkey = p => p.vendorId || ('n:' + vendorName(p));
// Open cost (still to come) by vendor, biggest first.
function vendorOpen(){
  const m = new Map();
  for (const p of POS){ if (!isOpen(p)) continue; const k = vkey(p), o = m.get(k) || {key: k, name: vendorName(p), n: 0, cost: 0}; o.n++; o.cost += onOrder(p); m.set(k, o); }
  return [...m.values()].sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name));
}
// The five biggest vendors by month of delivery (open orders, still to come); everyone else is "Other".
function deliveriesChart(vs){
  const top = vs.slice(0, 5), topK = new Set(top.map(v => v.key)), open = POS.filter(p => isOpen(p) && /^\d{4}-\d{2}/.test(p.deliveryMonth || ''));
  if (!open.length) return '';
  const ds = deliverySlots(open.map(p => p.deliveryMonth), THIS_MONTH), cols = (ds.early ? ['Earlier / late'] : []).concat(ds.months.map(monthLabel), ds.later ? ['Later'] : []), n = cols.length;
  const series = top.map((v, j) => ({name: v.name, key: v.key, k: j + 1, values: cols.map(() => 0)}));
  const other = {name: 'Other vendors', k: 'ly', values: cols.map(() => 0)};
  for (const p of open){ const i = ds.slot(p.deliveryMonth), s = topK.has(vkey(p)) ? series.find(z => z.key === vkey(p)) : other; s.values[i] += onOrder(p); }
  const hasOther = other.values.some(v => v), all = hasOther ? [...series, other] : series, labs = cols;
  const legend = `<div class="lg">${series.map(s => `<button type="button" class="lgb" data-ovend="${esc(s.key)}" aria-pressed="${filt.vendor === s.key}" title="Show only ${esc(s.name)}"><i class="csw k${s.k}"></i>${esc(s.name)}</button>`).join('')}${hasOther ? '<span><i class="csw kly"></i>Other vendors</span>' : ''}</div>`;
  return `<section class="ccard"><h3>Deliveries by month</h3><div class="cs">What is still to come on open orders, by the month it is due, for the ${series.length} vendors with the most open cost. Click a vendor to show only its orders.</div>
    ${legend}${chStack({labels: labs, series: all, fmt: moneyK, label: 'Open orders by delivery month, by vendor'})}
    ${anaNumbers(['Month', ...all.map(s => s.name), 'Total'], cols.map((m, i) => [labs[i], ...all.map(s => money(s.values[i])), money(all.reduce((a, s) => a + s.values[i], 0))]))}</section>`;
}
function renderOrders(S){
  if (filt.vendor !== 'all' && !POS.some(p => vkey(p) === filt.vendor)) filt.vendor = 'all';
  const sel = selMonth(), q = filt.q.trim().toLowerCase();
  let rows = POS.filter(p => {
    if (filt.status === 'active' && !isOpen(p)) return false;
    if (filt.status === 'hold' && p.status !== 'hold') return false;
    if (filt.status === 'received' && p.status !== 'received') return false;
    if (filt.status === 'cancelled' && p.status !== 'cancelled') return false;
    if (filt.cat !== 'all' && !(p.cat === filt.cat || (p.lines || []).some(l => l.cat === filt.cat))) return false;
    if (filt.vendor !== 'all' && vkey(p) !== filt.vendor) return false;
    if (filt.season !== 'all' && (seasonOf(p.deliveryMonth) || {}).label !== filt.season) return false;
    if (filt.arriving && sel !== 'season' && bucket(p) !== sel) return false;
    if (q && !`${p.poNumber} ${vendorName(p)} ${p.notes || ''} ${p.fix || ''} ${(p.lines || []).map(l => l.style + ' ' + l.color).join(' ')}`.toLowerCase().includes(q)) return false;
    return true;
  });
  rows.sort((a,b) => { const x = sortVal(a, sort.key), y = sortVal(b, sort.key); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  const vs = vendorOpen(), allV = new Map(POS.map(p => [vkey(p), vendorName(p)])), vopts = [...allV].sort((a, b) => a[1].localeCompare(b[1]));
  const seasons = new Map(); for (const p of POS){ const z = seasonOf(p.deliveryMonth); if (z) seasons.set(z.label, z.first); }
  const sopts = [...seasons].sort((a, b) => a[1].localeCompare(b[1])).map(z => z[0]);
  const filtered = filt.vendor !== 'all' || filt.season !== 'all';
  const segB = (v,l) => `<button type="button" data-ofilt="${v}" aria-pressed="${filt.status === v}">${l}</button>`;
  const strip = vs.length ? `<div class="chips vstrip" role="group" aria-label="Open cost by vendor"><span class="lab" style="margin-right:4px">Open cost</span>${vs.slice(0, 8).map(v => `<button type="button" class="fchip" data-ovend="${esc(v.key)}" aria-pressed="${filt.vendor === v.key}" title="${v.n} open order${v.n === 1 ? '' : 's'}, ${esc(money(v.cost))} still to come">${esc(v.name)}<span class="c">${moneyK(v.cost)}</span></button>`).join('')}${vs.length > 8 ? `<span class="sm" style="color:var(--muted)">and ${vs.length - 8} more vendors</span>` : ''}</div>` : '';
  const chart = vs.length ? deliveriesChart(vs) : '';
  const sumCost = rows.reduce((a, p) => a + poTotal(p), 0), sumOpen = rows.reduce((a, p) => a + onOrder(p), 0);
  // Sorted by delivery (the default), the orders fall under a heading for each month with its count and what's still to come.
  const byMonth = sort.key === 'deliveryMonth', mkey = p => String(p.deliveryMonth || '').slice(0, 7);
  const mtot = new Map(); for (const p of rows){ const k = mkey(p), t = mtot.get(k) || {n: 0, open: 0}; t.n++; t.open += onOrder(p); mtot.set(k, t); }
  const monthHead = k => { const t = mtot.get(k); return `<tr class="mgrp"><td colspan="${COLS.length}"><b>${k ? monthLabel(k) : 'No delivery month'}</b><span>${t.n} order${t.n === 1 ? '' : 's'} · ${money(t.open)} still to come</span></td></tr>`; };
  $('#pane').innerHTML = `${chart ? `<div class="astack" style="margin-bottom:18px">${chart}</div>` : ''}<section class="panel">
    ${strip}
    <div class="toolbar"><div class="filters"><div class="seg" role="group" aria-label="Status">${segB('active','Open')}${POS.some(p => p.status === 'hold') ? segB('hold', `On hold (${POS.filter(p => p.status === 'hold').length})`) : ''}${segB('all','All')}${segB('received','Received')}${segB('cancelled','Cancelled')}</div>
      ${sel !== 'season' ? `<label style="font-size:13px;display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="fArr" ${filt.arriving ? 'checked' : ''}> Only arriving in ${monthFull(sel)}</label>` : ''}</div>
      <div class="filters"><label for="fVend" class="sr">Vendor</label><select id="fVend" class="field-inline"><option value="all">All vendors</option>${vopts.map(([k, n]) => `<option value="${esc(k)}" ${filt.vendor === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <label for="fSeason" class="sr">Season</label><select id="fSeason" class="field-inline"><option value="all">All seasons</option>${sopts.map(n => `<option value="${esc(n)}" ${filt.season === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <label for="fCat" class="sr">Category</label><select id="fCat" class="field-inline"><option value="all">All categories</option>${catList().map(c => `<option value="${c.code}" ${filt.cat === c.code ? 'selected' : ''}>${c.code} · ${esc(c.name)}</option>`).join('')}</select>
      <label for="fQ" class="sr">Search</label><input id="fQ" class="field-inline" type="search" placeholder="Search PO #, vendor, style" value="${esc(filt.q)}"></div></div>
    ${rows.length ? `<div class="note" style="padding:6px 18px">${int(rows.length)} order${rows.length === 1 ? '' : 's'} · ${money(sumCost)} ordered · ${money(sumOpen)} still to come${filtered ? ' <button type="button" class="btn ghost sm" data-oclear="1">Clear vendor and season</button>' : ''}</div>` : ''}
    <div class="tbl"><table><thead><tr>${COLS.map(c => `<th class="${c.r ? 'r' : ''}" aria-sort="${sort.key === c.k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" data-sort="${c.k}">${c.l}${sort.key === c.k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead>
    <tbody class="click">${rows.map((p, i) => `${byMonth && (i === 0 || mkey(rows[i - 1]) !== mkey(p)) ? monthHead(mkey(p)) : ''}<tr class="${rowFlag(p)}" data-po="${esc(p.id)}" tabindex="0">
      <td class="po">${esc(p.poNumber)}</td><td>${esc(vendorName(p))}${RISK_VENDORS.test(vendorName(p)) ? '<span class="sm" style="color:var(--ochre)">cost risk</span>' : ''}</td>
      <td>${catSummary(p)}</td><td>${itemsSummary(p)}</td><td class="nowrap">${monthLabel(p.deliveryMonth)}</td><td class="num nowrap">${p.cancelDate ? dateLabel(p.cancelDate) : '—'}</td>
      <td class="r num">${money(poTotal(p))}</td><td class="r num">${onOrder(p) ? money(onOrder(p)) : '—'}${arrivalBarHtml(p)}</td>
      <td><span class="pill ${esc(p.status)}">${STATUS[p.status] || esc(p.status)}</span>${p.status === 'hold' && p.fix ? `<span class="sm fixnote" title="${esc(p.fix)}">${esc(p.fix)}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>
    ${!POS.length ? `<div class="empty"><h3>No purchase orders yet</h3><p>Click <b>+ New order</b> to write one, or use <b>Tools → Paste orders from a spreadsheet</b> to load your current open orders all at once.</p>${canAct() ? '<button class="btn primary" type="button" data-act="new">+ New order</button>' : ''}</div>` : !rows.length ? `<div class="empty"><p>No orders match these filters.</p>${filtered ? '<button type="button" class="btn sm" data-oclear="1">Clear vendor and season</button>' : ''}</div>` : ''}
  </section>`;
  fillPeople();
}

/* ---------- needs attention tab ---------- */
function itemHtml(i, compact){
  const cat = i.cat ? CAT(i.cat).name : '';
  const st = i.state;
  const who = st ? `<span class="who">${st.status === 'done' ? 'Done' : 'Set aside'} ${dateLabel((st.at || '').slice(0,10))} · <span class="person" data-uid="${esc(st.by || '')}"></span></span>` : '';
  const go = i.kind === 'order' ? (i.guide ? `<button class="btn sm" type="button" data-go="guidelines:${esc(i.guide)}">Open the guideline</button>` : i.po ? `<button class="btn sm" type="button" data-openpo="${esc(i.po)}">Open order</button>` : i.cat ? `<button class="btn sm" type="button" data-cat="${esc(i.cat)}">Open category</button>` : '') : '';
  // Every item, order problems included, can be marked Done or Not now (and undone); Not now is the one word for setting one aside.
  const btns = compact ? '' : go + (st ? (canAct() ? `<button class="btn sm" type="button" data-istate="${esc(i.id)}" data-v="">Undo</button>` : '')
      : `${(i.kind === 'reorder' || i.kind === 'stockout') && canAct() ? `<button class="btn primary sm" type="button" data-startorder="${esc(i.id)}">Start an order</button>` : ''}
         ${canAct() ? `<button class="btn sm" type="button" data-istate="${esc(i.id)}" data-v="done">Done</button><button class="btn ghost sm" type="button" data-istate="${esc(i.id)}" data-v="dismissed">Not now</button>` : ''}`);
  return `<li class="item ${i.sev} ${st ? 'resolved' : ''}"><div class="stripe"></div><div class="body">
    <div class="t"><span class="kind ${i.kind}">${KINDS[i.kind]}</span>${esc(i.title)}</div>
    ${i.sku ? `<div class="d"><span class="num">${esc(i.sku)}</span> · ${esc(i.desc)}${cat ? ' · ' + esc(cat) : ''}</div>` : ''}
    <div class="d">${esc(posDates(i.detail))}</div>
    ${compact ? '' : `<div class="a"><b>What to do:</b> ${esc(i.action)}</div>`}${who ? `<div class="d">${who}</div>` : ''}
  </div><div class="side">${btns}</div></li>`;
}
function renderAttention(S){
  const all = allAttention(S);
  const counts = {}; for (const i of all) if (!i.state) counts[i.kind] = (counts[i.kind] || 0) + 1;
  let list = all.filter(i => (afilt.showResolved || !i.state) && (afilt.kind === 'all' || i.kind === afilt.kind) && (afilt.cat === 'all' || i.cat === afilt.cat));
  const rank = {crit:0, warn:1, good:2, info:3};
  list.sort((a,b) => (!!a.state - !!b.state) || (a.kind === 'order' ? -1 : 0) - (b.kind === 'order' ? -1 : 0) || rank[a.sev] - rank[b.sev] || (b.priority || 0) - (a.priority || 0));
  const fc = (k, l) => `<button type="button" class="fchip" data-akind="${k}" aria-pressed="${afilt.kind === k}">${l}<span class="c">${k === 'all' ? Object.values(counts).reduce((a,b) => a + b, 0) : (counts[k] || 0)}</span></button>`;
  const top = topDecisions(S);
  $('#pane').innerHTML = `${top.length ? `<section class="panel" style="margin-bottom:16px">
    <header><h2>Most important this week</h2><span class="lab">${top.length} decisions · biggest dollars first</span></header>
    <div class="note" style="border-bottom:1px solid var(--rule)">The few decisions worth the most money right now, from the order problems, the item list below and the scorecard's suggestions. Mark one Done when you've acted, or Not now to take it off this list; everything stays in the full list.</div>
    <ul class="items">${top.map(decisionHtml).join('')}</ul></section>` : ''}<section class="panel">
    <header><h2>To do</h2><span class="lab">Item suggestions from the ${dateLabel(INS.asOf)} SKU Analysis · refreshed each month-end</span></header>
    <div class="chips">${fc('all','All')}${Object.keys(KINDS).map(k => fc(k, KINDS[k])).join('')}
      <span style="flex:1"></span><select id="aCat" class="field-inline" aria-label="Category"><option value="all">All categories</option>${catList().map(c => `<option value="${c.code}" ${afilt.cat === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <label style="font-size:12.5px;display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="aRes" ${afilt.showResolved ? 'checked' : ''}> Show done</label></div>
    <div class="note" style="border-bottom:1px solid var(--rule)">${esc(KIND_NOTE[afilt.kind] || KIND_NOTE.all)}</div>
    ${list.length ? (afilt.kind === 'all' ? attnGroups(list) : `<ul class="items">${list.map(i => itemHtml(i, false)).join('')}</ul>`) : '<ul class="items"><li class="item good"><div class="stripe"></div><div class="body"><div class="t">Nothing here.</div><div class="d">Everything in this view has been dealt with.</div></div></li></ul>'}
  </section>`;
  fillPeople();
}
/* The All view in groups, one per kind in KINDS order, each showing its first ATTN_SHOW items (already ranked) with
   a button for the rest; afilt.more holds the kinds opened in full. */
const ATTN_SHOW = 5;
function attnGroups(list){
  const by = {}; for (const i of list) (by[i.kind] = by[i.kind] || []).push(i);
  return Object.keys(KINDS).filter(k => by[k]).map(k => {
    const xs = by[k], open = !!(afilt.more || {})[k], show = open ? xs : xs.slice(0, ATTN_SHOW);
    const more = xs.length > ATTN_SHOW ? `<button type="button" class="btn ghost sm agmore" data-amore="${k}" aria-expanded="${open}">${open ? 'Show the first ' + ATTN_SHOW : `Show all ${xs.length}`}</button>` : '';
    return `<div class="agrp"><h3 class="agh"><span class="kind ${k}">${esc(KINDS[k])}</span><span class="c">${xs.length}</span></h3>
      <ul class="items">${show.map(i => itemHtml(i, false)).join('')}</ul>${more}</div>`;
  }).join('');
}
const KIND_NOTE = {
  all:'Order problems come first, then item suggestions ranked by dollars at stake. Each group shows its five biggest first. Mark one Done when you have acted on it, or Not now if it doesn\'t apply; what you mark stays through each month-end refresh.',
  order:'Problems with orders you have written: cancel dates, late deliveries, and categories going over budget. These update the moment an order changes.',
  reorder:'Fast sellers that will run out in under 6 weeks at the pace forecast for the coming weeks. "Start an order" fills in a new order for you.',
  stockout:'Items that sold well in the last three months but have none on hand. Reorder the ones you are keeping in the line.',
  overstock:'Items with more than a year of stock at the current pace. Don\'t reorder them; move them with a feature or a markdown.',
  aged:'Items that have not sold in over a year. "Restocked" means more arrived after it stopped selling — check whether that receipt was a mistake.',
  margin:'The latest cost is well above what you paid last year, but the selling price hasn\'t changed. Check the invoice, then re-price or renegotiate.',
  split:'One SKU is being used for several different products. You can\'t tell which design, color or size sells, so reorders are guesses and dead styles never show up as not selling.',
  data:'Records that can\'t be right, such as negative stock. Fix them before the next count so the numbers the plan uses are real.'
};

/* ---------- inventory & counts tab ---------- */
function renderInventory(S){
  const rows = catList().map(c => { const i = INV.cats[c.code] || {units:0,cost:0,aged:0,skus:0}; const wks = catWeeks(c.code, shelfCost(c.code, i.cost));
    return {c, i, wks, tgt: c.target, gap: i.cost - (c.target || 0)}; });
  const T = rows.reduce((a,r) => ({units:a.units + r.i.units, cost:a.cost + r.i.cost, aged:a.aged + r.i.aged, skus:a.skus + r.i.skus}), {units:0,cost:0,aged:0,skus:0});
  const counts = [...COUNTS].sort((a,b) => String(b.date).localeCompare(String(a.date)));
  const lastCt = counts[0], ctCats = lastCt ? Object.entries(lastCt.cats || {}).filter(([, c]) => num(c.book) || num(c.counted)).sort((a, b) => num(b[1].book) - num(a[1].book)) : [];
  const ctChart = ctCats.length ? `<section class="ccard"><h3>Book against counted</h3><div class="cs">${esc(lastCt.label || 'Latest count')}, ${dateLabel(lastCt.date)}: what the system said you had against what was counted, by category, at cost. Counted below book is shrink.</div>
    ${chLegend([{name: 'Book', k: 1}, {name: 'Counted', k: 2}])}
    ${chBars({labels: ctCats.map(([c]) => CAT(c).name), series: [{name: 'Book', values: ctCats.map(([, c]) => num(c.book)), k: 1}, {name: 'Counted', values: ctCats.map(([, c]) => num(c.counted)), k: 2}], label: 'Book against counted by category',
      tips: i => `Book: ${money(num(ctCats[i][1].book))} · Counted: ${money(num(ctCats[i][1].counted))} · Difference: ${money(num(ctCats[i][1].counted) - num(ctCats[i][1].book))}`})}</section>` : '';
  $('#pane').innerHTML = `<div class="stack">
  ${ctChart}
  <section class="panel"><header><h2>Inventory on hand</h2><span class="lab">${esc(INV.source)} · as of ${dateLabel(INV.asOf)}</span></header>
    <div class="note" style="border-bottom:1px solid var(--rule)">This is the starting point for every budget. It updates each month-end when the new SKU Analysis comes in. <b>Weeks of supply</b> is how long the stock lasts at the sales pace forecast for the coming months. <b>Target by Apr 30</b> is the stock level the plan is steering towards.</div>
    <div class="tbl"><table style="min-width:900px"><thead><tr><th><span class="h">Category</span></th><th class="r"><span class="h">SKUs</span></th><th class="r"><span class="h">Units</span></th><th class="r"><span class="h">At cost</span></th><th class="r"><span class="h">Not sold 12+ mo</span></th><th class="r"><span class="h">Weeks of supply</span></th><th class="r"><span class="h">Target by Apr 30</span></th><th><span class="h">Read</span></th></tr></thead>
    <tbody class="click">${rows.map(r => `<tr data-cat="${r.c.code}"><td><b>${esc(r.c.name)}</b><span class="sm">${r.c.code}</span></td><td class="r num">${int(r.i.skus)}</td><td class="r num">${int(r.i.units)}</td><td class="r num">${money(r.i.cost)}</td>
      <td class="r num">${r.i.aged ? money(r.i.aged) + `<span class="sm">${Math.round(r.i.aged / r.i.cost * 100)}%</span>` : '—'}</td><td class="r num" ${r.wks > 30 ? 'style="color:var(--brick)"' : ''}>${r.wks ? Math.round(r.wks) : '—'}</td>
      <td class="r num">${r.tgt != null ? money(r.tgt) : '—'}</td><td style="font-size:12.5px;color:var(--muted)">${invRead(r)}</td></tr>`).join('')}
      <tr class="tot"><td>Total merchandise</td><td class="r num">${int(T.skus)}</td><td class="r num">${int(T.units)}</td><td class="r num">${money(T.cost)}</td><td class="r num">${money(T.aged)}</td><td></td><td class="r num">${money(rows.reduce((a,r) => a + (r.tgt || 0), 0))}</td><td></td></tr></tbody></table></div>
    ${S.receivedSince ? `<div class="note">${money(S.receivedSince)} has been received on orders logged here since ${dateLabel(INV.asOf)}. It will show in on-hand after the next month-end SKU Analysis.</div>` : ''}
  </section>
  <section class="panel"><header><h2>Quarterly counts</h2>${canAct() ? '<button class="btn primary sm" type="button" data-act="count">+ Record a count</button>' : ''}</header>
    <div class="note" style="border-bottom:1px solid var(--rule)">After each count, enter what the system said you had (<b>book</b>) and what you actually counted, by category, at cost. The difference is shrink. A shortage means you have less stock than the plan assumed, so ${isAdmin ? 'you can' : 'the owner can'} add it back to that category's budget with one click.</div>
    ${counts.length ? `<div class="tbl"><table style="min-width:760px"><thead><tr><th><span class="h">Count</span></th><th class="r"><span class="h">Book</span></th><th class="r"><span class="h">Counted</span></th><th class="r"><span class="h">Difference</span></th><th class="r"><span class="h">Shrink</span></th><th><span class="h">Entered by</span></th><th></th></tr></thead><tbody class="click">
      ${counts.map(ct => { const t = countTotals(ct); return `<tr data-count="${esc(ct.id)}"><td><b>${esc(ct.label || 'Count')}</b><span class="sm">${dateLabel(ct.date)}</span></td><td class="r num">${money(t.book)}</td><td class="r num">${money(t.counted)}</td>
        <td class="r num ${t.diff < 0 ? 'neg' : ''}">${money(t.diff)}</td><td class="r num">${t.book ? (Math.max(-t.diff, 0) / t.book * 100).toFixed(2) + '%' : '—'}</td><td><span class="person" data-uid="${esc(ct.by || '')}"></span></td><td>${ct.applied ? '<span class="chip buy">Applied to budgets</span>' : ''}</td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="empty"><h3>No counts recorded yet</h3><p>Record your next quarterly count here. Over a year this builds a shrink rate by category, which goes into next year's plan.</p></div>`}
  </section></div>`;
  fillPeople();
}
function invRead(r){
  if (!inOTB(r.c.code)) return 'Customer orders — not budgeted.';
  if (r.i.aged / Math.max(r.i.cost, 1) > .3) return 'Heavy with old stock — clear before buying.';
  if (r.wks > 30) return 'Too much stock for the pace of sales.';
  if (r.gap > r.tgt * .5 && r.tgt > 0) return 'Above target; buy lightly until it works down.';
  if (r.wks && r.wks < 12) return 'Lean — keep reorders flowing.';
  return 'In line with plan.';
}
const countTotals = ct => Object.values(ct.cats || {}).reduce((a,c) => ({book:a.book + num(c.book), counted:a.counted + num(c.counted), diff:a.diff + num(c.counted) - num(c.book)}), {book:0, counted:0, diff:0});

/* ---------- how it works ---------- */
function renderHelp(){
  const P = PLANS.cur || PLAN, ga = P.cats['620'] || {};
  $('#pane').innerHTML = `<div class="help">
  <section class="panel"><div class="in"><h3>The pages</h3>
    <p>The sidebar on the left groups the pages by the job you're doing. On a narrow screen it folds into the Menu button at the top.</p>
    ${NAV.map(g => `<h4 style="margin:12px 0 4px">${esc(g.label)}</h4><dl class="gl">${g.pages.map(([id, label]) => `<dt>${esc(label)}</dt><dd>${esc(id === 'vendors' ? 'Vendor contacts, account numbers, terms and lead times. Every order picks its vendor from this list.' : (TABHEAD[id] || [])[1] || '')}</dd>`).join('')}</dl>`).join('')}
    <h3 style="margin-top:14px">What the open-to-buy is</h3>
    <p>A spending limit for merchandise, set by category and month, at cost. It tells you how much you can bring in without ending the year with more stock than you need.</p>
    <div class="formula"><div class="ln"><span class="op"></span><span>Stock you want at the end of the year</span><span>target</span></div>
      <div class="ln"><span class="op">+</span><span>What you're expected to sell, at cost</span><span>forecast</span></div>
      <div class="ln"><span class="op">−</span><span>What's on the shelf at the start</span><span>on hand</span></div>
      <div class="ln tot"><span class="op">=</span><span>What you can still bring in</span><span>budget</span></div></div>
    <p><b>It's based on sales.</b> This year's open months are last year's sales for the month plus a growth rate, and next year is this year plus a growth rate for each category. All of it is on the Forecast page, converted to cost at each category's real margin. <b>Only shelf sales count:</b> special orders — a member's custom clubs, an event's logo order — are bought when the customer orders, so their sales and the stock waiting for them are left out of every budget.</p>
    <h3 style="margin-top:14px">Worked example: General Accessories, ${P.fy}</h3>
    <div class="formula"><div class="ln"><span class="op"></span><span>Target stock at the end of ${monthLabel(P.window.to)}</span><span>${money(ga.target || 0)}</span></div><div class="sub">${ga.wos ? esc(wosLabel(ga, P)) : '14 weeks'} of the cost of shelf sales forecast for the four months after</div>
      <div class="ln"><span class="op">+</span><span>Forecast cost of shelf sales</span><span>${money(ga.cogs || 0)}</span></div><div class="sub">${money(ga.shelf || 0)} of shelf sales at retail, at ${Math.round((ga.gm || 0) * 100)}% margin</div>
      <div class="ln"><span class="op">−</span><span>On hand ${dateLabel(P.asOf)}</span><span>${money(ga.onHand || 0)}</span></div>
      <div class="ln tot"><span class="op">=</span><span>${P.fy} budget</span><span>${money(ga.plan || 0)}</span></div></div>
  </div></section>
  <section class="panel"><div class="in"><h3>Buying for next year</h3>
    <p>Pick <b>${PLANS.next ? PLANS.next.fy : 'next year'}</b> at the top of the Budget page (Plan), or enter any order with a delivery month from May on. It's checked against next year's budget automatically.</p>
    <p>Next year's budget starts from the stock this year is expected to end with. If a category is overbought now, or you order more than this year's budget, the extra comes out of next year's budget. The Open-to-buy page lists what next year inherits.</p>
    <p>The brand scorecard warns you when you order from a brand marked Drop or Reduce.</p>
    <h3 style="margin-top:14px">Months</h3>
    <p>The budget is spread across the months, so you don't bring everything in at once. Pick a month to see how much room you have <b>by the end of that month</b>. A category with <b>no room yet</b> started the year with more stock than it needed; it gets room once enough of that stock has sold.</p>
    <h3 style="margin-top:14px">What the labels mean</h3>
    <dl class="gl">${Object.keys(CALLTXT).map(k => `<dt><span class="chip ${k}">${CALLTXT[k]}</span></dt><dd>${CALLHELP[k]}</dd>`).join('')}</dl>
    <h3 style="margin-top:14px">Changing a budget</h3>
    <p>Budgets are a starting point, not a rule. The owner can raise or lower any category, in any month, with a reason — for example a new vendor or a big outing. Open a category and click <b>Change budget</b>. Every change is kept in a list with who made it and why.</p>
    <p>Each month-end the plan is refreshed from actual sales and stock. Your changes stay in place on top of it. Budget changes belong to the year shown at the top.</p>
  </div></section>
  <section class="panel"><div class="in"><h3>Your routine</h3><ul class="routine">
    <li><span class="when">Every order</span><span>Enter it the day you write it: vendor, delivery month, cancel date, and the lines with sizes. The budget check happens as you type.</span></li>
    <li><span class="when">Deliveries</span><span>Receive boxes into the POS as usual. At each month-end upload the program works out what arrived from the SKU Analysis and matches it to open orders; the owner confirms the list. Whatever hasn't come stays on order.</span></li>
    <li><span class="when">Mondays</span><span>Go through <b>To do</b>. Mark each item Done or Not now.</span></li>
    <li><span class="when">Month-end</span><span>Work through the <b>Month-end</b> checklist: run the reports and the owner uploads them on that page, PDF or Excel. The forecast, budgets, on-hand, suggestions and brand scorecard are then refreshed.</span></li>
    <li><span class="when">Each season</span><span>Review the <b>Brands</b> page before market or a buying appointment. Set your own call where you disagree.</span></li>
    <li><span class="when">Quarterly</span><span>After the count, go to <b>Stock &amp; counts</b> and record book and counted values by category.</span></li></ul></div></section>
  <section class="panel"><div class="in"><h3>Words used on this page</h3><dl class="gl">
    <dt>At cost</dt><dd>What you pay the vendor, not the retail price. Every budget and inventory figure here is at cost.</dd>
    <dt>Room</dt><dd>How much the plan lets you receive by a given date.</dd>
    <dt>Committed</dt><dd>Orders you've written that arrive in the period, plus what's already been received.</dd>
    <dt>Left to buy</dt><dd>Room minus committed.</dd>
    <dt>On order</dt><dd>The part of open orders that hasn't arrived yet.</dd>
    <dt>Weeks of supply</dt><dd>How many weeks the stock on hand lasts at the expected sales pace. Twelve to sixteen is healthy for most categories.</dd>
    <dt>Shrink</dt><dd>Stock that the system says you have but the count doesn't find — theft, damage, mis-rings.</dd>
    <dt>GMROI</dt><dd>Gross margin earned in a year for each $1 of stock at cost. Above 2 is strong for apparel; under 1 means the stock isn't paying its way.</dd>
    <dt>What-if</dt><dd>Forecast changes you're trying out that aren't saved. Only you see them, until the owner saves them as the plan.</dd>
    <dt>Combined SKU</dt><dd>One SKU number used for several different products, so the reports can't tell them apart.</dd></dl></div></section>
  </div>`;
}
