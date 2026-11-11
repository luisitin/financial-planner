// qa/guess-sanity.mjs -- every guess and default a layperson would find hard to believe for THEIR household.
//
// The owner's rule: a guess is the most likely figure for people like you (age, couple or single, children, owner or renter,
// pay, state, what you typed), and every figure behind it has a source and a date. This script builds a grid of invented
// households through Get started's own apply functions (modules/overview/setup/compute.js, the way
// qa/fixtures/setup-personas.mjs does, with core/estimate settle after each save as store.update does), adds every plan
// in qa/households and the qa fixtures, runs every estimator (overview/guesses + overview/setup) and the computes of the
// pages that show a derived figure, at a fixed date, and checks the rules in qa/guess-sanity-rules.json (what, the line,
// why, source and date of each). Pure Node: no browser, no server, nothing written to any plan.
//
//   node qa/guess-sanity.mjs                      the sampled grid + qa plans + sweeps (under 10 minutes on 3 cores)
//   node qa/guess-sanity.mjs --full               the whole grid (slow: about 4x)
//   node qa/guess-sanity.mjs --out <dir>          where sweep.json and sweep.md go (default: qa/results/, git-ignored)
//   node qa/guess-sanity.mjs --workers 1          single thread (default: up to 3 worker threads)
//   node qa/guess-sanity.mjs --rules HD-MORT-START,SF-GOAL-EDU    only these rules
//   node qa/guess-sanity.mjs --no-qa              skip the 1,400 qa/households plans
//
// tests/guess-sanity.test.mjs runs the hard rules on the personas and a small grid inside `npm test`.
// A rule whose owner is another build (bought: the mortgage's years left, balance, payment and the year a home was bought;
// leftover: the "left over each month" input) is checked here and fixed there: sweep.md lists those under their owner.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as S from "../modules/overview/setup/compute.js";
import * as G from "../modules/overview/guesses/compute.js";
import * as E from "../core/estimate/index.js";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ageOn, addMonths, monthsBetween } from "../core/math/dates.js";
import { nper, pmt } from "../core/math/finance.js";
import { takeHome, householdOf, spendModel } from "../modules/overview/guesses/estimators/spend.js";
import { escrowMonthly } from "../modules/overview/guesses/estimators/home.js";
import { leftMarker } from "../core/math/leftover.js";
import { fullRetirementAge } from "../modules/retirement/social-security/compute.js";
// skeptic pass 2026-11-07: the figures the pages show, where a rule had read an internal one (the Federal estimate shows
// fullSteps' total, not result.totalTax; Timeline and Net worth over time follow the payoff plan's dates)
import * as PAYOFF from "../modules/debt/payoff/compute.js";
import { fullSteps } from "../modules/taxes/withholding/compute.js";
import { known as fedKnown } from "../modules/taxes/federal/known.js";
import { compute as fedCompute } from "../modules/taxes/federal/compute.js";
/** The year's federal tax as the Federal estimate page shows it (its hero and walk: fullSteps over known.js). */
const fedShown = (plan, today) => { const d = fedCompute(plan, { today }); return fullSteps(plan, d, { today }, fedKnown(plan, { today }, d)).total; };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
export const TODAY = "2026-11-07";
const TY = 2026;
export const REG = E.mergeEstimators([{ from: "overview/guesses", estimators: G.estimators, tables: G.TABLES }, { from: "overview/setup", estimators: S.estimators }]);
const GO = (today = TODAY) => ({ estimators: REG.estimators, tables: REG.tables, today });
export const RULE_TEXT = JSON.parse(fs.readFileSync(path.join(HERE, "guess-sanity-rules.json"), "utf8"));
const META = Object.fromEntries(RULE_TEXT.rules.map((r) => [r.id, r]));

// ---------------------------------------------------------------------------------------------------------------------
// Figures the rules hold the guesses to. Each comes from qa/guess-sanity-rules.json (source and date per rule); the
// longer tables are the same survey cells, kept here so the script needs nothing else.
// Survey of Consumer Finances 2025 (Federal Reserve, released 2026-10-09; weighted, 5 implicates, age = oldest adult).
const band = (a) => (a < 35 ? "<35" : a < 45 ? "35-44" : a < 55 ? "45-54" : a < 65 ? "55-64" : a < 75 ? "65-74" : "75+");
const SCF_YIH = { "<35": [0, 1, 3, 5, 9], "35-44": [1, 3, 5, 9, 16], "45-54": [1, 4, 9, 16, 24], "55-64": [2, 6, 14, 23, 35], "65-74": [3, 9, 22, 31, 46], "75+": [3, 11, 24, 40, 55] };   // years in the home
const SCF_LEFT = { "<35": [20, 25, 27, 29, 30], "35-44": [11, 21, 26, 27, 30], "45-54": [8, 17, 24, 26, 29], "55-64": [5, 12, 23, 26, 29], "65-74": [3, 13, 21, 26, 29], "75+": [1, 10, 17, 25, 28] };   // years left on the mortgage
const SCF_LTV = { "<35": [0.3, 0.53, 0.73, 0.87, 0.96], "35-44": [0.2, 0.4, 0.54, 0.71, 0.9], "45-54": [0.18, 0.3, 0.44, 0.6, 0.82], "55-64": [0.06, 0.23, 0.4, 0.56, 0.83], "65-74": [0.08, 0.19, 0.32, 0.47, 0.77], "75+": [0.02, 0.11, 0.25, 0.41, 0.7] };
const SCF_VI = { "<35": [1.29, 2.86, 7.13], "35-44": [1.26, 2.99, 8.11], "45-54": [1.19, 3.09, 11.43], "55-64": [1.06, 3.3, 11.43], "65-74": [1.35, 5.06, 18.0], "75+": [1.4, 5.52, 20.27] };   // home value / income p5, p50, p95
const SCF_CARD = { "<35": [100, 2000, 17000], "35-44": [110, 2900, 30000], "45-54": [200, 5000, 32000], "55-64": [150, 4600, 35000], "65-74": [200, 3000, 37000], "75+": [300, 3000, 24000] };
const SCF_PIR = { "<35": 0.51, "35-44": 0.52, "45-54": 0.57, "55-64": 0.55, "65-74": 0.68, "75+": 0.63 };   // debt payments / income p95
const SCF_MPI = { "<35": 0.45, "35-44": 0.39, "45-54": 0.42, "55-64": 0.39, "65-74": 0.56, "75+": 0.6 };     // mortgage payment / income p95
const CUTS = [35946, 63676, 102703, 174595, 252649];   // SCF 2025 income percentiles 20/40/60/80/90
const fifthOf = (i) => (i < CUTS[0] ? 1 : i < CUTS[1] ? 2 : i < CUTS[2] ? 3 : i < CUTS[3] ? 4 : 5);
const SCF_TOT = { "single|1": [317, 610, 1000, 1500, 3300], "single|2": [583, 1167, 1917, 2500, 4333], "single|3": [833, 1500, 2500, 3750, 6417], "single|4": [1083, 2083, 3333, 4917, 8333], "single|5": [1000, 2833, 4583, 10000, 21000],
  "single+kids|1": [508, 833, 1100, 1833, 4000], "single+kids|2": [833, 1500, 2000, 2583, 3750], "single+kids|3": [1167, 1833, 2833, 4167, 7667], "single+kids|4": [1700, 2500, 3167, 4000, 7750], "single+kids|5": [2333, 4333, 6167, 10000, 15083],
  "couple|1": [417, 833, 1417, 2250, 4417], "couple|2": [833, 1500, 2083, 3000, 5000], "couple|3": [1167, 1917, 2917, 4167, 7417], "couple|4": [1500, 2900, 4750, 6417, 10000], "couple|5": [2083, 4167, 6500, 10000, 20833],
  "couple+kids|1": [917, 1250, 1667, 2250, 3917], "couple+kids|2": [1000, 1667, 2167, 3333, 5250], "couple+kids|3": [1333, 2200, 3000, 4250, 7083], "couple+kids|4": [1900, 3167, 4583, 6000, 10000], "couple+kids|5": [2600, 4583, 6750, 10000, 20833] };
const SCF_FOOD = { 1: [100, 867], 2: [250, 1300], 3: [280, 1600], 4: [400, 1950], 5: [400, 2000] };   // food at home a month p5, p95 by size
const SCF_RENT = { 1: [0.16, 0.49, 1.23], 2: [0.126, 0.312, 0.568], 3: [0.105, 0.225, 0.475], 4: [0.05, 0.18, 0.292], 5: [0.054, 0.117, 0.215] };   // rent / income p5, p50, p95
// retirement accounts among holders, by age band x income group (P5, P25, P50, P75, P95)
const RETIRE_CELLS = { "<35|0-40": [190, 2300, 5000, 17000, 46000], "<35|40-60": [1500, 7000, 14000, 41000, 156000], "<35|60-80": [2000, 10000, 30000, 81000, 172000], "<35|80-100": [2000, 31500, 57000, 134000, 324000],
  "35-44|0-40": [300, 1900, 5700, 28000, 106000], "35-44|40-60": [1200, 10000, 30000, 81000, 271000], "35-44|60-80": [2700, 25000, 53000, 170000, 372000], "35-44|80-90": [10000, 58000, 167000, 327800, 700000], "35-44|90-100": [4800, 172000, 460000, 852000, 1871000],
  "45-54|0-40": [690, 5000, 20000, 50000, 200000], "45-54|40-60": [1280, 28000, 70000, 122000, 400000], "45-54|60-80": [12000, 46000, 100000, 279000, 785060], "45-54|80-90": [40000, 100000, 196900, 439000, 1025000], "45-54|90-100": [30000, 275000, 593000, 1600000, 3200000],
  "55-64|0-40": [2000, 10000, 33000, 89000, 485000], "55-64|40-60": [5400, 30000, 72000, 194000, 600000], "55-64|60-80": [17000, 65000, 220000, 531000, 1165000], "55-64|80-90": [45800, 257000, 551000, 990000, 1963000], "55-64|90-100": [65000, 414000, 1199000, 2460000, 4910000],
  "65-74|0-40": [3600, 20000, 100000, 192000, 1015000], "65-74|40-60": [11000, 57000, 182000, 419000, 1070000], "65-74|60-80": [20000, 104000, 320200, 757000, 1958000], "65-74|80-90": [78000, 223000, 520000, 1550000, 3688000], "65-74|90-100": [140000, 662000, 1750000, 3162000, 6709800],
  "75+|0-40": [6000, 22000, 66000, 169000, 470000], "75+|60-80": [8600, 120000, 257000, 825000, 1350000], "75+|80-90": [20000, 286000, 602000, 1200000, 2600000], "75+|90-100": [29000, 1160000, 1866000, 3070000, 6730000] };
const P95R = { "<25": 0.606, "25-29": 1.146, "30-34": 1.629, "35-44": 2.951, "45-54": 5.412, "55-64": 9.189, "65-74": 14.13, "75+": 11.223 };   // retirement / income p95
const rband = (a) => (a < 25 ? "<25" : a < 30 ? "25-29" : a < 35 ? "30-34" : band(a));
const ig5 = (i) => (i < CUTS[1] ? "0-40" : i < CUTS[2] ? "40-60" : i < CUTS[3] ? "60-80" : i < CUTS[4] ? "80-90" : "90-100");
// stocks + pooled funds among holders, by age band x income group (bottom 60%, 60-90%, top 10%)
const INV = { "<35|0-60": [5, 300, 2900, 27000, 120000], "<35|60-90": [120, 2000, 15000, 60000, 260000], "<35|90-100": [5000, 112000, 182000, 312000, 1313000],
  "35-44|0-60": [160, 1300, 3500, 25000, 1600000], "35-44|60-90": [150, 7000, 25000, 100000, 508000], "35-44|90-100": [15000, 45000, 273000, 1451000, 6064000],
  "45-54|0-60": [70, 1200, 2700, 20000, 120000], "45-54|60-90": [180, 5200, 27000, 150000, 903000], "45-54|90-100": [5000, 60000, 417000, 1700000, 6411000],
  "55-64|0-60": [1, 3100, 10000, 200000, 1180000], "55-64|60-90": [300, 15000, 45000, 225000, 1000000], "55-64|90-100": [22000, 120000, 1425000, 4020000, 10007600],
  "65-74|0-60": [100, 5000, 50000, 176000, 1600000], "65-74|60-90": [500, 12000, 160000, 600000, 4400000], "65-74|90-100": [33600, 300000, 1450000, 3446000, 18670000],
  "75+|0-60": [3000, 36000, 110000, 358000, 1069000], "75+|60-90": [700, 68000, 500000, 1000000, 3390000], "75+|90-100": [26000, 450000, 1000000, 3749000, 15000000] };
const ig3 = (i) => (i < CUTS[2] ? "0-60" : i < CUTS[4] ? "60-90" : "90-100");
// checking + savings in months of income among families, by age band x income group (P5..P95)
const CASHM = { "<35|0-40": [0, 0.117, 0.436, 1.519, 7.424], "<35|40-60": [0.047, 0.365, 0.813, 2.003, 7.539], "<35|60-80": [0.154, 0.406, 1.211, 2.212, 8.4], "<35|80-100": [0.344, 0.953, 2.045, 3.789, 13.632],
  "35-44|0-40": [0, 0.066, 0.307, 1.034, 3.895], "35-44|40-60": [0.014, 0.188, 0.527, 1.863, 5.052], "35-44|60-80": [0.049, 0.413, 1.059, 2.362, 6.35], "35-44|80-100": [0.143, 0.877, 2.413, 5.501, 17.207],
  "45-54|0-40": [0, 0.043, 0.252, 1.099, 6.426], "45-54|40-60": [0.04, 0.342, 0.817, 2.568, 11.724], "45-54|60-80": [0.097, 0.498, 1.2, 2.936, 9.624], "45-54|80-100": [0.097, 0.862, 2.241, 5.255, 14.481],
  "55-64|0-40": [0, 0.076, 0.471, 1.51, 8.958], "55-64|40-60": [0.033, 0.234, 0.73, 2.178, 17.709], "55-64|60-80": [0.078, 0.635, 1.981, 4.886, 13.232], "55-64|80-100": [0.206, 1.005, 2.599, 5.96, 26.055] };
const ig4 = (i) => (i < CUTS[1] ? "0-40" : i < CUTS[2] ? "40-60" : i < CUTS[3] ? "60-80" : "80-100");
// Freddie Mac PMMS, annual average of the weekly 30-year rate (pmms30), through 2026-11-05, read 2026-11-07
const PMMS30 = { 1996: 7.81, 1997: 7.6, 1998: 6.94, 1999: 7.44, 2000: 8.05, 2001: 6.97, 2002: 6.54, 2003: 5.83, 2004: 5.84, 2005: 5.87, 2006: 6.41, 2007: 6.34, 2008: 6.03, 2009: 5.04, 2010: 4.69, 2011: 4.45, 2012: 3.66, 2013: 3.98,
  2014: 4.17, 2015: 3.85, 2016: 3.65, 2017: 3.99, 2018: 4.54, 2019: 3.94, 2020: 3.11, 2021: 2.96, 2022: 5.34, 2023: 6.81, 2024: 6.72, 2025: 6.6, 2026: 6.53 };
// CDC/NCHS United States Life Tables, 2024: survivors l(x) of 100,000 at ages 0..100
const LIFE = {
  male: [100000, 99411, 99367, 99339, 99315, 99297, 99281, 99266, 99253, 99241, 99230, 99221, 99211, 99197, 99173, 99138, 99089, 99029, 98957, 98875, 98783, 98681, 98570, 98450, 98324, 98194, 98061, 97923, 97779, 97626, 97465, 97293, 97113, 96923, 96726, 96519, 96304, 96079, 95844, 95597, 95339, 95066, 94780, 94482, 94172, 93853, 93521, 93175, 92809, 92418, 91999, 91549, 91066, 90549, 89996, 89406, 88777, 88104, 87376, 86584, 85721, 84788, 83788, 82723, 81595, 80401, 79140, 77796, 76382, 74893, 73331, 71702, 69991, 68187, 66290, 64291, 62175, 59946, 57635, 55115, 52469, 49640, 46696, 43569, 40370, 37049, 33693, 30314, 26902, 23510, 20201, 17036, 14076, 11373, 8968, 6890, 5146, 3731, 2621, 1782, 1170],
  female: [100000, 99484, 99449, 99426, 99409, 99393, 99380, 99368, 99357, 99346, 99336, 99325, 99314, 99302, 99287, 99268, 99246, 99220, 99191, 99159, 99124, 99086, 99045, 99000, 98954, 98905, 98855, 98802, 98745, 98683, 98614, 98539, 98457, 98368, 98274, 98173, 98067, 97953, 97832, 97702, 97564, 97417, 97259, 97092, 96915, 96729, 96532, 96321, 96096, 95854, 95595, 95317, 95018, 94696, 94350, 93976, 93573, 93138, 92663, 92143, 91574, 90956, 90289, 89574, 88809, 87990, 87113, 86169, 85163, 84094, 82959, 81759, 80480, 79102, 77620, 76003, 74249, 72336, 70308, 68039, 65626, 63001, 60181, 57143, 53924, 50535, 46986, 43254, 39375, 35397, 31379, 27387, 23494, 19775, 16302, 13135, 10326, 7904, 5880, 4243, 2966],
  total: [100000, 99447, 99407, 99381, 99361, 99344, 99330, 99316, 99304, 99292, 99282, 99272, 99262, 99248, 99229, 99202, 99166, 99122, 99071, 99013, 98950, 98879, 98802, 98718, 98631, 98541, 98448, 98352, 98251, 98143, 98027, 97902, 97770, 97630, 97483, 97329, 97167, 96997, 96817, 96628, 96428, 96217, 95994, 95760, 95516, 95262, 94996, 94717, 94420, 94103, 93763, 93397, 93004, 92583, 92132, 91648, 91130, 90574, 89971, 89313, 88595, 87817, 86982, 86090, 85141, 84133, 83063, 81918, 80708, 79429, 78082, 76668, 75173, 73584, 71897, 70090, 68157, 66086, 63917, 61524, 58997, 56274, 53397, 50322, 47121, 43776, 40341, 36781, 33138, 29462, 25811, 22248, 18837, 15640, 12710, 10093, 7817, 5895, 4320, 3072, 2116],
};
const survive = (sex, x, to) => { const l = LIFE[sex]; const a = Math.min(100, Math.max(0, Math.floor(x))), b = Math.min(100, Math.max(0, Math.floor(to))); return b > 100 ? 0 : l[b] / l[a]; };
// IRS 2026 limits (IR-2025-111, Notice 2025-67); SSA 2026 wage base
const L402 = (age) => 24500 + (age >= 60 && age <= 63 ? 11250 : age >= 50 ? 8000 : 0);
const IRA = (age) => 7500 + (age >= 50 ? 1100 : 0);
const WAGE_BASE = { 2026: 184500, 2027: 192300 };
// BLS usual weekly earnings of full-time workers by age, Q2 2026 (median); P10 and P90 of all workers $642 / $2,924
const BLS_WEEK = [[24, 773], [34, 1173], [44, 1414], [54, 1407], [64, 1376], [200, 1165]];
const medianPay = (age) => Math.round((BLS_WEEK.find(([hi]) => age <= hi)[1] * 52) / 1000) * 1000;
const NO_WAGE_TAX = new Set(["AK", "FL", "NV", "NH", "SD", "TN", "TX", "WY", "WA"]);
// each state's own zero line for wages (2026 allowances; the rules file, pt.state.never-silent-zero); unlisted: $15,000
const ZERO_LINE = { OH: [26050, 26050], CA: [5540, 11080], NY: [8000, 16050], GA: [12000, 24000], MS: [18300, 36600] };

