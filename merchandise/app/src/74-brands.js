
/* ---------- brand scorecard ---------- */
let BRANDS = FALLBACK.brands || null, BCALLS = {};
let bfilt = {seg: 'all', call: 'all', q: '', small: false}, bsort = {key: 't12', dir: -1};
const normName = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const bCall = r => (BCALLS[r.id] && BCALLS[r.id].call) || r.call;
const HATRX = /\b(hat|hats|visor|beanie|bucket|cap|caps|headwear)\b/i;
function brandNameFor(vendor){
  if (!BRANDS || !vendor) return null;
  const v = normName(vendor), names = [...new Set(BRANDS.rows.map(r => r.brand))];
  return names.find(b => normName(b) === v) || names.find(b => { const n = normName(b); return n.length >= 3 && (v.startsWith(n) || n.startsWith(v)); })
    || names.find(b => b.split(' / ').some(x => normName(x) === v)) || null;
}
function segOfLine(cat, l){
  if (cat === '440') return HATRX.test((subName(l.sub) || '') + ' ' + (l.style || '')) ? 'hats' : 'accessories';
  return ({'400':'mens','430':'mens','470':'mens','480':'mens','490':'mens','500':'ladies','620':'accessories','660':'accessories'})[cat] || 'equipment';
}
/* committed cost by brand+segment, split into this year and next year */
function brandOrders(){
  const out = {};
  for (const p of POS){
    if (p.status === 'cancelled') continue;
    const b = brandNameFor(vendorName(p)); if (!b) continue;
    const key = planKeyFor(p.deliveryMonth), lines = (p.lines && p.lines.length) ? p.lines : [{cat: p.cat, cost: poTotal(p), units: 1}];
    const tot = sum(lines, lineExt) || poTotal(p);
    for (const l of lines){
      const seg = segOfLine(l.cat || p.cat, l), id = (seg + '-' + b).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const share = tot ? lineExt(l) / tot : 1 / lines.length, o = out[id] = out[id] || {cur: 0, next: 0, open: 0, pos: new Set()};
      o[key === 'next' ? 'next' : 'cur'] += committed(p) * share; o.open += onOrder(p) * share; o.pos.add(p.id);
    }
  }
  return out;
}
function brandWarns(p){
  const out = [], b = brandNameFor(vendorName(p)); if (!b || !BRANDS) return out;
  const lines = (p.lines && p.lines.length) ? p.lines : [{cat: p.cat}], seen = new Set();
  for (const l of lines){
    if (!(l.cat || p.cat)) continue;
    const seg = segOfLine(l.cat || p.cat, l), r = BRANDS.rows.find(x => x.brand === b && x.seg === seg);
    if (!r || seen.has(r.id)) continue; seen.add(r.id);
    const c = bCall(r);
    if (c === 'drop') out.push(['crit', `The brand scorecard says Drop ${b} in ${SEGS[seg]}: ${(BCALLS[r.id] || {}).note || r.why} Only order against a customer commitment.`]);
    else if (c === 'reduce') out.push(['', `The brand scorecard says Reduce ${b} in ${SEGS[seg]}: ${(BCALLS[r.id] || {}).note || r.why} Buy tighter than last time.`]);
  }
  return out;
}
function spark(series, w = 96, h = 24){
  const n = series.length, hi = Math.max(...series, 1), x = i => (i / (n - 1) * (w - 2) + 1).toFixed(1), y = v => (h - 2 - v / hi * (h - 4)).toFixed(1);
  const half = Math.floor(n / 2), p = (a, b) => series.slice(a, b).map((v, i) => (i ? 'L' : 'M') + x(a + i) + ' ' + y(v)).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${p(0, half + 1)}" fill="none" stroke="var(--faint)" stroke-width="1.2"/><path d="${p(half, n)}" fill="none" stroke="var(--cypress)" stroke-width="1.8"/></svg>`;
}
const trendTxt = r => r.ly >= 10 ? pct(r.ty / r.ly - 1) : (r.ty ? 'new' : '—');
function renderBrands(){
  if (!BRANDS){ $('#pane').innerHTML = `<section class="panel"><div class="note">The brand scorecard loads after the first month-end refresh.</div></section>`; return; }
  const BO = brandOrders(), rows0 = BRANDS.rows.map(r => ({...r, ecall: bCall(r), ord: BO[r.id] || {cur: 0, next: 0, open: 0, pos: new Set()}}));
  const q = bfilt.q.trim().toLowerCase();
  const inSeg = rows0.filter(r => bfilt.seg === 'all' || r.seg === bfilt.seg);
  const small = r => r.t12 < 1500 && r.oh < 1500;
  let rows = inSeg.filter(r => (bfilt.call === 'all' || r.ecall === bfilt.call) && (!q || r.brand.toLowerCase().includes(q)) && (bfilt.small || q || !small(r)));
  const nSmall = inSeg.filter(r => (bfilt.call === 'all' || r.ecall === bfilt.call) && small(r)).length;
  const sv = (r, k) => k === 'brand' ? r.brand.toLowerCase() : k === 'trend' ? (r.ly >= 10 ? r.ty / r.ly : -9) : k === 'ordcur' ? r.ord.cur : k === 'ordnext' ? r.ord.next : k === 'call' ? ['grow','keep','watch','reduce','drop','inactive'].indexOf(r.ecall) : num(r[k]);
  rows.sort((a, b) => { const x = sv(a, bsort.key), y = sv(b, bsort.key); return (x < y ? -1 : x > y ? 1 : 0) * bsort.dir; });
  const cnt = k => inSeg.filter(r => r.ecall === k).length;
  const segCnt = s => rows0.filter(r => s === 'all' || r.seg === s).length;
  const tied = k => sum(inSeg.filter(r => r.ecall === k), r => r.oh);
  const t12 = sum(inSeg, r => r.t12), growShare = sum(inSeg.filter(r => r.ecall === 'grow'), r => r.t12) / (t12 || 1);
  const risky = inSeg.filter(r => (r.ecall === 'drop' || r.ecall === 'reduce') && r.ord.cur + r.ord.next > 0.5);
  const k = (lab, v, sub, expl) => `<div class="kpi"><div class="lab">${lab}</div><div class="v num">${v}</div><div class="s">${sub}</div><div class="x">${expl}</div></div>`;
  const kpis = k('Last 12 months', moneyK(t12), `${inSeg.length} brand lines`, `Sales ${monthLabel(BRANDS.t12Months[0])} – ${monthLabel(BRANDS.t12Months[1])}, at retail.`) +
    k('Grow', cnt('grow'), `${Math.round(growShare * 100)}% of sales`, 'High return on stock and turning — give them more of the budget.') +
    k('Reduce', cnt('reduce'), `${moneyK(tied('reduce'))} on hand`, 'Keep, but buy tighter: fewer styles, deeper on the winners.') +
    k('Drop', `<span style="color:var(--brick)">${cnt('drop')}</span>`, `${moneyK(tied('drop'))} on hand`, 'Stop buying and sell through. That stock is cash to free up.') +
    k('Watch', cnt('watch'), 'new or changing', 'Too new or moving too fast to judge. Look again next season.') +
    k('Orders at risk', `<span style="color:${risky.length ? 'var(--brick)' : 'inherit'}">${risky.length}</span>`, moneyK(sum(risky, r => r.ord.cur + r.ord.next)), 'Orders placed with brands marked Drop or Reduce.');
  const top = (call, n) => inSeg.filter(r => r.ecall === call).sort((a, b) => b.oh - a.oh).slice(0, n);
  const lines = [];
  const dr = top('drop', 5); if (dr.length) lines.push(`<b>Drop:</b> ${dr.map(r => `${esc(r.brand)} (${SEGS[r.seg].toLowerCase()}, ${moneyK(r.oh)} on hand)`).join(', ')}.`);
  const gr = inSeg.filter(r => r.ecall === 'grow').sort((a, b) => b.t12 - a.t12).slice(0, 5); if (gr.length) lines.push(`<b>Grow:</b> ${gr.map(r => `${esc(r.brand)} (${SEGS[r.seg].toLowerCase()}${r.oh <= 0 ? ', out of stock' : ', GMROI ' + r.gmroi}`).join('), ')}).`);
  if (risky.length) lines.push(`<b>Check these orders:</b> ${risky.slice(0, 5).map(r => `${esc(r.brand)} ${moneyK(r.ord.cur + r.ord.next)}`).join(', ')} — brands marked ${[...new Set(risky.map(r => BCALL[r.ecall].toLowerCase()))].join(' or ')}.`);
  lines.push(`Scorecard updates every month-end from the SKU Analysis and cost report. Sales through ${monthLabel(BRANDS.through)}. Trend compares units in ${BRANDS.compare[1].map(monthShort).join('–')} with the same months last year.`);
  const th = (key, l, r) => `<th class="${r ? 'r' : ''}"><button class="sorth" type="button" data-bsort="${key}">${l}${bsort.key === key ? (bsort.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`;
  const segBtn = (s, l) => `<button type="button" class="fchip" data-bseg="${s}" aria-pressed="${bfilt.seg === s}">${l}<span class="c">${segCnt(s)}</span></button>`;
  const callBtn = (c, l) => `<button type="button" class="fchip" data-bcall="${c}" aria-pressed="${bfilt.call === c}">${l}${c !== 'all' ? `<span class="c">${cnt(c)}</span>` : ''}</button>`;
  $('#pane').innerHTML = `<section class="kpis" style="margin-top:0">${kpis}</section>
  <section class="summary"><h2>Brand calls${bfilt.seg === 'all' ? '' : ' · ' + SEGS[bfilt.seg]}</h2><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul></section>
  <section class="panel" style="margin-top:14px">
    <div class="chips">${segBtn('all', 'All')}${Object.entries(SEGS).map(([s, l]) => segBtn(s, l)).join('')}</div>
    <div class="chips">${callBtn('all', 'Every call')}${Object.entries(BCALL).map(([c, l]) => callBtn(c, l)).join('')}<button type="button" class="fchip" data-bsmall="1" aria-pressed="${bfilt.small}" title="Brands under $1,500 in both sales and stock">Small brands<span class="c">${nSmall}</span></button><input id="bQ" type="search" placeholder="Find a brand" value="${esc(bfilt.q)}" style="margin-left:auto;padding:5px 10px;border:1px solid var(--rule2);border-radius:4px;background:var(--card)"></div>
    <div class="tbl"><table class="brandt" style="min-width:1180px"><thead><tr>${th('brand', 'Brand')}${th('call', 'Call')}${th('t12', 'Sales, 12 mo', 1)}${th('trend', 'Trend', 1)}<th><span class="h">24 months</span></th>${th('oh', 'On hand', 1)}${th('wks', 'Weeks', 1)}${th('gm', 'Margin', 1)}${th('gmroi', 'GMROI', 1)}${th('agedPct', 'Aged', 1)}${th('ordcur', 'On order ' + PLANS.cur.fy, 1)}${th('ordnext', 'Bought ' + (PLANS.next ? PLANS.next.fy : 'next yr'), 1)}</tr></thead>
    <tbody class="click">${rows.map(r => `<tr data-brand="${esc(r.id)}" tabindex="0" style="cursor:pointer">
      <td><b>${esc(r.brand)}</b><div style="font-size:11.5px;color:var(--faint)">${SEGS[r.seg]}</div></td>
      <td><span class="chip b-${r.ecall}">${BCALL[r.ecall]}</span>${BCALLS[r.id] ? ' <span title="Set by the owner" style="color:var(--faint)">✎</span>' : ''}</td>
      <td class="r num">${money(r.t12)}</td><td class="r num ${r.ly >= 10 && r.ty < r.ly * .75 ? 'neg' : ''}">${trendTxt(r)}</td><td>${spark(r.series)}</td>
      <td class="r num">${money(r.oh)}</td><td class="r num ${r.wks > 40 ? 'neg' : ''}">${r.wks == null ? '—' : r.wks >= 999 ? 'no sales' : Math.round(r.wks)}</td>
      <td class="r num">${r.gm == null ? '—' : Math.round(r.gm * 100) + '%'}</td><td class="r num ${r.gmroi != null && r.gmroi < (r.seg === 'equipment' ? .5 : 1) ? 'neg' : ''}">${r.gmroi == null ? '—' : r.gmroi.toFixed(2)}</td>
      <td class="r num ${r.agedPct > .3 ? 'neg' : ''}">${r.oh ? Math.round(r.agedPct * 100) + '%' : '—'}</td>
      <td class="r num">${r.ord.cur ? money(r.ord.cur) : '<span style="color:var(--faint)">–</span>'}</td><td class="r num">${r.ord.next ? money(r.ord.next) : '<span style="color:var(--faint)">–</span>'}</td></tr>`).join('') || '<tr><td colspan="12" style="color:var(--muted);padding:12px">No brands match.</td></tr>'}</tbody></table></div>
    <div class="note"><b>GMROI</b> = gross margin earned in 12 months for every $1 of stock at cost; under 1.0 means the stock isn't paying its way (equipment runs lower because margins are thin). <b>Weeks</b> = weeks of supply at the last 12 months' pace. <b>Aged</b> = share of the stock with no sale in 12 months. Brands are matched from item descriptions; ${money(sum(Object.values(BRANDS.unassigned || {})))} of sales couldn't be matched to a brand.</div></section>`;
}
function openBrand(id){
  const r0 = BRANDS.rows.find(x => x.id === id); if (!r0) return;
  const r = {...r0, ecall: bCall(r0)}, ov = BCALLS[id], ords = (brandOrders()[id] || {pos: new Set()}), pos = POS.filter(p => ords.pos.has(p.id));
  const n = r.series.length, half = n / 2, ly = r.series.slice(0, half), ty = r.series.slice(half), months = BRANDS.months.slice(half);
  const hi = Math.max(...r.series, 1), W = 520, H = 150, L = 44, bw = (W - L - 6) / half, y = v => 10 + (H - 34) * (1 - v / hi);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly sales for ${esc(r.brand)}, this year against last year">`;
  for (const v of [0, hi / 2, hi]) svg += `<line x1="${L}" x2="${W - 6}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule)"/><text class="axis" x="${L - 5}" y="${y(v) + 3}" text-anchor="end">${moneyK(v)}</text>`;
  ty.forEach((v, i) => { svg += `<rect x="${L + i * bw + 3}" y="${y(v)}" width="${bw - 6}" height="${y(0) - y(v)}" fill="var(--cypress)"><title>${monthLabel(months[i])}: ${money(v)} · last year ${money(ly[i])}</title></rect><text class="axis" x="${L + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${monthShort(months[i])[0]}</text>`; });
  svg += `<path d="${ly.map((v, i) => (i ? 'L' : 'M') + (L + i * bw + bw / 2).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ')}" fill="none" stroke="var(--ink)" stroke-width="1.5"/></svg>`;
  const m = (lab, v, sub) => `<div><div class="lab">${lab}</div><div class="num" style="font-size:17px;font-weight:600">${v}</div><div style="font-size:12px;color:var(--muted)">${sub}</div></div>`;
  const canSet = isAdmin && canAct();
  $('#overlay').innerHTML = `<div class="scrim" data-close="1"></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="bTitle">
    <header><div><div class="lab">${SEGS[r.seg]}</div><h2 id="bTitle">${esc(r.brand)} <span class="chip b-${r.ecall}" style="vertical-align:middle">${BCALL[r.ecall]}</span></h2>
      <div style="font-size:12.5px;color:var(--muted);margin-top:4px">${ov ? `Owner's call${ov.note ? ': ' + esc(ov.note) : ''}. The numbers suggest <b>${BCALL[r.call]}</b> — ${esc(r.why)}` : esc(r.why) + ' ' + BCALLHELP[r.ecall]}</div></div><button class="x" type="button" data-close="1" aria-label="Close">×</button></header>
    <div class="body">
      <div class="row3">${m('Sales, last 12 months', money(r.t12), `${int(r.units12)} units · ${r.skus} SKUs`)}${m('This year to date', money(r.ytd), r.ytdly ? pct(r.ytd / r.ytdly - 1) + ' vs last year' : 'new this year')}${m('Trend', trendTxt(r), `${int(r.ly)} → ${int(r.ty)} units, ${BRANDS.compare[1].map(monthShort).join('–')}`)}</div>
      <div class="row3">${m('On hand', money(r.oh), r.aged ? money(r.aged) + ' not sold in 12 months' : 'nothing aged')}${m('Weeks of supply', r.wks == null ? '—' : r.wks >= 999 ? 'no sales' : Math.round(r.wks), r.wks > 40 ? 'too much stock' : 'at the last 12 months\' pace')}${m('GMROI', r.gmroi == null ? '—' : r.gmroi.toFixed(2), `margin ${r.gm == null ? '—' : Math.round(r.gm * 100) + '%'} · markdowns ${r.md == null ? '—' : Math.round(r.md * 100) + '%'}`)}</div>
      <div class="sec">Sales by month</div>
      <div>${svg}</div><div style="font-size:12px;color:var(--muted)">Bars: the last 12 months. Line: the same months a year earlier.</div>
      <div class="sec">Best sellers</div>
      <table class="mini"><thead><tr><th>SKU</th><th>Item</th><th class="r">Sales 12 mo</th><th class="r">Units</th><th class="r">On hand</th></tr></thead><tbody>${r.top.map(t => `<tr><td class="num">${esc(t.sku)}</td><td>${esc(t.desc)}</td><td class="r num">${money(t.t12)}</td><td class="r num">${int(t.units)}</td><td class="r num">${int(t.oh)}</td></tr>`).join('')}</tbody></table>
      ${r.agedSkus.length ? `<div class="sec">Not sold in 12 months</div><table class="mini"><thead><tr><th>SKU</th><th>Item</th><th class="r">On hand</th><th class="r">At cost</th><th>Last sold</th></tr></thead><tbody>${r.agedSkus.map(t => `<tr><td class="num">${esc(t.sku)}</td><td>${esc(t.desc)}</td><td class="r num">${int(t.oh)}</td><td class="r num">${money(t.value)}</td><td>${esc(t.last || 'never')}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="sec">Orders</div>
      ${pos.length ? `<table class="mini"><thead><tr><th>PO</th><th>Delivery</th><th class="r">Cost</th><th>Status</th></tr></thead><tbody class="click">${pos.map(p => `<tr data-po="${esc(p.id)}" style="cursor:pointer"><td class="num"><b>${esc(p.poNumber)}</b></td><td>${monthLabel(p.deliveryMonth)}</td><td class="r num">${money(poTotal(p))}</td><td><span class="pill ${p.status}">${STATUS[p.status]}</span></td></tr>`).join('')}</tbody></table>` : `<div style="font-size:13px;color:var(--muted)">No orders with this brand in the book. Orders link to a brand through the vendor name.</div>`}
      <div class="sec">Your call</div>
      ${canSet ? `<div class="row2"><div class="f"><label for="bcSel">Call</label><select id="bcSel">${Object.entries(BCALL).map(([c, l]) => `<option value="${c}" ${r.ecall === c ? 'selected' : ''}>${l}${c === r.call ? ' (suggested)' : ''}</option>`).join('')}</select></div>
        <div class="f"><label for="bcNote">Why</label><input id="bcNote" value="${esc(ov ? ov.note : '')}" placeholder="e.g. Member favorite; keep one table"></div></div>
        <div style="display:flex;gap:8px"><button class="btn primary sm" type="button" data-bcsave="${esc(id)}">Save call</button>${ov ? `<button class="btn sm" type="button" data-bcclear="${esc(id)}">Use the suggested call</button>` : ''}</div>`
      : `<div style="font-size:13px;color:var(--muted)">${ov ? 'Set by the owner.' : 'Suggested from the numbers.'} Only the owner can change a brand's call.</div>`}
    </div>
    <footer><div></div><button class="btn" type="button" data-close="1">Close</button></footer></aside>`;
}
async function saveBrandCall(id){
  const call = $('#bcSel').value, note = $('#bcNote').value.trim();
  if (await write('brandCalls/' + id, {call, note, by: myId, at: new Date().toISOString()})){ toast('Call saved'); setTimeout(() => openBrand(id), 300); }
}
