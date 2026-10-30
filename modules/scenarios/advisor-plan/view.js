// modules/scenarios/advisor-plan/view.js -- DOM only. The advisor's assumptions in one form; then their
// plan against yours, which assumption makes the difference, what the fee costs, and their quoted chance
// against the one this app gets with the same assumptions. Runs on the PC when connected.
import { LEVERS } from "../compare/compute.js";
import { ADVISOR_LEVERS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.ap-root .ap-figs { list-style: none; margin: 0; padding: 0; }
.ap-root .ap-figs li { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); align-items: baseline; }
.ap-root .ap-figs li:last-child { border-bottom: 0; }
.ap-root .ap-figs .ap-h { color: var(--muted); font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: .04em; }
.ap-root .ap-figs b { white-space: nowrap; text-align: right; min-width: 80px; }
.ap-root .ap-eff { list-style: none; margin: 0; padding: 0; }
.ap-root .ap-eff li { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--line); }
.ap-root .ap-eff li:last-child { border-bottom: 0; }
.ap-root .ap-up { color: var(--ok); white-space: nowrap; } .ap-root .ap-down { color: var(--bad); white-space: nowrap; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const root = ui.h("div", { class: "ap-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const host = ui.h("div");
  root.append(host);
  host.append(ui.notice("info", "Running your plan and the advisor's..."));
  ctx.computeRemote("scenarios/advisor-plan", { today: fmt.today() }).then(draw, (e) => host.replaceChildren(ui.notice("error", `The comparison could not run: ${e}. Reload the page; if it keeps happening, check Will the money last? first.`)));

  function draw(d) {
    host.replaceChildren();
    if (!d.entered) host.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Check an advisor's plan"),
      ui.h("p", { class: "lede" }, "An advisor's plan rests on a few assumptions: the returns, inflation, when you retire, what you spend, and their fee. Enter the ones in their report and this page runs them through the same engine as your plan, so you can see which assumption makes their numbers look the way they do."),
      ui.h("p", { class: "muted small" }, "The assumptions page of the report usually lists them; ask for it if not.")));
    if (!d.ready) { host.append(ui.card(null, ui.h("p", { class: "muted" }, `To compare, your plan needs: ${d.missing.join("; ")}.`))); host.append(formCard(d)); return; }
    if (d.entered && d.theirs) {
      const y = d.yours, t = d.theirs;
      const row = (label, a, b) => ui.h("li", {}, ui.h("span", {}, label), ui.h("b", {}, a), ui.h("b", {}, b));
      host.append(ui.card(d.firm ? `Your plan and ${d.firm}${/s$/i.test(d.firm) ? "'" : "'s"}` : "Your plan and the advisor's", ui.h("ul", { class: "ap-figs" },
        ui.h("li", {}, ui.h("span", {}), ui.h("span", { class: "ap-h" }, "Yours"), ui.h("span", { class: "ap-h" }, "Advisor's")),
        row("Does the money last?", y.success ? "Yes" : `to ${y.failYear}`, t.success ? "Yes" : `to ${t.failYear}`),
        row("Chance it lasts", pct(y.chance), pct(t.chance)),
        row("Could spend a month", money(y.affordableMonthly), money(t.affordableMonthly)),
        row("Plans to spend a month", money(y.spendingMonthly), money(t.spendingMonthly)),
        row("Left at the end", money(y.endReal), money(t.endReal))),
        ui.h("p", { class: "muted small" }, `The advisor's version: ${d.described.join("; ")}. Today's dollars; the chance is over 400 simulated markets.`)));
      if (d.effects.length) host.append(ui.card("What makes the difference", ui.h("p", { class: "muted small" }, "Each of their assumptions on its own, put into your plan: how much more or less room it leaves a month (what the plan could spend, less what it plans to spend)."),
        ui.h("ul", { class: "ap-eff" }, d.effects.map((e) => ui.h("li", {}, ui.h("span", {}, e.text[0].toUpperCase() + e.text.slice(1)), ui.h("span", { class: e.roomMonthly >= 0 ? "ap-up" : "ap-down" }, `${e.roomMonthly >= 0 ? "+" : "−"}${money(Math.abs(e.roomMonthly))} a month`))))));
      if (d.feeCost) host.append(ui.card("What the fee costs", ui.row(ui.stat("Over the plan", money(d.feeCost.endReal), "less left at the end, today's dollars"), ui.stat("A month", money(d.feeCost.affordableMonthly), "less you could spend in retirement")),
        ui.h("p", { class: "muted small" }, `A fee of ${Math.round(d.fee * 1000) / 10}% a year comes out every year whatever the markets do. Whether the advice is worth it is your call; this is its price.`)));
      if (d.quotedChance !== null && d.chanceGap !== null) host.append(ui.card("Their quoted chance", ui.h("p", {}, `They quote ${pct(d.quotedChance)}; with the same assumptions this app gets ${pct(t.chance)}. ${Math.abs(d.chanceGap) < 0.05 ? "Close enough: different simulations differ by a few points." : d.chanceGap > 0 ? "Theirs is higher. Worth asking whether their figure includes the fee, inflation on spending, and taxes, and how volatile they assume markets are." : "Theirs is lower: their simulation is more cautious than this one."}`)));
    }
    host.append(formCard(d));
    host.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/scenarios/compare" }, "Compare what-ifs"), ui.h("a", { class: "btn secondary", href: "#/system/assumptions" }, "Your assumptions"))));
  }

  function formCard(d) {
    const A = plan.advisor ?? {};
    const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
    const fields = [
      { key: "firm", label: "Advisor or firm", type: "text", placeholder: "e.g. the firm's name" },
      { key: "date", label: "Date of the plan", type: "date" },
    ];
    for (const lv of LEVERS.filter((l) => ADVISOR_LEVERS.includes(l.key))) for (const a of lv.person ? adults : [null]) {
      const k = lv.person ? `${lv.key}:${a.id}` : lv.key;
      const now = lv.person ? lv.get(plan, a.id) : lv.get(plan);
      fields.push({ key: k, label: a ? `${a.name}: ${lv.label.toLowerCase()}` : lv.label, type: lv.type, min: lv.min ?? 0, max: lv.max, step: lv.type === "number" ? "1" : undefined, help: lv.key === "extraSavingMonthly" ? "what they recommend saving beyond what you save now" : now !== null && now !== undefined && now !== 0 ? `yours: ${lv.type === "percent" ? `${Math.round(now * 1000) / 10}%` : lv.type === "money" ? money(now) : now}` : undefined });
    }
    fields.push({ key: "fee", label: "Their fee a year", type: "percent", min: 0, max: 5, help: "the advisory fee, plus the funds' own costs if they say" }, { key: "quotedChance", label: "Chance of success they quote", type: "percent", min: 0, max: 100 }, { key: "notes", label: "Their recommendations", type: "textarea", rows: 3 });
    const values = { firm: A.firm ?? "", date: A.date ?? "", fee: A.fee ?? null, quotedChance: A.quotedChance ?? null, notes: A.notes ?? "", ...(A.changes ?? {}) };
    const form = ui.form(fields, values, (v) => {
      const changes = {};
      for (const f of fields) if (!["firm", "date", "fee", "quotedChance", "notes"].includes(f.key) && v[f.key] !== null && v[f.key] !== undefined && v[f.key] !== "") changes[f.key] = v[f.key];
      pending = "Advisor's plan saved.";
      store.update((p) => { p.advisor = { firm: (v.firm ?? "").trim(), date: v.date || "", fee: v.fee ?? null, quotedChance: v.quotedChance ?? null, notes: v.notes ?? "", changes }; });
    }, { submitLabel: d.entered ? "Save changes" : "Compare" });
    if (!d.entered) return ui.card("From their report", ui.h("p", { class: "muted small" }, "Fill in only what their report states; anything empty stays as your plan has it."), form);
    return ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Their assumptions"), ui.h("span", { class: "fold-status" }, d.firm || "entered"), ui.h("span", { class: "fold-chev" }, "›")), form);
  }
}
