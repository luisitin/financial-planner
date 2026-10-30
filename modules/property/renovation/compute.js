// modules/property/renovation/compute.js -- PURE. A home project against what it adds to the home's value,
// and four ways to pay for it: cash from savings (no interest, but the emergency fund shrinks), a home-equity
// line (deductible interest when the money improves the home), a cash-out refinance (the whole mortgage at a
// new rate, with closing costs) and a personal loan. The monthly payment, the interest and its tax saving,
// what is left of the cushion, and whether the equity is there to borrow against.
import { pmt } from "../../../core/math/finance.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeLiquidity } from "../../balance/liquidity/compute.js";
import { compute as computeFederal } from "../../taxes/federal/compute.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { planReturn } from "../../insurance/term-vs-permanent/compute.js";

/**
 * Share of the cost a project adds to the home's resale value: national averages from the 2024 Cost vs. Value report
 * (Zonda, Remodeling magazine), rounded to 5%. Local markets differ a lot; type your own when you have a quote or an agent's view.
 */
export const PROJECTS = {
  "garage-door": { label: "New garage door", recoup: 1.95 },
  "entry-door": { label: "New steel entry door", recoup: 1.90 },
  "stone-veneer": { label: "Stone veneer on the front", recoup: 1.55 },
  "minor-kitchen": { label: "Kitchen refresh (cabinets refaced, new counters and appliances)", recoup: 0.95 },
  "siding": { label: "New siding", recoup: 0.85 },
  "deck": { label: "Wood deck", recoup: 0.85 },
  "bath": { label: "Bathroom remodel", recoup: 0.75 },
  "windows": { label: "New windows", recoup: 0.65 },
  "major-kitchen": { label: "Full kitchen remodel", recoup: 0.50 },
  "addition": { label: "An addition (a new room or suite)", recoup: 0.25 },
  "other": { label: "Something else", recoup: 0.5 },
};
export const DEFAULTS = { project: "minor-kitchen", cost: 30000, recoup: null, helocRate: 0.08, helocYears: 10, refiRate: 0.065, refiYears: 30, refiCosts: 0.03, loanRate: 0.12, loanYears: 5, cltv: 0.85 };

/** A loan paid off at `payment` a month: its total interest, and its payments and interest in today's money at `discount` a year. */
export function schedule(principal, rate, payment, discount = 0, maxMonths = 600) {
  let b = principal, interest = 0, pv = 0, pvInterest = 0;
  for (let m = 0; m < maxMonths && b > 0.005; m++) {
    const i = b * rate / 12, p = Math.min(payment, b + i), f = Math.pow(1 + discount / 12, -(m + 1));
    interest += i; pv += p * f; pvInterest += i * f; b = b + i - p;
  }
  return { interest, pv, pvInterest };
}
/** A new loan of `principal` at `rate` over `years`: its payment and schedule. */
export function loanCost(principal, rate, years, discount = 0) {
  const payment = pmt(rate / 12, years * 12, principal);
  return { payment, ...schedule(principal, rate, payment, discount, years * 12) };
}

