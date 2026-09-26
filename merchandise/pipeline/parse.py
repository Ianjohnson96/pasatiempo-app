"""Parsers for each Pro Shop POS report (text layout as printed to PDF)."""
import re

MON = {'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12}


def _n(s):
    return float(s.replace(',', ''))


def parse_best100(text):
    """Cost & margin by SKU. Returns {period, rows:[...]}."""
    period = re.search(r'for the period (\w{3}\d{2}/\d{2}) through (\w{3}\d{2}/\d{2})', text)
    row = re.compile(r'^(\d+)\s+(\w+)\s+(.*?)\s+(-?[\d,]+)\s+(-?[\d,]+)\s+(-?[\d,]+)\s+(-?[\d.]+)%\s+(-?[\d,]+)$')
    cat, rows = None, []
    for ln in text.splitlines():
        m = re.match(r'^0{5,}(\d+) - (.+)$', ln.strip())
        if m:
            cat = (m.group(1), m.group(2).strip())
            continue
        m = row.match(ln.strip())
        if m and cat:
            g = m.groups()
            rows.append(dict(cat_no=cat[0], cat=cat[1], sku=g[1], desc=g[2].strip(), qty=int(_n(g[3])), gross=int(_n(g[4])),
                             cost=int(_n(g[5])), margin_pct=float(g[6]), markdown=int(_n(g[7]))))
    return dict(period=period.groups() if period else None, rows=rows)


def parse_sales_by_category(text):
    """Net sales by category. The report prints a detail pass then a summary pass; keep the first."""
    lines = text.splitlines()
    starts = [i for i, l in enumerate(lines) if re.match(r'^10 - ', l.strip())]
    if len(starts) > 1:
        lines = lines[starts[0]:starts[1]]
    item = re.compile(r'^(\d+)\s+(\S+)\s+(.*?)\s+(-?[\d,]+\.\d\d)\s+(-?[\d,]+\.\d\d)\s+(-?[\d,]+\.\d\d)$')
    cats, cat = {}, None
    for ln in lines:
        s = ln.strip()
        m = re.match(r'^(\d{2,3}) - (.+)$', s)
        if m:
            cat = m.group(1)
            cats.setdefault(cat, dict(name=m.group(2).strip(), items=[]))
            continue
        if s.startswith('Total:') or s.startswith('ONACCT'):
            cat = None
        m = item.match(s)
        if m and cat:
            g = m.groups()
            cats[cat]['items'].append(dict(sku=g[1], desc=g[2].strip(), avg=_n(g[3]), units=_n(g[4]), value=_n(g[5])))
    period = re.search(r'for (\w{3} \d{1,2}/\d{2}) thru (\w{3} \d{1,2}/\d{2})', text)
    return dict(period=period.groups() if period else None, cats=cats)


def parse_sales_by_item(text):
    item = re.compile(r'^(\d+)\s+(\S+)\s+(.*?)\s+(-?[\d,]+\.\d\d)\s+(-?[\d,]+\.\d\d)\s+(-?[\d,]+\.\d\d)$')
    out = {}
    for ln in text.splitlines():
        m = item.match(ln.strip())
        if m:
            g = m.groups()
            out[g[1]] = dict(desc=g[2].strip(), units=_n(g[4]), value=_n(g[5]))
    return out


def parse_sku_analysis(text):
    """On-hand, cost, trailing 12 months of unit sales by SKU. Month columns read from the header."""
    lines = text.splitlines()
    as_of = re.search(r'SKU Analysis as of (\w{3}) (\d{4})', text)
    mons, years = None, None
    for i, ln in enumerate(lines):
        if 'Units' in ln and 'Cost' in ln and 'Last' in ln:
            mons = re.findall(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b', ln.split('Units', 1)[1])
            years = re.findall(r'\b(20\d\d)\b', lines[i + 1])
            break
    months = [f'{y}-{MON[m]:02d}' for m, y in zip(mons, years)]
    rows, cat = [], None
    ch = re.compile(r'^0{5,}(\d+)\s+\d+\s+(.+)$')
    dt = re.compile(r'^[A-Z][a-z]{2}\d{2}/\d{2}$')
    for s in lines:
        m = ch.match(s.strip())
        if m:
            cat = (m.group(1), m.group(2).strip())
            continue
        if len(s) < 80 or not cat:
            continue
        sku, desc, lr, ls = s[0:16].strip(), s[16:42].strip(), s[42:51].strip(), s[51:60].strip()
        rest = s[60:].split()
        if not re.match(r'^[A-Za-z0-9]+$', sku) or len(rest) < 15 or (lr and not dt.match(lr)) or (ls and not dt.match(ls)):
            continue
        try:
            cost, oh, sold = _n(rest[0]), int(_n(rest[1])), int(_n(rest[2]))
            mo = [int(_n(x)) for x in rest[3:15]]
        except ValueError:
            continue
        rows.append(dict(cat_no=cat[0], cat=cat[1], sku=sku, desc=desc, last_rec=lr or None, last_sale=ls or None,
                         cost=cost, oh=oh, sold=sold, mo=dict(zip(months, mo))))
    return dict(as_of=f'{as_of.group(2)}-{MON[as_of.group(1)]:02d}' if as_of else None, months=months, rows=rows)


def parse_daily_sales(text):
    """Daily Sales Report by Item: today / month-to-date / fiscal YTD by item and category."""
    def n(s):
        return 0.0 if s == '-' else _n(s)
    trip = r'(-|-?[\d,]+\.\d\d)\s+(-|-?[\d,]+)\s+(-|-?[\d,]+\.\d\d)'
    item = re.compile(r'^(.*?)\s+' + trip + r'\s+' + trip + r'\s+' + trip + r'$')
    tot = re.compile(r'^Total Category\s+' + trip + r'\s+' + trip + r'\s+' + trip + r'$')
    rep = re.compile(r'^Total Report\s+' + trip + r'\s+' + trip + r'\s+' + trip + r'$')
    cats, cat, pend, report = {}, None, None, None
    for ln in text.splitlines():
        s = ln.strip()
        if re.match(r'^-{4,}$', s) and pend:
            cat = pend
            cats.setdefault(cat, dict(items=[], tot=None))
            pend = None
            continue
        m = rep.match(s)
        if m:
            g = m.groups()
            report = dict(mtd=n(g[3]), mtd_u=n(g[4]), fytd=n(g[6]), fytd_u=n(g[7]))
            continue
        m = tot.match(s)
        if m and cat:
            g = m.groups()
            cats[cat]['tot'] = dict(mtd=n(g[3]), mtd_u=n(g[4]), fytd=n(g[6]), fytd_u=n(g[7]))
            cat = pend = None
            continue
        m = item.match(s)
        if m and cat:
            g = m.groups()
            cats[cat]['items'].append(dict(desc=g[0].strip(), mtd=n(g[3]), mtd_u=n(g[4]), fytd=n(g[6]), fytd_u=n(g[7])))
            continue
        if s and not s.startswith(('=', '-', 'Pasatiempo', 'Daily Sales', 'For ', 'Units', 'Amount', 'Total Report', 'September', 'October',
                                   'November', 'December', 'January', 'February', 'March', 'April', 'May ', 'June', 'July', 'August')) and 'T O D A Y' not in s:
            pend = s
    d = re.search(r'For (\w{3}) (\d{1,2})/(\d{2})', text)
    date = f'20{d.group(3)}-{MON[d.group(1)]:02d}-{int(d.group(2)):02d}' if d else None
    return dict(date=date, cats=cats, report=report)


def parse_rounds(text):
    """Yearly Rounds Summary by Golfer Classification: 13 values (Jan..Dec, Total) per label."""
    out, label = {}, None
    num = r'((?:\s*(?:-|[\d,]+)){13})\s*$'
    for ln in text.splitlines():
        m = re.match(r'^(.+?)\s{2,}Weekdays\s+' + num, ln.rstrip())
        if m:
            label = m.group(1).strip()
            continue
        m = re.match(r'^Total\s+' + num, ln.strip())
        if m and label:
            out[label] = [0 if x == '-' else int(_n(x)) for x in m.group(1).split()]
            label = None
    y = re.search(r'\n\s*(20\d\d)\s*\n', text[:2000])
    return dict(year=int(y.group(1)) if y else None, rows=out)
