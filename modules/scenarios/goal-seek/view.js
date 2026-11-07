// modules/scenarios/goal-seek/view.js -- DOM only. Set the goal (the money lasts, leaving at least so
// much), then every lever solved for it on its own: spending, retirement age, saving, the return
// needed, a lump sum or the room today, the Social Security claiming age. Runs on the PC when connected.
import { legacyTarget } from "../../estate/legacy/compute.js";
import { whenCareful, monthlyOf, RULE_WORDS } from "../../retirement/careful.js";
import { RETIRE_HOW, shownValue, roundUp, roundDown, BAD_LUCK } from "./compute.js";

let legacy = null;   // what the plan should leave; a view choice on this device, starting from Legacy goals' amount
let scale = 1;       // 1 = the spending as planned; BAD_LUCK (1.15) = room for bad luck: every answer is worked out for 15% more spending
let readRoute = null; // the route object whose ?target=last was already read: the shell redraws with the same object, so a chip chosen since stays

const STYLE = `
.gs-root .gs-lever { display: flex; flex-direction: column; gap: 6px; }
.gs-root .gs-top { display: flex; align-items: center; gap: 10px; }
.gs-root .gs-ic { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 10px; background: var(--panel-2); font-size: 18px; }
.gs-root .gs-t { flex: 1; font-weight: 650; min-width: 0; }
.gs-root .gs-v { font-size: var(--fs-xl); font-weight: 750; letter-spacing: -.01em; line-height: 1.15; }
.gs-root .gs-u { font-size: var(--fs-sm); font-weight: 500; color: var(--text-2); margin-left: 4px; }
.gs-root .gs-s { color: var(--text-2); font-size: var(--fs-sm); }
.gs-root .gs-goal { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.gs-root .gs-goal .field { flex: 1 1 180px; }
.gs-root .gs-claims { display: grid; grid-template-columns: repeat(9, 1fr); gap: 3px; align-items: end; height: 70px; margin-top: 6px; }
.gs-root .gs-claims span { background: var(--accent-soft); border-radius: 4px 4px 0 0; position: relative; }
.gs-root .gs-claims span.best { background: var(--accent); }
.gs-root .gs-ages { display: grid; grid-template-columns: repeat(9, 1fr); gap: 3px; font-size: var(--fs-xs); color: var(--muted); text-align: center; }
.gs-root .gs-ages small { display: block; white-space: nowrap; font-size: inherit; }
`;
const PILL = { room: ["ok", "room to spare"], same: ["", "just right"], needs: ["warn", "needs a change"], cannot: ["bad", "not on its own"] };

