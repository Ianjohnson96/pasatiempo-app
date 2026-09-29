/* ---------- charts ----------
   Small SVG charts drawn as strings, sized to the page when they're drawn (render() redraws on a real resize).
   Colours come from the chart tokens in shell.html (--c1..--c3 for series, --c-ly for last year), picked and
   checked for colour-blind readers with the dataviz palette validator, light and dark. Every mark, or a hit area
   wider than it, carries data-cvt/data-cv, which 15-tips.js shows as the hover readout. One y axis, always. */
const CHP = {l: 48, r: 14, t: 14, b: 26};
function chWidth(){ const p = document.querySelector('#pane'); return Math.max(280, Math.min(1180, (p ? p.clientWidth : 800) - 34)); }
function chNice(v){ if (!(v > 0)) return 1; const e = 10 ** Math.floor(Math.log10(v)), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
const chEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chCv = (t, v) => ` data-cvt="${chEsc(t)}" data-cv="${chEsc(v)}"`;

function chFrame(w, h, lo, hi, fmt, body, labels, label){
  const pw = w - CHP.l - CHP.r, ph = h - CHP.t - CHP.b, y = v => CHP.t + ph - (v - lo) / (hi - lo) * ph;
  let g = '';
  for (let i = 0; i <= 4; i++){ const v = lo + (hi - lo) * i / 4, yy = y(v);
    g += `<line class="grid" x1="${CHP.l}" x2="${w - CHP.r}" y1="${yy}" y2="${yy}"/><text class="ax" x="${CHP.l - 6}" y="${yy + 3.5}" text-anchor="end">${chEsc(fmt(v))}</text>`; }
  const n = labels.length, band = pw / Math.max(1, n), step = Math.max(1, Math.ceil(n * 44 / pw));
  labels.forEach((l, i) => { if (i % step === 0) g += `<text class="ax" x="${CHP.l + band * (i + .5)}" y="${h - 8}" text-anchor="middle">${chEsc(l)}</text>`; });
  return `<svg class="ch" role="img" aria-label="${chEsc(label || 'Chart')}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${g}${body(y, band, pw, ph)}</svg>`;
}
function chRange(vals, zeroBase = true){
  const v = vals.filter(x => x != null && isFinite(x));
  if (!v.length) return [0, 1];
  let lo = zeroBase ? Math.min(0, ...v) : Math.min(...v), hi = Math.max(zeroBase ? 0 : -Infinity, ...v);
  if (!zeroBase){ const span = chNice((hi - lo) || Math.abs(hi) || 1), st = span / 4; lo = Math.floor(lo / st) * st; hi = lo + Math.ceil((hi - lo) / st) * st || lo + span; return [lo, hi]; }
  hi = chNice(hi); if (lo < 0) lo = -chNice(-lo);
  return [lo, hi];
}
// A bar with a rounded end (4px) and a square base on the axis.
function chBarPath(x, y0, y1, bw){
  const top = Math.min(y0, y1), hgt = Math.abs(y1 - y0), r = Math.min(4, bw / 2, hgt);
  if (hgt < .5) return '';
  return y1 <= y0 ? `M${x},${y0}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${y0}Z`
    : `M${x},${top}V${top + hgt - r}Q${x},${top + hgt} ${x + r},${top + hgt}H${x + bw - r}Q${x + bw},${top + hgt} ${x + bw},${top + hgt - r}V${top}Z`;
}

/** Grouped bars. series: [{name, values, k: 1|2|3|'ly'}]. */
function chBars({labels, series, fmt = moneyK, h = 230, w = chWidth(), label, tips}){
  const [lo, hi] = chRange(series.flatMap(s => s.values));
  return chFrame(w, h, lo, hi, fmt, (y, band) => {
    const gap = 2, inner = band * .74, bw = Math.max(2, (inner - gap * (series.length - 1)) / series.length);
    let out = '';
    labels.forEach((l, i) => {
      const x0 = CHP.l + band * i + (band - inner) / 2;
      series.forEach((s, j) => { const v = s.values[i]; if (v == null) return;
        out += `<path class="k${s.k}" d="${chBarPath(x0 + j * (bw + gap), y(Math.max(lo, 0)), y(v), bw)}"/>`; });
      out += `<rect class="hit" x="${CHP.l + band * i}" y="${CHP.t}" width="${band}" height="${h - CHP.t - CHP.b}"${chCv(l, tips ? tips(i) : series.map(s => s.name + ': ' + (s.values[i] == null ? '—' : fmt(s.values[i]))).join(' · '))}/>`;
    });
    return out;
  }, labels, label);
}

/** Stacked bars (all values >= 0), a 2px gap between segments. */
function chStack({labels, series, fmt = v => Math.round(v).toLocaleString('en-US'), h = 230, w = chWidth(), label}){
  const tot = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0)), [lo, hi] = chRange(tot);
  return chFrame(w, h, lo, hi, fmt, (y, band) => {
    const bw = Math.max(3, band * .62); let out = '';
    labels.forEach((l, i) => {
      let base = 0; const x = CHP.l + band * i + (band - bw) / 2;
      const segs = series.map((s, j) => ({s, j, v: s.values[i] || 0})).filter(z => z.v > 0);
      segs.forEach((z, n) => {
        const y0 = y(base) - (n ? 1 : 0), y1 = y(base + z.v) + (n < segs.length - 1 ? 1 : 0);
        out += n === segs.length - 1 ? `<path class="k${z.s.k}" d="${chBarPath(x, y0, y1, bw)}"/>` : `<rect class="k${z.s.k}" x="${x}" y="${Math.min(y0, y1)}" width="${bw}" height="${Math.max(0, Math.abs(y0 - y1))}"/>`;
        base += z.v; });
      out += `<rect class="hit" x="${CHP.l + band * i}" y="${CHP.t}" width="${band}" height="${h - CHP.t - CHP.b}"${chCv(l, series.map(s => s.name + ': ' + fmt(s.values[i] || 0)).join(' · ') + ' · Total: ' + fmt(tot[i]))}/>`;
    });
    return out;
  }, labels, label);
}

