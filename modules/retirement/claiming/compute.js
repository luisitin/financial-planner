// modules/retirement/claiming/compute.js -- PURE. When to start Social Security: the pair of claiming ages (or the one age)
// that pays the most over your lives, weighed by the chance of being alive each year, in today's dollars (gap design #7,
// 2026-11-13). The money rules are Social Security's own page's (pairYears in ../social-security/compute.js: the reduction
// for starting early, the credits for waiting, a spouse's top-up, the widow(er)'s check); the odds of living are How long
// to plan for's (survival in ../longevity/compute.js). Every pair is tried (at most 9 x 9 ages): the best is the largest
// total. Formulas, sources and read dates: README.md.
import { compute as socialSecurity, pairYears, ageWords } from "../social-security/compute.js";
import { survival } from "../longevity/compute.js";
import { nameIn, NameIn, nameOf, NameOf, verbFor, isYou } from "../../../core/words.js";

/** How much less each later year counts, the page's chips (a real rate: today's dollars). The plan's figure wins. */
export const RATE_PRESETS = [0, 0.01, 0.02];
/** The most the page's own box takes, 10% a year. */
export const RATE_MAX = 0.1;
/** The plan's rate, 0 to 10%: absent or not a number reads as 0; a figure outside the range (an imported plan: -50% gave
 * totals near $2e14) reads as the nearest end, as the box would have kept it (critic g16 #3). */
export const rateOf = (plan) => { const r = Number(plan.retirement?.claimingRate); return Number.isFinite(r) ? Math.min(RATE_MAX, Math.max(0, r)) : 0; };
/** The plan's ages within 2% of the best total: a close call, "any of them is a sound choice". */
export const CLOSE = 0.02;
/** Within 0.1% of the best total: the plan's ages already pay the most (a rounding apart). */
export const SAME = 0.001;
/** The age the year-by-year sum runs to. */
export const LAST_AGE = 110;
export const HEALTH = ["worse", "average", "better"];

const month = (a) => Math.round(a * 12) / 12;
const near = (a, b) => Math.abs(a - b) < 1 / 24;

/** The claim ages to try for someone `ageNow` years old today (exact, months as a fraction): 62 to 70, whole years, from
 * today's age on; past 62, "now" (today's age to the month, as the Social Security page offers it) comes first. */
export function agesFor(ageNow) {
  const out = [];
  const now = Number.isFinite(ageNow) && ageNow > 62 ? Math.min(70, Math.ceil(ageNow * 12 - 1e-9) / 12) : 62;
  if (now > 62 && !Number.isInteger(now)) out.push(now);
  for (let a = 62; a <= 70; a++) if (a >= now - 1e-9) out.push(a);
  return out;
}

/**
 * The odds tables for one person: alive[k] = the chance of being alive in the middle of year k (k = 0 is the year from
 * today), dies[d] = the chance of dying in year d (from the middle of year d - 1 to the middle of year d), so that the
 * chance of having died by the middle of year k is the sum of dies[0..k]. From longevity's survival(age, toAge, { sex, health }).
 */
export function oddsOf(ageNow, years, opts = {}) {
  const S = (t) => (t <= 0 ? 1 : survival(ageNow, ageNow + t, opts));
  const alive = Array.from({ length: years }, (_, k) => S(k + 0.5));
  const dies = Array.from({ length: years }, (_, d) => S(d - 0.5) - S(d + 0.5));
  return { alive, dies };
}

/**
 * lifetime(py, odds, { rate }) -> the pair's total: for each year k, weighed by (1 + rate)^-(k + 0.5),
 *   both alive  P(a) P(b) x (each own benefit + each spouse's top-up)
 *   one alive   P(a) x sum over the years d <= k the other died in of P(died in d) x alone(a, k, d), and the same for b
 * with the two lives taken as independent. One person: P(a) x own benefit. `py` is pairYears(...)'s result.
 */
