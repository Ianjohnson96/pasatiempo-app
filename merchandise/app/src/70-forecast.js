
/* ---------- forecast page ---------- */
const pct = (v, d = 0) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(d) + '%';
const catsAll = () => BASE.order;
const fySales = (fy, cats = catsAll()) => sum(cats, c => sum(fyMonths(fy), k => ENG.S[c][k]));
const lySales = (fy, cats = catsAll()) => sum(cats, c => sum(fyMonths(fy - 1), k => num(BASE.cats[c].hist[k])));
const monthStatus = k => k <= BASE.actualThrough ? 'actual' : (BASE.partial && k === BASE.partial.m ? 'partial' : 'forecast');
function monthTotal(k){ return sum(catsAll(), c => ENG.S[c][k]); }
function monthLY(k){ const l = addMonths(k, -12); return sum(catsAll(), c => l in ENG.S[c] ? ENG.S[c][l] : num(BASE.cats[c].hist[l])); }
const canPlan = () => isAdmin && canAct();

function setWhatIf(group, key, val){
  WHATIF = WHATIF || {};
  WHATIF[group] = {...(WHATIF[group] || {}), [key]: val};
  schedule();
}
async function saveAssumptions(){
  const a = assumptions();
  const body = {g27: a.g27, g27cat: a.g27cat, g28: a.g28, wos: a.wos, by: myId, at: new Date().toISOString(), basedOn: BASE.asOf};
  if (await write('plan/assumptions', body)){ WHATIF = null; toast('Saved. Every budget now uses this forecast.'); }
}
function whatIfBar(){
  if (!WHATIF) return SAVED ? `<div class="note" style="padding:0 0 10px">Using the forecast saved ${dateLabel((SAVED.at || '').slice(0,10))}${SAVED.by ? ' by <span class="person" data-uid="' + esc(SAVED.by) + '"></span>' : ''}.</div>` : '';
  return `<div class="warnbox" style="margin:0 0 14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between">
    <span><b>What-if.</b> These changes aren't saved. Budgets on every page follow them until you ${canPlan() ? 'save or discard them' : 'discard them'}.</span>
    <span style="display:flex;gap:8px">${canPlan() ? '<button class="btn primary sm" type="button" data-fc="save">Save as the plan</button>' : ''}<button class="btn sm" type="button" data-fc="discard">Discard</button></span></div>`;
}

