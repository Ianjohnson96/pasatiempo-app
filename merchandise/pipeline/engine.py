"""Forecast and open-to-buy engine. Mirrors the in-app engine (app/engine.js) so the two can be checked against each other.

  sales      FY27 closed months = actual; open months = last year x (1 + growth for that month [+ category tweak])
             FY28 = FY27 x (1 + FY28 growth for the category); beyond FY28 repeats FY28
  shelf      sales less special orders (cats[c].so: the month's own share, else the same month's a year earlier);
             budgets are set on shelf sales and shelf stock (on hand less soOnHand)
  cost       shelf sales x (1 - realized margin)
  target EOM weeks of supply x next four months' cost / 17.3 weeks
  OTB        target EOM - opening inventory + cost of sales for the month  (the current month counts only what is left)
"""
from model import add_months, fy_months


def sales_plan(base, a):
    fy = int(base['fy'][2:])
    m27, m28 = fy_months(fy), fy_months(fy + 1)
    beyond = [add_months(m28[-1], i + 1) for i in range(4)]
    g27, g28 = a.get('g27', base['defaults']['g27']), a.get('g28', base['defaults']['g28'])
    g27c = a.get('g27cat', {})
    out = {}
    for c, v in base['cats'].items():
        s = {}
        for k in m27:
            if k in v['act']:
                s[k] = v['act'][k]
            else:
                s[k] = v['hist'].get(add_months(k, -12), 0) * (1 + g27.get(k, 0) + g27c.get(c, 0))
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


def run(base, a=None, carry=None):
    """Monthly OTB by category from the current month through the end of next fiscal year.
    carry: {cat: $} inventory above plan entering next year (committed orders beyond this year's budget)."""
    a = a or {}
    carry = carry or {}
    wos = a.get('wos', base['defaults']['wos'])
    S, m27, m28 = sales_plan(base, a)
    part = base.get('partial')
    start = part['m'] if part else add_months(base['actualThrough'], 1)
    share = 1.0
    if part:
        share = 1 - part['actual'] / sum(S[c][part['m']] for c in S)
    months = [k for k in m27 + m28 if k >= start]
    res = {}
    for c, v in base['cats'].items():
        cr = 1 - v['gm']
        shelf = {k: x * (1 - so_share(v, k)) for k, x in S[c].items()}
        bom = v['onHand'] - v.get('soOnHand', 0)
        rows = []
        for k in months:
            if k == m28[0]:
                bom += carry.get(c, 0)
            f = share if part and k == part['m'] else 1
            sales, sh = S[c][k] * f, shelf[k] * f
            cogs = sh * cr
            eom = wos[c] * sum(shelf[add_months(k, i + 1)] for i in range(4)) / 17.3 * cr
            rows.append(dict(m=k, sales=sales, shelf=sh, cogs=cogs, bom=bom, eom=eom, otb=eom - bom + cogs))
            bom = eom
        res[c] = rows
    return dict(sales=S, months=months, cats=res, share=share, m27=m27, m28=m28)


def totals(r, cats, fy_months_):
    return sum(x['otb'] for c in cats for x in r['cats'][c] if x['m'] in fy_months_)
