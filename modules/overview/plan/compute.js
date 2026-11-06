// modules/overview/plan/compute.js -- PURE. "Your plan": the end of the path (overview/guide's "plan" journey). Every row quotes
// the function the result page uses for its own top answer, so B and the page never disagree; this file works out no money of
// its own. No heavy simulation runs here: the Monte Carlo, the stress tests, goal seek and the health score stay on their own
// pages (test: this file imports none of them). Life-needs is the one heavy-marked compute used: Next best action already
// pays for it.
import { standing, retirementGap } from "../setup/compute.js";
import { answerFor } from "../quick/compute.js";
import { protectionGaps, sayName, twoFigures } from "../../insurance/life-needs/compute.js";
import { firstYear } from "../../retirement/withdrawal-strategy/compute.js";
import { thisYear as rmdThisYear } from "../../retirement/rmd/compute.js";
import { rmdStartYear } from "../../../core/math/rmd.js";
import { compute as goalsOf } from "../../goals/goals/compute.js";
import { compute as nextBest } from "../next-best-action/compute.js";
import { goalsBehind } from "../alerts/compute.js";
import { compute as houseOf } from "../../goals/house/compute.js";
import { compute as educationOf } from "../../goals/education/compute.js";
import { checkInDue, nextMonth, monthLabel } from "../monthly-review/compute.js";
import { guessesInUse } from "../../../core/estimate/index.js";
import { money as fmtMoney } from "../../../core/format.js";
import { pathSummary, resultOrder, PATH_ID } from "../guide/compute.js";
import { goalsWords, guessList, notCounted, monthYear } from "./words.js";

export const GROUP_TITLES = ["Right now", "Family and retirement", "Goals and this year's tax"];
/** How many of our guesses Your plan lists before pointing at the page with all of them. */
export const GUESSES_SHOWN = 3;
/** A value longer than this goes into the sentence, and the right side of the row shows only the chevron. */
export const VALUE_MAX = 14;

const lower = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const num = (n) => String(Math.round(n * 10) / 10);
/** Months as the cushion page says them: whole months, one decimal only under 2 (design log 2026-09-15). */
const monthsOf = (m) => { const t = m >= 100 ? "100+" : m < 2 ? String(Math.round(m * 10) / 10) : String(Math.round(m)); return `${t} month${t === "1" ? "" : "s"}`; };
const join = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const guessed = (line) => (/guess/i.test(line) ? line : `${line} Partly our guesses.`);

/** The sources a row may quote, each worked out once and only when a row asks. */
function sources(plan, today, passedKeys = []) {
  const memo = {};
  const once = (k, fn) => () => (k in memo ? memo[k] : (memo[k] = (() => { try { return fn(); } catch { return null; } })()));
  const cur = plan?.meta?.currency ?? "USD";
  return {
    today, cur, passed: (k) => passedKeys.includes(k), money: (n) => fmtMoney(Math.round(Number(n) || 0), cur),
    st: once("st", () => standing(plan, { today })),
    debt: once("debt", () => answerFor("debt", plan, { today })),
    retire: once("retire", () => answerFor("retire", plan, { today })),
    taxes: once("taxes", () => answerFor("taxes", plan, { today })),
    gaps: once("gaps", () => protectionGaps(plan, { today })),
    first: once("first", () => firstYear(plan, { today })),
    rmd: once("rmd", () => rmdThisYear(plan, { today })),
    goals: once("goals", () => goalsOf(plan, { today })),
    nba: once("nba", () => nextBest(plan, { today })),
    house: once("house", () => houseOf(plan, { today })),
    college: once("college", () => educationOf(plan, { today })),
    gap: once("gap", () => retirementGap(plan)),
  };
}

const open = (what, href) => ({ status: "open", value: "Not yet", line: `Not worked out yet: needs ${what}.`, needs: what, fixHref: href ?? null, figure: null });

