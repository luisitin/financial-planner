// modules/taxes/estimated/view.js -- DOM only. What is due next and when, then the four
// quarters with what was paid, then last year's figures for the safe harbour (folded).
import { compute } from "./compute.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  // tax withheld from pay counts as paid evenly through the year (IRC 6654(g)(1)), so someone whose pay has tax taken out
  // can cover the whole shortfall, earlier quarters too, by raising withholding for the paychecks left: the easier fix,
  // and the one Withholding check and the Federal estimate point to
  // filing separately, each return is on its own: its own tax, withholding, safe amount and payments (compute `returns`;
  // Review 2026-11-06: "No estimated payments needed" while Bo's own return was 1,660 short of his tax)
  const rets = Array.isArray(d.returns) && d.returns.length > 1 ? d.returns : null;
  const needing = rets ? rets.filter((x) => x.needsEstimates) : [];
  // the schedule shown: the one return that needs payments, else the household's
  const S = needing.length === 1 ? { ...needing[0], withholding: needing[0].withheld } : d;
  const viaPay = S.needsEstimates && S.withholding > 0 && S.remaining > 0 && d.withholdingFrom !== "none";
  const who = needing.length === 1 ? `${S.name}'s ` : "";
  const head = rets ? (!needing.length ? "No estimated payments needed"
      : needing.length > 1 ? "Both returns need estimated payments"
      : viaPay ? `${S.name}: about ${money(S.remaining)} more withheld this year` : S.behind > 0 ? `${S.name}'s return: ${money(S.behind)} behind, pay it now` : S.nextDue ? `${S.name}'s return: ${money(S.nextDue.amount)} due by ${fmt.date(S.nextDue.due)}` : `${S.name}'s return needs estimated payments`)
    : !d.hasIncome ? "Quarterly estimated payments" : !d.needsEstimates ? "No estimated payments needed" : viaPay ? `Raise your withholding: about ${money(d.remaining)} more this year` : d.behind > 0 ? `${money(d.behind)} behind: pay it now` : d.nextDue ? `${money(d.nextDue.amount)} due by ${fmt.date(d.nextDue.due)}` : "Estimated payments";
  const retLine = (x) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${x.name}'s return`), ui.h("span", { class: "rec-value" }, x.needsEstimates ? `${money(x.perQuarter)} a quarter` : "none needed")),
    ui.h("div", { class: "rec-sub" }, `${x.back > 0.5 ? `no federal tax, and ${money(x.back)} of credits come back` : `about ${money(x.owed)} of federal tax`}; ${x.people.length ? `${money(x.withheld)} withheld from ${x.name}'s pay` : `nothing withheld from ${x.name}'s pay`}${x.paid >= 0.5 ? `, ${money(x.paid)} of the payments` : ""}.`),
    ui.h("div", { class: "rec-sub" }, x.needsEstimates
      ? `To stay clear of the penalty this return needs ${money(x.harbour.required)} paid in during the year (${x.harbour.label === "90% of this year's" ? "90% of its tax" : `${x.harbour.label}, its share`}), so ${money(x.toPayByEstimates)} in four payments. ${money(x.paid)} paid so far, ${money(x.remaining)} to go${x.behind > 0 ? `, ${money(x.behind)} of it behind` : ""}.`
      : `${x.balanceAfterWithholding < 1000 ? "Under 1,000 is left at filing time" : "The withholding reaches this return's safe amount"}, so no instalments are required: ${x.balanceAtFiling >= 0.5 ? `about ${money(x.balanceAtFiling)} to pay in April` : x.balanceAtFiling <= -0.5 ? `about ${money(-x.balanceAtFiling)} back` : "nothing to pay in April"}.`));
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, head),
    rets ? ui.h("p", { class: "lede" }, `${d.year}: filing separately, each of you pays the tax on your own return, and one return's refund cannot pay the other's bill.${viaPay ? ` Tax taken from pay counts as paid evenly through the year, so about ${money(S.remaining)} more withheld from ${S.name}'s pay before December keeps ${S.name}'s return clear of the penalty, earlier quarters included${S.balanceAtFiling > S.remaining + 50 ? ` (about ${money(S.balanceAtFiling)} more clears its April bill too)` : ""}. Withholding check works out the W-4 change; paying the quarters below works as well.` : ""}`) : null,
    rets && viaPay ? ui.row(ui.h("a", { class: "btn", href: "#/taxes/withholding" }, "Work out the W-4 change")) : null,
    rets && S.penaltyRisk && !viaPay ? ui.h("p", { class: "muted small" }, S.overdue ? `${who ? `${who}payments` : "Payments"} from the ${S.overdue.label} (due ${fmt.date(S.overdue.due)}) on are behind: the penalty runs like interest from each due date, so paying now costs less than waiting.` : `The ${S.lateQuarter.label}'s payment came after its due date (${fmt.date(S.lateQuarter.due)}): the IRS charges a small penalty, like interest, from that date until the day it was paid.`) : null,
    rets ? null : viaPay ? ui.h("p", { class: "lede" }, `Tax taken from pay counts as paid evenly through the year, so about ${money(d.remaining)} more withheld before December keeps you clear of the penalty, earlier quarters included${d.balanceAtFiling > d.remaining + 50 ? ` (about ${money(d.balanceAtFiling)} more clears the April bill too)` : ""}. Withholding check works out the W-4 change; paying the quarters below works as well.`) : null,
    !rets && viaPay ? ui.row(ui.h("a", { class: "btn", href: "#/taxes/withholding" }, "Work out the W-4 change")) : null,
    rets ? null : ui.h("p", { class: viaPay ? "muted small" : "lede" }, !d.hasIncome
      ? "Money that arrives without withholding (self-employment, pensions, IRA withdrawals, investment income, a Roth conversion) has to be paid in four instalments through the year or the IRS charges interest. Add income first."
      : !d.needsEstimates
        ? `${d.year}: ${d.creditsBack > 0.5 ? `no federal tax, and about ${money(d.creditsBack)} of credits come back on top of the ${money(d.withholding)} withheld from pay` : `about ${money(d.totalTax)} of federal tax${d.seTax >= 1 ? ` (self-employment tax included)` : ""}, ${money(d.withholding)} of it withheld from pay`}${d.paid > 0 ? ` and ${money(d.paid)} already paid in estimates` : ""}. ${d.balanceAfterWithholding < 1000 ? "The balance at filing time is under 1,000, so no instalments are required." : "Withholding alone reaches the safe-harbour amount, so no instalments are required."}`
        : `${d.year}: about ${money(d.totalTax)} of federal tax${d.seTax >= 1 ? ` (self-employment tax included)` : ""} and ${d.withholdingFrom === "paycheck" ? `about ${money(d.withholding)} withheld from pay (estimated from your paychecks)` : d.withholdingFrom === "mixed" ? `about ${money(d.withholding)} withheld from pay (partly estimated)` : `only ${money(d.withholding)} withheld`}. To stay clear of the penalty you need ${money(d.harbour.required)} paid in during the year (${d.harbour.label}), so ${money(d.toPayByEstimates)} in four payments of ${money(d.perQuarter)}. ${money(d.paid)} paid so far, ${money(d.remaining)} to go.`),
    !rets && d.behind > 0 && d.nextDue ? ui.h("p", { class: viaPay ? "muted small" : null }, viaPay ? `Paying by quarters instead: ${money(d.behind)} now for the quarters past, then ${money(d.nextDue.amount)} by ${fmt.date(d.nextDue.due)}.` : `Then ${money(d.nextDue.amount)} by ${fmt.date(d.nextDue.due)}.`) : null,
    !rets && d.penaltyRisk && !viaPay ? ui.h("p", { class: "muted small" }, d.overdue ? `Payments from the ${d.overdue.label} (due ${fmt.date(d.overdue.due)}) on are behind: the penalty runs like interest from each due date, so paying now costs less than waiting.` : `The ${d.lateQuarter.label}'s payment came after its due date (${fmt.date(d.lateQuarter.due)}): the IRS charges a small penalty, like interest, from that date until the day it was paid. Paying the rest on time keeps it there.`) : null,
  ));
  if (rets) root.append(ui.card("Each return", ui.h("ul", { class: "records" }, rets.map(retLine)),
    ui.h("p", { class: "muted small" }, `Your tax for the year in all: about ${money(d.totalTax)}${d.seTax >= 1 ? " (self-employment tax included)" : ""}. The payments typed below go to the return that needs them; you choose how to split them between your returns (IRS Publication 505).`)));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  root.append(ui.card(null, rets ? ui.row(rets.map((x) => ui.stat(`${x.name}: at filing time`, money(Math.abs(x.balanceAtFiling)), `${x.balanceAtFiling >= 0 ? "still to pay" : "refund"}; ${x.needsEstimates ? `${money(x.perQuarter)} a quarter by estimates` : "no estimates needed"}`))) : ui.row(
    ui.stat("Safe amount", money(d.harbour.required), d.harbour.label),
    ui.stat("Withholding covers", money(d.withholding), d.withholdingFrom === "paycheck" ? "estimated from your pay" : d.withholdingFrom === "mixed" ? "partly estimated from pay" : "Withholding check page"),
    ui.stat("By estimates", money(d.toPayByEstimates), d.needsEstimates ? `${money(d.perQuarter)} a quarter` : "none needed"),
    ui.stat("At filing time", money(Math.abs(d.balanceAtFiling)), d.balanceAtFiling >= 0 ? "still to pay" : "refund"),
  )));
  const paidNow = plan.taxes?.estimated?.paid ?? [0, 0, 0, 0];
  const FIELDS = d.quarters.map((q, i) => ({ key: `q${i}`, label: `${q.label} (due ${fmt.date(q.due)})`, type: "money", min: 0, help: `covers ${q.covers}` }));
  const values = Object.fromEntries(d.quarters.map((q, i) => [`q${i}`, paidNow[i] || null]));
  const form = ui.form(FIELDS, values, (v) => {
    pending = "Payments saved.";
    store.update((p) => { p.taxes.estimated = { ...(p.taxes.estimated ?? {}), paid: [0, 1, 2, 3].map((i) => v[`q${i}`] ?? 0), typedAt: fmt.today() }; });
  }, { submitLabel: "Save payments" });
  // paying through withholding instead, a past quarter is not "behind": it is covered once the withholding is raised
  const Q = needing.length === 1 ? S : d;
  const badge = (s) => s === "paid" ? ui.h("span", { class: "pill ok" }, "paid") : s === "short" ? (viaPay ? ui.h("span", { class: "pill" }, "not paid") : ui.h("span", { class: "pill warn" }, "behind")) : s === "due" ? ui.h("span", { class: "pill accent" }, "due now") : s === "upcoming" ? ui.h("span", { class: "pill" }, "upcoming") : null;
  root.append(ui.card(`The four payments for ${d.year}${needing.length === 1 ? `, on ${S.name}'s return` : ""}`,
    ui.h("ul", { class: "records" }, Q.quarters.map((q, i) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, q.label, " ", badge(q.status)), ui.h("span", { class: "rec-value" }, Q.needsEstimates ? money(q.share) : money(d.quarters[i].paid))),
      ui.h("div", { class: "rec-sub" }, `due ${fmt.date(q.due)} · covers ${q.covers}${d.quarters[i].paid > 0 ? ` · ${money(d.quarters[i].paid)} paid` : ""}`)))),
    ui.h("p", { class: "muted small" }, "Pay at irs.gov/payments (Direct Pay, free) or with Form 1040-ES vouchers. Record each payment here so the Federal estimate page counts it."),
    form,
  ));
  const pr = plan.taxes?.priorYear ?? {};
  // the 110% line is half for a married person filing separately (IRC 6654(d)(1)(C); safeHarbour already works it so)
  const over110 = d.filingStatus === "married_separate" ? "75,000" : "150,000";
  const priorForm = ui.form([
    { key: "tax", label: "Last year's total tax", type: "money", min: 0, help: "Form 1040 line 24" },
    { key: "agi", label: "Last year's adjusted gross income", type: "money", min: 0, help: `Form 1040 line 11; over ${over110} raises the safe harbour to 110%${d.filingStatus === "married_separate" ? " (filing separately)" : ""}` },
  ], { tax: pr.tax ?? null, agi: pr.agi ?? null }, (v) => {
    pending = "Last year's figures saved.";
    store.update((p) => { p.taxes.priorYear = { ...(p.taxes.priorYear ?? {}), tax: v.tax ?? null, agi: v.agi ?? null }; });
  }, { submitLabel: "Save" });
  root.append(ui.h("details", { class: "card fold fold-card", open: d.hasPrior ? null : true },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Last year's return"), ui.h("span", { class: "fold-status" }, d.hasPrior ? `tax ${money(d.priorTax)}` : "not entered"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, `The safe harbour: no penalty if the year's withholding and instalments reach 90% of this year's tax or 100% of last year's (110% if last year's income was over ${over110}${d.filingStatus === "married_separate" ? ", the line for a married person filing separately" : ""}). Last year's figure is known for certain, this year's is a forecast, so the prior-year route is the usual choice.`), priorForm)));
}
