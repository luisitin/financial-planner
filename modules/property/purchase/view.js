// modules/property/purchase/view.js -- DOM only. A big purchase three ways: save up by the date you want it,
// finance it now, or pay cash now; each against the money left each month, and the goals that would give way;
// the purchase in "The figures" (five boxes, the rest under "More details (optional)"). An empty payment-plan rate box shows
// our guess in gray (smart guesses C9, K3): counted in the answer while it stays empty, never saved; opening writes nothing.
import { compute, DEFAULTS } from "./compute.js";
import { previewText } from "../../goals/house/compute.js";
import { parts, links } from "../../../core/ui/more.js";

let pending = null;   // the confirmation shown on the next render
let worked = false;
const WORKED = Symbol("worked");   // "Compare" was tapped: the green line says the new answer, and "The figures" stays open (R7, R17)

const STYLE = `
.pu-root .pu-list { list-style: none; margin: 0; padding: 0; }
.pu-root .pu-list li { padding: 11px 0; border-bottom: 1px solid var(--line); }
.pu-root .pu-list li:last-child { border-bottom: 0; }
.pu-root .pu-head { display: flex; justify-content: space-between; gap: 12px; font-weight: 650; }
.pu-root .pu-head span:last-child { white-space: nowrap; }
.pu-root .pu-d { color: var(--text-2); font-size: var(--fs-sm); }
.pu-root .pu-warn { color: var(--warn); font-size: var(--fs-sm); }
.pu-root .pu-ok { color: var(--ok); font-size: var(--fs-sm); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const today = fmt.today();
  // our guess for the empty rate box (ctx.guess: the guesses module's card rate), passed to compute as a preview; a saved
  // figure is the person's and is never asked about
  const s = plan.whatIfs?.purchase ?? {};
  const blank = (k) => s[k] === null || s[k] === undefined || s[k] === "";
  const ask = (key, opts) => { if (typeof ctx.guess !== "function") return null; try { const e = ctx.guess(key, opts); return e && typeof e.value === "number" && Number.isFinite(e.value) ? e : null; } catch { return null; } };
  const g = { apr: blank("apr") ? ask("debt.credit.rate") : null };
  const d = compute(plan, { today, previews: { apr: g.apr?.value ?? null } });
  const shown = new Set(d.previewed ?? []);
  const root = ui.h("div", { class: "pu-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const name = d.inputs.name || "the purchase";
  if (pending === WORKED) pending = `Saved. ${name[0].toUpperCase()}${name.slice(1)}: ${money(d.total)}, or ${money(d.finance.payment)} a month on the payment plan.`;
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const keepOpen = worked; worked = false;
  const monthYear = (iso) => new Date(`${iso.slice(0, 7)}-15T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (!s.price) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "A big purchase"),
    ui.h("p", { class: "lede" }, "A sofa, a laptop, a ring, a boat: save up for it, put it on a payment plan, or pay now. Here is what each costs and does to your other goals."),
    ui.h("p", { class: "muted small" }, "Until you say what you want to buy, it shows a $3,000 example.")));

  root.append(ui.card(null, ui.row(
    ui.stat(d.inputs.name || "Price", money(d.total), d.saved ? `${money(d.saved)} already set aside` : d.inputs.salesTax ? "with sales tax" : "nothing set aside yet"),
    ui.stat("Left over each month", money(Math.max(0, d.spare)), d.spare < 0 ? `already ${money(-d.spare)} short` : "after spending and saving"),
  )));

  const effect = (e, amount) => {
    if (!e) return null;
    if (!e.list.length) return ui.h("div", { class: "pu-ok" }, `Fits in the money left each month: ${money(Math.max(0, d.spare - amount))} still spare.`);
    return ui.h("div", { class: "pu-warn" }, `Needs ${money(e.list.reduce((t, g) => t + g.from, 0))} a month from your goals: ${e.list.map((g) => `${g.name} ${g.paused ? "paused" : g.monthsLater > 0 ? `${g.monthsLater} month${g.monthsLater === 1 ? "" : "s"} later` : "slower"}`).join(", ")}${e.uncovered > 0.5 ? `, and ${money(e.uncovered)} a month more than you have` : ""}.`);
  };
  const ways = [];
  if (d.save) ways.push(ui.h("li", {}, ui.h("div", { class: "pu-head" }, ui.h("span", {}, `Save up by ${monthYear(d.inputs.when)}`), ui.h("span", {}, `${money(d.save.monthly)} a month`)),
    ui.h("div", { class: "pu-d" }, `${d.save.months} month${d.save.months === 1 ? "" : "s"} of saving; the savings earn about ${money(d.save.earned)} on the way. No interest to pay.`), effect(d.effect.save, d.save.monthly)));
  else ways.push(ui.h("li", {}, ui.h("div", { class: "pu-head" }, ui.h("span", {}, "Save up"), ui.h("span", {}, "—")), ui.h("div", { class: "pu-d" }, "Choose when you want it, below, to see the monthly saving.")));
  const f = d.finance;
  const rateText = `${(d.inputs.apr * 100).toFixed(1).replace(/\.0$/, "")}%${shown.has("apr") ? " (our guess)" : ""}`;
  ways.push(ui.h("li", {}, ui.h("div", { class: "pu-head" }, ui.h("span", {}, "Finance it now"), ui.h("span", {}, `${money(f.payment)} a month`)),
    // the rate is our guess while its box is empty: said here, beside the answer, never folded away (docs/OPTIONAL.md R9 #5)
    ui.h("div", { class: "pu-d" }, `${f.months} months${f.promo ? `, ${f.promo === f.months ? "all at 0%" : `0% for the first ${f.promo}, then ${rateText}`}` : ` at ${rateText}`}: ${f.interest > 0.5 ? `${money(f.interest)} of interest, so it costs ${money(d.total + f.interest)}` : "no interest if every payment is on time"}.`),
    f.promo && f.promo < f.months ? ui.h("div", { class: "pu-warn" }, "Many 0% offers charge all the interest from day one if anything is left when the free months end: read the terms.") : null,
    effect(d.effect.finance, f.payment)));
  ways.push(ui.h("li", {}, ui.h("div", { class: "pu-head" }, ui.h("span", {}, "Pay cash now"), ui.h("span", {}, money(d.total - d.saved))),
    ui.h("div", { class: d.cash.fits && (!d.cash.target || d.cash.after >= d.cash.target) ? "pu-d" : "pu-warn" }, !d.cash.fits ? "There is not this much usable cash: the rest is set aside for goals or is your emergency fund." : d.cash.target && d.cash.after < d.cash.target ? `Leaves ${money(d.cash.after)} of usable cash, under your emergency fund target of ${money(d.cash.target)}.` : `Leaves ${money(d.cash.after)} of usable cash.`)));
  root.append(ui.card("Three ways to buy it", ui.h("ul", { class: "pu-list" }, ways),
    ui.h("p", { class: "muted small" }, "Goals give way least important first, then the one due latest.")));

  // The figures: the five boxes most purchases need, then "More details (optional)". The rate box with our guess is empty
  // with the gray figure; a box with no guess is empty and its help says what an empty box counts (no example sits in a box)
  const ours = (k, own) => [`Our guess: ${g[k].why}${/[.!?]$/.test(g[k].why) ? "" : "."}`, own].filter(Boolean).join(" ");
  const fields = [
    { key: "name", label: "What it is", type: "text", placeholder: "e.g. New sofa" },
    // needed: an empty box made Compare do nothing at all (x-2)
    { key: "price", label: "Price", type: "money", min: 1, required: true },
    { key: "when", label: "When you want it", type: "date" },
    { key: "saved", label: "Already set aside for it", type: "money", min: 0 },
    { key: "apr", label: "The payment plan's rate", type: "percent", min: 0, max: 40, placeholder: shown.has("apr") ? previewText(g.apr.value, "percent") : "",
      // a card's rate is not a store's offer: many start with months at no interest (critic e9 P4), which the folded box takes
      help: shown.has("apr") ? ours("apr", "Many store plans charge no interest at first.") : `Left empty, we count ${Math.round(DEFAULTS.apr * 100)}% a year.` },
    { key: "termMonths", label: "Payment plan length (months)", type: "number", min: 1, max: 120, step: "1", help: `Left empty, we count ${DEFAULTS.termMonths} months.`, more: true },
    { key: "salesTax", label: "Sales tax", type: "percent", min: 0, max: 15, placeholder: "", help: "Leave it empty if there is none.", more: true },
    { key: "promoMonths", label: "Months at 0%, if offered", type: "number", min: 0, max: 60, step: "1", help: "Leave it empty if there is none.", more: true },
  ];
  // the boxes show what was saved, else nothing: the rate box with our guess opens empty (gray)
  const values = { name: s.name ?? "", price: s.price ?? "", when: s.when ?? "", ...Object.fromEntries(["saved", "apr", "termMonths", "salesTax", "promoMonths"].map((k) => [k, blank(k) ? null : Number(s[k])])) };
  const form = ui.form(fields, values, (v) => {
    if (!(v.price > 0)) return;
    pending = WORKED; worked = true;
    // an empty box saves nothing (null): the page counts its gray figure or its stated default, and never writes ours
    store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.purchase = { name: String(v.name ?? "").trim(), price: v.price, salesTax: v.salesTax ?? null, when: v.when || "", saved: v.saved ?? null, apr: v.apr ?? null, termMonths: v.termMonths ?? null, promoMonths: v.promoMonths ?? null }; });
  }, { submitLabel: "Compare" });
  // asks first (open until the page has a purchase of the person's own), then folds under the answer (docs/OPTIONAL.md R8)
  root.append(ui.h("div", {}, parts(ctx, { id: "figures", kind: "figures", says: s.price ? money(d.total) : "", guess: shown.size, open: !s.price || keepOpen, holds: fields.map((x) => x.key), body: form })));
  root.append(ui.h("div", {}, links(ctx, [
    { href: "#/goals/goals", ask: "Which goals would wait?" },
    { href: "#/goals/prioritizer", ask: "What should we save for first?" },
  ])));
}
