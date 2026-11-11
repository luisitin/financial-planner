// modules/taxes/federal/view.js -- DOM only. The year's federal tax first (the figure, the
// refund or bill, the rates), then the walk from income to tax, what the plan already knows,
// and folded forms for the figures only the owner knows.
import { compute, ratePct } from "./compute.js";
import { known } from "./known.js";
import { taxAnswer, fullSteps } from "../withholding/compute.js";
import { compute as computeEstimated } from "../estimated/compute.js";
import { FILING_STATUSES } from "../../../core/math/tax.js";
import { isYou, nameIn, nameOf, NameOf, verbFor } from "../../../core/words.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  // the page's figures: the answer keys' return (d.result, d.steps: untouched) with what the plan already knows put in, one
  // step at a time (known.js: this year's IRA and 401(k) withdrawals, stock pay, a business at its profit, rentals after
  // costs, the IRA deduction as the income limits allow it, student loan interest). The hero, tiles, walk and sources all
  // read it, so the taxable income and the bracket are the return's own (round 8, freelancer-4: "22%" for a 12% return)
  const k = known(plan, { today: fmt.today() }, d);
  const r = k.result;
  const money = (n) => fmt.money(n, cur);
  const statusLabel = FILING_STATUSES.find((s) => s.id === d.filingStatus)?.label ?? "Single";
  // refund or owe: the year's tax against what the paychecks take out by December (typed on Withholding check, else
  // estimated from pay) and the estimated payments: the same answer as Withholding check, Estimated payments and Quick answers
  // any income counted, the plan's withdrawals included (known.js hasIncome), not the Income page alone (round 8 review: a
  // retiree living on IRA withdrawals read "Nothing on the Income page yet" above 6,953 of tax)
  const hasIncome = k.hasIncome;
  const ans = hasIncome ? taxAnswer(plan, { today: fmt.today() }) : null;
  // the whole year's federal tax, self-employment tax included (the same total as Withholding check, Quick answers and
  // Needs attention), and the walk that ends at it; d.result stays the income tax the answer keys check
  const full = fullSteps(plan, d, { today: fmt.today() }, k);
  const total = full.total;
  // no pay at all (a freelancer): nothing is withheld, so what is still to pay is known from the estimates paid alone
  const noPay = !(r.income.wages > 0);
  const owes = ans && (ans.from !== "none" || noPay) ? ans.balance : null;
  // filing separately, each return settles on its own: one return's refund cannot pay the other's bill (withholding
  // byReturn; Review 2026-11-06: "you would get about $540 back" while Bo's own return owed 1,660)
  const rets = owes !== null && Array.isArray(ans.returns) && ans.returns.length > 1 ? ans.returns : null;
  // a return with no paycheck figure has the verdict "unknown"; the hero only gets here with withholding known (typed or
  // estimated) or with no pay at all (nothing withheld), so its balance is known: read it (Review 2026-11-06, verifier: two
  // self-employed spouses each owing thousands read "Gus's is about right, and Hal's is about right")
  const verdictOf = (x) => (x.verdict !== "unknown" ? x.verdict : Math.abs(x.balance) < 500 ? "about right" : x.balance > 0 ? "owe" : "refund");
  const retWords = rets ? rets.map((x) => verdictOf(x) === "owe" ? `${nameIn(x.name)} would owe about ${money(x.balance)}` : verdictOf(x) === "refund" ? `${nameIn(x.name)} would get about ${money(-x.balance)} back` : `${isYou(x.name) ? "yours" : nameOf(x.name)} is about right`).join(", and ") : "";
  const oweMost = rets ? Math.max(...rets.map((x) => x.balance)) : owes;
  // no pay and estimates needed (a freelancer, a retiree): what Estimated payments says is behind now and due next, not one
  // April figure (round 8, freelancer-4: "about $11,898 still to pay in April" while $6,731 was already past due)
  let es = null;
  if (owes !== null && noPay && !rets) { try { es = computeEstimated(plan, { today: fmt.today() }); } catch { es = null; } }
  const sched = es && es.needsEstimates && es.remaining > 0.5 && !es.holdBack ? es : null;
  const laterQuarters = sched?.nextDue ? sched.quarters.filter((q) => q.due > sched.nextDue.due).length : 0;
  const schedWords = sched ? `${sched.behind > 0.5 ? `${money(sched.behind)} is overdue now${sched.nextDue ? ", " : ""}` : ""}${sched.nextDue ? `${money(sched.nextDue.amount)} is due by ${fmt.date(sched.nextDue.due)}` : ""}${laterQuarters ? ", and the Estimated payments page has the rest of the year" : ", and the rest when you file"}` : "";
  // stock vesting this year: the employer holds back tax from it, inside `projected` (withholding withholdingEstimate)
  const stockHeld = Number(ans?.stock) || 0;
  // nothing withheld: "out of pay" for someone with a business; a retiree's pension or IRA may have tax held back the plan
  // has not been told about (typed under "Federal tax withheld so far")
  const noneHeld = full.se ? "No tax is taken out of your pay" : "You have not entered any tax withheld";
  const paidBy = !ans ? "" : ans.from === "none" ? (ans.paid > 0 ? `${noneHeld}. You have paid ${money(ans.paid)} in estimates so far` : full.se ? `${noneHeld}, and you have not entered any estimated payments yet` : `${noneHeld} or any estimated payments yet`)
    : `${ans.from === "typed" ? "The paychecks take out" : "Your paychecks take out about"} ${money(ans.projected)} by December${ans.from === "paycheck" ? ` (estimated from your pay${stockHeld >= 0.5 ? `, with about ${money(stockHeld)} held back from the stock as it vests` : ""})` : ans.from === "mixed" ? " (partly estimated from pay)" : stockHeld >= 0.5 ? `, with about ${money(stockHeld)} held back from the stock as it vests` : ""}${ans.paid > 0 ? ` and ${money(ans.paid)} is already paid` : ""}`;
  const seNote = full.se ? ` It includes ${money(full.se.tax)} of self-employment tax on the business.` : "";
  // the next dollar's cost and what sets it: the child care credit when it moves it (careSets), else the bracket
  const cents = Math.round(k.nextDollar * 100);
  // the care credit itself covers all the income tax only when it is held to it; otherwise (Lee: 2,100 of care credit on 2,148
  // of tax) it is the credits together, the child tax credit's refundable part already at its most (Review 2026-11-06, verifier)
  const careCoversAll = r.credits.careCredit >= r.incomeTax - 0.5;
  const why = k.careSets === "covers"
    ? (cents === 0 ? (careCoversAll ? "the child care credit is more than the tax, so it covers the tax on more pay too" : "with the child care credit, your credits are more than the tax, so they cover the tax on more pay too") : `less than the ${fmt.pct(r.bracketRate, 0)} rate: the child care credit covers part of the tax on more pay`)
    : k.careSets === "falls" || k.careFalls ? `the ${fmt.pct(r.bracketRate, 0)} rate, and the child care credit getting smaller`
    // more than the bracket: each dollar also pulls Social Security (or gains at the 0% rate) into tax, as the tile says
    : k.nextDollar > r.bracketRate + 0.005 ? `more than the ${fmt.pct(r.bracketRate, 0)} rate: ${r.income.socialSecurity > 0 ? "each dollar also makes more of your Social Security taxed" : "each dollar pulls other income into tax"}`
    : `the ${fmt.pct(r.bracketRate, 0)} rate${Number.isFinite(r.roomInBracket) ? `, ${money(r.roomInBracket)} of room left before it goes up` : ""}`;
  // credits worth more than the tax: the tax is below zero and the rest comes back (the walk's last line says the same)
  const negative = total < -0.5;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, hasIncome ? (negative ? `No federal tax for ${d.year}: about ${money(-total)} of credits come back` : `About ${money(total)} of federal tax for ${d.year}`) : `Federal tax for ${d.year}`),
    ui.h("p", { class: "lede" }, hasIncome
      ? `${statusLabel}, ${money(r.income.gross)} of income. ${negative ? "The credits are more than the tax, so the rest comes back with the refund" : `That is ${ratePct(full.rate)} of it overall`}; ${noPay && full.se ? `the next dollar the business makes costs ${Math.round(full.se.nextDollar * 100)} cents (the ${fmt.pct(r.bracketRate, 0)} rate and self-employment tax, less its deductions)` : `the next dollar ${r.separate ? earnsWords(r) : "you earn"} costs ${cents} cents (${why})`}.${rets ? ` ${paidBy}. Filing separately, each return settles on its own: ${retWords}.` : owes !== null ? Math.abs(owes) < 500 ? ` ${paidBy}. That is about right: within a few hundred dollars of the tax.` : owes > 0 ? (sched ? ` ${paidBy}, so you still owe about ${money(owes)}: ${schedWords}.` : es?.holdBack ? ` ${paidBy}, so you still owe about ${money(owes)}. Ask the IRA firm to hold back about ${money(es.holdBack.amount)} of tax from a withdrawal before December 31: tax held back counts as paid through the whole year, so the quarters already past are covered too${es.holdBack.whole > es.holdBack.amount + 50 ? ` (that is enough to avoid the penalty; about ${money(es.holdBack.whole)} leaves nothing to pay in April)` : ""}.` : ` ${paidBy}, so you would owe about ${money(owes)} at filing time.`) : ` ${paidBy}, so you would get about ${money(-owes)} back.` : ""}${seNote}`
      : "The plan estimates federal income tax from what it knows about your pay, pensions, Social Security and household, plus the figures you type below. Add income on the Income page or type it here."),
    owes !== null ? ui.row(noPay ? ui.h("a", { class: oweMost >= 500 ? "btn" : "btn secondary", href: "#/taxes/estimated" }, es?.holdBack ? "How to have tax held back" : oweMost >= 500 ? "Plan the estimated payments" : "See the estimated payments") : ui.h("a", { class: oweMost >= 500 ? "btn" : "btn secondary", href: "#/taxes/withholding" }, oweMost >= 500 ? "Fix it in your paychecks" : "Check your paychecks")) : null,
    ui.h("p", { class: "muted small" }, `${d.isIndexed ? `No official ${d.year} figures yet: the latest brackets and deductions, inflated. ` : ""}An estimate laid out like Form 1040, not tax advice. It counts the child tax credit and ${d.filingStatus === "married_separate" ? "no child care credit (a separate return gets none, unless you lived apart from your spouse for the last six months of the year)" : "the child care credit"}. It leaves out the alternative minimum tax, ${full.se ? "" : "the business deduction, "}the earned income and education credits, the credit for caring for an adult who cannot look after themselves, and state tax.`),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  // the engine's note that self-employment tax is left out is answered by the walk's business rows; then what the plan's own
  // figures could not count, or would count twice (known.js notes)
  // a household whose only income is the plan's own (this year's IRA and 401(k) withdrawals) is not told the estimate is
  // built from what is typed (round 8 verify: an early retiree read that above 14,127 of tax worked from the plan's draw)
  const fromPlan = !d.hasIncome && k.hasIncome && (Number(k.withdrawal?.counted) || 0) >= 0.5;
  const said = (x) => (fromPlan ? x.replace(/([Tt])he estimate is built from what you type below\./, "$1he estimate is built from this year's IRA and 401(k) withdrawals the plan takes (What the plan already knows) and what you type below.") : x);
  for (const x of d.notes) if (!(full.se && /self-employment tax/i.test(x))) root.append(ui.notice("info", said(x)));
  for (const n of k.notes) root.append(ui.notice("info", n));
  root.append(ui.card(null, ui.row(
    negative ? ui.stat("Credits back", money(-total), owes !== null ? `more than the tax; with withholding, about ${money(-owes)} back in April` : "more than the tax: it comes back with the refund")
      : ui.stat("Federal tax", money(total), rets ? "the two returns added up" : sched ? (sched.behind > 0.5 ? `${money(sched.behind)} behind now${sched.nextDue ? `, ${money(sched.nextDue.amount)} by ${fmt.date(sched.nextDue.due)}` : ""}` : sched.nextDue ? `${money(sched.nextDue.amount)} due by ${fmt.date(sched.nextDue.due)}` : `about ${money(owes)} still to pay`)
        : es?.holdBack ? `about ${money(es.holdBack.amount)} to have held back from the IRA withdrawal` : owes !== null ? owes > 0 ? `about ${money(owes)} still to pay in April` : owes > -0.5 ? "nothing to pay or get back in April" : `about ${money(-owes)} back in April` : "before withholding"),
    negative ? null : ui.stat("Of your income", ratePct(full.rate), "your overall rate"),
    noPay && full.se ? ui.stat("On the next dollar", fmt.pct(full.se.nextDollar, 0), `of business profit: the ${fmt.pct(r.bracketRate, 0)} rate and self-employment tax, less its deductions`)
      : ui.stat("On the next dollar", fmt.pct(k.nextDollar, 0), k.careSets === "covers" ? (cents === 0 && !careCoversAll ? "the credits cover it" : "the child care credit covers it")
        : k.careSets === "falls" || k.careFalls ? `the ${fmt.pct(r.bracketRate, 0)} rate, and a smaller child care credit`
        : k.nextDollar > r.bracketRate + 0.005 ? `more than the ${fmt.pct(r.bracketRate, 0)} rate: benefits or gains get pulled along` : `the ${fmt.pct(r.bracketRate, 0)} rate`),
    ui.stat("Taxable income", money(r.taxableIncome), `after ${money(r.deduction.amount + (Number(r.deduction.qbi) || 0))} of deductions${Number(r.deduction.qbi) >= 0.5 ? ", the business one included" : ""}`),
  )));
  // filing separately: each return's own tax, a business's self-employment tax and deductions on its owner's return
  // (fullSteps `returns`, withholding separateBusiness), so "the two added up" is exact (care fourth pass: 8,590 + 6,482 was
  // shown under a tax of 15,742)
  if (r.separate) {
    const own = (x) => full.returns?.find((y) => y.personId === x.personId) ?? null;
    root.append(ui.card("Two returns",
      ui.h("p", { class: "muted small" }, "Filing separately, each of you files your own return. The tax above is the two added up."),
      // a return with a business: its own income, taxable income and bracket with the business at its profit and its
      // deductions (separateBusiness), not the engine's with the business counted in full (Review 2026-11-06: Bo's read
      // "$50,500 taxed ... the 22% bracket" where his return taxes 48,653 in the 12%)
      ui.h("ul", { class: "records" }, r.separate.map((x) => { const o = own(x), se = o ? o.se + o.addl : 0, b = o && o.taxableIncome != null ? o : null;
        const gross = b?.gross ?? x.income.gross, taxable = b ? b.taxableIncome : x.taxableIncome, ded = b ? b.deduction : x.deduction, bracket = b ? b.bracketRate : x.bracketRate, half = Number(b?.half) || 0;
        return ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${x.name === null || x.name === undefined ? "Spouse's" : NameOf(x.name)} return`), ui.h("span", { class: "rec-value" }, money(o ? o.total : x.totalTax))),
        ui.h("div", { class: "rec-sub" }, `${money(gross)} of income, ${money(taxable)} taxed after ${money(ded.amount + (ded.qbi || 0) + half)} of deductions${ded.used === "itemized" ? " (itemized)" : ""}${[ded.qbi >= 0.5 ? `the 20% business deduction (${money(ded.qbi)})` : null, half >= 0.5 ? `half the self-employment tax (${money(half)})` : null].filter(Boolean).map((t, i) => `${i ? " and " : ", including "}${t}`).join("")}; the ${fmt.pct(bracket, 0)} bracket${se >= 0.5 ? `; with the business on this return: ${money(o.incomeTax)} of income tax and ${money(se)} of self-employment tax` : ""}`)); })),
    ));
  }
  // children under 13 and no care on Expenses: the credit is there to be had once the care is listed; with a child care
  // account chosen, what to say first is that its money would be lost (care fourth pass: with a 5,000 account and one child
  // the page promised a credit that stays 0)
  const careHint = d.care && d.care.persons > 0 && !(d.care.expensesAll > 0) && (d.filingStatus !== "married_separate" || d.care.elected > 0.5);
  const acctHint = careHint && d.care.elected > 0.5;
  const credLeft = d.filingStatus !== "married_separate" && (d.care.persons >= 2 ? 6000 : 3000) > Math.min(d.care.elected, d.care.benefitLimit) + 0.5;
  root.append(ui.card("From income to tax",
    ui.h("ul", { class: "records" }, full.steps.map((s) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, s.label), ui.h("span", { class: "rec-value", style: s.label === "Federal tax" ? { fontWeight: 700 } : null }, s.amount < -0.005 ? `−${money(-s.amount)}` : money(Math.abs(s.amount) < 0.005 ? 0 : s.amount))),
      s.sub ? ui.h("div", { class: "rec-sub" }, s.sub) : null))),
    careHint ? ui.h("p", { class: "muted small", style: { marginBottom: "0" } }, acctHint
      ? `Paying for child care so you can work? Add it on Expenses: the child care account pays it back. With no care to pay, the ${money(d.care.elected)} in the account would be lost.${credLeft ? " Care the account does not pay can still count for the child care credit." : ""}`
      : "Paying for child care so you can work? Add it on Expenses and the child care credit comes off your tax.") : null,
    careHint ? ui.h("a", { class: "small", href: "#/cashflow/expenses", style: { display: "inline-flex", alignItems: "center", minHeight: "44px" } }, "Add child care on Expenses ›") : null,
  ));
  // the pages the figures come from: the base ones, then each page a known.js step read
  const PAGE = { withdrawals: "Required withdrawals", stock: "Equity compensation", business: "Self-employment", rental: "Rental analysis", loanInterest: "Debts" };
  const pages = ["Income", "Contributions", ...(d.care?.expensesAll > 0 ? ["Expenses"] : []), ...k.lines.filter((l) => l.from === "plan").map((l) => PAGE[l.key]).filter(Boolean)];
  const pageList = [...new Set(pages)];
  root.append(ui.card("What the plan already knows",
    ui.h("p", { class: "muted small" }, `Yearly figures from your ${pageList.join(", ")} and People pages. Leave a box blank to use the plan's figure; anything you type replaces it.`),
    ui.h("ul", { class: "records" }, k.sources.map((s) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, s.label, " ", ui.h("span", { class: s.from === "typed" ? "pill accent" : "pill" }, s.from === "typed" ? "typed" : "from the plan")), ui.h("span", { class: "rec-value" }, s.amount < -0.005 ? `−${money(-s.amount)}` : money(Math.abs(s.amount) < 0.005 ? 0 : s.amount))),
      s.detail ? ui.h("div", { class: "rec-sub" }, s.detail) : null))),
    ui.h("p", { class: "muted small" }, `${d.people.adults} adult${d.people.adults === 1 ? "" : "s"}${d.people.ages65plus ? `, ${d.people.ages65plus} aged 65 or more` : ""}; ${d.people.dependentsUnder17} dependent${d.people.dependentsUnder17 === 1 ? "" : "s"} under 17${d.people.otherDependents ? ` and ${d.people.otherDependents} other` : ""}${d.care?.persons ? `; ${d.care.persons} under 13 ${d.care.turning13?.length ? "for some or all of the year" : "at the end of the year"}${d.filingStatus === "married_separate" ? "" : ", for the child care credit"}` : ""}. Filing ${statusLabel.toLowerCase()} (change it on the People page).`),
  ));
  root.append(figuresFold(ctx, { ...d, hasIncome }), deductionsFold(ctx, d, r), yearFold(ctx, d));
  root.append(ui.h("p", { class: "muted small" }, "Brackets and deductions: the IRS's yearly tables (Revenue Procedures 2023-34 for 2024, 2024-40 for 2025 and 2025-32 for 2026) with the 2025 tax law's changes. The Social Security pay limit comes from the Social Security Administration. Later years grow with inflation from the last table; the limits the law fixes in dollars stay put."));
}

