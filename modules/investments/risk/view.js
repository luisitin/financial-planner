// modules/investments/risk/view.js -- DOM only. What a bad year and the deepest fall would cost in your own dollars,
// four tiles and the first thing to do with it; then one card of quiet rows (opt spec 6.1): "6 more mixes" (the
// standard mixes on your money), "Ups and downs over longer stretches" (gap list, next 60, item 52: the spread of 1-, 5-
// and 10-year stretches, the return for each unit of ups and downs, how stocks, bonds and cash move together) and
// "How this is worked out" (the small print and the rest of what to do).
import { compute, STRETCHES, STRETCH_FIRST, BILLS_FROM, RECENT_FROM } from "./compute.js";
import { parts } from "../../../core/ui/more.js";

/** The stretch shown in "Ups and downs over longer stretches": this visit only, a choice of view, never in the plan. */
let stretch = STRETCH_FIRST;
/** For tests: back to the stretch shown first. */
export const resetStretch = () => { stretch = STRETCH_FIRST; };

export const LONGER_TITLE = "Ups and downs over longer stretches";
const pctOf = (x, d = 1) => `${(x * 100).toFixed(d).replace(/^-0(\.0+)?$/, "0$1")}%`;
const signed = (x, d = 1) => (x < 0 ? `-${pctOf(-x, d)}` : pctOf(x, d));
const NUMBER_WORDS = { 5: "five", 10: "ten" };
const spanWords = (k) => (k === 1 ? "year" : `${NUMBER_WORDS[k] ?? k}-year stretch`);
const when = (s) => (s.from === s.to ? String(s.from) : `${s.from}-${s.to}`);

/**
 * longerLead(main) -> the row's first line: which mix it is, by the name the page's headline gives it (critic P5: "a mix
 * like yours (70% stocks)" read as the household's own figure where the plan only has the 70% it starts with).
 */
export function longerLead(main, from) {
  const pct = `${Math.round(main.weights.stocks * 100)}% stocks`;
  const who = main.label === "What you hold" ? `what you hold (${pct})`
    : main.label === "Your target mix" ? `your target mix (${pct})`
    : `your plan's mix (${pct}, from the Will the money last? page, where you can change it)`;
  return `Every stretch of years since ${from} for ${who}, before fees and taxes.`;
}
/**
 * stretchSentence(r) -> the one sentence for the rolling stretches (R5): lost money in some, or never; one-year
 * stretches are "years". stretchRealSentence(r) -> the same after inflation.
 */
export function stretchSentence(r) {
  const lead = r.years === 1 ? `Of the ${r.n} years since ${r.from}, this mix` : `Over the ${r.n} ${spanWords(r.years)}es since ${r.from}, this mix`;
  const middle = r.years === 1 ? `the middle year grew ${signed(r.middle)}` : `the middle one grew ${signed(r.middle)} a year`;
  return r.lost > 0 ? `${lead} lost money in ${r.lost} (${Math.round(r.lostShare * 100)}%); ${middle}.` : `${lead} never lost money; ${middle}.`;
}
export function stretchRealSentence(r) {
  return r.lostReal > 0 ? `After inflation, ${r.lostReal} of them (${Math.round(r.lostRealShare * 100)}%) lost buying power.` : "After inflation, none of them lost buying power.";
}
/** The words under the strip: what its colours mean, when part of it is a loss. */
export const stripWords = (r) => (r.worst.rate < 0 ? "From the worst stretch to the best: red is a loss, the mark is the middle." : "From the worst stretch to the best, with the middle marked: none lost money.");
/** sharpeSentence({ main, stocks, bonds }) -> the return for each unit of ups and downs, in words, with all stocks and
 *  all bonds beside it, and why it starts later than the stretches (critic P6); a mix with no ups and downs above the
 *  bills (all cash) has none. */
