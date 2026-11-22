/* ---------- merchandise analysis: measures, rules of thumb, suggestions ----------
   Everything comes from assort/current (pipeline/model.py build_subcats): one row per category and subcategory
   with 24 months of sales (series, oldest first, matching assort.months), 12-month sales (t12), stock at cost (oh),
   stock unsold for 12 months (aged), margin (gm) and markdowns (md) as fractions of sales, and units in the last
   three months against the same months a year earlier (ty, ly). Special orders (640) are never analysed.
   Pure functions, no page globals: lib/merch/analysis.test.ts runs this file on its own. */

// Rules of thumb for a private-club pro shop. General guidelines, not the club's own targets.
const BENCH_DEFAULT = {
  agedPct: {good: 0.10, near: 0.15, text: 'Aged stock under 10% of stock'},
  md: {good: 0.15, near: 0.20, text: 'Markdowns under 15% of sales'},
  wks: {lo: 12, hi: 16, nearLo: 8, nearHi: 24, text: 'Weeks of supply by role: apparel 12–16, accessories and hats 12–20, balls and gloves 8–16, hard goods 16–26'},
  gmroi: {apparel: 2, accessories: 2, equipment: 1, near: 0.75, text: 'GMROI above 2 for apparel and accessories, above 1 for equipment'},
  turns: {apparel: 2, accessories: 2, equipment: 2, fast: 3, near: 0.75, text: 'Stock turning 2–3 times a year (3–4 for balls and gloves)'},
  gm: {apparel: 0.45, accessories: 0.40, equipment: 0.25, near: 0.05, text: 'Margin: apparel 45%+, accessories 40%+, equipment 25%+'}
};
const FAST_TURN = new Set(['160', '320']);   // balls and gloves

/* Each category's job in the shop, and how it is judged. All soft goods carry the club's logo, so they can't go back to
   the vendor, and members already get 25% off them (the member discount guideline): a markdown has to go deeper than that to move anything.
   wks: [lo, hi, nearLo, nearHi] weeks of supply; over: weeks at which "too much stock" is suggested; null = not judged
   on weeks (the demo fleet is a fitting tool, not stock for sale). Mirrored in pipeline/config.py ROLE_OF. */
const ROLES_DEFAULT = {
  fashion: {name: 'Fashion apparel', wks: [12, 16, 8, 24], over: 30, share: true,
    judge: 'Judged on sell-through, markdowns and return on stock. Logo goods can\'t go back to the vendor.',
    aged: 'Logo goods can\'t go back to the vendor, and members already get {MD} off: mark down past that (40% off ticket) or put it in a member sale',
    heavy: 'Pause orders until it sells down',
    stop: 'Only order against a customer commitment.'},
  impulse: {name: 'Accessories & hats', wks: [12, 20, 8, 30], over: 30, share: true,
    judge: 'Judged on turns and keeping the best styles in stock; cut the long tail, chase the winners.',
    aged: 'Mark down past the member {MD} (40% off ticket), bundle it, or put it on a feature table',
    heavy: 'Cut the slow styles and colors; keep buying the best sellers',
    stop: 'Reorder only the best-selling styles; no new lines.'},
  consumable: {name: 'Balls & gloves', wks: [8, 16, 6, 24], over: 24, share: false,
    judge: 'Never run out of the core balls and gloves; judged on in-stock and turns.',
    aged: 'Swap old models with the rep, or sell them by the dozen at a lower price',
    heavy: 'Order smaller and more often',
    stop: 'Reorder the core balls and gloves you can\'t run out of; nothing new.'},
  hardgoods: {name: 'Hard goods', wks: [16, 26, 12, 40], over: 40, share: false,
    judge: 'Stock clubs, shoes and bags back fittings and special orders: judged on margin dollars and a thin, current shelf.',
    aged: 'Ask the rep about a return or trade-in on old models; otherwise feature it at a fitting day',
    heavy: 'Replace only the core models that sell; order the rest for fittings and special orders',
    stop: 'Order for fittings and special orders, and replace only core models that sell.'},
  demo: {name: 'Demo fleet', wks: null, over: null, share: false,
    judge: 'A fitting tool, not stock for sale: keep it current and sell off demos older than a season.',
    aged: 'Sell off demo clubs older than a season as used, then refresh the fleet',
    heavy: 'Sell off older demos before adding new ones',
    stop: 'Refresh the fleet only after selling off older demos.'}
};
const ROLE_OF_DEFAULT = {'400': 'fashion', '430': 'fashion', '470': 'fashion', '480': 'fashion', '490': 'fashion', '500': 'fashion',
  '440': 'impulse', '620': 'impulse', '660': 'impulse', '160': 'consumable', '320': 'consumable',
  '200': 'hardgoods', '300': 'hardgoods', '350': 'hardgoods', '220': 'demo'};
