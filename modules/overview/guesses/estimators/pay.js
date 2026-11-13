// modules/overview/guesses/estimators/pay.js -- PURE. Pay (spec 7.E: E33 `pay.gross`). Formulas and sources: ../README.md
// "Pay before tax".
//
//   pay.gross            Get started's pay box left blank after "I work": typical full-time pay before tax for the
//                        person's age in their state, a year (income[setup-pay-<id>].amount, period "annual")
//   PAY_GUESS_STORED     the owner's switch (spec 17.1): true, a blank pay box is counted and marked like every other
//                        blank box (the one rule); false, the figure is only shown ("For example, ..."), never written
//   payAt(age)           typical full-time pay at an age (U.S.), with its spread: the Current Population Survey's
//                        full-time year-round medians by age band, read on straight lines of the log between the bands'
//                        middles (R3: a birthday never steps it), the all-ages row with no age
//   payLinePerson(plan, path)   the adult a pay line at `path` belongs to (Get started's own line, or one continuing it)
//   pay.fromTakeHome     E34: the pay before tax worked out from what reaches the bank (question 2's "I only know what
//                        reaches my bank"), so it follows when the 401(k) share changes
//   takeHomeOf(gross, o) / grossFromTakeHome(net, o)   what a year's pay leaves after the 401(k), Social Security and Medicare
//                        tax and the income tax held back, and its inverse by bisection
import { T as PAY } from "../data/pay.js";
import { T as HEALTH } from "../data/health.js";
import { STATE_NAME } from "../data/index.js";
import { FEDERAL } from "../../../taxes/federal/data/federal.js";
import { FLAT, NO_WAGE_TAX, flatTax } from "../../../taxes/state/compute.js";
import { federalTax, paramsFor } from "../../../../core/math/tax.js";
import { perYear } from "../../../../core/math/periods.js";
import { interpLinear, sigmaFromMeanMedian } from "../../../../core/math/estimate.js";
import { daysBetween, ageOn } from "../../../../core/math/dates.js";
import { isGuess } from "../../../../core/estimate/index.js";
import { ok, stateOf, money, fit, YOUR_STATE, YOUR_AGE } from "./common.js";

/** The owner's switch (spec 17.1): a blank pay box after "I work" is written and marked (true) or only shown (false). */
export const PAY_GUESS_STORED = true;

const ACS = "acs_median_earnings_by_state", CPS = "cps_ftyr_income_by_age5";
const L = (p, k) => (Array.isArray(p?.[k]) ? p[k] : []);
const cell = (t, row, col) => { const i = t.cols.indexOf(col); const v = i >= 0 ? t.rows[row]?.[i] : null; return ok(v) && v > 0 ? v : null; };
const FT = "full-time year-round";
/**
 * The CPS age bands and the age at each one's middle. The youngest band (15-24) is placed at 22, not 19.5: almost nobody
 * under 20 works full time all year, so its full-time workers are mostly 20 to 24 (Vanguard's "under 25" is placed at 22
 * the same way in saving.js). The oldest (75+) at 77, as saving.js reads it.
 */
const BANDS = [["15-24", 22], ["25-29", 27], ["30-34", 32], ["35-39", 37], ["40-44", 42], ["45-49", 47], ["50-54", 52], ["55-59", 57], ["60-64", 62], ["65-69", 67], ["70-74", 72], ["75+", 77]];
const smooth = (row, age) => Math.exp(interpLinear(BANDS.map(([c, mid]) => [mid, Math.log(cell(PAY[CPS], row, c))]), age));
/**
 * The age the ratio is held flat from (critic M5, 2026-11-13): 62, the 60-64 band's middle. PINC-01 is total money income, so
 * its older bands hold Social Security, pensions and withdrawals (65-69 $83,380, 70-74 $95,420) and read on they made pay
 * rise after 62, while pay from work falls (PINC-03 earnings, full time all year: 55-64 $71,500, 65+ $68,240; read
 * 2026-11-13). R3's "held flat outside the end buckets", with 60-64 the last band of pay.
 */
export const PAY_TOP_AGE = 62;

/**
 * Typical full-time pay at an age, U.S., as the Current Population Survey gives it (PINC-01, people working full time all
 * year): the median at that age (straight lines of the log between the bands' middles; from PAY_TOP_AGE up, that age's),
 * its mean the same way, and the spread sqrt(2 ln(mean / median)) (R6). No age: the all-ages row (15 and over).
 * -> { median, mean, sigma, all }
 */
