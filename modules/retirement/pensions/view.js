// modules/retirement/pensions/view.js -- DOM only. Each pension: what it pays and what inflation does to
// it, what it is worth over a lifetime, the lump sum against the monthly payments, the survivor option;
// one form to add or change a pension (the projection counts them).
import { compute } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.pn-root .pn-list { list-style: none; margin: 0; padding: 0; }
.pn-root .pn-list li { padding: 10px 0; border-bottom: 1px solid var(--line); }
.pn-root .pn-list li:last-child { border-bottom: 0; }
.pn-root .pn-t { font-weight: 650; }
.pn-root .pn-d { color: var(--text-2); font-size: var(--fs-sm); }
.pn-root .pn-v { font-weight: 650; }
.pn-root .pn-v.ok { color: var(--ok); } .pn-root .pn-v.warn { color: var(--warn); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const pct = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
  const d = compute(plan, { today: fmt.today() });
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const root = ui.h("div", { class: "pn-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  let editing = null;
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.items.length) root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "A pension"),
    ui.h("p", { class: "lede" }, "A pension pays a monthly amount for life. The big choices come when it starts: take it monthly or as a lump sum, and whether to keep paying a partner after you die. This page works out what each is worth, with your own life expectancy."),
    ui.h("p", { class: "muted small" }, "The pension's annual statement or the plan's website has the monthly amount at your retirement age; ask for the lump sum and the survivor options when you get close."),
    d.fromIncome.length ? ui.h("p", { class: "muted small" }, `Already counted from the Income page: ${d.fromIncome.map((x) => `${x.name} (${money(x.monthly)} a month)`).join(", ")}. Add it here too to see the choices.`) : null));
  else root.append(ui.card(null, ui.row(ui.stat("Pensions a month", money(d.totalMonthly), `${d.items.length} pension${d.items.length === 1 ? "" : "s"}, in the plan`), ui.stat("Worth over a lifetime", money(d.items.reduce((s, x) => s + x.lifetime, 0)), "expected, in today's money"))));

  for (const x of d.items) {
    const card = ui.card(x.name);
    card.append(ui.h("p", { class: "pn-d" }, `${x.personName}: ${money(x.monthly)} a month from ${x.startAge} (${x.startYear})${x.endAge ? ` to ${x.endAge}` : " for life"}, ${x.cola ? "rising with prices each year" : "the same dollars every year"}.`));
    const list = ui.h("ul", { class: "pn-list" });
    list.append(ui.h("li", {}, ui.h("div", { class: "pn-t" }, "Against inflation"), ui.h("div", { class: "pn-d" }, x.cola ? "It rises with prices, so it keeps what it buys." : `With no cost-of-living raises, by ${x.personName}'s 85th birthday ${money(x.monthly)} buys what about ${money(x.atEightyFive)} buys today, at ${pct(d.inflation)} inflation.`)));
    list.append(ui.h("li", {}, ui.h("div", { class: "pn-t" }, `Worth about ${money(x.lifetime)}`), ui.h("div", { class: "pn-d" }, `The payments over the years ${x.personName} is likely to live, in today's money, discounted at what safe bonds earn above inflation (${pct(d.realRate)}). It is what the same income would cost to buy.`)));
    if (x.lump) {
      const l = x.lump;
      const verdict = l.verdict === "monthly" ? ["ok", "The monthly payments look better."] : l.verdict === "lump" ? ["warn", "The lump sum looks better."] : ["", "About even."];
      list.append(ui.h("li", {}, ui.h("div", { class: "pn-t" }, `Lump sum of ${money(l.amount)} or monthly?`), ui.h("div", { class: `pn-v ${verdict[0]}` }, verdict[1]),
        ui.h("div", { class: "pn-d" }, `${l.rate === -Infinity ? "The lump sum is more than the payments are likely to add up to." : l.rate === Infinity ? "The payments are worth far more than this lump sum." : `The monthly payments are like investing the lump sum at ${pct(l.rate)} a year for life; safe bonds earn about ${pct(d.nominalRate)}.`} ${l.breakevenAge ? `They add up to more than the lump sum from age ${l.breakevenAge}; ${x.personName} has about a ${Math.round(l.chanceToBreakeven * 100)}% chance of getting there.` : ""} The monthly payments cannot run out and need no investing; the lump sum can be left to heirs.`)));
    }
    if (x.survivor) {
      const s = x.survivor;
      list.append(ui.h("li", {}, ui.h("div", { class: "pn-t" }, `For ${s.partnerName} after ${x.personName} dies`), ui.h("div", { class: `pn-v ${s.better === "joint" ? "ok" : s.better === "single" ? "warn" : ""}` }, s.better === "joint" ? "The survivor option is worth more on average." : s.better === "single" ? "The single-life option is worth more on average." : "About even on average."),
        ui.h("div", { class: "pn-d" }, `Single life pays ${money(x.monthly)} a month while ${x.personName} lives (worth about ${money(s.single)}); the survivor option pays ${money(s.monthly)}, and ${money(s.survivorMonthly)} to ${s.partnerName} after (worth about ${money(s.joint)}), counting both of your chances of living each year. The survivor option is insurance: it matters most if ${s.partnerName} would struggle without it.`)));
    }
    card.append(list, ui.row(ui.button("Change", () => { editing = (plan.retirement.pensions ?? []).find((y) => y.id === x.id); drawForm(true); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); }, { class: "secondary" })));
    root.append(card);
  }

  const formHost = ui.h("div");
  const fields = [
    { key: "name", label: "Pension", type: "text", required: true, placeholder: "e.g. County retirement plan" },
    { key: "personId", label: "Whose", type: "select", options: people.map((p) => ({ value: p.id, label: p.name })) },
    { key: "monthly", label: "Monthly amount", type: "money", min: 0, help: "single-life, at the age it starts" },
    { key: "startAge", label: "Starts at age", type: "number", min: 40, max: 80, step: "1" },
    { key: "cola", label: "Rises with prices each year (a cost-of-living raise)", type: "checkbox" },
    { key: "endAge", label: "Stops at age (optional)", type: "number", min: 40, max: 120, step: "1", help: "empty: for life" },
    { key: "lumpSum", label: "Lump sum offered instead (optional)", type: "money", min: 0 },
    { key: "jointMonthly", label: "Monthly with a survivor option (optional)", type: "money", min: 0, help: "the reduced amount while you both live" },
    { key: "survivorShare", label: "The survivor gets", type: "select", options: [{ value: "", label: "no survivor option" }, { value: "0.5", label: "50% of it" }, { value: "0.75", label: "75% of it" }, { value: "1", label: "100% of it" }] },
  ];
  const drawForm = (open = !d.items.length) => {
    formHost.innerHTML = "";
    if (!open && !editing) { formHost.append(ui.button("+ Add a pension", () => drawForm(true), { class: "secondary" })); return; }
    const values = editing ? { ...editing, survivorShare: editing.survivorShare ? String(editing.survivorShare) : "", cola: editing.cola !== false } : { personId: people.find((p) => p.role === "self")?.id ?? "", startAge: 65, cola: false };
    formHost.append(...[ui.h("h2", {}, editing ? `Change ${editing.name}` : "Add a pension"), ui.form(fields, values, (v) => {
      const clean = { name: v.name.trim(), personId: v.personId, monthly: v.monthly ?? 0, startAge: v.startAge ?? 65, cola: !!v.cola, endAge: v.endAge ?? null, lumpSum: v.lumpSum ?? null, jointMonthly: v.jointMonthly ?? null, survivorShare: v.survivorShare ? Number(v.survivorShare) : null };
      if (!clean.name) return;
      pending = editing ? "Changes saved." : `${clean.name} added.`;
      const id = editing?.id;
      store.update((p) => {
        p.retirement = p.retirement ?? {}; p.retirement.pensions = p.retirement.pensions ?? [];
        if (id) { const i = p.retirement.pensions.findIndex((y) => y.id === id); if (i >= 0) p.retirement.pensions[i] = { ...p.retirement.pensions[i], ...clean }; }
        else p.retirement.pensions.push({ id: ui.uid(), ...clean });
      });
      editing = null;
    }, { submitLabel: editing ? "Save changes" : "Add pension", resetAfter: !editing, onCancel: (editing || d.items.length) ? () => { editing = null; drawForm(false); } : null }),
    editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.name}`, () => {
      if (!ui.confirm(`Remove ${editing.name}?`)) return;
      const id = editing.id, name = editing.name; editing = null;
      pending = `${name} removed.`;
      store.update((p) => { p.retirement.pensions = (p.retirement.pensions ?? []).filter((y) => y.id !== id); });
    }, { class: "danger" })) : null].filter(Boolean));
  };
  drawForm();
  root.append(ui.card(null, out, formHost));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/projection" }, "Will the money last?"), ui.h("a", { class: "btn secondary", href: "#/retirement/longevity" }, "How long to plan for"))));
}
