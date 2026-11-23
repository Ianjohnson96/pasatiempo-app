/* ---------- page verdicts ----------
   One plain sentence at the top of every page: the state and what to do (spec 2026-11-22-merch-phase2, stage 1).
   PAGE_VERDICT[page id](S) returns {tone, text} or null when the page's data isn't loaded yet; S is stats() (null
   before the first upload). Tones: ok (green, room or fine), watch (amber, waiting), act (red, needs doing).
   They read page globals only when called, so this file loads before the rest. Rendered by renderSide (30-home.js). */
const vd = (tone, text) => ({tone, text});
const vdPlural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
/* dollars of an order waiting in the store room: its live invoice entries, as Receiving counts them (77-receiving.js) */
const storeRoomOf = p => { const L = rcvLive(p); return storeRoomValue(L.entries, poTotal(p), num(p.received)); };
const PAGE_VERDICT = {
  // Home's own three lines (homeLines, 31-today.js) are its verdict; a header line would repeat the first.
  today: () => null,
  // The year the page shows (PLAN: this year or next); its whole-year Left to buy whatever month is picked.
  overview(S){
    if (!S || !BASE || !PLAN || !PLAN.cats) return null;
    const cats = otbCats(), left = sum(cats, c => seasonBudget(c) - S.cm(c, LAST()));
    const room = cats.map(c => [c, seasonBudget(c) - S.cm(c, LAST())]).sort((a, b) => b[1] - a[1])[0];
    const big = room && room[1] > 0.5 ? ` Most room: ${PLAN.cats[room[0]].name} ${money(room[1])}.` : '';
    return left < -0.5 ? vd('act', `${PLAN.fy} is ${money(-left)} over budget after what's committed.${big}`)
      : vd('ok', `You can still buy ${money(left)} in ${PLAN.fy}.${big}`);
  },
  orders(S){
    if (!S) return null;
    const open = POS.filter(isOpen), late = open.filter(p => rcvOf(p) === 'late').length;
    const onOrd = open.reduce((a, p) => a + onOrder(p), 0);
    if (!open.length) return vd('ok', 'No open orders.');
    return late ? vd('act', `${vdPlural(open.length, 'open order')}, ${money(onOrd)} still to come; ${late} late. Chase the late ones first.`)
      : vd('ok', `${vdPlural(open.length, 'open order')}, ${money(onOrd)} still to come; none late.`);
  },
  receiving(S){
    if (!S) return null;
    let arrived = 0, n = 0;
    for (const p of POS){ if (rcvOf(p) === 'arrived'){ n++; arrived += storeRoomOf(p); } }
    const late = POS.filter(p => isOpen(p) && rcvOf(p) === 'late').length, toMatch = receivingQueue().toMatch.length;
    if (toMatch) return vd('watch', `${vdPlural(toMatch, 'log row')} to match${n ? `; ${vdPlural(n, 'order')} (${money(arrived)}) arrived but not in Jonas yet` : ''}${late ? `; ${late} late` : ''}.`);
    if (n) return vd('watch', `${vdPlural(n, 'order')} (${money(arrived)}) arrived but not in Jonas yet${late ? `; ${late} late` : ''}.`);
    return late ? vd('act', `${vdPlural(late, 'order')} late; nothing waiting to go into Jonas.`) : vd('ok', 'Nothing waiting to go into Jonas, and nothing late.');
  },
  vendors: () => vd('ok', `${vdPlural(VENDORS.length, 'vendor')} on file.`),
  seasons(S){
    if (!S || !BASE || !PLANS.cur) return null;
    const s = seasonOf(THIS_MONTH);
    return s ? vd('ok', `${s.label} is under way. Pick a season to see what's prebooked and what's held back.`) : null;
  },
  scorecard(){
    const a = anaNow(); if (!a) return null;
    const off = a.cats.filter(c => ['wks', 'agedPct', 'gmroi', 'gm'].some(m => grade(m, c[m], c.seg, c.cat) === 'bad'));
    return off.length ? vd('watch', `${vdPlural(off.length, 'category', 'categories')} outside a guideline: ${off.slice(0, 3).map(c => c.name).join(', ')}${off.length > 3 ? ` and ${off.length - 3} more` : ''}.`)
      : vd('ok', 'Every category is within its guidelines.');
  },
  trends(){
    const a = anaNow(); if (!a || !a.shop) return null;
    const g = a.shop.growth;
    return g == null ? vd('ok', 'Sales by month; growth shows once there is a year of data.')
      : vd(g < 0 ? 'watch' : 'ok', `Sales ${money(a.shop.t12)} over the last 12 months, ${g >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(g * 100))}% on a year earlier.`);
  },
  brands(){
    if (typeof BRANDS === 'undefined' || !BRANDS || !BRANDS.rows) return null;
    const call = r => (BCALLS[r.id] && BCALLS[r.id].call) || r.call;
    const red = BRANDS.rows.filter(r => call(r) === 'reduce' || call(r) === 'drop').length;
    return red ? vd('watch', `${vdPlural(red, 'brand')} to carry less or drop. Grow the ones marked Grow.`) : vd('ok', 'No brand needs cutting back.');
  },
  stuck(){
    const a = anaNow(); if (!a) return null;
    const over = stuckMoney(a).overstock.reduce((t, x) => t + x.excess, 0), aged = a.shop.aged || 0, pct = a.shop.agedPct || 0;
    const g = grade('agedPct', pct, null, null);
    return vd(g === 'bad' ? 'act' : g === 'near' ? 'watch' : 'ok', `${money(over)} over the weeks target and ${money(aged)} unsold for 12 months (${Math.round(pct * 100)}% of stock).`);
  },
  monthend(){
    if (!BASE) return vd('watch', 'Upload the month-end reports to start.');
    const due = typeof RPT !== 'undefined' && RPT ? rptAlerts() : [];
    return vd(due.some(x => x.status === 'overdue') ? 'act' : due.length ? 'watch' : 'ok',
      `Jonas data through ${dateLabel(BASE.asOf)}.${due.length ? ` ${vdPlural(due.length, 'checklist')} due.` : ' No checklist due.'}`);
  },
  inventory(){
    if (!INV || !INV.cats || !Object.keys(INV.cats).length) return null;
    const tot = Object.values(INV.cats).reduce((a, c) => a + num(c.cost), 0);
    return vd('ok', `${money(tot)} on hand at cost, from the ${dateLabel(INV.asOf)} SKU Analysis.`);
  },
  guidelines(){
    if (!BASE || !PLANS.cur) return null;
    const x = wosConflicts();
    return x.length ? vd('watch', `${vdPlural(x.length, 'category', 'categories')} budgeted outside their role's weeks of supply. See Budget inputs.`)
      : vd('ok', 'The guidelines agree with each other.');
  },
  forecast(){
    if (!BASE || !PLANS.cur) return null;
    const P = PLANS.cur;
    return vd('ok', `${P.fy} sales forecast ${money(sum(P.order, c => num(P.cats[c].fySales)))}. Budgets follow it.`);
  },
  attention(S){
    if (!S) return null;
    const n = openAttention(S).length;
    return n ? vd('watch', `${vdPlural(n, 'item')} to work through, biggest dollars first.`) : vd('ok', 'Nothing needs attention.');
  }
};
/** A page's verdict, or null if it can't be worked out yet (a verdict must never take the page down). */
function verdictFor(id, S){
  const f = PAGE_VERDICT[id]; if (!f) return null;
  try { return f(S); } catch (e){ console.error('Verdict for ' + id + ' failed', e); return null; }
}
const verdictHtml = v => v ? `<p class="verdict ${v.tone}">${esc(v.text)}</p>` : '';
