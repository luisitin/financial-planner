// modules/_template/compute.js -- PURE. Reads the plan, returns derived numbers.
// No DOM, no fetch, no localStorage, no Date.now() unless params.today is absent.
// Import math from ../../../core/math/*.js. Anything here must have a test in
// ./module.test.mjs, and the formula must be written down in README.md.
export function compute(plan, params = {}) {
  return { example: (plan.accounts ?? []).length, params };
}
