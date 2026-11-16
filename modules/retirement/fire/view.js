// modules/retirement/fire/view.js -- DOM only. First the answer from the plan itself (the earliest age to stop work with
// the money lasting even in a bad run of years, Social Security and pensions counted, filled in after the first paint; then the age
// if markets do as well as average: compute's withIncome); then the 25-times rule as a quick
// check, folded: the number, how far along you are, the years to get there at the current pace, and the coast figure.
// With no answer from the plan (already retired, no birth date) the rule is the page, as before.
import { compute, carefulAgeSteps, ruleWords, plannedStopWords, otherEndWords } from "./compute.js";
import { whenWorked, keyOf, slot, RULE_WORDS, leftWords, chanceWords, BAD_RUN } from "../careful.js";
import { parts } from "../../../core/ui/more.js";
import { unknownHero } from "../needs.js";
import { unknownWords } from "../projection/compute.js";

/** The page's own question inside the "we can't say yet" sentence (projection unknownWords). */
export const UNKNOWN_WHAT = "when you could stop working";

/** The two quiet rows at the foot, pinned in qa/first-view-lib.mjs: the rule of thumb (its title fixed, the "25 times" in its
 * status) and the years at each saving rate (gap next-60 #53). */
export const RULE_TITLE = "A quick rule of thumb";
export const LADDER_TITLE = "Years to independence at each saving rate";
const yearsOf = (n) => `${n} year${n === 1 ? "" : "s"}`;

/**
 * ladderWords(l, { fiNumber }, money, pct) -> { key, sentence }: the one sentence over the rows, written out for each case (R5):
 * noPay, already, own (the person's rate and the next listed rate above it), ownTop (no listed rate above), ownNever (not within
 * 80 years at the person's rate; the first listed rate that gets there), ownNeverAll (no listed rate gets there), ownNone
 * (saving none of it now). `l` is compute's ladder; pct(x) -> "51%". A household where everyone has stopped work gets no
 * sentence and no rows (the page leaves the ladder out: n1 fix P1, "no pay to save from" sat under a "Saving a year" figure).
 */
export function ladderWords(l, { fiNumber }, money, pct) {
  const fi = `the ${money(fiNumber)} you need to live on for good`;
  if (l.why === "noPay") return { key: "noPay", sentence: "There is no pay in the plan, so there is no share of pay to save: add pay on the Income page to see the years at each saving rate." };
  if (l.why === "already") return { key: "already", sentence: `You already have ${fi}, so at any saving rate you are there now.` };
  const mine = l.rows.find((r) => r.own);
  const above = l.rows.filter((r) => !r.own && r.rate > (mine?.rate ?? -1) && r.years !== null);
  const next = above[0] ?? null;
  if (!mine || mine.rate < 0.005) {
    return next ? { key: "ownNone", sentence: `You save none of your take-home pay now; at ${pct(next.rate)}, savings would reach ${fi} in about ${yearsOf(next.years)}.` }
      : { key: "ownNone", sentence: `You save none of your take-home pay now, and even at 70% savings would not reach ${fi} within 80 years.` };
  }
  const at = `At the ${pct(mine.rate)} of your take-home pay you save now, savings`;
  if (mine.years === null) {
    return next ? { key: "ownNever", sentence: `${at} would not reach ${fi} within 80 years; at ${pct(next.rate)}, in about ${yearsOf(next.years)}.` }
      : { key: "ownNeverAll", sentence: `${at} would not reach ${fi} within 80 years, nor at any rate up to 70%.` };
  }
  return next ? { key: "own", sentence: `${at} reach ${fi} in about ${yearsOf(mine.years)}; at ${pct(next.rate)}, in about ${yearsOf(next.years)}.` }
    : { key: "ownTop", sentence: `${at} reach ${fi} in about ${yearsOf(mine.years)}.` };
}

/** The part's first line when the page leads with the answer from the plan (n1 fix P2: the years read as a rival to it while
 * the caveat sat under all the rows): before the sentence, so it is read first. */
