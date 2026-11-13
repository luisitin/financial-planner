// modules/debt/credit-score/compute.js -- PURE. "Your credit score": the scores a person typed (never from a bureau), what
// each means on its own scale (FICO's five bands, VantageScore's four tiers, none for "Not sure"), the newest per person,
// the one lever that matters most (Credit cards' own figure: how much less on the cards gets the share of the limits in
// use under 30%, then 10%), the freeze ticks per person and bureau, and each person's fraud alert. Sources and read dates
// in README.md. Also the small pure writers the view saves through (saveScore, removeScore, setFreeze, setAlert).
import { compute as computeCards } from "../credit-cards/compute.js";
import { money, pct } from "../../../core/format.js";
import { isYou, NameOf } from "../../../core/words.js";

export const SCALE = Object.freeze({ min: 300, max: 850 });
export const MODELS = Object.freeze(["fico", "vantage", "unsure"]);
export const MODEL_LABELS = Object.freeze({ fico: "FICO", vantage: "VantageScore", unsure: "Not sure" });
/** FICO (myFICO, "What is a credit score?", read 2026-11-13) and VantageScore 4.0 (vantagescore.com, "The complete guide to
 * your VantageScore", published 2025-06-26, read 2026-11-13). `plain` says what a VantageScore tier means for a borrower,
 * in that guide's own terms. */
export const BANDS = Object.freeze({
  fico: Object.freeze([{ lo: 300, hi: 579, label: "poor" }, { lo: 580, hi: 669, label: "fair" }, { lo: 670, hi: 739, label: "good" }, { lo: 740, hi: 799, label: "very good" }, { lo: 800, hi: 850, label: "exceptional" }]),
  vantage: Object.freeze([{ lo: 300, hi: 600, label: "subprime", plain: "where a lender might say no" }, { lo: 601, hi: 660, label: "near prime", plain: "higher rates than prime" },
    { lo: 661, hi: 780, label: "prime", plain: "lower rates than near prime" }, { lo: 781, hi: 850, label: "superprime", plain: "the top tier" }]),
});
export const BUREAUS = Object.freeze([{ key: "equifax", name: "Equifax" }, { key: "experian", name: "Experian" }, { key: "transunion", name: "TransUnion" }]);
/** What goes into a FICO score (myFICO, "What's in my FICO Scores", read 2026-11-13). */
export const FICO_PARTS = Object.freeze([{ what: "Paying on time", share: 0.35 }, { what: "How much you owe, and how much of your card limits you use", share: 0.30 },
  { what: "How long you have had credit", share: 0.15 }, { what: "New credit you applied for", share: 0.10 }, { what: "The mix of cards and loans", share: 0.10 }]);
/** A score older than this many days asks for a newer one. */
export const STALE_DAYS = 365;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayNo = (iso) => { const m = ISO.exec(String(iso ?? "")) && String(iso).split("-").map(Number); return m ? Date.UTC(m[0], m[1] - 1, m[2]) / 864e5 : NaN; };
const isScore = (n) => typeof n === "number" && Number.isInteger(n) && n >= SCALE.min && n <= SCALE.max;

