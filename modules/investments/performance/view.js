// modules/investments/performance/view.js -- DOM only. The true return first, then each
// account with its two returns and the periods between balance points.
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const signed = (n) => n < 0 ? `−${money(-n)}` : `+${money(n)}`;
  const pc = (x) => x === null || x === undefined || !Number.isFinite(x) ? "-" : `${x < 0 ? "−" : "+"}${fmt.pct(Math.abs(x), 1)}`;
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "How your investments have done"), ui.h("p", { class: "lede" }, "How much your investments grew each year, leaving out the money you added (the figure to compare with an index fund), and what you earned counting when your money went in. Both come from the balances you save on the Net worth page."), ui.h("ul", {}, d.notes.map((n) => ui.h("li", {}, n))), ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, d.notes.some((n) => /No investment accounts/.test(n)) ? "Add an investment account" : "Save today's totals on Net worth"))));
    return;
  }
  const o = d.overall;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `${pc(o.twrAnnual)} a year${o.years >= 0.9 ? "" : " so far"}`),
    ui.h("p", { class: "lede" }, `From ${fmt.date(o.from)} to ${fmt.date(o.to)}: ${money(o.start)} grew to ${money(o.end)} with ${money(o.deposits)} added, so the investments themselves made ${signed(o.gain)}. The plan assumes ${fmt.pct(d.expected, 1)} a year${d.benchmark ? `; a plain ${Math.round(d.stockShare * 100)}/${Math.round((1 - d.stockShare) * 100)} index mix made ${pc(d.benchmark.annual)} a year over ${d.benchmark.from === d.benchmark.to ? d.benchmark.from : `${d.benchmark.from}-${d.benchmark.to}`}` : ""}.`),
  ));
  for (const n of d.notes) root.append(ui.notice("info", n));
  // a note about accounts left out says what to do: a button to Net worth, where balances are saved
  if (d.notes.some((n) => /only one saved balance/.test(n))) root.append(ui.row(ui.h("a", { class: "btn secondary", href: "#/balance/net-worth" }, "Save today's totals on Net worth")));
  root.append(ui.card(null, ui.row(
    ui.stat("Investments earned", pc(o.twrAnnual), "a year, leaving out what you added"),
    o.mwr !== null && Math.abs(o.mwr - o.twrAnnual) >= 0.0005 ? ui.stat("You earned", pc(o.mwr), "a year, counting when your money went in") : null,
    ui.stat("Growth", signed(o.gain), `on ${money(o.start)} plus ${money(o.deposits)} added`),
    ui.stat("Plan assumes", fmt.pct(d.expected, 1), "blended stocks and bonds"),
  )));
  for (const a of d.accounts.filter((x) => x.ready)) root.append(ui.card(a.name,
    ui.row(ui.stat("The investments", pc(a.twrAnnual), `a year over ${a.years.toFixed(1)} years`), ui.stat("What you earned", pc(a.mwr), "a year, counting when money went in"), ui.stat("Added", money(a.deposits), `${fmt.date(a.from)} to ${fmt.date(a.to)}`)),
    ui.h("ul", { class: "records" }, a.periods.map((p) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${fmt.date(p.from)} to ${fmt.date(p.to)}`), ui.h("span", { class: "rec-value" }, pc(p.rate))), ui.h("div", { class: "rec-sub" }, `${money(p.start)} to ${money(p.end)}${Math.abs(p.flow) > 0.5 ? ` with ${signed(p.flow)} added` : ""}`)))),
  ));
  root.append(ui.card("Reading the two numbers",
    ui.h("ul", { class: "records" }, [
      ["\"Investments earned\" is the funds' report card", "It leaves out how much you had invested when. Compare it with an index fund's return for the same stretch; if yours is lower every year, the fees or the picks are the reason."],
      ["\"You earned\" is your own report card", "Big deposits before a good run raise it, before a bad run lower it. Over a long stretch the two come together; over a short one they can differ a lot, and neither is wrong."],
      ["More points, better numbers", "A balance saved every month or quarter on the Net worth page turns this into a real record."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
  ));
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "How this is worked out"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("p", { class: "muted small" }, "\"Investments earned\" is the time-weighted return: money added between two saved balances is counted as arriving halfway through (the Modified Dietz method) and the periods are chained together. \"You earned\" is the money-weighted return: the yearly rate that makes every deposit, with its real date, grow to the end value (the internal rate of return). Deposits come from the account's own records when it has them, else from the Retirement contributions page.")));
}
