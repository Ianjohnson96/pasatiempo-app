/* ---------- Guidelines page: every rule the program grades and suggests by (spec 2026-11-19-merch-guidelines) ----------
   Each rule shows Suggested (the code default and where it comes from), Your shop now (the latest month-end figure)
   and Pasatiempo (the owner's value). Edits wait in GD.draft until Save; saving writes guidelines/current with a history
   entry per change. Budget inputs (weeks of supply) and the merchandise mix have their own tabs. Owner edits; everyone
   else reads. */
const GD_TABS = [['targets', 'Targets'], ['roles', 'Category roles'], ['budget', 'Budget inputs'], ['mix', 'Merchandise mix'], ['seasons', 'Seasons & discount'], ['history', 'Change history']];
const GD = {tab: (() => { try { return localStorage.getItem('mp.guideTab') || 'targets'; } catch (_) { return 'targets'; } })(), draft: {}, note: ''};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const gdOwner = () => ownerHere();

/* ----- reading and writing values by path ('bench.gm.apparel', 'roleOf.480', 'roles.fashion.wks') ----- */
const gdGet = (o, path) => path.split('.').reduce((a, k) => a == null ? undefined : a[k], o);
function gdSet(o, path, v){
  const ks = path.split('.'), last = ks.pop();
  let a = o; for (const k of ks){ if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }
  if (v === undefined) delete a[last]; else a[last] = v;
  return o;
}
const gdDefault = path => gdGet(guideValues(null), path);
const gdSaved = path => gdGet(guideValues(GUIDE), path);
const gdValue = path => Object.prototype.hasOwnProperty.call(GD.draft, path) ? GD.draft[path] : gdSaved(path);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Saves a change to guidelines/current: `patch` is {path: value}, undefined removing the saved value (back to the
    suggested one). History keeps the newest 200 entries. */
async function saveGuides(patch, entries, note){
  if (!gdOwner()) return false;
  const doc = JSON.parse(JSON.stringify(GUIDE || {}));
  for (const p in patch) gdSet(doc, p, patch[p]);
  const at = new Date().toISOString();
  doc.history = [...(entries || []).map(e => ({at, by: myId, ...e, ...(note ? {note} : {})})).reverse(), ...(doc.history || [])].slice(0, 200);
  doc.at = at; doc.by = myId;
  return write('guidelines/current', doc);
}

/* ----- formatting ----- */
const gdFmt = (kind, v) => v == null ? '—' : kind === 'pct' ? Math.round(v * 1000) / 10 + '%' : kind === 'x' ? (+v).toFixed(2).replace(/\.?0+$/, '') : kind === 'wks' ? v + ' wks'
  : kind === 'month' ? MONTHS[v - 1] : kind === 'role' ? (ROLES_DEFAULT[v] || {}).name || v : String(v);
const gdInputVal = (kind, v) => v == null ? '' : kind === 'pct' ? String(Math.round(v * 1000) / 10) : String(v);
function gdParse(kind, s){
  const n = Number(String(s).replace(/[%$,\s]|wks?/gi, ''));
  if (!String(s).trim() || !Number.isFinite(n)) return null;
  return kind === 'pct' ? n / 100 : n;
}

/* ----- your shop now, from the Scorecard's analysis (17-metrics.js measures) ----- */
function shopNow(){
  const a = typeof anaNow === 'function' ? anaNow() : null;
  if (!a) return null;
  const seg = (s, k, w) => { let t = 0, n = 0; for (const c of a.cats) if (c.seg === s && c[k] != null){ const wt = Math.max(0, c[w] || 0); t += c[k] * wt; n += wt; } return n ? t / n : null; };
  return {a, seg: (s, k) => seg(s, k, k === 'gm' || k === 'md' ? 't12' : 'oh'), shop: a.shop};
}

