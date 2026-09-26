/* ---------- needs attention ---------- */
function orderAlerts(S){
  const out = [];
  for (const p of POS){
    if (p.status !== 'open' && p.status !== 'partial') continue;
    const tag = `PO ${p.poNumber} · ${vendorName(p)}`;
    if (p.cancelDate && p.cancelDate < todayISO) out.push({id:'o-cx-'+p.id, kind:'order', sev:'crit', po:p.id, title:`${tag}: past its cancel date`, detail:`Cancel-by was ${dateLabel(p.cancelDate)}.`, action:'Confirm with the vendor that it is still coming, or cancel it.'});
    else if (p.cancelDate && daysBetween(todayISO, p.cancelDate) <= 14) out.push({id:'o-cw-'+p.id, kind:'order', sev:'warn', po:p.id, title:`${tag}: cancel window closes in ${daysBetween(todayISO, p.cancelDate)} days`, detail:`Last day to cancel or trim is ${dateLabel(p.cancelDate)}.`, action:'Decide now whether you still want all of it.'});
    if (p.deliveryMonth && p.deliveryMonth < THIS_MONTH) out.push({id:'o-late-'+p.id, kind:'order', sev:'warn', po:p.id, title:`${tag}: late`, detail:`Was due ${monthLabel(p.deliveryMonth)}; ${money(onOrder(p))} still outstanding.`, action:'Chase the vendor for a ship date.'});
  }
  for (const c of catList()){
    if (!inOTB(c.code)) continue;
    const used = S.cm(c.code, LAST()), bud = seasonBudget(c.code);
    if (bud <= 0 && used > 0) out.push({id:'o-stop-'+c.code, kind:'order', sev:'crit', cat:c.code, title:`${c.name}: ordering into an overbought category`, detail:`${money(used)} committed; the plan already holds ${money(-bud)} too much.`, action:'Only order against a customer commitment.'});
    else if (bud > 0 && used > bud) out.push({id:'o-over-'+c.code, kind:'order', sev:'crit', cat:c.code, title:`${c.name}: over the ${PLAN.fy} budget by ${money(used - bud)}`, detail:`${money(used)} committed against ${money(bud)}.`, action:'Trim or push out an order, or change the budget with a reason.'});
    else if (bud > 0 && used > bud * .85) out.push({id:'o-near-'+c.code, kind:'order', sev:'warn', cat:c.code, title:`${c.name}: ${Math.round(used/bud*100)}% of the ${PLAN.fy} budget used`, detail:`${money(bud - used)} left through ${monthLabel(LAST())}.`, action:'Save what is left for proven reorders.'});
  }
  let worst = 0, wm = null;
  for (const k of WIN()){ let r = 0, c = 0; for (const x of catList()) if (inOTB(x.code)){ r += roomThrough(x.code, k); c += S.cm(x.code, k); } const over = c - Math.max(r, 0); if (over > worst + 1){ worst = over; wm = k; } }
  if (wm) out.push({id:'o-room', kind:'order', sev:'warn', title:`${money(worst)} of deliveries arrive before there is room for them`, detail:`Orders landing through ${monthLabel(wm)} run ahead of the plan's receiving room.`, action:'Ask vendors for later ship dates where you can.'});
  return out;
}
function allAttention(S){
  const items = orderAlerts(S).concat((INS.items || []).map(i => ({...i, sev: KIND_SEV[i.kind] || 'info'})));
  return items.map(i => ({...i, state: ISTATE[i.id] || null}));
}
const openAttention = S => allAttention(S).filter(i => !i.state);

