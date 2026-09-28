"""Brand and segment assignment from POS item descriptions."""
import re

ALIAS = [
    ('Peter Millar', r'peter millar|\bpm\b'), ('Straight Down', r'straight down|\bsdr?\b|\bsd mack|\bsd mens'),
    ('Holderness & Bourne', r'holderness|\bh&b\b|\bhb\b'), ('Travis Mathew', r'travis\s*mathew|\btm logo'), ('Melin', r'melin'),
    ('Imperial', r'imperial'), ('Branded Bills', r'branded bills'), ('Legendary', r'legendary'), ('Angus & Grace', r'angus'),
    ('Greyson', r'greyson'), ('KJUS', r'kjus'), ('Zero Restriction', r'\bzero\b'), ('Sunice', r'sunice'), ('Amble', r'amble'),
    ('Anderson Ord', r'anderson\s*ord'), ('B. Draddy', r'draddy'), ('Bad Birdie', r'bad birdie'),
    ('Fairway & Greene', r'fairway\s*&\s*greene|f&g'), ('GG Blue', r'gg blue'), ('Kastel', r'kastel'), ('SanSoleil', r'sansoleil'),
    ('Johnnie-O', r'johnnie'), ('RLX', r'\brlx\b'), ('Linksoul', r'linksoul'), ('Garb', r'\bgarb\b'), ('Adidas', r'adidas'),
    ('PUMA', r'puma'), ('Nike', r'nike'), ('G/FORE', r'g/?fore|gallivan'), ('FootJoy', r'\bfj\b|foot\s*joy|footjoy'),
    ('Asics', r'asics'), ('d. hudson', r'd\. ?hudson'), ('Argali', r'argali'), ('Richardson', r'richardson'),
    ('Titleist', r'titleist|\btit\.?\b|titl\.|pro-?v1|scotty|vokey|\bsm1[01]\b'),
    ('TaylorMade', r'taylor\s*made|taylormade|\btm\b|tp5|talormade'), ('Callaway', r'callaway|\bcal\b|odys'), ('PING', r'\bping\b'),
    ('XXIO', r'xxio'), ('Vessel', r'vessel'), ('Sun Mountain', r'sun m'), ('Winston / Vanto / Seamus', r'winston|vanto|seamus'),
    ('PRG', r'\bprg\b'), ('Smathers & Branson', r'smathers'), ('NexBelt', r'nexbelt'), ('Bushnell', r'bushnell'),
    ('Oakley', r'oakley'), ('Maui Jim', r'maui jim'), ('YETI', r'yeti'), ('Tervis', r'tervis'), ('Sterling', r'sterling'),
    ('STRACKA', r'stracka'), ('Wallaroo', r'wallaroo'), ('Ahead', r'\bahead\b'), ('Sloop', r'sloop'), ('Vimhue', r'vimhue'),
    ('Donald Ross', r'donald ross'), ('Bobby Jones', r'bobby jones'), ('J. Lindeberg', r'lindeberg'),
    ('Greg Norman', r'greg norman'), ('Kradul', r'kradul'),
]
_RX = [(b, re.compile(rx)) for b, rx in ALIAS]
HAT = re.compile(r'^(hat|hats|visor|beanie|bucket)|\bhat\b|\bbeanie\b|\bvisor\b|bucket', re.I)

SEGMENTS = {'mens': "Men's apparel", 'ladies': "Ladies' apparel", 'hats': 'Hats', 'accessories': 'Accessories',
            'equipment': 'Equipment & shoes'}
_SEG = {'400': 'mens', '430': 'mens', '470': 'mens', '480': 'mens', '490': 'mens', '500': 'ladies', '620': 'accessories',
        '660': 'accessories', '160': 'equipment', '200': 'equipment', '220': 'equipment', '300': 'equipment', '320': 'equipment',
        '350': 'equipment'}


def _word_rx(w):
    return re.compile(r'(?<![a-z0-9])' + re.escape(w.strip().lower()) + r'(?![a-z0-9])')


def renamed(bl, b):
    """A brand's name after the program's renames and merges (brandmap/current "rename": {old: new})."""
    ren = (bl or {}).get('rename') or {}
    for _ in range(10):
        if not isinstance(ren.get(b), str) or not ren[b].strip() or ren[b] == b:
            break
        b = ren[b].strip()
    return b


def brand_of(desc, bl=None):
    """The brand named in a description. bl is brandmap/current: words added in the program
    ("words": {brand: [word or phrase, ...]}) are checked before the built-in list, and renames apply."""
    d = (desc or '').lower()
    for b, words in ((bl or {}).get('words') or {}).items():
        if isinstance(words, list) and any(isinstance(w, str) and w.strip() and _word_rx(w).search(d) for w in words):
            return renamed(bl, b)
    for b, rx in _RX:
        if rx.search(d):
            return renamed(bl, b)
    return None


def is_hat(desc):
    return bool(HAT.search(desc or ''))


def segment_of(cat, desc):
    if cat == '440':
        return 'hats' if is_hat(desc) else 'accessories'
    return _SEG.get(cat, 'other')


def brand_split(bmap, sku, *descs, bl=None):
    """[(brand, share)] for a SKU, shares adding up to 1; [] when the brand is unknown.

    bmap is the program's brand assignments (Brands -> Assign brands, document brandmap/current):
    {sku: [{"b": brand, "s": percent}, ...]}, several entries for a SKU that carries more than one
    brand. Without an assignment, the brand is the one named in the SKU's description. bl is the whole
    brandmap/current document, for the brand words and renames entered in the program (Brands -> Edit brands)."""
    rows = [r for r in ((bmap or {}).get(sku) or []) if isinstance(r, dict) and str(r.get('b', '')).strip()]
    shares = [max(float(r.get('s') or 0), 0.0) for r in rows]
    if sum(shares) > 0:
        out = {}  # two brands merged into one add together
        for r, v in zip(rows, shares):
            if v > 0:
                b = renamed(bl, str(r['b']).strip())
                out[b] = out.get(b, 0) + v / sum(shares)
        return list(out.items())
    for d in descs:
        b = brand_of(d, bl)
        if b:
            return [(b, 1.0)]
    return []
