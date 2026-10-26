// modules/taxes/federal/view.js -- DOM only. The year's federal tax first (the figure, the
// refund or bill, the rates), then the walk from income to tax, what the plan already knows,
// and folded forms for the figures only the owner knows.
import { compute } from "./compute.js";
import { FILING_STATUSES } from "../../../core/math/tax.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const r = d.result;
  const money = (n) => fmt.money(n, cur);
  const statusLabel = FILING_STATUSES.find((s) => s.id === d.filingStatus)?.label ?? "Single";
  const owes = r.withheld + r.paid > 0 ? r.balance : null;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasIncome ? `About ${money(r.totalTax)} of federal tax for ${d.year}` : `Federal tax for ${d.year}`),
    ui.h("p", { class: "lede" }, d.hasIncome
      ? `${statusLabel}, ${money(r.income.gross)} of income. That is ${fmt.pct(r.effectiveRate, 1)} of it overall; the next dollar you earn costs ${Math.round(d.marginal * 100)} cents (the ${fmt.pct(r.bracketRate, 0)} bracket${Number.isFinite(r.roomInBracket) ? `, ${money(r.roomInBracket)} of room left in it` : ""}).${owes !== null ? owes > 0 ? ` With ${money(r.withheld + r.paid)} already paid, you would owe about ${money(owes)} at filing time.` : ` With ${money(r.withheld + r.paid)} already paid, you would get about ${money(-owes)} back.` : ""}`
      : "The plan estimates federal income tax from what it knows about your pay, pensions, Social Security and household, plus the figures you type below. Add income on the Income page or type it here."),
    ui.h("p", { class: "muted small" }, `${d.isIndexed ? `No official ${d.year} figures yet: the latest brackets and deductions, inflated. ` : ""}An estimate in the way of the Form 1040, not tax advice: no AMT, business deduction, education or earned-income credits, or state tax.`),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  root.append(ui.card(null, ui.row(
    ui.stat("Federal tax", money(r.totalTax), owes !== null ? owes > 0 ? `${money(owes)} still to pay` : `${money(-owes)} refund` : "before withholding"),
    ui.stat("Of your income", fmt.pct(r.effectiveRate, 1), "the effective rate"),
    ui.stat("On the next dollar", fmt.pct(d.marginal, 0), d.marginal > r.bracketRate + 0.005 ? `more than the ${fmt.pct(r.bracketRate, 0)} bracket: benefits or gains get pulled along` : `the ${fmt.pct(r.bracketRate, 0)} bracket`),
    ui.stat("Taxable income", money(r.taxableIncome), `after ${money(r.deduction.amount)} of deductions`),
  )));
  root.append(ui.card("From income to tax",
    ui.h("ul", { class: "records" }, d.steps.map((s) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, s.label), ui.h("span", { class: "rec-value", style: s.label === "Federal tax" ? { fontWeight: 700 } : null }, s.amount < 0 ? `−${money(-s.amount)}` : money(s.amount))),
      s.sub ? ui.h("div", { class: "rec-sub" }, s.sub) : null))),
  ));
  root.append(ui.card("What the plan already knows",
    ui.h("p", { class: "muted small" }, "Yearly figures from your Income, Contributions and People pages. Blank fields below keep these; a typed figure replaces the plan's."),
    ui.h("ul", { class: "records" }, d.sources.map((s) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, s.label, " ", ui.h("span", { class: s.from === "typed" ? "pill accent" : "pill" }, s.from === "typed" ? "typed" : "from the plan")), ui.h("span", { class: "rec-value" }, s.amount < 0 ? `−${money(-s.amount)}` : money(s.amount))),
      s.detail ? ui.h("div", { class: "rec-sub" }, s.detail) : null))),
    ui.h("p", { class: "muted small" }, `${d.people.adults} adult${d.people.adults === 1 ? "" : "s"}${d.people.ages65plus ? `, ${d.people.ages65plus} aged 65 or more` : ""}; ${d.people.dependentsUnder17} dependent${d.people.dependentsUnder17 === 1 ? "" : "s"} under 17${d.people.otherDependents ? ` and ${d.people.otherDependents} other` : ""}. Filing ${statusLabel.toLowerCase()} (change it on the People page).`),
  ));
  root.append(figuresFold(ctx, d), deductionsFold(ctx, d), yearFold(ctx, d));
  root.append(ui.h("p", { class: "muted small" }, "Brackets, deductions and thresholds: IRS figures for 2024 and 2025 (via the UsTaxes project), 2026 from IRS Revenue Procedure 2025-32. Later years are inflated from the last table."));
}

