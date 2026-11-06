// modules/retirement/withdrawal-strategy/view.js -- DOM only. The four ways to take money out,
// each with what it means, and how each does on your numbers: expected returns and the worst
// stretch of history. Pick one; the Projection page uses it.
import { compute, firstYear, DESCRIPTIONS } from "./compute.js";
import { ssNotice } from "../ss-notice.js";
import { whenCareful, monthlyOf } from "../careful.js";

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
  // with a way that is not offered already chosen, the answer is worked out on what the household spends, the same every year
  // (round 8 review UX 6: the answer repeated the $16,880 the notice above it said was wrong)
  const fy = firstYear(d.chosenHeld ? { ...plan, retirement: { ...(plan.retirement ?? {}), strategy: "fixed-real" } } : plan, { today: fmt.today() });
  const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const KIND = { cash: "your cash savings", taxable: "your investment account", deferred: "your 401(k) or IRA", free: "your Roth" };
  const from = (b) => (b.accounts.length ? list(b.accounts) : KIND[b.bucket]);
  // the plan adds health cover in some year: both spending figures are on top of it (2026-11-02)
  const onTop = fy?.healthAdded ? " on top of health cover" : "";
  const averageWords = fy ? `If markets do as well as average, you could spend up to about ${money(Math.round(fy.affordable / 100) * 100)} a year${onTop}.` : "";
  const carefulWords = (mo, yr) => ["You can spend about ", mo, " a month ", ui.h("span", { style: { whiteSpace: "nowrap" } }, "(", yr), ` a year)${onTop}${d.chosen === "fixed-real" ? "" : ", the same every year,"} and the money lasts in about 9 of 10 markets. If markets do as well as average, up to about ${money(Math.round((fy?.affordable ?? 0) / 100) * 100)} a year.`];
  // while it is worked out: a soft grey bar as wide as the figure that will take its place, so the lines break the same
  const slot = (like) => ui.h("span", { "aria-hidden": "true", style: { display: "inline-block", width: `${String(like).length * 0.55}em`, height: "0.8em", borderRadius: "4px", background: "var(--line-2)", verticalAlign: "-0.05em" } });
  const answer = (() => {
    if (!fy) return null;
    const when = fy.thisYear ? `This year (${fy.year})` : `In ${fy.year}, your first year of retirement (in today's dollars)`;
    const src = list(fy.sources.map((x) => (x === "pension" ? "the pension" : x)));
    const bits = [];
    // the plan's health cover (marketplace to 65, then Medicare) is spending too: said with it (2026-11-02)
    const spend = `${money(fy.spending)} you plan to spend${fy.health >= 0.5 ? ` and ${money(fy.health)} of health cover` : ""}`;
    if (fy.need < 0.5 && fy.fromSavings < 0.5) bits.push(`${when}, nothing needs to come out of savings: about ${money(fy.income)} of ${src} covers the ${spend}.`);
    else if (fy.need < 0.5) {
      const dfr = fy.buckets.find((b) => b.bucket === "deferred");
      const back = (plan.accounts ?? []).filter((a) => a.type === "brokerage" && (Number(a.balance) || 0) > 0).map((a) => a.name);
      bits.push(`${when}, ${src} (about ${money(fy.income)}) ${fy.sources.length > 1 ? "cover" : "covers"} the ${spend}, so savings pay for nothing.`);
      // the tax it brings is what it adds to the year's federal tax at the brackets (round 8, widow-2: it was the plan's 15%)
      bits.push(`The law still requires about ${money(fy.required)} out of ${dfr ? from(dfr) : KIND.deferred}${fy.requiredTax >= 0.5 ? `; after about ${money(fy.requiredTax)} of tax on it` : ""}, what you do not spend can go into ${back.length ? list(back) : "a savings or investment account"}.`);
    } else {
      const [a, b2] = fy.buckets;
      // what the year needs, said in parts: three things take commas and one "and"; two take only the "and"
      const needs = list([`the ${money(fy.spending)} you plan to spend`, ...(fy.health >= 0.5 ? [`${money(fy.health)} of health cover`] : []), ...(fy.other >= 0.5 ? [`${money(fy.other)} of one-off costs`] : []), ...(fy.taxes >= 0.5 ? [`about ${money(fy.taxes)} of tax`] : [])]);
      const lead2 = fy.income >= 0.5 ? `With about ${money(fy.income)} of ${src}, that` : "That";
      if (fy.short >= 0.5) {
        // savings run out that year (round 8 review UX 1: "take $7,286 ... with $29,808 of Social Security, that pays for the $47,400
        // you plan to spend and $10,461 of health cover" added up to $20,767 the household does not have)
        bits.push(a ? `${when}, savings have only about ${money(fy.fromSavings)} left to take, from ${from(a)}${b2 ? ` and ${from(b2)}` : ""}.` : `${when}, savings are already used up.`);
        bits.push(`${lead2} covers about ${money(fy.fromSavings + fy.income)} of the ${money(fy.spending + fy.health + fy.other + fy.taxes)} the year needs: ${needs}.`);
      } else {
        // no account has anything left to take from (the money is already gone): say so instead of naming none (review 2026-11-05: crashed)
        bits.push(a ? `${when}, take about ${money(fy.fromSavings)} from savings, starting with ${from(a)}${b2 ? `, then ${from(b2)}` : ""}.` : `${when}, about ${money(fy.fromSavings)} would have to come from savings, and there is none left to take it from.`);
        bits.push(`${lead2} pays for ${needs}.`);
      }
    }
    // the careful figure (lasts in 9 of 10 markets) fills in below once worked out; the average-market one is the fallback
    bits.push(fy.verdict === "short" ? `At this spending the money runs out${fy.shortAge ? ` at ${fy.shortAge}` : ""}: Will the money last? shows what would fix it.` : averageWords);
    return bits;
  })();
  const say = (answer ?? []).slice(1).map((t) => ui.h("p", {}, t));
  // the spending that lasts in 9 of 10 markets (Monte Carlo's careful figure) replaces the average-market sentence (round 5):
  // drawn first with grey bars where its figures go (the same words, so nothing jumps), filled in after the first paint
  // (not with a way that is not offered already chosen: the careful figure is worked on the plan's own way)
  if (answer && fy.verdict !== "short" && say.length && !d.chosenHeld) {
    const last = say[say.length - 1];
    last.replaceChildren(...carefulWords(slot(money((fy.affordable * 0.8) / 12)), slot(money(fy.affordable * 0.8))));
    last.style.color = "var(--muted)";
    whenCareful(ctx, last, (c) => {
      last.style.color = "";
      if (!c || !(c.yearly > 0)) { last.replaceChildren(averageWords); return; }
      last.style.minHeight = `${last.offsetHeight}px`;
      last.replaceChildren(...carefulWords(money(monthlyOf(c.yearly)), money(c.yearly)));
    });
  }
  // the plan already uses a way that is held (chosen before this guard): said before the answer (its figures are that way's), with the way back below
  const chosenRow = d.rows.find((r) => r.key === d.chosen);
  const toFixed = `The answer below is for the ${money(d.spendingYearly)} you spend; to plan on it, choose "${DESCRIPTIONS["fixed-real"].name}" below.`;
  // why a way that plans on less than the year's income is held, with the year it goes wrong (round 8 review D2): said on its row
  // and, when the plan already uses it, in the notice
  const incomeReason = (r) => {
    const u = r.under ?? { year: r.first?.year, spending: r.expected.firstYear, income: r.first?.income ?? 0 };
    const low = r.expected.lowest < u.spending - 0.5 ? r.expected.lowest : null;
    return u.spending >= d.spendingYearly - 0.5
      ? `your ${money(u.income)} of income already covers the ${money(u.spending)} you spend, but the planner works this way out as if it were not there${low !== null ? `, so it cuts your spending when savings dip (as low as ${money(low)})` : ""}`
      : `the planner works this way out as if your income were not there, so in ${u.year} it plans on ${money(u.spending)} of spending, less than your ${money(u.income)} of income${low !== null ? `, and as low as ${money(low)}` : ""}`;
  };
  if (d.chosenHeld && chosenRow) root.append(ui.notice("warn", chosenRow.held === "below-income"
    ? `Your plan uses "${chosenRow.name}": ${incomeReason(chosenRow)}. ${toFixed}`
    : `Your plan uses "${chosenRow.name}", which on your plan counts ${money(chosenRow.expected.firstYear)} as all you spend${(chosenRow.first?.income ?? 0) >= 0.5 ? ` and leaves out your ${money(chosenRow.first.income)} of income` : ""}. ${toFixed}`));
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "How much to take out each year"),
    answer ? ui.h("p", { class: "lede" }, answer[0]) : null,
    ...say,
    answer && fy.required >= 0.5 ? ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/rmd" }, "This year's required withdrawal")) : null,
    // every way's figure is the same kind of amount (round 8 review UX 2: two showed spending and two a withdrawal, side by side)
    ui.h("p", { class: answer ? "muted small" : "lede" }, `Below: four ways to decide how much to spend, run on your plan with the returns you assume and through the worst stretch of history for a plan like yours (starting in ${d.worstStartYear}). Beside each way: what it takes from savings in the first year, in today's dollars.`),
  ));
  // each way's first year as "take $X from savings; with your income, that pays for ...", and why a way is not offered (round 8,
  // widow-1: "Use this one" on a share of what is left planned on $16,880 for a widow who spends $36,000). Review D6, D7 and UX 1:
  // the figure after "you spend" is the row's own spending; health cover, one-off costs and tax are named apart; a year whose
  // savings run short says how much of the need they cover; a required withdrawal beyond the need says what goes back.
  const firstWords = (r) => {
    const f = r.first;
    if (!f) return null;
    const G = f.income >= 0.5;
    // the first retirement year: this year for a household already retired, else that year (in today's dollars)
    const lead = f.year === Number(String(fmt.today()).slice(0, 4)) ? "This year" : `In ${f.year}, the first year of retirement`;
    if (f.beforeTax) return `${lead}: take about ${money(f.take)} from savings${r.key === "percent" ? ` (${fmt.pct(d.withdrawalRate, 1)} of what you have saved)` : ""}; ${G ? `with your ${money(f.income)} of income ` : ""}you would have about ${money(f.spend)} to spend, before tax.`;
    const parts = (withTax) => list([`the ${money(f.spend)} you spend`, ...(f.health >= 0.5 ? [`${money(f.health)} of health cover`] : []), ...(f.other >= 0.5 ? [`${money(f.other)} of one-off costs`] : []), ...(withTax && f.tax >= 0.5 ? [`about ${money(f.tax)} of tax`] : [])]);
    if (f.short >= 0.5) return `${lead}: savings have only about ${money(f.take)} left; ${G ? `with your ${money(f.income)} of income ` : ""}that covers about ${money(f.take + f.income)} of the ${money(f.spend + f.health + f.other + f.tax)} the year needs.`;
    if (f.take < 0.5) return G ? `${lead}: nothing from savings; your ${money(f.income)} of income pays for ${parts(true)}.` : `${lead}: nothing comes out of savings.`;
    const with_ = G ? `with your ${money(f.income)} of income, ` : "";
    if (f.back >= 0.5) {
      const law = f.required >= 0.5 && f.take <= f.required + 0.5 ? " (the least the law allows)" : "";
      return f.need < 0.5 && G
        ? `${lead}: take about ${money(f.take)} from savings${law}; your ${money(f.income)} of income already pays for ${parts(false)}, so the withdrawal, less its tax, goes back into savings.`
        : `${lead}: take about ${money(f.take)} from savings${law}; ${with_}that pays for ${parts(true)}, and what is left of it goes back into savings.`;
    }
    return `${lead}: take about ${money(f.take)} from savings; ${with_}that pays for ${parts(true)}.`;
  };
  // why a way is not offered, as the planner's limit, not the way's fault (round 8 review UX 2), with the year it goes wrong (review D2)
  const same = `"${DESCRIPTIONS["fixed-real"].name}" plans on what you really spend.`;
  const heldWords = (r) => {
    if (!r.held) return null;
    const S = money(r.expected.firstYear), G = r.first?.income ?? 0;
    if (r.held === "below-spending") return r.first?.rule === "share" && G >= 0.5
      ? `Not offered yet: the planner can only work this way out as if ${S} were all you spend, without your ${money(G)} of income, so it would plan your retirement on the wrong figure. ${same}`
      : `Not offered: on your plan it gives about ${S} a year to spend, less than the ${money(d.spendingYearly)} you spend.`;
    return `Not offered yet: ${incomeReason(r)}. ${same}`;
  };
  const offTrack = (r) => !!r.held && r.first?.rule === "share" && r.first.income >= 0.5;
  const rowOf = (r) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.name, r.key === d.chosen ? ui.h("span", { class: "pill accent" }, "chosen") : null), ui.h("span", { class: "rec-value" }, r.first ? `${money(r.first.take)} from savings` : `${money(r.expected.firstYear)} first year`)),
    ui.h("div", { class: "rec-sub" }, r.how),
    firstWords(r) ? ui.h("div", { class: "rec-sub" }, firstWords(r)) : null,
    // the chosen way's reason is the notice above the list
    r.held && r.key !== d.chosen ? ui.h("div", { class: "rec-sub" }, ui.h("strong", {}, heldWords(r))) : null,
    // a held share way whose figures leave the income out: its spending range would contradict the line above, so it is not drawn
    offTrack(r) ? null : ui.h("div", { class: "rec-sub" }, `With your assumptions: ${range(r.expected)}; ${outcome(r.expected)}.`),
    r.worst && !offTrack(r) ? ui.h("div", { class: "rec-sub" }, `Through ${d.worstStartYear}: ${range(r.worst)}; ${outcome(r.worst)}.`) : null,
    !r.offer ? null : ui.h("div", { class: "rec-foot" }, ui.button("Use this one", () => { pending = `Using: ${r.name}.`; store.update((p) => { p.retirement = { ...(p.retirement ?? {}), strategy: r.key }; }); }, { class: "secondary small" })));
  // the ways that can be chosen first; the ones not offered (most households with income, until the engine counts it) folded below
  const shown = d.rows.filter((r) => !r.held || r.key === d.chosen), folded = d.rows.filter((r) => r.held && r.key !== d.chosen);
  root.append(out);
  root.append(ui.card(!folded.length ? "The four ways" : d.chosenHeld ? "Your way, and the ways that fit your plan" : shown.length === 1 ? "The way that fits your plan" : "The ways that fit your plan",
    ui.h("ul", { class: "records" }, shown.map(rowOf)),
    ui.h("p", { class: "muted small" }, `The percentage and guardrail methods start from ${fmt.pct(d.withdrawalRate, 1)} (Projection page settings). Steady spending is easiest to live with; the variable ones never run dry but ask you to tighten in bad years.`),
  ));
  if (folded.length) root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, `Ways that don't fit your plan yet (${folded.length})`), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("ul", { class: "records" }, folded.map(rowOf)))));
  // Where the methods come from: one fold, not a tag on every card (design log 2026-09-16, pass 4).
  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "Where these methods come from"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "fold-body" }, d.rows.map((r) => ui.h("p", { class: "small" }, ui.h("strong", {}, `${r.name}. `), r.from)))));
}
