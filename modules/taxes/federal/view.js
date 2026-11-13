// modules/taxes/federal/view.js -- DOM only. Simple first (docs/OPTIONAL.md; opt C3, the rule's first page): the answer
// (what happens in April, or what is overdue now), one sentence with the year's tax and what is already being paid toward
// it, and the page's one action. Then five quiet rows: "N more numbers" (the rates and the taxable income), the three
// forms ("Figures the plan cannot see", with what the plan already knows under its boxes; "Itemized deductions"; "Year and
// people") and "How this is worked out" (the walk, what the estimate leaves out, where the tables come from); then "More
// on this".
import { compute, ratePct } from "./compute.js";
import { known } from "./known.js";
import { taxAnswer, fullSteps } from "../withholding/compute.js";
import { compute as computeEstimated } from "../estimated/compute.js";
import { FILING_STATUSES } from "../../../core/math/tax.js";
import { isYou, nameIn, nameOf, NameOf, verbFor } from "../../../core/words.js";
import { parts, links } from "../../../core/ui/more.js";

// what the last save was, kept for the redraw the shell makes after it: { part (the part saved in, or null), said, head
// (the headline then), total (the tax then) }. The saved part stays open with its green line (R17); the line names the
// new answer when the headline changed (R7)
let pending = null;

const lowFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const upFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// a try at the next save that the kit refuses (a box held back: "Use $0 or more.") takes the last save's green line away at
// once, so a refused try never reads as saved (critic, opt C3: the two lines stood together for up to 4 s)
const refusedEnds = (form, green) => { if (green) form.addEventListener("invalid", () => green.remove(), true); };

/**
 * answerFor(a, { money, date }) -> { case, head, now, lede }: the page's answer, one written sentence per case
 * (docs/OPTIONAL.md R3 to R5): the headline, the same headline as the green line after a save says it ("You would now owe
 * ..."), and the sentence under it. `a`: { year, hasIncome, total (the year's federal tax; below 0 when credits come back),
 * owes (what is left to pay in April, below 0 a refund; null when what the pay takes out is not known), gross (the year's
 * income), paidBy (what is already being paid toward the tax, a sentence without its full stop), retWords (filing
 * separately: each return's own refund or bill, else ""), sched ({ behind, next: { amount, due } | null, later }: estimates
 * still to pay with no pay to take them from, else null), holdBack ({ amount, whole }: tax a retiree can have held back from
 * an IRA withdrawal, else null) }.
 */