/** The spouse whose return the next dollar and the bracket figures are for (the engine's `separateTo`, else the first). */
const firstName = (r) => (r.separate.find((x) => x.personId != null && x.personId === r.separateTo) ?? r.separate[0]).name ?? null;
/** "you earn" for the first adult Get started left unnamed ("Me"), "your spouse earns", "Ana earns" (round 7). */
const earnsWords = (r) => { const n = firstName(r); return n === null ? "the first spouse earns" : `${nameIn(n)} ${verbFor(n, "earns", "earn")}`; };

function figuresFold(ctx, d) {
  const { ui, fmt, store, plan } = ctx;
  const ty = plan.taxes?.thisYear ?? {};
  const FIELDS = [
    { key: "wages", label: "Wages this year", type: "money", min: 0, help: "leave blank to use the Income page (pay less pre-tax 401(k) money, the health FSA and the child care account)" },
    { key: "iraWithdrawals", label: "IRA and 401(k) withdrawals this year", type: "money", min: 0, help: "the taxable part (Form 1099-R box 2a); leave blank to use the plan's required withdrawal" },
    { key: "otherOrdinary", label: "Other income taxed at regular rates", type: "money", min: 0, help: "interest, non-qualified dividends, Roth conversions; withdrawals go in the box above" },
    { key: "qualifiedIncome", label: "Qualified dividends", type: "money", min: 0, help: "taxed at the lower gains rates; long-term gains come from the Capital gains page" },
    { key: "taxExemptInterest", label: "Tax-exempt interest", type: "money", min: 0, help: "municipal bonds; counts toward Social Security taxation only" },
    { key: "socialSecurity", label: "Social Security benefits this year", type: "money", min: 0, help: "leave blank to use the Income page" },
    { key: "adjustments", label: "Other adjustments", type: "money", min: 0, help: "educator expenses and the like; student loan interest is worked out from Debts (a figure here replaces it), IRA and HSA contributions from their pages" },
    { key: "withheld", label: "Federal tax withheld so far", type: "money", min: 0, help: "from pay stubs, and from a pension or IRA (Form 1099-R box 4); last year's W-2 as a guide" },
    { key: "paid", label: "Other payments", type: "money", min: 0, help: "quarterly payments are on the Estimated payments page" },
  ];
  const values = { wages: ty.wages ?? null, iraWithdrawals: ty.iraWithdrawals ?? null, otherOrdinary: ty.otherOrdinary || null, qualifiedIncome: ty.qualifiedIncome || null, taxExemptInterest: ty.taxExemptInterest || null, socialSecurity: ty.socialSecurity ?? null, adjustments: ty.adjustments || null, withheld: ty.withheldTyped === true ? (ty.withheld ?? 0) : ty.withheld || null, paid: ty.paid || null };
  const form = ui.form(FIELDS, values, (v) => {
    pending = "Figures saved.";
    store.update((p) => { p.taxes.thisYear = { ...(p.taxes.thisYear ?? {}), wages: v.wages ?? null, iraWithdrawals: v.iraWithdrawals ?? null, otherOrdinary: v.otherOrdinary ?? 0, qualifiedIncome: v.qualifiedIncome ?? 0, taxExemptInterest: v.taxExemptInterest ?? 0, socialSecurity: v.socialSecurity ?? null, adjustments: v.adjustments ?? 0, withheld: v.withheld ?? 0, withheldTyped: v.withheld !== null && v.withheld !== undefined, paid: v.paid ?? 0 }; });
  }, { submitLabel: "Save figures" });
  // a withdrawal typed as 0 is typed (none this year: it replaces the plan's)
  const typedCount = Object.entries(values).filter(([key, v]) => v !== null && (v !== 0 || key === "iraWithdrawals")).length;
  return ui.h("details", { class: "card fold fold-card", open: d.hasIncome ? null : true },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Figures the plan cannot see"), ui.h("span", { class: "fold-status" }, typedCount ? `${typedCount} typed` : "none typed"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "Yearly amounts, whole dollars. Your last return or year-end statements have these."), form));
}

function deductionsFold(ctx, d, r = d.result) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const it = plan.taxes?.itemized ?? {};
  const FIELDS = [
    { key: "mortgageInterest", label: "Mortgage interest", type: "money", min: 0, help: "Form 1098 from the lender" },
    { key: "propertyTax", label: "Property tax", type: "money", min: 0 },
    { key: "stateTax", label: "State and local income tax", type: "money", min: 0, help: `together with property tax, capped at ${fmt.money(d.itemized.saltCap, cur)}` },
    { key: "charitable", label: "Charitable gifts", type: "money", min: 0 },
    { key: "medical", label: "Medical and dental", type: "money", min: 0, help: "only the part over 7.5% of income counts" },
    { key: "other", label: "Other itemized", type: "money", min: 0 },
  ];
  const values = Object.fromEntries(FIELDS.map((f) => [f.key, it[f.key] || null]));
  const form = ui.form(FIELDS, values, (v) => {
    pending = "Deductions saved.";
    store.update((p) => { p.taxes.itemized = { ...(p.taxes.itemized ?? {}), ...Object.fromEntries(FIELDS.map((f) => [f.key, v[f.key] ?? 0])) }; });
  }, { submitLabel: "Save deductions" });
  const used = r.deduction.used;
  return ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Itemized deductions"), ui.h("span", { class: "fold-status" }, used === "itemized" ? `itemizing: ${fmt.money(d.itemized.total, cur)}` : `standard ${fmt.money(r.deduction.standard, cur)} is better`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" },
      ui.h("p", { class: "muted small" }, `You get the larger of the standard deduction (${fmt.money(r.deduction.standard, cur)} for you) and these added up (${fmt.money(d.itemized.total, cur)} now). Most households take the standard one.`),
      d.itemized.lines.length ? ui.h("ul", { class: "records" }, d.itemized.lines.map((l) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, l.label), ui.h("span", { class: "rec-value" }, fmt.money(l.amount, cur))), l.note ? ui.h("div", { class: "rec-sub" }, l.note) : null))) : null,
      form));
}

