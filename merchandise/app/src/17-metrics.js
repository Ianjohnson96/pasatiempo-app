/* ---------- merchandise analysis: measures, rules of thumb, suggestions ----------
   Everything comes from assort/current (pipeline/model.py build_subcats): one row per category and subcategory
   with 24 months of sales (series, oldest first, matching assort.months), 12-month sales (t12), stock at cost (oh),
   stock unsold for 12 months (aged), margin (gm) and markdowns (md) as fractions of sales, and units in the last
   three months against the same months a year earlier (ty, ly). Special orders (640) are never analysed.
   Pure functions, no page globals: lib/merch/analysis.test.ts runs this file on its own. */

// Rules of thumb for a private-club pro shop. General guidelines, not the club's own targets.
const BENCH = {
  agedPct: {good: 0.10, near: 0.15, text: 'Aged stock under 10% of stock'},
  md: {good: 0.15, near: 0.20, text: 'Markdowns under 15% of sales'},
  wks: {lo: 12, hi: 16, nearLo: 8, nearHi: 24, text: '12–16 weeks of supply'},
  gmroi: {apparel: 2, accessories: 2, equipment: 1, near: 0.75, text: 'GMROI above 2 for apparel and accessories, above 1 for equipment'},
  turns: {apparel: 2, accessories: 2, equipment: 2, fast: 3, near: 0.75, text: 'Stock turning 2–3 times a year (3–4 for balls and gloves)'},
  gm: {apparel: 0.45, accessories: 0.40, equipment: 0.25, near: 0.05, text: 'Margin: apparel 45%+, accessories 40%+, equipment 25%+'}
};
const FAST_TURN = new Set(['160', '320']);   // balls and gloves
const SEGOF = code => ['160', '200', '220', '300', '320', '350'].includes(code) ? 'equipment'
  : ['440', '620', '660'].includes(code) ? 'accessories' : 'apparel';

/** 'good' | 'near' | 'bad' against the rules of thumb, or null when there is nothing to grade. */
function grade(metric, v, seg, cat){
  if (v == null || !isFinite(v)) return null;
  const b = BENCH[metric];
  if (metric === 'agedPct' || metric === 'md') return v <= b.good ? 'good' : v <= b.near ? 'near' : 'bad';
  if (metric === 'wks') return v >= b.lo && v <= b.hi ? 'good' : v >= b.nearLo && v <= b.nearHi ? 'near' : 'bad';
  if (metric === 'gm') return v >= b[seg] ? 'good' : v >= b[seg] - b.near ? 'near' : 'bad';
  const want = metric === 'turns' && FAST_TURN.has(cat) ? b.fast : b[seg];
  return v >= want ? 'good' : v >= want * b.near ? 'near' : 'bad';
}

const nz = v => { const n = +v; return isFinite(n) ? n : 0; };
const sumSeries = rows => (rows[0] && rows[0].series || []).map((_, i) => rows.reduce((a, r) => a + nz((r.series || [])[i]), 0));
// ctx.cmp: indexes of the last 12 months whose month a year earlier is inside the data, so growth compares like with like.
function measures(rows, base, ctx){
  const series = sumSeries(rows);
  const t12 = rows.reduce((a, r) => a + nz(r.t12), 0);
  const cmpTY = ctx.cmp.reduce((a, j) => a + nz(series[j]), 0), prior12 = ctx.cmp.reduce((a, j) => a + nz(series[j - 12]), 0);
  // Special orders filed in a category (so, soOh) count in its sales, but never sat on the shelf: stock, turns,
  // weeks and GMROI use shelf sales and shelf stock only.
  const so = rows.reduce((a, r) => a + Math.min(nz(r.so), nz(r.t12)), 0);
  const oh = rows.reduce((a, r) => a + Math.max(0, nz(r.oh) - nz(r.soOh)), 0), aged = rows.reduce((a, r) => a + nz(r.aged), 0);
  const gp = rows.reduce((a, r) => a + nz(r.t12) * nz(r.gm), 0), mdS = rows.reduce((a, r) => a + nz(r.t12) * nz(r.md), 0);
  const gpShelf = rows.reduce((a, r) => a + (nz(r.t12) - Math.min(nz(r.so), nz(r.t12))) * nz(r.gm), 0);
  const ty = rows.reduce((a, r) => a + nz(r.ty), 0), ly = rows.reduce((a, r) => a + nz(r.ly), 0);
  const cogs = t12 - so - gpShelf, stocked = oh > 0 && cogs > 0;
  return {...base, t12, so, prior12, cmpTY, series, oh, aged, gp, gpShelf, cogsWk: cogs / 52,
    growth: prior12 >= 500 ? cmpTY / prior12 - 1 : null,
    trend3: ly >= 10 ? ty / ly - 1 : null,
    gm: t12 > 0 ? gp / t12 : null, md: t12 > 0 ? mdS / t12 : null,
    agedPct: oh > 0 ? aged / oh : null,
    turns: stocked ? cogs / oh : null, wks: stocked ? oh / (cogs / 52) : null, gmroi: stocked ? gpShelf / oh : null,
    agedSkus: rows.flatMap(r => (r.agedSkus || []).map(s => ({...s, cat: r.cat, sub: r.sub})))};
}