const MEMBER_DISCOUNT_DEFAULT = 0.25;

/* ---------- the owner's guidelines (guidelines/current) over the defaults above ----------
   guideValues(doc) keeps every valid saved value and falls back to the default key by key, so a missing, partial or
   hand-edited document can never break a page. applyGuides(doc) makes those values the ones every page grades by. */
const pctTxt = v => Math.round(v * 100) + '%';
const numTxt = v => String(+v.toFixed(2));
function benchTexts(b, roles){
  const w = k => roles[k] && roles[k].wks ? roles[k].wks[0] + '–' + roles[k].wks[1] : 'not judged';
  const g = b.gmroi, t = b.turns, m = b.gm;
  b.agedPct.text = `Aged stock under ${pctTxt(b.agedPct.good)} of stock`;
  b.md.text = `Markdowns under ${pctTxt(b.md.good)} of sales`;
  b.wks.text = `Weeks of supply by role: apparel ${w('fashion')}, accessories and hats ${w('impulse')}, balls and gloves ${w('consumable')}, hard goods ${w('hardgoods')}`;
  b.gmroi.text = g.apparel === g.accessories ? `GMROI above ${numTxt(g.apparel)} for apparel and accessories, above ${numTxt(g.equipment)} for equipment`
    : `GMROI above ${numTxt(g.apparel)} for apparel, ${numTxt(g.accessories)} for accessories, above ${numTxt(g.equipment)} for equipment`;
  b.turns.text = `Stock turning ${numTxt(t.apparel)}–${numTxt(t.fast)} times a year (${numTxt(t.fast)}–${numTxt(t.fast + 1)} for balls and gloves)`;
  b.gm.text = `Margin: apparel ${pctTxt(m.apparel)}+, accessories ${pctTxt(m.accessories)}+, equipment ${pctTxt(m.equipment)}+`;
  return b;
}
// The numbers a saved document may change, and the range each must fall in.
const BENCH_LIMITS = {agedPct: {good: [0, 0.9], near: [0, 0.9]}, md: {good: [0, 0.9], near: [0, 0.9]},
  wks: {lo: [1, 104], hi: [1, 104], nearLo: [1, 104], nearHi: [1, 104]},
  gmroi: {apparel: [0, 20], accessories: [0, 20], equipment: [0, 20], near: [0, 1]},
  turns: {apparel: [0, 52], accessories: [0, 52], equipment: [0, 52], fast: [0, 52], near: [0, 1]},
  gm: {apparel: [0, 0.9], accessories: [0, 0.9], equipment: [0, 0.9], near: [0, 0.5]}};
