// modules/retirement/contributions/compute.js -- PURE. What goes into retirement accounts each
// year, per person and per account, with the employer match, against this year's IRS limits.
// Limits live in data/limits.js with the year they apply to; check them every January.
import { perYear, periodLabel } from "../../../core/math/periods.js";
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";
import { LIMITS } from "./data/limits.js";

const LIMIT_KIND = { "401k": "401k", ira: "ira", roth: "ira", hsa: "hsa" };   // Roth and traditional IRA share one limit; Roth 401(k) counts with the 401(k)

/**
 * compute(plan, { today }) -> {
 *   items: [{ ...contribution, accountName, accountType, personName, yearly, matchYearly, totalYearly, periodLabel }],
 *   yearly (everyone's own money), matchYearly, totalYearly, byPerson: [{ personId, name, age, yearly, match, limits: [{ kind, label, limit, used, over, catchUp }] }],
 *   limitsYear, warnings: [text], hasData
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  const limitsYear = LIMITS[year] ? year : Math.max(...Object.keys(LIMITS).map(Number));
  const L = LIMITS[limitsYear];
  const people = plan.household?.people ?? [];
  const accounts = plan.accounts ?? [];
  const items = (plan.retirement?.contributions ?? []).map((c) => {
    const acct = accounts.find((a) => a.id === c.accountId);
    const person = people.find((p) => p.id === c.personId);
    const yearly = perYear(c.amount, c.period), matchYearly = Number(c.employerMatch) || 0;
    return { ...c, accountName: acct?.name ?? "account no longer on file", accountType: acct?.type ?? null, typeLabel: acct ? (ACCOUNT_TYPES[acct.type]?.label ?? acct.type) : "", personName: person?.name ?? "Household", yearly, matchYearly, totalYearly: yearly + matchYearly, periodLabel: periodLabel(c.period) };
  });
  const warnings = [];
  const byPerson = people.filter((p) => p.role !== "dependent").map((p) => {
    const mine = items.filter((i) => i.personId === p.id);
    const age = today && p.birthDate ? year - Number(String(p.birthDate).slice(0, 4)) : null;   // the age reached this year is what the catch-up rules use
    const limits = [];
    for (const [kind, def] of Object.entries(L.kinds)) {
      // an employer's HSA deposits share the HSA limit (IRS Pub. 969); a 401(k) match has its own, much higher, overall limit
      const used = mine.filter((i) => LIMIT_KIND[i.accountType] === kind).reduce((s, i) => s + i.yearly + (kind === "hsa" ? i.matchYearly : 0), 0);
      if (!used) continue;
      let limit = def.limit, catchUp = 0;
      if (age !== null && def.catchUpAge && age >= def.catchUpAge) { catchUp = def.catchUp; if (def.superCatchUp && age >= def.superCatchUp.from && age <= def.superCatchUp.to) catchUp = def.superCatchUp.amount; limit += catchUp; }
      limits.push({ kind, label: def.label, limit, used, over: Math.max(0, used - limit), catchUp });
      if (used > limit) warnings.push(`${p.name}: ${def.label} contributions of ${Math.round(used).toLocaleString("en-US")} are over the ${limitsYear} limit of ${limit.toLocaleString("en-US")}${catchUp ? " (with catch-up)" : ""}.`);
    }
    return { personId: p.id, name: p.name, age, yearly: mine.reduce((s, i) => s + i.yearly, 0), match: mine.reduce((s, i) => s + i.matchYearly, 0), limits };
  });
  for (const i of items) if (!i.accountType) warnings.push(`A contribution points to an account that is no longer on file.`);
  return { items, yearly: items.reduce((s, i) => s + i.yearly, 0), matchYearly: items.reduce((s, i) => s + i.matchYearly, 0), totalYearly: items.reduce((s, i) => s + i.totalYearly, 0), byPerson, limitsYear, limits: L, warnings, hasData: items.length > 0 };
}
