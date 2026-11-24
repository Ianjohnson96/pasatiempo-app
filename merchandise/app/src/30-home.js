/* ---------- needs attention ---------- */
function orderAlerts(S){
  const out = [];
  for (const p of POS){
    if (!isOpen(p)) continue;
    const tag = `PO ${p.poNumber} · ${vendorName(p)}`;
    if (p.cancelDate && p.cancelDate < todayISO) out.push({id:'o-cx-'+p.id, kind:'order', sev:'crit', po:p.id, title:`${tag}: past its cancel date`, detail:`Cancel-by was ${dateLabel(p.cancelDate)}.`, action:'Confirm with the vendor that it is still coming, or cancel it.', usd:onOrder(p)});
    else if (p.cancelDate && daysBetween(todayISO, p.cancelDate) <= 14) out.push({id:'o-cw-'+p.id, kind:'order', sev:'warn', po:p.id, title:`${tag}: cancel window closes in ${daysBetween(todayISO, p.cancelDate)} days`, detail:`Last day to cancel or trim is ${dateLabel(p.cancelDate)}.`, action:'Decide now whether you still want all of it.', usd:onOrder(p)});
    if (p.deliveryMonth && p.deliveryMonth < THIS_MONTH) out.push({id:'o-late-'+p.id, kind:'order', sev:'warn', po:p.id, title:`${tag}: late`, detail:`Was due ${monthLabel(p.deliveryMonth)}; ${money(onOrder(p))} still to come${num(p.received) ? ` (${money(num(p.received))} has arrived)` : ''}.`, action:'Chase the vendor for a ship date and change the expected month, or set the order to Cancelled if the rest won\'t come. What arrived still counts.', usd:onOrder(p)});
  }
  for (const c of catList()){
    if (!inOTB(c.code)) continue;
    const used = S.cm(c.code, LAST()), bud = seasonBudget(c.code);
    if (bud <= 0 && used > 0) out.push({id:'o-stop-'+c.code, kind:'order', sev:'crit', cat:c.code, title:`${c.name}: ordering into an overbought category`, detail:`${money(used)} committed; the plan already holds ${money(-bud)} too much.`, action:roleOf(c.code).stop, usd:used});
    else if (bud > 0 && used > bud) out.push({id:'o-over-'+c.code, kind:'order', sev:'crit', cat:c.code, title:`${c.name}: over the ${PLAN.fy} budget by ${money(used - bud)}`, detail:`${money(used)} committed against ${money(bud)}.`, action:'Trim or push out an order, or change the budget with a reason.', usd:used - bud});
    else if (bud > 0 && used > bud * .85) out.push({id:'o-near-'+c.code, kind:'order', sev:'warn', cat:c.code, title:`${c.name}: ${Math.round(used/bud*100)}% of the ${PLAN.fy} budget used`, detail:`${money(bud - used)} left through ${monthLabel(LAST())}.`, action:'Save what is left for proven reorders.'});
  }
  let worst = 0, wm = null;
  for (const k of WIN()){ let r = 0, c = 0; for (const x of catList()) if (inOTB(x.code)){ r += roomThrough(x.code, k); c += S.cm(x.code, k); } const over = c - Math.max(r, 0); if (over > worst + 1){ worst = over; wm = k; } }
  if (wm) out.push({id:'o-room', kind:'order', sev:'warn', title:`${money(worst)} of deliveries arrive before there is room for them`, detail:`Orders landing through ${monthLabel(wm)} run ahead of the plan's receiving room.`, action:'Ask vendors for later ship dates where you can.', usd:worst});
  return out;
}
/* A reorder or out-of-stock item is worth doing only while its category is open to buy by the live budget (this year's
   call), or for balls and gloves, which never run out. The month-end reader lists them either way (buy: true), so a
   guideline or plan change that opens or stops a category shows here at once rather than at the next upload. */
