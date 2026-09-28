"""Build the Merchandise Program's data documents from parsed POS reports.

Outputs (each becomes one document in the app database):
  base/current        category sales history, actuals to date, margin, inventory, planning defaults
  inventory/current   on-hand at cost by category
  insights/current    item-level suggestions (reorder, aged, split combined SKUs, ...)
  brands/current      brand scorecard with segment, metrics, monthly series and a recommended call
  skuhist/FYyyyy      SKU monthly unit history (so next month only needs the current reports)
  skuhist/meta        SKU category, description and average selling price

All inventory and OTB values are at cost; sales are at retail. Fiscal year runs May 1 - Apr 30.
"""
import re
from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta

from brands import brand_of, brand_split, segment_of, is_hat
from config import (CATS, OTB_EXCLUDE, TARGET_WOS, MARKDOWN, G27_DEFAULT, G28_DEFAULT, COMBINED, DAILY_NAMES)

MERCH = set(CATS)
MON = {'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12}


# ---------- month helpers ----------
def ym(y, m):
    return f'{y}-{m:02d}'


def add_months(k, n):
    y, m = int(k[:4]), int(k[5:])
    t = y * 12 + (m - 1) + n
    return ym(t // 12, t % 12 + 1)


def fy_of(k):
    y, m = int(k[:4]), int(k[5:])
    return y + 1 if m >= 5 else y


def fy_months(fy):
    return [add_months(ym(fy - 1, 5), i) for i in range(12)]


def pos_date(s):
    m = re.match(r'([A-Z][a-z]{2})(\d{2})/(\d{2})', s or '')
    return date(2000 + int(m.group(3)), MON[m.group(1)], int(m.group(2))) if m else None


def month_end(k):
    y, m = int(k[:4]), int(k[5:])
    return date(y, m, monthrange(y, m)[1])


# ---------- SKU history ----------
def merge_history(sku_reports, prior=None):
    """Merge SKU Analysis reports (oldest first) into {sku: {ym: units}}; later reports win."""
    hist = defaultdict(dict)
    for fy, d in (prior or {}).items():
        for sku, arr in d.items():
            for k, u in zip(fy_months(int(fy[2:])), arr):
                if u:
                    hist[sku][k] = u
    for rep in sorted(sku_reports, key=lambda r: r['as_of']):
        for r in rep['rows']:
            hist[r['sku']].update(r['mo'])
    return hist


def history_docs(hist, meta, fys):
    out = {}
    for fy in fys:
        ms = fy_months(fy)
        d = {}
        for sku, mo in hist.items():
            arr = [int(mo.get(k, 0)) for k in ms]
            if any(arr):
                d[sku] = arr
        out[f'FY{fy}'] = d
    out['meta'] = meta
    return out


def prices(items_reports, prior_meta, snap):
    """Average selling price by SKU: latest Sales by Item wins, then prior, then category average."""
    p = {s: v[2] for s, v in (prior_meta or {}).items() if v[2]}
    for it in items_reports:
        for s, v in it.items():
            if v['units']:
                p[s] = v['value'] / v['units']
    return p


def fytd_by_category(cat_reports, fy, cur):
    """Sales by category from a Net Sales by Category run May 1 through the current month, or None."""
    for cr in cat_reports:
        per = cr.get('period')
        if not per:
            continue
        a, b = per
        if not a.strip().startswith('May 1/'):
            continue
        start_y, end = 2000 + int(a[-2:]), ym(2000 + int(b[-2:]), MON[b[:3]])
        if fy_of(ym(start_y, 5)) == fy and end == cur:
            return {c: sum(i['value'] for i in cr['cats'].get(c, {}).get('items', [])) for c in MERCH}
    return None


# ---------- main build ----------
def build(reports, prior=None):
    """reports: dict kind -> parsed report (lists for sku_analysis, rounds, sales_by_item, sales_by_category, best100).
    prior: previously published docs {'base':..., 'skuhist': {...}} or None for the first build."""
    prior = prior or {}
    skus = sorted(reports['sku_analysis'], key=lambda r: r['as_of'])
    snap_rep = skus[-1]
    snap = {r['sku']: r for r in snap_rep['rows'] if r['cat_no'] in MERCH}
    daily = reports.get('daily_sales')
    as_of = date.fromisoformat(daily['date']) if daily else month_end(snap_rep['as_of'])
    cur = ym(as_of.year, as_of.month)
    is_month_end = as_of == month_end(cur)
    actual_through = cur if is_month_end else add_months(cur, -1)
    fy = fy_of(cur)

    phist = prior.get('skuhist', {})
    hist = merge_history(skus, {k: v for k, v in phist.items() if k.startswith('FY')})
    pmeta = phist.get('meta', {})
    price = prices(reports.get('sales_by_item', []), pmeta, snap)

    # category of each SKU: snapshot, then prior meta
    cat_of = {s: v[0] for s, v in pmeta.items()}
    desc_of = {s: v[1] for s, v in pmeta.items()}
    for rep in skus:
        for r in rep['rows']:
            cat_of[r['sku']] = r['cat_no']
            desc_of[r['sku']] = r['desc']
    # longer descriptions win: Sales by Item, then the cost & margin report
    for it in reports.get('sales_by_item', []):
        for s, v in it.items():
            desc_of[s] = v['desc']
    for b in reports.get('best100', []):
        for r in b['rows']:
            desc_of[r['sku']] = r['desc']

    # category fallback price = average of priced SKUs, weighted by last fiscal year's units
    lyms = set(fy_months(fy - 1))
    cu, cv = defaultdict(float), defaultdict(float)
    for s, mo in hist.items():
        c = cat_of.get(s)
        if c in MERCH and s in price:
            u = sum(x for k, x in mo.items() if k in lyms)
            cu[c] += u
            cv[c] += u * price[s]
    cat_price = {c: cv[c] / cu[c] for c in cu if cu[c]}

    def px(s):
        return price.get(s, cat_price.get(cat_of.get(s), 0))

    est = defaultdict(lambda: defaultdict(float))  # cat -> ym -> estimated $
    for s, mo in hist.items():
        c = cat_of.get(s)
        if c not in MERCH:
            continue
        p = px(s)
        for k, u in mo.items():
            est[c][k] += u * p

    # ----- last year's history by category (fixed once built) -----
    pbase = prior.get('base')
    hist_fy = {}  # fy -> cat -> ym -> $
    if pbase:
        for c, v in pbase['cats'].items():
            for k, x in v.get('hist', {}).items():
                hist_fy.setdefault(fy_of(k), {}).setdefault(c, {})[k] = x
        # once the fiscal year turns, the last upload's actuals become last year's history; months it
        # hadn't closed yet come from the SKU history, scaled the way its closed months were
        pfy = int(str(pbase.get('fy') or 'FY0')[2:] or 0)
        if pfy < fy and pfy not in hist_fy:
            ms = fy_months(pfy)
            pact = {c: (pbase['cats'].get(c) or {}).get('act', {}) for c in MERCH}
            have = [k for k in ms if any(k in a for a in pact.values())]
            est_have = sum(est[c].get(k, 0) for c in MERCH for k in have)
            f = sum(pact[c].get(k, 0) for c in MERCH for k in have) / est_have if est_have else 1.0
            hist_fy[pfy] = {c: {k: pact[c].get(k, 0) if k in have else est[c].get(k, 0) * f for k in ms} for c in MERCH}
    for cr in reports.get('sales_by_category', []):
        # a full fiscal-year category report defines that year's history
        per = cr['period']
        if not per:
            continue
        a, b = per
        am, bm = MON[a[:3]], MON[b[:3]]
        by = 2000 + int(b[-2:])
        if am == 5 and bm == 4 and a.strip().startswith('May 1') and b.strip().startswith('Apr 30'):
            yr = by
            ms = fy_months(yr)
            hist_fy[yr] = {}
            for c in MERCH:
                rep = sum(i['value'] for i in cr['cats'].get(c, {}).get('items', []))
                tot = sum(est[c].get(k, 0) for k in ms)
                f = rep / tot if tot else 0
                hist_fy[yr][c] = {k: est[c].get(k, 0) * f for k in ms}

    ly = fy - 1
    if ly not in hist_fy:
        raise ValueError(f'Last year\'s (FY{ly}) monthly sales are missing. Load a month-end data file first, or include the full-year Sales by Category for FY{ly}.')

    # ----- this year's actuals -----
    closed = [k for k in fy_months(fy) if k <= actual_through]
    partial = None
    ytd_cat = {}
    if daily:
        rep_closed = daily['report']['fytd'] - (0 if is_month_end else daily['report']['mtd'])
        if not is_month_end:
            partial = dict(m=cur, actual=round(daily['report']['mtd'], 2), day=as_of.day, days=monthrange(as_of.year, as_of.month)[1])
        for name, v in daily['cats'].items():
            code = DAILY_NAMES.get(name)
            if code and v['tot']:
                ytd_cat[code] = v['tot']['fytd']
    else:
        rep_closed = None
    est_closed = sum(est[c].get(k, 0) for c in MERCH for k in closed)
    f = rep_closed / est_closed if rep_closed and est_closed else 1.0
    act = {c: {k: est[c].get(k, 0) * f for k in closed} for c in MERCH}
    if not daily and closed:
        # No Daily Sales Report: a Sales by Category from May 1 to this month gives each category's actual
        # sales so far, so the monthly estimates are scaled to it (spread like last year where there's no estimate).
        fytd = fytd_by_category(reports.get('sales_by_category', []), fy, cur)
        if fytd:
            for c in MERCH:
                target, tot = fytd.get(c, 0.0), sum(act[c].values())
                if tot > 0:
                    act[c] = {k: v * target / tot for k, v in act[c].items()}
                else:
                    shape = {k: hist_fy.get(ly, {}).get(c, {}).get(add_months(k, -12), 0) for k in closed}
                    st = sum(shape.values())
                    act[c] = {k: (target * v / st if st else target / len(closed)) for k, v in shape.items()}
                ytd_cat[c] = target
            rep_closed = sum(fytd.get(c, 0.0) for c in MERCH)
    units_closed = sum(u for sk, mo in hist.items() if cat_of.get(sk) in MERCH for k, u in mo.items() if k in closed)
    if closed and units_closed > 0 and sum(v for c in MERCH for v in act[c].values()) <= 0:
        raise ValueError("This year's sales come out at $0: there are no selling prices to turn unit sales into dollars. "
                         "Include the Net Sales by Item report (fiscal year to date from May 1), or the Daily Sales Report "
                         "or Net Sales by Category (May 1 to date).")

    # ----- margin by category (realized, from the cost & margin report) -----
    best = reports.get('best100', [])
    gm = {}
    sku_gm = {}
    if best:
        g, co = defaultdict(float), defaultdict(float)
        for r in best[-1]['rows']:
            g[r['cat_no']] += r['gross']
            co[r['cat_no']] += r['cost']
            if r['qty'] > 0 and r['gross'] > 0:
                sku_gm[r['sku']] = dict(g=r['gross'], c=r['cost'], md=r['markdown'], q=r['qty'])
        gm = {c: (1 - co[c] / g[c]) if g[c] else 0.4 for c in MERCH}
    elif pbase:
        gm = {c: pbase['cats'][c]['gm'] for c in MERCH}

    # ----- inventory -----
    inv = {c: dict(units=0, cost=0.0, aged=0.0, skus=0) for c in MERCH}
    for s, r in snap.items():
        if r['oh'] <= 0:
            continue
        v = r['oh'] * r['cost']
        a = inv[r['cat_no']]
        a['units'] += r['oh']
        a['cost'] += v
        a['skus'] += 1
        ls = pos_date(r['last_sale'])
        if not ls or (as_of - ls).days > 365:
            a['aged'] += v

    order = sorted([c for c in MERCH if c not in OTB_EXCLUDE], key=lambda c: -sum(hist_fy[ly][c].values()))
    order += sorted(OTB_EXCLUDE)

    cats = {}
    for c in MERCH:
        hv = {}
        for y in sorted(hist_fy):
            hv.update({k: round(v, 2) for k, v in hist_fy[y].get(c, {}).items()})
        cats[c] = dict(name=CATS[c], gm=round(gm[c], 4), md=MARKDOWN[c], onHand=round(inv[c]['cost'], 2), units=inv[c]['units'],
                       aged=round(inv[c]['aged'], 2), skus=inv[c]['skus'], hist=hv,
                       act={k: round(v, 2) for k, v in act[c].items()}, ytdReported=round(ytd_cat.get(c, 0), 2))
    # 18-hole rounds by calendar month (the current year's later months are forward bookings)
    rounds = {}
    groups = {'total': 'Report Totals', 'member': 'Member Rounds Total', 'guest': 'Guest Rounds Total', 'public': 'Public Rounds Total'}
    for r in reports.get('rounds', []):
        rounds[str(r['year'])] = {k: r['rows'][v][:12] for k, v in groups.items() if v in r['rows']}
    for y, v in ((prior.get('base') or {}).get('rounds') or {}).items():
        rounds.setdefault(y, v)

    base = dict(asOf=as_of.isoformat(), fy=f'FY{fy}', actualThrough=actual_through, partial=partial, cats=cats, order=order,
                ytdActual=round(rep_closed or sum(v for c in MERCH for v in act[c].values()), 2), ytdReport=round(daily['report']['fytd'], 2) if daily else None,
                defaults=dict(g27={k: v for k, v in G27_DEFAULT.items()}, g28=G28_DEFAULT, wos=TARGET_WOS),
                rounds=rounds, exclude=sorted(OTB_EXCLUDE))

    inventory = dict(asOf=as_of.isoformat(), source=f"SKU Analysis as of {snap_rep['as_of']} (on-hand x current cost price)",
                     cats={c: dict(units=v['units'], cost=round(v['cost'], 2), aged=round(v['aged'], 2), skus=v['skus']) for c, v in inv.items()})

    meta = {}
    for s, c in cat_of.items():
        if c in MERCH and (s in hist and any(hist[s].values()) or s in snap):
            meta[s] = [c, desc_of.get(s, ''), round(price.get(s, 0), 2)]
    skuhist = history_docs(hist, meta, sorted({fy_of(k) for mo in hist.values() for k in mo}))

    ctx = dict(as_of=as_of, cur=cur, actual_through=actual_through, fy=fy, snap=snap, sku_month=snap_rep['as_of'], hist=hist, px=px, sku_gm=sku_gm,
               bmap=((prior.get('brandmap') or {}).get('skus') or {}), blist=prior.get('brandmap') or {},
               desc_of=desc_of, cat_of=cat_of, items=reports.get('sales_by_item', []), base=base)
    return dict(base=base, inventory=inventory, skuhist=skuhist, ctx=ctx)


# ---------- insights ----------
def _window_units(mo, start, days):
    """Units in the `days` days starting at `start`, pro-rating months by day."""
    tot, d = 0.0, start
    end = start + timedelta(days=days)
    while d < end:
        k = ym(d.year, d.month)
        dim = monthrange(d.year, d.month)[1]
        last = min(end, date(d.year, d.month, dim) + timedelta(days=1))
        tot += mo.get(k, 0) * (last - d).days / dim
        d = last
    return tot


def build_insights(ctx, calls):
    """Item-level to-dos. `calls` maps category -> buy / replenish / stop / excluded."""
    as_of, snap, hist, px, sku_gm = ctx['as_of'], ctx['snap'], ctx['hist'], ctx['px'], ctx['sku_gm']
    base = ctx['base']
    last3 = [add_months(ctx['actual_through'], -i) for i in range(3)][::-1]
    start = as_of + timedelta(days=1)
    ly_start = date(start.year - 1, start.month, min(start.day, 28))
    # blended forecast growth over the next 13 weeks (day-weighted)
    g27 = base['defaults']['g27']
    gw, dsum, d = 0.0, 0, start
    while d < start + timedelta(days=91):
        gw += 1 + g27.get(ym(d.year, d.month), 0)
        dsum += 1
        d += timedelta(days=1)
    grow = gw / dsum
    out, seen = [], set()
    lbl = ' + '.join(date(2000, int(k[5:]), 1).strftime('%b') for k in last3)
    last3_lbl = f"{date(2000, int(last3[0][5:]), 1).strftime('%b')}–{date(2000, int(last3[-1][5:]), 1).strftime('%b')}"

    def add(kind, pri, r, title, detail, action, metrics):
        key = f"{kind}-{r['sku']}"
        if key in seen:
            return
        seen.add(key)
        metrics = dict(metrics, cost=round(r['cost'], 2))
        out.append(dict(id=key, kind=kind, priority=round(pri, 2), sku=r['sku'], desc=r['desc'], cat=r['cat_no'], title=title,
                        detail=detail, action=action, metrics=metrics))

    for s, r in snap.items():
        c = r['cat_no']
        mo = hist.get(s, {})
        recent = sum(mo.get(k, 0) for k in last3)
        ly13 = _window_units(mo, ly_start, 91)
        fwk = (ly13 * grow / 13) if ly13 >= 3 else (recent / 13 * 0.75)
        oh = r['oh']
        val = max(oh, 0) * r['cost']
        ls, lr = pos_date(r['last_sale']), pos_date(r['last_rec'])
        aur = px(s) or r['cost'] * 1.8
        call = calls.get(c, 'buy')
        oneoff = bool(re.search(r'\(|invitational|tournament|member.?guest|\b2[4-9]\b|ucsc|event', r['desc'], re.I))
        if oh < 0:
            dnu = bool(re.search(r'not use', r['desc'], re.I))
            add('data', (80 if dnu else 30) + abs(oh), r, 'Sales ringing to a retired SKU' if dnu else 'Negative on-hand',
                (f"This SKU is marked do-not-use but is still being sold (last sale {r['last_sale']}); it now shows {oh} on hand." if dnu
                 else f"System shows {oh} on hand while it's still selling (last sale {r['last_sale']})."),
                ('Find the SKU staff should be using, re-ring or adjust, and deactivate this one in the POS.' if dnu
                 else 'A receipt was never entered or sales are ringing to the wrong SKU. Fix before the next count.'), dict(oh=oh))
            continue
        if oh == 0 and recent >= 12 and call in ('buy', 'replenish') and not oneoff:
            add('stockout', recent * aur / 100, r, 'Out of stock and still in demand', f"Sold {recent} in {last3_lbl}; none on hand.",
                'Reorder if it is a continuing item.', dict(recent=recent, oh=0, suggest=max(round(fwk * 9), 1)))
            continue
        if oh <= 0:
            continue
        wos = oh / fwk if fwk > 0 else None
        if wos is not None and wos < 6 and recent >= 12 and call in ('buy', 'replenish') and not oneoff:
            need = max(round(fwk * 9 - oh), 1)
            add('reorder', (6 - wos) * fwk * aur / 50, r, f"About {max(round(wos), 1)} week{'s' if round(wos) != 1 else ''} of stock left",
                f"{oh} on hand; selling about {fwk:.1f} a week over the next few months.",
                f"Reorder now to cover the next 8–10 weeks (about {need} units).", dict(oh=oh, perWeek=round(fwk, 1), wos=round(wos, 1), suggest=need))
            continue
        days = (as_of - ls).days if ls else 9999
        if days > 365 and val >= 400:
            restock = lr and ls and (lr - ls).days > 180
            add('aged', val / 100, r, 'No sale in over a year' + (' — but restocked' if restock else ''),
                f"{oh} on hand, ${val:,.0f} at cost. Last sold {r['last_sale'] or 'never'}" + (f"; received again {r['last_rec']}." if restock else '.'),
                ('Stock was added after it stopped selling — check whether that receipt was an error or a return to vendor.' if restock else
                 ('Clear at or below cost.' if days > 730 else 'Mark down 40–50% or return to vendor.')),
                dict(oh=oh, value=round(val), daysSinceSale=days if days < 9000 else None))
            continue
        if wos is not None and wos > 52 and val >= 750 and days <= 365:
            add('overstock', val / 150, r, f"{wos:.0f} weeks of supply", f"{oh} on hand (${val:,.0f} at cost) against about {fwk:.1f} sold a week.",
                'Hold reorders. Consider a feature table or a markdown to move it.', dict(oh=oh, value=round(val), wos=round(wos)))
    # cost up at the same retail
    for s, b in sku_gm.items():
        r = snap.get(s)
        if not r or b['q'] < 20:
            continue
        old, new, aur = b['c'] / b['q'], r['cost'], b['g'] / b['q']
        if old <= 0 or new / old < 1.12:
            continue
        vol = sum(hist.get(s, {}).get(k, 0) for k in last3) * 4
        exp = (new - old) * vol
        if exp < 800:
            continue
        add('margin', exp / 200, r, f"Cost up {(new / old - 1) * 100:.0f}% at the same retail",
            f"Last cost ${new:.2f} vs ${old:.2f} actual last year; margin {((aur - old) / aur) * 100:.0f}% → {((aur - new) / aur) * 100:.0f}% at ${aur:.2f} average price.",
            'Check the latest invoice. If the cost is real, re-ticket; if this SKU mixes several products, the jump may be mix, not inflation.',
            dict(oldCost=round(old, 2), newCost=round(new, 2), aur=round(aur, 2), exposure=round(exp)))
    for sku, why in COMBINED.items():
        r = snap.get(sku)
        if not r:
            continue
        add('split', r['sold'] / 60, r, 'Combined SKU — split it', f"{why} {r['sold']:,} sold in the last 12 months; {max(r['oh'], 0):,} on hand.",
            "You can't see which design, color or size sells, so reorders are guesses and dead styles never show as aged. "
            "Split into one SKU per style (and size where your system allows).", dict(sold12=r['sold'], oh=r['oh']))
    cap = {'stockout': 15, 'reorder': 25, 'aged': 25, 'overstock': 15, 'margin': 12, 'split': 20, 'data': 13}
    final = []
    for k, n in cap.items():
        final += sorted([o for o in out if o['kind'] == k], key=lambda o: -o['priority'])[:n]
    return dict(asOf=as_of.isoformat(), items=final)


# ---------- brand scorecard ----------
def call_for(m):
    """Recommended call for a brand from its metrics. Returns (call, reason).
    Equipment and shoes run on thinner margins, so their return-on-inventory bars are half the apparel bars."""
    t12, oh, wks, aged, gmroi, md = m['t12'], m['oh'], m['wks'], m['agedPct'], m['gmroi'], m['md']
    ly, ty = m['ly'], m['ty']
    trend = (ty / ly - 1) if ly >= 10 else None
    if gmroi is not None and m['seg'] == 'equipment':
        gmroi *= 2
    if oh <= 0:
        if ty >= 12:
            return 'grow', 'Selling with nothing on hand — restock.'
        return 'inactive', 'Not in stock now — decide whether to bring it back.'
    if (ly < 10 and ty >= 20) or (trend is not None and trend > 1 and (gmroi or 0) < 1):
        return 'watch', 'New or fast-changing — judge after one more season.'
    if oh > 0 and t12 <= 0:
        return 'drop', 'Stock on hand and no sales in 12 months.'
    if gmroi is not None and gmroi < 0.7 and wks is not None and wks >= 50:
        return 'drop', 'Earns little on the money tied up, with a year or more of stock.'
    if t12 < 1000 and ty < 25:
        return 'drop', 'Too small to carry its own space and orders.'
    if aged > 0.5 and (gmroi or 0) < 1:
        return 'drop', 'Most of the stock has not sold in a year.'
    if ly == 0 and ty == 0 and oh > 0:
        return 'drop', 'No recent sales.'
    if t12 < 1500 and oh > 900 and ty < 20:
        return 'drop', 'Small sales against a large stock position.'
    if gmroi is not None and gmroi >= 2.5 and wks is not None and wks <= 16 and (trend is None or trend >= -0.2):
        return 'grow', 'High return on inventory and turning quickly.'
    if (gmroi is not None and gmroi < 1) or (wks is not None and wks > 40) or (md or 0) > 0.30 or \
            (trend is not None and trend < -0.25 and (wks or 0) > 20) or aged > 0.3:
        return 'reduce', 'Carry less: ' + ', '.join(x for x in [
            'low return on inventory' if gmroi is not None and gmroi < 1 else '',
            'too many weeks of stock' if wks is not None and wks > 40 else '',
            'heavy markdowns' if (md or 0) > 0.30 else '',
            'sales falling' if trend is not None and trend < -0.25 and (wks or 0) > 20 else '',
            'aged stock' if aged > 0.3 else ''] if x) + '.'
    return 'keep', 'Performing in line with the shop.'


def build_brands(ctx):
    as_of, snap, hist, px, sku_gm = ctx['as_of'], ctx['snap'], ctx['hist'], ctx['px'], ctx['sku_gm']
    desc_of, cat_of = ctx['desc_of'], ctx['cat_of']
    at = ctx['actual_through']
    t12m = [add_months(at, -i) for i in range(12)][::-1]
    last3 = t12m[-3:]
    ly3 = [add_months(k, -12) for k in last3]
    series_m = [add_months(at, -i) for i in range(24)][::-1]
    fy = ctx['fy']
    fyc = [k for k in fy_months(fy) if k <= at]
    fyl = [add_months(k, -12) for k in fyc]
    base = ctx['base']
    B = defaultdict(lambda: dict(skus=0, t12=0.0, cogs12=0.0, oh=0.0, aged=0.0, ly=0, ty=0, g=0.0, c=0.0, md=0.0, units12=0,
                                 ytd=0.0, ytdly=0.0, series=defaultdict(float), cats=defaultdict(float), top=[], agedList=[]))
    unassigned = defaultdict(float)
    for s in sorted(set(hist) | set(snap)):  # sorted: ties in the top lists come out the same every run
        c = cat_of.get(s)
        if c not in MERCH or c in OTB_EXCLUDE:
            continue
        desc = desc_of.get(s, '')
        r = snap.get(s)
        splits = brand_split(ctx.get('bmap'), s, desc, r['desc'] if r else '', bl=ctx.get('blist'))
        seg = segment_of(c, desc)
        mo = hist.get(s, {})
        p = px(s)
        t12 = sum(mo.get(k, 0) for k in t12m) * p
        if not splits:
            unassigned[seg] += t12
            continue
        cost = r['cost'] if r else 0
        u12 = sum(mo.get(k, 0) for k in t12m)
        v = max(r['oh'], 0) * cost if r else 0
        ls = pos_date(r['last_sale']) if r else None
        aged = v and (not ls or (as_of - ls).days > 365)
        bb = sku_gm.get(s)
        # A SKU carrying several brands counts toward each at its share.
        for b, sh in splits:
            a = B[(seg, b)]
            a['skus'] += 1
            a['t12'] += t12 * sh
            a['units12'] += u12 * sh
            a['cogs12'] += u12 * cost * sh
            a['ty'] += sum(mo.get(k, 0) for k in last3) * sh
            a['ly'] += sum(mo.get(k, 0) for k in ly3) * sh
            a['ytd'] += sum(mo.get(k, 0) for k in fyc) * p * sh
            a['ytdly'] += sum(mo.get(k, 0) for k in fyl) * p * sh
            a['cats'][c] += t12 * sh
            for k in series_m:
                if mo.get(k):
                    a['series'][k] += mo[k] * p * sh
            a['oh'] += v * sh
            part = {} if sh >= 0.9995 else dict(share=round(sh, 3))
            if aged:
                a['aged'] += v * sh
                a['agedList'].append(dict(sku=s, desc=desc, oh=round(r['oh'] * sh), value=round(v * sh), last=r['last_sale'], **part))
            if bb:
                a['g'] += bb['g'] * sh
                a['c'] += bb['c'] * sh
                a['md'] += bb['md'] * sh
            if t12 > 0 or v > 0:
                a['top'].append(dict(sku=s, desc=desc, cat=c, t12=round(t12 * sh), units=round(u12 * sh), oh=round((r['oh'] if r else 0) * sh),
                                     value=round(v * sh), **part))
    rows = []
    for (seg, b), a in B.items():
        if a['t12'] < 100 and a['oh'] <= 0:
            continue
        cat_gm = sum(base['cats'][c]['gm'] * v for c, v in a['cats'].items()) / a['t12'] if a['t12'] else None
        gm = (a['g'] - a['c']) / a['g'] if a['g'] > 0 else cat_gm
        md = a['md'] / (a['g'] + a['md']) if a['g'] + a['md'] > 0 else None
        wks = a['oh'] / (a['cogs12'] / 52) if a['cogs12'] > 0 else (None if a['oh'] <= 0 else 999)
        gmroi = (a['t12'] * gm) / a['oh'] if a['oh'] > 0 and gm is not None else None
        m = dict(seg=seg, brand=b, id=re.sub(r'[^a-z0-9]+', '-', f'{seg}-{b}'.lower()).strip('-'), skus=a['skus'], t12=round(a['t12']),
                 units12=round(a['units12']), ytd=round(a['ytd']), ytdly=round(a['ytdly']), oh=round(a['oh']), aged=round(a['aged']),
                 agedPct=round(a['aged'] / a['oh'], 3) if a['oh'] else 0, gm=round(gm, 3) if gm is not None else None,
                 md=round(md, 3) if md is not None else None, wks=round(wks, 1) if wks is not None else None,
                 gmroi=round(gmroi, 2) if gmroi is not None else None, ly=round(a['ly']), ty=round(a['ty']),
                 cats={c: round(v) for c, v in sorted(a['cats'].items(), key=lambda x: -x[1]) if v > 0},
                 series=[round(a['series'].get(k, 0)) for k in series_m],
                 top=sorted(a['top'], key=lambda x: -x['t12'])[:8], agedSkus=sorted(a['agedList'], key=lambda x: -x['value'])[:6])
        m['call'], m['why'] = call_for(m)
        rows.append(m)
    rows.sort(key=lambda r: -r['t12'])
    return dict(asOf=as_of.isoformat(), through=at, months=series_m, t12Months=[t12m[0], t12m[-1]], compare=[ly3, last3],
                unassigned={k: round(v) for k, v in unassigned.items()}, rows=rows)


def brand_inputs(ctx):
    """What the brand scorecard needs beyond the stored history, prices and base, so Brands -> Update brands can
    rebuild it between uploads (rebuild_ctx): {sku: [price, on hand, cost, last sale, SKU Analysis description,
    gross, cost, markdown]}. On hand to description are null for a SKU not in the SKU Analysis; the last three,
    from the cost & margin report, are left off when it has none."""
    out = {}
    for s in sorted(set(ctx['hist']) | set(ctx['snap'])):
        if ctx['cat_of'].get(s) not in MERCH:
            continue
        r, g = ctx['snap'].get(s), ctx['sku_gm'].get(s)
        row = [ctx['px'](s)] + ([r['oh'], r['cost'], r['last_sale'], r['desc']] if r else [None] * 4)
        out[s] = row + ([g['g'], g['c'], g['md']] if g else [])
    return dict(asOf=ctx['as_of'].isoformat(), skus=out)


def rebuild_ctx(docs):
    """The context build_brands() and brand_skus() take, from stored documents instead of reports:
    base/current, skuhist/*, brandin/current and brandmap/current ({path: data})."""
    base, bi, meta = docs.get('base/current'), docs.get('brandin/current'), docs.get('skuhist/meta') or {}
    if not base or not bi:
        raise ValueError('The brand scorecard can be updated once a month-end upload has saved its inputs. Upload the reports once more.')
    hist = defaultdict(dict)
    for path, d in docs.items():
        if path.startswith('skuhist/FY'):
            for sku, arr in d.items():
                for k, u in zip(fy_months(int(path[10:])), arr):
                    if u:
                        hist[sku][k] = u
    cat_of = {s: v[0] for s, v in meta.items()}
    desc_of = {s: v[1] for s, v in meta.items()}
    snap, px, sku_gm = {}, {}, {}
    for s, r in bi['skus'].items():
        px[s] = r[0]
        if r[1] is not None:
            snap[s] = dict(sku=s, oh=r[1], cost=r[2], last_sale=r[3], desc=r[4], cat_no=cat_of.get(s))
        if len(r) > 5:
            sku_gm[s] = dict(g=r[5], c=r[6], md=r[7])
    bm = docs.get('brandmap/current') or {}
    return dict(as_of=date.fromisoformat(base['asOf']), actual_through=base['actualThrough'], fy=int(base['fy'][2:]), snap=snap,
                hist=hist, px=lambda s: px.get(s, 0), sku_gm=sku_gm, desc_of=desc_of, cat_of=cat_of, base=base,
                bmap=bm.get('skus') or {}, blist=bm)


def brand_skus(ctx):
    """Every SKU with stock or sales in the last 12 months, for assigning brands in the program:
    [sku, description, category, brand from the description ('' if none), 12-month sales $, on hand $ at cost]."""
    at, snap, hist, px = ctx['actual_through'], ctx['snap'], ctx['hist'], ctx['px']
    t12m = [add_months(at, -i) for i in range(12)]
    rows = []
    for s in sorted(set(hist) | set(snap)):
        c = ctx['cat_of'].get(s)
        if c not in MERCH:
            continue
        r = snap.get(s)
        desc = ctx['desc_of'].get(s, '') or (r['desc'] if r else '')
        t12 = sum(hist.get(s, {}).get(k, 0) for k in t12m) * px(s)
        oh = max(r['oh'], 0) * r['cost'] if r else 0
        if t12 > 0 or oh > 0:
            rows.append([s, desc, c, brand_of(desc, ctx.get('blist')) or (brand_of(r['desc'], ctx.get('blist')) if r else None) or '', round(t12), round(oh)])
    return dict(asOf=ctx['as_of'].isoformat(), rows=rows)
