// modules/taxes/projection/compute.js -- PURE. Federal tax in every year of the retirement
// plan, through the brackets: what is taxed each year (pensions, pay, withdrawals, the taxable
// part of Social Security, gains and dividends), the bracket the year ends in, the tax and
// the rate; totals in today's dollars; the years that hurt most; and how the flat-rate
// setting compares. And the state's income tax in each of those years, from the state's own brackets and its rules for
// retirement income, for a state the app has them for (core/math/state-tax.js, gap design #40).
import { project } from "../../../core/math/retirement.js";
import { federalTax, largestAtOrUnder } from "../../../core/math/tax.js";
import { stateIncomeTax, hasRules, stateNames } from "../../../core/math/state-tax.js";
import { buildInputs, taxSettings, noYearsWhy, retirementUnknown } from "../../retirement/projection/compute.js";
import { medicareLine, medicareYears, marketplaceLines } from "../../retirement/roth-conversions/ceiling.js";
import { STATE_NAMES } from "../state/compute.js";
import { TAX_YEARS } from "../federal/data/federal.js";

// noYearsWhy lives with the projection since round 7 (buildInputs uses it); kept importable from here
export { noYearsWhy };
// the states worked out from their own rules, for the page's words (the view does not read the state table itself)
export { stateNames };