/**
 * compute(plan, { today }) -> {
 *   inputs, project: { id, label }, cost, recoup, valueAdded, equityChange, home: { value, mortgage, equity, borrowable } | null,
 *   ways: [{ id, label, monthly, interest (whole term), deductible, taxSaved, cost (interest + fees - tax saved), today (the extra cost in today's money at the plan's return), note, risk, fits }], discount,
 *   cushion: { now, after, months, monthsAfter, target } , best
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const s = plan.whatIfs?.renovation ?? {};
  const x = {};
  for (const [k, v] of Object.entries(DEFAULTS)) x[k] = s[k] === null || s[k] === undefined || s[k] === "" ? v : (typeof v === "number" || v === null) && k !== "project" ? Number(s[k]) : s[k];
  const project = PROJECTS[x.project] ? x.project : "other";
  const cost = Math.max(0, Number(x.cost) || 0);
  const recoup = x.recoup !== null && Number.isFinite(x.recoup) ? x.recoup : PROJECTS[project].recoup;
  const valueAdded = cost * recoup;

  // the home: the largest property account; its mortgage: the largest mortgage with a rate and payment
  const homes = (plan.accounts ?? []).filter((a) => a.type === "property").sort((a, b) => countedBalance(b) - countedBalance(a));
  const li = computeLiabilities(plan, { today });
  const mortgage = li.rows.filter((r) => r.type === "mortgage" && r.owed > 0).sort((a, b) => b.owed - a.owed)[0] ?? null;
  const home = homes.length ? (() => { const value = countedBalance(homes[0]), owed = mortgage?.owed ?? 0; return { name: homes[0].name, value, mortgage: owed, equity: value - owed, borrowable: Math.max(0, value * x.cltv - owed) }; })() : null;

  // the tax rate interest is deducted at, if the household itemizes (home interest on money used to improve the home is deductible)
  const fed = computeFederal(plan, { today });
  const itemizes = fed.result.deduction?.used === "itemized";
  const marginal = fed.marginal ?? 0.22;
  const ded = (interest) => (itemizes ? interest * marginal : 0);
  const discount = planReturn(plan);

  const ways = [];
  const liq = computeLiquidity(plan, { today });
  const monthlyNeed = liq.expenses?.essentialMonthly ?? liq.expenses?.monthly ?? null;
  const cushion = { now: liq.now ?? 0, after: (liq.now ?? 0) - cost, months: liq.runwayMonths ?? null, monthsAfter: monthlyNeed > 0 ? ((liq.now ?? 0) - cost) / monthlyNeed : null, target: liq.target ?? null };
  ways.push({ id: "cash", label: "Pay cash from savings", monthly: 0, interest: 0, fees: 0, deductible: false, taxSaved: 0, today: 0, note: "no interest and nothing owed", risk: cushion.after < 0 ? "There is not this much cash." : cushion.target && cushion.after < cushion.target ? "It leaves less usable cash than your emergency target." : null, fits: cushion.after >= 0 });
  if (home) {
    const h = loanCost(cost, x.helocRate, x.helocYears, discount);
    ways.push({ id: "heloc", label: "Home-equity line", monthly: h.payment, interest: h.interest, fees: 0, deductible: true, taxSaved: ded(h.interest), today: h.pv - cost - ded(h.pvInterest), note: `${(x.helocRate * 100).toFixed(2).replace(/\.?0+$/, "")}% repaid over ${x.helocYears} years; the rate usually floats`, risk: "The home secures it.", fits: home.borrowable >= cost });
    if (mortgage && mortgage.payment > 0) {
      // a cash-out refinance: the old mortgage and the project in one new loan; compare against keeping the old mortgage and paying cash
      const fees = (mortgage.owed + cost) * x.refiCosts;
      const newLoan = loanCost(mortgage.owed + cost + fees, x.refiRate, x.refiYears, discount);
      const old = schedule(mortgage.owed, mortgage.rate ?? 0, mortgage.payment, discount);
      const extraInterest = newLoan.interest - old.interest;
      ways.push({ id: "refi", label: "Cash-out refinance", monthly: newLoan.payment - mortgage.payment, interest: extraInterest, fees, deductible: true, taxSaved: ded(Math.max(0, extraInterest)), today: newLoan.pv - old.pv - cost - ded(Math.max(0, newLoan.pvInterest - old.pvInterest)), note: `the whole mortgage at ${(x.refiRate * 100).toFixed(2).replace(/\.?0+$/, "")}% for ${x.refiYears} years, with ${Math.round(x.refiCosts * 100)}% closing costs; the payment shown is the change`, risk: (mortgage.rate ?? 0) < x.refiRate ? `It gives up your ${((mortgage.rate ?? 0) * 100).toFixed(2).replace(/\.?0+$/, "")}% rate on the whole mortgage.` : null, fits: home.borrowable >= cost });
    }
  }
  const pl = loanCost(cost, x.loanRate, x.loanYears, discount);
  ways.push({ id: "loan", label: "Personal loan", monthly: pl.payment, interest: pl.interest, fees: 0, deductible: false, taxSaved: 0, today: pl.pv - cost, note: `${(x.loanRate * 100).toFixed(1).replace(/\.0$/, "")}% over ${x.loanYears} years; nothing secured`, risk: null, fits: true });
  for (const w of ways) w.cost = w.interest + w.fees - w.taxSaved;
  // ranked in today's money: a payment years from now costs less than one now, since the money could earn the plan's return meanwhile
  const best = ways.filter((w) => w.fits).reduce((a, w) => (w.today < a.today - 1 ? w : a), ways.find((w) => w.fits) ?? ways[0]);
  return {
    inputs: x, project: { id: project, label: PROJECTS[project].label }, cost, recoup, valueAdded, equityChange: valueAdded - cost,
    home, mortgage: mortgage ? { name: mortgage.name, owed: mortgage.owed, rate: mortgage.rate, payment: mortgage.payment } : null,
    itemizes, marginal, discount, ways, cushion, best: best?.id ?? null,
  };
}
