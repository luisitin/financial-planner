// modules/system/settings/compute.js -- PURE. Settings has almost nothing to compute;
// it reports plan size so the Data section can show it.
export function compute(plan) {
  const size = JSON.stringify(plan).length;
  return { schemaVersion: plan.schemaVersion, sizeKB: Math.round(size / 102.4) / 10, updatedAt: plan.meta?.updatedAt ?? null, sections: Object.keys(plan).filter((k) => Array.isArray(plan[k])).map((k) => ({ key: k, count: plan[k].length })) };
}

const kind = (v) => (v === null || v === undefined ? "none" : Array.isArray(v) ? "list" : typeof v === "object" ? "fields" : "value");
/**
 * Is a file to restore shaped like a plan? Each key it shares with `template` (emptyPlan()) must be the same kind:
 * a list stays a list, a set of fields stays a set of fields (checked two levels down, so household.people too).
 * A missing key is fine (migrate fills it); a template value of null accepts anything. Returns the first wrong key or null.
 */
export function planShapeProblem(p, template, depth = 2, path = "") {
  if (kind(p) !== "fields") return path || "the file";
  for (const [k, t] of Object.entries(template ?? {})) {
    if (!(k in p) || t === null || t === undefined) continue;
    const want = kind(t), got = kind(p[k]), at = path ? `${path}.${k}` : k;
    if (want === "list" && got !== "list") return at;
    if (want === "fields") {
      if (got !== "fields") return at;
      if (depth > 1) { const inner = planShapeProblem(p[k], t, depth - 1, at); if (inner) return inner; }
    }
  }
  return null;
}
