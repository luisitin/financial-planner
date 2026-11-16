// modules/taxes/federal/minimum-tax.js -- PURE. The alternative minimum tax for everyone on the Federal estimate (gap list,
// next 60, item 29): the other way the tax is worked out (Form 6251), for the plan's own tax year, on the page's own return
// (known.js). The arithmetic is core/math/tax.js minimumTaxOn, the one Equity compensation uses too.
//   minimumTaxStep  known.js's last step: puts `amt` on the return when the minimum tax applies (or a spread is typed), so
//                   the year's tax, every tax page that reads it and the next dollar's cost count it; otherwise it hands
//                   back the very same inputs, and every figure is what it was.
//   summary         what the page shows inside "N more numbers": the case, the figures, what pushes it.
//   MT_LEAD, sentence, pushSentence, rowsOf, returnRows, howSays, heroLine, optionsLine   the words, one written sentence
//                   per case (docs/OPTIONAL.md R5); on screen it is "a second tax check (the alternative minimum tax)".
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

/** What the second check is, in one sentence: the lead under the heading (critic t1 F2: nothing said what it is). */
export const MT_LEAD = "The IRS works your tax out a second way that allows fewer deductions, and you pay whichever is more.";
/** The heading of the section inside "N more numbers". */
export const MT_HEADING = "A second tax check (the alternative minimum tax)";

/** The sentence after the lead, one written per case. */
export function sentence(s, money = fmtInt) {
  if (!s) return "";
  if (s.case === "under") return `It adds nothing for you: this check counts ${money(Math.max(0, s.amti))} of your income, under the ${money(s.exemption)} it leaves untaxed.`;
  if (s.case === "even") return `It adds nothing for you: worked out this second way, the tax would be ${money(s.tentative)}, the same as the usual way.`;
  if (s.case === "below") return `It adds nothing for you: worked out this second way, the tax would be ${money(s.tentative)}, less than the ${money(s.regular)} worked out the usual way.`;
  if (s.case === "applies") return `It adds ${money(s.amt)} to your tax: worked out this second way, the tax is ${money(s.tentative)}, more than the ${money(s.regular)} worked out the usual way.`;
  if (s.case === "separate-none") return "It adds nothing to either return: worked out this second way, each return's tax is no more than the usual way.";
  if (s.case === "separate-one") return `It adds ${money(s.amt)} to your tax: worked out this second way, ${s.name ? W.nameOf(s.name) : "one"} return's tax is ${money(s.tentative)}, more than the ${money(s.regular)} worked out the usual way.`;
  if (s.case === "separate-both") return `It adds ${money(s.amt)} to your tax: worked out this second way, each return's tax is more than the usual way.`;
  return "";
}

/** What pushes it, one written sentence per kind; "" when it does not apply or no one figure makes most of it. */
export function pushSentence(s, money = fmtInt) {
  if (!s || !(s.amt >= 0.5)) return "";
  if (s.push === "options") return `It comes mostly from the ${money(s.preference)} gain on the incentive stock options you exercised, which only this check counts.`;
  if (s.push === "salt") return `It comes mostly from the ${money(s.addBack)} of state and local taxes you deduct, which this check does not allow.`;
  if (s.push === "income") return `It comes mostly from income over ${money(s.phaseOutStart)}, which takes away ${money(s.exemptionFull - s.exemption)} of the ${money(s.exemptionFull)} this check leaves untaxed.`;
  if (s.push === "standard") return `It comes mostly from the ${money(s.addBack)} standard deduction, which this check does not allow.`;
  if (s.push === "senior") return `It comes mostly from the ${money(s.senior)} deduction for people 65 and over, which this check does not allow.`;
  return "";
}

const WHO = { single: "a single person", head_of_household: "a single person", married_joint: "a married couple filing together", qualifying_surviving: "a married couple filing together", married_separate: "a married person filing separately" };

