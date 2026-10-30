// modules/insurance/cash-value/view.js -- DOM only. Each permanent policy on file as an investment: what
// it has earned, what cashing in leaves after tax, and keep or cash in, with the figures from the
// statement and an in-force illustration in a fold under it.
import { compute } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.cv-root .cv-verdict { font-weight: 650; margin: 8px 0 4px; }
.cv-root .cv-verdict.ok { color: var(--ok); } .cv-root .cv-verdict.warn { color: var(--warn); }
.cv-root .cv-d { color: var(--text-2); }
`;

const FIELDS = (laterYears) => [
  { key: "yearsPaid", label: "Years of premiums paid so far", type: "number", min: 0, step: "1" },
  { key: "surrenderValue", label: "What cashing in would pay today", type: "money", min: 0, help: "the surrender value on the statement: cash value less any surrender charge and loans" },
  { key: "basis", label: "Premiums paid in total (optional)", type: "money", min: 0, help: "empty: the premium a year times the years paid" },
  { key: "laterYears", label: "Years ahead to compare", type: "number", min: 1, max: 40, step: "1" },
  { key: "cashValueLater", label: `Cash value then, from an in-force illustration`, type: "money", min: 0, help: `ask the insurer for an "in-force illustration"; use the projected column ${laterYears} years ahead` },
  { key: "termQuote", label: "Term premium a year for the same cover", type: "money", min: 0, help: "0 if the family no longer needs the cover" },
];

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const pct = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
  const rate = (x) => (x < -0.0005 ? `−${pct(-x)} (a loss)` : pct(x));
  const d = compute(plan);
  const root = ui.h("div", { class: "cv-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.count) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "A policy with a cash value"),
      ui.h("p", { class: "lede" }, "Whole and universal life policies build a cash value. This page works out what that value has really earned on your premiums, and whether keeping the policy beats cashing it in and buying term."),
      ui.h("p", { class: "muted small" }, "Add the policy on Policies as \"Whole or universal life\" with its cash value from the latest statement."),
      ui.row(ui.h("a", { class: "btn", href: "#/insurance/policies" }, "Add the policy"), ui.h("a", { class: "btn secondary", href: "#/insurance/term-vs-permanent" }, "Thinking of buying one?"))));
    return;
  }

  for (const x of d.items) {
    const card = ui.card(x.name);
    card.append(ui.row(
      ui.stat("Cash in today", money(x.netCash), x.tax > 0 ? `${money(x.surrender)} less about ${money(x.tax)} tax on the gain` : x.gain !== null ? "no tax: less than the premiums paid" : "before any tax"),
      ui.stat("Earned so far", x.pastReturn === null ? "?" : rate(x.pastReturn), x.pastReturn === null ? "enter the years paid below" : `a year on ${money(x.basis ?? x.premiumYearly * x.yearsPaid)} of premiums`),
    ));
    if (x.keepReturn !== null) card.append(ui.h("p", { class: "cv-d" }, `If you keep paying ${money(x.premiumYearly)} a year, the illustration's ${money(x.cashValueLater)} in ${x.laterYears} years is a return of ${rate(x.keepReturn)} a year on what you leave in (the ${money(x.surrender)} you could take out today) and the premiums still to come. The death benefit of ${money(x.benefit)} stays in force meanwhile.`));
    if (x.verdict) {
      const alt = x.termQuote > 0 ? `cash in (${money(x.netCash)} after tax), buy term for ${money(x.termQuote)} a year and invest the other ${money(Math.max(0, x.premiumYearly - x.termQuote))} a year` : `cash in (${money(x.netCash)} after tax) and invest it with the ${money(x.premiumYearly)} a year`;
      card.append(ui.h("p", { class: `cv-verdict ${x.verdict === "keep" ? "ok" : "warn"}` }, x.verdict === "keep" ? `Keeping it looks better, by about ${money(x.cashValueLater - x.altValue)} in ${x.laterYears} years.` : x.verdict === "cash-in" ? `Cashing in and buying term looks better, by about ${money(x.altValue - x.cashValueLater)} in ${x.laterYears} years.` : "The two come out about even."),
        ui.h("p", { class: "cv-d" }, `The other way, ${alt}, comes to about ${money(x.altValue)} in ${x.laterYears} years at ${pct(d.returnRate)} a year, against ${money(x.cashValueLater)} of cash value. ${x.breakeven !== null ? `Keeping wins when investments would earn less than ${rate(x.breakeven)} a year.` : ""}`),
        x.verdict !== "keep" ? ui.notice("warn", "Never cancel a policy before the new cover is in force: a medical exam can change the term price, or rule it out. A \"1035 exchange\" can move the cash value into another policy or an annuity without tax.") : null);
    } else if (x.missing.length) card.append(ui.h("p", { class: "muted small" }, `To compare keeping it with cashing in: ${x.missing.join("; ")}.`));

    const p0 = plan.insurance.policies.find((y) => y.id === x.id) ?? {};
    const fold = ui.h("details", { class: "fold", style: { marginTop: "10px" } }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "From the statement and the illustration"), ui.h("span", { class: "fold-status" }, x.missing.length ? `${x.missing.length} to fill in` : "all entered"), ui.h("span", { class: "fold-chev" }, "›")));
    if (x.missing.length && !x.yearsPaid) fold.open = true;
    fold.append(ui.form(FIELDS(x.laterYears), { yearsPaid: p0.yearsPaid ?? "", surrenderValue: p0.surrenderValue ?? "", basis: p0.basis ?? "", laterYears: x.laterYears, cashValueLater: p0.cashValueLater ?? "", termQuote: p0.termQuote ?? "" }, (v) => {
      pending = `${x.name} saved.`;
      store.update((p) => { const t = p.insurance.policies.find((y) => y.id === x.id); if (t) for (const f of FIELDS(0)) t[f.key] = v[f.key] ?? null; });
    }, { submitLabel: "Save" }));
    card.append(fold);
    root.append(card);
  }
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/insurance/life-needs" }, "Is the cover still needed?"), ui.h("a", { class: "btn secondary", href: "#/insurance/term-vs-permanent" }, "Term vs permanent"))));
}
