
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
  // words the owner saved since the server last read the log take effect at once
  const g = (typeof GUIDE !== 'undefined' && GUIDE && GUIDE.vendorWords) || {};
  for (const k of Object.keys(g)) if (Array.isArray(g[k])) w[k] = [...new Set([...(w[k] || []), ...g[k].map(x => String(x).toLowerCase())])];
  for (const v of VENDORS){ const n = String(v.name || '').toLowerCase().trim(); if (n && !vendorKeyFor(n, w)) w[n] = [n]; }
  return w;
}
/* Worked out once per change, not once per caller: the sidebar, Home, the verdict and the page all ask on each redraw.
   A new copy of the log, of the calls, of the orders or vendors (each snapshot is a new array), or a log action, makes
   it fresh. */
let LOGQ = null, LOGQ_GEN = 0;
function receivingQueue(){
  const key = [RLOG, LOGMATCH, POS, VENDORS, LOGQ_GEN, typeof GUIDE !== 'undefined' ? GUIDE : null];
  if (LOGQ && LOGQ.key.every((x, i) => x === key[i])) return LOGQ.q;
  const words = logWords();
  const rows = ((RLOG && RLOG.rows) || []).map(r => ({...r, brand: (r.vendor && vendorKeyFor(r.vendor, words)) || vendorKeyFor(r.desc, words)}));
  const q = logQueue(rows, POS, LOGMATCH, p => vendorKeyFor(vendorName(p), words), p => Math.max(onOrder(p) - storeRoomOf(p), 0));
  LOGQ = {key, q};
  return q;
}
/** Whether this person may mark an order arrived by hand: before the receiving log is read, or as the owner's override. */
const invoiceInAllowed = () => canAct() && (!logLive() || isAdmin);
const logRow = key => ((RLOG && RLOG.rows) || []).find(r => r.key === key);
async function putOrder(p, invoicesIn){
  const body = {...p, invoicesIn, updatedBy: myId, updatedAt: new Date().toISOString()};
  delete body.id; delete body.vendor;
  return write('pos/' + p.id, body);
}
/* Log actions run one at a time on this page, so a quick run of Confirms on one order never races itself. */
let logChain = Promise.resolve();
const logAction = f => (logChain = logChain.then(f, f).then(r => { LOGQ_GEN++; return r; }));
/** Confirm a log row against an order: the order gets the row's invoice entry (replacing a hand entry for the same
    invoice number, and, if the person agrees, hand entries with no number), and the call is kept with what it replaced
    so Undo can put it back. */
function confirmLogRow(key, poId){
  return logAction(async () => {
    const row = logRow(key), p = POS.find(x => x.id === poId); if (!row || !p || !canAct()) return false;
    const blank = (p.invoicesIn || []).filter(e => e && e.source === 'hand' && !String(e.invoice || '').trim());
    const swap = blank.length && confirm(`PO ${p.poNumber || poId} was marked arrived by hand without an invoice number (${blank.map(e => dateLabel(e.date) + (e.amount != null ? ' ' + money2(e.amount) : '')).join(', ')}). Replace that with this row from the receiving log?`);
    const kept = swap ? (p.invoicesIn || []).filter(e => !blank.includes(e)) : (p.invoicesIn || []);
    const next = withLogEntry(kept, logEntry(row, p, myId)), replaced = (p.invoicesIn || []).filter(e => !next.includes(e) && e.logKey !== key);
    if (!(await putOrder(p, next))) return false;
    const ok = await write('logmatch/' + key, {state: 'matched', po: poId, amount: row.amount, date: row.date, invoice: row.invoice, by: myId, at: new Date().toISOString(), ...(replaced.length ? {replaced} : {})});
    if (ok) toast(`PO ${p.poNumber || poId}: ${money2(row.amount)} arrived (invoice ${row.invoice || 'without a number'})`);
    return ok;
  });
}
/** Rows sure enough to confirm together: named in the log (PO # or a credit's invoice), or with only one possible
    order. A row two orders could take is left for a person to pick. */