/**
 * compute(plan, { today, real, stateBrackets }) -> {
 *   ready, missing, rows: [{ year, ages, retired, ordinary, qualified, socialSecurity, taxableSocialSecurity, taxableIncome, deduction, bracketRate, taxes, effectiveRate, conversion, rmd, withdrawnDeferred, priceLevel }] (retired years; money real unless real=false),
 *   totals: { taxes, ordinary, socialSecurity, taxableSocialSecurity, conversions, rmd }, average (yearly tax), peak: { year, taxes, why }, byBracket: [{ rate, years }],
 *   flatTaxes (what the flat setting would charge over the same years), bracketsOn, notes, people, filingStatus, firstZero (years with no tax),
 *   noYears ({ why, check }: why the plan has no retirement year to tax and what to check on People, when `rows` is empty; else null),
 *   and only for a state with rules in core/math/state-tax.js (else these keys are absent and the answer is what it was):
 *   rows[].state (that year's state income tax), totals.state, state: { code, name, none, total, average, zeroYears, rules,
 *   yearWords, indexed, local }
 *   and only with `gains: true` (the page asks; every other caller gets the answer of before, byte for byte): gains, the
 *   long-term gain each year could take at the 0% rate (gainsRoom below; null when no retirement year starts with money in
 *   taxable accounts)
 * }
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  // everyone past the age the plan runs to: buildInputs has no year to run and says why (`noYears`, round 7)
  if (!b.inputs) return { ready: false, missing: b.missing, notes: b.notes, rows: [], noYears: b.noYears ?? null };
  const real = params.real !== false;
  const tax = taxSettings(plan, { mode: "brackets" });
  const r = project({ ...b.inputs, tax });
  const flat = project({ ...b.inputs, tax: { mode: "flat" } });
  const k = (row, n) => real ? n / row.priceLevel : n;
  const code = String(plan.household?.state ?? "").toUpperCase();
  const withState = params.stateBrackets !== false && hasRules(code);   // `stateBrackets: false`: the answer before gap #40 (tests)
  const rows = r.rows.filter((x) => x.retired).map((x) => {
    const i = x.taxInfo ?? {};
    const row = { year: x.year, ages: x.ages, retired: x.retired, ordinary: k(x, i.ordinary ?? 0), qualified: k(x, i.qualified ?? 0), socialSecurity: k(x, i.socialSecurity ?? 0), taxableSocialSecurity: k(x, i.taxableSocialSecurity ?? 0), taxableIncome: k(x, i.taxableIncome ?? 0), deduction: k(x, i.deduction ?? 0), bracketRate: i.bracketRate ?? null, taxes: k(x, x.taxes), effectiveRate: i.effectiveRate ?? 0, conversion: k(x, x.conversion), rmd: k(x, x.rmd), withdrawnDeferred: k(x, x.withdrawn.deferred), priceLevel: x.priceLevel };
    if (withState) row.state = k(x, stateYear(code, x, { inputs: b.inputs, status: tax.filingStatus, levelAt: levelAt(r.rows) }).tax);
    return row;
  });
  const sum = (f) => rows.reduce((s, x) => s + f(x), 0);
  const totals = { taxes: sum((x) => x.taxes), ordinary: sum((x) => x.ordinary), socialSecurity: sum((x) => x.socialSecurity), taxableSocialSecurity: sum((x) => x.taxableSocialSecurity), conversions: sum((x) => x.conversion), rmd: sum((x) => x.rmd), qualified: sum((x) => x.qualified) };
  let state;
  if (withState) {
    totals.state = sum((x) => x.state);
    const first = rows[0] ? stateYear(code, r.rows.find((x) => x.year === rows[0].year), { inputs: b.inputs, status: tax.filingStatus, levelAt: levelAt(r.rows) }) : stateIncomeTax(code, { year: b.inputs.startYear, status: tax.filingStatus });
    state = { code, name: first.name, none: first.none, total: totals.state, average: rows.length ? totals.state / rows.length : 0, zeroYears: rows.filter((x) => x.state < 1).length,
      rules: first.rules, yearWords: stateIncomeTax(code, { year: b.inputs.startYear, status: tax.filingStatus })?.yearWords ?? null, indexed: first.indexed, local: LOCAL[code] ?? null };
  }
  const peak = rows.reduce((a, x) => x.taxes > (a?.taxes ?? -1) ? x : a, null);
  const peakWhy = peak ? peak.conversion > 0 ? "a Roth conversion" : peak.rmd > 0 && peak.rmd >= peak.withdrawnDeferred * 0.9 ? "required withdrawals" : peak.withdrawnDeferred > 0 ? "pre-tax withdrawals" : "income" : "";
  const byBracketMap = new Map();
  for (const x of rows) if (x.bracketRate !== null) byBracketMap.set(x.bracketRate, (byBracketMap.get(x.bracketRate) ?? 0) + 1);
  const byBracket = [...byBracketMap.entries()].sort((a, b) => a[0] - b[0]).map(([rate, years]) => ({ rate, years }));
  const flatTaxes = flat.rows.filter((x) => x.retired).reduce((s, x) => s + (real ? x.taxes / x.priceLevel : x.taxes), 0);
  const notes = [...b.notes];
  if ((plan.retirement?.taxMode ?? "flat") !== "brackets") notes.push(`The projection pages still use the flat ${Math.round((plan.retirement?.taxRate ?? 0.15) * 100)}% setting, which comes to $${Math.round(flatTaxes).toLocaleString("en-US")} over the same years; switch Will the money last? to the federal brackets to use these figures.`);
  return { ready: true, missing: [], rows, totals, ...(withState ? { state } : {}), average: rows.length ? totals.taxes / rows.length : 0, peak: peak ? { year: peak.year, taxes: peak.taxes, why: peakWhy } : null, byBracket, flatTaxes, bracketsOn: (plan.retirement?.taxMode ?? "flat") === "brackets", notes, people: b.people, filingStatus: tax.filingStatus, zeroYears: rows.filter((x) => x.taxes < 1).length, real, retireYear: b.inputs.retireYear, success: r.success, failYear: r.failYear,
    noYears: rows.length ? null : noYearsWhy(b.people, b.inputs.startYear ?? (params.today ? Number(String(params.today).slice(0, 4)) : null)),
    ...(params.gains === true ? { gains: gainsRoom(plan, { run: r, inputs: b.inputs, tax, real, code, withState, today: params.today ?? null }) } : {}),
    // nothing saved for retirement and nothing going in: Will the money last?'s "We don't know yet", never "The money runs out in
    // 2067" (whole-app sweep x3, 2026-11-16); absent for every other plan
    ...(r.success ? {} : unknownOf(plan, params)) };
}
const unknownOf = (plan, params) => { const u = retirementUnknown(plan, { today: params.today ?? null }); return u ? { unknown: u } : {}; };

// ---- gains at the 0% rate, year by year (gap list, next 60, item 25) ------------------------------------------------------------
/** The top of the 0% band for long-term gains for a status in a year's params (taxable income up to it: Rev. Proc. 2025-32 sec. 4.03). */
export const zeroTop = (status, params) => (params.status[status] ?? params.status.single).ltcgBrackets?.[0] ?? 0;

/**
 * The most long-term gain one year's return could take at the 0% rate (IRC 1(h)(1)(B), 1(j)(5)): the largest g with taxable
 * income, with g more of qualified income, at or under the year's 0% top. Gains stack on top of ordinary income, so the line is
 * taxable income as a whole (Qualified Dividends and Capital Gain Tax Worksheet); g also raises the taxed part of Social Security
 * (IRC 86) and, in 2025-2028, can shrink the senior deduction, and both raise taxable income too, so the line is found by search
 * (core/math/tax.js largestAtOrUnder), not by subtraction. inputs: the year's federalTax inputs. -> { room (whole dollars, rounded
 * down), top, before, after } (before / after: federalTax without and with the room; after is before when there is no room)
 */