/**
 * The working as rows [{ label, amount, sub }] for one return's figures `s`, only when the check adds to the tax (critic t1
 * F1: a household it adds nothing for reads the sentence alone, which already holds both figures). The taxable income is
 * in the sub of "Income this check counts", not a row of its own (it is the tile just above).
 */
export function rowsOf(s, money = fmtInt) {
  if (!s || !(s.amt >= 0.5)) return [];
  const cents = `${Math.round(s.phaseOutRate * 100)} cents`;
  const added = [s.addBack >= 0.5, s.senior >= 0.5, s.preference >= 0.5].filter(Boolean).length;
  return [
    s.addBack >= 0.5 ? { label: "Deductions this check does not allow", amount: s.addBack, sub: s.addBackKind === "standard" ? "the standard deduction" : "the state and local taxes you deduct" } : null,
    s.senior >= 0.5 ? { label: "Deduction for 65 and over", amount: s.senior, sub: "not allowed in this check either" } : null,
    s.preference >= 0.5 ? { label: "Gain on the options", amount: s.preference, sub: "incentive stock options you exercised and kept: only this check counts it" } : null,
    { label: "Income this check counts", amount: s.amti, sub: `${s.line1b >= 0 ? `your taxable income, ${money(s.line1b)}` : `your deductions over income, ${money(s.line1b)}`}${added ? `, with the ${added === 1 ? "figure" : "figures"} above added` : ""}` },
    { label: "Not taxed in this check", amount: -s.exemption, sub: s.exemption < s.exemptionFull - 0.5 ? `${money(s.exemptionFull)} for ${WHO[s.status] ?? WHO.single}, less ${cents} for each dollar over ${money(s.phaseOutStart)}` : `${money(s.exemptionFull)} for ${WHO[s.status] ?? WHO.single}` },
    { label: "Tax worked out this second way", amount: s.tentative, sub: `26% up to ${money(s.line28)} of what is left, 28% above${s.qualified >= 0.5 ? "; dividends and long-term gains at their usual rates" : ""}` },
    { label: "Tax worked out the usual way", amount: s.regular, sub: "your income tax, before credits" },
    { label: "Added to your tax", amount: s.amt, sub: "the first less the second" },
  ].filter(Boolean);
}

/** Filing separately, one row per return when the check adds to either: [{ label, amount (what it adds), sub }]. */
export function returnRows(s, money = fmtInt) {
  if (!s || !(s.amt >= 0.5)) return [];
  return (s.returns ?? []).map((x) => ({ label: `${x.name ? W.NameOf(x.name) : "Spouse's"} return`, amount: x.amt,
    sub: `${x.amt >= 0.5 ? "added to its tax" : "adds nothing"}: this check counts ${money(Math.max(0, x.amti))} of its income; worked out this second way ${money(x.tentative)}, the usual way ${money(x.regular)}` }));
}

/** The status of "N more numbers" when the check adds to the tax ("second check $16,840"); null otherwise (as before). */
export function howSays(s, money = fmtInt) {
  if (!s || !(s.amt >= 0.5)) return null;
  const said = `second check ${money(s.amt)}`;
  return said.length <= 20 ? said : "second tax check";
}

/** The one line in the answer when the check adds to the tax (critic t1 F3: the headline jumped with no reason in sight); "" otherwise. */
export function heroLine(s, money = fmtInt) {
  return s && s.amt >= 0.5 ? `Your tax includes ${money(s.amt)} from a second tax check (the alternative minimum tax).` : "";
}

/** The line about the box, for a plan with incentive options on Equity compensation and no spread typed for `year`; "" otherwise. */
export function optionsLine(plan, year) {
  return hasIsoGrants(plan) && !isoSpreadOf(plan, year) ? `Exercised incentive stock options in ${year} and kept the shares? The gain on them counts in this check. Equity compensation shows how much you can exercise before it adds tax.` : "";
}
