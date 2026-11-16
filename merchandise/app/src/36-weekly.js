/* ---------- weekly numbers (pulse/{date}) ----------
   A Daily Sales Report uploaded on its own between month-ends (Month-end -> Update from this month's reports, the
   Daily Sales Report alone): month and fiscal year to date by category, through the day it was run for
   (merchandise/pipeline/refresh.py build_pulse). It changes no budget or stock figure; it shows how the month is
   tracking. Plan and last year for the month so far are the month's forecast and last year's month, pro-rated by
   the days gone. */
let PULSES = [];
const latestPulse = () => PULSES.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
/* The weekly numbers against plan and last year, by category and in total. Null when there is no forecast to compare with. */
function pulseView(p){
  if (!p || !BASE || !ENG) return null;
  const m = p.date.slice(0, 7), day = +p.date.slice(8, 10), days = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate(), f = day / days;
  const fy = fyOf(m), before = fyMonths(fy).filter(k => k < m);
  const S = c => ENG.S[c] || {}, plan = (c, k) => k in S(c) ? S(c)[k] : null;
  const cats = catsAll().map(c => {
    const v = BASE.cats[c], pm = plan(c, m), ly = lastYear(v, m);
    const pPrev = before.reduce((t, k) => t + num(plan(c, k) != null ? plan(c, k) : (k in v.act ? v.act[k] : 0)), 0);
    return {c, name: v.name, mtd: num((p.mtd || {})[c]), fytd: num((p.fytd || {})[c]), planMtd: pm == null ? null : pm * f, lyMtd: ly * f,
      planFytd: pm == null ? null : pPrev + pm * f, lyFytd: before.reduce((t, k) => t + lastYear(v, k), 0) + ly * f};
  });
  const tot = k => cats.some(x => x[k] == null) ? null : sum(cats, x => x[k]);
  const prev = PULSES.filter(x => x.date < p.date).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
  const since = prev && prev.date.slice(0, 7) === m ? prev : null;
  return {p, m, day, days, cats: cats.sort((a, b) => b.mtd - a.mtd), mtd: sum(cats, x => x.mtd), fytd: sum(cats, x => x.fytd),
    planMtd: tot('planMtd'), lyMtd: tot('lyMtd'), planFytd: tot('planFytd'), lyFytd: tot('lyFytd'),
    prev: since, week: since ? sum(cats, x => x.mtd) - sum(catsAll(), c => num((since.mtd || {})[c])) : null};
}
const vsTxt = (a, b) => b ? aDelta(a / b - 1) : '—';
/* Home's panel: shown while the weekly numbers are newer than the month-end data. */
function weeklyPanel(){
  const p = latestPulse();
  if (!p || !BASE || p.date <= BASE.asOf) return '';
  const w = pulseView(p); if (!w) return '';
  const top = w.cats.filter(x => x.mtd || x.planMtd).slice(0, 8);
  return `<section class="panel"><header><h2>This month so far: through ${dateLabel(p.date)}</h2><span class="lab">Weekly Daily Sales Report</span></header>
    <section class="tiles" aria-label="Weekly numbers" style="padding:12px 16px 4px">
      ${anaTile(`${monthFull(w.m)} to date`, moneyK(w.mtd), `${vsTxt(w.mtd, w.planMtd)} on plan · ${vsTxt(w.mtd, w.lyMtd)} on last year`, '', `Day ${w.day} of ${w.days}. Plan and last year are pro-rated by the days gone.`)}
      ${anaTile('Year to date', moneyK(w.fytd), `${vsTxt(w.fytd, w.planFytd)} on plan · ${vsTxt(w.fytd, w.lyFytd)} on last year`, '', `${fyLabel(fyOf(w.m))} from May 1.`)}
      ${w.prev ? anaTile(`Since ${dateLabel(w.prev.date)}`, moneyK(w.week), `${Math.round((new Date(p.date) - new Date(w.prev.date)) / 864e5)} days of sales`, '', 'The change in month-to-date sales since the last weekly numbers.') : ''}
    </section>
    <div class="atbl" style="padding:0 16px"><table class="mini" style="min-width:0"><thead><tr><th>Category</th><th class="r">Month to date</th><th class="r">vs plan</th><th class="r">vs last year</th></tr></thead>
      <tbody>${top.map(x => `<tr><td>${esc(x.name)}</td><td class="r num">${money(x.mtd)}</td><td class="r num">${vsTxt(x.mtd, x.planMtd)}</td><td class="r num">${vsTxt(x.mtd, x.lyMtd)}</td></tr>`).join('')}</tbody></table></div>
    <div class="note">Budgets, stock and suggestions still use the ${dateLabel(BASE.asOf)} month-end data; they update when the month's reports are uploaded.</div></section>`;
}
