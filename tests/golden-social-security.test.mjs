import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, toObjects } from "../core/csv.js";
import { compute } from "../modules/retirement/social-security/compute.js";
import { estimateBenefit } from "../modules/retirement/social-security/compute.js";
import { emptyPlan } from "../core/schema/migrate.js";

const readRows = (path) => toObjects(parseCsv(readFileSync(new URL(path, import.meta.url), "utf8")));
const histories = readRows("./golden/retirement/ss-histories.csv");
const benefits = readRows("./golden/retirement/ss-benefits.csv");
const byHistory = new Map(histories.map((row) => [row.history_id, row]));
const benefitByKey = new Map(benefits.map((row) => [`${row.history_id}|${row.claim_age_years}|${row.claim_age_months}`, row]));
// Where the key itself is a dime off (checked by hand, F-031): its generator floored a binary 2,984.7999... to
// 2,984.70 when 2,912.00 x 1.025 is exactly 2,984.80, and the missing dime carries through every claiming age of
// this history (PIA 3,068.30, not 3,068.20). On these rows the app's figures are the key's or up to two dimes above
// (a claim factor scales the missing dime: 0.725 of it at 62, 1.28 of it at 70).
const KEY_DIME_LOW = new Set(["w12-h04-steady-y1957"]);
const benefitsByHistory = new Map();
for (const row of benefits) {
  if (!benefitsByHistory.has(row.history_id)) benefitsByHistory.set(row.history_id, []);
  benefitsByHistory.get(row.history_id).push(row);
}
const sameDime = (actual, expected, label) => {
  assert.equal(Math.round(Number(actual) * 10), Math.round(Number(expected) * 10), `${label}: ${actual} != ${expected}`);
};

function appResult(history, claimAge, today = "2026-10-26") {
  const by = Number(history.birth_date.slice(0, 4));
  const record = [];
  for (let year = 1966; year <= 2030; year++) {
    const earnings = Number(history[String(year)]);
    if (earnings > 0) record.push({ year, earnings });
  }
  const plan = emptyPlan();
  plan.household.people.push({ id: "golden", name: "Invented worker", role: "self", birthDate: history.birth_date, retirementAge: 65 });
  plan.retirement = {
    ...plan.retirement,
    socialSecurity: { golden: { claimAge, record, futureEarnings: "none" } },
  };
  return compute(plan, { today }).people[0];
}

test("golden files contain 2,000 histories and 33 claiming ages for each", () => {
  assert.equal(histories.length, 2000);
  assert.equal(benefits.length, 2000 * 33);
  assert.equal(new Set(histories.map((row) => row.history_id)).size, 2000);
  for (const h of histories) {
    const rows = benefitsByHistory.get(h.history_id) ?? [];
    assert.equal(rows.length, 33, `${h.history_id} row count`);
    assert.equal(rows[0].claim_age_years, "62");
    assert.equal(rows[0].claim_age_months, "0");
    assert.equal(rows.at(-1).claim_age_years, "70");
    assert.equal(rows.at(-1).claim_age_months, "0");
  }
});

// A survivor at their own full retirement age gets the worker's benefit, but when the worker claimed early never less
// than 82.5% of the worker's primary insurance amount (the widow(er)'s limit, SSA POMS RS 00615.320). The key's
// `survivor` column is defined as the worker's benefit at that age (ss-rules.md), so the limit is applied to it here.
const fraMonths = (birthYear) => birthYear <= 1954 ? 66 * 12 : birthYear <= 1959 ? 66 * 12 + (birthYear - 1954) * 2 : 67 * 12;
const survivorByLaw = (row, birthYear, month) => Number(row.monthly_benefit) > 0 && month < fraMonths(birthYear) ? Math.max(Number(row.survivor), Math.floor(Number(row.pia) * 0.825 * 10 + 1e-8) / 10) : Number(row.survivor);