/* ----- the rules on the Targets tab ----- */
const GD_TARGETS = [
  ['Margin', 'Turns a category red on the Scorecard when it falls short', [
    ['bench.gm.apparel', 'Apparel margin', 'Shirts, sweaters, jackets, pants, ladies', 'pct', 'rule of thumb for club apparel', n => n.seg('apparel', 'gm'), 'min'],
    ['bench.gm.accessories', 'Accessories margin', 'Hats, clothing and general accessories', 'pct', 'rule of thumb for accessories', n => n.seg('accessories', 'gm'), 'min'],
    ['bench.gm.equipment', 'Equipment margin', 'Clubs, balls, gloves, bags, shoes', 'pct', 'rule of thumb for hard goods', n => n.seg('equipment', 'gm'), 'min']]],
  ['Return on stock', 'Margin dollars earned for each $1 of stock (GMROI)', [
    ['bench.gmroi.apparel', 'GMROI, apparel', '', 'x', '$2 of margin per $1 of stock', n => n.seg('apparel', 'gmroi'), 'min'],
    ['bench.gmroi.accessories', 'GMROI, accessories', '', 'x', '$2 of margin per $1 of stock', n => n.seg('accessories', 'gmroi'), 'min'],
    ['bench.gmroi.equipment', 'GMROI, equipment', 'Hard goods earn on margin dollars more than turns', 'x', '$1 of margin per $1 of stock', n => n.seg('equipment', 'gmroi'), 'min']]],
  ['Stock health', '', [
    ['bench.md.good', 'Markdowns', 'Share of sales given away in markdowns', 'pct', 'rule of thumb', n => n.shop.md, 'max'],
    ['bench.agedPct.good', 'Aged stock', 'Stock unsold for 12 months, share of all stock', 'pct', 'rule of thumb', n => n.shop.agedPct, 'max'],
    ['bench.turns.apparel', 'Turns, apparel', 'Times stock sells through in a year', 'x', 'AGM private-club average is 2.65', n => n.seg('apparel', 'turns'), 'min'],
    ['bench.turns.accessories', 'Turns, accessories', '', 'x', 'AGM private-club average is 2.65', n => n.seg('accessories', 'turns'), 'min'],
    ['bench.turns.equipment', 'Turns, equipment', '', 'x', 'rule of thumb', n => n.seg('equipment', 'turns'), 'min'],
    ['bench.turns.fast', 'Turns, balls and gloves', 'They should sell through faster', 'x', 'rule of thumb', null, 'min']]],
  ['How close counts as near', 'Within this much of a guideline, a figure shows amber instead of red', [
    ['bench.gm.near', 'Margin', 'Points below the margin guideline', 'pct', 'program default', null],
    ['bench.md.near', 'Markdowns', 'Markdowns up to this share still count as near', 'pct', 'program default', null],
    ['bench.agedPct.near', 'Aged stock', 'Aged stock up to this share still counts as near', 'pct', 'program default', null],
    ['bench.gmroi.near', 'GMROI', 'Share of the GMROI guideline that counts as near', 'pct', 'program default', null],
    ['bench.turns.near', 'Turns', 'Share of the turns guideline that counts as near', 'pct', 'program default', null]]]
];

/* ----- one row: guideline | suggested | your shop now | Pasatiempo | reset ----- */
function gdRow(path, label, sub, kind, why, nowFn, dir, N){
  const def = gdDefault(path), v = gdValue(path), owner = gdOwner();
  const nowV = nowFn && N ? nowFn(N) : null;
  const misses = nowV != null && v != null && (dir === 'min' ? nowV < v : dir === 'max' ? nowV > v : false);
  const changed = !same(v, def), pending = Object.prototype.hasOwnProperty.call(GD.draft, path);
  const input = owner ? `<input class="gd-in num" data-gd="${esc(path)}" data-kind="${kind}" inputmode="decimal" value="${esc(gdInputVal(kind, v))}" aria-label="${esc(label)}">${kind === 'pct' ? '<span class="gd-u">%</span>' : kind === 'wks' ? '<span class="gd-u">wks</span>' : ''}`
    : `<span class="num">${esc(gdFmt(kind, v))}</span>`;
  return `<div class="gd-row${changed ? ' changed' : ''}${pending ? ' pending' : ''}"><div class="gd-what"><b>${esc(label)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>
    <div class="gd-sug"><b class="num">${esc(gdFmt(kind, def))}</b><span>${esc(why || '')}</span></div>
    <div class="gd-now num ${misses ? 'neg' : ''}">${nowV == null ? '<span class="faint">—</span>' : esc(gdFmt(kind === 'wks' ? 'x' : kind, nowV))}</div>
    <div class="gd-val">${input}</div>
    <div>${owner && changed ? `<button type="button" class="btn ghost sm" data-gdreset="${esc(path)}">Reset to ${esc(gdFmt(kind, def))}</button>` : ''}</div></div>`;
}
const gdHead = (a = 'Guideline', b = 'Suggested', c = 'Your shop now', d = 'Pasatiempo') => `<div class="gd-row gd-hd"><span>${a}</span><span>${b}</span><span>${c}</span><span>${d}</span><span></span></div>`;
const gdCard = (title, sub, body) => `<section class="panel gd-card"><header><h2>${esc(title)}</h2>${sub ? `<span class="lab">${esc(sub)}</span>` : ''}</header>${body}</section>`;

