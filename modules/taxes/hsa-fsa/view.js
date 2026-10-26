// modules/taxes/hsa-fsa/view.js -- DOM only. What the HSA saves and grows into first, the
// room left this year, the FSA deadline, and one folded form for the figures.
import { compute } from "./compute.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const H = d.hsa, F = d.fsa;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasHsa && H.total > 0 ? `Your HSA saves about ${money(H.savedTotal)} of tax this year` : "Health savings and flexible spending accounts"),
    ui.h("p", { class: "lede" }, d.hasHsa && H.total > 0
      ? `${money(H.total)} goes in for ${d.year} (${money(H.contribution)} from you${H.employer ? `, ${money(H.employer)} from the employer` : ""}) against a limit of ${money(H.limit)}${H.catchUp ? ` including the catch-up from 55` : ""}: ${H.room > 0 ? `${money(H.room)} of room left` : H.over > 0 ? `${money(H.over)} over` : "the limit exactly"}. Kept invested, this year's money alone is worth about ${money(H.futureValue > 0 ? H.total * Math.pow(1 + H.growthRate, H.years) : H.total)} at 65, untaxed if it pays for health costs.`
      : `An HSA is the only account where money goes in untaxed, grows untaxed and comes out untaxed (for health costs), so it beats a 401(k) dollar for dollar. It needs a high-deductible health plan; the ${d.limitsYear} limit is ${money(d.hsa.coverage === "family" ? H.limit - H.catchUp : H.limit - H.catchUp)} for ${H.coverage === "family" ? "family" : "self-only"} coverage, plus 1,000 from age 55. Type what goes in below.`),
    ui.h("p", { class: "muted small" }, "Contributions through the paycheck also skip the 7.65% Social Security and Medicare tax. After 65 the money can be taken for anything, taxed like a traditional IRA."),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("warn", n));
  root.append(ui.card(null, ui.row(
    ui.stat(`${d.limitsYear} limit`, money(H.limit), `${H.coverage === "family" ? "family" : "self-only"} coverage${H.catchUp ? ", with catch-up" : ""}`),
    ui.stat("Room left", money(H.room), H.total > 0 ? `${money(H.total)} in so far` : "nothing in yet"),
    ui.stat("Tax saved", money(H.savedTotal), H.contribution > 0 ? `${fmt.pct(H.marginal, 0)} income tax + 7.65% payroll` : "on your own contributions"),
    ui.stat("At 65", money(H.atSixtyFive), `${H.years} years at ${fmt.pct(H.growthRate, 1)}: ${money(H.balance)} today plus ${money(H.total)} a year`),
  )));
  if (d.hasFsa) root.append(ui.card("Flexible spending account",
    ui.row(
      ui.stat("Elected", money(F.election), `limit ${money(F.limit)}`),
      ui.stat("Unspent", money(F.unspent), F.daysLeft !== null ? `${F.daysLeft} days left in ${d.year}` : ""),
      ui.stat("Tax saved", money(F.taxSaved), "income and payroll tax"),
    ),
    ui.h("p", { class: "small" }, F.unspent > 0 ? `Use it or lose it: what is not spent by December 31 is gone, unless your plan allows a grace period to mid-March or a carryover of up to ${money(F.carryover)}. ${F.daysLeft !== null && F.daysLeft < 90 ? "Glasses, dental work, prescriptions and first-aid supplies all count." : ""}` : "All spent: nothing to lose at year end."),
  ));
  const h = plan.taxes?.hsa ?? {};
  const FIELDS = [
    { key: "coverage", label: "HSA coverage", type: "select", options: [{ value: "self", label: "Self-only" }, { value: "family", label: "Family" }] },
    { key: "contribution", label: "You put in this year", type: "money", min: 0, help: "your own contributions for the year, through pay or directly" },
    { key: "employer", label: "Employer puts in", type: "money", min: 0, help: "counts against the same limit" },
    { key: "fsa", label: "FSA election this year", type: "money", min: 0, help: "leave blank if you have no FSA" },
    { key: "fsaSpent", label: "FSA spent so far", type: "money", min: 0 },
  ];
  const form = ui.form(FIELDS, { coverage: H.coverage, contribution: h.contribution || null, employer: h.employer || null, fsa: h.fsa || null, fsaSpent: h.fsaSpent || null }, (v) => {
    pending = "Saved.";
    store.update((p) => { p.taxes.hsa = { ...(p.taxes.hsa ?? {}), coverage: v.coverage, contribution: v.contribution ?? 0, employer: v.employer ?? 0, fsa: v.fsa ?? 0, fsaSpent: v.fsaSpent ?? 0 }; });
  }, { submitLabel: "Save" });
  root.append(ui.h("details", { class: "card fold fold-card", open: d.hasHsa || d.hasFsa ? null : true },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "This year's figures"), ui.h("span", { class: "fold-status" }, H.total > 0 ? `HSA ${money(H.total)}` : "not set"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "The HSA contribution also lowers the Federal estimate page's income. An HSA account on the Net worth page is counted in the growth figure."), form)));
  root.append(ui.card("Why an HSA comes first",
    ui.h("ul", { class: "records" }, [
      ["Three tax breaks, not two", "A 401(k) skips tax going in and pays it coming out; a Roth is the reverse. The HSA skips both, and the payroll tax as well when it comes from a paycheck."],
      ["Pay cash now, reimburse later", "Receipts never expire: pay today's medical bills from your own pocket, let the HSA grow for decades, and reimburse yourself tax-free whenever you like."],
      ["Medicare and the deadline", "Contributions must stop six months before Medicare starts. Contributions for a year can be made until the April filing deadline."],
      ["FSA is different", "An FSA is a spending account, not a savings account: the money is spent within the year, and unspent balances are forfeited apart from the small carryover."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
  ));
}
