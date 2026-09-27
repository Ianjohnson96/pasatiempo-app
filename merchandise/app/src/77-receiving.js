
/* ---------- deliveries worked out from the SKU Analysis ----------
   The shop receives into the POS without purchase orders, so nobody logs deliveries here. Each month-end
   upload works out what arrived since the last one, by category and brand (merchandise/pipeline/receipts.py),
   and this matches it to open orders, oldest expected delivery first, for the owner to confirm. */
const RCV_TOL = p => Math.max(25, poTotal(p) * 0.03);  // a balance this small left after a delivery counts as delivered
function owedIn(p, cat, taken){
  const ext = poParts(p).filter(x => x.cat === cat).reduce((a, x) => a + x.ext, 0);
  return Math.max(ext - num(receivedByCat(p)[cat]) - num(taken), 0);
}
function matchArrivals(A){
  const toM = A.to.slice(0, 7), horizon = addMonths(toM, 2), taken = {}, byPo = {}, loose = [];
  for (const g of A.groups || []){
    let left = num(g.value);
    const cands = !g.brand ? [] : POS.filter(p => (p.status === 'open' || p.status === 'partial') && String(p.orderDate || '') <= A.to
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
