// modules/goals/house/view.js -- DOM only. How much home the income supports, the home you have in mind a
// month, the cash it takes and when you get there; the figures in one form ("The figures": five boxes, the rest under
// "More details (optional)"), and a button that puts the cash target on the Goals page. An empty price, rate, property
// tax or insurance box shows our guess in gray (smart guesses C9, K3): counted in the answer while it stays empty, never
// saved; opening the page writes nothing. Inside "The figures", "Share these figures" builds a link that carries only the
// home's own figures (core/share-link.js); opened on any phone it fills this page for that visit, and only "Keep these"
// (asked first, with Undo) puts them in the plan.
import { compute, DEFAULTS, FRONT, BACK, guessedWords, previewText, placeOf, previewsOf } from "./compute.js";
import { parts, links } from "../../../core/ui/more.js";
import { defineShare, visitOf, sharedTop, shareBlock, visitGo, NO_LINK } from "../../../core/share-link.js";

/**
 * What a link may carry from this page (core/share-link.js): the home and its loan, never the household's own savings,
 * monthly saving or date (saved, monthly, targetDate stay on the phone they were typed on: `stays`). Ranges are the
 * form's own; a price up to $100 million. Each figure's plain name is said after a share and before Keep.
 */
export const SHARE_SPEC = defineShare({ page: "goals/house", path: ["whatIfs", "house"], stays: ["saved", "monthly", "targetDate"], fields: [
  { key: "price", as: "price", unit: "money", min: 0, max: 1e8, name: "the price" },
  { key: "downShare", as: "down", unit: "percent", min: 0, max: 1, name: "the down payment" },
  { key: "rate", as: "rate", unit: "percent", min: 0, max: 1, name: "the mortgage rate" },
  { key: "closingShare", as: "closing", unit: "percent", min: 0, max: 1, name: "the closing costs" },
  { key: "termYears", as: "term", unit: "whole", min: 5, max: 40, name: "the mortgage length" },
  { key: "taxRate", as: "tax", unit: "percent", min: 0, max: 1, name: "the property tax" },
  { key: "insuranceRate", as: "insurance", unit: "percent", min: 0, max: 1, name: "the home insurance" },
  { key: "hoaMonthly", as: "hoa", unit: "money", min: 0, max: 1e6, name: "the HOA fee" },
  { key: "reserveMonths", as: "reserve", unit: "whole", min: 0, max: 12, name: "the months kept in reserve" },
] });
const SHARED_KEYS = new Set(SHARE_SPEC.fields.map((f) => f.key));
/**
 * The green lines of a shared link (R7: each names the answer), one per case:
 *   kept   "Kept. A $420,000 home: about $3,040 a month."   (no monthly figure: "Kept. A $420,000 home.")
 *   worked "Worked out for this visit: a $420,000 home, about $3,040 a month."   (core/share-link.js adds "Nothing in your plan has changed.")
 */
export function shareWords(d, money) {
  const has = d.monthly !== null && Number.isFinite(d.monthly);
  return {
    kept: has ? `Kept. A ${money(d.inputs.price)} home: about ${money(d.monthly)} a month.` : `Kept. A ${money(d.inputs.price)} home.`,
    worked: has ? `Worked out for this visit: a ${money(d.inputs.price)} home, about ${money(d.monthly)} a month.` : `Worked out for this visit: a ${money(d.inputs.price)} home.`,
  };
}

let pending = null;   // the confirmation shown on the next render
let worked = false;
const WORKED = Symbol("worked");   // "Work it out" was tapped: the green line says the answer, and "The figures" stays open for the next try (A1, F6)

const STYLE = `
.hs-root .hs-list { list-style: none; margin: 0; padding: 0; }
.hs-root .hs-list li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.hs-root .hs-list li:last-child { border-bottom: 0; }
.hs-root .hs-list b { white-space: nowrap; }
`;