/** 69.4166... -> "69 and 5 months"; a whole age as it is. */
const ageWords = (a) => { const y = Math.floor(a + 1e-9), m = Math.round((a - y) * 12); return m ? `${y} and ${m} month${m === 1 ? "" : "s"}` : String(y); };

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  if (legacy === null) legacy = legacyTarget(plan).target;
  // opened from the Plan health score's hint (#/scenarios/goal-seek?target=last): the money lasting, leaving nothing, the
  // target its figures were worked out for (round 8 review, 2026-11-06), whatever Legacy goals holds
  // read once, then taken out of the address (round 8 batch 4 follow-up, 2026-11-07): a redraw after a sync must not undo the chip
  // chosen since
  if (ctx.route?.query?.target === "last" && ctx.route !== readRoute) {
    readRoute = ctx.route; legacy = 0; scale = 1;
    try { history.replaceState(history.state, "", `${location.pathname}${location.search}#/${ctx.route.group ?? "scenarios"}/${ctx.route.id ?? "goal-seek"}`); } catch { /* no address bar to tidy (a test, a file) */ }
  }
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const moneyUp = (n) => fmt.money(roundUp(n), cur), moneyDown = (n) => fmt.money(roundDown(n), cur);
  const root = ui.h("div", { class: "gs-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const host = ui.h("div");
  root.append(host);
  const load = () => {
    host.replaceChildren(ui.notice("info", "Working out each change for your goal..."));
    ctx.computeRemote("scenarios/goal-seek", { today: fmt.today(), legacy, ...(scale !== 1 ? { spendingScale: scale } : {}) }).then(draw, (e) => host.replaceChildren(ui.notice("error", `Goal seek could not run: ${e}. Reload the page; if it keeps happening, check Will the money last? first.`)));
  };
  const draw = (d) => {
    host.replaceChildren();
    if (!d || !d.ready) {
      host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Goal seek"),
        ui.h("p", { class: "lede" }, "Set the goal (the money lasts, and leaves what you want to leave) and see what each change would have to be: what you can spend, when you can retire, what to save, the return it needs. It needs the basics of your plan first:"),
        ui.h("ul", {}, (d?.missing ?? []).map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Will the money last?"))));
      return;
    }
    // under "Room for bad luck" the result is for 15% more spending than the plan: the hero says so, never "as it stands" (verify
    // 2026-11-07: a family whose money lasts read "As it stands the money runs out in 2082" with the chip on)
    const stands = (d.scale ?? 1) !== 1 ? `With ${Math.round((d.scale - 1) * 100)}% more spending than you plan, the money` : "As it stands the money";
    host.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, d.meets ? "Your plan gets there, with room" : "What it would take"),
      // no retirement savings on file: never "the money runs out in 2065" (the Will the money last? page says "we don't know yet")
      d.noSavings ? ui.h("p", { class: "lede" }, "You haven't told us about retirement savings, so we can't say what it would take yet. Add what you own first. ", ui.h("a", { href: "#/balance/net-worth" }, "What you own ›")) : ui.h("p", { class: "lede" }, d.meets
        ? `${stands} lasts and leaves about ${money(Math.round(d.endReal / 1000) * 1000)} (today's dollars)${d.legacy ? `, more than the ${money(d.legacy)} you want to leave` : ""}. Below: how far each change could go and still get there.`
        : d.success ? `${stands} lasts but leaves about ${money(Math.round(d.endReal / 1000) * 1000)}, short of the ${money(d.legacy)} you want to leave. Below: what each change would have to be.` : `${stands} runs out in ${d.failYear}. Below: what each change would have to be for it to last${d.legacy ? ` and leave ${money(d.legacy)}` : ""}.`)));

    // the goal
    const box = ui.input({ type: "number", inputmode: "decimal", min: "0", step: "1000", value: legacy || "", placeholder: "0", "aria-label": "Leave at least" });
    host.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "The goal"),
      ui.h("p", { class: "muted small" }, "Do you want money left over at the end? Most people choose \"Just last\": the money simply lasts. Pick an amount to leave something behind (in today's dollars)."),
      ui.h("div", { class: "chips", role: "group", "aria-label": "Leave at least" }, [0, 250000, 500000, 1000000].map((v) => ui.h("button", { type: "button", class: `chip${legacy === v ? " on" : ""}`, "aria-pressed": legacy === v ? "true" : "false", onClick: () => { legacy = v; load(); } }, v ? `Leave ${money(v)}` : "Just last"))),
      // room for bad luck: every answer below worked out for spending 15% above the plan (compute's spendingScale)
      ui.h("div", { class: "chips", role: "group", "aria-label": "Room for bad luck" }, ui.h("button", { type: "button", class: `chip${scale === BAD_LUCK ? " on" : ""}`, "aria-pressed": scale === BAD_LUCK ? "true" : "false", onClick: () => { scale = scale === BAD_LUCK ? 1 : BAD_LUCK; load(); } }, "Room for bad luck")),
      ui.h("p", { class: "muted small" }, `Plans for spending ${Math.round((BAD_LUCK - 1) * 100)}% more than you expect, in case markets or prices turn out worse.`, scale === BAD_LUCK ? ` Every figure below is worked out as if you spent ${Math.round((BAD_LUCK - 1) * 100)}% more than the ${money(d.spendingMonthly / scale)} a month your plan has.` : ""),
      ui.h("form", { class: "gs-goal", onSubmit: (e) => { e.preventDefault(); legacy = Math.max(0, Number(box.value) || 0); load(); } }, ui.field("Or leave at least", box), ui.h("button", { type: "submit", class: "secondary" }, "Use this"))));

    // the levers
    // an age in years and months is "now" only when compute says it is now for everyone it moves (nowForAll)
    // what must be reached rounds up and a limit rounds down, so doing what the page says always works (shownValue)
    const val = (l) => l.value === null || l.value === undefined ? "-" : l.unit === "month" ? money(shownValue(l, d.scale)) : l.unit === "once" ? money(shownValue(l)) : l.unit === "rate" ? `${(Math.round(shownValue(l) * 1000) / 10).toFixed(1)}%` : Number.isInteger(l.value) ? `age ${l.value}` : l.nowForAll && l.value === l.nowAge ? "now" : `age ${ageWords(l.value)}`;
    const unit = (l) => (l.unit === "month" ? "a month" : l.unit === "rate" ? "a year" : "");
    host.append(ui.h("section", { class: "card" }, ui.h("h2", {}, d.meets ? "How far each change could go" : "What each change would have to be"),
      ui.h("p", { class: "muted small" }, "Each answer changes just that one thing and keeps everything else as your plan has it. Move two at once and each needs to move less.",
        // the spending and age levers spend the same every year; named once when the plan has another rule (recheck 2026-11-05)
        ...(d.strategy && d.strategy !== "fixed-real" ? [` What you can spend and when you can retire are worked out spending the same every year; your plan uses another rule, ${RULE_WORDS[d.strategy] ?? "its own"}, so what you spend moves with markets (`, ui.h("a", { href: "#/retirement/withdrawal-strategy" }, "How much to take out"), ")."] : [])),
      ui.h("div", { class: "grid" }, d.levers.map((l) => {
        const [tone, label] = PILL[l.status];
        let pillEl = null;
        return ui.h("div", { class: "card flat gs-lever", style: { margin: "0" } },
          ui.h("div", { class: "gs-top" }, ui.h("span", { class: "gs-ic", "aria-hidden": "true" }, l.icon), ui.h("span", { class: "gs-t" }, l.title), pillEl = ui.h("span", { class: `pill ${tone}` }, label)),
          l.status === "cannot" ? null : ui.h("div", { class: "gs-v" }, val(l), unit(l) ? ui.h("span", { class: "gs-u" }, unit(l)) : null),
          l.id === "spending" && l.status !== "cannot" ? carefulLine(ctx, d.legacy, money, moneyUp, moneyDown, d.spendingMonthly / d.scale, d.scale, pillEl) : null,
          ui.h("div", { class: "gs-s" }, l.sentence),
          l.id === "claim" && l.results?.length ? claimBars(ui, l, moneyDown, d.scale) : null,
          ui.h("div", {}, ui.h("a", { class: "btn secondary small", href: `#/${l.go[0]}/${l.go[1]}` }, "Open the page")));
      }))));
    host.append(ui.h("details", { class: "card fold fold-card" },
      ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "How it is worked out"), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("div", { class: "fold-body" }, ui.h("ul", {},
        ui.h("li", {}, "Every change is run through your plan's own year-by-year engine (Will the money last?) at your expected returns, searching for the value where the money lasts to the end and leaves the amount you set."),
        ui.h("li", {}, `Spending: the most a month, steady, in today's dollars. ${RETIRE_HOW} Saving: more or less going into the accounts you already save into, until retirement. The return: stocks and bonds moved together, shown as the blend on your mix. Room today: what could come out of savings now; short today: what would have to go in. Social Security: everyone who has not claimed yet claiming at the same age, from today's age (62 at the earliest) to 70, and the one that leaves the most to spend; whoever already gets it stays as they are.`),
        ui.h("li", {}, "Real life is less smooth than expected returns: these answers are markets doing exactly as well as average every year, about a 4 in 10 chance. The careful figures (spending here, the age on Financial independence) and the Stress tests and Chance the money lasts pages show how much room to keep."),
      ))));
  };
  load();
}

