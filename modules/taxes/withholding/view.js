// modules/taxes/withholding/view.js -- DOM only. Refund or bill at filing time first, then the
// W-4 change that would fix it, then the paycheck figures (folded).
import { compute } from "./compute.js";
import { PERIOD_OPTIONS } from "../../../core/math/periods.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  // with no pay stub figure typed, the answer comes from pay: the withholding payroll would work out (the Paycheck page),
  // the same figure Estimated payments, the Federal estimate and Quick answers use; it never says "$0 withheld"
  const est = d.estimate, guessed = d.verdict === "unknown" && est.from === "paycheck";
  const v = guessed ? est.verdict : d.verdict, bal = guessed ? est.balance : d.balance;
  const head = v === "owe" ? `You would ${guessed ? "likely " : ""}owe about ${money(bal)} in April` : v === "refund" ? `You would ${guessed ? "likely " : ""}get about ${money(-bal)} back` : v === "about right" ? `Your withholding ${guessed ? "looks" : "is"} about right` : "Is enough tax coming out of your pay?";
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, head),
    ui.h("p", { class: "lede" }, guessed
      ? `${d.year}: about ${money(d.totalTax)} of federal tax; the paychecks take out about ${money(est.projected)} over the year${d.estimatedPaid > 0 ? `, and ${money(d.estimatedPaid)} is paid in estimates` : ""}.${v === "owe" && est.people.length ? ` Asking for about ${money(Math.ceil(bal / 10) * 10)} more over the paychecks left (W-4 Step 4(c), "extra withholding") clears it.` : ""}`
      : d.verdict === "unknown"
      ? `The plan estimates ${money(d.totalTax)} of federal tax for ${d.year}. Type what one paycheck withholds and it will say whether the year's paychecks cover it, or leave you a bill or a refund.`
      : `${d.year}: about ${money(d.totalTax)} of federal tax, ${money(d.withholding.projected)} withheld over the year${d.withholding.soFar > 0 ? ` (${money(d.withholding.soFar)} so far, ${money(d.withholding.rest)} from the paychecks left)` : ""}${d.estimatedPaid > 0 ? `, ${money(d.estimatedPaid)} paid in estimates` : ""}. ${d.verdict === "about right" ? "Within a few hundred dollars either way: nothing to change." : d.suggestion.text}`),
    guessed ? ui.h("p", { class: "muted small" }, `Estimated from your pay the way payroll works it out (${est.people.map((p) => `${p.name} about ${money(p.perPaycheck)} a paycheck`).join(", ")}). Type the "Federal income tax" figure from a pay stub below to make it exact.`) : null,
    d.penaltyRisk ? ui.h("p", { class: "muted small" }, `Underpayment penalty risk: the safe amount is ${money(d.harbour.required)} (${d.harbour.label}) and the paychecks reach ${money(d.withholding.projected + d.estimatedPaid)}.`) : null,
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) if (!guessed || !/^Type the federal tax/.test(n)) root.append(ui.notice("info", n));
  root.append(ui.card(null, ui.row(
    ui.stat("Tax for the year", money(d.totalTax), `${fmt.pct(d.effectiveRate, 1)} of income`),
    guessed ? ui.stat("Withheld by December", money(est.projected), "estimated from your pay")
      : ui.stat("Withheld by December", money(d.withholding.projected), d.withholding.people.length ? d.withholding.people.map((p) => `${p.name}: ${money(p.perPaycheck)} × ${p.left} left`).join(" · ") : "type a paycheck below"),
    d.verdict === "unknown" && !guessed ? null : ui.stat(bal >= 0 ? "Still to pay" : "Refund", money(Math.abs(bal)), guessed ? "at filing time, estimated" : "at filing time"),
    d.suggestion.kind === "add" ? ui.stat("Add per paycheck", money(d.suggestion.perPaycheck), `for ${d.suggestion.paychecks} paychecks: W-4 Step 4(c)`) : d.suggestion.kind === "cut" ? ui.stat("Could take home", money(d.suggestion.perPaycheck), "more per paycheck") : null,
  )));
  const w = plan.taxes?.withholding ?? {};
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const selfName = (adults.find((p) => p.role === "self") ?? adults[0])?.name ?? "You";
  const partner = adults.find((p) => p.role !== "self");
  const FIELDS = [
    { key: "selfPer", label: `${selfName}: federal tax taken per paycheck`, type: "money", min: 0, help: 'the "Federal income tax" line on the stub, not Social Security or Medicare' },
    { key: "selfPeriod", label: `${selfName}: paid how often`, type: "select", options: PERIOD_OPTIONS.filter((o) => ["weekly", "biweekly", "semimonthly", "monthly"].includes(o.value)) },
    ...(partner ? [
      { key: "partnerPer", label: `${partner.name}: federal tax taken per paycheck`, type: "money", min: 0 },
      { key: "partnerPeriod", label: `${partner.name}: paid how often`, type: "select", options: PERIOD_OPTIONS.filter((o) => ["weekly", "biweekly", "semimonthly", "monthly"].includes(o.value)) },
    ] : []),
  ];
  // how often each is paid starts on the pay period of their salary on Income (it was always "every two weeks")
  const PAYS = ["weekly", "biweekly", "semimonthly", "monthly"];
  const payOf = (person) => (plan.income ?? []).find((x) => x.personId === person?.id && x.type === "salary" && PAYS.includes(x.period))?.period ?? "biweekly";
  const values = { selfPer: w.self?.perPaycheck || null, selfPeriod: w.self?.period ?? payOf(adults.find((p) => p.role === "self") ?? adults[0]), partnerPer: w.partner?.perPaycheck || null, partnerPeriod: w.partner?.period ?? payOf(partner) };
  const form = ui.form(FIELDS, values, (v) => {
    pending = "Paycheck figures saved.";
    store.update((p) => { p.taxes.withholding = { ...(p.taxes.withholding ?? {}), self: { perPaycheck: v.selfPer ?? 0, period: v.selfPeriod }, partner: partner ? { perPaycheck: v.partnerPer ?? 0, period: v.partnerPeriod } : undefined }; });
  }, { submitLabel: "Save" });
  root.append(ui.h("details", { class: "card fold fold-card", open: d.withholding.hasSetup ? null : true },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "What a paycheck withholds"), ui.h("span", { class: "fold-status" }, d.withholding.people.length ? d.withholding.people.map((p) => `${money(p.perPaycheck)} ${p.period}`).join(", ") : "not set"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "From the latest paystub. The amount withheld so far this year goes on the Federal estimate page (\"Federal tax withheld so far\"); without it the whole year is assumed at this rate."), form)));
  root.append(ui.card("How the W-4 works now",
    ui.h("ul", { class: "records" }, [
      ["No more allowances", "Since 2020 the form asks for dollar amounts, not allowances. Step 3 credits and Step 4(b) deductions lower withholding; Step 4(c) adds a fixed extra amount per paycheck."],
      ["Two earners", "Each job withholds as if it were the only income, which under-withholds a couple. Ticking Step 2(c) on both W-4s, or putting the extra on the higher earner's 4(c), fixes it."],
      ["A refund is not a win", "It is money you overpaid through the year. Aiming for a small bill or a small refund keeps the cash in your own account; the safe-harbour rule means no penalty as long as the paychecks cover 90% of this year's tax or all of last year's."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
  ));
}
