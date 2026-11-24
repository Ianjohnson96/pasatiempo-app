/* ---------- one category's page (#category:<code>) ----------
   Stage 3 (spec 2026-11-22-merch-phase2): how a category is doing and what to do about it, on one page. Every figure
   comes from the functions the other pages use (anaNow, stats, seasonBudget, stuckMoney, arrivalBarHtml), so they agree.
   CATSEL is the category shown; goTab('category', code) sets it (90-io.js). */
let CATSEL = null;
/** The code if it is a category in the plan or the analysis, else null (a stale link opens All categories). */
function catPageTarget(code){
  const c = String(code == null ? '' : code);
  if (!c) return null;
  if (PLAN && PLAN.cats && PLAN.cats[c]) return c;
  const a = typeof anaNow === 'function' ? anaNow() : null;
  return a && a.cats.some(x => x.cat === c) ? c : null;
}
function renderCategory(S){
  $('#pane').innerHTML = `<section class="panel"><div class="note">Category ${esc(CATSEL || '')}</div></section>`;
}
