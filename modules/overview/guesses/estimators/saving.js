// modules/overview/guesses/estimators/saving.js -- PURE. Retirement saving and balances (spec 7.B: E12-E17, E40). Formulas and
// sources: ../README.md "Retirement saving and balances".
//
//   account.retire.balance   a 401(k) or 403(b) through work: what people in a work plan have, by pay and age (Vanguard, R2)
//   account.retire.split     a couple's joint figure ("both of ours"), split by pay (R7)
//   account.ira.balance      retirement savings on your own (an IRA): the Survey of Consumer Finances by income and age (R2),
//                            split by pay for a couple
//   account.invest.balance   investments outside retirement: the same survey, funds held
//   account.cash             checking and savings together (the survey's transaction accounts), shared out by what was picked
//   account.car.value        what a car is worth: the survey's vehicles over the vehicles a household has
//   contrib.amount           what you put in from pay: the share of pay people your age and pay put in (participation first)
//   contrib.match            what the employer adds: the usual match value times the share of the full match you earn
//
// `args` (what is on Get started's screen and not saved yet, so the grey figure is what saving the blank box writes):
//   retire        { [personId]: number | null }   the retirement boxes (null: left blank)
//   joint         { pid, total } | null           "both of ours" answered, the total typed in `pid`'s box
//   contrib       { [personId]: number | null }   what each person puts in a month (a typed figure, or null for blank)
//   noMatch       { [personId]: boolean }         the No match chip is on
//   checking, savings   number | null             the two cash boxes
//   car (not used: the car box has no neighbours)
import { T as BAL } from "../data/balances.js";
import { T as PAY } from "../data/pay.js";
import { T as SPEND } from "../data/spend.js";
import { profileOf, scfR2, ageCol, ok, has, money, fit, pctWords, SCF_TABLES, YOUR_PAY, YOUR_AGE } from "./common.js";
import { LIMITS } from "../../../retirement/contributions/data/limits.js";
import { benefitsFor } from "../../../career/benefits/data/benefits.js";
import { interpLog, interpLinear, sigmaFromMeanMedian, logitCombine, roundGuess } from "../../../../core/math/estimate.js";
import { ageOn } from "../../../../core/math/dates.js";
import { perYear, activeOn } from "../../../../core/math/periods.js";
import { isGuess } from "../../../../core/estimate/index.js";

const L = (p, k) => (Array.isArray(p?.[k]) ? p[k] : []);
const VG_BAL = "vanguard_has2026_401k_balance_by_age", VG_DEF = "vanguard_has2026_deferral_by_income_age", VG_PART = "vanguard_has2026_participation_by_income_age";
const VG_HEAD = "vanguard_has2026_headline", VG_DIST = "vanguard_has2026_deferral_distribution", CPS = "cps_ftyr_income_by_age5";
const CE_AGE = "ce2025_profile_by_ageOfReferencePerson";

// ---- Vanguard's tables, read by column name
const rowAt = (t, row, col) => { const i = t.cols.indexOf(col); const v = i >= 0 ? t.rows[row]?.[i] : null; return ok(v) ? v : null; };
const bal = (col, stat = "median") => rowAt(BAL[VG_BAL], stat, col);
const def = (col) => rowAt(PAY[VG_DEF], "deferral", col) / 100;
const part = (col) => rowAt(PAY[VG_PART], "participation", col) / 100;
const head = (row) => rowAt(PAY[VG_HEAD], row, "value");
/**
 * The pay each of Vanguard's pay groups stands for, where its figures are placed on the pay line: the middle of the band on the
 * log scale (the square root of its two edges: sqrt(15,000 x 30,000) = 21,213), rounded to $100. The first and last groups have one
 * edge only, so they are declared: $10,000 and $200,000. (R3: log-scale middles; plain middles would move Jordan's balance to $25,000.)
 */