export function zeroRoom(inputs, params) {
  const status = params.status[inputs.filingStatus] ? inputs.filingStatus : "single";
  const top = zeroTop(status, params);
  const q = Math.max(0, Number(inputs.qualifiedIncome) || 0);
  const at = (g) => federalTax({ ...inputs, qualifiedIncome: q + g }, params);
  const before = at(0);
  const over = (g) => at(g).taxableIncome - top;
  const f0 = before.taxableIncome - top;
  if (f0 >= 0) return { room: 0, top, before, after: before };
  // past the deduction, taxable income rises at least $1 for each $1 of gain, so the line is crossed by top + the deduction + 1
  let hi = top + before.deduction.amount + 1, fhi = over(hi);
  while (fhi <= 0 && hi < 1e12) { hi = hi * 2 + 1; fhi = over(hi); }
  const room = Math.max(0, Math.floor(largestAtOrUnder(over, 0, f0, hi, fhi, 1e-4, 1e-7) + 1e-6));
  return { room, top, before, after: room > 0 ? at(room) : before };
}

/**
 * The most long-term gain that keeps a year's adjusted gross income at or under `line` (Medicare's first surcharge line, in that
 * year's dollars): a gain raises AGI by itself and by the Social Security it pulls into tax, so this is a search too. Whole
 * dollars, rounded down; 0 when the year is already at or over the line.
 */
export function agiRoom(inputs, params, line) {
  const q = Math.max(0, Number(inputs.qualifiedIncome) || 0);
  const over = (g) => federalTax({ ...inputs, qualifiedIncome: q + g }, params).agi - line;
  const f0 = over(0);
  if (f0 >= 0) return 0;
  let hi = -f0 + 1, fhi = over(hi);   // AGI rises at least $1 for each $1 of gain
  while (fhi <= 0 && hi < 1e12) { hi = hi * 2 + 1; fhi = over(hi); }
  return Math.max(0, Math.floor(largestAtOrUnder(over, 0, f0, hi, fhi, 1e-4, 1e-7) + 1e-6));
}

/** Why a gain adds federal tax in some years (["ss", "senior", "niit"], in that order): more Social Security taxed, a smaller
 * senior deduction, the 3.8% tax on investment income; ["ss"] when none reaches $1 (a rounding cent). */
const causes = (list) => {
  const c = [["ss", "ssMore"], ["senior", "seniorLost"], ["niit", "niitMore"]].filter(([, f]) => list.some((v) => v[f] >= 1)).map(([c]) => c);
  return c.length ? c : ["ss"];
};

/**
 * gainsRoom(plan, { run, inputs, tax, real, code, withState, today }) -> null (no retirement year starts with money in
 * taxable accounts, or the plan counts no gain in them: nothing to take) | {
 *   line: { year, top }                 the 0% top for the plan's status in the newest year of the federal table (2026)
 *   years: [{ year, ages, room, before (taxable income without the gain), after (with all the room), top, ssMore (Social Security the room pulls into tax),
 *            seniorLost (of the 2025-2028 deduction for people 65 and over, which shrinks past $75,000 / $150,000 of AGI),
 *            niitMore (the 3.8% tax on investment income the room brings in: its $200,000 / $250,000 line does not rise with
 *            prices, so the plan's later years can pass it inside the 0% band), extraTax (the federal tax those three add: the
 *            gain itself is at 0%), state? (state income tax the room adds), cliffRoom? (a marketplace year: gain
 *            before the income passes the line where the help stops; Infinity under rules with no line), medicare? (a year whose
 *            income sets a Medicare premium two years later: { over (past the surcharge's first line with all the room taken),
 *            room (when over: the gain that keeps it under, agiRoom) } }]
 *                                       every retirement year that starts with money in taxable accounts, in date order
 *   next                                the years with room ($1 or more), in date order (the page shows the first five)
 *   total (the room of all those years together), roomYears, overYears, over (the years at the line, under $1 of room, or past it),
 *   first (the first year listed)
 *   held: { year, amount, share }       the gain the plan counts in taxable accounts as the first listed year starts
 *                                       (`retirement.gainShare` of what they hold, as the engine taxes a sale)
 *   taken: [{ year, amount, extraTax, ssMore, seniorLost, niitMore, state?, medicareOver? }]
 *                                       that gain taken in date order, each year up to its room (all the room when it never
 *                                       adds up to the gain): what the costs below are worked on, never more than the plan holds;
 *                                       each with what taking that amount adds, as a year's own figures say it for all its room
 *   coverYear                           the last year of taken when it holds the whole gain (null: all the room is less than it)
 *   extra: { years, tax, why: ["ss" | "senior" | "niit"] } | null   taken years where it adds federal tax, the tax over them, and why
 *   marketplace: { years, cliff (today's dollars, the first year's) | null } | null   taken years with marketplace cover
 *   medicare: { years, line (today's dollars), over: [years] } | null   taken years whose income sets a premium two years later,
 *                                       and those whose income with what is taken passes the surcharge's first line
 *   state: { code, name, total } (a state with rules that taxes what is taken) | { counted: false, name | null } (no rules here) | null
 * }
 * Money in today's dollars unless real is false. Nothing here enters the plan or the engine: the run is the plan's own, the room
 * is worked on each of its years alone (taking it does not change the plan's later years: shares sold and bought back).
 */
