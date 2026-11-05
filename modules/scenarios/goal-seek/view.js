// modules/scenarios/goal-seek/view.js -- DOM only. Set the goal (the money lasts, leaving at least so
// much), then every lever solved for it on its own: spending, retirement age, saving, the return
// needed, a lump sum or the room today, the Social Security claiming age. Runs on the PC when connected.
import { legacyTarget } from "../../estate/legacy/compute.js";
import { whenCareful, monthlyOf } from "../../retirement/careful.js";

let legacy = null;   // what the plan should leave; a view choice on this device, starting from Legacy goals' amount

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
`;
const PILL = { room: ["ok", "room to spare"], same: ["", "just right"], needs: ["warn", "needs a change"], cannot: ["bad", "not on its own"] };

/** 69.4166... -> "69 and 5 months"; a whole age as it is. */
const ageWords = (a) => { const y = Math.floor(a + 1e-9), m = Math.round((a - y) * 12); return m ? `${y} and ${m} month${m === 1 ? "" : "s"}` : String(y); };

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  if (legacy === null) legacy = legacyTarget(plan).target;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const root = ui.h("div", { class: "gs-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const host = ui.h("div");
  root.append(host);
  const load = () => {
    host.replaceChildren(ui.notice("info", "Solving each lever for your goal..."));
    ctx.computeRemote("scenarios/goal-seek", { today: fmt.today(), legacy }).then(draw, (e) => host.replaceChildren(ui.notice("error", `Goal seek could not run: ${e}. Reload the page; if it keeps happening, check Will the money last? first.`)));
  };
  const draw = (d) => {
    host.replaceChildren();
    if (!d || !d.ready) {
      host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Goal seek"),
        ui.h("p", { class: "lede" }, "Set the goal (the money lasts, and leaves what you want to leave) and see what each lever would have to be: what you can spend, when you can retire, what to save, the return it needs. It needs the basics of your plan first:"),
        ui.h("ul", {}, (d?.missing ?? []).map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Will the money last?"))));
      return;
    }
    host.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, d.meets ? "Your plan gets there, with room" : "What it would take"),
      ui.h("p", { class: "lede" }, d.meets
        ? `As it stands the money lasts and leaves about ${money(Math.round(d.endReal / 1000) * 1000)} (today's dollars)${d.legacy ? `, more than the ${money(d.legacy)} you want to leave` : ""}. Below: how far each lever could move and still get there.`
        : d.success ? `As it stands the money lasts but leaves about ${money(Math.round(d.endReal / 1000) * 1000)}, short of the ${money(d.legacy)} you want to leave. Below: what each lever would have to be.` : `As it stands the money runs out in ${d.failYear}. Below: what each lever would have to be for it to last${d.legacy ? ` and leave ${money(d.legacy)}` : ""}.`)));

    // the goal
    const box = ui.input({ type: "number", inputmode: "decimal", min: "0", step: "1000", value: legacy || "", placeholder: "0", "aria-label": "Leave at least" });
    host.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "The goal"),
      ui.h("p", { class: "muted small" }, "The money lasts to the end of the plan, and is still there in this amount at the end (today's dollars): for heirs, for a cushion, for whatever comes."),
      ui.h("div", { class: "chips", role: "group", "aria-label": "Leave at least" }, [0, 250000, 500000, 1000000].map((v) => ui.h("button", { type: "button", class: `chip${legacy === v ? " on" : ""}`, "aria-pressed": legacy === v ? "true" : "false", onClick: () => { legacy = v; load(); } }, v ? `Leave ${money(v)}` : "Just last"))),
      ui.h("form", { class: "gs-goal", onSubmit: (e) => { e.preventDefault(); legacy = Math.max(0, Number(box.value) || 0); load(); } }, ui.field("Or leave at least", box), ui.h("button", { type: "submit", class: "secondary" }, "Use this"))));

    // the levers
    const val = (l) => l.value === null || l.value === undefined ? "-" : l.unit === "month" ? money(l.value) : l.unit === "once" ? money(l.value) : l.unit === "rate" ? `${(Math.round(l.value * 1000) / 10).toFixed(1)}%` : Number.isInteger(l.value) ? `age ${l.value}` : "now";
    const unit = (l) => (l.unit === "month" ? "a month" : l.unit === "rate" ? "a year" : "");
    host.append(ui.h("section", { class: "card" }, ui.h("h2", {}, d.meets ? "How far each lever could move" : "What each lever would have to be"),
      ui.h("p", { class: "muted small" }, "Each answer moves that one lever alone and keeps everything else as your plan has it. Move two at once and each needs to move less."),
      ui.h("div", { class: "grid" }, d.levers.map((l) => {
        const [tone, label] = PILL[l.status];
        let pillEl = null;
        return ui.h("div", { class: "card flat gs-lever", style: { margin: "0" } },
          ui.h("div", { class: "gs-top" }, ui.h("span", { class: "gs-ic", "aria-hidden": "true" }, l.icon), ui.h("span", { class: "gs-t" }, l.title), pillEl = ui.h("span", { class: `pill ${tone}` }, label)),
          l.status === "cannot" ? null : ui.h("div", { class: "gs-v" }, val(l), unit(l) ? ui.h("span", { class: "gs-u" }, unit(l)) : null),
          l.id === "spending" && l.status !== "cannot" ? carefulLine(ctx, d.legacy, money, d.spendingMonthly, pillEl) : null,
          ui.h("div", { class: "gs-s" }, l.sentence),
          l.id === "claim" && l.results?.length ? claimBars(ui, l, money) : null,
          ui.h("div", {}, ui.h("a", { class: "btn secondary small", href: `#/${l.go[0]}/${l.go[1]}` }, "Open the page")));
      }))));
    host.append(ui.h("details", { class: "card fold fold-card" },
      ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "How it is worked out"), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("div", { class: "fold-body" }, ui.h("ul", {},
        ui.h("li", {}, "Every lever runs your plan's own year-by-year engine (Will the money last?) at your expected returns, searching for the value where the money lasts to the end and leaves the amount you set."),
        ui.h("li", {}, "Spending: the most a month, steady after inflation. Retirement: the first person's earliest age, from this year's to 75 (or the planned age if later), counted by the year they stop. Saving: more or less going into the accounts you already save into, until retirement. The return: stocks and bonds moved together, shown as the blend on your mix. Room today: what could come out of savings now; short today: what would have to go in. Social Security: everyone who has not claimed yet claiming at the same age, from today's age (62 at the earliest) to 70, and the one that leaves the most to spend; whoever already gets it stays as they are."),
        ui.h("li", {}, "Real life is less smooth than expected returns: these answers are markets doing exactly as well as average every year, about a 4 in 10 chance. The 9-in-10 figures (spending here, the age on Financial independence) and the Stress tests and Chance the money lasts pages show how much room to keep."),
      ))));
  };
  load();
}