test("every history at every claiming age: page compute agrees with the independent SSA key to the dime", () => {
  // All 2,000 histories (birth years 1950-1995) x 33 claiming ages, valued in October 2026, with SSA's tables through
  // the 2025 wage index, the 2027 maximum and the COLA paid from January 2027 (not yet in an October 2026 amount).
  const failed = [];
  for (const h of histories) {
    const birthYear = Number(h.birth_date.slice(0, 4));
    const shift = KEY_DIME_LOW.has(h.history_id) ? 1 : 0;
    for (let month = 62 * 12; month <= 70 * 12; month += 3) {
      const [ageYears, ageMonths] = [Math.floor(month / 12), month % 12];
      const key = `${h.history_id}|${ageYears}|${ageMonths}`;
      const expected = benefitByKey.get(key);
      const actual = appResult(h, ageYears + ageMonths / 12);
      const dimes = (v) => Math.round(Number(v) * 10);
      const checks = [
        ["AIME", actual.estimate.aime, expected.aime, 0],
        ["PIA", actual.estimate.pia, expected.pia, shift],
        ["monthly", actual.monthly, expected.monthly_benefit, Number(expected.monthly_benefit) > 0 ? shift : 0],
        ["spouse", actual.spousalAtSameAge, expected.spousal_at_same_age, Number(expected.spousal_at_same_age) > 0 ? shift : 0],
        ["survivor", actual.survivor, survivorByLaw(expected, birthYear, month), Number(expected.monthly_benefit) > 0 ? shift : 0],
      ];
      for (const [label, got, want, dimeShift] of checks) {
        const off = dimes(got) - dimes(want);
        if (off !== 0 && !(dimeShift && off > 0 && off <= 2)) failed.push(`${key} ${label}: app ${got}, key ${want}${dimeShift ? " (key known a dime low)" : ""}`);
      }
    }
  }
  assert.deepEqual(failed.slice(0, 20), []);
});

