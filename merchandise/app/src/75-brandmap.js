
/* ---------- brand assignments ----------
   Brands come from SKU descriptions (pipeline/brands.py). Here anyone who can log orders can give a SKU its
   brand, or split one that carries several brands by percentage. Saved in brandmap/current
   ({sku: [{b: brand, s: percent}]}); the scorecard and delivery matching use it from the next month-end upload.
   The SKU list (brandskus/current: [sku, desc, cat, brand from description, 12-month sales, on hand]) comes with each upload. */
let BRANDSKUS = null, BRANDMAP = {skus: {}};
const BM = {filter: 'unknown', q: '', edit: null, draft: []};
const bmFor = sku => (BRANDMAP.skus || {})[sku] || null;
const bmBrands = () => [...new Set([...(BRANDS ? BRANDS.rows.map(r => r.brand) : []), ...Object.values(BRANDMAP.skus || {}).flat().map(x => x.b),
  ...((BRANDSKUS && BRANDSKUS.rows) || []).map(r => r[3]).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
function bmLabel(row){
  const m = bmFor(row[0]);
  if (m) return m.map(x => m.length > 1 ? `${esc(x.b)} ${num(x.s)}%` : esc(x.b)).join(' · ');
  return row[3] ? `${esc(row[3])} <span style="color:var(--faint);font-size:11.5px">from the description</span>` : '<span class="neg">Unknown brand</span>';
}
function openBrandMap(){
  if (!BRANDSKUS){ $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div><aside class="drawer" role="dialog" aria-modal="true"><header><div><h2>Assign brands</h2></div><button class="x" type="button" data-close="1" aria-label="Close">×</button></header><div class="body"><div class="note">The SKU list arrives with the next month-end upload.</div></div></aside>`; return; }
  const ro = !canAct(), all = BRANDSKUS.rows, q = BM.q.trim().toLowerCase();
  const unknown = all.filter(r => !r[3] && !bmFor(r[0])), mine = all.filter(r => bmFor(r[0]));
  let list = BM.filter === 'unknown' ? unknown : BM.filter === 'mine' ? mine : all;
  if (q) list = all.filter(r => r[0].toLowerCase().includes(q) || String(r[1]).toLowerCase().includes(q) || String(r[3]).toLowerCase().includes(q)
    || (bmFor(r[0]) || []).some(x => x.b.toLowerCase().includes(q)));
  list = list.slice().sort((a, b) => (b[4] + b[5]) - (a[4] + a[5]));
  const shown = list.slice(0, 150), ed = BM.edit && all.find(r => r[0] === BM.edit);
  const seg = (k, l, n) => `<button type="button" class="fchip" data-bmfilt="${k}" aria-pressed="${BM.filter === k && !q}">${l}<span class="c">${n}</span></button>`;
  const tot = BM.draft.reduce((a, x) => a + num(x.s), 0);
  $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="bmTitle">
    <header><div><div class="lab">${unknown.length} SKU${unknown.length === 1 ? '' : 's'} with no brand · ${money(sum(unknown, r => r[4]))} of 12-month sales</div><h2 id="bmTitle">Assign brands</h2>
      <div style="font-size:12.5px;color:var(--muted);margin-top:4px">Give a SKU its brand, or split one that carries several brands. The brand scorecard and delivery matching use this from the next month-end upload.</div></div>
      <button class="x" type="button" data-close="1" aria-label="Close">×</button></header>
    <div class="body">
      ${ed ? `<div class="inline-add"><div class="lab">SKU ${esc(ed[0])} · ${esc(ed[1])}</div>
        <datalist id="bmList">${bmBrands().map(b => `<option value="${esc(b)}">`).join('')}</datalist>
        ${BM.draft.map((x, i) => `<div class="row2" style="align-items:end"><div class="f"><label for="bmB${i}">Brand</label><input id="bmB${i}" list="bmList" data-bmb="${i}" value="${esc(x.b)}" placeholder="Type or pick a brand"></div>
          <div class="f" style="max-width:130px"><label for="bmS${i}">Share %</label><input id="bmS${i}" type="number" min="0" max="100" step="1" data-bms="${i}" value="${esc(x.s)}" ${BM.draft.length === 1 ? 'disabled' : ''}></div>
          ${BM.draft.length > 1 ? `<button class="btn sm ghost" type="button" data-bmdrop="${i}" aria-label="Remove this brand">Remove</button>` : ''}</div>`).join('')}
        <div class="hint" id="bmTot" style="margin:4px 0 10px">${BM.draft.length > 1 ? `Shares add up to ${tot}%${tot === 100 ? '' : ' (they need to make 100%)'}. Sales, stock and deliveries are split the same way.` : 'Add another brand if this SKU carries more than one.'}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary sm" type="button" data-bmsave="1">Save</button><button class="btn sm" type="button" data-bmadd="1">+ Another brand</button>
          ${bmFor(ed[0]) ? `<button class="btn sm" type="button" data-bmclear="1">${ed[3] ? `Use the description (${esc(ed[3])})` : 'Remove the assignment'}</button>` : ''}<button class="btn sm ghost" type="button" data-bmcancel="1">Cancel</button></div></div>` : ''}
      <div class="chips" style="margin-bottom:10px">${seg('unknown', 'Unknown brand', unknown.length)}${seg('mine', 'Assigned here', mine.length)}${seg('all', 'All SKUs', all.length)}
        <input id="bmQ" type="search" placeholder="Find a SKU, description or brand" value="${esc(BM.q)}" style="margin-left:auto;padding:5px 10px;border:1px solid var(--rule2);border-radius:4px;background:var(--card);min-width:210px"></div>
      ${shown.length ? `<div style="overflow-x:auto"><table class="mini"><thead><tr><th>SKU</th><th>Description</th><th class="r">12-mo sales</th><th class="r">On hand</th><th>Brand</th><th></th></tr></thead><tbody>
        ${shown.map(r => `<tr${BM.edit === r[0] ? ' style="background:var(--hover)"' : ''}><td class="num">${esc(r[0])}</td><td>${esc(r[1])}<br><span style="color:var(--muted);font-size:11.5px">${esc(CAT(r[2]).name)}</span></td>
          <td class="r num">${money(r[4])}</td><td class="r num">${money(r[5])}</td><td>${bmLabel(r)}</td>
          <td>${ro ? '' : `<button class="btn sm" type="button" data-bmedit="${esc(r[0])}">${bmFor(r[0]) || !r[3] ? 'Edit' : 'Change'}</button>`}</td></tr>`).join('')}</tbody></table></div>
        ${list.length > shown.length ? `<div class="note">Showing the ${shown.length} biggest of ${list.length}. Search to find others.</div>` : ''}` : `<div class="note">${q ? 'No SKUs match.' : BM.filter === 'unknown' ? 'Every SKU has a brand.' : 'Nothing assigned here yet.'}</div>`}
    </div></aside>`;
}
function bmStartEdit(sku){
  const row = BRANDSKUS.rows.find(r => r[0] === sku), m = bmFor(sku);
  BM.edit = sku; BM.draft = m ? m.map(x => ({b: x.b, s: num(x.s)})) : [{b: row && row[3] || '', s: 100}];
  openBrandMap(); setTimeout(() => $('#bmB0')?.focus(), 0);
}
async function bmSave(clear){
  const sku = BM.edit; if (!sku) return;
  const names = bmBrands(), canon = b => names.find(n => n.toLowerCase() === b.toLowerCase()) || b;  // "prg" -> "PRG"
  const rows = BM.draft.map(x => ({b: canon(String(x.b).trim()), s: Math.round(num(x.s))})).filter(x => x.b && (BM.draft.length === 1 || x.s > 0));
  if (!clear){
    if (!rows.length){ toast('Enter a brand.'); return; }
    if (new Set(rows.map(x => x.b.toLowerCase())).size < rows.length){ toast('Each brand once, please.'); return; }
    if (rows.length > 1 && rows.reduce((a, x) => a + x.s, 0) !== 100){ toast('The shares need to add up to 100%.'); return; }
    if (rows.length === 1) rows[0].s = 100;
  }
  const skus = {...(BRANDMAP.skus || {})};
  if (clear) delete skus[sku]; else skus[sku] = rows;
  if (await write('brandmap/current', {skus, updatedBy: myId, updatedAt: new Date().toISOString()})){
    BRANDMAP = {...BRANDMAP, skus}; BM.edit = null; BM.draft = [];
    toast(clear ? `SKU ${sku} goes back to its description` : `SKU ${sku}: ${rows.map(x => rows.length > 1 ? `${x.b} ${x.s}%` : x.b).join(', ')}`);
    openBrandMap();
  }
}