export function lifetime(py, odds, { rate = 0 } = {}) {
  const [a, b] = py.ids;
  let total = 0;
  // the widow(er)'s amount on a record takes only a few values over the death years (the full-age amount before starting,
  // a step a year from full retirement age to the claim age, then one figure): the chance of each, summed as the years go
  const diedA = new Map(), diedB = new Map();
  const add = (m, base, q) => { if (q) m.set(base, (m.get(base) ?? 0) + q); };
  for (let k = 0; k < py.years; k++) {
    const v = (1 + rate) ** -(k + 0.5);
    const A = odds[a].alive[k];
    if (!b) { total += v * A * py.own[a][k]; continue; }
    const B = odds[b].alive[k];
    add(diedB, py.widow[b][k], odds[b].dies[k]);
    add(diedA, py.widow[a][k], odds[a].dies[k]);
    let onlyA = 0, onlyB = 0;
    for (const [base, q] of diedB) onlyA += q * py.aloneWith(a, k, base);
    for (const [base, q] of diedA) onlyB += q * py.aloneWith(b, k, base);
    total += v * (A * B * (py.own[a][k] + py.own[b][k] + py.topUp[a][k] + py.topUp[b][k]) + A * onlyA + B * onlyB);
  }
  return total;
}
/** The same sum death year by death year (no grouping): the slow, plain form, kept for the tests. */
export function lifetimePlain(py, odds, { rate = 0 } = {}) {
  const [a, b] = py.ids;
  let total = 0;
  for (let k = 0; k < py.years; k++) {
    const v = (1 + rate) ** -(k + 0.5);
    const A = odds[a].alive[k];
    if (!b) { total += v * A * py.own[a][k]; continue; }
    const B = odds[b].alive[k];
    let onlyA = 0, onlyB = 0;
    for (let d = 0; d <= k; d++) { onlyA += odds[b].dies[d] * py.alone(a, k, d); onlyB += odds[a].dies[d] * py.alone(b, k, d); }
    total += v * (A * B * (py.own[a][k] + py.own[b][k] + py.topUp[a][k] + py.topUp[b][k]) + A * onlyA + B * onlyB);
  }
  return total;
}

/** "about $38,000": to the nearest $1,000 from $10,000, to $100 from $1,000, else to $10. */
export const roundAbout = (x) => { const n = Math.abs(Number(x) || 0), s = n >= 10000 ? 1000 : n >= 1000 ? 100 : 10; return Math.round(n / s) * s; };

/**
 * compute(plan, { today }) -> {
 *   state: "noPeople" | "empty" | "fixed" | "now" | "best" | "close" | "gain",
 *   ready (an answer with ages: best, close or gain), couple (two adults with birth dates), married, rate,
 *   people: [{ id, name, ageNow, varies, why: null | "claimed" | "over70" | "noFigure", ages (to try), planAge, bestAge,
 *     monthlyAtBest (a month, at the best ages), health, sex, odds85, odds95 (the chance of reaching 85 and 95) }],
 *   pairs: [{ ages: { id: age }, total }] best first, best, plan (the ages in the plan), gain (best less plan, today's dollars),
 *   apply: { id: age } | null (what "Use these ages" writes: the best age of each person who can still choose),
 *   survivor: { keeps, from } | null (a married couple: who keeps whose larger check), noFigure: [ids], set: { rate, health },
 *   yearly (the household's Social Security a year in the plan, from the Social Security page),
 *   left: [{ id, name, why: "noBirth" | "third" }] (adults this page leaves out: no birth date, or past the first two)
 * }
 * Each person also carries pastAge (the claim age in the plan when the Social Security page says it has passed, else
 * null) and planMonthly (what the plan counts a month for them, the Social Security page's figure).
 * plan.retirement.claimingRate (optional, a real rate, default 0): how much less each later year counts (rateOf).
 */
