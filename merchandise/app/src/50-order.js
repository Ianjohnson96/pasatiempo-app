/* ---------- order drawer ---------- */
let D = null, DX = null;
const canAct = () => dbState === 'live' && !readOnly;
const activeVendors = () => VENDORS.filter(v => v.active !== false).sort((a,b) => a.name.localeCompare(b.name));
const subsFor = cat => SUBCATS.filter(s => s.cat === cat && s.active !== false).sort((a,b) => (a.sort ?? 99) - (b.sort ?? 99) || a.name.localeCompare(b.name));
const newLine = (cat, extra = {}) => ({id: uid(), cat: cat || '', sub: '', style: '', color: '', cost: '', run: 'none', sizes: [], qty: {}, units: '', ...extra});
function runCols(l){ return l.run === 'custom' ? (l.sizes || []) : (RUNS[l.run] || {}).cols || []; }
function draftPo(){ const p = {...D}; delete p._addVendor; p.lines = (D.lines || []).map(l => { const x = {...l}; delete x._addSub; return x; });
  if (p.lines.length){ p.cost = poTotal(p); p.units = poUnits(p); } else { p.cost = r2(num(p.cost)); p.units = num(p.units); } return p; }

function openOrder(id, preset){
  DX = id ? POS.find(p => p.id === id) : null;
  D = DX ? JSON.parse(JSON.stringify(DX)) : {poNumber:'', vendorId:'', cat:'', orderDate:todayISO, deliveryMonth:addMonths(THIS_MONTH,1), cancelDate:'', cost:'', units:'', status:'open', received:0, receivedDate:'', notes:'', lines:[]};
  if (!D.lines) D.lines = [];
  if (!D.vendorId && D.vendorName){ const v = VENDORS.find(x => x.name.toLowerCase() === String(D.vendorName).toLowerCase()); if (v) D.vendorId = v.id; }
  if (preset) Object.assign(D, preset);
  const ro = !canAct();
  $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dTitle">
    <header><div><div class="lab">${DX ? 'Purchase order' : 'New purchase order'}</div><h2 id="dTitle">${DX ? 'PO ' + esc(DX.poNumber) : 'Write an order'}</h2></div><button class="x" type="button" data-close="1" aria-label="Close">×</button></header>
    <div class="body">
      <div class="sec">1 · Order</div>
      <div class="row3">
        <div class="f" id="wPo"><label for="dPo">PO number</label><input id="dPo" data-d="poNumber" value="${esc(D.poNumber)}" autocomplete="off" ${ro ? 'disabled' : ''}></div>
        <div class="f"><label for="dOrder">Order date</label><input id="dOrder" type="date" data-d="orderDate" value="${esc(D.orderDate)}" ${ro ? 'disabled' : ''}></div>
        <div class="f"><label for="dStatus">Status</label><select id="dStatus" data-d="status" ${ro ? 'disabled' : ''}>${Object.entries(STATUS).map(([k,v]) => `<option value="${k}" ${D.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      </div>
      <div id="dVendorBox"></div>
      <div class="row3">
        <div class="f" id="wCat"><label for="dCat">Main category</label><select id="dCat" data-d="cat" ${ro ? 'disabled' : ''}><option value="">Choose…</option>${catList().map(c => `<option value="${c.code}" ${D.cat === c.code ? 'selected' : ''}>${c.code} · ${esc(c.name)}</option>`).join('')}</select><div class="hint">New lines start in this category</div></div>
        <div class="f" id="wDel"><label for="dDel">Expected delivery</label><select id="dDel" data-d="deliveryMonth" ${ro ? 'disabled' : ''}>${MONTH_OPTS.map(m => `<option value="${m}" ${D.deliveryMonth === m ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select></div>
        <div class="f"><label for="dCancel">Cancel by</label><input id="dCancel" type="date" data-d="cancelDate" value="${esc(D.cancelDate)}" ${ro ? 'disabled' : ''}><div class="hint">From the vendor's confirmation</div></div>
      </div>
      <div class="sec">2 · What you're buying</div>
      <div id="dLines"></div>
      <div id="dTotals"></div>
      <div class="sec">3 · Budget check</div>
      <div id="dImpact"></div>
      ${DX && !ro ? `<div class="receive"><h3>Record a delivery</h3>
        <div class="lab" style="margin-bottom:8px">Received so far: <span class="num">${money(num(DX.received))}</span>${DX.receivedDate ? ' · last ' + dateLabel(DX.receivedDate) : ''}</div>
        <div class="rr"><div class="f"><label for="rAmt">Cost value received ($)</label><input id="rAmt" type="number" min="0" step="0.01" value="${Math.max(poTotal(DX) - num(DX.received), 0).toFixed(2)}"></div>
        <div class="f"><label for="rDate">Date</label><input id="rDate" type="date" value="${todayISO}"></div><button class="btn" type="button" id="rBtn">Record</button></div></div>` : ''}
      <div class="f"><label for="dNotes">Notes</label><textarea id="dNotes" data-d="notes" ${ro ? 'disabled' : ''} placeholder="Confirmation #, ship-to, anything the next person needs">${esc(D.notes)}</textarea></div>
    </div>
    <footer><div>${DX && !ro ? '<button class="btn danger" type="button" id="dDelete">Delete</button>' : ''}</div>
      <div style="display:flex;gap:8px">${ro ? '<button class="btn" type="button" data-close="1">Close</button>' : `<button class="btn" type="button" data-close="1">Cancel</button><button class="btn primary" type="button" id="dSave">${DX ? 'Save changes' : 'Save order'}</button>`}</div></footer>
  </aside>`;
  renderVendorBox(); renderLines(); updateTotals();
  (DX ? $('.x') : $('#dPo')).focus();
}
function renderVendorBox(){
  const ro = !canAct(), v = VENDORS.find(x => x.id === D.vendorId);
  let info = '';
  if (v){ const bits = [v.rep && 'Rep: ' + esc(v.rep), v.phone && esc(v.phone), v.email && esc(v.email), v.terms && 'Terms: ' + esc(v.terms)].filter(Boolean);
    if (v.leadWeeks){ const eta = new Date(Date.now() + v.leadWeeks * 7 * 864e5); bits.push(`Lead time ${v.leadWeeks} wks → ordered today, arrives about ${MN[eta.getMonth()]} ${eta.getFullYear()}`); }
    info = bits.length ? `<div class="vinfo">${bits.join(' · ')}</div>` : `<div class="vinfo">No contact details yet — add them under <b>Vendors</b>.</div>`; }
  $('#dVendorBox').innerHTML = `<div class="f" id="wVendor"><label for="dVendor">Vendor</label>
    <select id="dVendor" ${ro ? 'disabled' : ''}><option value="">Choose a vendor…</option>${activeVendors().map(x => `<option value="${esc(x.id)}" ${x.id === D.vendorId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
    ${v && v.active === false ? `<option value="${esc(v.id)}" selected>${esc(v.name)} (hidden)</option>` : ''}${ro ? '' : '<option value="__new">＋ Add a new vendor…</option>'}</select>${info}</div>
    ${D._addVendor ? `<div class="inline-add"><div class="lab">New vendor — saved for everyone, so it's in the list next time</div>
      <div class="row2"><div class="f"><label for="nvName">Vendor name</label><input id="nvName" autocomplete="off"></div><div class="f"><label for="nvRep">Rep</label><input id="nvRep"></div></div>
      <div class="row3"><div class="f"><label for="nvPhone">Phone</label><input id="nvPhone"></div><div class="f"><label for="nvEmail">Email</label><input id="nvEmail"></div><div class="f"><label for="nvLead">Lead time (weeks)</label><input id="nvLead" type="number" min="0"></div></div>
      <div style="display:flex;gap:8px"><button class="btn primary sm" type="button" id="nvSave">Add vendor</button><button class="btn sm" type="button" id="nvCancel">Cancel</button></div></div>` : ''}`;
  if (D._addVendor) $('#nvName').focus();
}
function sizeGrid(l, ro){
  const cols = runCols(l), rows = (RUNS[l.run] || {}).rows;
  if (!cols.length) return l.run === 'custom' ? '' : '';
  const cell = key => `<td><input type="number" min="0" step="1" inputmode="numeric" placeholder=" " aria-label="Quantity ${esc(key.replace('|',' '))}" data-q="${l.id}" data-k="${esc(key)}" value="${num(l.qty[key]) || ''}" ${ro ? 'disabled' : ''}></td>`;
  const rt = keys => `<td class="rt" data-rt="${l.id}|${esc(keys.join(','))}">${keys.reduce((a,k) => a + num(l.qty[k]), 0) || ''}</td>`;
  const rr = rows || [null];
  return `<div class="sizegrid"><table><thead><tr><th class="rl">${rows ? '' : 'Qty'}</th>${cols.map(c => `<th>${esc(c)}</th>`).join('')}<th>Total</th></tr></thead><tbody>
    ${rr.map(r => { const keys = cols.map(c => r ? r + '|' + c : c); return `<tr><td class="rl">${r ? esc(r) : ''}</td>${keys.map(cell).join('')}${rt(keys)}</tr>`; }).join('')}</tbody></table></div>
    ${(RUNS[l.run] || {}).note ? `<div class="hint" style="font-size:11.5px;color:var(--faint)">${esc(RUNS[l.run].note)}</div>` : ''}`;
}
function renderLines(){
  const ro = !canAct();
  const L = D.lines;
  const box = $('#dLines');
  if (!L.length){
    box.innerHTML = `<div class="inline-add" style="border-style:solid;background:var(--card)">
      <div style="font-size:13.5px">Add the items on this order — subcategory, style, color, cost and sizes. The order total adds itself up.</div>
      ${ro ? '' : `<div><button class="btn primary sm" type="button" data-addline="1">+ Add a line</button></div>`}
      <div class="row2"><div class="f"><label for="dCost">Or just enter the order total at cost ($)</label><input id="dCost" type="number" min="0" step="0.01" data-d="cost" value="${esc(D.cost)}" ${ro ? 'disabled' : ''}></div>
      <div class="f"><label for="dUnits">Total units (optional)</label><input id="dUnits" type="number" min="0" step="1" data-d="units" value="${esc(D.units)}" ${ro ? 'disabled' : ''}></div></div></div>`;
    return;
  }
  box.innerHTML = L.map((l, i) => {
    const subs = subsFor(l.cat);
    return `<div class="line" data-line="${l.id}">
      <div class="lh"><span class="n">LINE ${i + 1}${l.sku ? ' · SKU ' + esc(l.sku) : ''}</span>${ro ? '' : `<span style="display:flex;gap:6px"><button class="btn sm" type="button" data-lact="dup" data-l="${l.id}" title="Copy this line, e.g. for another color">Copy line</button><button class="btn sm danger" type="button" data-lact="remove" data-l="${l.id}">Remove</button></span>`}</div>
      <div class="lb">
        <div class="lr"><div class="f"><label for="lc-${l.id}">Category</label><select id="lc-${l.id}" data-l="${l.id}" data-f="cat" ${ro ? 'disabled' : ''}><option value="">Choose…</option>${catList().map(c => `<option value="${c.code}" ${l.cat === c.code ? 'selected' : ''}>${c.code} · ${esc(c.name)}</option>`).join('')}</select></div>
          <div class="f"><label for="ls-${l.id}">Subcategory</label><select id="ls-${l.id}" data-l="${l.id}" data-f="sub" ${ro || !l.cat ? 'disabled' : ''}><option value="">${l.cat ? 'Choose…' : 'Pick a category first'}</option>${subs.map(s => `<option value="${esc(s.id)}" ${l.sub === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}${ro || !l.cat ? '' : '<option value="__new">＋ Add a subcategory…</option>'}</select></div></div>
        ${l._addSub ? `<div class="inline-add"><div class="lab">New subcategory in ${esc(CAT(l.cat).name)}</div><div class="row2"><div class="f"><label for="nsn-${l.id}">Name</label><input id="nsn-${l.id}" placeholder="e.g. Ball markers"></div>
          <div class="f"><label for="nsr-${l.id}">Usual sizes</label><select id="nsr-${l.id}">${Object.entries(RUNS).map(([k,r]) => `<option value="${k}">${esc(r.label)}</option>`).join('')}</select></div></div>
          <div style="display:flex;gap:8px"><button class="btn primary sm" type="button" data-nsave="${l.id}">Add subcategory</button><button class="btn sm" type="button" data-ncancel="${l.id}">Cancel</button></div></div>` : ''}
        <div class="lr3"><div class="f"><label for="lst-${l.id}">Style / description</label><input id="lst-${l.id}" data-l="${l.id}" data-f="style" value="${esc(l.style)}" placeholder="Style # and name" ${ro ? 'disabled' : ''}></div>
          <div class="f"><label for="lco-${l.id}">Color</label><input id="lco-${l.id}" data-l="${l.id}" data-f="color" value="${esc(l.color)}" ${ro ? 'disabled' : ''}></div>
          <div class="f"><label for="lu-${l.id}">Unit cost ($)</label><input id="lu-${l.id}" type="number" min="0" step="0.01" data-l="${l.id}" data-f="cost" value="${esc(l.cost)}" ${ro ? 'disabled' : ''}></div></div>
        <div class="lr"><div class="f"><label for="lr-${l.id}">Sizes</label><select id="lr-${l.id}" data-l="${l.id}" data-f="run" ${ro ? 'disabled' : ''}>${Object.entries(RUNS).map(([k,r]) => `<option value="${k}" ${l.run === k ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select></div>
          ${l.run === 'none' ? `<div class="f"><label for="lq-${l.id}">Quantity</label><input id="lq-${l.id}" type="number" min="0" step="1" data-l="${l.id}" data-f="units" value="${esc(l.units)}" ${ro ? 'disabled' : ''}>${l.suggest ? `<div class="hint">Suggested: about ${int(l.suggest)}</div>` : ''}</div>`
            : l.run === 'custom' ? `<div class="f"><label for="lcs-${l.id}">Your sizes, separated by commas</label><input id="lcs-${l.id}" data-l="${l.id}" data-f="sizesText" value="${esc((l.sizes || []).join(', '))}" placeholder="e.g. 8, 9, 10, 11 or S/M, L/XL" ${ro ? 'disabled' : ''}></div>`
            : `<div class="hint" style="align-self:end;font-size:12px;color:var(--muted)">Type a quantity under each size.${l.suggest ? ` Suggested total: about ${int(l.suggest)}.` : ''}</div>`}</div>
        ${l.run !== 'none' ? sizeGrid(l, ro) : ''}
      </div>
      <div class="lf"><span data-lsum="${l.id}"></span><span class="ext" data-ext="${l.id}"></span></div></div>`;
  }).join('') + (ro ? '' : `<div style="display:flex;gap:8px"><button class="btn sm" type="button" data-addline="1">+ Add another line</button></div>`);
}
function updateTotals(){
  for (const l of D.lines){
    const u = lineUnits(l), e = lineExt(l);
    const s = document.querySelector(`[data-lsum="${l.id}"]`), x = document.querySelector(`[data-ext="${l.id}"]`);
    if (s) s.textContent = `${int(u)} unit${u === 1 ? '' : 's'} × ${money2(num(l.cost))} each`;
    if (x) x.textContent = money(e);
    $$(`[data-rt^="${l.id}|"]`).forEach(td => { const keys = td.dataset.rt.split('|').slice(1).join('|').split(','); td.textContent = keys.reduce((a,k) => a + num(l.qty[k]), 0) || ''; });
  }
  const p = draftPo();
  $('#dTotals').innerHTML = D.lines.length ? `<div class="ordertot"><div><div class="lab">Order total at cost</div><div style="font-size:12.5px;color:var(--muted)">${D.lines.length} line${D.lines.length === 1 ? '' : 's'} · ${int(poUnits(p))} units</div></div><div class="big">${money(poTotal(p))}</div></div>` : '';
  renderImpact(p);
}
function renderImpact(p){ withPlan(planKeyFor(p.deliveryMonth), () => renderImpactIn(p)); }
function renderImpactIn(p){
  const box = $('#dImpact'); if (!box) return;
  const warns = brandWarns(p);
  if (p.poNumber && POS.some(x => x.poNumber === p.poNumber && (!DX || x.id !== DX.id))) warns.push(['', `PO ${p.poNumber} is already in the book. Check it isn't a duplicate.`]);
  const v = VENDORS.find(x => x.id === p.vendorId);
  if (v && RISK_VENDORS.test(v.name)) warns.push(['', 'Costs from this vendor were up 22–35% on last year. Check the selling price still gives you your margin.']);
  const parts = ledger([{...p, id:'__d'}]).filter(e => e.cat);
  const cats = [...new Set(parts.map(e => e.cat))];
  if (!cats.length || !poTotal(p)){ box.innerHTML = `<div class="warnbox info">Pick a category and enter costs to see how this order fits the budget.</div>` + warns.map(w => `<div class="warnbox ${w[0]}">${esc(w[1])}</div>`).join(''); return; }
  const others = POS.filter(x => !DX || x.id !== DX.id);
  const S0 = stats(others), S1 = stats(others.concat([{...p, id:'__d'}])), b = bucket({...p});
  let html = '';
  for (const code of cats){
    const c = CAT(code);
    if (!inOTB(code)){ html += `<div class="warnbox info"><b>${esc(c.name)}</b> is outside the open-to-buy. This line is logged for the record and doesn't use a budget.</div>`; continue; }
    const season = seasonBudget(code), before = S0.cm(code, LAST()), after = S1.cm(code, LAST()), mine = after - before;
    const left = season - after;
    const g1 = season > 0 ? Math.min(100, before / season * 100) : 0, g2 = season > 0 ? Math.min(100 - g1, mine / season * 100) : 0;
    let monthMsg = '';
    if (b && WIN().includes(b)){
      const room = roomThrough(code, b), usedBy = S1.cm(code, b);
      if (usedBy > room + 1){ const f = WIN().find(k => roomThrough(code, k) >= S1.cm(code, k) - 1 && k >= b);
        monthMsg = room <= 0 ? `No room to receive ${esc(c.name)} by ${monthFull(b)} yet${f ? ` — room opens in ${monthFull(f)}. A later ship date would fit.` : '.'}`
                             : `By the end of ${monthFull(b)} this puts ${esc(c.name)} ${money(usedBy - room)} over its room.${f ? ` Shipping in ${monthFull(f)} would fit.` : ''}`; }
      else monthMsg = `Fits: ${money(room - usedBy)} of room left in ${esc(c.name)} by the end of ${monthFull(b)}.`;
    } else if (b === 'later') monthMsg = `Arrives after ${monthLabel(LAST())}, past the end of the plan.`;
    html += `<div class="impact"><div class="lab">${esc(c.name)} — ${PLAN.fy} budget</div>
      <div class="gauge" aria-hidden="true"><i style="width:${g1}%;background:var(--fog)"></i><i style="width:${g2}%;background:${left < 0 ? 'var(--brick)' : 'var(--cypress)'}"></i></div>
      <div class="ln"><span>${PLAN.fy} budget</span><span>${season > 0 ? money(season) : 'none — overbought'}</span></div>
      <div class="ln"><span>Already committed</span><span>${money(before)}</span></div>
      <div class="ln"><span>This order</span><span>${money(mine)}</span></div>
      <div class="ln b"><span>Left after this order</span><span class="${left < 0 ? 'neg' : ''}">${money(left)}</span></div></div>
      ${season <= 0 ? `<div class="warnbox crit">${esc(c.name)} is already overbought for ${PLAN.fy}. Only order against a customer commitment.</div>` : left < 0 ? `<div class="warnbox crit">This takes ${esc(c.name)} over its ${PLAN.fy} budget by ${money(-left)}.</div>` : ''}
      ${monthMsg ? `<div class="warnbox ${/^Fits/.test(monthMsg) ? 'good' : /next year/.test(monthMsg) ? 'info' : ''}">${monthMsg}</div>` : ''}`;
  }
  box.innerHTML = html + warns.map(w => `<div class="warnbox ${w[0]}">${esc(w[1])}</div>`).join('');
}
function validateOrder(p){
  let ok = true; const mark = (id, bad) => { const el = $(id); if (el) el.classList.toggle('err', bad); if (bad) ok = false; };
  mark('#wPo', !p.poNumber); mark('#wVendor', !p.vendorId); mark('#wDel', !p.deliveryMonth);
  const lineBad = p.lines.some(l => !l.cat || !(num(l.cost) > 0) || !(lineUnits(l) > 0));
  mark('#wCat', !p.cat && !p.lines.length);
  if (p.lines.length && lineBad){ ok = false; toast('Each line needs a category, a unit cost and at least one unit.'); return false; }
  if (!p.lines.length && !(num(p.cost) > 0)){ ok = false; toast('Add a line, or enter the order total.'); return false; }
  if (!ok) toast('Fill in the highlighted fields: PO number, vendor and delivery month.');
  return ok;
}
async function saveOrder(){
  const p = draftPo();
  if (!p.cat && p.lines.length) p.cat = p.lines[0].cat;
  if (!validateOrder(p)) return;
  const v = VENDORS.find(x => x.id === p.vendorId); p.vendorName = v ? v.name : '';
  if (p.status === 'received' && !num(p.received)){ p.received = poTotal(p); p.receivedDate = p.receivedDate || todayISO; }
  const now = new Date().toISOString();
  const body = {...p, createdBy: DX ? (DX.createdBy || null) : myId, createdAt: DX ? (DX.createdAt || now) : now, updatedBy: myId, updatedAt: now};
  delete body.id; delete body.vendor;
  const id = DX ? DX.id : db.collection('pos').doc().id;
  $('#dSave').disabled = true;
  if (await write(`pos/${id}`, body)){ closeOverlay(); toast(DX ? `PO ${p.poNumber} updated` : `PO ${p.poNumber} saved`); }
  else if ($('#dSave')) $('#dSave').disabled = false;
}
async function recordReceipt(){
  const amt = r2(num($('#rAmt').value)), date = $('#rDate').value || todayISO;
  if (!(amt > 0)){ toast('Enter the cost value received.'); return; }
  const received = r2(num(DX.received) + amt), status = received >= poTotal(DX) - 0.5 ? 'received' : 'partial';
  const body = {...DX, received, receivedDate: date, status, updatedBy: myId, updatedAt: new Date().toISOString()}; delete body.id;
  $('#rBtn').disabled = true;
  if (await write(`pos/${DX.id}`, body)){ closeOverlay(); toast(status === 'received' ? `PO ${DX.poNumber} fully received` : `Recorded ${money(amt)} received on PO ${DX.poNumber}`); }
  else if ($('#rBtn')) $('#rBtn').disabled = false;
}
async function deleteOrder(){
  if (!confirm(`Delete PO ${DX.poNumber}? If it was cancelled, set its status to Cancelled instead to keep the record.`)) return;
  try { await db.doc(`pos/${DX.id}`).delete(); closeOverlay(); toast(`PO ${DX.poNumber} deleted`); } catch (e){ writeError(e); }
}
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';
async function addVendorInline(){
  const name = $('#nvName').value.trim(); if (!name){ toast('Enter the vendor name.'); return; }
  const dup = VENDORS.find(v => v.name.toLowerCase() === name.toLowerCase());
  if (dup){ D.vendorId = dup.id; D._addVendor = false; renderVendorBox(); updateTotals(); toast(`${dup.name} is already in the list — selected it.`); return; }
  const id = 'v-' + slug(name) + '-' + uid().slice(0,4);
  const body = {name, rep: $('#nvRep').value.trim(), phone: $('#nvPhone').value.trim(), email: $('#nvEmail').value.trim(), account:'', terms:'', notes:'', leadWeeks: num($('#nvLead').value) || null, active:true, createdBy: myId, createdAt: new Date().toISOString()};
  $('#nvSave').disabled = true;
  if (await write(`vendors/${id}`, body)){ if (!VENDORS.find(v => v.id === id)) VENDORS.push({id, ...body}); D.vendorId = id; D._addVendor = false; renderVendorBox(); updateTotals(); toast(`${name} added to the vendor list`); }
  else if ($('#nvSave')) $('#nvSave').disabled = false;
}
async function addSubInline(lineId){
  const l = D.lines.find(x => x.id === lineId); const name = $(`#nsn-${lineId}`).value.trim(), run = $(`#nsr-${lineId}`).value;
  if (!name){ toast('Enter a subcategory name.'); return; }
  const dup = subsFor(l.cat).find(s => s.name.toLowerCase() === name.toLowerCase());
  if (dup){ l.sub = dup.id; l._addSub = false; renderLines(); updateTotals(); return; }
  const id = `s-${l.cat}-${slug(name)}-${uid().slice(0,3)}`, body = {cat: l.cat, name, run, sort: 90, active: true, createdBy: myId};
  if (await write(`subcats/${id}`, body)){ if (!SUBCATS.find(s => s.id === id)) SUBCATS.push({id, ...body}); l.sub = id; l._addSub = false; if (!Object.keys(l.qty).length) l.run = run; renderLines(); updateTotals(); toast(`${name} added to ${CAT(l.cat).name}`); }
}
function startOrderFromItem(itemId){
  const it = (INS.items || []).find(i => i.id === itemId); if (!it) return;
  const words = it.desc.toLowerCase();
  const v = activeVendors().filter(x => words.includes(x.name.toLowerCase().split(/[ /]/)[0])).sort((a,b) => b.name.length - a.name.length)[0];
  const sub = subsFor(it.cat)[0];
  const suggest = it.metrics && (it.metrics.suggest || (it.metrics.perWeek ? Math.round(it.metrics.perWeek * 9) : it.metrics.recent ? Math.round(it.metrics.recent / 13 * 9) : 0));
  const line = newLine(it.cat, {sku: it.sku, style: it.desc, cost: it.metrics && it.metrics.cost ? it.metrics.cost : '', sub: '', run: 'none', suggest});
  openOrder(null, {cat: it.cat, vendorId: v ? v.id : '', lines: [line], notes: `Reorder from To do: ${it.title}`});
}