/** One builder per row key: -> { value, line, short?, status, guessed?, mostlyGuessed?, figure, note?, needs?, fixHref? }. */
const ROW = {
  net(S, plan) {
    const st = S.st();
    if (!st || st.netWorth === null) return open("what you have and what you owe", "#/overview/setup/have?back=done&from=plan");
    const g = !!st.netWorthGuessed;
    const line = `You own ${S.money(st.assets)} and owe ${S.money(st.liabilities)}.`;
    return { value: S.money(st.netWorth), line: g ? guessed(line) : line, status: g || st.netWorth < 0 ? "calm" : "ok", guessed: g, mostlyGuessed: g, figure: st.netWorth };
  },
  month(S) {
    const st = S.st();
    if (st && st.spare === null && st.spendGuessed?.rows > 0) {
      // the Expenses step just showed the guessed spending: say it, and say what is missing, so the row never seems to lose that page
      const r = { ...open("your pay", "#/overview/setup/money?back=done&from=plan"), value: null };
      return { ...r, line: `Spending is our guess (about ${S.money(Math.round(st.spendGuessed.rows / 10) * 10)} a month). Add your pay to see what is left.` };
    }
    if (!st || st.spare === null) return open("your pay and spending", "#/overview/setup/money?back=done&from=plan");
    const amt = Math.abs(Math.round(st.spare));
    const word = st.spare < 0 ? "short" : "spare";
    if (st.spareWaits) return { value: null, line: `Most of your spending is our guesses, so this waits for yours. With our guesses, about ${S.money(Math.round(amt / 10) * 10)} ${word}.`, status: "calm", guessed: true, mostlyGuessed: true, figure: st.spare };
    if (st.drawing) return { value: `${S.money(-st.spare)} a month`, line: `About ${S.money(-st.spare)} a month comes from your savings, as planned.`, status: "calm", guessed: !!st.spendGuessed, figure: st.spare };
    if (st.bank) return { value: null, line: `By your plan, about ${S.money(amt)} is left each month. Your bank shows about ${S.money(Math.round(st.bank.gap / 10) * 10)} a month more going out.`, status: "warn", short: "your bank shows more going out than your plan lists", guessed: !!st.spendGuessed, figure: st.spare };
    if (st.spare >= 0) return { value: `${S.money(amt)} a month`, line: `About ${S.money(amt)} is left each month after tax, bills and saving.`, status: "ok", short: `about ${S.money(amt)} left each month`, guessed: !!st.spendGuessed, figure: st.spare };
    return { value: `${S.money(amt)} short`, line: `About ${S.money(amt)} more goes out than comes in each month.`, status: "warn", short: `about ${S.money(amt)} short each month`, guessed: !!st.spendGuessed, figure: st.spare };
  },
  debts(S) {
    const a = S.debt();
    if (!a) return open("your loans and cards", "#/balance/net-worth");
    const st = S.st();
    const g = (st?.guessed ?? []).some((x) => x.rate !== null);
    const words = a.status === "warn" ? `${a.headline}. ${a.line}` : `${a.headline}: ${a.line}`;
    return { value: null, line: g ? `${words} Some rates are our guesses.` : words, status: a.status === "warn" ? "warn" : "ok", short: lower(a.headline), guessed: g, figure: a.headline };
  },
  cushion(S) {
    const st = S.st();
    const note = "Cash set aside for a lost job or a big repair.";
    if (!st || st.runway === null) return { ...open("your spending and savings", "#/overview/setup/spend?back=done&from=plan"), note };
    const months = monthsOf(st.runway), target = st.runwayTarget ?? 6;
    // the bills are mostly our guesses: the page says how many months is not known yet, so this row gives no bare figure
    if (st.runwayWaits) return { value: null, line: st.runway < 0.05 ? "Not known yet: it needs your own bills and the cash you have. Type them to find out." : `By our guesses of your bills, about ${months}. How many it really is isn't known yet: type your bills to find out.`, status: "calm", guessed: true, mostlyGuessed: true, figure: st.runway, note };
    if (st.runwayStatus === "ok") return { value: months, line: `Cash for ${months} of the bills you have to pay. You're covered.`, status: "ok", short: `cash for ${months}`, figure: st.runway, note };
    if (st.cushionLater) return { value: months, line: `Enough for now; build it to ${target} months once the costly debt is paid.`, status: "calm", figure: st.runway, note };
    return { value: months, line: `Cash for about ${months} of the bills you have to pay. Aim for ${target}.`, status: st.runwayStatus === "bad" ? "bad" : "warn", short: `cash for ${months.replace(/ months?$/, "")} of ${target} months`, figure: st.runway, note };
  },
  protect(S, plan) {
    if (plan?.guide?.journeys?.[PATH_ID]?.none?.protect) return { value: null, line: "You said no one depends on your pay.", status: "ok", figure: 0 };
    const gaps = S.gaps();
    // before the cover step is passed, a clean result rests on what we assumed: grey and "not checked yet", never a green verdict
    if (!gaps || !gaps.length) return S.passed("protect") ? { value: null, line: "If an earner died, your family would be all right.", status: "ok", figure: 0 }
      : { value: null, line: "Not checked yet: the cover step looks at this with you.", status: "calm", figure: 0 };
    const rough = gaps.some((g) => g.rough);
    const amt = (g) => S.money(g.rough ? twoFigures(g.gap) : g.gap);
    const parts = gaps.map((g, i) => (i === 0 ? `${cap(sayName(g.name))} would need about ${amt(g)} more life insurance` : `${sayName(g.name)} about ${amt(g)}`));
    const total = gaps.reduce((t, g) => t + g.gap, 0);
    return { value: null, line: `${join(parts)}.`, status: rough ? "calm" : "warn", short: `life insurance about ${S.money(rough ? twoFigures(total) : total)} short`, guessed: rough, mostlyGuessed: rough, figure: total };
  },
  retire(S) {
    const a = S.retire(), st = S.st();
    if (!a) { const g = S.gap(); return open(g?.what ?? "your Social Security", g ? `#/${g.go.join("/")}` : "#/retirement/social-security"); }
    // no retirement savings on file: calm and "not known yet", never "runs out"; it is not a gap that holds the plan unfinished
    if (a.verdict === "unknown") return { value: "Not known yet", line: a.line, status: "calm", figure: a.headline, fixHref: "#/balance/net-worth" };
    const g = !!st?.retireGuessed;
    const value = a.verdict === "on track" ? "The money lasts" : a.verdict === "tight" ? "It lasts, just" : `Runs out at ${a.shortAge}`;
    const short = a.verdict === "on track" ? "the money lasts" : a.verdict === "tight" ? "the money lasts, just" : `the money runs out at ${a.shortAge}`;
    // the page's sentence, without its "(Will the money last? shows how much less)" pointer: that is a page title, not plain words
    const base = String(a.line).replace(/\s*\([^()]*shows how much less\)/, "");
    const line = g ? `${base} Partly our guesses of your spending.` : base;
    return { value, line, status: g ? "calm" : a.verdict === "on track" ? "ok" : a.verdict === "tight" ? "warn" : "bad", short, guessed: g, mostlyGuessed: g, figure: a.headline };
  },
  "fix-retire"() {
    return { value: null, line: "A few changes would make it last, like working a little longer or spending a little less. See them.", status: "calm", figure: null };
  },
  "take-out"(S) {
    const f = S.first();
    if (!f) return open("your ages and savings", "#/household/people");
    if (f.fromSavings < 1) return { value: null, line: `This year, nothing needs to come out of savings: ${join(f.sources.length ? f.sources.map((x) => (x === "pension" ? "the pension" : x)) : ["your income"])} ${f.sources.length > 1 ? "cover" : "covers"} it.`, status: "calm", figure: f.fromSavings };
    const names = f.buckets.map((b) => b.accounts[0] ?? { cash: "your cash", taxable: "your savings", deferred: "your retirement accounts", free: "your tax-free accounts" }[b.bucket] ?? "your savings");
    const from = names.length > 1 ? `${names[0]}, then ${names.slice(1).map((n) => (/^your /.test(n) ? n : `the ${n}`)).join(", then ")}` : names[0] ?? "your savings";
    return { value: null, line: `This year, take about ${S.money(Math.round(f.fromSavings / 100) * 100)} from ${from}.`, status: "calm", figure: f.fromSavings };
  },
  rmd(S, plan, today) {
    const r = S.rmd();
    if (!r) return open("your ages and accounts", "#/household/people");
    if (r.due?.length) {
      const total = Math.round(r.total);
      const acct = r.due.length === 1 ? r.due[0].accounts[0]?.name : null;
      return { value: null, line: `The law says you must take out at least ${S.money(total)}${acct ? ` from the ${acct}` : ""} by ${monthDay(r.deadline)}.`, status: "warn", figure: r.total };
    }
    if (r.people?.length) return { value: null, line: "You've taken this year's required amount.", status: "ok", figure: 0 };
    const y = Math.min(...(plan?.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate).map((p) => rmdStartYear(p.birthDate)));
    return { value: null, line: Number.isFinite(y) ? `Required withdrawals start in ${y}.` : "Required withdrawals have not started.", status: "calm", figure: 0 };
  },
  goals(S, plan) {
    const gl = S.goals();
    if (!gl?.count) return { value: null, line: "No goals set yet.", status: "calm", figure: 0 };
    const gb = goalsBehind(gl, { nba: S.nba(), today: S.today });
    const words = goalsWords(gl, gb, S.money);
    return { value: null, line: `${gl.count} goal${gl.count === 1 ? "" : "s"}: ${words}.`, status: gb.behind.length || gb.pastDue.length ? "warn" : "ok", figure: gl.count };
  },
  home(S, plan) {
    const h = S.house();
    if (!h || h.maxPrice === null) return open("your pay", "#/cashflow/income");
    const price = S.money(Math.round(h.maxPrice / 1000) * 1000);
    const saved = !!plan?.whatIfs?.house;
    return saved
      ? { value: null, line: `You could afford a home of about ${price}.`, status: "ok", figure: h.maxPrice }
      : { value: null, line: `Your pay supports a home of up to about ${price}, at a typical rate and down payment.`, status: "calm", guessed: true, mostlyGuessed: true, figure: h.maxPrice };
  },
  college(S) {
    const c = S.college();
    const kids = (c?.children ?? []);
    if (!kids.length) return open("your children's birth dates", "#/household/people");
    const total = kids.reduce((t, k) => t + (k.total || 0), 0);
    const monthly = kids.filter((k) => k.neededMonthly > 0).reduce((t, k) => t + k.neededMonthly, 0);
    const who = kids.length === 1 ? (kids[0].name ? `${kids[0].name}'s` : "a child's") : `${kids.length} children's`;
    return { value: null, line: `Four years of ${who} college would cost about ${S.money(Math.round(total / 100) * 100)}${monthly > 0 ? `; about ${S.money(Math.round(monthly / 10) * 10)} a month would cover it` : ""}.`, status: "calm", figure: total };
  },
  taxes(S, plan) {
    const a = S.taxes();
    if (!a) return open("your pay", "#/cashflow/income");
    return { value: a.headline.length <= VALUE_MAX ? a.headline : null, line: a.headline.length <= VALUE_MAX ? a.line : `${a.headline}. ${a.line}`, status: a.status === "warn" ? "warn" : "ok", short: /^About right/.test(a.headline) ? "no big tax bill or refund" : /^Owe /.test(a.headline) ? `you ${lower(a.headline)}` : lower(a.headline), guessed: plan?.taxes?.thisYear?.withheldTyped !== true, figure: a.headline };
  },
};
function monthDay(iso) { const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(iso ?? "")); return m ? `${monthYear(`2000-${m[1]}`).split(" ")[0]} ${Number(m[2])}` : "the deadline"; }

