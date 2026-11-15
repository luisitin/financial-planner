// modules/investments/glide-path/risk.js -- PURE. "Five questions about how much ups and downs suit you" (gap list, next
// 60, item 14; map G4): five answers give a range of stock share by the app's own rule of thumb (README "The five
// questions"), shown beside the page's age-based share and the plan's own. Information, not advice: nothing here writes
// the plan, and compute() in compute.js is not changed by any of this (the view calls these beside it). Also the hero's
// words, one written sentence per case (opt spec R3, R5), so each case is tested here.

/** The five questions, in the order shown. `cap` (question 1) is the highest band the date allows; `points` the rest. */
export const QUESTIONS = Object.freeze([
  { key: "when", ask: "When will you need most of this money?", help: "Taking it out over years? Pick the middle year.",
    answers: [{ value: "under3", label: "Within 3 years", cap: 0 }, { value: "3to10", label: "3 to 10 years", cap: 2 }, { value: "10to20", label: "10 to 20 years", cap: 3 }, { value: "over20", label: "Over 20 years", cap: 4 }] },
  { key: "income", ask: "How steady is your income?", help: "A pension or Social Security counts as very steady.",
    answers: [{ value: "unsteady", label: "Uncertain", points: 0 }, { value: "fair", label: "Fairly steady", points: 1 }, { value: "steady", label: "Very steady", points: 2 }] },
  { key: "fall", ask: "If your investments fell 20% in a few months, what would you do?",
    answers: [{ value: "sell", label: "Sell", points: 0 }, { value: "wait", label: "Wait it out", points: 1 }, { value: "buy", label: "Buy more", points: 2 }] },
  { key: "year", ask: "How would you feel about a year when your investments lose a third (about $33,000 of every $100,000)?",
    answers: [{ value: "cannot", label: "Could not stand it", points: 0 }, { value: "worry", label: "Worried, but hold on", points: 1 }, { value: "fine", label: "Part of investing", points: 2 }] },
  { key: "know", ask: "How much do you know about investing?",
    answers: [{ value: "little", label: "Very little", points: 0 }, { value: "some", label: "Some", points: 1 }, { value: "lot", label: "A lot", points: 2 }] },
]);
export const KEYS = Object.freeze(QUESTIONS.map((q) => q.key));
/** The five ranges of stock share, low to high (band 0 to 4). */
export const BANDS = Object.freeze([[0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 0.8], [0.8, 1]].map((b) => Object.freeze(b)));
/** The band the points of questions 2 to 5 give (0 to 8 points): 0-2 -> 20% to 40%, 3-4 -> 40% to 60%, 5-6 -> 60% to
 *  80%, 7-8 -> 80% to 100%. No points alone give 0% to 20%: only money needed within 3 years does. */
export const pointsBand = (points) => (points <= 2 ? 1 : points <= 4 ? 2 : points <= 6 ? 3 : 4);
const answerOf = (key, value) => QUESTIONS.find((q) => q.key === key)?.answers.find((x) => x.value === value) ?? null;

/** Only the answers this page knows, every key present (null when not answered). */
export function cleanAnswers(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(KEYS.map((k) => [k, answerOf(k, src[k]) ? src[k] : null]));
}
/** The saved answers (plan.whatIfs.riskCheck), or null when none of them is one this page knows. */
export function answersOf(plan) {
  const a = cleanAnswers(plan?.whatIfs?.riskCheck);
  return KEYS.some((k) => a[k]) ? a : null;
}
/** The answers in a line, as the chips say them ("Over 20 years · Fairly steady · ..."); unanswered ones left out. */
export function answersLine(raw) {
  const a = cleanAnswers(raw);
  return QUESTIONS.filter((q) => a[q.key]).map((q) => answerOf(q.key, a[q.key]).label).join(" · ");
}
/** The same five answers (both null, or each the same). */
export function sameAnswers(a, b) {
  const x = cleanAnswers(a), y = cleanAnswers(b);
  return KEYS.every((k) => x[k] === y[k]);
}

/**
 * riskRange(answers) -> { answers, answered, missing: [keys], complete, points (0-8), fromPoints (band), cap (band),
 *   capped (the date lowers the range), band, low, high }
 * The rule: add the points of questions 2 to 5; their band; the date's cap; the range is the lower band of the two.
 */
export function riskRange(raw) {
  const answers = cleanAnswers(raw);
  const missing = KEYS.filter((k) => !answers[k]);
  const out = { answers, answered: KEYS.length - missing.length, missing, complete: missing.length === 0, points: null, fromPoints: null, cap: null, capped: false, band: null, low: null, high: null };
  if (!out.complete) return out;
  const points = ["income", "fall", "year", "know"].reduce((s, k) => s + answerOf(k, answers[k]).points, 0);
  const fromPoints = pointsBand(points), cap = answerOf("when", answers.when).cap;
  const band = Math.min(fromPoints, cap);
  return { ...out, points, fromPoints, cap, capped: cap < fromPoints, band, low: BANDS[band][0], high: BANDS[band][1] };
}