/** "In 9 of 10 markets: about $7,500 a month": drawn with "..." first (the same line, so nothing moves), filled after the first
 * paint with Monte Carlo's careful figure for the same goal (careful.js); gone when nothing lasts in 9 of 10 markets. Below the
 * plan's own spending it says by how much, and a green "room to spare" over it turns amber (review 2026-11-05: the pill read
 * "room to spare" right above a careful figure lower than the plan spends). */
function carefulLine(ctx, legacy, money, moneyUp, moneyDown, planned, scale, pill) {
  const { ui } = ctx;
  const words = (v, less = 0) => [ui.h("strong", {}, "Even in a bad run of years:"), ` about ${v} a month${legacy ? `, leaving ${money(legacy)}` : ""}${less > 0 ? `, ${moneyUp(less)} less than the ${money(planned)} the plan spends` : ""}`];
  const el = ui.h("div", { class: "gs-s", "aria-live": "polite" }, ...words("..."));
  whenCareful(ctx, el, (c) => {
    if (!c || !(c.yearly >= 1200)) { el.remove(); return; }
    const m = monthlyOf(c.yearly) / scale;   // in the plan's terms, as the answer above (room for bad luck: the most to plan)
    const less = planned - m >= 5 ? planned - m : 0;   // a limit rounds down, how much less than the plan rounds up
    el.replaceChildren(...words(scale === 1 ? money(m) : moneyDown(m), less));
    if (less > 0 && pill?.classList.contains("ok")) { pill.className = "pill warn"; pill.textContent = "tight"; }
  }, { legacy });
  return el;
}

function claimBars(ui, l, money, scale = 1) {
  const max = Math.max(...l.results.map((r) => r.monthly), 1);
  return ui.h("div", { "aria-label": "What the plan can spend a month by claiming age" },
    // today's age is claimable in years and months (69 and 5 months): "now" on the bar, never 69.4166... (review 2026-11-02);
    // "now" only when it is now for everyone moved, else the age and its months on two short lines (review 2026-11-02, round 5)
    ui.h("div", { class: "gs-claims" }, l.results.map((r) => ui.h("span", { class: r.age === l.value ? "best" : null, title: `${ageWords(r.age)}: ${money(r.monthly / scale)} a month`, style: { height: `${Math.max(4, Math.round((r.monthly / max) * 100))}%` } }))),
    ui.h("div", { class: "gs-ages" }, l.results.map((r) => {
      if (Number.isInteger(r.age)) return ui.h("span", {}, String(r.age));
      if (l.nowForAll && r.age === l.nowAge) return ui.h("span", {}, "now");
      const y = Math.floor(r.age + 1e-9), m = Math.round((r.age - y) * 12);
      return ui.h("span", { "aria-label": ageWords(r.age) }, String(y), ui.h("small", {}, `${m} mo`));
    })));
}
