// modules/retirement/projection/view.js -- DOM only. The verdict, the money over time, what the
// plan assumes, and the settings that every retirement page shares (folded, saved with a green line).
import { compute, savingsUnknown, healthAdded, healthSummary, incomeWords, onJobWords, spouseWords, saveSpendingFigure, spendingLoanWords, middleWords } from "./compute.js";
import { twoDates } from "../../debt/payoff/compute.js";
import { STRATEGIES } from "../../../core/math/retirement.js";
import { lineChart } from "../charts.js";
import { ssNotice } from "../ss-notice.js";
import { afterPaint, whenCareful, whenWorked, carefulKey, knownAnswer, keyOf, slot as barOf, monthlyOf, CAREFUL_CHANCE, busyWords, leftWords, leftWhy, chanceWords, BAD_RUN, BAD_RUN_NOTE } from "../careful.js";
import { leverList, leverSteps, restsOnWords, valuesOf, changedKeys, changedWords, answerWords, outcomeOf, TAGS, answerOf, answerChangeWords, applyLeftover, lowerLeftover, leftoverAnswer, leftoverAccounts } from "../levers.js";
import { isYou, nameIn, NameIn, nameOf, verbFor } from "../../../core/words.js";
import { hopefulReturn } from "../../system/assumptions/compute.js";
import { isNowAccount } from "../contributions/compute.js";
import { perYear } from "../../../core/math/periods.js";
// the ways How much to take out offers (round 8 review UX 7: this list set the ways that page holds back, with no reason given),
// by the names that page gives them (batch 5b UX review 8)
import { wayOptions, wayOptionsFor, DESCRIPTIONS } from "../withdrawal-strategy/compute.js";

/** "a, b and c" */
const listOf = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

let pending = null;
let healthPending = null;
// "What this rests on" (owner's request 2026-11-11, spec part A): the answer and the numbers last drawn on this visit, so coming
// back after a change elsewhere says "Before your change: ... Now: ..." (D-A6; a module-level memory as careful.js keeps)
let lastDrawn = null;
// the route the page was last drawn for: a new arrival (a link, Back) is told what changed in the card too; a redraw after a save
// on this page keeps the same route object (review 2026-11-12, F3)
let drawnFor = null;
// a tap that scrolls the page (the hero's "Check the numbers behind this ↓") puts other links under the still finger: taps on the
// page are let go for a moment after it (review 2026-11-12, B4)
let tapsHeldUntil = 0;
const TAP_HOLD_MS = 1000, TAP_HOLD_AFTER_SCROLL_MS = 400;
// the settings fold's save: the answer before it, so its notice can say what the save did to it (review 2026-11-12, P7)
let settingsBefore = null;
// the money left over, answered on the card (spec L4): what was saved and the answer before it, said on the next drawing
let leftPending = null;
// Next best action's month (`spare`, the money left over each month), worked out once per plan as it stands: it is a whole
// ladder of steps (about 80 ms on a PC), and a redraw that changed nothing else needs none of it again
const spareMemo = new Map();
function spareOf(ctx, plan, today) {
  let key = null;
  try { const { meta, ...rest } = plan; key = keyOf([today, rest]); } catch { key = null; }
  if (key !== null && spareMemo.has(key)) return spareMemo.get(key);
  let nba = null;
  try { nba = ctx.computeOf?.("overview/next-best-action", { today }) ?? null; } catch { nba = null; }
  const spare = nba?.ready ? nba.spare ?? null : null;
  if (key !== null) { spareMemo.clear(); spareMemo.set(key, spare); }
  return spare;
}   // the health toggle's confirmation, shown on the next render (the shell re-renders after store.update)

// "taxable, then pre-tax, then Roth" read as jargon in a list a person scrolls (money review UX 6): the same order in plain words
const orderWords = (label) => String(label).replace(/Taxable/g, "regular savings").replace(/\btaxable\b/g, "regular savings").replace(/Pre-tax/g, "retirement accounts you pay tax on later").replace(/\bpre-tax\b/g, "retirement accounts you pay tax on later").replace(/Roth/g, "Roth accounts (tax already paid)").replace(/^./, (c) => c.toLowerCase());
/**
 * The "Retirement money today" row without the empty parts: "$3,700, all of it cash" (never "$3,700: $3,700 cash, $0 taxable, ..."),
 * "none yet", and, when nothing is saved for retirement and only cash is counted, said so ("No retirement savings on file").
 */
