"""Forecast and open-to-buy engine. Mirrors the in-app engine (app/engine.js) so the two can be checked against each other.

  plan year  the fiscal year of the first month not yet closed (plan_fy): base['fy'] until its April closes, then the next
  sales      plan year: closed months = actual; open months = last year x (1 + growth for that month [+ category extra])
             next year = plan year x (1 + next year's growth for the category); beyond that repeats next year
  growth     by fiscal year (config.GROWTH_DEFAULT, plan/assumptions); resolve() reads the plan year's and the next
             year's entries into g27 (months), g27cat and g28 (categories), whatever the years are
  shelf      sales less special orders (cats[c].so: the month's own share, else the same month's a year earlier);
             budgets are set on shelf sales and shelf stock (on hand less soOnHand)
  cost       shelf sales x (1 - realized margin)
  target EOM weeks of supply x next four months' cost / 17.3 weeks; with a saved mix total (Guidelines -> Merchandise mix)
             every category's weeks are scaled by one factor so the target averages that total over the first 12 months
  OTB        target EOM - opening inventory + cost of sales for the month  (the current month counts only what is left)
"""
from model import add_months, fy_months, fy_of


def plan_fy(base):
    """The fiscal year being planned: the year of the first month not yet closed."""
    part = base.get('partial')
    return fy_of(part['m'] if part else add_months(base['actualThrough'], 1))


def by_year(store, fy_hint=None):
    """Growth settings by fiscal year ({'YYYY': {months, cats}}) from plan/assumptions or base['defaults'],
    in either shape: by year ({growth: ...}) or the older one with no year (g27 months, g27cat, g28), which
    belongs to the year of its g27 months (else fy_hint, else FY2027)."""
    store = store or {}
    out = {str(y): {'months': dict(g.get('months') or {}), 'cats': dict(g.get('cats') or {})} for y, g in (store.get('growth') or {}).items()}
    if any(k in store for k in ('g27', 'g27cat', 'g28')):
        ms = sorted(store.get('g27') or {})
        fy = fy_of(ms[0]) if ms else (int(store['fy'][2:]) if str(store.get('fy', '')).startswith('FY') else fy_hint or 2027)
        cur, nxt = out.setdefault(str(fy), {'months': {}, 'cats': {}}), out.setdefault(str(fy + 1), {'months': {}, 'cats': {}})
        cur['months'].update(store.get('g27') or {})
        cur['cats'].update(store.get('g27cat') or {})
        nxt['cats'].update(store.get('g28') or {})
    return out


def resolve(base, saved=None, fy=None):
    """The engine's assumptions for the plan year: g27 (growth by month), g27cat (extra by category) and g28 (next
    year's by category), from base['defaults'] with the saved plan on top, key by key; wos likewise."""
    fy = fy or plan_fy(base)
    d, s = by_year(base.get('defaults')), by_year(saved)
    pick = lambda y, part: {**(d.get(str(y)) or {}).get(part, {}), **(s.get(str(y)) or {}).get(part, {})}
    return dict(g27=pick(fy, 'months'), g27cat=pick(fy, 'cats'), g28=pick(fy + 1, 'cats'),
                wos={**(base.get('defaults') or {}).get('wos', {}), **((saved or {}).get('wos') or {})})


def last_year(v, k):
    """A category's sales in the month a year before k: this data's actual where it has one, else its history."""
    kk = add_months(k, -12)
    return v['act'][kk] if kk in v['act'] else v['hist'].get(kk, 0)


def sales_plan(base, a):
    fy = plan_fy(base)
    m27, m28 = fy_months(fy), fy_months(fy + 1)
    beyond = [add_months(m28[-1], i + 1) for i in range(4)]
    g27, g28, g27c = a['g27'], a['g28'], a['g27cat']
    out = {}
    for c, v in base['cats'].items():
        s = {}
        for k in m27:
            if k in v['act']:
                s[k] = v['act'][k]
            else:
                s[k] = last_year(v, k) * (1 + g27.get(k, 0) + g27c.get(c, 0))
        for k in m28:
            s[k] = s[add_months(k, -12)] * (1 + g28.get(c, 0))
        for k in beyond:
            s[k] = s[add_months(k, -12)]
        out[c] = s
    return out, m27, m28


def so_share(v, k):
    """Special orders' part of a category's sales in month k: that month's own when it has sales, else the same
    month's in the nearest year before that does."""
    so = v.get('so') or {}
    for i in range(4):
        kk = add_months(k, -12 * i)
        tot = v['act'].get(kk) or v['hist'].get(kk)
        if tot:
            return min(max(so.get(kk, 0) / tot, 0), 1)
    return 0


def mix_scale(total, months, target, exclude):
    """The factor for every budgeted category's target weeks that makes the target month-end stock, averaged over the
    first 12 months planned, equal the mix total; 1 with no total. Target stock is linear in the weeks, so it is exact.
    Mirrors mixScale() in app/src/20-engine.js."""
    if not (isinstance(total, (int, float)) and not isinstance(total, bool) and total > 0):
        return 1.0
    year = months[:12]
    t = sum(target[c][k] for c in target if c not in exclude for k in year)
    avg = t / len(year) if year else 0
    return total / avg if avg > 0 else 1.0


def run(base, a=None, carry=None, mix_total=None):
    """Monthly OTB by category from the current month through the end of next fiscal year.
    a: the saved plan (plan/assumptions, either shape) or None for the defaults.
    carry: {cat: $} inventory above plan entering next year (committed orders beyond this year's budget).
    mix_total: the owner's saved total stock to plan for (guidelines/current mix.total), which the budget is linked to."""
    a = resolve(base, a)
    carry = carry or {}
    wos = a['wos']
    S, m27, m28 = sales_plan(base, a)
    part = base.get('partial')
    start = part['m'] if part else add_months(base['actualThrough'], 1)
    share = 1.0
    if part:
        share = 1 - part['actual'] / sum(S[c][part['m']] for c in S)
    months = [k for k in m27 + m28 if k >= start]
    shelf, target = {}, {}
    for c, v in base['cats'].items():
        cr = 1 - v['gm']
        sh = shelf[c] = {k: x * (1 - so_share(v, k)) for k, x in S[c].items()}
        target[c] = {k: wos.get(c, 0) * sum(sh[add_months(k, i + 1)] for i in range(4)) / 17.3 * cr for k in months}
    scale = mix_scale(mix_total, months, target, base.get('exclude') or ['640'])
    res = {}
    for c, v in base['cats'].items():
        cr = 1 - v['gm']
        bom = v['onHand'] - v.get('soOnHand', 0)
        rows = []
        for k in months:
            if k == m28[0]:
                bom += carry.get(c, 0)
            f = share if part and k == part['m'] else 1
            sales, sh = S[c][k] * f, shelf[c][k] * f
            cogs = sh * cr
            eom = target[c][k] * scale
            rows.append(dict(m=k, sales=sales, shelf=sh, cogs=cogs, bom=bom, eom=eom, otb=eom - bom + cogs))
            bom = eom
        res[c] = rows
    return dict(sales=S, months=months, cats=res, share=share, m27=m27, m28=m28, scale=scale)


def totals(r, cats, fy_months_):
    return sum(x['otb'] for c in cats for x in r['cats'][c] if x['m'] in fy_months_)
