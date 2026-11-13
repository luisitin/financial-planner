// modules/estate/inheritance/compute.js -- PURE and heavy. An inheritance you might receive, as a
// what-if beside the plan, never inside it: what arrives after tax and costs (an inherited traditional
// IRA is taxed as it is emptied, a house costs money to sell), what it would change if it came (the
// money left at the end, the spending the plan could carry), and the same if it were half as much or
// ten years later. The main plan never counts it.
import { project, affordableSpending, copyInputs } from "../../../core/math/retirement.js";
import { buildInputs, taxSettings } from "../../retirement/projection/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { known } from "../../taxes/federal/known.js";
import { federalTax } from "../../../core/math/tax.js";
import { rmdStartYear, inheritedDivisor } from "../../../core/math/rmd.js";

/** What each kind leaves after tax and costs: an inherited traditional IRA is taxed as income when it is emptied (within 10 years, SECURE Act); a house sold soon after costs about 6% to sell, with no gains tax on the stepped-up value (IRC 1014); cash and Roth money arrive whole. */
export const KINDS = {
  cash: { label: "Money or investments", net: () => 1 },
  home: { label: "A house (to sell)", net: () => 1 - 0.06 },
  ira: { label: "A traditional IRA or 401(k)", net: (taxRate) => 1 - taxRate },
  roth: { label: "A Roth IRA", net: () => 1 },
};
export const LATER_YEARS = 10;

/** What an item adds to savings, in today's dollars, after tax and costs. */
export const netOf = (item, taxRate) => Math.max(0, Number(item.amount) || 0) * (KINDS[item.kind] ?? KINDS.cash).net(taxRate);

/**
 * compute(plan, { today }) -> {
 *   ready, missing, items: [{ ...item, kindLabel, net }], total, net, taxRate,
 *   base: { success, endReal, affordableMonthly }, withIt: same | null, half: same | null, later: same | null,
 *   extraMonthly (with it, the spending the plan could carry in addition), endGain, spendingMonthly
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const b = buildInputs(plan, { today });
  const raw = plan.estate?.inheritance?.items ?? [];
  const taxRate = b.inputs ? Number(b.inputs.rates?.taxRate ?? 0.15) : 0.15;
  const startYear = b.inputs?.startYear ?? (today ? Number(String(today).slice(0, 4)) : 2026);
  const items = raw.map((x) => ({ ...x, amount: Math.max(0, Number(x.amount) || 0), year: Math.max(startYear, Number(x.year) || startYear), kind: KINDS[x.kind] ? x.kind : "cash", kindLabel: (KINDS[x.kind] ?? KINDS.cash).label, net: netOf(x, taxRate) }));
  const total = items.reduce((s, x) => s + x.amount, 0), net = items.reduce((s, x) => s + x.net, 0);
  if (!b.inputs) return { ready: false, missing: b.missing ?? [], items, total, net, taxRate };
  const I = b.inputs;
  const run = (events) => {
    const T = copyInputs(I); T.events.push(...events);
    const r = project(T);
    return { success: r.success, failYear: r.failYear ?? null, endReal: r.endBalanceReal, affordableMonthly: affordableSpending(T) / 12 };
  };
  const ev = (scale = 1, shift = 0) => items.filter((x) => x.net > 0).map((x) => ({ year: Math.min(I.endYear, x.year + shift), amount: -x.net * scale, label: `inheritance from ${x.from || "family"}` }));
  const base = run([]);
  const withIt = items.length ? run(ev()) : null;
  const half = items.length ? run(ev(0.5)) : null;
  const later = items.length ? run(ev(1, LATER_YEARS)) : null;
  return {
    ready: true, missing: [], items, total, net, taxRate, base, withIt, half, later,
    spendingMonthly: I.spending.yearly / 12,
    extraMonthly: withIt ? withIt.affordableMonthly - base.affordableMonthly : 0,
    endGain: withIt ? withIt.endReal - base.endReal : 0,
  };
}

// ---------------------------------------------------------------- an inherited IRA: emptying it within 10 years (gap #36)
// Beside compute(), never inside it: compute() gives what it gave before, whatever an item's three optional boxes hold.
/** The years after the year of death an inherited account has to be empty in (IRC 401(a)(9)(H); Publication 590-B (2025), "10-year rule"). */
export const EMPTY_YEARS = 10;
/** The kinds the 10-year limit is shown for. */
export const EMPTYING_KINDS = ["ira", "roth"];
/** The most items that get their own part on the page (the page holds five parts; one is "How this is worked out"). */
export const EMPTYING_MAX = 4;

