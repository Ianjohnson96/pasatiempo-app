/* ---------- orders tab ---------- */
const vendorOf = p => VENDORS.find(v => v.id === p.vendorId);
const vendorName = p => (vendorOf(p) || {}).name || p.vendorName || p.vendor || '—';
const subName = id => (SUBCATS.find(s => s.id === id) || {}).name || '';
const COLS = [{k:'poNumber',l:'PO #'},{k:'vendor',l:'Vendor'},{k:'cat',l:'Category'},{k:'items',l:'Items'},{k:'deliveryMonth',l:'Delivery'},{k:'cancelDate',l:'Cancel by'},{k:'cost',l:'Cost',r:1},{k:'open',l:'Still to come',r:1},{k:'status',l:'Status'},{k:'createdBy',l:'Entered by'}];
function sortVal(p, k){ if (k === 'open') return onOrder(p); if (k === 'cost') return poTotal(p); if (k === 'items') return poUnits(p); if (k === 'vendor') return vendorName(p).toLowerCase(); if (k === 'cat') return CAT(p.cat).name; return String(p[k] || ''); }
function rowFlag(p){ if (p.status !== 'open' && p.status !== 'partial') return '';
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
function renderOrders(S){
  const sel = selMonth(), q = filt.q.trim().toLowerCase();
  let rows = POS.filter(p => {
    if (filt.status === 'active' && !(p.status === 'open' || p.status === 'partial')) return false;
    if (filt.status === 'received' && p.status !== 'received') return false;
    if (filt.status === 'cancelled' && p.status !== 'cancelled') return false;
    if (filt.cat !== 'all' && !(p.cat === filt.cat || (p.lines || []).some(l => l.cat === filt.cat))) return false;
    if (filt.arriving && sel !== 'season' && bucket(p) !== sel) return false;
    if (q && !`${p.poNumber} ${vendorName(p)} ${p.notes || ''} ${(p.lines || []).map(l => l.style + ' ' + l.color).join(' ')}`.toLowerCase().includes(q)) return false;
    return true;
  });
  rows.sort((a,b) => { const x = sortVal(a, sort.key), y = sortVal(b, sort.key); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  const segB = (v,l) => `<button type="button" data-ofilt="${v}" aria-pressed="${filt.status === v}">${l}</button>`;
  $('#pane').innerHTML = `<section class="panel">
    <div class="toolbar"><div class="filters"><div class="seg" role="group" aria-label="Status">${segB('active','Open')}${segB('all','All')}${segB('received','Received')}${segB('cancelled','Cancelled')}</div>
      ${sel !== 'season' ? `<label style="font-size:13px;display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="fArr" ${filt.arriving ? 'checked' : ''}> Only arriving in ${monthFull(sel)}</label>` : ''}</div>
      <div class="filters"><label for="fCat" class="sr">Category</label><select id="fCat" class="field-inline"><option value="all">All categories</option>${catList().map(c => `<option value="${c.code}" ${filt.cat === c.code ? 'selected' : ''}>${c.code} · ${esc(c.name)}</option>`).join('')}</select>
      <label for="fQ" class="sr">Search</label><input id="fQ" class="field-inline" type="search" placeholder="Search PO #, vendor, style" value="${esc(filt.q)}"></div></div>
    <div class="tbl"><table><thead><tr>${COLS.map(c => `<th class="${c.r ? 'r' : ''}" aria-sort="${sort.key === c.k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" data-sort="${c.k}">${c.l}${sort.key === c.k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead>
    <tbody class="click">${rows.map(p => `<tr class="${rowFlag(p)}" data-po="${esc(p.id)}" tabindex="0">
      <td class="po">${esc(p.poNumber)}</td><td>${esc(vendorName(p))}${RISK_VENDORS.test(vendorName(p)) ? '<span class="sm" style="color:var(--ochre)">cost risk</span>' : ''}</td>
      <td>${catSummary(p)}</td><td>${itemsSummary(p)}</td><td>${monthLabel(p.deliveryMonth)}</td><td class="num">${p.cancelDate ? dateLabel(p.cancelDate) : '—'}</td>
      <td class="r num">${money(poTotal(p))}</td><td class="r num">${onOrder(p) ? money(onOrder(p)) : '—'}</td>
      <td><span class="pill ${esc(p.status)}">${STATUS[p.status] || esc(p.status)}</span></td><td><span class="person" data-uid="${esc(p.createdBy || '')}"></span></td></tr>`).join('')}</tbody></table></div>
    ${!POS.length ? `<div class="empty"><h3>No purchase orders yet</h3><p>Click <b>+ New order</b> to write one, or use <b>More → Paste orders from a spreadsheet</b> to load your current open orders all at once.</p>${canAct() ? '<button class="btn primary" type="button" data-act="new">+ New order</button>' : ''}</div>` : !rows.length ? '<div class="empty"><p>No orders match these filters.</p></div>' : ''}
  </section>`;
  fillPeople();
}

/* ---------- needs attention tab ---------- */
function itemHtml(i, compact){
  const cat = i.cat ? CAT(i.cat).name : '';
  const st = i.state;
  const who = st ? `<span class="who">${st.status === 'done' ? 'Done' : 'Dismissed'} ${dateLabel((st.at || '').slice(0,10))} · <span class="person" data-uid="${esc(st.by || '')}"></span></span>` : '';
  const btns = compact ? '' : (i.kind === 'order' ? (i.po ? `<button class="btn sm" type="button" data-openpo="${esc(i.po)}">Open order</button>` : i.cat ? `<button class="btn sm" type="button" data-cat="${esc(i.cat)}">Open category</button>` : '')
      : (st ? (canAct() ? `<button class="btn sm" type="button" data-istate="${esc(i.id)}" data-v="">Undo</button>` : '')
      : `${(i.kind === 'reorder' || i.kind === 'stockout') && canAct() ? `<button class="btn primary sm" type="button" data-startorder="${esc(i.id)}">Start an order</button>` : ''}
         ${canAct() ? `<button class="btn sm" type="button" data-istate="${esc(i.id)}" data-v="done">Done</button><button class="btn ghost sm" type="button" data-istate="${esc(i.id)}" data-v="dismissed">Dismiss</button>` : ''}`));
  return `<li class="item ${i.sev} ${st ? 'resolved' : ''}"><div class="stripe"></div><div class="body">
    <div class="t"><span class="kind ${i.kind}">${KINDS[i.kind]}</span>${esc(i.title)}</div>
    ${i.sku ? `<div class="d"><span class="num">${esc(i.sku)}</span> · ${esc(i.desc)}${cat ? ' · ' + esc(cat) : ''}</div>` : ''}
    <div class="d">${esc(i.detail)}</div>
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
  $('#pane').innerHTML = `<section class="panel">
    <header><h2>To do</h2><span class="lab">Item suggestions from the ${dateLabel(INS.asOf)} SKU Analysis · refreshed each month-end</span></header>
    <div class="chips">${fc('all','All')}${Object.keys(KINDS).map(k => fc(k, KINDS[k])).join('')}
      <span style="flex:1"></span><select id="aCat" class="field-inline" aria-label="Category"><option value="all">All categories</option>${catList().map(c => `<option value="${c.code}" ${afilt.cat === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <label style="font-size:12.5px;display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="aRes" ${afilt.showResolved ? 'checked' : ''}> Show done</label></div>
    <div class="note" style="border-bottom:1px solid var(--rule)">${esc(KIND_NOTE[afilt.kind] || KIND_NOTE.all)}</div>
    <ul class="items">${list.length ? list.map(i => itemHtml(i, false)).join('') : '<li class="item good"><div class="stripe"></div><div class="body"><div class="t">Nothing here.</div><div class="d">Everything in this view has been dealt with.</div></div></li>'}</ul>
  </section>`;
  fillPeople();
}
const KIND_NOTE = {
  all:'Order problems come first, then item suggestions ranked by dollars at stake. Mark each one Done when you have acted on it, or Dismiss it if it doesn\'t apply. I see what you mark when I roll the plan.',
  order:'Problems with orders you have written: cancel dates, late deliveries, and categories going over budget. These update the moment an order changes.',
  reorder:'Fast sellers that will run out in under 6 weeks at the pace expected this fall. "Start an order" fills in a new order for you.',
  stockout:'Items that sold well in June to August but have none on hand. Reorder the ones you are keeping in the line.',
  overstock:'Items with more than a year of stock at the current pace. Don\'t reorder them; move them with a feature or a markdown.',
  aged:'Items that have not sold in over a year. "Restocked" means more arrived after it stopped selling — check whether that receipt was a mistake.',
  margin:'The latest cost is well above what you paid last year, but the selling price hasn\'t changed. Check the invoice, then re-price or renegotiate.',
  split:'One SKU is being used for several different products. You can\'t tell which design, color or size sells, so reorders are guesses and dead styles never show up as not selling.',
  data:'Records that can\'t be right, such as negative stock. Fix them before the next count so the numbers the plan uses are real.'
};

/* ---------- inventory & counts tab ---------- */
function renderInventory(S){
  const rows = catList().map(c => { const i = INV.cats[c.code] || {units:0,cost:0,aged:0,skus:0}; const wks = wksNow(c.code, i.cost);
    return {c, i, wks, tgt: c.target, gap: i.cost - (c.target || 0)}; });
  const T = rows.reduce((a,r) => ({units:a.units + r.i.units, cost:a.cost + r.i.cost, aged:a.aged + r.i.aged, skus:a.skus + r.i.skus}), {units:0,cost:0,aged:0,skus:0});
  const counts = [...COUNTS].sort((a,b) => String(b.date).localeCompare(String(a.date)));
  $('#pane').innerHTML = `<div class="stack">
  <section class="panel"><header><h2>Inventory on hand</h2><span class="lab">${esc(INV.source)} · as of ${dateLabel(INV.asOf)}</span></header>
    <div class="note" style="border-bottom:1px solid var(--rule)">This is the starting point for every budget. It updates each month-end when the new SKU Analysis comes in. <b>Weeks of supply</b> is how long the stock lasts at the sales pace forecast for this fall and winter. <b>Target by Apr 30</b> is the stock level the plan is steering towards.</div>
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
  <section class="panel"><div class="in"><h3>The pages</h3><dl class="gl">
    <dt>Overview</dt><dd>Budget left by category for the year and month you pick, and the top things to do.</dd>
    <dt>Forecast</dt><dd>Sales by month for this year and next. Growth and target weeks can be changed; every budget follows.</dd>
    <dt>Open-to-buy</dt><dd>The budget as a category × month grid for this year, next year or calendar ${P.fyNum || 2027}, plus the month-by-month worksheet.</dd>
    <dt>Orders</dt><dd>Every purchase order. Each one counts against the fiscal year it arrives in.</dd>
    <dt>Brands</dt><dd>A scorecard for every brand, by men's, ladies', hats, accessories and equipment, with a call: Grow, Keep, Watch, Reduce or Drop.</dd>
    <dt>To do</dt><dd>Order problems and item-level suggestions: reorders, stock-outs, aged stock, combined SKUs, data errors.</dd>
    <dt>Month-end</dt><dd>The checklist, the refresh history, and how each month came in against the forecast.</dd></dl>
    <h3 style="margin-top:14px">What the open-to-buy is</h3>
    <p>A spending limit for merchandise, set by category and month, at cost. It tells you how much you can bring in without ending the year with more stock than you need.</p>
    <div class="formula"><div class="ln"><span class="op"></span><span>Stock you want at the end of the year</span><span>target</span></div>
      <div class="ln"><span class="op">+</span><span>What you're expected to sell, at cost</span><span>forecast</span></div>
      <div class="ln"><span class="op">−</span><span>What's on the shelf at the start</span><span>on hand</span></div>
      <div class="ln tot"><span class="op">=</span><span>What you can still bring in</span><span>budget</span></div></div>
    <p><b>It's based on sales.</b> This year's open months are last year's sales for the month plus a growth rate, and next year is this year plus a growth rate for each category. All of it is on the Forecast page, converted to cost at each category's real margin.</p>
    <h3 style="margin-top:14px">Worked example: General Accessories, ${P.fy}</h3>
    <div class="formula"><div class="ln"><span class="op"></span><span>Target stock at the end of ${monthLabel(P.window.to)}</span><span>${money(ga.target || 0)}</span></div><div class="sub">${ga.wos || 14} weeks of the cost of sales forecast for the four months after</div>
      <div class="ln"><span class="op">+</span><span>Forecast cost of sales</span><span>${money(ga.cogs || 0)}</span></div><div class="sub">${money(ga.sales || 0)} of sales at retail, at ${Math.round((ga.gm || 0) * 100)}% margin</div>
      <div class="ln"><span class="op">−</span><span>On hand ${dateLabel(P.asOf)}</span><span>${money(ga.onHand || 0)}</span></div>
      <div class="ln tot"><span class="op">=</span><span>${P.fy} budget</span><span>${money(ga.plan || 0)}</span></div></div>
  </div></section>
  <section class="panel"><div class="in"><h3>Buying for next year</h3>
    <p>Pick <b>${PLANS.next ? PLANS.next.fy : 'next year'}</b> at the top of the Overview, or enter any order with a delivery month from May on. It's checked against next year's budget automatically.</p>
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
    <li><span class="when">Deliveries</span><span>Open the order and click <b>Record receipt</b> when the goods come in.</span></li>
    <li><span class="when">Mondays</span><span>Go through <b>To do</b>. Mark each item Done or Dismiss.</span></li>
    <li><span class="when">Month-end</span><span>Work through the <b>Month-end</b> checklist: run the five reports and upload them to the chat with Claude. The forecast, budgets, on-hand, suggestions and brand scorecard are then refreshed.</span></li>
    <li><span class="when">Each season</span><span>Review the <b>Brands</b> page before market or a buying appointment. Set your own call where you disagree.</span></li>
    <li><span class="when">Quarterly</span><span>After the count, go to <b>Inventory &amp; counts</b> and record book and counted values by category.</span></li></ul></div></section>
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