/** Categories (each with its subcategories), and the shop, measured the same way. Null before the first upload. */
const tidySub = id => { const t = String(id || '').replace(/^s-\d+-/, '').replace(/-s-/g, "'s ").replace(/-/g, ' ').trim(); return t ? t[0].toUpperCase() + t.slice(1) : 'Not sorted'; };
function analyze(assort, catNames, subNames){
  if (!assort || !Array.isArray(assort.rows)) return null;
  const rows = assort.rows.filter(r => r.cat && r.cat !== '640');
  const all = sumSeries(rows), n = all.length, first = Math.max(0, all.findIndex(v => v > 0));
  const ctx = {first, cmp: [...Array(Math.min(12, n)).keys()].map(k => n - 12 + k).filter(j => j - 12 >= first)};
  const byCat = new Map();
  for (const r of rows) (byCat.get(r.cat) || byCat.set(r.cat, []).get(r.cat)).push(r);
  const shop = measures(rows, {key: 'shop', name: 'Pro shop', cat: null, sub: null}, ctx);
  const share = m => { m.share = shop.t12 > 0 ? m.t12 / shop.t12 : 0; m.stockShare = shop.oh > 0 ? m.oh / shop.oh : 0; return m; };
  const cats = [...byCat].map(([cat, rs]) => {
    const name = (catNames && catNames[cat]) || cat, seg = SEGOF(cat);
    const c = share(measures(rs, {key: cat, name, cat, sub: null, seg}, ctx));
    c.subs = rs.map(r => share(measures([r], {key: cat + '|' + (r.sub || ''), name: (subNames && subNames[r.sub]) || tidySub(r.sub), cat, sub: r.sub || '', seg, catName: name}, ctx)))
      .sort((a, b) => b.t12 - a.t12);
    return c;
  }).sort((a, b) => b.t12 - a.t12);
  share(shop);
  return {months: assort.months || [], first, cmpMonths: ctx.cmp.length, cmpFrom: assort.months ? assort.months[ctx.cmp[0]] : null, through: assort.through || null, t12Months: assort.t12Months || null, shop, cats};
}

/** Shop sales per round for each of the 24 months; rounds are {year: {total, member, guest, public: [Jan..Dec]}}. */
function perRound(ana, rounds){
  const at = (m, k) => { const y = rounds && rounds[m.slice(0, 4)]; const v = y && y[k] ? y[k][+m.slice(5, 7) - 1] : null; return v == null ? null : nz(v); };
  const sales = m => { const i = ana.months.indexOf(m); return i < ana.first ? null : ana.shop.series[i]; };
  const ly = m => (+m.slice(0, 4) - 1) + m.slice(4);
  const spr = m => { const r = at(m, 'total'), s = sales(m); return r > 0 && s != null ? s / r : null; };
  return ana.months.map(m => ({month: m, sales: sales(m), rounds: at(m, 'total'), member: at(m, 'member'), guest: at(m, 'guest'), public: at(m, 'public'),
    spr: spr(m), sprLY: spr(ly(m))}));
}

/** Each calendar month's share (Jan..Dec) of the last 12 months' sales. */
function seasonality(ana){
  const out = Array(12).fill(0), n = ana.months.length, tot = ana.shop.series.slice(n - 12).reduce((a, v) => a + v, 0);
  ana.months.slice(n - 12).forEach((m, i) => { out[+m.slice(5, 7) - 1] = tot > 0 ? ana.shop.series[n - 12 + i] / tot : 0; });
  return out;
}