/**
 * Three ways to empty a balance B over years k = 1..10, the money left growing at g a year (real). Each year: the balance
 * at its start Bk, the withdrawal wk, and B(k+1) = (Bk - wk) x (1 + g).
 *   even      wk = Bk / (11 - k): the same share of what is left each year, nothing after year 10
 *   required  wk = Bk / Lk (the divisor, core/math/rmd.js inheritedDivisor), year 10 takes the rest; null when the heir's age is not known
 *   last      nothing until year 10, then all of it
 * drawPlans({ balance, growth, heirAge, ownerAge }) -> { even, required | null, last }, each [{ k, start, draw }] (10 rows)
 */
export function drawPlans({ balance, growth = 0, heirAge = null, ownerAge = null }) {
  const B = Math.max(0, Number(balance) || 0), g = Number(growth) || 0;
  const run = (take) => {
    const rows = []; let b = B;
    for (let k = 1; k <= EMPTY_YEARS; k++) { const draw = Math.min(b, Math.max(0, k === EMPTY_YEARS ? b : take(k, b))); rows.push({ k, start: b, draw }); b = (b - draw) * (1 + g); }
    return rows;
  };
  const known = inheritedDivisor(1, heirAge, ownerAge) !== null;
  return {
    even: run((k, b) => b / (EMPTY_YEARS + 1 - k)),
    required: known ? run((k, b) => b / inheritedDivisor(k, heirAge, ownerAge)) : null,
    last: run(() => 0),
  };
}

/**
 * Had the person who died begun required withdrawals? What was typed ("yes" / "no"), else worked out from their birth year
 * and the year of death: they begin by April 1 of the year after the year the start age is reached (rmdStartYear), so a
 * death after that year is "yes", a death in or before the year the age is reached is "no", and a death in the year
 * between depends on the day ("unsure"). Nothing to go on: "unsure".
 * pastRbdOf(item, year) -> { past: "yes" | "no" | "unsure", from: "typed" | "age" | "unknown" }
 */
export function pastRbdOf(item, year = Number(item?.year)) {
  if (item?.pastRbd === "yes" || item?.pastRbd === "no") return { past: item.pastRbd, from: "typed" };
  const born = bornOf(item, year);
  if (born === null || !Number.isFinite(year)) return { past: "unsure", from: "unknown" };
  const reached = rmdStartYear(String(born));
  return { past: year > reached + 1 ? "yes" : year <= reached ? "no" : "unsure", from: "age" };
}

/** The year the person who died was born, as a whole year from 1900 to `latest`; anything else (a hand-edited file) is not known. */
export const bornOf = (item, latest = Infinity) => { const y = Math.round(Number(item?.fromBirthYear)); return y >= 1900 && y <= latest ? y : null; };
const yearOf = (person) => { const y = Number(String(person?.birthDate ?? "").slice(0, 4)); return y > 1850 ? y : null; };
/** The adults who could inherit (the people of the household who are not dependents), "Me" first. */
export const heirsOf = (plan) => (plan.household?.people ?? []).filter((p) => p.role !== "dependent").sort((a, b) => Number(b.role === "self") - Number(a.role === "self"));

/**
 * emptying(plan, { today }) -> {
 *   growth (the plan's expected return above inflation, at the mix it holds now), taxYear, filingStatus, heirs: [{ id, name }],
 *   items: [{ id, kind, from, amount, year (of the death), endYear (year + 10), heirId, heirName, heirAge (in the year after the death) | null,
 *     past, pastFrom, close (the heir is not more than 10 years younger than the person, by their birth years) | null (not known),
 *     set (how many of the three boxes hold something),
 *     plans: { even, required | null, last } each { rows: [{ k, year, start, draw, tax }], taken, tax, kept, taxLow, taxHigh (the dearest year) },
 *     evenShort (in some year an even share is less than the required amount: an old heir),
 *     offered: ["even", "required", "last"] (the ways the rule allows, in order; a Roth IRA: ["last", "even"]; withdrawals
 *       begun and evenShort: ["required"] alone, because taking an even share would take too little) }]
 *   noIncome (nothing to count the withdrawals on top of: no income this year and none in the plan's retired years)
 * }
 * Money is in today's dollars. The tax on a year's withdrawal is that year's federal tax with it minus without it, at this
 * year's tables: on top of this year's return (taxes/federal known()) in the years before the household retires, and on top
 * of what the plan's own run through the brackets holds for the year (pensions, Social Security, withdrawals) after. A Roth
 * IRA's withdrawals are not income (tax 0).
 */