export const VG_PAY_CENTRES = [["income:<$15,000", 10000], ["income:$15,000-$29,999", 21200], ["income:$30,000-$49,999", 38700], ["income:$50,000-$74,999", 61200], ["income:$75,000-$99,999", 86600], ["income:$100,000-$149,999", 122500], ["income:$150,000+", 200000]];
const AGE_BANDS = [["age:<25", 0, 24], ["age:25-34", 25, 34], ["age:35-44", 35, 44], ["age:45-54", 45, 54], ["age:55-64", 55, 64], ["age:65+", 65, Infinity]];
const bandOf = (age) => (ok(age) && age >= 0 ? AGE_BANDS.find(([, lo, hi]) => age >= lo && age <= hi)?.[0] ?? null : null);
const CPS_BANDS = [["15-24", 15, 24], ["25-29", 25, 29], ["30-34", 30, 34], ["35-39", 35, 39], ["40-44", 40, 44], ["45-49", 45, 49], ["50-54", 50, 54], ["55-59", 55, 59], ["60-64", 60, 64], ["65-69", 65, 69], ["70-74", 70, 74], ["75+", 75, Infinity]];
/** The median pay of people working full time all year at this age (Census CPS), the pay "people your age" have. */
const typicalPay = (age) => { const b = CPS_BANDS.find(([, lo, hi]) => age >= lo && age <= hi) ?? CPS_BANDS[0]; return rowAt(PAY[CPS], "full-time year-round", b[0]); };
const onPayLine = (f, pay) => interpLog(VG_PAY_CENTRES.map(([c, mid]) => [mid, f(c)]), pay);
const logitOf = (p) => Math.log(p / (1 - p));

// ---- who and how much pay
/** The person a path names: setup-contrib-<id>, setup-have-retire-<id>, setup-workplan-<id>, or a record's owner/personId. */
export function personOf(plan, path) {
  const m = typeof path === "string" ? /\[(?:setup-contrib|setup-have-retire|setup-workplan)-([^\]]+)\]/.exec(path) : null;
  if (m) return m[1];
  const r = typeof path === "string" ? /^(accounts|retirement\.contributions)\[([^\]]+)\]/.exec(path) : null;
  const rec = r ? L(r[1] === "accounts" ? plan : plan?.retirement, r[1] === "accounts" ? "accounts" : "contributions").find((x) => x?.id === r[2]) : null;
  const adults = L(plan?.household, "people").filter((p) => p?.role !== "dependent");
  return rec?.personId || rec?.ownerId || adults.find((p) => p.role === "self")?.id || adults[0]?.id || null;
}
/**
 * Pay from an employer a year, before tax, for one person today (salary and bonus lines); 0 when none. A lone adult's unassigned
 * lines are theirs only while none of their pay is assigned to them: a line left unassigned beside the adult's own pay (a partner
 * who went, their pay kept as the household's) is not theirs (follow-up F9).
 */
export function payOf(plan, pid, today) {
  const adults = L(plan?.household, "people").filter((p) => p?.role !== "dependent");
  const lines = L(plan, "income").filter((x) => x && Number(x.amount) > 0 && x.period !== "once" && (x.type === "salary" || x.type === "bonus") && (!today || activeOn(x, today)));
  const lone = adults.length === 1 && adults[0].id === pid && !lines.some((x) => x.personId === pid);
  const other = (x) => { const r = String(x.continues ?? x.id ?? ""); return r.startsWith("setup-pay-") && r !== `setup-pay-${pid}`; };   // a removed person's own pay line, kept as the household's
  return lines.filter((x) => x.personId === pid || (lone && !x.personId && !other(x))).reduce((s, x) => s + perYear(x.amount, x.period), 0);
}
/**
 * The pay a person's work plan goes by (follow-up F8): the pay line Get started made for them (`setup-pay-<id>`, with the raises
 * that continue it), so a second job added later does not add its pay to the first job's 401(k) and match. A person with no
 * Get started pay line (pay typed on Income): all their pay, as payOf.
 */
