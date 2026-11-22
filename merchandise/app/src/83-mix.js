/* ---------- Guidelines page, Merchandise mix tab: each role's share of stock dollars against a range in percent of a
   total the owner types (spec 2026-11-19-merch-guidelines). Pure math lives in 19-guides.js. ---------- */
/** What the budget plans while it is linked to the saved total: the factor on target weeks, the average target stock
    over the next 12 months (the total), stock planned at the end of the plan year, and that year's left to buy. */
function gdMixLink(){
  const P = PLANS.cur; if (!P || !ENG || !P.mixTotal) return null;
  const cats = otbCats(), year = ENG.months.slice(0, 12);
  const avgOf = cs => sum(year, k => sum(cs, c => { const r = ENG.cats[c].find(x => x.m === k); return r ? r.eom : 0; })) / year.length;
  const used = committedIn(P);
  const left = withPlan('cur', () => sum(cats, c => seasonBudget(c)) - sum(cats, c => num(used[c])));
  const byRole = Object.fromEntries(MIX_ROLES.map(r => [r, avgOf(cats.filter(c => roleKey(c) === r))]));
  return {P, scale: P.scale, avg: avgOf(cats), byRole, end: sum(cats, c => P.cats[c].target), left};
}
/** The guidelines document with the owner's unsaved edits on top (saved = true: as saved). */
function gdDoc(saved){
  const d = JSON.parse(JSON.stringify(GUIDE || {}));
  if (!saved) for (const p in GD.draft) gdSet(d, p, GD.draft[p]);
  return d;
}
/** The mix as the page shows it (saved values with the owner's unsaved edits on top), or, with saved = true, as saved —
    what To do uses, so its items never change while someone is still editing. null before the first upload. */
function gdMixData(saved){
  if (!BASE) return null;
  const val = p => saved ? gdSaved(p) : gdValue(p);
  // shelf stock, as the budget counts it: on hand less special orders waiting for their customers; 640 left out
  const oh = {}; for (const [c, v] of Object.entries(BASE.cats || {})) if (c !== '640'){ const r = roleKey(c); oh[r] = (oh[r] || 0) + num(v.onHand) - num(v.soOnHand); }
  const rows = (ASSORT && ASSORT.rows) || [], shares = salesShareByRole(rows), sug = suggestedRanges(shares);
  const onHand = Object.values(oh).reduce((t, x) => t + x, 0);
  // the total as the budget will use it: the suggestion while following it (with any unsaved turns targets), else typed
  const doc = gdDoc(saved), gv = guideValues(doc), follow = gv.mix.follow === 'suggested';
  const total = mixTotalOf(doc, rows) || onHand;
  const ranges = Object.fromEntries(MIX_ROLES.map(r => [r, val('mix.ranges.' + r) || sug[r] || [0, 100]]));
  const sugTotal = suggestedTotal(rows, c => turnsFor(gv.bench, c));
  const cost12 = suggestedTotal(rows, 1), turnsMid = sugTotal > 0 ? cost12 / sugTotal : 0;   // the turns the suggestion works out to overall
  return {oh, onHand, shares, sug, total, follow, typed: val('mix.total'), ranges, rows: mixRows(oh, shares || {}, ranges, total), sugTotal, turnsMid, noSales: !shares};
}