/** "November 2, 2026" from "2026-11-02"; "" for anything else. */
export function longDate(iso) {
  if (!ISO.test(String(iso ?? ""))) return "";
  const [y, m, d] = String(iso).split("-").map(Number);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${d}, ${y}` : "";
}
/** "February 2026" from "2026-02-01". */
const monthYear = (iso) => { const [y, m] = String(iso).split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };

/** The band a whole score from 300 to 850 falls in on its scale ({ lo, hi, label, plain? }), or null ("Not sure", off the scale). */
export function band(score, model) {
  const lines = BANDS[model];
  if (!lines || !isScore(score)) return null;
  return lines.find((b) => score >= b.lo && score <= b.hi) ?? null;
}

/** The adults a score can belong to (the people who are not dependents); one stand-in with no id when there are none. */
export function adultsOf(plan) {
  const people = (plan?.household?.people ?? []).filter((p) => p && p.role !== "dependent");
  return people.length ? people.map((p) => ({ id: p.id ?? "", name: p.name ?? "" })) : [{ id: "", name: "" }];
}

/**
 * compute(plan, { today }) -> {
 *   today, empty, people: [{ id, name, scores (newest first), latest | null, stale }], shown: [the newest score of each person
 *   who has one, in the household's order], more: [every other score, newest first], lever: leverOf(Credit cards),
 *   freeze: { [personId]: { equifax, experian, transunion } }, frozen, bureaus, alerts: { [personId]: { until, active } }
 * }
 * A score is { id, personId, date, score, model, band }. A score whose person is no longer in the plan stays its own when
 * there are two adults, and is read as the one adult's when there is one. Nothing here comes from a bureau.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const c = plan?.credit && typeof plan.credit === "object" ? plan.credit : {};
  const adults = adultsOf(plan);
  const known = new Set(adults.map((a) => a.id));
  const ownerOf = (pid) => (known.has(pid) ? pid : adults.length === 1 ? adults[0].id : pid);
  const scores = (Array.isArray(c.scores) ? c.scores : [])
    .filter((s) => s && typeof s === "object" && isScore(s.score) && ISO.test(String(s.date ?? "")))
    .map((s) => { const model = MODELS.includes(s.model) ? s.model : "unsure"; return { id: String(s.id ?? ""), personId: String(s.personId ?? ""), date: s.date, score: s.score, model, band: band(s.score, model) }; })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const groups = new Map(adults.map((a) => [a.id, { ...a, scores: [] }]));
  for (const s of scores) {
    const o = ownerOf(s.personId);
    if (!groups.has(o)) groups.set(o, { id: o, name: "", scores: [] });
    groups.get(o).scores.push(s);
  }
  const t = dayNo(today);
  const people = [...groups.values()].map((g) => ({ ...g, latest: g.scores[0] ?? null, stale: !!g.scores[0] && Number.isFinite(t) && t - dayNo(g.scores[0].date) > STALE_DAYS }));
  const shown = people.filter((p) => p.latest).map((p) => p.latest);
  const shownIds = new Set(shown);
  const more = scores.filter((s) => !shownIds.has(s));
  // the freeze ticks and the fraud alerts, per adult (an entry for someone no longer in the plan is not counted)
  const fz = c.freeze && typeof c.freeze === "object" && !Array.isArray(c.freeze) ? c.freeze : {};
  const freeze = Object.fromEntries(adults.map((a) => [a.id, Object.fromEntries(BUREAUS.map((b) => [b.key, fz[a.id]?.[b.key] === true]))]));
  const frozen = Object.values(freeze).reduce((n, f) => n + Object.values(f).filter(Boolean).length, 0);
  const al = c.alertUntil && typeof c.alertUntil === "object" && !Array.isArray(c.alertUntil) ? c.alertUntil : {};
  const alerts = Object.fromEntries(adults.filter((a) => ISO.test(String(al[a.id] ?? ""))).map((a) => [a.id, { until: al[a.id], active: !(dayNo(al[a.id]) < t) }]));
  let cards = null;
  try { cards = computeCards(plan, { today }); } catch { cards = null; }
  const lever = leverOf(cards);
  // no "owed of ... in limits" while a card that carries a balance has no limit: its balance would be measured against the
  // other cards' limits (critic g35 #1)
  const cardTotals = cards?.hasData && cards.totalLimit > 0 && !lever.missing ? { balance: cards.totalBalance, limit: cards.totalLimit, share: cards.utilisation } : null;
  return { today, empty: scores.length === 0, people, shown, more, lever, cardTotals,
    freeze, frozen, bureaus: adults.length * BUREAUS.length, alerts };
}

// ---------------------------------------------------------------- the words, one sentence per case (R3, R5)
const personOf = (d, s) => d.people.find((p) => p.scores.includes(s)) ?? { name: "" };
/** "Your score: 712"; for two people "Your score: 712 · Bo's: 655"; "Your credit score" before any score. */
export function headlineOf(d) {
  if (d.empty) return "Your credit score";
  return d.shown.map((s, i) => `${NameOf(personOf(d, s).name)}${i === 0 ? " score" : ""}: ${s.score}`).join(" · ");
}
/** The one sentence under the score, per case: FICO (its band and range), VantageScore (its tier and what it means), Not
 * sure (no band words: which kind it is decides what it means). With two people, led by whose it is ("Yours, seen ..."). */
export function sentenceOf(s, d) {
  const two = d.shown.length > 1, name = personOf(d, s).name;
  const lead = two ? `${isYou(name) ? "Yours" : NameOf(name)}, seen` : "Seen";
  const when = longDate(s.date);
  if (s.model === "fico" && s.band) return `${lead} ${when}: ${s.band.label} on FICO's scale (${s.band.lo} to ${s.band.hi}).`;
  if (s.model === "vantage" && s.band) return `${lead} ${when}: VantageScore calls ${s.band.lo} to ${s.band.hi} ${s.band.label}, ${s.band.plain}.`;
  return `${lead} ${when}. Your app names the kind of score (FICO or VantageScore): pick it with your next score to see what it means.`;
}
/** A second sentence when that person's newest score is more than a year old; else null. */
export function staleSentence(s, d) {
  return personOf(d, s).stale ? "That was over a year ago: your bank or card app may show a newer one." : null;
}
/** The empty page's one sentence. */
export const emptySentence = () => "Type your score and the date you saw it. Your bank or card app often shows it for free.";
/** The green line after a save: the new answer, with its band when it has one. */
export function savedSentence(d, s) {
  const name = personOf(d, s).name;
  // an older score than the one shown goes with the older scores, and the green line says so
  if (!d.shown.includes(s)) return `Saved: ${NameOf(name)} ${s.score} from ${longDate(s.date)} is with the older scores.`;
  const what = `${NameOf(name)} score: ${s.score}`;
  if (s.model === "fico" && s.band) return `Saved. ${what}, ${s.band.label} on FICO's scale.`;
  if (s.model === "vantage" && s.band) return `Saved. ${what}, ${s.band.label} on VantageScore's scale.`;
  return `Saved. ${what}.`;
}

