// modules/estate/gifting/view.js -- DOM only. The yearly tax-free amount, the gifts you plan or have
// made against it (what needs a gift tax return), the five-year 529 front-load, and one form to add or
// change a gift.
import { compute, KINDS } from "./compute.js";
import { SUPERFUND_YEARS, FIRST_YEAR } from "./data/transfer-tax.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.gf-root .gf-list { list-style: none; margin: 0; padding: 0; }
.gf-root .gf-list li { display: flex; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.gf-root .gf-list li:last-child { border-bottom: 0; }
.gf-root .gf-body { flex: 1; min-width: 0; }
.gf-root .gf-t { font-weight: 600; }
.gf-root .gf-d { color: var(--text-2); font-size: var(--fs-sm); }
.gf-root .gf-v { flex: none; white-space: nowrap; text-align: right; }
.gf-root .gf-over { color: var(--warn); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "gf-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  let editing = null;
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  const each = d.couple ? `each of you can give ${money(d.annualExclusion)} to as many people as you like (${money(d.annualExclusion * 2)} together)` : `you can give ${money(d.annualExclusion)} to as many people as you like`;
  root.append(ui.h("section", { class: d.count ? "card" : "card accent hero" },
    d.count ? null : ui.h("h1", {}, "Giving while you are alive"),
    ui.h("p", { class: d.count ? "" : "lede" }, `In ${d.year} ${each}, with no tax and no paperwork. Above that a gift tax return (Form 709) is filed, but no tax is due: the extra only uses part of the ${money(d.lifetimeExclusion)} lifetime exemption. School tuition and medical bills paid straight to the school or the hospital do not count at all.`),
    ui.h("p", { class: "muted small" }, `A 529 college plan can take ${SUPERFUND_YEARS} years of gifts at once: up to ${money(d.superfund.perGiver)} from one giver${d.couple ? `, ${money(d.superfund.couple)} from a couple` : ""}, per child, counted a fifth a year.`)));
  for (const w of d.warnings) root.append(ui.notice("warn", w));
  for (const n of d.notes) root.append(ui.notice("info", n));

  if (d.count) {
    const t = d.thisYear;
    root.append(ui.card(null, ui.row(
      ui.stat(`Given or planned in ${d.year}`, money(t ? t.rows.reduce((s, r) => s + r.counted, 0) : 0), t?.overTotal ? `${money(t.overTotal)} over the yearly limit` : "all within the yearly limit"),
      ui.stat("Lifetime exemption left", money(Math.min(...Object.values(d.lifetimeLeft))), d.couple ? "the lower of yours" : "of " + money(d.lifetimeExclusion)),
    )));
    const list = ui.h("ul", { class: "gf-list" }, [...d.gifts].sort((a, b) => a.year - b.year).map((g) => {
      const overRows = d.byYear.filter((b) => g.years.includes(b.year)).flatMap((b) => b.rows.filter((r) => r.over > 0 && r.to.toLowerCase() === String(g.to ?? "").trim().toLowerCase() && g.givers.some((f) => f.id === r.giverId)).map((r) => `${r.giverName} ${money(r.over)} over in ${b.year}`));
      return ui.h("li", { role: "button", tabindex: "0", onClick: () => { editing = (plan.estate.gifts ?? []).find((y) => y.id === g.id); drawForm(true); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); }, onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("div", { class: "gf-body" }, ui.h("div", { class: "gf-t" }, `${g.to || "Someone"}: ${KINDS[g.kind] ?? KINDS.cash}`),
          ui.h("div", { class: "gf-d" }, [g.givers.map((f) => f.name).join(" and ") + (g.splitByElection ? " (split, as every gift that year)" : ""), g.spread > 1 ? `${g.year} to ${g.year + g.spread - 1}, spread over ${g.spread} years` : String(g.year)].join(" · ")),
          overRows.length ? ui.h("div", { class: "gf-d gf-over" }, `Gift tax return: ${overRows.join("; ")}`) : null),
        ui.h("div", { class: "gf-v" }, money(g.amount)));
    }));
    root.append(ui.card("Your gifts", ui.h("p", { class: "muted small" }, "Tap a gift to change it."), list));
    const returns = d.byYear.filter((b) => b.needs709);
    if (returns.length) root.append(ui.card("Gift tax returns to file", ui.h("ul", {}, returns.map((b) => ui.h("li", {}, `${b.year}: Form 709 by April 15, ${b.year + 1}${b.overTotal ? ` (${money(b.overTotal)} over the yearly limit, from the lifetime exemption)` : " (to split gifts or spread a 529; no tax)"}`))),
      ui.h("p", { class: "muted small" }, `Lifetime exemption these gifts use: ${d.givers.map((g) => `${g.name} ${money(d.lifetimeUsed[g.id])}`).join(", ")}.`)));
  }

  // add or change a gift
  const formHost = ui.h("div");
  const fields = [
    { key: "to", label: "To whom", type: "text", required: true, placeholder: "e.g. Cy" },
    { key: "amount", label: "Amount", type: "money", min: 0 },
    { key: "year", label: "Year", type: "number", min: FIRST_YEAR, max: 2100, step: "1", help: `${FIRST_YEAR} or later` },
    { key: "from", label: "From", type: "select", options: [...d.givers.map((g) => ({ value: g.id, label: g.name })), ...(d.couple ? [{ value: "both", label: "Both of us (split, half each)" }] : [])] },
    { key: "kind", label: "What", type: "select", options: Object.entries(KINDS).map(([value, label]) => ({ value, label })) },
    { key: "superfund", label: `529 only: spread it over ${SUPERFUND_YEARS} years (front-load)`, type: "checkbox" },
    { key: "notes", label: "Notes", type: "textarea", rows: 2 },
  ];
  const drawForm = (open = !d.count) => {
    formHost.innerHTML = "";
    if (!open && !editing) { formHost.append(ui.button("+ Add another gift", () => drawForm(true), { class: "secondary" })); return; }
    const values = editing ? { ...editing } : { year: d.year, from: d.couple ? "both" : d.givers[0]?.id ?? "", kind: "cash", superfund: false };
    // append() writes a null as the text "null": only real elements go in
    formHost.append(...[ui.h("h2", {}, editing ? `Change the gift to ${editing.to}` : "Add a gift"), ui.form(fields, values, (v) => {
      const clean = { to: v.to.trim(), amount: v.amount ?? 0, year: v.year ?? d.year, from: v.from, kind: v.kind, superfund: v.kind === "529" && !!v.superfund, notes: v.notes ?? "" };
      if (!clean.to) return;
      pending = editing ? "Changes saved." : `Gift to ${clean.to} added.`;
      const id = editing?.id;
      store.update((p) => {
        p.estate = p.estate ?? { documents: [], beneficiaries: [] }; p.estate.gifts = p.estate.gifts ?? [];
        if (id) { const i = p.estate.gifts.findIndex((x) => x.id === id); if (i >= 0) p.estate.gifts[i] = { ...p.estate.gifts[i], ...clean }; }
        else p.estate.gifts.push({ id: ui.uid(), ...clean });
      });
      editing = null;
    }, { submitLabel: editing ? "Save changes" : "Add gift", resetAfter: !editing, onCancel: (editing || d.count) ? () => { editing = null; drawForm(false); } : null }),
    editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button("Remove this gift", () => {
      if (!ui.confirm(`Remove the gift to ${editing.to}?`)) return;
      const id = editing.id; editing = null;
      pending = "Gift removed.";
      store.update((p) => { p.estate.gifts = (p.estate.gifts ?? []).filter((x) => x.id !== id); });
    }, { class: "danger" })) : null].filter(Boolean));
  };
  drawForm();
  root.append(ui.card(null, out, formHost));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/estate/estate-tax" }, "Estate tax"), ui.h("a", { class: "btn secondary", href: "#/goals/education" }, "College"))));
}
