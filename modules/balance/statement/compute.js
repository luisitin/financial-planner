// modules/balance/statement/compute.js -- PURE. A formal balance sheet: what you own, sorted by how fast it
// turns into cash (today; in a few days; with tax or a penalty to take out early; months to sell), each with
// what it would bring if cashed in today; what you owe, split into what falls due within a year and later;
// every line by owner; and the ratios a lender or planner reads from it.
import { ACCOUNT_TYPES, countedBalance, isLiability } from "../net-worth/compute.js";
import { compute as computeLiabilities } from "../liabilities/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeFederal } from "../../taxes/federal/compute.js";
import { compute as computeState } from "../../taxes/state/compute.js";

/** How fast each kind of account turns into cash, most liquid first. */
export const TIERS = [
  { id: "now", label: "Cash you can use today", types: ["checking", "savings", "cash"] },
  { id: "days", label: "Investments you can sell in a few days", types: ["brokerage", "crypto"] },
  { id: "later", label: "Saved for later: tax or a penalty to take out early", types: ["401k", "ira", "roth", "hsa", "529", "cash_value_life"] },
  { id: "months", label: "Home, cars and things: months to sell", types: null },
];
/** Cash-in assumptions: pre-tax accounts pay income tax and, before 59½, a 10% penalty (IRS Publication 590-B); selling a home costs about 6% (agent and closing). */
export const PENALTY = 0.10, SELL_HOME = 0.06;
export const DUE_NOW = ["credit"];

/** Principal paid off in the next `months` payments: balance minus the balance after them (no payment: none). */
export function principalWithin(balance, rate, payment, months = 12) {
  if (!(payment > 0)) return 0;
  let b = balance;
  for (let m = 0; m < months && b > 0.005; m++) b = Math.max(0, b * (1 + (rate ?? 0) / 12) - payment);
  return Math.max(0, Math.min(balance, balance - b));
}