export function moneyToday(b, noSavings, money) {
  const parts = [[b.cash, "in cash"], [b.taxable, "in regular savings"], [b.deferred, "in retirement accounts you pay tax on later"], [b.free, "you already paid tax on"]].filter(([v]) => v > 0.5);
  const total = b.cash + b.taxable + b.deferred + b.free;
  if (!parts.length) return "none on file yet";
  if (noSavings && parts.length === 1 && b.cash > 0.5) return `no retirement savings on file; ${money(b.cash)} in cash is counted`;
  if (parts.length === 1) return `${money(total)}, all of it ${parts[0][1]}`;
  return `${money(total)}: ${parts.map(([v, w]) => `${money(v)} ${w}`).join(", ")}`;
}

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), showHealth: true });   // showHealth: with the box ticked, still say what cover would cost
  // no Social Security in the plan: say so first (ss-notice.js); not while the page still needs its basics, where its filled button
  // stood above the one thing to do first (stress test 2026-11-11, x-5: four filled buttons on the first screen)
  if (d.ready) { const ss = ssNotice(ctx); if (ss) root.append(ss); }
  const rt = plan.retirement ?? {};
  root.append(ui.h("style", {}, ".pj-link { display: inline; padding: 14px 0; margin: -14px 0; }"));
  const money = (n) => fmt.money(n, cur);
  // taps let go just after one that scrolled the page (B4): the second of a double tap lands on whatever slid under the finger
  // (the press too: it would move the focus to the link under the finger)
  // (only a tap at the place of the one that scrolled: a tap elsewhere on the card is the person's next step and goes through, N7)
  for (const type of ["click", "pointerdown", "mousedown"]) root.addEventListener?.(type, (e) => { if (nowMs() < tapsHeldUntil && nearHeld(e)) { e.preventDefault(); e.stopPropagation(); } }, true);

  if (!d.ready) {
    // one button for each thing still missing, the first one filled; what is done has none (stress test 2026-11-11, x-3: "People"
    // stayed the filled button after People was done, while the one thing missing was a box further down)
    const settings = settingsCard(ctx, d);
    const typeSpending = () => typeInto(settings);
    const steps = d.missing.map((m) => {
      const t = String(m);
      if (/People page/.test(t)) return { words: t.replace("a person with a birth date on the People page", "who is in the household, with birth dates (People page)"), act: ui.h("a", { href: "#/household/people" }, /^a person/.test(t) ? "Add people ›" : "Check People ›") };
      if (/Net worth page/.test(t)) return { words: "what you own: your savings and retirement accounts", act: ui.h("a", { href: "#/balance/net-worth" }, "Add what you own ›") };
      if (/spend in retirement/.test(t)) return { words: "what you will spend in retirement: type it under Retirement settings below, or list today's bills on the Expenses page", act: ui.h("button", { type: "button", onClick: typeSpending }, "Type what you'll spend ↓") };
      return { words: t, act: null };
    });
    const acts = steps.map((x) => x.act).filter(Boolean);
    acts.forEach((a, i) => { a.className = i ? "btn secondary" : "btn"; });
    if (steps.some((x) => /spend in retirement/.test(x.words))) acts.push(ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Expenses ›"));
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Will the money last?"),
      ui.h("p", { class: "lede" }, `This page runs your plan year by year to the end: what you have, what you add, what Social Security and pensions bring in, what you spend, and what is left each year. It needs ${steps.length === 1 ? "this" : "these"} first:`),
      ui.h("ul", {}, steps.map((x) => ui.h("li", {}, x.words))),
      ui.row(...acts),
    ));
    root.append(settings);
    openAsked(ctx, settings);
    return;
  }
  // "(Contributions page)" and the like are links to that page, not plain text to go and find
  const PAGES = { "What you save for retirement": "#/retirement/contributions", "Social Security page": "#/retirement/social-security", "Assumptions": "#/system/assumptions", "Taxes pages": "#/taxes/federal" };
  // (the links are 44 px tall: inline links on a phone are hard to hit)
  const linked = (text) => String(text).split(/\((What you save for retirement|Social Security page|Assumptions|Taxes pages)\)/).map((part, i) => i % 2 ? (/page/.test(part) ? ["(", ui.h("a", { href: PAGES[part], class: "pj-link" }, part), ")"] : ["(on the ", ui.h("a", { href: PAGES[part], class: "pj-link" }, part), " page)"]) : part);
  // the line below is markets doing exactly as well as average every year; the careful figure (even in a bad run of years, from the
  // Monte Carlo page's engine) fills in under it once worked out (round 5, 2026-11-02: the average figure lasts in only
  // about 4 of 10 markets, and every page called it the most you could spend)
  // health cover (marketplace to 65, then Medicare) is added on top of the spending figure unless it already includes it (2026-11-02)
  const healthOn = healthAdded(d.health);
  const onTop = healthOn ? " on top of health insurance" : "";
  // what the plan spends in its first retirement year: with a way that sets its own withdrawal that is the way's figure, not the
  // one in the settings, and "Paid by income" below is against it (round 8, Batch 5b: "you plan on $36,000" sat beside "Paid by
  // income 299%" of the $16,880 the way then planned)
  const r0 = d.rows.find((r) => r.year === d.atRetirement?.year) ?? null;
  // a way that moves with markets is said as itself (batch 5b UX review 5: "The money lasts", "On track" and "you plan on $72,380"
  // beside "$0 left" and more than the plan can carry): what it spends a month the first year, how low it goes, and a way that
  // spends savings down says so
  const moving = d.strategy !== "fixed-real" && !!r0;
  const retiredRows = d.rows.filter((r) => r.retired);
  const lowest = retiredRows.length ? Math.min(...retiredRows.map((r) => r.spendingReal)) : 0;
  const thisYear = Number(String(fmt.today()).slice(0, 4));
  const movingText = moving ? `About ${money(r0.spendingReal / 12)} a month ${r0.year === thisYear ? "this year" : `in ${r0.year}`}, about ${money(lowest / 12)} at the lowest if markets do as well as average.` : null;
  const spentDown = moving && d.strategy === "vpw" && d.result.success && d.atEnd.totalReal < 1 ? `Savings are spent down to $0 by ${d.atEnd.year} on purpose.` : null;
  const planOn = `you plan to spend ${money(d.spendingYearly)}`;
  const verdictText = moving && d.verdict !== "short" ? movingText : { "on track": `If markets do as well as average, it can pay for ${money(d.affordable)} a year${onTop}; ${planOn}.`, tight: `If markets do as well as average, it can pay for about ${money(d.affordable)} a year${onTop}; ${planOn}.`, short: `Short. If markets do as well as average, ${moving ? `this way runs out` : `${money(d.spendingYearly)} a year${onTop} runs out`} in ${d.shortYear} (age ${d.shortAge}), ${d.affordable >= 1 ? `and the most the plan can pay for is about ${money(d.affordable)} a year` : "and even spending nothing it would not last to the end"}.` }[d.verdict];
  // the careful line, drawn first with grey bars where its figures go (the same words, so the same height: nothing jumps when
  // they arrive), then filled in after the first paint (careful.js: on the PC, or here a slice at a time)
  const steady = d.strategy === "fixed-real";
  // under 9 in 10 at the planned spending: said here, in amber, next to the figure (one verdict word on every page: the headline
  // above stays the average-market verdict that the Dashboard, Quick answers, Timeline and Goal seek also show; review 2026-11-05)
  const fewer = (share) => (share !== null && share < CAREFUL_CHANCE ? ui.h("span", { class: "pill warn" }, "short in a bad run") : null);
  // the chance in the words How much to take out uses (UX review 7); the page it comes from is a button below, not a link (UX 17)
  // two short paragraphs, not one of five lines on a phone: what lasts even in a bad run of years, then how often the plan's own
  // figure does (path part 3: "Even in a bad run of years (only 1 in 10 is worse)" on this first screen; odds.js says it everywhere)
  const careWords = (y, mo) => steady
    ? [`Even in a bad run of years ${BAD_RUN_NOTE}, the money can pay for about `, y, " a year ", ui.h("span", { style: { whiteSpace: "nowrap" } }, "(", mo), ` a month)${onTop}.`]
    : ["Spent the same every year instead, about ", mo, ` a month${onTop} would last ${BAD_RUN} ${BAD_RUN_NOTE}.`];
  // the amber pill follows the full stop with a space ("lasts 7 in 10. short in a bad run"), never ".short in a bad run"
  const shareWords = (share, shareN = null) => { const f = fewer(shareN); return [`At the ${money(d.spendingYearly)} you plan, it lasts `, share, ".", f ? " " : null, f]; };
  // a soft grey bar as wide as the figure that will take its place (the average figure's own length), so the lines break the same
  // (careful.js's own bar, never wider than its line: stress test 2026-11-11, x-3 and A9)
  const slot = (like) => barOf(ui, like);
  // a line's exact drawn height (offsetHeight rounds 67.9 up to 68, a 1 px move); 0 where there is no layout (tests)
  const heightOf = (el) => el.getBoundingClientRect?.().height ?? 0;
  // nothing lasts to the end even at $0 (affordable 0): no careful search, no placeholder; the average figure, named as such
  const noCare = !(d.affordable >= 1);
  const careLine = noCare ? null : ui.h("p", { "aria-live": "polite", "aria-busy": "true", style: { color: "var(--muted)" } }, busyWords(ui, "Working out the spending that lasts even in a bad run of years. "), ...careWords(slot(money(d.affordable)), slot(money(d.affordable / 12))));
  // the placeholder keeps room for the amber pill too, and the line holds its height when filled: the pill used to arrive half a
  // second later on a line of its own and push the buttons below down 22 px (review round 1 N3)
  const careLine2 = noCare || !steady ? null : ui.h("p", { style: { color: "var(--muted)" } }, ...shareWords(slot("in most pretend futures (93 of 100)")), " ", ui.h("span", { class: "pill warn", "aria-hidden": "true", style: { visibility: "hidden" } }, "short in a bad run"));
  const careSub = `a year${onTop}, today's dollars; ${money(d.affordable)} if markets do as well as average`;
  const careStat = ui.h("div", { style: { display: "contents" } }, noCare ? ui.stat("Spending it can pay for", money(d.affordable), `a year${onTop}, today's dollars, if markets do as well as average`) : ui.stat("Spending that lasts, even in a bad run of years", "...", careSub));
  // nothing saved for retirement is on file and the income alone does not carry the spending: the page cannot say the money
  // runs out, only that it does not know yet (review UX 3: a 26-year-old who never mentioned savings read "Runs out in 2065")
  const unknownYet = savingsUnknown(d);
  const averageHead = unknownYet ? "We don't know yet" : d.verdict === "short" ? `Runs out in ${d.shortYear}` : moving ? "Your spending moves with markets" : d.verdict === "on track" ? "The money lasts" : "It lasts, just";
  // the headline the bad-run answer can still change (steady spending that lasts if markets are average): under 6 in 10 it says
  // so in the same words (UX review 7: "It lasts, just" over 47%); between 6 and 9 in 10 "The money lasts" over a line saying it
  // fails in a third of them contradicted itself (money review UX 1): "just" is for 9 in 10 or more
  const canTurn = !noCare && !unknownYet && steady && d.verdict !== "short";
  const finalHead = (c) => (!canTurn || !c || !(c.yearly > 0) || !Number.isFinite(c.planned) ? averageHead
    : c.planned < 0.6 ? `Lasts ${chanceWords(c.planned, { exact: false })}` : c.planned < 0.9 ? "It lasts in most cases, not all" : averageHead);
  // a verdict is never shown before it is known (stress test 2026-11-11, HC-2, R-A1, W5): "The money lasts" stood for one to three
  // seconds and then turned into "It lasts in most cases, not all". Until the bad-run answer is in, the headline says it is being
  // checked, two lines tall (the longest verdict's height); an answer already worked out for this plan is used at once
  const known = canTurn ? knownAnswer(carefulKey(ctx)) : null;
  const waiting = canTurn && known === undefined;
  const headline = waiting
    ? ui.h("h1", { "aria-busy": "true", style: { minHeight: "2.5em", color: "var(--muted)" } }, "Checking your plan against bad years...")
    : ui.h("h1", {}, canTurn ? finalHead(known) : averageHead);
  // what waits for the headline's own words while they are being checked (the "Before your change" line, review 2026-11-12, F5)
  const onHead = [];
  if (!noCare) whenCareful(ctx, careLine, (c) => {
    if (waiting) { headline.style.minHeight = `${heightOf(headline)}px`; headline.textContent = finalHead(c); headline.removeAttribute("aria-busy"); headline.style.color = ""; for (const f of onHead) f(finalHead(c)); }   // the two lines stay held: a one-line verdict must not pull the page up 32 px (review of this change)
    // nothing worked out, or nothing lasts even in a bad run of years, even at $0: no careful line, the average figure named as such
    // the lines stay, in words, at the placeholder's height: removing them pulled the page up 174 px under the thumb (breaker on N3)
    if (!c || !(c.yearly > 0)) {
      for (const el of [careLine, careLine2]) if (el) { el.style.minHeight = `${heightOf(el)}px`; el.style.color = ""; el.removeAttribute("aria-busy"); }
      careLine.replaceChildren(c ? `Even in a bad run of years ${BAD_RUN_NOTE}, the money does not last to the end of the plan.` : "The spending that lasts in a bad run of years could not be worked out; the figure below is if markets do as well as average.");
      careLine2?.replaceChildren(...(c && Number.isFinite(c.planned) ? shareWords(chanceWords(c.planned), c.planned).filter((x) => x !== null) : []));
      careStat.replaceChildren(ui.stat("Spending it can pay for", money(d.affordable), `a year${onTop}, today's dollars, if markets do as well as average`));
      return;
    }
    careLine.style.minHeight = `${heightOf(careLine)}px`;   // never shorter than the placeholder it replaces (exact: offsetHeight rounds 67.9 up and moved the page 1 px)
    careLine.style.color = "";
    careLine.removeAttribute("aria-busy");
    // the share rounded down, so a figure just under 9 in 10 never reads "90%" (review 2026-11-05), in the shared words (UX review 7)
    careLine.replaceChildren(...careWords(money(c.yearly), money(monthlyOf(c.yearly))));
    if (careLine2) { careLine2.style.minHeight = `${heightOf(careLine2)}px`; careLine2.style.color = ""; careLine2.replaceChildren(...shareWords(chanceWords(c.planned), c.planned).filter((x) => x !== null)); }   // replaceChildren writes a null as the text "null"
    careStat.replaceChildren(ui.stat("Spending that lasts, even in a bad run of years", money(c.yearly), careSub));
  });
  // who starts retirement (fifth pass): the first adult, or the last working adult when Get started says the first does not work,
  // or nobody ("nobody in the plan works now")
  // the projection's own note about the spending figure, said where it can be changed (UX review 18: "on this page")
  const noteWords = (n) => n.replace("Social Security already paid, from the Income page:", "Social Security you already get (from the Income page):").replace("The plan assumes you will spend in retirement what you spend today; set your own figure on this page if it will differ.", "Retirement spending is set to what you spend today; change it under Retirement settings below.");
  const rb = d.retireBy ?? { name: d.people[0].name, age: d.atRetirement.age, first: true };
  // the first adult has stopped while a partner with pay works on (seventh pass): retirement starts now, the pay counted as income
  // "you" and "your" for the first adult Get started left unnamed ("you at 65", "your spouse's pay"; round 7)
  const paidOn = rb.stopped && rb.working?.length ? `${nameIn(rb.name)} ${rb.notWorking ? `${verbFor(rb.name, "is", "are")} not working` : `${verbFor(rb.name, "has", "have")} stopped work`}; ${listOf(rb.working.map((w) => `${nameOf(w.name)} pay comes in until ${w.untilYear}`))}` : null;
  // the person who starts it is past their retirement age already: it has begun, it does not "start in" this year
  const starter = d.people.find((p) => p.id === rb.id), alreadyRetired = !!starter && !rb.nobody && !rb.stopped && thisYear - starter.birthYear > starter.retireAge;
  const startWho = paidOn ?? (rb.nobody ? "nobody in the plan works now" : rb.first ? `${nameIn(rb.name)} at ${rb.age}` : `when ${nameIn(rb.name)} ${verbFor(rb.name, "stops", "stop")} work at ${rb.age}`);
  // what the answer rests on (owner's request 2026-11-11, spec part A): the numbers, whose each is, worked out at once (no
  // projections: levers.js leverList); the card under the hero says what one change to each would do
  const today = fmt.today();
  const spare = spareOf(ctx, plan, today);
  let list = null;
  try { list = leverList(plan, { today, spare, money, d }); } catch (e) { console.warn("[planner] what this rests on", e); list = null; }
  // the answer as drawn now, and the one drawn before on this visit: a change made since (here or on another page) is said with
  // both answers and the number that moved (D-A6), in the answer's own unit (D-A1)
  const nowAnswer = d.result ? (() => { const last = d.rows.at(-1); return { lasts: !!d.result.success, age: d.result.success ? null : d.result.failAge, endAge: last?.ages?.[0] ?? null, endReal: last?.totalReal ?? 0 }; })() : null;
  const values = list?.ready ? valuesOf(list) : {};
  const drawKey = keyOf([today, d.inputs, values]);
  const prev = lastDrawn && lastDrawn.key !== drawKey && lastDrawn.answer && nowAnswer ? lastDrawn : null;
  // the money going in as Roth 401(k) a year: a change of when the tax is paid is said with what this answer leaves out (spec D-C3)
  const rothIn = (plan.retirement?.contributions ?? []).filter((c) => isNowAccount((plan.accounts ?? []).find((a) => a.id === c.accountId), c.employerMatch)).reduce((t, c) => t + perYear(Number(c.amount) || 0, c.period), 0);
  // the headline's own words, once known (while they are checked, set when they come; F5)
  const nowHead = waiting ? null : canTurn ? finalHead(known) : averageHead;
  const drawn = { key: drawKey, answer: nowAnswer, values, rothIn, head: nowHead, verdict: d.verdict, unknown: unknownYet };
  lastDrawn = drawn;
  if (waiting) onHead.push((h) => { drawn.head = h; });
  const arrival = drawnFor !== ctx.route;
  drawnFor = ctx.route;
  const bothLeft = !!prev && prev.answer.lasts && nowAnswer.lasts;
  const moved = prev ? changedKeys(prev.values, values) : [];
  const taxMoved = !!prev && Math.abs((prev.rothIn ?? 0) - rothIn) > 0.5;
  // the headline turned (tight to on track, short to lasting): said first, in its own words (F5). A run-out year that moved is
  // not a new headline: the line below says it by age
  const headKind = (h) => (/^Runs out in \d{4}$/.test(h ?? "") ? "short" : h ?? null);
  const headTurned = !!prev?.head && (nowHead ? headKind(prev.head) !== headKind(nowHead) : prev.verdict !== d.verdict);
  const answerMoved = !!prev && answerWords(prev.answer, money, { left: bothLeft }) !== answerWords(nowAnswer, money, { left: bothLeft });
  // said only after a change that moved the answer, turned the headline, or changed a number the person sets (B6: a balance
  // update or a renamed account that moves nothing draws no line)
  const before = prev && (answerMoved || headTurned || moved.length || taxMoved) ? prev : null;
  const changeSay = (strongFirst = true, { split = false } = {}) => changeNodes(ui, { before, nowAnswer, nowHead, headTurned, bothLeft, moved: moved.map((x) => (x.to === "now counted" ? `${x.name} (now counted)` : `${x.name} (${x.from} → ${x.to})`)), taxMoved, money, onHead, strongFirst, split });
  // (the settings fold's own save says the same under its Save button: settingsCard, P7)
  // simple first (owner, 2026-11-12; review P12: up to five sentences stood between the headline and the answer's own words):
  // one sentence in the hero, the headline's turn or the answer before and now; what was changed, and the tax note, one quiet
  // tap away under "What changed"
  const beforeLine = before ? (() => {
    const [first, ...more] = changeSay(true, { split: true });
    const p = ui.h("p", { class: "lv-before" }, first);
    if (!more.length) return p;
    return ui.h("div", {}, p, ui.h("details", { class: "fold lv-what" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "What changed"), ui.h("span", { class: "fold-chev" }, "›")), ui.h("p", { class: "small" }, ...more)));
  })() : null;
  const restsLine = list?.ready && !unknownYet ? restsOnWords(list) : list?.ready && list.missing.length ? restsOnWords({ counts: {}, missing: list.missing }) : "";
  // the answer to "What happens to the money left over?" just saved: what was written, and the retirement answer before and after
  // (P6: when the headline turned, its own words lead, before and now; M7: after "We don't know yet" only the new answer)
  const leftNotice = leftPending ? (() => {
    const w = answerChangeWords(leftPending.before, nowAnswer, money, { unknown: !!leftPending.unknown });
    const turn = headTurned && prev && !leftPending.unknown ? [" ", headTurnNode(ui, { was: prev.head, now: nowHead, onHead, lead: "Before" })] : [];
    const n = ui.notice("ok", [leftPending.text, ...turn, w ? ` Your retirement answer: ${w}.` : ""]);
    leftPending = null;
    return n;
  })() : null;
  // coming back after a change made elsewhere (a link from the card, Back): the same sentence first in the card, where the person
  // lands, brought into view when the hero is not (F3)
  const backNotice = before && arrival && !leftNotice ? ui.notice("ok", changeSay()) : null;
  const changed = Object.fromEntries(moved.filter((x) => x.to !== "now counted").map((x) => [x.key, `${x.from} → ${x.to}`]));
  const lvCard = list?.ready && list.rows.length ? leversCard(ctx, d, list, { unknownYet, money, notice: leftNotice ?? backNotice, leftJust: !!leftNotice, changed: before ? changed : {}, heroLine: beforeLine, openSpending: () => { const s = root.querySelector("details.pj-settings"); if (s) typeInto(s); } }) : null;
  const checkButton = lvCard ? ui.h("button", { type: "button", class: unknownYet ? "btn secondary" : "btn", onClick: (e) => { holdTaps(e); openLevers(lvCard, { smooth: true }); } }, "Check the numbers behind this ↓") : null;
  // a stock return typed above the hopeful one (8%): the answer says it rests on it, in amber, with the way to check it (spec L5)
  const stocksNow = Number(plan.assumptions?.returnStocks ?? 0.07);
  const hopefulTag = !unknownYet && hopefulReturn(plan) ? ui.h("p", { class: "small" }, ui.h("span", { class: "pill warn" }, "on your hopeful return"), ` Stocks grow ${Number((stocksNow * 100).toFixed(2))}% a year in this answer: higher than any forecast we know. `, ui.h("a", { href: "#/system/assumptions?show=returnStocks", class: "pj-link" }, "Check it ›")) : null;
  // with stocks above our middle figure (7%), the middle figure's answer when it is worse (spec L10): Next best action, Benchmarks,
  // the guide's "What would help" step and "drawing as planned" go by it (savingVerdict), so this page says it too
  const middleSay = unknownYet ? null : middleWords(d);
  const middleLine = middleSay ? ui.h("p", { class: "small" }, middleSay) : null;
  root.append(ui.h("section", { class: "card accent hero" },
    headline,
    hopefulTag,
    middleLine,
    beforeLine,
    // no retirement savings on file (stress test 2026-11-11, F4): what to do, as the one filled button below; no chart of a line
    // falling to $0 under "we don't know"
    unknownYet ? ui.h("p", { class: "lede" }, "You haven't told us about retirement savings, so we can't say whether the money will last. Add what you own to see. If you have no retirement savings yet, that is common; you can go on and come back.") : ui.h("p", { class: "lede" }, verdictText),
    spentDown && d.verdict !== "short" && !unknownYet ? ui.h("p", {}, spentDown) : null,
    // (simple first, review P21: at 320 px the filled button was under three paragraphs and off the first screen. The answer, then
    // what it rests on and the one action; the bad-run lines and when retirement starts follow)
    // what the answer rests on, in one line, and the page's one filled button to the card under the hero (owner's request
    // 2026-11-11: check the numbers before changing the plan); with nothing saved on file "Add what you own" stays the filled one
    restsLine ? ui.h("p", { class: "small" }, restsLine) : null,
    // what would change the answer is on Goal seek (the most you could spend, the earliest age, what more to save): one tap away;
    // the page the chance comes from, or the one that compares the ways, as a button beside it (no links inside sentences); with
    // nothing saved on file there is no chance to show (path part 3: the careful line is not shown then either)
    // (simple first, round 2: one action under the answer. "Could you stop sooner?" and the chance or how-much page lead the Go
    // deeper card under "What this answer rests on"; with nothing saved, "Add what you own" and the check of what is not counted)
    ui.row(unknownYet ? ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add what you own ›") : checkButton,
      unknownYet ? checkButton : null),
    unknownYet ? null : careLine,
    unknownYet ? null : careLine2,
    // income not counted after work stops (support and other with no end date; dividends), and how to keep it (recheck 2026-11-05)
    // in the normal text colour (grey on the hero's tint was under 4.5:1), short (UX review 17, 18)
    // where the age is set, one tap away (stress test 2026-11-11, A6: "Can I retire at 62?" had no way to the age)
    ui.h("p", { class: "small" }, `${alreadyRetired ? "Retirement has already begun" : `Retirement starts in ${d.atRetirement.year}`} (${startWho}); the plan runs to ${d.atEnd.year}. `, ui.h("a", { href: "#/household/people", class: "pj-link" }, alreadyRetired ? "Ages ›" : "Change the age ›")),
    d.notes.length || d.otherLeft?.length ? ui.h("p", { class: "small" }, ...linked(d.notes.map(noteWords).join(" ")), ...(d.otherLeft?.length ? [d.notes.length ? " " : "", ...leftWords(ui, money, d.otherLeft)] : [])) : null,
  ));
  // the card directly under the answer, then the questions that go deeper (spec part D: two levels at most)
  if (lvCard) root.append(lvCard);
  // (not while the answer is "We don't know yet": the pages it links rank levers under a verdict that does not exist; P19)
  if (!unknownYet) root.append(ui.card("Go deeper",
    ui.h("p", { class: "muted small" }, "Questions about your own answer, each on a page of its own."),
    ui.h("div", { class: "row lv-deeper" },
      ui.h("a", { class: "btn secondary", href: "#/scenarios/goal-seek" }, alreadyRetired ? "What would change it ›" : "Could you stop sooner? What would change it ›"),
      noCare ? null : steady ? ui.h("a", { class: "btn secondary", href: "#/retirement/monte-carlo" }, "Chance the money lasts ›") : ui.h("a", { class: "btn secondary", href: "#/retirement/withdrawal-strategy" }, "How much to take out ›"),
      ui.h("a", { class: "btn secondary", href: "#/scenarios/sensitivity" }, "What matters most? ›"),
      ui.h("a", { class: "btn secondary", href: "#/scenarios/compare" }, "Try two plans side by side ›"),
      ui.h("a", { class: "btn secondary", href: "#/retirement/historical" }, "What if history repeated? ›"))));
  if (lvCard) landCheck(ctx, lvCard);
  // an answer just saved on the card: its notice is brought into view now, in this drawing, so the shell sees it on the screen and
  // does not repeat it as a note at the foot that covers the row just answered (review 2026-11-12, F6/P13)
  if (leftNotice?.isConnected !== false && leftNotice) leftNotice.scrollIntoView?.({ block: "center" });
  // (with nothing saved on file the four figures would all read $0 or 0%: left out until there is something to measure)
  if (!unknownYet) root.append(ui.card(null, ui.row(
    ui.stat("At retirement", money(d.atRetirement.totalReal), `${d.atRetirement.year}, in today's dollars`),
    careStat,
    // all the income that comes in that year, named by what it is (recheck 2026-11-05: "Guaranteed income ... Social Security,
    // pensions, a partner's pay" read 203% for a couple whose rent and dividends were in it), against that year's spending and
    // health cover (the health line is spending too)
    ui.stat("Paid by income", d.coverage !== null ? fmt.pct(d.coverage, 0) : "-", `of the first retirement year's spending${healthOn ? " and health insurance" : ""}${d.coverageFrom?.length ? `, from ${listOf(d.coverageFrom)}` : ": nothing comes in that year but savings"}`),
    ui.stat(`Left in ${d.atEnd.year}`, money(Math.max(0, d.atEnd.totalReal)), d.atEnd.totalReal > 0 ? "today's dollars" : "nothing"),
  )));
  const years = d.rows.map((r) => r.year);
  if (!unknownYet) root.append(ui.card("Money over the years, in today's dollars",
    lineChart({ years, series: [{ values: d.rows.map((r) => r.totalReal) }], marks: [{ year: d.atRetirement.year, label: "retire" }], label: "balance over the years" }),
    // (R-A8: a page title in the middle of a sentence read as a question); the two pages as outlined links (spec part D)
    ui.h("p", { class: "muted small" }, "One line, at expected returns. Two more pages show the range around it:"),
    ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/monte-carlo" }, "Chance the money lasts ›"), ui.h("a", { class: "btn secondary", href: "#/retirement/historical" }, "If history repeated ›")),
  ));
  // the loans the spending holds (buildInputs `loans`): each paid as a fixed amount until Debts' payoff, then gone; the tax and
  // insurance inside a mortgage's payment stay. Said in plain sentences after the figure (compute spendingLoanWords; fix round 1,
  // 2026-11-11: one sentence with brackets inside brackets, and a loan-only figure no other page shows). A rental's loan is said
  // with the rental's lines under "Income counted" (incomeWords). When the payoff plan ends a loan sooner, its year is said too.
  let planEnds = {};
  try { planEnds = Object.fromEntries(Object.entries(twoDates(plan, { today: fmt.today() })).map(([id, x]) => [id, Number(String(x.plan).slice(0, 4))])); } catch { planEnds = {}; }
  const loanLines = spendingLoanWords(d.inputs, money, { planEnds });
  const typedHolds = d.spendingSource === "typed" && !d.health?.fromSetup && loanLines.length > 0;
  const spendFrom = d.health?.fromSetup ? "the figure from Set up my plan" : d.spendingSource === "expenses" ? "today's expenses" : typedHolds ? "the figure you typed" : "";
  const spendWords = `${money(d.spendingYearly)} a year in today's dollars${spendFrom ? `, ${spendFrom}` : ""}${spendFrom && d.health?.removedMonthly > 0 ? ` less ${money(d.health.removedMonthly)} a month of health insurance` : ""}${healthOn ? ", on top of health insurance" : d.health?.included ? ", health insurance included" : ""}${loanLines.length ? `. ${loanLines.join(" ")}` : ""}`;
  const intoList = ui.h("ul", { class: "records" }, [
      // the first adult who has stopped while a partner's pay comes in (seventh pass): their age on file is not when it starts
      // "You: retire at 65, plan to 95; your spouse: retires at 62, ..." (the first adult unnamed; round 7)
      ["People", d.people.map((p, i) => (rb.stopped && rb.id === p.id ? `${(i ? nameIn : NameIn)(p.name)}: ${rb.notWorking ? "not working now" : "stopped work"} (${p.retireAge} on file), plan to ${p.endAge}` : (thisYear - p.birthYear >= p.retireAge || plan.guide?.setup?.status?.[p.id] === "retired") ? `${(i ? nameIn : NameIn)(p.name)}: already retired (${thisYear - p.birthYear}), plan to ${p.endAge}` : `${(i ? nameIn : NameIn)(p.name)}: ${verbFor(p.name, "retires", "retire")} at ${p.retireAge}, plan to ${p.endAge}`)).join("; ")],
      ["Retirement money today", moneyToday(d.inputs.balances, unknownYet, money)],
      ["Added each year until retirement", d.inputs.contributions.length ? `${money(d.inputs.contributions.reduce((s, c) => s + c.yearly, 0))}, rising with pay (What you save for retirement)` : "nothing entered (What you save for retirement)"],
      // each line by its own name, with its ages or years (incomeWords: rent says "from 2033", never its owner's age)
      // the lines named for the unnamed first adult say "your Social Security": a capital only at the start of the record
      ["Income counted", d.inputs.incomes.length ? incomeWords(d.inputs, money).join("; ").replace(/^your /, "Your ") : "none entered (Social Security page)"],
      ...(d.otherLeft?.length ? [["Not counted", d.otherLeft.map((x) => `${x.name}: ${money(x.yearly)} a year, ${leftWhy(x)}`).join("; ")]] : []),
      ["Spending in retirement", spendWords],
      ["Growth and rising prices", `stocks ${fmt.pct(d.inputs.returns.stocks, 1)} a year, bonds ${fmt.pct(d.inputs.returns.bonds, 1)}, prices rising ${fmt.pct(d.inputs.rates.inflation, 1)} a year (Assumptions); ${Math.round(d.inputs.rates.stocksNow * 100)}% in stocks now, ${Math.round(d.inputs.rates.stocksRetired * 100)}% in retirement`],
      ["Taxes", d.inputs.tax?.mode === "brackets" ? `the federal brackets on each year's income, filing ${d.inputs.tax.filingStatus.replace(/_/g, " ").replace("married joint", "jointly").replace("married separate", "separately")} (Taxes pages); withdrawals ${orderWords(d.orderLabel)}${d.inputs.rothConversion ? `; Roth conversions fill the ${fmt.pct(d.inputs.rothConversion.fillRate, 0)} bracket before required withdrawals` : ""}; required withdrawals start at ${d.inputs.rmd.startAge}` : `${fmt.pct(d.inputs.rates.taxRate, 0)} on money taken from retirement accounts you pay tax on later; withdrawals ${orderWords(d.orderLabel)}; required withdrawals start at ${d.inputs.rmd.startAge}`],
    ].flatMap(([k, v]) => [ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, k)), ui.h("div", { class: "rec-sub" }, linked(v))),
      // health cover right under the spending it goes on top of (by its name: the "Not counted" row comes and goes above it)
      ...(k === "Spending in retirement" ? [healthRecord(ctx, d)] : [])]).filter(Boolean));
  // with no retirement savings on file the list is folded (F4: nine blocks of Medigap and tax rates under "we don't know yet")
  root.append(unknownYet
    ? ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "What goes into this"), ui.h("span", { class: "fold-chev" }, "›")), ui.h("div", { class: "fold-body" }, intoList))
    : ui.card("What goes into this", intoList));
  const settings = settingsCard(ctx, d);
  root.append(settings);
  openAsked(ctx, settings);
}

