
/* ---------- reports calendar ----------
   Every report and task on the reporting calendar, with shared tick boxes (checklist/{key}).
   The schedule comes from the club app (lib/merch/schedule.ts via MERCH_HOST.reports); without it
   (the standalone build) the tab is left out and the Month-end checklist works as before. */
const RPT = (window.MERCH_HOST && window.MERCH_HOST.reports) || null;
const RPT_STATUS = {upcoming: 'Coming up', due: 'Due', overdue: 'Overdue', done: 'Done'};
function rptState(p){
  const t = (CHECKS[p.key] || {}).items || {}, left = p.items.filter(i => !t[i.k]).length;
  const status = !left ? 'done' : RPT.today < p.due ? 'upcoming' : RPT.today < p.late ? 'due' : 'overdue';
  return {p, left, status};
}
const rptOpen = () => RPT ? RPT.periods.map(rptState) : [];
const rptAlerts = () => rptOpen().filter(x => x.status === 'due' || x.status === 'overdue');
const rptMonthly = () => RPT ? RPT.periods.find(p => p.cadence === 'monthly') || null : null;
function rptWhen(x){
  const d = x.p.due;
  if (x.status === 'done') return 'All done';
  if (x.status === 'overdue') return `Overdue — was due ${dateLabel(d)}`;
  if (d === RPT.today) return 'Due today';
  return `Due ${dateLabel(d)}`;
}
function checklistHTML(key, items){
  const chk = CHECKS[key] || {items: {}};
  return `<ul class="checks">${items.map(x => { const on = !!(chk.items && chk.items[x.k]); return `<li><label><input type="checkbox" data-chk="${esc(x.k)}" data-chkm="${esc(key)}" ${on ? 'checked' : ''} ${canAct() ? '' : 'disabled'}><span><b>${esc(x.t)}</b><span class="d">${esc(x.d)}</span>${on && chk.by && chk.by[x.k] ? `<span class="who">✓ <span class="person" data-uid="${esc(chk.by[x.k])}"></span></span>` : ''}</span></label></li>`; }).join('')}</ul>`;
}
function renderDueBar(){
  let bar = $('#duebar');
  if (!bar){ bar = document.createElement('div'); bar.id = 'duebar'; bar.className = 'banner duebar'; bar.hidden = true; $('#wibar').before(bar); }
  const a = rptAlerts();
  bar.hidden = !a.length || TAB === 'reports';
  if (bar.hidden) return;
  const late = a.some(x => x.status === 'overdue');
  bar.classList.toggle('late', late);
  bar.innerHTML = `<span>${a.map(x => `<b>${esc(x.p.label)}</b> ${x.status === 'overdue' ? 'is overdue' : x.p.due === RPT.today ? 'is due today' : 'is due'} (${x.left} left)`).join(' · ')}${a.some(x => x.p.cadence === 'monthly' && x.p.due === RPT.today && !((CHECKS[x.p.key] || {}).items || {}).sku) ? '. Run the SKU Analysis today: on-hand can\'t be recreated later.' : ''}</span><button class="btn sm" type="button" data-tab="reports">Open Reports</button>`;
}
function renderReports(){
  if (!RPT){ $('#pane').innerHTML = `<section class="panel"><div class="note">The reports calendar is part of the club app.</div></section>`; return; }
  const open = rptOpen(), order = {overdue: 0, due: 1, upcoming: 2, done: 3};
  open.sort((a, b) => order[a.status] - order[b.status] || a.p.due.localeCompare(b.p.due));
  const panel = x => `<section class="panel"><header><h2>${esc(x.p.label)}</h2><span class="rstat ${x.status}">${esc(rptWhen(x))}</span></header>
    <div class="note" style="padding-bottom:0">${esc(RPT.cadences[x.p.cadence] || '')} · ${x.p.items.length - x.left} of ${x.p.items.length} done</div>
    ${checklistHTML(x.p.key, x.p.items)}</section>`;
  $('#pane').innerHTML = `<div class="grid">
    <div class="stack">${open.length ? open.map(panel).join('') : '<section class="panel"><div class="note">Nothing is due right now.</div></section>'}</div>
    <div class="stack">
      <section class="panel"><header><h2>Coming up</h2></header>
        <table class="mini" style="margin:8px 16px 12px;width:calc(100% - 32px)"><tbody>${RPT.upcoming.map(p => `<tr><td><b>${esc(p.label)}</b><br><span style="color:var(--muted);font-size:12px">${esc(RPT.cadences[p.cadence] || '')}</span></td><td class="r num" style="white-space:nowrap">${dateLabel(p.due)}</td></tr>`).join('')}</tbody></table></section>
      <section class="panel"><header><h2>Reminders</h2><span class="lab">${RPT.emailOn ? 'Email on' : 'Email not set up'}</span></header>
        <div class="note" style="font-size:13.5px;color:var(--ink)">
          <p style="margin-top:0">Everyone with the Merchandise Program sees what's due here and in a banner on every page. Anyone who can log orders can tick items off; everyone sees the same ticks.</p>
          <p style="margin-bottom:0">${RPT.emailOn ? 'On reminder days an email goes out at about 8 am to everyone with the program, listing what\'s still unticked: the month-end three days before, on the last day, and on the 4th if anything is left; each Monday and Wednesday for the week; and at the quarterly count, the buying reviews and year-end.' : 'Reminder emails start once the club\'s mailbox is connected to the app (SMTP settings in Vercel). Until then, reminders show here and in the banner.'}</p></div></section>
    </div></div>`;
  fillPeople();
}
