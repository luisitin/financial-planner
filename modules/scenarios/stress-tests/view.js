// modules/scenarios/stress-tests/view.js -- DOM only. How many shocks the plan survives, then each
// shock as a fold: what happens, whether the money lasts, how deep it cuts, the spending it can
// still carry, and a small chart against the plan's own path. Runs on the PC when connected.
import { lineChart } from "../../retirement/charts.js";
import { TAKE_HOME, SURVIVOR_SPENDING, JOB_LOSS_MONTHS, CARE_HOME_YEARLY, FUNERAL, LOWER_RETURNS } from "./compute.js";

let when = "retire";   // when the market shocks hit; a view choice on this device

const STYLE = `
.st-root .st-sum { display: flex; align-items: center; gap: 12px; }
.st-root .st-ic { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 10px; background: var(--panel-2); font-size: 18px; }
.st-root .st-t { flex: 1; min-width: 0; font-weight: 600; }
.st-root .st-pill { flex: none; font-size: var(--fs-sm); font-weight: 650; padding: 2px 10px; border-radius: 999px; white-space: nowrap; }
.st-root .st-pill.ok { color: var(--ok); background: var(--ok-soft); }
.st-root .st-pill.bad { color: var(--bad); background: var(--bad-soft); }
.st-root .st-story { color: var(--text-2); margin: 4px 0 12px; }
.st-root .st-key { display: flex; gap: 14px; flex-wrap: wrap; font-size: var(--fs-xs); color: var(--muted); margin: 6px 0 10px; }
.st-root .st-key i { display: inline-block; width: 18px; height: 0; border-top: 3px solid; vertical-align: middle; margin-right: 6px; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(n, cur);
  const root = ui.h("div", { class: "st-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const host = ui.h("div");
  const load = () => {
    host.replaceChildren(ui.notice("info", "Running your plan through every shock..."));
    ctx.computeRemote("scenarios/stress-tests", { today: fmt.today(), when }).then((d) => draw(d), (e) => host.replaceChildren(ui.notice("error", `The stress tests could not run: ${e}. Reload the page; if it keeps happening, check Will the money last? first.`)));
  };
  const draw = (d) => {
    host.replaceChildren();
    if (!d || !d.ready) {
      host.append(ui.h("section", { class: "card accent hero" },
        ui.h("h1", {}, "Stress tests"),
        ui.h("p", { class: "lede" }, "Your plan run through the things that break plans: a crash the year you retire, a decade of high prices, a job loss, an illness, losing a partner, a long life. It needs the basics of your plan first:"),
        ui.h("ul", {}, (d?.missing ?? []).map((m) => ui.h("li", {}, m))),
        ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Will the money last?"))));
      return;
    }
    const failed = d.scenarios.filter((s) => !s.success);
    host.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, failed.length ? `Your plan survives ${d.passed} of ${d.total} shocks` : `Your plan survives all ${d.total} shocks`),
      ui.h("p", { class: "lede" }, failed.length
        ? `The money runs out in ${failed.length === 1 ? "one of them" : `${failed.length} of them`}, opened below. Each shock changes one thing; everything else is your plan as it stands.`
        : "Real crises from the record and the things that happen to people, one at a time; everything else is your plan as it stands."),
      failed.length ? ui.h("ul", { class: "records" }, failed.map((s) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${s.icon} ${s.title}`), ui.h("span", { class: "rec-value bad" }, s.failAge ? `out at ${s.failAge}` : `out in ${s.failYear}`))))) : null,
      ui.h("div", { class: "progress" }, ui.h("span", { style: { width: `${Math.round(d.passed / d.total * 100)}%`, background: failed.length ? "var(--warn)" : "var(--ok)" } })),
      ui.h("p", { class: "muted small" }, `Without any shock the money lasts${d.base.success ? "" : " only"} ${d.base.success ? `to ${d.years[d.years.length - 1]} with about ${money(Math.round(d.base.endReal / 1000) * 1000)} left` : `to ${d.base.failYear}`} (today's dollars). ${ctx.store.backend() === "server" ? "Worked out on your PC." : "Worked out on this device."}`)));

    const markets = d.scenarios.filter((s) => s.group === "market"), life = d.scenarios.filter((s) => s.group === "life");
    const timing = d.retireYear > d.startYear ? ui.h("div", { class: "chips", role: "group", "aria-label": "When markets fall" },
      [["retire", `As you retire (${d.retireYear})`], ["now", "Now"]].map(([k, label]) => ui.h("button", { type: "button", class: `chip${d.when === k ? " on" : ""}`, "aria-pressed": d.when === k ? "true" : "false", onClick: () => { when = k; load(); } }, label))) : null;
    host.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Markets"),
      ui.h("p", { class: "muted small" }, d.retireYear > d.startYear ? "When a crash comes matters most in the first years of retirement, when money is coming out. Pick when it hits:" : "The real returns and inflation of those years, starting now; your plan's own assumptions before and after."),
      timing, ui.h("div", { class: "folds" }, markets.map((s) => fold(ui, fmt, money, d, s)))));
    host.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Life"), ui.h("div", { class: "folds" }, life.map((s) => fold(ui, fmt, money, d, s)))));
    if (d.notes.length) host.append(ui.card("Left out", ui.h("ul", {}, d.notes.map((n) => ui.h("li", { class: "muted" }, n)))));
    host.append(ui.h("details", { class: "card fold fold-card" },
      ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "How these are worked out"), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("div", { class: "fold-body" }, ui.h("ul", {},
        ui.h("li", {}, "Every shock is the plan's own year-by-year engine (Will the money last?) with one thing changed. The market crises replay the real yearly returns of stocks, 10-year Treasury bonds and bills, and the real inflation, of those years (Damodaran, NYU), with your own assumptions before and after."),
        ui.h("li", {}, `A job loss lasts ${JOB_LOSS_MONTHS} months; take-home pay is taken as ${Math.round(TAKE_HOME * 100)}% of gross pay. Unemployment benefits are not counted.`),
        ui.h("li", {}, "Never working again: pay and retirement saving stop from next year; Social Security disability is counted at the full-retirement-age amount on the Social Security page, from next year; a disability policy on file pays its monthly benefit to 65."),
        ui.h("li", {}, `A death this year: the survivor's spending is ${Math.round(SURVIVOR_SPENDING * 100)}% of the couple's (a rule of thumb), Social Security is the larger of their own and the survivor amount, a funeral costs ${money(FUNERAL)} (NFDA 2023 median with viewing and burial), and any life insurance on file is paid out.`),
        ui.h("li", {}, `A care home costs ${money(CARE_HOME_YEARLY)} a year in today's dollars: the 2024 national median for a private nursing-home room (CareScout, formerly Genworth, Cost of Care Survey).`),
        ui.h("li", {}, `Lower returns: stocks and bonds both earn ${Math.round(LOWER_RETURNS * 100)} percentage points a year less than on the Assumptions page.`),
        ui.h("li", {}, "Spending room is the largest steady spending (after inflation) that still lasts to the end under that shock, compared with your plan's spending."),
      ))));
  };
  root.append(host);
  load();
}

