// modules/taxes/brackets/view.js -- DOM only. Your bracket and the room left in it first,
// then what more income would cost, then the whole ladder with your part of each rung filled.
import { compute } from "./compute.js";
import { statusLabel } from "../../../core/math/tax.js";

let extra = 10000;

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), extra });
  const money = (n) => fmt.money(n, cur);
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasIncome ? `${d.whose ? `${d.whose} is` : "You are"} in the ${fmt.pct(d.bracketRate, 0)} bracket` : "Which bracket are you in?"),
    ui.h("p", { class: "lede" }, d.hasIncome
      ? `${d.whose ? `Filing separately, each of you has your own ladder; this is ${d.whose}'s return. ` : ""}${money(d.ordinaryTaxable)} of ordinary taxable income in ${d.year}${Number.isFinite(d.roomInBracket) ? `, with ${money(d.roomInBracket)} of room before the ${fmt.pct(d.nextRate, 0)} rate starts` : ", the top rate"}. Only the dollars inside each rung pay that rung's rate: overall ${d.whose ? "the two of you pay" : "you pay"} ${fmt.pct(d.effectiveRate, 1)}.${d.qualifiedNote ? ` ${d.qualifiedNote}` : ""}`
      : "Brackets are steps: each slice of income pays its own rate, so moving up a bracket never costs you money on the dollars below it. Add income on the Income page or the Federal estimate page to see where you stand."),
  ));
  if (d.hasIncome) root.append(ui.card(null, ui.row(
    ui.stat("Bracket", fmt.pct(d.bracketRate, 0), `${statusLabel(d.filingStatus).toLowerCase()}, ${d.year}`),
    ui.stat("Room left", Number.isFinite(d.roomInBracket) ? money(d.roomInBracket) : "no limit", Number.isFinite(d.roomInBracket) ? `before ${fmt.pct(d.nextRate, 0)}` : "the top rate"),
    ui.stat("Next dollar", fmt.pct(d.marginal, 0), d.marginal > d.bracketRate + 0.005 ? "more than the bracket: benefits or gains get pulled along" : "what it really costs"),
    ui.stat("Deductions", money(d.deduction), "come off before the ladder"),
  )));
  if (d.hasIncome && d.separate) root.append(ui.card("Two returns",
    ui.h("ul", { class: "records" }, d.separate.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${x.name ?? "Spouse"}'s return`, x.shown ? ui.h("span", { class: "pill accent" }, "shown here") : null), ui.h("span", { class: "rec-value" }, fmt.pct(x.bracketRate, 0))),
      ui.h("div", { class: "rec-sub" }, `${money(x.taxableIncome)} taxable${Number.isFinite(x.roomInBracket) ? `, ${money(x.roomInBracket)} of room in the bracket` : ""}; ${money(x.totalTax)} of tax`)))),
    ui.h("p", { class: "muted small" }, `More income below is added to ${d.whose}'s return. The overall rate above is for both returns together.`),
  ));
  // what more income would cost
  const amounts = [5000, 10000, 25000, 50000, 100000];
  const chips = ui.h("div", { class: "chips" }, amounts.map((a) => ui.h("button", { type: "button", class: `chip${a === extra ? " on" : ""}`, onClick: () => { extra = a; root.replaceChildren(); render(root, ctx); } }, `+${fmt.money(a, cur)}`)));
  const custom = ui.input({ type: "number", value: extra, min: 0, step: "1000", inputmode: "numeric", "aria-label": "Extra income", onChange: (e) => { extra = Math.max(0, Number(e.target.value) || 0); root.replaceChildren(); render(root, ctx); } });
  root.append(ui.card("What more income would cost",
    ui.h("p", { class: "muted small" }, "A raise, a bonus, a Roth conversion, an IRA withdrawal: the tax on the extra alone, through every rung it crosses (and any Social Security or gains it drags into tax)."),
    chips, ui.h("div", { class: "form" }, ui.field("Or an amount", custom)),
    d.extra ? ui.row(
      ui.stat("Extra tax", money(d.extra.tax), `on ${money(d.extra.amount)} more`),
      ui.stat("Rate on it", fmt.pct(d.extra.rate, 1), d.extra.bracketRate !== d.bracketRate ? `ends in the ${fmt.pct(d.extra.bracketRate, 0)} bracket` : `stays in the ${fmt.pct(d.bracketRate, 0)} bracket`),
      ui.stat("You keep", money(d.extra.keep), "before state tax"),
    ) : null,
    d.above.length ? ui.h("ul", { class: "records" }, d.above.map((s) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, Number.isFinite(s.amount) ? `The next ${money(s.amount)}` : "Everything above that"), ui.h("span", { class: "rec-value" }, `at ${fmt.pct(s.rate, 0)}`)), Number.isFinite(s.tax) ? ui.h("div", { class: "rec-sub" }, `${money(s.tax)} of tax on that slice`) : null))) : null,
  ));
  root.append(ui.card(`The ${d.year} ladder`,
    ui.h("p", { class: "muted small" }, "Ordinary taxable income only (after deductions). The bar shows how much of each rung you fill."),
    ui.h("ul", { class: "records" }, d.ladder.map((l) => ui.h("li", { style: l.current ? { background: "var(--accent-soft)", borderRadius: "8px" } : null },
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${fmt.pct(l.rate, 0)}`, l.current ? ui.h("span", { class: "pill accent" }, "you are here") : null), ui.h("span", { class: "rec-value" }, Number.isFinite(l.to) ? `${money(l.from)} to ${money(l.to)}` : `over ${money(l.from)}`)),
      ui.h("div", { class: "rec-sub" }, l.filled > 0 ? `${money(l.filled)} of yours: ${money(l.tax)} of tax` : "none of yours"),
      l.width ? ui.h("div", { class: "progress", style: { margin: "6px 0 0" } }, ui.h("span", { style: { width: `${Math.round(Math.min(1, l.filled / l.width) * 100)}%` } })) : null))),
    d.isIndexed ? ui.h("p", { class: "muted small" }, `No official ${d.year} table yet: the last one, inflated.`) : null,
  ));
}
