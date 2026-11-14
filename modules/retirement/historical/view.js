// modules/retirement/historical/view.js -- DOM only. The plan replayed from every start year in
// history: how many stretches it survived, which would have sunk it, and the spending that
// survived them all.
// Simple first (opt C14 for this page, done with gap next-60 #53, 2026-11-14): the answer as one ui.stat with its words and one
// sentence per case, the chart, then the rest as quiet rows of one card (core/ui/more.js): "N more numbers" (the two tiles and the
// hardest starts, moved), "Never run the savings down" (the rate that never touches the starting money, new), "How this is
// worked out" (what the page does and where the data comes from, moved). Nothing was deleted.
import { needButtons } from "../needs.js";
import { lineChart } from "../charts.js";
import { ssNotice } from "../ss-notice.js";
import { needsWords } from "../../../core/words.js";
import { parts } from "../../../core/ui/more.js";

/** The new part's title, pinned in qa/first-view-lib.mjs (gap next-60 #53); its status the two rates "a year". It was "Living on
 * the growth alone · 2.5% to 4.0%", which said nothing plain at a glance (n1 fix P4). */
export const GROWTH_TITLE = "Never run the savings down";
/** A plan's own first-year rate from which the sentence says "far more" (n1 fix F2: 65.7% read "more than even a middle start
 * could", beside 4.0%): a quarter of the savings or more in one year is over twice any middle start in history (about 4% over
 * 30 years; 9.6% at most, a single year all in stocks: checked over 1 to 60 years at 0% to 100% in stocks, README). */
export const FAR_RATE = 0.25;
const SINCE = 1928;

/**
 * answerFor(d) -> { key, value, label, lede }: the answer (one ui.stat with its words, R3) and the one sentence under it for each
 * case the page can reach (R5): every, strong, fair, weak, none. `d` is compute()'s result.
 */
export function answerFor(d) {
  const lasted = d.runs ? d.runs.filter((r) => r.success).length : Math.round(d.successRate * d.windows);
  const value = `${lasted} of ${d.windows}`;
  const label = `start years since ${d.dataRange?.[0] ?? SINCE} in which the money lasts to the end`;
  const key = lasted === d.windows ? "every" : lasted === 0 ? "none" : d.verdict;
  const lede = {
    every: `Strong: it lasted from every start year since ${d.dataRange?.[0] ?? SINCE}, through the Depression and the 1970s.`,
    strong: "Strong: it lasted from nearly every start year, but not all.",
    fair: "Fair: most start years were fine, but the hardest ones ran it dry.",
    weak: "Weak: many stretches of real history would have run this plan dry.",
    none: `Weak: the money ran out from every start year since ${d.dataRange?.[0] ?? SINCE}.`,
  }[key];
  return { key, value, label, lede };
}

const r1 = (x) => Math.round(x * 1000);   // a rate as the page shows it, to a tenth of a percent
const yearsWords = (p) => (p.years === 1 ? `the one year ${p.from}` : `the ${p.years} years from ${p.from} to ${p.to}`);

/** The status: the rates "a year" while that fits the 20 characters a status has (R25), else the rates alone. */
const yearly = (t) => (`${t} a year`.length <= 20 ? `${t} a year` : t);

/**
 * growthWords(p, pct) -> { key, says, history, plan }: the part's status and its sentences, each written out per case (R5).
 * history: both (the worst start could take something: one sentence for it, one for a middle start, n1 fix P5), worstNone (it
 * could take nothing), allNone (at least half the start years could take nothing). plan: below, between, above (against the two
 * rates as shown), far (a quarter of its savings or more: FAR_RATE), all (more than all of its savings), nothing (income pays
 * for it), noSavings, or "" when the plan has no retired year. `p` is compute's perpetual; pct(x) -> "2.5%".
 */
