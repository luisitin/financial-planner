// modules/retirement/buckets/view.js -- DOM only. The three buckets as one bar and three lines, the stock
// share they leave against the plan's, how to refill them, and the years in each (a fold).
import { compute, DEFAULTS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.bk-root .bk-bar { display: flex; height: 28px; border-radius: 8px; overflow: hidden; margin: 6px 0 12px; border: 1px solid var(--line); }
.bk-root .bk-bar span { display: block; height: 100%; }
.bk-root .bk-cash { background: color-mix(in srgb, var(--accent) 22%, var(--panel)); } .bk-root .bk-bonds { background: color-mix(in srgb, var(--accent) 55%, var(--panel)); } .bk-root .bk-stocks { background: var(--accent); }
.bk-root .bk-list { list-style: none; margin: 0; padding: 0; }
.bk-root .bk-list li { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.bk-root .bk-list li:last-child { border-bottom: 0; }
.bk-root .bk-dot { flex: none; width: 14px; height: 14px; border-radius: 4px; margin-top: 3px; }
.bk-root .bk-body { flex: 1; min-width: 0; }
.bk-root .bk-t { font-weight: 600; }
.bk-root .bk-d { color: var(--text-2); font-size: var(--fs-sm); }
.bk-root .bk-v { flex: none; text-align: right; white-space: nowrap; }
.bk-root .bk-v span { display: block; color: var(--muted); font-size: var(--fs-xs); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 100) * 100, cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "bk-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Three buckets"),
    ui.h("p", { class: "lede" }, "A simple way to hold savings in retirement: the next couple of years of withdrawals in cash, the years after in bonds, the rest in stocks. When stocks fall you live on the cash and bonds and never have to sell low; in good years you top the buckets up from stocks.")));
  if (!d.ready) { root.append(ui.card(null, ui.h("p", { class: "muted" }, `It needs your plan first: ${d.missing.join("; ")}.`), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Will the money last?")))); return; }
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  const colors = { cash: "bk-cash", bonds: "bk-bonds", stocks: "bk-stocks" };
  root.append(ui.card(`When you retire (${d.retireYear}): ${money(d.savings)}`,
    ui.h("div", { class: "bk-bar", role: "img", "aria-label": d.buckets.map((b) => `${b.key} ${pct(b.share)}`).join(", ") }, d.buckets.filter((b) => b.share > 0).map((b) => ui.h("span", { class: colors[b.key], style: { width: `${b.share * 100}%` } }))),
    ui.h("ul", { class: "bk-list" }, d.buckets.map((b) => ui.h("li", {},
      ui.h("span", { class: `bk-dot ${colors[b.key]}` }),
      ui.h("span", { class: "bk-body" }, ui.h("div", { class: "bk-t" }, b.label), ui.h("div", { class: "bk-d" }, b.to ? `${b.from} to ${b.to}${b.key === "bonds" ? ", at what bonds earn above inflation" : ""}` : `${b.from} on`)),
      ui.h("span", { class: "bk-v" }, money(b.amount), ui.h("span", {}, pct(b.share)))))),
    ui.h("p", { class: "bk-d", style: { marginTop: "10px" } }, `The buckets leave ${pct(d.impliedStocks)} in stocks; your plan assumes ${pct(d.planStocks)} in retirement. ${d.impliedStocks > d.planStocks + 0.05 ? "With this much set aside for the next ten years, more of the rest can stay in stocks." : d.impliedStocks < d.planStocks - 0.05 ? "The withdrawals are large next to the savings: the buckets need more in cash and bonds than the plan holds." : "About the same."} Money in today's dollars.`)));

  root.append(ui.card("The withdrawals it covers", ui.h("p", { class: "bk-d" }, "Each year's spending and tax less Social Security, pensions and other guaranteed income, from your plan:"),
    ui.h("ul", { class: "bk-list" }, d.draws.slice(0, d.cashYears + d.bondYears).map((x, i) => ui.h("li", {}, ui.h("span", { class: `bk-dot ${i < d.cashYears ? "bk-cash" : "bk-bonds"}` }), ui.h("span", { class: "bk-body" }, `${x.year}`, ui.h("div", { class: "bk-d" }, `age ${x.age}`)), ui.h("span", { class: "bk-v" }, money(x.draw)))))));

  root.append(ui.card("Keeping them full", ui.h("ul", {},
    ui.h("li", {}, "Once a year, spend from cash. After a year when stocks rose, refill the cash (and the bonds) by selling stocks."),
    ui.h("li", {}, "After a year when stocks fell, refill the cash from bonds instead, and leave stocks alone to recover."),
    ui.h("li", {}, "Inside retirement accounts, buckets are just labels: sell and buy within the account without tax."))));

  const s = plan.retirement?.buckets ?? {};
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Years in each bucket"), ui.h("span", { class: "fold-status" }, `${d.cashYears} in cash, ${d.bondYears} in bonds`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([
      { key: "cashYears", label: "Years of withdrawals in cash", type: "number", min: 1, max: 5, step: "1", help: `${DEFAULTS.cashYears} if empty` },
      { key: "bondYears", label: "Years in bonds after that", type: "number", min: 0, max: 20, step: "1", help: `${DEFAULTS.bondYears} if empty` },
    ], { cashYears: s.cashYears ?? "", bondYears: s.bondYears ?? "" }, (v) => {
      pending = "Saved.";
      store.update((p) => { p.retirement = p.retirement ?? {}; p.retirement.buckets = { cashYears: v.cashYears ?? null, bondYears: v.bondYears ?? null }; });
    }, { submitLabel: "Save" })));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/sequence-risk" }, "Order of returns"), ui.h("a", { class: "btn secondary", href: "#/retirement/withdrawal-order" }, "Withdrawal order"))));
}