export function emptying(plan, params = {}) {
  const today = params.today ?? null;
  const b = buildInputs(plan, { today });
  const I = b.inputs ?? null;
  const A = plan.assumptions ?? {};
  const year0 = I?.startYear ?? (today ? Number(String(today).slice(0, 4)) : 2026);
  const share = Number(I?.rates?.stocksNow ?? 0.6), infl = Number(I?.rates?.inflation ?? A.inflation ?? 0.03);
  const nominal = share * Number(I?.returns?.stocks ?? A.returnStocks ?? 0.07) + (1 - share) * Number(I?.returns?.bonds ?? A.returnBonds ?? 0.04);
  const growth = (1 + nominal) / (1 + infl) - 1;
  // this year's return, as the Federal estimate holds it
  const fed = taxInputs(plan, { today });
  let now = fed.inputs;
  try { now = known(plan, { today }).inputs ?? fed.inputs; } catch { now = fed.inputs; }
  const P = fed.params;
  // the years after the household retires: what the plan's own run through the brackets taxes in each
  const later = new Map();
  if (I) for (const x of project({ ...I, tax: taxSettings(plan, { mode: "brackets" }) }).rows) {
    if (!x.retired || !x.taxInfo) continue;
    const k = (n) => (Number(n) || 0) / x.priceLevel;
    later.set(x.year, { filingStatus: fed.filingStatus, otherOrdinary: k(x.taxInfo.ordinary), qualifiedIncome: k(x.taxInfo.qualified), socialSecurity: k(x.taxInfo.socialSecurity), ages65plus: (x.ages ?? []).slice(0, 2).filter((a) => a >= 65).length });
  }
  const lastYear = later.size ? Math.max(...later.keys()) : null;
  const otherIn = (year) => later.get(year) ?? (lastYear !== null && year > lastYear ? later.get(lastYear) : now);
  const taxOn = (draw, year) => {
    if (!(draw > 0)) return 0;
    const base = otherIn(year);
    return Math.max(0, federalTax({ ...base, otherOrdinary: (Number(base.otherOrdinary) || 0) + draw }, P).totalTax - federalTax(base, P).totalTax);
  };
  const heirs = heirsOf(plan);
  const items = (plan.estate?.inheritance?.items ?? []).filter((x) => EMPTYING_KINDS.includes(x.kind) && Number(x.amount) > 0).map((x) => {
    const year = Math.max(year0, Math.round(Number(x.year)) || year0);
    const heir = heirs.find((p) => p.id === x.heirId) ?? heirs[0] ?? null;
    const heirBorn = yearOf(heir), born = bornOf(x, year0);
    const heirAge = heirBorn === null ? null : year + 1 - heirBorn;
    const { past, from: pastFrom } = pastRbdOf({ ...x, fromBirthYear: born }, year);
    const roth = x.kind === "roth";
    const draws = drawPlans({ balance: x.amount, growth, heirAge, ownerAge: born === null ? null : year - born });
    const sum = (rows) => {
      const out = rows.map((r) => ({ ...r, year: year + r.k, tax: roth ? 0 : taxOn(r.draw, year + r.k) }));
      const taken = out.reduce((s, r) => s + r.draw, 0), tax = out.reduce((s, r) => s + r.tax, 0);
      const paid = out.filter((r) => r.draw > 0).map((r) => r.tax);
      return { rows: out, taken, tax, kept: taken - tax, taxLow: paid.length ? Math.min(...paid) : 0, taxHigh: paid.length ? Math.max(...paid) : 0 };
    };
    const plans = { even: sum(draws.even), required: draws.required ? sum(draws.required) : null, last: sum(draws.last) };
    // a Roth IRA: nothing comes out year by year whatever the owner's age (a Roth owner has no required withdrawals in life)
    // an even share that is less than the year's required amount would be a missed withdrawal: not a way when they had begun
    const evenShort = !roth && !!draws.required && draws.even.some((r, i) => r.k < EMPTY_YEARS && r.draw < draws.required[i].draw - 1e-9);
    const offered = roth ? ["last", "even"] : past === "yes" ? (evenShort ? ["required"] : ["even", "required"]) : past === "no" ? ["even", "last"] : ["even", "required", "last"];
    return {
      id: x.id, kind: x.kind, from: x.from ?? "", amount: Number(x.amount), year, endYear: year + EMPTY_YEARS,
      heirId: heir?.id ?? null, heirName: heir?.name ?? "", heirAge, past: roth ? "no" : past, pastFrom: roth ? "typed" : pastFrom,
      close: heirBorn === null || born === null ? null : heirBorn - born <= 10,
      set: [x.pastRbd === "yes" || x.pastRbd === "no", born !== null, !!x.heirId && heirs.some((p) => p.id === x.heirId)].filter(Boolean).length,
      plans, evenShort, offered: offered.filter((k) => plans[k]),
    };
  });
  const income = (t) => ["wages", "otherOrdinary", "qualifiedIncome", "socialSecurity", "selfEmployment"].reduce((s, k) => s + Math.max(0, Number(t?.[k]) || 0), 0);
  const noIncome = !(income(now) > 0) && ![...later.values()].some((t) => income(t) > 0);
  return { noIncome, growth, taxYear: fed.year, filingStatus: fed.filingStatus, heirs: heirs.map((p) => ({ id: p.id, name: p.name ?? "" })), items };
}

