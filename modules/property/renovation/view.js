// modules/property/renovation/view.js -- DOM only. A home project: what it adds to the home's value against
// its cost, each way to pay (a month, the interest, the cost in today's money, the risk; the cheapest marked),
// the cash cushion and the equity to borrow against; the project and the offers in folds.
import { compute, PROJECTS, DEFAULTS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.rv-root .rv-list { list-style: none; margin: 0; padding: 0; }
.rv-root .rv-list li { padding: 11px 0; border-bottom: 1px solid var(--line); }
.rv-root .rv-list li:last-child { border-bottom: 0; }
.rv-root .rv-head { display: flex; justify-content: space-between; gap: 12px; font-weight: 650; }
.rv-root .rv-head span:last-child { white-space: nowrap; }
.rv-root .rv-best .rv-head span:last-child { color: var(--ok); }
.rv-root .rv-d { color: var(--text-2); font-size: var(--fs-sm); }
.rv-root .rv-risk { color: var(--warn); font-size: var(--fs-sm); }
.rv-root .rv-off { opacity: .6; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "rv-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const s = plan.whatIfs?.renovation ?? {};
  const best = d.ways.find((w) => w.id === d.best);

  if (!s.cost) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "A home project"),
    ui.h("p", { class: "lede" }, "Some projects add more to a home's price than they cost; most add less, and the rest is the pleasure of living with them. This page weighs that, and the cheapest way to pay."),
    ui.h("p", { class: "muted small" }, `Showing a ${money(d.cost)} ${d.project.label.toLowerCase()} until you choose your own project below.`)));

  root.append(ui.card(null, ui.row(
    ui.stat("Adds to the home's value", money(d.valueAdded), `about ${pct(d.recoup)} of its ${money(d.cost)} cost`),
    best ? ui.stat("Cheapest way to pay", best.label, best.id === "cash" ? "no interest at all" : `about ${money(best.today)} more than cash, in today's money`) : null,
  ), ui.h("p", {}, d.equityChange >= 0 ? `The home should gain about ${money(d.equityChange)} more than the project costs.` : `About ${money(-d.equityChange)} of the cost is for living with it rather than for the sale price; worth it if you will enjoy it for years.`)));

  root.append(ui.card("Ways to pay", ui.h("ul", { class: "rv-list" }, d.ways.map((w) => ui.h("li", { class: [w.id === d.best ? "rv-best" : "", w.fits ? "" : "rv-off"].join(" ").trim() || null },
    ui.h("div", { class: "rv-head" }, ui.h("span", {}, w.label), ui.h("span", {}, w.id === "cash" ? money(d.cost) + " now" : w.id === "refi" ? `${w.monthly >= 0 ? "+" : "−"}${money(Math.abs(w.monthly))} a month` : `${money(w.monthly)} a month`)),
    ui.h("div", { class: "rv-d" }, w.id === "cash" ? w.note : `${w.id === "refi" ? `${w.note.replace("the whole mortgage", `the whole ${money(d.mortgage.owed)} mortgage`)}. ${money(w.interest)} more interest than keeping the mortgage as it is` : `${w.note}. ${money(w.interest)} of interest`}${w.fees ? ` and ${money(w.fees)} of costs` : ""}${w.taxSaved > 1 ? `, ${money(w.taxSaved)} back in tax` : w.deductible && !d.itemizes ? " (deductible only if you itemize)" : ""}; ${money(w.today)} more than cash in today's money.`),
    w.risk ? ui.h("div", { class: "rv-risk" }, w.risk) : null,
    !w.fits && w.id !== "cash" ? ui.h("div", { class: "rv-risk" }, "Not enough equity to borrow this much.") : null))),
    ui.h("p", { class: "muted small" }, `"In today's money" counts that money paid later could earn ${(d.discount * 100).toFixed(1)}% a year meanwhile (the plan's own return), so a long cheap loan can beat a short dear one.`)));

  const c = d.cushion;
  root.append(ui.card("Your cushion and your equity", ui.h("ul", {},
    ui.h("li", {}, c.after >= 0 ? `Paying cash leaves ${money(c.after)} of usable cash${c.monthsAfter !== null ? `, about ${c.monthsAfter.toFixed(1)} months of essential spending` : ""}${c.target ? ` (your target is ${money(c.target)})` : ""}.` : `Usable cash is ${money(c.now)}: not enough to pay cash${c.target ? `, and it is meant for emergencies (target ${money(c.target)})` : ""}.`),
    d.home ? ui.h("li", {}, `${d.home.name}: worth ${money(d.home.value)}, ${money(d.home.mortgage)} owed. Lenders usually lend up to ${pct(d.inputs.cltv)} of the value in all, so about ${money(d.home.borrowable)} could be borrowed against it.`) : ui.h("li", {}, "Add the home on Accounts (as Real estate) to see the equity you could borrow against."))));

  root.append(ui.h("details", { class: "card fold fold-card", open: s.cost ? null : true }, ui.h("summary", {}, ui.h("h2", {}, "The project"), ui.h("span", { class: "fold-status" }, `${money(d.cost)}`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([
      { key: "project", label: "What you are doing", type: "select", options: Object.entries(PROJECTS).map(([value, p]) => ({ value, label: `${p.label} (adds about ${pct(p.recoup)})` })) },
      { key: "cost", label: "What it will cost", type: "money", min: 0 },
      { key: "recoup", label: "Value it adds, as a share of the cost", type: "percent", min: 0, max: 300, help: "empty: the national average for the project (2024 Cost vs. Value report); an agent's view of your area is better" },
    ], { project: d.project.id, cost: s.cost ?? "", recoup: s.recoup ?? "" }, (v) => {
      if (!(v.cost > 0)) return;
      pending = "Saved.";
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.renovation = { ...(p.whatIfs.renovation ?? {}), project: v.project, cost: v.cost, recoup: v.recoup ?? null }; });
    }, { submitLabel: "Compare" })));
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "The offers"), ui.h("span", { class: "fold-status" }, "rates and terms"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([
      { key: "helocRate", label: "Home-equity line rate", type: "percent", min: 0, max: 20 },
      { key: "helocYears", label: "Years to repay it", type: "number", min: 1, max: 30, step: "1" },
      { key: "refiRate", label: "Refinance rate", type: "percent", min: 0, max: 15 },
      { key: "refiYears", label: "Refinance length (years)", type: "number", min: 10, max: 30, step: "5" },
      { key: "refiCosts", label: "Refinance closing costs", type: "percent", min: 0, max: 8 },
      { key: "loanRate", label: "Personal loan rate", type: "percent", min: 0, max: 36 },
      { key: "loanYears", label: "Personal loan length (years)", type: "number", min: 1, max: 12, step: "1" },
    ], Object.fromEntries(["helocRate", "helocYears", "refiRate", "refiYears", "refiCosts", "loanRate", "loanYears"].map((k) => [k, s[k] ?? DEFAULTS[k]])), (v) => {
      pending = "Saved.";
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.renovation = { ...(p.whatIfs.renovation ?? {}), ...v }; });
    }, { submitLabel: "Compare" })));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/balance/liquidity" }, "Emergency fund"), ui.h("a", { class: "btn secondary", href: "#/debt/mortgage" }, "Mortgage"))));
}
