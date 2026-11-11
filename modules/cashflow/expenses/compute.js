// modules/cashflow/expenses/compute.js -- PURE. Regular spending on a monthly footing, split
// into what you must pay and what is nice to have, grouped by category, and compared with
// income. Liquidity, budget, forecast and retirement pages read these totals.
import { perMonth, perYear, activeOn, periodLabel } from "../../../core/math/periods.js";
import { compute as computeIncome } from "../income/compute.js";
import { money } from "../../../core/format.js";
import { roundShares } from "../../../core/math/shares.js";
import { compute as computeDebts } from "../../balance/liabilities/compute.js";
import { isGuess, clearGuess } from "../../../core/estimate/index.js";

// essential: the default for "I must pay this" when a category is picked in the form.
export const CATEGORIES = {
  housing:        { label: "Rent or mortgage",        icon: "🏠", essential: true },
  utilities:      { label: "Utilities",               icon: "💡", essential: true },
  groceries:      { label: "Groceries",               icon: "🛒", essential: true },
  transport:      { label: "Car, gas, transit",       icon: "🚗", essential: true },
  insurance:      { label: "Insurance",               icon: "🛡️", essential: true },
  health:         { label: "Health and medical",      icon: "🩺", essential: true },
  debt:           { label: "Loan and card payments",  icon: "💳", essential: true },
  childcare:      { label: "Childcare and school",    icon: "🧒", essential: true },
  phone:          { label: "Phone and internet",      icon: "📱", essential: true },
  taxes:          { label: "Taxes not withheld",      icon: "🧾", essential: true },
  subscriptions:  { label: "Subscriptions",           icon: "📺", essential: false },
  dining:         { label: "Eating out",              icon: "🍽️", essential: false },
  fun:            { label: "Fun and hobbies",         icon: "🎉", essential: false },
  shopping:       { label: "Shopping and clothes",    icon: "🛍️", essential: false },
  travel:         { label: "Travel",                  icon: "✈️", essential: false },
  giving:         { label: "Gifts and giving",        icon: "🎁", essential: false },
  personal:       { label: "Personal care",           icon: "💇", essential: false },
  pets:           { label: "Pets",                    icon: "🐾", essential: false },
  other:          { label: "Other",                   icon: "📦", essential: false },
};

/**
 * What each of Get started's spending rows (`setup-x-<row>`) holds, by Expenses category: its own categories (setup's SPEND
 * `covers`, which decide what question 6 asks) plus what the survey puts inside the row (spec 7.A E07, E08: entertainment,
 * which holds streaming and other subscriptions and pets, is in "Eating out and fun"; personal care is in "Shopping and
 * everything else"). A bill typed under one of them comes off that row's guess (overview/guesses spend.js), and the bank
 * card compares the row with all of them at once (income-statement bankVsPlan). Gifts, travel and "other" are in no row.
 */
export const ROW_HOLDS = { housing: ["housing"], utilities: ["utilities", "phone"], groceries: ["groceries"], transport: ["transport"], insurance: ["insurance", "health"], childcare: ["childcare"], dining: ["dining", "fun", "subscriptions", "pets"], shopping: ["shopping", "personal"] };
/** The spread (ledger `s`) the spending guesses give a row read from the person's own bank files (overview/guesses R12, C7):
 *  such a row is their own months, so it does not count as our guess in `guessedMonthly` (a verdict waits on our guesses,
 *  not on the bank's figures). */
export const BANK_SPREAD = 0.15;
/**
 * mortgageLines(lines, months, pay) -> Set of the bank lines (t) that are a mortgage's own payment (C7 review M2), with a mortgage
 * on Debts paying `pay` a month: a housing line named so ("mortgage", "mtg") or within 10% of the payment, as a typed bill is
 * read below; and, of the payees seen in every month looked at (each month's total from it within 10% of the others), the
 * largest when it is at least half the payment: a servicer's own name ("MR COOPER", "PENNYMAC LOAN SVC"), often with the home's
 * tax and insurance on top. lines: [{ t, ym, out }] (housing money out, a positive amount, over `months`). The bank's spending
 * rows (overview/guesses R12) and the bank card (income-statement bankVsPlan) both ask this.
 */
