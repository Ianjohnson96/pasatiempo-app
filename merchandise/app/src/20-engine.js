
/* ---------- forecast + open-to-buy engine (mirrors pipeline/engine.py) ---------- */
const fyOf = m => +m.slice(0,4) + (+m.slice(5,7) >= 5 ? 1 : 0);
const fyMonths = fy => Array.from({length: 12}, (_, i) => addMonths((fy - 1) + '-05', i));
const fyLabel = fy => 'FY' + fy;
const fyRange = fy => `May ${fy - 1} – Apr ${fy}`;
const REPLENISH = new Set(['200', '160', '350']);
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + num(f(x)), 0);

let BASE = FALLBACK.base || null, SAVED = null, WHATIF = null, ENG = null, PLANS = {}, ADJS = {};
let FYSEL = (() => { try { return localStorage.getItem('mp.fy') || 'cur'; } catch (_) { return 'cur'; } })();
const LEGACY_PLAN = FALLBACK.plan;

/* Growth by fiscal year ({'YYYY': {months, cats}}) from plan/assumptions or BASE.defaults, in either shape: by year
   ({growth}) or the older one with no year (g27 months, g27cat, g28), which belongs to the year of its g27 months.
   Mirrors by_year() in pipeline/engine.py. */
function byYear(store){
  store = store || {};
  const out = {};
  for (const [y, g] of Object.entries(store.growth || {})) out[y] = {months: {...((g || {}).months || {})}, cats: {...((g || {}).cats || {})}};
  if (store.g27 || store.g27cat || store.g28){
    const ms = Object.keys(store.g27 || {}).sort(), fy = ms.length ? fyOf(ms[0]) : /^FY\d{4}$/.test(store.fy || '') ? +store.fy.slice(2) : 2027;
    const cur = out[fy] = out[fy] || {months: {}, cats: {}}, nxt = out[fy + 1] = out[fy + 1] || {months: {}, cats: {}};
    Object.assign(cur.months, store.g27 || {}); Object.assign(cur.cats, store.g27cat || {}); Object.assign(nxt.cats, store.g28 || {});
  }
  return out;
}
/* The engine's assumptions for the plan year: the defaults, the saved plan over them, then this viewer's unsaved what-if.
   g27 = this year's growth by month, g27cat = this year's extra by category, g28 = next year's by category (resolve() in engine.py). */
function assumptions(){
  const fy = curFY(), d = byYear(BASE.defaults), s = byYear(SAVED), w = WHATIF || {};
  const pick = (y, part, wk) => ({...((d[y] || {})[part] || {}), ...((s[y] || {})[part] || {}), ...(w[wk] || {})});
  return {g27: pick(fy, 'months', 'g27'), g27cat: pick(fy, 'cats', 'g27cat'), g28: pick(fy + 1, 'cats', 'g28'),
    wos: {...((BASE.defaults || {}).wos || {}), ...((SAVED || {}).wos || {}), ...(w.wos || {})}, mixTotal: savedMixTotal()};
}
/* The owner's saved total stock to plan for (Guidelines -> Merchandise mix), or null. While one is saved the budget is
   linked to it (mixScale). Unsaved edits on the Guidelines page don't move the budget. */
function savedMixTotal(){
  if (typeof GUIDE === 'undefined' || typeof mixTotalOf !== 'function') return null;
  const t = mixTotalOf(GUIDE, typeof ASSORT !== 'undefined' && ASSORT ? ASSORT.rows : null);
  return t > 0 ? t : null;
}
/** This plan year's left to buy (budget with its changes, less what is committed in it) under the assumptions a, for
    previews of a change before it is saved; the Budget page's figure when a is the saved one. */
function leftToBuyWith(a){
  const fy = curFY(), p = planFor(runEngine(BASE, a), fy, a), used = committedIn(p), adj = ADJS[adjKey(p)] || [];
  return sum(BASE.order.filter(c => p.cats[c].plan != null), c => p.cats[c].plan + sum(adj.filter(x => x.cat === c), x => x.amount) - num(used[c]));
}
/** Categories whose budget weeks (typed × the mix factor) fall outside their role's weeks-of-supply range on the
    Guidelines page: the budget would plan stock the Scorecard and Stuck money then call too thin or too heavy. */
function wosConflicts(P = PLANS.cur){
  if (!P) return [];
  return P.order.filter(c => P.cats[c].plan != null).map(c => {
    const w = (ROLES[roleKey(c)] || {}).wks, v = num(P.cats[c].wosEff);
    return w && (v > w[1] + 0.05 || v < w[0] - 0.05) ? {c, name: P.cats[c].name, role: ROLES[roleKey(c)].name, wks: v, lo: w[0], hi: w[1], dir: v > w[1] ? 'above' : 'below'} : null;
  }).filter(Boolean);
}
/* the fiscal year being planned: the year of the first month not yet closed (plan_fy in engine.py) */
const curFY = () => BASE ? fyOf(BASE.partial ? BASE.partial.m : addMonths(BASE.actualThrough, 1)) : fyOf(THIS_MONTH);
/* a category's sales a year before month k: this data's actual where it has one, else its history */
const lastYear = (v, k) => { const kk = addMonths(k, -12); return kk in v.act ? v.act[kk] : num(v.hist[kk]); };