// Independent source tables for the alternate calculation below. Figures are transcribed from SSA OACT:
// AWI: https://www.ssa.gov/oact/cola/AWI.html
// Taxable maximum: https://www.ssa.gov/oact/cola/cbb.html
// Credit thresholds: https://www.ssa.gov/oact/cola/QC.html
// COLA history: https://www.ssa.gov/oact/cola/colaseries.html
// Future-year fallback assumptions are described in tests/golden/retirement/ss-rules.md.
const AWI = Object.fromEntries([
  [1951, 2799.16],
  [1952, 2973.32],
  [1953, 3139.44],
  [1954, 3155.64],
  [1955, 3301.44],
  [1956, 3532.36],
  [1957, 3641.72],
  [1958, 3673.8],
  [1959, 3855.8],
  [1960, 4007.12],
  [1961, 4086.76],
  [1962, 4291.4],
  [1963, 4396.64],
  [1964, 4576.32],
  [1965, 4658.72],
  [1966, 4938.36],
  [1967, 5213.44],
  [1968, 5571.76],
  [1969, 5893.76],
  [1970, 6186.24],
  [1971, 6497.08],
  [1972, 7133.8],
  [1973, 7580.16],
  [1974, 8030.76],
  [1975, 8630.92],
  [1976, 9226.48],
  [1977, 9779.44],
  [1978, 10556.03],
  [1979, 11479.46],
  [1980, 12513.46],
  [1981, 13773.1],
  [1982, 14531.34],
  [1983, 15239.24],
  [1984, 16135.07],
  [1985, 16822.51],
  [1986, 17321.82],
  [1987, 18426.51],
  [1988, 19334.04],
  [1989, 20099.55],
  [1990, 21027.98],
  [1991, 21811.6],
  [1992, 22935.42],
  [1993, 23132.67],
  [1994, 23753.53],
  [1995, 24705.66],
  [1996, 25913.9],
  [1997, 27426.0],
  [1998, 28861.44],
  [1999, 30469.84],
  [2000, 32154.82],
  [2001, 32921.92],
  [2002, 33252.09],
  [2003, 34064.95],
  [2004, 35648.55],
  [2005, 36952.94],
  [2006, 38651.41],
  [2007, 40405.48],
  [2008, 41334.97],
  [2009, 40711.61],
  [2010, 41673.83],
  [2011, 42979.61],
  [2012, 44321.67],
  [2013, 44888.16],
  [2014, 46481.52],
  [2015, 48098.63],
  [2016, 48642.15],
  [2017, 50321.89],
  [2018, 52145.8],
  [2019, 54099.99],
  [2020, 55628.6],
  [2021, 60575.07],
  [2022, 63795.13],
  [2023, 66621.8],
  [2024, 69846.57],
  [2025, 72800.33]
]);
const TAXABLE_MAX = Object.fromEntries([
  [1937, 3000.0],
  [1938, 3000.0],
  [1939, 3000.0],
  [1940, 3000.0],
  [1941, 3000.0],
  [1942, 3000.0],
  [1943, 3000.0],
  [1944, 3000.0],
  [1945, 3000.0],
  [1946, 3000.0],
  [1947, 3000.0],
  [1948, 3000.0],
  [1949, 3000.0],
  [1950, 3000.0],
  [1951, 3600.0],
  [1952, 3600.0],
  [1953, 3600.0],
  [1954, 3600.0],
  [1955, 4200.0],
  [1956, 4200.0],
  [1957, 4200.0],
  [1958, 4200.0],
  [1959, 4800.0],
  [1960, 4800.0],
  [1961, 4800.0],
  [1962, 4800.0],
  [1963, 4800.0],
  [1964, 4800.0],
  [1965, 4800.0],
  [1966, 6600.0],
  [1967, 6600.0],
  [1968, 7800.0],
  [1969, 7800.0],
  [1970, 7800.0],
  [1971, 7800.0],
  [1972, 9000.0],
  [1973, 10800.0],
  [1974, 13200.0],
  [1975, 14100.0],
  [1976, 15300.0],
  [1977, 16500.0],
  [1978, 17700.0],
  [1979, 22900.0],
  [1980, 25900.0],
  [1981, 29700.0],
  [1982, 32400.0],
  [1983, 35700.0],
  [1984, 37800.0],
  [1985, 39600.0],
  [1986, 42000.0],
  [1987, 43800.0],
  [1988, 45000.0],
  [1989, 48000.0],
  [1990, 51300.0],
  [1991, 53400.0],
  [1992, 55500.0],
  [1993, 57600.0],
  [1994, 60600.0],
  [1995, 61200.0],
  [1996, 62700.0],
  [1997, 65400.0],
  [1998, 68400.0],
  [1999, 72600.0],
  [2000, 76200.0],
  [2001, 80400.0],
  [2002, 84900.0],
  [2003, 87000.0],
  [2004, 87900.0],
  [2005, 90000.0],
  [2006, 94200.0],
  [2007, 97500.0],
  [2008, 102000.0],
  [2009, 106800.0],
  [2010, 106800.0],
  [2011, 106800.0],
  [2012, 110100.0],
  [2013, 113700.0],
  [2014, 117000.0],
  [2015, 118500.0],
  [2016, 118500.0],
  [2017, 127200.0],
  [2018, 128400.0],
  [2019, 132900.0],
  [2020, 137700.0],
  [2021, 142800.0],
  [2022, 147000.0],
  [2023, 160200.0],
  [2024, 168600.0],
  [2025, 176100.0],
  [2026, 184500.0],
  [2027, 192300]
]);
const CREDIT = Object.fromEntries([
  [1978, 250.0],
  [1979, 260.0],
  [1980, 290.0],
  [1981, 310.0],
  [1982, 340.0],
  [1983, 370.0],
  [1984, 390.0],
  [1985, 410.0],
  [1986, 440.0],
  [1987, 460.0],
  [1988, 470.0],
  [1989, 500.0],
  [1990, 520.0],
  [1991, 540.0],
  [1992, 570.0],
  [1993, 590.0],
  [1994, 620.0],
  [1995, 630.0],
  [1996, 640.0],
  [1997, 670.0],
  [1998, 700.0],
  [1999, 740.0],
  [2000, 780.0],
  [2001, 830.0],
  [2002, 870.0],
  [2003, 890.0],
  [2004, 900.0],
  [2005, 920.0],
  [2006, 970.0],
  [2007, 1000.0],
  [2008, 1050.0],
  [2009, 1090.0],
  [2010, 1120.0],
  [2011, 1120.0],
  [2012, 1130.0],
  [2013, 1160.0],
  [2014, 1200.0],
  [2015, 1220.0],
  [2016, 1260.0],
  [2017, 1300.0],
  [2018, 1320.0],
  [2019, 1360.0],
  [2020, 1410.0],
  [2021, 1470.0],
  [2022, 1510.0],
  [2023, 1640.0],
  [2024, 1730.0],
  [2025, 1810.0],
  [2026, 1890.0],
  [2027, 1970.0]
]);
const COLA = Object.fromEntries([
  [1975, 0.08],
  [1976, 0.064],
  [1977, 0.059000000000000004],
  [1978, 0.065],
  [1979, 0.099],
  [1980, 0.14300000000000002],
  [1981, 0.11199999999999999],
  [1982, 0.07400000000000001],
  [1983, 0.035],
  [1984, 0.035],
  [1985, 0.031],
  [1986, 0.013000000000000001],
  [1987, 0.042],
  [1988, 0.04],
  [1989, 0.047],
  [1990, 0.054000000000000006],
  [1991, 0.037000000000000005],
  [1992, 0.03],
  [1993, 0.026000000000000002],
  [1994, 0.027999999999999997],
  [1995, 0.026000000000000002],
  [1996, 0.028999999999999998],
  [1997, 0.021],
  [1998, 0.013000000000000001],
  [1999, 0.025],
  [2000, 0.035],
  [2001, 0.026000000000000002],
  [2002, 0.013999999999999999],
  [2003, 0.021],
  [2004, 0.027000000000000003],
  [2005, 0.040999999999999995],
  [2006, 0.033],
  [2007, 0.023],
  [2008, 0.057999999999999996],
  [2009, 0.0],
  [2010, 0.0],
  [2011, 0.036000000000000004],
  [2012, 0.017],
  [2013, 0.015],
  [2014, 0.017],
  [2015, 0.0],
  [2016, 0.003],
  [2017, 0.02],
  [2018, 0.027999999999999997],
  [2019, 0.016],
  [2020, 0.013000000000000001],
  [2021, 0.059000000000000004],
  [2022, 0.087],
  [2023, 0.032],
  [2024, 0.025],
  [2025, 0.027999999999999997],
  [2026, 0.036000000000000004]
]);