export function jobPayOf(plan, pid, today) {
  const root = `setup-pay-${pid}`;
  const live = (x) => x && Number(x.amount) > 0 && x.period !== "once" && (!today || activeOn(x, today));
  const job = L(plan, "income").filter((x) => live(x) && (x.id === root || x.continues === root) && (x.type === "salary" || x.type === "bonus"));
  if (!job.length) return payOf(plan, pid, today);
  const bonus = L(plan, "income").filter((x) => live(x) && x.type === "bonus" && x.personId === pid && !job.includes(x));
  return [...job, ...bonus].reduce((s, x) => s + perYear(x.amount, x.period), 0);
}
const ageOf = (plan, pid, today) => { const p = L(plan?.household, "people").find((x) => x?.id === pid); return p?.birthDate && today ? ageOn(p.birthDate, today) : null; };
/** The age a person reaches in `year` (the year minus the birth year): what the 401(k) catch-up and the 60 to 63 amount go by (IRS Notice 2025-67). */
export const ageInYear = (plan, pid, year) => { const p = L(plan?.household, "people").find((x) => x?.id === pid); const y = Number(String(p?.birthDate ?? "").slice(0, 4)); return Number.isFinite(y) && y > 1800 && ok(year) ? year - y : null; };
const yearOf = (today) => new Date(`${today ?? "2026-01-01"}T00:00:00Z`).getUTCFullYear();
/** The most pay a plan counts (IRC 401(a)(17), IRS Notice 2025-67: $360,000 for 2026), from Work benefits' yearly table. */
export const compLimit = (year) => benefitsFor(year).compLimit;
/** The match on a share of pay `d` for tiers [{ rate, upTo }] (each upTo the top of its band), as Work benefits' matchAt. */
const tierMatch = (d, tiers) => { let prev = 0, m = 0; for (const t of [...tiers].sort((a, b) => a.upTo - b.upTo)) { m += Math.max(0, Math.min(d, t.upTo) - prev) * t.rate; prev = Math.max(prev, t.upTo); } return m; };
/** Match tiers typed on Work benefits: null when none were typed, [] when typed with no money in them (no match). */
export const typedTiers = (plan, pid) => { const t = plan?.whatIfs?.benefits?.[pid]?.matchTiers; return Array.isArray(t) ? t.map((x) => ({ rate: Number(x?.rate) || 0, upTo: Number(x?.upTo) || 0 })).filter((x) => x.rate > 0 && x.upTo > 0) : null; };
const nameOfPerson = (plan, pid) => L(plan?.household, "people").find((x) => x?.id === pid)?.name ?? null;
/** The person a setup path names is still an adult in the household (removed and their account kept as the household's: no). */
const stillHere = (plan, pid) => L(plan?.household, "people").some((x) => x?.id === pid && x.role !== "dependent");
const guessedPay = (plan, pid) => L(plan, "income").some((x) => x && typeof x.id === "string" && !/[.[\]]/.test(x.id) && x.personId === pid && isGuess(plan, `income[${x.id}].amount`));

// ---- E12: a 401(k) balance
/**
 * R2 on Vanguard's balances: the median of everyone x the pay ratio x the age ratio left once the age group's typical pay is
 * taken out. Pay unknown: the age group's own median; age unknown: the pay ratio alone; neither: everyone's median. The spread is
 * the age group's (else everyone's) sqrt(2 ln(average / median)). -> { value, sigma, parts }
 */
export function vanguardBalance({ pay = null, age = null } = {}) {
  const all = bal("all:all participants");
  const band = bandOf(age), ageMed = band ? bal(band) : null;
  const rInc = ok(pay) && pay > 0 ? onPayLine((c) => bal(c), pay) / all : null;
  let value = all;
  if (rInc !== null) value *= rInc;
  if (ageMed) {
    const rAge = ageMed / all;
    value = rInc !== null ? value * (rAge / (onPayLine((c) => bal(c), typicalPay(age)) / all)) : ageMed;
  }
  const at = ageMed ? band : "all:all participants";
  return { value, sigma: sigmaFromMeanMedian(bal(at, "average"), bal(at)), parts: { all, band: ageMed ? band : null, rInc } };
}

// ---- E13: what a person puts in
/** The 401(k) limit for a person this year (IRS Notice 2025-67): the limit plus the catch-up from 50, the larger one from 60 to 63. */
export function deferralLimit(age, year) {
  const k = LIMITS[year]?.kinds?.["401k"] ?? LIMITS[Math.max(...Object.keys(LIMITS).map(Number).filter((y) => LIMITS[y].kinds?.["401k"] && y <= year))]?.kinds?.["401k"];
  if (!k) return null;
  const sc = k.superCatchUp;
  return k.limit + (ok(age) && age >= k.catchUpAge ? (sc && age >= sc.from && age <= sc.to ? sc.amount : k.catchUp) : 0);
}
/** The share of pay a person puts in (a fraction, the median), by pay and age. R2 on Vanguard's averages, times median / average (README). */
export function deferralRate({ pay, age }) {
  const all = def("all:all"), inc = (c) => def(c);
  const rInc = onPayLine(inc, pay) / all;
  const band = bandOf(age);
  const rAge = band ? def(band) / all : 1;
  const resid = band ? rAge / (onPayLine(inc, typicalPay(age)) / all) : 1;
  return all * rInc * resid * (head("median participant deferral rate") / head("average participant deferral rate"));
}
/**
 * The share of eligible employees who put money in at all, on the log-odds scale: everyone's, plus how far this pay is from it, plus
 * how far this age is from it once the age group's typical pay is taken out (the age figures carry their own pay effect).
 */