/** Retirement settings opened at the spending box, scrolled to and focused (the not-ready hero's "Type what you'll spend ↓"). */
function typeInto(settings) {
  settings.open = true;
  const box = settings.querySelector("input[name=spendingMonthly]") ?? settings.querySelector("input");
  settings.scrollIntoView({ behavior: "smooth", block: "start" });
  box?.focus({ preventScroll: true });
}

// ?type=spending (another retirement page's "Type what you'll spend ›", needs.js): the settings open at the box once per visit,
// not again on each redraw after a save (stress test 2026-11-11, RB2: those pages sent a newcomer here to read the list again)
let typedFor = null;
function openAsked(ctx, settings) {
  if (ctx.route?.query?.type !== "spending" || typedFor === ctx.route) return;
  typedFor = ctx.route;
  afterPaint(() => { if (settings.isConnected) typeInto(settings); });
}

/**
 * The health line as a record of "What goes into this" (2026-11-02): marketplace cover from retirement to 65 after the
 * credit, then Medicare, both worked out on their own pages and added on top of the spending figure, the cliff year when
 * there is one, and the box "My spending figure already includes health cover" (retirement.healthIncluded, saved on change).
 */
function healthRecord(ctx, d) {
  const { ui, fmt, store, plan } = ctx;
  const h = d.health;
  if (!h) return null;
  const around = (n) => fmt.money(Math.round(n / 10) * 10, plan.meta.currency);
  const list = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
  const span = (from, until, n) => (from === until ? `${from}` : n === 2 ? `${from} and ${until}` : `${from} to ${until}`);
  // years as words: "2053", "2053 and 2054", "2053 to 2056", or a list when they skip
  const yearsOf = (ys) => (ys.length === 1 ? `${ys[0]}` : ys.length === 2 || ys.at(-1) - ys[0] + 1 !== ys.length ? list(ys.map(String)) : `${ys[0]} to ${ys.at(-1)}`);
  // a sentence a part, naming the people and the years (healthSummary; fifth pass, 2026-11-02): "Bo: about $210 to $1,440 a
  // month, 2026 and 2027 (marketplace; with the credit in the years it applies). Ana: Medicare, about $240 a month from 2026.
  // Bo: Medicare from 2028 (about $480 a month for the two of you)." "after the credit" only when every year of a part has
  // one, "with the credit in the years it applies" when some do (creditWords)
  const say = (b, m, surcharge) => healthSummary(b, m, { money: (n) => fmt.money(n, plan.meta.currency), surcharge });
  const words = [];
  if (h.included) {
    const s = h.shown;
    words.push("Not added: you said your spending figure already includes it.");
    if (s) words.push(`Without that, the plan would add about ${around(s.total)} in all, in today's dollars. ${say(s.bridge, s.medicare, false)}`);
  } else {
    const b = h.bridge, m = h.medicare;
    // the total names what it holds; a work premium kept while a partner works is said on its own line, with its own amount
    const jobTotal = h.jobPlan?.total ?? 0;
    if (b || m) words.push(`${say(b, m, true)} About ${around(h.total - jobTotal)} in all for ${list([b ? "the marketplace" : null, m ? "Medicare" : null].filter(Boolean))}, in today's dollars, added to what you spend.`);
    // married filing separately: no marketplace credit (26 U.S.C. 36B(c)(1)(C); seventh pass), said once
    if (b?.separate) words.push("You file separate returns, and a married couple filing separately gets no marketplace tax credit, so the full premium is counted. Only someone living apart from a spouse who abused or abandoned them can still get it (the instructions for IRS Form 8962 say how).");
    // what Medicare holds beyond Part B and the drug plan, and what it leaves out (seventh pass)
    if (m) words.push(`Medicare here is Part B, a drug plan and a supplement (${m.supplementDefault ? `about ${fmt.money(Math.round(m.supplementMonthly), plan.meta.currency)} a month each, the national average for Medigap Plan G; yours on the Medicare page` : m.supplementMonthly > 0 ? `${fmt.money(Math.round(m.supplementMonthly), plan.meta.currency)} a month each, as you entered on the Medicare page` : "none: you entered $0 on the Medicare page"}). Not counted: what you pay at the pharmacy, dental care, glasses, hearing aids and long-term care.`);
    if (b?.underLine?.length) words.push(`In ${yearsOf(b.underLine)} the plan's income is under the poverty line, where the marketplace gives no credit: Medicaid may cover people with that income instead (your state's marketplace site will say).`);
    if (h.paidBy) words.push(h.paidBy.era
      ? `Your expenses list "${h.paidBy.line}": with ${list(h.paidBy.names.map(nameIn))} 65 or over and retired, that counts as ${h.paidBy.names.length > 1 ? (h.paidBy.names.some(isYou) ? "your" : "their") : nameOf(h.paidBy.names[0])} Medicare and any supplement, so it stays in your spending and Medicare is not added again.`
      : `Medicare for ${list(h.paidBy.names.map(nameIn))} is already in your spending (your expenses list "${h.paidBy.line}"), so it is not added again.`);
    if (h.otherLine) words.push(`Your expenses list "${h.otherLine}": nobody here is 65 yet, so it stays in your spending as it is, and your own Medicare is added from 65.`);
    // the Medicare years left to a job's plan, a sentence for each worker's run of years (onJobWords; verify 2026-11-06)
    if (h.onJob) words.push(...onJobWords(h.onJob, list));
    // a husband's or wife's Medicare counted while the other still works, and how to leave it out (spouseWords; seventh pass)
    if (h.spouseOnJob) words.push(...spouseWords(h.spouseOnJob, list));
    if (h.coverLines?.length) words.push(`${list(h.coverLines.map((x) => `"${x.name}"`))} on Expenses ${h.coverLines.length === 1 ? "is" : "are"} left out of retirement spending: coverage from retirement on is worked out here instead.`);
    if (h.jobPlan) words.push(`While ${nameIn(h.jobPlan.worker)} still ${verbFor(h.jobPlan.worker, "works", "work")} (${span(h.jobPlan.fromYear, h.jobPlan.untilYear, h.jobPlan.years)}), the ${around(h.jobPlan.monthly)} a month stays in, for the plan at work: about ${around(h.jobPlan.total)}${b || m ? " more" : ""} over ${h.jobPlan.years === 1 ? "that year" : "those years"}.`);
    if (!words.length) return null;
  }
  const out = ui.h("div");
  if (healthPending) { const n = ui.notice("ok", healthPending); out.append(n); setTimeout(() => n.remove(), 4000); healthPending = null; }
  const box = ui.h("input", { type: "checkbox", checked: h.included ? true : null, onChange: (e) => {
    const on = e.target.checked;
    healthPending = on ? "Saved: your spending figure counts as including health insurance, so none is added." : "Saved: health insurance is added on top of your spending.";
    store.update((p) => { p.retirement = p.retirement ?? {}; if (on) p.retirement.healthIncluded = true; else delete p.retirement.healthIncluded; });
  } });
  // the cliff: which years are over it, by how little, what it costs and that the cost is already in the figure above
  const cliff = !h.included && h.bridge?.cliff ? h.bridge.cliff : null;
  const cliffYears = cliff ? yearsOf(cliff.yearsList) : "";
  return ui.h("li", {}, out,
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, "Health insurance")),
    ui.h("div", { class: "rec-sub" }, words[0]),
    // what is left out or kept, and why (a Medicare line, years on a job's plan, a premium), under the figure itself
    words.length > 1 ? ui.h("div", { class: "rec-sub", style: { marginTop: "6px" } }, words.slice(1).join(" ")) : null,
    cliff ? ui.h("div", { class: "rec-sub", style: { marginTop: "6px" } }, `In ${cliffYears} the plan's income is over ${fmt.money(Math.round(cliff.income), plan.meta.currency)} (by ${cliff.years > 1 ? "as little as" : "about"} ${around(cliff.overBy)}), so ${cliff.years > 1 ? "those years get" : "that year gets"} no marketplace credit: about ${around(cliff.lostTotal)}, already in the cost above. Taking ${cliff.years > 1 ? "those years'" : "that year's"} money from Roth or cash could keep the credit (Healthcare before 65 shows how).`) : null,
    ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/healthcare" }, "Healthcare before 65 ›"), ui.h("a", { class: "btn secondary", href: "#/retirement/medicare" }, "Medicare ›")),
    ui.h("label", { style: { display: "flex", gap: "10px", alignItems: "center", minHeight: "44px", marginTop: "4px", fontSize: "var(--fs-sm)" } }, box, ui.h("span", {}, "My spending figure already includes health insurance")));
}