const usd = (n) => `$${(Math.round(n / 10) * 10).toLocaleString("en-US")}`;
/**
 * The sentence for one inherited account, written out per case (docs/OPTIONAL.md R5); `money` formats a figure.
 * Cases: a Roth IRA; the person had begun required withdrawals ("yes"); had not ("no"); not known ("unsure"), and in the
 * first and last of those, the heir's age not known (the required amounts cannot be worked out).
 */
export function emptyingSentence(e, money = usd) {
  const p = e.plans;
  if (e.kind === "roth") return `A Roth IRA you inherit is not taxed when you take the money out, and nothing has to come out year by year. It must be empty by the end of ${e.endYear}. Left to grow until then, about ${money(p.last.taken)} would come out, with no tax.`;
  if (e.past === "yes" && p.required && e.evenShort) return `The person was already taking required withdrawals, so some has to come out every year, and all of it by the end of ${e.endYear}. At the age of the one who inherits, the yearly minimum is more than an even share, so it cannot be spread evenly: taking the yearly minimum would cost about ${money(p.required.tax)} of federal tax in all.`;
  if (e.past === "yes" && p.required) return `The person was already taking required withdrawals, so some has to come out every year, and all of it by the end of ${e.endYear}. Taking it out evenly would cost about ${money(p.even.tax)} of federal tax in all; taking only the yearly minimum and the rest in ${e.endYear}, about ${money(p.required.tax)}.`;
  if (e.past === "yes") return `The person was already taking required withdrawals, so some has to come out every year, and all of it by the end of ${e.endYear}. Taking it out evenly would cost about ${money(p.even.tax)} of federal tax in all. How much is required each year depends on your age: add your birth date on People to see it.`;
  if (e.past === "no") return `Nothing has to come out year by year, but all of it has to be out by the end of ${e.endYear}. Taking it out evenly would cost about ${money(p.even.tax)} of federal tax in all; leaving it all to ${e.endYear}, about ${money(p.last.tax)}.`;
  if (p.required) return `All of it has to be out by the end of ${e.endYear}. If the person was already taking required withdrawals, some has to come out every year too: the firm that holds the account can tell you. Taking it out evenly would cost about ${money(p.even.tax)} of federal tax in all.`;
  return `All of it has to be out by the end of ${e.endYear}. If the person was already taking required withdrawals, some has to come out every year too: the firm that holds the account can tell you, and with your birth date on People this page can show how much. Taking it out evenly would cost about ${money(p.even.tax)} of federal tax in all.`;
}
/** The line on who has other choices: the heir's own case when both birth years are known and they are close in age, else the list. */
export function eligibleNote(e) {
  if (e.close === true) return `By the birth years, ${e.heirName || "the one who inherits"} is not more than 10 years younger than the person who died. Someone that close in age, a spouse, a minor child, or someone disabled or chronically ill has other choices: they can spread the withdrawals over their lifetime instead, and a spouse can treat the account as their own.`;
  return "A spouse, a minor child, someone disabled or chronically ill, or someone not more than 10 years younger has other choices; a spouse can treat it as their own.";
}
const pct = (w) => `${Math.round((w.taken > 0 ? w.tax / w.taken : 0) * 100)}%`;
/**
 * One way's row: its name, the tax in all, one line under it, and (not known whether withdrawals had begun) when it applies.
 * The line gives the tax as a share of what comes out, never "what you keep": money left in longer has grown more, so the
 * totals of two ways are not the same money.
 */