function gdTargets(N){
  return GD_TARGETS.map(([t, s, rows]) => gdCard(t, s, gdHead() + rows.map(r => gdRow(r[0], r[1], r[2], r[3], r[4], r[5], r[6], N)).join(''))).join('');
}

function gdRoles(){
  const owner = gdOwner(), roles = Object.keys(ROLES_DEFAULT);
  const roleRows = roles.filter(r => ROLES_DEFAULT[r].wks).map(r => {
    const w = gdValue(`roles.${r}.wks`), d = ROLES_DEFAULT[r].wks, over = gdValue(`roles.${r}.over`), changed = !same(w, d) || over !== ROLES_DEFAULT[r].over;
    const box = (i, lab) => owner ? `<label class="gd-wk"><span>${lab}</span><input class="gd-in num" data-gdwk="${r}" data-i="${i}" inputmode="decimal" value="${w[i]}"></label>` : `<span class="gd-wk"><span>${lab}</span><b class="num">${w[i]}</b></span>`;
    return `<div class="gd-row gd-role${changed ? ' changed' : ''}"><div class="gd-what"><b>${esc(ROLES_DEFAULT[r].name)}</b><span>${esc(ROLES_DEFAULT[r].judge)}</span></div>
      <div class="gd-sug"><b class="num">${d[0]}–${d[1]} wks</b><span>near ${d[2]}–${d[3]}, too much at ${ROLES_DEFAULT[r].over}</span></div>
      <div class="gd-wks">${box(0, 'Low')}${box(1, 'High')}${box(2, 'Near low')}${box(3, 'Near high')}${owner ? `<label class="gd-wk"><span>Too much</span><input class="gd-in num" data-gd="roles.${r}.over" data-kind="n" inputmode="decimal" value="${over}"></label>` : `<span class="gd-wk"><span>Too much</span><b class="num">${over}</b></span>`}</div>
      <div>${owner && changed ? `<button type="button" class="btn ghost sm" data-gdreset="roles.${r}.wks,roles.${r}.over">Reset</button>` : ''}</div></div>`;
  }).join('');
  const cats = Object.entries((BASE || {}).cats || {}).filter(([c]) => c !== '640').sort((a, b) => a[0].localeCompare(b[0]));
  const catRows = cats.map(([code, c]) => {
    const path = 'roleOf.' + code, v = gdValue(path), def = gdDefault(path) || 'fashion', changed = v !== def;
    const sel = owner ? `<select class="gd-in" data-gd="${path}" data-kind="role" aria-label="Role for ${esc(c.name)}">${roles.map(r => `<option value="${r}" ${r === v ? 'selected' : ''}>${esc(ROLES_DEFAULT[r].name)}</option>`).join('')}</select>` : esc(gdFmt('role', v));
    const wk = typeof wksNow === 'function' ? wksNow(code, num(c.onHand)) : null, rw = (ROLES_DEFAULT[v] || {}).wks && gdValue(`roles.${v}.wks`);
    return `<div class="gd-row${changed ? ' changed' : ''}"><div class="gd-what"><b>${code} ${esc(c.name)}</b></div>
      <div class="gd-sug"><b>${esc(gdFmt('role', def))}</b></div>
      <div class="gd-now num ${rw && wk != null && (wk < rw[2] || wk > rw[3]) ? 'neg' : ''}">${wk == null ? '—' : Math.round(wk) + ' wks'}</div>
      <div class="gd-val">${sel}</div><div>${owner && changed ? `<button type="button" class="btn ghost sm" data-gdreset="${path}">Reset</button>` : ''}</div></div>`;
  }).join('');
  return gdCard('Weeks of supply by role', 'Too little or too much stock is judged against these', `<div class="gd-row gd-hd gd-role"><span>Role</span><span>Suggested</span><span>Pasatiempo</span><span></span></div>${roleRows}`)
    + gdCard("Each category's role", 'Sets which weeks of supply and which advice a category gets', gdHead('Category', 'Suggested', 'Weeks now', 'Role') + catRows);
}