function itemOpenToBuy(i){
  if (!i.buy) return true;
  const c = PLANS.cur && PLANS.cur.cats[i.cat];
  return !c || c.call === 'buy' || c.call === 'replenish' || roleKey(i.cat) === 'consumable';
}
function allAttention(S){
  const items = orderAlerts(S).concat(mixAlerts(),(INS.items || []).filter(itemOpenToBuy).map(i => ({...i, sev: KIND_SEV[i.kind] || 'info'})));
  return items.map(i => ({...i, state: ISTATE[i.id] || null}));
}
const openAttention = S => allAttention(S).filter(i => !i.state);

/* The few decisions worth making this week: order problems, item to-dos and the analysis's suggestions on one scale
   (dollars at stake, at cost), at most two of each kind of decision so one problem can't fill the list. Each can be
   marked Done or Not now (istate/{id}); the full To do list keeps everything. */
const DECIDE = {cut: 'Cut orders', cancel: 'Cancel or confirm', chase: 'Chase', push: 'Push out', reorder: 'Reorder', markdown: 'Mark down', hold: 'Hold buying', fix: 'Fix'};
function topDecisions(S, n = 6){
  const out = [];
  for (let i of openAttention(S)){
    let verb = null, usd = 0, page = null;
    if (i.kind === 'order'){
      const t = i.id.split('-')[1];
      verb = t === 'stop' || t === 'over' ? 'cut' : t === 'cx' || t === 'cw' ? 'cancel' : t === 'late' ? 'chase' : t === 'room' ? 'push' : null;
      usd = num(i.usd);
    } else {
      const m = i.metrics || {};
      if (i.kind === 'reorder' || i.kind === 'stockout'){ verb = 'reorder'; usd = num(m.suggest) * num(m.cost); }
      else if (i.kind === 'aged'){ verb = 'markdown'; usd = num(m.value); }
      else if (i.kind === 'overstock'){ verb = 'hold'; usd = num(m.value); }
      else if (i.kind === 'margin'){ verb = 'fix'; usd = num(m.exposure); }
    }
    // Cutting orders already placed: say what to do with them, then the category's rule for new ones.
    if (verb === 'cut') i = {...i, action: `Trim or cancel the open orders before their cancel dates. After that: ${i.action}`};
    if (verb && usd >= 250) out.push({...i, verb, usd, page});
  }
  const a = typeof anaNow === 'function' ? anaNow() : null;
  for (const x of a ? suggest(a) : []){
    const id = ('sug-' + x.kind + '-' + x.key).replace(/[^A-Za-z0-9_.~:@+-]/g, '_');
    if (ISTATE[id]) continue;
    const verb = x.kind === 'aged' ? 'markdown' : x.kind === 'short' ? 'reorder' : 'hold';
    out.push({id, kind: 'suggestion', sev: x.kind === 'short' ? 'good' : 'warn', title: x.title, detail: x.why, action: x.action, cat: x.cat, verb, usd: x.impact, page: x.page});
  }
  out.sort((p, q) => q.usd - p.usd);
  const per = {}, pick = [];
  for (const d of out){ if ((per[d.verb] || 0) >= 2) continue; per[d.verb] = (per[d.verb] || 0) + 1; pick.push(d); if (pick.length >= n) break; }
  return pick;
}
function decisionHtml(d, k){
  const go = d.po ? `<button class="btn sm" type="button" data-openpo="${esc(d.po)}">Open order</button>`
    : d.page ? `<button class="btn sm" type="button" data-tab="${esc(d.page)}">Look at it</button>`
    : d.cat ? `<button class="btn sm" type="button" data-cat="${esc(d.cat)}">Open category</button>` : '';
  const btns = canAct() ? `<button class="btn sm" type="button" data-istate="${esc(d.id)}" data-v="done">Done</button><button class="btn ghost sm" type="button" data-istate="${esc(d.id)}" data-v="dismissed">Not now</button>` : '';
  return `<li class="item ${d.sev}"><div class="stripe"></div><div class="body">
    <div class="t"><span class="num" style="color:var(--muted);margin-right:6px">${k + 1}.</span><span class="kind order">${DECIDE[d.verb]}</span>${esc(d.title)} <span class="num" style="color:var(--muted);font-weight:400">· ${moneyK(d.usd)}</span></div>
    ${d.sku ? `<div class="d"><span class="num">${esc(d.sku)}</span> · ${esc(d.desc)}</div>` : ''}
    <div class="d">${esc(posDates(d.detail))}</div><div class="a"><b>Do:</b> ${esc(d.action)}</div>
  </div><div class="side">${go}${btns}</div></li>`;
}