export function participation({ pay, age }) {
  const all = part("all:all");
  const pts = VG_PAY_CENTRES.map(([c, mid]) => [Math.log(mid), part(c)]);
  const byPay = (x) => interpLinear(pts, Math.log(x));
  const band = bandOf(age);
  const terms = [byPay(pay)];
  if (band) terms.push(1 / (1 + Math.exp(-(logitOf(all) + logitOf(part(band)) - logitOf(byPay(typicalPay(age)))))));
  return logitCombine(all, terms);
}
/** The spread of what people put in: from the quarter to the three quarters of participants, sigma = ln(q75 / q25) / 1.349 (README). */
export function deferralSigma() {
  // the table's rows are bins of the share of pay ("0.1%-3.9%" ... "15.0%+"): each bin runs from the last one's top; the first starts at 0 and the open one ends at 25
  const t = PAY[VG_DIST], tops = Object.keys(t.rows).map((k) => Number(/([\d.]+)%(\+?)$/.exec(k.replace(/^[\d.]+%-/, ""))?.[1]));
  const bins = Object.values(t.rows).map((r, n) => [n ? tops[n - 1] : 0, n === tops.length - 1 ? 25 : tops[n], r[0]]);
  const at = (q) => { let c = 0; for (const [lo, hi, s] of bins) { if (c + s >= q) return lo + ((q - c) / s) * (hi - lo); c += s; } return bins.at(-1)[1]; };
  return Math.log(at(75) / at(25)) / 1.349;
}
/** The usual match: its value as a share of pay and the share of pay it takes to get all of it (Vanguard's medians). */
export const matchTerms = () => ({ value: MATCH_VALUE(), needed: MATCH_NEEDED() });
const MATCH_VALUE = () => head("median value of promised employer match (plans with single/multitier match)") / 100;
const MATCH_NEEDED = () => head("median employee deferral needed to get the full match") / 100;

/** The share of pay people like this person put in (to 0.1 point), the same figure contrib.amount says; null without pay. */
export function usualShare(plan, pid, today) {
  const pay = jobPayOf(plan, pid, today);
  return pay > 0 ? Math.round(deferralRate({ pay, age: ageOf(plan, pid, today) }) * 1000) / 1000 : null;
}
const contribRec = (plan, pid) => L(plan?.retirement, "contributions").find((c) => c?.id === `setup-contrib-${pid}`) ?? null;
const contribPath = (pid) => `retirement.contributions[setup-contrib-${pid}].amount`;
const MATCH_PATH = (pid) => `retirement.contributions[setup-contrib-${pid}].employerMatch`;
const planOf = (plan, pid) => plan?.retirement?.workPlans?.[pid] ?? {};
/** What a person puts in a month, to read the match from: the screen's figure, else the guess, else the record's (typed, or our guess already saved). */
function putInOf(plan, pid, args, today, lib) {
  if (has(args?.contrib, pid)) {
    const a = args.contrib[pid];
    if (ok(a)) return { monthly: a, typed: true };
    const g = lib.estimate("contrib.amount", { path: contribPath(pid), args });
    return g && ok(g.value) ? { monthly: g.value, typed: false } : null;
  }
  const rec = contribRec(plan, pid);
  if (rec && ok(Number(rec.amount)) && rec.period !== "once") return { monthly: perYear(Number(rec.amount), rec.period) / 12, typed: !isGuess(plan, contribPath(pid)) };
  const g = lib.estimate("contrib.amount", { path: contribPath(pid), args });
  return g && ok(g.value) ? { monthly: g.value, typed: false } : null;
}

// ---- E17, E40
const vehiclesPerHousehold = (age) => {
  const lvl = !ok(age) ? "all" : age < 25 ? "under25" : age < 35 ? "25-34" : age < 45 ? "35-44" : age < 55 ? "45-54" : age < 65 ? "55-64" : age < 75 ? "65-74" : "75plus";
  return rowAt(SPEND[CE_AGE], "vehicles", lvl);
};