export const LADDER_LEAD = "A quick estimate, not your plan's answer: like the rule of thumb, these years leave out Social Security, pensions and taxes, so go by the answer at the top of the page.";
/** rowValue(r) -> the figure at the right of a row: "18 years", "over 80 years", or "nothing going in" for the person's own row
 * when nothing goes in now (its years are null: no years from growth alone, M-6; n1 fix F1). */
export const rowValue = (r) => (r.years !== null ? yearsOf(r.years) : r.own && !(r.saving > 0.5) ? "nothing going in" : "over 80 years");

/** ladderHow(d, money, pct) -> the how text under the rows (small): the page's own figures, and what the rows leave the same. */
export function ladderHow(d, money, pct) {
  const l = d.ladder;
  return `How: each year what you have invested grows by ${pct(d.realReturn, 1)} above prices (your stock and bond assumptions blended), and that share of your ${money(l.takeHome)} a year of take-home pay goes in${l.match > 0.5 ? `, with the ${money(l.match)} your employer adds` : ""}, until the total reaches ${money(d.fiNumber)}: your spending of ${money(d.spendingYearly)} a year over the ${pct(d.withdrawalRate, 0)} you would take out each year${d.loansEnding ? ", plus the loans still owed" : ""}. Your spending is the same on every row; in life, saving more usually means spending less, which lowers the amount needed too, so the higher rows would come sooner and the lower ones later.`;
}

const STYLE = `
.fi-root .fi-note { margin-top: 10px; }
.fi-root .fi-rule { margin: 4px 0 12px; }
.fi-root .fold-body h3 { margin: 18px 0 4px; }
.fi-root .fold-body .progress { margin: 8px 0 12px; }
.fi-root .card > .fi-ladder { margin-top: 12px; }
`;