export function compute(plan, params = {}) {
  const today = params.today ?? new Date().toISOString().slice(0, 10);
  const ss = socialSecurity(plan, { today });
  const rate = rateOf(plan);
  const lg = plan.retirement?.longevity ?? {};
  const married = !(plan.household?.people ?? []).some((p) => p.role !== "dependent" && p.relation === "partner");
  // the pair: the first two adults with a birth date, as the Social Security page pairs them (couple(), pairYears); anyone
  // else is left out of the answer and said on the page, never dropped without a word (critic g16 #4)
  const dated = ss.people.filter((p) => p.birthYear && Number.isFinite(p.ageNow));
  const adults = dated.slice(0, 2);
  const left = ss.people.filter((p) => !adults.includes(p)).map((p) => ({ id: p.id, name: p.name, why: dated.includes(p) ? "third" : "noBirth" }));
  const base = { ready: false, couple: adults.length === 2, married, rate, people: [], pairs: [], best: null, plan: null, gain: 0, apply: null, survivor: null, noFigure: [], yearly: ss.householdYearly,
    set: { rate: rate !== 0, health: 0 }, left };
  if (!adults.length) return { ...base, state: "noPeople" };
  const people = adults.map((p) => {
    const opts = { sex: lg[p.id]?.sex ?? "", health: lg[p.id]?.health ?? "average" };
    const why = p.claimed ? "claimed" : p.source === "none" ? "noFigure" : p.ageNow >= 70 - 1 / 24 ? "over70" : null;
    const ages = why === null ? agesFor(p.ageNow) : [why === "over70" ? 70 : p.claimAge];
    // the age in the plan, as the plan counts it. One gone by without a claim stays what it is (critic g16 #1: it was shown
    // as today's age): the Social Security page says it has passed and the plan counts that age's check from today. It is
    // not one of the ages tried, as it cannot be chosen any more. One still ahead with months is tried as it is.
    const gone = why === null && p.claimAge < p.ageNow - 1 / 24;
    let planAge = why !== null ? ages[0] : gone ? month(p.claimAge) : Math.min(70, Math.max(ages[0], p.claimAge));
    if (why === null && !gone && !ages.some((a) => near(a, planAge))) { ages.push(month(planAge)); ages.sort((x, y) => x - y); planAge = month(planAge); }
    else if (why === null && !gone) planAge = ages.find((a) => near(a, planAge));
    const odds = (age) => (p.ageNow >= age ? 1 : survival(p.ageNow, age, opts));
    return { id: p.id, name: p.name, ageNow: p.ageNow, varies: why === null, why, ages, planAge, bestAge: planAge, monthlyAtBest: 0, health: opts.health, sex: opts.sex, odds85: odds(85), odds95: odds(95),
      pastAge: p.pastClaimAge ? p.claimAge : null, planMonthly: Number(p.monthly) || 0, src: p };
  });
  const noFigure = people.filter((p) => p.why === "noFigure").map((p) => p.id);
  const set = { rate: base.set.rate, health: people.filter((p) => lg[p.id]?.health && lg[p.id].health !== "average").length };
  const shared = { ...base, people, noFigure, set, yearly: ss.householdYearly };
  if (people.every((p) => p.why === "noFigure")) return { ...shared, people: strip(people), state: "empty" };
  const years = Math.max(1, Math.min(120, Math.ceil(LAST_AGE - Math.min(...people.map((p) => p.ageNow)))));
  const odds = Object.fromEntries(people.map((p) => [p.id, oddsOf(p.ageNow, years, { sex: p.sex, health: p.health })]));
  const value = (ages) => lifetime(pairYears(ss.people, ages, { married, years }), odds, { rate });
  const fixedAges = Object.fromEntries(people.map((p) => [p.id, p.planAge]));
  const varying = people.filter((p) => p.varies);
  const planTotal = value(fixedAges);
  const planPair = { ages: { ...fixedAges }, total: planTotal };
  const monthlyAt = (ages) => { const py = pairYears(ss.people, ages, { married, years }); return Object.fromEntries(people.map((p) => [p.id, Math.max(...py.own[p.id]) / 12])); };
  const survivorOf = (ages) => {
    if (!married || people.length < 2) return null;
    const m = monthlyAt(ages), py = pairYears(ss.people, ages, { married, years });
    const [h, l] = [...people].sort((x, y) => m[y.id] - m[x.id]);
    // the larger check, kept: what a widow(er) gets on the larger one's record once they had started, over the other's own
    const kept = py.widow[h.id][years];
    return kept > m[l.id] + 0.5 ? { keeps: l.id, from: h.id } : null;
  };
  if (!varying.length) {
    const state = people.some((p) => p.why === "over70") ? "now" : "fixed";
    return { ...shared, people: strip(people.map((p) => ({ ...p, monthlyAtBest: monthlyAt(fixedAges)[p.id] }))), state, best: planPair, plan: planPair };
  }
  // every pair: the ages of whoever can still choose, the others as they are
  const pairs = [];
  const tryAll = (i, ages) => {
    if (i === varying.length) { pairs.push({ ages: { ...ages }, total: value(ages) }); return; }
    for (const a of varying[i].ages) tryAll(i + 1, { ...ages, [varying[i].id]: a });
  };
  tryAll(0, { ...fixedAges });
  const best = bestOf(pairs);
  const gain = best.total - planTotal;
  // "already pays the most" only for ages in the plan that can still be chosen: an age gone by is at most a close call
  const planTried = varying.every((p) => p.ages.some((a) => near(a, p.planAge)));
  const state = planTried && gain <= SAME * best.total ? "best" : gain < CLOSE * best.total ? "close" : "gain";
  const shownBest = state === "best" ? planPair : best;
  const atBest = monthlyAt(shownBest.ages);
  const out = people.map((p) => ({ ...p, bestAge: shownBest.ages[p.id], monthlyAtBest: atBest[p.id] }));
  const apply = state === "best" ? null : Object.fromEntries(varying.map((p) => [p.id, month(best.ages[p.id])]));
  const sorted = [...pairs].sort((x, y) => y.total - x.total);
  return { ...shared, ready: true, state, people: strip(out), pairs: sorted, best: shownBest, plan: planPair, gain: Math.max(0, gain), apply, survivor: survivorOf(shownBest.ages) };
}
/** The largest total; on a tie, the first tried (the earlier ages). */
export function bestOf(pairs) {
  let best = null;
  for (const p of pairs) if (!best || p.total > best.total + 1e-9) best = p;
  return best;
}
const strip = (people) => people.map(({ src, ...p }) => p);