function independentFra(birthYear) {
  if (birthYear <= 1954) return 66 * 12;
  if (birthYear <= 1959) return 66 * 12 + (birthYear - 1954) * 2;
  return 67 * 12;
}
// SSA early reductions are 5/9 of 1% per month for the first 36 months and 5/12 of 1% thereafter; delayed credits for these birth years are 8% per year through 70. Sources are linked in ss-rules.md.
function independentWorkerFactor(birthYear, ageYears, ageMonths) {
  const claimMonth = ageYears * 12 + ageMonths;
  const fraMonth = independentFra(birthYear);
  if (claimMonth < fraMonth) {
    const early = fraMonth - claimMonth;
    return 1 - Math.min(36, early) * (5 / 9) / 100 - Math.max(0, early - 36) * (5 / 12) / 100;
  }
  return 1 + Math.min(claimMonth - fraMonth, 70 * 12 - fraMonth) * (8 / 12) / 100;
}
function independentSpouseAmount(pia, birthYear, ageYears, ageMonths) {
  const monthsEarly = Math.max(0, independentFra(birthYear) - (ageYears * 12 + ageMonths));
  const reduction = Math.min(36, monthsEarly) * (25 / 36) / 100 + Math.max(0, monthsEarly - 36) * (5 / 12) / 100;
  return Math.floor(Math.max(0, pia * (0.5 - reduction)) * 10 + 1e-8) / 10;
}