// a slip of extra digits is refused at the box, in the box's own words (stress test 2026-11-11, R-A10: $99,999,999,999 a month
// was saved and the page said "Runs out in 2055"); far above any household this plan is for
export const SPEND_MONTHLY_CEILING = 100000;
function settingsCard(ctx, d) {
  const { ui, fmt, store, plan } = ctx;
  const rt = plan.retirement ?? {};
  const out = ui.h("div");
  const justSaved = !!pending;
  if (pending) {
    // what the save did to the answer, in the words Contributions and Assumptions use after theirs (review 2026-11-12, P7: only
    // "Retirement settings saved." showed, 4,000 px under the answer); a plain "saved" goes after 4 seconds, one with the answer stays
    let w = "";
    try { w = settingsBefore ? answerChangeWords(settingsBefore, answerOf(plan, { today: fmt.today() }), (n) => fmt.money(n, plan.meta.currency), { still: false }) : ""; } catch { w = ""; }
    const n = ui.notice("ok", w ? `${pending} Your retirement answer: ${w}.` : pending);
    out.append(n);
    if (!w) setTimeout(() => n.remove(), 4000);
    pending = null; settingsBefore = null;
  }
  // the box shows what the plan counts before health cover (figureMonthly; fourth pass, 2026-11-02): a typed figure as it is,
  // or Get started's own less the health insurance among today's bills that the health line replaces
  const spendNow = d.figureMonthly ?? (Number(rt.spendingMonthly) > 0 ? Number(rt.spendingMonthly) : null);
  const less = d.health?.fromSetup && d.health.removedMonthly > 0 ? `: Get started's figure from today's bills, less ${fmt.money(Math.round(d.health.removedMonthly), plan.meta.currency)} a month of health insurance` : "";
  // each way judged on its own run (review D2), as How much to take out does
  const ways = d.ready ? wayOptions(plan, { today: fmt.today() }, { inputs: d.inputs }) : wayOptionsFor(null, rt.strategy ?? "fixed-real");
  const waysLeft = Object.keys(STRATEGIES).length - ways.length;
  const FIELDS = [
    // the help follows the box under Health cover: before cover (the plan adds it), or cover included (you said so)
    { key: "spendingMonthly", label: "Spending in retirement, a month", type: "money", min: 0, max: SPEND_MONTHLY_CEILING, help: rt.healthIncluded === true ? "today's dollars, health insurance included (you said so under Health insurance); leave blank to use today's expenses" : `today's dollars, before health insurance (the plan adds it)${less}; leave blank to use today's expenses${(d.inputs?.loans ?? []).length ? ". A loan payment in this figure still stops when the loan is paid off, whatever you type" : ""}` },
    { key: "stocksNow", label: "Share in stocks now", type: "percent", min: 0, max: 100, help: "the rest counts as bonds" },
    { key: "stocksRetired", label: "Share in stocks once retired", type: "percent", min: 0, max: 100 },
    { key: "taxMode", label: "How tax is worked out", type: "select", options: [{ value: "flat", label: "A flat rate on pre-tax withdrawals (quick)" }, { value: "brackets", label: "The federal brackets on each year's income" }], help: "the brackets use the filing status from the People page and the rules on the Taxes pages" },
    { key: "taxRate", label: "Flat rate on money taken from pre-tax accounts", type: "percent", min: 0, max: 60, help: "used by the flat setting only" },
    { key: "strategy", label: "How much to take out each year", type: "select", options: ways, help: waysLeft ? `${waysLeft === 1 ? "One way is" : `${waysLeft} ways are`} left out: on your plan ${waysLeft === 1 ? "it" : "they"} would leave some of your income unspent (How much to take out says when)` : "How much to take out compares them on your plan" },
    { key: "withdrawalRate", label: "Starting withdrawal rate", type: "percent", min: 1, max: 15, help: `the share of savings "${DESCRIPTIONS.percent.name}" and "${DESCRIPTIONS.guardrails.name}" start from; 4 is the classic figure` },
  ];
  const values = { spendingMonthly: spendNow, stocksNow: rt.stocksNow ?? 0.7, stocksRetired: rt.stocksRetired ?? 0.5, taxMode: rt.taxMode ?? "flat", taxRate: rt.taxRate ?? 0.15, strategy: rt.strategy ?? "fixed-real", withdrawalRate: rt.withdrawalRate ?? 0.04 };
  const form = ui.form(FIELDS, values, (v) => {
    const kept = { stocksNow: v.stocksNow ?? 0.7, stocksRetired: v.stocksRetired ?? 0.5, taxMode: v.taxMode === "brackets" ? "brackets" : "flat", taxRate: v.taxRate ?? 0.15, strategy: v.strategy, withdrawalRate: v.withdrawalRate ?? 0.04 };
    // the settings under "More settings" that this save changes, named (the final review F3: "Retirement settings saved." for an
    // 85% typed under a closed fold): "share in stocks now 70% → 85%"
    const low = (t) => `${t.charAt(0).toLowerCase()}${t.slice(1)}`;
    const named = FIELDS.filter((f) => f.key in kept).filter((f) => (f.type === "percent" ? Math.abs(Number(kept[f.key]) - Number(values[f.key])) > 1e-9 : kept[f.key] !== values[f.key]))
      .map((f) => (f.type === "percent" ? `${low(f.label)} ${Number((Number(values[f.key]) * 100).toFixed(2))}% → ${Number((Number(kept[f.key]) * 100).toFixed(2))}%` : `${low(f.label)}: ${low(f.options?.find((o) => o.value === kept[f.key])?.label ?? String(kept[f.key]))}`));
    pending = `Retirement settings saved${named.length ? `: ${named.join("; ")}` : ""}.`;
    try { settingsBefore = d.ready && !savingsUnknown(d) ? answerOf(plan, { today: fmt.today() }) : null; } catch { settingsBefore = null; }
    store.update((p) => {
      // a figure typed here, other than the one shown, is the household's own: no longer Get started's (retireAuto), taken as typed
      saveSpendingFigure(p, v.spendingMonthly ?? null, spendNow);
      p.retirement = { ...(p.retirement ?? {}), ...kept };
    });
  }, { submitLabel: "Save settings" });
  // simple first, detail on request (owner, 2026-11-12; review P7: "Change ›" on the spending row landed in seven boxes of
  // finance words with Save 950 px under the one the person came for): the spending box and Save, and the six technical
  // settings in a fold of their own that says when one of them is not the usual figure. Opening it changes nothing; the boxes
  // stay in the form, so Save saves them as before
  const USUAL = { stocksNow: 0.7, stocksRetired: 0.5, taxMode: "flat", taxRate: 0.15, strategy: "fixed-real", withdrawalRate: 0.04 };
  const changedN = Object.keys(USUAL).filter((k) => (typeof USUAL[k] === "number" ? Math.abs(Number(values[k]) - USUAL[k]) > 1e-9 : values[k] !== USUAL[k])).length;
  // (a form without querySelector is a test's stand-in: the boxes then stay where the form put them)
  const actions = typeof form.querySelector === "function" ? form.querySelector(".form-actions") : null;
  if (actions?.before) {
    const moreBody = ui.h("div", { class: "fold-body" });
    for (const k of Object.keys(USUAL)) { const lab = form.querySelector(`[name="${k}"]`)?.closest?.("label"); if (lab) moreBody.append(lab); }
    const status = ui.h("span", { class: "fold-status" });
    const more = ui.h("details", { class: "fold pj-more" },
      ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "More settings (stocks, tax, how much to take out)"), status, ui.h("span", { class: "fold-chev" }, "›")),
      moreBody);
    actions.before(more);
    // the line says when a box under it holds a figure typed or picked since the page was drawn, which Save keeps: "1 to save"
    // (owner's rule 4; the final review F3: it still said "as usual" over an 85 typed in "Share in stocks now", and Save saved it)
    const boxOf = (k) => form.querySelector(`[name="${k}"]`);
    const drawn = Object.fromEntries(Object.keys(USUAL).map((k) => [k, String(boxOf(k)?.value ?? "")]));
    const same = (a, b) => a === b || (a !== "" && b !== "" && Number(a) === Number(b));
    const say = () => {
      const typed = Object.keys(USUAL).filter((k) => boxOf(k) && !same(String(boxOf(k).value ?? ""), drawn[k])).length;
      status.textContent = typed ? `${typed} to save` : changedN ? `${changedN} changed` : "as usual";
    };
    say();
    form.addEventListener?.("input", say);
    form.addEventListener?.("change", say);
    // a box in the closed fold that the browser will not take (a figure outside its range): the fold opens so its message can show
    form.addEventListener?.("invalid", () => { more.open = true; }, true);
  }
  // folded like every technical section, also on a first open (stress test 2026-11-11, R-A5, x-5: seven boxes in finance words opened
  // under "add these first"); the hero's "Type what you'll spend" opens it at the box when that is what is missing
  const noFigure = !spendNow && (d.spendingSource === "none" || (d.missing ?? []).some((m) => /spend in retirement/.test(String(m))));
  // open after its own Save, so its green line is seen (a review of the stress-test fixes: saved from the hero's "Type what you'll
  // spend", the note sat inside the shut section); the shell keeping the place after a save is wave 1's
  const details = ui.h("details", { class: "card fold fold-card pj-settings", open: justSaved ? true : null },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Retirement settings"), ui.h("span", { class: "fold-status" }, spendNow ? `${fmt.money(spendNow, plan.meta.currency)} a month` : noFigure ? "spending not set yet" : "spending = today's expenses"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "Shared by every retirement page. Ages and how long the plan runs come from the People page; growth and inflation from Assumptions."), out, form));
  return details;
}