/** Lines, 2px, gaps where a value is null, the last point marked. */
function chLine({labels, series, fmt = moneyK, h = 230, w = chWidth(), label, zeroBase = true}){
  const [lo, hi] = chRange(series.flatMap(s => s.values), zeroBase);
  return chFrame(w, h, lo, hi, fmt, (y, band) => {
    let out = '';
    const x = i => CHP.l + band * (i + .5);
    series.forEach(s => {
      let d = '', pen = false, last = -1;
      s.values.forEach((v, i) => { if (v == null || !isFinite(v)){ pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); pen = true; last = i; });
      out += `<path class="ln l${s.k}${s.dash ? ' dash' : ''}" d="${d}"/>`;
      if (last >= 0) out += `<circle class="k${s.k} dot" cx="${x(last)}" cy="${y(s.values[last])}" r="4"/>`;
    });
    labels.forEach((l, i) => { out += `<rect class="hit" x="${CHP.l + band * i}" y="${CHP.t}" width="${band}" height="${h - CHP.t - CHP.b}"${chCv(l, series.map(s => s.name + ': ' + (s.values[i] == null ? '—' : fmt(s.values[i]))).join(' · '))}/>`; });
    return out;
  }, labels, label);
}

/** Scatter with reference lines and quadrant names. points: [{x, y, r, label, k, cvt, cv, attrs}]. */
function chScatter({points, xFmt, yFmt, xRef = 0, yRef, quads = [], h = 340, w = chWidth(), label, xName, yName, named = 7}){
  if (!points.length) return '';
  const pad = (a, b) => { const s = (b - a) || 1; return [a - s * .1, b + s * .1]; };
  const [x0, x1] = pad(Math.min(xRef, ...points.map(p => p.x)), Math.max(xRef, ...points.map(p => p.x)));
  const [y0, y1] = pad(Math.min(0, yRef ?? 0, ...points.map(p => p.y)), Math.max(yRef ?? 0, ...points.map(p => p.y)));
  const L = CHP.l, R = w - CHP.r, T = CHP.t + 6, B = h - CHP.b - 12;
  const X = v => L + (v - x0) / (x1 - x0) * (R - L), Y = v => B - (v - y0) / (y1 - y0) * (B - T);
  let g = '';
  for (let i = 0; i <= 4; i++){ const v = y0 + (y1 - y0) * i / 4; g += `<line class="grid" x1="${L}" x2="${R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end">${chEsc(yFmt(v))}</text>`; }
  for (let i = 0; i <= 4; i++){ const v = x0 + (x1 - x0) * i / 4; g += `<text class="ax" x="${X(v)}" y="${B + 16}" text-anchor="middle">${chEsc(xFmt(v))}</text>`; }
  g += `<line class="ref" x1="${X(xRef)}" x2="${X(xRef)}" y1="${T}" y2="${B}"/>` + (yRef != null ? `<line class="ref" x1="${L}" x2="${R}" y1="${Y(yRef)}" y2="${Y(yRef)}"/>` : '');
  const [tl, tr, bl, br] = quads;
  g += `<text class="quad" x="${L + 6}" y="${T + 10}">${chEsc(tl || '')}</text><text class="quad" x="${R - 6}" y="${T + 10}" text-anchor="end">${chEsc(tr || '')}</text>`
    + `<text class="quad" x="${L + 6}" y="${B - 6}">${chEsc(bl || '')}</text><text class="quad" x="${R - 6}" y="${B - 6}" text-anchor="end">${chEsc(br || '')}</text>`;
  const rmax = Math.max(...points.map(p => p.r || 1)), rr = p => 5 + 12 * Math.sqrt(Math.max(0, p.r || 1) / rmax);
  const bySize = points.slice().sort((a, b) => (b.r || 0) - (a.r || 0)), big = bySize.slice(0, named);
  for (const p of bySize) g += `<circle class="k${p.k || 1} pt" cx="${X(p.x)}" cy="${Y(p.y)}" r="${rr(p)}"${chCv(p.cvt || p.label, p.cv || '')}${p.attrs || ''}/>`;
  for (const p of big) g += `<text class="plab" x="${Math.max(L + 30, Math.min(R - 30, X(p.x)))}" y="${Math.max(T + 22, Y(p.y) - rr(p) - 4)}" text-anchor="middle">${chEsc(p.label)}</text>`;
  if (xName) g += `<text class="axn" x="${R}" y="${h - 2}" text-anchor="end">${chEsc(xName)} →</text>`;
  if (yName) g += `<text class="axn" x="${L}" y="${CHP.t - 2}">↑ ${chEsc(yName)}</text>`;
  return `<svg class="ch" role="img" aria-label="${chEsc(label || 'Chart')}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${g}</svg>`;
}