function salesPlan(base, a){
  const fy = curFY(), m27 = fyMonths(fy), m28 = fyMonths(fy + 1);
  const beyond = [1, 2, 3, 4].map(i => addMonths(m28[11], i)), S = {};
  for (const [c, v] of Object.entries(base.cats)){
    const s = {};
    for (const k of m27) s[k] = (k in v.act) ? v.act[k] : lastYear(v, k) * (1 + num(a.g27[k]) + num(a.g27cat[c]));
    for (const k of m28) s[k] = s[addMonths(k, -12)] * (1 + num(a.g28[c]));
    for (const k of beyond) s[k] = s[addMonths(k, -12)];
    S[c] = s;
  }
  return {S, m27, m28};
}
/* special orders' part of a category's sales in month k: that month's own when it has sales, else the same month's a year before */
function soShare(v, k){
  const so = v.so || {};
  for (let i = 0; i < 4; i++){
    const kk = addMonths(k, -12 * i), tot = num(v.act[kk]) || num(v.hist[kk]);
    if (tot) return Math.min(Math.max(num(so[kk]) / tot, 0), 1);
  }
  return 0;
}
/* Linking the budget to the mix total: one factor for every budgeted category's target weeks, so the target month-end
   stock, averaged over the first 12 months the engine plans, equals the total. Turns are a year's cost of sales over
   average stock, and the mix's suggested total is that year's cost over the turns target, so the two then agree.
   Target stock is linear in the weeks, so the factor is exact. 1 when no total is saved. (mix_scale in engine.py) */
function mixScale(total, months, target, exclude){
  if (!(num(total) > 0)) return 1;
  const year = months.slice(0, 12); let t = 0;
  for (const c of Object.keys(target)) if (!exclude.includes(c)) for (const k of year) t += target[c][k];
  const avg = year.length ? t / year.length : 0;
  return avg > 0 ? total / avg : 1;
}
/* budgets are set on shelf sales and shelf stock: special orders are bought when a customer orders */
function runEngine(base, a, carry = {}){
  const {S, m27, m28} = salesPlan(base, a), part = base.partial;
  const start = part ? part.m : addMonths(base.actualThrough, 1);
  const share = part ? 1 - part.actual / Object.keys(S).reduce((t, c) => t + S[c][part.m], 0) : 1;
  const months = m27.concat(m28).filter(k => k >= start), cats = {}, shelf = {}, target = {};
  // target month-end stock at the typed weeks: weeks x next four months' cost of shelf sales / 17.3
  for (const [c, v] of Object.entries(base.cats)){
    const cr = 1 - v.gm, sh = shelf[c] = {}, tg = target[c] = {};
    for (const k of Object.keys(S[c])) sh[k] = S[c][k] * (1 - soShare(v, k));
    for (const k of months){ let f = 0; for (let i = 1; i <= 4; i++) f += sh[addMonths(k, i)]; tg[k] = num(a.wos[c]) * f / 17.3 * cr; }
  }
  const scale = mixScale(a.mixTotal, months, target, base.exclude || ['640']);
  for (const [c, v] of Object.entries(base.cats)){
    const cr = 1 - v.gm, rows = [];
    let bom = v.onHand - num(v.soOnHand);
    for (const k of months){
      if (k === m28[0]) bom += num(carry[c]);
      const x = part && k === part.m ? share : 1, sales = S[c][k] * x, sh = shelf[c][k] * x, cogs = sh * cr;
      const eom = target[c][k] * scale;
      rows.push({m: k, sales, shelf: sh, cogs, bom, eom, otb: eom - bom + cogs});
      bom = eom;
    }
    cats[c] = rows;
  }
  return {S, m27, m28, months, cats, share, start, scale};
}
function planFor(E, fy, a, carry){
  const win = E.months.filter(k => fyOf(k) === fy), cats = {}, isCur = fy === curFY();
  for (const code of BASE.order){
    const v = BASE.cats[code], rows = E.cats[code].filter(r => win.includes(r.m));
    const otb = sum(rows, r => r.otb), cogs = sum(rows, r => r.cogs), sales = sum(rows, r => r.sales), shelf = sum(rows, r => r.shelf);
    const excluded = (BASE.exclude || ['640']).includes(code);
    const call = excluded ? 'excluded' : otb < 0 ? 'stop' : (REPLENISH.has(code) || otb < cogs * .1) ? 'replenish' : 'buy';
    cats[code] = {name: v.name, call, plan: excluded ? null : otb, target: rows.length ? rows[rows.length - 1].eom : 0, cogs, sales,
      wos: a.wos[code], wosEff: num(a.wos[code]) * E.scale, gm: v.gm, onHand: rows.length ? rows[0].bom : v.onHand - num(v.soOnHand), soOnHand: num(v.soOnHand), shelf, carry: num((carry || {})[code]),
      fySales: sum(fyMonths(fy), k => E.S[code][k]), mplan: Object.fromEntries(rows.map(r => [r.m, r.otb]))};
  }
  const start = isCur ? (() => { const d = new Date(BASE.asOf + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); })() : win[0] + '-01';
  return {fy: fyLabel(fy), fyNum: fy, current: isCur, asOf: BASE.asOf, start, window: {from: win[0], to: win[win.length - 1]},
    months: win.map(m => ({m, otb: sum(BASE.order.filter(c => cats[c].plan != null), c => cats[c].mplan[m])})), order: BASE.order, cats, scale: E.scale, mixTotal: a.mixTotal};
}
/* The weeks the budget really uses for a category: the typed weeks, times the mix factor while the budget is linked to
   the saved mix total. */
