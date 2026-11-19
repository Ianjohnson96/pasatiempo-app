/* ---------- Season buys ----------
   Read-only. Seasons by delivery month (18-ops.js seasonOf). Committed cost comes from the same ledger the Budget page uses;
   "room" and "held back" are that page's own month figures (budgetAt and committed, as in the Month by month grid),
   summed over the season's months that fall inside a plan window. No new budget math. Special Orders (640) are left out. */
let SB = {season: null};
/* One row per order line, in the month it counts. A received delivery counts in the month it arrived. */
function seasonRows(){
  const rows = [], plans = [PLANS.cur, PLANS.next].filter(Boolean), lastP = plans[plans.length - 1];
  for (const P of plans) for (const e of ledger(POS, P)){
    const p = POS.find(x => x.id === e.po); if (!p || !e.committed) continue;
    let m = e.b; if (m === 'later' && P === lastP) m = p.deliveryMonth; if (!/^\d{4}-\d{2}/.test(m || '')) continue;
    rows.push({month: m.slice(0, 7), cat: e.cat, brand: brandNameFor(vendorName(p)) || '', orderDate: p.orderDate, amount: e.committed, units: e.units});
  }
  return rows;
}
function renderSeasons(S){
  if (!BASE || !PLANS.cur){ $('#pane').innerHTML = `<section class="panel"><div class="note">Season buys load after the first month-end refresh.</div></section>`; return; }
  const rows = seasonRows(), list = seasonList(rows, THIS_MONTH);
  if (!list.length){ $('#pane').innerHTML = `<section class="panel"><header><h2>Season buys</h2></header><div class="empty"><p>No orders are in the book yet.</p></div></section>`; return; }
  const season = list.find(s => s.label === SB.season) || list[0]; SB.season = season.label;
  const T = seasonBuys(rows, season), months = seasonMonths(season), CM = committedMatrix();
  const inPlan = months.filter(planOfMonth), partial = inPlan.length < months.length;
  const cats = otbCats().filter(c => T.byCat[c] || inPlan.some(k => budgetAt(c, k)));
  const crow = cats.map(c => {
    const room = sum(inPlan, k => budgetAt(c, k)), used = sum(inPlan, k => num((CM[c] || {})[k]));
    return {c, name: BASE.cats[c].name, room, committed: num(T.byCat[c]), held: room - used};
  }).filter(r => r.room || r.committed);
  const held = sum(crow, r => r.held), roomAll = sum(crow, r => r.room);
  const tile = (lab, v, d) => `<div class="tile"><div class="lab">${lab}</div><div class="v">${v}</div>${d ? `<div class="d">${d}</div>` : ''}</div>`;
  const pct = v => v && T.committed ? Math.round(v / T.committed * 100) + '% of the season' : '';
  const series = [{name: 'Prebooked', k: 1, values: months.map(k => T.byMonth[k].prebooked)}, {name: 'Reorders', k: 2, values: months.map(k => T.byMonth[k].reorders)}];
  const chips = list.map(s => `<button type="button" class="fchip" data-sbseason="${esc(s.label)}" aria-pressed="${s.label === season.label}">${esc(s.label)}</button>`).join('');
  const heldTxt = v => v < -0.5 ? `<span class="neg">${money(-v)} over budget</span>` : money(v);
  const pctHeld = r => r.room > 0 ? Math.round(r.held / r.room * 100) + '%' : '—';
  $('#pane').innerHTML = `<section class="panel"><header><h2>Season buys</h2><span class="lab">${esc(season.label)} · ${months.map(monthShort).join(', ')}</span></header>
    <div class="chips" role="group" aria-label="Season">${chips}</div>
    <div class="note">Cost of what is committed for deliveries in the season: ordered and still to come, plus goods already received. Prebooked means the order was placed before the season began; orders placed during it are reorders. Special Orders are left out.</div>
    <div style="padding:0 16px 14px"><section class="tiles" aria-label="${esc(season.label)} at a glance">
      ${tile('Committed', money(T.committed), `${int(T.units)} units at cost`)}
      ${tile('Prebooked', money(T.prebooked), pct(T.prebooked))}
      ${tile('Reorders', money(T.reorders), pct(T.reorders))}
      ${tile('Held back', `<span class="${held < -0.5 ? 'neg' : ''}">${money(held)}</span>`, held < -0.5 ? 'Over budget for the season' : `of ${money(roomAll)} room, not yet committed`)}
    </section></div></section>
  <section class="ccard" style="margin-top:18px"><h3>Committed by month</h3><div class="cs">At cost, by the month goods are due or arrived.</div>
    ${chLegend(series)}${chStack({labels: months.map(k => monthShort(k)), series, fmt: moneyK, label: `${season.label} committed by month, prebooked and reorders`, go: i => 'overview:' + months[i]})}
    ${anaNumbers(['Month', 'Prebooked', 'Reorders', 'Total'], months.map(k => [monthLabel(k), money(T.byMonth[k].prebooked), money(T.byMonth[k].reorders), money(T.byMonth[k].prebooked + T.byMonth[k].reorders)]))}</section>
  <section class="panel" style="margin-top:18px"><header><h2>By category</h2><span class="lab">${crow.length} categories</span></header>
    <div class="note">Room and held back are the Budget page's own figures for these months: room is what the plan allows, held back is room not yet committed (negative means over budget).${partial ? ` Only ${inPlan.map(monthShort).join(', ') || 'none of the months'} fall inside a plan, so room and held back cover those months.` : ''}</div>
    <div class="tbl"><table class="rt"><thead><tr><th>Category</th><th class="r">Room in season</th><th class="r">Committed</th><th class="r">Held back</th><th class="r">% held back</th></tr></thead>
    <tbody class="click">${crow.map(r => `<tr data-go="overview:${esc(r.c)}" tabindex="0"><td><span class="code">${esc(r.c)}</span> ${esc(r.name)}</td><td data-l="Room in season" class="r num">${money(r.room)}</td><td data-l="Committed" class="r num">${money(r.committed)}</td><td data-l="Held back" class="r num">${heldTxt(r.held)}</td><td data-l="% held back" class="r num">${pctHeld(r)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td><b>All categories</b></td><td class="r num"><b>${money(roomAll)}</b></td><td class="r num"><b>${money(sum(crow, r => r.committed))}</b></td><td class="r num"><b>${heldTxt(held)}</b></td><td class="r num"><b>${roomAll > 0 ? Math.round(held / roomAll * 100) + '%' : '—'}</b></td></tr></tfoot></table></div></section>
  <section class="panel" style="margin-top:18px"><header><h2>By brand</h2><span style="display:flex;gap:8px;align-items:center"><span class="lab">${T.byBrand.length} brands</span><button class="btn sm" type="button" data-sborders="${esc(season.label)}">See the orders</button></span></header>
    <div class="note">Committed cost only; the plan has no budget for individual brands.</div>
    <div class="tbl"><table class="rt"><thead><tr><th>Brand</th><th class="r">Committed</th><th class="r">Prebooked</th><th class="r">Reorders</th><th class="r">Units</th></tr></thead>
    <tbody>${T.byBrand.map(b => `<tr><td><b>${esc(b.brand)}</b></td><td data-l="Committed" class="r num">${money(b.committed)}</td><td data-l="Prebooked" class="r num">${b.prebooked ? money(b.prebooked) : '—'}</td><td data-l="Reorders" class="r num">${b.reorders ? money(b.reorders) : '—'}</td><td data-l="Units" class="r num">${int(b.units)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