const target16 = M => M.cogsWk * BENCH.wks.hi;   // stock needed for 16 weeks of shelf sales at the last year's pace
/** Stock over target, aged stock, markdown candidates and lines to reorder. Subcategory level. */
function stuckMoney(ana){
  const subs = ana.cats.flatMap(c => c.subs);
  return {
    overstock: ana.cats.map(M => ({M, excess: Math.max(0, M.oh - target16(M))})).filter(x => x.excess > 0).sort((a, b) => b.excess - a.excess),
    aged: subs.filter(M => M.aged > 0).map(M => ({M, aged: M.aged})).sort((a, b) => b.aged - a.aged),
    agedSkus: subs.flatMap(M => M.agedSkus).sort((a, b) => nz(b.value) - nz(a.value)),
    markdown: subs.filter(M => M.aged > 0).map(M => ({M, cashAt30: M.aged / (1 - Math.min(nz(M.gm), 0.9)) * 0.7})).sort((a, b) => b.cashAt30 - a.cashAt30),
    // Selling off the shelf, and out of stock or under 4 weeks of it.
    reorder: subs.filter(M => M.t12 - M.so >= 2000 && (M.oh <= 0 || (M.wks != null && M.wks < 4))).sort((a, b) => b.t12 - a.t12)
  };
}

/** Ranked, rule-based suggestions: [{id, title, why, impact, action, page, cat, sub}], biggest dollars first. */
function suggest(ana){
  if (!ana) return [];
  const out = [], pctS = v => Math.round(v * 100) + '%', usd = v => '$' + Math.round(v).toLocaleString('en-US');
  const add = (M, kind, impact, title, why, action, page) => { if (impact >= 250) out.push({id: kind + ':' + M.key, key: M.key, kind, title, why, impact: Math.round(impact), action, page, cat: M.cat, sub: M.sub == null ? null : M.sub, name: M.name, catName: M.catName || M.name}); };
  for (const c of ana.cats){
    if (c.stockShare - c.share > 0.05 && c.oh > 5000)
      add(c, 'share', c.oh - c.share * ana.shop.oh, `${c.name}: hold back open-to-buy`,
        `${pctS(c.stockShare)} of the shop's stock but ${pctS(c.share)} of its sales.`, 'Buy less until stock matches its share of sales', 'scorecard');
    if (c.md != null && c.md > BENCH.md.good && c.t12 > 5000)
      add(c, 'md', c.t12 * (c.md - BENCH.md.good), `${c.name}: markdowns are high`,
        `Markdowns are ${pctS(c.md)} of sales, against a rule of thumb of 15%.`, 'Buy shallower and review full-price sell-through', 'scorecard');
  }
  for (const c of ana.cats) for (const s of c.subs){
    const nm = `${c.name} › ${s.name}`, g = BENCH.gmroi[s.seg];
    if (s.agedPct != null && s.agedPct > BENCH.agedPct.good && s.aged >= 500)
      add(s, 'aged', s.aged, `${nm}: clear aged stock`, `${usd(s.aged)} (${pctS(s.agedPct)}) hasn't sold in 12 months.`, 'Mark down, bundle or return to the vendor', 'stuck');
    if (s.wks != null && s.wks > 30)
      add(s, 'wks', s.oh - target16(s), `${nm}: too much stock`, `${Math.round(s.wks)} weeks of supply at the last year's pace; 12–16 is the rule of thumb.`, 'Pause orders until it sells down', 'stuck');
    if (s.growth != null && s.growth > 0.15 && s.t12 - s.so >= 2000 && (s.oh <= 0 || (s.wks != null && s.wks < 8)))
      add(s, 'short', (s.t12 - s.so) / 52 * (12 - (s.wks || 0)), `${nm}: buy deeper`, `Sales up ${pctS(s.growth)} on last year with ${s.oh <= 0 ? 'nothing in stock' : 'only ' + Math.round(s.wks) + ' weeks of stock'}.`, 'Reorder before it runs out', 'scorecard');
    if (s.gmroi != null && s.gmroi < g && s.oh > 5000)
      add(s, 'gmroi', s.oh - s.gp / g, `${nm}: stock isn't earning its keep`, `GMROI ${s.gmroi.toFixed(2)} against a rule of thumb of ${g}.`, 'Carry less of it, or buy it at a better margin', 'scorecard');
    if (s.trend3 != null && s.trend3 <= -0.25 && s.oh > 2000)
      add(s, 'falling', s.oh, `${nm}: sales are falling`, `Units in the last 3 months down ${pctS(-s.trend3)} on a year ago, with ${usd(s.oh)} in stock.`, 'Cut the next buy and move what is left', 'trends');
  }
  // One suggestion per line: the biggest, with the others' reasons folded in.
  const best = new Map();
  for (const x of out.sort((a, b) => b.impact - a.impact)){
    const k = x.key, b = best.get(k);
    if (b) b.also.push(x.why); else best.set(k, {...x, also: []});
  }
  return [...best.values()];
}