// ---------------------------------------------------------------------------------------------------------------------
// small helpers
const L = (o, k) => (Array.isArray(o?.[k]) ? o[k] : []);
const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : Number.isFinite(Number(x)) && x !== null && x !== "" ? Number(x) : null);
const r0 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? x : Math.round(x));
const r2 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? x : Math.round(x * 100) / 100);
const r3 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? x : Math.round(x * 1000) / 1000);
const yearsAge = (birth, iso) => { if (!birth || !iso) return null; const m = monthsBetween(birth, iso); return m === null ? null : m / 12; };
const monthOf = (iso) => String(iso ?? "").slice(0, 7);
const perYear = (amount, period) => { const a = Number(amount) || 0; return ({ weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, quarterly: 4, annual: 1, yearly: 1, once: 0 })[period ?? "monthly"] * a; };
const money = (n) => (n === null || n === undefined || !Number.isFinite(n) ? String(n) : `$${Math.round(n).toLocaleString("en-US")}`);
const inRange = (x, lo, hi) => x >= lo && x <= hi;
/** How far a guessed payment may sit from the exact one: it is rounded (core/math/estimate roundGuess), to $10 or so. */
const ROUNDING = (pay) => Math.max(5, 0.0125 * pay);

// ---------------------------------------------------------------------------------------------------------------------
// Get started, as the screens save it: each answer is applied to a copy of the plan, with our guesses worked out from the
// plan as it was before the save (ctx.guess), then settle runs (store.update), exactly as the app does.
function step(p, fn, today) {
  const before = structuredClone(p);
  const guess = (k, o = {}) => E.estimate(before, k, { ...GO(today), ...o });
  const d = structuredClone(p);
  fn(d, guess, before);
  E.settle(d, GO(today));
  return d;
}
/**
 * One household through Get started. o: { who: "me"|"spouse"|"partner", ages: [self, partner?], status: ["work"|"retired"|"none", ...],
 * pays: [yearly or null (blank box), ...], kids: [ages; null = no birth year], state, tenure: "rent"|"own"|"mortgage",
 * typed: { home, payment, owed } (what the person typed about the home and mortgage), debts: ["car-loan", ...], kind: "work"|"own",
 * taps: { "health-cover", childcare, hoa, "mortgage-start" }, pension (a month, retired), noAges, goals, have, by: "self" (own business),
 * left (question 6 answered the left-over way: what is left over a month, setup applyLeftOver, a051c6f) }
 * -> { plan, preview } (preview: the grey spending figures the screen showed, for SF-SPEND-ONE-FIGURE)
 */
export function walk(o, today = TODAY) {
  const ty = Number(today.slice(0, 4));
  let p = migrate(emptyPlan());
  const two = o.who && o.who !== "me";
  const ids = two ? ["setup-self", "setup-partner"] : ["setup-self"];
  const kids = o.kids ?? [];
  p = step(p, (d) => S.applyYou(d, { name: "Me", who: o.who ?? "me", partnerName: "Partner", kids: kids.length, state: o.state ?? "OH" }), today);
  const people = {};
  ids.forEach((id, i) => {
    const st = o.status?.[i] ?? "work";
    people[id] = st === "work" ? { status: "work", amount: o.pays?.[i] === null || o.pays?.[i] === undefined ? "" : String(o.pays[i]), period: "annual", ...(o.by && i === 0 ? { by: "self" } : {}) }
      : st === "retired" ? { status: "retired", ...(o.pension && i === 0 ? { pension: o.pension } : {}) } : { status: "none" };
  });
  p = step(p, (d) => S.applyMoney(d, { people, other: o.other ?? {}, today }), today);
  if (!o.noAges) {
    const a = {};
    ids.forEach((id, i) => {
      const age = o.ages[i], st = o.status?.[i] ?? "work";
      // the stop-age stepper starts at the plan's 65 and holds it to at least next year's age (setup view: stepper min a + 1)
      // the Social Security answer as the screen sends it: someone who said "retired" on question 2 is never offered "Estimate it
      // for me" (overview/setup view.js: it becomes "I already get it", amount blank); verify 2026-11-07
      a[id] = { month: i === 0 ? 3 : 8, year: ty - age, stopAge: Math.max(65, age + 1, 40), retired: st === "retired", ss: { mode: o.ss ?? (st === "retired" ? "getting" : "estimate") } };
    });
    const k = {};
    kids.forEach((age, i) => { k[`setup-kid-${i + 1}`] = age === null ? "" : ty - age; });
    p = step(p, (d) => S.applyAges(d, { people: a, kids: k }, today), today);
  }
  const owns = o.tenure === "own" || o.tenure === "mortgage";
  const have = o.have ?? ["checking", "savings", "retire", "invest", ...(owns ? ["home"] : []), ...((o.debts ?? []).includes("car-loan") ? ["car"] : [])];
  p = step(p, (d) => S.applyHavePicks(d, have), today);
  const hv = {};
  if (o.kind) for (const id of ids) hv[`kind-${id}`] = o.kind;
  if (owns && o.typed?.home) hv.home = o.typed.home;
  p = step(p, (d, guess) => S.applyHaveAmounts(d, hv, today, { guess }), today);
  const owe = [...(o.tenure === "mortgage" ? ["mortgage"] : []), ...(o.debts ?? [])];
  p = step(p, (d) => S.applyOwePicks(d, owe.length ? owe : ["none"]), today);
  if (owe.length) {
    const x = {};
    if (o.tenure === "mortgage") x.mortgage = { owed: o.typed?.owed ?? "", payment: o.typed?.payment ?? "", ...(o.taps?.["mortgage-start"] ? { start: o.taps["mortgage-start"] } : {}) };
    p = step(p, (d, guess) => S.applyOweAmounts(d, x, today, { guess }), today);
  }
  const taps = Object.fromEntries(Object.entries(o.taps ?? {}).filter(([k, v]) => ["health-cover", "childcare", "hoa"].includes(k) && v));
  const sv = { mode: "rows", rows: {}, taps };
  let preview = null;
  p = step(p, (d, guess, before) => {
    // the left-over way writes rows worked out from it, not the grey figures, so there is no preview to hold them to
    if (o.left !== undefined && o.left !== null) { S.applyLeftOver(d, { ...sv, left: o.left }, today, { guess }); return; }
    const args = S.spendArgs(before, sv);
    preview = Object.fromEntries(Object.keys(args.rows).map((k) => [k, guess(`spend.${k}`, { path: `expenses[setup-x-${k}].amount`, args })?.value ?? null]));
    S.applySpend(d, sv, today, { guess });
  }, today);
  const goals = o.goals ?? ["cushion", "retire", ...(kids.some((k) => k === null || k < 18) ? ["education"] : []), ...(o.tenure === "rent" && o.homeGoal ? ["home"] : [])];
  p = step(p, (d) => S.applyGoalPicks(d, goals), today);
  p = step(p, (d) => S.applyGoalDetails(d, {}, today), today);
  p = step(p, (d) => S.applyGuesses(d, today), today);
  return { plan: p, preview };
}

// ---------------------------------------------------------------------------------------------------------------------
// The grid. Ages 20..85 every 5 plus 22, 62, 67, 73; single, couple the same age, couple 10 years apart; 0..3 children
// of believable ages; renter, owner without a mortgage (nothing typed / home value typed), owner with one (nothing typed /
// home value only / payment only / balance only); pay low, median, high for the age (BLS) or retired; 6 states.
export const GRID_AGES = [20, 22, 25, 30, 35, 40, 45, 50, 55, 60, 62, 65, 67, 70, 73, 75, 80, 85];
export const STATES = ["OH", "CA", "TX", "NY", "GA", "MS"];
export const TENURES = [["rent", {}], ["own", {}], ["own", { home: true }], ["mortgage", {}], ["mortgage", { home: true }], ["mortgage", { payment: true }], ["mortgage", { owed: true }]];
const DEBT_SETS = [[], ["car-loan"], ["student", "credit"], ["car-loan", "student", "credit", "loan"]];
const PAY_TIERS = { low: 0.51, median: 1, high: 2.34 };   // BLS P10 and P90 over the median, all full-time workers
/** Children of believable ages for the youngest adult y: the first born at 20 (young parents) or 28, then every 3 years; parent 18..45 at each birth. */
export function kidAges(y, n) {
  if (!n) return [];
  const k0 = y < 28 ? Math.max(0, y - 20) : Math.min(17, y - 28);
  const out = [];
  for (let i = 0; i < n; i++) { const k = k0 - 3 * i; if (k < 0 || y - k < 18 || y - k > 45) return null; out.push(k); }
  return out;
}
const payVariants = (age) => (age < 62 ? ["low", "median", "high"] : age <= 70 ? ["low", "median", "high", "retired"] : ["median", "retired"]);
/** A typed figure a person might know: the survey's middle for the age (home value x income, owed x value, a payment of 15% of pay). */
function typedFigures(ages, income) {
  const b = band(Math.max(...ages)), inc = Math.max(income, 40000);
  const home = Math.round((SCF_VI[b][1] * inc) / 5000) * 5000;
  const owed = Math.round((home * SCF_LTV[b][2]) / 1000) * 1000;
  const payment = Math.max(400, Math.round((0.15 * inc) / 12 / 10) * 10);
  return { home, owed, payment };
}
/** Every grid household (the full cross); `sample` keeps a covering subset: the state rotates instead of crossing. */
export function gridSpecs({ full = false } = {}) {
  const out = [];
  let i = 0;
  GRID_AGES.forEach((age, ai) => {
    ["single", "same", "apart"].forEach((type, ti) => {
      const ages = type === "single" ? [age] : type === "same" ? [age, age] : [age, age - 10 >= 18 ? age - 10 : age + 10];
      const youngest = Math.min(...ages);
      for (let n = 0; n <= 3; n++) {
        const kids = kidAges(youngest, n);
        if (kids === null) continue;
        payVariants(age).forEach((pv, pi) => {
          TENURES.forEach(([tenure, t], tni) => {
            const states = full ? STATES : [STATES[(ai + ti * 2 + n * 3 + pi + tni * 5) % STATES.length]];
            for (const state of states) {
              const status = ages.map((a) => (pv === "retired" && a >= 62 ? "retired" : "work"));
              // spread the rest so every value meets every age: who works at home, unmarried partners, other debts, retirement kind, taps
              const who = type === "single" ? "me" : i % 4 === 3 ? "partner" : "spouse";
              if (type !== "single" && i % 5 === 4 && status[1] === "work") status[1] = "none";
              const pays = ages.map((a, k) => (status[k] === "work" ? Math.round((medianPay(a) * PAY_TIERS[pv === "retired" ? "median" : pv]) / 1000) * 1000 : null));
              const income = pays.reduce((s, x) => s + (x ?? 0), 0);
              const tf = typedFigures(ages, income);
              const typed = { ...(t.home ? { home: tf.home } : {}), ...(t.payment ? { payment: tf.payment } : {}), ...(t.owed ? { owed: tf.owed } : {}) };
              const debts = DEBT_SETS[(i + ai) % DEBT_SETS.length].filter((d) => d !== "student" || age < 70 || i % 2 === 0);
              const taps = { ...(kids.length ? { childcare: ["yes", "no", null][i % 3] } : {}), "health-cover": [null, null, "work", "own", "unsure"][i % 5] };
              const pension = status[0] === "retired" && i % 2 === 0 ? 1200 : 0;
              out.push({ id: `g${i}`, src: "grid", who, ages, status, pays, kids, state, tenure, typed, debts, kind: i % 3 === 2 ? "own" : "work", taps, pension, homeGoal: i % 2 === 0 });
              i++;
            }
          });
        });
      }
    });
  });
  return out;
}
/** Households built for one rule each (the edge of what the grid holds). */
export function edgeSpecs() {
  const e = [];
  const add = (id, o) => e.push({ id, src: "edge", status: o.status ?? o.ages.map(() => "work"), pays: o.pays ?? o.ages.map(() => 60000), kids: [], state: "OH", tenure: "rent", typed: {}, debts: [], kind: "work", taps: {}, ...o });
  add("e-partner-pay-blank", { who: "spouse", ages: [40, 40], state: "GA", pays: [70000, null] });
  add("e-one-earner", { who: "spouse", ages: [45, 45], pays: [150000, null], status: ["work", "none"] });
  add("e-unmarried", { who: "partner", ages: [35, 33], pays: [80000, 50000] });
  add("e-retired-couple", { who: "spouse", ages: [70, 68], status: ["retired", "retired"], pays: [null, null] });
  add("e-works-past-65", { who: "me", ages: [67], pays: [60000] });
  add("e-undated-kid", { who: "spouse", ages: [70, 70], kids: [null], status: ["retired", "retired"], pays: [null, null] });
  add("e-young-mortgage", { who: "spouse", ages: [25, 25], pays: [90000, 90000], tenure: "mortgage" });
  add("e-old-mortgage", { who: "me", ages: [78], status: ["retired"], pays: [null], tenure: "mortgage" });
  add("e-side-business", { who: "me", ages: [40], state: "CA", pays: [180000], other: { kind: "business", amount: 2000 } });
  add("e-freelancer", { who: "me", ages: [38], state: "NY", pays: [95000], by: "self" });
  add("e-no-birth-dates", { who: "me", ages: [50], noAges: true, pays: [70000] });
  add("e-retired-pension-no-ages", { who: "me", ages: [70], noAges: true, status: ["retired"], pays: [null], pension: 1500 });
  add("e-childcare-yes", { who: "me", ages: [30], pays: [50000], kids: [0, 3, 7], taps: { childcare: "yes" } });
  add("e-childcare-teen", { who: "spouse", ages: [45, 45], pays: [70000, 70000], kids: [13, 15], taps: { childcare: "yes" } });
  add("e-student-78", { who: "me", ages: [78], status: ["retired"], pays: [null], debts: ["student"] });
  add("e-card-big", { who: "me", ages: [45], pays: [150000], debts: ["credit"] });
  // question 6 answered the left-over way (a051c6f): SF-LEFTOVER-TYPED
  add("e-leftover-couple", { who: "spouse", ages: [35, 33], pays: [70000, 50000], left: 1500 });
  add("e-leftover-mortgage-kids", { who: "spouse", ages: [40, 38], pays: [90000, 60000], kids: [8, 5], tenure: "mortgage", debts: ["car-loan"], left: 800 });
  add("e-leftover-goes-down", { who: "me", ages: [28], pays: [42000], debts: ["student", "credit"], left: -150 });
  add("e-leftover-retired", { who: "spouse", ages: [70, 68], status: ["retired", "retired"], pays: [null, null], tenure: "own", pension: 2500, left: 300 });
  return e;
}
/** The qa fixtures (each exported plan builder); the setup personas are walked through the rest of Get started with our guesses. */
export async function fixturePlans() {
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".mjs") && !["fake-dom.mjs"].includes(x)).sort()) {
    let mod;
    try { mod = await import(pathToFileURL(path.join(dir, f)).href); } catch { continue; }
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn !== "function" || !/plan|Plan|household|Household|jordan|patLee|sam|ruth|Couple|Retiree|separate/.test(name) || /^(withVisaFile|noCardFromAug|oneFileAMonth|bankLine|anAccount|finishSetup|renderPage|pageText|textOf)$/.test(name)) continue;
      let plan = null;
      try { plan = fn.length > 1 ? null : fn(); } catch { plan = null; }
      if (!plan || typeof plan !== "object" || !plan.household) continue;
      if (f === "setup-personas.mjs") plan = finishWithGuesses(plan);
      out.push({ id: `fixture:${f.replace(/\.mjs$/, "")}:${name}`, src: "fixture", plan: migrate(plan) });
    }
  }
  return out;
}
/** A persona stopped at the debts question: every later box left blank, saved as the screens save it. */
export function finishWithGuesses(p0, today = TODAY) {
  let p = p0;
  if (S.picks(p, "owe").length && S.picks(p, "owe")[0] !== "none") p = step(p, (d, guess) => S.applyOweAmounts(d, {}, today, { guess }), today);
  p = step(p, (d, guess) => S.applySpend(d, { mode: "rows", rows: {} }, today, { guess }), today);
  p = step(p, (d) => S.applyGoalPicks(d, ["cushion", "retire"]), today);
  p = step(p, (d) => S.applyGoalDetails(d, {}, today), today);
  return p;
}
/** Every plan in qa/households (the Plan JSON block of each case file). */
export function qaHouseholdFiles() {
  const dir = path.join(ROOT, "qa", "households");
  const out = [];
  const walkDir = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walkDir(f); else if (e.name.endsWith(".md") && /^H-\d+/.test(e.name)) out.push(f); } };
  if (fs.existsSync(dir)) walkDir(dir);
  return out.sort();
}
export function qaHouseholdPlan(file) {
  const md = fs.readFileSync(file, "utf8");
  const json = (/```json\n([\s\S]*?)\n```/.exec(md) || [])[1];
  if (!json) return null;
  try { return migrate(JSON.parse(json)); } catch { return null; }
}

// ---------------------------------------------------------------------------------------------------------------------
// One household as the pages see it: computes on demand (memoised), the facts that describe it, and the shared readings.
const PAGES = new Map();
async function loadPage(id) { if (!PAGES.has(id)) PAGES.set(id, await import(pathToFileURL(path.join(ROOT, "modules", id, "compute.js")).href)); return PAGES.get(id); }
/** The pages whose figures the rules read. Tier A: every household. Tier B: adds the slower ones (every 3rd grid household). */
export const PAGES_A = ["balance/liabilities", "debt/mortgage", "debt/payoff", "balance/net-worth", "property/home", "retirement/social-security", "retirement/medicare", "retirement/pensions",
  "investments/glide-path", "goals/emergency-fund", "balance/liquidity", "goals/education", "goals/goals", "cashflow/expenses", "cashflow/income", "cashflow/paycheck", "taxes/state",
  "taxes/withholding", "taxes/federal", "taxes/estimated", "cashflow/budget-percent", "career/side-income", "taxes/self-employment"];
export const PAGES_B = ["retirement/projection", "retirement/fire", "overview/timeline", "balance/projection", "insurance/life-needs", "retirement/rmd", "career/salary"];
export const PAGE_IDS = [...PAGES_A, ...PAGES_B];
export async function loadPages() { for (const id of PAGE_IDS) { try { await loadPage(id); } catch { /* a page that is gone is reported by the rule that needs it */ } } }

