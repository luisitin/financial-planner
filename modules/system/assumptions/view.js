// modules/system/assumptions/view.js -- DOM only. One form with every assumption (the two that move the retirement answer most
// first, the other eight one tap away), a plain line under each field, the sources in one fold at the end, a "reviewed" status
// and a reset.
// Layout and wording per docs/DESIGN_LOG.md 2026-09-15 (Assumptions round 17).
import { compute, ASSUMPTIONS, RETURN_PRESETS, INFLATION_PRESETS, HOPEFUL_MAX, HOPEFUL_WORDS, FORECAST_LINE, FORECAST_SOURCE, saveAssumptions } from "./compute.js";
// the retirement answer before and after a save (owner's request 2026-11-11, spec L5): one projection at average markets, the
// verdict Will the money last? shows, in the words Contributions uses after a save
import { answerOf, answerChangeWords } from "../../retirement/levers.js";

// One plain sentence per field; the full sourcing from compute.js goes in the fold below.
const PLAIN = {
  inflation: "How fast prices rise.",
  returnStocks: "Before inflation; ours is the middle figure, which leaves room for fees and bad decades.",
  returnBonds: "Before inflation.",
  returnCash: "Savings and money-market accounts; roughly keeps pace with prices over time.",
  stdevStocks: "How far a normal year can land from the average; used by the what-if pages.",
  stdevBonds: "Same idea for bonds.",
  salaryGrowth: "Typical yearly raise: about inflation plus a little.",
  retirementAge: "The usual planning age; each person can have their own on the People page.",
  planEndAge: "Planning this long leaves a margin; each person can have their own.",
  emergencyMonths: "Three to six is the usual advice; more if income is irregular or there is one earner.",
};

