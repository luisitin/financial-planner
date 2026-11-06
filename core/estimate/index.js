// core/estimate/index.js -- the one import path for pages and tools: `import { ... } from "../../../core/estimate/index.js"`.
// Plumbing only (docs/CONVENTIONS.md "Guesses"): it holds no data and imports no module. The sourced tables and the
// core estimators are in modules/overview/guesses/; any module may add estimators of its own in its compute.js.
export { parsePath, getAt, setAt, canonical, pathOf } from "./paths.js";
export { TOLERANCE, same, isEntry, ledgerOf, debtKind, guessAt, isGuess, guessesInUse, guessesTouching, markGuess, clearGuess, confirmGuess, saveField, LEGACY } from "./ledger.js";
export { UNITS, WEIGHTS, applies, estimate, settle, rangeOf, mergeEstimators, checkEstimators } from "./engine.js";