/** The household as the retirement and cash guesses read it: who is an adult, with pay and age; one share of a household figure by pay (R7). */
function peopleOf(plan, today) {
  const adults = L(plan?.household, "people").filter((p) => p?.role !== "dependent");
  const rows = adults.map((p) => ({ id: p.id, name: p.name, pay: payOf(plan, p.id, today), age: ageOf(plan, p.id, today) }));
  return rows;
}
/** The survey figure with the age residual held between half and double (spec E15, E16: a thin age group never moves it more than that). */
const clamped = (r) => r.parts.all * r.parts.rInc * Math.min(2, Math.max(0.5, r.parts.resid));
/** One adult's share of a household figure: by pay when every adult has pay, else equal parts (R7). */
export function shareOf(people, pid) {
  if (people.length <= 1) return 1;
  const total = people.reduce((s, p) => s + p.pay, 0);
  return people.every((p) => p.pay > 0) && total > 0 ? (people.find((p) => p.id === pid)?.pay ?? 0) / total : 1 / people.length;
}

/** The day the split rule (R7) was written: the split reads no table, so this is its dataAsOf. */
const SPLIT_RULE_ON = "2026-11-02";
const NET_WORTH = () => "#/balance/net-worth";
const SETUP_AMOUNTS = { label: "what is in it", href: "#/overview/setup/have-amounts" };
const SPLIT_ASK = (name, total) => ({
  key: "retire-joint", kind: "split", question: `Is the ${money(total)} ${name ? `${name}'s alone` : "one person's alone"}, or both of yours?`,
  options: [{ value: "alone", label: name ? `${name}'s alone` : "Mine alone" }, { value: "both", label: "Both of ours" }],
});

/** The joint answer on file or on the screen: { pid, total } while the person who typed it still has the matching split guess, else null. */
function jointOf(plan, args) {
  if (has(args, "joint")) return args.joint && ok(args.joint.total) && args.joint.total > 0 ? args.joint : null;
  const j = plan?.guide?.setup?.taps?.["retire-joint"];
  if (!j || typeof j !== "object" || !ok(j.total) || typeof j.pid !== "string") return null;
  const key = plan?.guesses?.[`accounts[setup-have-retire-${j.pid}].balance`]?.k ?? plan?.guesses?.[`accounts[setup-workplan-${j.pid}].balance`]?.k;
  return key === "account.retire.split" ? j : null;
}

