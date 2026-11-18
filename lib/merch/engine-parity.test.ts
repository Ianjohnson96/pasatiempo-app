import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// merchandise/app/src/20-engine.js (the page's forecast and open-to-buy engine) and merchandise/pipeline/engine.py
// (the month-end reader's) must give the same budgets. Both run merchandise/pipeline/fixtures/engine_parity.json;
// pipeline/test_parity.py checks Python against its expected numbers, this checks the page's engine against them.
const src = (f: string) => readFileSync(path.join(process.cwd(), "merchandise", f), "utf8");
const fx = JSON.parse(src("pipeline/fixtures/engine_parity.json"));

// The few page helpers the engine uses (from 10-core.js), then the engine itself.
const helpers = `
const num = v => { const n = +v; return isFinite(n) ? n : 0; };
const pad = n => String(n).padStart(2,'0');
const addMonths = (m, k) => { let y = +m.slice(0,4), mo = +m.slice(5,7) - 1 + k; y += Math.floor(mo/12); mo = ((mo%12)+12)%12; return y + '-' + pad(mo+1); };
const THIS_MONTH = '2026-11', FALLBACK = {}, localStorage = {getItem: () => null};
`;
const ctx = vm.createContext({});
vm.runInContext(helpers + src("app/src/20-engine.js"), ctx);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (carry?: Record<string, number>): any =>
  vm.runInContext(`BASE = ${JSON.stringify(fx.base)}; SAVED = null; WHATIF = null;
    (() => { const a = assumptions(), E = runEngine(BASE, a, ${JSON.stringify(carry || {})});
      const tot = (c, ms) => E.cats[c].filter(r => ms.includes(r.m)).reduce((t, r) => t + r.otb, 0);
      return Object.fromEntries(Object.keys(BASE.cats).map(c => [c, {cur: tot(c, E.m27), next: tot(c, E.m28)}])); })()`, ctx);

describe("forecast engine parity with pipeline/engine.py", () => {
  it("gives the same budgets this year and next", () => {
    const got = run();
    for (const c of Object.keys(fx.expected.cur)) {
      expect(got[c].cur).toBeCloseTo(fx.expected.cur[c], 2);
      expect(got[c].next).toBeCloseTo(fx.expected.next[c], 2);
    }
  });

  it("carries stock above plan into next year the same way", () => {
    const got = run(fx.carry);
    for (const c of Object.keys(fx.expected.nextWithCarry)) expect(got[c].next).toBeCloseTo(fx.expected.nextWithCarry[c], 2);
  });
});
