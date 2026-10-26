// modules/system/settings/compute.js -- PURE. Settings has almost nothing to compute;
// it reports plan size so the Data section can show it.
export function compute(plan) {
  const size = JSON.stringify(plan).length;
  return { schemaVersion: plan.schemaVersion, sizeKB: Math.round(size / 102.4) / 10, updatedAt: plan.meta?.updatedAt ?? null, sections: Object.keys(plan).filter((k) => Array.isArray(plan[k])).map((k) => ({ key: k, count: plan[k].length })) };
}
