
/* ---------- open-to-buy page: category x month grid ---------- */
let OTBV = (() => { try { return JSON.parse(localStorage.getItem('mp.otb')) || {}; } catch (_) { return {}; } })();
OTBV = {view: 'cur', metric: 'left', cat: 'all', ...OTBV};
const saveOTBV = () => { try { localStorage.setItem('mp.otb', JSON.stringify(OTBV)); } catch (_) {} };
const otbCats = () => BASE.order.filter(c => !(BASE.exclude || ['640']).includes(c));
function planOfMonth(k){ for (const key of ['cur', 'next']){ const P = PLANS[key]; if (P && P.months.some(x => x.m === k)) return P; } return null; }
function viewMonths(){
  if (OTBV.view === 'next') return PLANS.next.months.map(x => x.m);
  if (OTBV.view === 'cal'){ const y = PLANS.cur.fyNum; return Array.from({length: 12}, (_, i) => y + '-' + pad(i + 1)).filter(planOfMonth); }
  return PLANS.cur.months.map(x => x.m);
}
function committedMatrix(){
  const out = {};
  for (const P of [PLANS.cur, PLANS.next]) if (P) for (const e of ledger(POS, P)){
    if (!e.b || e.b === 'before' || e.b === 'later') continue;
    const r = out[e.cat] = out[e.cat] || {}; r[e.b] = (r[e.b] || 0) + e.committed;
  }
  return out;
}
function budgetAt(c, k){
  const P = planOfMonth(k); if (!P || P.cats[c].plan == null) return 0;
  const adj = (ADJS[adjKey(P)] || []).filter(a => a.cat === c && (a.month || P.window.to) === k);
  return num(P.cats[c].mplan[k]) + sum(adj, a => a.amount);
}
function renderOTB(){
  if (!BASE){ $('#pane').innerHTML = `<section class="panel"><div class="note">The open-to-buy grid loads after the first month-end refresh.</div></section>`; return; }
  const ms = viewMonths(), CM = committedMatrix(), cats = otbCats();
  const val = (c, k) => { const b = budgetAt(c, k), u = num((CM[c] || {})[k]); return OTBV.metric === 'budget' ? b : OTBV.metric === 'committed' ? u : b - u; };
  const cell = v => `<td class="r num ${v < -0.5 ? 'neg cneg' : v > 0.5 && OTBV.metric === 'left' ? 'cpos' : ''}">${Math.abs(v) < 0.5 ? '<span style="color:var(--faint)">–</span>' : moneyK(v)}</td>`;
  const rows = cats.map(c => { const vs = ms.map(k => val(c, k)); return `<tr data-cat="${c}" style="cursor:pointer"><td><span class="code">${c}</span> ${esc(BASE.cats[c].name)}</td>${vs.map(cell).join('')}<td class="r num"><b>${moneyK(sum(vs))}</b></td></tr>`; }).join('');
  const colTot = ms.map(k => sum(cats, c => val(c, k)));
  let run = 0; const cum = colTot.map(v => run += v);
  const so = sum(ms, k => num((CM['640'] || {})[k]));
  const vbtn = (v, l) => `<button type="button" class="fchip" data-otbv="${v}" aria-pressed="${OTBV.view === v}">${l}</button>`;
  const mbtn = (v, l) => `<button type="button" class="fchip" data-otbm="${v}" aria-pressed="${OTBV.metric === v}">${l}</button>`;
  const title = {cur: `${PLANS.cur.fy} · ${periodTxt(PLANS.cur)}`, next: `${PLANS.next.fy} · ${periodTxt(PLANS.next)}`, cal: `Calendar ${PLANS.cur.fyNum} · Jan – Dec`}[OTBV.view];
  const explain = {budget: 'What the plan lets you bring in each month, at cost. A negative month means stock is already above what that month needs.',
    committed: 'Orders due to arrive each month (or already received), at cost.', left: 'Budget minus committed for each month. Green is room to buy; red is more coming in than the month needs.'}[OTBV.metric];
  const carry = PLANS.next ? cats.filter(c => PLANS.next.cats[c].carry > 0.5) : [];
  $('#pane').innerHTML = `<section class="panel"><header><h2>Open-to-buy by month</h2><span class="lab">${esc(title)}</span></header>
    <div class="chips">${vbtn('cur', `This year (${PLANS.cur.fy})`)}${vbtn('next', `Next year (${PLANS.next.fy})`)}${vbtn('cal', `Calendar ${PLANS.cur.fyNum}`)}<span style="width:14px"></span>${mbtn('left', 'Left to buy')}${mbtn('budget', 'Budget')}${mbtn('committed', 'On order')}</div>
    <div class="note" style="border-bottom:1px solid var(--rule)">${explain} Click a category for its details.${OTBV.view === 'cal' ? ` Jan–Apr come from the ${PLANS.cur.fy} plan, May–Dec from ${PLANS.next.fy}.` : ''}</div>
    <div class="tbl"><table class="mini otbgrid" style="min-width:${220 + ms.length * 74}px"><thead><tr><th>Category</th>${ms.map(k => `<th class="r">${monthShort(k)}<div class="lab" style="letter-spacing:0">${k.slice(2, 4)}</div></th>`).join('')}<th class="r">Total</th></tr></thead>
      <tbody class="click">${rows}</tbody>
      <tfoot><tr><td><b>All categories</b></td>${colTot.map(v => `<td class="r num ${v < 0 ? 'neg' : ''}"><b>${moneyK(v)}</b></td>`).join('')}<td class="r num"><b>${moneyK(sum(colTot))}</b></td></tr>
      <tr><td style="color:var(--muted)">Running total</td>${cum.map(v => `<td class="r num ${v < 0 ? 'neg' : ''}" style="color:var(--muted)">${moneyK(v)}</td>`).join('')}<td></td></tr></tfoot></table></div>
    ${so ? `<div class="note">Special Orders due in these months: ${money(so)} (not budgeted).</div>` : ''}</section>
  ${carry.length && OTBV.view !== 'cur' ? `<section class="panel" style="margin-top:18px"><header><h2>What ${PLANS.next.fy} inherits</h2><span class="lab">Stock above plan on ${dateLabel(PLANS.next.start)}</span></header>
    <div class="note">Next year's budget starts from the stock this year is expected to end with. If a category is already overbought, or you order more than this year's budget, the extra is still on the shelf in May and comes out of next year's budget.</div>
    <table class="mini" style="margin:0 16px 14px;width:calc(100% - 32px)"><thead><tr><th>Category</th><th class="r">Extra stock carried in</th><th>Why</th></tr></thead><tbody>${carry.map(c => `<tr><td>${esc(BASE.cats[c].name)}</td><td class="r num">${money(PLANS.next.cats[c].carry)}</td><td>${PLANS.cur.cats[c].plan < 0 ? `Already ${money(-PLANS.cur.cats[c].plan)} over this year's plan` : 'Orders beyond this year\'s budget'}</td></tr>`).join('')}</tbody></table></section>` : ''}
  ${worksheet(ms, CM)}`;
}
function worksheet(ms, CM){
  const cats = OTBV.cat === 'all' ? otbCats() : [OTBV.cat];
  const pick = f => ms.map(k => sum(cats, c => { const r = ENG.cats[c].find(x => x.m === k); return r ? f(r) : 0; }));
  const sales = pick(r => r.sales), cogs = pick(r => r.cogs), bom = pick(r => r.bom), eom = pick(r => r.eom), otb = pick(r => r.otb);
  const com = ms.map(k => sum(cats, c => num((CM[c] || {})[k])));
  const row = (lab, vs, cls = '', note = '') => `<tr class="${cls}"><td>${lab}${note ? `<div style="font-size:11.5px;color:var(--faint)">${note}</div>` : ''}</td>${vs.map(v => `<td class="r num ${v < -0.5 ? 'neg' : ''}">${moneyK(v)}</td>`).join('')}</tr>`;
  const part = BASE.partial && ms.includes(BASE.partial.m);
  return `<section class="panel" style="margin-top:18px"><header><h2>Open-to-buy worksheet</h2>
    <select id="otbCat" aria-label="Category">${['all'].concat(otbCats()).map(c => `<option value="${c}" ${OTBV.cat === c ? 'selected' : ''}>${c === 'all' ? 'All budgeted categories' : c + ' ' + esc(BASE.cats[c].name)}</option>`).join('')}</select></header>
    <div class="tbl"><table class="mini" style="min-width:${220 + ms.length * 74}px"><thead><tr><th></th>${ms.map(k => `<th class="r">${monthShort(k)} ${k.slice(2, 4)}</th>`).join('')}</tr></thead><tbody>
      ${row('Planned sales (retail)', sales, '', part ? `${monthShort(BASE.partial.m)} is what's left after ${money(BASE.partial.actual)} sold so far` : '')}
      ${row('Cost of those sales', cogs)}
      ${row('Opening stock', bom, '', 'At cost. First month = on hand; then last month\'s target')}
      ${row('Target closing stock', eom, '', 'Target weeks × next four months\' cost of sales ÷ 17.3')}
      ${row('<b>Budget = target − opening + cost of sales</b>', otb, 'tot')}
      ${row('On order / received', com)}
      ${row('<b>Left to buy</b>', otb.map((v, i) => v - com[i]), 'tot')}
    </tbody></table></div>
    <div class="note">This is the standard retail open-to-buy, one month at a time. It ignores budget changes; those show in the grid above.${cats.length === 1 ? ` Target weeks for ${esc(BASE.cats[cats[0]].name)}: ${assumptions().wos[cats[0]]}.` : ''}</div></section>`;
}