// ---------------------------------------------------------------- the one lever
/**
 * leverOf(Credit cards' compute) -> { kind, amount?, date?, missing? }: "under30" (the cards' combined use is over 30% of
 * their limits: Credit cards' `under.less30`, the amount less on the cards that brings it to 30%), "under10" (between 10%
 * and 30%: `under.less10`), "limits" (no card has a limit typed; or, with `missing` naming them, cards that carry a balance
 * have none: Credit cards adds their balance to what is owed but nothing to the limits, so the share cannot be worked out),
 * "onTime" (no card, or under 10%). A card with nothing owed and no limit does not hold the figure back: its limit could
 * only lower the share, so the amount stays enough.
 */
export function leverOf(cards) {
  if (!cards?.hasData) return { kind: "onTime" };
  const u = cards.under;
  if (!u) return { kind: "limits" };
  const missing = (cards.cards ?? []).filter((c) => c && c.balance > 0.005 && !(c.limit > 0)).map((c) => String(c.name ?? ""));
  if (missing.length) return { kind: "limits", missing };
  if (u.less30 > 0.5) return { kind: "under30", amount: u.less30, date: u.date30 ?? null };
  if (u.less10 > 0.5) return { kind: "under10", amount: u.less10, date: u.date10 ?? null };
  return { kind: "onTime" };
}
/** A card's name inside a sentence: "the Visa card" (it ends in "card"), "Card A" (it starts with the word), "the Gold
 * card" otherwise, "one of your cards" with no name (as Credit cards says it). */
const theCard = (name) => { const n = String(name ?? "").trim(); return !n ? "one of your cards" : /card$/i.test(n) ? `the ${n}` : /^card\b/i.test(n) ? n : `the ${n} card`; };
/** "the Visa card", "the Visa card and the Mastercard", "3 of your cards". */
const cardsNamed = (names) => (names.length === 1 ? theCard(names[0]) : names.length === 2 ? `${theCard(names[0])} and ${theCard(names[1])}` : `${names.length} of your cards`);
/** One sentence per lever; the amount rounded up to the dollar so the share really gets under the line. */
export function leverSentence(l, currency = "USD") {
  const amt = (n) => money(Math.ceil(Number(n) - 1e-9), currency);
  if (l?.kind === "under30") return `Paying ${amt(l.amount)} off your cards would bring the share of your limits in use under 30%.`;
  if (l?.kind === "under10") return `Paying ${amt(l.amount)} off your cards would bring the share of your limits in use under 10%, the best for a score.`;
  if (l?.kind === "limits" && l.missing?.length === 1) return `Add the credit limit of ${cardsNamed(l.missing)} on the Debts page: without it, the share of your limits in use cannot be worked out.`;
  if (l?.kind === "limits" && l.missing?.length) return `Add the credit limits of ${cardsNamed(l.missing)} on the Debts page: without them, the share of your limits in use cannot be worked out.`;
  if (l?.kind === "limits") return "Add your cards' credit limits on the Debts page: how much of them you use is one of the biggest parts of a score.";
  return "Paying every bill on time counts most: it is about a third of a FICO score.";
}
/** "How this is worked out"'s line on the person's own cards, per case: a card with a balance and no limit, no limit at
 * all, or the balance of limits in use with the lever worked out (30% or 10% of the limits, and the amount less). */
export function cardsLine(d, currency = "USD") {
  const l = d?.lever ?? {}, ct = d?.cardTotals, m = (n) => money(n, currency);
  if (l.kind === "limits" && l.missing?.length) { const who = cardsNamed(l.missing); return `${who[0].toUpperCase()}${who.slice(1)} ${l.missing.length === 1 ? "has" : "have"} no credit limit on file, so the share of your limits in use is not worked out.`; }
  if (!ct) return "No card with a credit limit on file, so the share of your limits in use is not worked out.";
  const head = `Your cards: ${m(ct.balance)} owed of ${m(ct.limit)} in limits, ${pct(ct.share, 0)} in use.`;
  if (l.kind === "under30") return `${head} 30% of ${m(ct.limit)} is ${m(0.3 * ct.limit)}, so ${m(Math.ceil(l.amount - 1e-9))} less gets you there.`;
  if (l.kind === "under10") return `${head} 10% of ${m(ct.limit)} is ${m(0.1 * ct.limit)}, so ${m(Math.ceil(l.amount - 1e-9))} less gets you there.`;
  return head;
}

