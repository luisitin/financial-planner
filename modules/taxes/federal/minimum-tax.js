// modules/taxes/federal/minimum-tax.js -- PURE. The alternative minimum tax for everyone on the Federal estimate (gap list,
// next 60, item 29): the other way the tax is worked out (Form 6251), for the plan's own tax year, on the page's own return
// (known.js). The arithmetic is core/math/tax.js minimumTaxOn, the one Equity compensation uses too.
//   minimumTaxStep  known.js's last step: puts `amt` on the return when the minimum tax applies (or a spread is typed), so
//                   the year's tax, every tax page that reads it and the next dollar's cost count it; otherwise it hands
//                   back the very same inputs, and every figure is what it was.
//   summary         what the page shows inside "How this is worked out": the case, the figures, what pushes it.
//   sentence, pushSentence, rowsOf, howSays   the words, one written sentence per case (docs/OPTIONAL.md R5).
// README "The other way the tax is worked out (minimum tax)".
import { federalTax, minimumTaxOn } from "../../../core/math/tax.js";
import { itemizedTotal } from "./compute.js";
import { amtTableFor } from "./data/amt.js";
import * as W from "../../../core/words.js";

/** The switch the invariance test turns off: off is the code before the minimum tax (tests/minimum-tax-invariance.test.mjs). */
export const MINIMUM_TAX = { on: true };

const n = (v) => Number(v) || 0;
const fmtInt = (v) => { const r = Math.round(Number(v) || 0); return `${r < 0 ? "-" : ""}$${Math.abs(r).toLocaleString("en-US")}`; };

/**
 * The spread on incentive stock options exercised in tax year `year` and still held (`taxes.thisYear.isoSpread`), or 0. It
 * counts only for the year it was typed for (`taxes.thisYear.isoSpreadYear`): a return worked for another year (Equity
 * compensation's next year, Withholding check's or Forecast's other years, the Federal estimate after New Year) does not
 * count it, and a figure saved without its year counts for none (critic t1 M1, M2).
 */
export function isoSpreadOf(plan, year) {
  const ty = plan?.taxes?.thisYear;
  const v = Number(ty?.isoSpread);
  return Number.isFinite(v) && v > 0 && Number(ty?.isoSpreadYear) === Number(year) && Number(year) > 0 ? v : 0;
}
/** The plan has incentive stock options on Equity compensation. */
export const hasIsoGrants = (plan) => (plan?.equity?.grants ?? []).some((g) => g && g.kind === "option" && g.optionType === "iso");

/**
 * The state and local taxes each return deducts on Schedule A (what the minimum tax adds back when itemizing), as taxInputs
 * worked them: the household's itemized lines on a joint or single return; filing separately, each spouse's half of the
 * Itemized deductions boxes against that return's own income, as taxInputs splits them. -> [salt] per return, or [salt].
 */
export function saltOf(plan, fed) {
  const P = fed.params;
  if (Array.isArray(fed.separate) && fed.separate.length) {
    const half = Object.fromEntries(Object.entries(plan?.taxes?.itemized ?? {}).map(([k, v]) => [k, typeof v === "number" ? v / 2 : v]));
    return fed.separate.map((part) => {
      const agi = federalTax({ ...part, itemized: 0 }, P).agi;
      return itemizedTotal(half, agi, fed.filingStatus, P).lines.find((l) => l.key === "salt")?.amount ?? 0;
    });
  }
  return [fed.itemized?.lines?.find((l) => l.key === "salt")?.amount ?? 0];
}

/** Filing separately, the return the typed spread is on: the adult Equity compensation names, else the one marked "Me". */
const spreadReturn = (plan, inputs) => {
  const ids = inputs.separate.map((x) => x.personId);
  const named = plan?.equity?.personId;
  return named && ids.includes(named) ? named : inputs.separateTo ?? ids[0];
};

/**
 * known.js's last step: the minimum tax on the return the other steps left (`ctx.inputs`). It puts `amt` ({ table, salt,
 * preference }) on the inputs (each return's own when filing separately) when the minimum tax is 50 cents or more, or a
 * spread is typed (so Equity compensation's room counts the spread already used); otherwise it returns the very same
 * inputs object, so known() changes nothing. -> { inputs }
 */
export function minimumTaxStep({ plan, fed, inputs }) {
  if (!MINIMUM_TAX.on || !fed?.params) return { inputs };
  const table = amtTableFor(fed.year);
  if (!table) return { inputs };
  const spread = isoSpreadOf(plan, fed.year), P = fed.params, salts = saltOf(plan, fed);
  let next;
  if (inputs.filingStatus === "married_separate" && Array.isArray(inputs.separate) && inputs.separate.length) {
    const who = spreadReturn(plan, inputs);
    next = { ...inputs, separate: inputs.separate.map((part, i) => ({ ...part, amt: { table, salt: salts[i] ?? 0, preference: part.personId === who ? spread : 0 } })) };
  } else next = { ...inputs, amt: { table, salt: salts[0] ?? 0, preference: spread } };
  const r = federalTax(next, P);
  return n(r.minimumTax?.amt) >= 0.5 || spread > 0 ? { inputs: next } : { inputs };
}