const sureMatches = q => q.toMatch.filter(x => x.fit === 'exact' || (x.fit === 'good' && x.cands.length === 1));
/** Confirm every sure match after one question. Each runs as a normal Confirm (Undo works the same). */
async function confirmAllSure(){
  const list = sureMatches(receivingQueue()).map(x => [x.row.key, x.cands[0].id]);
  if (!list.length || !canAct()) return 0;
  const total = list.reduce((a, [k]) => a + num((logRow(k) || {}).amount), 0);
  if (!confirm(`Confirm ${list.length} matches from the receiving log (${money2(total)} in all)? Each can be undone.`)) return 0;
  let n = 0;
  for (const [k, po] of list) if (await confirmLogRow(k, po)) n++;
  return n;
}
function markNotOrder(key){
  return logAction(async () => {
    if (!logRow(key) || !canAct()) return false;
    return write('logmatch/' + key, {state: 'notorder', by: myId, at: new Date().toISOString()});
  });
}
/** Take back a call on a row: its entry comes off the order (or orders) carrying it, any hand entry it replaced comes
    back, and the row returns to the list. */
function undoLogRow(key, onlyPo){
  return logAction(async () => {
    if (!canAct()) return false;
    const d = LOGMATCH[key];
    for (const p of POS.filter(x => (x.invoicesIn || []).some(e => e && e.logKey === key) && (!onlyPo || x.id === onlyPo))){
      const back = d && d.state === 'matched' && d.po === p.id ? (d.replaced || []) : [];
      if (!(await putOrder(p, withoutLogEntry(p.invoicesIn, key).concat(back)))) return false;
    }
    if (onlyPo && POS.some(x => (x.invoicesIn || []).some(e => e && e.logKey === key))) return true;   // still on another order
    return d ? write('logmatch/' + key, null) : true;
  });
}
/* Opening Orders & receiving asks the server to read the log again (it reads at most every two minutes); the copy
   arrives with the next poll. LOGPOKE is how the last request went, so a read that fails before it can save anything
   (the app unreachable, an error on the server) still shows on the page, with its code. The owner can read now. */
let logPokedAt = 0, LOGPOKE = null;
async function readLogNow(force){
  const base = ((typeof window !== 'undefined' && window.MERCH_HOST) || {}).base || '';
  try {
    const r = await fetch(base + '/api/receiving-log', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({force: !!force})});
    const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch (_) {}
    LOGPOKE = {at: Date.now(), status: r.status, rows: j && j.rows, skipped: j && j.skipped,
      error: r.ok && j && j.ok !== false ? null : (j && j.error) || `The app answered ${r.status} when asked to read the receiving log.`};
  } catch (_){
    LOGPOKE = {at: Date.now(), status: 0, error: "Couldn't reach the app to read the receiving log. Check the connection and try again."};
  }
  LOGQ_GEN++;
  if (typeof render === 'function') render();
  return LOGPOKE;
}
function pokeReceivingLog(){
  if (!canAct() || typeof window === 'undefined' || !window.MERCH_HOST || Date.now() - logPokedAt < 120000) return;
  logPokedAt = Date.now();
  readLogNow(false);
}
document.addEventListener('click', async e => {
  const all = e.target.closest && e.target.closest('[data-logall]');
  if (all){ all.disabled = true; const n = await confirmAllSure(); if (n) toast(`${n} match${n === 1 ? '' : 'es'} confirmed`); all.disabled = false; return; }
  const r = e.target.closest && e.target.closest('[data-logread]');
  if (r){ r.disabled = true; const x = await readLogNow(true); toast(x.error ? 'The receiving log could not be read: see the message on the page.' : x.skipped ? 'The receiving log was read moments ago.' : `Receiving log read: ${x.rows || 0} row${x.rows === 1 ? '' : 's'} from the go-live date on.`); return; }
  const b = e.target.closest && e.target.closest('[data-logok],[data-lognot],[data-logundo]');
  if (!b) return;
  b.disabled = true;
  if (b.dataset.logok){ const [key, po] = b.dataset.logok.split('|'); await confirmLogRow(key, po); }
  else if (b.dataset.lognot) await markNotOrder(b.dataset.lognot);
  else { const [key, po] = b.dataset.logundo.split('|'); await undoLogRow(key, po || null); }
  b.disabled = false;
});

/* ----- learning the log's words for a vendor ----- */
const NOT_BRAND = new Set(('shirts t-shirts tshirts shirt tees tee sweaters sweater hats hat caps cap visors gloves glove balls socks shoes pants shorts '
  + 'skirts skorts dresses jackets jacket outerwear vests vest bags bag backpack backpacks headwear accessories polos polo quarter zip pullover belts belt '
  + 'umbrellas umbrella towels towel mens men\'s womens women\'s ladies jr junior juniors kids youth boys girls stock reorder re-order special order orders '
  + 'demo misc golf apparel gear and the for with new').split(' '));
