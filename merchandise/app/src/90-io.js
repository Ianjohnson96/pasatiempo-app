/* ---------- paste import ---------- */
function parseDelimited(text){
  const delim = text.includes('\t') ? '\t' : ','; const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++){ const ch = text[i];
    if (q){ if (ch === '"'){ if (text[i+1] === '"'){ cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true; else if (ch === delim){ row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r'){ if (ch === '\r' && text[i+1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch; }
  if (cell || row.length){ row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => c.trim())).filter(r => r.some(c => c));
}
const MON_IDX = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function parseMonth(s){ s = (s || '').trim().toLowerCase(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/))) return m[1] + '-' + pad(+m[2]);
  if ((m = s.match(/^(\d{1,2})\/(?:\d{1,2}\/)?(\d{2,4})$/))) return (m[2].length === 2 ? '20' + m[2] : m[2]) + '-' + pad(+m[1]);
  if ((m = s.match(/^([a-z]{3,9})[\s\-.,']*(\d{1,2},?\s*)?(\d{2,4})$/))){ const mo = MON_IDX[m[1].slice(0,3)]; if (mo) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + pad(mo); }
  return ''; }
function parseDate(s){ s = (s || '').trim(); let m; if (!s) return '';
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + pad(+m[1]) + '-' + pad(+m[2]);
  if ((m = s.toLowerCase().match(/^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})$/))){ const mo = MON_IDX[m[1].slice(0,3)]; if (mo) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + pad(mo) + '-' + pad(+m[2]); }
  return null; }
function matchCat(s){ s = (s || '').trim().toLowerCase(); if (!s) return '';
  const code = s.match(/^\d{3}/); if (code && PLAN.cats[code[0]]) return code[0];
  const ex = catList().find(c => c.name.toLowerCase() === s); if (ex) return ex.code;
  const hits = catList().filter(c => c.name.toLowerCase().includes(s) || s.includes(c.name.toLowerCase())); return hits.length === 1 ? hits[0].code : ''; }
function parseStatus(s){ s = (s || '').trim().toLowerCase(); if (!s || /open|on order|ordered|pending/.test(s)) return 'open'; if (/part/.test(s)) return 'partial'; if (/rec|complete|closed/.test(s)) return 'received'; if (/cancel|void/.test(s)) return 'cancelled'; return null; }
let IMP = [];
function openImport(){
  $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="iTitle">
    <header><div><div class="lab">Load existing orders</div><h2 id="iTitle" style="margin:0;font-size:19px">Paste from a spreadsheet</h2></div><button class="x" type="button" data-close="1" aria-label="Close">×</button></header>
    <div class="body"><p style="margin:0 0 10px;color:var(--muted)">Copy rows from Excel and paste below — one order per row, columns in this order:</p>
      <p style="margin:0 0 12px"><code class="k">PO #</code> <code class="k">Vendor</code> <code class="k">Category</code> <code class="k">Cost</code> <code class="k">Delivery month</code> <code class="k">Cancel date</code> <code class="k">Status</code> <span style="color:var(--faint);font-size:12px">Status is optional (blank = Open). Category can be the name or 3-digit code. New vendors are added to the list for you. Add the line items and sizes afterwards by opening each order.</span></p>
      <label for="iText" class="sr">Pasted rows</label><textarea id="iText" placeholder="10452&#9;Peter Millar&#9;Fancy Shirts&#9;4850&#9;Nov 2026&#9;11/15/2026"></textarea>
      <div style="margin-top:10px"><button class="btn" type="button" id="iPrev">Check rows</button></div><div id="iOut"></div></div>
    <footer><button class="btn" type="button" data-close="1">Cancel</button><button class="btn primary" type="button" id="iGo" disabled>Import orders</button></footer></div>`;
  $('#iText').focus();
}
function previewImport(){
  const rows = parseDelimited($('#iText').value);
  if (rows.length && !(num(String(rows[0][3] || '').replace(/[$,\s]/g, '')) > 0)) rows.shift();
  const seen = new Set(POS.map(p => p.poNumber));
  IMP = rows.map(r => { const o = {poNumber:(r[0] || '').trim(), vendor:(r[1] || '').trim(), cat:matchCat(r[2]), cost:r2(num(String(r[3] || '').replace(/[$,\s]/g, ''))), deliveryMonth:parseMonth(r[4]), cancelDate:parseDate(r[5]), status:parseStatus(r[6]), raw:r};
    const e = []; if (!o.poNumber) e.push('PO #'); if (!o.vendor) e.push('vendor'); if (!o.cat) e.push(`category "${r[2] || ''}"`); if (!(o.cost > 0)) e.push('cost'); if (!o.deliveryMonth) e.push(`delivery "${r[4] || ''}"`); if (o.cancelDate === null) e.push(`cancel date "${r[5] || ''}"`); if (o.status === null) e.push(`status "${r[6] || ''}"`);
    o.errs = e; o.dup = seen.has(o.poNumber); o.newVendor = o.vendor && !VENDORS.some(v => v.name.toLowerCase() === o.vendor.toLowerCase()); return o; });
  const good = IMP.filter(o => !o.errs.length), n = good.filter(o => !o.dup).length, nv = new Set(good.filter(o => o.newVendor).map(o => o.vendor.toLowerCase())).size;
  $('#iOut').innerHTML = !IMP.length ? '<p style="color:var(--muted);margin-top:12px">Nothing to import yet — paste some rows first.</p>' :
    `<p style="margin:12px 0 0;font-size:13px"><b>${n}</b> ready${IMP.length - good.length ? `, <b class="neg">${IMP.length - good.length}</b> need fixing first` : ''}${good.some(o => o.dup) ? `, ${good.filter(o => o.dup).length} already in the book (skipped)` : ''}${nv ? `, ${nv} new vendor${nv === 1 ? '' : 's'} will be added` : ''}.</p>
    <div class="prev"><table><thead><tr><th>PO #</th><th>Vendor</th><th>Category</th><th class="r">Cost</th><th>Delivery</th><th>Cancel by</th><th>Status</th><th>Check</th></tr></thead><tbody>${IMP.map(o => `<tr class="${o.errs.length ? 'bad' : ''}"><td>${esc(o.poNumber)}</td><td>${esc(o.vendor)}${o.newVendor ? ' <span class="chip buy">new</span>' : ''}</td><td>${esc(CAT(o.cat).name || o.raw[2] || '')}</td><td class="r num">${o.cost ? money(o.cost) : esc(o.raw[3] || '')}</td><td>${o.deliveryMonth ? monthLabel(o.deliveryMonth) : esc(o.raw[4] || '')}</td><td>${o.cancelDate ? dateLabel(o.cancelDate) : esc(o.raw[5] || '—')}</td><td>${o.status ? STATUS[o.status] : esc(o.raw[6])}</td><td>${o.errs.length ? 'Fix: ' + esc(o.errs.join(', ')) : o.dup ? 'Skip — already in' : 'Ready'}</td></tr>`).join('')}</tbody></table></div>`;
  $('#iGo').disabled = !n; $('#iGo').textContent = n ? `Import ${n} order${n === 1 ? '' : 's'}` : 'Import orders';
}
async function runImport(){
  const todo = IMP.filter(o => !o.errs.length && !o.dup); $('#iGo').disabled = true; let done = 0; const now = new Date().toISOString();
  for (const o of todo){
    let v = VENDORS.find(x => x.name.toLowerCase() === o.vendor.toLowerCase());
    if (!v){ const id = 'v-' + slug(o.vendor) + '-' + uid().slice(0,4); const body = {name:o.vendor, rep:'', phone:'', email:'', account:'', terms:'', notes:'', leadWeeks:null, active:true, createdBy:myId, createdAt:now};
      if (!(await write(`vendors/${id}`, body))) break; v = {id, ...body}; VENDORS.push(v); }
    const body = {poNumber:o.poNumber, vendorId:v.id, vendorName:v.name, cat:o.cat, orderDate:'', deliveryMonth:o.deliveryMonth, cancelDate:o.cancelDate || '', cost:o.cost, units:0, lines:[], status:o.status,
      received:o.status === 'received' ? o.cost : 0, receivedDate:o.status === 'received' ? todayISO : '', notes:'Imported from spreadsheet', createdBy:myId, createdAt:now, updatedBy:myId, updatedAt:now};
    if (!(await write(`pos/${db.collection('pos').doc().id}`, body))) break;
    done++; $('#iGo').textContent = `Importing ${done} of ${todo.length}…`;
  }
  closeOverlay(); toast(done === todo.length ? `Imported ${done} order${done === 1 ? '' : 's'}` : `Imported ${done} of ${todo.length}; the rest didn't save`);
}

/* ---------- export ---------- */
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
async function download(name, rows){
  const dl = window.claude?.use ? await window.claude.use('downloads') : null;
  if (!dl){ toast('Downloads aren\'t available in this view.'); return; }
  try { await dl.save({filename: name, data: rows.map(r => r.map(csvCell).join(',')).join('\r\n')}); }
  catch (e){ if (e && e.code !== 'declined') toast(e.code === 'rate_limited' ? 'A download is already waiting for your OK.' : 'Downloads aren\'t available in this view.'); }
}
function exportOrders(){
  const rows = [['PO #','Vendor','Main category code','Main category','Order date','Delivery month','Cancel by','Units','Cost','Received','Still to come','Status','Received date','Notes']]
    .concat([...POS].sort((a,b) => String(a.deliveryMonth).localeCompare(String(b.deliveryMonth))).map(p => [p.poNumber, vendorName(p), p.cat, CAT(p.cat).name, p.orderDate, p.deliveryMonth, p.cancelDate, poUnits(p), poTotal(p).toFixed(2), num(p.received).toFixed(2), onOrder(p).toFixed(2), STATUS[p.status], p.receivedDate, p.notes]));
  download(`pasatiempo-orders-${todayISO}.csv`, rows);
}
function exportLines(){
  const rows = [['PO #','Vendor','Delivery month','Status','Category code','Category','Subcategory','Style','Color','Size run','Size','Quantity','Unit cost','Extended cost']];
  for (const p of POS) for (const l of (p.lines || [])){
    const base = [p.poNumber, vendorName(p), p.deliveryMonth, STATUS[p.status], l.cat, CAT(l.cat).name, subName(l.sub), l.style, l.color, (RUNS[l.run] || {}).label || l.run];
    if (!l.run || l.run === 'none') rows.push([...base, '', num(l.units), num(l.cost).toFixed(2), lineExt(l).toFixed(2)]);
    else for (const [k,q] of Object.entries(l.qty || {})) if (num(q)) rows.push([...base, k.replace('|', ' '), num(q), num(l.cost).toFixed(2), r2(num(q) * num(l.cost)).toFixed(2)]);
  }
  if (rows.length === 1){ toast('No line items yet — add lines to your orders first.'); return; }
  download(`pasatiempo-order-lines-${todayISO}.csv`, rows);
}

/* ---------- writes, people, toast ---------- */
async function write(path, body){
  try { await db.doc(path).set(JSON.parse(JSON.stringify(body))); return true; } catch (e){ writeError(e); return false; }
}
function writeError(e){
  const c = e && e.code;
  if (c === 'invalid_argument' && canWrite !== true){ readOnly = true; applyMode(); toast('Your access is view-only. Ask the owner to make you a Contributor.'); }
  else if (c === 'invalid_argument') toast('That change isn\'t allowed for your access level. Budget changes are for the owner.');
  else if (c === 'quota_exceeded') toast('The order book is full. Download a CSV, then delete old received or cancelled orders.');
  else if (c === 'revoked'){ readOnly = true; applyMode(); toast('Access to this page changed. Reload to continue.'); }
  else toast('That didn\'t save. Check your connection and try again.');
}
async function fillPeople(){
  if (!userNS) return;
  const cells = $$('.person[data-uid]').filter(el => el.dataset.uid), ids = [...new Set(cells.map(el => el.dataset.uid))];
  if (!ids.length) return;
  const ps = await userNS.profiles(ids);
  for (const el of cells){ const p = ps[el.dataset.uid]; if (!p) continue; el.textContent = '';
    const img = document.createElement('img'); img.src = p.avatarUrl; img.alt = ''; const t = document.createElement('span'); t.textContent = p.isMe ? 'You' : (p.name || 'Someone'); el.append(img, t); }
}
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 4500); }
function closeOverlay(){ $('#overlay').innerHTML = ''; D = null; DX = null; }

/* ---------- render + mode ---------- */
const PAGES = {overview: renderOverview, forecast: renderForecast, otb: renderOTB, orders: renderOrders, brands: renderBrands, attention: renderAttention, inventory: renderInventory, monthend: renderMonthEnd, help: renderHelp};
function render(){
  if (!BASE && !LEGACY_PLAN){
    $('.monthbar').hidden = true; $('#summary').hidden = true; $('#kpis').hidden = true; $('#tabs').innerHTML = '';
    $('#pane').innerHTML = `<section class="panel"><div class="note" style="font-size:14px">${dbState === 'connecting' ? 'Loading the program…' : 'The forecast and budgets appear after the first month-end data is loaded.'}</div></section>`;
    return;
  }
  derive();
  if (!PAGES[TAB]) TAB = 'overview';
  const S = stats(), bar = TAB === 'overview' || TAB === 'orders';
  $('.monthbar').hidden = !bar; $('#summary').hidden = TAB !== 'overview'; $('#kpis').hidden = TAB !== 'overview';
  if (bar) renderMonths();
  if (TAB === 'overview'){ renderSummary(S); renderKpis(S); }
  renderTabs(S);
  const w = $('#wibar'); w.hidden = !WHATIF || TAB === 'forecast';
  if (WHATIF) w.innerHTML = `<span><b>What-if in use.</b> Budgets on every page reflect forecast changes that aren't saved.</span><span style="display:flex;gap:8px"><button class="btn sm" type="button" data-tab="forecast">Review</button><button class="btn sm" type="button" data-fc="discard">Discard</button></span>`;
  const scrollY = window.scrollY;
  PAGES[TAB](S);
  window.scrollTo(0, scrollY);
  if (D && $('#dImpact')) updateTotals();
}
let renderQ = null;
const schedule = () => { if (renderQ) return; renderQ = requestAnimationFrame(() => { renderQ = null; render(); }); };
function applyMode(){
  const live = canAct();
  $('#btnNew').hidden = !live; $('#btnMore').parentElement.hidden = dbState !== 'live';
  const b = $('#banner');
  if (dbState === 'unavailable'){ b.hidden = false; b.textContent = 'Orders can\'t be loaded right now, so you are seeing the plan with nothing committed. Check your connection and reload the page.'; }
  else if (dbState === 'live' && readOnly){ b.hidden = false; b.textContent = 'You can look but not change anything. Ask the owner to make you a Contributor to log orders.'; }
  else if (dbState === 'connecting'){ b.hidden = false; b.textContent = 'Loading orders…'; }
  else b.hidden = true;
  schedule();
}

/* ---------- events ---------- */
document.addEventListener('click', e => { if (!e.target.closest('.menu')) $('#morePop').hidden = true; }, true);
document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-cat],[data-po],[data-count],tr[data-po],tr[data-brand]'); if (!t) return;
  const ds = t.dataset;
  if (ds.close) return closeOverlay();
  if (ds.fy){ FYSEL = ds.fy; SEL = null; try { localStorage.setItem('mp.fy', FYSEL); localStorage.removeItem('ob.month'); } catch (_) {} return render(); }
  if (ds.fc === 'discard'){ WHATIF = null; return render(); }
  if (ds.fc === 'save') return saveAssumptions();
  if (ds.otbv){ OTBV.view = ds.otbv; saveOTBV(); return render(); }
  if (ds.otbm){ OTBV.metric = ds.otbm; saveOTBV(); return render(); }
  if (ds.bseg){ bfilt.seg = ds.bseg; return render(); }
  if (ds.bcall){ bfilt.call = ds.bcall; return render(); }
  if (ds.bsmall){ bfilt.small = !bfilt.small; return render(); }
  if (ds.bsort){ bsort = {key: ds.bsort, dir: bsort.key === ds.bsort ? -bsort.dir : (ds.bsort === 'brand' ? 1 : -1)}; return render(); }
  if (ds.bcsave) return saveBrandCall(ds.bcsave);
  if (ds.bcclear){ try { await db.doc('brandCalls/' + ds.bcclear).delete(); toast('Back to the suggested call'); setTimeout(() => openBrand(ds.bcclear), 300); } catch (err){ writeError(err); } return; }
  if (ds.brand && !D) return openBrand(ds.brand);
  if (ds.month){ SEL = ds.month; try { localStorage.setItem('ob.month', SEL); } catch (_) {} return render(); }
  if (ds.tab){ TAB = ds.tab; try { localStorage.setItem('ob.tab', TAB); } catch (_) {} closeOverlay(); render(); return window.scrollTo({top: $('#tabs').offsetTop - 10}); }
  if (t.id === 'btnMore'){ const p = $('#morePop'); p.hidden = !p.hidden; t.setAttribute('aria-expanded', String(!p.hidden)); return; }
  if (ds.act === 'import'){ $('#morePop').hidden = true; return openImport(); }
  if (ds.act === 'exportOrders'){ $('#morePop').hidden = true; return exportOrders(); }
  if (ds.act === 'exportLines'){ $('#morePop').hidden = true; return exportLines(); }
  if (ds.act === 'new') return openOrder(null);
  if (ds.act === 'count') return openCount(null);
  if (t.id === 'btnNew') return openOrder(null);
  if (t.id === 'btnVendors' || ds.vendors) return openVendors();
  if (ds.vedit) return openVendors(ds.vedit);
  if (ds.vsave) return saveVendor(ds.vsave);
  if (ds.vdel){ if (!confirm('Delete this vendor? It has no orders.')) return; try { await db.doc('vendors/' + ds.vdel).delete(); toast('Vendor deleted'); openVendors(); } catch (err){ writeError(err); } return; }
  if (ds.sort){ sort = {key: ds.sort, dir: sort.key === ds.sort ? -sort.dir : 1}; return render(); }
  if (ds.ofilt){ filt.status = ds.ofilt; return render(); }
  if (ds.akind){ afilt.kind = ds.akind; return render(); }
  if (ds.openpo) return openOrder(ds.openpo);
  if (ds.startorder) return startOrderFromItem(ds.startorder);
  if (ds.neworderCat) return openOrder(null, {cat: ds.neworderCat, lines: [newLine(ds.neworderCat)]});
  if (ds.istate != null && ds.v != null){
    const id = ds.istate;
    if (!ds.v){ try { await db.doc('istate/' + id).delete(); } catch (err){ writeError(err); } return; }
    await write('istate/' + id, {status: ds.v, by: myId, at: new Date().toISOString()}); toast(ds.v === 'done' ? 'Marked done' : 'Dismissed'); return;
  }
  if (ds.applycount) return applyCount(ds.applycount);
  if (ds.delcount){ if (!confirm('Delete this count?')) return; try { await db.doc('counts/' + ds.delcount).delete(); closeOverlay(); toast('Count deleted'); } catch (err){ writeError(err); } return; }
  if (ds.savecount != null) return saveCount(ds.savecount || null);
  if (t.id === 'cAdjBtn') return showAdjForm(CUR_CAT);
  if (t.id === 'aCancel'){ $('#cAdjForm').innerHTML = ''; return; }
  if (ds.saveadj){ const code = ds.saveadj; if (await saveAdj(code, num($('#aAmt').value), $('#aMonth').value, $('#aNote').value.trim())){ toast('Budget changed'); setTimeout(() => openCategory(code), 350); } return; }
  if (ds.deladj){ if (!confirm('Remove this budget change?')) return; try { await db.doc(`plan/${adjKey(PLAN)}/adjustments/` + ds.deladj).delete(); toast('Change removed'); } catch (err){ writeError(err); } return; }
  if (t.id === 'iPrev') return previewImport();
  if (t.id === 'iGo') return runImport();
  if (D){
    if (t.id === 'dSave') return saveOrder();
    if (t.id === 'dDelete') return deleteOrder();
    if (t.id === 'rBtn') return recordReceipt();
    if (t.id === 'nvSave') return addVendorInline();
    if (t.id === 'nvCancel'){ D._addVendor = false; D.vendorId = ''; return renderVendorBox(); }
    if (ds.addline){ D.lines.push(newLine(D.cat || (D.lines[D.lines.length-1] || {}).cat)); renderLines(); updateTotals(); const ls = D.lines[D.lines.length-1]; setTimeout(() => $(`#lc-${ls.id}`)?.focus(), 0); return; }
    if (ds.lact === 'dup'){ const i = D.lines.findIndex(l => l.id === ds.l); const c = JSON.parse(JSON.stringify(D.lines[i])); c.id = uid(); c.color = ''; c.qty = {}; c.units = ''; delete c._addSub; D.lines.splice(i + 1, 0, c); renderLines(); updateTotals(); setTimeout(() => $(`#lco-${c.id}`)?.focus(), 0); return; }
    if (ds.lact === 'remove'){ D.lines = D.lines.filter(l => l.id !== ds.l); renderLines(); updateTotals(); return; }
    if (ds.nsave) return addSubInline(ds.nsave);
    if (ds.ncancel){ const l = D.lines.find(x => x.id === ds.ncancel); l._addSub = false; l.sub = ''; renderLines(); updateTotals(); return; }
  }
  if (ds.count) return openCount(ds.count);
  if (ds.po) return openOrder(ds.po);
  if (ds.cat && !D){ if (TAB === 'otb' && BASE){ const k = OTBV.view === 'next' ? 'next' : 'cur'; if (FYSEL !== k){ FYSEL = k; try { localStorage.setItem('mp.fy', FYSEL); } catch (_) {} render(); } } return openCategory(ds.cat); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){ if ($('#overlay').innerHTML) closeOverlay(); $('#morePop').hidden = true; }
  if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-po],[data-cat][tabindex],tr[data-brand]')){ e.preventDefault(); e.target.click(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'bQ'){ bfilt.q = t.value; clearTimeout(document._bq); document._bq = setTimeout(() => { render(); const f = $('#bQ'); if (f){ f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 250); return; }
  if (t.id === 'fQ'){ filt.q = t.value; clearTimeout(document._q); document._q = setTimeout(() => { render(); const f = $('#fQ'); if (f){ f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 250); return; }
  if (t.dataset.cb != null || t.dataset.cc != null) return countTotalsUI();
  if (!D) return;
  if (t.dataset.d){ D[t.dataset.d] = t.value; return updateTotals(); }
  if (t.dataset.q){ const l = D.lines.find(x => x.id === t.dataset.q); const v = Math.max(0, Math.floor(num(t.value))); if (v) l.qty[t.dataset.k] = v; else delete l.qty[t.dataset.k]; return updateTotals(); }
  if (t.dataset.l && ['style','color','cost','units'].includes(t.dataset.f)){ const l = D.lines.find(x => x.id === t.dataset.l); l[t.dataset.f] = t.value; return updateTotals(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'fCat'){ filt.cat = t.value; return render(); }
  if (t.id === 'fArr'){ filt.arriving = t.checked; return render(); }
  if (t.id === 'aCat'){ afilt.cat = t.value; return render(); }
  if (t.id === 'aRes'){ afilt.showResolved = t.checked; return render(); }
  if (t.id === 'otbCat'){ OTBV.cat = t.value; saveOTBV(); return render(); }
  if (t.dataset.wi){ if (t.value === '' || !isFinite(+t.value)) return render(); const g = t.dataset.wi; setWhatIf(g, t.dataset.k, g === 'wos' ? Math.max(1, Math.min(52, Math.round(+t.value))) : +t.value / 100); return; }
  if (t.dataset.chk){ return toggleCheck(t.dataset.chkm, t.dataset.chk, t.checked); }
  if (!D) return;
  if (t.id === 'dVendor'){ if (t.value === '__new'){ D._addVendor = true; } else { D._addVendor = false; D.vendorId = t.value; } renderVendorBox(); return updateTotals(); }
  if (t.dataset.d){ D[t.dataset.d] = t.value; return updateTotals(); }
  if (t.dataset.l){
    const l = D.lines.find(x => x.id === t.dataset.l), f = t.dataset.f;
    if (f === 'cat'){ l.cat = t.value; l.sub = ''; }
    else if (f === 'sub'){ if (t.value === '__new'){ l._addSub = true; } else { l.sub = t.value; const s = SUBCATS.find(x => x.id === t.value); if (s && !Object.keys(l.qty).length && !num(l.units)) l.run = s.run || 'none'; } }
    else if (f === 'run'){ l.run = t.value; l.qty = {}; }
    else if (f === 'sizesText'){ l.sizes = t.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 30); l.qty = {}; }
    else return;
    renderLines(); updateTotals();
    if (l._addSub) setTimeout(() => $(`#nsn-${l.id}`)?.focus(), 0);
  }
});