// ---------------------------------------------------------------- the page's words (one written sentence per case; README)
const whose = (p) => (isYou(p.name) ? "yours" : nameOf(p.name));   // "Starting yours at 70", "Starting Ana's at 70"
const A = (x) => ageWords(x);
/**
 * words(d, money) -> { title, lede, survivor, link, ask, noFigure, passed, left }: the headline, its sentence for the case,
 * the sentence on the survivor, and what Social Security's "More on this" row says under its question (null: no row);
 * never folded: a partner with no figure, a claim age gone by (the Social Security page's own sentence) and the adults
 * this page leaves out. `money` formats an amount ("$38,000").
 */
export function words(d, money) {
  const two = d.people.length === 2;
  const ask = two ? "When should each of us start?" : "When should I start?";
  const g = money(roundAbout(d.gain));
  const vary = d.people.filter((p) => p.varies);
  const [a, b] = vary;
  const noFig = d.people.filter((p) => p.why === "noFigure");
  const noFigure = noFig.length && d.ready ? `${NameOf(noFig[0].name)} Social Security is not in the plan yet, so only what ${nameIn(noFig[0].name)} would get as a widow or widower is counted.` : "";
  // a claim age gone by, as the Social Security page says it (critic g16 #1)
  const passed = d.people.filter((p) => p.pastAge !== null && p.pastAge !== undefined)
    .map((p) => `The plan has ${nameIn(p.name)} claiming at ${A(p.pastAge)}, which has passed, so it counts ${money(p.planMonthly)} a month.`).join(" ");
  const out = { title: "When to start Social Security", lede: "", survivor: "", link: null, ask, noFigure, passed, left: d.state === "noPeople" ? "" : leftWords(d.left ?? []) };
  if (d.state === "noPeople") return { ...out, lede: "First add the adults in your home, with their birth dates." };
  if (d.state === "empty") return { ...out, lede: "The best age to start depends on what you would get. Add your Social Security figure first, from your ssa.gov account or your statement." };
  if (d.state === "fixed") {
    const withFig = d.people.filter((p) => p.why === "claimed");
    const lede = withFig.length === 2 ? "You both already get Social Security, so there is no age left to choose."
      : `${NameIn(withFig[0].name)} already ${verbFor(withFig[0].name, "gets", "get")} Social Security, so there is no age left to choose.`;
    return { ...out, title: "No age left to choose", lede };
  }
  if (d.state === "now") return { ...out, title: "Start now", lede: "Waiting past 70 adds nothing, so starting now pays the most." };
  const B = d.best.ages, P = d.plan.ages;
  const sv = d.survivor ? (() => {
    const l = d.people.find((p) => p.id === d.survivor.keeps), h = d.people.find((p) => p.id === d.survivor.from);
    return `If ${nameIn(l.name)} ${verbFor(l.name, "outlives", "outlive")} ${nameIn(h.name)}, ${nameIn(l.name)} ${verbFor(l.name, "keeps", "keep")} ${nameOf(h.name)} larger check.`;
  })() : "";
  out.survivor = sv;
  const kind = vary.length === 2 ? "pair" : two ? "oneOfTwo" : "one";
  if (d.state === "best") {
    const lede = kind === "pair" ? `Starting ${whose(a)} at ${A(B[a.id])} and ${whose(b)} at ${A(B[b.id])}, the ages in your plan, already pays the most over your lives.`
      : kind === "oneOfTwo" ? `Starting ${whose(a)} at ${A(B[a.id])}, the age in your plan, already pays the most over your lives.`
      : `Starting at ${A(B[a.id])}, the age in your plan, already pays the most over your life.`;
    return { ...out, title: kind === "pair" ? "Keep the ages in your plan" : "Keep the age in your plan", lede, link: kind === "pair" ? "The ages in your plan already pay the most" : "The age in your plan already pays the most" };
  }
  const title = kind === "pair" ? `${NameIn(a.name)} at ${A(B[a.id])}, ${nameIn(b.name)} at ${A(B[b.id])}` : kind === "oneOfTwo" ? `Start ${whose(a)} at ${A(B[a.id])}` : `Start at ${A(B[a.id])}`;
  const link = kind === "pair" ? `${NameIn(a.name)} at ${A(B[a.id])}, ${nameIn(b.name)} at ${A(B[b.id])}: about ${g} more over your lives`
    : kind === "oneOfTwo" ? `${NameIn(a.name)} at ${A(B[a.id])}: about ${g} more over your lives` : `At ${A(B[a.id])}: about ${g} more over your life`;
  if (d.state === "gain") {
    const lede = kind === "pair" ? `Starting ${whose(a)} at ${A(B[a.id])} and ${whose(b)} at ${A(B[b.id])} pays the most over your lives: about ${g} more than the ages in your plan (${pairName(d, P, { mid: true })}).`
      : kind === "oneOfTwo" ? `Starting ${whose(a)} at ${A(B[a.id])} pays the most over your lives: about ${g} more than at ${A(P[a.id])}, the age in your plan.`
      : `Starting at ${A(B[a.id])} pays the most over your life: about ${g} more than at ${A(P[a.id])}, the age in your plan.`;
    return { ...out, title, lede, link };
  }
  // close: the plan's ages come within 2% of the best
  const lede = kind === "pair" ? `Starting ${whose(a)} at ${A(B[a.id])} and ${whose(b)} at ${A(B[b.id])} pays the most, but only about ${g} more than the ages in your plan (${pairName(d, P, { mid: true })}). Several pairs come within 2% of each other; any of them is a sound choice.`
    : kind === "oneOfTwo" ? `Starting ${whose(a)} at ${A(B[a.id])} pays the most, but only about ${g} more than at ${A(P[a.id])}, the age in your plan. Several ages come within 2% of each other; any of them is a sound choice.`
    : `Starting at ${A(B[a.id])} pays the most, but only about ${g} more than at ${A(P[a.id])}, the age in your plan. Several ages come within 2% of each other; any of them is a sound choice.`;
  return { ...out, title, lede, link };
}

