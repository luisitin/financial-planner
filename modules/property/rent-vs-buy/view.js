// modules/property/rent-vs-buy/view.js -- DOM only. Who comes out ahead after the years you choose, the
// year buying pulls ahead, the rent at which they are even, both households' money year by year as a
// chart, the first year's monthly costs side by side, and every figure in one form ("The figures": five boxes, the rest
// under "More details (optional)"). An empty price, rent, rate, property tax or insurance box shows our guess in gray (smart
// guesses C9, K3): counted in the answer while it stays empty, never saved; opening the page writes nothing.
import { compute, simulate, DEFAULTS, PREVIEWED, PREVIEW_KEYS } from "./compute.js";
import { guessedWords, previewText, placeOf } from "../../goals/house/compute.js";
import { lineChart } from "../../retirement/charts.js";
import { parts, links } from "../../../core/ui/more.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.rb-root .rb-list { list-style: none; margin: 0; padding: 0; }
.rb-root .rb-list li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.rb-root .rb-list li:last-child { border-bottom: 0; }
.rb-root .rb-list b { white-space: nowrap; }
.rb-root .rb-key { display: flex; gap: 14px; flex-wrap: wrap; font-size: var(--fs-xs); color: var(--muted); margin: 6px 0; }
.rb-root .rb-key i { display: inline-block; width: 18px; height: 0; border-top: 3px solid; vertical-align: middle; margin-right: 6px; }
.rb-root .rb-verdict { font-weight: 650; margin: 8px 0; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  // our guesses for the empty boxes (ctx.guess), passed to compute as previews; a saved figure is the person's
  const s = plan.whatIfs?.rentVsBuy ?? {};
  const blank = (k) => s[k] === null || s[k] === undefined || s[k] === "" || !Number.isFinite(Number(s[k]));
  const ask = (key, opts) => { if (typeof ctx.guess !== "function") return null; try { const e = ctx.guess(key, opts); return e && typeof e.value === "number" && Number.isFinite(e.value) ? e : null; } catch { return null; } };
  const g = {};
  for (const k of PREVIEWED) if (k !== "insuranceRate" && blank(k)) g[k] = ask(PREVIEW_KEYS[k]);
  if (blank("insuranceRate")) g.insuranceRate = ask(PREVIEW_KEYS.insuranceRate, { args: { price: blank("price") ? g.price?.value ?? null : Number(s.price) } });
  const d = compute(plan, { previews: Object.fromEntries(PREVIEWED.map((k) => [k, g[k]?.value ?? null])) });
  const x = d.inputs;
  const shown = new Set(d.previewed ?? []);
  const where = placeOf(plan);
  const root = ui.h("div", { class: "rb-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const keepOpen = !!pending;   // after "Compare" the figures stay open for the next try (R17)
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const saved = !!plan.whatIfs?.rentVsBuy;
  // nothing saved and our typical home counted: the whole answer is an example until the person puts in theirs, and the page
  // says so first (critic e9 P1: an empty plan read "Renting ahead by $101,610" as if it were about them)
  const example = !saved && shown.has("price");
  const theirRent = !shown.has("rentMonthly") || g.rentMonthly?.basis === "yours";
  const home = example ? `An example: a typical ${where === "the U.S." ? "U.S." : where} home of ${money(x.price)}, ${Math.round(x.downShare * 100)}% down` : `A ${money(x.price)} home with ${Math.round(x.downShare * 100)}% down`;

  root.append(ui.h("section", { class: saved ? "card" : "card accent hero" },
    saved ? null : ui.h("h1", {}, "Rent or buy?"),
    ui.h("p", { class: saved ? "" : "lede" }, `${home}, against renting a similar one for ${money(x.rentMonthly)} a month and investing what buying would have cost up front (${money(d.upfront)}) and each year at ${(x.investReturn * 100).toFixed(1)}%.`),
    saved ? null : ui.h("p", { class: "muted small" }, shown.size ? "Put in yours below: an empty box counts the gray figure." : "These are example figures: change them below to the home and the rent you are weighing."),
    // which figures are our guesses: said beside the answer, never folded away (docs/OPTIONAL.md R9 #5); while nothing is saved
    // the sentence above says the gray figures count, so the line waits for the save
    shown.size && saved ? ui.h("p", { class: "muted small" }, guessedWords([...shown])) : null));

  const e = d.atEnd;
  root.append(ui.card(`After ${e.year} years`, ui.row(
    ui.stat(`${example ? "Example: " : ""}${e.winner === "buy" ? (example ? "buying" : "Buying") : example ? "renting" : "Renting"} ahead by`, money(Math.abs(e.ahead)), `buyer ${money(e.buyerWealth)}, renter ${money(e.renterWealth)}`),
    ui.stat("Buying pulls ahead", d.breakevenYear ? `after ${d.breakevenYear} year${d.breakevenYear === 1 ? "" : "s"}` : "not in 40 years", d.breakevenYear ? "if you stay that long" : "renting stays cheaper"),
  ), ui.h("p", { class: "rb-verdict" }, d.rentEven !== null ? `Over ${e.year} years the two come out even at a rent of about ${money(d.rentEven)} a month: ${theirRent ? "your" : "this"} rent is ${x.rentMonthly > d.rentEven ? "higher, so buying wins" : "lower, so renting wins"}.` : ""),
  ui.h("p", { class: "muted small" }, "If the home were sold that year: the buyer has its value less selling costs and the loan, plus investments; the renter, the investments. Dollars of each year, not adjusted for inflation.")));

  // both households' money, 40 years
  const long = simulate(x, 40).rows;
  root.append(ui.card("Year by year", ui.h("div", { class: "rb-key" }, ui.h("span", {}, ui.h("i", { style: { borderColor: "var(--accent)" } }), "buy"), ui.h("span", {}, ui.h("i", { style: { borderColor: "var(--muted)" } }), "rent and invest")),
    lineChart({ years: long.map((r) => r.year), series: [{ values: long.map((r) => r.renterWealth), color: "var(--muted)", width: 2 }, { values: long.map((r) => r.buyerWealth), color: "var(--accent)" }], marks: d.breakevenYear ? [{ year: d.breakevenYear, label: "even" }] : [], height: 180, label: "Money if sold, buying against renting, by year" })));

  // the first year, a month
  const r1 = d.rows[0];
  root.append(ui.card("The first year, a month", ui.h("ul", { class: "rb-list" },
    ui.h("li", {}, ui.h("span", {}, "Mortgage (interest and principal)"), ui.h("b", {}, money(d.monthlyPI))),
    ui.h("li", {}, ui.h("span", {}, "Property tax, insurance, upkeep" + (x.hoaMonthly ? ", HOA" : "")), ui.h("b", {}, money((r1.propertyTax + r1.insurance + r1.upkeep + r1.hoa) / 12))),
    x.itemize ? ui.h("li", {}, ui.h("span", {}, "Less the tax saved by itemizing"), ui.h("b", {}, `−${money(r1.taxSaving / 12)}`)) : null,
    ui.h("li", {}, ui.h("span", {}, ui.h("b", {}, "Buying")), ui.h("b", {}, money(d.firstYear.buyMonthly))),
    ui.h("li", {}, ui.h("span", {}, ui.h("b", {}, "Renting")), ui.h("b", {}, money(d.firstYear.rentMonthly)))),
    ui.h("p", { class: "muted small" }, `Of the mortgage, about ${money(r1.principal / 12)} a month is principal: it is not a cost, it builds the share of the home you own.`)));

  // The figures: the five boxes most people change, then "More details (optional)". A box with our guess is empty with the
  // gray figure; a folded box with no guess is empty and its help says what an empty box counts (no example sits in a box)
  const ours = (k, own) => (shown.has(k) ? [`Our guess: ${g[k].why}.`, own].filter(Boolean).join(" ") : own);
  const gray = (k, type) => (shown.has(k) ? previewText(g[k].value, type) : type === "percent" ? "" : undefined);
  const pctField = (key, label, help, more) => ({ key, label, type: "percent", min: 0, max: 100, help, placeholder: gray(key, "percent"), more: more || undefined });
  const pct1 = (r) => `${Number((r * 100).toFixed(2))}%`;
  const empty = (k, words) => (shown.has(k) ? "" : `Left empty, we count ${words}.`);
  const fields = [
    { key: "price", label: "Home price", type: "money", min: 0, help: ours("price"), placeholder: gray("price", "money") },
    { key: "rentMonthly", label: "Rent for a similar home, a month", type: "money", min: 0, help: ours("rentMonthly"), placeholder: gray("rentMonthly", "money") },
    // a figure in a box nobody typed says where it comes from (critic e9 P2): black is what Compare saves, gray is our guess
    pctField("downShare", "Down payment", blank("downShare") ? `We start at ${Math.round(DEFAULTS.downShare * 100)}%, which avoids mortgage insurance.` : "20% avoids mortgage insurance."),
    pctField("rate", "Mortgage rate a year", ours("rate")),
    { key: "years", label: "Years you would stay", type: "number", min: 1, max: 40, step: "1", help: blank("years") ? `We start at ${DEFAULTS.years} years.` : undefined },
    { key: "termYears", label: "Mortgage length (years)", type: "number", min: 5, max: 40, step: "1", help: `Left empty, we count ${DEFAULTS.termYears} years.`, more: true },
    pctField("taxRate", "Property tax a year, share of value", ours("taxRate", empty("taxRate", `${pct1(DEFAULTS.taxRate)} of the value; your county lists it`)), true),
    pctField("insuranceRate", "Home insurance a year, share of value", ours("insuranceRate", empty("insuranceRate", `${pct1(DEFAULTS.insuranceRate)} of the value`)), true),
    pctField("maintenanceRate", "Upkeep a year, share of value", `Left empty, we count ${pct1(DEFAULTS.maintenanceRate)} of the value, the usual rule.`, true),
    { key: "hoaMonthly", label: "HOA a month", type: "money", min: 0, help: "Leave it empty if there is none.", more: true },
    pctField("buyCosts", "Closing costs to buy, share of price", `Left empty, we count ${pct1(DEFAULTS.buyCosts)} of the price.`, true),
    pctField("sellCosts", "Costs to sell, share of value", `Left empty, we count ${pct1(DEFAULTS.sellCosts)}: agent and fees.`, true),
    pctField("appreciation", "Home value growth a year", `Left empty, we count ${pct1(DEFAULTS.appreciation)} a year.`, true),
    pctField("rentGrowth", "Rent growth a year", `Left empty, we count ${pct1(DEFAULTS.rentGrowth)} a year.`, true),
    { key: "rentersInsurance", label: "Renters insurance a year", type: "money", min: 0, help: `Left empty, we count ${money(DEFAULTS.rentersInsurance)} a year.`, more: true },
    pctField("investReturn", "Return on invested money a year", "Left empty, we use your plan's own mix, less tax along the way.", true),
    { key: "itemize", label: "We itemize deductions (mortgage interest lowers our tax)", type: "checkbox", help: "Most households take the standard deduction instead.", more: true },
    pctField("marginalRate", "Our top tax rate", `For the itemized saving. Left empty, we count ${pct1(DEFAULTS.marginalRate)}.`, true),
  ];
  // the five boxes show the figures the page works with (an empty one with our guess stays empty, gray); a folded box shows
  // what was saved, else nothing (its help says what an empty box counts)
  const SHOWN_FIRST = ["price", "rentMonthly", "downShare", "rate", "years"];
  const values = Object.fromEntries(fields.map((f) => [f.key, f.type === "checkbox" ? !!s[f.key]
    : shown.has(f.key) ? null
    : SHOWN_FIRST.includes(f.key) ? x[f.key]
    : blank(f.key) ? null : Number(s[f.key])]));
  const form = ui.form(fields, values, (v) => {
    pending = "Saved.";
    store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.rentVsBuy = Object.fromEntries(fields.map((f) => [f.key, f.type === "checkbox" ? !!v[f.key] : v[f.key] ?? null])); });
  }, { submitLabel: "Compare" });
  // asks first (open until the page has an answer of the person's own), then folds under the answer (docs/OPTIONAL.md R8)
  root.append(ui.h("div", {}, parts(ctx, { id: "figures", kind: "figures", says: `${money(x.price)}, ${money(x.rentMonthly)} rent`, guess: shown.size, open: !saved || keepOpen, holds: fields.map((f) => f.key), body: form })));
  root.append(ui.h("div", {}, links(ctx, [
    { href: "#/goals/house", ask: "How much home can we afford?" },
    { href: "#/debt/mortgage", ask: "What is left on our mortgage?" },
  ])));
}
