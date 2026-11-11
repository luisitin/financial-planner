// core/estimate/providers.js -- a figure another module works out, handed to the estimators without an import.
// The guesses may import core and data only (modules/overview/guesses/module.test.mjs, the import rule): a page whose
// compute reaches the guesses back (cashflow/budget-percent, through the next-step card) cannot be imported by them.
// That page registers its figure here when it loads (the app loads every module before any guess runs; qa/guess-sanity
// loads every page); an estimator asks with `provided(name)` and falls back to its own rule when nothing is registered.
//   provide(name, fn)   register (the last one wins)
//   provided(name)      the function, or null
//   PROVIDED_BY         name -> the page ("group/id") whose compute.js registers it. A place that runs one page's compute on
//                       its own (the PC server's POST /api/compute) imports these first, so the figure is there
//                       (fixer round 2, ssg-provider-order). Every provided("...") name in modules/ must be listed here
//                       (tests/guess-likely.test.mjs checks it).
const P = new Map();
export function provide(name, fn) { if (typeof name === "string" && typeof fn === "function") P.set(name, fn); }
export function provided(name) { return P.get(name) ?? null; }
export const PROVIDED_BY = Object.freeze({ "budget:afterTaxMonth": "cashflow/budget-percent" });