/** What a pair is called in the list of pairs: "Ana at 69, Bo at 67", "At 69" (one person), "Sam at 69" (one of two).
 * `mid`: inside a sentence ("you at 66, Bo at 67"). Each age is named, so two ages with months never read as one
 * ("68 and 8 months and 66 and 4 months", critic g16 #1). */
export function pairName(d, ages, { mid = false } = {}) {
  const vary = d.people.filter((p) => p.varies);
  if (d.people.length === 1) return `${mid ? "at" : "At"} ${A(ages[vary[0].id])}`;
  return vary.map((p, i) => `${i || mid ? nameIn(p.name) : NameIn(p.name)} at ${A(ages[p.id])}`).join(", ");
}
/** "Cy is left out here: ..." / "Ana's birth date is not in the plan, so Ana is left out here." (critic g16 #4), or "". */
export function leftWords(left) {
  const noBirth = left.filter((x) => x.why === "noBirth").map((x) => `${NameOf(x.name)} birth date is not in the plan, so ${nameIn(x.name)} ${verbFor(x.name, "is", "are")} left out here.`);
  const third = left.filter((x) => x.why === "third");
  const names = third.map((x, i) => (i ? nameIn(x.name) : NameIn(x.name)));
  const list = names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  const many = third.length > 1 || (third.length === 1 && isYou(third[0].name));
  return [...noBirth, ...(third.length ? [`${list} ${many ? "are" : "is"} left out here: this page works out the best ages for two people.`] : [])].join(" ");
}

