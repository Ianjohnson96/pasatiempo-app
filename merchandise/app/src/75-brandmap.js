
/* ---------- brand assignments ----------
   Brands come from SKU descriptions (pipeline/brands.py). Here anyone who can log orders can give a SKU its
   brand, or split one that carries several brands by percentage. Saved in brandmap/current
   ({sku: [{b: brand, s: percent}]}); the scorecard and delivery matching use it from the next month-end upload.
   The SKU list (brandskus/current: [sku, desc, cat, brand from description, 12-month sales, on hand]) comes with each upload.
   The same document holds the owner's brand list edits (Edit brands, below): "words" ({brand: [word or phrase]}), checked
   before the built-in list, and "rename" ({old: new}; renaming into an existing brand merges the two). */
let BRANDSKUS = null, BRANDMAP = {skus: {}};
const BM = {filter: 'unknown', q: '', edit: null, draft: []};
const bmFor = sku => (BRANDMAP.skus || {})[sku] || null;
const bmRen = b => { const r = BRANDMAP.rename || {}; for (let i = 0; i < 10 && typeof r[b] === 'string' && r[b] && r[b] !== b; i++) b = r[b]; return b; };
// whole words, like pipeline/brands.py
const bmWordRx = w => new RegExp('(^|[^a-z0-9])' + w.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-z0-9])');
function bmWordBrand(desc){
  const d = String(desc || '').toLowerCase();
  for (const [b, ws] of Object.entries(BRANDMAP.words || {})) if ((ws || []).some(w => typeof w === 'string' && w.trim() && bmWordRx(w).test(d))) return bmRen(b);
  return null;
}
/* a SKU row's brands as the next upload will count them, [{b, s, how}], or null when it has none */
function bmEff(row){
  const m = bmFor(row[0]);
  if (m) return m.map(x => ({b: bmRen(x.b), s: num(x.s), how: 'set'}));
  const w = bmWordBrand(row[1]); if (w) return [{b: w, s: 100, how: 'words'}];
  return row[3] ? [{b: bmRen(row[3]), s: 100, how: 'desc'}] : null;
}
const bmUnknown = () => ((BRANDSKUS && BRANDSKUS.rows) || []).filter(r => !bmEff(r));
const bmBrands = () => [...new Set([...(BRANDS ? BRANDS.rows.map(r => r.brand) : []), ...Object.values(BRANDMAP.skus || {}).flat().map(x => x.b),
  ...((BRANDSKUS && BRANDSKUS.rows) || []).map(r => r[3]).filter(Boolean), ...Object.keys(BRANDMAP.words || {})].map(bmRen))].sort((a, b) => a.localeCompare(b));