export function growthWords(p, pct) {
  const w = p.worst, m = p.middle;
  let key, says, history;
  if (r1(w.rate) > 0) {
    key = "both"; says = yearly(`${pct(w.rate)} to ${pct(m.rate)}`);
    history = `In the worst start in history (${w.startYear}), you could take out ${pct(w.rate)} of the savings in the first year, then the same amount raised with prices each year, and still have at least as much at the end of ${yearsWords(p)}, in today's dollars. In a middle start (${m.startYear}), you could take out ${pct(m.rate)}.`;
  } else if (r1(m.rate) > 0) {
    key = "worstNone"; says = yearly(`up to ${pct(m.rate)}`);
    history = `In the worst start in history (${w.startYear}), the savings ended ${yearsWords(p)} smaller than they began, in today's dollars, even with nothing taken out. In a middle start (${m.startYear}), you could take out ${pct(m.rate)} of the savings in the first year, then the same amount raised with prices each year, and still have at least as much at the end.`;
  } else {
    key = "allNone"; says = "";
    history = `Over ${yearsWords(p)}, the savings ended smaller than they began, in today's dollars, in at least half of the start years in history even with nothing taken out, so there is no such amount to give.`;
  }
  const q = p.plan;
  let planKey = "", plan = "";
  if (q && q.rate === null) { planKey = "noSavings"; plan = "Your plan has no savings to take from when it retires, so it has no rate of its own to set beside these."; }
  else if (q && r1(q.rate) <= 0) { planKey = "nothing"; plan = `Your plan takes nothing from its savings in its first year retired (${q.year}): its income pays for the spending.`; }
  else if (q && q.rate >= 1) { planKey = "all"; plan = `In its first year retired (${q.year}) your plan needs more than all of its savings.`; }
  else if (q && q.rate >= FAR_RATE) { planKey = "far"; plan = `Your plan takes out ${pct(q.rate)} of its savings in its first year retired (${q.year}), far more than even a middle start could.`; }
  else if (q && r1(q.rate) < r1(w.rate)) { planKey = "below"; plan = `Your plan takes out ${pct(q.rate)} of its savings in its first year retired (${q.year}), less than even the worst start could.`; }
  else if (q && r1(q.rate) <= r1(m.rate)) { planKey = "between"; plan = `Your plan takes out ${pct(q.rate)} of its savings in its first year retired (${q.year}), between the two.`; }
  else if (q) { planKey = "above"; plan = `Your plan takes out ${pct(q.rate)} of its savings in its first year retired (${q.year}), more than even a middle start could.`; }
  return { key, says, history, planKey, plan };
}

/** The how text under the two sentences (small): exactly what is worked out, and what it leaves out. */
export function growthHow(p, pct) {
  return `How: for each start year since ${SINCE}, the share of the savings that could be taken out in the first year, then the same amount raised each year with that year's prices, so that after ${yearsWords(p)} the savings, in today's dollars, are at least what they were at the start. The savings grow with each year's stock and bond returns at your mix once retired (${pct(p.stocks).replace(/\.0%$/, "%")} in stocks); no taxes, fees or income are counted. Your plan's own rate is what Will the money last? takes from savings in its first year retired (the spending, health insurance and tax, less your income) as a share of the savings then, if markets do as well as average. Taking out more than this rate does not mean the money runs out: only that the savings end smaller than they began, as a plan meant to be spent down does (the chance it lasts is the answer at the top).`;
}

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  { const ss = ssNotice(ctx); if (ss) root.append(ss); }   // no Social Security in the plan: say so first (ss-notice.js)
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(n, cur);
  const answer = ui.h("div", {}, ui.h("p", { class: "lede", "aria-busy": "true" }, "Replaying history..."));
  root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "If history repeated itself"), answer));
  const host = ui.h("div");
  root.append(host);
  ctx.computeRemote("retirement/historical", { today: fmt.today(), perpetual: true }).then((d) => {
    answer.replaceChildren();
    if (!d || !d.ready) {
      answer.append(ui.h("p", {}, d?.missing?.length ? needsWords("First, the plan needs", d.missing) : "First, the plan needs a few answers."), needButtons(ui, d?.missing) ?? ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Open Will the money last?")));
      return;
    }
    const a = answerFor(d);
    answer.append(ui.stat(a.label, a.value), ui.h("p", {}, a.lede));
    // the chart stays on the first view (opt spec 6.1)
    const years = d.runs.map((r) => r.startYear);
    const ends = d.runs.map((r) => Math.max(0, r.endReal));
    host.append(ui.card("Money left at the end, by the year the plan would have started",
      ends.some((v) => v > 0)
        ? lineChart({ years, series: [{ values: ends }], label: "end balance by start year" })
        : ui.notice("warn", "The money ran out before the end in every start year, so there is nothing left to chart."),
      ends.some((v) => v > 0) ? ui.h("p", { class: "muted small" }, "Today's dollars. Zero means the money ran out before the end.") : null,
    ));
    host.append(ui.h("div", {}, parts(ctx, numbersPart(ctx, d, money), growthPart(ctx, d), howPart(ctx, d))));
  }).catch((e) => { answer.replaceChildren(); host.append(ui.notice("error", `Could not run it: ${e.message}`)); });
}