/** Where a stock share sits against the range: "inside" (the edges included), "above", "below", or null (no range yet,
 *  or no share: only a number is a share, so "" or null is never read as 0%). */
export function compareShare(share, r) {
  const s = share;
  if (!r?.complete || typeof s !== "number" || !Number.isFinite(s)) return null;
  if (s < r.low - 1e-9) return "below";
  if (s > r.high + 1e-9) return "above";
  return "inside";
}

const pct = (x) => `${Math.round(Number(x) * 100)}%`;
/** "40% to 60%" (a band's two ends). */
export const bandText = (b) => `${pct(BANDS[b][0])} to ${pct(BANDS[b][1])}`;
export const rangeText = (r) => (r?.complete ? bandText(r.band) : "");
/** "40–60%", for a part's status (at most 20 characters with "set by you · "). */
export const rangeShort = (r) => (r?.complete ? `${Math.round(r.low * 100)}–${Math.round(r.high * 100)}%` : "");

// ---------------------------------------------------------------- the words (one written sentence per case, each tested)
/** While the answers are not all in (R5: none, one, two, three, four). */
export function progressSentence(r) {
  const n = r?.answered ?? 0;
  if (r?.complete || n === 0) return "";
  if (n === 4) return "4 of 5 answered: answer the last one to see a range.";
  if (n === 3) return "3 of 5 answered: answer the other 2 to see a range.";
  if (n === 2) return "2 of 5 answered: answer the other 3 to see a range.";
  return "1 of 5 answered: answer the other 4 to see a range.";
}
const WHEN_WORDS = { under3: "within 3 years", "3to10": "in 3 to 10 years", "10to20": "in 10 to 20 years" };
/** Why the range is lower than the other answers alone give: how soon the money is needed caps it. Empty when it does not. */
export function capSentence(r) {
  if (!r?.complete || !r.capped) return "";
  return `Money you need ${WHEN_WORDS[r.answers.when]} has little time to wait out a fall, so how soon you need the money counts most: ${bandText(r.cap)}. Your other answers alone give ${bandText(r.fromPoints)}.`;
}
/** A share against the range (R5: inside, above, below), for what is held now ("held", when holdings are on file: the
 *  share the money really has) or for the plan's own share ("plan", while no holdings are on file). */
export function compareSentence(kind, share, whose = "plan") {
  const p = pct(share);
  const who = whose === "held" ? `The ${p} you hold in stocks` : `Your plan's ${p} in stocks`;
  if (kind === "inside") return `${who} is inside the range your answers give.`;
  if (kind === "above") return `${who} is above the range your answers give: a bad year would shake it more than your answers say you would like.`;
  if (kind === "below") return `${who} is below the range your answers give: it may grow more slowly than you could accept.`;
  return "";
}
/** With holdings on file, the plan's own share after the held one (the link under it changes the plan's share): "too"
 *  when it sits where the held share does (R5: inside, above, below, each alone or "too"). */
export function planAlsoSentence(planKind, heldKind, share) {
  if (!["inside", "above", "below"].includes(planKind)) return "";
  return `Your plan's ${pct(share)} is ${planKind} it${planKind === heldKind ? " too" : ""}.`;
}
export const NOT_ADVICE = "Not advice: the app's own rule of thumb.";

/** What the hero's headline names a path by, when holdings are on file. */
const SAYS = { plan: "your plan's path says", age: "110 minus your age says", "target-date": "a target-date fund holds" };
/**
 * heroWords(d) -> { head, lede, case }: the page's headline and its one sentence (R3, R5), from compute()'s output.
 * Six cases: no holdings and the path glides ("glides"), stays flat ("flat") or is already at its retirement share
 * ("retired"); holdings on the path ("on"), with more stock ("more") or less ("fewer").
 */
export function heroWords(d) {
  if (d.actual === null || d.actual === undefined) {
    const lede = "Add your holdings to see where you stand against this path.";
    const thisYear = d.rows?.[0]?.year ?? null;
    if (thisYear !== null && !(d.retireYear > thisYear)) return { case: "retired", head: `${pct(d.stocksRetired)} in stocks, your plan's share in retirement`, lede };
    if (pct(d.stocksNow) === pct(d.stocksRetired)) return { case: "flat", head: `${pct(d.stocksNow)} in stocks now and when you retire, on your plan's path`, lede };
    return { case: "glides", head: `${pct(d.stocksNow)} in stocks now; about ${pct(d.stocksRetired)} when you retire, on your plan's path`, lede };
  }
  const head = `You hold ${pct(d.actual)} in stocks; ${SAYS[d.rule] ?? SAYS.plan} ${pct(d.suggested)}`;
  const off = Math.round(Math.abs(d.gap) * 100);
  if (d.verdict === "on path") return { case: "on", head, lede: "That is within five points: you are on the path." };
  if (d.verdict === "more stocks than the path") return { case: "more", head, lede: `That is ${off} points more than the path: a bad year would hit harder than the plan assumes.` };
  return { case: "fewer", head, lede: `That is ${off} points less than the path: growth would lag what the plan assumes.` };
}