function gainsRoom(plan, { run, inputs, tax, real, code, withState, today }) {
  const people = inputs.people ?? [];
  const k = (x, n) => (real ? n / x.priceLevel : n);
  const status = tax.filingStatus;
  const share = Math.max(0, Math.min(1, Number(tax.gainShare ?? 0.5)));
  const medicareSet = new Set(medicareYears(inputs));
  const mLine = medicareLine(status);
  const years = [];
  let cliffs = null, noCliff = false;   // the marketplace's line by year (retirement/healthcare's), when a listed year has it
  run.rows.forEach((x, idx) => {
    if (!x.retired || !x.taxInfo) return;
    const startTaxable = idx > 0 ? run.rows[idx - 1].balances.taxable : Number(inputs.balances?.taxable) || 0;
    if (!(startTaxable > 0.5)) return;   // nothing in taxable accounts as the year starts: no shares to sell
    const i = x.taxInfo, params = tax.paramsFor(x.year);
    const ages65plus = people.slice(0, 2).filter((p, n) => x.ages[n] >= 65).length;
    // the year's return as core/math/retirement.js works it (its taxFor), so `before` is the engine's own taxable income
    const yin = { filingStatus: status, otherOrdinary: i.ordinary, qualifiedIncome: i.qualified, socialSecurity: i.socialSecurity, itemized: tax.itemized ?? 0, ages65plus };
    const z = zeroRoom(yin, params);
    const ssMore = z.after.income.taxableSocialSecurity - z.before.income.taxableSocialSecurity;
    const seniorLost = (z.before.deduction.senior ?? 0) - (z.after.deduction.senior ?? 0);
    const niitMore = (z.after.niit ?? 0) - (z.before.niit ?? 0);
    const y = { year: x.year, ages: x.ages, room: k(x, z.room), before: k(x, z.before.taxableIncome), after: k(x, z.after.taxableIncome), top: k(x, z.top), ssMore: k(x, ssMore), seniorLost: k(x, seniorLost), niitMore: k(x, niitMore), extraTax: k(x, Math.max(0, z.after.totalTax - z.before.totalTax)), startTaxable: k(x, startTaxable), x, z, yin, params };
    if (withState && z.room > 0) {
      y.sctx = { inputs, status, levelAt: levelAt(run.rows) };
      y.stateBase = stateYear(code, x, y.sctx).tax;
      const after = stateYear(code, { ...x, taxInfo: { ...i, qualified: i.qualified + z.room, taxableSocialSecurity: z.after.income.taxableSocialSecurity } }, y.sctx).tax;
      y.state = k(x, Math.max(0, after - y.stateBase));
    }
    // Medicare's surcharge is set by the return of two years before (the Medicare page's line, today's dollars, times this
    // year's prices, as roth-conversions/ceiling.js holds it): with all the room taken, is this year's income past it?
    if (z.room > 0 && medicareSet.has(x.year)) {
      const over = z.after.agi > mLine * x.priceLevel;
      y.medicare = over ? { over, room: k(x, agiRoom(yin, params, mLine * x.priceLevel)) } : { over };
    }
    years.push(y);
  });
  if (!years.length) return null;
  // the marketplace years (retirement/healthcare's own: before 65, nobody at work), only when a listed year can have them
  const under65 = years.some((y) => y.room > 0 && people.some((p, n) => y.ages[n] < 65 && y.ages[n] <= (p.endAge ?? Infinity)));
  if (under65 && status !== "married_separate") {
    const mk = marketplaceLines(plan, inputs, { today });
    if (!mk.separate) {
      cliffs = new Map(mk.years.map((m) => [m.year, mk.noCliff ? Infinity : m.cliff]));
      noCliff = !!mk.noCliff;
      for (const y of years) {
        if (!(y.room > 0) || !cliffs.has(y.year)) continue;
        const cliff = cliffs.get(y.year);
        // the marketplace's income: AGI plus the untaxed part of Social Security (26 USC 36B(d)(2)(B)); a gain raises it $1 for $1
        const magi = y.z.before.agi + Math.max(0, y.x.taxInfo.socialSecurity - y.z.before.income.taxableSocialSecurity);
        if (cliff === Infinity) { y.cliffRoom = Infinity; continue; }
        if (!(cliff > 0) || magi > cliff * y.x.priceLevel) continue;   // past the line already: no help left to lose that year
        y.cliffRoom = k(y.x, cliff * y.x.priceLevel - magi);
      }
    }
  }
  const withRoom = years.filter((y) => y.room >= 1);
  const over = years.filter((y) => y.room < 1);   // at the line (under $1 of room: "at or past the line") or past it
  const total = withRoom.reduce((s, y) => s + y.room, 0);
  const first = years[0];
  const held = share > 0 && first.startTaxable * share >= 1 ? { year: first.year, amount: first.startTaxable * share, share } : null;
  if (!held) return null;   // the plan counts no gain in its taxable accounts (gain share 0): nothing to take at 0%
  // The gain the plan holds, taken in date order, each year up to its room (critics M1, M2 2026-11-15: all the room summed over
  // the plan is not gain anyone has). What it costs is worked on what is taken, never on room the plan has no gain for.
  let left = held.amount;
  const taken = [];
  for (const y of withRoom) {
    if (left <= 0.5) break;
    const u = Math.min(y.room, left);
    left -= u;
    const g = u >= y.room ? y.z.room : (real ? u * y.x.priceLevel : u);   // the year's own dollars
    const a = g >= y.z.room ? y.z.after : federalTax({ ...y.yin, qualifiedIncome: Math.max(0, Number(y.yin.qualifiedIncome) || 0) + g }, y.params);
    const t = { y, year: y.year, amount: u, extraTax: k(y.x, Math.max(0, a.totalTax - y.z.before.totalTax)),
      ssMore: k(y.x, a.income.taxableSocialSecurity - y.z.before.income.taxableSocialSecurity), seniorLost: k(y.x, (y.z.before.deduction.senior ?? 0) - (a.deduction.senior ?? 0)),
      niitMore: k(y.x, (a.niit ?? 0) - (y.z.before.niit ?? 0)) };
    if (y.sctx) {
      const i = y.x.taxInfo;
      t.state = k(y.x, Math.max(0, stateYear(code, { ...y.x, taxInfo: { ...i, qualified: i.qualified + g, taxableSocialSecurity: a.income.taxableSocialSecurity } }, y.sctx).tax - y.stateBase));
    }
    if (medicareSet.has(y.year)) t.medicareOver = a.agi > mLine * y.x.priceLevel;
    taken.push(t);
  }
  const coverYear = left <= 0.5 && taken.length ? taken.at(-1).year : null;
  const extraYears = taken.filter((t) => t.extraTax >= 1);
  const mcYears = taken.filter((t) => t.medicareOver !== undefined);
  const mkYears = taken.filter((t) => t.y.cliffRoom !== undefined);
  let state = null;
  if (withState) {
    const t = taken.reduce((s, v) => s + (v.state ?? 0), 0);
    if (t >= 1) state = { code, name: stateIncomeTax(code, { year: first.year, status })?.name ?? stateNameOf(code), total: t };
  } else if (!hasRules(code)) state = { counted: false, name: stateNameOf(code) };
  const clean = (y) => { const { x, z, yin, params, sctx, stateBase, startTaxable, ...rest } = y; return rest; };
  const listed = years.map(clean);
  const byYear = new Map(listed.map((y) => [y.year, y]));
  return {
    line: { year: LINE_YEAR, top: zeroTop(status, tax.paramsFor(LINE_YEAR)) },
    years: listed,
    next: withRoom.map((y) => byYear.get(y.year)),
    total, roomYears: withRoom.length, overYears: over.length, over: over.map((y) => y.year), first: first.year,
    // each year taken also carries what taking that amount adds (fix round r2: a year's line said what all its room would cost,
    // also when the plan's gain used only part of it); the same figures `extra`, `state` and `medicare` sum below
    held, taken: taken.map((t) => ({ year: t.year, amount: t.amount, extraTax: t.extraTax, ssMore: t.ssMore, seniorLost: t.seniorLost, niitMore: t.niitMore,
      ...(t.state !== undefined ? { state: t.state } : {}), ...(t.medicareOver !== undefined ? { medicareOver: t.medicareOver } : {}) })), coverYear,
    extra: extraYears.length ? { years: extraYears.map((t) => t.year), tax: extraYears.reduce((s, t) => s + t.extraTax, 0), why: causes(extraYears) } : null,
    marketplace: mkYears.length ? { years: mkYears.map((t) => t.year), cliff: noCliff ? null : cliffs.get(mkYears[0].year) } : null,
    medicare: mcYears.length ? { years: mcYears.map((t) => t.year), line: mLine, over: mcYears.filter((t) => t.medicareOver).map((t) => t.year) } : null,
    state,
  };
}
// ---- the words of "Gains you could take tax-free" (R5: one written sentence per case, each with a test) --------------------
/** The part's fixed title (pinned in qa/first-view-lib.mjs PINNED_TITLES, with its reason). */
export const GAINS_TITLE = "Gains you could take tax-free";
/** The years a sentence names: "2027", "2027 and 2028", "2027 to 2029", "4 years from 2027 to 2033". */
const span = (ys) => (ys.length === 2 ? `${ys[0]} and ${ys[1]}` : ys.length > 1 ? (ys.at(-1) - ys[0] === ys.length - 1 ? `${ys[0]} to ${ys.at(-1)}` : `${ys.length} years from ${ys[0]} to ${ys.at(-1)}`) : String(ys[0]));
/** Why taking the gain adds federal tax, inside "Taking the profit in 2031 also ...": more of the benefit taxed (IRC 86), the 2025-2028
 * deduction for people 65 and over shrinking with income (6% of AGI past $75,000, $150,000 joint), the 3.8% tax on investment
 * income (IRC 1411: past $200,000 of AGI, $250,000 joint, never raised with prices), joined with "and". */