function fold(ui, fmt, money, d, s) {
  const ageNote = s.failAge ? ` at ${s.failAge}` : "";
  const pill = s.success ? ui.h("span", { class: "st-pill ok" }, "Lasts") : ui.h("span", { class: "st-pill bad" }, `Runs out${ageNote}`);
  const room = Math.round(s.roomMonthly / 10) * 10;
  const roomStat = room >= 0 ? ui.stat("Spending room", `${money(room)}`, "a month to spare, after inflation") : ui.stat("To make it last", `${money(-room)} less`, "spent a month, after inflation");
  if (room < 0) roomStat.querySelector(".stat-value").style.color = "var(--bad)";
  const n = Math.max(s.path.length, d.base.path.length);
  const years = Array.from({ length: n }, (_, i) => d.startYear + i);
  const pad = (a) => [...a, ...Array(n - a.length).fill(NaN)];
  return ui.h("details", { class: "fold", open: !s.success ? true : null },
    ui.h("summary", {}, ui.h("span", { class: "st-sum", style: { flex: "1", minWidth: "0" } }, ui.h("span", { class: "st-ic", "aria-hidden": "true" }, s.icon), ui.h("span", { class: "st-t" }, s.title), pill), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" },
      ui.h("p", { class: "st-story" }, s.story),
      ui.row(
        s.success ? ui.stat("Left at the end", money(Math.round(s.endReal / 1000) * 1000), "today's dollars") : ui.stat("Runs out", String(s.failYear), s.failAge ? `at ${s.failAge}` : ""),
        !s.success ? null : s.worstGap ? ui.stat("At worst", `${Math.round(s.worstGap.share * 100)}% below`, `the plan's path, in ${s.worstGap.year}`) : ui.stat("At worst", "on track", "never below the plan's path"),
        roomStat,
      ),
      lineChart({ years, series: [{ values: pad(d.base.path), color: "var(--muted)", width: 1.5, dash: "4 3" }, { values: pad(s.path), color: s.success ? "var(--accent)" : "var(--bad)" }], marks: d.retireYear > d.startYear ? [{ year: d.retireYear, label: "retire" }] : [], height: 160, label: `${s.title}: savings by year` }),
      ui.h("div", { class: "st-key" }, ui.h("span", {}, ui.h("i", { style: { borderColor: s.success ? "var(--accent)" : "var(--bad)" } }), "with this shock"), ui.h("span", {}, ui.h("i", { style: { borderColor: "var(--muted)", borderTopStyle: "dashed" } }), "your plan as it is")),
      s.go ? ui.row(ui.h("a", { class: "btn secondary", href: `#/${s.go[0]}/${s.go[1]}` }, linkLabel(s))) : null));
}

function linkLabel(s) {
  if (s.id === "job-loss") return "Emergency fund";
  if (s.id === "disability" || s.id.startsWith("death-")) return "Social Security";
  if (s.id === "long-life") return "How long to plan for";
  if (s.id === "lower-returns") return "Assumptions";
  if (s.id === "care-home") return "Will the money last?";
  return "Order of returns";
}