export function payAt(age = null) {
  const all = cell(PAY[CPS], FT, "15+"), allMean = cell(PAY[CPS], `${FT}:mean`, "15+");
  const at = ok(age) ? Math.min(age, PAY_TOP_AGE) : null;
  const median = ok(at) ? smooth(FT, at) : all, mean = ok(at) ? smooth(`${FT}:mean`, at) : allMean;
  return { median, mean, sigma: sigmaFromMeanMedian(mean, median), all };
}

/** Age in years with the fraction (a day's change moves a guess a day's worth, never a year's: R3). */
const exactAge = (birthDate, today) => { const d = birthDate && today ? daysBetween(birthDate, today) : null; return ok(d) && d >= 0 ? d / 365.2425 : null; };

/**
 * The adult a pay line belongs to, from its path `income[<id>].amount`: Get started's own line (`setup-pay-<id>`) or one
 * that continues it (a raise from a later date). A pay line typed on Income is the person's own and never guessed: null.
 * The line need not be in the plan yet (the screen's grey figure is worked out before the first save).
 */
export function payLinePerson(plan, path) {
  const id = /^income\[([^\]]+)\]\.amount$/.exec(path ?? "")?.[1];
  if (!id) return null;
  const rec = L(plan, "income").find((x) => x?.id === id) ?? null;
  const root = rec ? (String(rec.id).startsWith("setup-pay-") ? rec.id : typeof rec.continues === "string" ? rec.continues : null) : id;
  const pid = /^setup-pay-(.+)$/.exec(root ?? "")?.[1] ?? null;
  const person = pid ? L(plan?.household, "people").find((p) => p?.id === pid && p.role !== "dependent") ?? null : null;
  return person ? { person, rec } : null;
}

const YOUR_PAY = { label: "your pay", href: "#/overview/setup/money" };

// ---- E34: from what reaches the bank (spec 7.E). Social Security tax 6.2% up to the year's wage base and Medicare 1.45%
// (IRC 3101(a), (b); SSA, 2026 wage base $184,500 in taxes/federal's tables); the 0.9% extra Medicare tax is in federalTax.
const SS_RATE = 0.062, MEDICARE_RATE = 0.0145;
const VG_HEAD = "vanguard_has2026_headline", KFF = "kff_ehbs2026_premiums";
/** What a worker pays a year for health insurance through work (KFF Employer Health Benefits Survey 2026: $1,672 single, $7,471 family). */
export const healthPremium = (cover) => { const t = HEALTH[KFF], i = t.cols.indexOf(cover); const v = i >= 0 ? t.rows["worker contribution, annual"]?.[i] : null; return ok(v) && v > 0 ? v : 0; };
/** The median share of pay people put in a 401(k) (Vanguard, How America Saves 2026: 6.6%), used when a plan at work is picked and no share is typed. */
export const USUAL_SHARE = () => PAY[VG_HEAD].rows["median participant deferral rate"][0] / 100;
export const PERIOD_WORDS = { annual: "a year", monthly: "a month", biweekly: "every two weeks", semimonthly: "twice a month", weekly: "every week" };
const yearOf = (today) => { const y = Number(String(today ?? "").slice(0, 4)); return y > 1900 ? y : Math.max(...Object.keys(FEDERAL).map(Number)); };

/**
 * What reaches the bank in a year from `gross` a year of one person's pay: pay less what goes into a 401(k) (`share` of pay,
 * or `dollars` a year), Social Security and Medicare tax, the federal income tax held back (federalTax on this pay alone with
 * the household's filing status, as a paycheck's withholding works it; the child tax credit's refundable part is paid with
 * the return, not in the paycheck, so it is left out) and the state's: none in a state with no wage tax, its flat rule, or a
 * rate typed on the State page; a graduated state's tax is not counted (no rate to use)); and health insurance through work,
 * taken before tax (`health`, a year). o: { status, kids, others, ages65, share, dollars, health, state, rate, adults, year }
 */
