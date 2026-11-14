// modules/property/vehicles/view.js -- DOM only. Each car's real cost a year and per mile, line by line; keep
// it, buy new or lease over the same years, the cheapest marked; the comparison's inputs in "The figures" (five boxes, the
// rest under "More details (optional)"); each car's details behind an outlined "Change its details", a new car behind
// "+ Add another car" (open while there is none). An empty new-car loan rate box shows our guess in gray (smart guesses C9,
// K3): counted in the comparison while it stays empty, never saved; opening the page writes nothing.
import { compute, DEFAULTS } from "./compute.js";
import { previewText } from "../../goals/house/compute.js";
import { parts, links } from "../../../core/ui/more.js";

let pending = null;   // the confirmation shown on the next render
let worked = false;
const WORKED = Symbol("worked");   // "Compare" was tapped: the green line says the new answer, and "The figures" stays open (R7, R17)

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
.vh-root .rec-form { padding-top: 14px; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const count = (words) => `Left empty, we count ${words}.`;   // a box's help when it has no gray figure: what an empty box counts
  // our guess for the empty rate box (ctx.guess: the estimator in compute.js), passed to compute as a preview; a saved
  // figure is the person's and is never asked about
  const s = plan.whatIfs?.vehicles ?? {};
  const blank = (k) => s[k] === null || s[k] === undefined || s[k] === "" || !Number.isFinite(Number(s[k]));
  const ask = (key, opts) => { if (typeof ctx.guess !== "function") return null; try { const e = ctx.guess(key, opts); return e && typeof e.value === "number" && Number.isFinite(e.value) ? e : null; } catch { return null; } };
  const g = { newRate: blank("newRate") ? ask("property/vehicles:newRate") : null };
  const d = compute(plan, { today: fmt.today(), previews: { newRate: g.newRate?.value ?? null } });
  const shown = new Set(d.previewed ?? []);
  const root = ui.h("div", { class: "vh-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending === WORKED) {
    const best = d.ready ? d.comparison.options.find((o) => o.id === d.best) : null;
    pending = best ? `Saved. Cheapest over ${d.comparison.years} years: ${best.label.toLowerCase()}, ${money(best.monthly)} a month.` : "Saved.";
  }
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const keepOpen = worked; worked = false;

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "What your cars cost"),
      ui.h("p", { class: "lede" }, "A car costs far more than its payment: the value it loses, fuel, insurance, repairs. This page adds it up per year and per mile, and compares keeping it with buying new or leasing."),
      ui.h("p", { class: "muted small" }, "Add the car below, or on Net worth as a Vehicle with what it is worth.")));
    // an empty list keeps its add form open (docs/OPTIONAL.md R20)
    root.append(ui.card("Add a car", carForm(null)));
    return;
  }

  root.append(ui.card(null, ui.row(
    ui.stat(d.cars.length === 1 ? "Your car costs, a year" : `Your ${d.cars.length} cars cost, a year`, money(d.total), `${money(d.monthly)} a month, everything counted`),
    d.cars.length === 1 && d.cars[0].year.perMile !== null ? ui.stat("Per mile", fmt.money(d.cars[0].year.perMile, cur, "en-US", 2), `at ${Number(d.cars[0].details.milesYear ?? DEFAULTS.car.milesYear).toLocaleString("en-US")} miles a year`) : null,
  )));

  // a form that opens under its outlined button (the kit's openUnder; a plain node after it on the test stand-in): the button
  // stays, a second tap or Cancel shuts the form and the focus goes back to the button. A button swapped for its form left
  // Cancel nothing to go back to: the focus fell to the page and the screen jumped (C9 walk, 2026-11-14).
  const opensUnder = (label, build) => {
    let close = null;
    const shut = () => { const c = close; close = null; c?.(); btn.setAttribute?.("aria-expanded", "false"); };
    const btn = ui.button(label, () => {
      if (close) { shut(); return; }
      if (ui.openUnder && row.parentElement) close = ui.openUnder(row, (holder) => holder.append(build(shut)));
      else { const holder = ui.h("div"); row.after(holder); holder.append(build(shut)); close = () => holder.remove(); }
      btn.setAttribute?.("aria-expanded", "true");
    }, { class: "secondary", "aria-expanded": "false" });
    const row = ui.row(btn);
    return row;
  };

  for (const c of d.cars) {
    // its details open in place under an outlined button (a tap, not a fold); Cancel or a save shuts them again
    root.append(ui.card(`${c.name}${d.cars.length > 1 && c.year.perMile !== null ? ` · ${fmt.money(c.year.perMile, cur, "en-US", 2)} a mile` : ""}`,
      ui.h("ul", { class: "vh-lines" }, [...c.year.lines.map((l) => ui.h("li", {}, ui.h("span", {}, l.label), ui.h("span", {}, money(l.amount)))), ui.h("li", {}, ui.h("span", {}, "A year"), ui.h("span", {}, money(c.year.total)))]),
      ui.h("p", { class: "vh-d" }, `Worth ${money(c.value)}${c.loan ? `, ${money(c.loan.balance)} still owed on ${c.loan.name}` : ""}. The value it loses is a real cost even though no bill comes: it shows when you sell.`),
      opensUnder("Change its details", (shut) => carForm(c, shut))));
  }

  // keep, buy or lease
  const cmp = d.comparison, chosen = d.cars.find((c) => (c.accountId ?? c.id) === d.chosen);
  const best = cmp.options.find((o) => o.id === d.best);
  const keep = cmp.options[0];
  // the loan's rate is our guess while its box is empty: said here, beside the answer, never folded away (docs/OPTIONAL.md R9 #5)
  const rateWords = shown.has("newRate") ? ` at ${Number((d.inputs.newRate * 100).toFixed(2))}% (our guess)` : "";
  root.append(ui.card(`Keep, buy or lease: the next ${cmp.years} years`, d.cars.length > 1 ? ui.h("p", { class: "vh-d" }, `For ${chosen.name}.`) : null,
    ui.h("ul", { class: "vh-list" }, cmp.options.map((o) => ui.h("li", { class: o.id === d.best ? "vh-best" : null },
      ui.h("div", { class: "vh-head" }, ui.h("span", {}, o.label), ui.h("span", {}, `${money(o.monthly)} a month`)),
      ui.h("div", { class: "vh-d" }, o.id === "lease" && cmp.leaseCredit > 0.5
        ? `${money(o.out + cmp.leaseCredit)} paid over ${cmp.years} years, less the ${money(cmp.leaseCredit)} your car brings in: ${money(o.cost)} in all. ${o.terms} lease${o.terms === 1 ? "" : "s"} of ${d.inputs.leaseMonths} months; nothing owned at the end.`
        : `${money(o.out)} paid over ${cmp.years} years${o.back > 0.5 ? `, less ${money(o.back)} it is worth at the end${o.id === "keep" && o.owedAtEnd > 0.5 ? ` after the ${money(o.owedAtEnd)} still owed on its loan` : ""}` : o.id === "keep" && o.owedAtEnd > 0.5 ? `, with ${money(o.owedAtEnd)} still owed on its loan at the end, more than it is worth` : ""}: ${money(o.cost)} in all.${o.id === "keep" ? ` Upkeep is counted rising ${Math.round(d.inputs.upkeepRise * 100)}% a year as it ages; fuel, insurance and registration at today's prices.` : o.id === "buy" ? `${cmp.financed > 0.5 ? ` ${money(cmp.newPayment)} a month on ${money(cmp.financed)} borrowed for ${d.inputs.newTermMonths} months${rateWords}${o.owedAtEnd > 0 ? `; ${money(o.owedAtEnd)} still owed at the end` : ""}.` : ` Nothing to borrow: your car${d.inputs.newDown > 0 ? " and the cash down" : ""} cover the price${cmp.cashBack > 0.5 ? `, with ${money(cmp.cashBack)} back to you (counted above)` : ""}.`} A new car's running costs, upkeep too, at today's prices.` : ` ${o.terms} lease${o.terms === 1 ? "" : "s"} of ${d.inputs.leaseMonths} months; nothing owned at the end.`}`)))),
    cmp.tradeIn < 0 ? ui.h("p", { class: "vh-d" }, `It is worth ${money(-cmp.tradeIn)} less than its loan: trading it in means paying that first (counted above), or rolling it into the new loan.`) : null,
    ui.h("p", {}, best.id === "keep" ? `Keeping it is cheapest by ${money(Math.min(...cmp.options.filter((o) => o.id !== "keep").map((o) => o.cost)) - keep.cost)}. Replace it when repairs start to cost more than the value it is losing, or when it is no longer safe.` : `${best.label} is cheapest, by ${money(keep.cost - best.cost)} against keeping it.`)));

  // The figures: the new car and the lease. The rate box with our guess is empty with the gray figure; a box with no guess is
  // empty and its help says what an empty box counts (no example sits in a box)
  const C = DEFAULTS.compare;
  const fields = [
    d.cars.length > 1 ? { key: "car", label: "Compare for", type: "select", options: d.cars.map((c) => ({ value: c.accountId ?? c.id, label: c.name })) } : null,
    { key: "years", label: "Years to compare", type: "number", min: 1, max: 15, step: "1", help: count(`${C.years} years`) },
    { key: "newPrice", label: "New car's price", type: "money", min: 0, help: count(money(C.newPrice)) },
    { key: "newRate", label: "Car loan rate", type: "percent", min: 0, max: 30, placeholder: shown.has("newRate") ? previewText(g.newRate.value, "percent") : "",
      help: shown.has("newRate") ? `Our guess: ${g.newRate.why}${/[.!?]$/.test(g.newRate.why) ? "" : "."}` : count(`${Number((C.newRate * 100).toFixed(2))}% a year`) },
    // any whole number: a step of 12 (or 500 miles) answered "The two nearest valid values are..." to a plain 66 or 11,200 (W6)
    { key: "newTermMonths", label: "Car loan length (months)", type: "number", min: 12, max: 96, step: "1", help: count(`${C.newTermMonths} months`) },
    { key: "leaseMonthly", label: "Lease payment a month", type: "money", min: 0, help: count(money(C.leaseMonthly)), more: d.cars.length > 1 || undefined },
    { key: "newSalesTax", label: "Sales tax", type: "percent", min: 0, max: 15, placeholder: "", help: count(`${Number((C.newSalesTax * 100).toFixed(2))}% of the price`), more: true },
    { key: "newMpg", label: "New car's miles per gallon", type: "number", min: 1, max: 150, help: count(`${C.newMpg}`), more: true },
    { key: "newDown", label: "Cash down, beyond the trade-in", type: "money", min: 0, help: "Leave it empty if there is none.", more: true },
    { key: "leaseDue", label: "Due at signing", type: "money", min: 0, help: count(money(C.leaseDue)), more: true },
    { key: "leaseMonths", label: "Lease length (months)", type: "number", min: 12, max: 60, step: "1", help: count(`${C.leaseMonths} months`), more: true },
    { key: "leaseMiles", label: "Miles a year the lease allows", type: "number", min: 0, step: "1", help: count(`${C.leaseMiles.toLocaleString("en-US")} miles`), more: true },
    { key: "leaseExcess", label: "Charge per mile over", type: "money", min: 0, step: "0.01", help: count(`${fmt.money(C.leaseExcess, cur, "en-US", 2)} a mile`), more: true },
  ].filter(Boolean);
  // the boxes show what was saved, else nothing: the rate box with our guess opens empty (gray)
  const values = { ...Object.fromEntries(fields.filter((f) => f.key !== "car").map((f) => [f.key, blank(f.key) ? null : Number(s[f.key])])), car: d.chosen };
  const form = ui.form(fields, values, (v) => {
    pending = WORKED; worked = true;
    // an empty box saves nothing (null): the comparison counts its gray figure or its stated default, and never writes ours
    store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.vehicles = { ...(p.whatIfs.vehicles ?? {}), ...Object.fromEntries(fields.map((f) => [f.key, v[f.key] ?? null])) }; });
  }, { submitLabel: "Compare" });
  // the status names the new car's price only once the person typed it: beside "our guess" the stated $35,000 would read as ours
  root.append(ui.h("div", {}, parts(ctx, { id: "figures", kind: "figures", says: blank("newPrice") ? "" : money(d.inputs.newPrice), guess: shown.size, open: keepOpen || undefined, holds: fields.map((f) => f.key), body: form })));

  // another car: behind an outlined button while the list has cars (docs/OPTIONAL.md R20)
  root.append(ui.card(null, opensUnder("+ Add another car", (shut) => carForm(null, shut))));
  root.append(ui.h("div", {}, links(ctx, [
    { href: "#/goals/vehicle", ask: "How to save for a car?" },
    { href: "#/insurance/property", ask: "Is the car insured enough?" },
  ])));

  // a car's details (stored as a property entry linked to its vehicle account): the boxes most cars need first, the rest
  // under "More details (optional)"; an empty box saves nothing and counts the figure its help line names
  function carForm(c, onCancel) {
    const e = c?.details ?? {};
    const K = DEFAULTS.car;
    const loans = (plan.accounts ?? []).filter((a) => a.type === "loan");
    const form = ui.form([
      c ? null : { key: "name", label: "Which car", type: "text", placeholder: "e.g. 2018 hatchback" },
      // needed for a new car: the browser says so at the box and puts the cursor there (DP-2: the message went 300 px above)
      c?.accountId ? null : { key: "value", label: "What it is worth today", type: "money", min: 1, required: !c, help: "a used-car guide's private-sale value" },
      { key: "milesYear", label: "Miles a year", type: "number", min: 0, step: "1", help: count(`${K.milesYear.toLocaleString("en-US")} miles`) },
      { key: "insuranceYear", label: "Insurance a year", type: "money", min: 0, help: count(`${money(K.insuranceYear)} a year`) },
      { key: "loanAccountId", label: "Its loan", type: "select", options: [{ value: "", label: "None" }, ...loans.map((a) => ({ value: a.id, label: a.name }))] },
      { key: "mpg", label: "Miles per gallon", type: "number", min: 1, max: 150, help: count(`${K.mpg}`), more: true },
      { key: "fuelPrice", label: "Fuel price a gallon", type: "money", min: 0, step: "0.01", help: count(fmt.money(K.fuelPrice, cur, "en-US", 2)), more: true },
      { key: "maintenanceYear", label: "Upkeep and repairs a year", type: "money", min: 0, help: count(`${money(K.maintenanceYear)} a year`), more: true },
      { key: "registrationYear", label: "Registration and fees a year", type: "money", min: 0, help: count(`${money(K.registrationYear)} a year`), more: true },
      { key: "loss", label: "Value it loses a year", type: "percent", min: 0, max: 50, placeholder: "", help: count(`${Math.round(K.loss * 100)}% of its value a year`), more: true },
    ].filter(Boolean), { ...Object.fromEntries(Object.keys(K).map((k) => [k, e[k] ?? null])), name: "", value: e.value ?? null, loanAccountId: e.loanAccountId ?? "" }, (v) => {
      if (!c && !(v.value > 0)) { form.prepend(ui.notice("error", "Type what the car is worth today.")); return; }
      pending = c ? "Saved." : `${v.name || "Car"} added.`;
      store.update((p) => {
        p.property = p.property ?? [];
        const base = c?.id ? p.property.find((x) => x.id === c.id) : null;
        const item = { ...(base ?? { id: ui.uid(), kind: "vehicle", accountId: c?.accountId ?? null }), ...v, name: c ? (base?.name ?? "") : String(v.name ?? "").trim() };
        p.property = base ? p.property.map((x) => (x.id === base.id ? item : x)) : [...p.property, item];
      });
    }, { submitLabel: c ? "Save" : "Add car", onCancel });
    return form;
  }
}
