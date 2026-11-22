
/* ---------- deliveries worked out from the SKU Analysis ----------
   The shop receives into the POS without purchase orders, so nobody logs deliveries here. Each month-end
   upload works out what arrived since the last one, by category and brand (merchandise/pipeline/receipts.py),
   and this matches it to open orders, oldest expected delivery first, for the owner to confirm. */
/* Where an order stands for receiving (18-ops.js rcvState): received, arrived (not yet in the POS), late, due or later. */
function rcvLive(p){ return liveInvoices(p.invoicesIn, p.invoicesClearedAt); }
function rcvOf(p){ const L = rcvLive(p); return rcvState({status:p.status, deliveryMonth:p.deliveryMonth, invoicesIn:L.entries, invoicesClearedAt:L.cleared ? p.invoicesClearedAt : null, receivedValue:num(p.received), openValue:poTotal(p)}, THIS_MONTH); }
const RCV_TOL = p => Math.max(25, poTotal(p) * 0.03);  // a balance this small left after a delivery counts as delivered
function owedIn(p, cat, taken){
  const ext = poParts(p).filter(x => x.cat === cat).reduce((a, x) => a + x.ext, 0);
  return Math.max(ext - num(receivedByCat(p)[cat]) - num(taken), 0);
}
function matchArrivals(A){
  const toM = A.to.slice(0, 7), horizon = addMonths(toM, 2), taken = {}, byPo = {}, loose = [];
  for (const g of A.groups || []){
    let left = num(g.value);
    const cands = !g.brand ? [] : POS.filter(p => isOpen(p) && String(p.orderDate || '') <= A.to
        && String(p.deliveryMonth || toM) <= horizon && brandNameFor(vendorName(p)) === g.brand && poParts(p).some(x => x.cat === g.cat))
      .sort((a, b) => String(a.deliveryMonth).localeCompare(String(b.deliveryMonth)) || String(a.orderDate).localeCompare(String(b.orderDate)));
    for (const p of cands){
      const k = p.id + '|' + g.cat, owe = owedIn(p, g.cat, taken[k]);
      if (owe < 0.5) continue;
      const amt = r2(Math.min(left, owe));
      taken[k] = num(taken[k]) + amt; left = r2(left - amt);
      const m = byPo[p.id] = byPo[p.id] || {po: p.id, byCat: {}};
      m.byCat[g.cat] = r2(num(m.byCat[g.cat]) + amt);
      if (left < 1) break;
    }
    if (left >= 25) loose.push({cat: g.cat, brand: g.brand, value: left, top: g.top || []});
  }
  const matches = Object.values(byPo).map(m => ({...m, found: r2(Object.values(m.byCat).reduce((a, v) => a + v, 0))}));
  for (const m of matches){ m.amount = m.found; m.on = true; }
  return {A, matches, loose};
}
/* The order after this delivery: what's been received, and whether anything worth waiting for is left. */
function afterDelivery(p, amount){
  const received = r2(num(p.received) + num(amount)), left = r2(poTotal(p) - received);
  return {received, left, status: left <= RCV_TOL(p) ? 'received' : 'partial'};
}
function rcvHTML(R){
  if (!R) return '';
  const A = R.A, on = R.matches.filter(m => m.on), total = on.reduce((a, m) => a + num(m.amount), 0);
  const rows = R.matches.map((m, i) => {
    const p = POS.find(x => x.id === m.po); if (!p) return '';
    const after = afterDelivery(p, m.on ? m.amount : 0);
    return `<tr><td><input type="checkbox" data-rcvon="${i}" ${m.on ? 'checked' : ''} aria-label="Record this delivery on PO ${esc(p.poNumber)}"></td>
      <td><b>PO ${esc(p.poNumber)}</b> · ${esc(vendorName(p))}<br><span style="color:var(--muted);font-size:12px">${Object.keys(m.byCat).map(c => esc(CAT(c).name)).join(', ')} · due ${monthLabel(p.deliveryMonth)} · ${money(poTotal(p) - num(p.received))} still owed</span></td>
      <td class="r"><input type="number" min="0" step="0.01" data-rcvamt="${i}" value="${num(m.amount).toFixed(2)}" style="width:96px;text-align:right" ${m.on ? '' : 'disabled'}></td>
      <td>${m.on ? `<span class="pill ${after.status}">${STATUS[after.status]}</span>${after.status === 'partial' ? `<br><span style="color:var(--muted);font-size:12px">${money(after.left)} still to come</span>` : ''}` : '<span style="color:var(--faint)">not recorded</span>'}</td></tr>`;
  }).join('');
  const loose = R.loose.slice(0, 8).map(g => `<li>${esc(g.brand || 'Unknown brand')} · ${esc(CAT(g.cat).name)}: ${money(g.value)}${g.top[0] ? ` <span style="color:var(--muted)">(e.g. ${esc(g.top[0].desc)})</span>` : ''}</li>`).join('');
  return `<div class="note" style="font-size:13.5px;color:var(--ink);padding-top:12px"><b>Deliveries ${dateLabel(A.from)} – ${dateLabel(A.to)}</b>: ${money(A.total)} arrived at cost, worked out from the SKU Analysis.
    ${R.matches.length ? `${money(R.matches.reduce((a, m) => a + m.found, 0))} of it matches ${R.matches.length} open order${R.matches.length === 1 ? '' : 's'}. Untick anything that isn't right, or change an amount.` : 'None of it matches an open order in the book.'}</div>
    ${R.matches.length ? `<div style="overflow-x:auto"><table class="mini" style="margin:6px 16px 4px;width:calc(100% - 32px)"><thead><tr><th></th><th>Order</th><th class="r">Arrived</th><th>After</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="note">${on.length} order${on.length === 1 ? '' : 's'} will be updated, ${money(total)} in all. Anything still to come stays on order in its expected month.</div>` : ''}
    ${loose ? `<div class="note"><b>Arrived with no open order in the book</b> (reorders, or orders that weren't entered):<ul style="margin:4px 0 0;padding-left:18px">${loose}</ul>${R.loose.length > 8 ? `<div>…and ${R.loose.length - 8} more.</div>` : ''}</div>` : ''}
    ${A.down && A.down.value >= 25 ? `<div class="note">Stock on ${A.down.skus} SKU${A.down.skus === 1 ? '' : 's'} fell by more than it sold (${money(A.down.value)} at cost): counts, shrink or returns to vendors.</div>` : ''}`;
}
/* ---------- the receiving log on the page ----------
   RLOG is receivinglog/current, the app's read-only copy of the accounting team's sheet (the server keeps it:
   lib/merch/receiving-log-server.ts); LOGMATCH holds people's calls on its rows (logmatch/{row key}). The page
   suggests an order for each row and a person confirms: Confirm adds a 'log' invoice entry to the order, just as
   Invoice in does, so nothing about the budget changes. */
let RLOG = null, LOGMATCH = {};
const logLive = () => !!(RLOG && !RLOG.error && RLOG.readAt);
/* The vendor words the server read the log with, plus every vendor's own name. */
function logWords(){
  const w = {...((RLOG && RLOG.words) || {})};
  for (const v of VENDORS){ const n = String(v.name || '').toLowerCase().trim(); if (n && !vendorKeyFor(n, w)) w[n] = [n]; }
  return w;
}
function receivingQueue(){
  const words = logWords();
  const rows = ((RLOG && RLOG.rows) || []).map(r => ({...r, brand: vendorKeyFor(r.desc, words)}));
  return logQueue(rows, POS, LOGMATCH, p => vendorKeyFor(vendorName(p), words), p => Math.max(onOrder(p) - storeRoomOf(p), 0));
}
const logRow = key => ((RLOG && RLOG.rows) || []).find(r => r.key === key);
async function putOrder(p, invoicesIn){
  const body = {...p, invoicesIn, updatedBy: myId, updatedAt: new Date().toISOString()};
  delete body.id; delete body.vendor;
  return write('pos/' + p.id, body);
}
/** Confirm a log row against an order: the order gets the row's invoice entry, and the call is kept. */
async function confirmLogRow(key, poId){
  const row = logRow(key), p = POS.find(x => x.id === poId); if (!row || !p || !canAct()) return false;
  if (!(await putOrder(p, withLogEntry(p.invoicesIn, logEntry(row, p, myId))))) return false;
  const ok = await write('logmatch/' + key, {state: 'matched', po: poId, amount: row.amount, date: row.date, invoice: row.invoice, by: myId, at: new Date().toISOString()});
  if (ok) toast(`PO ${p.poNumber || poId}: ${money(row.amount)} arrived (invoice ${row.invoice || 'without a number'})`);
  return ok;
}
async function markNotOrder(key){
  if (!logRow(key) || !canAct()) return false;
  return write('logmatch/' + key, {state: 'notorder', by: myId, at: new Date().toISOString()});
}
/** Take back a call on a row: a match comes off its order; the row goes back to the list. */
async function undoLogRow(key){
  const d = LOGMATCH[key]; if (!d || !canAct()) return false;
  if (d.state === 'matched'){
    const p = POS.find(x => x.id === d.po);
    if (p && !(await putOrder(p, withoutLogEntry(p.invoicesIn, key)))) return false;
  }
  return write('logmatch/' + key, null);
}
/* Opening Orders & receiving asks the server to read the log again (it reads at most every two minutes); the copy
   arrives with the next poll. */
let logPokedAt = 0;
function pokeReceivingLog(){
  if (!canAct() || typeof window === 'undefined' || !window.MERCH_HOST || Date.now() - logPokedAt < 120000) return;
  logPokedAt = Date.now();
  fetch(window.MERCH_HOST.base + '/api/receiving-log', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: '{}'}).catch(() => {});
}
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-logok],[data-lognot],[data-logundo]');
  if (!b) return;
  b.disabled = true;
  if (b.dataset.logok){ const [key, po] = b.dataset.logok.split('|'); await confirmLogRow(key, po); }
  else if (b.dataset.lognot) await markNotOrder(b.dataset.lognot);
  else await undoLogRow(b.dataset.logundo);
  b.disabled = false;
});

/* Record the ticked deliveries on their orders. */
async function applyArrivals(R){
  let ok = true;
  const now = new Date().toISOString();
  for (const m of R.matches){
    if (!m.on || !(num(m.amount) > 0)) continue;
    const p = POS.find(x => x.id === m.po); if (!p) continue;
    const scale = m.found > 0 ? num(m.amount) / m.found : 1, byCat = Object.fromEntries(Object.entries(m.byCat).map(([c, v]) => [c, r2(v * scale)]));
    const receipts = [...poReceipts(p), {date: R.A.to, amount: r2(num(m.amount)), byCat, source: 'pos', from: R.A.from, by: myId, at: now}];
    const after = afterDelivery(p, m.amount);
    const body = {...p, receipts, received: after.received, receivedDate: receipts.map(r => r.date).sort().pop(), status: after.status, updatedBy: myId, updatedAt: now};
    delete body.id; delete body.vendor;
    ok = (await write('pos/' + p.id, body)) && ok;
  }
  return ok;
}

/* ---------- Receiving page: what has arrived in the store room but isn't in the POS yet ----------
   Staff mark an order "Invoice in" (invoicesIn on the pos doc). It changes nothing about received or the budget:
   goods stay committed until month-end matching records them. Clear only takes an order off this list. */
function rcvRows(){
  const rows = [];
  for (const p of POS){
    if (!isOpen(p)) continue;
    const st = rcvOf(p); if (st === 'received' || st === 'later') continue;
    const inv = rcvLive(p).entries;
    rows.push({p, st, inv, arrived: storeRoomValue(inv, poTotal(p), num(p.received)), days: daysWaiting(inv, todayISO)});
  }
  return rows;
}
// Once the receiving log is read, arrivals come from it: staff no longer mark them by hand; the owner keeps the
// button as an override for a shipment the log hasn't caught up with.
const rcvBtns = p => !canAct() ? '' : !logLive() ? `<button class="btn sm" type="button" data-invin="${esc(p.id)}">Invoice in</button>`
  : isAdmin ? `<button class="btn ghost sm" type="button" data-invin="${esc(p.id)}" title="Mark it arrived by hand: for a shipment the receiving log doesn't show yet">Override</button>` : '';
function rcvTable(rows, kind){
  const head = kind === 'arrived' ? '<th>Order</th><th class="r">Days waiting</th><th class="r">Arrived</th><th>Trail</th><th></th>' : '<th>Order</th><th>Expected</th><th class="r">Still to come</th><th></th>';
  return `<div class="tbl"><table class="mini rt" style="min-width:0"><thead><tr>${head}</tr></thead><tbody class="click">${rows.map(({p, inv, arrived, days}) => {
    const first = `<td class="wrapv"><b>PO ${esc(p.poNumber)}</b> · ${esc(vendorName(p))}</td>`;
    if (kind === 'arrived'){
      return `<tr data-po="${esc(p.id)}" tabindex="0">${first}<td data-l="Days waiting" class="r num">${days}</td><td data-l="Arrived" class="r num">${money(arrived)}</td><td data-l="Trail" style="font-size:12.5px">${rcvTrail(p, inv)}</td>
        <td class="r">${canAct() ? `<button class="btn ghost sm" type="button" data-invclear="${esc(p.id)}" title="Take it off this list. It doesn't change what the POS or the budget say.">Clear</button>` : ''}</td></tr>`;
    }
    return `<tr data-po="${esc(p.id)}" tabindex="0">${first}<td data-l="Expected">${monthLabel(p.deliveryMonth)}</td><td data-l="Still to come" class="r num">${money(onOrder(p))}</td><td class="r">${rcvBtns(p)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function rcvChart(rows){
  const g = new Map();
  for (const r of rows){
    if (r.st !== 'arrived' && r.st !== 'late') continue;
    const k = vkey(r.p); if (!g.has(k)) g.set(k, {key: k, name: vendorName(r.p), store: 0, late: 0});
    const z = g.get(k); if (r.st === 'arrived') z.store += r.arrived; else z.late += onOrder(r.p);
  }
  const vs = [...g.values()].sort((a, b) => (b.store + b.late) - (a.store + a.late)).slice(0, 10);
  if (!vs.length) return '';
  const labels = vs.map(v => v.name);
  const series = [{name: 'In the store room', k: 1, values: vs.map(v => v.store)}, {name: 'Late, not arrived', k: 2, values: vs.map(v => v.late)}];
  return `<section class="ccard"><h3>Backlog by vendor</h3><div class="cs">At cost: what is in the store room but not in the POS, and what is late and hasn't arrived. Click a vendor to see its orders.</div>
    ${chLegend(series)}${chStack({labels, series, fmt: moneyK, label: 'Receiving backlog at cost, by vendor', go: i => 'orders:' + vs[i].key})}
    ${anaNumbers(['Vendor', 'In the store room', 'Late', 'Total'], vs.map(v => [v.name, money(v.store), money(v.late), money(v.store + v.late)]))}</section>`;
}
/* The receiving log's part of the page: where the copy stands, rows to match, rows not from an order, and matches
   whose row has changed in the log. */
const ago = iso => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : dateLabel(iso.slice(0, 10)); };
function logStatusHtml(){
  if (!RLOG) return `<div class="warnbox info"><b>The receiving log isn't connected yet.</b> Once it is, every row the accounting team adds shows up here to match against an order. Setup: docs/merch-receiving-log-setup.md (the owner, once).</div>`;
  const probs = (RLOG.problems || []).length;
  return `<div class="note">${RLOG.error ? `<span class="neg"><b>${esc(RLOG.error)}</b></span>` : `Receiving log read ${esc(ago(RLOG.readAt || RLOG.at))}, rows from ${esc(dateLabel(RLOG.since))} on.`}
    ${probs ? ` <details style="display:inline"><summary>${probs} row${probs === 1 ? '' : 's'} couldn't be read</summary><ul>${RLOG.problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul></details>` : ''}</div>`;
}
const logRowCells = r => `<td data-l="Date">${dateLabel(r.date)}</td><td class="wrapv">${esc(r.desc)}${r.special ? ' <span class="pill">special order</span>' : ''}</td><td data-l="Invoice">${esc(r.invoice || '—')}</td><td data-l="Amount" class="r num ${r.amount < 0 ? 'neg' : ''}">${money(r.amount)}</td>`;
const poLabel = p => `PO ${esc(p.poNumber || p.id)} · ${esc(vendorName(p))} · due ${monthLabel(p.deliveryMonth)} · ${money(Math.max(onOrder(p) - storeRoomOf(p), 0))} open`;
function logMatchHtml(q){
  if (!RLOG) return '';
  const act = canAct(), who = id => id ? `<span class="person" data-uid="${esc(id)}"></span>` : '';
  const toMatch = q.toMatch.length ? `<div class="tbl"><table class="mini rt" style="min-width:0"><thead><tr><th>Date</th><th>From the log</th><th>Invoice</th><th class="r">Amount</th><th>Order</th></tr></thead><tbody>${q.toMatch.map(({row, cands}) =>
    `<tr>${logRowCells(row)}<td data-l="Order">${poLabel(cands[0])}${act ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn primary sm" type="button" data-logok="${esc(row.key)}|${esc(cands[0].id)}">Confirm</button>${cands.slice(1).map(p => `<button class="btn sm" type="button" data-logok="${esc(row.key)}|${esc(p.id)}" title="${poLabel(p)}">Pick PO ${esc(p.poNumber || p.id)}</button>`).join('')}<button class="btn ghost sm" type="button" data-lognot="${esc(row.key)}">Not an order</button></div>` : ''}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="note">Nothing to match: every row in the log is matched or isn\'t from an order.</div>';
  const changed = q.changed.length ? `<section class="panel"><header><h2>Changed in the log</h2><span class="lab">${q.changed.length}</span></header><div class="note">These rows were matched, then changed or removed in the receiving log. Check the order and undo the match if it no longer applies.</div>
    <ul class="items">${q.changed.map(c => { const p = POS.find(x => x.id === c.po); return `<li class="item warn"><div class="stripe"></div><div class="body"><div class="t">${p ? poLabel(p) : esc(c.po)}</div></div>${act ? `<button class="btn sm" type="button" data-logundo="${esc(c.key)}">Undo the match</button>` : ''}</li>`; }).join('')}</ul></section>` : '';
  const not = q.notOrder.length ? `<details class="panel" style="padding:12px 16px"><summary><b>Not from an order</b> · ${q.notOrder.length} row${q.notOrder.length === 1 ? '' : 's'}: reorders, special orders and anything else not in the order book. Nothing to do.</summary>
    <div class="tbl"><table class="mini rt" style="min-width:0"><tbody>${q.notOrder.map(({row, why}) => { const d = LOGMATCH[row.key];
      return `<tr>${logRowCells(row)}<td>${why === 'marked' ? `marked by ${who(d && d.by)}${act ? ` <button class="btn ghost sm" type="button" data-logundo="${esc(row.key)}">Undo</button>` : ''}` : '<span class="faint">no open order matches</span>'}</td></tr>`; }).join('')}</tbody></table></div></details>` : '';
  const matched = q.matched.length ? `<details class="panel" style="padding:12px 16px"><summary><b>Matched</b> · ${q.matched.length} row${q.matched.length === 1 ? '' : 's'}</summary>
    <div class="tbl"><table class="mini rt" style="min-width:0"><tbody>${q.matched.map(({row, po}) => { const p = POS.find(x => x.id === po), d = LOGMATCH[row.key];
      return `<tr>${logRowCells(row)}<td>${p ? `PO ${esc(p.poNumber || p.id)} · ${esc(vendorName(p))}` : esc(po)} · ${who(d && d.by)}${act ? ` <button class="btn ghost sm" type="button" data-logundo="${esc(row.key)}">Undo</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div></details>` : '';
  return `<section class="panel"><header><h2>Match from the receiving log</h2><span class="lab">${q.toMatch.length} to match</span></header>
    <div class="note" style="padding-bottom:4px">Each row is what the accounting team logged. The app suggests the order it most likely belongs to: same vendor, due within a month, enough still open. Confirm marks the order arrived (it stays committed in the budget until Jonas records it).</div>${toMatch}</section>${changed}${not}${matched}`;
}
/* An order's trail: placed, arrived (from the log or by hand), in Jonas. */
function rcvTrail(p, inv){
  const first = (inv || []).map(e => e.date).sort()[0], refs = (inv || []).map(e => e.invoice).filter(Boolean);
  return `<span class="faint">Placed ${p.orderDate ? dateLabel(p.orderDate) : '—'} → </span>Arrived ${first ? dateLabel(first) : '—'}${refs.length ? ` (inv ${refs.map(esc).join(', ')})` : ''}<span class="faint"> → In Jonas at the next upload</span>`;
}
function renderReceiving(S){
  pokeReceivingLog();
  const q = receivingQueue();
  const rows = rcvRows(), by = st => rows.filter(r => r.st === st);
  const arr = by('arrived').sort((a, b) => b.days - a.days || String(a.p.poNumber).localeCompare(String(b.p.poNumber)));
  const late = by('late').sort((a, b) => String(a.p.deliveryMonth).localeCompare(String(b.p.deliveryMonth)) || onOrder(b.p) - onOrder(a.p));
  const due = by('due').sort((a, b) => onOrder(b.p) - onOrder(a.p));
  const tot = arr.reduce((a, r) => a + r.arrived, 0), oldest = arr.reduce((m, r) => Math.max(m, r.days), 0), lateCost = late.reduce((a, r) => a + onOrder(r.p), 0);
  const sec = (title, sub, list, kind, empty) => `<section class="panel"><header><h2>${title}</h2><span class="lab">${list.length} order${list.length === 1 ? '' : 's'}</span></header>
    <div class="note" style="padding-bottom:4px">${sub}</div>${list.length ? rcvTable(list, kind) : `<div class="note">${empty}</div>`}</section>`;
  $('#pane').innerHTML = `<div class="astack">
    <section class="tiles" aria-label="Receiving at a glance">
      ${todayTile('In the store room', moneyK(tot), 'at cost, not in the POS yet')}
      ${todayTile('Orders waiting', String(arr.length), arr.length ? 'arrived, waiting to be received in the POS' : 'nothing waiting')}
      ${todayTile('Oldest wait', arr.length ? oldest + (oldest === 1 ? ' day' : ' days') : '—', arr.length ? 'since the first invoice came in' : '')}
      ${todayTile('Late orders', String(late.length), late.length ? `${moneyK(lateCost)} past the delivery month` : 'none past their delivery month')}
    </section>
    ${logStatusHtml()}
    ${logMatchHtml(q)}
    ${rcvChart(rows)}
    ${sec('In the store room, not in the POS', 'Oldest first. Arrived is what the invoices add up to. Clear takes an order off this list once it is in the POS; it changes no figures. Open an order to change what was received.', arr, 'arrived', 'Nothing is waiting. Use Invoice in on an order (or on the Late and Due lists below) when its goods arrive.')}
    ${sec('Late', 'Open orders past their delivery month with nothing arrived.', late, 'open', 'No late orders.')}
    ${sec('Due this month', `Open orders due in ${monthFull(THIS_MONTH)} with nothing arrived.`, due, 'open', 'Nothing else is due this month.')}
    <div class="note">${logLive() ? 'Arrivals come from the receiving log: match each row above.' : 'Until the receiving log is connected, mark orders by hand with Invoice in.'} Arrived goods stay committed in the budget until month-end records them as received.</div></div>`;
}
/* The Invoice in dialog: date (today), optional amount, optional invoice #, note. Blank amount = the whole open balance. */
function openInvoiceIn(poId){
  const p = POS.find(x => x.id === poId); if (!p || !canAct()) return;
  $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="iiTitle" style="width:min(460px,calc(100% - 32px))">
    <header><div><div class="lab">Invoice in</div><h2 id="iiTitle" style="margin:0;font-size:19px">PO ${esc(p.poNumber)} · ${esc(vendorName(p))}</h2></div><button class="x" type="button" data-close="1" aria-label="Close">×</button></header>
    <div class="body"><p style="margin:0 0 12px;color:var(--muted);font-size:13px">The goods are in the store room. Leave the amount blank if the whole order came (${money(onOrder(p))} still to come); type the invoice total for a partial shipment. This doesn't change the budget.</p>
      <div class="row3"><div class="f"><label for="iiDate">Date</label><input id="iiDate" type="date" value="${todayISO}"></div>
      <div class="f"><label for="iiAmt">Invoice amount ($, optional)</label><input id="iiAmt" inputmode="decimal" autocomplete="off" placeholder="whole order"></div>
      <div class="f"><label for="iiInv">Invoice # (optional)</label><input id="iiInv" autocomplete="off"></div></div>
      <div class="f"><label for="iiNote">Note (optional)</label><input id="iiNote" autocomplete="off"></div></div>
    <footer><button class="btn" type="button" data-close="1">Cancel</button><button class="btn primary" type="button" data-invsave="${esc(p.id)}">Mark arrived</button></footer></div>`;
  $('#iiAmt').focus();
}
async function saveInvoiceIn(poId, btn){
  const p = POS.find(x => x.id === poId); if (!p) return;
  const r = makeInvoiceEntry({date: $('#iiDate').value, amount: $('#iiAmt').value, invoice: $('#iiInv').value, note: $('#iiNote').value}, myId, num(p.received));
  if (r.error){ toast(r.error); return; }
  if (btn) btn.disabled = true;
  const body = {...p, invoicesIn: [...(p.invoicesIn || []), r.entry], updatedBy: myId, updatedAt: new Date().toISOString()};
  delete body.id; delete body.vendor;
  if (await write('pos/' + p.id, body)){ closeOverlay(); toast(`PO ${p.poNumber} marked arrived`); }
  else if (btn) btn.disabled = false;
}
async function clearArrived(poId){
  const p = POS.find(x => x.id === poId); if (!p || !canAct()) return;
  const body = {...p, invoicesClearedAt: new Date().toISOString(), updatedBy: myId, updatedAt: new Date().toISOString()};
  delete body.id; delete body.vendor;
  if (await write('pos/' + p.id, body)) toast(`PO ${p.poNumber} taken off the store-room list`);
}