/* ---------- top of page ---------- */
function renderMonths(){
  const s = selMonth();
  $('#years').innerHTML = BASE && PLANS.next ? ['cur','next'].map(k => `<button type="button" data-fy="${k}" aria-pressed="${(PLANS[FYSEL] ? FYSEL : 'cur') === k}">${PLANS[k].fy}<span class="now">${k === 'cur' ? 'this year' : 'next year'}</span></button>`).join('') : '';
  const btn = (v, label, now) => `<button type="button" data-month="${v}" aria-pressed="${s === v}">${label}${now ? '<span class="now">now</span>' : ''}</button>`;
  $('#months').innerHTML = btn('season', PLAN.current ? 'Rest of year' : 'Whole year') + WIN().map(m => btn(m, monthShort(m), m === THIS_MONTH)).join('');
  $('#monthHint').textContent = s === 'season' ? `Showing ${periodTxt(PLAN)}: the full ${PLAN.fy} budget and every order due in it.`
    : `Showing everything through the end of ${monthFull(s)}: room to receive by then, and orders arriving by then.`;
}
/* ---------- sidebar ----------
   The pages grouped by job (NAV, 05-nav.js). A page gets a count only when something on it needs you, so a badge
   always means "look here": late or past-cancel orders, things in the store room or late, the urgent items in To do,
   checklists due, SKUs to sort. Under 900px the same list folds into the Menu button (shell.html). */
function sideBadges(S){
  const b = {};
  if (!S) return b;
  // One count failing (a page's data still loading) must not take the whole sidebar with it.
  const put = (id, f) => { try { const v = f(); if (v) b[id] = v; } catch (e){ console.error('Sidebar count for ' + id + ' failed', e); } };
  // Orders & receiving: each open order that needs a look counts once (a problem, past its month, or in the store room).
  put('orders', () => {
    let n = 0, hot = false;
    for (const p of POS){
      if (!isOpen(p)) continue;
      const st = rcvOf(p), bad = rowFlag(p) === 'flag-crit' || (p.deliveryMonth && p.deliveryMonth < THIS_MONTH) || st === 'late';
      if (bad || st === 'arrived'){ n++; if (bad) hot = true; }
    }
    n += receivingQueue().toMatch.length;   // receiving log rows waiting for a person to match
    return n ? [n, hot ? 'hot' : ''] : null;
  });
  put('attention', () => { const n = openAttention(S).filter(i => i.sev === 'crit').length; return n ? [n, 'hot'] : null; });
  put('monthend', () => {
    const a = RPT ? rptAlerts() : [];
    const due = BASE ? nextRefreshMonth() : null, late = !!due && todayISO > due + '-' + pad(new Date(+due.slice(0,4), +due.slice(5,7), 0).getDate());
    const hot = late || a.some(x => x.status === 'overdue');
    return a.length ? [a.length, hot ? 'hot' : ''] : late ? ['!', 'hot'] : null;
  });
  put('scorecard', () => { const n = ssUnsorted().length + ssPlace().length; return n ? [n, ''] : null; });
  return b;
}
/* A sidebar entry's count: the counts of every page it holds (Orders & receiving: late orders plus the store room;
   Home: To do's urgent items), hot if any of them is. */
