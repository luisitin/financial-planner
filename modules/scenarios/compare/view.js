// modules/scenarios/compare/view.js -- DOM only. Your plan and its copies side by side: a table on wide
// screens, one card per scenario on a phone with the difference from the plan; quick starters; one form
// to make or change a copy (only the levers you fill in change). Runs on the PC when connected.
import { LEVERS, MAX_SCENARIOS, PATHS, chanceShown, carry, askWords, madeWords, backWords, whatIfOnly, makeMyPlan, putBack, answerFor, offers, EASE_CHOICES, STRATEGY_CHOICES, SAME_AS_PLAN, choiceHelp } from "./compute.js";
import { part } from "../../../core/ui/more.js";
import { knownChance } from "../../retirement/careful.js";
import { needItem } from "../../../core/words.js";

// the confirmation shown on the next render: a sentence (shown at the top), or, after "Make this my plan" or "Undo: put my
// plan back", { part: the version's id, name, made: how many changes | back: what was put back }, shown in that
// version's part, which stays open (docs/OPTIONAL.md R17); left: how many things of the version were not carried
let pending = null;

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
.sc-root .sc-say { margin: 0; }
.sc-root .sc-d { display: block; font-size: var(--fs-xs); text-align: right; }
`;

/** The line under the comparison that says where the chance comes from (W7). */
export function chanceNote(about) {
  return about
    ? `Each version is tried on the same ${PATHS} pretend futures, so the differences are fair. The chance is rounded to the nearest 5. Open Chance the money lasts for your plan's exact figure; this page then uses it.`
    : `Your plan's chance is the one from Chance the money lasts. Each copy's goes up or down by how it did against your plan on the same ${PATHS} pretend futures.`;
}