const nowMs = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
/**
 * Let taps on the page go for a moment: called by a tap that scrolls the page under the finger (B4). A second second, and as long as
 * the page is still gliding plus a little: a thumb's second tap of a double tap comes 100 to 700 ms after the first.
 */
let heldAt = null;
const nearHeld = (e) => !heldAt || !Number.isFinite(e?.clientX) || Math.hypot(e.clientX - heldAt.x, e.clientY - heldAt.y) < 48;
function holdTaps(e = null) {
  const t0 = nowMs();
  heldAt = Number.isFinite(e?.clientX) && (e.clientX || e.clientY) ? { x: e.clientX, y: e.clientY } : null;
  tapsHeldUntil = t0 + TAP_HOLD_MS;
  if (typeof addEventListener !== "function") return;
  const glide = () => { const t = nowMs(); if (t - t0 > 2000) { removeEventListener("scroll", glide); return; } tapsHeldUntil = Math.max(tapsHeldUntil, t + TAP_HOLD_AFTER_SCROLL_MS); };
  addEventListener("scroll", glide, { passive: true });
  setTimeout(() => removeEventListener("scroll", glide), 2100);
}
// a grey bar as wide as the longest headline, where the new headline goes while it is being checked (F5)
const LONGEST_HEAD = "Lasts in about 5 of 10 pretend futures";
/**
 * The headline's turn in its own words, bold: "Before your change: It lasts in most cases, not all. Now: The money lasts."
 * (`lead` is "Before your change" in the hero's line, "Before" in a notice that has just said what was saved; P6). While the new
 * headline is being checked a grey bar holds its place and `onHead` fills it.
 */