function independentAllFromRules(history, ageYears, ageMonths) {
  const birthYear = Number(history.birth_date.slice(0, 4));
  const indexingYear = birthYear + 60;
  // 2025 AWI $72,800.33 and frozen future AWI are from SSA's AWI table / explicit fixture assumption (ss-rules.md).
  const targetAwi = AWI[Math.min(indexingYear, 2025)] ?? 72800.33;
  const indexedEarnings = [];
  let credits = 0;
  for (let year = 1966; year <= 2030; year++) {
    const raw = Number(history[String(year)]);
    if (raw <= 0) continue;
    // 2027 taxable maximum $192,300 is the latest published value; later years are frozen by assumption.
    const covered = Math.min(raw, TAXABLE_MAX[year] ?? 192300);
    const yearAwi = AWI[Math.min(year, 2025)] ?? 72800.33;
    indexedEarnings.push(year < indexingYear ? covered * targetAwi / yearAwi : covered);
    // Before 1978 SSA credited $50 per quarter; from 1978 use the annual SSA credit table (40 credits are required).
    const creditAmount = year < 1978 ? 50 : (CREDIT[year] ?? 1970);
    credits += Math.min(4, Math.floor(raw / creditAmount));
  }
  const aime = Math.floor(indexedEarnings.sort((a, b) => b - a).slice(0, 35).reduce((sum, value) => sum + value, 0) / 420 + 1e-10);
  const bendYear = birthYear + 60;
  const bendAwi = AWI[Math.min(bendYear, 2025)] ?? 72800.33;
  const scale = bendAwi / AWI[1977];
  // SSA's 90% / 32% / 15% PIA formula uses 1977 base bend points $180 / $1,085, wage-indexed to the eligibility year; see the linked PIA formula in ss-rules.md.
  const bp1 = Math.floor(180 * scale + 0.5);
  const bp2 = Math.floor(1085 * scale + 0.5);
  let pia = Math.floor((0.9 * Math.min(aime, bp1) + 0.32 * Math.max(0, Math.min(aime, bp2) - bp1) + 0.15 * Math.max(0, aime - bp2)) * 10 + 1e-8) / 10;
  for (let year = birthYear + 62; year < 2026; year++) {
    if (COLA[year] !== undefined) pia = Math.floor(pia * (1 + COLA[year]) * 10 + 1e-8) / 10;
  }
  const insured = credits >= 40;
  const workerFactor = independentWorkerFactor(birthYear, ageYears, ageMonths);
  const worker = insured ? Math.floor(pia * workerFactor * 10 + 1e-8) / 10 : 0;
  const spouse = insured ? independentSpouseAmount(pia, birthYear, ageYears, ageMonths) : 0;
  return { aime, pia, worker, spouse, survivor: worker };
}

test("every tenth history passes a second full calculation from SSA rules", () => {
  for (let i = 9; i < histories.length; i += 10) {
    const h = histories[i];
    for (let month = 62 * 12; month <= 70 * 12; month += 3) {
      const ageYears = Math.floor(month / 12), ageMonths = month % 12;
      const row = benefitByKey.get(`${h.history_id}|${ageYears}|${ageMonths}`);
      const expected = independentAllFromRules(h, ageYears, ageMonths);
      sameDime(row.aime, expected.aime, `${h.history_id} independent AIME`);
      sameDime(row.pia, expected.pia, `${h.history_id} independent PIA`);
      sameDime(row.monthly_benefit, expected.worker, `${h.history_id} independent worker`);
      sameDime(row.spousal_at_same_age, expected.spouse, `${h.history_id} independent spouse`);
      sameDime(row.survivor, expected.survivor, `${h.history_id} independent survivor`);
    }
  }
});

