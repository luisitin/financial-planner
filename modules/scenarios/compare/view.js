// modules/scenarios/compare/view.js -- DOM only. Your plan and its copies side by side: a table on wide
// screens, one card per scenario on a phone with the difference from the plan; quick starters; one form
// to make or change a copy (only the levers you fill in change). Runs on the PC when connected.
import { LEVERS, MAX_SCENARIOS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.sc-root table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
.sc-root th, .sc-root td { text-align: right; padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
.sc-root th:first-child, .sc-root td:first-child { text-align: left; }
.sc-root th { font-weight: 650; }
.sc-root .sc-cards { display: grid; gap: 12px; }
.sc-root .sc-card h3 { margin: 0 0 4px; }
.sc-root .sc-what { color: var(--text-2); font-size: var(--fs-sm); margin: 0 0 8px; }
.sc-root .sc-figs { list-style: none; margin: 0; padding: 0; }
.sc-root .sc-figs li { display: flex; justify-content: space-between; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.sc-root .sc-figs li:last-child { border-bottom: 0; }
.sc-root .sc-figs b { white-space: nowrap; }
.sc-root .sc-up { color: var(--ok); } .sc-root .sc-down { color: var(--bad); }
.sc-root .sc-d { display: block; font-size: var(--fs-xs); text-align: right; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const sym = fmt.money(0, cur).replace(/[\d.,\s]/g, "");
  const big = (n) => (Math.abs(n) >= 1e6 ? `${n < 0 ? "−" : ""}${sym}${(Math.abs(n) / 1e6).toFixed(2)}M` : money(n));
  const root = ui.h("div", { class: "sc-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const host = ui.h("div");
  root.append(host);
  host.append(ui.notice("info", "Running your plan and each scenario..."));
  ctx.computeRemote("scenarios/compare", { today: fmt.today() }).then(draw, (e) => host.replaceChildren(ui.notice("error", `The scenarios could not run: ${e}. Reload the page; if it keeps happening, check Will the money last? first.`)));

  const save = (mutate, message) => { pending = message; store.update((p) => { p.scenarios = p.scenarios ?? []; mutate(p.scenarios); }); };
  const STARTERS = (d) => {
    const adults = d.adults;
    const ret = Object.fromEntries(adults.map((a) => [`retireAge:${a.id}`, Math.max(40, Number(d.current[`retireAge:${a.id}`]) - 3)]));
    const spend = Number(d.current.spendingMonthly) || 0;
    return [
      { name: "Retire 3 years earlier", changes: ret },
      spend > 0 ? { name: "Spend 10% less", changes: { spendingMonthly: Math.round(spend * 0.9 / 10) * 10 } } : null,
      { name: "Save $500 more a month", changes: { extraSavingMonthly: 500 } },
      { name: "Returns 1 point lower", changes: { returnStocks: Math.round((Number(d.current.returnStocks) - 0.01) * 1000) / 1000, returnBonds: Math.round((Number(d.current.returnBonds) - 0.01) * 1000) / 1000 } },
      { name: "Pay a 1% adviser fee", changes: { fee: 0.01 } },
    ].filter(Boolean);
  };

  function draw(d) {
    host.replaceChildren();
    if (!d || !d.ready) {
      host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Compare what-ifs"),
        ui.h("p", { class: "lede" }, "Make copies of your plan with a few things changed and see them side by side. It needs the basics of your plan first:"),
        ui.h("ul", {}, (d?.missing ?? []).map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Will the money last?"))));
      return;
    }
    const starters = ui.h("div", { class: "chips" }, STARTERS(d).map((s) => ui.h("button", { type: "button", class: "chip", disabled: d.scenarios.length >= MAX_SCENARIOS ? true : null, onClick: () => save((list) => list.push({ id: ui.uid(), name: s.name, changes: s.changes, createdAt: fmt.today() }), `${s.name} added.`) }, `+ ${s.name}`)));
    if (!d.scenarios.length) host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Compare what-ifs"),
      ui.h("p", { class: "lede" }, "Copy your plan, change a few things (retire earlier, spend less, save more, different returns) and see the results side by side. Your plan itself never changes."),
      ui.h("p", { class: "muted small" }, "Start from one of these, or make your own below:"), starters));

    const cols = [{ name: "Your plan", r: d.base, described: [] }, ...d.scenarios.filter((s) => s.results).map((s) => ({ ...s, r: s.results }))];
    const ROWS = [
      ["Does the money last?", (r) => (r.success ? "Yes" : `Runs out ${r.failYear}`), null],
      ["Chance it lasts", (r) => (r.chance === null ? "-" : `${Math.round(r.chance * 100)}%`), (r) => r.chance, (x) => `${x > 0 ? "+" : ""}${Math.round(x * 100)} pts`],
      ["Could spend a month", (r) => money(r.affordableMonthly), (r) => r.affordableMonthly, (x) => `${x > 0 ? "+" : "−"}${money(Math.abs(x))}`],
      ["Saved at retirement", (r) => big(r.atRetirementReal), (r) => r.atRetirementReal, (x) => `${x > 0 ? "+" : "−"}${big(Math.abs(x))}`],
      ["Left at the end", (r) => big(r.endReal), (r) => r.endReal, (x) => `${x > 0 ? "+" : "−"}${big(Math.abs(x))}`],
    ];
    if (d.scenarios.length) {
      // wide: one table
      const table = ui.h("table", {}, ui.h("thead", {}, ui.h("tr", {}, ui.h("th", {}, ""), cols.map((c) => ui.h("th", {}, c.name)))),
        ui.h("tbody", {}, ROWS.map(([label, show]) => ui.h("tr", {}, ui.h("td", {}, label), cols.map((c) => ui.h("td", {}, show(c.r)))))));
      // a phone: one card each, with the difference from the plan
      const cards = ui.h("div", { class: "sc-cards" }, cols.map((c, i) => ui.h("div", { class: "card sc-card" }, ui.h("h3", {}, c.name), i ? ui.h("p", { class: "sc-what" }, c.described.length ? c.described.join("; ") : "Nothing changed yet.") : ui.h("p", { class: "sc-what" }, "As the plan stands."),
        ui.h("ul", { class: "sc-figs" }, ROWS.map(([label, show, val, delta]) => {
          const diff = i && val ? val(c.r) - val(d.base) : 0;
          return ui.h("li", {}, ui.h("span", {}, label), ui.h("b", {}, show(c.r), i && val && Math.abs(diff) > (label === "Chance it lasts" ? 0.005 : 5) ? ui.h("span", { class: `sc-d ${diff > 0 ? "sc-up" : "sc-down"}` }, delta(diff)) : null));
        })),
        i ? ui.row(ui.button("Change", () => openEditor(d.scenarios.find((s) => s.id === c.id), d), { class: "secondary" }), ui.button("Remove", () => { if (ui.confirm(`Remove ${c.name}?`)) save((list) => list.splice(list.findIndex((s) => s.id === c.id), 1), `${c.name} removed.`); }, { class: "secondary" })) : null)));
      host.append(ui.card("Side by side", ui.h("div", { class: "only-wide" }, table, ui.h("p", { class: "muted small" }, d.scenarios.map((s) => `${s.name}: ${s.described.join("; ") || "nothing changed"}`).join(". "))), ui.h("p", { class: "muted small" }, "Money in today's dollars. The chance is over 400 simulated markets; spending is the most each version could spend a month in retirement and still last.")));
      host.append(ui.h("div", { class: "only-narrow" }, cards));
      host.append(ui.h("div", { class: "only-wide" }, ui.card("Change a scenario", ui.row(...d.scenarios.map((s) => ui.button(s.name, () => openEditor(s, d), { class: "secondary" }))))));
      if (d.scenarios.length < MAX_SCENARIOS) host.append(ui.card("Another one", starters, ui.row(ui.button("+ Make your own", () => openEditor(null, d), { class: "secondary" }))));
    } else host.append(ui.card(null, ui.row(ui.button("+ Make your own", () => openEditor(null, d), { class: "secondary" }))));
    host.append(editorHost);
    host.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/scenarios/advisor-plan" }, "An adviser's plan"), ui.h("a", { class: "btn secondary", href: "#/scenarios/goal-seek" }, "Goal seek"))));
  }

  // make or change a scenario: only the levers filled in change; the placeholders show the plan's own values
  const editorHost = ui.h("div");
  function openEditor(s, d) {
    const fields = [{ key: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Retire at 60" }];
    const keyOf = (lv, a) => (lv.person ? `${lv.key}:${a.id}` : lv.key);
    for (const lv of LEVERS) for (const a of lv.person ? d.adults : [null]) {
      const k = keyOf(lv, a);
      const now = d.current[k];
      const shown = now === null || now === undefined ? "" : lv.type === "percent" ? `${Math.round(now * 1000) / 10}%` : lv.type === "money" ? money(now) : String(now);
      fields.push({ key: k, label: a ? `${a.name}: ${lv.label.toLowerCase()}` : lv.label, type: lv.type, min: lv.signed ? undefined : lv.min ?? 0, max: lv.max, step: lv.type === "number" ? "1" : undefined, help: shown && !lv.input ? `the plan: ${shown}` : lv.key === "lumpYear" ? "with the one-off sum" : undefined });
    }
    const values = { name: s?.name ?? "", ...(s?.changes ?? {}) };
    editorHost.replaceChildren(ui.card(s ? `Change ${s.name}` : "Make your own", ui.h("p", { class: "muted small" }, "Fill in only what changes; anything left empty stays as the plan has it."), ui.form(fields, values, (v) => {
      const changes = {};
      for (const f of fields.slice(1)) if (v[f.key] !== null && v[f.key] !== undefined && v[f.key] !== "") changes[f.key] = v[f.key];
      const name = v.name.trim() || "A scenario";
      if (s) save((list) => { const i = list.findIndex((x) => x.id === s.id); if (i >= 0) list[i] = { ...list[i], name, changes }; }, `${name} saved.`);
      else save((list) => list.push({ id: ui.uid(), name, changes, createdAt: fmt.today() }), `${name} added.`);
    }, { submitLabel: s ? "Save changes" : "Add scenario", onCancel: () => editorHost.replaceChildren() })));
    editorHost.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