/** A sparkline for a table cell or tile. */
function chSpark(values, {w = 120, h = 28, k = 1} = {}){
  const v = values.map(x => x == null ? null : +x), ok = v.filter(x => x != null);
  if (ok.length < 2) return '';
  const lo = Math.min(...ok), hi = Math.max(...ok), s = (hi - lo) || 1;
  let d = '', pen = false;
  v.forEach((x, i) => { if (x == null){ pen = false; return; } d += (pen ? 'L' : 'M') + (2 + i * (w - 4) / (v.length - 1)).toFixed(1) + ',' + (h - 3 - (x - lo) / s * (h - 6)).toFixed(1); pen = true; });
  return `<svg class="ch spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path class="ln l${k}" d="${d}"/></svg>`;
}

/** A legend: a swatch and the series name, in ink. */
const chLegend = series => `<div class="lg">${series.map(s => `<span><i class="sw k${s.k}${s.dash ? ' dash' : ''}"></i>${chEsc(s.name)}</span>`).join('')}</div>`;

// Redraw charts when the page width really changes (not on every resize event).
let chLastW = 0;
addEventListener('resize', () => { clearTimeout(chWidth._t); chWidth._t = setTimeout(() => { const w = chWidth(); if (Math.abs(w - chLastW) > 40){ chLastW = w; if (typeof ANALYSIS_TABS !== 'undefined' && ANALYSIS_TABS.has(TAB)) render(); } }, 200); });
