// modules/retirement/medicare/compute.js -- PURE. Medicare from 65: when each of you can sign up, what
// Part B, a drug plan and any supplement cost, and the income surcharge (IRMAA) each year, from the plan's
// own income two years before (Roth conversions and required withdrawals included): which years it bites,
// how much it adds over retirement, and how much room is left under the first threshold.
import { buildInputs } from "../projection/compute.js";
import { project } from "../../../core/math/retirement.js";
import { ageOn } from "../../../core/math/dates.js";
import { YEAR, PART_B, PART_B_DEDUCTIBLE, PART_D_BASE, tiersFor, LATE_PENALTY } from "./data/medicare.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeContributions } from "../contributions/compute.js";

/** The tier for a modified AGI: { index, partB, partDAdd, upTo, next (the next threshold above, or null) }. */
export function tierFor(magi, status) {
  const t = tiersFor(status);
  const i = t.findIndex(([upTo]) => magi <= upTo);
  const k = i < 0 ? t.length - 1 : i;
  return { index: k, partB: t[k][1], partDAdd: t[k][2], upTo: t[k][0], first: t[0][0] };
}

/** The sign-up window around the 65th birthday: three months before the birthday month to three months after (a birthday on the 1st moves it a month earlier). */
export function enrollmentWindow(birthDate) {
  const [y, m, d] = String(birthDate).split("-").map(Number);
  let month = m - (d === 1 ? 1 : 0), year = y + 65;
  if (month < 1) { month += 12; year -= 1; }
  const at = (k) => { const t = (year * 12 + (month - 1)) + k; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };
  return { from: at(-3), month: at(0), to: at(3) };
}

/**
 * compute(plan, { today }) -> {
 *   ready, missing, year (of the figures), partB, deductible, partD, supplement, status,
 *   people: [{ id, name, medicareYear, window: { from, month, to } }],
 *   years: [{ year, enrolled, magiYear, magiReal, tier, partBEach, partDAddEach, surchargeYearly, totalYearly, conversion }],
 *   lifetime (all premiums, today's dollars), surcharge (the IRMAA part of it), surchargeYears, firstSurcharge: { year, magiYear, over } | null, roomNow: { year, room } | null
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const m = plan.retirement?.medicare ?? {};
  const partD = Number(m.partDPremium) >= 0 && m.partDPremium !== null && m.partDPremium !== "" && m.partDPremium !== undefined ? Number(m.partDPremium) : PART_D_BASE;
  const supplement = Number(m.supplementPremium) > 0 ? Number(m.supplementPremium) : 0;
  const status = plan.household?.filingStatus || "single";
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const people = adults.map((p) => ({ id: p.id, name: p.name, medicareYear: Number(p.birthDate.slice(0, 4)) + 65, window: enrollmentWindow(p.birthDate), age: today ? ageOn(p.birthDate, today) : null }));
  const base = { year: YEAR, partB: PART_B, deductible: PART_B_DEDUCTIBLE, partD, supplement, status, people, latePenalty: LATE_PENALTY };
  // the plan's income each year, through the federal brackets (so every row carries its taxable income)
  const p2 = JSON.parse(JSON.stringify(plan));
  p2.retirement = { ...(p2.retirement ?? {}), taxMode: "brackets" };
  const b = buildInputs(p2, { today });
  if (!b.inputs) return { ...base, ready: false, missing: b.missing ?? [] };
  const I = b.inputs;
  const r = project(I);
  // income for the surcharge: the year's taxed income from the brackets; in working years (no tax worked out by the engine),
  // the pay of whoever still works less their pre-tax retirement saving, plus the plan's other taxable income that year
  const inc = computeIncome(plan, { today }), con = computeContributions(plan, { today });
  const payOf = (id) => inc.active.filter((x) => x.personId === id && ["salary", "bonus", "business"].includes(x.type)).reduce((s, x) => s + x.yearly, 0);
  const preTaxOf = (id) => (con.items ?? []).filter((c) => c.personId === id && ["401k", "ira"].includes(c.accountType)).reduce((s, c) => s + c.yearly, 0);
  const magiOf = (row) => {
    if (row?.retired && row.taxInfo) return (row.taxInfo.ordinary + row.taxInfo.qualified + row.taxInfo.taxableSocialSecurity) / row.priceLevel;
    const working = I.people.reduce((s, p, k) => s + (row.ages[k] < p.retireAge ? Math.max(0, payOf(p.id) - preTaxOf(p.id)) : 0), 0);
    const other = (row.incomeLines ?? []).filter((l) => !/'s pay$/.test(l.name) && !/Social Security/.test(l.name)).reduce((s, l) => s + l.amount, 0) / row.priceLevel;
    return working + other;
  };
  const byYear = new Map(r.rows.map((row) => [row.year, row]));
  const years = [];
  for (const row of r.rows) {
    const enrolled = I.people.filter((p, k) => row.ages[k] >= 65 && row.ages[k] <= p.endAge).length;
    if (!enrolled) continue;
    const src = byYear.get(row.year - 2) ?? r.rows[0];
    const magiReal = magiOf(src) ?? 0;
    const t = tierFor(magiReal, status);
    const each = (t.partB + partD + t.partDAdd + supplement) * 12;
    years.push({ year: row.year, enrolled, magiYear: src.year, magiReal, tier: t.index, partBEach: t.partB, partDAddEach: t.partDAdd, surchargeYearly: ((t.partB - PART_B) + t.partDAdd) * 12 * enrolled, totalYearly: each * enrolled, conversion: (src.conversion ?? 0) / src.priceLevel });
  }
  const sum = (k) => years.reduce((s, y) => s + y[k], 0);
  const hit = years.filter((y) => y.tier > 0);
  const first = hit[0] ?? null;
  // the room under the first threshold in the first year that sets a premium (the year two before the first Medicare year)
  const firstY = years[0];
  const firstTier = firstY ? tierFor(firstY.magiReal, status) : null;
  return {
    ...base, ready: true, missing: [], years,
    lifetime: sum("totalYearly"), surcharge: sum("surchargeYearly"), surchargeYears: hit.length,
    firstSurcharge: first ? { year: first.year, magiYear: first.magiYear, over: first.magiReal - tierFor(0, status).upTo, conversion: first.conversion } : null,
    roomNow: firstY ? { year: firstY.magiYear, premiumYear: firstY.year, room: firstTier.first - firstY.magiReal } : null,
    taxMode: plan.retirement?.taxMode ?? "flat",
  };
}
