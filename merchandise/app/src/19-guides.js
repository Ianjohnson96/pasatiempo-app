/* ---------- merchandise mix and suggested values for the Guidelines page (pure; no page globals at load) ----------
   Mix = each category role's share of stock dollars at cost, against a target range in percent of a total the owner
   types. Suggested ranges come from each role's share of 12-month sales; the suggested total from what those sales cost
   divided by the turns target. Special Orders (640) are never part of the mix. */
// The owner's saved guidelines/current (90-io.js keeps it live and applies it with applyGuides), or null.
let GUIDE = null;
const MIX_ROLES = ['fashion', 'impulse', 'hardgoods', 'consumable', 'demo'];

/** "$700,000", "700000", "700k", "1.2m" -> dollars; blank, unreadable or not above zero -> null. */
function parseMoney(s){
  const m = /^\s*\$?\s*([\d,]*\.?\d+)\s*([km])?\s*$/i.exec(String(s == null ? '' : s));
  if (!m) return null;
  const v = parseFloat(m[1].replace(/,/g, '')) * (m[2] ? (m[2].toLowerCase() === 'k' ? 1e3 : 1e6) : 1);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}

/** {role: share of 12-month sales} from assort rows (cat, t12); every mix role present, 640 left out; null without sales. */
function salesShareByRole(rows){
  const by = Object.fromEntries(MIX_ROLES.map(r => [r, 0]));
  let tot = 0;
  for (const r of rows || []){
    if (!r || !r.cat || r.cat === '640') continue;
    const v = Math.max(0, Number(r.t12) || 0);
    by[roleKey(r.cat)] = (by[roleKey(r.cat)] || 0) + v; tot += v;
  }
  if (!(tot > 0)) return null;   // no sales data yet: nothing to suggest from
  for (const r in by) by[r] = by[r] / tot;
  return by;
}

/** Stock for the mix, counted the way the Budget counts it: shelf stock at cost, by role — each category's on hand less
    the special orders filed in it (soOnHand), with Special Orders (640) left out. Also what that leaves out, so the page
    can tie it back to Stock & counts: all = every category, so640 = Special Orders, soIn = special orders elsewhere. */
function mixStock(cats){
  const out = {oh: {}, onHand: 0, all: 0, so640: 0, soIn: 0};
  for (const [c, v] of Object.entries(cats || {})){
    const oh = Math.max(0, Number(v && v.onHand) || 0);
    out.all += oh;
    if (c === '640'){ out.so640 += oh; continue; }
    const so = Math.min(oh, Math.max(0, Number(v.soOnHand) || 0)), shelf = oh - so, r = roleKey(c);
    out.soIn += so; out.onHand += shelf; out.oh[r] = (out.oh[r] || 0) + shelf;
  }
  return out;
}

/** {role: [lo, hi]} in whole percentage points: sales share ± 5, floored at 0. */
function suggestedRanges(shares){
  const out = {};
  for (const r in shares || {}){ const p = (Number(shares[r]) || 0) * 100; out[r] = [Math.max(0, Math.round(p - 5)), Math.round(p + 5)]; }
  return out;
}

/** A category's turns target (bench from guideValues): balls and gloves the fast target, the rest their segment's, as
    the Scorecard grades them. */
function turnsFor(bench, cat){ const t = (bench || BENCH).turns; return FAST_TURN.has(cat) ? t.fast : t[SEGOF(cat)]; }

/** Shelf stock the last 12 months' sales support: each category's cost of shelf sales ((t12 − special orders) ×
    (1 − margin)) divided by its turns target. `turns` is one number for every category, or cat => turns. Special orders
    are bought when a customer orders, so, as in the budget, they need no shelf stock. Mirrors config.suggested_total. */
function suggestedTotal(rows, turns){
  const tf = typeof turns === 'function' ? turns : () => turns;
  let stock = 0;
  for (const r of rows || []){
    if (!r || !r.cat || r.cat === '640') continue;
    const t = Number(tf(r.cat));
    if (t > 0) stock += Math.max(0, (Number(r.t12) || 0) - (Number(r.so) || 0)) * (1 - (Number(r.gm) || 0)) / t;
  }
  return Math.round(stock);
}

/** The total stock the budget is linked to under a guidelines document: the suggested total, from these assort rows
    and the document's turns targets, while it follows the suggestion; else the typed total; null for none. */
function mixTotalOf(doc, rows){
  const v = guideValues(doc), m = v.mix;
  if (m.follow === 'suggested'){ const s = suggestedTotal(rows, c => turnsFor(v.bench, c)); return s > 0 ? s : m.total; }
  return m.total;
}

/** One row per role, in MIX_ROLES order: on hand, share of stock and of sales, the target range in % and dollars at
    `total`, and whether it is in range, short (gap = dollars to the bottom) or over (gap = dollars above the top). */
function mixRows(onHandByRole, salesShares, ranges, total){
  const oh = onHandByRole || {}, all = MIX_ROLES.reduce((a, r) => a + Math.max(0, Number(oh[r]) || 0), 0);
  return MIX_ROLES.map(role => {
    const onHand = Math.max(0, Number(oh[role]) || 0), [lo, hi] = (ranges || {})[role] || [0, 100];
    const loDollar = total * lo / 100, hiDollar = total * hi / 100;
    const status = onHand < loDollar - 0.5 ? 'short' : onHand > hiDollar + 0.5 ? 'over' : 'in';
    return {role, name: (ROLES[role] || {}).name || role, onHand, share: all > 0 ? onHand / all : 0, salesShare: Number((salesShares || {})[role]) || 0,
      lo, hi, loDollar, hiDollar, status, gap: status === 'short' ? loDollar - onHand : status === 'over' ? onHand - hiDollar : 0};
  });
}

/** What the ranges' low and high ends add up to, in percent. */
function rangeSum(ranges){
  let lo = 0, hi = 0;
  for (const r in ranges || {}){ lo += Number(ranges[r][0]) || 0; hi += Number(ranges[r][1]) || 0; }
  return {lo, hi};
}

/** Room to buy by month for the plan year, as saved and with changed target weeks of supply ({code: weeks}): runs the
    budget engine (20-engine.js runEngine) twice, so the preview is exactly what saving would give. Only the changed
    categories and the total are returned; nothing global changes. */
function wosPreview(base, a, changes, carry){
  const codes = Object.keys(changes || {}).filter(c => base.cats[c]);
  const E0 = runEngine(base, a, carry || {}), E1 = codes.length ? runEngine(base, {...a, wos: {...a.wos, ...changes}}, carry || {}) : E0;
  const months = E0.m27.filter(k => E0.months.includes(k));
  const room = (E, c) => months.map(k => { const r = E.cats[c].find(x => x.m === k); return r ? r.otb : 0; });
  const pick = E => {
    const out = {}; for (const c of codes) out[c] = room(E, c);
    out.total = months.map((k, i) => Object.keys(base.cats).filter(c => !(base.exclude || ['640']).includes(c)).reduce((t, c) => t + room(E, c)[i], 0));
    return out;
  };
  return {months, before: pick(E0), after: pick(E1)};
}
