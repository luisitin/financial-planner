// tools/extract-tax.mjs -- pull the federal income-tax parameters out of the vendored UsTaxes
// (vendor/ustaxes/src/forms/Y<year>/data/federal.ts, AGPL-3.0; numbers are the IRS's own) into
//   modules/taxes/federal/data/federal.js
// Per year and filing status: ordinary brackets and rates, the standard deduction and the extra
// allowance for age or blindness, long-term capital gains brackets, the Social Security benefit
// taxation thresholds, the Social Security wage base, NIIT and additional-Medicare thresholds,
// the child tax credit, the 2025 senior deduction (OBBB), and the child and dependent care credit
// (typed from IRC 21 and 129 for every year, below fixLaw). Years without a UsTaxes folder
// are added by hand below (2026: see the sources over that block). The figures are facts (IRS and
// statute numbers); no UsTaxes code is copied. Sources by year (read 2026-10-31):
//   2024: Rev. Proc. 2023-34. 2025: Rev. Proc. 2024-40, with Pub. L. 119-21 (the 2025 tax law) for the
//   standard deduction ($15,750 / $31,500) and the $2,200 child credit (Rev. Proc. 2025-32 sec. 3.01).
//   Thresholds fixed in law: Social Security benefit taxation IRC 86(c); NIIT IRC 1411(b); additional
//   Medicare IRC 3101(b)(2); child credit phase-out IRC 24(b)(2). Wage base: SSA's yearly taxable maximum.
// Two corrections are applied to every year after reading (fixLaw below): the child credit phase-out
// is $400,000 only on a joint return (a qualifying surviving spouse gets $200,000), and married
// filing separately with no Social Security base amount (spouses who lived together at any time).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATUSES = { S: "single", MFJ: "married_joint", MFS: "married_separate", HOH: "head_of_household", W: "qualifying_surviving" };
const out = {};
for (const year of [2024, 2025]) {
  const file = path.join(ROOT, `vendor/ustaxes/src/forms/Y${year}/data/federal.ts`);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, "utf8");
  const rates = /rates:\s*\[([\d,\s]+)\]/.exec(src)[1].split(",").map((x) => Number(x) / 100);
  const y = { year, rates, status: {}, ltcgRates: [0, 0.15, 0.20], ssTaxation: {}, childTaxCredit: year >= 2025 ? 2200 : 2000, childTaxCreditPhaseOut: { single: 200000, married_joint: 400000, married_separate: 200000, head_of_household: 200000, qualifying_surviving: 200000 } };
  const ordinaryBlock = src.slice(src.indexOf("ordinary: {"), src.indexOf("longTermCapGains: {"));
  const ltcgBlock = src.slice(src.indexOf("longTermCapGains: {"), src.indexOf("export const fica"));
  for (const [code, key] of Object.entries(STATUSES)) {
    const re = new RegExp(`\\[FilingStatus\\.${code}\\]:\\s*\\{\\s*brackets:\\s*\\[([\\d,\\s]+)\\][\\s\\S]*?deductions:\\s*\\[([\\s\\S]*?)\\]\\s*,`);
    const m = re.exec(ordinaryBlock); if (!m) throw new Error(`no ordinary block for ${code} ${year}`);
    const brackets = m[1].split(",").map((x) => Number(x.trim()));
    const amounts = [...m[2].matchAll(/amount:\s*(\d+)/g)].map((a) => Number(a[1]));
    const lt = new RegExp(`\\[FilingStatus\\.${code}\\]:\\s*\\{\\s*brackets:\\s*\\[([\\d,\\s]+)\\]`).exec(ltcgBlock);
    y.status[key] = { brackets, standardDeduction: amounts[0], extraAllowance: amounts.length > 1 ? amounts[1] - amounts[0] : 0, ltcgBrackets: lt ? lt[1].split(",").map((x) => Number(x.trim())) : null };
  }
  const ssWage = /maxIncomeSSTaxApplies:\s*([\d.]+)/.exec(src); y.ssWageBase = ssWage ? Number(ssWage[1]) : null;
  y.niitThreshold = { single: 200000, married_joint: 250000, married_separate: 125000, head_of_household: 200000, qualifying_surviving: 250000 };
  y.additionalChildTaxCredit = 1700;
  y.saltCap = year >= 2025 ? { cap: 40000, floor: 10000, phaseOutStart: 500000, phaseOutRate: 0.3 } : { cap: 10000 };   // OBBB: 40,000 from 2025 (+1% a year), cut 30 cents per dollar of income over 500,000, never below 10,000; MFS halves
  y.additionalMedicareThreshold = { single: 200000, married_joint: 250000, married_separate: 125000, head_of_household: 200000, qualifying_surviving: 200000 };
  const ss = [...src.matchAll(/\[FilingStatus\.(\w+)\]:\s*\{\s*l8:\s*(\d+),\s*l10:\s*(\d+)\s*\}/g)];
  for (const s of ss) y.ssTaxation[STATUSES[s[1]]] = { base: Number(s[2]), extra: Number(s[3]) };   // base: 25,000/32,000; extra: 9,000/12,000 (the second threshold is base + extra)
  const senior = /senior:\s*\{\s*perPerson:\s*(\d+)/.exec(src);
  if (senior) y.seniorDeduction = { perPerson: Number(senior[1]), phaseOutThreshold: { single: 75000, married_joint: 150000, head_of_household: 75000, qualifying_surviving: 75000 }, phaseOutRate: 0.06 };
  out[year] = y;
}
// 2026: brackets, standard deduction, the age-65/blind allowance, capital-gains tops, the $2,200 child credit and
// $1,700 refundable part: IRS Rev. Proc. 2025-32 sec. 4 (October 2025). Wage base $184,500: SSA, October 2025.
// SALT cap $40,400 phasing down 30% over $505,000: IRC 164(b)(7) (Pub. L. 119-21). Senior deduction: IRC 151(f).
// Charity floor and non-itemizer cap: IRC 170(b)(1)(I), 170(p); 37%-bracket limit: IRC 68. Verify against the 1040
// instructions when they appear.
out[2026] = {
  year: 2026, rates: [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37],
  status: {
    single:               { brackets: [12400, 50400, 105700, 201775, 256225, 640600], standardDeduction: 16100, extraAllowance: 2050, ltcgBrackets: [49450, 545500] },
    married_joint:        { brackets: [24800, 100800, 211400, 403550, 512450, 768700], standardDeduction: 32200, extraAllowance: 1650, ltcgBrackets: [98900, 613700] },
    qualifying_surviving: { brackets: [24800, 100800, 211400, 403550, 512450, 768700], standardDeduction: 32200, extraAllowance: 1650, ltcgBrackets: [98900, 613700] },
    married_separate:     { brackets: [12400, 50400, 105700, 201775, 256225, 384350], standardDeduction: 16100, extraAllowance: 1650, ltcgBrackets: [49450, 306850] },
    head_of_household:    { brackets: [17700, 67450, 105700, 201750, 256200, 640600], standardDeduction: 24150, extraAllowance: 2050, ltcgBrackets: [66200, 579600] },
  },
  ltcgRates: [0, 0.15, 0.20], childTaxCredit: 2200, childTaxCreditPhaseOut: { single: 200000, married_joint: 400000, married_separate: 200000, head_of_household: 200000, qualifying_surviving: 200000 },
  additionalChildTaxCredit: 1700, ssWageBase: 184500, saltCap: { cap: 40400, floor: 10000, phaseOutStart: 505000, phaseOutRate: 0.3 },
  niitThreshold: { single: 200000, married_joint: 250000, married_separate: 125000, head_of_household: 200000, qualifying_surviving: 250000 },
  additionalMedicareThreshold: { single: 200000, married_joint: 250000, married_separate: 125000, head_of_household: 200000, qualifying_surviving: 200000 },
  ssTaxation: { single: { base: 25000, extra: 9000 }, married_joint: { base: 32000, extra: 12000 }, married_separate: { base: 0, extra: 0 }, head_of_household: { base: 25000, extra: 9000 }, qualifying_surviving: { base: 25000, extra: 9000 } },
  seniorDeduction: { perPerson: 6000, phaseOutThreshold: { single: 75000, married_joint: 150000, head_of_household: 75000, qualifying_surviving: 75000 }, phaseOutRate: 0.06 },
  // OBBBA from 2026: itemized gifts count above 0.5% of AGI (IRC §170(b)(1)(I)); non-itemizers deduct up to 1,000 / 2,000 joint of cash gifts (§170(p)); itemized deductions cut by 2/37 in the 37% bracket (§68)
  charity: { floorRate: 0.005, nonItemizerCap: { single: 1000, married_joint: 2000, married_separate: 1000, head_of_household: 1000, qualifying_surviving: 1000 } },
  itemizedLimit: { fraction: [2, 37] },
};
// The law over the worksheet figures, every year:
// - IRC 24(b)(2): the child credit starts to phase out at $400,000 on a joint return and $200,000 on any other,
//   a qualifying surviving spouse's included (that status is not a joint return).
// - IRC 86(c)(1)(C)(ii) and (c)(2)(C): married filing separately and living together at any time in the year,
//   the base amounts are zero, so up to 85% of benefits is taxable from the first dollar (the 1040 worksheet's
//   "skip lines 9 through 16"). Spouses who lived apart all year use the single figures; that case is not modelled.
function fixLaw(y) {
  y.childTaxCreditPhaseOut.qualifying_surviving = 200000;
  if (y.ssTaxation.married_separate) y.ssTaxation.married_separate = { base: 0, extra: 0 };
}
for (const y of Object.values(out)) fixLaw(y);
// The child and dependent care credit (IRC 21, Form 2441) and the dependent care benefits exclusion (IRC 129), typed from
// the statute (neither is indexed for inflation; Rev. Proc. 2025-32 has no entry for them). Read 2026-11-02:
//   P.L. 119-21 sec. 70404 (129(a)(2)(A): $5,000 -> $7,500, $2,500 -> $3,750 separately) and sec. 70405 (21(a)(2) rewritten),
//   both "taxable years beginning after December 31, 2025": https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm
//   26 U.S.C. 21 (with the prior text of (a)(2) in its Amendments note) https://uscode.house.gov/us/usc/t26/s21/ and 129
//   https://uscode.house.gov/us/usc/t26/s129/; 2026 Form 2441 instructions (draft, Aug 21 2026) "2026 Phaseout Schedule"
//   https://www.irs.gov/pub/irs-dft/i2441--dft.pdf; 2025 Form 2441 line 8 table https://www.irs.gov/pub/irs-pdf/f2441.pdf.
// expenseLimit: 21(c), $3,000 for one qualifying person, $6,000 for two or more (both years). startPct and phaseDowns:
// 21(a)(2) in percentage points: each phase takes 1 point off for each `per` dollars (or fraction) of AGI over `over`, not
// below `floorPct`; `joint` replaces over/per on a joint return. To 2025 (the text in force since P.L. 107-16, 2021 aside):
// 35 down to 20 over $15,000. From 2026: 50 down to 35 over $15,000, then down to 20 over $75,000 by $2,000 ($150,000 by
// $4,000 joint). benefitLimit / benefitLimitSeparate: 129(a)(2)(A), Form 2441 line 21.
const CARE_PRIOR = { expenseLimit: { one: 3000, twoOrMore: 6000 }, startPct: 35, phaseDowns: [{ over: 15000, per: 2000, floorPct: 20 }], benefitLimit: 5000, benefitLimitSeparate: 2500 };
const CARE_2026 = { expenseLimit: { one: 3000, twoOrMore: 6000 }, startPct: 50, phaseDowns: [{ over: 15000, per: 2000, floorPct: 35 }, { over: 75000, per: 2000, floorPct: 20, joint: { over: 150000, per: 4000 } }], benefitLimit: 7500, benefitLimitSeparate: 3750 };
for (const y of Object.values(out)) y.careCredit = y.year >= 2026 ? CARE_2026 : CARE_PRIOR;
const file = path.join(ROOT, "modules/taxes/federal/data/federal.js");
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, `// Generated by tools/extract-tax.mjs: 2024 and 2025 read from vendor/ustaxes (UsTaxes, AGPL-3.0; only the\n// figures, which are IRS numbers: Rev. Procs. 2023-34 and 2024-40, with Pub. L. 119-21 for 2025), 2026 typed from\n// IRS Rev. Proc. 2025-32 sec. 4, SSA's wage base and the statute (sources in the tool). The tool also applies\n// IRC 24(b)(2) and 86(c) for a surviving spouse's child credit and separate filers' Social Security. Do not edit by\n// hand; re-run the tool.\n// Per year: ordinary rates and bracket tops by filing status, the standard deduction and the extra\n// allowance for age 65+ or blindness, long-term capital gains bracket tops, Social Security benefit\n// taxation thresholds (base = where up to half becomes taxable; base + extra = where up to 85% does),\n// the Social Security wage base, NIIT and additional-Medicare thresholds, the child tax credit, and\n// the 2025-2028 senior deduction (joint and unmarried returns only), from 2026 the charity rules and\n// the limit on itemized deductions in the 37% bracket, and the child and dependent care credit (IRC 21; the\n// dependent care benefits limit of IRC 129), typed from the statute every year (sources in the tool).\nexport const FEDERAL = ${JSON.stringify(out, null, 1)};\nexport const TAX_YEARS = Object.keys(FEDERAL).map(Number);\n`);
console.log("wrote", file, "years", Object.keys(out).join(", "));
