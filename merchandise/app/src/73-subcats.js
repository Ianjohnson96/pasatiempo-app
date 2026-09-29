/* ---------- subcategories ----------
   assort/current (pipeline/model.py build_subcats) is the brand scorecard's measures by category and subcategory,
   rebuilt at every month-end upload and by Update brands / Update subcategories. Special Orders (640) items show in
   the category they sell as, and every special order is flagged: sales count it, the stock measures and the
   budgets don't. From the description (config SUB_RULES, SELLS_AS, SO_*; brandskus rows [6] subcategory, [7] the
   category a 640 item sells as, [8] special-order kind) unless someone set it here (submap/current: skus
   {sku: subcat id}, cat {sku: category}, so {sku: kind or 'shelf'}). Budgets stay by category. */
let ASSORT = null, SUBMAP = {skus: {}};
const SC = {cat: 'all'}, SS = {filter: 'unsorted', cat: 'all', q: '', keep: new Set()};  // keep: SKUs changed in this view stay in it
const SOK = {member: 'Member special order', group: 'Group & event order', notretail: 'Not retail'};
const soTag = k => k && SOK[k] ? ` <span class="sotag" title="${SOK[k]}">${k === 'notretail' ? 'Not retail' : 'Special order'}</span>` : '';
const soLine = r => r.so >= 1 ? `<div style="font-size:11px;color:var(--muted)">${Math.max(1, Math.round(r.so / (r.t12 || r.so) * 100))}% special orders</div>` : '';
function soNote(r){
  if (!(r.so >= 1) && !(r.soOh >= 1)) return '';
  const k = Object.entries(r.soKinds || {}).map(([x, v]) => `${SOK[x] ? SOK[x].replace(' special order', '').replace(' order', '').toLowerCase() : x} ${money(v)}`).join(' · ');
  return `<div class="note" style="padding:0">Includes ${money(r.so || 0)} of special orders${k ? ` (${k})` : ''}${r.soOh >= 1 ? `, and ${money(r.soOh)} of the stock is special orders waiting for their customers` : ''}. Weeks of supply, GMROI and the call count shelf sales and shelf stock only.</div>`;
}
const scSubName = (cat, sub) => sub ? (subName(sub) || sub.replace(/^s-\d+-/, '').replace(/-/g, ' ')) : 'Not sorted';
const ssHas = (m, sku) => Object.prototype.hasOwnProperty.call(m || {}, sku);
const ssSet = sku => ssHas(SUBMAP.skus, sku);
/* the category a SKU sells as: its own, or for a Special Orders item the one set here or from its description ('640' when none yet) */
const ssCat = row => row[2] !== '640' ? row[2] : (ssHas(SUBMAP.cat, row[0]) ? SUBMAP.cat[row[0]] : row[7]) || '640';
const ssSo = row => ssHas(SUBMAP.so, row[0]) ? (SUBMAP.so[row[0]] === 'shelf' ? '' : SUBMAP.so[row[0]]) : (row[8] || '');
const ssSubAuto = row => row[6] && subsFor(ssCat(row)).some(x => x.id === row[6]) ? row[6] : '';
const ssSub = row => ssSet(row[0]) ? SUBMAP.skus[row[0]] : ssSubAuto(row);
const ssRows = () => (BRANDSKUS && BRANDSKUS.rows) || [];
const ssPlace = () => ssRows().filter(r => r[2] === '640' && ssCat(r) === '640' && ssSo(r) !== 'notretail');
const ssUnsorted = () => ssRows().filter(r => ssCat(r) !== '640' && ssSo(r) !== 'notretail' && !ssSub(r));
const subPending = () => !!(ASSORT && SUBMAP.updatedAt && SUBMAP.updatedAt > (ASSORT.at || ''));
const scTrend = r => r.ly >= 10 ? pct(r.ty / r.ly - 1) : (r.ty ? 'new' : '—');

