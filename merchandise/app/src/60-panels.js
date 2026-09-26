/* ---------- category drawer ---------- */
let CUR_CAT = null;
function openCategory(code){
  CUR_CAT = code;
  const c = {code, ...CAT(code)}, S = stats(), inv = INV.cats[code] || {units:0,cost:0,aged:0};
  const adj = ADJ.filter(a => a.cat === code).sort((a,b) => String(b.at).localeCompare(String(a.at)));
  const subs = Object.entries(S.bySub).filter(([k]) => k.startsWith(code + '|')).map(([k,v]) => ({name: subName(k.split('|')[1]) || 'No subcategory', ...v})).sort((a,b) => b.dollars - a.dollars);
  const pos = POS.filter(p => p.cat === code || (p.lines || []).some(l => l.cat === code));
  const items = allAttention(S).filter(i => i.cat === code && !i.state);
  const excluded = !inOTB(code);
  let run = 0;
  const monthRows = WIN().map(k => { const room = roomThrough(code, k), used = S.cm(code, k), mp = num(c.mplan && c.mplan[k]);
    return `<tr ${k === selMonth() ? 'style="background:var(--sunk)"' : ''}><td>${monthLabel(k)}</td><td class="r num">${money(mp)}</td><td class="r num">${money(room)}</td><td class="r num">${money(used)}</td><td class="r num ${room - used < 0 ? 'neg' : ''}">${money(room - used)}</td></tr>`; }).join('');
  $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="cTitle">
    <header><div><div class="lab">Category ${code}</div><h2 id="cTitle">${esc(c.name)} <span class="chip ${c.call}" style="vertical-align:middle">${CALLTXT[c.call]}</span></h2><div style="font-size:12.5px;color:var(--muted);margin-top:4px">${CALLHELP[c.call]}</div></div><button class="x" type="button" data-close="1" aria-label="Close">×</button></header>
    <div class="body">
      ${excluded ? `<div class="warnbox info">Special Orders is outside the open-to-buy. Its orders are logged here for the record, and its stock is still counted in on-hand and aging.</div>` : `
      <div class="sec">How this budget was set</div>
      <div class="formula" style="margin:0">
        <div class="ln"><span class="op"></span><span>Stock you want on hand at the end of ${monthLabel(LAST())}</span><span>${money(c.target)}</span></div><div class="sub">${c.wos} weeks of the cost of sales forecast for the four months after</div>
        <div class="ln"><span class="op">+</span><span>Forecast cost of sales, ${periodTxt(PLAN)}</span><span>${money(c.cogs)}</span></div><div class="sub">${money(c.sales)} of sales at retail — from the Forecast page — at a ${Math.round(c.gm * 100)}% margin</div>
        <div class="ln"><span class="op">−</span><span>${PLAN.current ? 'On hand at ' + dateLabel(PLAN.asOf) : 'Expected stock on ' + dateLabel(PLAN.start)}</span><span>${money(c.onHand)}</span></div>${!PLAN.current && c.carry > 0.5 ? `<div class="sub">includes ${money(c.carry)} more than plan, carried in from ${PLANS.cur.fy}${PLANS.cur.cats[code].plan < 0 ? ' because the category is already overstocked' : ' by orders beyond that year\'s budget'}</div>` : ''}
        <div class="ln tot"><span class="op">=</span><span>Plan budget for ${PLAN.fy}</span><span>${money(c.plan)}</span></div>
        <div class="ln"><span class="op">${adjTotal(code) < 0 ? '−' : '+'}</span><span>Your changes</span><span>${money(Math.abs(adjTotal(code)))}</span></div>
        <div class="ln tot"><span class="op">=</span><span>Working budget</span><span>${money(seasonBudget(code))}</span></div></div>
      ${c.plan <= 0 ? `<div class="warnbox crit">The shelf already holds more than this category needs through ${monthFull(LAST())} — ${money(c.onHand)} on hand against a ${money(c.target)} target, with only ${money(c.cogs)} forecast to sell. That's why there's no budget.</div>` : ''}
      <div class="sec">Month by month</div>
      <div class="tbl" style="border:1px solid var(--rule)"><table class="mini" style="min-width:520px"><thead><tr><th>Month</th><th class="r">Plan for month</th><th class="r">Room by month-end</th><th class="r">Committed by then</th><th class="r">Left</th></tr></thead><tbody>${monthRows}</tbody></table></div>
      <div style="font-size:12.5px;color:var(--muted)">"Room by month-end" adds up the monthly plan plus any changes. A negative month means September's extra stock still needs to sell before more comes in.</div>
      <div class="sec" style="display:flex;justify-content:space-between;align-items:center">Budget changes ${isAdmin && canAct() ? '<button class="btn sm" type="button" id="cAdjBtn">Change budget</button>' : ''}</div>
      <div id="cAdjForm"></div>
      ${adj.length ? `<table class="mini"><thead><tr><th>When</th><th>Change</th><th>Applies from</th><th>Reason</th><th>By</th>${isAdmin ? '<th></th>' : ''}</tr></thead><tbody>${adj.map(a => `<tr><td>${dateLabel((a.at || '').slice(0,10))}</td><td class="num ${num(a.amount) < 0 ? 'neg' : ''}">${num(a.amount) < 0 ? '−' : '+'}${money(Math.abs(num(a.amount)))}</td><td>${monthLabel(a.month)}</td><td>${esc(a.note)}</td><td><span class="person" data-uid="${esc(a.by || '')}"></span></td>${isAdmin && canAct() ? `<td><button class="btn ghost sm" type="button" data-deladj="${esc(a.id)}">Remove</button></td>` : ''}</tr>`).join('')}</tbody></table>`
        : `<div style="font-size:13px;color:var(--muted)">No changes. ${isAdmin ? 'Use <b>Change budget</b> to raise or lower it, with a reason.' : 'Only the owner can change budgets.'}</div>`}`}
      <div class="sec">Stock</div>
      <div class="row3"><div><div class="lab">On hand</div><div class="num" style="font-size:17px;font-weight:600">${money(inv.cost)}</div><div style="font-size:12px;color:var(--muted)">${int(inv.units)} units · ${int(inv.skus || 0)} SKUs</div></div>
        <div><div class="lab">Not sold 12+ months</div><div class="num" style="font-size:17px;font-weight:600">${money(inv.aged)}</div><div style="font-size:12px;color:var(--muted)">${inv.cost ? Math.round(inv.aged / inv.cost * 100) : 0}% of the category</div></div>
        <div><div class="lab">Weeks of supply</div><div class="num" style="font-size:17px;font-weight:600">${wksNow(code, inv.cost) ? Math.round(wksNow(code, inv.cost)) : "—"}</div><div style="font-size:12px;color:var(--muted)">target ${c.wos || '—'}</div></div></div>
      ${subs.length ? `<div class="sec">On order by subcategory</div><table class="mini"><thead><tr><th>Subcategory</th><th class="r">Units</th><th class="r">Committed</th></tr></thead><tbody>${subs.map(s => `<tr><td>${esc(s.name)}</td><td class="r num">${int(s.units)}</td><td class="r num">${money(s.dollars)}</td></tr>`).join('')}</tbody></table>` : ''}
      ${items.length ? `<div class="sec">Suggestions for this category</div><ul class="items" style="border:1px solid var(--rule)">${items.slice(0,8).map(i => itemHtml(i, true)).join('')}</ul>` : ''}
      <div class="sec">Orders</div>
      ${pos.length ? `<table class="mini"><thead><tr><th>PO</th><th>Vendor</th><th>Delivery</th><th class="r">Cost</th><th>Status</th></tr></thead><tbody class="click">${pos.map(p => `<tr data-po="${esc(p.id)}" style="cursor:pointer"><td class="num"><b>${esc(p.poNumber)}</b></td><td>${esc(vendorName(p))}</td><td>${monthLabel(p.deliveryMonth)}</td><td class="r num">${money(poTotal(p))}</td><td><span class="pill ${p.status}">${STATUS[p.status]}</span></td></tr>`).join('')}</tbody></table>` : '<div style="font-size:13px;color:var(--muted)">No orders in this category yet.</div>'}
    </div>
    <footer><div></div><div style="display:flex;gap:8px">${canAct() && !excluded ? `<button class="btn primary" type="button" data-neworder-cat="${code}">+ New order in ${esc(c.name)}</button>` : ''}<button class="btn" type="button" data-close="1">Close</button></div></footer>
  </aside>`;
  fillPeople();
}
function showAdjForm(code){
  $('#cAdjForm').innerHTML = `<div class="inline-add"><div class="row3">
    <div class="f"><label for="aAmt">Change ($ at cost)</label><input id="aAmt" type="number" step="1" placeholder="e.g. 5000 or -3000"><div class="hint">Use a minus sign to lower it</div></div>
    <div class="f"><label for="aMonth">Starting in</label><select id="aMonth">${WIN().map(m => `<option value="${m}" ${m === (selMonth() === 'season' ? THIS_MONTH : selMonth()) ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select><div class="hint">The extra room becomes available that month</div></div>
    <div class="f" style="grid-column:span 1"><label for="aNote">Reason</label><input id="aNote" placeholder="e.g. Member-guest logo order"></div></div>
    <div style="display:flex;gap:8px"><button class="btn primary sm" type="button" data-saveadj="${code}">Save change</button><button class="btn sm" type="button" id="aCancel">Cancel</button></div></div>`;
  $('#aAmt').focus();
}
async function saveAdj(code, amount, month, note){
  if (!amount || !note){ toast('Enter the amount and a reason.'); return false; }
  const id = 'a-' + Date.now().toString(36) + uid().slice(0,3);
  return write(`plan/${adjKey(PLAN)}/adjustments/${id}`, {cat: code, amount: r2(amount), month, note, by: myId, at: new Date().toISOString()});
}

/* ---------- vendors ---------- */
function openVendors(editId){
  const ro = !canAct();
  const cnt = {}, open = {}; for (const p of POS){ const k = p.vendorId || ''; cnt[k] = (cnt[k] || 0) + 1; open[k] = (open[k] || 0) + onOrder(p); }
  const list = [...VENDORS].sort((a,b) => (a.active === false) - (b.active === false) || a.name.localeCompare(b.name));
  const ed = editId ? VENDORS.find(v => v.id === editId) || {id:'__new', name:'', active:true} : null;
  $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="vTitle">
    <header><div><div class="lab">${VENDORS.filter(v => v.active !== false).length} active</div><h2 id="vTitle">Vendors</h2><div style="font-size:12.5px;color:var(--muted);margin-top:4px">Everything here appears in the vendor list on every order. The starting list came from brands in your SKU Analysis — edit, hide or add as you need.</div></div><button class="x" type="button" data-close="1" aria-label="Close">×</button></header>
    <div class="body">
      ${ed ? `<div class="inline-add"><div class="lab">${ed.id === '__new' ? 'Add a vendor' : 'Edit ' + esc(ed.name)}</div>
        <div class="row2"><div class="f"><label for="veName">Name</label><input id="veName" value="${esc(ed.name)}"></div><div class="f"><label for="veRep">Rep</label><input id="veRep" value="${esc(ed.rep)}"></div></div>
        <div class="row3"><div class="f"><label for="vePhone">Phone</label><input id="vePhone" value="${esc(ed.phone)}"></div><div class="f"><label for="veEmail">Email</label><input id="veEmail" value="${esc(ed.email)}"></div><div class="f"><label for="veAcct">Account #</label><input id="veAcct" value="${esc(ed.account)}"></div></div>
        <div class="row3"><div class="f"><label for="veLead">Lead time (weeks)</label><input id="veLead" type="number" min="0" value="${esc(ed.leadWeeks ?? '')}"></div><div class="f"><label for="veTerms">Terms</label><input id="veTerms" value="${esc(ed.terms)}" placeholder="e.g. Net 60"></div><div class="f"><label for="veActive">Show in list</label><select id="veActive"><option value="1" ${ed.active !== false ? 'selected' : ''}>Yes</option><option value="0" ${ed.active === false ? 'selected' : ''}>No — hide it</option></select></div></div>
        <div class="f"><label for="veNotes">Notes</label><textarea id="veNotes" placeholder="Minimums, cancel windows, co-op, anything useful">${esc(ed.notes)}</textarea></div>
        <div style="display:flex;gap:8px"><button class="btn primary sm" type="button" data-vsave="${esc(ed.id)}">Save vendor</button><button class="btn sm" type="button" data-vendors="1">Cancel</button>${ed.id !== '__new' && !cnt[ed.id] ? `<span style="flex:1"></span><button class="btn danger sm" type="button" data-vdel="${esc(ed.id)}">Delete</button>` : ''}</div></div>`
        : (ro ? '' : `<div><button class="btn primary sm" type="button" data-vedit="__new">+ Add a vendor</button></div>`)}
      <table class="mini"><thead><tr><th>Vendor</th><th>Rep / contact</th><th class="r">Lead</th><th class="r">Orders</th><th class="r">Still to come</th><th></th></tr></thead><tbody>
      ${list.map(v => `<tr ${v.active === false ? 'style="opacity:.5"' : ''}><td><b>${esc(v.name)}</b>${v.active === false ? ' <span class="chip excluded">hidden</span>' : ''}</td><td style="font-size:12px;color:var(--muted)">${esc([v.rep, v.phone, v.email].filter(Boolean).join(' · ') || '—')}</td><td class="r num">${v.leadWeeks ? v.leadWeeks + ' wk' : '—'}</td><td class="r num">${cnt[v.id] || 0}</td><td class="r num">${open[v.id] ? money(open[v.id]) : '—'}</td><td>${ro ? '' : `<button class="btn ghost sm" type="button" data-vedit="${esc(v.id)}">Edit</button>`}</td></tr>`).join('')}</tbody></table>
    </div></aside>`;
  if (ed) $('#veName').focus();
}
async function saveVendor(id){
  const name = $('#veName').value.trim(); if (!name){ toast('Enter the vendor name.'); return; }
  if (VENDORS.some(v => v.id !== id && v.name.toLowerCase() === name.toLowerCase())){ toast(`${name} is already in the list.`); return; }
  const prev = VENDORS.find(v => v.id === id) || {};
  const body = {...prev, name, rep: $('#veRep').value.trim(), phone: $('#vePhone').value.trim(), email: $('#veEmail').value.trim(), account: $('#veAcct').value.trim(),
    leadWeeks: num($('#veLead').value) || null, terms: $('#veTerms').value.trim(), notes: $('#veNotes').value.trim(), active: $('#veActive').value === '1', updatedBy: myId, updatedAt: new Date().toISOString()};
  delete body.id;
  const vid = id === '__new' ? 'v-' + slug(name) + '-' + uid().slice(0,4) : id;
  if (id === '__new'){ body.createdBy = myId; body.createdAt = body.updatedAt; }
  if (await write(`vendors/${vid}`, body)){ toast(`${name} saved`); openVendors(); }
}

/* ---------- counts ---------- */
function openCount(id){
  const ex = id ? COUNTS.find(c => c.id === id) : null, ro = !canAct() || (ex && ex.applied);
  const cats = catList();
  $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="ctTitle">
    <header><div><div class="lab">Inventory count</div><h2 id="ctTitle">${ex ? esc(ex.label || 'Count') + ' · ' + dateLabel(ex.date) : 'Record a count'}</h2></div><button class="x" type="button" data-close="1" aria-label="Close">×</button></header>
    <div class="body">
      <div class="row2"><div class="f"><label for="ctDate">Count date</label><input id="ctDate" type="date" value="${esc(ex ? ex.date : todayISO)}" ${ro ? 'disabled' : ''}></div>
        <div class="f"><label for="ctLabel">Name</label><input id="ctLabel" value="${esc(ex ? ex.label : 'Quarterly count')}" ${ro ? 'disabled' : ''}></div></div>
      <div style="font-size:13px;color:var(--muted)">Enter both figures at cost. <b>Book</b> is what the system showed just before you posted the count; <b>Counted</b> is what you found. Your POS count-variance report usually has both. Leave a category blank if it wasn't counted.</div>
      <table class="mini"><thead><tr><th>Category</th><th class="r" style="width:130px">Book ($)</th><th class="r" style="width:130px">Counted ($)</th><th class="r">Difference</th></tr></thead><tbody>
        ${cats.map(c => { const v = (ex && ex.cats && ex.cats[c.code]) || {}; return `<tr><td>${esc(c.name)}<span class="sm" style="display:block;font-family:var(--mono);font-size:11px;color:var(--faint)">${c.code}</span></td>
          <td><input type="number" step="0.01" data-cb="${c.code}" value="${v.book ?? ''}" aria-label="${esc(c.name)} book" ${ro ? 'disabled' : ''}></td><td><input type="number" step="0.01" data-cc="${c.code}" value="${v.counted ?? ''}" aria-label="${esc(c.name)} counted" ${ro ? 'disabled' : ''}></td><td class="r num" data-cd="${c.code}"></td></tr>`; }).join('')}
        <tr class="tot"><td>Total</td><td class="r num" id="ctB"></td><td class="r num" id="ctC"></td><td class="r num" id="ctD"></td></tr></tbody></table>
      <div class="f"><label for="ctNotes">Notes</label><textarea id="ctNotes" ${ro ? 'disabled' : ''} placeholder="Who counted, anything unusual">${esc(ex ? ex.notes : '')}</textarea></div>
      ${ex && !ex.applied && isAdmin && canAct() ? `<div class="warnbox info">Apply to budgets: each category's shortage is added to its budget from ${monthLabel(ex.date.slice(0,7))}, and any overage is taken off, so the plan reflects the stock you actually have. Each one is listed under that category's budget changes.<div style="margin-top:8px"><button class="btn primary sm" type="button" data-applycount="${esc(ex.id)}">Apply to budgets</button></div></div>` : ''}
      ${ex && ex.applied ? '<div class="warnbox good">This count has been applied to the budgets.</div>' : ''}
    </div>
    <footer><div>${ex && !ex.applied && canAct() ? `<button class="btn danger" type="button" data-delcount="${esc(ex.id)}">Delete</button>` : ''}</div><div style="display:flex;gap:8px"><button class="btn" type="button" data-close="1">${ro ? 'Close' : 'Cancel'}</button>${ro ? '' : `<button class="btn primary" type="button" data-savecount="${esc(ex ? ex.id : '')}">Save count</button>`}</div></footer>
  </aside>`;
  countTotalsUI();
}
function countTotalsUI(){
  let B = 0, C = 0;
  $$('[data-cb]').forEach(el => { const k = el.dataset.cb, b = $(`[data-cc="${k}"]`); const bv = el.value === '' ? null : num(el.value), cv = b.value === '' ? null : num(b.value);
    const d = (bv != null && cv != null) ? cv - bv : null; const td = $(`[data-cd="${k}"]`);
    td.textContent = d == null ? '' : money(d); td.className = 'r num' + (d < 0 ? ' neg' : '');
    if (bv != null && cv != null){ B += bv; C += cv; } });
  $('#ctB').textContent = money(B); $('#ctC').textContent = money(C); const D0 = C - B;
  $('#ctD').innerHTML = `${money(D0)}${B ? `<span style="display:block;font-size:11px;color:var(--muted)">${(Math.max(-D0,0) / B * 100).toFixed(2)}% shrink</span>` : ''}`;
  $('#ctD').className = 'r num' + (D0 < 0 ? ' neg' : '');
}
async function saveCount(id){
  const cats = {};
  $$('[data-cb]').forEach(el => { const k = el.dataset.cb, c = $(`[data-cc="${k}"]`); if (el.value !== '' && c.value !== '') cats[k] = {book: r2(num(el.value)), counted: r2(num(c.value))}; });
  if (!Object.keys(cats).length){ toast('Enter book and counted values for at least one category.'); return; }
  const ex = id ? COUNTS.find(c => c.id === id) : null, now = new Date().toISOString();
  const body = {date: $('#ctDate').value || todayISO, label: $('#ctLabel').value.trim() || 'Count', cats, notes: $('#ctNotes').value.trim(), applied: false, by: ex ? ex.by : myId, at: ex ? ex.at : now, updatedAt: now};
  const cid = id || 'c-' + body.date + '-' + uid().slice(0,4);
  if (await write(`counts/${cid}`, body)){ closeOverlay(); toast('Count saved'); }
}
async function applyCount(id){
  const ct = COUNTS.find(c => c.id === id); if (!ct) return;
  const month = WIN().includes(ct.date.slice(0,7)) ? ct.date.slice(0,7) : THIS_MONTH;
  let n = 0;
  for (const [code, v] of Object.entries(ct.cats || {})){
    if (!inOTB(code)) continue; const amt = r2(num(v.book) - num(v.counted)); if (Math.abs(amt) < 1) continue;
    if (!(await saveAdj(code, amt, month, `${ct.label || 'Count'} ${dateLabel(ct.date)}: ${amt > 0 ? 'shortage replaced' : 'overage removed'}`))) return; n++;
  }
  const body = {...ct, applied: true, appliedBy: myId, appliedAt: new Date().toISOString()}; delete body.id;
  if (await write(`counts/${id}`, body)){ closeOverlay(); toast(`Applied to ${n} categor${n === 1 ? 'y' : 'ies'}`); }
}