function headTurnNode(ui, { was, now, onHead, lead }) {
  if (now) return ui.h("strong", {}, `${lead}: ${was}. Now: ${now}.`);
  const slotEl = ui.h("span", {}, barOf(ui, LONGEST_HEAD));
  onHead.push((h) => {
    // the paragraph keeps the height it was drawn with: the words take the bar's place (nothing below moves)
    const host = slotEl.parentNode?.parentNode;
    const ht = host?.getBoundingClientRect?.().height ?? 0;
    if (host && ht) host.style.minHeight = `${ht}px`;
    slotEl.replaceChildren(h);
  });
  return ui.h("strong", {}, `${lead}: ${was}. Now: `, slotEl, ".");
}

/**
 * The "Before your change" sentence (D-A6; review 2026-11-12, F5, B6), as nodes for a paragraph or a notice: the headline's own
 * words first when they turned ("Before your change: It lasts in most cases, not all. Now: The money lasts."; while the new one
 * is being checked a grey bar holds its place and `onHead` fills it), then the answer in its own unit, said as what it is, the
 * average-market answer ("If markets do as well as average, before your change: runs out at 70. Now: runs out at 74."), then
 * what the person changed, then the tax note (D-C3).
 */
function changeNodes(ui, { before, nowAnswer, nowHead, headTurned, bothLeft, moved, taxMoved, money, onHead, strongFirst = true, split = false }) {
  const out = [];
  if (headTurned) out.push(headTurnNode(ui, { was: before.head, now: nowHead, onHead, lead: "Before your change" }), " ");
  // split: [the first sentence (a node), ...the rest] for the hero's line and its fold (P12)
  if (split) {
    const avg = before.unknown ? `If markets do as well as average: ${answerWords(nowAnswer, money, { left: true })}.`
      : `If markets do as well as average, before your change: ${answerWords(before.answer, money, { left: bothLeft })}. Now: ${answerWords(nowAnswer, money, { left: bothLeft })}.`;
    const rest = [
      ...(headTurned ? [avg] : []),
      ...(moved.length ? [`${headTurned ? " " : ""}You changed ${moved.slice(0, 2).join(" and ")}.`] : []),
      ...(taxMoved ? [" You changed when the tax is paid on money at work. This answer does not count the tax that paying later saves you each year, so paying now looks better here than it is."] : []),
    ];
    return [headTurned ? out[0] : ui.h("strong", {}, avg), ...rest.map((x, i) => (i === 0 ? x.replace(/^ /, "") : x))];
  }
  // the page said "We don't know yet" before (nothing saved for retirement was on file): no answer is put in its mouth (M7)
  const avg = before.unknown ? `If markets do as well as average: ${answerWords(nowAnswer, money, { left: true })}.`
    : `If markets do as well as average, before your change: ${answerWords(before.answer, money, { left: bothLeft })}. Now: ${answerWords(nowAnswer, money, { left: bothLeft })}.`;
  out.push(headTurned || !strongFirst ? avg : ui.h("strong", {}, avg));
  if (moved.length) out.push(` You changed ${moved.slice(0, 2).join(" and ")}.`);
  if (taxMoved) out.push(" You changed when the tax is paid on money at work. This answer does not count the tax that paying later saves you each year, so paying now looks better here than it is.");
  return out;
}