function scByCat(){
  const out = {};
  for (const r of (ASSORT ? ASSORT.rows : [])){
    const o = out[r.cat] = out[r.cat] || {cat: r.cat, rows: [], t12: 0, oh: 0};
    o.rows.push(r); o.t12 += r.t12; o.oh += r.oh;
  }
  return Object.values(out).sort((a, b) => b.t12 - a.t12);
}
function renderSubcats(S){
  if (!ASSORT){ $('#pane').innerHTML = `<section class="panel"><div class="note">The subcategory report appears after the next month-end upload${isAdmin ? ', or press <b>Update brands</b> on the Brands tab' : ''}.</div></section>`; return; }
  const groups = scByCat(), shown = SC.cat === 'all' ? groups : groups.filter(g => g.cat === SC.cat), uns = ssUnsorted().length, place = ssPlace();
  const chip = (k, l, n) => `<button type="button" class="fchip" data-sccat="${k}" aria-pressed="${SC.cat === k}">${l}${n != null ? `<span class="c">${n}</span>` : ''}</button>`;
  const th = (l, r, t) => `<th class="${r ? 'r' : ''}" ${t ? `title="${esc(t)}"` : ''}>${l}</th>`;
  const bySubOrder = (cat, sub) => num((S.bySub[cat + '|' + sub] || {}).dollars);
  const table = g => `<section class="panel" style="margin-top:14px"><header><h2><button type="button" class="linklike" data-cat="${g.cat}">${esc(CAT(g.cat).name)}</button> <span style="color:var(--faint);font-weight:400;font-size:13px">${g.cat}</span></h2>
      <span class="lab">${money(g.t12)} sales · ${money(g.oh)} on hand</span></header>
    <div class="tbl"><table class="brandt" style="min-width:1090px"><thead><tr>${th('Subcategory')}${th('Share of sales', 0, 'This subcategory’s part of the category’s last-12-month sales')}${th('Sales, 12 mo', 1)}${th('Special orders', 1, 'The part of the 12-month sales bought for one member or one group; left out of weeks of supply, GMROI, the call and the budgets')}${th('Trend', 1, 'Units in the last three closed months against the same months a year earlier')}<th><span class="h">24 months</span></th>${th('On hand', 1, 'At cost')}${th('Weeks of supply', 1, 'On hand at the last 12 months’ pace')}${th('Margin', 1)}${th('GMROI', 1, 'Gross margin in 12 months for every $1 of stock at cost')}${th('Aged', 1, 'Share of the stock not sold in 12 months')}${th('Committed ' + PLANS.cur.fy, 1, 'Order Book lines in this subcategory arriving this year')}${th('Call')}</tr></thead>
    <tbody class="click">${g.rows.map(r => { const share = g.t12 ? r.t12 / g.t12 : 0, ord = bySubOrder(r.cat, r.sub);
      return `<tr data-subrow="${esc(r.cat + '|' + r.sub)}" tabindex="0" style="cursor:pointer"><td><b>${esc(scSubName(r.cat, r.sub))}</b><div style="font-size:11.5px;color:var(--faint)">${r.skus} SKU${r.skus === 1 ? '' : 's'}</div></td>
        <td style="min-width:120px"><div class="meter" style="margin:0"><i style="width:${Math.round(share * 100)}%;background:var(--cypress)"></i></div><div style="font-size:11.5px;color:var(--muted)">${Math.round(share * 100)}%</div></td>
        <td class="r num">${money(r.t12)}</td><td class="r num">${r.so >= 1 ? `${money(r.so)}<div style="font-size:11px;color:var(--muted)">${Math.max(1, Math.round(r.so / (r.t12 || r.so) * 100))}%</div>` : '<span style="color:var(--faint)">–</span>'}</td><td class="r num ${r.ly >= 10 && r.ty < r.ly * .75 ? 'neg' : ''}">${scTrend(r)}</td><td>${spark(r.series)}</td>
        <td class="r num">${money(r.oh)}</td><td class="r num ${r.wks > 40 ? 'neg' : ''}">${r.wks == null ? '—' : r.wks >= 999 ? 'no sales' : Math.round(r.wks)}</td>
        <td class="r num">${r.gm == null ? '—' : Math.round(r.gm * 100) + '%'}</td><td class="r num ${r.gmroi != null && r.gmroi < 1 ? 'neg' : ''}">${r.gmroi == null ? '—' : r.gmroi.toFixed(2)}</td>
        <td class="r num ${r.agedPct > .3 ? 'neg' : ''}">${r.oh ? Math.round(r.agedPct * 100) + '%' : '—'}</td><td class="r num">${ord ? money(ord) : '<span style="color:var(--faint)">–</span>'}</td>
        <td><span class="chip b-${r.call}">${BCALL[r.call]}</span></td></tr>`; }).join('')}</tbody></table></div></section>`;
  $('#pane').innerHTML = `<section class="panel"><div class="chips">${chip('all', 'All categories')}${groups.map(g => chip(g.cat, esc(CAT(g.cat).name), g.rows.length)).join('')}</div>
      <div class="chips" style="justify-content:flex-end;gap:8px">${isAdmin ? `<button type="button" class="btn sm ${subPending() || bmPending() ? 'primary' : ''}" data-bupd="1" ${BUP.busy || !canAct() ? 'disabled' : ''} title="Rebuild the subcategory report, the brand scorecard and the budgets' special orders with the latest sorting and brand work">${BUP.busy ? 'Updating…' : 'Update subcategories'}</button>` : ''}<button type="button" class="btn sm" data-ssopen="1">Sort SKUs${uns + place.length ? ` <span class="cnt hot">${uns + place.length}</span>` : ''}</button></div>
      <div class="note">Sales at retail, stock at cost, ${monthLabel(ASSORT.t12Months[0])} – ${monthLabel(ASSORT.t12Months[1])}. Trend compares units in ${ASSORT.compare[1].map(monthShort).join('–')} with the same months last year. Special orders show in the category they sell as; weeks of supply, GMROI and the call count shelf sales and shelf stock only. Budgets stay by category; this shows where inside each category the sales and the stock are.</div></section>
    ${specialPanel(place)}
    ${shown.map(table).join('')}`;
}
/* special orders in all categories, and what still needs sorting */
function specialPanel(place){
  const sp = ASSORT.special || {}, m = sp.member || {}, g = sp.group || {}, nr = sp.notretail || {}, t12 = num(m.t12) + num(g.t12);
  if (!t12 && !place.length && !num(nr.n)) return '';
  const all = sum(ASSORT.rows, r => r.t12), pl = sum(place, r => r[4]);
  const catTot = c => sum(ASSORT.rows.filter(r => r.cat === c), r => r.t12) || 1;
  const cats = [...ASSORT.rows.reduce((o, r) => (r.so >= 1 && r.cat !== '640' && o.set(r.cat, (o.get(r.cat) || 0) + r.so), o), new Map())]
    .filter(([c, v]) => v >= 1000).sort((a, b) => b[1] / catTot(b[0]) - a[1] / catTot(a[0])).slice(0, 4);
  return `<section class="panel" style="margin-top:14px"><header><h2>Special orders</h2><span class="lab">${money(t12)} of sales in 12 months${all ? ` · ${Math.round(t12 / all * 100)}% of the shop` : ''}</span></header>
    <div class="row3" style="padding:0 16px">
      <div><div class="lab">Member special orders</div><div class="num" style="font-size:17px;font-weight:600">${money(num(m.t12))}</div><div style="font-size:12px;color:var(--muted)">${int(num(m.n))} SKUs · custom clubs, named orders, imprinted balls</div></div>
      <div><div class="lab">Group &amp; event orders</div><div class="num" style="font-size:17px;font-weight:600">${money(num(g.t12))}</div><div style="font-size:12px;color:var(--muted)">${int(num(g.n))} SKUs · invitationals, member-guest, outside groups</div></div>
      <div><div class="lab">Biggest shares</div><div style="font-size:13px;line-height:1.55">${cats.map(([c, v]) => `${esc(CAT(c).name)} <b>${Math.round(v / catTot(c) * 100)}%</b>`).join('<br>') || '—'}</div></div></div>
    <div class="note">They sell as ordinary items, so they show in their category with a <span class="sotag">Special order</span> tag. Every budget counts shelf sales and shelf stock only: special orders are bought when the customer orders.
      ${place.length ? `<br><b>${place.length} Special Orders item${place.length === 1 ? '' : 's'} (${money(pl)} of sales) need${place.length === 1 ? 's' : ''} a category</b> — the description doesn't say what was sold. <button class="btn sm" type="button" data-ssopen="1" data-ssfiltgo="place">Place them</button>` : ''}
      ${num(nr.n) ? `<br>${int(nr.n)} not-retail SKUs (rentals, repairs, fees) hold ${money(num(nr.oh))} of stock; they're left out of the reports. Move them out of retail inventory in the POS.` : ''}</div></section>`;
}
function openSubcat(key){
  const [cat, sub] = key.split('|'), r = ASSORT && ASSORT.rows.find(x => x.cat === cat && x.sub === sub); if (!r) return;
  const m = (lab, v, s) => `<div><div class="lab">${lab}</div><div class="num" style="font-size:17px;font-weight:600">${v}</div><div style="font-size:12px;color:var(--muted)">${s}</div></div>`;
  $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="scTitle">
    <header><div><div class="lab">${esc(CAT(cat).name)} · ${cat}</div><h2 id="scTitle">${esc(scSubName(cat, sub))} <span class="chip b-${r.call}" style="vertical-align:middle">${BCALL[r.call]}</span></h2>
      <div style="font-size:12.5px;color:var(--muted);margin-top:4px">${esc(r.why)}</div></div><button class="x" type="button" data-close="1" aria-label="Close">×</button></header>
    <div class="body">
      <div class="row3">${m('Sales, last 12 months', money(r.t12), `${int(r.units12)} units · ${r.skus} SKUs`)}${m('This year to date', money(r.ytd), r.ytdly ? pct(r.ytd / r.ytdly - 1) + ' vs last year' : 'new this year')}${m('Trend', scTrend(r), `${int(r.ly)} → ${int(r.ty)} units`)}</div>
      <div class="row3">${m('On hand', money(r.oh), r.aged ? money(r.aged) + ' not sold in 12 months' : 'nothing aged')}${m('Weeks of supply', r.wks == null ? '—' : r.wks >= 999 ? 'no sales' : Math.round(r.wks), 'at the last 12 months’ pace')}${m('GMROI', r.gmroi == null ? '—' : r.gmroi.toFixed(2), `margin ${r.gm == null ? '—' : Math.round(r.gm * 100) + '%'} · markdowns ${r.md == null ? '—' : Math.round(r.md * 100) + '%'}`)}</div>
      ${soNote(r)}
      <div class="sec">Best sellers</div>
      <table class="mini"><thead><tr><th>SKU</th><th>Item</th><th class="r">Sales 12 mo</th><th class="r">Units</th><th class="r">On hand</th></tr></thead><tbody>${r.top.map(t => `<tr><td class="num">${esc(t.sku)}</td><td>${esc(t.desc)}${soTag(t.so)}</td><td class="r num">${money(t.t12)}</td><td class="r num">${int(t.units)}</td><td class="r num">${int(t.oh)}</td></tr>`).join('')}</tbody></table>
      ${r.agedSkus.length ? `<div class="sec">Not sold in 12 months</div><table class="mini"><thead><tr><th>SKU</th><th>Item</th><th class="r">On hand</th><th class="r">At cost</th><th>Last sold</th></tr></thead><tbody>${r.agedSkus.map(t => `<tr><td class="num">${esc(t.sku)}</td><td>${esc(t.desc)}</td><td class="r num">${int(t.oh)}</td><td class="r num">${money(t.value)}</td><td>${esc(t.last || 'never')}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="note">Wrong SKUs in here? <button class="btn sm" type="button" data-ssopen="${esc(cat)}">Sort ${esc(CAT(cat).name)} SKUs</button></div>
    </div>
    <footer><div></div><button class="btn" type="button" data-close="1">Close</button></footer></aside>`;
}
/* Sort SKUs: a SKU's subcategory, whether it is a special order, and the category a Special Orders item sells as.
   Choosing what the description gives removes the override. */
const SSSEL = 'padding:4px 6px;border:1px solid var(--rule2);border-radius:4px;background:var(--card);max-width:200px';
function openSortSkus(){
  if (!BRANDSKUS){ $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div><aside class="drawer" role="dialog" aria-modal="true"><header><div><h2>Sort SKUs</h2></div><button class="x" type="button" data-close="1" aria-label="Close">×</button></header><div class="body"><div class="note">The SKU list arrives with the next month-end upload.</div></div></aside>`; return; }
  const ro = !canAct(), all = ssRows(), q = SS.q.trim().toLowerCase(), old = BRANDSKUS.rows.length && BRANDSKUS.rows[0].length < 9;
  const inCat = all.filter(r => SS.cat === 'all' || ssCat(r) === SS.cat);
  const uns = inCat.filter(r => ssCat(r) !== '640' && ssSo(r) !== 'notretail' && !ssSub(r)), set = inCat.filter(r => ssSet(r[0]) || ssHas(SUBMAP.so, r[0]) || ssHas(SUBMAP.cat, r[0]));
  const auto = inCat.filter(r => !ssSet(r[0]) && ssSubAuto(r)), spec = inCat.filter(r => ssSo(r)), place = inCat.filter(r => r[2] === '640' && ssCat(r) === '640' && ssSo(r) !== 'notretail');
  const F = {unsorted: uns, place, special: spec, auto, set, all: inCat};
  let list = F[SS.filter] || inCat;
  if (SS.keep.size) list = list.concat(inCat.filter(r => SS.keep.has(r[0]) && !list.includes(r)));
  if (q) list = inCat.filter(r => r[0].toLowerCase().includes(q) || String(r[1]).toLowerCase().includes(q) || scSubName(ssCat(r), ssSub(r)).toLowerCase().includes(q));
  list = list.slice().sort((a, b) => (b[4] + b[5]) - (a[4] + a[5]));
  const shown = list.slice(0, 150), cats = [...new Set(all.map(ssCat))].sort((a, b) => CAT(a).name.localeCompare(CAT(b).name));
  const sellCats = BASE ? BASE.order.filter(c => c !== '640') : [...new Set(all.map(r => r[2]).filter(c => c !== '640'))];
  const seg = (k, l, n) => `<button type="button" class="fchip" data-ssfilt="${k}" aria-pressed="${SS.filter === k && !q}">${l}<span class="c">${n}</span></button>`;
  const subOpts = r => { const cur = ssSub(r), a = ssSubAuto(r);
    return `<option value="" ${!cur ? 'selected' : ''}>Not sorted</option>${subsFor(ssCat(r)).map(x => `<option value="${esc(x.id)}" ${x.id === cur ? 'selected' : ''}>${esc(x.name)}${x.id === a ? ' (from the description)' : ''}</option>`).join('')}`; };
  const catOpts = r => { const cur = ssCat(r), a = r[7] || '';
    return `<option value="" ${cur === '640' ? 'selected' : ''}>No category yet</option>${sellCats.map(c => `<option value="${c}" ${c === cur ? 'selected' : ''}>${esc(CAT(c).name)}${c === a ? ' (from the description)' : ''}</option>`).join('')}`; };
  const soOpts = r => { const cur = ssSo(r), a = r[8] || '';
    return [['', 'Shelf stock'], ['member', SOK.member], ['group', SOK.group], ['notretail', SOK.notretail]].map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}${v === a ? ' (from the description)' : ''}</option>`).join(''); };
  const where = r => { const c = ssCat(r), notes = [];
    notes.push(r[2] === '640' ? `Special Orders${c !== '640' ? ` · sells as ${esc(CAT(c).name)}` : ''}` : esc(CAT(r[2]).name));
    if (ssSet(r[0]) || ssHas(SUBMAP.so, r[0]) || ssHas(SUBMAP.cat, r[0])) notes.push('set here');
    return notes.join(' · '); };
  const cell = (r, kind) => {
    if (kind === 'cat') return r[2] !== '640' ? `<span style="color:var(--muted)">${esc(CAT(r[2]).name)}</span>` : ro ? esc(ssCat(r) === '640' ? 'No category yet' : CAT(ssCat(r)).name) : `<select data-sscatsku="${esc(r[0])}" aria-label="Category SKU ${esc(r[0])} sells as" style="${SSSEL}">${catOpts(r)}</select>`;
    if (kind === 'sub') return ssCat(r) === '640' ? '<span style="color:var(--faint)">pick a category first</span>' : ro ? esc(scSubName(ssCat(r), ssSub(r))) : `<select data-sssku="${esc(r[0])}" aria-label="Subcategory for SKU ${esc(r[0])}" style="${SSSEL}">${subOpts(r)}</select>`;
    return ro ? (ssSo(r) ? SOK[ssSo(r)] : 'Shelf stock') : `<select data-ssso="${esc(r[0])}" aria-label="Special order or shelf stock, SKU ${esc(r[0])}" style="${SSSEL}">${soOpts(r)}</select>`;
  };
  $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div>
  <aside class="drawer wide" role="dialog" aria-modal="true" aria-labelledby="ssTitle">
    <header><div><div class="lab">${ssUnsorted().length} SKUs not sorted · ${ssPlace().length} special orders need a category</div><h2 id="ssTitle">Sort SKUs</h2>
      <div style="font-size:12.5px;color:var(--muted);margin-top:4px">Each SKU's subcategory, and whether it is shelf stock or a special order, comes from its description; change any that are wrong. Special Orders items also get the category they sell as, so they report with it. Choices save as you make them, and ${isAdmin ? '<b>Update subcategories</b>' : 'the owner’s <b>Update subcategories</b>'} puts them into the reports and the budgets (every month-end upload does too).</div></div>
      <button class="x" type="button" data-close="1" aria-label="Close">×</button></header>
    <div class="body">
      ${old ? '<div class="warnbox info">Special orders are marked from the next Update subcategories or month-end upload.</div>' : ''}
      <div class="chips">${seg('unsorted', 'Not sorted', uns.length)}${seg('place', 'Needs a category', place.length)}${seg('special', 'Special orders', spec.length)}${seg('auto', 'From the description', auto.length)}${seg('set', 'Set here', set.length)}${seg('all', 'All', inCat.length)}</div>
      <div class="chips" style="gap:8px"><select id="ssCat" style="padding:5px 8px;border:1px solid var(--rule2);border-radius:4px;background:var(--card)"><option value="all">All categories</option>${cats.map(c => `<option value="${c}" ${SS.cat === c ? 'selected' : ''}>${c === '640' ? 'Special Orders, no category yet' : esc(CAT(c).name)} (${c})</option>`).join('')}</select>
        <input id="ssQ" type="search" placeholder="Find a SKU, description or subcategory" value="${esc(SS.q)}" style="margin-left:auto;padding:5px 10px;border:1px solid var(--rule2);border-radius:4px;background:var(--card);min-width:230px"></div>
      ${shown.length ? `<div style="overflow-x:auto"><table class="mini" style="min-width:980px"><thead><tr><th>SKU</th><th>Description</th><th class="r">12-mo sales</th><th class="r">On hand</th><th style="min-width:110px">Sells as</th><th>Subcategory</th><th>Shelf or special order</th></tr></thead><tbody>
        ${shown.map(r => `<tr><td class="num">${esc(r[0])}</td><td style="min-width:230px">${esc(r[1])}${soTag(ssSo(r))}<br><span style="color:var(--muted);font-size:11.5px">${where(r)}</span></td>
          <td class="r num">${money(r[4])}</td><td class="r num">${money(r[5])}</td>
          <td>${cell(r, 'cat')}</td><td>${cell(r, 'sub')}</td><td>${cell(r, 'so')}</td></tr>`).join('')}</tbody></table></div>
        ${list.length > shown.length ? `<div class="note">Showing the ${shown.length} biggest of ${list.length}. Search or pick a category to find others.</div>` : ''}` : `<div class="note">${q ? 'No SKUs match.' : SS.filter === 'unsorted' ? 'Every SKU here has a subcategory.' : SS.filter === 'place' ? 'Every special order has a category.' : 'Nothing here.'}</div>`}
    </div></aside>`;
}
async function ssWrite(sku, patch, msg){
  SS.keep.add(sku);
  const next = {...SUBMAP, ...patch, updatedBy: myId, updatedAt: new Date().toISOString()};
  if (await write('submap/current', next)){ SUBMAP = next; toast(msg); openSortSkus(); }
}
function ssSave(sku, sub){
  const row = ssRows().find(r => r[0] === sku), skus = {...(SUBMAP.skus || {})};
  if (row && (sub || '') === ssSubAuto(row)) delete skus[sku]; else skus[sku] = sub || '';
  return ssWrite(sku, {skus}, `SKU ${sku}: ${scSubName(row ? ssCat(row) : '', sub)}`);
}
/* a Special Orders item's category; its subcategory starts again from the description */
function ssSaveCat(sku, cat){
  const row = ssRows().find(r => r[0] === sku), cats = {...(SUBMAP.cat || {})}, skus = {...(SUBMAP.skus || {})};
  if (row && (cat || '') === (row[7] || '')) delete cats[sku]; else cats[sku] = cat || '';
  delete skus[sku];
  return ssWrite(sku, {cat: cats, skus}, `SKU ${sku} sells as ${cat ? CAT(cat).name : 'no category yet'}`);
}
function ssSaveSo(sku, v){
  const row = ssRows().find(r => r[0] === sku), so = {...(SUBMAP.so || {})};
  if (row && (v || '') === (row[8] || '')) delete so[sku]; else so[sku] = v || 'shelf';
  return ssWrite(sku, {so}, `SKU ${sku}: ${v ? SOK[v] : 'shelf stock'}`);
}
/* the category drawer's summary of its subcategories */
function subcatSectionHTML(code){
  const rows = ASSORT ? ASSORT.rows.filter(r => r.cat === code) : []; if (!rows.length) return '';
  const tot = sum(rows, r => r.t12) || 1;
  return `<div class="sec" style="display:flex;justify-content:space-between;align-items:center">Sales and stock by subcategory <button class="btn sm ghost" type="button" data-tab="subcats" data-sccatgo="${code}">Open Subcategories</button></div>
    <table class="mini"><thead><tr><th>Subcategory</th><th class="r">Share</th><th class="r">Sales 12 mo</th><th class="r">On hand</th><th class="r">Weeks</th></tr></thead><tbody class="click">${rows.map(r => `<tr data-subrow="${esc(r.cat + '|' + r.sub)}" style="cursor:pointer"><td>${esc(scSubName(r.cat, r.sub))}</td><td class="r num">${Math.round(r.t12 / tot * 100)}%</td><td class="r num">${money(r.t12)}</td><td class="r num">${money(r.oh)}</td><td class="r num ${r.wks > 40 ? 'neg' : ''}">${r.wks == null ? '—' : r.wks >= 999 ? 'no sales' : Math.round(r.wks)}</td></tr>`).join('')}</tbody></table>`;
}