/** The green line's second sentence after a choice in "Set my own numbers": the answer now (R7), said as moved ("are now")
 * or not ("stay") against `before`, the best ages the page showed when the chip was tapped. */
export function nowWords(d, before = null) {
  if (!d.ready) return "";
  const vary = d.people.filter((p) => p.varies);
  if (d.state === "best") return vary.length === 2 ? "The ages in your plan pay the most." : "The age in your plan pays the most.";
  const kept = !!before && vary.every((p) => before[p.id] !== undefined && Math.abs(before[p.id] - d.best.ages[p.id]) < 1 / 24);
  const what = d.people.length === 1 ? A(d.best.ages[vary[0].id]) : pairName(d, d.best.ages);
  const many = vary.length === 2;
  return `The ${many ? "ages that pay" : "age that pays"} the most ${kept ? (many ? "stay" : "stays") : many ? "are now" : "is now"} ${what}.`;
}
/** "Saved: your plan now starts Ana's at 62 and Bo's at 70." for the ages "Use these ages" wrote. */
export function savedWords(d) {
  const vary = d.people.filter((p) => p.varies && d.apply?.[p.id] !== undefined);
  if (!vary.length) return "";
  if (d.people.length === 1) return `Saved: your plan now starts it at ${A(d.apply[vary[0].id])}.`;
  return `Saved: your plan now starts ${vary.map((p) => `${whose(p)} at ${A(d.apply[p.id])}`).join(" and ")}.`;
}
/** "Back to the ages you had: Ana at 67, Bo at 67." after Undo (each age named, critic g16 #1). */
export function undoWords(d) {
  const vary = d.people.filter((p) => p.varies && d.apply?.[p.id] !== undefined);
  return vary.length === 2 ? `Back to the ages you had: ${pairName(d, d.plan.ages, { mid: true })}.` : `Back to the age you had: ${A(d.plan.ages[vary[0]?.id])}.`;
}
/** "Will the money last? now says ..." from that page's verdict (retirement/projection compute), or "" before it can say. */
export function retireWords(r) {
  if (!r?.ready || !r.verdict) return "";
  return r.verdict === "on track" ? "Will the money last? now says the money lasts to the end of the plan."
    : r.verdict === "tight" ? "Will the money last? now says the money lasts, with little to spare."
    : `Will the money last? now says the money runs out${r.shortAge ? ` at about ${r.shortAge}` : ""}.`;
}