export function sharpeSentence(s) {
  const m = s.main;
  if (m.ratio === null) return `A mix that is all cash has no ups and downs above Treasury bills, so this number does not apply to it.`;
  return `Since ${m.from}, when the record of 3-month Treasury bills begins, this mix earned ${signed(m.excess)} a year more than those bills on average, with ups and downs of ${pctOf(m.spread)} a year around that, so ${m.ratio.toFixed(2)} for each unit. Higher is better: all stocks ${s.stocks.ratio.toFixed(2)}, all bonds ${s.bonds.ratio.toFixed(2)}.`;
}
const NAMES = { stocks: "stocks", bonds: "bonds", bills: "cash" };
/** The row of one pair: its name, its words, and its correlation since 1928 and since 2000 (and the recent words when they differ). */
export function pairRow(p) {
  const title = `${NAMES[p.a].charAt(0).toUpperCase()}${NAMES[p.a].slice(1)} and ${NAMES[p.b]}`;
  const num = (r) => (r === null ? "-" : r.toFixed(2).replace(/^-0\.00$/, "0.00"));
  const sub = `${num(p.r)} since ${p.from}; ${num(p.recentR)} since ${p.recent}${p.recentWords !== p.words ? ` (lately they ${p.recentWords})` : ""}`;
  return { title, words: p.words, sub };
}

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), stretch });
  const money = (n) => fmt.money(n, cur);
  const m = d.main;
  const mixText = (w) => `${Math.round(w.stocks * 100)}% stocks, ${Math.round(w.bonds * 100)}% bonds${w.bills > 0.005 ? `, ${Math.round(w.bills * 100)}% cash` : ""}`;
  // the shell draws the page again in place (open rows and the scroll stay); a stand-in without it draws this root again
  const redraw = () => { if (ctx.redraw) ctx.redraw(); else { root.innerHTML = ""; render(root, ctx); } };
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.amount > 0 ? `A bad year could take about ${money(-m.badYear)}` : "How rough is the ride?"),
    ui.h("p", { class: "lede" }, `${m.label} (${mixText(m.weights)})${d.amount > 0 ? ` on your ${money(d.amount)}` : ""}: since 1871, a mix like this has averaged ${fmt.pct(m.mean, 1)} a year, with a typical swing of ${fmt.pct(m.stdev, 0)} up or down. It lost money in ${Math.round(m.lossShare * 100)}% of years; its worst year was ${m.worstYearWhen} (${fmt.pct(m.worstYear, 0)}${d.amount > 0 ? `, or ${money(-m.worstYearDollars)} of yours` : ""}). The deepest fall was ${fmt.pct(m.drawdown.depth, 0)} from ${m.drawdown.peakYear} to ${m.drawdown.troughYear}${d.amount > 0 ? ` (${money(m.drawdownDollars)})` : ""}${m.drawdown.recoveryYear ? `, back to its old level by ${m.drawdown.recoveryYear}` : ""}.`),
    // what "a bad year" in the headline means; with no money to put a dollar on it the headline does not say it
    d.amount > 0 ? ui.h("p", { class: "muted small" }, `A "bad year" here is the kind that comes about one year in six.`) : null,
  ));
  for (const n of d.notes) root.append(ui.notice(n.includes("Retirement is") ? "warn" : "info", n));
  root.append(ui.card(null, ui.row(
    ui.stat("Ups and downs", fmt.pct(m.stdev, 0), "typical swing in a year"),
    ui.stat("Losing years", `${Math.round(m.lossShare * 100)}%`, "of years since 1871"),
    ui.stat("Worst year", fmt.pct(m.worstYear, 0), String(m.worstYearWhen)),
    ui.stat("Deepest fall", fmt.pct(m.drawdown.depth, 0), `${m.drawdown.peakYear} to ${m.drawdown.troughYear}`),
  )));
  if (d.held && d.target && Math.abs(d.held.weights.stocks - d.target.weights.stocks) > 0.02) root.append(ui.card(d.targetSource === "own" ? "What you hold against your target" : "What you hold against your plan's mix",
    ui.h("ul", { class: "records" }, [d.held, d.target].map((x) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${x.label} (${mixText(x.weights)})`), ui.h("span", { class: "rec-value" }, `${fmt.pct(x.stdev, 0)} a year`)), ui.h("div", { class: "rec-sub" }, `worst year ${fmt.pct(x.worstYear, 0)} (${money(-x.worstYearDollars)}), deepest fall ${fmt.pct(x.drawdown.depth, 0)} (${money(x.drawdownDollars)}), ${Math.round(x.lossShare * 100)}% losing years`)))),
  ));
  const todo = (t, s) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s));
  root.append(ui.card("What to do with this",
    ui.h("ul", { class: "records" }, todo("Pick the fall you can sit through", "The right mix is the most stock you can hold through a fall like 1929-32, 1973-74 or 2008 without selling at the bottom. Everything else is detail.")),
  ));
  root.append(ui.h("div", {}, parts(ctx, mixesPart(ctx, d, money), longerPart(ctx, d, redraw), howPart(ctx, d, todo))));
}

// ---------------------------------------------------------------- "6 more mixes": the standard mixes on your money (moved, opt spec 6.1)
function mixesPart(ctx, d, money) {
  const { ui, fmt } = ctx;
  const m = d.main;
  return { id: "mixes", kind: "more", n: d.comparison.length, noun: "mixes", body: () => [
    ui.h("ul", { class: "records" }, d.comparison.map((x) => ui.h("li", { style: Math.abs(x.weights.stocks - m.weights.stocks) < 0.1 ? { background: "var(--accent-soft)", borderRadius: "8px" } : null },
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${x.label} stocks / bonds`, Math.abs(x.weights.stocks - m.weights.stocks) < 0.1 ? ui.h("span", { class: "pill accent" }, "closest to yours") : null), ui.h("span", { class: "rec-value" }, `${fmt.pct(x.mean, 1)} a year`)),
      ui.h("div", { class: "rec-sub" }, `moves ${fmt.pct(x.stdev, 0)} a year · worst year ${fmt.pct(x.worstYear, 0)}${d.amount > 0 ? ` (${money(-x.worstYearDollars)})` : ""} · deepest fall ${fmt.pct(x.drawdown.depth, 0)}${d.amount > 0 ? ` (${money(x.drawdownDollars)})` : ""} · losing years ${Math.round(x.lossShare * 100)}%`)))),
    ui.h("p", { class: "muted small" }, "Yearly returns 1871-2025 (Shiller, then Damodaran), rebalanced once a year, before fees and taxes. Bonds are 10-year Treasuries. The Backtest page runs any two mixes side by side."),
  ] };
}

