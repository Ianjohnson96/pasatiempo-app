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

/** {role: share of 12-month sales} from assort rows (cat, t12); every mix role present, 640 left out. */
function salesShareByRole(rows){
  const by = Object.fromEntries(MIX_ROLES.map(r => [r, 0]));
  let tot = 0;
  for (const r of rows || []){
    if (!r || !r.cat || r.cat === '640') continue;
    const v = Math.max(0, Number(r.t12) || 0);
    by[roleKey(r.cat)] = (by[roleKey(r.cat)] || 0) + v; tot += v;
  }
  for (const r in by) by[r] = tot > 0 ? by[r] / tot : 0;
  return by;
}

/** {role: [lo, hi]} in whole percentage points: sales share ± 5, floored at 0. */
function suggestedRanges(shares){
  const out = {};
  for (const r in shares || {}){ const p = (Number(shares[r]) || 0) * 100; out[r] = [Math.max(0, Math.round(p - 5)), Math.round(p + 5)]; }
  return out;
}

/** Stock the last 12 months' sales support: their cost (t12 × (1 − margin)) divided by the turns target. */
function suggestedTotal(rows, turnsMid){
  if (!(turnsMid > 0)) return 0;
  let cost = 0;
  for (const r of rows || []) if (r && r.cat && r.cat !== '640') cost += Math.max(0, Number(r.t12) || 0) * (1 - (Number(r.gm) || 0));
  return Math.round(cost / turnsMid);
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