export function answerFor(a, { money, date }) {
  const { year, total, owes, paidBy } = a;
  const taxWords = total < -0.5 ? `No federal tax for ${year}: about ${money(-total)} of credits come back` : total < 0.5 ? `No federal tax for ${year}` : `About ${money(total)} of federal tax for ${year}`;
  const typeIt = "type it under Figures the plan cannot see, below.";
  const rest = (s) => (s.later ? ", and the Estimated payments page has the rest of the year" : ", and the rest when you file");
  // the year's tax and what is already paid toward it; after "credits come back" (a colon already in it) as two sentences
  const andPaid = total < -0.5 ? `${taxWords}. ${paidBy}.` : `${taxWords}, and ${lowFirst(paidBy)}.`;
  if (!a.hasIncome) return { case: "start", head: `Federal tax for ${year}`, now: `Federal tax for ${year}`,
    lede: "Add what you earn first, then this page works out your tax. Type your pay here, or add all your income on the Income page." };
  if (a.retWords) return { case: "split", head: upFirst(a.retWords), now: `Now ${a.retWords}`,
    lede: `${taxWords}, the two returns added up. ${paidBy}. Filing separately, each return settles on its own: one return's refund cannot pay the other's bill.` };
  if (owes === null) return total < -0.5
    ? { case: "credits", head: taxWords, now: `Now ${lowFirst(taxWords)}`, lede: `What comes back in April depends on the tax taken out of your pay: ${typeIt}` }
    : { case: "unknown", head: `Your federal tax for ${year} is about ${money(total)}`, now: `Your federal tax for ${year} is now about ${money(total)}`,
      lede: `What you would owe or get back in April depends on the tax taken out of your pay: ${typeIt}` };
  if (Math.abs(owes) < 500) {
    if (total < 0.5) return { case: "nothing", head: `No federal tax to pay for ${year}`, now: `Now no federal tax to pay for ${year}`,
      lede: owes <= -0.5 ? `Your deductions and credits cover the tax on your ${money(a.gross)} of income, and about ${money(-owes)} comes back in April.`
        : `Your deductions and credits cover the tax on your ${money(a.gross)} of income.` };
    const head = owes >= 0.5 ? `You would owe about ${money(owes)} in April` : owes <= -0.5 ? `You would get about ${money(-owes)} back in April` : "Nothing to pay or get back in April";
    const now = owes >= 0.5 ? `You would now owe about ${money(owes)} in April` : owes <= -0.5 ? `You would now get about ${money(-owes)} back in April` : "Now nothing to pay or get back in April";
    return { case: "right", head, now, lede: `${andPaid} That is about right: within a few hundred dollars of the tax.` };
  }
  const s = a.sched;
  if (owes > 0 && s && s.behind > 0.5) return { case: "overdue", head: `${money(s.behind)} of tax is overdue now`, now: `${money(s.behind)} of tax is overdue now`,
    lede: `${taxWords}. ${paidBy}, so you still owe about ${money(owes)}: ${money(s.behind)} is overdue now${s.next ? `, ${money(s.next.amount)} is due by ${date(s.next.due)}` : ""}${rest(s)}.` };
  if (owes > 0 && s && s.next) return { case: "due", head: `${money(s.next.amount)} of tax is due by ${date(s.next.due)}`, now: `Now ${money(s.next.amount)} of tax is due by ${date(s.next.due)}`,
    lede: `${taxWords}. ${paidBy}, so you still owe about ${money(owes)}: ${money(s.next.amount)} is due by ${date(s.next.due)}${rest(s)}.` };
  const hb = a.holdBack;
  if (owes > 0 && hb) return { case: "holdback", head: `You still owe about ${money(owes)} of tax for ${year}`, now: `Now about ${money(owes)} of tax is still to pay for ${year}`,
    lede: `${andPaid} Ask the IRA firm to hold back about ${money(hb.amount)} of tax from a withdrawal before December 31: tax held back counts as paid through the whole year, so the quarters already past are covered too${hb.whole > hb.amount + 50 ? ` (that is enough to avoid the penalty; about ${money(hb.whole)} leaves nothing to pay in April)` : ""}.` };
  if (owes > 0) return { case: "owe", head: `You would owe about ${money(owes)} in April`, now: `You would now owe about ${money(owes)} in April`, lede: andPaid };
  return { case: "back", head: `You would get about ${money(-owes)} back in April`, now: `You would now get about ${money(-owes)} back in April`, lede: andPaid };
}

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const just = pending; pending = null;
  // the page's figures: the answer keys' return (d.result, d.steps: untouched) with what the plan already knows put in, one
  // step at a time (known.js: this year's IRA and 401(k) withdrawals, stock pay, a business at its profit, rentals after
  // costs, the IRA deduction as the income limits allow it, student loan interest). The answer, the numbers, the walk and the
  // sources all read it, so the taxable income and the bracket are the return's own (round 8, freelancer-4: "22%" for a 12% return)
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
  // a return with no paycheck figure has the verdict "unknown"; the answer only gets here with withholding known (typed or
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
  // stock vesting this year: the employer holds back tax from it, inside `projected` (withholding withholdingEstimate)
  const stockHeld = Number(ans?.stock) || 0;
  // nothing withheld: "out of pay" for someone with a business; a retiree's pension or IRA may have tax held back the plan
  // has not been told about (typed under "Federal tax withheld so far")
  const noneHeld = full.se ? "No tax is taken out of your pay" : "You have not entered any tax withheld";
  const paidBy = !ans ? "" : ans.from === "none" ? (ans.paid > 0 ? `${noneHeld}. You have paid ${money(ans.paid)} in estimates so far` : full.se ? `${noneHeld}, and you have not entered any estimated payments yet` : `${noneHeld} or any estimated payments yet`)
    : `${ans.from === "typed" ? "The paychecks take out" : "Your paychecks take out about"} ${money(ans.projected)} by December${ans.from === "paycheck" ? ` (estimated from your pay${stockHeld >= 0.5 ? `, with about ${money(stockHeld)} held back from the stock as it vests` : ""})` : ans.from === "mixed" ? " (partly estimated from pay)" : stockHeld >= 0.5 ? `, with about ${money(stockHeld)} held back from the stock as it vests` : ""}${ans.paid > 0 ? ` and ${money(ans.paid)} is already paid` : ""}`;
  const answer = answerFor({ year: d.year, hasIncome, total, owes, gross: r.income.gross, paidBy, retWords,
    sched: sched ? { behind: sched.behind, next: sched.nextDue ? { amount: sched.nextDue.amount, due: sched.nextDue.due } : null, later: laterQuarters > 0 } : null,
    holdBack: es?.holdBack ? { amount: es.holdBack.amount, whole: es.holdBack.whole } : null }, { money, date: fmt.date });
  const head = answer.head;
  // the green line after a save names the new answer (R7): the headline when it changed, else the tax when that did
  const said = just ? (head !== just.head ? `${just.said} ${answer.now}.`
    : hasIncome && Math.abs(total - just.total) >= 0.5 ? `${just.said} ${total < -0.5 ? `No federal tax for ${d.year} now: about ${money(-total)} of credits come back.` : `Federal tax for ${d.year} is now about ${money(total)}.`}`
    : just.said) : null;
  const green = () => { const n = ui.notice("ok", said); setTimeout(() => n.remove(), 4000); return n; };
  const saved = (part) => (said && just.part === part ? green() : null);
  const remember = (part, words) => { pending = { part, said: words, head, total }; };

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
  // the page's one action: the paychecks (Withholding check) or, with no pay, Estimated payments; filled when there is a
  // bill to fix, outlined when it is about right; nothing to plan with no pay and no bill (opt spec 6.1: no "See the
  // estimated payments" when nothing is owed)
  const action = owes === null ? null : noPay
    ? (oweMost >= 500 ? ui.h("a", { class: "btn", href: "#/taxes/estimated" }, es?.holdBack ? "How to have tax held back" : "Plan the estimated payments") : null)
    : ui.h("a", { class: oweMost >= 500 ? "btn" : "btn secondary", href: "#/taxes/withholding" }, oweMost >= 500 ? "Fix it in your paychecks" : "Check your paychecks");
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, head),
    ui.h("p", { class: "lede" }, answer.lede),
    // nothing earned on file: one box and one filled button instead of four $0 tiles (stress test A8, T3)
    hasIncome ? null : quickPay(ctx, remember),
    action ? ui.row(action) : null,
    ui.h("p", { class: "muted small" }, `${d.isIndexed ? `No official ${d.year} figures yet: the latest brackets and deductions, inflated. ` : ""}An estimate, not tax advice.`),
  ));
  // the engine's note that self-employment tax is left out is answered by the walk's business rows; then what the plan's own
  // figures could not count, or would count twice (known.js notes). Notices are never folded (docs/OPTIONAL.md R9)
  // a household whose only income is the plan's own (this year's IRA and 401(k) withdrawals) is not told the estimate is
  // built from what is typed (round 8 verify: an early retiree read that above 14,127 of tax worked from the plan's draw)
  const fromPlan = !d.hasIncome && k.hasIncome && (Number(k.withdrawal?.counted) || 0) >= 0.5;
  const fromWhat = (x) => (fromPlan ? x.replace(/([Tt])he estimate is built from what you type below\./, "$1he estimate is built from this year's IRA and 401(k) withdrawals the plan takes (What the plan already knows) and what you type below.") : x);
  // pay typed on this page (the quick box, or "Wages this year") replaces the Income page's for the tax: say so once the
  // Income page has pay too, with one tap back to it (review: a quick figure silently outlived the Income page)
  const typedPay = plan.taxes?.thisYear?.wages;
  if (typedPay !== null && typedPay !== undefined && (plan.income ?? []).some((x) => x.type === "salary" && Number(x.amount) > 0)) root.append(ui.notice("info", `Your pay is the ${money(typedPay)} typed on this page, not the pay on your Income page.`),
    ui.row(ui.button("Use the Income page's pay", () => { remember(null, "Now using the pay on your Income page."); store.update((p) => { p.taxes.thisYear = { ...(p.taxes.thisYear ?? {}), wages: null }; }); }, { class: "secondary" })));
  if (hasIncome) for (const x of d.notes) if (!(full.se && /self-employment tax/i.test(x))) root.append(ui.notice("info", fromWhat(x)));
  for (const n of k.notes) root.append(ui.notice("info", n));
  // children under 13 and no care on Expenses: the credit is there to be had once the care is listed; with a child care
  // account chosen, what to say first is that its money would be lost (care fourth pass: with a 5,000 account and one child
  // the page promised a credit that stays 0). Money the person could claim stays on the first view (R9 item 6: data-worth)
  const careHint = hasIncome && d.care && d.care.persons > 0 && !(d.care.expensesAll > 0) && (d.filingStatus !== "married_separate" || d.care.elected > 0.5);
  const acctHint = careHint && d.care.elected > 0.5;
  const credLeft = careHint && d.filingStatus !== "married_separate" && (d.care.persons >= 2 ? 6000 : 3000) > Math.min(d.care.elected, d.care.benefitLimit) + 0.5;
  if (careHint) root.append(ui.card(null,
    ui.h("p", { dataset: { worth: "" }, style: { margin: "0" } }, acctHint
      ? `Paying for child care so you can work? Add it on Expenses: the child care account pays it back. With no care to pay, the ${money(d.care.elected)} in the account would be lost.${credLeft ? " Care the account does not pay can still count for the child care credit." : ""}`
      : "Paying for child care so you can work? Add it on Expenses and the child care credit comes off your tax."),
    ui.h("a", { class: "small", href: "#/cashflow/expenses", style: { display: "inline-flex", alignItems: "center", minHeight: "44px" } }, "Add child care on Expenses ›")));

  // ---- the parts: the rest of the figures, the three forms, the working (docs/OPTIONAL.md R12: one card, this order)
  const tiles = hasIncome ? [
    negative ? null : ui.stat("Of your income", ratePct(full.rate), "your overall rate"),
    noPay && full.se ? ui.stat("On the next dollar", fmt.pct(full.se.nextDollar, 0), `of business profit: the ${fmt.pct(r.bracketRate, 0)} rate and self-employment tax, less its deductions`)
      : ui.stat("On the next dollar", fmt.pct(k.nextDollar, 0), k.careSets === "covers" ? (cents === 0 && !careCoversAll ? "the credits cover it" : "the child care credit covers it")
        : k.careSets === "falls" || k.careFalls ? `the ${fmt.pct(r.bracketRate, 0)} rate, and a smaller child care credit`
        : k.nextDollar > r.bracketRate + 0.005 ? `more than the ${fmt.pct(r.bracketRate, 0)} rate: benefits or gains get pulled along` : `the ${fmt.pct(r.bracketRate, 0)} rate`),
    ui.stat("Taxable income", money(r.taxableIncome), `after ${money(r.deduction.amount + (Number(r.deduction.qbi) || 0))} of deductions${Number(r.deduction.qbi) >= 0.5 ? ", the business one included" : ""}`),
    full.se ? ui.stat("Self-employment tax", money(full.se.tax), "Social Security and Medicare on the business, in the tax above") : null,
  ].filter(Boolean) : [];
  const numbers = hasIncome && tiles.length ? { id: "numbers", kind: "more", n: tiles.length, noun: "numbers", one: "number", body: () => [ui.row(...tiles),
    ui.h("p", { class: "muted small", style: { margin: "0" } }, `${statusLabel}, ${money(r.income.gross)} of income. ${negative ? "The credits are more than the tax, so the rest comes back with the refund" : `That is ${ratePct(full.rate)} of it overall`}; ${noPay && full.se ? `the next dollar the business makes costs ${Math.round(full.se.nextDollar * 100)} cents (the ${fmt.pct(r.bracketRate, 0)} rate and self-employment tax, less its deductions)` : `the next dollar ${r.separate ? earnsWords(r) : "you earn"} costs ${cents} cents (${why})`}.${full.se ? ` It includes ${money(full.se.tax)} of self-employment tax on the business.` : ""}`)] } : null;
  const figures = figuresPart(ctx, { owes, hasIncome, open: just?.part === "figures", green: saved("figures"), remember, known: hasIncome ? knownBody(ctx, { d, k, statusLabel, money }) : null });
  const itemized = deductionsPart(ctx, d, r, { open: just?.part === "itemized", green: saved("itemized"), remember });
  const year = yearPart(ctx, d, { open: just?.part === "year", green: saved("year"), remember });
  const how = { id: "how", kind: "how", says: hasIncome ? `${full.steps.length} steps` : "sources", body: () => howBody(ctx, { d, full, rets: r.separate, hasIncome, money }) };
  root.append(parts(ctx, numbers, figures, itemized, year, how));
  // a save outside the parts (the pay box at the top, "Use the Income page's pay") says itself at the foot of the page, and
  // the shell repeats it at the bottom of the screen: nothing above the button moves
  if (said && !just.part) root.append(green());
  // the deeper pages, each row the question it answers (R24, G8); one shut row on a step of a guide (R6)
  const more = hasIncome ? links(ctx, [
    { href: "#/taxes/brackets", ask: "What would more income cost?", says: noPay && full.se ? null : `${fmt.pct(k.nextDollar, 0)} on the next dollar` },
    { href: "#/taxes/projection", ask: "What is the tax in later years?" },
    { href: "#/taxes/capital-gains", ask: "What is the tax on what you sell?" },
    { href: "#/taxes/state", ask: "What does your state take?" },
    { href: "#/reports/tax", ask: "Can you print all of this on one page?" },
  ]) : null;
  if (more) root.append(more);
}