/**
 * compute(plan, { today }) -> {
 *   ready, today, owners: [names, "Joint" last],
 *   tiers: [{ id, label, accounts: [{ id, name, type, typeLabel, owner, value, cashIn, note }], total, cashIn }],
 *   assets, cashIn (all assets as cashed in today), taxRate (on pre-tax money),
 *   debts: [{ id, name, typeLabel, owner, owed, dueSoon, dueLater }], liabilities, dueSoon, dueLater,
 *   netWorth, netWorthCashed (cashIn - liabilities),
 *   byOwner: [{ name, assets, liabilities, netWorth }],
 *   ratios: { monthsOfCash, quick, debtToAssets, investedShare, monthlySpending }
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const accounts = plan.accounts ?? [];
  if (!accounts.length) return { ready: false };
  const people = plan.household?.people ?? [];
  const ownerOf = (a) => people.find((p) => p.id === a.ownerId) ?? null;
  const self = people.find((p) => p.role === "self") ?? people.find((p) => p.role !== "dependent") ?? null;
  const t = String(today ?? "2026-01-01");
  // age in whole months today; 59½ is 714 months
  const months = (b) => (Number(t.slice(0, 4)) - Number(b.slice(0, 4))) * 12 + Number(t.slice(5, 7)) - Number(b.slice(5, 7)) - (t.slice(8, 10) < b.slice(8, 10) ? 1 : 0);
  const under59half = (p) => !p?.birthDate || months(p.birthDate) < 714;
  // the tax on pre-tax money taken out now: the federal top rate plus the state's share
  const fed = computeFederal(plan, { today });
  const st = computeState(plan, { today });
  const taxRate = (fed.marginal ?? 0.22) + (st.effective ?? 0);
  const label = (t) => (ACCOUNT_TYPES[t] ?? ACCOUNT_TYPES.other_asset).label;
  const known = new Set(TIERS.flatMap((t) => t.types ?? []));
  const tiers = TIERS.map((tier) => {
    const list = accounts.filter((a) => !isLiability(a.type) && (tier.types ? tier.types.includes(a.type) : !known.has(a.type))).map((a) => {
      const value = countedBalance(a), owner = ownerOf(a);
      let cashIn = value, note = null;
      if (["401k", "ira"].includes(a.type)) {
        const early = under59half(owner ?? self);
        cashIn = value * (1 - taxRate - (early ? PENALTY : 0));
        note = `less ${Math.round(taxRate * 100)}% tax${early ? " and the 10% penalty before 59½" : ""}`;
      } else if (a.type === "property") { cashIn = value * (1 - SELL_HOME); note = "less about 6% to sell"; }
      else if (a.type === "brokerage" || a.type === "crypto") note = "before any tax on gains";
      else if (a.type === "roth") note = "what you put in comes out free; growth may carry tax and a penalty";
      else if (a.type === "hsa") note = "free for medical bills";
      else if (a.type === "529") note = "free for school costs";
      return { id: a.id, name: a.name, type: a.type, typeLabel: label(a.type), owner: owner?.name ?? "Joint", value, cashIn, note };
    }).sort((x, y) => y.value - x.value);
    return { id: tier.id, label: tier.label, accounts: list, total: list.reduce((s, x) => s + x.value, 0), cashIn: list.reduce((s, x) => s + x.cashIn, 0) };
  });
  const li = computeLiabilities(plan, { today });
  const rowOf = Object.fromEntries(li.rows.map((r) => [r.id, r]));
  const debts = accounts.filter((a) => isLiability(a.type) && countedBalance(a) > 0).map((a) => {
    const owed = countedBalance(a), r = rowOf[a.id];
    const dueSoon = DUE_NOW.includes(a.type) ? owed : principalWithin(owed, r?.rate, r?.payment);
    return { id: a.id, name: a.name, type: a.type, typeLabel: label(a.type), owner: ownerOf(a)?.name ?? "Joint", owed, dueSoon, dueLater: owed - dueSoon };
  }).sort((x, y) => y.owed - x.owed);
  const assets = tiers.reduce((s, t) => s + t.total, 0), cashIn = tiers.reduce((s, t) => s + t.cashIn, 0);
  const liabilities = debts.reduce((s, d) => s + d.owed, 0), dueSoon = debts.reduce((s, d) => s + d.dueSoon, 0);
  const names = [...new Set([...tiers.flatMap((t) => t.accounts.map((a) => a.owner)), ...debts.map((d) => d.owner)])];
  const owners = [...names.filter((n) => n !== "Joint"), ...(names.includes("Joint") ? ["Joint"] : [])];
  const byOwner = owners.map((name) => { const own = tiers.flatMap((t) => t.accounts).filter((a) => a.owner === name).reduce((s, a) => s + a.value, 0), owe = debts.filter((d) => d.owner === name).reduce((s, d) => s + d.owed, 0); return { name, assets: own, liabilities: owe, netWorth: own - owe }; });
  const tier = (id) => tiers.find((t) => t.id === id);
  const ex = (plan.expenses ?? []).length ? computeExpenses(plan, { today }) : null;
  const monthlySpending = ex?.monthly > 0 ? ex.monthly : null;
  const netWorth = assets - liabilities;
  const invested = accounts.filter((a) => !isLiability(a.type) && (ACCOUNT_TYPES[a.type]?.invested)).reduce((s, a) => s + countedBalance(a), 0);
  return {
    ready: true, today, owners, tiers: tiers.filter((t) => t.accounts.length), assets, cashIn, taxRate,
    debts, liabilities, dueSoon, dueLater: liabilities - dueSoon, netWorth, netWorthCashed: cashIn - liabilities, byOwner,
    ratios: {
      monthlySpending,
      monthsOfCash: monthlySpending ? tier("now").total / monthlySpending : null,
      quick: dueSoon > 0 ? (tier("now").total + tier("days").total) / dueSoon : null,
      debtToAssets: assets > 0 ? liabilities / assets : null,
      investedShare: netWorth > 0 ? invested / netWorth : null,
    },
  };
}