const sayName = (n) => (n === "Me" || !n ? "you" : String(n).replace(/^My (spouse|partner)$/, "your $1"));
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const listOf = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a.at(-1)}` : a[0] ?? "");

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d0 = compute(plan, { today: fmt.today(), ladder: true });
  // the saving the app counts everywhere else (Next best action's year saving, plus the employer's match) and its rate on take-home pay,
  // when a month can be read; else the rule's own figures (follow-up 2026-11-07)
  const sv = d0.ready ? d0.saving : null;
  // everyone already retired: no "years to get there" at a pace of saving there is none of (left2 fix round 1, M-6)
  const gone = !!d0.withIncome?.retired;
  const d = sv ? { ...d0, savingYearly: sv.yearly, savingsRate: sv.rate, yearsToFi: gone ? null : sv.yearsToFi, fiAge: gone ? null : sv.fiAge, fiYear: gone ? null : sv.fiYear } : d0;
  const money = (n) => fmt.money(Math.round(n), cur);
  const host = ui.h("div", { class: "fi-root" }, ui.h("style", {}, STYLE));
  root.append(host);
  if (!d.ready) {
    host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Financial independence"), ui.h("p", { class: "lede" }, "The savings that could pay your living costs without a paycheck, and how far you are from that amount. It needs what you spend:"), ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/cashflow/expenses" }, "Expenses"))));
    return;
  }
  const w = d.withIncome;
  const times = Math.round(1 / d.withdrawalRate);

  // the 25-times rule's own words (plain: no "withdrawal rate", "real growth" or "coast"), the page's hero when the plan gives
  // no answer, else inside the fold
  // (a loan payment in the spending that ends is not spending for good: left out of the target and said so; fix round 1, 2026-11-11)
  const loanNote = d.loansEnding ? ` That is your spending without the ${money(d.loansEnding.yearly)} a year of loan payments that end by ${d.loansEnding.untilYear}, plus the ${money(d.loansEnding.owed)} still owed on those loans.` : "";
  const ruleLede = `Spending ${money(d.spendingYearly)} a year needs about ${money(d.fiNumber)} to live on for good, taking out ${fmt.pct(d.withdrawalRate, 0)} a year.${loanNote} You have ${money(d.invested)} invested, not counting cash in the bank: ${fmt.pct(d.progress, 0)} of the way.${d.yearsToFi !== null && d.yearsToFi > 0 ? ` At ${money(d.savingYearly)} a year of saving and growth of ${fmt.pct(d.realReturn, 1)} a year above inflation, you get there around ${d.fiYear}${d.fiAge ? ` (age ${d.fiAge})` : ""}.` : ""}`;
  const statRow = () => ui.row(
    ui.stat("Enough to live on", money(d.fiNumber), d.loansEnding ? `${times} times yearly spending, plus the loans still owed` : `${times} times yearly spending`),
    ui.stat("Still to go", money(d.gap), "in today's dollars"),
    // a short month: what goes in out of pay, and the drop in checking said, never netted to $0 (M-6); a month that builds up:
    // why this counts checking and Will the money last? does not (L-6)
    ui.stat("Saving a year", money(d.savingYearly), sv ? (sv.short > 0
      ? `${sv.rate !== null ? `${fmt.pct(sv.rate, 0)} of take-home pay: ` : ""}what goes into retirement accounts out of pay${sv.match > 0.5 ? `, plus ${money(sv.match)} from your employer` : ""}. Meanwhile ${sv.goals > 0.5 ? "checking, savings and your goals together" : "checking and savings"} go down about ${money(Math.round(sv.short / 100) * 100)} a year`
      : `${sv.rate !== null ? `${fmt.pct(sv.rate, 0)} of take-home pay: ` : ""}what you save out of pay, what builds up in checking and savings, and extra on debts${sv.match > 0.5 ? `, plus ${money(sv.match)} from your employer` : ""}${sv.cash >= 50 ? `. This quick rule counts what builds up in checking as if you invest it; Will the money last? counts only what goes into your accounts` : ""}`) : (d.savingsRate !== null ? `${fmt.pct(d.savingsRate, 0)} of income: what goes into retirement accounts plus what is left over` : "what goes into retirement accounts plus what is left over")),
    d.coast ? ui.stat("Enough to stop saving", money(d.coast.number), d.coast.reached ? `you have it: with no more saving, growth alone gets there by ${d.retireAge}` : `with this much today, growth alone gets there by ${d.retireAge}`) : null,
  );
  const moveList = () => ui.h("ul", { class: "records" }, [
      ["Spend less", `Every dollar a year you no longer need cuts the amount you need by $${times}. That works on both ends: less to save for, and more saved.`],
      ["Save more", `How much of your pay you save matters far more than returns. Starting from nothing, at ${fmt.pct(d.realReturn, 1)} growth above inflation and taking out ${fmt.pct(d.withdrawalRate, 1)} a year: saving half of income takes about ${d.fromZero.half ?? "over 100"} years; saving a tenth, ${d.fromZero.tenth ? `about ${d.fromZero.tenth}` : "over 100"}.`],
      ["Stop saving early", "Once you have the amount under Enough to stop saving, you could stop putting money in and growth alone would get there by your retirement age; your pay only has to cover today."],
      ["Growth", `It uses ${fmt.pct(d.realReturn, 1)} a year above inflation (your stock and bond assumptions blended). Real years are far more uneven.`],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s))));
  const ruleHead = d.progress >= 1 ? "You are financially independent" : d.yearsToFi !== null ? `Financially independent in about ${d.yearsToFi} year${d.yearsToFi === 1 ? "" : "s"}` : "Financial independence";
  const progress = ui.h("div", { class: "progress" }, ui.h("span", { style: { width: `${Math.round(d.progress * 100)}%` } }));

  // "Years to independence at each saving rate" (gap next-60 #53): one quiet row; its rows the page's own engine at each rate.
  // With no rows to show (no pay, everyone retired, there already) the one sentence is said where the rule's figures are
  // instead (a part of one sentence is not worth a tap: docs/OPTIONAL.md R14)
  const l = d0.ladder;
  const pct0 = (x) => fmt.pct(x, 0);
  // everyone stopped work: no ladder at all (no pay to save from, while "Saving a year" counts what pensions and Social Security
  // leave over: n1 fix P1)
  const ladderSaid = l && !gone ? ladderWords(l, { fiNumber: d.fiNumber }, money, pct0) : null;
  const shown = !!ladderSaid && !l.why;
  const ladderLine = () => (ladderSaid && !shown ? ui.h("p", { class: "fi-ladder" }, ladderSaid.sentence) : null);
  const ladderPart = () => {
    if (!shown) return null;
    const rowOf = (r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${pct0(r.rate)} of take-home pay${r.own ? " (what you save now)" : ""}`), ui.h("span", { class: "rec-value" }, rowValue(r))),
      ui.h("div", { class: "rec-sub" }, `${money(Math.round(r.saving / 100) * 100)} a year${r.years !== null && r.age !== null ? `: there at age ${r.age}, in ${r.year}` : r.years !== null ? `: there in ${r.year}` : ""}`));
    return { id: "rates", kind: "more", title: LADDER_TITLE, body: () => [
      w ? ui.h("p", {}, LADDER_LEAD) : null,
      ui.h("p", {}, ladderSaid.sentence),
      ui.h("ul", { class: "records" }, l.rows.map(rowOf)),
      ui.h("p", { class: "muted small" }, ladderHow(d0, money, (x, n) => fmt.pct(x, n))),
    ] };
  };

  if (!w) {
    host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, ruleHead), ui.h("p", { class: "lede" }, ruleLede), progress), ui.card(null, statRow()), ui.card("What moves it", moveList(), ladderLine()));
    host.append(ui.h("div", {}, parts(ctx, ladderPart())));
    return;
  }

  // the rule of thumb, folded and said as a comparison (shown at the same weight, or with its own headline, it reads as a
  // rival answer): why it differs, in one line, then its figures. A quiet row of the helper's (core/ui/more.js; it was a
  // hand-written fold titled "The 25-times rule, a quick check · for comparison": the title is fixed now and the "25 times" is
  // its status), then the years at each saving rate
  const rulePart = { id: "rule", kind: "more", title: RULE_TITLE, says: `${times} times spending`, body: () => [
    ui.h("p", { class: "fi-rule" }, ruleWords(times, d.healthAdded)),
    ui.h("p", {}, `${d.progress >= 1 ? "By this rule you have enough already. " : d.yearsToFi !== null ? `By this rule: about ${d.yearsToFi} year${d.yearsToFi === 1 ? "" : "s"}. ` : ""}${ruleLede}`), progress, statRow(), ui.h("h3", {}, "What moves it"), moveList(),
    ladderLine(),
  ] };
  // nothing saved for retirement and nothing going in: the same "we can't say yet" as Will the money last? (whole-app sweep x3,
  // 2026-11-16: "Even working to 75, the money runs short" beside its "We don't know yet"); the 25-times rule stays one quiet row
  if (d.unknown && !w.retired) {
    host.append(unknownHero(ui, unknownWords(d.unknown, UNKNOWN_WHAT), { title: "Financial independence" }));
    host.append(ui.h("div", {}, parts(ctx, rulePart, ladderPart())));
    return;
  }

  // the answer from the plan: the earliest age to stop with the money lasting to the end, Social Security counted. Two ages:
  // the one at which it lasts even in a bad run of years (worked out after the page is drawn: careful.js) leads; the one at which it
  // lasts if markets do exactly as well as average every year (goal seek's) follows, named as such (round 5 review: 58 read
  // as safe, and lasts in only 4 of 10 markets)
  const who = sayName(w.name), Who = cap(who), age = w.earliestAge, planned = w.plannedAge;
  const round100 = (n) => money(Math.round((n ?? 0) / 100) * 100);
  const yrs = (n) => `${n} year${n === 1 ? "" : "s"}`;
  // someone under their retirement age with no pay who did not say "retired" is "not working", never "already retired" (a
  // parent at home; recheck 2026-11-05, second pass)
  // reaching the planned age this year while still on pay: "stopping this year, as planned" (seventh pass; it read "already retired")
  const others = (w.others ?? []).map((o) => (o.notWorking ? `${sayName(o.name)} not working` : o.stoppingNow ? `${sayName(o.name)} stopping this year, as planned` : o.retired ? `${sayName(o.name)} already retired` : `${sayName(o.name)} stopping at ${o.retireAge} as planned`));
  // named in one fixed order (pensions, rent, dividends, other income), whatever order the plan lists them in
  const KINDS = { pension: "pensions", rent: "rent", dividends: "dividends", other: "other income" };
  const kinds = Object.keys(KINDS).filter((k) => (w.otherKinds?.length ? w.otherKinds : ["pension"]).includes(k));
  // what of it stops, and when (review 2026-11-06: "plus $14,400 a year of other income" for child support that ends in 2034)
  const ends = w.otherYearly > 0 ? w.otherEnding : null;
  // each step when parts stop in different years (seventh pass): "until 2030, then $14,400 until 2034"
  const endWords = otherEndWords(ends, w.otherYearly, money);
  const otherWords = w.otherYearly > 0 ? `${money(w.otherYearly)} a year of ${listOf((kinds.length ? kinds : ["other"]).map((k) => KINDS[k]))}${endWords}` : "";
  // Social Security already being paid says so (review: "from 2020" for someone who claimed in 2020; recheck 2026-11-05: and
  // for Social Security typed on the Income page, which starts this year in the plan)
  const ssWhen = !w.ssFrom ? "" : w.ssPaidNow ? `already being paid${w.ssFullFrom > w.startYear ? ` (both benefits from ${w.ssFullFrom})` : ""}` : `from ${w.ssFrom}${w.ssFullFrom && w.ssFullFrom !== w.ssFrom ? ` (both benefits from ${w.ssFullFrom})` : ""}`;
  // more than all the spending is "more than", never a share capped at 100%
  const ssOf = !w.ssShare ? "" : w.ssShare >= 1 ? `, more than the ${money(w.spendingYearly)} a year you plan to spend` : `, ${fmt.pct(w.ssShare, 0)} of the ${money(w.spendingYearly)} a year you plan to spend`;
  const income = w.ssFrom
    ? `It counts Social Security ${ssWhen}: about ${round100(w.ssYearly)} a year in today's dollars${ssOf}${otherWords ? `, plus ${otherWords}` : ""}.`
    : w.ssNone ? `No Social Security is counted: you said you won't get it.${otherWords ? ` It counts ${otherWords}.` : ""}`
    : otherWords ? `It counts ${otherWords}; no Social Security is in the plan yet.` : "No Social Security is in the plan yet, so this counts only your savings.";
  const how = `Worked out year by year from your plan: what you have and keep putting in, returns after inflation, taxes${w.ssFrom ? ", Social Security" : ""} and your spending once retired.`;
  const alongside = others.length ? `, with ${listOf(others)}` : "";
  const leaves = w.legacy > 0 ? ` and leaves the ${money(w.legacy)} you want to leave` : "";
  const works = (a) => `${who} work${who === "you" ? "" : "s"} until ${a}`;
  const hh = who === "you" ? "You" : others.length ? "The household" : Who;
  const savedWords = (amount, year, before = "") => [`${before}${before && (hh === "You" || hh === "The household") ? hh.toLowerCase() : hh} would have about `, amount, " at retirement in ", year, ", in today's dollars, savings and investments together."];
  // the average-market age, as the second sentence (no "little to spare" when stopping now: it would have lasted sooner too)
  const avgWords = () => `If the next years are about average, ${w.now ? "you could stop now" : `stopping at ${age} would do`}${age > (w.ageNow ?? -1) ? ", with little to spare" : ""}.`;
  const hero = ui.h("section", { class: "card accent hero" });
  let head, lede, saved = null, pending = false;
  if (w.retired) {
    head = w.lasts ? "The money lasts" : `The money runs short${w.failYear ? ` in ${w.failYear}` : ""}`;
    // named by what the plan counts (recheck 2026-11-05: "with Social Security and any pensions" left out the rent it counted)
    const withWhat = listOf([w.ssFrom ? "Social Security" : null, ...(w.otherYearly > 0 ? kinds.map((k) => KINDS[k]) : [])].filter(Boolean));
    lede = w.lasts ? `You have stopped work, and what you have${withWhat ? `, with ${withWhat},` : ""} lasts to the end of the plan${leaves}.` : `You have stopped work, and at the spending you plan the money runs out${w.failYear ? ` in ${w.failYear}` : ""}.${w.plannedStop ? "" : " Will the money last? shows what would fix it."}`;
  } else if (age === null) {
    head = `Even working to ${w.upTo ?? 75}, the money runs short`;
    lede = `The money does not last to the end of the plan${w.legacy > 0 ? ` and leave the ${money(w.legacy)} you want to leave` : ""}, even if the next years are about average and ${works(w.upTo ?? 75)}${alongside}. Will the money last? shows when it runs short and what would fix it.`;
  } else {
    pending = true;
    // no verdict before it is known (stress test 2026-11-11, HC-2, R-A1, W5): "Ana could stop work at [bar]" turned into "Ana would
    // need to work until 67"; the heading now says what is being worked out, two lines tall, and the answer replaces it once
    head = `Working out when ${who} could stop work...`;
    // room kept for the longest usual answer, "(2 years past the 65 planned)" included: the answer came in a line longer and moved
    // the buttons down 25 px half a second after the page opened (review round 1 N3); the line holds this height once filled
    lede = [`Stopping at `, slot(ui, String(age)), " ", slot(ui, "(2 years past the 65 planned)"), `, the money lasts ${BAD_RUN}${leaves}${alongside}. ${avgWords()}`];
    saved = savedWords(slot(ui, round100(w.atAgeReal)), slot(ui, String(w.stopYear)));
  }
  const h1 = ui.h("h1", pending ? { "aria-busy": "true", style: { minHeight: "2.5em", color: "var(--muted)" } } : {}, head);
  const ledeEl = ui.h("p", { class: "lede", "aria-live": "polite", style: pending ? { color: "var(--muted)" } : {} }, lede);
  const savedEl = saved ? ui.h("p", { style: { color: "var(--muted)" } }, ...saved) : null;
  // the first adult counted as stopped now while the plan still has a later age (review 2026-11-06: this page read "The money
  // runs short in 2052" and Will the money last?, spending savings only from 2031, "It lasts, just")
  // (verify 2026-11-06: one who said "Not working now", a parent at home, read "stopped" and "If Elena has stopped, set Elena's
  // retirement age to 35"; now "not working" and "if Elena does not go back to work")
  const ps = w.plannedStop, psWords = plannedStopWords(ps, sayName);
  const psEl = ps ? ui.h("p", { class: "small" }, psWords, ui.h("a", { href: "#/household/people" }, "People page"), ".") : null;
  // fill in the 9-in-10 age: the same paths and seed as Will the money last?'s careful figure (fire/compute.js carefulAgeSteps)
  // the line keeps the placeholder's exact height (offsetHeight rounds), so a shorter answer leaves at most a line's gap and
  // nothing below moves (review round 1 N3: the answer was a line longer than the placeholder and pushed the buttons 25 px)
  const fill = (c) => {
    // the heading too: at 320 px "Working out when Ana could stop work..." takes three lines, the answer two (breaker on N3)
    if (pending) for (const el of [h1, ledeEl]) el.style.minHeight = `${el.getBoundingClientRect?.().height ?? 0}px`;
    ledeEl.style.color = ""; if (savedEl) savedEl.style.color = "";
    h1.removeAttribute("aria-busy"); h1.style.color = "";   // the held two lines stay: nothing below moves when a one-line answer arrives
    if (!c) {
      // it could not be worked out: the average-market age, said plainly
      h1.replaceChildren(age > planned ? `${Who} would need to work until ${age}` : w.now ? `${Who} could stop work now` : `${Who} could stop work at ${age}`);
      ledeEl.replaceChildren(`If the next years are about average, the money lasts to the end of the plan${leaves}${alongside}, with little to spare; in a bad run of years it would not. Will the money last? shows the margin.`);
      savedEl?.replaceChildren(...savedWords(round100(w.atAgeReal), String(w.stopYear)));
      return;
    }
    if (c.age === null) {
      h1.replaceChildren(`Even working to ${c.upTo}, the money may run short`);
      // the shared words (odds.js) with the number; the average-market age at the last age is "only just", not "75 would do"
      ledeEl.replaceChildren(`Working to ${c.upTo}${alongside ? `${alongside},` : ","} the money lasts ${chanceWords(c.share)}, which does not cover a bad run of years. ${age === c.upTo ? "If the next years are average, it only just lasts." : avgWords()} Will the money last? shows what would help.`);
      savedEl?.replaceChildren(...savedWords(round100(w.atAgeReal), String(w.stopYear), `Stopping at ${age}, `));
      return;
    }
    const sooner = (w.plannedStopYear ?? c.stopYear) - c.stopYear;
    h1.replaceChildren(sooner > 0 ? (c.atNow ? `${Who} could stop work now` : `${Who} could stop work at ${c.age}`)
      : sooner === 0 ? (c.atNow ? `${Who} could stop work this year, as planned` : `${Who} could stop work at ${planned}, as planned`)
      : `${Who} would need to work until ${c.age}`);
    ledeEl.replaceChildren(`${c.atNow ? (sooner === 0 ? "Stopping this year" : "Stopping now") : `Stopping at ${c.age}`}${sooner < 0 ? ` (${yrs(-sooner)} past the ${planned} planned)` : ""}, the money lasts ${BAD_RUN}${leaves}${alongside}.${c.age !== age ? ` ${avgWords()}` : ""}`);
    savedEl?.replaceChildren(...savedWords(round100(c.atAgeReal), String(c.stopYear)));
  };
  if (pending) whenWorked(ctx, ledeEl, {
    // the same plan worked out before on this visit: the age at once (careful.js)
    key: keyOf(["fire", fmt.today(), ctx.store.get(), w.legacy, w.personId, age, w.upTo, w.stopNow]),
    remote: ["retirement/fire", { today: fmt.today(), careful: true }],
    pick: (out) => out?.withIncome?.careful ?? null,
    steps: () => carefulAgeSteps(ctx.store.get(), { today: fmt.today(), legacy: w.legacy, personId: w.personId, from: age, upTo: w.upTo, stopNow: w.stopNow }),
  }, fill);
  const needSs = !w.ssFrom && !w.ssNone;
  hero.append(...[
    h1,
    ledeEl,
    savedEl,
    psEl,
    // what is not counted after work stops and how to keep it, then the spending rule both ages use when the plan has another
    // (recheck 2026-11-05)
    ui.h("p", { class: "muted small" }, `${income} ${how}`, ...(w.left?.length ? [" ", ...leftWords(ui, money, w.left)] : []),
      ...(!w.retired && w.strategy && w.strategy !== "fixed-real" ? [` Both ages spend the same every year; your plan uses another rule, ${RULE_WORDS[w.strategy] ?? "its own"}, so what you spend moves with markets (`, ui.h("a", { href: "#/retirement/withdrawal-strategy" }, "How much to take out"), ")."] : [])),
    ui.row(
      needSs ? ui.h("a", { class: "btn", href: "#/retirement/social-security" }, "Add Social Security") : ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Will the money last?"),
      needSs ? ui.h("a", { class: "btn secondary", href: "#/retirement/projection" }, "Will the money last?") : ui.h("a", { class: "btn secondary", href: "#/scenarios/goal-seek" }, "What would change it"),
    ),
    needSs ? ui.h("p", { class: "fi-note small muted" }, "Social Security usually pays a large share of retirement spending, so the age above may well come down once it is in.") : null,
  ].filter(Boolean));
  host.append(hero);

  host.append(ui.h("div", {}, parts(ctx, rulePart, ladderPart())));
}