export class Household {
  constructor(plan, spec = {}, { today = TODAY, tier = "A" } = {}) {
    this.plan = plan; this.spec = spec; this.today = today; this.tier = tier;
    this.memo = new Map();
    this.ledger = new Set(E.guessesInUse(plan).map((e) => e.path));
  }
  once(k, f) { if (!this.memo.has(k)) { let v; try { v = f(); } catch (e) { v = { __error: String(e?.message ?? e) }; } this.memo.set(k, v); } return this.memo.get(k); }
  page(id) { return this.once(`page:${id}`, () => { const m = PAGES.get(id); if (!m) throw new Error(`page ${id} not loaded`); return m.compute(this.plan, { today: this.today }); }); }
  ok(id) { const r = this.page(id); return r && !r.__error ? r : null; }
  est(key, opts = {}) { return this.once(`est:${key}:${JSON.stringify(opts)}`, () => E.estimate(this.plan, key, { ...GO(this.today), ...opts })); }
  guessed(p) { return this.ledger.has(p); }
  get lib() { return { memo: (k, f) => f(), estimate: (k, o = {}) => E.estimate(this.plan, k, { ...GO(this.today), ...o }) }; }
  get people() { return L(this.plan.household, "people"); }
  get adults() { return this.people.filter((p) => p.role !== "dependent"); }
  get deps() { return this.people.filter((p) => p.role === "dependent"); }
  ageOf(p, iso = this.today) { return p?.birthDate ? yearsAge(p.birthDate, iso) : null; }
  get ages() { return this.adults.map((a) => this.ageOf(a)).filter((a) => a !== null); }
  get oldest() { return this.ages.length ? Math.max(...this.ages) : null; }
  get youngest() { return this.ages.length ? Math.min(...this.ages) : null; }
  /** The oldest adult's age on a date. */
  ageAt(iso) { const o = this.adults.filter((a) => a.birthDate).sort((a, b) => a.birthDate.localeCompare(b.birthDate))[0]; return o ? yearsAge(o.birthDate, iso) : null; }
  get kidsUnder18() { return this.deps.filter((k) => !k.birthDate || ageOn(k.birthDate, this.today) < 18); }
  get couple() { return this.adults.length >= 2; }
  get fam() { return `${this.couple ? "couple" : "single"}${this.kidsUnder18.length ? "+kids" : ""}`; }
  /** Every income line coming in today, a year. */
  get income() { return this.once("income", () => this.ok("cashflow/income")?.yearly ?? 0); }
  get payYearly() { return this.once("pay", () => L(this.plan, "income").filter((x) => ["salary", "business", "bonus"].includes(x.type) && x.period !== "once" && !x.endDate && (!x.startDate || x.startDate <= this.today)).reduce((s, x) => s + perYear(x.amount, x.period), 0)); }
  status(pid) { return this.plan.guide?.setup?.status?.[pid] ?? null; }
  get owner() { return L(this.plan, "accounts").some((a) => a.type === "property" || a.type === "real_estate") || L(this.plan, "property").some((x) => x.kind === "home"); }
  get home() {
    return this.once("home", () => {
      const p = L(this.plan, "property").find((x) => x.kind === "home");
      const acct = (p?.accountId ? L(this.plan, "accounts").find((a) => a.id === p.accountId) : null) ?? L(this.plan, "accounts").find((a) => a.type === "property" || a.type === "real_estate") ?? null;
      if (!acct && !p) return null;
      const value = num(acct?.balance) ?? num(p?.value);
      const vPath = acct ? `accounts[${acct.id}].balance` : null;
      const purchaseDate = p?.purchaseDate || null;
      const pdPath = p ? `property[${p.id}].purchaseDate` : null;
      return { acct, entry: p, value, guessed: vPath ? this.guessed(vPath) : false, purchaseDate, purchaseGuessed: pdPath ? this.guessed(pdPath) : false };
    });
  }
  /** Each debt as Liabilities shows it, with what is a guess. */
  get debts() {
    return this.once("debts", () => {
      const lib = this.ok("balance/liabilities");
      return L(this.plan, "debts").map((d) => {
        const acct = L(this.plan, "accounts").find((a) => a.id === d.accountId);
        if (!acct) return null;
        const owed = Math.abs(Number(acct.balance) || 0);
        const g = { owed: this.guessed(`accounts[${acct.id}].balance`), rate: this.guessed(`debts[${d.id}].rate`), pay: this.guessed(`debts[${d.id}].minPayment`) };
        const kind = acct.type === "mortgage" ? "mortgage" : acct.type === "credit" || acct.type === "credit_card" ? "credit" : acct.type === "student_loan" ? "student" : d.id === "setup-debt-car-loan" || /\bcar\b|auto|vehicle/i.test(String(acct.name)) ? "car-loan" : acct.type === "loan" ? "loan" : acct.type;
        const row = lib?.rows?.find((r) => r.id === acct.id) ?? null;
        return { d, acct, kind, owed, rate: Number(d.rate) || 0, pay: Number(d.minPayment) || 0, term: num(d.termMonths), startDate: d.startDate || null, g, anyGuess: g.owed || g.rate || g.pay, row };
      }).filter(Boolean);
    });
  }
  /** The main mortgage, as the rules define M (qa/guess-sanity-rules.json defs, home-debt). */
  get mortgage() {
    return this.once("mortgage", () => {
      const m = this.debts.filter((x) => x.kind === "mortgage" && x.owed > 0).sort((a, b) => b.owed - a.owed)[0];
      if (!m) return null;
      // the tax and insurance the app takes to be inside the payment: in a guessed payment (debt.mortgage.payment adds them), and
      // in a typed payment it works a guessed balance back from (debt.mortgage.owed takes them off); never in a payment and
      // balance both typed (nothing in the app reads tax and insurance into those). The escrow tap "no" takes them out.
      // A figure on the debt row (debts[].escrowMonthly: typed, answered on Debts or Get started, or kept from a guessed payment)
      // is the one, 0 included (2026-11-07).
      const tap = this.plan.guide?.setup?.taps?.escrow;
      const assumed = tap !== "no" && (m.g.pay || m.g.owed);
      const own = typeof m.d?.escrowMonthly === "number" && Number.isFinite(m.d.escrowMonthly) ? Math.max(0, m.d.escrowMonthly) : null;
      const esc = own !== null ? own : assumed ? escrowMonthly(this.plan, { today: this.today }, this.lib)?.total ?? 0 : 0;
      const term = m.term ?? 360;
      const left = num(m.row?.months);
      const start = left !== null && Number.isFinite(left) ? addMonths(this.today, Math.round(left - term)) : null;
      const startTyped = !!m.startDate || m.term !== null;
      const loanAgeTyped = startTyped || !!this.plan.guide?.setup?.taps?.["mortgage-start"] || (!!this.home?.purchaseDate && !this.home?.purchaseGuessed) || (!m.g.owed && !m.g.pay);
      return { ...m, esc, pi: m.pay - esc, term, left, start: startTyped && m.startDate ? m.startDate : start, startTyped, loanAgeTyped, derived: m.anyGuess && !startTyped };
    });
  }
  /** Spending rows Get started saved (setup-x-*), a month, and which are ours. */
  get spendRows() {
    return this.once("spend", () => {
      const rows = {};
      for (const x of L(this.plan, "expenses")) if (typeof x.id === "string" && x.id.startsWith("setup-x-")) rows[x.id.slice(8)] = { monthly: perYear(x.amount, x.period) / 12, guessed: this.guessed(`expenses[${x.id}].amount`) };
      return rows;
    });
  }
  get spendTyped() { return Object.values(this.spendRows).some((r) => !r.guessed) || L(this.plan, "expenses").some((x) => !String(x.id).startsWith("setup-x-")); }
  /** After-tax income a month (spend.js takeHome) and the left over Next best action, Budget and the Dashboard show. */
  get takeHomeMonthly() { return this.once("th", () => { const t = takeHome(this.plan, this.today); return t ? t.a / 12 : null; }); }
  get leftOver() { return this.once("lo", () => { const b = this.ok("cashflow/budget-percent"); return b?.ready ? { monthly: b.saving?.leftover === undefined ? null : b.saving.leftover - (b.saving.short ?? 0), afterTax: b.month?.afterTax ?? null, payroll: b.month?.payroll ?? 0 } : null; }); }
  /** What describes the household in an example: who, ages, children, state, home, pay, what was typed. */
  get facts() {
    return this.once("facts", () => {
      const s = this.spec;
      const f = { id: s.id, src: s.src };
      f.adults = this.adults.map((a) => `${a.role === "self" ? "self" : a.relation || "partner"} ${this.ageOf(a) === null ? "?" : Math.floor(this.ageOf(a))}${this.status(a.id) ? ` ${this.status(a.id)}` : ""}`).join(", ");
      f.kids = this.deps.map((k) => (k.birthDate ? ageOn(k.birthDate, this.today) : "?")).join(", ") || "none";
      f.state = this.plan.household?.state || "none";
      f.home = s.tenure ? `${s.tenure === "rent" ? "renter" : s.tenure === "own" ? "owner, no mortgage" : "owner with a mortgage"}${Object.keys(s.typed ?? {}).length ? ` (typed: ${Object.entries(s.typed).map(([k, v]) => `${k} ${money(v)}`).join(", ")})` : s.tenure !== "rent" ? " (nothing typed)" : ""}` : this.mortgage ? "owner with a mortgage" : this.owner ? "owner" : "renter or unknown";
      f.pay = money(this.payYearly);
      f.income = money(this.income);
      if (s.debts?.length) f.debts = s.debts.join(", ");
      return f;
    });
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The rules. check(H) returns a list of results: { ok, part?, figures } (one per thing checked), or [] when the rule does not
// apply to the household. `tier`: "A" every household, "B" the ones with the slower pages, "C" the slowest (the sampling).
export const RULES = [];
const rule = (id, tier, check, extra = {}) => RULES.push({ id, tier, check, ...extra });
const res = (ok, figures = {}, part = null) => ({ ok: !!ok, figures, ...(part ? { part } : {}) });
const TIERS = { A: 0, B: 1, C: 2 };

// ---- home and debts (rules-home-debt) ---------------------------------------------------------------------------------
/** The date the household is taken to have bought its home: a guessed purchase date, else (no date kept) the derived loan start. */
function impliedPurchase(H) {
  const h = H.home, M = H.mortgage;
  if (h?.purchaseDate && h.purchaseGuessed) return { date: h.purchaseDate, from: "guessed purchase date" };
  if (h?.purchaseDate) return null;
  if (M?.derived && M.start) return { date: M.start, from: "loan start (no purchase date kept; the mortgage's years left imply it)" };
  return null;
}
rule("HD-HOME-BUY-AGE", "A", (H) => {
  const P = impliedPurchase(H);
  const out = [];
  if (P) { const a = H.ageAt(P.date); out.push(res(P.date <= H.today && a !== null && a >= 18, { purchase: P.date, from: P.from, ageThen: r2(a) })); }
  const M = H.mortgage;
  if (M?.derived && M.start && H.home?.purchaseDate && !H.home.purchaseGuessed) out.push(res(M.start >= H.home.purchaseDate, { loanStart: M.start, purchase: H.home.purchaseDate }, "loan before purchase"));
  return out;
});
rule("HD-HOME-YEARS-IN", "A", (H) => {
  const P = impliedPurchase(H);
  if (!P || H.oldest === null) return [];
  const y = yearsAge(P.date, H.today), q = SCF_YIH[band(H.oldest)], nothing = !H.mortgage?.loanAgeTyped && !H.home?.purchaseDate;
  return [res(nothing ? inRange(y, q[1], q[3]) : inRange(y, q[0], q[4]), { yearsInHome: r2(y), from: P.from, band: band(H.oldest), line: nothing ? `p25..p75 ${q[1]}..${q[3]}` : `p5..p95 ${q[0]}..${q[4]}` })];
});
rule("HD-MORT-START", "A", (H) => {
  const M = H.mortgage;
  if (!M || !M.anyGuess) return [];
  const out = [];
  const shown = [["balance/liabilities", M.left], ["debt/mortgage", num(H.ok("debt/mortgage")?.base?.months)], ["overview/guesses (implied by the guessed payment)", M.g.pay ? nper(M.rate / 12, M.pi + ROUNDING(M.pay), M.owed) : null]];
  for (const [page, left] of shown) {
    if (left === null || left === undefined) continue;
    const start = Number.isFinite(left) ? addMonths(H.today, Math.round(left - M.term)) : null;
    const a = start ? H.ageAt(start) : null;
    const ok = Number.isFinite(left) && left > 0 && left <= M.term + 0.5 && start <= H.today && a !== null && a >= 18 && (!H.home?.purchaseDate || start >= H.home.purchaseDate);
    out.push(res(ok, { monthsLeft: r0(left), term: M.term, loanStart: start, oldestAgeAtStart: r2(a), owed: r0(M.owed), payment: r0(M.pay), escrow: r0(M.esc), rate: M.rate }, page));
  }
  return out;
});
rule("HD-MORT-START-AGE", "A", (H) => {
  const M = H.mortgage, out = [];
  if (M?.derived && M.start) { const a = H.ageAt(M.start); out.push(res(a !== null && a >= 22, { loanStart: M.start, ageThen: r2(a) }, "loan start")); }
  const h = H.home;
  if (h?.purchaseDate && h.purchaseGuessed) { const a = H.ageAt(h.purchaseDate); out.push(res(a !== null && a >= 22, { purchase: h.purchaseDate, ageThen: r2(a) }, "purchase")); }
  return out;
});
rule("HD-MORT-YEARS-LEFT", "A", (H) => {
  const M = H.mortgage;
  if (!M?.derived || M.left === null || H.oldest === null) return [];
  const yl = M.left / 12, q = SCF_LEFT[band(H.oldest)];
  return [res(M.loanAgeTyped ? inRange(yl, q[0], q[4]) : inRange(yl, q[1], q[3]), { yearsLeft: r2(yl), band: band(H.oldest), line: M.loanAgeTyped ? `p5..p95 ${q[0]}..${q[4]}` : `p25..p75 ${q[1]}..${q[3]}`, payoffAge: r2(H.oldest + yl) })];
});
rule("HD-MORT-UNDERWATER", "A", (H) => {
  const M = H.mortgage, h = H.home;
  if (!M || !h?.value || !(M.g.owed || h.guessed)) return [];
  return [res(M.owed <= h.value + 0.5, { owed: r0(M.owed), homeValue: r0(h.value), owedGuessed: M.g.owed, valueGuessed: h.guessed })];
});
rule("HD-MORT-LTV", "A", (H) => {
  const M = H.mortgage, h = H.home;
  if (!M || !h?.value || !(M.g.owed || h.guessed) || H.oldest === null) return [];
  const r = M.owed / h.value, q = SCF_LTV[band(H.oldest)], nothing = M.g.owed && h.guessed && M.g.pay;
  return [res(nothing ? inRange(r, q[1], q[3]) : r <= q[4], { owedOverValue: r3(r), band: band(H.oldest), line: nothing ? `p25..p75 ${q[1]}..${q[3]}` : `<= p95 ${q[4]}` })];
});
rule("HD-MORT-RATE-VINTAGE", "A", (H) => {
  const M = H.mortgage;
  if (!M || !M.g.rate || !M.start) return [];
  const y = Number(M.start.slice(0, 4));
  if (!(y >= 1996) || !PMMS30[y]) return [];
  const d = M.rate * 100 - PMMS30[Math.min(y, 2026)], nothing = !M.loanAgeTyped;
  return [res(nothing ? inRange(d, -1.04, 0.16) : inRange(d, -2.84, 1.46), { rate: r3(M.rate * 100), loanStartYear: y, pmmsThatYear: PMMS30[y], diff: r2(d), line: nothing ? "-1.04..+0.16" : "-2.84..+1.46" })];
});
rule("HD-AMORT-IDENTITY", "A", (H) => {
  const out = [];
  const pay = H.ok("debt/payoff"), mort = H.ok("debt/mortgage");
  for (const x of H.debts) {
    if (!(x.owed > 0) || x.kind === "credit") continue;
    const esc = x.kind === "mortgage" && H.mortgage?.d === x.d ? H.mortgage.esc : 0;
    const pi = x.pay - esc, interest = (x.owed * x.rate) / 12;
    const n = nper(x.rate / 12, pi, x.owed);
    const want = Number.isFinite(n) ? Math.ceil(n - 1e-9) : Infinity;
    // (Pay off debts moves a finished debt's payment to the next one, a strategy it labels: its per-debt months are compared only when there is one debt)
    const single = H.debts.filter((y) => y.owed > 0).length === 1;
    const shown = [["balance/liabilities", num(x.row?.months)], ...(single ? [["debt/payoff", num(pay?.baseline?.debts?.find((y) => y.id === x.acct.id)?.months)]] : []), ...(x.kind === "mortgage" && mort?.mortgage?.id === x.acct.id ? [["debt/mortgage", num(mort.base?.months)]] : [])];
    for (const [page, m] of shown) {
      if (m === null) continue;
      out.push(res(pi > interest && Number.isFinite(want) && Math.abs(m - want) <= 1, { debt: x.kind, owed: r0(x.owed), rate: x.rate, payment: r0(x.pay), escrowInside: r0(esc), interest: r0(interest), shownMonths: m, monthsFromPrincipalAndInterest: Number.isFinite(want) ? want : "never", page }, x.kind));
    }
  }
  return out;
});
rule("HD-ESCROW-ONCE", "A", (H) => {
  const M = H.mortgage;
  if (!M || !(M.esc > 0)) return [];
  const home = H.ok("property/home"), ex = H.ok("cashflow/expenses");
  const lines = home?.costs?.lines ?? [];
  const homeTI = lines.filter((l) => /tax|insur/i.test(`${l.key} ${l.label}`)).reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const dup = (ex?.items ?? []).filter((i) => (ex.active ?? ex.items).includes(i) && /property tax|home ?owner|home insurance|homeowners/i.test(`${i.name} ${i.category}`)).reduce((s, i) => s + (Number(i.monthly) || 0), 0);
  return [res(Math.abs(M.esc * 12 - homeTI) <= 12, { escrowInPaymentYear: r0(M.esc * 12), taxAndInsuranceOnHomePage: r0(homeTI) }, "home page"), res(dup === 0, { escrowInPayment: r0(M.esc), taxOrInsuranceAlsoOnExpenses: r0(dup) }, "expenses")];
});
rule("HD-ESCROW-GUESS", "A", (H) => {
  const M = H.mortgage;
  const path = M?.d?.id ? `debts[${M.d.id}].escrowMonthly` : null;
  if (!path || !H.guessed(path) || !(M.esc > 0)) return [];
  const h = H.home;
  const tax = H.est("home.propertyTax")?.value ?? null, ins = H.est("home.insurance")?.value ?? null;
  const usual = tax !== null && ins !== null ? (tax + ins) / 12 : null;
  const interest = (M.owed * M.rate) / 12;
  return [res(M.esc <= M.pay / 2 + 0.5 && M.pay - M.esc > interest && (usual === null || M.esc <= usual + 1) && (!h?.value || inRange(M.esc * 12 / h.value, 0.0032, 0.0411)),
    { escrowMonthly: r0(M.esc), payment: r0(M.pay), interest: r0(interest), usualTaxAndInsurance: usual === null ? null : r0(usual), homeValue: h?.value ? r0(h.value) : null })];
});
rule("HD-PROPTAX", "A", (H) => {
  const h = H.home;
  if (!h?.value) return [];
  const e = H.est("home.propertyTax");
  if (!e || !(e.value > 0)) return [];
  const t = e.value / h.value;
  const st = H.plan.household?.state;
  const tab = G.TABLES["acs2025_effective_property_tax_rate_by_state"];
  const col = tab ? tab.cols.indexOf(st && tab.cols.includes(st) ? st : "US") : -1;
  const rate = col >= 0 ? tab.rows["median taxes / median value"][col] / 100 : null;
  return [res(inRange(t, 0.0022, 0.025) && (rate === null || Math.abs(e.value - h.value * rate) <= Math.max(0.01 * h.value * rate, 50)), { taxYear: r0(e.value), homeValue: r0(h.value), share: r3(t * 100) + "%", stateRate: rate === null ? null : r3(rate * 100) + "%" })];
});
rule("HD-HOMEINS", "A", (H) => {
  const h = H.home;
  if (!h?.value) return [];
  const e = H.est("home.insurance");
  if (!e || !(e.value > 0)) return [];
  const i = e.value / h.value;
  return [res(inRange(i, 0.001, 0.0161), { insuranceYear: r0(e.value), homeValue: r0(h.value), share: r3(i * 100) + "%" })];
});
rule("HD-HOME-VALUE-INCOME", "A", (H) => {
  const h = H.home;
  // an income under $1,000 a year bounds nothing (the lowest point of the survey's income scale; home.value does the same)
  if (!h?.value || !h.guessed || !(H.income >= 1000) || H.oldest === null) return [];
  const r = h.value / H.income, q = SCF_VI[band(H.oldest)];
  return [res(inRange(r, q[0], q[2]), { homeValue: r0(h.value), income: r0(H.income), valueOverIncome: r2(r), band: band(H.oldest), line: `${q[0]}..${q[2]}` })];
});
rule("HD-CAR-TERM", "A", (H) => H.debts.filter((x) => x.kind === "car-loan" && x.owed > 0 && x.anyGuess).map((x) => {
  const m = num(x.row?.months);
  return res(m !== null && inRange(m, 1, 96) && (!x.row?.payoffDate || monthOf(x.row.payoffDate) > monthOf(H.today)), { owed: r0(x.owed), payment: r0(x.pay), rate: x.rate, monthsLeft: m, payoff: x.row?.payoffDate });
}));
rule("HD-CAR-LEFT", "A", (H) => H.debts.filter((x) => x.kind === "car-loan" && x.owed > 0 && x.anyGuess).map((x) => {
  const m = num(x.row?.months), nothing = !x.g.pay ? false : !H.plan.guide?.setup?.taps?.["car-loan-start"];
  return res(m !== null && m <= 72 && x.owed / x.pay <= 60 && (!nothing || inRange(m, 24, 48)), { monthsLeft: m, owedOverPayment: r2(x.owed / x.pay), line: nothing ? "24..48 months (nothing typed)" : "<= 72 months" });
}));
rule("HD-STUDENT-TERM", "A", (H) => H.debts.filter((x) => x.kind === "student" && x.owed > 0 && x.anyGuess).map((x) => {
  const n = nper(x.rate / 12, x.pay, x.owed);
  const payoffAge = H.oldest !== null && Number.isFinite(n) ? H.oldest + n / 12 : null;
  return res(x.pay > (x.owed * x.rate) / 12 && inRange(n, 1, 360), { owed: r0(x.owed), payment: r0(x.pay), rate: x.rate, months: r0(n), payoffAgeOfOldest: r2(payoffAge) });
}));
rule("HD-CARD-MIN", "A", (H) => H.debts.filter((x) => x.kind === "credit" && x.owed > 0 && x.g.pay).map((x) => {
  const b = x.owed, apr = x.rate, want = b <= 40 ? b : Math.max(40, 0.01 * b + (b * apr) / 12);
  let bal = b, m = 0;
  while (bal > 0.005 && m < 1200) { const i = (bal * apr) / 12; const p = Math.min(bal + i, Math.max(40, bal * 0.01 + i)); bal = bal + i - p; m++; }
  return res(Math.abs(x.pay - want) <= Math.max(5, 0.05 * want) && x.pay <= b + 0.5 && (b > 29000 || m <= 360), { balance: r0(b), apr, minimum: r0(x.pay), rule: r0(want), monthsAtMinimum: m });
}));
rule("HD-CARD-BALANCE", "A", (H) => H.debts.filter((x) => x.kind === "credit" && x.owed > 0 && x.g.owed && H.income > 0 && H.oldest !== null).map((x) => {
  const q = SCF_CARD[band(H.oldest)], nothing = x.g.pay && x.g.rate;
  return res(inRange(x.owed, q[0], q[2]) && x.owed / H.income <= 0.341 && (!nothing || inRange(x.owed, 930, 9500)), { balance: r0(x.owed), income: r0(H.income), band: band(H.oldest), line: nothing ? "$930..$9,500 (nothing typed)" : `${q[0]}..${q[2]}` });
}));
rule("HD-PAYOFF-FUTURE", "B", (H) => {
  const out = [];
  const now = monthOf(H.today);
  for (const x of H.debts) {
    if (x.owed > 0) {
      const r = x.row;
      // a typed payment that never pays the loan off says so (no date); a row without a rate or payment has no date to check
      if (r && !(r.neverPaysOff && !x.g.pay) && r.detail && Number(r.payment) > 0) out.push(res(num(r.months) > 0 && (!r.payoffDate || monthOf(r.payoffDate) >= now) && !(x.g.pay && r.neverPaysOff), { page: "balance/liabilities", months: r.months, payoff: r.payoffDate, neverPaysOff: r.neverPaysOff, paymentGuessed: x.g.pay }, x.kind));
    }
  }
  const tl = H.ok("overview/timeline");
  for (const e of tl?.events ?? []) if (/paid off|debt-free|debt free/i.test(e.title ?? "") && e.date) out.push(res(e.date >= H.today, { page: "overview/timeline", event: e.title, date: e.date }, "timeline"));
  return out;
});
rule("HD-PAYOFF-ONE-DATE", "B", (H) => {
  const out = [];
  const pay = H.ok("debt/payoff"), mort = H.ok("debt/mortgage"), tl = H.ok("overview/timeline"), bp = H.ok("balance/projection");
  const live = H.debts.filter((x) => x.owed > 0 && x.row && Number.isFinite(num(x.row.months)));
  // skeptic pass 2026-11-07: the Timeline's debt-free year and Net worth over time follow the payoff plan (finished debts'
  // payments move onto the next), which Liabilities shows as its second date ("..., Mar 2034 on your payoff plan",
  // debt/payoff twoDates, R4-18). Those two are held to the payoff-plan date when there is one, else to Liabilities' own.
  let two = {};
  try { two = PAYOFF?.twoDates(H.plan, { today: H.today }) ?? {}; } catch { two = {}; }
  const planDate = (x) => two[x.acct.id]?.plan ?? x.row.payoffDate;
  for (const x of live) {
    const ym = (iso) => (iso ? Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) : null);
    const base = ym(x.row.payoffDate);
    const single = live.length === 1;
    const others = [...(single ? [["debt/payoff", pay?.baseline?.debts?.find((y) => y.id === x.acct.id)?.endDate]] : [["debt/payoff (own payment)", pay?.rollover?.find((y) => y.id === x.acct.id)?.ownEnd]]), ...(x.kind === "mortgage" && mort?.mortgage?.id === x.acct.id ? [["debt/mortgage", mort.base?.endDate]] : []),
      ...(x.kind === "mortgage" ? [["overview/timeline", tl?.events?.find((e) => e.kind === "mortgage")?.date]] : [])];
    // a second date is allowed when the page says why (the timeline: "... moving onto it once paid off; on its own payment it runs to ...")
    const labelled = (page) => page === "overview/timeline" && /on its own payment it runs to/.test(tl?.events?.find((e) => e.kind === "mortgage")?.detail ?? "");
    for (const [page, d] of others) if (d) out.push(res(Math.abs(ym(d) - base) <= 1 || labelled(page), { liabilities: x.row.payoffDate, [page]: d }, `${x.kind} ${page}`));
    if (x.kind === "mortgage" && bp?.rows?.length) {
      const free = bp.rows.find((r) => (Number(r.mortgage) || 0) <= 0.5);
      const py = Number(String(planDate(x)).slice(0, 4));
      if (py <= bp.rows[bp.rows.length - 1].year) out.push(res(free && Math.abs(free.year - py) <= 1, { liabilitiesYear: Number(String(x.row.payoffDate).slice(0, 4)), payoffPlanYear: py, projectionMortgageFreeYear: free?.year ?? "never in its years" }, "mortgage balance/projection"));
    }
  }
  if (tl?.headline && live.length) {
    const maxY = Math.max(...live.map((x) => Number(String(planDate(x)).slice(0, 4))));
    out.push(res(tl.headline.debtFreeYear === maxY, { timelineDebtFree: tl.headline.debtFreeYear, lastPayoffOnPayoffPlan: maxY, lastPayoffOwnPayments: Math.max(...live.map((x) => Number(String(x.row.payoffDate).slice(0, 4)))) }, "timeline debt-free"));
  }
  return out;
});
rule("HD-TYPED-WINS", "A", (H) => {
  const out = [], M = H.mortgage, h = H.home;
  if (M && h?.value && !h.guessed && M.g.owed) out.push(res(M.owed <= h.value, { typedHomeValue: r0(h.value), guessedOwed: r0(M.owed) }, "a: owed under the typed value"));
  if (M && !M.g.owed && !M.g.pay && M.g.rate) {
    const n = nper(M.rate / 12, M.pi, M.owed);
    out.push(res(M.rate < (12 * M.pi) / M.owed && n <= M.term, { typedPayment: r0(M.pay), typedOwed: r0(M.owed), guessedRate: M.rate, monthsAtThatRate: Number.isFinite(n) ? r0(n) : "never" }, "b: typed payment pays the guessed rate"));
  }
  if (M && !M.g.owed && M.g.pay) { const n = nper(M.rate / 12, M.pi + ROUNDING(M.pay), M.owed); out.push(res(Number.isFinite(n) && n <= M.term + 0.5, { typedOwed: r0(M.owed), guessedPayment: r0(M.pay), impliedMonths: Number.isFinite(n) ? r0(n) : "never" }, "c: guessed payment over the term")); }
  if (H.plan.guesses && Object.keys(H.plan.guesses).length) {
    const d = structuredClone(H.plan);
    const { changed, dropped } = E.settle(d, GO(H.today));
    out.push(res(!changed.length && !dropped.length, { moved: changed.slice(0, 3).map((c) => `${c.path} ${r2(c.from)} -> ${r2(c.to)}`), dropped: dropped.length }, "f: settle again moves nothing"));
  }
  return out;
});
rule("HD-DEBT-PAY-INCOME-MAX", "A", (H) => {
  const ds = H.debts.filter((x) => x.owed > 0);
  if (!ds.some((x) => x.anyGuess)) return [];
  const S0 = ds.reduce((s, x) => s + x.pay, 0), Gm = H.income / 12;
  if (!(Gm > 0)) return [];
  const out = [res(S0 <= Gm, { debtPayments: r0(S0), grossMonthly: r0(Gm) }, "payments under gross pay")];
  const lo = H.leftOver, th = H.takeHomeMonthly;
  if (lo?.monthly !== null && lo?.monthly !== undefined && th && !H.spendTyped && ds.every((x) => x.g.pay)) out.push(res(lo.monthly >= -0.1 * th, { leftOverMonthly: r0(lo.monthly), takeHomeMonthly: r0(th), debtPayments: r0(S0) }, "left over from guesses"));
  return out;
});
rule("HD-DEBT-PAY-INCOME", "A", (H) => {
  const ds = H.debts.filter((x) => x.owed > 0);
  if (!ds.length || !ds.every((x) => x.g.pay) || !(H.income > 0) || H.oldest === null) return [];
  const Gm = H.income / 12, S0 = ds.reduce((s, x) => s + x.pay, 0), b = band(H.oldest);
  const out = [res(S0 / Gm <= SCF_PIR[b], { debtPayments: r0(S0), grossMonthly: r0(Gm), share: r3(S0 / Gm), p95: SCF_PIR[b] }, "all debts")];
  const M = H.mortgage;
  if (M) out.push(res(M.pay / Gm <= SCF_MPI[b], { mortgagePayment: r0(M.pay), grossMonthly: r0(Gm), share: r3(M.pay / Gm), p95: SCF_MPI[b] }, "mortgage"));
  return out;
});

// ---- pay, tax, Social Security (rules-pay-tax) -------------------------------------------------------------------------
rule("pt.pay.work-has-pay", "A", (H) => {
  const ss = H.ok("retirement/social-security"), pc = H.ok("cashflow/paycheck");
  return H.adults.filter((a) => H.status(a.id) === "work").map((a) => {
    const pay = L(H.plan, "income").filter((x) => x.personId === a.id && ["salary", "business"].includes(x.type) && !x.endDate).reduce((s, x) => s + perYear(x.amount, x.period), 0);
    const p = ss?.people?.find((x) => x.id === a.id);
    const mode = H.plan.guide?.setup?.ss?.[a.id];
    const salary = L(H.plan, "income").some((x) => x.personId === a.id && x.type === "salary");
    // skeptic pass 2026-11-07: Social Security cannot be estimated without a birth year (the page asks for it), so it is
    // required only once the person has one
    return res(pay > 0 && (!salary || pc?.people?.some((x) => x.id === a.id)) && (!a.birthDate || ["none", "statement"].includes(mode) || (p && p.source !== "none")), { person: a.role, payYear: r0(pay), onPaycheck: !!pc?.people?.some((x) => x.id === a.id), ssSource: p?.source ?? null });
  });
});
rule("pt.pay.guess-by-age", "A", (H) => {   // (no pay is guessed yet: modules/overview/guesses/estimators/pay.js is empty)
  const out = [];
  for (const x of L(H.plan, "income")) {
    if (!["salary", "business"].includes(x.type) || !H.guessed(`income[${x.id}].amount`)) continue;
    const a = H.ageOf(H.adults.find((p) => p.id === x.personId));
    if (a === null) continue;
    const wk = perYear(x.amount, x.period) / 52, med = BLS_WEEK.find(([hi]) => a <= hi)[1];
    out.push(res(Math.abs(wk / med - 1) <= 0.1 && inRange(wk, 642, 2924), { weekly: r0(wk), blsMedianForAge: med }));
  }
  return out;
}, { note: "No pay is guessed yet (modules/overview/guesses/estimators/pay.js has no estimators, the pay guesses E33/E34 are planned): the rule checks them once they land." });
rule("pt.pay.raise-one-path", "B", (H) => {
  const inc = H.ok("cashflow/income"), pr = H.ok("retirement/projection"), sal = H.ok("career/salary");
  const g = num(pr?.inputs?.rates?.salaryGrowth), infl = Number(H.plan.assumptions?.inflation ?? 0.03);
  return (inc?.items ?? []).filter((x) => x.type === "salary" && x.active && !(Number(x.growth) > 0)).map((x) => {
    const viaProjection = g === null ? null : x.yearly * (1 + g);
    const job = sal?.jobs?.find((j) => j.incomeId === x.id);
    const viaSalary = job ? x.yearly * (1 + (job.avgGrowth ?? 0)) : null;
    // skeptic pass 2026-11-07: with no raise typed, Income's "Next year" is this year's pay labelled "no raises entered"
    // (cashflow/income view), a statement of what was typed, not a forecast; the forecasts (Projection, Salary) must agree
    const vals = [viaProjection, viaSalary].filter((v) => v !== null && v !== undefined);
    return res(Math.max(...vals) - Math.min(...vals) <= 1, { pay: r0(x.yearly), nextYearOnIncome: r0(x.nextYear), nextYearInProjection: r0(viaProjection), nextYearOnSalaryPage: r0(viaSalary), inflation: infl });
  });
});
rule("pt.pay.working-means-working", "B", (H) => {
  const pr = H.ok("retirement/projection");
  if (!pr?.ready) return [];
  return H.adults.filter((a) => H.status(a.id) === "work" && a.birthDate && L(H.plan, "income").some((x) => x.personId === a.id && ["salary", "business"].includes(x.type) && !x.endDate)).map((a) => {
    const i = H.adults.indexOf(a), p = pr.inputs.people?.find((x) => x.id === a.id) ?? pr.inputs.people?.[i];
    const age = H.ageOf(a);
    const r0w = pr.rows?.[0];
    const counted = r0w && (r0w.retired === false || (r0w.incomeLines ?? []).some((l) => /pay|business|work/i.test(l.name ?? "")));
    return res(p && p.retireAge > age && counted, { person: a.role, age: r2(age), retireAgeUsed: p?.retireAge, thisYearRetired: r0w?.retired, payCountedThisYear: !!counted });
  });
});
rule("pt.takehome.payroll-arithmetic", "A", (H) => {
  const pc = H.ok("cashflow/paycheck");
  if (!pc?.ready) return [];
  const base = WAGE_BASE[pc.year] ?? WAGE_BASE[2026];
  return (pc.people ?? []).filter((p) => p.yearly && p.wages).map((p) => {
    const fica = p.wages.fica * p.paychecks, y = p.yearly;
    const ss = 0.062 * Math.min(fica, base), med = 0.0145 * fica + 0.009 * Math.max(0, fica - 200000);
    // skeptic pass 2026-11-07: two jobs at once (qa starts-next-month: a second salary from October) are two employers, and
    // each withholds Social Security up to the wage base and the extra Medicare above $200,000 on its own pay (IRS Topic 751;
    // the excess comes back on the return): the per-employer arithmetic is right too
    const lines = L(H.plan, "income").filter((x) => x.personId === p.id && x.type === "salary" && !x.endDate && x.period !== "once").map((x) => perYear(x.amount, x.period));
    const tot = lines.reduce((t, v) => t + v, 0);
    const per = lines.length > 1 && tot > 0 ? { ss: lines.reduce((t, v) => t + 0.062 * Math.min((v / tot) * fica, base), 0), med: 0.0145 * fica + lines.reduce((t, v) => t + 0.009 * Math.max(0, (v / tot) * fica - 200000), 0) } : null;
    const okSS = Math.abs(y.ss - ss) <= 1 || (per && Math.abs(y.ss - per.ss) <= 1), okMed = Math.abs(y.medicare - med) <= 1 || (per && Math.abs(y.medicare - per.med) <= 1);
    return res(okSS && okMed && y.net <= y.gross - y.ss - y.medicare + 1 && y.net > 0 && y.net / y.gross <= 0.9235 + 1e-6, { gross: r0(y.gross), ss: r0(y.ss), ssRule: r0(ss), medicare: r0(y.medicare), medicareRule: r0(med), net: r0(y.net) });
  });
});
rule("pt.state.never-silent-zero", "A", (H) => {
  const st = H.ok("taxes/state"), code = H.plan.household?.state;
  if (!st || !code) return [];
  const wages = H.payYearly + L(H.plan, "income").filter((x) => x.type === "pension").reduce((s, x) => s + perYear(x.amount, x.period), 0);
  const pc = H.ok("cashflow/paycheck");
  const pcState = (pc?.people ?? []).reduce((s, p) => s + (p.yearly?.state ?? 0), 0);
  if (NO_WAGE_TAX.has(code)) return [res(!(st.tax > 0.5) && !(pcState > 0.5), { state: code, stateTax: r0(st.tax), paycheckState: r0(pcState) }, "no wage tax")];
  const joint = H.plan.household?.filingStatus === "married_joint";
  const line = (ZERO_LINE[code] ?? [15000, 30000])[joint ? 1 : 0] + 5000;
  if (!(wages > line)) return [];
  const salaried = (pc?.people ?? []).length > 0;
  return [res(st.tax > 0 && st.method !== "unknown" && (!salaried || pcState > 0), { state: code, wages: r0(wages), method: st.method, stateTax: r0(st.tax), paycheckState: r0(pcState) })];
});
rule("pt.tax.partners-two-returns", "A", (H) => {
  const partner = H.adults.find((a) => a.relation === "partner");
  if (!partner) return [];
  const fed = H.ok("taxes/federal");
  const fs1 = H.plan.household?.filingStatus;
  if (!fed?.result) return [res(!/^married/.test(fs1 ?? ""), { filingStatus: fs1 })];
  let draws = true;
  try { const d = fedCompute(H.plan, { today: H.today }); draws = (fedKnown(H.plan, { today: H.today }, d)?.withdrawal?.total ?? 0) > 0; } catch { draws = true; }
  const noDraw = (p) => { p.taxes = { ...(p.taxes ?? {}), thisYear: { ...(p.taxes?.thisYear ?? {}), iraWithdrawals: 0 } }; return p; };
  // each partner's own return: the plan with only that adult (their own pay; the children with one of them: `kidsWith`;
  // verify 2026-11-07: either partner may claim them, so the page may match either way round)
  const one = (keep, kidsWith) => {
    const p = structuredClone(H.plan);
    p.household.people = p.household.people.filter((x) => x.role === "dependent" ? keep.id === kidsWith.id : x.id === keep.id);
    p.household.people = p.household.people.map((x) => (x.id === keep.id ? { ...x, role: "self" } : x));
    p.income = L(p, "income").filter((x) => !x.personId || x.personId === keep.id);
    p.household.filingStatus = p.household.people.some((x) => x.role === "dependent") ? "head_of_household" : "single";
    p.retirement.contributions = L(p.retirement, "contributions").filter((c) => c.personId === keep.id);
    // verify 2026-11-07: a partner taken alone keeps the household's bills, so the estimate would draw all of them from that
    // partner's 401(k) (with the 10% before 59 1/2) on a return that is not real: each own return draws nothing this year
    // (and the household's figure is compared with its draw held at $0 too, when it has one: see `noDraw` below).
    noDraw(p);
    // skeptic pass 2026-11-07: the figure the Federal estimate shows (fullSteps total: the 401(k) put in from pay off wages),
    // not result.totalTax (the answer keys' return, before what the plan knows)
    try { return fedShown(p, H.today); } catch { return null; }
  };
  const self = H.adults.find((x) => x.role === "self");
  const ways = [self, ...(H.deps.length ? [partner] : [])].map((kidsWith) => { const a = one(self, kidsWith), b = one(partner, kidsWith); return a === null || b === null ? null : a + b; });
  // the household's figure as the page shows it; with this year's draw for spending held at $0 when it has one, so the two
  // own returns (which cannot split that draw) are compared on the same income: the question is one return or two
  let shown = null; try { shown = fedShown(draws ? noDraw(structuredClone(H.plan)) : H.plan, H.today); } catch { shown = null; }
  // (an own return that cannot be worked out fails the check, as before)
  const sum = ways.some((x) => x === null) ? null : [...ways].sort((x, y) => Math.abs(x - (shown ?? 0)) - Math.abs(y - (shown ?? 0)))[0];
  return [res(!/^married/.test(fs1 ?? "") && sum !== null && shown !== null && Math.abs(shown - sum) <= 1, { filingStatus: fs1, federalOnPage: r0(shown), twoOwnReturns: r0(sum), ...(ways.length > 1 ? { eitherWay: ways.map(r0) } : {}), ...(draws ? { compared: "with this year's 401(k) draw held at $0" } : {}) })];
});
rule("pt.withholding.default-follows-w4", "A", (H) => {
  const wh = H.ok("taxes/withholding");
  const ans = wh?.estimate;
  if (!ans || ans.from !== "paycheck" || L(H.plan, "income").some((x) => x.type === "business")) return [];
  // which households: unmarried partners' bill comes from one return for both (pt.tax.partners-two-returns), married two
  // earners' from each W-4 left at married-filing-jointly without Step 2
  const kind = H.adults.some((a) => a.relation === "partner") ? "unmarried partners" : H.plan.household?.filingStatus === "married_joint" && L(H.plan, "income").filter((x) => x.type === "salary" && !x.endDate).map((x) => x.personId).filter((v, i, a) => a.indexOf(v) === i).length >= 2 ? "married, two earners" : "other";
  return [res(!(ans.balance >= 1000 && ans.projected < 0.9 * wh.totalTax), { totalTax: r0(wh.totalTax), withheld: r0(ans.projected), balance: r0(ans.balance), filing: H.plan.household?.filingStatus }, kind)];
});
rule("pt.tax.one-refund-or-owe", "A", (H) => {
  const wh = H.ok("taxes/withholding"), est = H.ok("taxes/estimated");
  if (!wh?.hasIncome || !wh.estimate) return [];
  const a = wh.estimate;
  // skeptic pass 2026-11-07: the Federal estimate shows fullSteps' total (taxes/federal view.js `full.total`), the same
  // figure as Withholding check; result.totalTax is the answer keys' return and is not on screen
  let shown = null; try { shown = fedShown(H.plan, H.today); } catch { shown = null; }
  const whTax = wh.totalTax - (wh.creditsBack ?? 0);
  return [res(Math.abs((est?.balanceAtFiling ?? a.balance) - a.balance) <= 1 && (shown === null || Math.abs(shown - whTax) <= 1 || Math.abs(shown - wh.totalTax) <= 1) && a.projected >= 0,
    { withholdingPageBalance: r0(wh.balance), answerBalance: r0(a.balance), estimatedBalanceAtFiling: r0(est?.balanceAtFiling), federalShown: r0(shown), withholdingTotalLessCreditsBack: r0(whTax), verdict: wh.verdict, answerVerdict: a.verdict })];
});
rule("pt.side.set-aside-floor", "A", (H) => {
  const side = H.ok("career/side-income"), se = H.ok("taxes/self-employment");
  const biz = L(H.plan, "income").filter((x) => x.type === "business" && !x.endDate);
  if (!biz.length) return [];
  const P = biz.reduce((s, x) => s + perYear(x.amount, x.period), 0);
  const W = L(H.plan, "income").filter((x) => x.type === "salary" && !x.endDate).reduce((s, x) => s + perYear(x.amount, x.period), 0);
  const base = WAGE_BASE[2026], net = 0.9235 * P;
  const want = net >= 400 ? 0.124 * Math.min(net, Math.max(0, base - W)) + 0.029 * net : 0;
  const sa = side?.setAside ?? side?.items?.[0]?.setAside ?? null;
  const code = H.plan.household?.state;
  const out = [];
  if (sa && typeof sa === "object") out.push(res((sa.yearly ?? 0) >= want - 1 && (NO_WAGE_TAX.has(code) || !(P > 0) || (sa.state ?? 0) > 0), { profit: r0(P), wages: r0(W), setAsideYearly: r0(sa.yearly), seTaxFloor: r0(want), statePart: r0(sa.state), state: code }, "side income set-aside"));
  if (se && num(se.total) !== null) out.push(res(Math.abs(se.total - want - 0.009 * Math.max(0, W + net - 200000)) <= Math.max(1, 0.01 * want), { seOnPage: r0(se.total), seRule: r0(want) }, "self-employment page"));
  return out;
});
rule("pt.ss.claim-age", "A", (H) => {
  const ss = H.ok("retirement/social-security");
  return (ss?.people ?? []).filter((p) => p.birthYear && !p.unreduced).map((p) => {
    const a = H.adults.find((x) => x.id === p.id), age = H.ageOf(a);
    const fra = fullRetirementAge(p.birthYear).asYears;
    const onFile = num(H.plan.retirement?.socialSecurity?.[p.id]?.claimAge);
    if (p.claimed || (H.plan.guide?.setup?.ss?.[p.id] === "getting")) return res(p.claimAge <= age + 1 / 12 + 1e-6, { claimed: true, claimAge: p.claimAge, age: r2(age) }, "claimed");
    if (onFile !== null) return res(inRange(p.claimAge, 62, 70), { typedClaimAge: onFile, claimAge: p.claimAge }, "typed");
    // skeptic pass 2026-11-07: from 70 on, waiting adds nothing, so someone that age who has not claimed is not a household
    // the population holds (SSA: nearly everyone has claimed by 70); the page's 70 is the only age still open. Checked to 70.
    if (age >= 70) return null;
    const want = Math.min(70, Math.max(62, fra, Math.ceil(age * 12 - 1e-9) / 12));
    return res(Math.abs(p.claimAge - want) <= 1 / 24 && p.fromAge >= Math.floor(age), { age: r2(age), fullRetirementAge: r2(fra), claimAgeShown: r2(p.claimAge), claimAgeRule: r2(want), fromAge: p.fromAge }, "not claimed");
  }).filter(Boolean);
});
rule("pt.ss.spousal-floor", "A", (H) => {
  const ss = H.ok("retirement/social-security");
  const c = ss?.couple;
  if (!c || !H.adults.some((a) => a.relation === "spouse")) return [];
  return (ss.people ?? []).filter((p) => (c.spousal?.[p.id] ?? 0) > 0 && H.plan.guide?.setup?.ss?.[p.id] !== "none").map((p) => res((c.spousalCounted?.[p.id] ?? 0) >= c.spousal[p.id] - 0.1, { person: p.id, spousalWorkedOut: r2(c.spousal[p.id]), spousalCounted: r2(c.spousalCounted?.[p.id] ?? 0), ownSource: p.source }));
});
rule("pt.ss.not-zero-when-retired", "B", (H) => {
  const ss = H.ok("retirement/social-security");
  return H.adults.filter((a) => { const g = H.ageOf(a); return g !== null && (g >= 62 || (g >= 50 && H.status(a.id) === "retired")) && H.plan.guide?.setup?.ss?.[a.id] !== "none"; }).map((a) => {
    const p = ss?.people?.find((x) => x.id === a.id);
    const v = (p?.monthly ?? 0) + (ss?.couple?.spousalCounted?.[a.id] ?? 0);
    const pr = v > 0 ? null : H.ok("retirement/projection");
    return res(v > 0 || !pr?.ready || !pr.verdict, { person: a.role, age: r2(H.ageOf(a)), ssMonthly: r0(v), projectionVerdict: pr?.verdict ?? null });
  });
});
rule("pt.ss.guess-bounds-monotone", "A", (H) => {
  const ss = H.ok("retirement/social-security"), out = [];
  for (const a of H.people) {
    const path = `retirement.socialSecurity.${a.id}.monthlyAtFRA`;
    const e = H.est("overview/setup:ss", { path });
    if (a.role === "dependent") { if (e && e.value > 0) out.push(res(false, { dependent: a.id, guess: e.value }, "dependent")); continue; }
    if (!e || !(e.value > 0) || !a.birthDate) continue;
    const by = Number(a.birthDate.slice(0, 4));
    const max = S.estimateSocialSecurity({ birthYear: by, yearlyPay: 1e7, stopAge: a.retirementAge ?? Number(H.plan.assumptions?.retirementAge ?? 65), today: H.today });
    const onFile = Number(H.plan.retirement?.socialSecurity?.[a.id]?.monthlyAtFRA) || 0;
    const ours = H.guessed(path) || H.plan.guide?.setup?.ssWrote?.[a.id] === onFile;
    const pia = ss?.people?.find((x) => x.id === a.id)?.pia;
    out.push(res(e.value > 0 && (max === null || e.value <= max + 1) && (!ours || Math.abs(onFile - e.value) <= 1 || Math.abs((pia ?? onFile) - onFile) <= 1), { guess: r0(e.value), maxEarner: max, onFile, pia }));
  }
  return out;
});
rule("pt.medicare.at-65", "A", (H) => {
  const med = H.ok("retirement/medicare");
  return (med?.people ?? []).map((m) => {
    const a = H.adults.find((x) => x.id === m.id);
    if (!a?.birthDate) return null;
    const by = Number(a.birthDate.slice(0, 4)), bm = Number(a.birthDate.slice(5, 7)), bd = Number(a.birthDate.slice(8, 10));
    const want = bd === 1 && bm === 1 ? by + 64 : by + 65;
    // skeptic pass 2026-11-07: the page says the month Medicare starts (signup.month, retirement/medicare view: "around the
    // 65th birthday (Dec 2044)"), which already moves a birthday on the 1st to the month before; medicareYear is never shown
    const shown = m.signup?.month ? Number(String(m.signup.month).slice(0, 4)) : m.medicareYear;
    return res(shown === want, { birthDate: a.birthDate, yearShown: shown, medicareYear: m.medicareYear, rule: want });
  }).filter(Boolean);
});
rule("pt.pension.age-window", "A", (H) => {
  const pen = H.ok("retirement/pensions"), out = [];
  for (const it of [...(pen?.items ?? []), ...(pen?.fromIncome ?? [])]) {
    const holder = H.adults.find((a) => a.id === it.personId) ?? (H.adults.length === 1 ? H.adults[0] : null);
    const age = holder ? H.ageOf(holder) : null;
    const ageNow = num(it.ageNow);
    if (age === null) { out.push(res(ageNow === null, { holderBirthDate: null, ageShown: ageNow }, "no birth date")); continue; }
    const by = Number(holder.birthDate.slice(0, 4)), rmdAge = by >= 1960 ? 75 : 73;
    const start = num(it.startAge);
    out.push(res((ageNow === null || Math.abs(ageNow - Math.floor(age)) <= 1) && (start === null || inRange(start, 50, Math.max(rmdAge, holder.retirementAge ?? 65))), { age: r2(age), ageShown: ageNow, startAge: start }, "with birth date"));
  }
  const gp = H.ok("investments/glide-path");
  if (gp && !H.adults.some((a) => a.birthDate)) out.push(res(!(num(gp.ageNow) > 0), { page: "investments/glide-path", ageShown: gp.ageNow }, "glide path without a birth date"));
  return out;
});
rule("pt.leftover.identity", "A", (H) => {
  const b = H.ok("cashflow/budget-percent"), ex = H.ok("cashflow/expenses");
  if (!b?.ready || !ex) return [];
  const T = b.month.afterTax, Sx = ex.monthly, K = b.saving?.retirement ?? 0, Lx = b.saving?.leftover;
  if (Lx === null || Lx === undefined) return [];
  // S: Expenses' month (every debt payment once; a tax line typed there is already out of T); K: saved from pay outside both
  // (retirement, goals, the saved debt plan's extra); L: what is left (Budget's leftover, less what is short)
  const short = b.saving?.short ?? 0, S0 = Sx - (b.taxesListed ?? 0), other = (b.saving?.goals ?? 0) + (b.saving?.debtPlan ?? 0);
  const gap = T - S0 - K - other - (Lx - short);
  return [res(Math.abs(gap) <= 1, { afterTaxMonth: r0(T), spending: r0(S0), savedFromPay: r0(K), goalsAndDebtPlan: r0(other), leftOver: r0(Lx - short), gap: r0(gap) })];
});
rule("pt.bought.payment-vs-pay", "A", (H) => {
  const M = H.mortgage;
  if (!M?.g.pay || !(H.payYearly > 0)) return [];
  const other = H.debts.filter((x) => x !== M && x.d !== M.d && x.owed > 0).reduce((s, x) => s + x.pay, 0);
  const dti = (M.pay + other) / (H.payYearly / 12);
  const fed = H.ok("taxes/federal");
  const out = [res(dti <= 0.5, { mortgagePayment: r0(M.pay), otherPayments: r0(other), grossPayMonthly: r0(H.payYearly / 12), dti: r3(dti) }, "payments vs pay")];
  if (fed?.result?.deduction) out.push(res(fed.result.deduction.used !== "itemized" || fed.result.deduction.itemized > fed.result.deduction.standard, { used: fed.result.deduction.used, itemized: r0(fed.result.deduction.itemized), standard: r0(fed.result.deduction.standard) }, "itemizing"));
  return out;
});

// ---- saving and retirement (rules-saving-retire) ----------------------------------------------------------------------
const retAccts = (H) => L(H.plan, "accounts").filter((a) => ["401k", "ira", "roth", "403b"].includes(a.type));
const yearsAt = (B, yearly, r = 0.05) => (yearly > 0 ? Math.log(1 + (B * r) / yearly) / Math.log(1 + r) : Infinity);
rule("sr.retire.adult-years", "A", (H) => {
  const out = [];
  for (const a of retAccts(H)) {
    if (!H.guessed(`accounts[${a.id}].balance`) || !(Number(a.balance) > 0)) continue;
    const p = H.people.find((x) => x.id === a.ownerId);
    if (!p) continue;
    if (p.role === "dependent") { out.push(res(false, { dependent: true, balance: a.balance })); continue; }
    const age = H.ageOf(p);
    if (age === null) continue;
    const pay = H.status(p.id) === "retired" ? 0 : L(H.plan, "income").filter((x) => x.personId === p.id && ["salary", "bonus"].includes(x.type) && !x.endDate).reduce((s, x) => s + perYear(x.amount, x.period), 0);
    const y = (pay > 0 ? Math.min(pay, L402(age)) + 0.04 * Math.min(pay, 360000) : L402(age)) + IRA(age);
    const n = yearsAt(Number(a.balance), y), adult = Math.max(0, Math.floor(age) - 17);
    const c = L(H.plan.retirement, "contributions").find((x) => x.accountId === a.id);
    const own = c ? perYear(c.amount, c.period) + (Number(c.employerMatch) || 0) : 0;
    const nOwn = own > 0 ? yearsAt(Number(a.balance), own) : null;
    out.push(res(age >= 18 && n <= adult + 1e-9 && (nOwn === null || nOwn <= adult), { type: a.type, balance: r0(a.balance), age: Math.floor(age), pay: r0(pay), mostAYear: r0(y), yearsNeeded: r2(n), yearsAtOwnRate: r2(nOwn), adultYears: adult }, a.type));
  }
  return out;
});
rule("sr.retire.like-you", "A", (H) => {
  const accts = retAccts(H);
  if (!accts.some((a) => H.guessed(`accounts[${a.id}].balance`)) || !(H.income > 0) || H.oldest === null) return [];
  const T0 = accts.reduce((s, a) => s + (Number(a.balance) || 0), 0), A = H.oldest, I = H.income;
  // skeptic pass 2026-11-07: (a) only while someone works: a retired household's income is its pension or Social Security,
  // not what it draws, so savings over that income say nothing (a retired couple of 62 with $220,000 and a $1,200 pension)
  const working = H.adults.some((a) => H.status(a.id) === "work");
  const out = working ? [res(T0 / I <= P95R[rband(A)], { total: r0(T0), income: r0(I), ratio: r2(T0 / I), p95: P95R[rband(A)] }, "a: ratio")] : [];
  if (A >= 25) {
    const key = band(A) === "<35" && I >= CUTS[3] ? "<35|80-100" : `${band(A)}|${ig5(I)}`;
    const q = RETIRE_CELLS[key];
    if (q) { out.push(res(inRange(T0, q[0], q[4]), { total: r0(T0), cell: key, p5: q[0], p95: q[4] }, "b: p5..p95")); // (c) skeptic pass 2026-11-07: the income groups are wide (a $61,000 earner sits in the bottom 40% with $20,000 earners;
      // a 401(k) through work is one plan, the survey's figure every account), so the middle half reaches the next group's edges
      const order = ["0-40", "40-60", "60-80", "80-90", "80-100", "90-100"], b0 = key.split("|")[0];
      const cells = order.map((g) => `${b0}|${g}`).filter((k) => RETIRE_CELLS[k]), gi = cells.indexOf(key);
      const near = (d) => (gi + d >= 0 && gi + d < cells.length ? RETIRE_CELLS[cells[gi + d]] : null);
      const lo = Math.min(q[1], near(-1)?.[1] ?? q[1]), hi = Math.max(q[3], near(1)?.[3] ?? q[3]);
      out.push(res(inRange(T0, lo, hi), { total: r0(T0), cell: key, p25: q[1], median: q[2], p75: q[3], timesMedian: r2(T0 / q[2]) }, "c: typical (p25..p75)")); }
  }
  return out;
});
rule("sr.balance.like-you", "A", (H) => {
  const out = [];
  if (!(H.income > 0) || H.oldest === null) return out;
  const inv = L(H.plan, "accounts").filter((a) => ["brokerage", "crypto"].includes(a.type) && H.guessed(`accounts[${a.id}].balance`));
  if (inv.length) {
    const V = inv.reduce((s, a) => s + (Number(a.balance) || 0), 0), key = `${band(H.oldest)}|${ig3(H.income)}`, q = INV[key];
    if (q) { out.push(res(inRange(V, q[0], q[4]), { investments: r0(V), cell: key, p5: q[0], p95: q[4] }, "investments p5..p95")); out.push(res(inRange(V, q[1], q[3]), { investments: r0(V), cell: key, p25: q[1], median: q[2], p75: q[3], timesMedian: r2(V / q[2]) }, "investments typical")); }
  }
  const cash = L(H.plan, "accounts").filter((a) => ["checking", "savings"].includes(a.type));
  if (cash.some((a) => H.guessed(`accounts[${a.id}].balance`))) {
    const m = cash.reduce((s, a) => s + (Number(a.balance) || 0), 0) / (H.income / 12), key = `${band(H.oldest)}|${ig4(H.income)}`, q = CASHM[key];
    if (q) { out.push(res(inRange(m, q[0], q[4]), { cashMonthsOfIncome: r2(m), cell: key, p5: q[0], p95: q[4] }, "cash p5..p95")); out.push(res(inRange(m, q[1], q[3]), { cashMonthsOfIncome: r2(m), cell: key, p25: q[1], p75: q[3] }, "cash typical")); }
  }
  return out;
});
rule("sr.contrib.law", "A", (H) => L(H.plan.retirement, "contributions").map((c) => {
  const p = H.adults.find((x) => x.id === c.personId);
  if (!p?.birthDate) return null;
  const age = TY - Number(p.birthDate.slice(0, 4));
  const y = perYear(c.amount, c.period), m = Number(c.employerMatch) || 0;
  const pay = L(H.plan, "income").filter((x) => x.personId === p.id && ["salary", "bonus", "business"].includes(x.type) && !x.endDate).reduce((s, x) => s + perYear(x.amount, x.period), 0);
  const gm = H.guessed(`retirement.contributions[${c.id}].employerMatch`), ga = H.guessed(`retirement.contributions[${c.id}].amount`);
  const none = ga && (pay <= 0 || H.status(p.id) === "retired" || H.plan.retirement?.workPlans?.[p.id]?.plan === false);
  return res(y >= 0 && y <= Math.min(Math.max(pay, 0), L402(age)) + 0.5 && y + m <= 72000 && (!none || (y === 0 && m === 0)) && (!gm || (m <= y + 1 && m <= 0.06 * Math.min(pay, 360000) + 1 && (y > 0 || m === 0))), { age, pay: r0(pay), putInYear: r0(y), match: r0(m), limit: L402(age), guessed: ga || gm });
}).filter(Boolean));
rule("sr.contrib.like-you", "A", (H) => L(H.plan.retirement, "contributions").filter((c) => H.guessed(`retirement.contributions[${c.id}].amount`)).map((c) => {
  const pay = L(H.plan, "income").filter((x) => x.personId === c.personId && ["salary", "bonus"].includes(x.type) && !x.endDate).reduce((s, x) => s + perYear(x.amount, x.period), 0);
  if (!(pay > 0)) return null;
  const s = perYear(c.amount, c.period) / pay;
  return res(s === 0 || inRange(s, 0.01, 0.15), { share: r3(s), pay: r0(pay) });
}).filter(Boolean));
rule("sr.saving.from-take-home", "B", (H) => {
  const fire = H.ok("retirement/fire"), lo = H.leftOver;
  if (!fire?.ready || !(num(fire.savingYearly) !== null) || !lo) return [];
  const K = L(H.plan.retirement, "contributions").reduce((s, c) => s + perYear(c.amount, c.period) + (Number(c.employerMatch) || 0), 0);
  const cap = K + Math.max(0, (lo.monthly ?? 0) * 12) + 12;
  return [res(fire.savingYearly <= cap, { fireSavingYear: r0(fire.savingYearly), fireRate: r3(fire.savingsRate), fromPayAndMatch: r0(K), leftOverYear: r0((lo.monthly ?? 0) * 12), most: r0(cap) })];
});
rule("sr.retire-age.one-age", "B", (H) => {
  const out = [];
  const gp = H.ok("investments/glide-path"), pen = H.ok("retirement/pensions");
  if (!H.adults.some((a) => a.birthDate)) {
    if (gp) out.push(res(!(num(gp.ageNow) > 0), { page: "investments/glide-path", ageShown: gp.ageNow }, "no birth date: glide path"));
    for (const it of [...(pen?.items ?? []), ...(pen?.fromIncome ?? [])]) out.push(res(!(num(it.ageNow) > 0), { page: "retirement/pensions", ageShown: it.ageNow }, "no birth date: pensions"));
    return out;
  }
  const pr = H.ok("retirement/projection"), fire = H.ok("retirement/fire"), tl = H.ok("overview/timeline");
  for (const a of H.adults.filter((x) => x.birthDate)) {
    const R = a.retirementAge ?? Number(H.plan.assumptions?.retirementAge ?? 65), end = a.lifeExpectancy ?? Number(H.plan.assumptions?.planEndAge ?? 95);
    const by = Number(a.birthDate.slice(0, 4));
    const vals = { person: a.role, retireAge: R, retireYear: by + R };
    // skeptic pass 2026-11-07: a retirement age past the plan's end is checked only when both are the plan's defaults (a typed
    // contradiction such as qa's plan-to-age-below-retirement is the person's, said on Assumptions, not a guess)
    let ok = (a.retirementAge !== undefined && a.retirementAge !== null) || a.lifeExpectancy || H.plan.assumptions?.planEndAge !== undefined || R < end;
    const pp = pr?.inputs?.people?.find((x) => x.id === a.id);
    if (pp) { vals.projection = pp.retireAge; ok = ok && pp.retireAge === R; }
    if (fire?.ready && a.role === "self" && num(fire.retireAge) !== null) { vals.fire = fire.retireAge; ok = ok && fire.retireAge === R; }
    if (gp?.person && a.role === "self" && num(gp.retireAge) !== null) { vals.glidePath = gp.retireAge; ok = ok && gp.retireAge === R; }
    const ev = tl?.events?.find((e) => e.kind === "retire" && e.personId === a.id);
    if (ev?.date) { vals.timelineYear = Number(ev.date.slice(0, 4)); ok = ok && Math.abs(vals.timelineYear - (by + R)) <= 1; }
    if (H.status(a.id) === "retired") { const guessedPut = L(H.plan.retirement, "contributions").some((c) => c.personId === a.id && H.guessed(`retirement.contributions[${c.id}].amount`) && Number(c.amount) > 0); vals.contributionGuessed = guessedPut; ok = ok && !guessedPut; }
    out.push(res(ok, vals, "across pages"));
  }
  return out;
});
rule("sr.plan-end.survival", "A", (H) => {
  const ad = H.adults.filter((a) => a.birthDate && !a.lifeExpectancy);
  if (!ad.length || ad.length !== H.adults.length) return [];
  const end = Number(H.plan.assumptions?.planEndAge ?? 95);
  const ages = ad.map((a) => H.ageOf(a));
  const p = ad.length === 1 ? survive("total", ages[0], Math.floor(ages[0]) + (end + 1 - Math.floor(ages[0]))) : 1 - (1 - survive("male", ages[0], end + 1)) * (1 - survive("female", ages[1], end + 1));
  return [res(p <= 0.25 && ages.every((x) => x < end), { planEndAge: end, ages: ages.map((x) => Math.floor(x)), chanceAliveAfterPlanEnd: r3(p) })];
});
rule("sr.rmd.law", "B", (H) => {
  const rm = H.ok("retirement/rmd"), pr = H.ok("retirement/projection"), out = [];
  const law = (b) => { const y = Number(b.slice(0, 4)), md = b.slice(5); return b < "1949-07-01" ? 70.5 : y <= 1950 ? 72 : y <= 1959 ? 73 : 75; };
  for (const q of rm?.people ?? []) { const a = H.adults.find((x) => x.id === q.id); if (!a?.birthDate) continue; out.push(res(q.startAge === law(a.birthDate), { person: a.role, startAgeShown: q.startAge, law: law(a.birthDate) }, "retirement/rmd")); }
  for (const [i, o] of (pr?.inputs?.rmd?.owners ?? []).entries()) { const a = H.adults[o.personIndex ?? i]; if (!a?.birthDate) continue; out.push(res(o.startAge === law(a.birthDate), { person: a.role, startAgeInProjection: o.startAge, law: law(a.birthDate) }, "retirement/projection")); }
  return out;
});
const RANK = { "on track": 0, tight: 1, short: 2 };
rule("sr.verdict.one-answer", "B", (H) => {
  const pr = H.ok("retirement/projection");
  if (!pr?.ready || !pr.verdict) return [];
  const sv = (() => { try { return PAGES.get("retirement/projection").savingVerdict(H.plan, { today: H.today }); } catch { return null; } })();
  const age = H.ageOf(H.adults[0]);
  const ok = RANK[pr.verdict] !== undefined && (pr.verdict === "short") === (pr.shortAge !== null && pr.shortAge !== undefined) && (pr.shortAge == null || (age === null || pr.shortAge >= Math.floor(age))) && (!sv || (sv.verdict === pr.verdict && (sv.shortAge ?? null) === (pr.shortAge ?? null)));
  const tl = H.ok("overview/timeline");
  const waits = !tl?.headline || tl.headline.needsSS || tl.headline.needs;
  const tlOk = waits || (tl.headline.shortYear ?? null) === (pr.shortYear ?? null);
  return [res(ok, { verdict: pr.verdict, shortAge: pr.shortAge, savingVerdict: sv ? `${sv.verdict} ${sv.shortAge ?? ""}` : null }, "projection vs savingVerdict"), res(tlOk, { projectionShortYear: pr.shortYear ?? null, timelineShortYear: tl?.headline?.shortYear ?? null }, "timeline")];
});
rule("sr.verdict.monotone", "C", (H) => {
  const P = PAGES.get("retirement/projection");
  const pr = H.ok("retirement/projection");
  if (!pr?.ready || !pr.verdict) return [];
  const worse = (a, b) => RANK[b.verdict] > RANK[a.verdict] || (a.shortAge && b.shortAge && b.shortAge < a.shortAge) || (!a.shortAge && b.shortAge);
  const tries = [];
  const acc = L(H.plan, "accounts").find((a) => ["401k", "ira", "roth", "brokerage"].includes(a.type));
  if (acc) tries.push(["+$10,000 saved", (q) => { q.accounts.find((a) => a.id === acc.id).balance = Number(acc.balance) + 10000; }]);
  const ex = L(H.plan, "expenses").find((x) => perYear(x.amount, x.period) / 12 > 150);
  if (ex) tries.push(["-$100 a month on a bill", (q) => { const x = q.expenses.find((y) => y.id === ex.id); x.amount = Number(x.amount) - (x.period === "annual" ? 1200 : 100); }]);
  if (Number(H.plan.retirement?.spendingMonthly) > 150) tries.push(["-$100 a month in retirement", (q) => { q.retirement.spendingMonthly = Number(q.retirement.spendingMonthly) - 100; }]);
  const c = L(H.plan.retirement, "contributions")[0];
  if (c) tries.push(["+$100 a month put in", (q) => { const x = q.retirement.contributions.find((y) => y.id === c.id); x.amount = Number(x.amount) + (x.period === "annual" ? 1200 : 100); }]);
  const w = H.adults.find((a) => a.birthDate && H.status(a.id) !== "retired" && (a.retirementAge ?? 65) < 70);
  if (w) tries.push(["retire a year later", (q) => { const x = q.household.people.find((y) => y.id === w.id); x.retirementAge = (x.retirementAge ?? Number(q.assumptions?.retirementAge ?? 65)) + 1; }]);
  return tries.map(([what, f]) => { const q = structuredClone(H.plan); f(q); E.settle(q, GO(H.today)); let b = null; try { b = P.compute(q, { today: H.today }); } catch { b = null; } return res(b && !worse(pr, b), { change: what, before: `${pr.verdict} ${pr.shortAge ?? ""}`, after: b ? `${b.verdict} ${b.shortAge ?? ""}` : "error" }, what); });
});
rule("sr.verdict.loans-end", "B", (H) => {
  const pr = H.ok("retirement/projection");
  if (!pr?.ready || !H.guessed("retirement.spendingMonthly")) return [];
  const loans = S.loansRunningThen(H.plan, H.today);
  if (!loans.length) return [];
  const out = [];
  for (const d of loans) {
    const acct = L(H.plan, "accounts").find((a) => a.id === d.accountId), owed = Math.abs(Number(acct?.balance) || 0);
    // the payoff Debts shows (the payment less the tax and insurance inside a mortgage's: HD-PAYOFF-ONE-DATE), else nper on the payment
    const shown = H.debts.find((x) => x.acct.id === d.accountId)?.row?.months;
    const n = typeof shown === "number" ? shown : nper((Number(d.rate) || 0) / 12, Number(d.minPayment) || 0, owed);
    if (!Number.isFinite(n)) continue;
    const payoffYear = Number(addMonths(H.today, Math.ceil(n)).slice(0, 4));
    const rows = pr.rows ?? [];
    const before = rows.find((r) => r.year === payoffYear - 1), after = rows.find((r) => r.year === payoffYear + 1);
    if (!before || !after || !before.retired || !(before.spendingReal > 0)) continue;
    const drop = before.spendingReal - after.spendingReal, want = (Number(d.minPayment) * 12) / (after.priceLevel || 1);
    out.push(res(drop >= 0.5 * want, { debt: acct?.type, payment: r0(d.minPayment), payoffYear, spendingRealBefore: r0(before.spendingReal), spendingRealAfter: r0(after.spendingReal), expectedDropAtLeast: r0(0.5 * want) }));
  }
  return out;
});
rule("sr.emergency.one-cushion", "A", (H) => {
  const ef = H.ok("goals/emergency-fund"), lq = H.ok("balance/liquidity");
  if (!ef || !lq || !(ef.essentialMonthly > 0)) return [];
  let c = null; try { c = S.cushion(H.plan, null, H.today); } catch { c = null; }
  const typed = H.plan.assumptions?.emergencyMonths !== undefined && H.plan.assumptions?.emergencyMonths !== null && H.plan.assumptions?.emergencyMonthsTyped;
  return [res(Math.abs(ef.target - lq.target) <= 1 && (!c || Math.abs(ef.target - c.exact) <= 1) && ef.runwayMonths >= 0 && (typed || inRange(ef.months, 3, 12)), { emergencyFund: r0(ef.target), liquidity: r0(lq.target), getStarted: r0(c?.exact), months: ef.months, runway: r2(ef.runwayMonths) })];
});
rule("sr.emergency.months-default", "A", (H) => {
  // only households Get started built: a plan written by hand (a qa plan, a fixture) carries the schema's starting 6 and says nothing about Get started
  if (H.spec?.src === "qa" || H.spec?.src === "fixture") return [];
  const ef = H.ok("goals/emergency-fund");
  if (!ef?.suggested || !(ef.essentialMonthly > 0)) return [];
  return [res(ef.months === ef.suggested.months, { targetMonths: ef.months, pageAdvice: ef.suggested.months, adults: ef.adults })];
});
rule("sr.networth.one-figure", "A", (H) => {
  const nw = H.ok("balance/net-worth");
  if (!nw) return [];
  const iL = (t) => { try { return PAGES.get("balance/net-worth").isLiability(t); } catch { return false; } };
  const sum = L(H.plan, "accounts").reduce((s, a) => s + (iL(a.type) ? -Math.abs(Number(a.balance) || 0) : Number(a.balance) || 0), 0);
  const out = [res(Math.abs(nw.netWorth - (nw.assets - nw.liabilities)) <= 1 && Math.abs(nw.netWorth - sum) <= 1, { netWorth: r0(nw.netWorth), assets: r0(nw.assets), liabilities: r0(nw.liabilities), sumOfAccounts: r0(sum) }, "identity")];
  const M = H.mortgage, h = H.home;
  if (M && h?.value && (M.g.owed || h.guessed)) out.push(res(M.owed <= h.value, { mortgage: r0(M.owed), home: r0(h.value) }, "mortgage under the home"));
  return out;
});
rule("sr.leftover.saving", "A", (H) => {
  const lo = H.leftOver, th = H.takeHomeMonthly;
  if (!lo || lo.monthly === null || H.spendTyped || !(H.income > 0) || !th) return [];
  const g = fifthOf(H.income) <= 2 ? "bottom 40%" : fifthOf(H.income) >= 4 ? "top 40%" : "middle";
  return [res(lo.monthly >= 0 && (g !== "bottom 40%" || lo.monthly <= 0.25 * th) && (g !== "top 40%" || lo.monthly > 0), { leftOverMonthly: r0(lo.monthly), takeHomeMonthly: r0(th), incomeGroup: g, income: r0(H.income) })];
});

// ---- spending and family (rules-spend-family) -------------------------------------------------------------------------
rule("SF-FAM-CHILD-OLDER", "A", (H) => {
  const out = [];
  // a birth date typed in a qa plan to test the pages (a 126-year-old) is the person's input, not a guess: only households we built are held to 15..115
  for (const a of H.adults) { if (!a.birthDate || H.spec?.src === "qa") continue; const g = H.ageOf(a); out.push(res(inRange(g, 15, 115) && a.birthDate <= H.today, { adult: a.role, birthDate: a.birthDate, age: r2(g) }, "adult age")); }
  for (const k of H.deps) {
    if (!k.birthDate) continue;
    // skeptic pass 2026-11-07: a dependent of 18 or more can be a parent cared for at home (qa centenarian-dependent); only a
    // dependent under 18 must be born after every adult
    if (ageOn(k.birthDate, H.today) >= 18) { out.push(res(k.birthDate <= H.today, { child: k.id, birthDate: k.birthDate }, "child after parents")); continue; }
    out.push(res(k.birthDate <= H.today && H.adults.filter((a) => a.birthDate).every((a) => k.birthDate > a.birthDate), { child: k.id, birthDate: k.birthDate, adults: H.adults.map((a) => a.birthDate).join(", ") }, "child after parents"));
  }
  return out;
});
rule("SF-FAM-PARENT-AGE", "A", (H) => H.deps.filter((k) => k.birthDate && ageOn(k.birthDate, H.today) < 18 && H.adults.some((a) => a.birthDate)).map((k) => {
  const at = H.adults.filter((a) => a.birthDate).map((a) => Number(k.birthDate.slice(0, 4)) - Number(a.birthDate.slice(0, 4)));
  // skeptic pass 2026-11-07: children's birth years are always typed (never guessed), and an adult of 50+ at the birth is
  // often a grandparent raising the child (Census: about 2.4 million grandparents responsible for grandchildren); only a gap
  // no family can have (an adult under 12 at the birth) is flagged
  return res(at.some((x) => x >= 12), { child: k.id, adultsAgeAtBirth: at.join(", ") });
}));
rule("SF-FAM-UNDATED-CHILD", "A", (H) => {
  const und = H.deps.filter((k) => !k.birthDate);
  if (!und.length || H.youngest === null || H.youngest < 63) return [];
  const hh = householdOf(H.plan, H.today);
  // skeptic pass 2026-11-07: the "with children, Total" cell holds children of any age, an adult child at home included
  return [res(!/Child(?!renTotal)|oneParent/.test(hh ?? "") && !H.spendRows.childcare, { undatedDependents: und.length, youngestAdult: Math.floor(H.youngest), spendingCell: hh, childcareRow: r0(H.spendRows.childcare?.monthly ?? 0) })];
});
rule("SF-FAM-CHILD-AGES-ONE-SOURCE", "B", (H) => {
  const out = [];
  const edu = H.ok("goals/education");
  for (const c of edu?.children ?? []) {
    const k = H.deps.find((x) => x.id === c.id);
    if (!k?.birthDate) continue;
    const startAge = Number(H.plan.whatIfs?.college?.[k.id]?.startAge ?? 18);
    out.push(res(c.startYear === Number(k.birthDate.slice(0, 4)) + startAge, { child: k.id, birthDate: k.birthDate, educationStartYear: c.startYear, rule: Number(k.birthDate.slice(0, 4)) + startAge }, "education"));
  }
  const life = H.ok("insurance/life-needs");
  const dated = H.kidsUnder18.filter((k) => k.birthDate);
  if (life?.ready && dated.length && dated.length === H.kidsUnder18.length) {
    const youngest = Math.min(...dated.map((k) => yearsAge(k.birthDate, H.today)));
    for (const p of life.people ?? []) if (p.dime && num(p.dime.incomeYears) !== null && p.method !== "child") out.push(res(Math.abs(p.dime.incomeYears - Math.max(0, 18 - youngest)) <= 1 / 12 + 0.01, { person: p.id, lifeCoverYears: r2(p.dime.incomeYears), rule: r2(Math.max(0, 18 - youngest)) }, "life cover"));
  }
  return out;
});
rule("SF-GOAL-DATES", "A", (H) => {
  const out = [], gs = H.ok("goals/goals");
  for (const g of L(H.plan, "goals")) {
    if (!String(g.id).startsWith("setup-goal-") || !g.targetDate) continue;
    out.push(res(g.targetDate > H.today, { goal: g.id, date: g.targetDate }, "a: default dates after today"));
  }
  for (const g of gs?.goals ?? []) if (g.targetDate && g.targetDate < H.today && g.remaining > 0) out.push(res(g.neededMonthly === null || g.neededMonthly === undefined, { goal: g.id, date: g.targetDate, neededMonthly: g.neededMonthly }, "c: past due asks for a date"));
  const edu = H.ok("goals/education");
  for (const c of edu?.children ?? []) { const k = H.deps.find((x) => x.id === c.id); if (k?.birthDate) out.push(res(c.startYear >= Number(k.birthDate.slice(0, 4)) + 14, { child: k.id, birthDate: k.birthDate, startYear: c.startYear }, "b/d: college after 14")); }
  return out;
});
rule("SF-GOAL-EDU", "A", (H) => {
  const g = L(H.plan, "goals").find((x) => x.id === "setup-goal-education");
  const kids = H.kidsUnder18.filter((k) => k.birthDate);
  if (!g || !kids.length) return [];
  const edu = H.ok("goals/education");
  const waiting = (edu?.children ?? []).filter((c) => kids.some((k) => k.id === c.id) && !c.started).sort((a, b) => a.startYear - b.startYear);
  if (!waiting.length) return [];
  const first = waiting[0];
  const out = [res(g.targetDate && Math.abs(Number(g.targetDate.slice(0, 4)) - first.startYear) <= 1 && g.targetDate > H.today, { goalDate: g.targetDate, firstCollegeYear: first.startYear, childAge: first.age }, "goal year")];
  for (const c of edu.children) out.push(res(inRange(c.yearlyNow, 15000, 60920) && inRange(c.years, 1, 6), { yearlyNow: r0(c.yearlyNow), years: c.years }, "cost and years"));
  return out;
});
const spendTotal = (H) => Object.entries(H.spendRows).reduce((s, [, r]) => s + r.monthly, 0);
rule("SF-SPEND-TOTAL-BAND", "A", (H) => {
  if (H.spendTyped || !Object.keys(H.spendRows).length || !(H.income > 0) || H.adults.length > 2) return [];
  const renter = !H.owner;
  const Sx = spendTotal(H) - (renter ? H.spendRows.housing?.monthly ?? 0 : 0) - (H.spendRows.childcare?.monthly ?? 0);
  const q = SCF_TOT[`${H.fam}|${fifthOf(H.income)}`];
  return [res(inRange(Sx, q[0], q[4]), { spendingMonthly: r0(Sx), cell: `${H.fam} income fifth ${fifthOf(H.income)}`, p5: q[0], p95: q[4] })];
});
rule("SF-SPEND-FOOD", "A", (H) => {
  const g = H.spendRows.groceries;
  if (!g?.guessed) return [];
  const size = Math.min(5, H.people.length), food = g.monthly / 1.13, q = SCF_FOOD[size];
  return [res(inRange(food, q[0], q[1]), { groceriesRow: r0(g.monthly), foodAtHome: r0(food), size, p5: q[0], p95: q[1] })];
});
rule("SF-SPEND-RENT", "A", (H) => {
  const h = H.spendRows.housing;
  if (!h?.guessed || H.owner || !(H.income > 0)) return [];
  const r = (12 * h.monthly) / H.income, q = SCF_RENT[fifthOf(H.income)];
  return [res(inRange(r, q[0], q[2]), { rent: r0(h.monthly), income: r0(H.income), rentOverIncome: r3(r), p5: q[0], p95: q[2] })];
});
rule("SF-SPEND-CHILDCARE-AGE", "A", (H) => {
  const tap = H.plan.guide?.setup?.taps?.childcare;
  if (!H.deps.length) return [];
  const c = H.spendRows.childcare?.monthly ?? 0;
  if (tap !== "yes") return [res(!(c > 0) || !H.spendRows.childcare?.guessed, { childcareTap: tap ?? "unanswered", childcareGuess: r0(c) }, "only on yes")];
  const ages = H.deps.map((k) => (k.birthDate ? ageOn(k.birthDate, H.today) : null));
  const under13 = ages.filter((a) => a === null || a < 13).length;
  const st = H.plan.household?.state, tab = G.TABLES["ccaoa2025_childcare_annual_price_by_state"];
  const col = tab ? tab.cols.indexOf(st) : -1, infant = col >= 0 ? tab.rows["center:infant"]?.[col] : null;
  return [res((under13 > 0 || c === 0) && (!infant || c <= (under13 * infant) / 12 + 50), { kidsAges: ages.join(", "), childcareMonthly: r0(c), under13, stateInfantYear: infant })];
});
rule("SF-HEALTH-AGE", "A", (H) => {
  const ins = H.spendRows.insurance;
  if (!ins?.guessed || H.oldest === null) return [];
  const tap = H.plan.guide?.setup?.taps?.["health-cover"];
  const out = [];
  if (H.oldest < 35 && tap !== "work") out.push(res(ins.monthly <= 773, { insuranceRow: r0(ins.monthly), oldest: Math.floor(H.oldest), cap: 773 }, "b: under 35"));
  const n65 = H.adults.filter((a) => H.ageOf(a) >= 65).length;
  const qi = H.couple ? 2455 : 1816;
  if (n65 && tap !== "work" && H.income / 12 > qi) out.push(res(ins.monthly >= 241.89 * n65, { insuranceRow: r0(ins.monthly), adults65: n65, floor: r2(241.89 * n65) }, "c: Medicare floor"));
  return out;
});
rule("SF-LEFTOVER-DEFAULT", "A", (H) => {
  const lo = H.leftOver, th = H.takeHomeMonthly;
  if (!lo || lo.monthly === null || H.spendTyped || !th) return [];
  return [res(lo.monthly >= -Math.max(50, 0.02 * th), { leftOverMonthly: r0(lo.monthly), takeHomeMonthly: r0(th), floor: r0(-Math.max(50, 0.02 * th)) })];
});
rule("SF-LEFTOVER-TYPED", "A", (H) => {
  // the left-over input landed in a051c6f: question 6 (or Expenses) keeps what was said in guide.setup.spendLeft, good while the
  // spending rows still add up to what was written (core/math/leftover.js leftMarker). The plan must read back exactly that
  // left-over: setup leftReading, the one figure the reveal, Expenses, Your plan and the Dashboard show (Next best action's
  // left-over before goal saving; the Budget page's is after goal saving, so it is not this one). No row worked out from it is
  // below $0. (The older names stay for a plan written before it.)
  const L0 = num(leftMarker(H.plan)?.left ?? H.plan.cashflow?.leftoverMonthly ?? H.plan.guide?.setup?.leftover ?? null);
  if (L0 === null) return [];
  const back = S.leftReading(H.plan, H.today);
  const low = Object.entries(H.spendRows).filter(([, r]) => r.monthly < 0).map(([k]) => k);
  return [res(back !== null && Math.abs(back - L0) <= 1 && !low.length, { typedLeftOver: L0, readsBack: back, rowsBelowZero: low.join(", ") || null })];
});
rule("SF-SAVING-ONE-FIGURE", "B", (H) => {
  const fire = H.ok("retirement/fire"), lo = H.leftOver;
  if (!fire?.ready || !lo || lo.monthly === null || num(fire.savingYearly) === null) return [];
  const K = L(H.plan.retirement, "contributions").reduce((s, c) => s + perYear(c.amount, c.period) + (Number(c.employerMatch) || 0), 0);
  const want = 12 * lo.monthly + K;
  return [res(Math.abs(fire.savingYearly - want) <= 12, { fireSavingYear: r0(fire.savingYearly), leftOverYearPlusPayroll: r0(want) })];
});
rule("SF-SPEND-ONE-FIGURE", "A", (H) => {
  const out = [];
  const pv = H.spec.preview;
  if (pv) for (const [k, v] of Object.entries(pv)) { const r = H.spendRows[k]; if (v > 0 && r?.guessed) out.push(res(Math.abs(r.monthly - v) <= 1, { row: k, shownGrey: r0(v), saved: r0(r.monthly) }, "grey = written")); }
  const ex = H.ok("cashflow/expenses"), b = H.ok("cashflow/budget-percent");
  if (ex && b?.ready) {
    // Budget's needs and wants, plus what it files as saving from the Debts page's payments (extra on a debt), plus taxes it lists apart
    const bs = (b.needs ?? []).concat(b.wants ?? []).reduce((s, x) => s + (Number(x.monthly) || 0), 0) + (b.saving?.debts ?? 0) - (b.saving?.debtPlan ?? 0) + (b.taxesListed ?? 0);
    out.push(res(Math.abs(bs - ex.monthly) <= 10, { expensesMonthly: r0(ex.monthly), budgetMonth: r0(bs) }, "expenses vs budget"));
  }
  return out;
});
rule("SF-RETIRE-SPEND", "A", (H) => {
  if (!H.guessed("retirement.spendingMonthly")) return [];
  const R = Number(H.plan.retirement.spendingMonthly) || 0;
  const today = spendTotal(H) + (H.ok("cashflow/expenses")?.debtFromDebts ?? 0) - (H.spendRows.childcare?.monthly ?? 0);
  return [res(R <= today + 10, { retireSpend: r0(R), todaySpendingWithoutChildcare: r0(today) }, "not above today")];
});

// ---------------------------------------------------------------------------------------------------------------------
// Sweeps: one household moved along one answer (age, pay, a child), for the monotone and no-cliff rules.
const sweepSpec = (o) => ({ src: "sweep", state: "OH", tenure: "rent", typed: {}, debts: [], kind: "work", taps: {}, kids: [], ...o });
function series(name, specs) { return { name, specs }; }
export const SWEEPS = [];
const sweep = (ids, run) => SWEEPS.push({ ids, run });
const plansOf = (specs) => specs.map((s) => { const w = walk(s); return new Household(w.plan, { ...s, preview: w.preview }); });
/** Pairs (x, y) of consecutive steps; check returns res. */
function along(rows, fn) { const out = []; for (let i = 1; i < rows.length; i++) { const r = fn(rows[i - 1], rows[i]); if (r) out.push(r); } return out; }
sweep(["HD-MONO-AGE"], () => {
  const hs = plansOf(Array.from({ length: 64 }, (_, i) => sweepSpec({ who: "spouse", ages: [22 + i, 22 + i], pays: [90000, 90000], tenure: "mortgage" })));
  const rows = hs.map((H) => ({ age: Math.floor(H.oldest), L: (H.mortgage?.left ?? NaN) / 12, Y: H.mortgage?.left !== null ? (H.mortgage.term - H.mortgage.left) / 12 : NaN, V: H.mortgage && H.home?.value ? H.mortgage.owed / H.home.value : NaN }));
  const out = along(rows, (a, b) => res(b.L <= a.L + 0.5 && b.Y >= a.Y - 0.5 && b.V <= a.V + 0.01, { from: a.age, to: b.age, yearsLeft: `${r2(a.L)} -> ${r2(b.L)}`, yearsInHome: `${r2(a.Y)} -> ${r2(b.Y)}`, owedOverValue: `${r3(a.V)} -> ${r3(b.V)}` }, "step"));
  const at = (x) => rows.find((r) => r.age === x);
  out.push(res(at(30).L - at(78).L >= 5, { yearsLeftAt30: r2(at(30).L), yearsLeftAt78: r2(at(78).L) }, "30 vs 78 years left"));
  out.push(res(at(78).Y - at(30).Y >= 10, { yearsInHomeAt30: r2(at(30).Y), yearsInHomeAt78: r2(at(78).Y) }, "30 vs 78 years in home"));
  return { "HD-MONO-AGE": out.map((r) => ({ ...r, facts: { series: "Ohio couple, $90,000 each, own with a mortgage, nothing typed; both the same age" } })) };
});
sweep(["HD-MONO-PAY"], () => {
  const out = [];
  for (const who of ["me", "spouse"]) {
    const pays = Array.from({ length: 38 }, (_, i) => 30000 + i * 10000);
    const hs = plansOf(pays.map((p) => sweepSpec({ who, ages: who === "me" ? [45] : [45, 45], pays: who === "me" ? [p] : [p / 2, p / 2], tenure: "mortgage" })));
    const rows = hs.map((H, i) => ({ pay: pays[i], V: H.home?.value ?? NaN, O: H.mortgage?.owed ?? NaN }));
    out.push(...along(rows, (a, b) => ({ ...res(b.V >= a.V * 0.99 && b.O >= a.O * 0.99, { pay: `${money(a.pay)} -> ${money(b.pay)}`, homeValue: `${r0(a.V)} -> ${r0(b.V)}`, owed: `${r0(a.O)} -> ${r0(b.O)}` }, who === "me" ? "single" : "couple"), facts: { series: `Ohio ${who === "me" ? "single" : "couple"}, oldest 45, own with a mortgage, nothing typed; household pay $30,000..$400,000` } })));
  }
  return { "HD-MONO-PAY": out };
});
sweep(["sr.saving.monotone", "sr.saving.no-cliff", "sr.verdict.continuity", "sr.contrib.like-you"], () => {
  const r = { "sr.saving.monotone": [], "sr.saving.no-cliff": [], "sr.verdict.continuity": [], "sr.contrib.like-you": [] };
  const P = PAGES.get("retirement/projection");
  const fig = (H) => {
    const ret = retAccts(H).reduce((s, a) => s + (Number(a.balance) || 0), 0), inv = L(H.plan, "accounts").filter((a) => a.type === "brokerage").reduce((s, a) => s + (Number(a.balance) || 0), 0);
    const cash = L(H.plan, "accounts").filter((a) => ["checking", "savings"].includes(a.type)).reduce((s, a) => s + (Number(a.balance) || 0), 0);
    const c = L(H.plan.retirement, "contributions")[0];
    const share = c && H.payYearly > 0 ? perYear(c.amount, c.period) / (H.payYearly / H.adults.length) : 0;
    let pr = null; try { pr = P.compute(H.plan, { today: H.today }); } catch { pr = null; }
    return { age: Math.floor(H.oldest), ret, inv, cash, share, v: pr?.verdict ?? null, run: pr?.shortAge ?? null, end: Number(H.plan.assumptions?.planEndAge ?? 95) };
  };
  const cap = (a) => (a < 30 ? 1.5 : a < 45 ? 1.25 : 1.15);
  for (const who of ["me", "spouse"]) for (const pay of [40000, 80000, 150000]) for (const kind of ["work", "own"]) {
    const name = `Ohio ${who === "me" ? "single" : "couple"}, $${pay.toLocaleString("en-US")} ${who === "me" ? "" : "each "}, retirement ${kind === "work" ? "through work" : "on my own"}, every box blank`;
    const rows = plansOf(Array.from({ length: 47 }, (_, i) => sweepSpec({ who, ages: who === "me" ? [18 + i] : [18 + i, 18 + i], pays: who === "me" ? [pay] : [pay, pay], kind }))).map(fig);
    const facts = { series: name };
    // skeptic pass 2026-11-07: up to a quarter lower one year older (an age band's edge in Vanguard's and the survey's tables) is
    // not something one household sees; a larger fall is
    r["sr.saving.monotone"].push(...along(rows, (a, b) => ({ ...res(b.ret >= 0.75 * a.ret - 1 && b.inv >= 0.75 * a.inv - 1 && b.cash >= 0.75 * a.cash - 1 && b.share >= a.share - 0.005, { ages: `${a.age} -> ${b.age}`, retirement: `${r0(a.ret)} -> ${r0(b.ret)}`, investments: `${r0(a.inv)} -> ${r0(b.inv)}`, cash: `${r0(a.cash)} -> ${r0(b.cash)}`, shareOfPay: `${r3(a.share)} -> ${r3(b.share)}` }, "age"), facts })));
    r["sr.saving.no-cliff"].push(...along(rows, (a, b) => { const k = cap(a.age); const x = (u, v) => (u > 0 ? v / u : v > 0 ? Infinity : 1); return { ...res(x(a.ret, b.ret) <= k && x(a.inv, b.inv) <= k && x(a.cash, b.cash) <= k && x(a.share, b.share) <= k, { ages: `${a.age} -> ${b.age}`, cap: k, retirement: `${r0(a.ret)} -> ${r0(b.ret)}`, investments: `${r0(a.inv)} -> ${r0(b.inv)}`, cash: `${r0(a.cash)} -> ${r0(b.cash)}`, shareOfPay: `${r3(a.share)} -> ${r3(b.share)}` }), facts }; }));
    r["sr.verdict.continuity"].push(...along(rows, (a, b) => { if (!a.v || !b.v) return null; const ok = Math.abs(RANK[b.v] - RANK[a.v]) <= 1 && (!(a.run && b.run) || Math.abs(b.run - a.run) <= 3) && (!!a.run === !!b.run || (a.run ?? b.run) >= a.end - 3); return { ...res(ok, { ages: `${a.age} -> ${b.age}`, verdict: `${a.v}${a.run ? ` (runs out at ${a.run})` : ""} -> ${b.v}${b.run ? ` (runs out at ${b.run})` : ""}` }), facts }; }));
    r["sr.contrib.like-you"].push(...along(rows, (a, b) => (a.share > 0 ? { ...res(b.share >= a.share - 0.005, { ages: `${a.age} -> ${b.age}`, shareOfPay: `${r3(a.share)} -> ${r3(b.share)}` }, "age profile"), facts } : null)));
  }
  for (const age of [24, 30, 45, 60]) {
    const pays = Array.from({ length: 39 }, (_, i) => 20000 + i * 10000);
    const rows = plansOf(pays.map((p) => sweepSpec({ who: "me", ages: [age], pays: [p] }))).map((x, i) => ({ ...fig(x), pay: pays[i] }));
    r["sr.saving.monotone"].push(...along(rows, (a, b) => ({ ...res(b.ret >= a.ret - 1 && b.inv >= a.inv - 1 && b.cash >= a.cash - 1, { pay: `${money(a.pay)} -> ${money(b.pay)}`, retirement: `${r0(a.ret)} -> ${r0(b.ret)}`, investments: `${r0(a.inv)} -> ${r0(b.inv)}`, cash: `${r0(a.cash)} -> ${r0(b.cash)}` }, "pay"), facts: { series: `Ohio single aged ${age}, pay $20,000..$400,000, every box blank` } })));
  }
  return r;
});
sweep(["pt.takehome.payroll-arithmetic"], () => {
  const out = [];
  for (const state of ["OH", "CA"]) {
    const pays = Array.from({ length: 159 }, (_, i) => 5000 + i * 2500);
    const pc = PAGES.get("cashflow/paycheck");
    const nets = pays.map((p) => { const w = walk(sweepSpec({ who: "me", ages: [40], pays: [p], state, have: ["checking"] })); try { return pc.compute(w.plan, { today: TODAY }).people?.[0]?.yearly?.net ?? null; } catch { return null; } });
    for (let i = 1; i < pays.length; i++) out.push({ ...res(nets[i] !== null && nets[i - 1] !== null && nets[i] >= nets[i - 1] - 0.5, { pay: `${money(pays[i - 1])} -> ${money(pays[i])}`, net: `${r0(nets[i - 1])} -> ${r0(nets[i])}` }, "monotone"), facts: { series: `${state} single aged 40, pay $5,000..$400,000` } });
  }
  return { "pt.takehome.payroll-arithmetic": out };
});
sweep(["pt.ss.guess-bounds-monotone"], () => {
  const out = [];
  for (const by of [1962, 1966, 1976, 1986, 1996, 2004]) {
    const pays = Array.from({ length: 159 }, (_, i) => 5000 + i * 2500);
    const v = pays.map((p) => S.estimateSocialSecurity({ birthYear: by, yearlyPay: p, stopAge: 65, today: TODAY }) ?? 0);
    for (let i = 1; i < pays.length; i++) out.push({ ...res(v[i] >= v[i - 1] && (pays[i - 1] < WAGE_BASE[2026] * 1.1 || v[i] === v[i - 1]), { pay: `${money(pays[i - 1])} -> ${money(pays[i])}`, monthlyAtFullAge: `${v[i - 1]} -> ${v[i]}` }, "pay"), facts: { series: `born ${by}, stop at 65, pay $5,000..$400,000` } });
    const stops = Array.from({ length: 16 }, (_, i) => 55 + i);
    const w = stops.map((s) => S.estimateSocialSecurity({ birthYear: by, yearlyPay: 60000, stopAge: s, today: TODAY }) ?? 0);
    for (let i = 1; i < stops.length; i++) out.push({ ...res(w[i] >= w[i - 1], { stopAge: `${stops[i - 1]} -> ${stops[i]}`, monthlyAtFullAge: `${w[i - 1]} -> ${w[i]}` }, "stop age"), facts: { series: `born ${by}, $60,000, stop age 55..70` } });
  }
  return { "pt.ss.guess-bounds-monotone": out };
});
sweep(["SF-HEALTH-AGE"], () => {
  const out = [];
  for (const tap of [null, "own", "unsure"]) {
    const ages = Array.from({ length: 43 }, (_, i) => 22 + i);
    const hs = plansOf(ages.map((a) => sweepSpec({ who: "spouse", ages: [a, a], pays: [60000, 60000], taps: tap ? { "health-cover": tap } : {} })));
    const v = hs.map((H) => H.spendRows.insurance?.monthly ?? 0);
    const facts = { series: `Ohio couple, $60,000 each, renting, health cover tap ${tap ?? "unanswered"}, ages 22..64` };
    for (let i = 1; i < ages.length; i++) out.push({ ...res(v[i] >= v[i - 1] - 1, { ages: `${ages[i - 1]} -> ${ages[i]}`, insuranceRow: `${r0(v[i - 1])} -> ${r0(v[i])}` }, "a: non-decreasing"), facts });
    const at = (a) => v[ages.indexOf(a)];
    out.push({ ...res(at(60) / at(30) >= 1.15, { at30: r0(at(30)), at60: r0(at(60)), ratio: r2(at(60) / at(30)) }, "a: 60 vs 30"), facts });
    if (tap === "own") out.push({ ...res(at(64) / at(25) >= 1.5, { at25: r0(at(25)), at64: r0(at(64)), ratio: r2(at(64) / at(25)) }, "a: own, 64 vs 25"), facts });
  }
  return { "SF-HEALTH-AGE": out };
});
sweep(["SF-SPEND-CHILD-MONO", "SF-SPEND-FOOD"], () => {
  const out = [], food = [];
  for (const state of ["OH", "CA", "TX"]) for (const who of ["me", "spouse"]) for (const age of [25, 33, 40]) for (const pay of [30000, 60000, 120000]) for (const tenure of ["rent", "own"]) for (const child of [0, 8]) {
    if (age - child < 18) continue;
    const base = sweepSpec({ who, ages: who === "me" ? [age] : [age, age], pays: who === "me" ? [pay] : [pay, pay], state, tenure });
    const [a, b] = plansOf([base, { ...base, kids: [child], taps: { childcare: "no" } }]);
    const tot = (H) => spendTotal(H) - (H.spendRows.childcare?.monthly ?? 0);
    const ctc = child < 17 ? 2200 : 0;
    const facts = { series: `${state} ${who === "me" ? "single" : "couple"} ${age}, $${pay.toLocaleString("en-US")}${who === "me" ? "" : " each"}, ${tenure === "rent" ? "renting" : "own"}; then a child of ${child}` };
    const rows = ["housing", "utilities", "groceries"].map((k) => [k, a.spendRows[k]?.monthly ?? 0, b.spendRows[k]?.monthly ?? 0]);
    // skeptic pass 2026-11-07: a row may move by 5% when the survey cell changes (single to single parent); a bigger fall is wrong
    out.push({ ...res(tot(b) >= tot(a) - 10 && rows.every(([, x, y]) => y >= 0.95 * x - 10) && (!(num(a.leftOver?.monthly) !== null && num(b.leftOver?.monthly) !== null) || b.leftOver.monthly <= a.leftOver.monthly + ctc / 12 + 10), { total: `${r0(tot(a))} -> ${r0(tot(b))}`, ...Object.fromEntries(rows.map(([k, x, y]) => [k, `${r0(x)} -> ${r0(y)}`])), leftOver: `${r0(a.leftOver?.monthly)} -> ${r0(b.leftOver?.monthly)}` }), facts });
    food.push({ ...res((b.spendRows.groceries?.monthly ?? 0) >= 0.95 * (a.spendRows.groceries?.monthly ?? 0) - 10, { groceries: `${r0(a.spendRows.groceries?.monthly)} -> ${r0(b.spendRows.groceries?.monthly)}` }, "one more person"), facts });
  }
  return { "SF-SPEND-CHILD-MONO": out, "SF-SPEND-FOOD": food };
});
sweep(["SF-RETIRE-SPEND"], () => {
  const out = [];
  const lines = [["Ohio couple $90,000 each renting", { who: "spouse", pays: [90000, 90000] }], ["Ohio single $50,000 owning", { who: "me", pays: [50000], tenure: "own" }],
    ["Ohio couple $75,000 each, child 12, own with a mortgage", { who: "spouse", pays: [75000, 75000], tenure: "mortgage", kids: [12] }], ["Texas single $40,000 renting", { who: "me", pays: [40000], state: "TX" }]];
  for (const [name, o] of lines) {
    const ages = Array.from({ length: 25 }, (_, i) => 40 + i);
    const hs = plansOf(ages.map((a) => sweepSpec({ ...o, ages: o.who === "me" ? [a] : [a, a] })));
    const v = hs.map((H) => Number(H.plan.retirement?.spendingMonthly) || 0);
    // skeptic pass 2026-11-07: at 50 the guess switches from today's spending to the survey's retirement ratios
    // (overview/setup retireSpendFor, documented); that one step is the design, every other year must stay within 10%
    for (let i = 1; i < ages.length; i++) out.push({ ...res(ages[i] === 50 || Math.abs(v[i] - v[i - 1]) <= 0.1 * v[i - 1], { ages: `${ages[i - 1]} -> ${ages[i]}`, retireSpend: `${v[i - 1]} -> ${v[i]}` }, "per year of age"), facts: { series: `${name}; oldest 40..64` } });
  }
  return { "SF-RETIRE-SPEND": out };
});
sweep(["pt.medicare.at-65"], () => {
  // no guess prices someone 65 or over at the under-65 figure: the same household at 60 and at 70
  const out = [];
  for (const who of ["me", "spouse"]) for (const pay of [30000, 60000, 120000]) for (const tap of [null, "unsure"]) {
    const mk = (age) => sweepSpec({ who, ages: who === "me" ? [age] : [age, age], pays: who === "me" ? [pay] : [pay, pay], taps: tap ? { "health-cover": tap } : {} });
    const [a, b] = plansOf([mk(60), mk(70)]);
    const x = a.spendRows.insurance?.monthly ?? 0, y = b.spendRows.insurance?.monthly ?? 0;
    // skeptic pass 2026-11-07: a guess need not change at 65; at 70 it must cover each adult's Part B + Part D base premium
    // ($202.90 + $38.99 a month, 2026) when income is above the Medicare Savings Program limit (SF-HEALTH-AGE (c))
    const n70 = who === "me" ? 1 : 2, qi70 = who === "me" ? 1816 : 2455, inc70 = (who === "me" ? pay : 2 * pay) / 12;
    out.push({ ...res(inc70 <= qi70 || y >= 241.89 * n70, { at60: r0(x), at70: r0(y), medicareFloor: r2(241.89 * n70) }, "health guess at 70 vs 60"), facts: { series: `Ohio ${who === "me" ? "single" : "couple"}, $${pay.toLocaleString("en-US")}${who === "me" ? "" : " each"}, renting, health tap ${tap ?? "unanswered"}` } });
  }
  return { "pt.medicare.at-65": out };
});

// ---------------------------------------------------------------------------------------------------------------------
// Running: households -> per rule { checked, failed, parts, examples }.
const MAX_EX = 5;
export function emptyTally() { return {}; }
function tallyAdd(t, id, r, facts, key) {
  const x = (t[id] ??= { checked: 0, failed: 0, households: 0, failedHouseholds: 0, parts: {}, examples: [], seen: new Set(), bad: new Set() });
  x.checked++;
  const hk = key ?? facts?.id ?? facts?.series;
  if (hk !== undefined && !x.seen.has(hk)) { x.seen.add(hk); x.households++; }
  if (r.part) { const p = (x.parts[r.part] ??= { checked: 0, failed: 0 }); p.checked++; if (!r.ok) p.failed++; }
  if (!r.ok) {
    x.failed++;
    if (hk !== undefined && !x.bad.has(hk)) { x.bad.add(hk); x.failedHouseholds++; }
    if (x.examples.length < MAX_EX && !x.examples.some((e) => (e.facts?.id ?? e.facts?.series) === hk && e.part === r.part)) x.examples.push({ facts, part: r.part ?? null, figures: r.figures });
  }
}
export function finishTally(t) { for (const x of Object.values(t)) { x.seen = x.seen.size; delete x.seen; x.bad = undefined; delete x.bad; } return t; }
/** Check every per-household rule on one household. */
export function checkHousehold(H, tally, { only = null } = {}) {
  for (const R of RULES) {
    if (only && !only.has(R.id)) continue;
    if (TIERS[R.tier] > TIERS[H.tier]) continue;
    let out;
    try { out = R.check(H) ?? []; } catch (e) { out = [res(false, { crash: String(e?.message ?? e).slice(0, 200) }, "crash")]; }
    for (const r of out) if (r) tallyAdd(tally, R.id, r, H.facts, H.facts.id);
  }
}
export function runSweep(sw, tally, { only = null } = {}) {
  if (only && !sw.ids.some((id) => only.has(id))) return;
  let got;
  try { got = sw.run(); } catch (e) { got = Object.fromEntries(sw.ids.map((id) => [id, [{ ...res(false, { crash: String(e?.stack ?? e).slice(0, 300) }, "crash"), facts: { series: "sweep" } }]])); }
  for (const [id, list] of Object.entries(got)) for (const r of list) tallyAdd(tally, id, r, r.facts, `${r.facts?.series}|${JSON.stringify(Object.values(r.figures).slice(0, 1))}`);
}
function merge(into, t) {
  for (const [id, x] of Object.entries(t)) {
    const y = (into[id] ??= { checked: 0, failed: 0, households: 0, failedHouseholds: 0, parts: {}, examples: [] });
    y.checked += x.checked; y.failed += x.failed; y.households += x.households; y.failedHouseholds += x.failedHouseholds;
    for (const [p, v] of Object.entries(x.parts)) { const q = (y.parts[p] ??= { checked: 0, failed: 0 }); q.checked += v.checked; q.failed += v.failed; }
    for (const e of x.examples) if (y.examples.length < MAX_EX) y.examples.push(e);
  }
  return into;
}
const tierOf = (i, src) => (src === "edge" || src === "fixture" ? "C" : i % 12 === 0 ? "C" : i % 3 === 0 ? "B" : "A");
/** One job: { kind: "grid"|"edge"|"qa"|"fixture"|"sweep", items }. Returns a finished tally. */
export async function runJob(job, { only = null } = {}) {
  await loadPages();
  const t = {};
  if (job.kind === "sweep") { for (const k of job.items) runSweep(SWEEPS[k], t, { only }); return finishTally(t); }
  if (job.kind === "fixture") { for (const f of await fixturePlans()) checkHousehold(new Household(f.plan, f, { tier: "C" }), t, { only }); return finishTally(t); }
  for (const it of job.items) {
    if (job.kind === "qa") {
      const plan = qaHouseholdPlan(it.file);
      if (!plan) continue;
      const today = plan.__today ?? TODAY;
      checkHousehold(new Household(plan, { id: `qa:${path.basename(it.file, ".md")}`, src: "qa" }, { tier: tierOf(it.i, "qa"), today }), t, { only });
      continue;
    }
    const w = walk(it);
    checkHousehold(new Household(w.plan, { ...it, preview: w.preview }, { tier: tierOf(Number(String(it.id).replace(/\D/g, "")) || 0, it.src) }), t, { only });
  }
  return finishTally(t);
}

// ---------------------------------------------------------------------------------------------------------------------
// The report
export function report(tally, { sampled, seconds }) {
  const rules = RULE_TEXT.rules.map((m) => {
    const x = tally[m.id] ?? { checked: 0, failed: 0, households: 0, failedHouseholds: 0, parts: {}, examples: [] };
    const impl = RULES.find((r) => r.id === m.id), sw = SWEEPS.some((s) => s.ids.includes(m.id));
    return { id: m.id, strength: m.strength, owner: m.owner ?? null, file: m.file, tier: impl?.tier ?? null, sweep: sw, pending: impl?.pending ?? null, checked: x.checked, failed: x.failed, households: x.households, failedHouseholds: x.failedHouseholds, parts: x.parts, examples: x.examples, threshold: m.threshold, source: m.source, sourceDate: m.sourceDate };
  });
  return { asOf: TODAY, seconds, sampled, rules };
}
const ownerWords = (o) => (o ? String(o) : "none (fix in this build)");
export function markdown(rep) {
  const rs = [...rep.rules].sort((a, b) => (a.strength === b.strength ? 0 : a.strength === "hard" ? -1 : 1) || b.failed - a.failed || b.failedHouseholds - a.failedHouseholds || a.id.localeCompare(b.id));
  const lines = [];
  lines.push(`# Guess sanity sweep (${rep.asOf})`, "");
  lines.push(`Made by \`node qa/guess-sanity.mjs\` in ${Math.round(rep.seconds)} s. Every rule, its words, line, source and date: qa/guess-sanity-rules.json.`, "");
  lines.push("## What was checked", "", ...rep.sampled.map((s) => `- ${s}`), "");
  const hard = rs.filter((r) => r.strength === "hard"), soft = rs.filter((r) => r.strength !== "hard");
  const sum = (xs) => `${xs.filter((r) => r.failed > 0).length} of ${xs.length} rules fail somewhere`;
  lines.push(`Hard rules: ${sum(hard)}. Soft rules: ${sum(soft)}.`, "");
  lines.push("## Rules by failures (hard first)", "", "| rule | strength | owner | checks | failed | households failing / checked |", "|---|---|---|---:|---:|---:|");
  for (const r of rs) lines.push(`| ${r.id} | ${r.strength} | ${r.owner ?? ""} | ${r.checked} | ${r.failed} | ${r.failedHouseholds} / ${r.households} |`);
  lines.push("");
  const owned = rs.filter((r) => r.owner && r.failed > 0);
  lines.push("## Owned by the other builds (checked here, fixed there)", "");
  for (const o of ["bought", "leftover", "claude-a"]) {
    const xs = owned.filter((r) => String(r.owner).includes(o));
    if (xs.length) lines.push(`- **${o}**: ${xs.map((r) => `${r.id} (${r.failed} failing checks${Object.keys(r.parts).length ? `; ${Object.entries(r.parts).filter(([, v]) => v.failed).map(([k, v]) => `${k} ${v.failed}`).join(", ")}` : ""})`).join("; ")}`);
  }
  lines.push("");
  lines.push("## Each rule", "");
  for (const r of rs) {
    lines.push(`### ${r.id} (${r.strength}${r.owner ? `, owner: ${r.owner}` : ""})`, "");
    lines.push(`${r.failed} of ${r.checked} checks fail (${r.failedHouseholds} of ${r.households} households or steps)${r.tier ? `; runs on tier ${r.tier}` : ""}${r.sweep ? "; has a sweep" : ""}${r.pending ? `; waits for the ${r.pending} build's input` : ""}.`);
    const note = RULES.find((x) => x.id === r.id)?.note;
    if (!r.checked) lines.push("", r.pending ? `Nothing to check yet: the input this rule reads does not exist until the ${r.pending} build lands.` : note ?? "Nothing in the grid reached this rule (see the notes on coverage above).");
    const parts = Object.entries(r.parts).filter(([, v]) => v.checked);
    if (parts.length) lines.push("", `Parts: ${parts.map(([k, v]) => `${k} ${v.failed}/${v.checked}`).join("; ")}.`);
    lines.push("", `Line: ${r.threshold ?? ""}`, "", `Source: ${r.source ?? ""} (${r.sourceDate ?? ""})`);
    if (r.examples.length) {
      lines.push("", `Examples (the first ${r.examples.length} found${r.failed > r.examples.length ? ` of ${r.failed}` : ""}):`);
      for (const e of r.examples) lines.push(`- ${e.facts ? Object.entries(e.facts).filter(([k]) => k !== "src").map(([k, v]) => `${k}: ${v}`).join("; ") : ""}${e.part ? ` [${e.part}]` : ""} -> ${Object.entries(e.figures ?? {}).map(([k, v]) => `${k} ${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------------------------------------------------
// Command line (and the worker threads it starts)
async function main(argv) {
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const full = argv.includes("--full"), noQa = argv.includes("--no-qa");
  const only = arg("--rules") ? new Set(arg("--rules").split(",")) : null;
  const out = path.resolve(arg("--out") ?? path.join(ROOT, "qa", "results"));
  const workers = Math.max(1, Math.min(Number(arg("--workers") ?? Math.min(3, Math.max(1, os.cpus().length - 1))), 8));
  const t0 = Date.now();
  const grid = gridSpecs({ full }), fullCount = full ? grid.length : gridSpecs({ full: true }).length;
  const qa = noQa ? [] : qaHouseholdFiles().map((file, i) => ({ file, i }));
  const tiers = { A: 0, B: 0, C: 0 };
  grid.forEach((g) => { tiers[tierOf(Number(g.id.slice(1)), "grid")]++; });
  const jobs = [];
  const chunk = (xs, n) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
  SWEEPS.forEach((s, k) => jobs.push({ kind: "sweep", items: [k] }));
  for (const c of chunk(grid, 60)) jobs.push({ kind: "grid", items: c });
  jobs.push({ kind: "edge", items: edgeSpecs() });
  jobs.push({ kind: "fixture", items: [] });
  for (const c of chunk(qa, 100)) jobs.push({ kind: "qa", items: c });
  const total = {};
  let done = 0;
  const say = () => process.stderr.write(`\r${done}/${jobs.length} jobs, ${Math.round((Date.now() - t0) / 1000)} s   `);
  if (workers <= 1) { for (const j of jobs) { merge(total, await runJob(j, { only })); done++; say(); } }
  else {
    const { Worker } = await import("node:worker_threads");
    let next = 0;
    await Promise.all(Array.from({ length: workers }, () => new Promise((resolve, reject) => {
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: { only: only ? [...only] : null } });
      const feed = () => { if (next >= jobs.length) { w.terminate(); resolve(); return; } w.postMessage(jobs[next++]); };
      w.on("message", (t) => { merge(total, t); done++; say(); feed(); });
      w.on("error", reject);
      feed();
    })));
  }
  process.stderr.write("\n");
  const seconds = (Date.now() - t0) / 1000;
  const sampled = [
    `Grid: ${grid.length} households built through Get started${full ? " (the whole grid)" : ` of the ${fullCount} in the whole grid: every age (${GRID_AGES.join(", ")}) x single / couple the same age / couple 10 years apart x 0..3 children of believable ages (the first born when the youngest adult was 20 or 28, then every 3 years; parent 18..45 at each birth) x pay (low, median, high for the age from BLS weekly earnings x 0.51 / 1 / 2.34; and retired from 62) x 7 home answers (renter; owner without a mortgage, nothing typed or the value typed; owner with a mortgage, nothing typed, value only, payment only, balance only), with the state rotated over ${STATES.join(", ")} instead of crossed (each state meets every age, couple type, pay and home answer). Run with --full for the whole grid`}.`,
    "Spread over the grid by position (so each meets every age): unmarried partners (every 4th couple), a partner not working (every 5th couple), other debts (none; car loan; student loan and cards; all four), retirement saving through work or on my own, the childcare and health-cover taps, a $1,200 pension for half the retired. Nothing else is typed: every other box is our guess.",
    `Pages: tier A (every household): every estimator and ${PAGES_A.length} pages (${PAGES_A.join(", ")}); tier B (grid households 0, 3, 6, ...: ${tiers.B + tiers.C} of ${grid.length}) adds ${PAGES_B.join(", ")}; tier C (grid households 0, 12, 24, ...: ${tiers.C}) adds the four what-ifs of sr.verdict.monotone (each one more run of Will the money last). A rule that reads a tier-B page is checked only on tier B and C households: its "checks" count says so. Edge households and fixtures run every tier.`,
    `Edge households: ${edgeSpecs().length} built for one rule each (${edgeSpecs().map((e) => e.id.slice(2)).join(", ")}).`,
    `qa plans: ${noQa ? "skipped (--no-qa)" : `${qa.length} plans from qa/households (tier B for every 3rd) and every exported plan in qa/fixtures (the setup personas walked to the end with our guesses)`}.`,
    `Sweeps: ${SWEEPS.map((s) => s.ids[0]).join(", ")}: one household moved along one answer (age, pay, a child), every step built through Get started.`,
    `Date: ${TODAY}. ${only ? `Only rules ${[...only].join(", ")}.` : "Every rule."}`,
  ];
  const rep = report(total, { sampled, seconds });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "sweep.json"), JSON.stringify(rep, null, 1));
  fs.writeFileSync(path.join(out, "sweep.md"), markdown(rep));
  const hard = rep.rules.filter((r) => r.strength === "hard" && r.failed > 0).length;
  console.log(`${path.join(out, "sweep.md")}: ${rep.rules.filter((r) => r.failed > 0).length} of ${rep.rules.length} rules fail somewhere (${hard} hard), ${Math.round(seconds)} s`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const wt = await import("node:worker_threads");
if (!wt.isMainThread && wt.workerData && "only" in wt.workerData) {
  const only = wt.workerData.only ? new Set(wt.workerData.only) : null;
  wt.parentPort.on("message", async (job) => { wt.parentPort.postMessage(await runJob(job, { only })); });
} else if (isMain) {
  await main(process.argv.slice(2));
}