/* ---------- top of page ---------- */
function renderMonths(){
  const s = selMonth();
  $('#years').innerHTML = BASE && PLANS.next ? ['cur','next'].map(k => `<button type="button" data-fy="${k}" aria-pressed="${(PLANS[FYSEL] ? FYSEL : 'cur') === k}">${PLANS[k].fy}<span class="now">${k === 'cur' ? 'this year' : 'next year'}</span></button>`).join('') : '';
  const btn = (v, label, now) => `<button type="button" data-month="${v}" aria-pressed="${s === v}">${label}${now ? '<span class="now">now</span>' : ''}</button>`;
  $('#months').innerHTML = btn('season', PLAN.current ? 'Rest of year' : 'Whole year') + WIN().map(m => btn(m, monthShort(m), m === THIS_MONTH)).join('');
  $('#monthHint').textContent = s === 'season' ? `Showing ${periodTxt(PLAN)}: the full ${PLAN.fy} budget and every order due in it.`
    : `Showing everything through the end of ${monthFull(s)}: room to receive by then, and orders arriving by then.`;
}
function renderSummary(S){
  const s = selMonth(), cats = catList().filter(c => inOTB(c.code));
  const withRoom = cats.map(c => ({c, left: roomThrough(c.code, S.m) - S.cm(c.code, S.m)})).filter(x => x.left > 0).sort((a,b) => b.left - a.left);
  const noRoom = cats.filter(c => roomThrough(c.code, S.m) - S.cm(c.code, S.m) <= 0);
  const att = openAttention(S), reo = att.filter(i => i.kind === 'reorder' || i.kind === 'stockout').length, ord = att.filter(i => i.kind === 'order').length;
  const lines = [];
  if (s === 'season') lines.push(`From ${periodTxt(PLAN)} the plan lets you receive <b>${money(S.room)}</b> at cost. <b>${money(S.commit)}</b> is on order or already in, which leaves <b>${money(S.left)}</b> to buy.`);
  else if (S.left >= 0) lines.push(`By the end of ${monthFull(s)} you can still receive <b>${money(S.left)}</b> across all categories${S.commit ? `, after the ${money(S.commit)} already committed` : ''}.`);
  else if (S.room <= 0) lines.push(`Overall there's no room to receive by the end of ${monthFull(s)}: stock on hand is still <b class="neg">${money(-S.room)}</b> more than the plan allows by then${S.commit ? `, and <b>${money(S.commit)}</b> of orders are due in on top of that` : ''}. Some categories still have room — they're listed next.`);
  else lines.push(`Orders due in by the end of ${monthFull(s)} come to <b>${money(S.commit)}</b>, which is <b class="neg">${money(-S.left)}</b> more than the <b>${money(S.room)}</b> of room the plan allows by then.`);
  if (withRoom.length) lines.push(`<b>Room to buy${s === 'season' ? '' : ' now'}:</b> ${withRoom.slice(0,4).map(x => `${esc(x.c.name)} (${money(x.left)})`).join(', ')}${withRoom.length > 4 ? `, and ${withRoom.length - 4} more` : ''}.`);
  if (noRoom.length && s !== 'season'){
    const waits = noRoom.filter(c => seasonBudget(c.code) > 0).map(c => { const f = firstRoomMonth(c.code, k => S.cm(c.code, k)); return `${esc(c.name)}${f ? ' (opens ' + monthShort(f) + ')' : ''}`; });
    const stops = noRoom.filter(c => seasonBudget(c.code) <= 0).map(c => esc(c.name));
    if (waits.length) lines.push(`<b>Wait before buying:</b> ${waits.join(', ')}. September's stock is still above plan in these, so goods that arrive earlier just sit.`);
    if (stops.length) lines.push(`<b>Don't buy in ${PLAN.fy}:</b> ${stops.join(', ')} — already overbought for the whole year.`);
  }
  if (S.arriving && s !== 'season') lines.push(`<b>${money(S.arriving)}</b> of orders are due to arrive in ${monthFull(s)}.`);
  lines.push(`<b>To do:</b> ${ord ? `${ord} order ${ord === 1 ? 'issue' : 'issues'}, ` : ''}${reo} items to reorder, and ${att.length - ord - reo} other suggestions — see <button class="btn ghost sm" type="button" data-tab="attention" style="padding:0">To do</button>.`);
  $('#summary').innerHTML = `<h2>${s === 'season' ? PLAN.fy + ' at a glance' : monthFull(s) + ' ' + s.slice(0,4) + ' at a glance'}</h2><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>`;
}
function renderKpis(S){
  const s = selMonth(), att = openAttention(S), crit = att.filter(i => i.sev === 'crit').length;
  const invTot = Object.values(INV.cats).reduce((a,c) => a + c.cost, 0), invU = Object.values(INV.cats).reduce((a,c) => a + c.units, 0);
  const catsWithRoom = catList().filter(c => inOTB(c.code) && roomThrough(c.code, S.m) - S.cm(c.code, S.m) > 0).length;
  const k = (lab, v, sub, expl, extra = '') => `<div class="kpi"><div class="lab">${lab}</div><div class="v num">${v}</div><div class="s">${sub}</div>${extra}<div class="x">${expl}</div></div>`;
  $('#kpis').innerHTML =
    k(s === 'season' ? PLAN.fy + ' budget' : `Room through ${monthShort(s)}`, money(S.room), 'at cost', s === 'season' ? `What the plan lets you receive from ${periodTxt(PLAN)}.` : `What the plan lets you receive from ${dateLabel(PLAN.start)} to the end of this month.`) +
    k('Committed', money(S.commit), `${POS.filter(p => p.status === 'open' || p.status === 'partial').length} open orders`, 'Orders arriving in this period, plus anything already received.', `<div class="meter"><i style="width:${S.room > 0 ? Math.min(100, S.commit / S.room * 100) : (S.commit ? 100 : 0)}%;background:${S.commit > S.room ? 'var(--brick)' : 'var(--cypress)'}"></i></div>`) +
    k('Left to buy', `<span class="${S.left < 0 ? 'neg' : ''}">${money(S.left)}</span>`, `${catsWithRoom} of 15 categories have room`, S.left < 0 ? 'Negative means more is due in than the plan allows by then.' : 'Room minus committed. Spend it where the category list shows room.') +
    k('On hand', money(invTot), `${int(invU)} units · ${dateLabel(INV.asOf)}`, `Stock on the shelf at cost, from the SKU Analysis. ${S.receivedSince ? money(S.receivedSince) + ' received since.' : 'Updated every month-end.'}`) +
    k('On order', money(S.open), S.later ? `+ ${money(S.later)} after ${monthShort(LAST())} ${LAST().slice(0,4)}` : 'not yet received', 'Still to arrive from vendors on open orders.') +
    k('To do', `<span style="color:${crit ? 'var(--brick)' : att.length ? 'var(--ochre)' : 'inherit'}">${att.length}</span>`, `${crit} urgent`, 'Order problems and item suggestions to work through.');
}
function renderTabs(S){
  const att = openAttention(S), crit = att.filter(i => i.sev === 'crit').length;
  const due = BASE ? nextRefreshMonth() : null, overdue = due && todayISO > due + '-' + pad(new Date(+due.slice(0,4), +due.slice(5,7), 0).getDate());
  const T = [['overview','Overview'],['forecast','Forecast'],['otb','Open-to-buy'],['orders','Orders', POS.length],['brands','Brands'],['attention','To do', att.length, crit],['inventory','Inventory & counts'],['monthend','Month-end', overdue ? '!' : null, overdue],['help','How it works']];
  $('#tabs').innerHTML = T.map(([id,l,c,hot]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${TAB === id}">${l}${c != null ? `<span class="cnt ${hot ? 'hot' : ''}">${c}</span>` : ''}</button>`).join('');
}

/* ---------- overview ---------- */
function catRow(c, S){
  const m = S.m, used = S.cm(c.code, m), inv = INV.cats[c.code] || {units:0, cost:0};
  const wks = wksNow(c.code, inv.cost);
  const chip = `<span class="chip ${c.call}">${CALLTXT[c.call]}</span>`;
  const invLine = `<span class="mono">On hand ${money(inv.cost)} · ${int(inv.units)} units · ${wks ? Math.round(wks) + ' wks of supply' : '—'}</span>`;
  if (!inOTB(c.code)){
    const so = S.L.filter(e => e.cat === '640').reduce((a,e) => a + e.open, 0);
    return `<div class="cat" data-cat="${c.code}"><span class="code">${c.code}</span><span class="nm">${esc(c.name)} ${chip}</span><span class="fig">${money(so)} <span style="color:var(--faint)">on order</span></span>
      <div class="detail">${invLine}<span>Customer-ordered; not budgeted.</span></div></div>`;
  }
  const room = roomThrough(c.code, m), season = seasonBudget(c.code), left = room - used;
  let bar, fig, msg;
  if (season <= 0){
    bar = `<div class="bar nobar"></div>`; fig = `<span class="neg"><b>${money(used)}</b> / none</span>`;
    msg = `<span class="neg">Overbought ${money(-season)} for ${PLAN.fy}.</span>`;
  } else if (room <= 0){
    const f = firstRoomMonth(c.code, k => S.cm(c.code, k));
    bar = `<div class="bar wait"></div>`; fig = `<b>${money(used)}</b> / <span style="color:var(--ochre)">no room yet</span>`;
    msg = `<span style="color:var(--ochre)">Room opens ${f ? 'in ' + monthFull(f) : 'later'}.</span> <span>${PLAN.fy} ${money(season)}</span>`;
  } else {
    const pct = Math.min(100, used / room * 100);
    bar = `<div class="bar"><i class="${used > room ? 'over' : ''}" style="width:${pct}%"></i></div>`;
    fig = `<b>${money(used)}</b> / ${money(room)}`;
    msg = (used > room ? `<span class="neg">Over by ${money(used - room)}</span>` : `<span><b style="color:var(--cypress)">${money(left)} left</b>${m !== LAST() ? ' by end of ' + monthShort(m) : ''}</span>`) + `<span>${PLAN.fy} ${money(season)}</span>`;
  }
  return `<div class="cat" data-cat="${c.code}" tabindex="0" role="button" aria-label="${esc(c.name)} details"><span class="code">${c.code}</span><span class="nm">${esc(c.name)} ${chip}</span><span class="fig">${fig}</span>${bar}<div class="detail">${msg}${invLine}</div></div>`;
}
function renderOverview(S){
  const att = openAttention(S).sort((a,b) => ({crit:0,warn:1,good:2,info:3}[a.sev] - {crit:0,warn:1,good:2,info:3}[b.sev]) || (b.priority || 0) - (a.priority || 0)).slice(0,6);
  $('#pane').innerHTML = `<div class="grid">
    <section class="panel"><header><h2>Budget by category</h2><span class="lab">Committed / room ${selMonth() === 'season' ? 'for ' + PLAN.fy : 'through ' + monthShort(S.m)}</span></header>
      ${catList().map(c => catRow(c, S)).join('')}
      <div class="note">Click a category to see how its budget was worked out, month by month, and to change it. Budgets come from the forecast on the Forecast page, with data through ${dateLabel(PLAN.asOf)}.${PLAN.current ? '' : ' Next year starts from the stock this year is expected to end with.'}</div></section>
    <div class="stack">
      <section class="panel"><header><h2>Receiving room by month</h2><span class="lab">Cumulative, all categories</span></header>
        <div class="legend"><span><i class="sw line" style="background:var(--ink)"></i>Plan room</span><span><i class="sw" style="background:var(--cypress)"></i>Committed deliveries</span><span><i class="sw" style="background:var(--brick)"></i>Over the room</span></div>
        <div class="chart" id="chart"></div>
        <div class="note" id="roomNote"></div></section>
      <section class="panel"><header><h2>Top things to do</h2><button class="btn ghost sm" type="button" data-tab="attention">See all</button></header>
        <ul class="items">${att.length ? att.map(i => itemHtml(i, true)).join('') : '<li class="item good"><div class="stripe"></div><div class="body"><div class="t">Nothing needs attention.</div></div></li>'}</ul></section>
    </div></div>`;
  renderChart(S);
}
function renderChart(S){
  const W = 560, H = 250, L = 56, R = 14, Tp = 14, B = 34, iw = W - L - R, ih = H - Tp - B, w = WIN();
  const room = [], com = [];
  for (const k of w){ let r = 0, c = 0; for (const x of catList()) if (inOTB(x.code)){ r += roomThrough(x.code, k); c += S.cm(x.code, k); } room.push(r); com.push(c); }
  let lo = Math.min(0, ...room, ...com), hi = Math.max(0, ...room, ...com);
  const step = 200000; lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step || step;
  const y = v => Tp + ih - (v - lo) / (hi - lo) * ih, bw = iw / w.length, sel = selMonth();
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative receiving room versus committed deliveries by month">`;
  if (sel !== 'season'){ const i = w.indexOf(sel); s += `<rect x="${L + i*bw}" y="${Tp}" width="${bw}" height="${ih}" fill="var(--sunk)"/>`; }
  for (let v = lo; v <= hi; v += step){ s += `<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule)" stroke-width="${v === 0 ? 0 : 1}"/><text class="axis" x="${L-8}" y="${y(v)+3.5}" text-anchor="end">${moneyK(v)}</text>`; }
  w.forEach((m, i) => {
    const x = L + i*bw + bw*.22, bwid = bw*.56, v = com[i];
    if (v > 0){ const inR = Math.max(0, Math.min(v, room[i])), ov = v - inR;
      if (inR > 0) s += `<rect x="${x}" y="${y(inR)}" width="${bwid}" height="${y(0)-y(inR)}" fill="var(--cypress)"/>`;
      if (ov > 0) s += `<rect x="${x}" y="${y(v)}" width="${bwid}" height="${y(inR)-y(v)}" fill="var(--brick)"/>`; }
    s += `<text class="axis" x="${L + i*bw + bw/2}" y="${H - B + 17}" text-anchor="middle" ${m === sel ? 'style="fill:var(--ink);font-weight:600"' : ''}>${monthShort(m)}</text>`;
  });
  s += `<line x1="${L}" x2="${W-R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--muted)"/>`;
  let d = ''; w.forEach((m, i) => { const x0 = L + i*bw; d += (i ? ` L${x0},${y(room[i])}` : `M${x0},${y(room[i])}`) + ` L${x0 + bw},${y(room[i])}`; });
  s += `<path d="${d}" fill="none" stroke="var(--ink)" stroke-width="2"/>`;
  const lx = L + iw, ly = y(room[room.length-1]);
  s += `<circle cx="${lx}" cy="${ly}" r="3.5" fill="var(--ink)"/><text class="axlab" x="${lx-6}" y="${ly-8}" text-anchor="end">${moneyK(room[room.length-1])} by ${monthShort(LAST())} ${LAST().slice(0,4)}</text></svg>`;
  $('#chart').innerHTML = s;
  const fp = w.findIndex((m, i) => room[i] > 0);
  $('#roomNote').innerHTML = `The black line is how much you're allowed to have received by the end of each month. ${PLAN.months[0].otb < 0 ? `It starts below zero because ${monthFull(PLAN.months[0].m)}'s opening stock is ${money(-PLAN.months[0].otb)} more than that month needs. ` : ''}${fp > 0 ? `Overall it turns positive in <b>${monthFull(w[fp])}</b>, but some categories open sooner — see the list.` : ''}`;
}