const wosNum = v => Math.round(v * 10) / 10;
function wosLabel(c, P = PLAN){
  if (!P || !(P.scale > 0) || Math.abs(P.scale - 1) < 1e-9) return `${c.wos} weeks`;
  return `${wosNum(c.wosEff)} weeks (${c.wos} × ${P.scale.toFixed(2)}, linked to the ${money(P.mixTotal)} stock plan)`;
}
/* One sentence for the pages that explain target stock, while the budget is linked to the mix total; '' otherwise. */
function mixLinkTxt(P = PLAN){
  if (!P || !P.mixTotal || Math.abs(P.scale - 1) < 1e-9) return '';
  return `The budget is linked to the ${money(P.mixTotal)} total stock to plan for (Guidelines → Merchandise mix): every category's target weeks are multiplied by ${P.scale.toFixed(2)}, so target stock averages ${money(P.mixTotal)} over the next 12 months.`;
}
const adjKey = P => 'fy' + String(P.fy).slice(-2);
/* committed cost by category inside a plan's window (orders due or received in it) */
function committedIn(P){
  const out = {};
  for (const e of ledger(POS, P)) if (e.b && e.b !== 'before' && e.b !== 'later') out[e.cat] = (out[e.cat] || 0) + e.committed;
  return out;
}
function derive(){
  if (!BASE){ PLANS = {cur: LEGACY_PLAN}; PLAN = LEGACY_PLAN; ADJ = ADJS[adjKey(PLAN)] || []; return; }
  const a = assumptions(), fy = curFY();
  const E1 = runEngine(BASE, a), p1 = planFor(E1, fy, a);
  const used = committedIn(p1), adj1 = ADJS[adjKey(p1)] || [], carry = {};
  for (const c of BASE.order){
    const pc = p1.cats[c]; if (pc.plan == null){ carry[c] = 0; continue; }
    const budget = pc.plan + sum(adj1.filter(x => x.cat === c), x => x.amount);
    carry[c] = Math.max(budget, num(used[c]), 0) - pc.plan;   // stock above plan entering next year
  }
  ENG = runEngine(BASE, a, carry);
  PLANS = {cur: p1, next: planFor(ENG, fy + 1, a, carry)};
  PLAN = PLANS[FYSEL] || p1;
  ADJ = ADJS[adjKey(PLAN)] || [];
}
/* one-line reason for a category's call, in plain words */
function callWhy(c){
  if (c.call === 'stop') return `Opening stock already covers what ${c.name} needs for the year.`;
  if (c.call === 'replenish') return 'Replace what sells; hold off on new lines.';
  if (c.call === 'excluded') return 'Customer-ordered; tracked but not budgeted.';
  return 'Growing and productive — buy within budget.';
}
const periodTxt = P => `${dateLabel(P.start)} – ${dateLabel(P.window.to + '-' + pad(new Date(+P.window.to.slice(0,4), +P.window.to.slice(5,7), 0).getDate()))}`;
function planKeyFor(m){
  if (!m || !BASE) return FYSEL;
  const f = fyOf(m);
  if (PLANS.next && f === PLANS.next.fyNum) return 'next';
  if (PLANS.cur && f === PLANS.cur.fyNum) return 'cur';
  return FYSEL;
}
function withPlan(key, fn){
  const P0 = PLAN, A0 = ADJ;
  if (PLANS[key]){ PLAN = PLANS[key]; ADJ = ADJS[adjKey(PLAN)] || []; }
  try { return fn(); } finally { PLAN = P0; ADJ = A0; }
}
const planWeeks = (P = PLAN) => Math.max(1, daysBetween(P.start, P.window.to + '-' + pad(new Date(+P.window.to.slice(0,4), +P.window.to.slice(5,7), 0).getDate())) + 1) / 7;
/* weeks the stock on hand lasts at this year's forecast pace */
function wksNow(code, cost){ const P = PLANS.cur || PLAN, c = P.cats[code]; return c && c.cogs ? Math.max(cost - num(c.soOnHand), 0) / (c.cogs / planWeeks(P)) : 0; }