export function mortgageLines(lines, months, pay) {
  const out = new Set();
  if (!(pay > 0)) return out;
  for (const l of lines) if (/mortgage|\bmtg\b/i.test(`${l.t?.payee ?? ""} ${l.t?.rawPayee ?? ""}`) || Math.abs(l.out - pay) <= pay * 0.1) out.add(l.t);
  const key = (t) => String(t?.rawPayee || t?.payee || "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
  const by = new Map();
  for (const l of lines) { const k = key(l.t); if (!k) continue; const m = by.get(k) ?? by.set(k, new Map()).get(k); m.set(l.ym, (m.get(l.ym) ?? 0) + l.out); }
  let best = null;
  for (const [k, m] of by) {
    if (!months.length || !months.every((ym) => m.has(ym))) continue;
    const v = months.map((ym) => m.get(ym)), hi = Math.max(...v), lo = Math.min(...v), avg = v.reduce((t, x) => t + x, 0) / v.length;
    if (hi - lo <= 0.1 * hi && avg >= 0.5 * pay && (!best || avg > best.avg)) best = { k, avg };
  }
  if (best) for (const l of lines) if (key(l.t) === best.k) out.add(l.t);
  return out;
}
/**
 * Get started's housing row when it is a share of a month the person gave as one figure (the best-guess box, or a left-over worked
 * into spending): it carries no guess mark but it is not a typed payment either, and it is the home's costs besides the mortgage
 * whatever its amount (a share near the mortgage's payment was taken for the mortgage and dropped it from the month).
 */
export const sharedHousingRow = (plan, x) => {
  const ss = plan?.guide?.setup?.spendSum;
  return x?.id === "setup-x-housing" && !!ss && !(Array.isArray(ss.typed) && ss.typed.includes("housing"));
};
/** A bill is one of Get started's spending rows whose amount is still our guess (only a plan whose ledger holds its path). */
export const guessedSetupRow = (plan, x) => typeof x?.id === "string" && x.id.startsWith("setup-x-") && !!plan?.guesses && typeof plan.guesses === "object"
  && Object.prototype.hasOwnProperty.call(plan.guesses, `expenses[${x.id}].amount`) && isGuess(plan, `expenses[${x.id}].amount`);

/**
 * Does the bill list open on its own? (path part 3, review UX 1.) Short lists (5 or fewer) stay open. A longer one opens
 * only when the person listed at least half the bills themselves, counted by bills, not dollars. Rows Get started spread
 * from one total or a split (ids "setup-x-...") and rows that are our guesses are not bills the person listed here.
 */
export function billsFoldOpen(plan, items) {
  const rows = items ?? [];
  if (rows.length <= 5) return true;
  const own = rows.filter((x) => !(typeof x.id === "string" && (x.id.startsWith("setup-x-") || isGuess(plan, `expenses[${x.id}].amount`)))).length;
  return own * 2 >= rows.length;
}

/**
 * compute(plan, { today }) -> {
 *   items: [{ ...expense, categoryLabel, icon, periodLabel, monthly, yearly, active, upcoming, ended, essential, inflates }],
 *   active, count, monthly, yearly, essentialMonthly, optionalMonthly, inflatingMonthly,
 *   byCategory: [{ category, label, icon, monthly, share }] (active, largest first),
 *   income: { monthly, yearly } | null, leftOver (income monthly - expenses monthly) | null, savingsRate | null,
 *   warnings: [text],
 *   debtsCounted: [{ id (the Debts row's account id), monthly (what the month carries for it) }] (the Debts payments in `monthly`),
 *   guessedMonthly, guessedShare, guessedEssential, guessedEssentialShare, guessedCount (only when the plan holds guesses and
 *   some of the month is ours: the bills and debt payments Get started guessed, a month, and their share of the month and of
 *   the must-pay part; spec 8.1)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const items = (plan.expenses ?? []).map((x) => {
    const c = CATEGORIES[x.category] ?? CATEGORIES.other;
    return {
      ...x, categoryLabel: c.label, icon: c.icon, periodLabel: periodLabel(x.period),
      monthly: perMonth(x.amount, x.period), yearly: perYear(x.amount, x.period),
      active: today ? activeOn(x, today) : true,
      upcoming: !!(today && x.startDate && String(x.startDate) > today),
      ended: !!(today && x.endDate && String(x.endDate) < today),
      essential: x.essential ?? c.essential,
      inflates: x.inflates !== false,
      oneTime: x.period === "once" ? Number(x.amount) || 0 : 0,
    };
  });
  const active = items.filter((x) => x.active);
  const sum = (arr, k) => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  // F-019: required debt payments live on the Debts page. Each debt is matched to its own expense here (round 4,
  // 2026-11-02): one whose payment is not listed is counted as a line of its own, so listing the car payment no longer
  // drops the card's. Before, any expense under "Loan and card payments" stopped every Debts payment from counting.
  const debts = (plan.debts ?? []).length ? computeDebts(plan, params) : null;
  // A mortgage's payment is often filed here under housing ("Mortgage payment"), not under loan payments. When a
  // housing expense is that payment (its name says mortgage, or it is within 10% of the mortgage's payment), the
  // mortgage is not added again from Debts. Set up my plan files "Home costs" besides the mortgage under housing, so
  // there the mortgage still comes from Debts. The check below accepts either way of filing it.
  const mortgagePay = debts ? (debts.rows ?? []).filter((r) => r.type === "mortgage").reduce((s, r) => s + (Number(r.payment) || 0), 0) : 0;
  // (Get started's housing row while it is our guess is never the mortgage's payment: it is the home's other costs, worked
  // out by our guesses, whatever its name or amount; C3 review D1. Nor is it once it is a figure worked out from a left-over, which
  // carries no guess mark: Get started's housing row is always the home's costs besides the mortgage, whatever its amount)
  const isMortgageBill = (x) => x.category === "housing" && !guessedSetupRow(plan, x)  && !sharedHousingRow(plan, x) && (/mortgage/i.test(x.name ?? "") || Math.abs(x.monthly - mortgagePay) <= mortgagePay * 0.1);
  const mortgageFiled = mortgagePay > 0 && active.some(isMortgageBill);
  const allDebtPayments = debts ? debts.payments : 0;
  const debtPayments = allDebtPayments - (mortgageFiled ? mortgagePay : 0);
  const filedDebt = sum(active.filter((x) => x.category === "debt"), "monthly");
  const rows = (debts?.rows ?? []).filter((r) => (Number(r.payment) || 0) > 0 && !(mortgageFiled && r.type === "mortgage"));
  // a paid-off debt's payment still listed here is matched first (by name, or its typed payment), so it is said to have
  // ended and never stands in for another debt's missing payment
  const paidRows = (debts?.rows ?? []).filter((r) => r.paidOff && r.typedPayment > 0).map((r) => ({ ...r, payment: r.typedPayment, minPayment: r.typedPayment }));
  const debtItems = active.filter((x) => x.category === "debt");
  const pm = paidRows.length ? matchDebts(debtItems, paidRows) : { matched: new Map() };
  const endedIds = new Set([...pm.matched.values()].map((e) => e.id));
  const ended = [...pm.matched].map(([id, e]) => ({ debtId: id, debtName: paidRows.find((r) => r.id === id)?.name ?? "", id: e.id, name: e.name, monthly: e.monthly }));
  const m = matchDebts(debtItems.filter((x) => !endedIds.has(x.id)), rows);
  // the Debts rows the month carries and how much of each (round 8 batch 6 review, money 1 and 2: the retirement plan gives a
  // rental's loan payment back once the loan is paid off only when the spending carries it, and only what it carries): a row
  // matched to a bill at the bill's amount; any other row with a payment at that payment (added from Debts, or covered by a
  // filed line that matches no debt). The mortgages, when a housing bill is the mortgage, only when those bills add up to all
  // of them (within 10%): a bill for one of two mortgages drops both from Debts, and which one it is cannot be told
  const filedMortgages = mortgageFiled ? sum(active.filter(isMortgageBill), "monthly") : 0;
  const mortgagesInBill = mortgageFiled && Math.abs(filedMortgages - mortgagePay) <= mortgagePay * 0.1;
  // one mortgage and a bill for it that is more than 10% off its payment (an amount out of date, or the person's own cut): that bill is
  // still that loan's, at the bill's amount (at most the payment), so the retirement plan ends it at the payoff; it was spent for
  // life, and $100 a week less on the bill ran out a year sooner (loans lane fix round 2, 2026-11-11, qa H-0329)
  const mortgageRows = (debts?.rows ?? []).filter((r) => r.type === "mortgage" && (Number(r.payment) || 0) > 0);
  const oneMortgageBill = mortgageFiled && !mortgagesInBill && mortgageRows.length === 1 ? Math.min(filedMortgages, Number(mortgageRows[0].payment)) : 0;
  const debtsCounted = [
    ...mortgageRows.filter(() => mortgagesInBill).map((r) => ({ id: r.id, monthly: Number(r.payment) })),
    ...(oneMortgageBill > 0.005 ? [{ id: mortgageRows[0].id, monthly: oneMortgageBill }] : []),
    ...rows.map((r) => ({ id: r.id, monthly: m.matched.get(r.id)?.monthly ?? r.payment })),
  ];
  // what is filed but matches no debt (one line for all of them, or an amount out of date) covers the unmatched debts up to its amount
  const unmatchedRows = rows.filter((r) => !m.matched.has(r.id));
  const missingTotal = unmatchedRows.reduce((t, r) => t + r.payment, 0);
  const debtFromDebts = Math.max(0, missingTotal - m.spare);
  const fromDebts = debtFromDebts > 0.005 && m.spare <= 0.005 ? unmatchedRows.map((r) => ({ id: r.id, name: r.name, monthly: r.payment, required: Math.min(r.payment, Number(r.minPayment) || r.payment) })) : [];
  // the required part of a missing payment is a must-pay; an extra set on Debts is not
  const debtRequired = fromDebts.length ? fromDebts.reduce((t, x) => t + x.required, 0) : Math.min(debtFromDebts, unmatchedRows.reduce((t, r) => t + Math.min(r.payment, Number(r.minPayment) || r.payment), 0));
  const monthly = sum(active, "monthly") + debtFromDebts;
  const cat = new Map();
  for (const x of active) { const k = CATEGORIES[x.category] ? x.category : "other"; const e = cat.get(k) ?? { category: k, label: CATEGORIES[k].label, icon: CATEGORIES[k].icon, monthly: 0 }; e.monthly += x.monthly; cat.set(k, e); }
  if (debtFromDebts) { const had = cat.get("debt"); cat.set("debt", { category: "debt", label: had ? "Loan and card payments (some from Debts)" : "Loan and card payments (from Debts)", icon: CATEGORIES.debt.icon, monthly: (had?.monthly ?? 0) + debtFromDebts, virtual: true }); }
  const byCategory = [...cat.values()].filter((c) => c.monthly > 0).map((c) => ({ ...c, share: monthly ? c.monthly / monthly : 0 })).sort((a, b) => b.monthly - a.monthly);
  const percents = roundShares(byCategory.map((c) => c.monthly));   // F-009: whole percentages that add up to 100
  byCategory.forEach((c, i) => { c.percent = percents[i]; });
  const inc = (plan.income ?? []).length ? computeIncome(plan, params) : null;
  const income = inc ? { monthly: inc.monthly, yearly: inc.yearly, nextYear: inc.nextYear } : null;
  const leftOver = income ? income.monthly - monthly : null;
  const inflation = Number(plan.assumptions?.inflation ?? 0.03);
  const inflatingMonthly = sum(active.filter((x) => x.inflates), "monthly");
  const yearly = sum(active, "yearly") + debtFromDebts * 12;
  const nextYear = inflatingMonthly * 12 * (1 + inflation) + (yearly - inflatingMonthly * 12);   // F-018: next year's spending after inflation
  const leftOverNextYear = income ? income.nextYear - nextYear : null;
  const warnings = [];
  // the filed loan payments against the Debts payments they stand for (the ones not added above): far apart, one is out of date
  const covered = debtPayments - debtFromDebts;
  const off = (want) => want <= 0 || Math.abs(filedDebt - want) / want > 0.1;
  if (covered > 0 && filedDebt > 0 && off(covered)) warnings.push(`Loan and card payments here add up to ${money(filedDebt, plan.meta?.currency ?? "USD")} a month; the Debts page has ${money(covered, plan.meta?.currency ?? "USD")}${mortgageFiled ? " (not counting the mortgage, which is under housing)" : ""}${debtFromDebts ? ` for the same debts (${money(debtFromDebts, plan.meta?.currency ?? "USD")} more is counted from Debts)` : ""}. ${filedDebt < covered ? "A payment may be missing here" : "One may be out of date"}: check both.`);
  for (const x of items) {
    // (a row of ours at $0 is our guess giving way to a bill typed in its place, not an amount the person forgot; C3 review D6)
    if (!(Number(x.amount) > 0) && !guessedSetupRow(plan, x)) warnings.push(`${x.name || "An expense"} has no amount.`);
    if (x.startDate && x.endDate && String(x.endDate) < String(x.startDate)) warnings.push(`${x.name || "An expense"} ends before it starts.`);
  }
  // pay before tax minus spending: a view that can work out the after-tax figure (Next best action) shows that instead
  const overspend = leftOver !== null && leftOver < 0 ? `You spend ${money(-leftOver, plan.meta?.currency ?? "USD")} more each month than comes in. Check the amounts, or this is the first thing the plan should fix.` : null;
  if (overspend) warnings.push(overspend);
  // how much of the month is our guesses (core/estimate: a bill Get started guessed, and a debt payment it guessed counted
  // from Debts), so a verdict resting mostly on them can wait (spec 8.1). Only for a plan that holds guesses: every other
  // plan computes exactly as before.
  const led = !!plan.guesses && typeof plan.guesses === "object" && !Array.isArray(plan.guesses) && Object.keys(plan.guesses).length > 0;
  let guessedKeys = {};
  if (led) {
    // isGuess walks the plan (and the older flags), which settle would otherwise do for every bill on every update, so
    // only a path that can be a guess is looked at: a bill only through the ledger (no older flag covers expenses), a
    // debt payment through the ledger or its older `paymentGuessed` flag
    const inLedger = (path) => Object.prototype.hasOwnProperty.call(plan.guesses, path);
    // (a row our guesses read from the bank files is the person's own months: not counted here; C7)
    const g = active.filter((x) => typeof x.id === "string" && inLedger(`expenses[${x.id}].amount`) && plan.guesses[`expenses[${x.id}].amount`]?.s !== BANK_SPREAD && isGuess(plan, `expenses[${x.id}].amount`));
    const gDebts = fromDebts.filter((f) => { const d = rows.find((r) => r.id === f.id)?.detail; return typeof d?.id === "string" && (inLedger(`debts[${d.id}].minPayment`) || typeof d.paymentGuessed === "number") && isGuess(plan, `debts[${d.id}].minPayment`); });
    const guessedMonthly = sum(g, "monthly") + gDebts.reduce((t, x) => t + x.monthly, 0);
    const guessedEssential = sum(g.filter((x) => x.essential), "monthly") + gDebts.reduce((t, x) => t + x.required, 0);
    const essentialAll = sum(active.filter((x) => x.essential), "monthly") + debtRequired;
    if (guessedMonthly > 0) guessedKeys = { guessedMonthly, guessedShare: monthly > 0 ? guessedMonthly / monthly : 0, guessedEssential, guessedEssentialShare: essentialAll > 0 ? guessedEssential / essentialAll : 0, guessedCount: g.length + gDebts.length };
  }
  return {
    ...guessedKeys,
    items, active, count: items.length, monthly, yearly,
    essentialMonthly: sum(active.filter((x) => x.essential), "monthly") + debtRequired,
    // an extra paid on a debt kept on Debts alone could be cut in a pinch: it is a nice-to-have, so the two add up to the total
    optionalMonthly: sum(active.filter((x) => !x.essential), "monthly") + (debtFromDebts - debtRequired),
    inflatingMonthly, nextYear, leftOverNextYear,
    debtPayments, debtFromDebts, debtRequired, fromDebts, ended, debtsCounted, debtMatches: Object.fromEntries([...m.matched].map(([id, e]) => [id, e.id])),
    oneTime: sum(active, "oneTime"),
    byCategory, income, leftOver, savingsRate: income && income.monthly > 0 ? leftOver / income.monthly : null,
    warnings, overspend,
  };
}

/**
 * The bank card's "Add" (income-statement bankVsPlan's `lines`), written into the draft: a line for one of Get started's rows
 * that is our guess (`line.ours`) makes the plan list what the bank shows for everything the row holds, less what is typed
 * beside it, and the figures are the person's from then on (their own bank, not ours: the guess goes). The bank card compares
 * a row of the person's kind by kind, so each kind is written on its own: the row keeps its own kind (`parts`), and each other
 * kind it held that the bank shows gets a bill of its own, named as the kind ("Phone and internet" beside "Utilities"; the row
 * then takes its kind's name, so no line reads as the phone twice). A row with nothing of its own kind gives way to those
 * bills. Any other line adds a bill of the rest the bank shows, as before.
 * -> { name, amount, row: true | false, also: [{ name, amount }] } (the notice's words), or null when nothing changed.
 */
export function addFromBank(draft, line, newId) {
  draft.expenses = draft.expenses ?? [];
  const ten = (v) => Math.round(v / 10) * 10;
  if (line?.ours) {
    const x = draft.expenses.find((e) => e.id === line.ours.id);
    if (!x) return null;
    const parts = line.ours.parts ?? { [x.category]: line.ours.to };
    const own = ten(parts[x.category] ?? 0);
    const also = Object.entries(parts).filter(([c, v]) => c !== x.category && CATEGORIES[c] && ten(v) >= 10)
      .map(([c, v], i) => ({ id: i ? `${newId}-${i}` : newId, name: CATEGORIES[c].label, category: c, amount: ten(v), period: "monthly", essential: CATEGORIES[c].essential, inflates: true }));
    clearGuess(draft, `expenses[${x.id}].amount`);
    const keep = own >= 10 || !also.length;
    if (keep) { x.amount = own; x.period = "monthly"; if (also.length && CATEGORIES[x.category]) x.name = CATEGORIES[x.category].label; }
    else draft.expenses = draft.expenses.filter((e) => e.id !== x.id);
    draft.expenses.push(...also);
    return { name: x.name, amount: keep ? own : 0, row: keep, also: also.map((b) => ({ name: b.name, amount: b.amount })) };
  }
  const name = line.plan > 0.5 ? `${line.label}: the rest the bank shows` : line.label;
  draft.expenses.push({ id: newId, name, category: line.category, amount: ten(line.more), period: "monthly", essential: line.essential, inflates: true });
  return { name, amount: ten(line.more), row: false, also: [] };
}
/** The notice for addFromBank's answer, in plain words with the plan's currency ("Groceries is now $1,020 a month, from your bank."). */
export function fromBankWords(said, cur = "USD") {
  const m = (v) => money(v, cur);
  if (!said.also?.length) return said.row ? `${said.name} is now ${m(said.amount)} a month, from your bank.` : `Added ${said.name}: ${m(said.amount)} a month.`;
  const list = [...(said.row ? [`${said.name} ${m(said.amount)}`] : []), ...said.also.map((b) => `${b.name} ${m(b.amount)}`)];
  return `From your bank: ${list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0]} a month.`;
}

/**
 * matchDebts(debtExpenses, debts) -> { matched: Map(debt id -> expense), spare (a month: filed loan payments that match no debt,
 *   and the part of a matched one more than 10% over its debt's payment, which pays other debts too) }
 * Which expense under "Loan and card payments" is which debt's payment: first by name (the expense names a word of the
 * debt's, "Visa payment" for "Visa card"; words every loan shares do not count), then by amount (within 10% of the payment
 * or the required minimum, the closest pairs first). Each expense pays one debt at most.
 */
const SHARED_WORDS = new Set(["loan", "loans", "card", "cards", "credit", "payment", "payments", "the", "and", "for", "debt", "monthly", "bill"]);
const words = (t) => String(t ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !SHARED_WORDS.has(w));
export function matchDebts(debtExpenses, debts) {
  const matched = new Map(), used = new Set();
  const free = (x) => !used.has(x.id);
  for (const d of debts) {
    const dw = words(d.name);
    const e = dw.length ? debtExpenses.find((x) => free(x) && words(x.name).some((w) => dw.includes(w))) : null;
    if (e) { used.add(e.id); matched.set(d.id, e); }
  }
  // by amount: the closest pairs first, so a $410 car payment goes to the $410 loan, not to a $400 card it is also near
  const pairs = [];
  for (const d of debts) {
    if (matched.has(d.id)) continue;
    for (const x of debtExpenses.filter(free)) {
      const off = Math.min(...[d.payment, d.minPayment].filter((p) => Number(p) > 0).map((p) => Math.abs(x.monthly - p) / Number(p)));
      if (off <= 0.1) pairs.push({ d, x, off });
    }
  }
  for (const { d, x } of pairs.sort((a, b) => a.off - b.off)) if (!matched.has(d.id) && free(x)) { used.add(x.id); matched.set(d.id, x); }
  // an expense well over its debt's payment ("Mortgage and car") pays others too: the part over counts as filed
  const over = [...matched].reduce((t, [id, e]) => { const d = debts.find((y) => y.id === id); const p = Number(d?.payment) || 0; return t + (e.monthly > p * 1.1 ? e.monthly - p : 0); }, 0);
  return { matched, spare: over + debtExpenses.filter(free).reduce((t, x) => t + (Number(x.monthly) || 0), 0) };
}

/**
 * closeGap(items, gap, { goalSaving }) -> { gap, picks: [{ id, name, monthly, period, amount, trimBy | null, trimTo | null }], covered, enough, niceTotal,
 *   bigMustPays: [{ id, name, monthly }] (when the nice-to-haves cannot close it), goalSaving }
 * The fewest nice-to-have expenses that close a monthly gap: the largest ones until one of the rest covers what is left,
 * then the smallest of those, so a big cut is never picked when a small one does it. The last pick says how much a
 * trim would be enough (trimBy, a month) when that is less than the whole amount, and the amount each time that leaves
 * (trimTo, in the expense's own period, rounded down to $5 so it closes the gap).
 */
export function closeGap(items, gap, opts = {}) {
  const pool = (items ?? []).filter((x) => x.active && !x.essential && x.period !== "once" && x.monthly > 0.5).sort((a, b) => b.monthly - a.monthly);
  const niceTotal = pool.reduce((t, x) => t + x.monthly, 0);
  const picks = [];
  let left = Math.max(0, Number(gap) || 0);
  const rest = [...pool];
  while (left > 0.5 && rest.length) {
    const fits = rest.filter((x) => x.monthly >= left);
    const x = fits.length ? fits[fits.length - 1] : rest[0];
    rest.splice(rest.indexOf(x), 1);
    const trimBy = x.monthly > left + 0.5 ? left : null;
    // the trim in the expense's own terms (its form asks for the amount each time): a yearly $3,000 trimmed by $220 a month is $360 a year
    const times = perYear(1, x.period) || 12;
    picks.push({ id: x.id, name: x.name, monthly: x.monthly, period: x.period, amount: Number(x.amount) || 0, trimBy, trimTo: trimBy === null ? null : Math.max(0, Math.floor(((Number(x.amount) || 0) - (trimBy * 12) / times) / 5) * 5) });
    left -= x.monthly;
  }
  const covered = picks.reduce((t, x) => t + x.monthly, 0);
  const enough = gap > 0 && covered >= gap - 0.5;
  const bigMustPays = enough ? [] : (items ?? []).filter((x) => x.active && x.essential && x.period !== "once" && x.monthly > 0.5 && !String(x.id ?? "").startsWith("debt")).sort((a, b) => b.monthly - a.monthly).slice(0, 3).map((x) => ({ id: x.id, name: x.name, monthly: x.monthly }));
  return { gap: Math.max(0, Number(gap) || 0), picks, covered, enough, niceTotal, bigMustPays, goalSaving: Math.max(0, Number(opts.goalSaving) || 0) };
}
