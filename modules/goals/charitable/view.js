// modules/goals/charitable/view.js -- DOM only. What a year's giving saves in federal tax and really costs,
// whether bunching several years into one helps, giving grown shares instead of cash, gifts from an IRA
// after 70 1/2, and the figures in a fold.
import { compute, DEFAULTS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.gv-root .gv-list { list-style: none; margin: 0; padding: 0; }
.gv-root .gv-list li { padding: 10px 0; border-bottom: 1px solid var(--line); }
.gv-root .gv-list li:last-child { border-bottom: 0; }
.gv-root .gv-t { font-weight: 600; }
.gv-root .gv-d { color: var(--text-2); font-size: var(--fs-sm); }
.gv-root .gv-ok { color: var(--ok); } .gv-root .gv-warn { color: var(--warn); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "gv-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const saved = !!plan.whatIfs?.charitable || d.fromTaxes > 0;

  if (!saved) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Giving"),
    ui.h("p", { class: "lede" }, "What your giving does to your taxes, and ways to give the same and pay less: bunching gifts into one year, giving shares that have grown, and, after 70 1/2, giving straight from an IRA. The figures use an example of $3,000 a year: put in your own below.")));
  for (const w of d.warnings) root.append(ui.notice("info", w));

  root.append(ui.card(`Giving ${money(d.yearly)} a year`, ui.row(
    ui.stat("Tax it saves", money(d.saved), d.withGift.used === "itemized" ? "you itemize" : "with the standard deduction"),
    ui.stat("What it really costs you", money(d.netCost), `${Math.round(d.savedShare * 100)}% comes back as lower tax`),
  ), ui.h("p", { class: "gv-d" }, d.withGift.used === "itemized" ? `Your itemized deductions (${money(d.withGift.itemized)}) beat the standard deduction (${money(d.withGift.standard)}), so gifts count in full above a small floor (0.5% of income).` : `You take the standard deduction (${money(d.withGift.standard)}); from 2026 people who do so can still deduct up to $1,000 of cash gifts ($2,000 on a joint return).`)));

  const b = d.bunch;
  const list = ui.h("ul", { class: "gv-list" },
    ui.h("li", {}, ui.h("div", { class: "gv-t" }, `Bunching: ${b.years} years of gifts in one year`), ui.h("div", { class: `gv-d ${b.saving > 0.5 ? "gv-ok" : ""}` }, b.saving > 0.5 ? `Giving ${money(b.gift)} in one year and nothing the next ${b.years - 1} saves about ${money(b.saving)} over the ${b.years} years. A donor-advised fund lets you take the deduction now and send the money to charities over the years.` : b.saving < -0.5 ? `It would cost about ${money(-b.saving)} more: even ${money(b.gift)} in one year does not beat the standard deduction, and the $1,000 / $2,000 deduction for cash gifts is used only once instead of every year.` : "It makes no difference for you.")),
    ui.h("li", {}, ui.h("div", { class: "gv-t" }, "Give shares that have grown, not cash"), ui.h("div", { class: "gv-d" }, `If ${Math.round(d.gainShare * 100)}% of a ${money(d.yearly)} gift of shares is growth, giving the shares instead of selling them and giving the cash avoids about ${money(d.stock.taxAvoided)} of capital gains tax. Keep the cash and buy the shares back if you like them.`)),
    ui.h("li", {}, ui.h("div", { class: "gv-t" }, "From an IRA after 70 1/2"), ui.h("div", { class: "gv-d" }, d.qcd.eligible ? `${d.qcd.names.join(" and ")} can give straight from an IRA (a qualified charitable distribution): never taxed, it counts toward required withdrawals, and it helps even with the standard deduction.` : "From 70 1/2, gifts can go straight from an IRA to charity, never taxed and counting toward required withdrawals. Worth planning for.")));
  root.append(ui.card("Give the same, pay less", list));

  const s = plan.whatIfs?.charitable ?? {};
  root.append(ui.h("details", { class: "card fold fold-card", open: saved ? null : true }, ui.h("summary", {}, ui.h("h2", {}, "The figures"), ui.h("span", { class: "fold-status" }, `${money(d.yearly)} a year`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([
      { key: "yearly", label: "What you give a year", type: "money", min: 0, help: d.fromTaxes ? `empty: ${money(d.fromTaxes)} from the Federal estimate page` : "empty: an example of $3,000" },
      { key: "bunchYears", label: "Years to bunch together", type: "number", min: 2, max: 5, step: "1", help: `${DEFAULTS.bunchYears} if empty` },
      { key: "gainShare", label: "Share of shares' value that is growth", type: "percent", min: 0, max: 100, help: "on the brokerage's cost-basis page; 50% if empty" },
    ], { yearly: s.yearly ?? "", bunchYears: s.bunchYears ?? "", gainShare: s.gainShare ?? null }, (v) => {
      pending = "Saved.";
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.charitable = { yearly: v.yearly ?? null, bunchYears: v.bunchYears ?? null, gainShare: v.gainShare ?? null }; });
    }, { submitLabel: "Work it out" })));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/taxes/federal" }, "Federal estimate"), ui.h("a", { class: "btn secondary", href: "#/estate/legacy" }, "Legacy goals"))));
}