export const estimators = {
  "account.retire.balance": {
    tier: 2, order: 19, label: "Retirement savings at work", unit: "total", weight: "big", page: NET_WORTH, reads: [],
    fn(plan, { today, path, args }, lib) {
      const pid = personOf(plan, path);
      // the person was removed and the account kept as the household's: nothing left to guess from, so it stays as it is (C4 verify V6)
      if (!stillHere(plan, pid)) return null;
      const pay = payOf(plan, pid, today), age = ageOf(plan, pid, today);
      const r = vanguardBalance({ pay: pay > 0 ? pay : null, age });
      // a couple with one box typed and the other blank: is the typed figure for both? (the tap; Not sure counts it as one person's)
      const people = peopleOf(plan, today);
      let ask = null;
      if (people.length === 2 && has(args?.retire, pid) && args.retire[pid] === null) {
        const other = people.find((p) => p.id !== pid);
        const typed = other && has(args.retire, other.id) ? args.retire[other.id] : null;
        if (ok(typed) && typed > 0 && !has(args, "joint")) ask = SPLIT_ASK(other.name === "Me" ? null : other.name, typed);
      }
      const who = pay > 0 ? (guessedPay(plan, pid) ? "on our pay guess" : "on your pay") : "";
      const at = age !== null ? `at ${age}` : "";
      return {
        value: r.value, sigma: r.sigma, measured: r.sigma !== null,
        why: fit(`typical in a work plan ${[at, who].filter(Boolean).join(" ")}`.replace(/\s+/g, " ").trim(), "typical in a work plan"),
        uses: { pay: pay > 0 ? (guessedPay(plan, pid) ? "guess" : "typed") : null, age: age !== null ? "typed" : null },
        sharperWith: [...(pay > 0 ? [] : [YOUR_PAY]), ...(age !== null ? [] : [YOUR_AGE]), SETUP_AMOUNTS].slice(0, 2),
        tables: [VG_BAL, CPS], ...(ask ? { ask } : {}),
      };
    },
  },
  "account.retire.split": {
    tier: 2, order: 20, label: "Your share of the retirement savings you gave for both of you", unit: "total", weight: "big", page: NET_WORTH, reads: ["account.retire.balance"], basis: "yours",
    fn(plan, { today, path, args }) {
      const pid = personOf(plan, path), j = jointOf(plan, args);
      if (!j) return null;
      const people = peopleOf(plan, today);
      if (people.length < 2 || !people.some((p) => p.id === pid) || !people.some((p) => p.id === j.pid)) return null;
      const byPay = people.every((p) => p.pay > 0);
      // the others get their share to two figures; the person who typed the total gets what is left, so the two add up to it exactly
      const others = people.filter((p) => p.id !== j.pid).reduce((t, p) => t + roundGuess(j.total * shareOf(people, p.id), "total", null, false), 0);
      const value = pid === j.pid ? j.total - others : roundGuess(j.total * shareOf(people, pid), "total", null, false);
      return {
        value, sigma: null, measured: false, rounded: true,
        why: byPay ? `your ${money(j.total)} split by pay` : `your ${money(j.total)} split in two`,
        uses: { total: "typed", pay: byPay ? "typed" : null }, sharperWith: [], tables: [], dataAsOf: SPLIT_RULE_ON, basis: "yours",
      };
    },
  },
  "account.ira.balance": {
    tier: 2, order: 21, label: "Retirement savings on your own", unit: "total", weight: "big", page: NET_WORTH, reads: [],
    fn(plan, { today, path }) {
      const prof = profileOf(plan, today), pid = personOf(plan, path), people = peopleOf(plan, today);
      if (!stillHere(plan, pid)) return null;   // (as account.retire.balance: a removed person's kept account stays as it is)
      const age = ageOf(plan, pid, today) ?? prof.age;
      const r = scfR2("retirementAccounts", { income: prof.income, age });
      if (!r) return null;
      const on = prof.income ? (prof.payHow === "guess" ? "on our pay guess" : "on your pay") : "";
      return {
        value: clamped(r) * shareOf(people, pid), sigma: r.sigma, measured: r.sigma !== null,
        why: fit(`typical for households your age ${on} who have one`.replace(/\s+/g, " ").trim(), "typical for households your age who have one"),
        uses: { pay: prof.payHow, age: age !== null ? "typed" : null }, sharperWith: [...(prof.income ? [] : [YOUR_PAY]), ...(age !== null ? [] : [YOUR_AGE])].slice(0, 2), tables: SCF_TABLES,
      };
    },
  },
  "account.invest.balance": {
    tier: 2, order: 22, label: "Investments outside retirement", unit: "total", weight: "small", page: NET_WORTH, reads: [],
    fn(plan, { today }) {
      const prof = profileOf(plan, today);
      const r = scfR2("pooledInvestmentFunds", { income: prof.income, age: prof.age });
      if (!r) return null;
      const on = prof.income ? (prof.payHow === "guess" ? "on our pay guess" : "on your pay") : "";
      return {
        value: clamped(r), sigma: r.sigma, measured: r.sigma !== null,
        why: fit(`typical for households your age ${on} who have one`.replace(/\s+/g, " ").trim(), "typical for households your age who have one"),
        uses: { pay: prof.payHow, age: prof.age !== null ? "typed" : null }, sharperWith: [...(prof.income ? [] : [YOUR_PAY]), ...(prof.age !== null ? [] : [YOUR_AGE])].slice(0, 2), tables: SCF_TABLES,
      };
    },
  },
  "account.cash": {
    tier: 2, order: 23, label: "Checking and savings", unit: "total", weight: "small", page: NET_WORTH, reads: [],
    fn(plan, { today, path, args }) {
      const prof = profileOf(plan, today);
      const which = /setup-have-savings/.test(path ?? "") ? "savings" : "checking", other = which === "savings" ? "checking" : "savings";
      const picked = prof.picks.have;
      const accounts = L(plan, "accounts");
      const known = (k) => {
        if (has(args, k)) return ok(args[k]) && args[k] >= 0 ? args[k] : null;      // a typed 0 is the person's 0
        const a = accounts.find((x) => x?.id === `setup-have-${k}`);
        return a && Number(a.balance) > 0 && !isGuess(plan, `accounts[${a.id}].balance`) ? Number(a.balance) : null;
      };
      const r = scfR2("transactionAccounts", { income: prof.income, age: prof.age });
      if (!r) return null;
      // bank accounts already on file that this screen did not make (Net worth's) are part of the survey's total
      const onFile = accounts.filter((x) => x && ["checking", "savings", "cash"].includes(x.type) && !String(x.id).startsWith("setup-have-")).reduce((t, x) => t + Math.max(0, Number(x.balance) || 0), 0);
      const total = Math.max(0, roundGuess(r.value, "total", r.sigma, r.sigma !== null) - onFile);
      if (total < 100) return null;
      const both = picked.includes("checking") && picked.includes("savings");
      let value = total, how = "";
      if (both) {
        const typed = known(other);
        if (typed !== null) { value = Math.max(0, total - typed); how = `${other === "savings" ? "savings" : "checking"} you typed taken out`; if (value < 100) return null; }
        else { value = Math.round(total / 2); how = "shared with your other bank account"; }
      } else if (onFile > 0) how = "your other bank accounts taken out";
      const on = prof.income ? (prof.payHow === "guess" ? "on our pay guess" : "on your pay") : "";
      const age = prof.age !== null ? `at ${prof.age}` : "";
      return {
        value, sigma: r.sigma, measured: r.sigma !== null, rounded: true,
        why: fit(`typical bank balance ${[age, on].filter(Boolean).join(" ")}${how ? `, ${how}` : ""}`.replace(/\s+/g, " ").trim(), `typical bank balance ${[age, on].filter(Boolean).join(" ")}`.trim(), "typical bank balance"),
        uses: { pay: prof.payHow, age: prof.age !== null ? "typed" : null }, sharperWith: [...(prof.income ? [] : [YOUR_PAY]), ...(prof.age !== null ? [] : [YOUR_AGE])].slice(0, 2), tables: SCF_TABLES,
      };
    },
  },
  "account.car.value": {
    tier: 2, order: 24, label: "What your car is worth", unit: "total", weight: "small", page: NET_WORTH, reads: [],
    fn(plan, { today }) {
      const prof = profileOf(plan, today);
      const r = scfR2("vehicles", { income: prof.income, age: prof.age }), per = vehiclesPerHousehold(prof.age);
      if (!r || !ok(per) || per <= 0) return null;
      const on = prof.income ? (prof.payHow === "guess" ? "on our pay guess" : "on your pay") : "";
      return {
        value: r.value / per, sigma: r.sigma, measured: r.sigma !== null,
        why: fit(`what a car is usually worth for people your age ${on}`.replace(/\s+/g, " ").trim(), "what a car is usually worth for people your age"),
        uses: { pay: prof.payHow, age: prof.age !== null ? "typed" : null }, sharperWith: [...(prof.income ? [] : [YOUR_PAY]), ...(prof.age !== null ? [] : [YOUR_AGE])].slice(0, 2), tables: [...SCF_TABLES, CE_AGE],
      };
    },
  },
  "contrib.amount": {
    tier: 4, order: 1, label: "What you put into your 401(k) a month", unit: "month", weight: "big", page: () => "#/retirement/contributions", reads: [],
    fn(plan, { today, path }) {
      const pid = personOf(plan, path);
      if (!stillHere(plan, pid)) return null;
      const pay = jobPayOf(plan, pid, today), age = ageOf(plan, pid, today);
      const rec = contribRec(plan, pid);
      // a row that is not a monthly one is never given monthly dollars (it stays as it is)
      if (rec && rec.period && rec.period !== "monthly") return null;
      // the person said the job has no retirement plan (question 2's No, after a Yes): our guess of what goes in is $0 (C4 verify V2)
      if (planOf(plan, pid).plan === false) return rec && isGuess(plan, contribPath(pid)) ? { value: 0, sigma: null, measured: false, rounded: true, why: "you said this job has no retirement plan", uses: { pay: null, age: null }, sharperWith: [], tables: [VG_PART] } : null;
      // the pay this guess was worked from is gone (no job now, or the pay line ended): nothing goes in. With no row yet there is nothing to write.
      if (!(pay > 0)) return rec && isGuess(plan, contribPath(pid)) ? { value: 0, sigma: null, measured: false, rounded: true, why: "no pay from a job now, so nothing goes in", uses: { pay: null, age: null }, sharperWith: [], tables: [VG_PART] } : null;
      const p = participation({ pay, age });
      const on = guessedPay(plan, pid) ? "on our pay guess" : "on your pay";
      const common = { uses: { pay: guessedPay(plan, pid) ? "guess" : "typed", age: age !== null ? "typed" : null }, sharperWith: [...(age !== null ? [] : [YOUR_AGE])], tables: [VG_PART, VG_DEF, VG_HEAD, VG_DIST, CPS] };
      // under half put anything in: nothing yet, said so (a different box says the match still waits)
      if (p < 0.5) return { value: 0, sigma: null, measured: false, why: fit(`about half of people your age ${on} don't put money in yet`, "about half of people your age don't put money in yet"), ...common };
      // the share of pay to 0.1 point (R11: a rate), then the month's dollars of it: "about 5.5%" and "$270" say the same thing
      const rate = Math.round(deferralRate({ pay, age }) * 1000) / 1000, year = yearOf(today);
      const cap = deferralLimit(ageInYear(plan, pid, year) ?? age, year);
      // to $10 under $1,000, else $50 (R11); never past the limit (the largest $10 under it)
      let monthly = roundGuess(rate * pay / 12, "month", null, false);
      if (ok(cap) && monthly * 12 > cap) monthly = Math.floor(cap / 12 / 10) * 10;
      return { value: monthly, rounded: true, sigma: deferralSigma(), measured: false, why: fit(`people your age ${on} usually put in about ${pctWords(rate)}`, `people your age usually put in about ${pctWords(rate)}`), ...common, uses: { ...common.uses, rate } };
    },
  },
  "contrib.match": {
    tier: 4, order: 2, label: "What your employer adds a year", unit: "year", weight: "big", page: () => "#/retirement/contributions", reads: ["contrib.amount"],
    fn(plan, { today, path, args }, lib) {
      const pid = personOf(plan, path);
      if (!stillHere(plan, pid)) return null;
      const pay = jobPayOf(plan, pid, today);
      const tiers = typedTiers(plan, pid);
      // "no match at this job": said on Contributions (or question 2's No), on this screen (its No match chip) before it is saved, or a
      // formula on Work benefits with no money in it. On the screen the chip writes a typed 0; said elsewhere after our guess was
      // saved, the guess goes to $0 (it never stays frozen at money the person said is not there: C4 verify V2, V3)
      const onScreen = has(args?.noMatch, pid);
      if (onScreen ? args.noMatch[pid] : tiers ? tiers.length === 0 : planOf(plan, pid).match === false || planOf(plan, pid).plan === false) {
        return !onScreen && contribRec(plan, pid) && isGuess(plan, MATCH_PATH(pid)) ? { value: 0, sigma: null, measured: false, rounded: true, why: "you said there is no match at this job", uses: { pay: null }, sharperWith: [], tables: [VG_HEAD] } : null;
      }
      if (!(pay > 0)) return contribRec(plan, pid) && isGuess(plan, MATCH_PATH(pid)) ? { value: 0, sigma: null, measured: false, rounded: true, why: "no pay from a job now, so the employer adds nothing", uses: { pay: null }, sharperWith: [], tables: [VG_HEAD] } : null;
      const put = putInOf(plan, pid, args, today, lib);
      if (!put) return null;
      const year = yearOf(today), comp = Math.min(pay, compLimit(year));
      const cap = deferralLimit(ageInYear(plan, pid, year) ?? ageOf(plan, pid, today), year);
      const putYearly = Math.min(put.monthly * 12, ok(cap) ? cap : Infinity);
      // typed on Work benefits: that formula on the pay a plan counts. Otherwise the usual: its value times the share of the full match
      // you earn (the match needs about 6% of pay in). The rounding is the month's, $10, so the yearly figure is twelve of them
      const yearly = tiers ? tierMatch(putYearly / comp, tiers) * comp : MATCH_VALUE() * Math.min(1, putYearly / comp / MATCH_NEEDED()) * comp;
      const month = Math.round(yearly / 12 / 10) * 10;
      const none = put.monthly <= 0;
      const uses = { pay: guessedPay(plan, pid) ? "guess" : "typed", contribution: put.typed ? "typed" : "guess" };
      return {
        value: month * 12, sigma: null, measured: false, rounded: true,
        why: none ? "nothing goes in, so the employer adds nothing yet" : tiers ? "the match formula you typed on Work benefits" : fit("most work plans add about 4% of pay when you put in 6%", "most work plans add about 4% of pay"),
        uses, sharperWith: [], ...(tiers ? { tables: [], basis: "yours", dataAsOf: SPLIT_RULE_ON } : { tables: [VG_HEAD] }),
      };
    },
  },
};
