// opt/hh.mjs -- what each invented household holds (plan sections with a count)
import { households } from "$SP/ux/kit.mjs";
const H = await households("$SP/opt/app", "2026-11-12");
for (const k of ["family", "renterDebt", "retiredCouple", "freelancer", "jordanMidSetup", "demo"]) {
  const p = H[k](); const n = (x) => (Array.isArray(x) ? x.length : x && typeof x === "object" ? Object.keys(x).length : x ? 1 : 0);
  console.log(k.padEnd(15), Object.entries(p).filter(([key, v]) => n(v) && !["meta", "schemaVersion"].includes(key)).map(([key, v]) => `${key} ${Array.isArray(v) ? v.length : "{" + Object.keys(v).length + "}"}`).join(", "));
}