export function takeHomeOf(gross, o = {}) {
  const P = paramsFor(FEDERAL, o.year ?? yearOf(null));
  const pretax = Math.min(gross, (o.share ?? 0) * gross + (o.dollars ?? 0));
  // health insurance through work (`health`, a year): taken before tax (a Section 125 plan), so out of the wages that income
  // tax and Social Security and Medicare tax are worked on, and out of what reaches the bank (critic M7)
  const health = Math.min(gross - pretax, Math.max(0, o.health ?? 0));
  const fed = federalTax({ filingStatus: o.status ?? "single", wages: gross - pretax - health, medicareWages: gross - health, dependentsUnder17: o.kids ?? 0, otherDependents: o.others ?? 0, ages65plus: o.ages65 ?? 0 }, P);
  const income = Math.max(0, fed.totalTax + (fed.credits?.refundable ?? 0));
  const fica = SS_RATE * Math.min(gross - health, P.ssWageBase ?? Infinity) + MEDICARE_RATE * (gross - health);
  let state = 0;
  if (ok(o.rate)) state = o.rate * Math.max(0, fed.agi);
  else if (o.state && !NO_WAGE_TAX[o.state] && FLAT[o.state]) {
    const adults = o.adults ?? 1, deps = (o.kids ?? 0) + (o.others ?? 0);
    state = flatTax(FLAT[o.state], fed.agi, { joint: o.status === "married_joint", people: adults + deps, adults, dependents: deps, fed: { deduction: fed.deduction?.amount ?? 0, standard: fed.deduction?.standard ?? 0 } }).tax;
  }
  return gross - pretax - health - fica - income - state;
}
/** The pay before tax that leaves `net` a year (takeHomeOf rises with pay: bisection to a cent). null when none does. */
export function grossFromTakeHome(net, o = {}) {
  if (!(ok(net) && net > 0)) return null;
  let lo = net, hi = net * 2;
  for (let i = 0; i < 20 && takeHomeOf(hi, o) < net; i++) hi *= 2;
  if (takeHomeOf(hi, o) < net) return null;
  for (let i = 0; i < 100 && hi - lo > 0.005; i++) { const mid = (lo + hi) / 2; if (takeHomeOf(mid, o) < net) lo = mid; else hi = mid; }
  return hi;
}
/** What the person puts in a 401(k) from this pay, typed (never our guess of it): { share } or { dollars } a year, or null. */
function typedSaving(plan, pid, today) {
  const types = new Map(L(plan, "accounts").map((a) => [a?.id, a?.type]));
  const rows = L(plan?.retirement, "contributions").filter((c) => c && (c.personId === pid || c.id === `setup-contrib-${pid}`) && ["401k", "roth"].includes(types.get(c.accountId)) && !(typeof c.id === "string" && isGuess(plan, `retirement.contributions[${c.id}].amount`)));
  const share = rows.map((c) => Number(c.pctOfPay)).find((x) => ok(x) && x >= 0 && x <= 1);
  if (ok(share)) return { share };
  const chip = plan?.guide?.setup?.saving?.[pid]?.pct;
  const dollars = rows.reduce((t, c) => t + (Number(c.amount) > 0 ? perYear(Number(c.amount), c.period ?? "monthly") : 0), 0);
  if (dollars > 0) return { dollars };
  if (ok(chip) && chip >= 0 && chip <= 1) return { share: chip };
  if (rows.length) return { dollars: 0 };
  return null;
}

