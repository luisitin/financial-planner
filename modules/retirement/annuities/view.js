// modules/retirement/annuities/view.js -- DOM only. Each annuity quote: what it pays, the return it pays
// like over your likely lifetime, what bonds paying the same would cost, and what buying it does to your
// plan; one form to add or change a quote. Runs on the PC when connected.
let pending = null;   // the confirmation shown on the next render

const STYLE = `
.an-root .an-figs { list-style: none; margin: 0; padding: 0; }
.an-root .an-figs li { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); align-items: baseline; }
.an-root .an-figs li:last-child { border-bottom: 0; }
.an-root .an-figs .an-h { color: var(--muted); font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: .04em; }
.an-root .an-figs b { white-space: nowrap; text-align: right; min-width: 76px; }
.an-root .an-d { color: var(--text-2); font-size: var(--fs-sm); }
.an-root .an-v { font-weight: 650; margin: 8px 0 2px; }
.an-root .an-v.ok { color: var(--ok); } .an-root .an-v.warn { color: var(--warn); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const pct = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const root = ui.h("div", { class: "an-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const host = ui.h("div");
  root.append(host);
  host.append(ui.notice("info", "Running your plan with each quote..."));
  ctx.computeRemote("retirement/annuities", { today: fmt.today() }).then(draw, (e) => host.replaceChildren(ui.notice("error", `The quotes could not be checked: ${e}. Reload the page; if it keeps happening, check Will the money last? first.`)));

  function draw(d) {
    host.replaceChildren();
    let editing = null;
    if (!d.quotes.length) host.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "An income for life"),
      ui.h("p", { class: "lede" }, "An income annuity turns a sum of savings into a monthly payment for as long as you live, like a pension you buy. It cannot run out, but the money is gone once paid. Enter a quote and see what it would do to your plan."),
      ui.h("p", { class: "muted small" }, "Quotes come free from insurers or comparison sites: give your age, the sum and when you want the payments to start.")));
    if (!d.ready) host.append(ui.card(null, ui.h("p", { class: "muted" }, `To check a quote against your plan, it needs: ${d.missing.join("; ")}.`)));
    for (const q of d.quotes) {
      const card = ui.card(q.name);
      card.append(ui.h("p", { class: "an-d" }, `${money(q.premium)} now for ${money(q.monthly)} a month from ${q.personName}'s ${q.startAge}${q.joint && q.partnerName ? `, for as long as ${q.personName} or ${q.partnerName} lives` : ", for life"}, ${q.cola ? "rising with prices" : "the same dollars every year"}${q.insurer ? ` (${q.insurer})` : ""}.`));
      const ladderBetter = q.ladderSaving < 0;
      if (q.rate !== null && Number.isFinite(q.rate)) card.append(
        ui.h("p", { class: `an-v ${ladderBetter ? "warn" : "ok"}` }, ladderBetter ? `Bonds paying the same until ${q.endAge} would cost ${money(q.ladderCost)}: less than the annuity.` : `Bonds paying the same until ${q.endAge} would cost ${money(q.ladderCost)}: the annuity is ${money(q.ladderSaving)} cheaper.`),
        ui.h("p", { class: "an-d" }, `It pays ${pct(q.payoutRate)} of the sum a year; over the lifetime ${q.joint ? "the two of you are" : `${q.personName} is`} likely to have, that is like a ${pct(q.rate)} return. The bonds stop at ${q.endAge}; the annuity keeps paying after, which is what it is for.`));
      if (q.withIt) {
        const b = d.base, w = q.withIt;
        const row = (label, x, y) => ui.h("li", {}, ui.h("span", {}, label), ui.h("b", {}, x), ui.h("b", {}, y));
        card.append(ui.h("ul", { class: "an-figs", style: { marginTop: "10px" } },
          ui.h("li", {}, ui.h("span", {}), ui.h("span", { class: "an-h" }, "Plan now"), ui.h("span", { class: "an-h" }, "With it")),
          row("Chance the money lasts", pct(b.chance), pct(w.chance)),
          row("Could spend a month", money(b.affordableMonthly), money(w.affordableMonthly)),
          row("Guaranteed income covers", q.floorBefore === null ? "-" : pct(q.floorBefore), q.floorAfter === null ? "-" : pct(q.floorAfter)),
          row("Left at the end", money(b.endReal), money(w.endReal))),
          ui.h("p", { class: "muted small" }, "Guaranteed income covers: Social Security, pensions and annuities as a share of the first retirement year's spending. Today's dollars."));
      }
      card.append(ui.row(ui.button("Change", () => { editing = (plan.retirement.annuities ?? []).find((y) => y.id === q.id); drawForm(true); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); }, { class: "secondary" })));
      host.append(card);
    }
    const formHost = ui.h("div");
    const fields = [
      { key: "name", label: "Quote", type: "text", required: true, placeholder: "e.g. Income at 65" },
      { key: "insurer", label: "Insurer", type: "text" },
      { key: "personId", label: "On whose life", type: "select", options: people.map((p) => ({ value: p.id, label: p.name })) },
      { key: "premium", label: "You pay", type: "money", min: 0 },
      { key: "monthly", label: "It pays a month", type: "money", min: 0 },
      { key: "startAge", label: "From age", type: "number", min: 40, max: 90, step: "1", help: "now, or later (a deferred annuity)" },
      { key: "joint", label: "Keeps paying while either of us lives (joint life)", type: "checkbox" },
      { key: "cola", label: "Rises with prices each year", type: "checkbox" },
    ];
    const drawForm = (open = !d.quotes.length) => {
      formHost.innerHTML = "";
      if (!open && !editing) { formHost.append(ui.button("+ Add a quote", () => drawForm(true), { class: "secondary" })); return; }
      formHost.append(...[ui.h("h2", {}, editing ? `Change ${editing.name}` : "Add a quote"), ui.form(fields, editing ? { ...editing } : { personId: people.find((p) => p.role === "self")?.id ?? "", startAge: 65 }, (v) => {
        const clean = { name: v.name.trim(), insurer: (v.insurer ?? "").trim(), personId: v.personId, premium: v.premium ?? 0, monthly: v.monthly ?? 0, startAge: v.startAge ?? 65, joint: !!v.joint, cola: !!v.cola };
        if (!clean.name) return;
        pending = editing ? "Changes saved." : `${clean.name} added.`;
        const id = editing?.id;
        store.update((p) => {
          p.retirement = p.retirement ?? {}; p.retirement.annuities = p.retirement.annuities ?? [];
          if (id) { const i = p.retirement.annuities.findIndex((y) => y.id === id); if (i >= 0) p.retirement.annuities[i] = { ...p.retirement.annuities[i], ...clean }; }
          else p.retirement.annuities.push({ id: ui.uid(), ...clean });
        });
      }, { submitLabel: editing ? "Save changes" : "Add quote", resetAfter: !editing, onCancel: (editing || d.quotes.length) ? () => { editing = null; drawForm(false); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.name}`, () => {
        if (!ui.confirm(`Remove ${editing.name}?`)) return;
        const id = editing.id, name = editing.name; editing = null;
        pending = `${name} removed.`;
        store.update((p) => { p.retirement.annuities = (p.retirement.annuities ?? []).filter((y) => y.id !== id); });
      }, { class: "danger" })) : null].filter(Boolean));
    };
    drawForm();
    host.append(ui.card(null, out, formHost));
    host.append(ui.card("Good to know", ui.h("ul", {},
      ui.h("li", {}, "A quote here is a what-if: the plan only counts an annuity you have bought (add it as a pension)."),
      ui.h("li", {}, "Bought with savings outside retirement accounts, part of each payment is your own money back and is not taxed; inside an IRA it is all taxed. The plan taxes all of it, to be safe."),
      ui.h("li", {}, "Each state guarantees annuities up to a limit (often $250,000 per insurer) if an insurer fails: spread larger sums.")),
      ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/pensions" }, "Pensions"), ui.h("a", { class: "btn secondary", href: "#/retirement/monte-carlo" }, "Chance the money lasts"))));
  }
}
