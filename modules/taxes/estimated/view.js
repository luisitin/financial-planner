// modules/taxes/estimated/view.js -- DOM only. What is due next and when, then the four
// quarters with what was paid, then last year's figures for the safe harbour (folded).
import { compute } from "./compute.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const head = !d.hasIncome ? "Quarterly estimated payments" : !d.needsEstimates ? "No estimated payments needed" : d.nextDue ? `${money(d.nextDue.amount)} due by ${fmt.date(d.nextDue.due)}` : "Estimated payments";
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, head),
    ui.h("p", { class: "lede" }, !d.hasIncome
      ? "Money that arrives without withholding (self-employment, pensions, IRA withdrawals, investment income, a Roth conversion) has to be paid in four instalments through the year or the IRS charges interest. Add income first."
      : !d.needsEstimates
        ? `${d.year}: about ${money(d.totalTax)} of federal tax, ${money(d.withholding)} of it withheld from pay${d.paid > 0 ? ` and ${money(d.paid)} already paid in estimates` : ""}. ${d.balanceAfterWithholding < 1000 ? "The balance at filing time is under 1,000, so no instalments are required." : "Withholding alone reaches the safe-harbour amount, so no instalments are required."}`
        : `${d.year}: about ${money(d.totalTax)} of federal tax and only ${money(d.withholding)} withheld. To stay clear of the penalty you need ${money(d.harbour.required)} paid in during the year (${d.harbour.basis === "last year" ? "100% of last year's tax" : "90% of this year's"}), so ${money(d.toPayByEstimates)} in four payments of ${money(d.perQuarter)}. ${money(d.paid)} paid so far, ${money(d.remaining)} to go.`),
    d.penaltyRisk ? ui.h("p", { class: "muted small" }, "A quarter is already behind: the penalty runs like interest from each due date, so paying now costs less than waiting.") : null,
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  root.append(ui.card(null, ui.row(
    ui.stat("Safe amount", money(d.harbour.required), d.harbour.basis === "last year" ? "100% of last year's tax" : "90% of this year's"),
    ui.stat("Withholding covers", money(d.withholding), "Withholding check page"),
    ui.stat("By estimates", money(d.toPayByEstimates), d.needsEstimates ? `${money(d.perQuarter)} a quarter` : "none needed"),
    ui.stat("At filing time", money(Math.abs(d.balanceAtFiling)), d.balanceAtFiling >= 0 ? "still to pay" : "refund"),
  )));
  const paidNow = plan.taxes?.estimated?.paid ?? [0, 0, 0, 0];
  const FIELDS = d.quarters.map((q, i) => ({ key: `q${i}`, label: `${q.label} (due ${fmt.date(q.due)})`, type: "money", min: 0, help: `covers ${q.covers}` }));
  const values = Object.fromEntries(d.quarters.map((q, i) => [`q${i}`, paidNow[i] || null]));
  const form = ui.form(FIELDS, values, (v) => {
    pending = "Payments saved.";
    store.update((p) => { p.taxes.estimated = { ...(p.taxes.estimated ?? {}), paid: [0, 1, 2, 3].map((i) => v[`q${i}`] ?? 0) }; });
  }, { submitLabel: "Save payments" });
  const badge = (s) => s === "paid" ? ui.h("span", { class: "pill ok" }, "paid") : s === "short" ? ui.h("span", { class: "pill warn" }, "behind") : s === "due" ? ui.h("span", { class: "pill accent" }, "due now") : s === "upcoming" ? ui.h("span", { class: "pill" }, "upcoming") : null;
  root.append(ui.card(`The four payments for ${d.year}`,
    ui.h("ul", { class: "records" }, d.quarters.map((q) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, q.label, " ", badge(q.status)), ui.h("span", { class: "rec-value" }, d.needsEstimates ? money(q.share) : money(q.paid))),
      ui.h("div", { class: "rec-sub" }, `due ${fmt.date(q.due)} · covers ${q.covers}${q.paid > 0 ? ` · ${money(q.paid)} paid` : ""}`)))),
    ui.h("p", { class: "muted small" }, "Pay at irs.gov/payments (Direct Pay, free) or with Form 1040-ES vouchers. Record each payment here so the Federal estimate page counts it."),
    form,
  ));
  const pr = plan.taxes?.priorYear ?? {};
  const priorForm = ui.form([
    { key: "tax", label: "Last year's total tax", type: "money", min: 0, help: "Form 1040 line 24" },
    { key: "agi", label: "Last year's adjusted gross income", type: "money", min: 0, help: "Form 1040 line 11; over 150,000 raises the safe harbour to 110%" },
  ], { tax: pr.tax ?? null, agi: pr.agi ?? null }, (v) => {
    pending = "Last year's figures saved.";
    store.update((p) => { p.taxes.priorYear = { ...(p.taxes.priorYear ?? {}), tax: v.tax ?? null, agi: v.agi ?? null }; });
  }, { submitLabel: "Save" });
  root.append(ui.h("details", { class: "card fold fold-card", open: d.hasPrior ? null : true },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Last year's return"), ui.h("span", { class: "fold-status" }, d.hasPrior ? `tax ${money(d.priorTax)}` : "not entered"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "The safe harbour: no penalty if the year's withholding and instalments reach 90% of this year's tax or 100% of last year's (110% if last year's income was over 150,000). Last year's figure is known for certain, this year's is a forecast, so the prior-year route is the usual choice."), priorForm)));
}
