// modules/estate/inheritance/view.js -- DOM only. An inheritance you might receive, as a what-if: what it
// would change if it came, and if it came smaller or later; the plan itself never counts on it. Runs on
// the PC when connected.
import { KINDS, LATER_YEARS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.ih-root .ih-list { list-style: none; margin: 0; padding: 0; }
.ih-root .ih-list li { display: flex; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.ih-root .ih-list li:last-child { border-bottom: 0; }
.ih-root .ih-body { flex: 1; min-width: 0; }
.ih-root .ih-t { font-weight: 600; }
.ih-root .ih-d { color: var(--text-2); font-size: var(--fs-sm); }
.ih-root .ih-v { flex: none; white-space: nowrap; text-align: right; }
.ih-root .ih-cases { list-style: none; margin: 0; padding: 0; }
.ih-root .ih-cases li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.ih-root .ih-cases li:last-child { border-bottom: 0; }
.ih-root .ih-cases .ih-v span { display: block; color: var(--muted); font-size: var(--fs-xs); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const root = ui.h("div", { class: "ih-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const host = ui.h("div");
  root.append(host);
  host.append(ui.notice("info", "Running your plan with and without it..."));
  ctx.computeRemote("estate/inheritance", { today: fmt.today() }).then(draw, (e) => host.replaceChildren(ui.notice("error", `The inheritance could not be worked out: ${e}. Reload the page; if it keeps happening, check Will the money last? first.`)));

  function draw(d) {
    host.replaceChildren();
    let editing = null;
    if (!d.items.length) host.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "An inheritance you might receive"),
      ui.h("p", { class: "lede" }, "Many people expect something from parents or relatives. It is wise not to count on it: care in later life can use most of it up, and plans change. Here you can see what it would change if it came, without putting it in your plan."),
      ui.h("p", { class: "muted small" }, "Enter what you might receive and when, in today's money. Nothing here changes your other pages.")));
    else if (d.ready) {
      const w = d.withIt;
      host.append(ui.card("If it comes", ui.row(
        ui.stat("What arrives", money(d.net), d.net < d.total ? `of ${money(d.total)}, after tax and selling costs` : "in today's money"),
        ui.stat("You could spend", `${d.extraMonthly >= 0 ? "+" : ""}${money(d.extraMonthly)}`, `a month more in retirement, about ${money(w.affordableMonthly)} in all`),
      ), ui.h("p", { class: "ih-d" }, `${w.success && !d.base.success ? "With it the money lasts; without it, it does not. " : ""}The plan would end with about ${money(w.endReal)} instead of ${money(d.base.endReal)} (today's dollars).`)));
      const cases = [["Without it (your plan)", d.base], ["If it comes as expected", w], ["Half as much", d.half], [`${LATER_YEARS} years later`, d.later]];
      host.append(ui.card("If it is smaller, or later", ui.h("ul", { class: "ih-cases" }, cases.map(([t, r]) => ui.h("li", {}, ui.h("span", {}, t), ui.h("span", { class: "ih-v" }, `${money(r.affordableMonthly)} a month`, ui.h("span", {}, r.success ? `ends with ${money(r.endReal)}` : `runs out in ${r.failYear}`))))),
        ui.h("p", { class: "muted small" }, "What the plan could spend a month in retirement and still last, in each case. Spend it only once it has arrived.")));
    } else host.append(ui.card(null, ui.h("p", { class: "muted" }, `To see what it would change, the plan needs: ${d.missing.join("; ")}.`)));

    if (d.items.length) host.append(ui.card("What you might receive", ui.h("p", { class: "muted small" }, "Tap one to change it."), ui.h("ul", { class: "ih-list" }, d.items.map((x) => ui.h("li", { role: "button", tabindex: "0", onClick: () => { editing = (plan.estate.inheritance.items ?? []).find((y) => y.id === x.id); drawForm(true); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); }, onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      ui.h("div", { class: "ih-body" }, ui.h("div", { class: "ih-t" }, x.from ? `From ${x.from}` : "An inheritance"), ui.h("div", { class: "ih-d" }, `${x.kindLabel} · about ${x.year}${x.net < x.amount ? ` · ${money(x.net)} after tax and costs` : ""}`)),
      ui.h("div", { class: "ih-v" }, money(x.amount)))))));

    const formHost = ui.h("div");
    const drawForm = (open = !d.items.length) => {
      formHost.innerHTML = "";
      if (!open && !editing) { formHost.append(ui.button("+ Add another", () => drawForm(true), { class: "secondary" })); return; }
      formHost.append(...[ui.h("h2", {}, editing ? "Change it" : "Add what you might receive"), ui.form([
        { key: "from", label: "From", type: "text", placeholder: "e.g. Mum and Dad" },
        { key: "amount", label: "About how much, in today's money", type: "money", min: 0 },
        { key: "year", label: "About when (year)", type: "number", min: 1990, max: 2150, step: "1" },
        { key: "kind", label: "In what form", type: "select", options: Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label })) },
        { key: "notes", label: "Notes", type: "text" },
      ], editing ? { ...editing } : { kind: "cash", year: (d.items[0]?.year ?? Number(fmt.today().slice(0, 4)) + 20) }, (v) => {
        const clean = { from: (v.from ?? "").trim(), amount: v.amount ?? 0, year: v.year ?? null, kind: v.kind, notes: (v.notes ?? "").trim() };
        pending = editing ? "Changes saved." : "Added.";
        const id = editing?.id;
        store.update((p) => {
          p.estate = p.estate ?? { documents: [], beneficiaries: [] }; p.estate.inheritance = p.estate.inheritance ?? { items: [] }; p.estate.inheritance.items = p.estate.inheritance.items ?? [];
          if (id) { const i = p.estate.inheritance.items.findIndex((x) => x.id === id); if (i >= 0) p.estate.inheritance.items[i] = { ...p.estate.inheritance.items[i], ...clean }; }
          else p.estate.inheritance.items.push({ id: ui.uid(), ...clean });
        });
      }, { submitLabel: editing ? "Save changes" : "Add", resetAfter: !editing, onCancel: (editing || d.items.length) ? () => { editing = null; drawForm(false); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button("Remove it", () => {
        if (!ui.confirm("Remove this inheritance?")) return;
        const id = editing.id; editing = null;
        pending = "Removed.";
        store.update((p) => { p.estate.inheritance.items = (p.estate.inheritance.items ?? []).filter((x) => x.id !== id); });
      }, { class: "danger" })) : null].filter(Boolean));
    };
    drawForm();
    host.append(ui.card(null, out, formHost));
    host.append(ui.card("Good to know", ui.h("ul", {},
      ui.h("li", {}, "There is no federal inheritance tax; a few states tax some heirs (Estate tax lists them)."),
      ui.h("li", {}, "An inherited traditional IRA or 401(k) must usually be emptied within 10 years, and each withdrawal is taxed as income: spreading them out keeps the tax lower."),
      ui.h("li", {}, "Inherited property and shares get a new cost basis at their value on the day of death, so selling soon after owes little or no gains tax.")),
      ui.row(ui.h("a", { class: "btn secondary", href: "#/insurance/ltc" }, "Long-term care"), ui.h("a", { class: "btn secondary", href: "#/estate/estate-tax" }, "Estate tax"))));
  }
}