/**
 * "What this rests on" (owner's request 2026-11-11, spec part A, levers.js): the numbers the answer rests on, whose each one is,
 * and what one sensible change to each would do, in the answer's own unit. Open under a short or tight answer, a fold under one
 * that is on track. The rows are drawn as grey records of a fixed height first and filled in after the first paint a slice at a
 * time (careful.js whenWorked, levers.js leverSteps), so nothing above them moves; the five that matter most show, the rest fold.
 */
function leversCard(ctx, d, list, { unknownYet, money, notice = null, leftJust = false, changed = {}, heroLine = null, openSpending = null }) {
  const { ui, fmt, plan } = ctx;
  const today = fmt.today();
  const folded = !unknownYet && d.verdict === "on track";
  const head = ui.h(folded ? "span" : "h2", { class: folded ? "fold-title" : null, id: "lv-head", tabindex: "-1" }, "What this answer rests on");
  const intro = ui.h("p", { class: "muted small" }, unknownYet
    ? "Nothing saved for retirement is on file, so the plan cannot say yet. These are the things it does not count:"
    : "The numbers this answer uses, whose each one is, and what one change would do if markets do as well as average.");
  // a grey record as tall as a filled one, for each row that will show (at most five)
  const bar = (w, h = "0.8em") => ui.h("span", { "aria-hidden": "true", style: { display: "block", width: w, maxWidth: "100%", height: h, borderRadius: "4px", background: "var(--line-2)", margin: "6px 0" } });
  // three rows (simple first, owner 2026-11-12), but never a number that is not counted yet (a match missed, the money left over:
  // a hint worth money is never folded) or one the person just changed
  const must = (r) => r.tag === "missing" || !!changed[r.key] || (leftJust && r.key === "leftover");
  const n = Math.min(list.rows.filter((r) => !r.foldOnly).length, Math.max(SHOWN_ROWS, list.rows.filter((r) => !r.foldOnly && must(r)).length));
  const rowsEl = ui.h("ul", { class: "records lv-rows", "aria-busy": "true" }, Array.from({ length: n }, () => ui.h("li", { style: { minHeight: "128px" } }, bar("60%", "1em"), bar("45%"), bar("85%"), bar("70%"), bar("40%", "2.2em"))));
  const busy = busyWords(ui, "Working out what each number does to the answer.");
  const tail = ui.h("div");
  const body = [intro, notice, busy, rowsEl, tail];
  // folded on track, its line names a number it holds that is not counted yet (the final review F4: the family's left-over, "If
  // it's invested: lasts to the end, with about $4,455,000 more left", sat under "12 numbers")
  const notCounted = list.rows.filter((r) => r.tag === "missing").length;
  const card = folded
    ? ui.h("details", { class: "card fold fold-card lv" }, ui.h("summary", {}, head, ui.h("span", { class: "fold-status" }, notCounted ? `${notCounted} not counted` : `${list.rows.length} numbers`), ui.h("span", { class: "fold-chev" }, "›")), ui.h("div", { class: "fold-body" }, ...body))
    : ui.h("section", { class: "card lv" }, head, ...body);
  card.append(ui.h("style", {}, ".lv .rec-head { flex-wrap: wrap; justify-content: flex-start; gap: 4px 8px; } .lv .rec-head .pill { margin-left: 0; } .lv .lv-eff { margin: 6px 0 0; } .lv .lv-eff p { margin: 2px 0; } .lv .rec-foot { justify-content: flex-start; } .lv-before { margin: 4px 0 8px; } .lv .lv-ans { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); } .lv .lv-ans .chips { flex-wrap: wrap; margin: 8px 0 12px; }"));
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    whenWorked(ctx, rowsEl, { key: keyOf(["levers", today, d.inputs, valuesOf(list), list.rows.map((r) => [r.key, r.tag, r.value])]), steps: () => leverSteps(ctx.store.get(), { today, spare: spareOf(ctx, ctx.store.get(), today), money, d }) }, (r) => fill(r));
  };
  function fill(r) {
    rowsEl.removeAttribute("aria-busy");
    busy.remove();
    if (!r?.ready) { rowsEl.replaceChildren(ui.h("li", {}, ui.h("div", { class: "rec-sub" }, "What each number does could not be worked out just now."))); return; }
    // the left-over just answered stays right under its notice (first), whatever its place in the order; so does a number the
    // person just changed elsewhere, with what it was and what it is now, even one that now moves the answer by less than a
    // year (review 2026-11-12, F3)
    const every = [...r.shown, ...r.folded, ...r.hidden];
    const first = [...(leftJust ? every.filter((x) => x.key === "leftover") : []), ...every.filter((x) => changed[x.key] && !(leftJust && x.key === "leftover"))];
    const rest = r.shown.filter((x) => !first.includes(x));
    const order = [...first, ...rest];
    const lastMust = order.reduce((k, x, i) => (must(x) ? i : k), -1);
    const shown = order.slice(0, Math.max(SHOWN_ROWS, lastMust + 1));
    const folded = [...rest.filter((x) => !shown.includes(x)), ...r.folded.filter((x) => !first.includes(x))];
    const hidden = r.hidden.filter((x) => !first.includes(x));
    rowsEl.replaceChildren(...shown.map((x) => record(x)));
    tail.replaceChildren();
    // the fold's line says how many of its numbers are the person's own, in the words of the line under the answer (owner's rule
    // 4; the final review F4: "6 more numbers" held "How fast investments grow, Yours, stocks 6%" and "How fast prices rise,
    // Yours, 3.5%" without a word)
    const yoursIn = folded.filter((x) => x.tag === "yours").length;
    if (folded.length) tail.append(ui.h("details", { class: "fold" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, `${folded.length} more number${folded.length === 1 ? "" : "s"}${yoursIn ? `, ${yoursIn} you gave us` : ""}`), ui.h("span", { class: "fold-chev" }, "›")), ui.h("ul", { class: "records" }, folded.map((x) => record(x)))));
    // the rest are named, so the count in the answer adds up: each moves it by less than a year (D-A2's hidden rows)
    if (hidden.length) tail.append(ui.h("p", { class: "muted small" }, `Also counted (the change we tried on each moves the answer by less than a year): ${listWords(hidden.map((x) => `${x.name} (${x.short})`))}.`));
  }
  function record(x) {
    const li = ui.h("li", { "data-lever": x.key });
    // the money left over is answered here, in place (spec L4): the button opens the question under the row
    let panel = null;
    // "Answer" only opens (a second tap of a double tap finds the question open, B11); its Cancel closes it
    const close = (btn) => { if (!panel) return; panel.remove(); panel = null; btn.setAttribute("aria-expanded", "false"); btn.focus?.(); };
    const toggle = (btn) => {
      if (panel) { panel.querySelector?.("button")?.focus?.({ preventScroll: true }); return; }
      panel = leftoverPanel(ctx, x, money, () => close(btn), { unknown: unknownYet });
      li.append(panel);
      btn.setAttribute("aria-expanded", "true");
      panel.querySelector?.("button")?.focus?.({ preventScroll: true });
      panel.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    };
    const acts = (x.acts ?? []).map((a) => (a.answer
      ? ui.h("button", { type: "button", class: "btn secondary small", "aria-expanded": "false", onClick: (e) => toggle(e.currentTarget) }, a.label)
      : a.keep
      ? ui.h("button", { type: "button", class: "btn secondary small", onClick: () => keepLeftover(ctx, x, money) }, a.label)
      : a.lower !== undefined
      ? ui.h("button", { type: "button", class: "btn secondary small", onClick: () => lowerNow(ctx, x, a.lower, money) }, a.label)
      // a box further down this same page: opened, scrolled to and focused in place. Never a link to this page's own address
      // (N4: the page was drawn again from the top and then moved, so the second tap of a double tap followed whatever link
      // passed under the thumb), and taps are let go while it glides
      : a.open === "spending"
      ? ui.h("button", { type: "button", class: "btn secondary small", onClick: (e) => { holdTaps(e); openSpending?.(); } }, a.label)
      : a.open === "settings"
      ? ui.h("button", { type: "button", class: "btn secondary small", onClick: (e) => { const s = document.querySelector("details.pj-settings"); if (s) { holdTaps(e); s.open = true; const m = s.querySelector("details.pj-more"); if (m) m.open = true; s.scrollIntoView({ behavior: "smooth", block: "start" }); s.querySelector("input[name=stocksRetired]")?.focus({ preventScroll: true }); } } }, a.label)
      : ui.h("a", { class: "btn secondary small", href: a.href }, a.label)));
    // (the DOM's own append writes a null as the text "null": only the parts there are)
    li.append(...[
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.label), ui.h("span", { class: "pill" }, TAGS[x.tag])),
      ui.h("div", { class: "rec-sub" }, x.value),
      changed[x.key] ? ui.h("p", { class: "small", style: { margin: "4px 0 0" } }, ui.h("strong", {}, "You just changed this: "), changed[x.key], ".") : null,
      x.effects?.length ? ui.h("div", { class: "lv-eff small" }, x.effects.map((t) => ui.h("p", {}, t))) : null,
      x.note ? ui.h("p", { class: "muted small", style: { margin: "4px 0 0" } }, x.note) : null,
      acts.length ? ui.h("div", { class: "rec-foot" }, ...acts) : null].filter(Boolean));
    return li;
  }
  if (folded) card.addEventListener?.("toggle", () => { if (card.open) start(); });
  else start();
  // after an answer saved on the card: the card stays open and its notice is brought into view (a fold on track included); back
  // from a change made elsewhere, the same, unless the hero's own "Before your change" line is on the screen (F3)
  if (notice) {
    if (folded) { card.open = true; start(); }
    notice.setAttribute("tabindex", "-1");
    afterPaint(() => {
      if (!notice.isConnected || (!leftJust && heroLine && onScreen(heroLine))) return;
      notice.scrollIntoView?.({ block: "center" }); notice.focus?.({ preventScroll: true });
    });
  }
  card.__start = start;
  card.__head = head;
  return card;
}
const SHOWN_ROWS = 3;
/** On the screen now (under the top bar): a line the person can read without scrolling. */
function onScreen(el) {
  const r = el.getBoundingClientRect?.();
  if (!r || !(r.height > 0)) return false;
  const top = document.getElementById?.("topbar")?.getBoundingClientRect?.().bottom ?? 0;
  return r.top >= top && r.bottom <= (globalThis.innerHeight ?? 0);
}

