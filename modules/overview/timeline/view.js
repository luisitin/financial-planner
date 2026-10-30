// modules/overview/timeline/view.js -- DOM only. The household's money life on one line: a hero with
// the three dates that matter most, the savings curve, topic chips, then every year that has
// something in it, each moment a card that opens the page where it is worked out.
import { compute, TOPICS } from "./compute.js";
import { lineChart } from "../../retirement/charts.js";

let topic = "all";   // the chip picked on this device; kept across re-renders, not saved in the plan

const STYLE = `
.tl-root .tl { position: relative; list-style: none; margin: 4px 0 0; padding: 0 0 0 30px; }
.tl-root .tl-year { position: relative; padding: 2px 0 6px; }
.tl-root .tl-year::before { content: ""; position: absolute; left: -26px; top: 8px; width: 15px; height: 15px; border-radius: 50%; background: var(--panel); border: 3px solid var(--accent); box-sizing: border-box; z-index: 1; }
.tl-root .tl-year::after { content: ""; position: absolute; left: -20px; top: 16px; bottom: -8px; width: 3px; border-radius: 3px; background: var(--accent-soft); }
.tl-root .tl-year:last-child::after { display: none; }
.tl-root .tl-year.retired::before { border-color: var(--ok); }
.tl-root .tl-year.retired::after { background: var(--ok-soft); }
.tl-root .tl-year.now::before { background: var(--accent); }
.tl-root .tl-head { display: flex; align-items: baseline; gap: 4px 10px; flex-wrap: wrap; min-height: 30px; }
.tl-root .tl-y { font-weight: 750; font-size: var(--fs-lg); letter-spacing: -.01em; }
.tl-root .tl-ages { color: var(--muted); font-size: var(--fs-sm); }
.tl-root .tl-events { list-style: none; margin: 0; padding: 0; }
.tl-root .tl-card { display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; margin: 6px 0; min-height: 44px; border: 1px solid var(--line); border-left-width: 4px; border-radius: var(--radius-sm); background: var(--panel-2); color: inherit; text-decoration: none; }
.tl-root a.tl-card:hover { border-color: var(--accent); text-decoration: none; }
.tl-root .tl-card.ok { border-left-color: var(--ok); }
.tl-root .tl-card.warn { border-left-color: var(--warn); }
.tl-root .tl-card.bad { border-left-color: var(--bad); background: var(--bad-soft); }
.tl-root .tl-ic { flex: none; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; background: var(--panel); font-size: 18px; line-height: 1; }
.tl-root .tl-body { flex: 1; min-width: 0; }
.tl-root .tl-t { display: block; font-weight: 650; }
.tl-root .tl-d { display: block; color: var(--text-2); font-size: var(--fs-sm); line-height: 1.4; margin-top: 2px; }
.tl-root .tl-when { display: block; color: var(--muted); font-size: var(--fs-xs); margin-top: 4px; }
.tl-root .tl-chev { flex: none; color: var(--muted); font-size: 22px; line-height: 1; align-self: center; }
.tl-root .tl-gap { position: relative; color: var(--muted); font-size: var(--fs-sm); padding: 4px 0 10px; }
.tl-root .tl-era { position: relative; margin: 10px 0 12px -30px; padding: 10px 14px; border-radius: var(--radius-sm); font-weight: 650; background: var(--ok-soft); color: var(--ok); }
.tl-root .stat-value.bad { color: var(--bad); }
.tl-root .stat-value.good { color: var(--ok); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const root = ui.h("div", { class: "tl-root" }, ui.h("style", {}, STYLE));   // scoped styles; #content is shared by every page
  page.append(root);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Life timeline"),
      ui.h("p", { class: "lede" }, "Every moment from today to the end of the plan that changes your money: retiring, Social Security, Medicare, the last mortgage payment, a child growing up, the year the savings could carry you. It starts from the people in your household and their birthdays."),
      ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "Add the people in your household"))));
    return;
  }

  const h = d.headline;
  const years = h.endYear - d.startYear;
  const statBox = (label, value, sub, tone) => { const s = ui.stat(label, value, sub); if (tone) s.querySelector(".stat-value").classList.add(tone); return s; };
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `Your next ${years} years`),
    ui.h("p", { class: "lede" }, `From today to ${h.endYear}, when the plan ends: ${d.counts.all} moments that change your money, in order. Tap one to open the page that works it out.`),
    ui.row(
      statBox(h.retireIn > 0 ? "Retirement" : "Retired", h.retireIn > 0 ? String(h.retireYear) : "Now", h.retireIn > 0 ? `in ${h.retireIn} year${h.retireIn === 1 ? "" : "s"}` : "the plan is in its spending years"),
      statBox("Debt-free", h.debtFreeYear ? String(h.debtFreeYear) : "Now", h.debtFreeYear ? "the last loan or card paid off" : "nothing owed with a payment plan"),
      h.shortYear ? statBox("Savings run out", String(h.shortYear), "before the plan ends", "bad")
        : h.lastsTo ? statBox("The money lasts", String(h.lastsTo), "to the end of the plan", "good")
        : statBox("Will it last?", "Not yet known", "add accounts and spending"),
    )));

  if (d.savings.length > 1) {
    const marks = [{ year: h.retireYear, label: "retire" }];
    if (h.debtFreeYear && h.debtFreeYear !== h.retireYear) marks.push({ year: h.debtFreeYear, label: "debt-free" });
    const peak = Math.max(...d.savings.map((s) => s.real));
    root.append(ui.card("Savings along the way",
      lineChart({ years: d.savings.map((s) => s.year), series: [{ values: d.savings.map((s) => s.real) }], marks, height: 190, label: "Savings by year in today's dollars" }),
      ui.h("p", { class: "muted small" }, `In today's dollars, after inflation: the savings, retirement and investment accounts the plan draws on (not the house). The highest point is about ${money(Math.round(peak / 1000) * 1000)}.`)));
  }

  const chips = ui.h("div", { class: "chips", role: "group", "aria-label": "Show" });
  const list = ui.h("ol", { class: "tl", "aria-label": "Timeline" });
  const draw = () => {
    chips.replaceChildren(...TOPICS.filter((t) => t.id === "all" || d.counts[t.id]).map((t) => ui.h("button", { type: "button", class: `chip${topic === t.id ? " on" : ""}`, "aria-pressed": topic === t.id ? "true" : "false", onClick: () => { topic = t.id; draw(); } }, `${t.label} ${d.counts[t.id] ?? 0}`)));
    list.replaceChildren();
    let shown = 0, lastEra = null, lastYear = null;
    for (const y of d.years) {
      const evs = y.events.filter((e) => topic === "all" || e.topic === topic || e.kind === "now");
      if (!evs.length) continue;
      if (lastYear !== null && y.year - lastYear > 1) list.append(ui.h("li", { class: "tl-gap", "aria-hidden": "true" }, `${y.year - lastYear - 1} quiet year${y.year - lastYear - 1 === 1 ? "" : "s"}`));
      if (lastEra === "work" && y.era === "retired") list.append(ui.h("li", { class: "tl-era" }, `${h.retireYear}: retirement begins. The line turns green.`));
      lastEra = y.era; lastYear = y.year;
      const isNow = y.events.some((e) => e.kind === "now");
      list.append(ui.h("li", { class: `tl-year ${y.era}${isNow ? " now" : ""}` },
        ui.h("div", { class: "tl-head" }, ui.h("span", { class: "tl-y" }, String(y.year)), ui.h("span", { class: "tl-ages" }, y.ages.map((a) => `${a.name} ${a.age}`).join(" · "))),
        ui.h("ul", { class: "tl-events" }, evs.map((e) => { shown++; return ui.h("li", {}, card(ui, e)); }))));
    }
    if (!shown) list.append(ui.h("li", { class: "muted" }, "Nothing of this kind on the timeline."));
  };
  draw();
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Year by year"), chips, list));
  if (d.notes.length) root.append(ui.card("Not on the timeline yet", ui.h("ul", {}, d.notes.map((n) => ui.h("li", { class: "muted" }, n)))));
}

function card(ui, e) {
  const when = e.date && e.kind !== "now" ? new Date(Number(e.date.slice(0, 4)), Number(e.date.slice(5, 7)) - 1, Number(e.date.slice(8, 10))).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : null;
  const body = [ui.h("span", { class: "tl-ic", "aria-hidden": "true" }, e.icon), ui.h("span", { class: "tl-body" }, ui.h("span", { class: "tl-t" }, e.title), e.detail ? ui.h("span", { class: "tl-d" }, e.detail) : null, when ? ui.h("span", { class: "tl-when" }, when) : null)];
  const cls = `tl-card${e.tone ? ` ${e.tone}` : ""}`;
  return e.go ? ui.h("a", { class: cls, href: `#/${e.go[0]}/${e.go[1]}` }, ...body, ui.h("span", { class: "tl-chev", "aria-hidden": "true" }, "›")) : ui.h("div", { class: cls }, ...body);
}