/** What Remove asks: a version that was made the plan holds the way back, and says so. */
export function removeWords(name, made) {
  return made ? `Remove ${name}? Your plan stays as it is now. The way to put it back as it was goes with this version.` : `Remove ${name}?`;
}

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const sym = fmt.money(0, cur).replace(/[\d.,\s]/g, "");
  const big = (n) => (Math.abs(n) >= 1e6 ? `${n < 0 ? "−" : ""}${sym}${(Math.abs(n) / 1e6).toFixed(2)}M` : money(n));
  const root = ui.h("div", { class: "sc-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const flash = pending && typeof pending === "object" ? pending : null;
  if (typeof pending === "string") { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); }
  pending = null;
  const today = fmt.today();
  const host = ui.h("div");
  root.append(host);
  host.append(ui.notice("info", "Running your plan and each scenario..."));
  ctx.computeRemote("scenarios/compare", { today }).then(draw, (e) => host.replaceChildren(ui.notice("error", `The scenarios could not run: ${e}. Reload the page; if it keeps happening, check Will the money last? first.`)));

  const save = (mutate, message) => { pending = message; store.update((p) => { p.scenarios = p.scenarios ?? []; mutate(p.scenarios); }); };
  const STARTERS = (d) => {
    const adults = d.adults;
    const ret = Object.fromEntries(adults.map((a) => [`retireAge:${a.id}`, Math.max(40, Number(d.current[`retireAge:${a.id}`]) - 3)]));
    const spend = Number(d.current.spendingMonthly) || 0;
    return [
      { name: "Retire 3 years earlier", changes: ret },
      spend > 0 ? { name: "Spend 10% less", changes: { spendingMonthly: Math.round(spend * 0.9 / 10) * 10 } } : null,
      { name: "Save $500 more a month", changes: { extraSavingMonthly: 500 } },
      { name: "Returns 1 percentage point lower", changes: { returnStocks: Math.round((Number(d.current.returnStocks) - 0.01) * 1000) / 1000, returnBonds: Math.round((Number(d.current.returnBonds) - 0.01) * 1000) / 1000 } },
      { name: "Pay a 1% advisor fee", changes: { fee: 0.01 } },
    ].filter(Boolean);
  };

  // "Make this my plan" (gap design #25): one quiet row on each version that has something the plan can take. Opened, it says
  // in words what would change and what is not carried, with one outlined button; after the tap the same row says so in
  // green with the new answer and offers the way back, which stays there (kept on the version, in the plan) until it is used.
  const greens = [];   // the green line just drawn (one for a phone, one for a wide screen): brought into view once the page is drawn
  const said = (text) => ui.h("p", { class: "small sc-say" }, text);
  function usePart(s, wide) {
    const rec = (plan.scenarios ?? []).find((x) => x?.id === s.id);
    const made = rec?.madePlan ?? null;
    const mine = flash?.part === s.id ? flash : null;
    const c = made ? null : carry(plan, s.changes ?? {}, { today });
    if (!made && !c.carried.length && !mine) return null;
    const green = mine ? ui.notice("ok", mine.back ? backWords(s.name, mine.back) : madeWords(s.name, mine.made, answerFor(plan, { today }), mine.left ?? 0)) : null;
    if (green) greens.push(green);
    const id = `${wide ? "usew" : "use"}-${s.id}`;
    if (made) {
      const words = Array.isArray(made.words) ? made.words : [];
      // the way back first, right under the green line and called what it is (critic P4); the row says what it now is (P1)
      return part(ctx, { id, kind: "item", title: wide ? s.name : "This is your plan now", says: wide ? "in your plan" : "you can undo it", open: !!mine, body: [green,
        ui.row(ui.button("Undo: put my plan back", () => { pending = { part: s.id, name: s.name, back: { done: 0, kept: 0 } }; const p = pending; store.update((dr) => { p.back = putBack(dr, s.id); }); }, { class: "secondary" })),
        said(`You made this your plan${made.on ? ` on ${fmt.date(made.on)}` : ""}${words.length ? `. It changed ${words.length === 1 ? "1 thing" : `${words.length} things`}: ${words.join("; ")}.` : "."}`),
        ...whatIfOnly(s.changes ?? {}).map((x) => said(x)),
        said("Undo puts your plan back as it was. Anything you changed after that day is left as it is, and this version stays here either way.")] });
    }
    const n = c.carried.length;
    return part(ctx, { id, kind: "item", title: wide ? s.name : "Make this my plan", says: n === 1 ? "1 change" : n ? `${n} changes` : "", open: !!mine, body: [green,
      said(askWords(c)), ...c.not.map((t) => said(t)),
      n ? said("Every page of the app then uses the new figures. This version stays here, with Undo to put your plan back as it was.") : null,
      n ? ui.row(ui.button("Make this my plan", () => { pending = { part: s.id, name: s.name, made: n }; const p = pending; store.update((dr) => { const r = makeMyPlan(dr, s.id, { today }); p.made = r?.carried.length ?? 0; p.left = r?.not.length ?? 0; if (!p.made) pending = null; }); }, { class: "secondary" })) : null] });
  }

  function draw(d) {
    host.replaceChildren();
    if (!d || !d.ready) {
      host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Compare what-ifs"),
        ui.h("p", { class: "lede" }, "Make copies of your plan with a few things changed and see them side by side. It needs the basics of your plan first:"),
        ui.h("ul", {}, (d?.missing ?? []).map((m) => ui.h("li", {}, needItem(m)))), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Will the money last?"))));
      return;
    }
    const starters = ui.h("div", { class: "chips" }, STARTERS(d).map((s) => ui.h("button", { type: "button", class: "chip", disabled: d.scenarios.length >= MAX_SCENARIOS ? true : null, onClick: () => save((list) => list.push({ id: ui.uid(), name: s.name, changes: s.changes, createdAt: fmt.today() }), `${s.name} added.`) }, `+ ${s.name}`)));
    if (!d.scenarios.length) host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Compare what-ifs"),
      ui.h("p", { class: "lede" }, "Copy your plan, change a few things (retire earlier, spend less, save more, different returns) and see the results side by side. Your plan only changes if you tap Make this my plan on one of them."),
      ui.h("p", { class: "muted small" }, "Start from one of these, or make your own below:"), starters));

    // the chance: the Chance page's own figure for this plan when it ran on this visit, each copy moved from it by its difference
    // on the shared draw; else "about", to the nearest 5 (W7; compute.js chanceShown)
    const known = knownChance(ctx);
    const withChance = (r, own) => ({ ...r, shown: chanceShown(d.base.chance, own ? null : r.chance, known) });
    const cols = [{ name: "Your plan", r: withChance(d.base, true), described: [] }, ...d.scenarios.filter((s) => s.results).map((s) => ({ ...s, r: withChance(s.results, false) }))];
    const about = cols.some((c) => c.r.shown.about);
    const ROWS = [
      // one answer per card (stress test 2026-11-11, RC-8: "Does the money last? Yes" over "Chance it lasts 37%"): the chance first,
      // then the straight-line run named as what it is
      ["Chance it lasts", (r) => r.shown.text, (r) => r.shown.value, (x) => `${x > 0 ? "+" : "−"}${Math.abs(Math.round(x * 100))} points`],
      ["If markets do as well as average", (r) => (r.success ? "lasts" : `runs out in ${r.failYear}`), null],
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
          const diff = i && val && val(c.r) !== null && val(cols[0].r) !== null ? val(c.r) - val(cols[0].r) : 0;
          return ui.h("li", {}, ui.h("span", {}, label), ui.h("b", {}, show(c.r), i && val && Math.abs(diff) > (label === "Chance it lasts" ? 0.005 : 5) ? ui.h("span", { class: `sc-d ${diff > 0 ? "sc-up" : "sc-down"}` }, delta(diff)) : null));
        })),
        ...(i ? (c.notes ?? []).map((t) => ui.notice("warn", t)) : []),
        i ? ui.row(ui.button("Edit", () => openEditor(d.scenarios.find((s) => s.id === c.id), d), { class: "secondary" }), ui.button("Remove", () => { if (ui.confirm(removeAsk(c))) save((list) => list.splice(list.findIndex((s) => s.id === c.id), 1), `${c.name} removed.`); }, { class: "secondary" })) : null,
        i ? folds(usePart(c, false)) : null)));
      host.append(ui.card("Side by side", ui.h("div", { class: "only-wide" }, table, ui.h("p", { class: "muted small" }, d.scenarios.map((s) => `${s.name}: ${s.described.join("; ") || "nothing changed"}`).join(". "))), ui.h("p", { class: "muted small" }, `Money in today's dollars. Spending is the most each version could spend a month in retirement and still last. ${chanceNote(about)}`)));
      host.append(ui.h("div", { class: "only-narrow" }, cards));
      host.append(ui.h("div", { class: "only-wide" }, ui.card("Change a scenario", ui.row(...d.scenarios.map((s) => ui.button(s.name, () => openEditor(s, d), { class: "secondary" }))),
        ...d.scenarios.flatMap((s) => (s.notes ?? []).map((t) => ui.notice("warn", `${s.name}: ${t}`))))));
      const wideParts = d.scenarios.filter((s) => s.results).map((s) => usePart(s, true)).filter(Boolean);
      if (wideParts.length) host.append(ui.h("div", { class: "only-wide" }, ui.card("Make a version your plan", ui.h("div", { class: "folds" }, wideParts))));
      if (d.scenarios.length < MAX_SCENARIOS) host.append(ui.card("Another one", starters, ui.row(ui.button("+ Make your own", () => openEditor(null, d), { class: "secondary" }))));
    } else host.append(ui.card(null, ui.row(ui.button("+ Make your own", () => openEditor(null, d), { class: "secondary" }))));
    host.append(editorHost);
    // the page was drawn again from the top of its sums: the green line is where the eye is, whatever its part's height
    const shownGreen = greens.find((g) => g.offsetParent);
    if (shownGreen) setTimeout(() => ui.reveal?.(shownGreen, { block: "start" }), 0);
    host.append(ui.card("More on this", ui.row(ui.h("a", { class: "btn secondary", href: "#/scenarios/advisor-plan" }, "An advisor's plan"), ui.h("a", { class: "btn secondary", href: "#/scenarios/goal-seek" }, "Goal seek"), about ? ui.h("a", { class: "btn secondary", href: "#/retirement/monte-carlo" }, "Chance the money lasts ›") : null)));
  }

  const folds = (el) => (el ? ui.h("div", { class: "folds", style: { marginTop: "8px" } }, el) : null);
  const removeAsk = (c) => removeWords(c.name, !!(plan.scenarios ?? []).find((x) => x?.id === c.id)?.madePlan);

  // make or change a scenario: only the levers filled in change; the placeholders show the plan's own values. The first
  // boxes are the ones most versions change (retire, spend, save); the rest wait under "More details (optional)"
  // (docs/OPTIONAL.md R21), the levers of gap design #25 last among them
  const FIRST = ["retireAge", "spendingMonthly", "extraSavingMonthly"];
  const editorHost = ui.h("div");
  function openEditor(s, d) {
    const fields = [{ key: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Retire at 60" }];
    const keyOf = (lv, a) => (lv.person ? `${lv.key}:${a.id}` : lv.key);
    for (const lv of LEVERS.filter((l) => !l.choice)) for (const a of lv.person ? d.adults : [null]) {
      const k = keyOf(lv, a);
      const now = d.current[k];
      const shown = now === null || now === undefined ? "" : lv.type === "percent" ? `${Math.round(now * 1000) / 10}%` : lv.type === "money" ? money(now) : String(now);
      fields.push({ key: k, label: a ? `${a.name}: ${lv.label[0].toLowerCase()}${lv.label.slice(1)}` : lv.label, type: lv.type, min: lv.signed ? undefined : lv.min ?? 0, max: lv.max, step: lv.type === "number" ? "1" : undefined, help: shown && !lv.input ? `the plan: ${shown}` : lv.key === "lumpYear" ? "with the one-time sum" : undefined, more: !FIRST.includes(lv.key) });
    }
    // more levers (gap design #25): two short lists, then the home and working less, each only where the plan has what it needs
    const o = offers(plan, { today });
    // each list says under it, in one plain sentence, what the choice it shows does (critic P2); "Same as my plan" fits 320 px (P3)
    const same = { value: "", label: SAME_AS_PLAN };
    const lines = {};
    const says = (key) => (lines[key] = ui.h("span", { "aria-live": "polite" }, choiceHelp(key, (s?.changes ?? {})[key] ?? "", o)));
    fields.push({ key: "spendingEase", label: "Spending as you age", type: "select", more: true, options: [same, ...EASE_CHOICES], help: says("spendingEase") });
    fields.push({ key: "strategy", label: "How money is taken out", type: "select", more: true, options: [same, ...STRATEGY_CHOICES], help: says("strategy") });
    const yearBox = { type: "number", step: "1", min: o.nowYear, max: o.endYear ?? undefined, placeholder: `e.g. ${o.nowYear + 10}`, more: true };
    if (o.home) fields.push({ ...yearBox, key: "homeYear", label: "Year I sell or downsize the home" },
      { key: "homeBuyFor", label: "Then buy a home for", type: "money", more: true, help: "in today's dollars; leave empty if you would rent" },
      { key: "homeRent", label: "Or rent for, a month", type: "money", more: true, help: "leave both empty if no housing cost follows" });
    if (o.workers.length > 1) fields.push({ key: "lessWho", label: "Work less: who", type: "select", more: true, options: o.workers.map((w) => ({ value: w.id, label: w.name })) });
    if (o.workers.length) fields.push({ ...yearBox, key: "lessFrom", label: "Work less from", help: "the first year of less work, or of a break" },
      { ...yearBox, key: "lessUntil", label: "Work less until", help: "the last year; leave empty for one year" },
      { key: "lessShare", label: "Share of the usual pay kept", type: "percent", min: 0, max: 100, more: true, placeholder: "e.g. 50", help: "50 for half-time; leave empty for a break with no pay" });
    const values = { name: s?.name ?? "", ...(s?.changes ?? {}) };
    if (values.spendingEase !== undefined && values.spendingEase !== null) values.spendingEase = String(values.spendingEase);
    const formEl = ui.form(fields, values, (v) => {
      const changes = {};
      for (const f of fields.slice(1)) if (v[f.key] !== null && v[f.key] !== undefined && v[f.key] !== "") changes[f.key] = v[f.key];
      if (changes.spendingEase !== undefined) changes.spendingEase = Number(changes.spendingEase);
      // a price, a rent or a share with no year does nothing: say so at Save instead of saving a version that looks set
      const refuse = (text) => { editorHost.append(ui.notice("error", text)); return false; };
      if (changes.homeYear === undefined && (changes.homeBuyFor !== undefined || changes.homeRent !== undefined)) return refuse("Type the year the home is sold, or clear the price and the rent.");
      if (changes.lessFrom === undefined && (changes.lessUntil !== undefined || changes.lessShare !== undefined)) return refuse("Type the first year of working less, or clear the last year and the share.");
      if (changes.lessFrom === undefined) delete changes.lessWho; else if (!changes.lessWho && o.workers.length) changes.lessWho = o.workers[0].id;
      const name = v.name.trim() || "A scenario";
      if (s) save((list) => { const i = list.findIndex((x) => x.id === s.id); if (i >= 0) list[i] = { ...list[i], name, changes }; }, `${name} saved.`);
      else save((list) => list.push({ id: ui.uid(), name, changes, createdAt: fmt.today() }), `${name} added.`);
    }, { submitLabel: s ? "Save changes" : "Add scenario", onCancel: () => editorHost.replaceChildren() });
    for (const [key, line] of Object.entries(lines)) { const box = formEl.elements?.[key]; box?.addEventListener("change", () => { line.textContent = choiceHelp(key, box.value, o); }); }
    editorHost.replaceChildren(ui.card(s ? `Change ${s.name}` : "Make your own", ui.h("p", { class: "muted small" }, "Fill in only what changes; anything left empty stays as the plan has it."), formEl));
    editorHost.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
