// modules/taxes/state/compute.js -- PURE. The year's state income tax, from the best source the plan has:
// a rate you typed; nothing in the nine states without an income tax on wages; last year's state return
// (the share of adjusted gross income it took, applied to this year's); or the state's flat rate on income less
// its usual deductions. What it is a month, what counting it on the federal return as an itemized deduction
// would save, what is left to pay after withholding, and the same income in the other flat-tax states.
import { compute as computeFederal } from "../federal/compute.js";

export const STATE_NAMES = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "Washington, D.C.", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };

/** The nine states with no income tax on wages, and what they do tax (Tax Foundation, 2026). */
export const NO_WAGE_TAX = {
  AK: "no income tax at all", FL: "no income tax at all", NV: "no income tax at all", SD: "no income tax at all", TX: "no income tax at all", WY: "no income tax at all",
  NH: "no income tax: its tax on interest and dividends ended in 2025",
  TN: "no income tax: its tax on interest and dividends ended in 2021",
  WA: "no tax on wages, but 7% on long-term capital gains above about $270,000 a year (9.9% above $1 million)",
};

/**
 * Flat-rate states for 2026 (rates: Tax Foundation's 2026 table and each state's enacted schedule) and the
 * usual deductions before the rate, from each state's instructions: `fed` = starts from federal taxable income
 * (the federal deduction comes off), `fedStd` = the federal standard deduction, `std` = [single, joint],
 * `person` = per person (children too), `adult` = per adult, `dependent` = more per dependent, `zero` = the first dollars taxed at nothing.
 * Approximate on purpose: credits and phase-outs are left out; your own figures replace them.
 */
export const FLAT = {
  AZ: { rate: 0.025, fedStd: true },
  CO: { rate: 0.044, fed: true },
  IA: { rate: 0.038, fed: true },
  IL: { rate: 0.0495, person: 2850 },
  IN: { rate: 0.0295, person: 1000, dependent: 1500 },
  KY: { rate: 0.035, std: [3270, 6540] },
  LA: { rate: 0.03, std: [12500, 25000] },
  MA: { rate: 0.05, adult: 4400, dependent: 1000, note: "plus 4% on income above about $1.08 million" },
  MI: { rate: 0.0425, person: 5800 },
  MS: { rate: 0.04, zero: 10000, std: [8300, 16600], dependent: 1500 },
  NC: { rate: 0.0399, std: [12750, 25500] },
  OH: { rate: 0.0275, zero: 26050 },
  PA: { rate: 0.0307 },
};

/** States where cities, counties or school districts add an income tax of their own in some places. */
export const LOCAL_TAX = ["AL", "DE", "IA", "IN", "KY", "MD", "MI", "MO", "NY", "OH", "OR", "PA"];

/** What a flat-rate state takes from `agi`: { allowance, tax }. `fed` = { deduction (used), standard } from the federal estimate. */
export function flatTax(rule, agi, { joint, people, adults, dependents, fed }) {
  let allowance = 0;
  if (rule.fed) allowance += fed.deduction;
  if (rule.fedStd) allowance += fed.standard;
  if (rule.std) allowance += rule.std[joint ? 1 : 0];
  if (rule.person) allowance += rule.person * people;
  if (rule.adult) allowance += rule.adult * adults;
  if (rule.dependent) allowance += rule.dependent * dependents;
  const taxable = Math.max(0, agi - allowance - (rule.zero ?? 0));
  return { allowance: allowance + (rule.zero ?? 0), tax: taxable * rule.rate };
}

/**
 * compute(plan, { today }) -> {
 *   year, code, name, method: "none" | "typed" | "prior" | "flat" | "unknown", agi, rate (the rate applied), allowance,
 *   tax, monthly, effective (share of AGI), note, local, withheld, balance (tax - withheld; null without withholding),
 *   federal: { counted (already on Federal), itemizes, saving (federal tax saved by counting it), cap },
 *   others: [{ code, name, tax }] (the same income in the no-tax and flat-tax states, cheapest first)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const code = String(plan.household?.state ?? "").toUpperCase();
  const s = plan.taxes?.state ?? {};
  const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const fedNow = computeFederal(plan, { today });
  const r = fedNow.result;
  const agi = Math.max(0, r.agi);
  const joint = fedNow.filingStatus === "married_joint";
  const people = plan.household?.people ?? [];
  const dependents = people.filter((p) => p.role === "dependent").length;
  const adults = Math.max(1, people.length - dependents);
  const filers = joint ? Math.min(2, adults) : 1;
  const ctx = { joint, people: filers + dependents, adults: filers, dependents, fed: { deduction: r.deduction?.amount ?? 0, standard: r.deduction?.standard ?? 0 } };
  const typedRate = num(s.rate), typedDeduction = num(s.deduction);
  const priorTax = num(s.priorTax), priorAgi = num(s.priorAgi);
  let method = "unknown", rate = null, allowance = 0, tax = null;
  if (typedRate !== null) { method = "typed"; rate = typedRate; allowance = typedDeduction ?? 0; tax = rate * Math.max(0, agi - allowance); }
  else if (NO_WAGE_TAX[code]) { method = "none"; rate = 0; tax = 0; }
  else if (priorTax !== null && priorAgi > 0) { method = "prior"; rate = priorTax / priorAgi; tax = rate * agi; }
  else if (FLAT[code]) {
    method = "flat"; rate = FLAT[code].rate;
    const f = flatTax(FLAT[code], agi, ctx);
    allowance = typedDeduction ?? f.allowance;
    tax = typedDeduction !== null ? rate * Math.max(0, agi - typedDeduction) : f.tax;
  }
  const withheld = num(s.withheld);
  const out = {
    year: fedNow.year, code, name: STATE_NAMES[code] ?? "", method, agi, rate, allowance, tax, monthly: tax === null ? null : tax / 12,
    effective: tax !== null && agi > 0 ? tax / agi : null, note: NO_WAGE_TAX[code] ?? FLAT[code]?.note ?? null, local: LOCAL_TAX.includes(code),
    withheld, balance: tax !== null && withheld !== null ? tax - withheld : null,
  };
  // on the federal return: state income tax is an itemized deduction, with property tax, up to the cap
  const counted = Number(plan.taxes?.itemized?.stateTax) || 0;
  let saving = 0, itemizes = r.deduction?.used === "itemized";
  if (tax !== null && tax > 0 && Math.abs(counted - tax) >= 1) {
    const copy = JSON.parse(JSON.stringify(plan));
    copy.taxes = copy.taxes ?? {}; copy.taxes.itemized = { ...(copy.taxes.itemized ?? {}), stateTax: Math.round(tax) };
    const fedWith = computeFederal(copy, { today });
    saving = r.totalTax - fedWith.result.totalTax;
    itemizes = fedWith.result.deduction?.used === "itemized";
  }
  out.federal = { counted, itemizes, saving, cap: fedNow.itemized?.saltCap ?? null };
  // the same income elsewhere: the states without a wage tax and the flat-rate ones (graduated states need their tables)
  out.others = [
    ...Object.keys(NO_WAGE_TAX).map((c) => ({ code: c, name: STATE_NAMES[c], tax: 0 })),
    ...Object.entries(FLAT).map(([c, rule]) => ({ code: c, name: STATE_NAMES[c], tax: flatTax(rule, agi, ctx).tax })),
  ].sort((a, b) => a.tax - b.tax || a.name.localeCompare(b.name));
  return out;
}