export function wayWords(e, key, money = usd) {
  const w = e.plans[key], roth = e.kind === "roth", first = w.rows[0], final = w.rows.at(-1);
  if (key === "even") return { title: "Evenly over 10 years", value: roth ? "no tax" : `${money(w.tax)} tax`,
    when: !roth && e.past === "unsure" && e.evenShort ? "only if the person had not yet started taking money out" : "",
    detail: roth ? `about ${money(first.draw)} out in the first year, a little more each year after` : `about ${money(w.tax / EMPTY_YEARS)} of tax a year, ${pct(w)} of what comes out` };
  // an old heir: the yearly minimum empties it before the last year, so there is no "rest"
  const out = key === "required" && !(final.draw > 0) ? w.rows.filter((r) => r.draw > 0).at(-1) : null;
  if (out) return { title: "Only the yearly minimum", value: `${money(w.tax)} tax`, when: e.past === "unsure" ? "if the person had already started taking money out" : "",
    detail: `about ${money(first.draw)} out in the first year, all of it out by ${out.year}; ${pct(w)} of what comes out` };
  if (key === "required") return { title: `Only the yearly minimum, the rest in ${e.endYear}`, value: `${money(w.tax)} tax`,
    when: e.past === "unsure" ? "if the person had already started taking money out" : "",
    detail: `about ${money(first.draw)} out in the first year; ${money(final.tax)} of the tax falls in ${e.endYear}; ${pct(w)} of what comes out` };
  return { title: `All in ${e.endYear}`, value: roth ? "no tax" : `${money(w.tax)} tax`,
    when: !roth && e.past === "unsure" ? "only if the person had not yet started taking money out" : "",
    detail: roth ? `about ${money(w.taken)} after 10 years of growth` : `all of the tax in one year, ${pct(w)} of what comes out` };
}
/** The tax a shut row and the green line name: the first way the rule allows (evenly, or the yearly minimum when evenly is not allowed). */
export const mainWay = (e) => e.offered[0] ?? "even";
/** What an account's shut row says: "about $104,230 tax in all"; a Roth IRA "no tax"; no income to count it on top of: "needs your income". */
export const emptyingSays = (e, money = usd, noIncome = false) => (e.kind === "roth" ? "no tax" : noIncome ? "needs your income" : `about ${money(e.plans[mainWay(e)].tax)} tax in all`);
/** The green line after a save inside an account's part (R7): the word, then the new figure. */
export function emptyingSaved(e, word, money = usd) {
  if (e.kind === "roth") return word;
  const k = mainWay(e);
  return `${word} ${k === "required" ? "Taking the yearly minimum" : "Taking it out evenly"} would cost about ${money(e.plans[k].tax)} of federal tax in all.`;
}
/**
 * Why the page's own "after tax" figure for this account and the tax here do not add up: the answer takes the plan's flat
 * rate off in one go (`net`, `taxRate` from compute()); the ten years are taxed year by year through the brackets.
 */
export const bridgeSentence = (net, taxRate, money = usd) => `Above, this account counts as ${money(net)} after tax: your plan's usual tax rate (${Math.round(taxRate * 100)}%) taken off in one go. Here the tax is worked out year by year, on top of your other income, so the two do not match.`;
/** With no income entered the tax is counted on this money alone, which is too low: said first, with what to do. */
export const NO_INCOME = "Your income is not entered yet, so the tax here counts this money alone and comes out too low.";
/** Each account's row title: one account "Emptying it within 10 years"; several are named ("Emptying the IRA from Dad"), and numbered when two share a name. */
export function partTitles(items) {
  if (items.length === 1) return ["Emptying it within 10 years"];
  const names = items.map((e) => { const what = e.kind === "roth" ? "Roth IRA" : "IRA"; return e.from ? `Emptying the ${what} from ${e.from}` : `Emptying ${e.kind === "roth" ? "a" : "an"} ${what}`; });
  return names.map((n, i) => (names.indexOf(n) === i && names.lastIndexOf(n) === i ? n : `${n} (${names.slice(0, i + 1).filter((x) => x === n).length})`));
}

/**
 * The sentence under "If it comes", written out per case (docs/OPTIONAL.md R5): the money lasts only with it; lasts either
 * way; runs out either way.
 */
export function answerSentence(d, money = usd) {
  const w = d.withIt, b = d.base;
  if (w.success && !b.success) return `With it your money lasts to the end of the plan; without it, it runs out in ${b.failYear}. It would leave about ${money(w.endReal)} at the end (today's dollars).`;
  if (w.success) return `The plan would end with about ${money(w.endReal)} instead of ${money(b.endReal)} (today's dollars).`;
  return w.failYear > b.failYear ? `Even with it the money runs out, in ${w.failYear} instead of ${b.failYear}.` : `Even with it the money runs out in ${w.failYear}, as it does without it.`;
}
/** The green line after an add or a change, naming the new answer (R7); nothing to name: the bare word. */
export function savedLine(word, d, money = usd) {
  if (!d?.ready || !d.withIt) return word;
  return `${word} If it comes, you could spend about ${money(Math.max(0, d.extraMonthly))} a month more in retirement.`;
}
