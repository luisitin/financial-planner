// modules/investments/employer-stock/view.js -- DOM only. Your employer's stock: how much of your invested
// wealth rides on it (owned and still to vest), what a halving would take while your pay depends on the same
// company, the next year's vests and the tax gap at 22%, how to get under 10% and what it costs; the company
// and the grants in folds.
import { compute, LIMIT, SUPPLEMENTAL, DEFAULT_GRANT } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.es-root .es-flag { color: var(--warn); font-weight: 650; }
.es-root .es-bad { color: var(--bad); font-weight: 650; }
.es-root .es-bar { height: 12px; border-radius: 6px; background: var(--panel-2); border: 1px solid var(--line); overflow: hidden; margin: 10px 0 4px; position: relative; }
.es-root .es-bar span { display: block; height: 100%; background: var(--accent); }
.es-root .es-bar i { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--text); }
.es-root .es-d { color: var(--text-2); font-size: var(--fs-sm); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "es-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const eq = plan.equity ?? {};

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Your employer's stock"),
      ui.h("p", { class: "lede" }, "Shares of the company you work for, and stock it has promised you, put your pay and your savings on the same bet. This page shows how big that bet is and how to shrink it."),
      ui.h("p", { class: "muted small" }, "Start with the company's stock symbol and today's price; then add any grants (restricted stock units or options) from your company's stock plan site.")));
    root.append(companyForm(true));
    return;
  }

  // the headline
  const barShare = Math.min(1, d.share ?? 1);
  root.append(ui.card(null, ui.row(
    ui.stat(`${d.symbol || "Company"} stock, yours and promised`, money(d.exposure), `${money(d.owned)} yours now, ${money(d.unvested)} still to vest`),
    ui.stat("Of your invested wealth", d.share === null ? "—" : pct(d.share), `the usual ceiling for one company is ${pct(LIMIT.ok)}`),
  ), ui.h("div", { class: "es-bar", role: "img", "aria-label": `${d.share === null ? "" : pct(d.share)} of invested wealth, against a ${pct(LIMIT.ok)} ceiling` }, ui.h("span", { style: { width: `${barShare * 100}%` } }), ui.h("i", { style: { left: `${LIMIT.ok * 100}%` } })),
  d.level !== "ok" ? ui.h("p", { class: d.level === "large" ? "es-bad" : "es-flag" }, d.level === "large" ? "A large bet on one company: if it struggles, your savings fall just when your job is at risk." : "Above the usual ceiling for a single company.") : ui.h("p", { class: "es-d" }, "Within the usual ceiling.")));

  // the double risk
  root.append(ui.card("If the company had a bad year", ui.h("p", {}, ui.h("b", {}, `If the price halved, you would lose about ${money(d.stress.loss)}`), d.pay > 0 ? `, at the same time as ${d.person ? `${d.person}'s` : "your"} ${money(d.pay)} a year of pay depends on the same company.` : "."),
    ui.h("p", { class: "es-d" }, "Companies that fail often take their staff's savings with them: Enron's employees in 2001 lost their jobs and much of their 401(k)s, which held mostly Enron stock.")));

  // what is held and granted
  const recs = [
    ...d.held.map((h) => ({ title: `${h.shares} shares in ${h.account}`, value: h.value, sub: `${h.bucket === "taxable" ? `paid ${money(h.cost)}; ${h.gain >= 0 ? "gain" : "loss"} ${money(Math.abs(h.gain))} (taxed if sold)` : "inside a retirement plan: no tax to sell and switch funds"}` })),
    ...d.grants.map((g) => ({ title: g.name, value: g.vestedValue + g.unvestedValue, sub: `${g.kind === "option" ? `${g.shares} options at ${money(g.strike)}` : `${g.shares} units`}: ${g.vested} vested, ${g.unvested} to come${g.next ? `; next ${g.next.shares} on ${shortDate(g.next.date)}` : ""}${g.kind === "option" ? `; worth the price above ${money(g.strike)}${g.expires ? `, until ${shortDate(g.expires)}` : ""}` : "; vested units are counted once they are listed on Holdings"}` })),
  ];
  root.append(ui.card(`What you hold at ${money(d.price)} a share`, ui.h("ul", { class: "records" }, recs.map((r) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.title), ui.h("span", { class: "rec-value" }, money(r.value))), ui.h("div", { class: "rec-sub" }, r.sub)))),
    d.priceAsOf ? ui.h("p", { class: "muted small" }, `Price from ${shortDate(d.priceAsOf)}.`) : null,
    d.expiringSoon.length ? ui.h("p", { class: "es-flag" }, `${d.expiringSoon.map((g) => `${g.name} (${shortDate(g.expires)})`).join(", ")}: these options run out within a year, and any not exercised by then are lost.`) : null));

  // the next year's vests
  if (d.vests.length) {
    const tot = d.vests.reduce((s, v) => s + v.value, 0), stateOwed = d.vests.reduce((s, v) => s + v.stateOwed, 0);
    root.append(ui.card("Vesting in the next year", ui.h("ul", { class: "records" }, d.vests.map((v) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${shortDate(v.date)} · ${v.shares} units`), ui.h("span", { class: "rec-value" }, money(v.value))), ui.h("div", { class: "rec-sub" }, `${v.grant}; ${money(v.withheld)} federal tax withheld`)))),
      ui.h("p", {}, `${money(tot)} of pay in all: vesting units are taxed like wages on their value that day. Employers withhold ${pct(SUPPLEMENTAL.rate)} for federal tax; your top rate is ${pct(d.rates.marginal)}.`),
      d.vestGap > 1 ? ui.h("p", { class: "es-flag" }, `Set aside about ${money(d.vestGap)} more for April${stateOwed > 0 ? `, plus about ${money(stateOwed)} of state tax if your employer withholds none` : ""}.`) : ui.h("p", { class: "es-d" }, `The ${pct(SUPPLEMENTAL.rate)} withheld covers the federal tax at your rate.`),
      ui.h("p", { class: "es-d" }, "Selling units the day they vest costs no more tax: their cost is the value they were taxed at.")));
  }

  // getting under the ceiling
  if (d.diversify) {
    const x = d.diversify;
    root.append(ui.card(`Getting under ${pct(LIMIT.ok)}`, ui.h("p", {}, `Selling about ${money(x.sell)} of the shares you hold and spreading it over a broad fund brings the stake to ${x.after === null ? "—" : pct(x.after)}.`),
      ui.h("ul", {},
        x.fromPlans > 0 ? ui.h("li", {}, `${money(x.fromPlans)} inside your retirement plan: no tax at all; switch funds on the plan's site.`) : null,
        x.fromTaxable > 0 ? ui.h("li", {}, `${money(x.fromTaxable)} in the brokerage: about ${money(x.tax)} of tax on the gain (${pct(d.rates.gains)} for shares held over a year).`) : null,
        x.stillOver ? ui.h("li", {}, "Even then it stays above the ceiling because of grants still to vest or options not yet exercised: sell new units as they vest, and plan when to exercise options.") : null),
      ui.h("p", { class: "es-d" }, "Company stock with a large gain inside a 401(k): before selling it, ask about net unrealized appreciation (NUA), which can tax that gain at the lower rate when you leave the job. Selling a little every quarter on a fixed plan avoids guessing the best day.")));
  }

  root.append(companyForm(false));
  root.append(grantsFold());
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/investments/holdings" }, "Holdings"), ui.h("a", { class: "btn secondary", href: "#/investments/allocation" }, "Allocation"))));

  function companyForm(open) {
    const form = ui.form([
      { key: "symbol", label: "Company stock symbol", type: "text", placeholder: "e.g. ACME" },
      { key: "price", label: "Price of one share today", type: "money", min: 0 },
      { key: "personId", label: "Who works there", type: "select", options: [{ value: "", label: "Whoever has a salary" }, ...(plan.household?.people ?? []).filter((p) => p.role !== "dependent").map((p) => ({ value: p.id, label: p.name }))] },
    ], { symbol: eq.symbol ?? "", price: eq.price ?? "", personId: eq.personId ?? "" }, (v) => {
      if (!String(v.symbol ?? "").trim() && !(eq.grants ?? []).length) { form.prepend(ui.notice("error", "Type the company's stock symbol first.")); return; }
      pending = "Saved.";
      store.update((p) => { p.equity = { ...(p.equity ?? {}), symbol: String(v.symbol ?? "").trim().toUpperCase(), price: v.price ?? null, priceAsOf: v.price ? today : (p.equity?.priceAsOf ?? null), personId: v.personId || "" }; });
    }, { submitLabel: "Save" });
    return ui.h("details", { class: "card fold fold-card", open: open ? true : null }, ui.h("summary", {}, ui.h("h2", {}, "The company"), ui.h("span", { class: "fold-status" }, d.ready && d.symbol ? `${d.symbol} at ${money(d.price)}` : "symbol and price"), ui.h("span", { class: "fold-chev" }, "›")), form);
  }
  function grantsFold() {
    const list = eq.grants ?? [];
    const form = ui.form([
      { key: "kind", label: "Kind", type: "select", options: [{ value: "rsu", label: "Restricted stock units (shares given as they vest)" }, { value: "option", label: "Stock options (the right to buy at a set price)" }] },
      { key: "name", label: "Name", type: "text", placeholder: "e.g. 2025 new-hire grant" },
      { key: "shares", label: "Units or options granted", type: "number", min: 1, step: "1" },
      { key: "strike", label: "Options: the price you pay per share", type: "money", min: 0 },
      { key: "vestStart", label: "Vesting starts", type: "date", help: "usually the grant or start date" },
      { key: "vestMonths", label: "Months until fully vested", type: "number", min: 1, max: 120, step: "1" },
      { key: "cliffMonths", label: "Months before the first vest (the cliff)", type: "number", min: 0, max: 60, step: "1" },
      { key: "every", label: "Then vests every ... months", type: "number", min: 1, max: 12, step: "1" },
    ], { kind: "rsu", ...DEFAULT_GRANT }, (v) => {
      if (!(v.shares > 0) || !v.vestStart) { form.prepend(ui.notice("error", "Type how many units or options and when vesting starts.")); return; }
      pending = `${v.name || "Grant"} added.`;
      store.update((p) => { p.equity = p.equity ?? {}; p.equity.grants = [...(p.equity.grants ?? []), { id: ui.uid(), kind: v.kind, name: String(v.name ?? "").trim(), granted: v.vestStart, vestStart: v.vestStart, shares: Math.floor(v.shares), strike: v.kind === "option" ? v.strike ?? 0 : null, vestMonths: v.vestMonths ?? DEFAULT_GRANT.vestMonths, cliffMonths: v.cliffMonths ?? DEFAULT_GRANT.cliffMonths, every: v.every ?? DEFAULT_GRANT.every }]; });
    }, { submitLabel: "Add grant" });
    const rows = list.map((g) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, g.name || (g.kind === "option" ? "Stock options" : "Restricted stock units")), ui.button("Remove", () => {
      pending = `${g.name || "Grant"} removed.`;
      store.update((p) => { p.equity.grants = (p.equity.grants ?? []).filter((x) => x.id !== g.id); });
    }, { class: "secondary small" })), ui.h("div", { class: "rec-sub" }, `${g.shares} ${g.kind === "option" ? `options at ${money(g.strike)}` : "units"}, from ${shortDate(g.vestStart)} over ${g.vestMonths ?? DEFAULT_GRANT.vestMonths} months`)));
    return ui.h("details", { class: "card fold fold-card", open: list.length ? null : true }, ui.h("summary", {}, ui.h("h2", {}, list.length ? "+ Add another grant" : "Grants from your company"), ui.h("span", { class: "fold-status" }, list.length ? `${list.length} grant${list.length === 1 ? "" : "s"}` : "none yet"), ui.h("span", { class: "fold-chev" }, "›")),
      list.length ? ui.h("ul", { class: "records" }, rows) : null, form);
  }
}
