// modules/taxes/federal/blanks.js -- PURE. What the Federal estimate's empty boxes stand for, worked out from other pages' own
// computes (smart guesses C11, 2026-11-15). Read by view.js and the tests only, never by a compute: the pages it reads
// (Withholding check, Home, State tax) all read this module's compute.js, so compute.js cannot read them back.
//   withheldSoFar(plan, { today })  the gray figure in "Federal tax withheld so far": the paychecks so far at the rate an
//                                   empty box already counts (a preview: never saved, nothing in any compute changes)
//   fromPlan(plan, { today, d, k }) the plan's own mortgage interest, property tax and state income tax for the itemized
//                                   boxes left empty, what they would add up to and what itemizing them would save: said
//                                   on the page as a labelled figure, never counted until the person types it
//   planSentence(f, money), hintSentence(f, money), helpFor(line, money)   the words, one written sentence per case
import { withholdingEstimate } from "../withholding/compute.js";
import { compute as computeHome } from "../../property/home/compute.js";
import { compute as computeState } from "../state/compute.js";
import { compute as computeFederal, WITHHELD_WHY } from "./compute.js";
import { known } from "./known.js";

export { WITHHELD_WHY };

/**
 * The tax the paychecks took out by today, as an empty "withheld so far" already counts it: Withholding check runs the whole
 * year at the paycheck rate (typed per paycheck there, else worked out from pay as payroll does, plus the tax held back from
 * stock as it vests), and a figure typed here adds the paychecks still to come. So the part already taken out is
 *   soFar = projected(box empty) - (projected(1 typed) - 1),
 * and typing soFar leaves `projected`, and so the April answer, exactly as it is.
 * -> { soFar, from: "paycheck" | "typed" | "mixed", projected } or null: a figure is typed (`withheldTyped`, or above 0 in a
 * plan from before the flag), nothing is withheld from pay, or nothing is taken out yet this year.
 */
export function withheldSoFar(plan, { today = null } = {}) {
  const ty = plan?.taxes?.thisYear ?? {};
  if (ty.withheldTyped === true || Number(ty.withheld) > 0) return null;
  let blank, one;
  try {
    blank = withholdingEstimate(plan, { today });
    one = withholdingEstimate({ ...plan, taxes: { ...(plan.taxes ?? {}), thisYear: { ...ty, withheld: 1, withheldTyped: true } } }, { today });
  } catch { return null; }
  if (!blank || blank.from === "none" || !Number.isFinite(blank.projected) || !Number.isFinite(one?.projected)) return null;
  const soFar = blank.projected - (one.projected - 1);
  return soFar >= 0.5 ? { soFar, from: blank.from, projected: blank.projected } : null;
}

/** Interest on the first $750,000 owed is deductible ($375,000 filing separately): IRS Publication 936 (2025), "Home mortgage
 * interest", read 2026-11-15. A loan from before December 16, 2017 keeps $1,000,000; the plan does not record that, so the lower
 * line is used (the figure is a pointer, never counted). */
export const MORTGAGE_LIMIT = { usual: 750000, married_separate: 375000 };
/** At or above this much off the year's tax, the plan's own figures are a hint worth money on the first view (OPTIONAL.md R9 #6). */
export const HINT_FROM = 100;
const KEYS = ["mortgageInterest", "propertyTax", "stateTax"];
const empty = (it, k) => !(Number(it?.[k]) > 0);

/**
 * The plan's own figures for the itemized boxes left empty (a box with a figure is the person's and is never replaced):
 * - mortgageInterest: the Home page's year of interest on its mortgage, on the first MORTGAGE_LIMIT owed;
 * - propertyTax: the Home page's property tax line (typed on Home, the part of the mortgage payment, or our guess of what is
 *   paid apart); never one line that holds the home insurance too, and never the itemized box itself (it is empty here);
 * - stateTax: the State tax page's "withheld or paid this year" when typed, else its tax for the year.
 * -> { lines: [{ key, label, amount, from, capped (the limit owed the interest was cut to, else false), guessed? (true: the Home
 *      page's own guess of the property tax paid apart) }], total (the itemized deductions with them in, after the caps), standard,
 *      saving (the year's federal tax now less with them in), beats (itemizing them beats the standard deduction) }; lines []
 *      and the rest null when the plan has none.
 */
