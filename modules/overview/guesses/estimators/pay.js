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
import { T as PAY } from "../data/pay.js";
import { STATE_NAME } from "../data/index.js";
import { interpLinear, sigmaFromMeanMedian } from "../../../../core/math/estimate.js";
import { daysBetween } from "../../../../core/math/dates.js";
import { ok, stateOf, YOUR_STATE, YOUR_AGE } from "./common.js";

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

export const estimators = {
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
