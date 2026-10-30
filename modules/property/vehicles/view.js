// modules/property/vehicles/view.js -- DOM only. Each car's real cost a year and per mile, line by line; keep
// it, buy new or lease over the same years, the cheapest marked; each car's details and the offers in folds.
import { compute, DEFAULTS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.vh-root .vh-lines { list-style: none; margin: 0; padding: 0; }
.vh-root .vh-lines li { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line); }
.vh-root .vh-lines li:last-child { border-bottom: 0; font-weight: 700; }
.vh-root .vh-lines li span:last-child { white-space: nowrap; font-variant-numeric: tabular-nums; }
.vh-root .vh-list { list-style: none; margin: 0; padding: 0; }
.vh-root .vh-list li { padding: 11px 0; border-bottom: 1px solid var(--line); }
.vh-root .vh-list li:last-child { border-bottom: 0; }
.vh-root .vh-head { display: flex; justify-content: space-between; gap: 12px; font-weight: 650; }
.vh-root .vh-head span:last-child { white-space: nowrap; }
.vh-root .vh-best .vh-head span:last-child { color: var(--ok); }
.vh-root .vh-d { color: var(--text-2); font-size: var(--fs-sm); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "vh-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "What your cars cost"),
      ui.h("p", { class: "lede" }, "A car costs far more than its payment: the value it loses, fuel, insurance, repairs. This page adds it up per year and per mile, and compares keeping it with buying new or leasing."),
      ui.h("p", { class: "muted small" }, "Add the car below, or on Accounts as a Vehicle with what it is worth.")));
    root.append(details(null, true));
    return;
  }

  root.append(ui.card(null, ui.row(
    ui.stat(d.cars.length === 1 ? "Your car costs, a year" : `Your ${d.cars.length} cars cost, a year`, money(d.total), `${money(d.monthly)} a month, everything counted`),
    d.cars.length === 1 && d.cars[0].year.perMile !== null ? ui.stat("Per mile", fmt.money(d.cars[0].year.perMile, cur, "en-US", 2), `at ${Number(d.cars[0].details.milesYear ?? DEFAULTS.car.milesYear).toLocaleString("en-US")} miles a year`) : null,
  )));

  for (const c of d.cars) root.append(ui.card(`${c.name}${d.cars.length > 1 && c.year.perMile !== null ? ` · ${fmt.money(c.year.perMile, cur, "en-US", 2)} a mile` : ""}`,
    ui.h("ul", { class: "vh-lines" }, [...c.year.lines.map((l) => ui.h("li", {}, ui.h("span", {}, l.label), ui.h("span", {}, money(l.amount)))), ui.h("li", {}, ui.h("span", {}, "A year"), ui.h("span", {}, money(c.year.total)))]),
    ui.h("p", { class: "vh-d" }, `Worth ${money(c.value)}${c.loan ? `, ${money(c.loan.balance)} still owed on ${c.loan.name}` : ""}. The value it loses is a real cost even though no bill comes: it shows when you sell.`),
    details(c, false)));

  // keep, buy or lease
  const cmp = d.comparison, chosen = d.cars.find((c) => (c.accountId ?? c.id) === d.chosen);
  const best = cmp.options.find((o) => o.id === d.best);
  const keep = cmp.options[0];
  root.append(ui.card(`Keep, buy or lease: the next ${cmp.years} years`, d.cars.length > 1 ? ui.h("p", { class: "vh-d" }, `For ${chosen.name}.`) : null,
    ui.h("ul", { class: "vh-list" }, cmp.options.map((o) => ui.h("li", { class: o.id === d.best ? "vh-best" : null },
      ui.h("div", { class: "vh-head" }, ui.h("span", {}, o.label), ui.h("span", {}, `${money(o.monthly)} a month`)),
      ui.h("div", { class: "vh-d" }, `${money(o.out)} paid over ${cmp.years} years${o.back > 0.5 ? `, less ${money(o.back)} it is worth at the end` : ""}: ${money(o.cost)} in all.${o.id === "keep" ? ` Upkeep is counted rising ${Math.round(d.inputs.upkeepRise * 100)}% a year as it ages.` : o.id === "buy" ? ` ${money(cmp.newPayment)} a month on ${money(cmp.financed)} borrowed for ${d.inputs.newTermMonths} months${o.owedAtEnd > 0 ? `; ${money(o.owedAtEnd)} still owed at the end` : ""}.` : ` ${o.terms} lease${o.terms === 1 ? "" : "s"} of ${d.inputs.leaseMonths} months; nothing owned at the end.`}`)))),
    cmp.tradeIn < 0 ? ui.h("p", { class: "vh-d" }, `It is worth ${money(-cmp.tradeIn)} less than its loan: trading it in means paying that first (counted above), or rolling it into the new loan.`) : null,
    ui.h("p", {}, best.id === "keep" ? `Keeping it is cheapest by ${money(Math.min(...cmp.options.filter((o) => o.id !== "keep").map((o) => o.cost)) - keep.cost)}. Replace it when repairs start to cost more than the value it is losing, or when it is no longer safe.` : `${best.label} is cheapest, by ${money(keep.cost - best.cost)} against keeping it.`)));

  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "The new car and the lease"), ui.h("span", { class: "fold-status" }, `${money(d.inputs.newPrice)}, lease ${money(d.inputs.leaseMonthly)}`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([
      d.cars.length > 1 ? { key: "car", label: "Compare for", type: "select", options: d.cars.map((c) => ({ value: c.accountId ?? c.id, label: c.name })) } : null,
      { key: "years", label: "Years to compare", type: "number", min: 1, max: 15, step: "1" },
      { key: "newPrice", label: "New car's price", type: "money", min: 0 },
      { key: "newSalesTax", label: "Sales tax", type: "percent", min: 0, max: 15 },
      { key: "newMpg", label: "New car's miles per gallon", type: "number", min: 1, max: 150 },
      { key: "newRate", label: "Car loan rate", type: "percent", min: 0, max: 30 },
      { key: "newTermMonths", label: "Car loan length (months)", type: "number", min: 12, max: 96, step: "12" },
      { key: "newDown", label: "Cash down, beyond the trade-in", type: "money", min: 0 },
      { key: "leaseMonthly", label: "Lease payment a month", type: "money", min: 0 },
      { key: "leaseDue", label: "Due at signing", type: "money", min: 0 },
      { key: "leaseMonths", label: "Lease length (months)", type: "number", min: 12, max: 60, step: "12" },
      { key: "leaseMiles", label: "Miles a year the lease allows", type: "number", min: 0, step: "1000" },
      { key: "leaseExcess", label: "Charge per mile over", type: "money", min: 0, step: "0.01" },
    ].filter(Boolean), { ...d.inputs, car: d.chosen }, (v) => {
      pending = "Saved.";
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.vehicles = { ...(p.whatIfs.vehicles ?? {}), ...v }; });
    }, { submitLabel: "Compare" })));
  root.append(details(null, false));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/goals/vehicle" }, "Save for a car"), ui.h("a", { class: "btn secondary", href: "#/insurance/property" }, "Home and car insurance"))));

  // a car's details (stored as a property entry linked to its vehicle account)
  function details(c, open) {
    const e = c?.details ?? {};
    const loans = (plan.accounts ?? []).filter((a) => a.type === "loan");
    const form = ui.form([
      c ? null : { key: "name", label: "Which car", type: "text", placeholder: "e.g. 2018 hatchback" },
      c?.accountId ? null : { key: "value", label: "What it is worth today", type: "money", min: 0, help: "a used-car guide's private-sale value" },
      { key: "milesYear", label: "Miles a year", type: "number", min: 0, step: "500" },
      { key: "mpg", label: "Miles per gallon", type: "number", min: 1, max: 150 },
      { key: "fuelPrice", label: "Fuel price a gallon", type: "money", min: 0, step: "0.01" },
      { key: "insuranceYear", label: "Insurance a year", type: "money", min: 0 },
      { key: "maintenanceYear", label: "Upkeep and repairs a year", type: "money", min: 0 },
      { key: "registrationYear", label: "Registration and fees a year", type: "money", min: 0 },
      { key: "loss", label: "Value it loses a year", type: "percent", min: 0, max: 50 },
      { key: "loanAccountId", label: "Its loan", type: "select", options: [{ value: "", label: "None" }, ...loans.map((a) => ({ value: a.id, label: a.name }))] },
    ].filter(Boolean), { ...DEFAULTS.car, ...e, loanAccountId: e.loanAccountId ?? "" }, (v) => {
      if (!c && !(v.value > 0)) { form.prepend(ui.notice("error", "Type what the car is worth today.")); return; }
      pending = c ? "Saved." : `${v.name || "Car"} added.`;
      store.update((p) => {
        p.property = p.property ?? [];
        const base = c?.id ? p.property.find((x) => x.id === c.id) : null;
        const item = { ...(base ?? { id: ui.uid(), kind: "vehicle", accountId: c?.accountId ?? null }), ...v, name: c ? (base?.name ?? "") : String(v.name ?? "").trim() };
        p.property = base ? p.property.map((x) => (x.id === base.id ? item : x)) : [...p.property, item];
      });
    }, { submitLabel: c ? "Save" : "Add car" });
    return ui.h("details", { class: c ? "fold" : "card fold fold-card", open: open ? true : null }, ui.h("summary", {}, ui.h(c ? "strong" : "h2", {}, c ? "Change its details" : d.ready ? "+ Add another car" : "Add a car"), ui.h("span", { class: "fold-chev" }, "›")), form);
  }
}