export const estimators = {
  "pay.fromTakeHome": {
    tier: 1, order: 2, label: "Pay before tax, from what reaches your bank", unit: "year", weight: "big", basis: "yours", reads: [],
    page: () => "#/overview/setup/money",
    // args: { status, by, mode: "bank", takeHome: { amount, period }, plan: "yes" | "no" | "unsure" } (question 2 on screen);
    // else the plan: guide.setup.taps["pay-mode-<id>"] = "bank" and ["take-home-<id>"] = { amount, period }
    fn(plan, { today, path, args }) {
      const who = payLinePerson(plan, path);
      if (!who) return null;
      const { person, rec } = who, taps = plan?.guide?.setup?.taps ?? {};
      if ((args?.status ?? plan?.guide?.setup?.status?.[person.id]) !== "work") return null;
      if ((args?.by ?? (rec?.type === "business" ? "self" : "employer")) !== "employer") return null;   // no paycheck: nothing is held back
      if ((args?.mode ?? taps[`pay-mode-${person.id}`]) !== "bank") return null;
      if (rec && rec.period && rec.period !== "annual") return null;
      const th = args?.takeHome ?? taps[`take-home-${person.id}`];
      const n = Number(th?.amount);
      if (!(n > 0) || !PERIOD_WORDS[th?.period]) return null;
      const people = L(plan?.household, "people"), adults = people.filter((p) => p?.role !== "dependent");
      const kidsAges = people.filter((p) => p?.role === "dependent").map((p) => (p.birthDate && today ? ageOn(p.birthDate, today) : null));
      const self = person.role === "self" || adults[0]?.id === person.id;   // the children are claimed on one paycheck: the first adult's
      const kids = self ? kidsAges.filter((a) => a === null || a < 17).length : 0, others = self ? kidsAges.length - kids : 0;
      const age = person.birthDate && today ? ageOn(person.birthDate, today) : null;
      const st = stateOf(plan), raw = plan?.taxes?.state?.rate;
      const rate = raw === null || raw === undefined || raw === "" || !Number.isFinite(Number(raw)) ? null : Number(raw);
      // the 401(k): the share or dollars typed, else the usual 6.6% when a plan at work was picked, else none
      const typed = typedSaving(plan, person.id, today);
      const picked = args?.plan !== undefined && args?.plan !== null ? args.plan === "yes" : plan?.retirement?.workPlans?.[person.id]?.plan === true;
      const saving = typed ?? (picked ? { share: USUAL_SHARE() } : { share: 0 });
      // health insurance through work (question 6's answer): what a worker usually pays for it comes out of the first working
      // adult's paycheck (the one the children are claimed on), single for one adult with no children, else family (critic M7)
      const said = plan?.guide?.setup?.status ?? {};
      const coverer = adults.find((p) => (p.id === person.id ? args?.status ?? said[p.id] : said[p.id]) === "work") ?? null;
      const cover = taps["health-cover"] === "work" && coverer?.id === person.id ? healthPremium(adults.length <= 1 && !kidsAges.length ? "single" : "family") : 0;
      const status = ["single", "married_joint", "married_separate", "head_of_household"].includes(plan?.household?.filingStatus) ? plan.household.filingStatus : "single";
      const gross = grossFromTakeHome(perYear(n, th.period), { status, kids, others, ages65: ok(age) && age >= 65 ? 1 : 0, ...saving, health: cover, state: st, rate, adults: status === "married_joint" ? 2 : 1, year: yearOf(today) });
      if (!gross) return null;
      return {
        value: gross, sigma: null, measured: false,
        why: fit(`worked out from the ${money(n)} ${PERIOD_WORDS[th.period]} that reaches your bank`, `worked out from the ${money(n)} that reaches your bank`),
        uses: { pay: "worked out" },
        sharperWith: [{ label: "your pay before tax", href: "#/overview/setup/money" }],
        tables: [...(!typed && picked ? [VG_HEAD] : []), ...(cover > 0 ? [KFF] : [])], dataAsOf: "2026-11-02",
      };
    },
  },
  "pay.gross": {
    tier: 1, order: 1, label: "Pay before tax", unit: "year", weight: "big", reads: [],
    page: () => "#/overview/setup/money",
    // args (the pay question as it stands on screen): { status: "work" | "retired" | "none", by: "employer" | "self" }
    fn(plan, { today, path, args }) {
      const who = payLinePerson(plan, path);
      if (!who) return null;
      const { person, rec } = who;
      const status = args?.status ?? plan?.guide?.setup?.status?.[person.id] ?? null;
      if (status !== "work") return null;                              // retired or not working: no pay to guess
      if (rec && rec.period && rec.period !== "annual") return null;     // a line kept in another period is never given a year's figure
      const st = stateOf(plan), age = exactAge(person.birthDate, today);
      const place = cell(PAY[ACS], "full-time year-round, both sexes", st ?? "US");
      const p = payAt(age);
      if (!place || !p.median || !p.all) return null;
      // anchor x ratio (R2): the state's full-time median (ACS) x [the age's full-time median / all ages'] (CPS)
      const value = place * (p.median / p.all);
      // someone paid by their own business: the same figure (spec 7.E: "the same, rough"; no table of self-employment pay is bundled)
      const at = ok(age) ? ` at ${Math.floor(age)}` : "", where = st ? STATE_NAME[st] : "the U.S.";
      return {
        value, sigma: p.sigma, measured: true,
        why: `typical full-time pay${at} in ${where}`,
        uses: { state: st ? "typed" : null, age: ok(age) ? "typed" : null },
        sharperWith: [YOUR_PAY, ...(ok(age) ? [] : [YOUR_AGE]), ...(st ? [] : [YOUR_STATE])],
        tables: [ACS, CPS],
      };
    },
  },
};