/** The word in a log description most likely to be the brand: the first that isn't a product, size, gender or stock
    word, a number, or inside brackets (a customer's name). Null if none. */
function guessVendorWord(desc){
  const words = String(desc || '').toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[^a-z0-9&'-]+/).flatMap(w => w.split('/'));
  return words.find(w => w.length >= 3 && !/^\d/.test(w) && !NOT_BRAND.has(w) && !NOT_BRAND.has(w.replace(/s$/, ''))) || null;
}
/** After the owner matches a row by hand to a vendor its description didn't name: offer to remember a word, saved to
    the guidelines (vendorWords) so later rows with it suggest that vendor's orders. */
async function offerVendorWord(row, p){
  if (!row || !p || !ownerHere()) return false;
  const words = logWords(), key = vendorKeyFor(vendorName(p), words) || vendorName(p).toLowerCase().trim();
  if (!key || key.includes('.') || row.brand === key) return false;
  const name = vendorName(p), w = prompt(`Remember a word for ${name}? Receiving log rows with it will suggest ${name} orders. Edit it, or clear it to skip.`, guessVendorWord(row.desc) || '');
  const word = String(w || '').trim().toLowerCase();
  if (!word || word.length > 40) return false;
  const have = ((GUIDE && GUIDE.vendorWords && GUIDE.vendorWords[key]) || []).map(String);
  if (have.includes(word)) return false;
  const ok = await saveGuides({['vendorWords.' + key]: [...have, word]}, [{what: `Receiving log word for ${name}`, to: word}]);
  if (ok) toast(`Log rows with "${word}" will now suggest ${name} orders.`);
  return ok;
}
/* ----- orders that should have arrived ----- */
/** Open orders past their delivery month with nothing arrived (rcvOf 'late'), most overdue first, then biggest. */
const overdueOrders = () => POS.filter(p => isOpen(p) && rcvOf(p) === 'late')
  .sort((a, b) => String(a.deliveryMonth).localeCompare(String(b.deliveryMonth)) || onOrder(b) - onOrder(a));
/** The log's rows not matched to any order (still to match, or filed as not from an order), its vendor's first. */
function invoicePickHtml(p, q){
  const words = logWords(), key = vendorKeyFor(vendorName(p), words);
  const rows = q.toMatch.map(x => x.row).concat(q.notOrder.map(x => x.row)).filter(r => !r.credit);
  const mine = rows.filter(r => key && r.brand === key), rest = rows.filter(r => !(key && r.brand === key));
  if (!rows.length) return '';
  const opt = r => `<option value="${esc(r.key)}">${dateLabel(r.date)} · ${esc(r.desc)} · ${r.invoice ? 'inv ' + esc(r.invoice) + ' · ' : ''}${money2(r.amount)}</option>`;
  return `<select class="pick" data-invpick="${esc(p.id)}" aria-label="Match an invoice to PO ${esc(p.poNumber || p.id)}"><option value="">Match an invoice…</option>${mine.map(opt).join('')}${mine.length && rest.length ? '<option disabled>── other vendors ──</option>' : ''}${rest.map(opt).join('')}</select>`;
}
function overdueHtml(q){
  const list = overdueOrders();
  if (!list.length) return '';
  const act = canAct(), words = logWords();
  const lastDay = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
  return `<section class="panel attn"><header><h2>Should have arrived</h2><span class="lab">${list.length} order${list.length === 1 ? '' : 's'}</span></header>
    <div class="note" style="padding-bottom:4px">Past their delivery month with nothing arrived. Match each to its invoice in the receiving log; with no invoice yet, chase the vendor or move the delivery month on the order.</div>
    <div class="tbl"><table class="mini rt" style="min-width:0"><thead><tr><th>Order</th><th>Expected</th><th class="r">Still to come</th><th>Invoice</th></tr></thead><tbody class="click">${list.map(p => {
      const days = Math.max(0, daysAfterMonth(String(p.deliveryMonth).slice(0, 7), todayISO)), key = vendorKeyFor(vendorName(p), words);
      const has = key && receivingQueue().toMatch.concat(receivingQueue().notOrder).some(x => x.row.brand === key && !x.row.credit);
      return `<tr data-po="${esc(p.id)}" tabindex="0"><td class="wrapv"><b>PO ${esc(p.poNumber)}</b> · ${esc(vendorName(p))}</td><td data-l="Expected">${monthLabel(p.deliveryMonth)} <span class="rstat overdue">${days} day${days === 1 ? '' : 's'} late</span></td><td data-l="Still to come" class="r num">${money2(onOrder(p))}</td>
        <td data-l="Invoice">${act && RLOG ? invoicePickHtml(p, q) : ''}${has ? '' : `<div class="faint" style="font-size:12px">No unmatched invoice from ${esc(vendorName(p))} in the log${RLOG && RLOG.since ? ` since ${dateLabel(RLOG.since)}` : ''}.</div>`}</td></tr>`; }).join('')}</tbody></table></div></section>`;
}
/** Choosing an invoice for an overdue order confirms that log row on it. */
async function onInvPick(e){
  const sel = e.target.closest && e.target.closest('[data-invpick]');
  if (!sel || !sel.value) return;
  sel.disabled = true;
  await confirmLogRow(sel.value, sel.dataset.invpick);
  sel.disabled = false;
}
document.addEventListener('change', onInvPick);
/** Choosing an order in a row's pick list confirms the match, and for the owner offers to remember the vendor's word. */
async function onLogPick(e){
  const sel = e.target.closest && e.target.closest('[data-logpick]');
  if (!sel || !sel.value) return;
  sel.disabled = true;
  const key = sel.dataset.logpick, row = receivingQueue().toMatch.concat(receivingQueue().notOrder).map(x => x.row).find(r => r.key === key);
  if (await confirmLogRow(key, sel.value)) await offerVendorWord(row, POS.find(p => p.id === sel.value));
  sel.disabled = false;
}
document.addEventListener('change', onLogPick);

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
const rcvBtns = p => !invoiceInAllowed() ? '' : !logLive() ? `<button class="btn sm" type="button" data-invin="${esc(p.id)}">Invoice in</button>`
  : `<button class="btn ghost sm" type="button" data-invin="${esc(p.id)}" title="Mark it arrived by hand: for a shipment the receiving log doesn't show yet">Override</button>`;
function rcvTable(rows, kind){
  const head = kind === 'arrived' ? '<th>Order</th><th class="r">Days waiting</th><th class="r">Arrived</th><th>Trail</th><th></th>' : '<th>Order</th><th>Expected</th><th class="r">Still to come</th><th></th>';
  return `<div class="tbl"><table class="mini rt" style="min-width:0"><thead><tr>${head}</tr></thead><tbody class="click">${rows.map(({p, inv, arrived, days}) => {
    const first = `<td class="wrapv"><b>PO ${esc(p.poNumber)}</b> · ${esc(vendorName(p))}</td>`;
    if (kind === 'arrived'){
      return `<tr data-po="${esc(p.id)}" tabindex="0">${first}<td data-l="Days waiting" class="r num">${days}</td><td data-l="Arrived" class="r num">${money2(arrived)}</td><td data-l="Trail" style="font-size:12.5px">${rcvTrail(p, inv)}</td>
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
  const btn = canAct() && isAdmin ? ` <button class="btn sm" type="button" data-logread="1">Read the log now</button>` : '';
  const failed = LOGPOKE && LOGPOKE.error ? `<div class="warnbox" role="alert"><b>Reading the receiving log failed${LOGPOKE.status && LOGPOKE.status !== 200 ? ` (code ${LOGPOKE.status})` : ''}:</b> ${esc(LOGPOKE.error)}${btn}</div>` : '';
  if (failed) return failed;
  if (!RLOG) return `<div class="warnbox info"><b>The receiving log isn't connected yet.</b> Once it is, every row the accounting team adds shows up here to match against an order. Setup: docs/merch-receiving-log-setup.md (the owner, once).${btn}</div>`;
  const probs = (RLOG.problems || []).length;
  return `<div class="note">${RLOG.error ? `<span class="neg"><b>${esc(RLOG.error)}</b></span>` : RLOG.since && RLOG.since > todayISO ? `The receiving log is connected (read ${esc(ago(RLOG.readAt || RLOG.at))}). Receiving starts ${esc(dateLabel(RLOG.since))}: rows dated from then on show here to match against orders.` : `Receiving log read ${esc(ago(RLOG.readAt || RLOG.at))}, rows from ${esc(dateLabel(RLOG.since))} on.`}${btn}
    ${probs ? ` <details style="display:inline"><summary>${probs} row${probs === 1 ? '' : 's'} couldn't be read</summary><ul>${RLOG.problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul></details>` : ''}</div>`;
}
const logRowCells = r => `<td data-l="Date">${dateLabel(r.date)}</td><td class="wrapv">${esc(r.desc)}${r.special ? ' <span class="pill">special order</span>' : ''}</td><td data-l="Invoice">${esc(r.invoice || '—')}</td><td data-l="Amount" class="r num ${r.amount < 0 ? 'neg' : ''}">${money2(r.amount)}</td>`;
const poLabel = p => `PO ${esc(p.poNumber || p.id)} · ${esc(vendorName(p))} · due ${monthLabel(p.deliveryMonth)} · ${money2(Math.max(onOrder(p) - storeRoomOf(p), 0))} open`;
/* A list to match a row to an order by hand: the orders given first, then every other open order (a vendor the log
   names differently, a reorder entered late). Choosing one confirms the match; Undo takes it back. */
function logPickHtml(key, first, label){
  const seen = new Set(first.map(p => p.id));
  const rest = POS.filter(p => !seen.has(p.id) && (p.status === 'open' || p.status === 'partial' || p.status === 'hold'))
    .sort((a, b) => vendorName(a).localeCompare(vendorName(b)) || String(a.deliveryMonth).localeCompare(String(b.deliveryMonth)));
  const opt = p => `<option value="${esc(p.id)}">${poLabel(p)}</option>`;
  if (!first.length && !rest.length) return '';
  return `<select class="pick" data-logpick="${esc(key)}" aria-label="${esc(label)}"><option value="">${esc(label)}</option>${first.map(opt).join('')}${first.length && rest.length ? '<option disabled>── other open orders ──</option>' : ''}${rest.map(opt).join('')}</select>`;
}
function logMatchHtml(q){
  if (!RLOG) return '';
  const act = canAct(), who = id => id ? `<span class="person" data-uid="${esc(id)}"></span>` : '';
  const toMatch = q.toMatch.length ? `<div class="tbl"><table class="mini rt" style="min-width:0"><thead><tr><th>Date</th><th>From the log</th><th>Invoice</th><th class="r">Amount</th><th>Order</th></tr></thead><tbody>${q.toMatch.map(({row, cands, fit, reopened}) =>
    fit === 'loose'
      ? `<tr>${logRowCells(row)}<td data-l="Order"><span class="faint">No order fits exactly: ${esc(vendorName(cands[0]))} has ${cands.length === 1 ? 'an order' : cands.length + ' orders'} open, but due in another month or with less left open than this invoice.</span>${act ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${logPickHtml(row.key, cands, 'Pick the order…')}<button class="btn ghost sm" type="button" data-lognot="${esc(row.key)}">Not an order</button></div>` : ''}</td></tr>`
      : `<tr>${logRowCells(row)}<td data-l="Order">${poLabel(cands[0])}${fit === 'exact' ? ' <span class="pill">named in the log</span>' : ''}${reopened ? ' <span class="pill">entered after you marked it not an order</span>' : ''}${act ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn primary sm" type="button" data-logok="${esc(row.key)}|${esc(cands[0].id)}">Confirm</button>${cands.slice(1).map(p => `<button class="btn sm" type="button" data-logok="${esc(row.key)}|${esc(p.id)}" title="${poLabel(p)}">Pick PO ${esc(p.poNumber || p.id)}</button>`).join('')}<button class="btn ghost sm" type="button" data-lognot="${esc(row.key)}">Not an order</button></div>` : ''}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="note">Nothing to match: every row in the log is matched or isn\'t from an order.</div>';
  const was = (key, poId) => { const p = POS.find(x => x.id === poId), e = p && (p.invoicesIn || []).find(x => x && x.logKey === key), d = LOGMATCH[key] || {};
    const src = e || d; return `${p ? `PO ${esc(p.poNumber || p.id)} · ${esc(vendorName(p))}` : esc(poId)}: ${src.date ? dateLabel(src.date) : ''}${src.invoice ? ` · invoice ${esc(src.invoice)}` : ''}${src.amount != null ? ` · ${money2(src.amount)}` : ''}`; };
  const fixes = q.changed.map(c => ({...c, why: 'changed or removed in the log'})).concat(q.twice.flatMap(t => t.pos.map(po => ({key: t.key, po, why: 'matched to more than one order'}))));
  const changed = fixes.length ? `<section class="panel"><header><h2>Check these matches</h2><span class="lab">${fixes.length}</span></header><div class="note">A matched row that was changed or removed in the receiving log, or one matched to two orders. Undo the match that no longer applies, then match the corrected row.</div>
    <ul class="items">${fixes.map(c => `<li class="item warn"><div class="stripe"></div><div class="body"><div class="t">${was(c.key, c.po)}</div><div class="d">${c.why}</div></div>${act ? `<button class="btn sm" type="button" data-logundo="${esc(c.key)}|${esc(c.po)}">Undo this match</button>` : ''}</li>`).join('')}</ul></section>` : '';
  const not = q.notOrder.length ? `<details class="panel" style="padding:12px 16px"><summary><b>Not from an order</b> · ${q.notOrder.length} row${q.notOrder.length === 1 ? '' : 's'}: reorders, special orders and anything else not in the order book. Nothing to do.</summary>
    <div class="tbl"><table class="mini rt" style="min-width:0"><tbody>${q.notOrder.map(({row, why}) => { const d = LOGMATCH[row.key];
      return `<tr>${logRowCells(row)}<td>${why === 'marked' ? `marked by ${who(d && d.by)}${act ? ` <button class="btn ghost sm" type="button" data-logundo="${esc(row.key)}">Undo</button>` : ''}` : `<span class="faint">${why === 'special' ? 'a special order' : why === 'reorder' ? 'a reorder in the log' : 'no open order from this vendor'}</span>${act ? ` ${logPickHtml(row.key, [], 'Match to an order…')}` : ''}`}</td></tr>`; }).join('')}</tbody></table></div></details>` : '';
  const matched = q.matched.length ? `<details class="panel" style="padding:12px 16px"><summary><b>Matched</b> · ${q.matched.length} row${q.matched.length === 1 ? '' : 's'}</summary>
    <div class="tbl"><table class="mini rt" style="min-width:0"><tbody>${q.matched.map(({row, po}) => { const p = POS.find(x => x.id === po), d = LOGMATCH[row.key];
      return `<tr>${logRowCells(row)}<td>${p ? `PO ${esc(p.poNumber || p.id)} · ${esc(vendorName(p))}` : esc(po)} · ${who(d && d.by)}${act ? ` <button class="btn ghost sm" type="button" data-logundo="${esc(row.key)}">Undo</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div></details>` : '';
  const sure = act ? sureMatches(q).length : 0;
  return `<section class="panel"><header><h2>Match from the receiving log</h2><span style="display:flex;gap:8px;align-items:center">${sure >= 2 ? `<button class="btn primary sm" type="button" data-logall="1" title="Rows named in the log, or with only one possible order">Confirm all ${sure} sure matches</button>` : ''}<span class="lab">${q.toMatch.length} to match</span></span></header>
    <div class="note" style="padding-bottom:4px">Each row is what the accounting team logged. A PO # in the log names its order; otherwise the app suggests the likeliest: same vendor, due within a month, enough still open, or lets you pick when nothing fits exactly. Confirm marks the order arrived (it stays committed in the budget until Jonas records it).</div>${toMatch}</section>${changed}${not}${matched}`;
}
/* ---------- an order's arrival: the Orders list's bar and the order's timeline ----------
   Three parts that add up to the order's cost: what Jonas has recorded received (the official record), what has
   arrived by invoice and sits in the store room, and what is still to come. */
function arrivalSplit(p){
  const total = r2(poTotal(p)), inJonas = r2(Math.min(Math.max(num(p.received), 0), total)), storeRoom = r2(Math.min(storeRoomOf(p), total - inJonas));
  return {total, inJonas, storeRoom, toCome: r2(Math.max(total - inJonas - storeRoom, 0))};
}
function arrivalBarHtml(p){
  if (p.status === 'cancelled') return '';
  const a = arrivalSplit(p); if (a.total <= 0) return '';
  const pct = v => Math.round(v / a.total * 1000) / 10, t = `In Jonas ${money2(a.inJonas)} · in the store room ${money2(a.storeRoom)} · still to come ${money2(a.toCome)}`;
  return `<span class="abar" role="img" aria-label="${t}" title="${t}"><i class="j" style="width:${pct(a.inJonas)}%"></i><i class="s" style="width:${pct(a.storeRoom)}%"></i></span>`;
}
/** Days from the end of a 'YYYY-MM' delivery month to a date (0 or less: on time). */
const daysAfterMonth = (ym, iso) => { const [y, m] = ym.split('-').map(Number); return Math.round((Date.parse(iso + 'T00:00:00Z') - Date.UTC(y, m, 0)) / 864e5); };
function arrivalTimelineHtml(p){
  const a = arrivalSplit(p), placed = orderDateISO(p.orderDate), ym = /^\d{4}-\d{2}/.test(p.deliveryMonth || '') ? p.deliveryMonth.slice(0, 7) : null;
  const inv = (p.invoicesIn || []).filter(Boolean).slice().sort((x, y) => String(x.date).localeCompare(String(y.date)));
  const step = (cls, label, what) => `<li class="${cls}"><b>${label}</b> <span class="faint">${what}</span></li>`;
  const late = d => { if (!ym || !d) return ''; const n = daysAfterMonth(ym, d); return n > 0 ? ` <span class="rstat overdue">late, ${n} day${n === 1 ? '' : 's'} after ${monthLabel(ym)}</span>` : ''; };
  return `<ol class="atl">
    ${step('done', 'Placed', placed ? dateLabel(placed) : '—')}
    ${step(inv.length || a.inJonas ? 'done' : '', 'Due', ym ? monthLabel(ym) : 'no delivery month')}
    ${inv.map((e, i) => step('done', 'Arrived', `${dateLabel(e.date)} · ${e.amount != null && e.amount !== '' ? money2(num(e.amount)) : 'whole order'}${e.invoice ? ` · invoice ${esc(e.invoice)}` : ''} · ${e.source === 'log' ? 'from the receiving log' : 'marked by hand'}`) + (i === 0 ? late(e.date) : '')).join('')}
    ${step(a.inJonas ? 'done' : '', 'In Jonas', `${money2(a.inJonas)} of ${money2(a.total)} received${BASE && BASE.asOf ? `, as of the ${dateLabel(BASE.asOf)} upload` : ''}`)}
    ${a.storeRoom ? step('', 'In the store room', `${money2(a.storeRoom)}, not in Jonas yet`) : ''}
    ${p.status !== 'cancelled' && a.toCome ? step('', 'Still to come', money2(a.toCome) + (ym && ym < THIS_MONTH ? ' <span class="rstat overdue">late</span>' : '')) : ''}
  </ol>`;
}
/** A vendor's record on orders that were due (delivery month before today's): judged, those whose first arrival
    (invoice in, from the log or by hand) came by the end of the delivery month; avgLate, the average days late of the
    rest (still not arrived counts to today); due and arrived, dollars of those orders and how much of it is in Jonas
    or the store room; lastArrival, the latest invoice date on any of the vendor's orders. An order Jonas received with
    no arrival date counts toward arrived but not timing. Cancelled orders are left out. */
function vendorScore(orders, today){
  const month = today.slice(0, 7), late = [];
  let judged = 0, onTime = 0, due = 0, arrived = 0, lastArrival = null;
  for (const p of orders || []){
    if (!p || p.status === 'cancelled') continue;
    const dates = (p.invoicesIn || []).map(e => e && e.date).filter(Boolean).sort();
    if (dates.length && (!lastArrival || dates[dates.length - 1] > lastArrival)) lastArrival = dates[dates.length - 1];
    const ym = /^\d{4}-\d{2}/.test(p.deliveryMonth || '') ? p.deliveryMonth.slice(0, 7) : null;
    if (!ym || ym >= month) continue;
    const a = arrivalSplit(p); due += a.total; arrived += a.inJonas + a.storeRoom;
    if (dates.length){ judged++; const n = daysAfterMonth(ym, dates[0]); if (n <= 0) onTime++; else late.push(n); }
    else if (a.inJonas + a.storeRoom < a.total - 0.5){ judged++; late.push(daysAfterMonth(ym, today)); }
  }
  return {judged, onTime, avgLate: late.length ? Math.round(late.reduce((x, y) => x + y, 0) / late.length) : null, due: r2(due), arrived: r2(arrived), lastArrival};
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
    ${overdueHtml(q)}
    ${logMatchHtml(q)}
    ${rcvChart(rows)}
    ${sec('In the store room, not in the POS', 'Oldest first. Arrived is what the invoices add up to. Clear takes an order off this list once it is in the POS; it changes no figures. Open an order to change what was received.', arr, 'arrived', 'Nothing is waiting. Match a receiving log invoice, or use Invoice in, when the goods arrive.')}
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
