
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

/* saved assumptions (plan/assumptions) over the pipeline defaults, then this viewer's unsaved what-if */
function assumptions(){
  const d = BASE.defaults, s = SAVED || {}, w = WHATIF || {};
  const m = k => ({...(d[k] || {}), ...(s[k] || {}), ...(w[k] || {})});
  return {g27: m('g27'), g27cat: m('g27cat'), g28: m('g28'), wos: m('wos')};
}
const curFY = () => BASE ? fyOf(BASE.partial ? BASE.partial.m : addMonths(BASE.actualThrough, 1)) : 2027;

function salesPlan(base, a){
  const fy = +base.fy.slice(2), m27 = fyMonths(fy), m28 = fyMonths(fy + 1);
  const beyond = [1, 2, 3, 4].map(i => addMonths(m28[11], i)), S = {};
  for (const [c, v] of Object.entries(base.cats)){
    const s = {};
    for (const k of m27) s[k] = (k in v.act) ? v.act[k] : num(v.hist[addMonths(k, -12)]) * (1 + num(a.g27[k]) + num(a.g27cat[c]));
    for (const k of m28) s[k] = s[addMonths(k, -12)] * (1 + num(a.g28[c]));
    for (const k of beyond) s[k] = s[addMonths(k, -12)];
    S[c] = s;
  }
  return {S, m27, m28};
}
function runEngine(base, a, carry = {}){
  const {S, m27, m28} = salesPlan(base, a), part = base.partial;
  const start = part ? part.m : addMonths(base.actualThrough, 1);
  const share = part ? 1 - part.actual / Object.keys(S).reduce((t, c) => t + S[c][part.m], 0) : 1;
  const months = m27.concat(m28).filter(k => k >= start), cats = {};
  for (const [c, v] of Object.entries(base.cats)){
    const cr = 1 - v.gm, rows = [];
    let bom = v.onHand;
    for (const k of months){
      if (k === m28[0]) bom += num(carry[c]);
      const sales = S[c][k] * (part && k === part.m ? share : 1), cogs = sales * cr;
      let f = 0; for (let i = 1; i <= 4; i++) f += S[c][addMonths(k, i)];
      const eom = num(a.wos[c]) * f / 17.3 * cr;
      rows.push({m: k, sales, cogs, bom, eom, otb: eom - bom + cogs});
      bom = eom;
    }
    cats[c] = rows;
  }
  return {S, m27, m28, months, cats, share, start};
}
function planFor(E, fy, a, carry){
  const win = E.months.filter(k => fyOf(k) === fy), cats = {}, isCur = fy === curFY();
  for (const code of BASE.order){
    const v = BASE.cats[code], rows = E.cats[code].filter(r => win.includes(r.m));
    const otb = sum(rows, r => r.otb), cogs = sum(rows, r => r.cogs), sales = sum(rows, r => r.sales);
    const excluded = (BASE.exclude || ['640']).includes(code);
    const call = excluded ? 'excluded' : otb < 0 ? 'stop' : (REPLENISH.has(code) || otb < cogs * .1) ? 'replenish' : 'buy';
    cats[code] = {name: v.name, call, plan: excluded ? null : otb, target: rows.length ? rows[rows.length - 1].eom : 0, cogs, sales,
      wos: a.wos[code], gm: v.gm, onHand: rows.length ? rows[0].bom : v.onHand, carry: num((carry || {})[code]),
      fySales: sum(fyMonths(fy), k => E.S[code][k]), mplan: Object.fromEntries(rows.map(r => [r.m, r.otb]))};
  }
  const start = isCur ? (() => { const d = new Date(BASE.asOf + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); })() : win[0] + '-01';
  return {fy: fyLabel(fy), fyNum: fy, current: isCur, asOf: BASE.asOf, start, window: {from: win[0], to: win[win.length - 1]},
    months: win.map(m => ({m, otb: sum(BASE.order.filter(c => cats[c].plan != null), c => cats[c].mplan[m])})), order: BASE.order, cats};
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
function wksNow(code, cost){ const P = PLANS.cur || PLAN, c = P.cats[code]; return c && c.cogs ? cost / (c.cogs / planWeeks(P)) : 0; }