function sideCount(b, id){
  const parts = Object.keys(b).filter(k => navParent(k) === id).map(k => b[k]);
  if (!parts.length) return null;
  const nums = parts.map(p => p[0]).filter(n => typeof n === 'number');
  return [nums.length ? nums.reduce((a, n) => a + n, 0) : parts[0][0], parts.some(p => p[1] === 'hot') ? 'hot' : ''];
}
/** The view switch under a page's title: the sidebar page's views, the open one pressed; '' for a page without views. */
function renderViewBar(tab){
  const vs = VIEWS[navParent(tab)];
  if (!vs) return '';
  // Receiving carries what needs doing there: orders that should have arrived (red) and log rows to match.
  const badge = id => { if (id !== 'receiving') return ''; try { const o = overdueOrders().length, m = receivingQueue().toMatch.length;
    return o + m ? ` <span class="sb ${o ? 'hot' : ''}">${o + m}</span>` : ''; } catch (e){ return ''; } };
  return `<div class="seg viewbar" role="group" aria-label="${esc(pageLabel(navParent(tab)))} views">${vs.map(([id, l]) => `<button type="button" data-tab="${id}" aria-pressed="${tab === id}">${esc(l)}${badge(id)}</button>`).join('')}</div>`;
}
function renderSide(S){
  const b = sideBadges(S), cur = navParent(TAB);
  const item = ([id, label]) => {
    const [c, tone] = sideCount(b, id) || [];
    const tail = c != null ? `<span class="sb ${tone || ''}">${c}</span>` : '';
    return `<button type="button" class="sitem" data-tab="${sideTarget(id)}"${cur === id ? ' aria-current="page"' : ''}><span class="sl">${esc(label)}</span>${tail}</button>`;
  };
  $('#sideNav').innerHTML = `<div class="sgroup">${item(HOME_PAGE)}</div>` + NAV.map(g => `<div class="sgroup" role="group" aria-label="${esc(g.label)}"><div class="sglab" aria-hidden="true">${esc(g.label)}</div>${g.pages.map(item).join('')}</div>`).join('');
  const foot = $('#sideFootNav'); if (foot) foot.innerHTML = FOOT_PAGES.map(item).join('');
  const [, sub] = TABHEAD[TAB] || ['', ''];
  const grp = NAV.find(g => g.key === pageGroup(TAB));
  $('#pageGroup').textContent = grp ? grp.label : '';
  $('#pageTitle').textContent = pageLabel(cur) || pageLabel(TAB) || 'Home'; $('#pageSub').textContent = sub;
  const vb = $('#viewBar'); if (vb){ vb.innerHTML = renderViewBar(TAB); vb.hidden = !vb.innerHTML; }
  const pv = $('#pageVerdict'); if (pv) pv.innerHTML = verdictHtml(verdictFor(TAB, S));
  $('#pageActs').innerHTML = PAGE_ACTIONS[TAB] ? PAGE_ACTIONS[TAB]() : '';
}
const ANALYSIS_TABS = new Set(['today', 'scorecard', 'rounds', 'trends', 'stuck', 'inventory']);
// A page can put its own buttons in the header, beside + New order: PAGE_ACTIONS[page id] returns their HTML (empty for viewers).
const PAGE_ACTIONS = {brands: () => brandActions()};
// Each page's title (its sidebar label) and one line saying what it is for.
const TABHEAD = Object.fromEntries(Object.entries({
  today: "What needs you this week, and how the shop is doing: buying, arrivals and sales.",
  // Views of Orders & receiving, Upload & count and Settings keep their own line.
  orders: "Every purchase order, by vendor, season and month.",
  receiving: "What's arrived but isn't in the POS yet, and what's due.",
  attention: "Every order problem and item suggestion to work through.",
  vendors: "The vendors you buy from.",
  overview: "Room to buy by category and month, against what's committed.",
  budget: "Room to buy by category and month, against what's committed.",
  settings: "The rules the program grades and suggests by, and the forecast's assumptions.",
  seasons: "Each season's buy: prebooked, reorders and what's held back.",
  forecast: "Sales by month for this year and next.",
  guidelines: "The rules the program grades and suggests by, beside what's suggested and where the shop is now.",
  scorecard: "Every category and subcategory, graded against the rules of thumb.",
  brands: "Brand scorecard and the call for each brand.",
  stuck: "Stock over target and stock that isn't selling, with markdown candidates.",
  trends: "Sales trends, seasonality and spend per round.",
  monthend: "Upload the month-end reports, work the checklist, and see how the program works.",
  inventory: "Quarterly counts and stock on hand by category."
}).map(([id, d]) => [id, [pageLabel(id), d]]));