/** The deduction the push removes, by kind, to see how much of the minimum tax it makes. */
function without(r, A, opts, P, kind) {
  if (kind === "options") return minimumTaxOn(r, A, { ...opts, preference: 0 }, P).amt;
  if (kind === "salt") return minimumTaxOn(r, A, { ...opts, salt: (r.deduction.itemizedLimit ?? 0) }, P).amt;
  if (kind === "standard") return minimumTaxOn({ ...r, deduction: { ...r.deduction, standard: 0 } }, A, opts, P).amt;
  if (kind === "senior") return minimumTaxOn({ ...r, deduction: { ...r.deduction, senior: 0 } }, A, opts, P).amt;   // still deducted, not added back
  if (kind === "income") return minimumTaxOn(r, { ...A, phaseOutRate: 0 }, opts, P).amt;
  return null;
}
const KINDS = ["options", "salt", "income", "standard", "senior"];

/** One return's figures and what pushes its minimum tax most: the kind whose removal takes the most off it (at least 50 cents). */
function oneReturn(r, A, opts, P) {
  const m = r.minimumTax ?? minimumTaxOn(r, A, opts, P);
  let push = null;
  if (m.amt >= 0.5) {
    let best = 0.5;
    for (const kind of KINDS) {
      if (kind === "salt" && m.addBackKind !== "salt") continue;
      if (kind === "standard" && m.addBackKind !== "standard") continue;
      const left = without(r, A, opts, P, kind);
      if (left !== null && m.amt - left >= best) { best = m.amt - left; push = kind; }
    }
  }
  const line1b = r.agi - r.deduction.amount - (r.deduction.qbi ?? 0);
  return { ...m, push, line1b, qualified: n(r.income?.qualified) };
}

/**
 * summary(plan, k) -> what "How this is worked out" shows of the minimum tax, from known()'s return `k` (null without
 * income): { case: "under" | "even" | "below" | "applies" | "separate-none" | "separate-one" | "separate-both", amt (the
 * household's), year, ...the figures of the return that decides (minimumTaxOn's, with push and line1b), returns (filing
 * separately: [{ personId, name, ...figures }]) }. `under`: the income it counts is no more than what it leaves untaxed;
 * `even`: worked out the other way the tax is the same (within 50 cents); `below`: less; `applies`: more, the difference
 * is the minimum tax.
 */
export function summary(plan, k) {
  if (!k?.hasIncome || !k.fed?.params) return null;
  const A = amtTableFor(k.year);
  if (!A) return null;
  const P = k.fed.params, r = k.result, spread = isoSpreadOf(plan, k.year), salts = saltOf(plan, k.fed);
  if (Array.isArray(r.separate) && r.separate.length) {
    const who = spreadReturn(plan, { separate: r.separate, separateTo: r.separateTo });
    const returns = r.separate.map((x, i) => ({ personId: x.personId, name: x.name, ...oneReturn(x, A, { salt: salts[i] ?? 0, preference: x.personId === who ? spread : 0 }, P) }));
    const owing = returns.filter((x) => x.amt >= 0.5);
    const top = [...returns].sort((a, b) => b.amt - a.amt || (b.tentative - b.regular) - (a.tentative - a.regular))[0];
    return { ...top, case: owing.length === 0 ? "separate-none" : owing.length === 1 ? "separate-one" : "separate-both", amt: returns.reduce((t, x) => t + x.amt, 0), year: k.year, returns };
  }
  const m = oneReturn(r, A, { salt: salts[0] ?? 0, preference: spread }, P);
  const kase = m.excess <= 0 ? "under" : m.amt >= 0.5 ? "applies" : m.regular - m.tentative < 0.5 ? "even" : "below";
  return { ...m, case: kase, year: k.year, returns: null };
}

/** The sentence under the heading, one written per case. */
export function sentence(s, money = fmtInt) {
  if (!s) return "";
  if (s.case === "under") return `The minimum tax does not apply: the income it counts, ${money(Math.max(0, s.amti))}, is under the ${money(s.exemption)} it leaves untaxed.`;
  if (s.case === "even") return `The minimum tax does not apply: worked out this other way, the tax would be ${money(s.tentative)}, the same as worked out the usual way.`;
  if (s.case === "below") return `The minimum tax does not apply: worked out this other way, the tax would be ${money(s.tentative)}, less than the ${money(s.regular)} worked out the usual way.`;
  if (s.case === "applies") return `The minimum tax adds ${money(s.amt)} to your tax: worked out this other way, the tax is ${money(s.tentative)}, more than the ${money(s.regular)} worked out the usual way.`;
  if (s.case === "separate-none") return "The minimum tax does not apply to either return: worked out this other way, each return's tax is no more than the usual way.";
  if (s.case === "separate-one") return `The minimum tax adds ${money(s.amt)} to your tax: worked out this other way, ${s.name ? W.nameOf(s.name) : "one"} return's tax is ${money(s.tentative)}, more than the ${money(s.regular)} worked out the usual way.`;
  if (s.case === "separate-both") return `The minimum tax adds ${money(s.amt)} to your tax: worked out this other way, each return's tax is more than the usual way.`;
  return "";
}