// The shell re-renders after store.update, so a confirmation waits here for the next render.
let pending = null;
// a link that names one box (?show=emergencyMonths) brings it to the middle of the screen once per arrival; the shell redraws
// with the same route object after a save, a new address makes a new one (stress test p-balance/x-2, 2026-11-11)
const shown = new WeakSet();

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const d = compute(plan, { today: fmt.today() });
  const defText = (x) => x.kind === "percent" ? fmt.pct(x.def, 1) : String(x.def);
  // a link that names one number (?show=returnStocks, from "What this rests on" and other pages): that number alone, with its
  // own Save right under it, and the other nine one quiet tap away (review 2026-11-12, P4: a tapped chip looked applied, Save
  // was a screen and a half down, and Back lost it without a word; simple first, detail on request: owner, 2026-11-12)
  const focusKey = ASSUMPTIONS.some((x) => x.key === ctx.route?.query?.show) ? ctx.route.query.show : null;
  // opened plainly (from the menu), the two the owner named first, how fast investments grow and how fast prices rise, with their
  // chips and Save; the other eight under the same fold (the final review F6, 2026-11-13: ten boxes and their chips on a page
  // 2,468 px tall; owner, 2026-11-13: "it should stay simple by default")
  const shownKeys = focusKey ? [focusKey] : ["inflation", "returnStocks"];
  let moreFold = null;

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Assumptions"),
    ui.h("p", { class: "lede" }, "Ten numbers drive every projection: how fast prices rise, how much investments grow, when you retire, how long the money must last. The defaults are middle-of-the-road; change any that your advisor set differently."),
    ui.h("p", { class: "muted small" }, "Percentages are typed as plain numbers: 7 means 7% a year."),
  ));

  // Review status as a notice, not a tile; right after a save its own notice says it (the shell repeats the first new green
  // notice at the foot of the screen when the top is out of view, so that one must be the save's, with its answer: spec L5)
  const justSaved = !!pending;
  if (!d.reviewedAt) root.append(ui.notice("warn", "You have not looked the other numbers over yet. They are under \"All the numbers\"; saving with that open marks them as reviewed."));
  else if (d.stale) root.append(ui.notice("warn", `Reviewed on ${fmt.date(d.reviewedAt)}, more than a year ago. Open "All the numbers", look them over and save to mark them reviewed again.`));
  else if (!justSaved) root.append(ui.notice("ok", `Reviewed on ${fmt.date(d.reviewedAt)}.`));
  const out = ui.h("div");
  const money = (n) => fmt.money(n, plan.meta.currency);
  if (pending) {
    // a change to the figures says what it did to the retirement answer (spec L5); that notice stays, a plain one goes after 4 s
    let after = null;
    if (pending.before) { try { after = answerOf(plan, { today: fmt.today() }); } catch { after = null; } }
    const w = pending.before && after ? answerChangeWords(pending.before, after, money) : "";
    const n = ui.notice("ok", `${pending.text}${pending.review && d.reviewedAt ? ` Reviewed on ${fmt.date(d.reviewedAt)}.` : ""}${w ? ` Your retirement answer: ${w}.` : ""}`);
    out.append(n);
    if (!w) setTimeout(() => n.remove(), 4000);
    pending = null;
  }
  root.append(out);

  root.append(ui.card(null, ui.row(
    ui.stat("Changed from defaults", String(d.changedCount), d.changedCount ? "fields with your own number" : "all defaults"),
    ui.stat("Stocks after inflation", fmt.pct(d.realStocks, 1), `bonds ${fmt.pct(d.realBonds, 1)}, cash ${fmt.pct(d.realCash, 1)}`),
  )));
  // (the hopeful-return line is said under the stock box itself, where the figure is typed)
  for (const w of d.warnings) if (!w.includes(HOPEFUL_WORDS)) root.append(ui.notice("warn", w));

  const fields = ASSUMPTIONS.map((x) => ({
    key: x.key, label: x.label, type: x.kind === "percent" ? "percent" : "number",
    min: x.kind === "percent" ? x.min * 100 : x.min, max: x.kind === "percent" ? x.max * 100 : x.max, step: x.kind === "percent" ? "0.1" : "1",
    help: `${PLAIN[x.key] ?? ""} Default: ${defText(x)}.`.trim(),
  }));
  // ui.form shows percent fields as percentages itself (stored 0.07 -> shown 7), so pass the fractions.
  const values = Object.fromEntries(d.rows.map((r) => [r.key, r.value]));
  // the retirement answer now, kept for the notice after a save that changes a figure
  const answerNow = () => { try { return answerOf(plan, { today: fmt.today() }); } catch { return null; } };
  // what a save changed, in the notice (the final review F3: "Saved." while the box on screen still read 7, the change made under
  // the closed "All the numbers"): "prices rising 3% → 4%"
  const SHORT = { inflation: "prices rising", returnStocks: "stocks growing", returnBonds: "bonds growing", returnCash: "cash earning", stdevStocks: "how much stocks swing", stdevBonds: "how much bonds swing", salaryGrowth: "pay raises", retirementAge: "retirement age", planEndAge: "money lasting to age", emergencyMonths: "emergency fund months" };
  const said = (x, n) => (x.kind === "percent" ? `${Number((Number(n) * 100).toFixed(2))}%` : String(n));
  const movedIn = (v) => ASSUMPTIONS.filter((x) => v[x.key] !== null && v[x.key] !== undefined && !Number.isNaN(v[x.key]) && Math.abs(Number(v[x.key]) - values[x.key]) > 1e-9);
  const form = ui.form(fields, values, (v) => {
    const moved = movedIn(v);
    // saving is reviewing (design log 2026-09-15) when the person had all ten in front of them: with the rest folded, Save saves
    // and leaves the review date alone (they were not looked over)
    const review = !!moreFold?.open || !moreFold;
    const what = moved.map((x) => `${SHORT[x.key] ?? x.label} ${said(x, values[x.key])} → ${said(x, v[x.key])}`).join(", ");
    pending = { text: `${review ? "Saved and marked as reviewed" : "Saved"}${what ? `: ${what}` : ""}.`, before: moved.length ? answerNow() : null };
    // compute.js saveAssumptions, the code Will the money last?'s card tries
    store.update((p) => saveAssumptions(p, v, review ? fmt.today() : null));
  }, { submitLabel: "Save" });
  // careful, middle and hopeful above the stock box, and three figures above the inflation box (spec L5): outlined chips that
  // fill the box (nothing is saved until "Save and mark as reviewed"); the one the box holds is marked. The label is tied to
  // its box by id, so the chips can sit between the label and the box
  const pctOf = (x) => `${Number((x * 100).toFixed(2))}%`;
  const presets = (key, list, groupLabel, extra = null) => {
    const box = form.querySelector(`[name="${key}"]`);
    const lab = box?.closest("label");
    if (!box || !lab) return null;
    box.id = box.id || `as-${key}`;
    lab.htmlFor = box.id;
    const wrap = ui.h("div", { class: "chips as-chips", role: "group", "aria-label": groupLabel });
    const mark = () => { const n = Number(box.value); for (const b of wrap.children) { const on = box.value !== "" && Math.abs(Number(b.getAttribute("data-v")) * 100 - n) < 1e-6; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); } };
    for (const x of list) wrap.append(ui.h("button", { type: "button", class: "chip", "data-v": String(x.value), onClick: () => { box.value = String(Number((x.value * 100).toPrecision(10))); box.dispatchEvent(new Event("input", { bubbles: true })); mark(); } }, `${x.name ? `${x.name} ` : ""}${pctOf(x.value)}${x.ours ? " (ours)" : ""}`));
    box.addEventListener("input", mark);
    mark();
    lab.querySelector(".field-label")?.after(wrap, ...(extra ? [extra] : []));
    return box;
  };
  const stockBox = presets("returnStocks", RETURN_PRESETS, "Careful, middle or hopeful", ui.h("small", { class: "help as-forecast" }, FORECAST_LINE));
  presets("inflation", INFLATION_PRESETS, "A lower or higher figure");
  // the line under the form says what Save does: keep the numbers in view (and any changed under the fold), or, with the fold
  // open, mark them all as reviewed (round 17)
  const saveLine = ui.h("p", { class: "muted small", style: { marginTop: "12px" } });
  const these = shownKeys.length === 1 ? "this number" : "these two numbers";
  {
    const labelOf = (key) => form.querySelector(`[name="${key}"]`)?.closest("label");
    const firsts = ASSUMPTIONS.filter((x) => shownKeys.includes(x.key)).map((x) => labelOf(x.key)).filter(Boolean);
    const actions = form.querySelector(".form-actions");
    const rest = ASSUMPTIONS.filter((x) => !shownKeys.includes(x.key));
    const changedRest = d.rows.filter((r) => !shownKeys.includes(r.key) && r.changed).length;
    if (firsts.length && actions) {
      const status = ui.h("span", { class: "fold-status" });
      moreFold = ui.h("details", { class: "fold as-more" },
        ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "All the numbers"), status, ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
        ui.h("div", { class: "fold-body" }, rest.map((x) => labelOf(x.key)).filter(Boolean)));
      form.prepend(...firsts);
      firsts.at(-1).after(actions);
      form.append(moreFold);
      const save = actions.querySelector("button");
      // the fold's line counts what it holds that Save would keep: a figure typed or a chip tapped under it since the page was
      // drawn says "1 to save" (owner's rule 4; the final review F3: it still said "9 more" over an inflation of 4% that Save
      // then saved)
      const boxOf = (k) => form.querySelector(`[name="${k}"]`);
      const drawn = Object.fromEntries(rest.map((x) => [x.key, String(boxOf(x.key)?.value ?? "")]));
      const same = (a, b) => a === b || (a !== "" && b !== "" && Number(a) === Number(b));
      const say = () => {
        const typed = rest.filter((x) => boxOf(x.key) && !same(String(boxOf(x.key).value ?? ""), drawn[x.key])).length;
        status.textContent = `${rest.length} more${typed ? `, ${typed} to save` : changedRest ? `, ${changedRest} changed` : ""}`;
        // opening the fold changes nothing but what Save will say it does
        if (save) save.textContent = moreFold.open ? "Save and mark as reviewed" : "Save";
        saveLine.textContent = moreFold.open ? "Saving marks the setup step on the dashboard as done and dates it, so a year from now the plan can remind you to look again."
          : typed ? `Save keeps ${these} and what you changed under "All the numbers".`
          : `Save keeps ${these}. To look the rest over and mark them all as reviewed, open "All the numbers" first.`;
      };
      say();
      moreFold.addEventListener?.("toggle", say);
      form.addEventListener?.("input", say);
      form.addEventListener?.("change", say);
      // a box in the closed fold that the browser will not take: the fold opens so its message can show
      form.addEventListener?.("invalid", () => { moreFold.open = true; }, true);
    }
  }
  // a stock return typed above the hopeful one: amber, under the box, as it is typed and after a save (spec L5)
  if (stockBox) {
    const amber = ui.notice("warn", HOPEFUL_WORDS);
    const say = () => { amber.hidden = !(stockBox.value !== "" && Number(stockBox.value) > HOPEFUL_MAX * 100 + 1e-6); };
    stockBox.addEventListener("input", say);
    say();
    stockBox.closest("label")?.after(amber);
  }
  root.append(ui.card("The numbers", form,
    saveLine,
    ui.h("div", { style: { marginTop: "12px" } }, ui.button("Reset to defaults", () => { if (ui.confirm("Put every assumption back to its default?")) { pending = { text: "Every assumption is back to its default.", review: true, before: d.changedCount ? answerNow() : null }; store.update((p) => { const keep = p.assumptions?.reviewedAt; p.assumptions = Object.fromEntries(ASSUMPTIONS.map((x) => [x.key, x.def])); if (keep) p.assumptions.reviewedAt = keep; }); } }, { class: "secondary" })),
  ));
  root.append(ui.h("style", {}, ".as-chips { margin: 6px 0 8px; } .as-forecast { display: block; margin: 0 0 8px; } .as-more { margin-top: 12px; }"));

  const show = focusKey;
  if (show && ctx.route && !shown.has(ctx.route)) {
    shown.add(ctx.route);
    root.append(ui.h("style", {}, ".as-show { outline: 3px solid var(--accent); outline-offset: 6px; border-radius: var(--radius-sm); }"));
    (typeof requestAnimationFrame === "function" ? requestAnimationFrame : (f) => setTimeout(f, 0))(() => {
      const label = form.querySelector(`[name="${show}"]`)?.closest("label");
      if (!label) return;
      label.scrollIntoView({ block: "center" });
      label.classList.add("as-show");
      setTimeout(() => label.classList.remove("as-show"), 2000);
    });
  }

  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "Where these numbers come from"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "fold-body" }, ASSUMPTIONS.map((x) => ui.h("p", { class: "small" }, ui.h("strong", {}, `${x.label} (default ${defText(x)}). `), x.source)),
      // the figures above the stock and inflation boxes, each with why (spec L5)
      ui.h("p", { class: "small" }, ui.h("strong", {}, "Careful, middle and hopeful. "), `${RETURN_PRESETS.map((x) => `${x.name} ${pctOf(x.value)}: ${x.why}.`).join(" ")} ${FORECAST_LINE} ${FORECAST_SOURCE}`),
      ui.h("p", { class: "small" }, ui.h("strong", {}, "Prices rising. "), INFLATION_PRESETS.map((x) => `${pctOf(x.value)}: ${x.why}.`).join(" ")))));
}
