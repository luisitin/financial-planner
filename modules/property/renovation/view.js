// modules/property/renovation/view.js -- DOM only. A home project: what it adds to the home's value against
// its cost, each way to pay (a month, the interest, the cost in today's money, the risk; the cheapest marked),
// the cash cushion and the equity to borrow against; the project and the offers in "The figures" (the project first, the
// rates and terms under "More details (optional)"). An empty refinance or personal loan rate box shows our guess in gray
// (smart guesses C9, K3): counted in the answer while it stays empty, never saved; opening the page writes nothing.
import { compute, PROJECTS, DEFAULTS, PREVIEWED, PREVIEW_KEYS } from "./compute.js";
import { previewText } from "../../goals/house/compute.js";
import { withA } from "../../../core/words.js";
import { parts, links } from "../../../core/ui/more.js";

let pending = null;   // the confirmation shown on the next render
let worked = false;
const WORKED = Symbol("worked");   // "Compare" was tapped: the green line says the new answer, and "The figures" stays open (R7, R17)

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
  // our guesses for the empty rate boxes (ctx.guess), passed to compute as previews; a saved figure is the person's
  const s = plan.whatIfs?.renovation ?? {};
  const blank = (k) => s[k] === null || s[k] === undefined || s[k] === "";
  const ask = (key, opts) => { if (typeof ctx.guess !== "function") return null; try { const e = ctx.guess(key, opts); return e && typeof e.value === "number" && Number.isFinite(e.value) ? e : null; } catch { return null; } };
  const g = {};
  for (const k of PREVIEWED) if (blank(k)) g[k] = ask(PREVIEW_KEYS[k]);
  const d = compute(plan, { today: fmt.today(), previews: Object.fromEntries(PREVIEWED.map((k) => [k, g[k]?.value ?? null])) });
  const shown = new Set(d.previewed ?? []);
  const root = ui.h("div", { class: "rv-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const best = d.ways.find((w) => w.id === d.best);
  if (pending === WORKED) pending = best ? `Saved. The cheapest way to pay: ${best.label.toLowerCase()}.` : "Saved.";
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const keepOpen = worked; worked = false;

  if (!s.cost) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "A home project"),
    ui.h("p", { class: "lede" }, "Some projects add more to a home's price than they cost; most add less, and the rest is the pleasure of living with them. This page weighs that, and the cheapest way to pay."),
    ui.h("p", { class: "muted small" }, `Showing ${withA(money(d.cost))} ${d.project.label.toLowerCase()} until you choose your own project below.`)));

  root.append(ui.card(null, ui.row(
    ui.stat("Adds to the home's value", money(d.valueAdded), `about ${pct(d.recoup)} of its ${money(d.cost)} cost`),
    best ? ui.stat("Cheapest way to pay", best.label, best.id === "cash" ? "no interest at all" : `about ${money(best.today)} more than cash, in today's dollars`) : null,
  ), ui.h("p", {}, d.equityChange >= 0 ? `The home should gain about ${money(d.equityChange)} more than the project costs.` : `About ${money(-d.equityChange)} of the cost is for living with it rather than for the sale price; worth it if you will enjoy it for years.`)));

  root.append(ui.card("Ways to pay", ui.h("ul", { class: "rv-list" }, d.ways.map((w) => ui.h("li", { class: [w.id === d.best ? "rv-best" : "", w.fits ? "" : "rv-off"].join(" ").trim() || null },
    ui.h("div", { class: "rv-head" }, ui.h("span", {}, w.label), ui.h("span", {}, w.id === "cash" ? money(d.cost) + " now" : w.id === "refi" ? `${w.monthly >= 0 ? "+" : "−"}${money(Math.abs(w.monthly))} a month` : `${money(w.monthly)} a month`)),
    ui.h("div", { class: "rv-d" }, w.id === "cash" ? w.note : `${w.id === "refi" ? `${w.note.replace("the whole mortgage", `the whole ${money(d.mortgage.owed)} mortgage`)}. ${w.interest >= 0 ? `${money(w.interest)} more` : `${money(-w.interest)} less`} interest than keeping the mortgage as it is` : `${w.note}. ${money(w.interest)} of interest`}${w.fees ? ` and ${money(w.fees)} of costs` : ""}${w.taxSaved > 1 ? `, ${money(w.taxSaved)} back in tax` : w.taxSaved < -1 ? `, but ${money(-w.taxSaved)} less back in tax than the mortgage it replaces` : w.deductible && !d.itemizes ? " (deductible only if you itemize)" : ""}; ${w.today >= 0 ? `${money(w.today)} more` : `${money(-w.today)} less`} than cash in today's dollars.`),
    w.deductible && d.itemizes && w.deductibleShare < 0.995 ? ui.h("div", { class: "rv-d" }, w.id === "refi" ? `Only part of its interest is deductible: not on the closing costs rolled in${(d.mortgage.owed + d.cost) > (d.limit ?? 750000) ? `, nor on home debt past ${money(d.limit ?? 750000)}` : ""}.` : `Only the interest on the first ${money(d.limit ?? 750000)} of home debt is deductible, so about ${pct(w.deductibleShare)} of this line's.`) : null,
    w.risk ? ui.h("div", { class: "rv-risk" }, w.risk) : null,
    !w.fits && w.id === "refi" ? ui.h("div", { class: "rv-risk" }, `A cash-out refinance is usually limited to ${pct(d.inputs.refiLtv)} of the home's value; this one would be ${pct(w.ltv)}.`) : !w.fits && w.id !== "cash" ? ui.h("div", { class: "rv-risk" }, "Not enough equity to borrow this much.") : null))),
    ui.h("p", { class: "muted small" }, `"In today's dollars" allows for the ${(d.discount * 100).toFixed(1)}% a year money could earn meanwhile, so a long, cheap loan can beat a short, expensive one.`)));

  const c = d.cushion;
  root.append(ui.card("Your emergency fund and your equity", ui.h("ul", {},
    ui.h("li", {}, c.after >= 0 ? `Paying cash leaves ${money(c.after)} of usable cash${c.monthsAfter !== null ? `, about ${fmt.monthsWords(c.monthsAfter)} of essential spending` : ""}${c.target ? ` (your target is ${money(c.target)})` : ""}.` : `Usable cash is ${money(c.now)}: not enough to pay cash${c.target ? `, and it is meant for emergencies (target ${money(c.target)})` : ""}.`),
    d.home ? ui.h("li", {}, `${d.home.name}: worth ${money(d.home.value)}, ${money(d.home.mortgage)} owed. Lenders usually lend up to ${pct(d.inputs.cltv)} of the value in all, so about ${money(d.home.borrowable)} could be borrowed against it.`) : ui.h("li", {}, "Add the home on Net worth (as Real estate) to see the equity you could borrow against."))));

  // The figures: the project first (what it is, its cost, what it adds), then the offers' rates and terms under "More details
  // (optional)". A rate box with our guess is empty with the gray figure; a box with no guess is empty and its help says what
  // an empty box counts (no example sits in a box). The ways to pay above say "(our guess)" beside a guessed rate.
  const ours = (k) => `Our guess: ${g[k].why}${/[.!?]$/.test(g[k].why) ? "" : "."}`;
  const pctNum = (r) => Number((r * 100).toFixed(2));
  const rateField = (key, label, max) => ({ key, label, type: "percent", min: 0, max, more: true,
    placeholder: shown.has(key) ? previewText(g[key].value, "percent") : "", help: shown.has(key) ? ours(key) : `Left empty, we count ${pctNum(DEFAULTS[key])}% a year.` });
  const yearsField = (key, label, min, max, step) => ({ key, label, type: "number", min, max, step, more: true, help: `Left empty, we count ${DEFAULTS[key]} years.` });
  const fields = [
    { key: "project", label: "What you are doing", type: "select", options: Object.entries(PROJECTS).map(([value, p]) => ({ value, label: `${p.label} (adds about ${pct(p.recoup)})` })) },
    // needed: an empty box made Compare do nothing at all (x-2); the browser now says so at the box and puts the cursor there
    { key: "cost", label: "What it will cost", type: "money", min: 1, required: true },
    { key: "recoup", label: "Value it adds, as a share of the cost", type: "percent", min: 0, max: 300, placeholder: "", help: "Left empty, we count the national average for this kind of project." },
    rateField("helocRate", "Home-equity line rate", 20),
    yearsField("helocYears", "Years to repay it", 1, 30, "1"),
    rateField("refiRate", "Refinance rate", 15),
    yearsField("refiYears", "Refinance length (years)", 10, 30, "5"),
    { key: "refiCosts", label: "Refinance closing costs", type: "percent", min: 0, max: 8, more: true, placeholder: "", help: `Left empty, we count ${pctNum(DEFAULTS.refiCosts)}% of the new loan.` },
    rateField("loanRate", "Personal loan rate", 36),
    yearsField("loanYears", "Personal loan length (years)", 1, 12, "1"),
  ];
  const OFFERS = ["helocRate", "helocYears", "refiRate", "refiYears", "refiCosts", "loanRate", "loanYears"];
  // the boxes show what was saved, else nothing: a rate box with our guess opens empty (gray)
  const values = { project: d.project.id, cost: s.cost ?? "", recoup: s.recoup ?? "", ...Object.fromEntries(OFFERS.map((k) => [k, blank(k) ? null : Number(s[k])])) };
  const form = ui.form(fields, values, (v) => {
    if (!(v.cost > 0)) return;
    pending = WORKED; worked = true;
    // an empty box saves nothing (null): the page counts its gray figure or its stated default, and never writes ours
    store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.renovation = { ...(p.whatIfs.renovation ?? {}), project: v.project, cost: v.cost, recoup: v.recoup ?? null, ...Object.fromEntries(OFFERS.map((k) => [k, v[k] ?? null])) }; });
  }, { submitLabel: "Compare" });
  // asks first (open until the page has a project of the person's own), then folds under the answer (docs/OPTIONAL.md R8)
  root.append(ui.h("div", {}, parts(ctx, { id: "figures", kind: "figures", says: s.cost ? money(d.cost) : "", guess: shown.size, open: !s.cost || keepOpen, holds: fields.map((f) => f.key), body: form })));
  root.append(ui.h("div", {}, links(ctx, [
    { href: "#/balance/liquidity", ask: "Is our emergency fund enough?" },
    { href: "#/debt/mortgage", ask: "What is left on our mortgage?" },
  ])));
}