/* ---------- start ---------- */
if (window.MERCH_HOST){
  const H = window.MERCH_HOST, pop = $('#morePop');
  pop.insertAdjacentHTML('beforeend', `<hr>${H.me.role === 'owner' ? `<a href="${esc(H.base)}/admin">People &amp; data</a>` : ''}<a href="${esc(H.base)}/account">Change your password</a>
    <form method="post" action="${esc(H.base)}/signout"><button type="submit">Sign out (${esc(H.me.name || H.me.email)})</button></form>`);
}
render(); applyMode();
(async () => {
  const c = window.claude;
  if (!c || !c.use){ dbState = 'unavailable'; applyMode(); return; }
  const [d, u] = await Promise.all([c.use('db'), c.use('user')]);
  userNS = u;
  if (u){ try { canWrite = await u.can('data.write'); isAdmin = await u.canEdit(); myId = await u.id(); } catch (_) {} }
  if (canWrite === false) readOnly = true;
  if (!d){ dbState = 'unavailable'; applyMode(); return; }
  db = d;
  const live = () => { if (dbState !== 'live'){ dbState = 'live'; applyMode(); } else schedule(); };
  const onErr = name => err => { if (err.code === 'revoked'){ readOnly = true; } if (err.code === 'unavailable'){ setTimeout(() => subs[name] && subs[name](), 2000); return; } if (dbState !== 'live'){ dbState = 'unavailable'; } applyMode(); };
  const coll = (path, set, name) => db.collection(path).onSnapshot(s => { set(s.docs.map(x => ({id: x.id, ...x.data()}))); live(); }, onErr(name));
  const subs = {
    pos: () => coll('pos', v => POS = v, 'pos'),
    vendors: () => coll('vendors', v => VENDORS = v, 'vendors'),
    subcats: () => coll('subcats', v => SUBCATS = v, 'subcats'),
    counts: () => coll('counts', v => COUNTS = v, 'counts'),
    istate: () => coll('istate', v => ISTATE = Object.fromEntries(v.map(x => [x.id, x])), 'istate'),
    adj27: () => coll('plan/fy27/adjustments', v => ADJS.fy27 = v, 'adj27'),
    adj28: () => coll('plan/fy28/adjustments', v => ADJS.fy28 = v, 'adj28'),
    assume: () => db.doc('plan/assumptions').onSnapshot(s => { SAVED = s.exists ? s.data() : null; live(); }, onErr('assume')),
    base: () => db.doc('base/current').onSnapshot(s => { if (s.exists) BASE = s.data(); live(); }, onErr('base')),
    brands: () => db.doc('brands/current').onSnapshot(s => { if (s.exists) BRANDS = s.data(); live(); }, onErr('brands')),
    bcalls: () => coll('brandCalls', v => BCALLS = Object.fromEntries(v.map(x => [x.id, x])), 'bcalls'),
    refreshes: () => coll('refreshes', v => REFRESHES = v, 'refreshes'),
    checks: () => coll('checklist', v => CHECKS = Object.fromEntries(v.map(x => [x.id, x])), 'checks'),
    inv: () => db.doc('inventory/current').onSnapshot(s => { if (s.exists) INV = s.data(); live(); }, onErr('inv')),
    ins: () => db.doc('insights/current').onSnapshot(s => { if (s.exists) INS = s.data(); live(); }, onErr('ins'))
  };
  Object.values(subs).forEach(f => f());
})();
