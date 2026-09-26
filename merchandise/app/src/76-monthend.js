
/* ---------- month-end page ---------- */
let REFRESHES = [], CHECKS = {};
const MONTH_END = [
  {k: 'sku', t: 'SKU Analysis', d: 'PRSHP – SKU Analysis as of the last day, all categories. Must be run on the last day: on-hand can\'t be recreated later.'},
  {k: 'daily', t: 'Daily Sales Report by Item', d: 'Run for the last day of the month. Gives month-to-date and fiscal-year-to-date sales by category.'},
  {k: 'cat', t: 'Sales by Category', d: 'Net Sales by Category – Pro Shop, fiscal year to date from May 1.'},
  {k: 'item', t: 'Sales by Item', d: 'Net Sales by Item – Pro Shop, fiscal year to date. Gives each SKU\'s average selling price.'},
  {k: 'best', t: 'Cost & margin report', d: 'PRSHP – BEST 100 based on Quantity Sold, fiscal year to date — past the top 100 if the system allows.'},
  {k: 'pos', t: 'Every purchase order is in the Order Book', d: 'Including phone and show orders. Mark anything received this month.'},
  {k: 'recv', t: 'Receipts entered in the POS', d: 'Every box that came in is received in the POS before the SKU Analysis runs.'},
  {k: 'send', t: 'Upload the reports', d: 'The owner uploads them on this page, PDF or Excel, checks what changes, then updates the program.'}
];
function nextRefreshMonth(){ return BASE ? (BASE.partial ? BASE.partial.m : addMonths(BASE.actualThrough, 1)) : THIS_MONTH; }
function renderMonthEnd(){
  if (!BASE){ $('#pane').innerHTML = `<section class="panel"><div class="note">Month-end status appears after the first refresh.</div></section>`; return; }
  const due = nextRefreshMonth(), dueEnd = due + '-' + pad(new Date(+due.slice(0,4), +due.slice(5,7), 0).getDate());
  const late = todayISO > dueEnd ? daysBetween(dueEnd, todayISO) : 0;
  const chk = CHECKS[due] || {items: {}}, done = MONTH_END.filter(x => chk.items && chk.items[x.k]).length;
  const hist = REFRESHES.slice().sort((a, b) => String(b.asOf).localeCompare(String(a.asOf)));
  const fyNow = curFY(), closed = fyMonths(fyNow).filter(k => monthStatus(k) === 'actual');
  const fcFor = k => { const r = hist.filter(h => h.forecast && h.forecast[k] != null && h.asOf < k + '-01').sort((a, b) => String(b.asOf).localeCompare(String(a.asOf)))[0]; return r ? r.forecast[k] : null; };
  const res = closed.map(k => ({k, act: monthTotal(k), ly: monthLY(k), fc: fcFor(k)}));
  $('#pane').innerHTML = `<div class="grid">
    <div class="stack">
      <section class="panel"><header><h2>Where the data stands</h2><span class="lab">Updated ${dateLabel(BASE.asOf)}</span></header>
        <div class="note" style="font-size:13.5px;color:var(--ink)">
          <p style="margin-top:0">Sales, stock and suggestions are as of <b>${dateLabel(BASE.asOf)}</b>. Closed months run through <b>${monthFull(BASE.actualThrough)} ${BASE.actualThrough.slice(0,4)}</b>${BASE.partial ? `; ${monthFull(BASE.partial.m)} had ${money(BASE.partial.actual)} of sales by day ${BASE.partial.day}` : ''}.</p>
          <p>${late ? `<b class="neg">The ${monthFull(due)} refresh is ${late} day${late === 1 ? '' : 's'} overdue.</b> Budgets are still using ${dateLabel(BASE.asOf)} stock, so anything received since then isn't reflected yet.` : `Next refresh: after <b>${monthFull(due)} ${due.slice(0,4)}</b> closes (${dateLabel(dueEnd)}).`}</p>
          <p style="margin-bottom:0">Orders, vendors, counts, budget changes and brand calls are live — they never wait for a refresh.</p></div></section>
      <section class="panel"><header><h2>${monthFull(due)} month-end checklist</h2><span class="lab">${done} of ${MONTH_END.length} done</span></header>
        <ul class="checks">${MONTH_END.map(x => { const on = !!(chk.items && chk.items[x.k]); return `<li><label><input type="checkbox" data-chk="${x.k}" data-chkm="${due}" ${on ? 'checked' : ''} ${canAct() ? '' : 'disabled'}><span><b>${x.t}</b><span class="d">${x.d}</span>${on && chk.by && chk.by[x.k] ? `<span class="who">✓ <span class="person" data-uid="${esc(chk.by[x.k])}"></span></span>` : ''}</span></label></li>`; }).join('')}</ul>
        <div class="note">Anyone who can log orders can tick these off; everyone sees the same list. Save each report as Excel if you can (it reads in seconds), PDF otherwise.</div></section>
    </div>
    <div class="stack">
      ${renderUpload()}
      <section class="panel"><header><h2>What happens at a refresh</h2></header><div class="note" style="font-size:13.5px;color:var(--ink)">
        <ol style="margin:0;padding-left:18px">
          <li>The owner uploads the reports on this page (PDF or Excel) and checks the new numbers before updating.</li>
          <li>The month just closed becomes an actual. The forecast moves forward from there.</li>
          <li>On-hand stock resets to the new SKU Analysis. Every budget, this year's and next year's, is worked out again.</li>
          <li>The To do list and the brand scorecard are rebuilt from the new numbers. Anything you'd marked done or dismissed stays that way.</li>
          <li>A line is added to the history below, so you can see how the plan moved.</li></ol></div></section>
      <section class="panel"><header><h2>Month results</h2><span class="lab">${fyLabel(fyNow)} closed months</span></header>
        <div style="overflow-x:auto"><table class="mini" style="margin:8px 16px 4px;width:calc(100% - 32px)"><thead><tr><th>Month</th><th class="r">Actual</th><th class="r">Last year</th><th class="r">vs LY</th><th class="r">Forecast</th><th class="r">vs forecast</th></tr></thead>
        <tbody>${res.map(r => `<tr><td>${monthLabel(r.k)}</td><td class="r num">${money(r.act)}</td><td class="r num">${money(r.ly)}</td><td class="r num">${pct(r.act / r.ly - 1)}</td><td class="r num">${r.fc == null ? '—' : money(r.fc)}</td><td class="r num ${r.fc != null && r.act < r.fc ? 'neg' : ''}">${r.fc == null ? '—' : pct(r.act / r.fc - 1)}</td></tr>`).join('')}</tbody></table></div>
        <div class="note">"Forecast" is what the plan expected for the month at the refresh before it. It fills in from the next refresh on.</div></section>
      <section class="panel"><header><h2>Refresh history</h2></header>
        ${hist.length ? `<div style="overflow-x:auto"><table class="mini" style="margin:8px 16px 14px;width:calc(100% - 32px)"><thead><tr><th>Data as of</th><th class="r">Sales YTD</th><th class="r">On hand</th><th class="r">This year budget</th><th class="r">Next year budget</th></tr></thead><tbody>${hist.map(h => `<tr title="${esc((h.notes || []).join(' '))}"><td>${dateLabel(h.asOf)}</td><td class="r num">${moneyK(num(h.ytd))}</td><td class="r num">${moneyK(num(h.onHand))}</td><td class="r num">${moneyK(num(h.otbCur))}</td><td class="r num">${moneyK(num(h.otbNext))}</td></tr>${(h.notes || []).length ? `<tr><td colspan="5" style="font-size:12px;color:var(--muted);border-top:none;padding-top:0">${h.notes.map(esc).join(' · ')}</td></tr>` : ''}`).join('')}</tbody></table></div>` : '<div class="note">No refreshes recorded yet.</div>'}</section>
    </div></div>`;
  fillPeople();
}
async function toggleCheck(m, k, on){
  const cur = CHECKS[m] || {items: {}, by: {}};
  const body = {items: {...(cur.items || {}), [k]: on}, by: {...(cur.by || {}), [k]: on ? myId : null}, month: m};
  await write('checklist/' + m, body);
}

/* ---------- month-end upload (owner) ----------
   1. POST {base}/api/refresh      a pass for the report reader + last month's documents
   2. POST /api/merch/reports      the reader (Python) returns a data file and its headline numbers
   3. POST {base}/api/import       once the owner confirms, the data file replaces the month-end documents */
const UP = {files: [], note: '', busy: false, applying: false, result: null, error: null, found: null};
const UP_MAX = 3.2e6;  // raw bytes; base64 adds a third and the reader takes 4.4 MB
const UP_KINDS = {sku_analysis: 'SKU Analysis', daily_sales: 'Daily Sales Report', best100: 'Cost & margin (BEST 100)', sales_by_category: 'Sales by Category', sales_by_item: 'Sales by Item', rounds: 'Rounds Summary'};
const ownerHere = () => !!(window.MERCH_HOST && MERCH_HOST.me && MERCH_HOST.me.role === 'owner') && canAct();
function upReset(){ Object.assign(UP, {files: [], note: '', busy: false, applying: false, result: null, error: null, found: null}); }
function upFilesTable(found){
  if (!found || !found.length) return '';
  return `<table class="mini" style="margin:8px 16px 4px;width:calc(100% - 32px)"><thead><tr><th>File</th><th>Read as</th></tr></thead><tbody>${found.map(f => `<tr><td style="word-break:break-all">${esc(f.name)}</td><td>${f.ok ? esc(UP_KINDS[f.kind] || f.kind) : `<span class="neg">${esc(f.note || 'Not used')}</span>`}</td></tr>`).join('')}</tbody></table>`;
}
function renderUpload(){
  if (!ownerHere()) return '';
  const head = `<header><h2>Update from this month's reports</h2><span class="lab">Owner</span></header>`;
  if (UP.busy) return `<section class="panel">${head}<div class="note" style="font-size:13.5px;color:var(--ink)">Reading ${UP.files.length} file${UP.files.length === 1 ? '' : 's'}… PDFs can take up to a minute; Excel takes seconds.</div></section>`;
  const r = UP.result;
  if (r){
    const s = r.summary, last = REFRESHES.slice().sort((a, b) => String(b.asOf).localeCompare(String(a.asOf)))[0] || {};
    const fy = +String(s.fy).slice(2), row = (label, before, after) => `<tr><td>${label}</td><td class="r num">${before}</td><td class="r num"><b>${after}</b></td></tr>`;
    return `<section class="panel">${head}
      ${upFilesTable(r.files)}
      ${(r.warnings || []).length ? `<ul class="note" style="margin:6px 0 0;padding-left:34px">${r.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
      <table class="mini" style="margin:10px 16px 4px;width:calc(100% - 32px)"><thead><tr><th></th><th class="r">Now</th><th class="r">After updating</th></tr></thead><tbody>
        ${row('Data as of', s.was ? dateLabel(s.was.asOf) : '—', dateLabel(s.asOf))}
        ${row('Closed months through', s.was && s.was.actualThrough ? monthLabel(s.was.actualThrough) : '—', monthLabel(s.actualThrough))}
        ${row('Sales this year to date', last.ytd != null ? money(num(last.ytd)) : '—', money(s.ytd))}
        ${row('On hand at cost', last.onHand != null ? money(num(last.onHand)) : '—', money(s.onHand))}
        ${row(`FY${fy} budget left`, last.otbCur != null ? money(num(last.otbCur)) : '—', money(s.otbCur))}
        ${row(`FY${fy + 1} budget`, last.otbNext != null ? money(num(last.otbNext)) : '—', money(s.otbNext))}
      </tbody></table>
      <div class="note">Budgets are before orders and budget changes, like the refresh history below. Orders, vendors, counts, budget changes and brand calls aren't touched.</div>
      <div style="display:flex;gap:8px;padding:4px 16px 14px"><button type="button" class="btn primary" id="upApply" ${UP.applying ? 'disabled' : ''}>${UP.applying ? 'Updating…' : 'Update the program'}</button><button type="button" class="btn" id="upReset" ${UP.applying ? 'disabled' : ''}>Cancel</button></div></section>`;
  }
  const size = UP.files.reduce((a, f) => a + f.size, 0);
  return `<section class="panel">${head}
    <div class="note" style="font-size:13.5px;color:var(--ink)">Choose this month's reports all at once, PDF or Excel, any file names. The program reads them and shows what changes before anything is updated.</div>
    ${UP.error ? `<div class="note neg" style="font-size:13.5px">${esc(UP.error)}</div>` : ''}
    ${upFilesTable(UP.found)}
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:6px 16px 4px">
      <label class="btn" style="cursor:pointer">Choose files<input type="file" id="upFiles" multiple accept=".pdf,.xlsx,.xls,.xlsm,.csv,application/pdf" style="display:none"></label>
      <span class="lab">${UP.files.length ? `${UP.files.length} file${UP.files.length === 1 ? '' : 's'}, ${(size / 1e6).toFixed(1)} MB` : 'No files chosen'}</span></div>
    ${UP.files.length ? `<ul class="note" style="margin:0;padding-left:34px">${UP.files.map(f => `<li style="word-break:break-all">${esc(f.name)}</li>`).join('')}</ul>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px 16px 14px"><input id="upNote" type="text" maxlength="200" placeholder="Note for the history (optional), e.g. October close" value="${esc(UP.note)}" style="flex:1;min-width:200px;padding:7px 10px;border:1px solid var(--rule2);border-radius:4px;background:var(--card)">
      <button type="button" class="btn primary" id="upRead" ${UP.files.length ? '' : 'disabled'}>Read the reports</button></div></section>`;
}
const fileB64 = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => no(r.error); r.readAsDataURL(f); });
async function upJSON(url, body){
  let r;
  try { r = await fetch(url, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})}); }
  catch (_){ throw new Error("Couldn't reach the server. Check your connection and try again."); }
  let j = null; try { j = await r.json(); } catch (_) {}
  if (!r.ok){ const e = new Error((j && j.error) || (r.status === 404 ? "The report reader isn't available on this server." : r.status === 413 ? 'Those files are too large to upload together. Upload fewer at a time, or use Excel exports.' : 'Something went wrong. Try again.')); e.found = j && j.files; throw e; }
  return j;
}
async function readReports(){
  if (!UP.files.length || UP.busy) return;
  const size = UP.files.reduce((a, f) => a + f.size, 0);
  if (size > UP_MAX){ UP.error = `Those files come to ${(size / 1e6).toFixed(1)} MB; the limit is ${(UP_MAX / 1e6).toFixed(1)} MB at a time. Leave out anything that isn't a month-end report, or use Excel exports, which are smaller.`; return render(); }
  Object.assign(UP, {busy: true, error: null, found: null}); render();
  try {
    const H = window.MERCH_HOST;
    const start = await upJSON(H.base + '/api/refresh');
    const files = await Promise.all(UP.files.map(async f => ({name: f.name, data: await fileB64(f)})));
    UP.result = await upJSON('/api/merch/reports', {ticket: start.ticket, prior: start.prior, note: UP.note, files});
  } catch (e){ UP.error = e.message; UP.found = e.found || null; }
  UP.busy = false; render();
}
async function applyReports(){
  const r = UP.result; if (!r || UP.applying) return;
  UP.applying = true; render();
  try {
    await upJSON(window.MERCH_HOST.base + '/api/import', r.bundle);
    const asOf = r.summary.asOf; upReset(); render();
    toast(`Updated to reports as of ${dateLabel(asOf)}. Reloading…`);
    setTimeout(() => location.reload(), 1200);
  } catch (e){ UP.applying = false; UP.error = e.message; UP.result = null; render(); }
}