function renderForecast(){
  if (!BASE){ $('#pane').innerHTML = `<section class="panel"><div class="note">The forecast needs the month-end data. It loads after the first refresh.</div></section>`; return; }
  const fy = curFY(), a = assumptions();
  const f1 = fySales(fy), l1 = lySales(fy), f2 = fySales(fy + 1);
  const closed = fyMonths(fy).filter(k => monthStatus(k) === 'actual');
  const ytd = sum(closed, monthTotal), ytdLY = sum(closed, monthLY);
  const gm1 = sum(catsAll(), c => sum(fyMonths(fy), k => ENG.S[c][k]) * BASE.cats[c].gm), gm2 = sum(catsAll(), c => sum(fyMonths(fy + 1), k => ENG.S[c][k]) * BASE.cats[c].gm);
  const open = fyMonths(fy).filter(k => monthStatus(k) !== 'actual');
  const gOpen = open.map(k => num(a.g27[k]));
  const rest = sum(open, monthTotal), restLY = sum(open, monthLY);
  const k = (lab, v, sub, expl) => `<div class="kpi"><div class="lab">${lab}</div><div class="v num">${v}</div><div class="s">${sub}</div><div class="x">${expl}</div></div>`;
  const kpis = k(`${fyLabel(fy)} sales forecast`, moneyK(f1), `${pct(f1 / l1 - 1)} vs ${fyLabel(fy - 1)}`, `Actual through ${monthLabel(BASE.actualThrough)}, forecast after. Retail, all categories.`) +
    k('Year to date', moneyK(ytd), `${pct(ytd / ytdLY - 1, 1)} vs last year`, `${monthShort(closed[0] || fyMonths(fy)[0])}–${monthShort(BASE.actualThrough)}, closed months.`) +
    k('Rest of the year', moneyK(rest), `${pct(rest / restLY - 1)} vs last year`, `Growth assumed ${Math.round(Math.min(...gOpen) * 100)}–${Math.round(Math.max(...gOpen) * 100)}% a month — below the year-to-date pace.`) +
    k(`${fyLabel(fy)} gross margin`, moneyK(gm1), `${Math.round(gm1 / f1 * 100)}% of sales`, 'Forecast sales × each category\'s realized margin.') +
    k(`${fyLabel(fy + 1)} sales forecast`, moneyK(f2), `${pct(f2 / f1 - 1)} vs ${fyLabel(fy)}`, 'This year × next year\'s growth by category.') +
    k(`${fyLabel(fy + 1)} gross margin`, moneyK(gm2), `${Math.round(gm2 / f2 * 100)}% of sales`, 'Mix shifts toward the higher-margin categories.');
  const inp = (grp, key, val, dis) => `<input class="gin num" type="number" step="1" inputmode="decimal" data-wi="${grp}" data-k="${key}" value="${Math.round(val * 100)}" ${dis ? 'disabled' : ''} aria-label="${grp} ${key} growth %">`;
  const m1 = fyMonths(fy);
  const monthRows = m1.map(k => {
    const st = monthStatus(k), tot = monthTotal(k), ly = monthLY(k), nx = monthTotal(addMonths(k, 12));
    const g = st === 'actual' ? `<span class="num">${pct(tot / ly - 1)}</span>` : st === 'partial' ? inp('g27', k, a.g27[k]) + '<span class="pc">%</span>' : inp('g27', k, a.g27[k]) + '<span class="pc">%</span>';
    const tag = st === 'actual' ? '<span class="pill received">Actual</span>' : st === 'partial' ? `<span class="pill partial">${money(BASE.partial.actual)} so far</span>` : '<span class="pill open">Forecast</span>';
    return `<tr><td>${monthLabel(k)}</td><td class="r num">${money(ly)}</td><td class="r">${g}</td><td class="r num"><b>${money(tot)}</b></td><td>${tag}</td><td class="r num">${money(nx)}</td><td class="r num">${pct(nx / tot - 1)}</td></tr>`;
  }).join('');
  const catRows = BASE.order.map(c => {
    const v = BASE.cats[c], s1 = sum(m1, k => ENG.S[c][k]), s0 = sum(fyMonths(fy - 1), k => num(v.hist[k])), s2 = sum(fyMonths(fy + 1), k => ENG.S[c][k]);
    const y = sum(closed, k => ENG.S[c][k]);
    return `<tr><td><span class="code">${c}</span> ${esc(v.name)}</td><td class="r num">${money(s0)}</td><td class="r num">${money(y)}</td><td class="r num"><b>${money(s1)}</b></td><td class="r num">${s0 ? pct(s1 / s0 - 1) : '—'}</td>
      <td class="r">${inp('g27cat', c, num(a.g27cat[c]))}<span class="pc">%</span></td><td class="r num">${Math.round(v.gm * 100)}%</td><td class="r num">${money(s1 * v.gm)}</td>
      <td class="r">${inp('g28', c, num(a.g28[c]))}<span class="pc">%</span></td><td class="r num"><b>${money(s2)}</b></td>
      <td class="r"><input class="gin num" type="number" step="1" min="1" max="52" data-wi="wos" data-k="${c}" value="${a.wos[c]}" aria-label="Target weeks ${esc(v.name)}"></td></tr>`;
  }).join('');
  const tot0 = lySales(fy), totY = ytd;
  $('#pane').innerHTML = whatIfBar() + `<section class="kpis" style="margin-top:0">${kpis}</section>
  <div class="grid" style="margin-top:18px">
    <section class="panel"><header><h2>Sales by month</h2><span class="lab">${fyLabel(fy)} and ${fyLabel(fy + 1)}, retail</span></header>
      <div class="legend"><span><i class="sw" style="background:var(--cypress)"></i>Actual</span><span><i class="sw" style="background:color-mix(in srgb,var(--cypress) 40%,var(--card))"></i>${fyLabel(fy)} forecast</span><span><i class="sw" style="background:color-mix(in srgb,var(--fog) 55%,var(--card))"></i>${fyLabel(fy + 1)} forecast</span><span><i class="sw line" style="background:var(--ink)"></i>Same month last year</span></div>
      <div class="chart" id="fcChart"></div>
      <div class="note">Closed months are actual sales from the Daily Sales Report. Open months are last year's sales for the month grown by the percentage in the table. Next year repeats this year's months, grown by category.</div></section>
    <section class="panel"><header><h2>How the forecast works</h2></header><div class="note" style="font-size:13.5px;color:var(--ink)">
      <p style="margin-top:0"><b>This year:</b> each open month = the same month last year × (1 + the month's growth + any extra growth set for the category).</p>
      <p><b>Next year:</b> each month = this year's forecast for the month × (1 + next year's growth for the category).</p>
      <p><b>Budgets follow the forecast.</b> Cost of sales is sales × (1 − margin). Each month's target stock is the target weeks × the next four months' cost of sales ÷ 17.3 weeks. So changing next year's growth also changes this April's target, and this year's budget with it.</p>
      <p style="margin-bottom:0">${canPlan() ? 'Change any white box to see a what-if everywhere. Nothing is saved until you press <b>Save as the plan</b>.' : 'You can try what-ifs in the white boxes. Only the owner can save them as the plan.'}</p></div></section>
  </div>
  <section class="panel" style="margin-top:18px"><header><h2>${fyLabel(fy)} month by month</h2><span class="lab">Type a growth % for any open month</span></header>
    <div class="tbl"><table class="mini fc" style="min-width:760px"><thead><tr><th>Month</th><th class="r">Last year</th><th class="r">Growth</th><th class="r">${fyLabel(fy)}</th><th>Status</th><th class="r">${fyLabel(fy + 1)}</th><th class="r">Change</th></tr></thead>
    <tbody>${monthRows}</tbody><tfoot><tr><td><b>Year</b></td><td class="r num">${money(tot0)}</td><td class="r num">${pct(f1 / tot0 - 1)}</td><td class="r num"><b>${money(f1)}</b></td><td></td><td class="r num"><b>${money(f2)}</b></td><td class="r num">${pct(f2 / f1 - 1)}</td></tr></tfoot></table></div></section>
  <section class="panel" style="margin-top:18px"><header><h2>By category</h2><span class="lab">Growth and target weeks are editable</span></header>
    <div class="tbl"><table class="mini fc" style="min-width:1080px"><thead><tr><th>Category</th><th class="r">${fyLabel(fy - 1)} actual</th><th class="r">${fyLabel(fy)} to date</th><th class="r">${fyLabel(fy)} forecast</th><th class="r">vs LY</th><th class="r" title="Added to the monthly growth for this category's open months">Extra growth</th><th class="r">Margin</th><th class="r">Gross margin $</th><th class="r">${fyLabel(fy + 1)} growth</th><th class="r">${fyLabel(fy + 1)} forecast</th><th class="r" title="Weeks of supply to hold at each month-end">Target weeks</th></tr></thead>
    <tbody>${catRows}</tbody><tfoot><tr><td><b>All categories</b></td><td class="r num">${money(tot0)}</td><td class="r num">${money(totY)}</td><td class="r num"><b>${money(f1)}</b></td><td class="r num">${pct(f1 / tot0 - 1)}</td><td></td><td class="r num">${Math.round(gm1 / f1 * 100)}%</td><td class="r num">${money(gm1)}</td><td class="r num">${pct(f2 / f1 - 1)}</td><td class="r num"><b>${money(f2)}</b></td><td></td></tr></tfoot></table></div>
    <div class="note"><b>Extra growth</b> adds to the monthly growth for one category (for example, −10 for a category you're shrinking). <b>Target weeks</b> is how many weeks of sales to keep on hand; lower means leaner stock and less to buy. Special Orders are included in sales but never in a budget.</div></section>
  ${roundsPanel(fy)}`;
  fcChart(fy);
  fillPeople();
}
function roundsPanel(fy){
  const R = BASE.rounds || {}, y1 = String(fy - 1), y0 = String(fy - 2);
  if (!R[y1] || !R[y0]) return '';
  const rows = []; let R0 = 0, R1 = 0, S0 = 0, S1 = 0;
  for (let m = 5; m <= 12; m++){
    const k1 = y1 + '-' + pad(m), k0 = y0 + '-' + pad(m);
    if (monthStatus(k1) !== 'actual') continue;
    const r1 = R[y1].total[m - 1], r0 = R[y0].total[m - 1], s1 = monthTotal(k1), s0 = monthLY(k1);
    R0 += r0; R1 += r1; S0 += s0; S1 += s1;
    rows.push(`<tr><td>${MFULL[m - 1]}</td><td class="r num">${int(r0)}</td><td class="r num">${int(r1)}</td><td class="r num">${pct(r1 / r0 - 1)}</td><td class="r num">${money2(s0 / r0)}</td><td class="r num">${money2(s1 / r1)}</td><td class="r num"><b>${pct((s1 / r1) / (s0 / r0) - 1)}</b></td></tr>`);
  }
  if (!rows.length) return '';
  const booked = [];
  for (let m = 1; m <= 12; m++){ const k = y1 + '-' + pad(m); if (monthStatus(k) === 'forecast' && k > BASE.actualThrough && R[y1].total[m - 1] && R[y0].total[m - 1]) booked.push(`${MN[m - 1]} ${int(R[y1].total[m - 1])} booked vs ${int(R[y0].total[m - 1])} played last year`); }
  return `<section class="panel" style="margin-top:18px"><header><h2>Rounds and spend per round</h2><span class="lab">Yearly Rounds Summary · 18-hole rounds</span></header>
    <div class="tbl"><table class="mini" style="min-width:680px"><thead><tr><th>Month</th><th class="r">Rounds ${y0}</th><th class="r">Rounds ${y1}</th><th class="r">Change</th><th class="r">Shop $ per round ${y0}</th><th class="r">Shop $ per round ${y1}</th><th class="r">Change</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
    <div class="note">Over these months rounds are <b>${pct(R1 / R0 - 1)}</b> and shop spend per round is <b>${pct((S1 / R1) / (S0 / R0) - 1)}</b>. ${(S1 / R1) / (S0 / R0) - 1 > R1 / R0 - 1 ? 'Most of the growth is each golfer spending more, not more golfers. That is harder to repeat than extra rounds, so the forecast for the rest of the year assumes less than the year-to-date pace.' : 'Most of the growth is coming from more rounds, which tends to hold up.'}${booked.length ? ' Forward bookings so far: ' + booked.slice(0, 3).join('; ') + ' (bookings fill in closer to the date).' : ''}</div></section>`;
}
function fcChart(fy){
  const el = $('#fcChart'); if (!el) return;
  const ms = fyMonths(fy).concat(fyMonths(fy + 1));
  const W = 560, H = 240, L = 50, R = 8, T = 12, B = 30, iw = W - L - R, ih = H - T - B;
  const vals = ms.map(monthTotal), ly = ms.map(monthLY), hi = Math.ceil(Math.max(...vals, ...ly) / 100000) * 100000 || 100000;
  const y = v => T + ih - v / hi * ih, bw = iw / ms.length;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly sales, actual and forecast, with last year for comparison">`;
  for (let v = 0; v <= hi; v += 100000) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule)"/><text class="axis" x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${moneyK(v)}</text>`;
  ms.forEach((k, i) => {
    const x = L + i * bw + 2, w = bw - 4, st = monthStatus(k), v = vals[i];
    const fill = fyOf(k) > fy ? 'color-mix(in srgb,var(--fog) 55%,var(--card))' : st === 'actual' ? 'var(--cypress)' : 'color-mix(in srgb,var(--cypress) 40%,var(--card))';
    s += `<rect x="${x}" y="${y(v)}" width="${w}" height="${ih - (y(v) - T)}" fill="${fill}"><title>${monthLabel(k)}: ${money(v)} (${st === 'actual' ? 'actual' : 'forecast'}) · last year ${money(ly[i])}</title></rect>`;
    if (st === 'partial'){ const a = BASE.partial.actual; s += `<rect x="${x}" y="${y(a)}" width="${w}" height="${ih - (y(a) - T)}" fill="var(--cypress)"/>`; }
    if (i % 2 === 0 || bw > 26) s += `<text class="axis" x="${x + w / 2}" y="${H - B + 13}" text-anchor="middle">${monthShort(k)[0]}</text>`;
  });
  s += `<text class="axis" x="${L + 6 * bw}" y="${H - 4}" text-anchor="middle">${fyLabel(fy)}</text><text class="axis" x="${L + 18 * bw}" y="${H - 4}" text-anchor="middle">${fyLabel(fy + 1)}</text>`;
  s += `<line x1="${L + 12 * bw}" x2="${L + 12 * bw}" y1="${T}" y2="${T + ih}" stroke="var(--rule2)" stroke-dasharray="3 3"/>`;
  s += `<path d="${ly.map((v, i) => (i ? 'L' : 'M') + (L + i * bw + bw / 2).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ')}" fill="none" stroke="var(--ink)" stroke-width="1.6"/>`;
  el.innerHTML = s + '</svg>';
}