const GD_SEASONS = ['spring', 'summer', 'fall', 'holiday'];
const seasonEnd = (f, k) => { const i = GD_SEASONS.indexOf(k); return i < 3 ? f[GD_SEASONS[i + 1]] - 1 : 12; };
const seasonSpan = (f, k) => MONTHS[f[k] - 1].slice(0, 3) + ' – ' + MONTHS[seasonEnd(f, k) - 1].slice(0, 3);
function gdSeasons(){
  const owner = gdOwner(), defs = guideValues(null).seasons;
  // The four seasons are saved together (they only make sense as a set in calendar order).
  const firsts = gdValue('seasons');
  const rows = GD_SEASONS.map(k => {
    const def = defs[k], v = firsts[k], changed = v !== def, name = k[0].toUpperCase() + k.slice(1);
    const ctl = owner && k !== 'spring' ? `<select class="gd-in" data-gdseason="${k}" aria-label="${name} starts in">${MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === v ? 'selected' : ''}>${m}</option>`).join('')}</select>` : `<span>${MONTHS[v - 1]}</span>`;
    return `<div class="gd-row${changed ? ' changed' : ''}"><div class="gd-what"><b>${name}</b><span>${k === 'spring' ? 'Always starts in January' : ''}</span></div>
      <div class="gd-sug"><b>${seasonSpan(defs, k)}</b></div>
      <div class="gd-now">${seasonSpan(firsts, k)}</div><div class="gd-val">${ctl}</div>
      <div>${owner && k === 'spring' && !same(firsts, defs) ? '<button type="button" class="btn ghost sm" data-gdreset="seasons">Reset seasons</button>' : ''}</div></div>`;
  }).join('');
  return gdCard('Seasons', 'Which delivery months make up each buying season (Season buys and the Orders season filter)', gdHead('Season', 'Suggested', 'Months now', 'Starts in') + rows)
    + gdCard('Member discount', '', gdHead() + gdRow('memberDiscount', "Members' discount on soft goods", 'Markdown advice goes deeper than this to move anything', 'pct', 'the club\'s member discount', null, null, null));
}

function gdHistory(){
  const h = (GUIDE && GUIDE.history) || [];
  return gdCard('Change history', `${h.length} change${h.length === 1 ? '' : 's'}`, h.length ? `<ul class="gd-hist">${h.map(e => `<li><time>${esc(dateLabel(String(e.at || '').slice(0, 10)))}</time> <span class="person" data-uid="${esc(e.by || '')}"></span> changed <b>${esc(e.what)}</b> from ${esc(e.from == null ? '—' : String(e.from))} to ${esc(e.to == null ? '—' : String(e.to))}.${e.budget ? ` <span class="faint">Left to buy through ${esc(monthLabel(e.budget.through))}: ${esc(money(e.budget.change))}.</span>` : ''}${e.note ? ` <span class="faint">"${esc(e.note)}"</span>` : ''}</li>`).join('')}</ul>`
    : '<div class="empty"><p>No changes yet. Every saved change is listed here with who made it and why.</p></div>');
}

/* ----- the page ----- */
const GD_PANES = {targets: () => gdTargets(shopNow()), roles: gdRoles, seasons: gdSeasons, history: gdHistory,
  budget: () => typeof gdBudget === 'function' ? gdBudget() : '', mix: () => typeof gdMix === 'function' ? gdMix() : ''};
const gdTabCount = t => Object.keys(GD.draft).filter(p => gdTabOf(p) === t).length;
const gdTabOf = p => p.startsWith('bench.') ? 'targets' : p.startsWith('roles.') || p.startsWith('roleOf.') ? 'roles' : p === 'seasons' || p === 'memberDiscount' ? 'seasons' : p.startsWith('mix.') ? 'mix' : '';

/** Every saved path a tab can change, for "Reset this tab". */
function gdTabPaths(t){
  if (t === 'targets') return GD_TARGETS.flatMap(([, , rows]) => rows.map(r => r[0]));
  if (t === 'roles') return Object.keys(ROLES_DEFAULT).filter(r => ROLES_DEFAULT[r].wks).flatMap(r => [`roles.${r}.wks`, `roles.${r}.over`])
    .concat(Object.keys((BASE || {}).cats || {}).filter(c => c !== '640').map(c => 'roleOf.' + c));
  if (t === 'seasons') return ['seasons', 'memberDiscount'];
  if (t === 'mix') return ['mix.total', ...MIX_ROLES.map(r => 'mix.ranges.' + r)];
  return [];
}
function renderGuidelines(){
  if (!GD_PANES[GD.tab]) GD.tab = 'targets';
  const n = Object.keys(GD.draft).length, owner = gdOwner();
  const resetAll = gdTabPaths(GD.tab).filter(p => !same(gdValue(p), gdDefault(p)));
  const tabs = GD_TABS.map(([id, l]) => { const c = gdTabCount(id); return `<button type="button" role="tab" data-gdtab="${id}" aria-selected="${GD.tab === id}">${esc(l)}${c ? `<span class="gd-ct">${c} unsaved</span>` : ''}</button>`; }).join('');
  $('#pane').innerHTML = `<p class="gd-intro">Suggested values are general rules of thumb for a private-club shop, or worked out from your own sales; change any of them to fit Pasatiempo.
      ${owner ? '' : ' Only the owner can change them.'} Month-end suggestions update at your next upload.</p>
    <div class="gd-tabs" role="tablist" aria-label="Guidelines">${tabs}${owner && resetAll.length ? `<button type="button" class="btn ghost sm gd-resetall" data-gdreset="${esc(resetAll.join(','))}">Reset this tab to suggested</button>` : ''}</div>
    <div class="gd-pane">${GD_PANES[GD.tab]()}</div>
    ${owner && n ? `<div class="gd-save" role="region" aria-label="Unsaved changes"><b>${n} unsaved change${n === 1 ? '' : 's'}</b>
      <input class="field-inline" id="gdNote" placeholder="Why (optional), e.g. Peter Millar carries better margin now" value="${esc(GD.note)}">
      <button type="button" class="btn" data-gdact="discard">Discard</button><button type="button" class="btn primary" data-gdact="save">Save changes</button></div>` : ''}`;
  if (typeof fillPeople === 'function') fillPeople();
}

/** Puts an edited value in the draft when guideValues accepts it; otherwise says what is allowed. */
function gdEdit(path, v){
  const cand = JSON.parse(JSON.stringify(GUIDE || {}));
  for (const p in GD.draft) gdSet(cand, p, GD.draft[p]);
  gdSet(cand, path, v);
  if (!same(gdGet(guideValues(cand), path), v)){ toast("That value isn't allowed there. Percentages stay under 90%, weeks between 1 and 104, low before high, seasons in calendar order."); return render(); }
  if (same(v, gdSaved(path))) delete GD.draft[path]; else GD.draft[path] = v;
  render();
}

document.addEventListener('change', e => {
  const t = e.target;
  if (!t.closest || !t.closest('.gd-pane') || !gdOwner()) return;
  if (t.dataset.gdseason) return gdEdit('seasons', {...gdValue('seasons'), [t.dataset.gdseason]: +t.value});
  if (t.dataset.gdwk){
    const r = t.dataset.gdwk, w = (gdValue(`roles.${r}.wks`) || []).slice(), n = gdParse('n', t.value);
    if (n == null){ toast('Type a number of weeks.'); return render(); }
    w[+t.dataset.i] = n; return gdEdit(`roles.${r}.wks`, w);
  }
  if (!t.dataset.gd) return;
  const kind = t.dataset.kind, path = t.dataset.gd;
  const v = kind === 'role' ? t.value : kind === 'month' ? +t.value : gdParse(kind, t.value);
  if (v == null){ toast('Type a number.'); return render(); }
  gdEdit(path, v);
});
document.addEventListener('input', e => { if (e.target && e.target.id === 'gdNote') GD.note = e.target.value; });
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-gdtab],[data-gdreset],[data-gdact]');
  if (!b || !$('#pane').contains(b)) return;
  if (b.dataset.gdtab){ GD.tab = b.dataset.gdtab; try { localStorage.setItem('mp.guideTab', GD.tab); } catch (_) {} return render(); }
  if (!gdOwner()) return;
  if (b.dataset.gdreset){
    for (const p of b.dataset.gdreset.split(',')){ const d = gdDefault(p); if (same(d, gdSaved(p))) delete GD.draft[p]; else GD.draft[p] = d; }
    return render();
  }
  if (b.dataset.gdact === 'discard'){ GD.draft = {}; GD.note = ''; return render(); }
  if (b.dataset.gdact === 'save'){
    const patch = {}, entries = [];
    for (const p in GD.draft){
      const v = GD.draft[p], def = gdDefault(p);
      patch[p] = same(v, def) ? undefined : v;
      entries.push({what: gdLabel(p), from: gdShow(p, gdSaved(p)), to: gdShow(p, v)});
    }
    b.disabled = true;
    if (await saveGuides(patch, entries, GD.note.trim())){ GD.draft = {}; GD.note = ''; toast('Guidelines saved. Every page now uses them.'); }
    else b.disabled = false;
  }
});

/** Plain-English name of a guideline path, for the history. */
function gdLabel(p){
  for (const [, , rows] of GD_TARGETS) for (const r of rows) if (r[0] === p) return r[1];
  const m = /^roleOf\.(\d+)$/.exec(p); if (m) return `Role of ${m[1]} ${(((BASE || {}).cats || {})[m[1]] || {}).name || ''}`.trim();
  const w = /^roles\.(\w+)\.(wks|over)$/.exec(p); if (w) return `${(ROLES_DEFAULT[w[1]] || {}).name} weeks of supply${w[2] === 'over' ? ' (too much)' : ''}`;
  if (p === 'seasons') return 'Season months';
  if (p === 'memberDiscount') return 'Member discount';
  return p;
}
function gdShow(p, v){
  if (v == null) return null;
  if (p.startsWith('roleOf.')) return gdFmt('role', v);
  if (p === 'seasons') return GD_SEASONS.map(k => `${k[0].toUpperCase() + k.slice(1)} ${seasonSpan(v, k)}`).join(', ');
  if (/\.wks$/.test(p)) return `${v[0]}–${v[1]} wks (near ${v[2]}–${v[3]})`;
  for (const [, , rows] of GD_TARGETS) for (const r of rows) if (r[0] === p) return gdFmt(r[3], v);
  if (p === 'memberDiscount') return gdFmt('pct', v);
  return String(v);
}

/* ----- Budget inputs: target weeks of supply per category, saved in plan/assumptions (the budget engine's own input).
   Edits wait in GW and are previewed by running the engine (wosPreview); the Forecast page's WHATIF is never touched. */
let GW = {};
const gdWosNow = c => assumptions().wos[c];
function gdBudget(){
  if (!BASE) return gdCard('Target weeks of supply', '', '<div class="empty"><p>The budget loads after the first month-end upload.</p></div>');
  const owner = gdOwner(), sug = (BASE.defaults || {}).wos || {};
  const codes = BASE.order.filter(c => !(BASE.exclude || ['640']).includes(c));
  const rows = codes.map(c => {
    const v = c in GW ? GW[c] : gdWosNow(c), changed = v !== sug[c], wk = wksNow(c, num(BASE.cats[c].onHand));
    const input = owner ? `<input class="gd-in num" data-gdwos="${c}" inputmode="decimal" value="${v}" aria-label="Target weeks for ${esc(BASE.cats[c].name)}"><span class="gd-u">wks</span>` : `<span class="num">${v} wks</span>`;
    return `<div class="gd-row${changed ? ' changed' : ''}${c in GW ? ' pending' : ''}"><div class="gd-what"><b>${c} ${esc(BASE.cats[c].name)}</b><span>On hand ${money(num(BASE.cats[c].onHand))}</span></div>
      <div class="gd-sug"><b class="num">${sug[c] == null ? '—' : sug[c] + ' wks'}</b><span>program default</span></div>
      <div class="gd-now num">${wk == null ? '—' : Math.round(wk) + ' wks'}</div><div class="gd-val">${input}</div>
      <div>${owner && changed ? `<button type="button" class="btn ghost sm" data-gdwosreset="${c}">Reset to ${sug[c]}</button>` : ''}</div></div>`;
  }).join('');
  return gdCard('Target weeks of supply', 'How much stock the budget plans to end each month with. Changing it moves open-to-buy.', gdHead('Category', 'Suggested', 'Weeks now', 'Pasatiempo') + rows
    + '<div class="note">Nothing changes in the budget until you look at the effect and press Save to the budget.</div>') + gdBudgetPreview();
}
/** Left to buy by month, now and with the unsaved weeks: the Budget page's figure (budget less committed) plus the
    change in the plan the engine gives. */
function gdBudgetPreview(){
  const codes = Object.keys(GW); if (!codes.length) return '';
  const P = wosPreview(BASE, assumptions(), GW, {}), cm = committedMatrix();
  const left = (c, k) => budgetAt(c, k) - num((cm[c] || {})[k]);
  const line = (label, vals, cls) => `<tr><td>${label}</td>${vals.map(v => `<td class="r num ${cls ? cls(v) : ''}">${money(v)}</td>`).join('')}</tr>`;
  let body = '';
  for (const c of codes){
    const now = P.months.map(k => left(c, k)), wth = P.months.map((k, i) => now[i] + P.after[c][i] - P.before[c][i]);
    body += `<tr class="gd-pv-h"><td colspan="${P.months.length + 1}"><b>${c} ${esc(BASE.cats[c].name)}</b>: ${gdWosNow(c)} → ${GW[c]} weeks</td></tr>`
      + line('Left to buy now', now) + line(`With ${GW[c]} weeks`, wth, v => v >= 0 ? 'pos' : 'neg');
  }
  const d = P.months.map((k, i) => P.after.total[i] - P.before.total[i]);
  body += line('Change, all categories', d, v => v > 0 ? 'pos' : v < 0 ? 'neg' : '');
  return `<section class="panel gd-card gd-pv" role="region" aria-label="Effect before you save"><header><h2>Effect before you save</h2><span class="lab">${esc(PLANS.cur ? PLANS.cur.fy : '')} by month</span></header>
    <div class="tbl"><table><thead><tr><th></th>${P.months.map(k => `<th class="r">${esc(monthLabel(k))}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>
    <div class="gd-save"><b>${codes.length} unsaved budget change${codes.length === 1 ? '' : 's'}</b>
      <input class="field-inline" id="gdNote" placeholder="Why (optional)" value="${esc(GD.note)}">
      <button type="button" class="btn" data-gdwosact="discard">Discard</button><button type="button" class="btn primary" data-gdwosact="save">Save to the budget</button></div></section>`;
}
document.addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.gdwos || !gdOwner()) return;
  const c = t.dataset.gdwos, n = gdParse('n', t.value);
  if (n == null || n < 1 || n > 104){ toast('Type a number of weeks between 1 and 104.'); return render(); }
  if (n === gdWosNow(c)) delete GW[c]; else GW[c] = n;
  render();
});
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-gdwosreset],[data-gdwosact]');
  if (!b || !$('#pane').contains(b) || !gdOwner()) return;
  if (b.dataset.gdwosreset){ const c = b.dataset.gdwosreset, d = ((BASE.defaults || {}).wos || {})[c]; if (d === gdWosNow(c)) delete GW[c]; else GW[c] = d; return render(); }
  if (b.dataset.gdwosact === 'discard'){ GW = {}; return render(); }
  if (b.dataset.gdwosact === 'save'){
    const sug = (BASE.defaults || {}).wos || {}, P = wosPreview(BASE, assumptions(), GW, {});
    const wos = {...((SAVED || {}).wos || {})};
    for (const c in GW){ if (GW[c] === sug[c]) delete wos[c]; else wos[c] = GW[c]; }
    const change = P.months.reduce((t, k, i) => t + P.after.total[i] - P.before.total[i], 0);
    const entries = Object.keys(GW).map(c => ({what: `Target weeks of supply, ${c} ${BASE.cats[c].name}`, from: gdWosNow(c) + ' wks', to: GW[c] + ' wks'}));
    b.disabled = true;
    if (await write('plan/assumptions', {...(SAVED || {}), wos, by: myId, at: new Date().toISOString()})){
      entries[0].budget = {through: P.months[P.months.length - 1], change: Math.round(change)};
      await saveGuides({}, entries, GD.note.trim());
      GW = {}; GD.note = ''; toast('Saved. The budget now uses these weeks of supply.');
    } else b.disabled = false;
  }
});
/** Leaving the Guidelines page with unsaved changes asks first (goTab in 90-io.js). */
function gdLeaveOk(){
  if (!Object.keys(GW).length && !Object.keys(GD.draft).length) return true;
  if (!confirm('You have unsaved guideline changes. Leave without saving them?')) return false;
  GW = {}; GD.draft = {}; return true;
}