const WHY = { ss: "makes more of your Social Security taxed", senior: "shrinks the extra deduction for people 65 and over", niit: "brings in the 3.8% tax on investment income" };
/** The same causes on a year's line: "on Social Security", "a smaller deduction for 65 and over", "the 3.8% tax on investment income". */
const WHY_LINE = { senior: "a smaller deduction for 65 and over", niit: "the 3.8% tax on investment income" };
const shareWords = (s) => (Math.abs(s - 0.5) < 1e-9 ? "about half" : Math.abs(s - 1) < 1e-9 ? "all" : `about ${Math.round(s * 100)}%`);
/** Extra tax under this is not worth a line on a phone (critic P7, 2026-11-15: "$5 more tax" beside $68,642 reads as noise). */
export const GAINS_SMALL = 50;
/** The status beside the title (20 characters at most): the years with room. */
export const gainsStatus = (g) => (g.roomYears > 1 ? `${g.roomYears} years with room` : g.roomYears === 1 ? "1 year with room" : "no room");
/**
 * Every sentence of the part, for compute's `gains` and the page's money formatter: { intro, held, label, total, over, buys,
 * watch: [sentence], note }. "" (or []) where a case says nothing. No sum of the room over the years is said: the plan's gain
 * is (critics M1, P1 2026-11-15); what to watch is worked on that gain, taken in the years named.
 */