/**
 * compute(plan, { today, off }) -> {
 *   head: { state: "empty" | "going" | "complete", step, total, doneCount, next, name, inShort, gaps, firstGap },
 *   groups: [{ title, rows: [{ key, label, value, line, short, status: ok | warn | bad | calm | open, guessed, href, figure, note }] }],
 *   moves: [{ title, detail, href }], guesses: [{ label, href }], guessCount, notCounted: [{ label, href }],
 *   assumptions: { inflation, returnStocks, returnBonds, planEndAge, emergencyMonths, looked },
 *   checkIn: { due: { month, name } | null, next: "YYYY-MM", nextName }, madeOn, someGuessed }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null, off = params.off ?? [];
  const ps = pathSummary(plan, { off, today });
  const order = resultOrder(plan, { off, today });
  const S = sources(plan, today, ps.parts.filter((x) => x.passed || x.done).map((x) => x.key));
  const rows = order.map((r) => {
    let b;
    try { b = ROW[r.key](S, plan, today); } catch { b = open("a few more answers", null); }
    // a row that rests mostly on guesses is never red or amber
    if (b.mostlyGuessed && (b.status === "warn" || b.status === "bad")) b = { ...b, status: "calm" };
    return { key: r.key, label: r.name, group: r.group, value: b.value ?? null, line: b.line, short: b.short ?? null, status: b.status, guessed: !!b.guessed, href: `#/${r.page}?from=plan`, figure: b.figure ?? null, note: b.note ?? null, needs: b.needs ?? null, fixHref: b.fixHref ?? null };
  });
  const groups = GROUP_TITLES.map((title, gi) => ({ title, rows: rows.filter((r) => r.group === gi) })).filter((g) => g.rows.length);
  // "In short": the worst answers first (red, then amber, then green), at most three, each in its own words
  const used = ["bad", "warn", "ok"].flatMap((s) => rows.filter((r) => r.status === s && r.short)).slice(0, 3);
  const shorts = used.map((r) => r.short);
  // a phrase that rests on a figure we filled in says so (the tax row is an estimate until the paycheck's tax is typed)
  const inShort = shorts.length ? `In short: ${join(shorts)}.${used.some((r) => r.guessed) ? " Some of this rests on our guesses." : ""}` : "";
  const gapRows = rows.filter((r) => r.status === "open");
  const self = (plan?.household?.people ?? []).find((p) => p.role === "self");
  const name = self?.name && self.name !== "Me" ? self.name : null;
  const state = ps.complete ? "complete" : ps.started ? "going" : "empty";
  const gapN = gapRows.length, ready = state === "complete" && gapN === 0;
  // the words of the head: "ready" and a check mark only when no answer is still missing
  const title = state === "empty" ? "Your plan" : state === "going" ? "Your plan so far" : gapN ? "Your plan is not finished yet" : name ? `Your plan is ready, ${name}` : "Your plan is ready";
  const lede = gapN ? `${gapN} answer${gapN === 1 ? " still needs" : "s still need"} something from you; ${gapN === 1 ? "it says" : "they say"} Not worked out yet.` : null;
  const moves = (() => { try { return (S.st()?.moves ?? []).slice(0, 3).map((m) => ({ title: m.title, detail: m.detail ?? null, href: m.href })); } catch { return []; } })();
  const gl = (() => { try { return guessList(plan, { today, st: S.st() }); } catch { return []; } })();
  const nc = (() => { try { return notCounted(plan, { today, st: S.st() }); } catch { return []; } })();
  const count = (() => { try { return guessesInUse(plan).length; } catch { return 0; } })();
  const a = plan?.assumptions ?? {};
  const due = (() => { try { return today ? checkInDue(plan, today) : null; } catch { return null; } })();
  const nextYm = today ? nextMonth(today.slice(0, 7)) : null;
  return {
    head: { state, ready, title, lede, step: ps.step, total: ps.total, doneCount: ps.doneCount, next: ps.next, name, inShort, gaps: gapN, firstGap: gapRows[0] ? { what: gapRows[0].needs, href: gapRows[0].fixHref } : null },
    groups, moves, guesses: gl, guessCount: count, notCounted: nc,
    assumptions: { inflation: a.inflation ?? 0.03, returnStocks: a.returnStocks ?? 0.07, returnBonds: a.returnBonds ?? 0.04, planEndAge: a.planEndAge ?? 95, emergencyMonths: a.emergencyMonths ?? 6, looked: !!a.reviewedAt },
    checkIn: { due, next: nextYm, nextName: nextYm ? monthLabel(nextYm).split(" ")[0] : null },
    madeOn: today, someGuessed: count > 0 || gl.length > 0,
  };
}
