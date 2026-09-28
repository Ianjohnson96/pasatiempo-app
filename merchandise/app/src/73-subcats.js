/* ---------- subcategories ----------
   assort/current (pipeline/model.py build_subcats) is the brand scorecard's measures by category and subcategory,
   rebuilt at every month-end upload and by Update brands. Which subcategory a SKU is in comes from its description
   (config.SUB_RULES, brandskus row [6]) unless someone set it here (submap/current: {skus: {sku: subcat id}}).
   Reporting only: budgets stay by category. */
let ASSORT = null, SUBMAP = {skus: {}};
const SC = {cat: 'all'}, SS = {filter: 'unsorted', cat: 'all', q: ''};
const scSubName = (cat, sub) => sub ? (subName(sub) || sub.replace(/^s-\d+-/, '').replace(/-/g, ' ')) : 'Not sorted';
const ssSet = sku => Object.prototype.hasOwnProperty.call(SUBMAP.skus || {}, sku);
const ssSub = row => ssSet(row[0]) ? SUBMAP.skus[row[0]] : (row[6] || '');
const ssRows = () => ((BRANDSKUS && BRANDSKUS.rows) || []).filter(r => r[2] !== '640');
const ssUnsorted = () => ssRows().filter(r => !ssSub(r));
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
  const groups = scByCat(), shown = SC.cat === 'all' ? groups : groups.filter(g => g.cat === SC.cat), uns = ssUnsorted().length;
  const chip = (k, l, n) => `<button type="button" class="fchip" data-sccat="${k}" aria-pressed="${SC.cat === k}">${l}${n != null ? `<span class="c">${n}</span>` : ''}</button>`;
  const th = (l, r, t) => `<th class="${r ? 'r' : ''}" ${t ? `title="${esc(t)}"` : ''}>${l}</th>`;
  const bySubOrder = (cat, sub) => num((S.bySub[cat + '|' + sub] || {}).dollars);
  const table = g => `<section class="panel" style="margin-top:14px"><header><h2><button type="button" class="linklike" data-cat="${g.cat}">${esc(CAT(g.cat).name)}</button> <span style="color:var(--faint);font-weight:400;font-size:13px">${g.cat}</span></h2>
      <span class="lab">${money(g.t12)} sales · ${money(g.oh)} on hand</span></header>
    <div class="tbl"><table class="brandt" style="min-width:1000px"><thead><tr>${th('Subcategory')}${th('Share of sales', 0, 'This subcategory’s part of the category’s last-12-month sales')}${th('Sales, 12 mo', 1)}${th('Trend', 1, 'Units in the last three closed months against the same months a year earlier')}<th><span class="h">24 months</span></th>${th('On hand', 1, 'At cost')}${th('Weeks of supply', 1, 'On hand at the last 12 months’ pace')}${th('Margin', 1)}${th('GMROI', 1, 'Gross margin in 12 months for every $1 of stock at cost')}${th('Aged', 1, 'Share of the stock not sold in 12 months')}${th('Committed ' + PLANS.cur.fy, 1, 'Order Book lines in this subcategory arriving this year')}${th('Call')}</tr></thead>
    <tbody class="click">${g.rows.map(r => { const share = g.t12 ? r.t12 / g.t12 : 0, ord = bySubOrder(r.cat, r.sub);
      return `<tr data-subrow="${esc(r.cat + '|' + r.sub)}" tabindex="0" style="cursor:pointer"><td><b>${esc(scSubName(r.cat, r.sub))}</b><div style="font-size:11.5px;color:var(--faint)">${r.skus} SKU${r.skus === 1 ? '' : 's'}</div></td>
        <td style="min-width:120px"><div class="meter" style="margin:0"><i style="width:${Math.round(share * 100)}%;background:var(--cypress)"></i></div><div style="font-size:11.5px;color:var(--muted)">${Math.round(share * 100)}%</div></td>
        <td class="r num">${money(r.t12)}</td><td class="r num ${r.ly >= 10 && r.ty < r.ly * .75 ? 'neg' : ''}">${scTrend(r)}</td><td>${spark(r.series)}</td>
        <td class="r num">${money(r.oh)}</td><td class="r num ${r.wks > 40 ? 'neg' : ''}">${r.wks == null ? '—' : r.wks >= 999 ? 'no sales' : Math.round(r.wks)}</td>
        <td class="r num">${r.gm == null ? '—' : Math.round(r.gm * 100) + '%'}</td><td class="r num ${r.gmroi != null && r.gmroi < 1 ? 'neg' : ''}">${r.gmroi == null ? '—' : r.gmroi.toFixed(2)}</td>
        <td class="r num ${r.agedPct > .3 ? 'neg' : ''}">${r.oh ? Math.round(r.agedPct * 100) + '%' : '—'}</td><td class="r num">${ord ? money(ord) : '<span style="color:var(--faint)">–</span>'}</td>
        <td><span class="chip b-${r.call}">${BCALL[r.call]}</span></td></tr>`; }).join('')}</tbody></table></div></section>`;
  $('#pane').innerHTML = `<section class="panel"><div class="chips">${chip('all', 'All categories')}${groups.map(g => chip(g.cat, esc(CAT(g.cat).name), g.rows.length)).join('')}</div>
      <div class="chips" style="justify-content:flex-end;gap:8px">${isAdmin ? `<button type="button" class="btn sm ${subPending() || bmPending() ? 'primary' : ''}" data-bupd="1" ${BUP.busy || !canAct() ? 'disabled' : ''} title="Rebuild the subcategory report and the brand scorecard with the latest sorting and brand work">${BUP.busy ? 'Updating…' : 'Update subcategories'}</button>` : ''}<button type="button" class="btn sm" data-ssopen="1">Sort SKUs${uns ? ` <span class="cnt hot">${uns}</span>` : ''}</button></div>
      <div class="note">Sales at retail, stock at cost, ${monthLabel(ASSORT.t12Months[0])} – ${monthLabel(ASSORT.t12Months[1])}. Trend compares units in ${ASSORT.compare[1].map(monthShort).join('–')} with the same months last year. Special orders aren't included. Budgets stay by category; this shows where inside each category the sales and the stock are.</div></section>
    ${shown.map(table).join('')}`;
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
      <div class="sec">Best sellers</div>
      <table class="mini"><thead><tr><th>SKU</th><th>Item</th><th class="r">Sales 12 mo</th><th class="r">Units</th><th class="r">On hand</th></tr></thead><tbody>${r.top.map(t => `<tr><td class="num">${esc(t.sku)}</td><td>${esc(t.desc)}</td><td class="r num">${money(t.t12)}</td><td class="r num">${int(t.units)}</td><td class="r num">${int(t.oh)}</td></tr>`).join('')}</tbody></table>
      ${r.agedSkus.length ? `<div class="sec">Not sold in 12 months</div><table class="mini"><thead><tr><th>SKU</th><th>Item</th><th class="r">On hand</th><th class="r">At cost</th><th>Last sold</th></tr></thead><tbody>${r.agedSkus.map(t => `<tr><td class="num">${esc(t.sku)}</td><td>${esc(t.desc)}</td><td class="r num">${int(t.oh)}</td><td class="r num">${money(t.value)}</td><td>${esc(t.last || 'never')}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="note">Wrong SKUs in here? <button class="btn sm" type="button" data-ssopen="${esc(cat)}">Sort ${esc(CAT(cat).name)} SKUs</button></div>
    </div>
    <footer><div></div><button class="btn" type="button" data-close="1">Close</button></footer></aside>`;
}
/* Sort SKUs: pick a SKU's subcategory; choosing the one its description gives removes the override. */
function openSortSkus(){
  if (!BRANDSKUS){ $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div><aside class="drawer" role="dialog" aria-modal="true"><header><div><h2>Sort SKUs</h2></div><button class="x" type="button" data-close="1" aria-label="Close">×</button></header><div class="body"><div class="note">The SKU list arrives with the next month-end upload.</div></div></aside>`; return; }
  const ro = !canAct(), all = ssRows(), q = SS.q.trim().toLowerCase();
  const inCat = all.filter(r => SS.cat === 'all' || r[2] === SS.cat);
  const uns = inCat.filter(r => !ssSub(r)), set = inCat.filter(r => ssSet(r[0])), auto = inCat.filter(r => !ssSet(r[0]) && r[6]);
  let list = SS.filter === 'unsorted' ? uns : SS.filter === 'set' ? set : SS.filter === 'auto' ? auto : inCat;
  if (q) list = inCat.filter(r => r[0].toLowerCase().includes(q) || String(r[1]).toLowerCase().includes(q) || scSubName(r[2], ssSub(r)).toLowerCase().includes(q));
  list = list.slice().sort((a, b) => (b[4] + b[5]) - (a[4] + a[5]));
  const shown = list.slice(0, 150), cats = [...new Set(all.map(r => r[2]))].sort((a, b) => CAT(a).name.localeCompare(CAT(b).name));
  const seg = (k, l, n) => `<button type="button" class="fchip" data-ssfilt="${k}" aria-pressed="${SS.filter === k && !q}">${l}<span class="c">${n}</span></button>`;
  const opts = r => { const cur = ssSub(r), subs = subsFor(r[2]);
    return `<option value="" ${!cur ? 'selected' : ''}>Not sorted</option>${subs.map(s => `<option value="${esc(s.id)}" ${s.id === cur ? 'selected' : ''}>${esc(s.name)}${s.id === r[6] ? ' (from the description)' : ''}</option>`).join('')}`; };
  $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="ssTitle">
    <header><div><div class="lab">${ssUnsorted().length} SKUs not sorted · ${money(sum(ssUnsorted(), r => r[4]))} of 12-month sales</div><h2 id="ssTitle">Sort SKUs into subcategories</h2>
      <div style="font-size:12.5px;color:var(--muted);margin-top:4px">SKUs are sorted from their descriptions; change any that landed in the wrong place. Choices save as you make them, and ${isAdmin ? '<b>Update subcategories</b>' : 'the owner’s <b>Update subcategories</b>'} puts them into the report (every month-end upload does too). The list of subcategories is the one order lines use.</div></div>
      <button class="x" type="button" data-close="1" aria-label="Close">×</button></header>
    <div class="body">
      <div class="chips">${seg('unsorted', 'Not sorted', uns.length)}${seg('auto', 'From the description', auto.length)}${seg('set', 'Set here', set.length)}${seg('all', 'All', inCat.length)}</div>
      <div class="chips" style="gap:8px"><select id="ssCat" style="padding:5px 8px;border:1px solid var(--rule2);border-radius:4px;background:var(--card)"><option value="all">All categories</option>${cats.map(c => `<option value="${c}" ${SS.cat === c ? 'selected' : ''}>${esc(CAT(c).name)} (${c})</option>`).join('')}</select>
        <input id="ssQ" type="search" placeholder="Find a SKU, description or subcategory" value="${esc(SS.q)}" style="margin-left:auto;padding:5px 10px;border:1px solid var(--rule2);border-radius:4px;background:var(--card);min-width:230px"></div>
      ${shown.length ? `<div style="overflow-x:auto"><table class="mini"><thead><tr><th>SKU</th><th>Description</th><th class="r">12-mo sales</th><th class="r">On hand</th><th>Subcategory</th></tr></thead><tbody>
        ${shown.map(r => `<tr><td class="num">${esc(r[0])}</td><td>${esc(r[1])}<br><span style="color:var(--muted);font-size:11.5px">${esc(CAT(r[2]).name)}${ssSet(r[0]) ? ' · set here' : ''}</span></td>
          <td class="r num">${money(r[4])}</td><td class="r num">${money(r[5])}</td>
          <td>${ro ? esc(scSubName(r[2], ssSub(r))) : `<select data-sssku="${esc(r[0])}" aria-label="Subcategory for SKU ${esc(r[0])}" style="padding:4px 6px;border:1px solid var(--rule2);border-radius:4px;background:var(--card);max-width:240px">${opts(r)}</select>`}</td></tr>`).join('')}</tbody></table></div>
        ${list.length > shown.length ? `<div class="note">Showing the ${shown.length} biggest of ${list.length}. Search or pick a category to find others.</div>` : ''}` : `<div class="note">${q ? 'No SKUs match.' : SS.filter === 'unsorted' ? 'Every SKU here has a subcategory.' : 'Nothing here.'}</div>`}
    </div></aside>`;
}
async function ssSave(sku, sub){
  const row = ssRows().find(r => r[0] === sku), skus = {...(SUBMAP.skus || {})};
  if (row && (sub || '') === (row[6] || '')) delete skus[sku]; else skus[sku] = sub || '';
  if (await write('submap/current', {...SUBMAP, skus, updatedBy: myId, updatedAt: new Date().toISOString()})){
    SUBMAP = {...SUBMAP, skus}; toast(`SKU ${sku}: ${scSubName(row ? row[2] : '', sub)}`); openSortSkus();
  }
}
/* the category drawer's summary of its subcategories */
function subcatSectionHTML(code){
  const rows = ASSORT ? ASSORT.rows.filter(r => r.cat === code) : []; if (!rows.length) return '';
  const tot = sum(rows, r => r.t12) || 1;
  return `<div class="sec" style="display:flex;justify-content:space-between;align-items:center">Sales and stock by subcategory <button class="btn sm ghost" type="button" data-tab="subcats" data-sccatgo="${code}">Open Subcategories</button></div>
    <table class="mini"><thead><tr><th>Subcategory</th><th class="r">Share</th><th class="r">Sales 12 mo</th><th class="r">On hand</th><th class="r">Weeks</th></tr></thead><tbody class="click">${rows.map(r => `<tr data-subrow="${esc(r.cat + '|' + r.sub)}" style="cursor:pointer"><td>${esc(scSubName(r.cat, r.sub))}</td><td class="r num">${Math.round(r.t12 / tot * 100)}%</td><td class="r num">${money(r.t12)}</td><td class="r num">${money(r.oh)}</td><td class="r num ${r.wks > 40 ? 'neg' : ''}">${r.wks == null ? '—' : r.wks >= 999 ? 'no sales' : Math.round(r.wks)}</td></tr>`).join('')}</tbody></table>`;
}