// ---------------------------------------------------------------- "N more numbers": the two tiles and the hardest starts (moved)
function numbersPart(ctx, d, money) {
  const { ui } = ctx;
  return { id: "numbers", kind: "more", n: 2 + d.worst.length, noun: "numbers", body: () => [
    ui.row(
      ui.stat("Spending that lasted in every start year", d.safeSpending !== null ? money(d.safeSpending) : "-", `a year, today's dollars; you plan on ${money(d.spendingYearly)}`),
      ui.stat("Typical amount left", money(Math.max(0, d.medianEndReal)), "middle start year, today's dollars"),
    ),
    ui.h("h3", {}, "The hardest starts"),
    ui.h("ul", { class: "records" }, d.worst.map((w) => {
      const head = ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `Starting in ${w.startYear}`), ui.h("span", { class: `rec-value ${w.success ? "" : "bad"}` }, w.success ? money(w.endReal) : `ran out at ${w.failAge}`));
      const sub = ui.h("div", { class: "rec-sub" }, w.success ? `left at the end; lowest point ${money(Math.max(0, w.minReal))}` : `the money ran out at age ${w.failAge}, in ${w.failYear}`);
      return ui.h("li", {}, head, sub);
    })),
  ] };
}

// ---------------------------------------------------------------- "Never run the savings down" (gap next-60 #53)
function growthPart(ctx, d) {
  const { ui, fmt } = ctx;
  const p = d.perpetual;
  if (!p) return null;
  const pct = (x) => fmt.pct(x, 1);
  const g = growthWords(p, pct);
  return { id: "growth", kind: "more", title: GROWTH_TITLE, says: g.says, body: () => [
    ui.h("p", {}, g.history),
    g.plan ? ui.h("p", {}, g.plan) : null,
    ui.h("p", { class: "muted small" }, growthHow(p, pct)),
  ] };
}

// ---------------------------------------------------------------- "How this is worked out": what the page does, the data (moved)
function howPart(ctx, d) {
  const { ui } = ctx;
  return { id: "how", kind: "how", body: () => [
    ui.h("p", {}, `Your plan replayed through every stretch of actual US history since ${d.dataRange[0]}, with the stock and bond returns and inflation of those years, starting in 1929, in 1966, in 2000 and so on. Each start year is one run: ${d.windows} of them, from ${d.dataRange[0]} to ${d.dataRange[1] - d.years + 1}.`),
    ui.h("p", { class: "muted small" }, "The spending that lasted in every start year is the most a year, the same in today's dollars every year, that the six hardest starts could all carry."),
    ui.h("p", { class: "muted small" }, "Data: Aswath Damodaran's yearly returns (S&P 500 with dividends, 10-year Treasuries, 3-month bills, CPI), 1928 to " + d.dataRange[1] + "."),
  ] };
}