/* ---------- Budget & open-to-buy ----------
   One page, three views: by category (with the month bar), the month-by-month grid and the worksheet (72-otb.js).
   The view is remembered in this browser (mp.budgetView); an old link to the open-to-buy page opens Month by month. */
const BV_VIEWS = {cats: 'By category', months: 'Month by month', worksheet: 'Worksheet'};
const isBV = v => Object.prototype.hasOwnProperty.call(BV_VIEWS, v);
let BV = (() => { try { const v = localStorage.getItem('mp.budgetView'); return isBV(v) ? v : 'cats'; } catch (_) { return 'cats'; } })();
function setBV(v){ if (!isBV(v)) return; BV = v; try { localStorage.setItem('mp.budgetView', v); } catch (_) {} }
// The view switch sits above the month bar, so it stays put when the month bar comes and goes.
function renderBVBar(){
  let el = $('#bvbar');
  if (!el){ el = document.createElement('div'); el.id = 'bvbar'; el.className = 'bvbar noprint'; $('.monthbar').before(el); }
  el.hidden = TAB !== 'overview';
  if (el.hidden) return;
  el.innerHTML = `<div class="seg" role="group" aria-label="Budget view">${Object.entries(BV_VIEWS).map(([v, l]) => `<button type="button" data-bv="${v}" aria-pressed="${BV === v}">${l}</button>`).join('')}</div>
    <span class="hint">${{cats: 'Room to buy by category, through the month you pick.', months: 'Each category, month by month: left to buy, budget or on order.', worksheet: 'How each month\'s budget is worked out.'}[BV]}</span>`;
}
function budgetTiles(S){
  const s = selMonth(), cats = catList().filter(c => inOTB(c.code)), nOpen = POS.filter(isOpen).length;
  const invTot = Object.values(INV.cats).reduce((a,c) => a + c.cost, 0), invU = Object.values(INV.cats).reduce((a,c) => a + c.units, 0);
  const withRoom = cats.filter(c => roomThrough(c.code, S.m) - S.cm(c.code, S.m) > 0).length;
  const meter = `<div class="meter"><i style="width:${S.room > 0 ? Math.min(100, S.commit / S.room * 100) : (S.commit ? 100 : 0)}%;background:${S.commit > S.room ? 'var(--brick)' : 'var(--cypress)'}"></i></div>`;
  return `<section class="tiles" aria-label="The budget at a glance">
    ${anaTile(s === 'season' ? PLAN.fy + ' budget' : `Room through ${monthShort(s)}`, money(S.room), 'at cost', '', s === 'season' ? `What the plan lets you receive from ${periodTxt(PLAN)}.` : `What the plan lets you receive from ${dateLabel(PLAN.start)} to the end of ${monthFull(s)}.`)}
    ${anaTile(s === 'season' ? 'Committed' : `Committed through ${monthShort(s)}`, money(S.commit), `${nOpen} open orders · ${money(S.open)} on order${S.later ? ` + ${money(S.later)} after ${monthShort(LAST())} ${LAST().slice(0,4)}` : ''}`, meter, s === 'season' ? 'Orders arriving in this period, plus anything already received.' : `Orders arriving by the end of ${monthFull(s)}, plus anything already received. Open orders due later don't count until their month.`)}
    ${anaTile('Left to buy', `<span class="${S.left < 0 ? 'neg' : ''}">${money(S.left)}</span>`, `${withRoom} of ${cats.length} categories have room`, '', S.left < 0 ? 'Negative means more is due in than the plan allows by then.' : 'Room minus committed. Spend it where the category table shows room.')}
    ${anaTile('On hand', money(invTot), `${int(invU)} units · ${dateLabel(INV.asOf)}`, '', `Stock on the shelf at cost, from the SKU Analysis. ${S.receivedSince ? money(S.receivedSince) + ' received since.' : 'Updated every month-end.'}`)}
  </section>`;
}
function catRow(c, S){
  const m = S.m, inv = INV.cats[c.code] || {units:0, cost:0}, wks = catWeeks(c.code, shelfCost(c.code, inv.cost));
  const first = `<td data-l="Category"><span class="code">${c.code}</span>${esc(c.name)} <span class="chip ${c.call}">${CALLTXT[c.call]}</span></td><td data-l="Role" class="crole">${esc(roleOf(c.code).name)}</td>`;
  const wk = `<td data-l="Weeks of supply" class="r num">${wks ? Math.round(wks) : '—'}</td>`;
  if (!inOTB(c.code)){
    const so = S.L.filter(e => e.cat === '640').reduce((a,e) => a + e.open, 0);
    return `<tr data-cat="${c.code}" tabindex="0" aria-label="${esc(c.name)} details">${first}<td data-l="Committed / room"><div class="bfig num">${money(so)} <span>on order</span></div></td><td data-l="Left" class="r" style="color:var(--faint)">Not budgeted</td>${wk}</tr>`;
  }
  const room = roomThrough(c.code, m), season = seasonBudget(c.code), used = S.cm(c.code, m), left = room - used;
  let bar, fig, lft;
  if (season <= 0){
    bar = ['nobar', '']; fig = `<span class="neg"><b>${money(used)}</b> / none</span>`;
    lft = `<span class="neg">Overbought ${money(-season)}</span>`;
  } else if (room <= 0){
    const f = firstRoomMonth(c.code, k => S.cm(c.code, k));
    bar = ['wait', '']; fig = `<b>${money(used)}</b> / <span style="color:var(--ochre)">no room yet</span>`;
    lft = `<span style="color:var(--ochre)">Opens ${f ? monthShort(f) + ' ' + f.slice(0, 4) : 'later'}</span>`;
  } else {
    bar = ['', `<i class="${used > room ? 'over' : ''}" style="width:${Math.min(100, used / room * 100)}%"></i>`]; fig = `<b>${money(used)}</b> / ${money(room)}`;
    lft = used > room ? `<span class="neg">Over by ${money(used - room)}</span>` : `<b style="color:var(--cypress)">${money(left)}</b>`;
  }
  const tip = chCv(c.name, `Committed ${money(used)} · Room ${money(room)} · Left ${money(left)} · ${PLAN.fy} budget ${money(season)}`);
  return `<tr data-cat="${c.code}" tabindex="0" aria-label="${esc(c.name)} details">${first}
    <td data-l="Committed / room" class="rt-wide"><div class="bcell"><div class="bbar ${bar[0]}" data-go="overview:${c.code}"${tip}>${bar[1]}</div><div class="bfig num">${fig} <span>· ${PLAN.fy} ${money(season)}</span></div></div></td>
    <td data-l="Left" class="r num">${lft}</td>${wk}</tr>`;
}
function renderOverview(S){
  if (BV === 'months') return renderOTB('grid');
  if (BV === 'worksheet') return renderOTB('worksheet');
  const s = selMonth();
  // The table takes the full width (its Left column was cut off beside the chart); the room chart sits under it.
  $('#pane').innerHTML = `<div class="astack">${budgetTiles(S)}<div class="stack">
    <section class="panel"><header><h2>Budget by category</h2><span class="lab">Committed / room ${s === 'season' ? 'for ' + PLAN.fy : 'through ' + monthShort(S.m)}</span></header>
      <div class="tbl"><table class="mini rt bcat" style="min-width:640px"><thead><tr><th>Category</th><th>Role</th><th style="width:34%">Committed / room</th><th class="r">Left</th><th class="r">Weeks of supply</th></tr></thead>
      <tbody class="click">${catList().map(c => catRow(c, S)).join('')}</tbody></table></div>
      <div class="note">Click a category to see how its budget was worked out, month by month, and to change it. Weeks of supply is the stock on hand at this year's forecast pace. Budgets come from the forecast on the Forecast page, with data through ${dateLabel(PLAN.asOf)}.${PLAN.current ? '' : ' Next year starts from the stock this year is expected to end with.'}</div></section>
    <section class="panel roomwide"><header><h2>Receiving room by month</h2><span class="lab">Cumulative, all categories</span></header>${roomChart(S)}</section>
    </div></div>`;
}
/* Cumulative receiving room and committed deliveries, all budgeted categories, month by month. */
function roomSeries(S){
  const w = WIN(), room = [], com = [];
  for (const k of w){ let r = 0, c = 0; for (const x of catList()) if (inOTB(x.code)){ r += roomThrough(x.code, k); c += S.cm(x.code, k); } room.push(r); com.push(c); }
  return {w, room, com};
}
// The room chart, its note and its numbers. A month opens Budget & open-to-buy through that month.
function roomChart(S){
  const W = 560, H = 250, L = 56, R = 14, Tp = 14, B = 34, iw = W - L - R, ih = H - Tp - B, {w, room, com} = roomSeries(S);
  let lo = Math.min(0, ...room, ...com), hi = Math.max(0, ...room, ...com);
  const step = 200000; lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step || step;
  const y = v => Tp + ih - (v - lo) / (hi - lo) * ih, bw = iw / w.length, sel = selMonth();
  let s = `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative receiving room versus committed deliveries by month">`;
  if (sel !== 'season' && w.includes(sel)){ const i = w.indexOf(sel); s += `<rect x="${L + i*bw}" y="${Tp}" width="${bw}" height="${ih}" fill="var(--sunk)"/>`; }
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
  s += `<circle cx="${lx}" cy="${ly}" r="3.5" fill="var(--ink)"/><text class="axlab" x="${lx-6}" y="${ly-8}" text-anchor="end">${moneyK(room[room.length-1])} by ${monthShort(LAST())} ${LAST().slice(0,4)}</text>`;
  const readout = i => `Room ${money(room[i])} · Committed ${money(com[i])} · Left ${money(room[i] - com[i])}`;
  w.forEach((m, i) => { s += `<rect class="hit go" x="${L + i*bw}" y="${Tp}" width="${bw}" height="${ih}"${chCv('Through ' + monthLabel(m), readout(i))}${chGo('overview:' + m, 'Budget through ' + monthLabel(m) + ': ' + readout(i))}/>`; });
  s += '</svg>';
  const fp = w.findIndex((m, i) => room[i] > 0);
  const note = `The black line is how much you're allowed to have received by the end of each month. ${PLAN.months[0].otb < 0 ? `It starts below zero because ${monthFull(PLAN.months[0].m)}'s opening stock is ${money(-PLAN.months[0].otb)} more than that month needs. ` : ''}${fp > 0 ? `Overall it turns positive in <b>${monthFull(w[fp])}</b>, but some categories open sooner — see the category table. ` : ''}Click a month to see the budget through it.`;
  return `<div class="legend"><span><i class="sw line" style="background:var(--ink)"></i>Plan room</span><span><i class="sw" style="background:var(--cypress)"></i>Committed deliveries</span><span><i class="sw" style="background:var(--brick)"></i>Over the room</span></div>
    <div class="chart">${s}</div><div class="note">${note}
    ${anaNumbers(['Month', 'Room by month-end', 'Committed by then', 'Left'], w.map((m, i) => [monthLabel(m), money(room[i]), money(com[i]), money(room[i] - com[i])]))}</div>`;
}
