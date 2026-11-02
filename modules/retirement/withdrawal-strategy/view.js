// modules/retirement/withdrawal-strategy/view.js -- DOM only. The four ways to take money out,
// each with what it means, and how each does on your numbers: expected returns and the worst
// stretch of history. Pick one; the Projection page uses it.
import { compute, firstYear } from "./compute.js";
import { ssNotice } from "../ss-notice.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  { const ss = ssNotice(ctx); if (ss) root.append(ss); }   // no Social Security in the plan: say so first (ss-notice.js)
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  // The plan's end age, for wording only: a run that fails in the last year has lasted to the end.
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const endAge = Math.max(...adults.map((p) => Number(p.lifeExpectancy ?? plan.assumptions?.planEndAge ?? 95)), 0) || Number(plan.assumptions?.planEndAge ?? 95);
  // one figure when both ends are the same ("between $60,600 and $60,600" read as a typo)
  const range = (x) => (Math.abs(x.highest - x.lowest) < 1 ? `spending stays at ${money(x.lowest)}` : `spending between ${money(x.lowest)} and ${money(x.highest)}`);
  const outcome = (x) => x.success ? `${money(Math.max(0, x.endReal))} left at the end` : x.failAge >= endAge ? `lasts to the end (${endAge})` : `runs out at ${x.failAge}`;
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "How much to take out each year"), ui.h("p", { class: "lede" }, "Four ways of deciding what to withdraw in retirement, compared on your own numbers. It needs the Projection page's inputs first."), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Set up the projection"))));
    return;
  }
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  // the answer first: how much comes out of savings in the first year of retirement, from where, and what it pays for
  // (round 4, 2026-11-02: the page showed four spending figures and never an amount to take out)
  const fy = firstYear(plan, { today: fmt.today() });
  const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const KIND = { cash: "your cash savings", taxable: "your investment account", deferred: "your 401(k) or IRA", free: "your Roth" };
  const from = (b) => (b.accounts.length ? list(b.accounts) : KIND[b.bucket]);
  const answer = (() => {
    if (!fy) return null;
    const when = fy.thisYear ? `This year (${fy.year})` : `In ${fy.year}, your first year of retirement (in today's dollars)`;
    const src = list(fy.sources.map((x) => (x === "pension" ? "the pension" : x)));
    const bits = [];
    if (fy.need < 0.5 && fy.fromSavings < 0.5) bits.push(`${when}, nothing needs to come out of savings: about ${money(fy.income)} of ${src} covers the ${money(fy.spending)} you plan to spend.`);
    else if (fy.need < 0.5) {
      const dfr = fy.buckets.find((b) => b.bucket === "deferred");
      const back = (plan.accounts ?? []).filter((a) => a.type === "brokerage" && (Number(a.balance) || 0) > 0).map((a) => a.name);
      bits.push(`${when}, ${src} (about ${money(fy.income)}) ${fy.sources.length > 1 ? "cover" : "covers"} the ${money(fy.spending)} you plan to spend, so savings pay for nothing.`);
      bits.push(`The law still requires about ${money(fy.required)} out of ${dfr ? from(dfr) : KIND.deferred}${fy.taxes >= 0.5 ? `; after about ${money(fy.taxes)} of tax on it` : ""}, what you do not spend can go into ${back.length ? list(back) : "a savings or investment account"}.`);
    } else {
      const [a, b2] = fy.buckets;
      bits.push(`${when}, take about ${money(fy.fromSavings)} from savings, starting with ${from(a)}${b2 ? `, then ${from(b2)}` : ""}.`);
      bits.push(`${fy.income >= 0.5 ? `With about ${money(fy.income)} of ${src}, that` : "That"} pays for the ${money(fy.spending)} you plan to spend${fy.taxes >= 0.5 ? ` and about ${money(fy.taxes)} of tax` : ""}.`);
    }
    bits.push(fy.verdict === "short" ? `At this spending the money runs out${fy.shortAge ? ` at ${fy.shortAge}` : ""}: Will the money last? shows what would fix it.` : `The most you could spend and still have the money last: about ${money(Math.round(fy.affordable / 100) * 100)} a year.`);
    return bits;
  })();
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "How much to take out each year"),
    answer ? ui.h("p", { class: "lede" }, answer[0]) : null,
    ...(answer ?? []).slice(1).map((t) => ui.h("p", {}, t)),
    answer && fy.required >= 0.5 ? ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/rmd" }, "This year's required withdrawal")) : null,
    ui.h("p", { class: answer ? "muted small" : "lede" }, `Below: four ways to decide how much to spend, run on your plan with the returns you assume and through the worst stretch of history for a plan like yours (starting in ${d.worstStartYear}). Amounts are yearly spending in today's dollars.`),
  ));
  root.append(out);
  root.append(ui.card("The four ways",
    ui.h("ul", { class: "records" }, d.rows.map((r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.name, r.key === d.chosen ? ui.h("span", { class: "pill accent" }, "chosen") : null), ui.h("span", { class: "rec-value" }, `${money(r.expected.firstYear)} first year`)),
      ui.h("div", { class: "rec-sub" }, r.how),
      ui.h("div", { class: "rec-sub" }, `With your assumptions: ${range(r.expected)}; ${outcome(r.expected)}.`),
      r.worst ? ui.h("div", { class: "rec-sub" }, `Through ${d.worstStartYear}: ${range(r.worst)}; ${outcome(r.worst)}.`) : null,
      r.key === d.chosen ? null : ui.h("div", { class: "rec-foot" }, ui.button("Use this one", () => { pending = `Using: ${r.name}.`; store.update((p) => { p.retirement = { ...(p.retirement ?? {}), strategy: r.key }; }); }, { class: "secondary small" }))))),
    ui.h("p", { class: "muted small" }, `The percentage and guardrail methods start from ${fmt.pct(d.withdrawalRate, 1)} (Projection page settings). Steady spending is easiest to live with; the variable ones never run dry but ask you to tighten in bad years.`),
  ));
  // Where the methods come from: one fold, not a tag on every card (design log 2026-09-16, pass 4).
  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "Where these methods come from"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "fold-body" }, d.rows.map((r) => ui.h("p", { class: "small" }, ui.h("strong", {}, `${r.name}. `), r.from)))));
}