function bmLabel(row){
  const m = bmEff(row);
  if (!m) return '<span class="neg">Unknown brand</span>';
  if (m[0].how === 'set') return m.map(x => m.length > 1 ? `${esc(x.b)} ${num(x.s)}%` : esc(x.b)).join(' · ');
  return `${esc(m[0].b)} <span style="color:var(--faint);font-size:11.5px">${m[0].how === 'words' ? 'from brand words' : 'from the description'}</span>`;
}
function openBrandMap(){
  if (!BRANDSKUS){ $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div><aside class="drawer" role="dialog" aria-modal="true"><header><div><h2>Assign brands</h2></div><button class="x" type="button" data-close="1" aria-label="Close">×</button></header><div class="body"><div class="note">The SKU list arrives with the next month-end upload.</div></div></aside>`; return; }
  const ro = !canAct(), all = BRANDSKUS.rows, q = BM.q.trim().toLowerCase();
  const unknown = bmUnknown(), mine = all.filter(r => bmFor(r[0]));
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
          ${bmFor(ed[0]) ? `<button class="btn sm" type="button" data-bmclear="1">${bmWordBrand(ed[1]) || ed[3] ? `Use ${esc(bmWordBrand(ed[1]) || bmRen(ed[3]))} from the description` : 'Remove the assignment'}</button>` : ''}<button class="btn sm ghost" type="button" data-bmcancel="1">Cancel</button></div></div>` : ''}
      <div class="chips" style="margin-bottom:10px">${seg('unknown', 'Unknown brand', unknown.length)}${seg('mine', 'Assigned here', mine.length)}${seg('all', 'All SKUs', all.length)}
        <input id="bmQ" type="search" placeholder="Find a SKU, description or brand" value="${esc(BM.q)}" style="margin-left:auto;padding:5px 10px;border:1px solid var(--rule2);border-radius:4px;background:var(--card);min-width:210px"></div>
      ${shown.length ? `<div style="overflow-x:auto"><table class="mini"><thead><tr><th>SKU</th><th>Description</th><th class="r">12-mo sales</th><th class="r">On hand</th><th>Brand</th><th></th></tr></thead><tbody>
        ${shown.map(r => `<tr${BM.edit === r[0] ? ' style="background:var(--hover)"' : ''}><td class="num">${esc(r[0])}</td><td>${esc(r[1])}<br><span style="color:var(--muted);font-size:11.5px">${esc(CAT(r[2]).name)}</span></td>
          <td class="r num">${money(r[4])}</td><td class="r num">${money(r[5])}</td><td>${bmLabel(r)}</td>
          <td>${ro ? '' : `<button class="btn sm" type="button" data-bmedit="${esc(r[0])}">${bmFor(r[0]) || !bmEff(r) ? 'Edit' : 'Change'}</button>`}</td></tr>`).join('')}</tbody></table></div>
        ${list.length > shown.length ? `<div class="note">Showing the ${shown.length} biggest of ${list.length}. Search to find others.</div>` : ''}` : `<div class="note">${q ? 'No SKUs match.' : BM.filter === 'unknown' ? 'Every SKU has a brand.' : 'Nothing assigned here yet.'}</div>`}
    </div></aside>`;
}
function bmStartEdit(sku){
  const row = BRANDSKUS.rows.find(r => r[0] === sku), m = bmFor(sku);
  const e = row && bmEff(row);
  BM.edit = sku; BM.draft = m ? m.map(x => ({b: bmRen(x.b), s: num(x.s)})) : [{b: e ? e[0].b : '', s: 100}];
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
  if (await write('brandmap/current', {...BRANDMAP, skus, updatedBy: myId, updatedAt: new Date().toISOString()})){
    BRANDMAP = {...BRANDMAP, skus}; BM.edit = null; BM.draft = [];
    toast(clear ? `SKU ${sku} goes back to its description` : `SKU ${sku}: ${rows.map(x => rows.length > 1 ? `${x.b} ${x.s}%` : x.b).join(', ')}`);
    openBrandMap();
  }
}

/* ---------- edit brands (owner) ----------
   Rename a brand, merge one into another, or add a brand and the words that find it in item descriptions.
   Saved in brandmap/current; this page shows the change at once, the scorecard and delivery matching from the next upload. */
const BE = {edit: null, name: '', words: '', q: ''};  // edit: the brand being edited, '' for a new one, null for the list
const beCanEdit = () => isAdmin && canAct();
const beWordsOf = b => Object.entries(BRANDMAP.words || {}).filter(([k]) => bmRen(k) === b).flatMap(([, ws]) => ws || []);
const bcId = (seg, b) => (seg + '-' + b).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function beStats(){
  const out = {};
  for (const b of bmBrands()) out[b] = {skus: 0, t12: 0};
  for (const r of (BRANDSKUS && BRANDSKUS.rows) || []) for (const x of bmEff(r) || []){
    const o = out[x.b] = out[x.b] || {skus: 0, t12: 0};
    o.skus++; o.t12 += num(r[4]) * num(x.s) / 100;
  }
  return out;
}
function bePreview(){
  const ws = BE.words.split(',').map(w => w.trim()).filter(Boolean);
  if (!ws.length || !BRANDSKUS) return '';
  const hit = BRANDSKUS.rows.filter(r => !bmFor(r[0]) && ws.some(w => bmWordRx(w).test(String(r[1]).toLowerCase())));
  const fresh = hit.filter(r => !bmEff(r));
  return hit.length ? `These words find <b>${hit.length}</b> SKU${hit.length === 1 ? '' : 's'} (${money(sum(hit, r => r[4]))} of 12-month sales)${fresh.length ? `, <b>${fresh.length}</b> of them with no brand now` : ''}: ${hit.slice(0, 4).map(r => esc(r[1])).join(' · ')}${hit.length > 4 ? ' …' : ''}`
    : 'These words don\'t find any SKU yet.';
}
function beNameHint(){
  const n = BE.name.trim(), other = n && bmBrands().find(b => b.toLowerCase() === n.toLowerCase() && b !== BE.edit);
  return other && BE.edit ? `<b>${esc(other)}</b> is already a brand: saving merges ${esc(BE.edit)} into it.` : other ? `<b>${esc(other)}</b> is already a brand: saving adds these words to it.` : '';
}
function openBrandList(){
  const st = beStats(), q = BE.q.trim().toLowerCase(), ren = Object.entries(BRANDMAP.rename || {}).filter(([a, b]) => b && a !== b);
  const list = Object.entries(st).filter(([b]) => !q || b.toLowerCase().includes(q) || beWordsOf(b).some(w => w.includes(q))).sort((a, b) => b[1].t12 - a[1].t12);
  const ed = BE.edit !== null, ok = beCanEdit();
  $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="beTitle">
    <header><div><div class="lab">${list.length} brand${list.length === 1 ? '' : 's'} · ${bmUnknown().length} SKUs with no brand</div><h2 id="beTitle">Edit brands</h2>
      <div style="font-size:12.5px;color:var(--muted);margin-top:4px">Rename a brand, merge two into one, or add a brand with the words that find it in item descriptions. Names and words show here at once; the brand scorecard and delivery matching use them from the next month-end upload.</div></div>
      <button class="x" type="button" data-close="1" aria-label="Close">×</button></header>
    <div class="body">
      ${ed ? `<div class="inline-add"><div class="lab">${BE.edit ? `Editing ${esc(BE.edit)}` : 'New brand'}</div>
        <datalist id="beList">${bmBrands().map(b => `<option value="${esc(b)}">`).join('')}</datalist>
        <div class="f"><label for="beName">Brand name</label><input id="beName" list="beList" value="${esc(BE.name)}" placeholder="e.g. Cutter & Buck"><div class="hint" id="beNameHint">${beNameHint()}</div></div>
        <div class="f"><label for="beWords">Words that find it in item descriptions</label><input id="beWords" value="${esc(BE.words)}" placeholder="e.g. cutter, c&b"><div class="hint">Separate with commas. Whole words only; capitals don't matter. These are checked before the program's own list, so they can also correct it.</div></div>
        <div class="hint" id="bePrev" style="font-size:12.5px;color:var(--muted)">${bePreview()}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary sm" type="button" data-besave="1">Save</button><button class="btn sm ghost" type="button" data-becancel="1">Cancel</button></div></div>`
      : ok ? `<div><button class="btn sm primary" type="button" data-benew="1">+ New brand</button></div>` : `<div class="note">Only the owner can change the brand list.</div>`}
      ${ren.length ? `<div><div class="sec" style="margin-top:0">Renamed and merged</div><table class="mini"><tbody>${ren.map(([a, b]) => `<tr><td>${esc(a)}</td><td>→ <b>${esc(bmRen(b))}</b></td><td class="r">${ok ? `<button class="btn sm ghost" type="button" data-beundo="${esc(a)}">Undo</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <input id="beQ" type="search" placeholder="Find a brand or word" value="${esc(BE.q)}" style="padding:5px 10px;border:1px solid var(--rule2);border-radius:4px;background:var(--card)">
      <div style="overflow-x:auto"><table class="mini"><thead><tr><th>Brand</th><th class="r">SKUs</th><th class="r">12-mo sales</th><th>Words added here</th><th></th></tr></thead><tbody>
        ${list.map(([b, o]) => `<tr${BE.edit === b ? ' style="background:var(--hover)"' : ''}><td><b>${esc(b)}</b></td><td class="r num">${o.skus}</td><td class="r num">${money(o.t12)}</td>
          <td style="font-size:12px;color:var(--muted)">${beWordsOf(b).map(esc).join(', ') || '—'}</td><td>${ok ? `<button class="btn sm" type="button" data-beedit="${esc(b)}">Edit</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" style="color:var(--muted)">No brands match.</td></tr>'}</tbody></table></div>
      <div class="note">To change the brand of one SKU, or split a SKU between brands, use <b>Assign brands</b>.</div>
    </div></aside>`;
}
function beStart(b){
  BE.edit = b; BE.name = b; BE.words = b ? beWordsOf(b).join(', ') : '';
  openBrandList(); setTimeout(() => $('#beName')?.focus(), 0);
}
async function beSave(){
  const old = BE.edit, raw = BE.name.trim().replace(/\s+/g, ' ');
  if (!raw){ toast('Enter a brand name.'); return; }
  const name = bmBrands().find(b => b.toLowerCase() === raw.toLowerCase() && b !== old) || raw;
  const words = [...new Set(BE.words.split(',').map(w => w.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean))];
  const W = {}, R = {...(BRANDMAP.rename || {})}, moved = [];
  if (old && old !== name){
    for (const k of Object.keys(R)) if (R[k] === old) R[k] = name;
    R[old] = name; delete R[name];
  }
  // words: those of the edited brand are replaced by the form's; a word belongs to one brand only
  for (const [k, ws] of Object.entries(BRANDMAP.words || {})){
    const b = bmRen(k); if (b === old || b === name && !old) continue;
    const keep = (ws || []).filter(w => { if (!words.includes(w)) return true; if (b !== name) moved.push(`"${w}" from ${b}`); return false; });
    const key = b === name ? name : k;
    if (keep.length) W[key] = [...new Set([...(W[key] || []), ...keep])];
  }
  const prev = old ? [] : beWordsOf(name);
  if (words.length || prev.length) W[name] = [...new Set([...(W[name] || []), ...prev.filter(w => !words.includes(w)), ...words])];
  if (!W[name] || !W[name].length) delete W[name];
  if (!old && !words.length){ toast('Add the words that find this brand in item descriptions.'); return; }
  const now = new Date().toISOString();
  if (!(await write('brandmap/current', {...BRANDMAP, words: W, rename: R, updatedBy: myId, updatedAt: now}))) return;
  // an owner's call on the old name carries to the new one
  if (old && old !== name && BRANDS) for (const r of BRANDS.rows.filter(x => bmRen(x.brand) === old)){
    const to = bcId(r.seg, name);
    if (BCALLS[r.id] && !BCALLS[to]){ const {id, ...c} = BCALLS[r.id]; await write('brandCalls/' + to, {...c, by: myId, at: now}); }
  }
  BRANDMAP = {...BRANDMAP, words: W, rename: R};
  toast(old && old !== name ? `${old} is now ${name}` + (moved.length ? `; moved ${moved.join(', ')}` : '') : `${name} saved` + (moved.length ? `; moved ${moved.join(', ')}` : ''));
  BE.edit = null; openBrandList(); if (TAB === 'brands') render();
}
async function beUndo(a){
  const R = {...(BRANDMAP.rename || {})}; delete R[a];
  if (await write('brandmap/current', {...BRANDMAP, rename: R, updatedBy: myId, updatedAt: new Date().toISOString()})){
    BRANDMAP = {...BRANDMAP, rename: R}; toast(`${a} is its own brand again`); openBrandList(); if (TAB === 'brands') render();
  }
}