export function gainsWords(g, money) {
  const first = g.next.length ? g.next[0].year : null;
  const intro = `Federal tax on the profit from shares held more than a year is 0% while your taxable income stays under ${money(g.line.top)} (the ${g.line.year} line, rising with prices). What is left under that line in a year is its room.`;
  let held = "";
  if (g.roomYears && g.held) {
    const counts = `We assume ${shareWords(g.held.share)} of what your taxable accounts hold is profit: about ${money(g.held.amount)} in ${g.held.year}.`;
    held = g.coverYear === null ? `${counts} All the room in your retirement, about ${money(g.total)}, would cover only part of it.`
      : g.coverYear === first ? `${counts} The room in ${first} alone would cover it.` : `${counts} The room from ${first} to ${g.coverYear} would cover it.`;
  }
  const label = g.roomYears > 5 ? "The next 5 years with room:" : g.roomYears > 1 ? "The years with room:" : "";
  const total = g.roomYears > 1 ? "" : g.roomYears === 1 ? `${first} is the only year with room.`
    : "No year of your retirement has room: in each one your taxable income is already at or past the line.";
  const over = !g.roomYears || !g.overYears ? "" : g.overYears > 1 ? `In ${g.overYears} other years your taxable income is already at or past the line.` : `In ${g.over[0]} your taxable income is already at or past the line.`;
  const buys = g.roomYears ? "Selling shares in a year with room and buying them back raises what they count as having cost, so less is taxed when you sell them later. The 30-day wait on buying back is only for shares sold at a loss; ask a tax preparer before you count on it." : "";
  const watch = [];
  if (g.roomYears) {
    if (g.extra && g.extra.tax >= GAINS_SMALL) watch.push(`Taking the profit in ${span(g.extra.years)} also ${g.extra.why.map((c) => WHY[c]).join(" and ")}: about ${money(g.extra.tax)} more federal tax${g.extra.years.length > 1 ? " in all" : ""}.`);
    if (g.marketplace) watch.push(g.marketplace.cliff
      ? `In ${span(g.marketplace.years)} you buy marketplace health insurance: the gain counts as income for its help, which shrinks with each dollar and stops once your income passes about ${money(g.marketplace.cliff)} in today's dollars.`
      : `In ${span(g.marketplace.years)} you buy marketplace health insurance: the gain counts as income for its help, which shrinks with each dollar.`);
    if (g.medicare?.over.length) watch.push(`Taking the profit in ${span(g.medicare.over)} would also pass the line where Medicare premiums go up two years later (${money(g.medicare.line)} in today's dollars).`);
    if (g.state?.counted === false) watch.push(g.state.name ? `${g.state.name} income tax on these gains is not counted.` : "State income tax on these gains is not counted.");
    else if (g.state && g.state.total >= 1) watch.push(`${g.state.name} taxes the profit as income: about ${money(g.state.total)}.`);
  }
  return { intro, held, label, total, over, buys, watch, note: "Nothing here changes your plan." };
}
/** One listed year's second line: what taking all its room would also cost, "" when nothing worth saying ("$1,100 more tax on
 * Social Security"); amounts under GAINS_SMALL are left out. */