/** "In 9 of 10 markets: about $7,500 a month": drawn with "..." first (the same line, so nothing moves), filled after the first
 * paint with Monte Carlo's careful figure for the same goal (careful.js); gone when nothing lasts in 9 of 10 markets. Below the
 * plan's own spending it says by how much, and a green "room to spare" over it turns amber (review 2026-11-05: the pill read
 * "room to spare" right above a careful figure lower than the plan spends). */
function carefulLine(ctx, legacy, money, planned, pill) {
  const { ui } = ctx;
  const words = (v, less = 0) => [ui.h("strong", {}, "In 9 of 10 markets:"), ` about ${v} a month${legacy ? `, leaving ${money(legacy)}` : ""}${less > 0 ? `: ${money(less)} less than the ${money(planned)} the plan spends` : ""}`];
  const el = ui.h("div", { class: "gs-s", "aria-live": "polite" }, ...words("..."));
  whenCareful(ctx, el, (c) => {
    if (!c || !(c.yearly >= 1200)) { el.remove(); return; }
    const m = monthlyOf(c.yearly);
    const less = Math.round((planned - m) / 10) * 10;
    el.replaceChildren(...words(money(m), less));
    if (less > 0 && pill?.classList.contains("ok")) { pill.className = "pill warn"; pill.textContent = "tight"; }
  }, { legacy });
  return el;
}

function claimBars(ui, l, money) {
  const max = Math.max(...l.results.map((r) => r.monthly), 1);
  return ui.h("div", { "aria-label": "What the plan can spend a month by claiming age" },
    // today's age is claimable in years and months (69 and 5 months): "now" on the bar, never 69.4166... (review 2026-11-02)
    ui.h("div", { class: "gs-claims" }, l.results.map((r) => ui.h("span", { class: r.age === l.value ? "best" : null, title: `${ageWords(r.age)}: ${money(r.monthly)} a month`, style: { height: `${Math.max(4, Math.round((r.monthly / max) * 100))}%` } }))),
    ui.h("div", { class: "gs-ages" }, l.results.map((r) => ui.h("span", {}, Number.isInteger(r.age) ? String(r.age) : "now"))));
}