const SEASONS_DEFAULT = {spring: 1, summer: 5, fall: 8, holiday: 11};
const isNumIn = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isObj = v => v != null && typeof v === 'object' && !Array.isArray(v);
const goodWks = w => Array.isArray(w) && w.length === 4 && w.every(x => isNumIn(x, 1, 104)) && w[2] <= w[0] && w[0] <= w[1] && w[1] <= w[3];
function guideValues(doc){
  const d = isObj(doc) ? doc : {};
  const bench = JSON.parse(JSON.stringify(BENCH_DEFAULT));
  if (isObj(d.bench)) for (const m in BENCH_LIMITS) if (isObj(d.bench[m])) for (const k in BENCH_LIMITS[m]){
    const v = d.bench[m][k], [lo, hi] = BENCH_LIMITS[m][k];
    if (isNumIn(v, lo, hi)) bench[m][k] = v;
  }
  const roles = {};
  for (const r in ROLES_DEFAULT){
    roles[r] = {...ROLES_DEFAULT[r], wks: ROLES_DEFAULT[r].wks && ROLES_DEFAULT[r].wks.slice()};
    const s = isObj(d.roles) && isObj(d.roles[r]) ? d.roles[r] : {};
    if (goodWks(s.wks)) roles[r].wks = s.wks.slice();
    if (isNumIn(s.over, 1, 104) && roles[r].wks && s.over >= roles[r].wks[1]) roles[r].over = s.over;
  }
  const roleOf = {...ROLE_OF_DEFAULT};
  if (isObj(d.roleOf)) for (const c in d.roleOf) if (/^\d{3}$/.test(c) && Object.prototype.hasOwnProperty.call(ROLES_DEFAULT, d.roleOf[c])) roleOf[c] = d.roleOf[c];
  const memberDiscount = isNumIn(d.memberDiscount, 0, 0.9) ? d.memberDiscount : MEMBER_DISCOUNT_DEFAULT;
  const s = d.seasons, seasons = isObj(s) && s.spring === 1 && [s.summer, s.fall, s.holiday].every(Number.isInteger)
    && 1 < s.summer && s.summer < s.fall && s.fall < s.holiday && s.holiday <= 12
    ? {spring: 1, summer: s.summer, fall: s.fall, holiday: s.holiday} : {...SEASONS_DEFAULT};
  // follow: 'suggested' = the total is the suggested one, worked out again from each month-end's sales and the turns targets
  const mix = {total: null, follow: null, ranges: {}};
  if (isObj(d.mix)){
    if (isNumIn(d.mix.total, 1, 1e9)) mix.total = d.mix.total;
    if (d.mix.follow === 'suggested') mix.follow = 'suggested';
    if (isObj(d.mix.ranges)) for (const r in d.mix.ranges){
      const x = d.mix.ranges[r];
      if (Object.prototype.hasOwnProperty.call(ROLES_DEFAULT, r) && Array.isArray(x) && x.length === 2 && isNumIn(x[0], 0, 100) && isNumIn(x[1], 0, 100) && x[0] <= x[1]) mix.ranges[r] = [x[0], x[1]];
    }
  }
  const md = pctTxt(memberDiscount);
  for (const r in roles) for (const k of ['judge', 'aged', 'heavy', 'stop']) roles[r][k] = String(roles[r][k]).split('{MD}').join(md);
  return {bench: benchTexts(bench, roles), roles, roleOf, memberDiscount, seasons, mix};
}
const GUIDE_DEFAULTS = guideValues(null);
let BENCH = GUIDE_DEFAULTS.bench, ROLES = GUIDE_DEFAULTS.roles, ROLE_OF = GUIDE_DEFAULTS.roleOf, MEMBER_DISCOUNT = GUIDE_DEFAULTS.memberDiscount;
function applyGuides(doc){
  const v = guideValues(doc);
  BENCH = v.bench; ROLES = v.roles; ROLE_OF = v.roleOf; MEMBER_DISCOUNT = v.memberDiscount;
  if (typeof SEASON_FIRSTS !== 'undefined') SEASON_FIRSTS = v.seasons;
  return v;
}
const roleKey = cat => ROLE_OF[cat] || 'fashion';
const roleOf = cat => ROLES[roleKey(cat)];
/** 'neg' (red) when a figure is off the rules of thumb, for the Subcategories and Brands tables: the same cut-offs the
    Scorecard shades by. seg: apparel | accessories | equipment. */
const offBench = (metric, v, seg, cat) => grade(metric, v, seg, cat) === 'bad' ? 'neg' : '';
const SEGOF = code => ['160', '200', '220', '300', '320', '350'].includes(code) ? 'equipment'
  : ['440', '620', '660'].includes(code) ? 'accessories' : 'apparel';