export function gainsYearLine(y, money, stateName = null) {
  const out = [];
  if (y.extraTax >= GAINS_SMALL) {
    const c = causes([y]), rest = c.filter((x) => x !== "ss").map((x) => WHY_LINE[x]);
    out.push(c[0] === "ss" ? `${money(y.extraTax)} more tax on Social Security${rest.length ? ` and ${rest.join(" and ")}` : ""}` : `${money(y.extraTax)} more tax: ${rest.join(" and ")}`);
  }
  if (y.state >= GAINS_SMALL && stateName) out.push(`${money(y.state)} ${stateName} tax`);
  if (Number.isFinite(y.cliffRoom) && y.cliffRoom < y.room) out.push(`marketplace help stops past ${money(y.cliffRoom)}`);
  if (y.medicare?.over) out.push(`Medicare premiums go up past ${money(y.medicare.room)}`);
  return out.join(" · ");
}

/**
 * One listed year's line beside its room, by what the plan's own gain does that year (fix round r2: with less gain than room,
 * each year listed the whole room and what taking all of it costs, which read as if more could be taken than there is).
 * y: a year of `next`; taken: its entry of `taken`, or undefined when the gain is used up before it; rest: an earlier year
 * already takes part of the gain (what is left of it is taken here). Said as what would happen if the profit were taken this
 * way (a person critic of r2, P4: "your profit uses $60,000 of it" beside a year by year table showing $2,400 of gains read as
 * a contradiction, and "used up by then" was vague):
 *   all its room used  -> gainsYearLine(y), as before
 *   part of it used    -> "taking all your profit would use $19,645 of it" ("the rest of your profit would use $29,025 of it"
 *                         after an earlier year), then what taking that much adds (the same fragments, on what is taken)
 *   none of it used    -> "you would already have taken all your profit by then"
 */
export function gainsUseLine(y, taken, money, stateName = null, { rest = false } = {}) {
  if (!taken) return "you would already have taken all your profit by then";
  if (taken.amount >= y.room - 0.5) return gainsYearLine(y, money, stateName);
  const part = { room: taken.amount, extraTax: taken.extraTax, ssMore: taken.ssMore, seniorLost: taken.seniorLost, niitMore: taken.niitMore, state: taken.state, cliffRoom: y.cliffRoom,
    medicare: taken.medicareOver === undefined ? undefined : { over: taken.medicareOver, room: y.medicare?.room } };
  return [`${rest ? "the rest of your profit" : "taking all your profit"} would use ${money(taken.amount)} of it`, gainsYearLine(part, money, stateName)].filter(Boolean).join(" \u00b7 ");
}

