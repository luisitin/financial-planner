// modules/overview/pages/compute.js -- PURE. The All-pages browser has no plan math; it
// only reads which pages carry notes so the list can flag them.
export function compute(plan) {
  return { noted: new Set(Object.keys(plan.pageNotes ?? {})) };
}
