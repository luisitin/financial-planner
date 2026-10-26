// modules/taxes/capital-gains/view.js -- DOM only. The tax your sales add this year and the
// room left at 0% first, then the sales themselves (tap a row to edit, one folded form to add),
// then what one more sale would cost.
import { compute } from "./compute.js";

let pending = null;
let what = { amount: 10000, held: "long" };

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), extra: what });
  const money = (n) => fmt.money(n, cur);
  const redraw = () => { root.innerHTML = ""; render(root, ctx); };
  let editing = null;
  const FIELDS = [
    { key: "name", label: "What you sold", type: "text", required: true, placeholder: "e.g. 100 shares of VTI" },
    { key: "proceeds", label: "Sold for", type: "money", required: true, min: 0 },
    { key: "basis", label: "Cost (what you paid)", type: "money", required: true, min: 0, help: "the basis on the broker's statement, fees included" },
    { key: "held", label: "How long you held it", type: "select", options: [{ value: "long", label: "more than a year (long-term)" }, { value: "short", label: "a year or less (short-term)" }] },
  ];
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasSales ? d.taxOnGains > 0 ? `Your sales add about ${money(d.taxOnGains)} of tax in ${d.year}` : d.gains.netLoss < 0 ? `Your sales take about ${money(d.lossSaves)} off your ${d.year} tax` : `Your sales add no tax in ${d.year}` : "Tax on what you sell"),
    ui.h("p", { class: "lede" }, d.hasSales
      ? `${d.gains.netLong > 0 ? `${money(d.gains.netLong)} of long-term gain at the 0/15/20% rates` : ""}${d.gains.netLong > 0 && d.gains.netShort > 0 ? " and " : ""}${d.gains.netShort > 0 ? `${money(d.gains.netShort)} of short-term gain at ordinary rates` : ""}${d.gains.netLoss < 0 ? `A net loss of ${money(-d.gains.netLoss)}: ${money(-d.gains.lossAllowed)} comes off ordinary income this year${d.gains.carryForward < 0 ? `, ${money(-d.gains.carryForward)} carries forward` : ""}` : ""}. ${d.zeroRoom > 0 ? `You could still realise ${money(d.zeroRoom)} of long-term gain this year at 0%.` : "The 0% band is used up; further long-term gains pay 15%."}`
      : `Gains on things held more than a year pay 0%, 15% or 20% depending on your taxable income; shorter holds are taxed like wages. ${d.zeroRoom > 0 ? `With your income, ${money(d.zeroRoom)} of long-term gain would be taxed at 0% this year.` : "Your income already fills the 0% band."} Add this year's sales below.`),
    ui.h("p", { class: "muted small" }, `${d.year} thresholds for you: 0% while taxable income stays under ${money(d.thresholds.zero)}, 15% to ${money(d.thresholds.fifteen)}, 20% above; plus 3.8% on investment income once income passes the surtax threshold. Losses are netted the way Schedule D does.`),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  root.append(ui.card(null, ui.row(
    ui.stat("Long-term", money(d.gains.netLong), "after netting"),
    ui.stat("Short-term", money(d.gains.netShort), d.shortTax > 0 ? `${money(d.shortTax)} of tax, at ordinary rates` : "taxed like wages"),
    ui.stat("Tax on the sales", money(Math.max(0, d.taxOnGains)), d.rateOnGains > 0 ? `${fmt.pct(d.rateOnGains, 1)} of the gains${d.niit > 0 ? `, surtax included` : ""}` : "none"),
    ui.stat("Room at 0%", money(d.zeroRoom), "more long-term gain this year"),
  )));
  // what one more sale would cost
  const chips = ui.h("div", { class: "chips" }, [5000, 10000, 25000, 50000].map((a) => ui.h("button", { type: "button", class: `chip${a === what.amount ? " on" : ""}`, onClick: () => { what = { ...what, amount: a }; redraw(); } }, `+${money(a)}`)));
  const heldSel = ui.select([{ value: "long", label: "held more than a year" }, { value: "short", label: "held a year or less" }], what.held, { "aria-label": "Holding period", onChange: (e) => { what = { ...what, held: e.target.value }; redraw(); } });
  const amt = ui.input({ type: "number", value: what.amount, min: 0, step: "1000", inputmode: "numeric", "aria-label": "Gain", onChange: (e) => { what = { ...what, amount: Math.max(0, Number(e.target.value) || 0) }; redraw(); } });
  root.append(ui.card("If you sold one more thing",
    ui.h("p", { class: "muted small" }, "The gain on it (sale price less cost), on top of everything else this year."),
    chips, ui.h("div", { class: "form" }, ui.field("Gain", amt), ui.field("Holding period", heldSel)),
    d.extra ? ui.row(ui.stat("Extra tax", money(Math.max(0, d.extra.tax)), `on a ${money(d.extra.amount)} ${d.extra.held}-term gain`), ui.stat("Rate on it", fmt.pct(Math.max(0, d.extra.rate), 1), d.extra.held === "long" ? "0, 15, 20% and the surtax, as it stacks" : "your ordinary rates"), ui.stat("You keep", money(d.extra.amount - Math.max(0, d.extra.tax)), "of the gain, before state tax")) : null,
  ));
  // the sales
  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = !d.hasSales;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!showForm && !editing) { formHost.append(ui.button("+ Add a sale", () => { showForm = true; drawForm(); }, { class: "secondary" })); return; }
    const values = editing ? { ...editing } : { held: "long" };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit: ${editing.name}` : `A sale in ${d.year}`),
      ui.form(FIELDS, values, (v) => {
        const clean = { name: v.name.trim(), proceeds: v.proceeds ?? 0, basis: v.basis ?? 0, held: v.held === "short" ? "short" : "long" };
        pending = editing ? "Sale saved." : "Sale added.";
        store.update((p) => { p.taxes.gains = p.taxes.gains ?? []; if (editing) { const i = p.taxes.gains.findIndex((g) => g.id === editing.id); if (i >= 0) p.taxes.gains[i] = { ...p.taxes.gains[i], ...clean }; } else p.taxes.gains.push({ id: ui.uid(), ...clean }); });
        editing = null;
      }, { submitLabel: editing ? "Save changes" : "Add sale", resetAfter: !editing, onCancel: (editing || d.hasSales) ? () => { editing = null; showForm = false; drawForm(); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button("Remove this sale", () => { const id = editing.id; editing = null; pending = "Sale removed."; store.update((p) => { p.taxes.gains = (p.taxes.gains ?? []).filter((g) => g.id !== id); }); }, { class: "danger" })) : null,
    ));
  };
  drawForm();
  if (d.rows.length) root.append(ui.card(`Sales in ${d.year}`,
    ui.h("ul", { class: "page-list" }, d.rows.map((g) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
      onClick: () => { editing = { ...plan.taxes.gains.find((x) => x.id === g.id) }; showForm = true; drawForm(); formCard.scrollIntoView({ behavior: "smooth", block: "start" }); },
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      ui.h("span", { class: "ic" }, g.held === "long" ? "📈" : "⚡"),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, g.name), ui.h("div", { class: "d" }, `sold for ${money(g.proceeds)}, cost ${money(g.basis)} · ${g.held === "long" ? "long-term" : "short-term"}`)),
      ui.h("span", { class: "st amount" }, ui.h("div", { style: g.gain < 0 ? { color: "var(--bad)" } : null }, g.gain < 0 ? `−${money(-g.gain)}` : money(g.gain)), ui.h("div", { class: "muted small" }, g.gain < 0 ? "loss" : "gain"))))),
  ));
  formCard.append(formHost);
  root.append(formCard);
  root.append(ui.card("How the rates work",
    ui.h("ul", { class: "records" }, [
      ["Long-term gains stack on top", "Your ordinary income fills the brackets first; the gains sit above it and pay 0% for the part under the first threshold, 15% up to the second, 20% beyond. A low-income year (early retirement, a gap year) is the time to realise gains for free."],
      ["Short-term is just income", "Anything held a year or less is taxed like wages, so waiting for the anniversary can cut the rate by half or more."],
      ["Losses offset gains, then 3,000 of income", "Short and long losses first cancel gains of their own kind, then each other; a net loss takes up to 3,000 a year off ordinary income and the rest carries forward for as long as it takes."],
      ["The 3.8% surtax", "Once income passes 200,000 (250,000 filing jointly), investment income pays an extra 3.8%. That threshold is not indexed."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
  ));
}