/**
 * "Keep your credit safe"'s status, at most 20 characters. One adult: "none frozen yet", "frozen at 2 of 3", "frozen at
 * all 3" (the three bureaus listed in the part). Two or more: counted in people frozen at all three bureaus (a freeze
 * keeps new credit out only where it is placed): "1 of 2 people frozen", "both frozen at all 3", "all 3 people frozen",
 * "partly frozen" (ticks, but nobody at all three yet). Never "3 of 6" (critic g35 #2: nobody can tell what 6 counts).
 */
export function safeStatus(d) {
  if (!d.frozen) return "none frozen yet";
  const per = Object.values(d.freeze ?? {});
  if (per.length <= 1) return d.frozen === d.bureaus ? `frozen at all ${d.bureaus}` : `frozen at ${d.frozen} of ${d.bureaus}`;
  const all = per.filter((f) => BUREAUS.every((b) => f?.[b.key])).length, n = per.length;
  if (all === n) return n === 2 ? "both frozen at all 3" : `all ${n} people frozen`;
  if (!all) return "partly frozen";
  const s = `${all} of ${n} people frozen`;
  return s.length <= 20 ? s : `${all} of ${n} frozen`;
}
/** The small line's words: "Your scores from 662 in February 2026 to 712 in November 2026" (oldest to newest), or null under three. */
export function trendWords(person) {
  const s = person?.scores ?? [];
  if (s.length < 3) return null;
  const first = s[s.length - 1], last = s[0];
  return `${NameOf(person.name)} scores from ${first.score} in ${monthYear(first.date)} to ${last.score} in ${monthYear(last.date)}`;
}

// ---------------------------------------------------------------- the writers (the view calls them inside store.update)
const section = (plan) => { if (!plan.credit || typeof plan.credit !== "object" || Array.isArray(plan.credit)) plan.credit = {}; return plan.credit; };
/** Nothing typed any more: the section goes, so a plan with nothing typed is as before. */
function tidy(plan) {
  const c = plan.credit;
  if (!c) return;
  if (Array.isArray(c.scores) && !c.scores.length) delete c.scores;
  if (c.freeze && typeof c.freeze === "object") { for (const [k, v] of Object.entries(c.freeze)) if (!v || !Object.values(v).some((x) => x === true)) delete c.freeze[k]; if (!Object.keys(c.freeze).length) delete c.freeze; }
  if (c.alertUntil && typeof c.alertUntil === "object" && !Object.keys(c.alertUntil).length) delete c.alertUntil;
  if (!Object.keys(c).length) delete plan.credit;
}
/** Save a typed score: { id, personId, date, score, model }. The same person and day again replaces that score. Returns
 * "added", "replaced", or null when it is not a whole score from 300 to 850 on a date with a known kind (nothing saved). */
export function saveScore(plan, { id, personId = "", date, score, model }) {
  if (!isScore(score) || !ISO.test(String(date ?? "")) || !MODELS.includes(model)) return null;
  const c = section(plan);
  c.scores = Array.isArray(c.scores) ? c.scores : [];
  const entry = { id: String(id), personId: String(personId ?? ""), date, score, model };
  const at = c.scores.findIndex((s) => s && String(s.personId ?? "") === entry.personId && s.date === date);
  if (at >= 0) { c.scores[at] = { ...entry, id: c.scores[at].id ?? entry.id }; return "replaced"; }
  c.scores.push(entry);
  return "added";
}
/** Remove one score by its id. */
export function removeScore(plan, id) {
  if (!Array.isArray(plan.credit?.scores)) return;
  plan.credit.scores = plan.credit.scores.filter((s) => s?.id !== id);
  tidy(plan);
}
/** Tick or untick a freeze at one bureau for one person. */
export function setFreeze(plan, personId, bureau, on) {
  if (!BUREAUS.some((b) => b.key === bureau)) throw new Error(`not a bureau: ${bureau}`);
  const c = section(plan);
  c.freeze = c.freeze && typeof c.freeze === "object" && !Array.isArray(c.freeze) ? c.freeze : {};
  const mine = { ...(c.freeze[personId] ?? {}) };
  if (on) mine[bureau] = true; else delete mine[bureau];
  c.freeze[personId] = mine;
  tidy(plan);
}
/** The last day of a person's fraud alert ("" removes it). */
export function setAlert(plan, personId, until) {
  const c = section(plan);
  c.alertUntil = c.alertUntil && typeof c.alertUntil === "object" && !Array.isArray(c.alertUntil) ? c.alertUntil : {};
  if (ISO.test(String(until ?? ""))) c.alertUntil[personId] = until; else delete c.alertUntil[personId];
  tidy(plan);
}
