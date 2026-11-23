import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

// The whole Merchandise page (merchandise/app/src, every file but 90-io.js, which talks to the database and the DOM's
// events) in a vm, with a stubbed DOM and a fixed "today", loaded with the documents a test gives. Returns an
// evaluator: R(expr) runs expr in the page's scope.
//   docs: {base, assort, inv, guide, pos, today, storage}  (all optional; no base = before the first upload;
//   storage = what this browser had saved, e.g. {'ob.month': '2026-12'})
// The #pane stub keeps the last HTML a page rendered in document.__html.

const DIR = path.join(process.cwd(), "merchandise/app/src");
const FILES = readdirSync(DIR).filter((f) => /^\d\d-.*\.js$/.test(f) && !f.startsWith("90-")).sort();
const SRC = FILES.map((f) => readFileSync(path.join(DIR, f), "utf8")).join("\n;\n");

const STUB = `
const __el = () => new Proxy({innerHTML: '', textContent: '', hidden: false, value: '', style: {}, dataset: {}, classList: {add(){}, remove(){}, toggle(){}, contains(){ return false; }}},
  {get: (t, k) => k in t ? t[k] : k === 'querySelectorAll' ? (() => []) : k === 'querySelector' || k === 'closest' ? (() => null) : (typeof k === 'string' ? (() => __el()) : undefined), set: (t, k, v) => { t[k] = v; if (k === 'innerHTML' && t.__pane) document.__html = v; return true; }});
const __pane = __el(); __pane.__pane = true;
const document = {__html: '', addEventListener(){}, querySelector(s){ return s === '#pane' ? __pane : null; }, querySelectorAll(){ return []; },
  createElement(){ return __el(); }, body: __el(), documentElement: __el(), hidden: false};
const window = {addEventListener(){}, scrollY: 0, scrollTo(){}};
const localStorage = {getItem: k => (__docs.storage || {})[k] ?? null, setItem(){}};
const location = {hash: ''}; const history = {pushState(){}, replaceState(){}};
const navigator = {}; function matchMedia(){ return {matches: false}; }
function addEventListener(){} function setInterval(){} function setTimeout(){} function requestAnimationFrame(){}
class MutationObserver { observe(){} } class ResizeObserver { observe(){} } class IntersectionObserver { observe(){} }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Docs = { base?: any; assort?: any; inv?: any; guide?: any; pos?: any[]; today?: string; storage?: Record<string, string> };

export function loadPage(docs: Docs = {}): (expr: string) => unknown {
  const today = docs.today || "2026-11-22";
  const RealDate = Date;
  class FixedDate extends RealDate {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...a: any[]) { if (a.length) super(...(a as [string])); else super(today + "T12:00:00"); }
    static now() { return new RealDate(today + "T12:00:00").getTime(); }
  }
  const ctx = vm.createContext({ console, Date: FixedDate, Math, JSON, Object, Array, Number, String, Set, Map, isFinite, parseFloat, parseInt, Intl, Proxy, __docs: docs });
  vm.runInContext(STUB + SRC.replace("__FALLBACK__", "{}"), ctx, { filename: "merch-page.js" });
  vm.runInContext(`
    if (__docs.base) BASE = JSON.parse(JSON.stringify(__docs.base));
    ASSORT = __docs.assort ? JSON.parse(JSON.stringify(__docs.assort)) : null;
    INV = __docs.inv ? JSON.parse(JSON.stringify(__docs.inv)) : {asOf: '', cats: {}};
    INS = {asOf: '', items: []};
    POS = JSON.parse(JSON.stringify(__docs.pos || []));
    GUIDE = __docs.guide || null; applyGuides(GUIDE); SAVED = null; ADJS = {};
    // render() derives only once there is data (or a legacy plan); before the first upload it shows a message.
    if (BASE) derive();`, ctx);
  return (expr: string) => vm.runInContext(expr, ctx);
}
