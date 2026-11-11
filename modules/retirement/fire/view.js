// modules/retirement/fire/view.js -- DOM only. First the answer from the plan itself (the earliest age to stop work with
// the money lasting even in a bad run of years, Social Security and pensions counted, filled in after the first paint; then the age
// if markets do as well as average: compute's withIncome); then the 25-times rule as a quick
// check, folded: the number, how far along you are, the years to get there at the current pace, and the coast figure.
// With no answer from the plan (already retired, no birth date) the rule is the page, as before.
import { compute, carefulAgeSteps, ruleWords, plannedStopWords, otherEndWords } from "./compute.js";
import { whenWorked, keyOf, slot, RULE_WORDS, leftWords, chanceWords, BAD_RUN } from "../careful.js";

const STYLE = `
.fi-root .fi-note { margin-top: 10px; }
.fi-root .fi-rule { margin: 4px 0 12px; }
.fi-root .fold-body h3 { margin: 18px 0 4px; }
.fi-root .fold-body .progress { margin: 8px 0 12px; }
`;

const sayName = (n) => (n === "Me" || !n ? "you" : String(n).replace(/^My (spouse|partner)$/, "your $1"));
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const listOf = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a.at(-1)}` : a[0] ?? "");

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
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
  const ruleLede = `Spending ${money(d.spendingYearly)} a year needs about ${money(d.fiNumber)} to live on for good, taking out ${fmt.pct(d.withdrawalRate, 0)} a year. You have ${money(d.invested)} invested, not counting cash in the bank: ${fmt.pct(d.progress, 0)} of the way.${d.yearsToFi !== null && d.yearsToFi > 0 ? ` At ${money(d.savingYearly)} a year of saving and growth of ${fmt.pct(d.realReturn, 1)} a year above inflation, you get there around ${d.fiYear}${d.fiAge ? ` (age ${d.fiAge})` : ""}.` : ""}`;
  const statRow = () => ui.row(
    ui.stat("Enough to live on", money(d.fiNumber), `${times} times yearly spending`),
    ui.stat("Still to go", money(d.gap), "in today's dollars"),
    ui.stat("Saving a year", money(d.savingYearly), d.savingsRate !== null ? `${fmt.pct(d.savingsRate, 0)} of income: what goes into retirement accounts plus what is left over` : "what goes into retirement accounts plus what is left over"),
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

  if (!w) {
    host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, ruleHead), ui.h("p", { class: "lede" }, ruleLede), progress), ui.card(null, statRow()), ui.card("What moves it", moveList()));
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
    lede = [`Stopping at `, slot(ui, String(age)), `, the money lasts ${BAD_RUN}${leaves}${alongside}. ${avgWords()}`];
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
  // (no height kept: the answer is as long as the placeholder or shorter, and a kept height left a blank gap)
  const fill = (c) => {
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

  // the rule of thumb, folded and said as a comparison (shown at the same weight, or with its own headline, it reads as a
  // rival answer): why it differs, in one line, then its figures
  host.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, `The ${times}-times rule, a quick check`), ui.h("span", { class: "fold-status" }, "for comparison"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" },
      ui.h("p", { class: "fi-rule" }, ruleWords(times, d.healthAdded)),
      ui.h("p", {}, `${d.progress >= 1 ? "By this rule you have enough already. " : d.yearsToFi !== null ? `By this rule: about ${d.yearsToFi} year${d.yearsToFi === 1 ? "" : "s"}. ` : ""}${ruleLede}`), progress, statRow(), ui.h("h3", {}, "What moves it"), moveList()),
  ));
}