/** What pushes it, one written sentence per kind; "" when it does not apply or no one figure makes most of it. */
export function pushSentence(s, money = fmtInt) {
  if (!s || !(s.amt >= 0.5)) return "";
  if (s.push === "options") return `It comes mostly from the ${money(s.preference)} spread on the incentive stock options you exercised, which only this tax counts.`;
  if (s.push === "salt") return `It comes mostly from the ${money(s.addBack)} of state and local taxes you deduct, which this tax does not allow.`;
  if (s.push === "income") return `It comes mostly from income over ${money(s.phaseOutStart)}, which takes away ${money(s.exemptionFull - s.exemption)} of the ${money(s.exemptionFull)} this tax leaves untaxed.`;
  if (s.push === "standard") return `It comes mostly from the ${money(s.addBack)} standard deduction, which this tax does not allow.`;
  if (s.push === "senior") return `It comes mostly from the ${money(s.senior)} deduction for people 65 and over, which this tax does not allow.`;
  return "";
}

const WHO = { single: "a single person", head_of_household: "a single person", married_joint: "a married couple filing together", qualifying_surviving: "a married couple filing together", married_separate: "a married person filing separately" };

/** The figures as rows [{ label, amount, sub }] for one return's figures `s` (not for "under": the sentence says it all). */
export function rowsOf(s, money = fmtInt) {
  if (!s || s.case === "under") return [];
  const cents = `${Math.round(s.phaseOutRate * 100)} cents`;
  return [
    s.line1b >= 0 ? { label: "Taxable income", amount: s.line1b, sub: "worked out the usual way" } : { label: "Deductions over income", amount: s.line1b, sub: "the usual way leaves nothing to tax" },
    s.addBack >= 0.5 ? { label: s.addBackKind === "standard" ? "Standard deduction added back" : "State and local taxes added back", amount: s.addBack, sub: "this tax does not allow it" } : null,
    s.senior >= 0.5 ? { label: "Deduction for 65 and over added back", amount: s.senior, sub: "this tax does not allow it" } : null,
    s.preference >= 0.5 ? { label: "Incentive stock options", amount: s.preference, sub: "the spread on the options you exercised, which only this tax counts" } : null,
    { label: "Income this tax counts", amount: s.amti, sub: "" },
    { label: "Left untaxed", amount: -s.exemption, sub: s.exemption < s.exemptionFull - 0.5 ? `${money(s.exemptionFull)} for ${WHO[s.status] ?? WHO.single}, less ${cents} for each dollar over ${money(s.phaseOutStart)}` : `${money(s.exemptionFull)} for ${WHO[s.status] ?? WHO.single}` },
    { label: "Tax worked out this other way", amount: s.tentative, sub: `26% up to ${money(s.line28)} of what is left, 28% above${s.qualified >= 0.5 ? "; dividends and long-term gains at their usual rates" : ""}` },
    { label: "Tax worked out the usual way", amount: s.regular, sub: "the income tax above, before credits" },
    { label: "Minimum tax", amount: s.amt, sub: s.amt >= 0.5 ? "the first less the second: added to your tax" : "none: the usual way is no less" },
  ].filter(Boolean);
}

/** Filing separately, one row per return: [{ label, amount (its minimum tax), sub }]. */
export function returnRows(s, money = fmtInt) {
  return (s?.returns ?? []).map((x) => ({ label: `${x.name ? W.NameOf(x.name) : "Spouse's"} minimum tax`, amount: x.amt,
    sub: `income this tax counts ${money(Math.max(0, x.amti))}; worked out this other way ${money(x.tentative)}, the usual way ${money(x.regular)}` }));
}

/** The status of "How this is worked out" when the minimum tax applies ("minimum tax $16,840"); null otherwise (the steps as before). */
export function howSays(s, money = fmtInt) {
  if (!s || !(s.amt >= 0.5)) return null;
  const said = `minimum tax ${money(s.amt)}`;
  return said.length <= 20 ? said : "with a minimum tax";
}

/** The line about the box, for a plan with incentive options on Equity compensation and no spread typed for `year`; "" otherwise. */
export function optionsLine(plan, year) {
  return hasIsoGrants(plan) && !isoSpreadOf(plan, year) ? "Exercised incentive stock options this year and kept the shares? Type the spread under Figures the plan cannot see. Equity compensation shows how much you can exercise before this tax starts." : "";
}