/** The spouse whose return the next dollar and the bracket figures are for (the engine's `separateTo`, else the first). */
const firstName = (r) => (r.separate.find((x) => x.personId != null && x.personId === r.separateTo) ?? r.separate[0]).name ?? null;
/** "you earn" for the first adult Get started left unnamed ("Me"), "your spouse earns", "Ana earns" (round 7). */
const earnsWords = (r) => { const n = firstName(r); return n === null ? "the first spouse earns" : `${nameIn(n)} ${verbFor(n, "earns", "earn")}`; };

/** With nothing earned on file: one box for this year's pay and one filled button (it writes the same figure as "Wages this year"). */
function quickPay(ctx, remember) {
  const { ui, store } = ctx;
  const m = ui.moneyBox({ name: "wages", required: true, min: 1, max: 1e9, label: "Your pay this year, before tax" });
  return ui.h("form", { class: "form", style: { marginTop: "12px" }, onSubmit: (e) => {
    e.preventDefault();
    const n = ui.moneyValue(m.input);
    if (!(n > 0)) return;
    remember(null, "Pay saved.");
    store.update((p) => { p.taxes = p.taxes ?? {}; p.taxes.thisYear = { ...(p.taxes.thisYear ?? {}), wages: n }; });
  } }, ui.field("Your pay this year, before tax", m.box, "wages or salary, before anything is taken out. Used for the tax until you add your pay on the Income page (then one tap switches to it)"),
    ui.h("div", { class: "form-actions" }, ui.h("button", { type: "submit" }, "Show my tax"), ui.h("a", { class: "btn secondary", href: "#/cashflow/income" }, "Add income on the Income page")));
}