export function fromPlan(plan, { today = null, d: d0 = null, k: k0 = null } = {}) {
  const it = plan?.taxes?.itemized ?? {};
  const none = { lines: [], total: null, standard: null, saving: null, beats: false };
  if (!KEYS.some((k) => empty(it, k))) return none;
  // the page's own figures when it has them (d: this compute, k: known()), so the page does not work them out twice
  let d = d0;
  if (!d) { try { d = computeFederal(plan, { today }); } catch { return none; } }
  const lines = [];
  if (empty(it, "mortgageInterest") || empty(it, "propertyTax")) {
    let h = null;
    try { h = computeHome(plan, { today }); } catch { h = null; }
    const L = h?.ready ? (h.costs?.lines ?? []) : [];
    const interest = L.find((l) => l.key === "interest");
    if (empty(it, "mortgageInterest") && Number(interest?.amount) >= 0.5) {
      const limit = d.filingStatus === "married_separate" ? MORTGAGE_LIMIT.married_separate : MORTGAGE_LIMIT.usual;
      const owed = Number(h.owed) || 0, share = owed > limit ? limit / owed : 1;
      lines.push({ key: "mortgageInterest", label: "mortgage interest", amount: Math.round(interest.amount * share), from: "the Home page", capped: share < 1 ? limit : false });
    }
    const tax = L.find((l) => l.key === "tax");
    const withInsurance = !!tax && !L.some((l) => l.key === "insurance") && /insurance/i.test(String(tax.label ?? ""));
    // (the Home page's own guess of the tax paid apart from the payment is said as ours: r1, F4)
    if (empty(it, "propertyTax") && Number(tax?.amount) >= 0.5 && !withInsurance) lines.push({ key: "propertyTax", label: "property tax", amount: Math.round(tax.amount), from: "the Home page", capped: false, ...(tax.guessed ? { guessed: true } : {}) });
  }
  if (empty(it, "stateTax")) {
    let s = null;
    try { s = computeState(plan, { today }); } catch { s = null; }
    const v = s ? (s.withheld !== null && s.withheld !== undefined ? Number(s.withheld) : Number(s.tax)) : NaN;
    if (v >= 0.5) lines.push({ key: "stateTax", label: "state income tax", amount: Math.round(v), from: "the State tax page", capped: false });
  }
  if (!lines.length) return none;
  const filled = { ...plan, taxes: { ...(plan.taxes ?? {}), itemized: { ...it, ...Object.fromEntries(lines.map((l) => [l.key, l.amount])) } } };
  let kNow = k0, k1, d1;
  try { kNow = kNow ?? known(plan, { today }, d); d1 = computeFederal(filled, { today }); k1 = known(filled, { today }, d1); } catch { return none; }
  return { lines, total: d1.itemized.total, standard: kNow.result.deduction.standard, saving: kNow.total - k1.total, beats: k1.result.deduction.used === "itemized" };
}

const about = (n, money) => `about ${money(Math.round(n / 10) * 10)}`;
const listOf = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** The sentence in "Itemized deductions" after its intro, one per case; "" when the plan has no figure for an empty box. */
export function planSentence(f, money) {
  if (!f?.lines?.length) return "";
  const own = `With your plan's own figures (${listOf(f.lines.map((l) => `${l.label} ${about(l.amount, money)}`))}), these would come to ${about(f.total, money)}`;
  return f.beats
    ? `${own}, more than the standard deduction: type the exact figures below (Form 1098, your tax bills and pay stubs have them).`
    : `${own}: still less than the standard deduction, so typing them would not change your tax.`;
}

/** The hint on the first view (only at HINT_FROM or more off the tax): what itemizing the plan's own figures would save. */
export function hintSentence(f, money) {
  if (!f?.lines?.length || !(f.saving >= HINT_FROM)) return "";
  return `Itemizing could save you ${about(f.saving, money)}: your plan's ${listOf(f.lines.map((l) => l.label))} bring your deductions to ${about(f.total, money)}, more than the ${money(f.standard)} standard one.`;
}

/** A box's help line naming the plan's own figure: "Your plan: about $16,350 (the Home page)."; a figure the Home page guessed
 * says so: "Your plan: about $5,000, our guess (the Home page)." */
export function helpFor(line, money) {
  if (!line) return "";
  return `Your plan: ${about(line.amount, money)}${line.guessed ? ", our guess" : ""} (${line.from}${line.capped ? `; the interest on the first ${money(line.capped)} owed` : ""}).`;
}