function yearFold(ctx, d) {
  const { ui, fmt, store, plan } = ctx;
  const t = plan.taxes ?? {};
  const thisYear = Number(fmt.today().slice(0, 4));
  const yearOptions = [...new Set([...d.years, thisYear, thisYear + 1])].sort().map((y) => ({ value: String(y), label: `${y}${d.years.includes(y) ? "" : " (the last table, raised for inflation)"}` }));
  const FIELDS = [
    { key: "year", label: "Tax year", type: "select", options: yearOptions },
    { key: "dependentsUnder17", label: "Children under 17 at year end", type: "number", min: 0, step: "1", help: "leave blank to count from the People page" },
    { key: "otherDependents", label: "Other dependents", type: "number", min: 0, step: "1", help: "leave blank to count from the People page" },
    { key: "blind", label: "Blind (you or your spouse)", type: "number", min: 0, max: 2, step: "1", help: "adds the same allowance as age 65" },
  ];
  const separate = d.filingStatus === "married_separate";
  if (separate) FIELDS.push({ key: "livedApart", label: "We lived apart all year", type: "checkbox", help: "filing separately: Social Security is then taxed as for a single person" });
  const values = { year: String(d.year), dependentsUnder17: t.dependentsUnder17 ?? null, otherDependents: t.otherDependents ?? null, blind: t.blind || null, livedApart: t.livedApart === true };
  const form = ui.form(FIELDS, values, (v) => {
    pending = "Saved.";
    store.update((p) => { p.taxes.year = Number(v.year) === thisYear ? null : Number(v.year); p.taxes.dependentsUnder17 = v.dependentsUnder17 ?? null; p.taxes.otherDependents = v.otherDependents ?? null; p.taxes.blind = v.blind ?? 0; if (separate) p.taxes.livedApart = v.livedApart ? true : null; });
  }, { submitLabel: "Save" });
  return ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Year and people"), ui.h("span", { class: "fold-status" }, `${d.year}`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "Ages come from birth dates on the People page; the filing status is set there too."), form));
}