/** 'good' | 'near' | 'bad' against the rules of thumb, or null when there is nothing to grade. */
function grade(metric, v, seg, cat){
  if (v == null || !isFinite(v)) return null;
  const b = BENCH[metric];
  if (metric === 'agedPct' || metric === 'md') return v <= b.good ? 'good' : v <= b.near ? 'near' : 'bad';
  // Weeks, turns and GMROI don't apply to the demo fleet.
  if (cat && !roleOf(cat).wks && (metric === 'wks' || metric === 'turns' || metric === 'gmroi')) return null;
  if (metric === 'wks'){
    const [lo, hi, nLo, nHi] = cat ? roleOf(cat).wks : [b.lo, b.hi, b.nearLo, b.nearHi];
    return v >= lo && v <= hi ? 'good' : v >= nLo && v <= nHi ? 'near' : 'bad';
  }
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
  const gp = rows.reduce((a, r) => a + nz(r.t12) * nz(r.gm), 0);
  // Markdowns are weighted over the lines the cost & margin report covers; a line without one isn't 0%.
  const mdRows = rows.filter(r => r.md != null && isFinite(+r.md)), mdBase = mdRows.reduce((a, r) => a + nz(r.t12), 0), mdS = mdRows.reduce((a, r) => a + nz(r.t12) * nz(r.md), 0);
  const gpShelf = rows.reduce((a, r) => a + (nz(r.t12) - Math.min(nz(r.so), nz(r.t12))) * nz(r.gm), 0);
  const ty = rows.reduce((a, r) => a + nz(r.ty), 0), ly = rows.reduce((a, r) => a + nz(r.ly), 0);
  const cogs = t12 - so - gpShelf, stocked = oh > 0 && cogs > 0;
  return {...base, t12, so, prior12, cmpTY, series, oh, aged, gp, gpShelf, cogsWk: cogs / 52,
    growth: prior12 >= 500 ? cmpTY / prior12 - 1 : null,
    trend3: ly >= 10 ? ty / ly - 1 : null,
    gm: t12 > 0 ? gp / t12 : null, md: mdBase > 0 ? mdS / mdBase : null,
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

// Stock needed for the top of the category role's weeks range at the last year's pace (16 weeks for apparel); none for the demo fleet.
const targetWks = M => { const r = roleOf(M.cat); return r.wks ? M.cogsWk * r.wks[1] : null; };
/** Stock over target, aged stock, markdown candidates and lines to reorder. Subcategory level. */
function stuckMoney(ana){
  const subs = ana.cats.flatMap(c => c.subs);
  return {
    overstock: ana.cats.filter(M => targetWks(M) != null).map(M => ({M, excess: Math.max(0, M.oh - targetWks(M))})).filter(x => x.excess > 0).sort((a, b) => b.excess - a.excess),
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
    // Expensive hard goods and the demo fleet always hold more of the stock than their share of sales.
    if (roleOf(c.cat).share && c.stockShare - c.share > 0.05 && c.oh > 5000)
      add(c, 'share', c.oh - c.share * ana.shop.oh, `${c.name}: hold back open-to-buy`,
        `${pctS(c.stockShare)} of the shop's stock but ${pctS(c.share)} of its sales.`, 'Buy less until stock matches its share of sales', 'scorecard');
    if (c.md != null && c.md > BENCH.md.good && c.t12 > 5000)
      add(c, 'md', c.t12 * (c.md - BENCH.md.good), `${c.name}: markdowns are high`,
        `Markdowns are ${pctS(c.md)} of sales, against a rule of thumb of 15%.`, 'Buy shallower and review full-price sell-through', 'scorecard');
  }
  for (const c of ana.cats) for (const s of c.subs){
    const nm = `${c.name} › ${s.name}`, g = BENCH.gmroi[s.seg], role = roleOf(c.cat);
    if (s.agedPct != null && s.agedPct > BENCH.agedPct.good && s.aged >= 500)
      add(s, 'aged', s.aged, `${nm}: clear aged stock`, `${usd(s.aged)} (${pctS(s.agedPct)}) hasn't sold in 12 months.`, role.aged, 'stuck');
    if (role.over && s.wks != null && s.wks > role.over)
      add(s, 'wks', s.oh - targetWks(s), `${nm}: too much stock`, `${Math.round(s.wks)} weeks of supply at the last year's pace; ${role.wks[0]}–${role.wks[1]} is the rule of thumb for ${role.name.toLowerCase()}.`, role.heavy, 'stuck');
    if (role.wks && s.growth != null && s.growth > 0.15 && s.t12 - s.so >= 2000 && (s.oh <= 0 || (s.wks != null && s.wks < 8)))
      add(s, 'short', (s.t12 - s.so) / 52 * (12 - (s.wks || 0)), `${nm}: buy deeper`, `Sales up ${pctS(s.growth)} on last year with ${s.oh <= 0 ? 'nothing in stock' : 'only ' + Math.round(s.wks) + ' weeks of stock'}.`, 'Reorder before it runs out', 'scorecard');
    if (role.wks && s.gmroi != null && s.gmroi < g && s.oh > 5000)
      add(s, 'gmroi', s.oh - s.gp / g, `${nm}: stock isn't earning its keep`, `GMROI ${s.gmroi.toFixed(2)} against a rule of thumb of ${g}.`, role.share ? 'Carry less of it, or buy it at a better margin' : role.heavy, 'scorecard');
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