function gdMix(){
  const D = gdMixData(); if (!D) return gdCard('Merchandise mix', '', '<div class="empty"><p>The mix loads after the first month-end upload.</p></div>');
  if (D.noSales) return gdCard('Merchandise mix', '', '<div class="empty"><p>The mix needs the subcategory report from a month-end upload: suggested ranges come from each role\'s share of sales.</p></div>');
  const owner = gdOwner(), sum = rangeSum(D.ranges), off = sum.lo > 100 || sum.hi < 100;
  const max = Math.max(55, ...D.rows.map(r => Math.max(r.hi, r.onHand / D.total * 100, r.salesShare * 100) + 5));
  const X = v => (Math.min(v, max) / max * 100).toFixed(2) + '%';
  const totalSaved = D.follow || gdValue('mix.total');
  const head = `<div class="gd-mixtop">
    <label class="gd-tot"><b>Total stock to plan for</b><span>At cost. Every role's dollar target follows its percentages.</span>
      ${owner ? `<input class="gd-in num" id="gdTotal" inputmode="decimal" value="${esc(money(D.total))}" aria-describedby="gdTotErr">` : `<b class="num">${money(D.total)}</b>`}<span id="gdTotErr" class="neg" role="alert"></span>
      ${D.follow ? '<span class="pos"><b>Follows the suggestion</b>: worked out again at every month-end upload and whenever a turns target changes. Type an amount to fix it instead.</span>' : ''}</label>
    <div class="gd-ref"><span>Suggested</span><b class="num">${money(D.sugTotal)}</b><span>each category's 12-month cost of shelf sales ÷ its turns target (${numTxt(Math.round(D.turnsMid * 100) / 100)} turns overall)</span>${owner && !D.follow ? '<button type="button" class="btn ghost sm" data-gdtotal="sug">Follow the suggestion</button>' : ''}</div>
    <div class="gd-ref"><span>On hand now</span><b class="num">${money(D.onHand)}</b><span>Shelf stock at cost, special orders left out (as the budget counts it)</span>${owner && (totalSaved || D.follow) ? '<button type="button" class="btn ghost sm" data-gdtotal="now">Use on hand</button>' : ''}</div>
    <div class="gd-ref"><span>Targets add up to</span><b class="num ${off ? 'neg' : ''}">${sum.lo}–${sum.hi}%</b><span>${off ? "of the total: these ranges can't all be met" : 'of the total'}</span></div></div>
    ${gdMixLinkHtml()}${gdConflictHtml()}
    <div class="gd-lg"><span><i class="b"></i>Target range</span><span><i class="d"></i>Share of stock now</span><span><i class="t"></i>Share of sales, last 12 months</span></div>`;
  const L = savedMixTotal() ? gdMixLink() : null;
  const rows = D.rows.map(r => {
    const path = 'mix.ranges.' + r.role, sg = D.sug[r.role] || [0, 100], changed = !same(D.ranges[r.role], sg), share = r.onHand / D.total * 100;
    const cats = Object.entries(BASE.cats).filter(([c]) => c !== '640' && roleKey(c) === r.role).map(([c, v]) => `${c} ${esc(v.name)} <span class="num">${money(num(v.onHand))}</span>`).join(' · ');
    const pct = (i, v) => owner ? `<input class="gd-in num gd-pct" data-gdmix="${r.role}" data-i="${i}" inputmode="decimal" value="${v}" aria-label="${esc(r.name)} ${i ? 'high' : 'low'} percent">` : `<span class="num">${v}</span>`;
    return `<div class="gd-mrow${changed ? ' changed' : ''}"><div class="gd-what"><b>${esc(r.name)}</b><span class="num">${money(r.onHand)} on hand</span>
        <span>${pct(0, r.lo)}–${pct(1, r.hi)}% = <b class="num">${money(r.loDollar)} – ${money(r.hiDollar)}</b></span>
        <span class="faint">suggested ${sg[0]}–${sg[1]}%${owner && changed ? ` <button type="button" class="btn ghost sm" data-gdreset="${path}">Reset</button>` : ''}</span></div>
      <div class="gd-track" role="img" aria-label="${esc(r.name)}: ${Math.round(share)}% of the total, target ${r.lo}–${r.hi}%, ${Math.round(r.salesShare * 100)}% of sales">
        <div class="gd-band" style="left:${X(r.lo)};width:${X(r.hi - r.lo)}"></div><div class="gd-tick" style="left:${X(r.salesShare * 100)}"></div>
        <div class="gd-dot ${r.status === 'in' ? '' : 'out'}" style="left:${X(share)}"></div></div>
      <div class="gd-verdict ${r.status === 'in' ? 'pos' : 'neg'}">${r.status === 'in' ? 'In range' : `<b class="num">${money(r.gap)}</b> ${r.status}`}${L ? (() => {
        const b = L.byRole[r.role] || 0, pc = L.avg > 0 ? b / L.avg * 100 : 0, out = pc < r.lo - 0.5 || pc > r.hi + 0.5;
        return `<div class="${out ? 'neg' : 'faint'}" style="font-size:12px;font-weight:400">Budget plans ${money(b)} (${Math.round(pc)}%)${out ? ', outside the range' : ''}</div>`; })() : ''}</div>
      <details class="gd-cats"><summary>Categories</summary>${cats}</details></div>`;
  }).join('');
  return gdCard('Merchandise mix', 'Target share of stock dollars, by category role', head + `<div class="gd-mix">${rows}</div>`
    + '<div class="note">Suggested ranges are each role\'s share of the last 12 months\' sales, plus or minus 5 points. A role outside its range adds an item to To do.</div>');
}

