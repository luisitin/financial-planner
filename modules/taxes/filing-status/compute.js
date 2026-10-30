// modules/taxes/filing-status/compute.js -- PURE. Which way to file: a married couple filing one joint return
// or two separate ones (each with their own pay, the shared income split in half, the children on the
// higher earner's return), a single parent as head of household or single. Each is a real federal return
// from the plan through the tax engine; what separate returns give up is listed beside it.
import { taxInputs } from "../federal/compute.js";
import { federalTax, statusLabel } from "../../../core/math/tax.js";
import { perYear } from "../../../core/math/periods.js";

/** What filing separately costs besides the tax (IRS Publication 501 and the forms' instructions). */
export const SEPARATE_LIMITS = [
  "no student loan interest deduction, and no credits for education or child and dependent care",
  "a Roth IRA is closed to you once income passes $10,000",
  "if one of you itemizes, the other must too",
  "it can lower an income-driven student loan payment, which follows the borrower's own income",
];

/** One return from a copy of the plan. */
function returnFor(plan, today) {
  const b = taxInputs(plan, { today });
  const r = federalTax(b.inputs, b.params);
  return { tax: r.totalTax, agi: r.agi, taxable: r.taxableIncome, rate: r.bracketRate, deduction: r.deduction.used };
}

/** The plan as one spouse's separate return: their income, half the shared income, their saving, half the typed figures, the children if they carry them. */
export function separatePlan(plan, personId, { kids }) {
  const p = JSON.parse(JSON.stringify(plan));
  const people = p.household?.people ?? [];
  p.household.people = people.filter((q) => q.id === personId || (kids && q.role === "dependent")).map((q) => (q.id === personId ? { ...q, role: "self" } : q));
  p.household.filingStatus = "married_separate";
  p.income = (p.income ?? []).filter((x) => !x.personId || x.personId === personId).map((x) => (x.personId ? x : { ...x, amount: (Number(x.amount) || 0) / 2 }));
  if (p.retirement) p.retirement.contributions = (p.retirement.contributions ?? []).filter((c) => c.personId === personId);
  const half = (o) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, typeof v === "number" ? v / 2 : v]));
  p.taxes = { ...(p.taxes ?? {}), thisYear: half(p.taxes?.thisYear), itemized: half(p.taxes?.itemized), gains: (p.taxes?.gains ?? []).map((g) => ({ ...g, proceeds: (Number(g.proceeds) || 0) / 2, basis: (Number(g.basis) || 0) / 2 })), dependentsUnder17: kids ? p.taxes?.dependentsUnder17 : 0, otherDependents: kids ? p.taxes?.otherDependents : 0 };
  return p;
}

/**
 * compute(plan, { today }) -> {
 *   kind: "couple"|"single-parent"|"single", current, options: [{ status, label, tax, parts?: [{ name, tax }], note }], best, saving (best against the current), limits
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const people = plan.household?.people ?? [];
  const adults = people.filter((q) => q.role !== "dependent");
  const kids = people.filter((q) => q.role === "dependent");
  const current = plan.household?.filingStatus || (adults.length > 1 ? "married_joint" : "single");
  const as = (status) => returnFor({ ...plan, household: { ...plan.household, filingStatus: status } }, today);
  const options = [];
  let kind = "single";
  if (adults.length >= 2) {
    kind = "couple";
    const joint = as("married_joint");
    options.push({ status: "married_joint", label: statusLabel("married_joint"), tax: joint.tax, note: `one return; ${joint.deduction} deduction; top rate ${Math.round(joint.rate * 100)}%` });
    // separate: the children go on the higher earner's return
    const payOf = (id) => (plan.income ?? []).filter((x) => x.personId === id).reduce((t, x) => t + perYear(x.amount, x.period), 0);   // a year's pay, whatever the period
    const carrier = [...adults.slice(0, 2)].sort((a, b) => payOf(b.id) - payOf(a.id))[0];
    const parts = adults.slice(0, 2).map((a) => ({ name: a.name, ...returnFor(separatePlan(plan, a.id, { kids: a.id === carrier.id }), today) }));
    options.push({ status: "married_separate", label: statusLabel("married_separate"), tax: parts.reduce((t, x) => t + x.tax, 0), parts: parts.map((x) => ({ name: x.name, tax: x.tax })), note: "two returns; the shared income split in half; the children on the higher earner's" });
  } else if (adults.length === 1) {
    const single = as("single");
    options.push({ status: "single", label: statusLabel("single"), tax: single.tax, note: "" });
    if (kids.length) { kind = "single-parent"; const hoh = as("head_of_household"); options.push({ status: "head_of_household", label: statusLabel("head_of_household"), tax: hoh.tax, note: "for an unmarried person paying more than half the cost of a home for a child or relative" }); }
  }
  const best = options.length ? options.reduce((a, b) => (b.tax < a.tax - 0.5 ? b : a)) : null;
  const cur = options.find((o) => o.status === current) ?? options[0] ?? null;
  return { kind, current, options, best: best?.status ?? null, saving: cur && best ? Math.max(0, cur.tax - best.tax) : 0, limits: kind === "couple" ? SEPARATE_LIMITS : [] };
}
