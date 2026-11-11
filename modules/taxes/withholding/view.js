// modules/taxes/withholding/view.js -- DOM only. Refund or bill at filing time first, then the
// W-4 change that would fix it, then the paycheck figures (folded).
import { compute, step3Words, addJanuaryWords, firstMove } from "./compute.js";
import { ratePct } from "../federal/compute.js";
import { PERIOD_OPTIONS } from "../../../core/math/periods.js";
import { isYou, nameIn, NameIn, nameOf, NameOf, verbFor } from "../../../core/words.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  // whenever any earner's withholding comes from pay (no pay stub figure typed for them), the answer is the estimate: the
  // withholding payroll would work out (the Paycheck page) for them and the typed figures for the rest, the same figure
  // Estimated payments, the Federal estimate and Quick answers use; it never counts an earner as $0 withheld
  const est = d.estimate, guessed = est.from === "paycheck" || est.from === "mixed";
  const v = guessed ? est.verdict : d.verdict, bal = guessed ? est.balance : d.balance;
  const sg = guessed ? est.suggestion : d.suggestion;
  const paidElse = d.estimatedPaid + (est.otherPaid || 0);
  const estNames = est.people.filter((p) => p.estimated);
  // with business income the year's tax includes self-employment tax (yearTax), which the Federal estimate's total leaves out
  // (its own figure, seOwn, as the Federal estimate's walk says it; seTax is the business's whole effect, deductions off)
  const seBit = d.seOwn >= 1 ? `, ${money(d.seOwn)} of it self-employment tax on business income` : "";
  // credits worth more than the tax (the refundable child tax credit): no tax, and the rest comes back with the refund
  const back = d.creditsBack > 0.5;
  const taxWords = back ? `no federal tax, and about ${money(d.creditsBack)} of credits come back on top of what is withheld` : `about ${money(d.totalTax)} of federal tax${seBit}`;
  // the first adult Get started left unnamed ("Me", or the compute's "You" when no adult is on People) reads "you" and "your",
  // the partner it named "My spouse" reads "your spouse"; a typed name as before (Review 2026-11-06 round 7)
  const nm = (n) => (n === "You" ? null : n);
  const whose = (x) => nameOf(nm(x.name));
  const said = (n) => nameIn(nm(n)) !== String(n ?? "");   // Get started's own name, said as "you" or "your spouse"
  const andList = (names) => names.map((n, i) => (i ? nameIn(nm(n)) : NameIn(nm(n)))).join(" and ");
  // a cut gives the Step 3 figure for the paychecks left and, when it differs, the whole year's for January (step3Words:
  // a W-4 stays until it is changed; Review 2026-11-06)
  const w4 = (x, back = d.creditsBack) => x.kind === "add" ? ` Ask for ${money(x.perPaycheck)} more ${x.paychecks === 1 ? `on the one paycheck left on ${whose(x)} W-4 (Step 4(c), "extra withholding"); that clears it.` : `per paycheck on ${whose(x)} W-4 (Step 4(c), "extra withholding") for the ${x.paychecks} paychecks left this year; that clears it.`}${x.january === null || x.january === undefined ? "" : ` ${addJanuaryWords(x.january, d.year, money)}`}`
    : x.kind === "cut" && (x.takeHome ?? x.perPaycheck) >= 1 ? ` That is about ${money(x.takeHome ?? x.perPaycheck)} a paycheck lent to the IRS${x.all ? ", all of what each paycheck takes out" : ""}${back > 0.5 ? ` (the ${money(back)} of credits comes back whatever the W-4 says)` : ""}. ${x.step3 ? step3Words(x, x.paychecks, { year: d.year, whose: x.name && !isYou(nm(x.name)) ? nameOf(x.name) : null }) : "A new W-4 with an amount in Step 3 or 4(b) brings take-home up and the refund down."}`
    : x.kind === "estimates" ? (x.noPay ? " No tax comes out of pay for this return: the Estimated payments page works out the payments." : " No paycheck is left this year to change: the Estimated payments page works out a payment instead.") : "";
  // filing separately, each return settles on its own: one return's refund cannot pay the other's bill (byReturn; Review
  // 2026-11-06: "You would likely get about $540 back" while Bo's own return owed 1,660)
  const rets = est.from !== "none" && Array.isArray(est.returns) && est.returns.length > 1 ? est.returns : null;
  const likely = guessed ? "likely " : "";
  const owing = rets ? rets.filter((x) => x.verdict === "owe") : [], getting = rets ? rets.filter((x) => x.verdict === "refund") : [];
  const sum = (xs) => xs.reduce((t, x) => t + x.balance, 0);
  const retHead = !rets ? null
    : owing.length && getting.length ? `${NameIn(nm(owing[0].name))} would ${likely}owe about ${money(owing[0].balance)} in April; ${nameIn(nm(getting[0].name))} would ${likely}get about ${money(-getting[0].balance)} back`
    : owing.length ? `${owing.length > 1 ? "You" : NameIn(nm(owing[0].name))} would ${likely}owe about ${money(sum(owing))} in April`
    : getting.length ? `${getting.length > 1 ? "You" : NameIn(nm(getting[0].name))} would ${likely}get about ${money(-sum(getting))} back`
    : `Your withholding ${guessed ? "looks" : "is"} about right`;
  const head = retHead ?? (v === "owe" ? `You would ${likely}owe about ${money(bal)} in April` : v === "refund" ? `You would ${likely}get about ${money(-bal)} back` : v === "about right" ? `Your withholding ${guessed ? "looks" : "is"} about right` : "Is enough tax coming out of your pay?");
  // each return's own line: its tax, its own withholding, what is left, the W-4 change on it, and its own penalty test
  const retLine = (x) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${NameOf(nm(x.name))} return`), ui.h("span", { class: "rec-value" }, x.verdict === "owe" ? `owes ${money(x.balance)}` : x.verdict === "refund" ? `${money(-x.balance)} back` : "about right")),
    ui.h("div", { class: "rec-sub" }, `${x.back > 0.5 ? `no federal tax, and ${money(x.back)} of credits come back` : `about ${money(x.owed)} of federal tax`}; ${x.people.length ? `${money(x.withheld)} withheld from ${whose(x)} pay` : `nothing withheld from ${whose(x)} pay`}${x.paid >= 0.5 ? `, ${money(x.paid)} paid otherwise` : ""}.${x.verdict === "about right" ? " Within a few hundred dollars: nothing to change." : w4(x.suggestion, x.back)}`),
    x.penaltyRisk ? ui.h("div", { class: "rec-sub" }, `${NameOf(nm(x.name))} pay takes out less than the safe amount for this return (${money(x.harbour.required)}, ${x.harbour.label === "90% of this year's" ? "90% of its tax" : x.harbour.label}), so an underpayment penalty is possible. More withheld before December counts as paid through the year.`) : null);
  // the one thing to do first, as the hero's filled button (stress test MR-7); "Type your pay stub figure" opens the paycheck
  // box below in place, scrolls it into view and puts the cursor in it
  const mv = firstMove({ hasIncome: d.hasIncome, guessed, verdict: v, suggestion: sg, returns: rets });
  let fold = null;
  const toStub = () => { if (!fold) return; fold.open = true; fold.scrollIntoView({ block: "start", behavior: "smooth" }); fold.querySelector("input")?.focus({ preventScroll: true }); };
  const stubBtn = (cls) => ui.h("button", { type: "button", class: cls, onClick: toStub }, "Type your pay stub figure");
  const moveRow = !mv ? null
    : mv.kind === "stub" ? ui.row(stubBtn("btn"))
    : ui.row(ui.h("a", { class: "btn", href: mv.href, ...(mv.kind === "w4" ? { target: "_blank", rel: "noopener" } : {}) }, `${mv.label} ›`), mv.also === "stub" ? stubBtn("btn secondary") : null);
  const moveNote = mv?.kind === "w4" ? ui.h("p", { class: "muted small" }, "The W-4 button opens the form on the IRS site: fill in the amount above, hand it to whoever runs payroll at work, and the change starts with the next paycheck.") : null;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasIncome ? head : "Is enough tax taken out of your pay?"),
    // nothing earned on file: say what to do first, with one button, instead of "$0 Tax for the year" (stress test T3, A8)
    !d.hasIncome ? ui.h("p", { class: "lede" }, "Add what you earn first, then this page checks whether your paychecks take out enough tax for the year.") : null,
    !d.hasIncome ? ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Add your income")) : null,
    !d.hasIncome ? null : ui.h("p", { class: "lede" }, rets
      ? `${d.year}: filing separately, each of you pays the tax on your own return from your own withholding, and one return's refund cannot pay the other's bill.${owing.length && getting.length ? " Each return's change is below." : ""}`
      : guessed
      ? `${d.year}: ${taxWords}; the paychecks take out about ${money(est.projected)} over the year${paidElse > 0 ? `, and ${money(paidElse)} is paid otherwise` : ""}.${v === "about right" ? " Within a few hundred dollars either way: nothing to change." : w4(sg)}`
      : d.verdict === "unknown"
      ? `The plan estimates ${back ? `no federal tax for ${d.year}: about ${money(d.creditsBack)} of credits come back` : `${money(d.totalTax)} of federal tax for ${d.year}${seBit}`}. Type what one paycheck withholds, and the page tells you whether a year of paychecks covers your tax or leaves you a bill or a refund.`
      : `${d.year}: ${taxWords}; ${money(d.withholding.projected)} withheld over the year${d.withholding.soFar > 0 ? ` (${money(d.withholding.soFar)} so far, ${money(d.withholding.rest)} from the paychecks left)` : ""}${d.estimatedPaid > 0 ? `, ${money(d.estimatedPaid)} paid in estimates` : ""}. ${d.verdict === "about right" ? "Within a few hundred dollars either way: nothing to change." : d.suggestion.text}`),
    guessed ? ui.h("p", { class: "muted small" }, `${est.from === "mixed" ? `${estNames.length === 1 ? NameOf(nm(estNames[0].name)) : `${andList(estNames.map((p) => p.name))}'s`} withholding is estimated` : "Estimated"} from pay the way payroll works it out (${estNames.map((p) => `${nameIn(nm(p.name))} about ${money(p.perPaycheck)} a paycheck`).join(", ")}). Type the "Federal income tax" figure from a pay stub below to make it exact.`) : null,
    d.penaltyRisk && !guessed && !rets ? ui.h("p", { class: "muted small" }, `Underpayment penalty risk: the safe amount is ${money(d.harbour.required)} (${d.harbour.label}) and the paychecks reach ${money(d.withholding.projected + d.estimatedPaid)}.`) : null,
    moveNote, moveRow,
  ));
  if (rets) root.append(ui.card("Each return", ui.h("ul", { class: "records" }, rets.map(retLine)),
    ui.h("p", { class: "muted small" }, `Your tax for the year in all: ${taxWords}.${rets.some((x) => x.paid >= 0.5) ? " Payments made for the year go to the return that owes first: you choose how to split them between your returns (IRS Publication 505)." : ""}${est.detail?.soFarTyped && est.detail.soFar > 0 && est.from !== "paycheck" ? " The withholding so far is one figure for the two of you, so each return's share of it goes by what each paycheck takes out: about." : ""}`)));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) if ((!guessed || !/^Type the federal tax/.test(n)) && (d.hasIncome || !/^No income on file/.test(n))) root.append(ui.notice("info", n));
  if (d.hasIncome) root.append(ui.card(null, ui.row(
    back ? ui.stat("Credits back", money(d.creditsBack), "more than the year's tax: they come back with the refund")
      : ui.stat("Tax for the year", money(d.totalTax), d.seOwn >= 1 ? `with ${money(d.seOwn)} of self-employment tax` : `${ratePct(d.effectiveRate)} of income`),
    guessed ? ui.stat("Withheld by December", money(est.projected), est.from === "mixed" ? "partly estimated from pay" : "estimated from your pay")
      : ui.stat("Withheld by December", money(d.withholding.projected), d.withholding.people.length ? d.withholding.people.map((p) => `${p.name}: ${money(p.perPaycheck)} × ${p.left} left`).join(" · ") : "type a paycheck below"),
    rets ? rets.map((x) => ui.stat(x.verdict === "owe" ? `${x.name}: still to pay` : x.verdict === "refund" ? `${x.name}: refund` : `${x.name}: about right`, money(Math.abs(x.balance)), "on their own return, at filing time"))
    : d.verdict === "unknown" && !guessed ? null : ui.stat(bal >= 0 ? "Still to pay" : "Refund", money(Math.abs(bal)), guessed ? "at filing time, estimated" : "at filing time"),
    rets ? null : sg.kind === "add" ? ui.stat("Add per paycheck", money(sg.perPaycheck), `for ${sg.paychecks} paychecks${sg.name ? ` on ${whose(sg)} W-4` : ""}: Step 4(c)`) : sg.kind === "cut" && (sg.takeHome ?? sg.perPaycheck) >= 1 ? ui.stat("Could take home", money(sg.takeHome ?? sg.perPaycheck), "more per paycheck") : null,
  )));
  const w = plan.taxes?.withholding ?? {};
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const selfName = (adults.find((p) => p.role === "self") ?? adults[0])?.name ?? "You";
  const partner = adults.find((p) => p.role !== "self");
  // "Your federal tax taken per paycheck", "How often you are paid"; a typed name keeps "Ana: paid how often"
  const perLabel = (n) => (said(n) ? `${NameOf(nm(n))} federal tax taken per paycheck` : `${n}: federal tax taken per paycheck`);
  const periodLabel = (n) => (said(n) ? `How often ${nameIn(nm(n))} ${verbFor(nm(n), "is", "are")} paid` : `${n}: paid how often`);
  const FIELDS = [
    { key: "selfPer", label: perLabel(selfName), type: "money", min: 0, help: 'the "Federal income tax" line on the stub, not Social Security or Medicare' },
    { key: "selfPeriod", label: periodLabel(selfName), type: "select", options: PERIOD_OPTIONS.filter((o) => ["weekly", "biweekly", "semimonthly", "monthly"].includes(o.value)) },
    ...(partner ? [
      { key: "partnerPer", label: perLabel(partner.name), type: "money", min: 0 },
      { key: "partnerPeriod", label: periodLabel(partner.name), type: "select", options: PERIOD_OPTIONS.filter((o) => ["weekly", "biweekly", "semimonthly", "monthly"].includes(o.value)) },
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
  root.append(fold = ui.h("details", { class: "card fold fold-card", open: d.withholding.hasSetup || !d.hasIncome ? null : true },   // nothing earned yet: folded, one filled button
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "What a paycheck withholds"), ui.h("span", { class: "fold-status" }, d.withholding.people.length ? d.withholding.people.map((p) => `${money(p.perPaycheck)} ${p.period}`).join(", ") : "not set"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "From the latest paystub. Type the amount withheld so far this year on the Federal estimate page (\"Federal tax withheld so far\"); without it, the page assumes the whole year was withheld at this rate."), form)));
  root.append(ui.card("How the W-4 works now",
    ui.h("ul", { class: "records" }, [
      ["No more allowances", "Since 2020 the form asks for dollar amounts, not allowances. Step 3 credits and Step 4(b) deductions lower withholding; Step 4(c) adds a fixed extra amount per paycheck."],
      ["Two earners", "Each job withholds as if it were the only income, which under-withholds a couple. Checking the Step 2(c) box on both W-4s, or putting the extra on the higher earner's 4(c), fixes it."],
      ["A refund is not a win", "It is money you overpaid through the year. Aiming for a small bill or a small refund keeps the cash in your own account; the safe-harbor rule means no penalty as long as the paychecks cover 90% of this year's tax or all of last year's."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
  ));
}