// ---------------------------------------------------------------- "Ups and downs over longer stretches" (gap list, next 60, item 52)
/** One strip from the worst stretch to the best, red below zero and the accent above, with a mark at the middle; the
 *  three figures under it. Drawn with the page's own boxes and colours (dark mode follows). */
function spread(ctx, r) {
  const h = ctx.ui.h;
  const lo = Math.min(0, r.worst.rate), hi = Math.max(0, r.best.rate), span = hi - lo || 1;
  const at = (x) => `${((x - lo) / span) * 100}%`;
  const zero = (0 - lo) / span;
  const left = (r.worst.rate - lo) / span, right = (r.best.rate - lo) / span;
  const piece = (from, to, color) => (to > from ? h("span", { style: { position: "absolute", top: "0", bottom: "0", left: `${from * 100}%`, width: `${(to - from) * 100}%`, background: color } }) : null);
  return h("div", { dataset: { spread: "" }, style: { display: "grid", gap: "8px" } },
    h("div", { role: "img", "aria-label": `from ${signed(r.worst.rate)} to ${signed(r.best.rate)} a year, the middle ${signed(r.middle)}`, style: { position: "relative", height: "14px", borderRadius: "999px", background: "var(--line)", overflow: "hidden", margin: "6px 0" } },
      piece(left, Math.min(zero, right), "var(--bad)"),
      piece(Math.max(zero, left), right, "var(--accent)"),
      lo < 0 ? h("span", { style: { position: "absolute", top: "-2px", bottom: "-2px", left: at(0), width: "2px", background: "var(--text)" } }) : null,
      h("span", { style: { position: "absolute", top: "0", bottom: "0", left: `calc(${at(r.middle)} - 2px)`, width: "4px", background: "var(--text)", borderRadius: "2px" } })),
    h("p", { class: "muted small" }, stripWords(r)),
    h("ul", { class: "records" },
      h("li", {}, h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, "Worst"), h("span", { class: "rec-value" }, `${signed(r.worst.rate)}${r.years > 1 ? " a year" : ""}`)), h("div", { class: "rec-sub" }, when(r.worst))),
      h("li", {}, h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, "Middle"), h("span", { class: "rec-value" }, `${signed(r.middle)}${r.years > 1 ? " a year" : ""}`)), h("div", { class: "rec-sub" }, "half did better, half worse")),
      h("li", {}, h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, "Best"), h("span", { class: "rec-value" }, `${signed(r.best.rate)}${r.years > 1 ? " a year" : ""}`)), h("div", { class: "rec-sub" }, when(r.best)))));
}
function longerPart(ctx, d, redraw) {
  const { ui } = ctx;
  const h = ui.h;
  const L = d.longer;
  if (!L?.rolling?.n) return null;
  const r = L.rolling;
  const chip = (k) => h("button", { type: "button", class: `chip${stretch === k ? " on" : ""}`, "aria-pressed": stretch === k ? "true" : "false", onClick: () => { if (stretch !== k) { stretch = k; redraw(); } } }, k === 1 ? "1 year" : `${k} years`);
  return { id: "longer", kind: "more", title: LONGER_TITLE, says: r.years === 1 ? "year by year" : `${r.years}-year stretches`, body: () => [
    h("p", { class: "muted small" }, longerLead(d.main, r.from)),
    h("div", { class: "chips", role: "group", "aria-label": "How long a stretch" }, STRETCHES.map(chip)),
    spread(ctx, r),
    h("p", { "aria-live": "polite" }, stretchSentence(r), " ", stretchRealSentence(r)),
    h("h3", {}, "Return for each unit of ups and downs"),
    h("p", {}, sharpeSentence(L.sharpe), L.sharpe.main.ratio === null ? null : " Its usual name is the Sharpe ratio."),
    h("h3", {}, "How the parts move together"),
    h("ul", { class: "records" }, L.together.map((p) => { const w = pairRow(p); return h("li", {}, h("div", { class: "rec-head" }, h("span", { class: "rec-title" }, w.title), h("span", { class: "rec-value" }, w.words)), h("div", { class: "rec-sub" }, w.sub)); })),
    h("p", { class: "muted small" }, `Each figure says how closely the two move together (its usual name is the correlation): 1 always together, 0 no link, -1 always opposite. Parts that do not move together soften each other's falls. Cash is 3-month Treasury bills, so this starts in ${BILLS_FROM} too; since ${RECENT_FROM} is shown because the link between stocks and bonds changed.`),
  ] };
}

// ---------------------------------------------------------------- "How this is worked out": the small print and the rest of what to do (moved)
function howPart(ctx, d, todo) {
  const { ui, fmt } = ctx;
  const m = d.main;
  return { id: "how", kind: "how", body: () => [
    ui.h("p", { class: "small" }, `A "bad year" is one swing below zero: ${fmt.pct(m.stdev, 0)} of the money. Since 1970 the same mix has swung about ${fmt.pct(m.recentStdev, 0)} a year with a worst year of ${fmt.pct(m.recentWorst, 0)} (${m.recentWorstWhen}). The plan assumes typical swings of ${fmt.pct(d.plan.stdev, 0)} a year around ${fmt.pct(d.plan.mean, 1)} (Assumptions page).`),
    ui.h("ul", { class: "records" },
      todo("Time heals stocks, not always bonds", "Every ten-year stretch of a 60/40 mix has ended up ahead, before counting inflation; all-stock mixes had decades that lost money. The Backtest page shows the worst ten years of any mix."),
      todo("Money needed soon is not investment money", "Spending in the next three to five years belongs in cash and short bonds; the Emergency fund and Irregular expenses pages cover it.")),
  ] };
}