/* The budget's side of the link, under the total. */
function gdMixLinkHtml(){
  const saved = savedMixTotal(), D = gdMixData();
  if (!saved) return '<div class="note">Save a total and the budget links to it: every category\'s target weeks are multiplied by one factor so planned stock averages the total.</div>';
  const L = gdMixLink(); if (!L) return '';
  const pending = Math.abs(D.total - saved) > 0.5 ? ` <b>Save to move the budget to ${money(D.total)}</b>; until then it uses ${money(saved)}.` : '';
  return `<div class="note"><b>Linked to the budget.</b> Target weeks × ${L.scale.toFixed(2)}: target stock averages <b class="num">${money(L.avg)}</b> over the next 12 months,
    ${money(L.end)} at the end of ${monthLabel(L.P.window.to)}. ${esc(L.P.fy)} left to buy: <b class="num ${L.left < 0 ? 'neg' : ''}">${money(L.left)}</b> (Budget & open-to-buy).${pending}</div>`;
}
document.addEventListener('change', e => {
  const t = e.target; if (!t.closest || !t.closest('.gd-pane') || !gdOwner()) return;
  if (t.id === 'gdTotal'){
    const v = parseMoney(t.value);
    if (v == null){ const m = $('#gdTotErr'); if (m) m.textContent = 'Type an amount like $700,000.'; return; }
    return gdMixTotal(v, false);
  }
  if (t.dataset.gdmix){
    const r = t.dataset.gdmix, cur = (gdMixData().ranges[r] || [0, 100]).slice(), n = gdParse('n', t.value);
    if (n == null){ toast('Type a percentage.'); return render(); }
    cur[+t.dataset.i] = n; return gdEdit('mix.ranges.' + r, cur);
  }
});
/* Following the suggestion keeps today's suggested amount as the total too, so the budget still has one if a month-end
   ever comes without sales. Typing an amount or using on hand stops following. */
function gdMixTotal(total, follow){
  for (const [p, v] of [['mix.total', total], ['mix.follow', follow ? 'suggested' : undefined]]){
    if (same(v, gdSaved(p))) delete GD.draft[p]; else GD.draft[p] = v;
  }
  render();
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-gdtotal]');
  if (!b || !$('#pane').contains(b) || !gdOwner()) return;
  const D = gdMixData(); if (!D) return;
  if (b.dataset.gdtotal === 'sug') gdMixTotal(D.sugTotal, true); else gdMixTotal(Math.round(D.onHand), false);
});
/** Categories whose budget weeks fall outside their role's range: the two guidelines disagree, so say so where either
    is set. */
function gdConflictHtml(){
  const X = wosConflicts(); if (!X.length) return '';
  return `<div class="warnbox" style="margin:10px 0"><b>${X.length} categor${X.length === 1 ? 'y is' : 'ies are'} budgeted outside ${X.length === 1 ? 'its' : 'their'} role's weeks of supply.</b>
    The budget plans ${X.map(x => `${esc(x.name)} ${wosNum(x.wks)} wks (${esc(x.role)} ${x.lo}–${x.hi})`).join(', ')}.
    Stuck money and the Scorecard judge stock by the role ranges, so they would call this stock ${X[0].dir === 'above' ? 'too heavy' : 'too thin'}.
    To make them agree, change the total (or the turns targets it follows), the target weeks on Budget inputs, or the role ranges on Category roles.</div>`;
}

/** To do items for roles outside their saved mix range at the saved (or on-hand) total. Only once the owner has saved a
    mix (total or a range), so nothing changes for anyone until then, and never without sales data. */
function mixAlerts(){
  const m = guideValues(GUIDE).mix;
  if (!m.total && !m.follow && !Object.keys(m.ranges).length) return [];
  const D = gdMixData(true); if (!D || D.noSales) return [];
  const X = wosConflicts();
  const conflict = X.length ? [{id: 'o-mix-weeks', kind: 'order', sev: 'info', guide: 'mix',
    title: `${X.length} categor${X.length === 1 ? 'y is' : 'ies are'} budgeted outside ${X.length === 1 ? 'its' : 'their'} role's weeks of supply`,
    detail: `Linked to the ${money(D.total)} stock plan, the budget plans ${X.slice(0, 4).map(x => `${x.name} ${wosNum(x.wks)} wks (${x.lo}–${x.hi})`).join(', ')}${X.length > 4 ? ` and ${X.length - 4} more` : ''}. Stuck money judges stock by the role ranges.`,
    action: 'Make the guidelines agree: change the total stock (or turns targets), the target weeks, or the role ranges on the Guidelines page.'}] : [];
  return conflict.concat(D.rows.filter(r => r.status !== 'in').map(r => ({id: 'o-mix-' + r.role, kind: 'order', sev: 'info', guide: 'mix',
    title: `${r.name} is ${money(r.gap)} ${r.status === 'short' ? 'short of' : 'over'} its mix range`,
    detail: `${money(r.onHand)} on hand is ${Math.round(r.onHand / D.total * 100)}% of the ${money(D.total)} you plan to carry; the target is ${r.lo}–${r.hi}%.`,
    action: r.status === 'short' ? 'Put more of the open-to-buy into this role, or change the range on the Guidelines page.' : 'Hold reorders in this role until it sells down, or change the range on the Guidelines page.'})));
}