/**
 * "What happens to the money left over each month?" answered in place (spec L4, decisions D-B1 to D-B7): invested for later (a
 * monthly row into a brokerage account: one on file, or a new $0 "Investments for later"), it stays in the bank (a row into a
 * savings account, grown at the cash rate), or it gets spent / not sure (the answer only). The amount starts at the left-over
 * rounded down to $10 and is the person's to change; the emergency fund's gap is said first when there is one (D-B4).
 */
function leftoverPanel(ctx, x, money, close, { unknown = false } = {}) {
  const { ui, fmt, plan } = ctx;
  const today = fmt.today();
  const ans = leftoverAnswer(plan);
  let choice = ans?.answer ?? null;
  let gap = 0;
  try { gap = Number(ctx.computeOf?.("balance/liquidity", { today })?.gap) || 0; } catch { gap = 0; }
  const panel = ui.h("div", { class: "lv-ans" });
  const CHOICES = [["invest", "Invested for later"], ["bank", "It stays in the bank"], ["spend", "It gets spent / not sure"]];
  const save = (v) => {
    const fail = (t) => { panel.querySelector(".notice.error")?.remove(); panel.querySelector("form")?.prepend(ui.notice("error", t)); return false; };
    const before = (() => { try { return answerOf(plan, { today }); } catch { return null; } })();
    const total = Math.round(x.total * 100) / 100;
    if (choice === "spend") {
      leftPending = { text: "Saved: the money left over each month is counted as spent, as before.", before, unknown };
      ctx.store.update((draft) => applyLeftover(draft, { answer: "spend", monthly: total, today, personId: x.leadId }));
      return;
    }
    const amount = Number(v.amount);
    if (!(amount > 0)) return fail("Type how much goes there each month, like 500.");
    if (amount > total + 0.5) return fail(`That is more than is left over each month (${money(total)}). Type ${money(Math.floor(total))} or less.`);
    const fresh = choice === "bank" ? { name: "Savings for later", type: "savings" } : { name: "Investments for later", type: "brokerage" };
    const acct = v.accountId && v.accountId !== "new" ? (plan.accounts ?? []).find((a) => a.id === v.accountId) : null;
    // (in the bank it is not saving out of pay: the month's left-over stays as it is, and the money is counted for later; M3)
    leftPending = { text: choice === "bank" ? `Saved: ${fmt.money(amount, plan.meta.currency)} a month stays in ${acct?.name ?? fresh.name}${acct ? "" : " (a new account at $0, on Net worth)"}, counted for later.`
      : `Saved: ${fmt.money(amount, plan.meta.currency)} a month into ${acct?.name ?? fresh.name}${acct ? "" : " (a new account at $0, on Net worth)"}.`, before, unknown };
    ctx.store.update((draft) => applyLeftover(draft, { answer: choice, monthly: total, amount, accountId: acct?.id ?? null, newAccount: acct ? null : { id: ui.uid(), ...fresh }, personId: x.leadId, today }));
  };
  const draw = () => {
    const kids = [
      ui.h("p", { style: { margin: "0" } }, ui.h("strong", {}, `What happens to the ${money(x.total)} left over each month?`)),
      ui.h("div", { class: "chips", role: "group", "aria-label": "What happens to it" }, CHOICES.map(([k, label]) =>
        ui.h("button", { type: "button", class: `chip${choice === k ? " on" : ""}`, "aria-pressed": choice === k ? "true" : "false", onClick: () => { choice = k; draw(); panel.querySelector?.(`[data-choice="${k}"]`)?.focus?.({ preventScroll: true }); }, "data-choice": k }, label))),
    ];
    if (choice === "invest" || choice === "bank") {
      const accts = leftoverAccounts(plan, choice);
      const fresh = choice === "bank" ? "Savings for later" : "Investments for later";
      const was = ans?.row && ans.answer === choice ? ans.row : null;
      if (choice === "invest" && gap > 0.5) kids.push(ui.h("p", { class: "small" }, `Your emergency fund is ${money(gap)} short. Many people fill that first; count only what goes into investments.`));
      kids.push(ui.form([
        { key: "accountId", label: "Into which account", type: "select", options: [...accts.map((a) => ({ value: a.id, label: a.name })), { value: "new", label: `A new account: ${fresh}` }] },
        { key: "amount", label: "How much a month", type: "money", min: 0, required: true, help: `Left over each month: ${money(x.total)}. Count only what really goes there.` },
      // (the amount starts at what was said before, never above what is left over now: B3)
      ], { accountId: was && accts.some((a) => a.id === was.accountId) ? was.accountId : accts[0]?.id ?? "new", amount: was && Number(was.amount) <= x.total + 0.5 ? Math.round(Number(was.amount) * 100) / 100 : x.amount }, save, { submitLabel: "Save my answer", onCancel: close }));
    } else if (choice === "spend") {
      kids.push(ui.h("p", { class: "muted small" }, "The plan keeps counting it as spent: nothing goes into savings for later."));
      kids.push(ui.form([], {}, save, { submitLabel: "Save my answer", onCancel: close }));
    } else kids.push(ui.row(ui.button("Cancel", close, { class: "secondary" })));
    panel.replaceChildren(...kids);
  };
  draw();
  return panel;
}
/**
 * "Still right": the answer asked again is kept as it is, dated today, for the left-over as it is now (D-B6). Never an amount
 * above what is left over now (B3: the row then offers "Lower it" instead, and this does nothing).
 */
function keepLeftover(ctx, x, money) {
  const { fmt, plan } = ctx;
  if ((x.rowMonthly ?? 0) > x.total + 0.5) return;
  const before = (() => { try { return answerOf(plan, { today: fmt.today() }); } catch { return null; } })();
  leftPending = { text: `Saved: still right. We will ask again in a year, or when the ${money(x.total)} left over changes by a lot.`, before };
  ctx.store.update((draft) => { if (draft.retirement?.leftover) { draft.retirement.leftover.on = fmt.today(); draft.retirement.leftover.monthly = Math.round(x.total * 100) / 100; } });
}
/** "Lower it to $1,120" / "Stop counting it": the answered row brought down to what is left over now, or taken out (B3, B7). */
function lowerNow(ctx, x, to, money) {
  const { fmt, plan } = ctx;
  const before = (() => { try { return answerOf(plan, { today: fmt.today() }); } catch { return null; } })();
  leftPending = { text: to > 0 ? `Saved: ${money(to)} a month is counted now (it was ${money(x.rowMonthly ?? 0)}).` : `Saved: the ${money(x.rowMonthly ?? 0)} a month is no longer counted.`, before };
  ctx.store.update((draft) => lowerLeftover(draft, to, { today: fmt.today(), total: x.total }));
}
const listWords = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** The card opened (a fold under an answer on track), brought to the top of the screen and its heading focused. */
function openLevers(card, { smooth = false } = {}) {
  if (card.tagName === "DETAILS") card.open = true;
  card.__start?.();
  card.scrollIntoView?.({ behavior: smooth ? "smooth" : "auto", block: "start" });
  card.__head?.focus?.({ preventScroll: true });
}

// ?check=1 (a link that should land on the card, spec part D): once per arrival, as ?type=spending does; a redraw after a save
// on this page keeps the same route object and is not brought back to it
let checkedFor = null;
function landCheck(ctx, card) {
  if (String(ctx.route?.query?.check ?? "") !== "1" || checkedFor === ctx.route) return;
  checkedFor = ctx.route;
  afterPaint(() => { if (card.isConnected) openLevers(card); });
}