export function render(page, ctx) {
  const { ui, fmt, store } = ctx;
  // a shared link in the address (core/share-link.js): the page is drawn from the link's figures for this visit only;
  // the plan itself is untouched (sv.plan is a copy with them in whatIfs.house)
  const sv = visitOf(ctx, SHARE_SPEC);
  const plan = sv.plan;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const monthYear = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? "")); return m ? new Date(Number(m[1]), Number(m[2]) - 1, 15).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : String(iso ?? ""); };
  const today = fmt.today();
  // our guesses for the empty boxes: compute() counts them itself (the estimators in compute.js, as ctx.guess works them), so
  // Your plan quotes the same answer; the box shows the figure the answer counts (x[k]), the help line its reason (previewsOf)
  const s = plan.whatIfs?.house ?? {};
  const blank = (k) => s[k] === null || s[k] === undefined || s[k] === "" || !Number.isFinite(Number(s[k]));
  const d = compute(plan, { today });
  const g = previewsOf(plan, { today });
  const x = d.inputs;
  const shown = new Set(d.previewed ?? []);
  const where = placeOf(plan);
  const root = ui.h("div", { class: "hs-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending === WORKED) pending = d.monthly !== null && Number.isFinite(d.monthly) ? `Saved. A ${money(x.price)} home: about ${money(d.monthly)} a month.` : "Saved.";
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(...sharedTop(ctx, SHARE_SPEC, sv, shareWords(d, money)));
  const keepOpen = worked; worked = false;
  const saved = !!plan.whatIfs?.house;

  if (!saved) root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Saving for a home"),
    ui.h("p", { class: "lede" }, d.fromGoal
      ? `Your "${d.goal.name}" goal of ${fmt.money(d.goalTarget, cur)} buys a home of about ${money(x.price)}: ${pct(x.downShare)} down, closing costs and ${x.reserveMonths} months of payments kept in reserve. Change the figures below to try another home.`
      : `How much home your income supports, what a home would cost a month, the cash you need at closing, and when you will have it. ${shown.size ? `Leave a box empty and we count the gray figure, what is typical for ${where}${where.endsWith(".") ? "" : "."}` : "The figures below are an example: put in the home you have in mind."}`)));
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  if (d.maxPrice !== null) root.append(ui.card("What your income supports", ui.row(
    ui.stat("Up to about", money(d.maxPrice), `with ${pct(x.downShare)} down at ${(x.rate * 100).toFixed(2)}%`),
    ui.stat("This home a month", money(d.monthly), `${pct(d.frontShare)} of income before tax; ${pct(FRONT)} is the usual limit`),
  ), ui.h("p", { class: "muted small" }, `Lenders like housing under ${pct(FRONT)} of income before tax (${money(d.maxFront)} a month for you) and all debt payments under ${pct(BACK)} (${money(d.maxBack)} left after your other loans and cards). The ${d.rule === "front" ? "first" : "second"} is the tighter one for you. "Supports" is not "comfortable": check the budget on Expenses.`)));
  else root.append(ui.card(null, ui.h("p", { class: "muted" }, "Add your pay on the Income page to see what it supports."), ui.row(ui.h("a", { class: "btn secondary", href: "#/cashflow/income" }, "Income"))));

  root.append(ui.card(`A ${money(x.price)} home`, ui.h("ul", { class: "hs-list" },
    ui.h("li", {}, ui.h("span", {}, "Mortgage (principal and interest)"), ui.h("b", {}, money(d.parts.principalInterest))),
    ui.h("li", {}, ui.h("span", {}, "Property tax and insurance"), ui.h("b", {}, money(d.parts.taxInsurance))),
    d.parts.hoa ? ui.h("li", {}, ui.h("span", {}, "HOA"), ui.h("b", {}, money(d.parts.hoa))) : null,
    ui.h("li", {}, ui.h("span", {}, ui.h("b", {}, "A month")), ui.h("b", {}, money(d.monthly)))),
    ui.h("h3", { style: { margin: "14px 0 4px" } }, "Cash needed at closing"),
    ui.h("ul", { class: "hs-list" },
      ui.h("li", {}, ui.h("span", {}, `Down payment (${pct(x.downShare)})`), ui.h("b", {}, money(d.cash.down))),
      ui.h("li", {}, ui.h("span", {}, `Closing costs (about ${pct(x.closingShare)})`), ui.h("b", {}, money(d.cash.closing))),
      ui.h("li", {}, ui.h("span", {}, `Cash left over after buying (${x.reserveMonths} months of the payment)`), ui.h("b", {}, money(d.cash.reserves))),
      ui.h("li", {}, ui.h("span", {}, ui.h("b", {}, "Cash needed")), ui.h("b", {}, money(d.cash.total)))),
    // which figures are our guesses: said next to the answer, never folded away (docs/OPTIONAL.md R9 #5); while nothing is saved
    // the hero's sentence says it ("Leave a box empty and we count the gray figure, ..."), so the line waits for the save
    shown.size && saved ? ui.h("p", { class: "muted small" }, guessedWords([...shown])) : null));

  // when
  const when = ui.card("When you get there");
  const have = `${money(d.saved)} set aside${d.goal ? ` (the "${d.goal.name}" goal)` : ""}`;
  if (d.monthsToGo === 0) when.append(ui.h("p", {}, `You have it: ${have}.`));
  else if (d.monthsToGo !== null) when.append(ui.h("p", {}, Number.isFinite(d.monthsToGo) ? `With ${have} and ${money(d.monthlySaving)} a month, you have it in about ${Math.ceil(d.monthsToGo / 12 * 10) / 10} years (${monthYear(d.readyDate)}).` : `At ${money(d.monthlySaving)} a month it is not reached in 100 years.`));
  // while a shared link shows, the savings boxes are not drawn (a link never carries them): the line does not point at them
  else when.append(ui.h("p", {}, sv.live ? `${have[0].toUpperCase()}${have.slice(1)}. Your savings stay your own: the link does not carry them.` : `${have[0].toUpperCase()}${have.slice(1)}; enter what you save a month below to see when.`));
  if (d.neededMonthly !== null) when.append(ui.h("p", {}, `To have it by ${monthYear(d.target)}: about ${money(d.neededMonthly)} a month.`));
  // The goal button only once the figures are the person's own: before, a filled "Update the goal" with the example's
  // figures replaced a $50,000 goal with $97,000 in one tap. It names both amounts, and it is outlined (Save is the action).
  const newTarget = Math.round(d.cash.total / 100) * 100;
  const changes = d.goal && Math.abs((d.goal.target ?? 0) - newTarget) >= 100;
  // while a shared link shows nothing but "Keep these" writes the plan: no goal button
  const goalButton = !saved || sv.live ? null : d.goal ? (changes ? ui.button(`Change the goal from ${fmt.money(d.goal.target ?? 0, cur)} to ${fmt.money(newTarget, cur)}`, () => goalWrite(), { class: "secondary" }) : null) : ui.button(`Make it a goal (${fmt.money(newTarget, cur)})`, () => goalWrite(), { class: "secondary" });
  if (!saved && !d.goal) when.append(ui.h("p", { class: "muted small" }, "Put the home you have in mind in the figures below and save; then it can become a goal."));
  const goalWrite = () => {
    pending = d.goal ? "Goal updated." : "Goal added on the Goals page.";
    store.update((p) => {
      p.goals = p.goals ?? [];
      const g = d.goal ? p.goals.find((y) => y.id === d.goal.id) : null;
      const target = Math.round(d.cash.total / 100) * 100;
      if (g) Object.assign(g, { target, targetDate: d.target || g.targetDate, monthly: x.monthly ?? g.monthly });
      else p.goals.push({ id: ui.uid(), name: "House down payment", icon: "🏠", target, targetDate: d.target || "", priority: 2, saved: x.saved ?? 0, fundedBy: [], monthly: x.monthly ?? 0, rate: null, inflates: true });
    });
  };
  when.append(ui.row(goalButton, ui.h("a", { class: "btn secondary", href: "#/goals/goals" }, "Goals")));
  root.append(when);

  // The figures: the five boxes most people change, then "More details (optional)". A box with our guess is empty with the
  // gray figure; a folded box with no guess is empty and its help says what an empty box counts (no example sits in a box)
  const ours = (k, own) => (shown.has(k) ? [`Our guess: ${g[k].why}${/[.!?]$/.test(g[k].why) ? "" : "."}`, own].filter(Boolean).join(" ") : own);
  const gray = (k, type) => (shown.has(k) ? previewText(x[k], type) : type === "percent" ? "" : undefined);
  const pctField = (key, label, help, more) => ({ key, label, type: "percent", min: 0, max: 100, help, placeholder: gray(key, "percent"), more: more || undefined });
  const pct1 = (r) => `${Number((r * 100).toFixed(2))}%`;
  const fields = [
    { key: "price", label: "Home price", type: "money", min: 0, help: ours("price"), placeholder: gray("price", "money") },
    // a figure in a box nobody typed says where it comes from (critic e9 P2): black is what Work it out saves, gray is our guess
    pctField("downShare", "Down payment", blank("downShare") ? `We start at ${pct(DEFAULTS.downShare)}, which avoids mortgage insurance.` : "20% avoids mortgage insurance."),
    pctField("rate", "Mortgage rate a year", ours("rate")),
    { key: "saved", label: "Set aside so far", type: "money", min: 0, help: "Left empty, we use the Goals page's house goal." },
    { key: "monthly", label: "Saved toward it a month", type: "money", min: 0, help: "Left empty, we use the house goal's monthly amount." },
    pctField("closingShare", "Closing costs, share of price", `Left empty, we count ${pct1(DEFAULTS.closingShare)} of the price; closing costs usually run 2% to 5%.`, true),
    { key: "termYears", label: "Mortgage length (years)", type: "number", min: 5, max: 40, step: "1", help: `Left empty, we count ${DEFAULTS.termYears} years.`, more: true },
    pctField("taxRate", "Property tax a year, share of value", ours("taxRate", shown.has("taxRate") ? "" : `Left empty, we count ${pct1(DEFAULTS.taxRate)} of the value.`), true),
    pctField("insuranceRate", "Home insurance a year, share of value", ours("insuranceRate", shown.has("insuranceRate") ? "" : `Left empty, we count ${pct1(DEFAULTS.insuranceRate)} of the value.`), true),
    { key: "hoaMonthly", label: "HOA a month", type: "money", min: 0, help: "Leave it empty if there is none.", more: true },
    { key: "reserveMonths", label: "Months of payments kept in reserve", type: "number", min: 0, max: 12, step: "1", help: `Left empty, we count ${DEFAULTS.reserveMonths} months, what lenders often like to see.`, more: true },
    { key: "targetDate", label: "Buy by", type: "date", help: "Leave it empty to use the house goal's date.", more: true },
  ];
  // the boxes show the figures the page works with: opened from the goal, the price its cash buys (not an example), so "Work
  // it out" without a change saves what the page shows; a box with our guess opens empty (gray), and so does a folded box
  // nobody filled in
  const SHOWN_FIRST = ["price", "downShare", "rate"];
  // while a shared link shows, the boxes are the link's: the household's own savings and date are not drawn (a link never
  // carries them, and this visit writes nothing)
  const boxes = sv.live ? fields.filter((f) => SHARED_KEYS.has(f.key)) : fields;
  const values = Object.fromEntries(boxes.map((f) => [f.key, f.key === "targetDate" ? s.targetDate || ""
    : shown.has(f.key) ? null
    : SHOWN_FIRST.includes(f.key) ? x[f.key]
    : blank(f.key) ? null : Number(s[f.key])]));
  const form = ui.form(boxes, values, (v) => {
    // a shared link: worked out for this visit (the figures go into the address), never saved
    if (sv.live) { worked = true; const r = visitGo(ctx, SHARE_SPEC, v); if (r !== true) { worked = false; return ui.fieldError(form.querySelector?.(`[name="${r || "price"}"]`), r ? NO_LINK : "Type a figure first."); } return; }
    pending = WORKED; worked = true;
    store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.house = Object.fromEntries(fields.map((f) => [f.key, f.type === "date" ? v[f.key] || "" : v[f.key] ?? null])); });
  }, { submitLabel: "Work it out" });
  // asks first (open until the page has an answer of the person's own; a link's figures are not, so the part is open while
  // one shows and the visitor sees where to change them: critic P5), then folds under the answer (docs/OPTIONAL.md R8)
  // under the form, "Share these figures" (only when a figure is typed): a link with this page's own figures and nothing else
  root.append(ui.h("div", {}, parts(ctx, { id: "figures", kind: "figures", says: money(x.price), guess: shown.size, open: !saved || keepOpen || sv.live, holds: boxes.map((f) => f.key), body: [form, ...shareBlock(ctx, SHARE_SPEC, s)] })));
  root.append(ui.h("div", {}, links(ctx, [
    { href: "#/property/rent-vs-buy", ask: "Rent or buy?" },
    { href: "#/debt/ratios", ask: "What do lenders see?" },
  ])));
}