/** The newest year of the federal table: the 0% line the page quotes ("the 2026 line, rising with prices"); later years are it
 * raised with the plan's inflation (paramsFor), as every bracket on this page. */
const LINE_YEAR = Math.max(...TAX_YEARS);

/** What the state figure leaves out that a reader there would expect (named under "How this is worked out": "... are not counted"). */
const LOCAL = { NY: "New York City's and Yonkers' own income taxes", NJ: "New Jersey's property tax deduction and credit for your home" };

/** The price level of the year the state's figures are for (a state that raises them with prices has them times the rise since). */
const levelAt = (rows) => (year) => rows.find((x) => x.year === year)?.priceLevel ?? (rows.length && year < rows[0].year ? rows[0].priceLevel : null);

/**
 * One projected year's state income tax (in that year's dollars) from the engine's row: federal AGI is the year's ordinary
 * income (pensions, a partner's pay, pre-tax withdrawals, conversions), its gains and dividends and the taxed part of Social
 * Security, as the federal tax has it; the pensions are the projection's pension lines paid that year, as the engine pays
 * them (core/math/retirement.js step 2); the withdrawals are the pre-tax money taken out (required withdrawals included);
 * the ages are the first two people's. The earned income is the pay lines paid that year (a partner still working), the
 * same way; the investment income is the year's gains and dividends (Georgia and New Jersey leave some of these out from 62);
 * the rent is the taxed rent lines paid that year (a place on Rental analysis after its running costs, as the engine taxes
 * it; Georgia's retirement exclusion counts rent).
 * A state that raises its figures with prices has them raised by the plan's inflation since the figures' year.
 * -> stateIncomeTax(...) (never null here: the caller asks only for a state with rules)
 */
export function stateYear(code, x, { inputs, status, levelAt: at }) {
  const i = x?.taxInfo ?? {};
  const paid = { pension: 0, pay: 0, rental: 0 };
  for (const inc of inputs.incomes ?? []) {
    if (!(inc.type in paid) || inc.taxable === false) continue;
    const age = x.ages[inc.personIndex ?? 0];
    if (age < inc.startAge || (inc.endAge !== undefined && inc.endAge !== null && age > inc.endAge)) continue;
    if ((inc.fromYear !== undefined && inc.fromYear !== null && x.year < inc.fromYear) || (inc.untilYear !== undefined && inc.untilYear !== null && x.year > inc.untilYear)) continue;
    paid[inc.type] += inc.yearly * (inc.cola === false ? 1 : x.priceLevel);
  }
  const figures = stateIncomeTax(code, { year: x.year, status })?.figuresYear ?? x.year;
  const base = at(figures);
  const scale = x.year > figures && base ? x.priceLevel / base : 1;
  return stateIncomeTax(code, { year: x.year, status, agi: (i.ordinary ?? 0) + (i.qualified ?? 0) + (i.taxableSocialSecurity ?? 0), taxableSocialSecurity: i.taxableSocialSecurity ?? 0,
    pensions: paid.pension, withdrawals: x.withdrawn?.deferred ?? 0, conversions: x.conversion ?? 0, investment: i.qualified ?? 0, earned: paid.pay, rental: paid.rental, ages: x.ages.slice(0, 2), dependents: 0, scale });
}

/** The name of a state the plan names (the State tax page's list), or null: for the words about a state outside the table. */
export const stateNameOf = (code) => STATE_NAMES[String(code ?? "").toUpperCase()] ?? null;

/**
 * The page's one sentence on the state (R5: one written sentence per case). `s` is compute's `state` (absent: the app has no
 * rules for the state, or none is chosen), `money` the page's formatter, `one` true for a single retirement year, `outside`
 * the name of the plan's state when the app has no rules for it ("Massachusetts income tax is not counted yet.").
 */
export function stateLine(s, money, one = false, outside = null) {
  if (!s) return outside ? `${outside} income tax is not counted yet.` : "State tax is not included.";
  if (s.none && s.code === "WA") return "Washington has no income tax on this; its tax on large capital gains is not counted.";
  if (s.none) return `${s.name} has no state income tax.`;
  if (s.total < 1) return `${s.name} takes no income tax from this retirement income.`;
  return one ? `${s.name} income tax adds about ${money(s.total)} that year.` : `${s.name} income tax adds about ${money(s.total)} over the same years, ${money(s.average)} a year on average.`;
}