test("an exact $x.x0 is not floored a dime low by binary floating point ($2,315.50, not $2,315.40)", () => {
  const h = byHistory.get("w01-h02-steady-y1951");
  const expected = benefitByKey.get(`${h.history_id}|63|6`);
  const actual = appResult(h, 63.5);
  sameDime(actual.monthly, expected.monthly_benefit, "known rounding boundary");
});

test("earnings are indexed with SSA's published 2025 wage index (a 1965 birth year turns 60 in 2025)", () => {
  const history = histories.find((row) => row.birth_date === "1965-07-01");
  const expected = benefitByKey.get(`${history.history_id}|62|0`);
  sameDime(appResult(history, 62).estimate.aime, expected.aime, "2025 AWI / age-60 indexing");
});

test("the 2027 bend points come out at SSA's published $1,340 and $8,077", () => {
  const history = histories.find((row) => row.birth_date === "1965-07-01");
  assert.deepEqual(appResult(history, 62).estimate.bendPoints, [1340, 8077]);
});

test("the 3.6% COLA effective December 2026 is in amounts valued in 2027", () => {
  const history = histories[0];
  const prior = benefitByKey.get(`${history.history_id}|62|0`);
  const expected = Math.floor(Number(prior.pia) * 1.036 * 10 + 1e-8) / 10;
  sameDime(appResult(history, 62, "2027-01-01").estimate.pia, expected, "2026 COLA");
});

test("2027 earnings are capped at the published $192,300 maximum, and later years at the last published one", () => {
  const estimate = estimateBenefit([{ year: 2027, earnings: 250000 }], { birthYear: 1965, futureEarnings: "none", today: "2027-01-01" });
  // 192,300 / 420 months, rounded down to the dollar.
  assert.equal(estimate.aime, 457);
  assert.equal(estimateBenefit([{ year: 2031, earnings: 250000 }], { birthYear: 1965, futureEarnings: "none", today: "2031-01-01" }).aime, 457, "a year past the table keeps the last maximum");
});

test("the page module returns spouse and survivor amounts for each person, and a couple's top-ups and survivor income", () => {
  const plan = emptyPlan();
  plan.household.people.push({ id: "a", name: "Pat", role: "self", birthDate: "1960-07-01" }, { id: "b", name: "Lou", role: "partner", birthDate: "1962-07-01" });
  plan.retirement.socialSecurity = { a: { claimAge: 62, monthlyAtFRA: 3000 }, b: { claimAge: 67, monthlyAtFRA: 1000 } };
  const page = compute(plan, { today: "2026-10-26" });
  assert.ok(page.people.every((person) => "spousalAtSameAge" in person && "survivor" in person));
  const [pat, lou] = page.people;
  assert.equal(pat.monthly, 2100, "62 is 60 months early: 30% less");
  assert.equal(pat.spousalAtSameAge, 450, "a spouse the same age claiming at 62: half, less 25/36 of 1% x 36 months and 5/12 of 1% x 24: 15% of 3,000");
  assert.equal(pat.survivor, 2475, "claimed early: the widow(er)'s limit, 82.5% of 3,000, beats 2,100");
  assert.equal(page.couple.spousal.b, 500, "Lou: half of 3,000 less 1,000 of their own, at full retirement age");
  assert.equal(page.couple.spousal.a, 0);
  assert.equal(page.couple.survivorMonthly.b, 2475, "if Pat dies first Lou keeps the survivor amount");
  assert.equal(page.couple.survivorMonthly.a, 2100, "if Lou dies first Pat keeps their own");
  assert.equal(page.couple.survivorYearly, 2475 * 12);
});