/**
 * "How this is worked out": filing separately each return's own tax, the walk from income to tax, what the estimate leaves
 * out, and where the tables come from. (What the plan already knows sits under the boxes that replace it, in "Figures the
 * plan cannot see": with it here the part was 1,644 px open for the family, over R15's 1,300.)
 */
function howBody(ctx, { d, full, rets, hasIncome, money }) {
  const { ui, fmt } = ctx;
  const out = [];
  // filing separately: each return's own tax, a business's self-employment tax and deductions on its owner's return
  // (fullSteps `returns`, withholding separateBusiness), so "the two added up" is exact (care fourth pass: 8,590 + 6,482 was
  // shown under a tax of 15,742)
  if (rets) {
    const own = (x) => full.returns?.find((y) => y.personId === x.personId) ?? null;
    out.push(ui.h("h3", {}, "Two returns"),
      ui.h("p", { class: "muted small" }, "Filing separately, each of you files your own return. The tax above is the two added up."),
      // a return with a business: its own income, taxable income and bracket with the business at its profit and its
      // deductions (separateBusiness), not the engine's with the business counted in full (Review 2026-11-06: Bo's read
      // "$50,500 taxed ... the 22% bracket" where his return taxes 48,653 in the 12%)
      ui.h("ul", { class: "records" }, rets.map((x) => { const o = own(x), se = o ? o.se + o.addl : 0, b = o && o.taxableIncome != null ? o : null;
        const gross = b?.gross ?? x.income.gross, taxable = b ? b.taxableIncome : x.taxableIncome, ded = b ? b.deduction : x.deduction, bracket = b ? b.bracketRate : x.bracketRate, half = Number(b?.half) || 0;
        return ui.h("li", {},
          ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${x.name === null || x.name === undefined ? "Spouse's" : NameOf(x.name)} return`), ui.h("span", { class: "rec-value" }, money(o ? o.total : x.totalTax))),
          ui.h("div", { class: "rec-sub" }, `${money(gross)} of income, ${money(taxable)} taxed after ${money(ded.amount + (ded.qbi || 0) + half)} of deductions${ded.used === "itemized" ? " (itemized)" : ""}${[ded.qbi >= 0.5 ? `the 20% business deduction (${money(ded.qbi)})` : null, half >= 0.5 ? `half the self-employment tax (${money(half)})` : null].filter(Boolean).map((t, i) => `${i ? " and " : ", including "}${t}`).join("")}; the ${fmt.pct(bracket, 0)} bracket${se >= 0.5 ? `; with the business on this return: ${money(o.incomeTax)} of income tax and ${money(se)} of self-employment tax` : ""}`)); })));
  }
  if (hasIncome) {
    out.push(ui.h("h3", {}, "From income to tax"),
      ui.h("ul", { class: "records" }, full.steps.map((s) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, s.label), ui.h("span", { class: "rec-value", style: s.label === "Federal tax" ? { fontWeight: 700 } : null }, s.amount < -0.005 ? `−${money(-s.amount)}` : money(Math.abs(s.amount) < 0.005 ? 0 : s.amount))),
        s.sub ? ui.h("div", { class: "rec-sub" }, s.sub) : null))));
  }
  out.push(ui.h("h3", {}, "What this leaves out"),
    ui.h("p", { class: "muted small" }, `An estimate laid out like Form 1040, not tax advice. It counts the child tax credit and ${d.filingStatus === "married_separate" ? "no child care credit (a separate return gets none, unless you lived apart from your spouse for the last six months of the year)" : "the child care credit"}. It leaves out the alternative minimum tax, ${full.se ? "" : "the business deduction, "}the earned income and education credits, the credit for caring for an adult who cannot look after themselves, and state tax.`),
    ui.h("h3", {}, "Where the tables come from"),
    ui.h("p", { class: "muted small" }, "Brackets and deductions: the IRS's yearly tables (Revenue Procedures 2023-34 for 2024, 2024-40 for 2025 and 2025-32 for 2026) with the 2025 tax law's changes. The Social Security pay limit comes from the Social Security Administration. Later years grow with inflation from the last table; the limits the law fixes in dollars stay put."));
  return out;
}

/** "What the plan already knows": each figure the estimate takes from the plan, the page it comes from, and the people
 * counted; under the boxes that replace them ("Leave a box blank to use the plan's figure"). */
/** "What the plan already knows": each figure the estimate takes from the plan, the page it comes from, and the people
 * counted; drawn under the boxes that replace them ("Leave a box blank to use the plan's figure"). */
function knownBody(ctx, { d, k, statusLabel, money }) {
  const { ui } = ctx;
  // the pages the figures come from: the base ones, then each page a known.js step read
  const PAGE = { withdrawals: "Required withdrawals", stock: "Equity compensation", business: "Self-employment", rental: "Rental analysis", loanInterest: "Debts" };
  const pages = ["Income", "Contributions", ...(d.care?.expensesAll > 0 ? ["Expenses"] : []), ...k.lines.filter((l) => l.from === "plan").map((l) => PAGE[l.key]).filter(Boolean)];
  const pageList = [...new Set(pages)];
  return [ui.h("h3", {}, "What the plan already knows"),
    ui.h("p", { class: "muted small", style: { margin: "0" } }, `Yearly figures from your ${pageList.join(", ")} and People pages. Leave a box blank to use the plan's figure; anything you type replaces it.`),
    ui.h("ul", { class: "records" }, k.sources.map((s) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, s.label, " ", ui.h("span", { class: s.from === "typed" ? "pill accent" : "pill" }, s.from === "typed" ? "typed" : "from the plan")), ui.h("span", { class: "rec-value" }, s.amount < -0.005 ? `−${money(-s.amount)}` : money(Math.abs(s.amount) < 0.005 ? 0 : s.amount))),
      s.detail ? ui.h("div", { class: "rec-sub" }, s.detail) : null))),
    ui.h("p", { class: "muted small", style: { margin: "0" } }, `${d.people.adults} adult${d.people.adults === 1 ? "" : "s"}${d.people.ages65plus ? `, ${d.people.ages65plus} aged 65 or more` : ""}; ${d.people.dependentsUnder17} dependent${d.people.dependentsUnder17 === 1 ? "" : "s"} under 17${d.people.otherDependents ? ` and ${d.people.otherDependents} other` : ""}${d.care?.persons ? `; ${d.care.persons} under 13 ${d.care.turning13?.length ? "for some or all of the year" : "at the end of the year"}${d.filingStatus === "married_separate" ? "" : ", for the child care credit"}` : ""}. Filing ${statusLabel.toLowerCase()} (change it on the People page).`)];
}

/** "Figures the plan cannot see": the box the tax guide asks for first ("Federal tax withheld so far") with its Save in
 * sight, the other eight under "More details (optional)" (R13; the guide step opens this part by its title); then the green
 * line of its save, then what the plan already knows (the figures a box left blank uses). */
function figuresPart(ctx, { owes, hasIncome, open, green, remember, known }) {
  const { ui, store, plan } = ctx;
  const ty = plan.taxes?.thisYear ?? {};
  const FIELDS = [
    { key: "withheld", label: "Federal tax withheld so far", type: "money", min: 0, help: "from pay stubs, and from a pension or IRA (Form 1099-R box 4); last year's W-2 as a guide" },
    { key: "wages", label: "Wages this year", type: "money", min: 0, more: true, help: "leave blank to use the Income page (pay less pre-tax 401(k) money, the health FSA and the child care account)" },
    { key: "iraWithdrawals", label: "IRA and 401(k) withdrawals this year", type: "money", min: 0, more: true, help: "the taxable part (Form 1099-R box 2a); leave blank to use the plan's required withdrawal" },
    { key: "otherOrdinary", label: "Other income taxed at regular rates", type: "money", min: 0, more: true, help: "interest, non-qualified dividends, Roth conversions; withdrawals go in the box above" },
    { key: "qualifiedIncome", label: "Qualified dividends", type: "money", min: 0, more: true, help: "taxed at the lower gains rates; long-term gains come from the Capital gains page" },
    { key: "taxExemptInterest", label: "Tax-exempt interest", type: "money", min: 0, more: true, help: "municipal bonds; counts toward Social Security taxation only" },
    { key: "socialSecurity", label: "Social Security benefits this year", type: "money", min: 0, more: true, help: "leave blank to use the Income page" },
    { key: "adjustments", label: "Other adjustments", type: "money", min: 0, more: true, help: "educator expenses and the like; student loan interest is worked out from Debts (a figure here replaces it), IRA and HSA contributions from their pages" },
    { key: "paid", label: "Other payments", type: "money", min: 0, more: true, help: "quarterly payments are on the Estimated payments page" },
  ];
  const values = { wages: ty.wages ?? null, iraWithdrawals: ty.iraWithdrawals ?? null, otherOrdinary: ty.otherOrdinary || null, qualifiedIncome: ty.qualifiedIncome || null, taxExemptInterest: ty.taxExemptInterest || null, socialSecurity: ty.socialSecurity ?? null, adjustments: ty.adjustments || null, withheld: ty.withheldTyped === true ? (ty.withheld ?? 0) : ty.withheld || null, paid: ty.paid || null };
  const form = ui.form(FIELDS, values, (v) => {
    remember("figures", "Figures saved.");
    store.update((p) => { p.taxes.thisYear = { ...(p.taxes.thisYear ?? {}), wages: v.wages ?? null, iraWithdrawals: v.iraWithdrawals ?? null, otherOrdinary: v.otherOrdinary ?? 0, qualifiedIncome: v.qualifiedIncome ?? 0, taxExemptInterest: v.taxExemptInterest ?? 0, socialSecurity: v.socialSecurity ?? null, adjustments: v.adjustments ?? 0, withheld: v.withheld ?? 0, withheldTyped: v.withheld !== null && v.withheld !== undefined, paid: v.paid ?? 0 }; });
  }, { submitLabel: "Save figures" });
  refusedEnds(form, green);
  // a withdrawal typed as 0 is typed (none this year: it replaces the plan's)
  const typed = Object.entries(values).filter(([key, v]) => v !== null && (v !== 0 || key === "iraWithdrawals")).length;
  return { id: "figures", kind: "own", title: "Figures the plan cannot see", holds: FIELDS.map((f) => f.key), set: typed, says: typed ? "" : "none typed",
    // what the pay takes out is not known (pay typed here, no paycheck to work it from): the box the answer waits for
    missing: hasIncome && owes === null && !typed, open,
    body: [ui.h("p", { class: "muted small", style: { margin: "0" } }, "Yearly amounts, whole dollars. Your last return or year-end statements have these."), form, green, known] };
}

function deductionsPart(ctx, d, r, { open, green, remember }) {
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
    remember("itemized", "Deductions saved.");
    store.update((p) => { p.taxes.itemized = { ...(p.taxes.itemized ?? {}), ...Object.fromEntries(FIELDS.map((f) => [f.key, v[f.key] ?? 0])) }; });
  }, { submitLabel: "Save deductions" });
  refusedEnds(form, green);
  const used = r.deduction.used;
  const typed = Object.values(values).filter((v) => v !== null).length;
  return { id: "itemized", kind: "own", title: "Itemized deductions", holds: FIELDS.map((f) => f.key), set: typed, says: used === "itemized" ? `itemizing ${fmt.money(d.itemized.total, cur)}` : "standard is better", open,
    body: [ui.h("p", { class: "muted small", style: { margin: "0" } }, `You get the larger of the standard deduction (${fmt.money(r.deduction.standard, cur)} for you) and these added up (${fmt.money(d.itemized.total, cur)} now). Most households take the standard one.`),
      d.itemized.lines.length ? ui.h("ul", { class: "records" }, d.itemized.lines.map((l) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, l.label), ui.h("span", { class: "rec-value" }, fmt.money(l.amount, cur))), l.note ? ui.h("div", { class: "rec-sub" }, l.note) : null))) : null,
      form, green] };
}

function yearPart(ctx, d, { open, green, remember }) {
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
    remember("year", "Saved.");
    store.update((p) => { p.taxes.year = Number(v.year) === thisYear ? null : Number(v.year); p.taxes.dependentsUnder17 = v.dependentsUnder17 ?? null; p.taxes.otherDependents = v.otherDependents ?? null; p.taxes.blind = v.blind ?? 0; if (separate) p.taxes.livedApart = v.livedApart ? true : null; });
  }, { submitLabel: "Save" });
  refusedEnds(form, green);
  // what the person set here (a year other than this one, a count in place of People's, the blind allowance, living apart)
  const typed = [t.year !== null && t.year !== undefined, values.dependentsUnder17 !== null, values.otherDependents !== null, values.blind !== null, separate && values.livedApart].filter(Boolean).length;
  return { id: "year", kind: "own", title: "Year and people", holds: FIELDS.map((f) => f.key), set: typed, says: `${d.year}`, open,
    body: [ui.h("p", { class: "muted small", style: { margin: "0" } }, "Ages come from birth dates on the People page; the filing status is set there too."), form, green] };
}