function figuresFold(ctx, d) {
  const { ui, fmt, store, plan } = ctx;
  const ty = plan.taxes?.thisYear ?? {};
  const FIELDS = [
    { key: "wages", label: "Wages this year", type: "money", min: 0, help: "leave blank to use the Income page (pay less pre-tax 401(k) contributions)" },
    { key: "otherOrdinary", label: "Other ordinary income", type: "money", min: 0, help: "interest, non-qualified dividends, IRA withdrawals, Roth conversions" },
    { key: "qualifiedIncome", label: "Qualified dividends", type: "money", min: 0, help: "taxed at the lower gains rates; long-term gains come from the Capital gains page" },
    { key: "taxExemptInterest", label: "Tax-exempt interest", type: "money", min: 0, help: "municipal bonds; counts toward Social Security taxation only" },
    { key: "socialSecurity", label: "Social Security benefits this year", type: "money", min: 0, help: "leave blank to use the Income page" },
    { key: "adjustments", label: "Other adjustments", type: "money", min: 0, help: "student loan interest, educator expenses; IRA and HSA contributions are counted from their pages" },
    { key: "withheld", label: "Federal tax withheld so far", type: "money", min: 0, help: "from paystubs or last year's W-2 as a guide" },
    { key: "paid", label: "Other payments", type: "money", min: 0, help: "quarterly payments are on the Estimated payments page" },
  ];
  const values = { wages: ty.wages ?? null, otherOrdinary: ty.otherOrdinary || null, qualifiedIncome: ty.qualifiedIncome || null, taxExemptInterest: ty.taxExemptInterest || null, socialSecurity: ty.socialSecurity ?? null, adjustments: ty.adjustments || null, withheld: ty.withheld || null, paid: ty.paid || null };
  const form = ui.form(FIELDS, values, (v) => {
    pending = "Figures saved.";
    store.update((p) => { p.taxes.thisYear = { ...(p.taxes.thisYear ?? {}), wages: v.wages ?? null, otherOrdinary: v.otherOrdinary ?? 0, qualifiedIncome: v.qualifiedIncome ?? 0, taxExemptInterest: v.taxExemptInterest ?? 0, socialSecurity: v.socialSecurity ?? null, adjustments: v.adjustments ?? 0, withheld: v.withheld ?? 0, paid: v.paid ?? 0 }; });
  }, { submitLabel: "Save figures" });
  const typedCount = Object.values(values).filter((v) => v !== null && v !== 0).length;
  return ui.h("details", { class: "card fold fold-card", open: d.hasIncome ? null : true },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Figures the plan cannot see"), ui.h("span", { class: "fold-status" }, typedCount ? `${typedCount} typed` : "none typed"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "Yearly amounts, whole dollars. Your last return or year-end statements have these."), form));
}

function deductionsFold(ctx, d) {
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
  const used = d.result.deduction.used;
  return ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Itemized deductions"), ui.h("span", { class: "fold-status" }, used === "itemized" ? `itemizing: ${fmt.money(d.itemized.total, cur)}` : `standard ${fmt.money(d.result.deduction.standard, cur)} is better`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" },
      ui.h("p", { class: "muted small" }, `You get the larger of the standard deduction (${fmt.money(d.result.deduction.standard, cur)} for you) and these added up (${fmt.money(d.itemized.total, cur)} now). Most households take the standard one.`),
      d.itemized.lines.length ? ui.h("ul", { class: "records" }, d.itemized.lines.map((l) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, l.label), ui.h("span", { class: "rec-value" }, fmt.money(l.amount, cur))), l.note ? ui.h("div", { class: "rec-sub" }, l.note) : null))) : null,
      form));
}

function yearFold(ctx, d) {
  const { ui, fmt, store, plan } = ctx;
  const t = plan.taxes ?? {};
  const thisYear = Number(fmt.today().slice(0, 4));
  const yearOptions = [...new Set([...d.years, thisYear, thisYear + 1])].sort().map((y) => ({ value: String(y), label: `${y}${d.years.includes(y) ? "" : " (inflated from the last table)"}` }));
  const FIELDS = [
    { key: "year", label: "Tax year", type: "select", options: yearOptions },
    { key: "dependentsUnder17", label: "Children under 17 at year end", type: "number", min: 0, step: "1", help: "blank = counted from the People page" },
    { key: "otherDependents", label: "Other dependents", type: "number", min: 0, step: "1", help: "blank = counted from the People page" },
    { key: "blind", label: "Blind (you or your spouse)", type: "number", min: 0, max: 2, step: "1", help: "adds the same allowance as age 65" },
  ];
  const values = { year: String(d.year), dependentsUnder17: t.dependentsUnder17 ?? null, otherDependents: t.otherDependents ?? null, blind: t.blind || null };
  const form = ui.form(FIELDS, values, (v) => {
    pending = "Saved.";
    store.update((p) => { p.taxes.year = Number(v.year) === thisYear ? null : Number(v.year); p.taxes.dependentsUnder17 = v.dependentsUnder17 ?? null; p.taxes.otherDependents = v.otherDependents ?? null; p.taxes.blind = v.blind ?? 0; });
  }, { submitLabel: "Save" });
  return ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Year and people"), ui.h("span", { class: "fold-status" }, `${d.year}`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "Ages come from birth dates on the People page; the filing status is set there too."), form));
}
