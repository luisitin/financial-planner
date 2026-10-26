// modules/investments/limits/compute.js -- PURE. This year's contribution limits for each
// person and account kind (401(k), IRA, HSA, health FSA, 529 gifts) against what is going
// in, the room left, the catch-ups that apply, the Roth income limit, and the deadlines.
import { LIMITS } from "../../retirement/contributions/data/limits.js";
import { compute as computeContributions } from "../../retirement/contributions/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";

const KIND_OF_TYPE = { "401k": "401k", ira: "ira", roth: "ira", hsa: "hsa" };

/**
 * compute(plan, { today }) -> {
 *   year, limitsYear, people: [{ name, age, rows: [{ kind, label, limit, catchUp, used, room, over, accounts: [names] }] }],
 *   fsa: { limit }, gift: { exclusion, superfund }, roth: { phaseOut: [lo, hi], magi, status: "ok"|"partial"|"over" | null },
 *   deadlines: [{ label, date }], totals: { used, limit }, notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  const limitsYear = LIMITS[year] ? year : Math.max(...Object.keys(LIMITS).map(Number));
  const L = LIMITS[limitsYear];
  const c = computeContributions(plan, { today });
  const accounts = plan.accounts ?? [];
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent").map((p) => {
    const age = p.birthDate ? year - Number(String(p.birthDate).slice(0, 4)) : null;
    const mine = c.items.filter((i) => i.personId === p.id);
    const rows = ["401k", "ira", "hsa"].map((kind) => {
      const def = L.kinds[kind];
      let limit = def.limit, catchUp = 0;
      if (age !== null && def.catchUpAge && age >= def.catchUpAge) { catchUp = def.catchUp; if (def.superCatchUp && age >= def.superCatchUp.from && age <= def.superCatchUp.to) catchUp = def.superCatchUp.amount; limit += catchUp; }
      if (kind === "hsa" && (plan.taxes?.hsa?.coverage === "family")) limit = def.family + catchUp;
      const items = mine.filter((i) => KIND_OF_TYPE[i.accountType] === kind);
      let used = items.reduce((s, i) => s + i.yearly, 0);
      if (kind === "hsa" && Number(plan.taxes?.hsa?.contribution) > 0) used = Math.max(used, Number(plan.taxes.hsa.contribution) + (Number(plan.taxes.hsa.employer) || 0));
      const names = [...new Set(items.map((i) => i.accountName))];
      const hasAccount = accounts.some((a) => KIND_OF_TYPE[a.type] === kind && (a.ownerId === p.id || !a.ownerId));
      return { kind, label: kind === "hsa" && plan.taxes?.hsa?.coverage === "family" ? "HSA (family coverage)" : def.label, limit, catchUp, used, room: Math.max(0, limit - used), over: Math.max(0, used - limit), accounts: names, hasAccount, catchUpAge: def.catchUpAge };
    });
    return { id: p.id, name: p.name, age, rows };
  });
  // the Roth income limit, on the household's MAGI (AGI is close enough)
  let roth = null;
  const po = L.rothPhaseOut?.[plan.household?.filingStatus ?? "single"];
  if (po) {
    const ti = taxInputs(plan, { today });
    const magi = federalTax(ti.inputs, ti.params).agi;
    roth = { phaseOut: po, magi, status: magi < po[0] ? "ok" : magi < po[1] ? "partial" : "over", filingStatus: ti.filingStatus };
  }
  const deadlines = [
    { label: `${year} IRA and HSA contributions`, date: `${year + 1}-04-15`, note: "can be made until the filing deadline of the following year" },
    { label: `${year} 401(k) contributions`, date: `${year}-12-31`, note: "through payroll only; last paycheck of the year" },
    { label: `${year} 529 gifts`, date: `${year}-12-31`, note: "some states allow the state deduction until the state's filing date" },
  ];
  const totals = { used: people.reduce((s, p) => s + p.rows.reduce((t, r) => t + r.used, 0), 0), limit: people.reduce((s, p) => s + p.rows.filter((r) => r.hasAccount || r.used > 0).reduce((t, r) => t + r.limit, 0), 0) };
  const notes = [];
  if (!people.length) notes.push("Add the adults on the People page; limits are per person.");
  if (!c.items.length) notes.push("Nothing on the Contributions page yet, so every limit shows its full room.");
  if (roth?.status === "over") notes.push(`Household income (${Math.round(roth.magi).toLocaleString("en-US")}) is over the Roth IRA limit for ${limitsYear}: direct Roth contributions are not allowed, but a backdoor Roth (a non-deductible IRA contribution converted at once) still is.`);
  else if (roth?.status === "partial") notes.push(`Household income is inside the Roth IRA phase-out (${roth.phaseOut[0].toLocaleString("en-US")} to ${roth.phaseOut[1].toLocaleString("en-US")}): only part of the IRA limit can go to a Roth directly.`);
  return { year, limitsYear, people, fsa: { limit: L.kinds.fsa?.limit ?? null }, gift: { exclusion: L.giftExclusion ?? 19000, superfund: (L.giftExclusion ?? 19000) * 5 }, roth, deadlines, totals, notes, hasContributions: c.items.length > 0 };
}
