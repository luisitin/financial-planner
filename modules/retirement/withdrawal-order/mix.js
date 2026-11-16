// modules/retirement/withdrawal-order/mix.js -- PURE. One search over the withdrawal order and Roth conversions together (gap list,
// next 60, item 23; 2026-11-16). The plan's own engine (core/math/retirement.js) is run on a small, stated grid: the five orders
// (the four, and a share from every account) x no Roth conversions, or conversions that fill the 10%, 12% or 22% rate until age
// 63, until 70 or until required withdrawals begin. Each run is the plan as it would be with that mix saved, at the real tax rates
// and the same spending every year, as Withdrawal order and Roth conversions run theirs. The runs are ranked by what is left at the
// end after tax, in today's dollars, then by the tax paid over the plan; the page shows the best three beside the plan as it is.
//
// Taking gains at the 0% rate is NOT an axis: the engine keeps no cost basis (a fixed `gainShare` of every sale from taxable money
// is profit), so selling and buying back to raise the basis changes nothing it counts. Tax, year by year shows that room instead
// (taxes/projection gainsRoom, which never enters the engine). README "One search over the order and Roth conversions".
//
// Nothing here is called by compute(): the page's own answer is what it was (module.test.mjs, "x2 invariance").
import { project } from "../../../core/math/retirement.js";
import { bracketTop } from "../../../core/math/tax.js";
import { buildInputs, taxSettings, WITHDRAWAL_ORDERS, WITHDRAWAL_SHARE, orderKey, sharesWithdrawals } from "../projection/compute.js";
import { chooseOrder } from "./compute.js";

/** The rates a conversion fills (the Roth conversions page's first three; its 24% is left out to keep the grid small). */
export const MIX_RATES = Object.freeze([0.10, 0.12, 0.22]);
/** The stop ages tried beside "until required withdrawals begin" (null). 63: the stop the Roth conversions page offers so the years
 * from 63 stay clear of Medicare's surcharge, which looks at income two years back; 70: the brief's. 75 is not tried: required
 * withdrawals begin at 73 or 75 (core/math/rmd.js), so "until 75" is always "until required withdrawals begin". */
export const MIX_STOPS = Object.freeze([63, 70]);
/** The best leaves this much more or less than the plan as it is: "about as much" (the Withdrawal order page's own line). */
export const ABOUT_SAME = 500;
/** The part's fixed title (pinned in qa/first-view-lib.mjs PINNED_TITLES, with its reason). "Try ..." says there is something to
 * gain by opening it (critic of x2, P6: "With Roth conversions too" gave no hint of the payoff). */
export const MIX_TITLE = "Try Roth conversions too";

const DEFAULT_ORDER = ["taxable", "deferred", "free"];
const pct = (r) => `${Math.round(Number(r) * 100)}%`;
const usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

/** The five orders as the page lists them: the four, then a share from every account (which keeps the plan's own order). */
export function mixOrders() {
  return [...Object.entries(WITHDRAWAL_ORDERS).map(([key, d]) => ({ key, label: d.label, order: [...d.order] })), { key: WITHDRAWAL_SHARE.key, label: WITHDRAWAL_SHARE.label, split: true }];
}
/** A conversion setting's key: "off", or "0.12@rmd" / "0.12@70". */
export const convKey = (conv) => (conv ? `${Number(conv.fillRate)}@${conv.untilAge ?? "rmd"}` : "off");

/**
 * savedConv(rc, rateOk) -> { fillRate, untilAge } | null: the plan's own Roth conversions as the engine runs them once the real rates
 * are on (buildInputs reads `{ fillRate: Number(fillRate ?? 0.22), untilAge: untilAge ? Number(untilAge) : null }`). Off, or a
 * setting the engine cannot run, is null: a rate that is none of the brackets' (core/math/tax.js bracketTop finds no top, and
 * core/math/retirement.js converts nothing) or a stop that is not a number (the engine's "under the stop" is never true). Only
 * hand-edited or damaged data is like that (critic of x2, F3: `{ on: true, fillRate: "abc", untilAge: "x" }` read "the NaN% rate").
 * rateOk(rate): whether the brackets have that rate (the plan's own table; mixGrid passes it).
 */
export function savedConv(rc, rateOk = () => true) {
  if (!rc || typeof rc !== "object" || !rc.on) return null;
  const fillRate = Number(rc.fillRate ?? 0.22);
  const untilAge = rc.untilAge ? Number(rc.untilAge) : null;
  if (!Number.isFinite(fillRate) || !rateOk(fillRate) || (untilAge !== null && !Number.isFinite(untilAge))) return null;
  return { fillRate, untilAge };
}

/**
 * planWith(plan, mix): the plan as it would be with that mix saved, on the real tax rates (what both pages run). mix null: the plan
 * as it is, on the real rates. A share from every account keeps the plan's own order (for money that comes in during a year).
 */
export function planWith(plan, mix) {
  const rt = plan.retirement ?? {};
  const r = { ...rt, taxMode: "brackets" };
  if (mix) {
    if (mix.order.split) r.withdrawalSplit = WITHDRAWAL_SHARE.key;
    else { r.withdrawalOrder = [...mix.order.order]; delete r.withdrawalSplit; }
    const rc = rt.rothConversion ?? {};
    r.rothConversion = mix.conv ? { ...rc, on: true, fillRate: mix.conv.fillRate, untilAge: mix.conv.untilAge } : { ...rc, on: false };
  }
  return { ...plan, retirement: r };
}

/**
 * mixGrid(plan, { today }) -> { ready, missing } | { ready: true, convert, why, rates, stops, cells, own, tried, bracketsOn,
 *   rmdStartAge, startAge, baseOrder, people }
 * cells: [{ key, order: { key, label, order? , split? }, conv: null | { fillRate, untilAge } }] in the grid's order (orders as the
 * page lists them; for each, no conversions, then each rate with each stop: required withdrawals first, then 63, then 70).
 * convert: the plan has pre-tax money and a retired year before the first person's required withdrawals (the engine converts only
 * then); otherwise the grid is the five orders alone (why: "no-pretax" | "no-years"). A stop age a is tried only when it changes
 * a year: startAge < a < min(rmdStartAge, the first person's last age + 1).
 * own: { key (the plan's own mix as a cell's key, its stop read the same way), inGrid, mix: { order, conv } (as saved: savedConv, null
 *   when off or when the engine cannot run it) }.
 * tried: cells, plus one when the plan's own mix is none of them.
 */
export function mixGrid(plan, params = {}) {
  const b = buildInputs(plan, params);
  if (!b.inputs) return { ready: false, missing: b.missing ?? [], cells: [] };
  const I = b.inputs, p0 = I.people[0];
  const rmdStartAge = I.rmd?.startAge ?? 75;                      // as Roth conversions reads it
  const startAge = Math.max(I.startYear, I.retireYear) - p0.birthYear;   // the first person's age in the first retired year
  const lastAge = I.endYear - p0.birthYear;
  const hasYears = startAge < rmdStartAge && startAge <= lastAge;
  const pretax = (I.balances?.deferred ?? 0) > 0;
  const convert = pretax && hasYears;
  const why = convert ? null : !pretax ? "no-pretax" : "no-years";
  const rates = convert ? [...MIX_RATES] : [];
  const stops = convert ? [null, ...MIX_STOPS.filter((a) => startAge < a && a < Math.min(rmdStartAge, lastAge + 1))] : [];
  const cells = [];
  for (const order of mixOrders()) {
    cells.push({ key: `${order.key}|off`, order, conv: null });
    for (const fillRate of rates) for (const untilAge of stops) cells.push({ key: `${order.key}|${convKey({ fillRate, untilAge })}`, order, conv: { fillRate, untilAge } });
  }
  // the plan's own mix, as saved; and the same as a cell's key (a stop at or before the first conversion year converts nothing;
  // one at or past required withdrawals or the plan's end is the same as no stop)
  const rt = plan.retirement ?? {};
  const baseOrder = Array.isArray(rt.withdrawalOrder) && rt.withdrawalOrder.length ? [...rt.withdrawalOrder] : [...DEFAULT_ORDER];
  const okey = sharesWithdrawals(rt) ? WITHDRAWAL_SHARE.key : orderKey(baseOrder);
  const ownOrder = okey === WITHDRAWAL_SHARE.key ? { key: okey, label: WITHDRAWAL_SHARE.label, split: true } : okey === "custom" ? { key: "custom", label: null, order: baseOrder } : { key: okey, label: WITHDRAWAL_ORDERS[okey].label, order: [...WITHDRAWAL_ORDERS[okey].order] };
  const tax = taxSettings(plan, { mode: "brackets" }), fed = tax.paramsFor(I.startYear);
  const ownConv = savedConv(rt.rothConversion, (r) => Number.isFinite(bracketTop(r, tax.filingStatus, fed)));
  const eff = !convert || !ownConv || (ownConv.untilAge !== null && ownConv.untilAge <= startAge) ? null
    : { fillRate: ownConv.fillRate, untilAge: ownConv.untilAge !== null && ownConv.untilAge >= Math.min(rmdStartAge, lastAge + 1) ? null : ownConv.untilAge };
  const key = `${okey}|${convKey(eff)}`;
  const inGrid = cells.some((c) => c.key === key);
  return { ready: true, missing: [], convert, why, rates, stops, cells, own: { key, inGrid, mix: { order: ownOrder, conv: ownConv } }, tried: cells.length + (inGrid ? 0 : 1),
    bracketsOn: (rt.taxMode ?? "flat") === "brackets", rmdStartAge, startAge, baseOrder, people: b.people ?? [] };
}

/** The key a run is kept under: a cell's, with the plan's own order for a share from every account (it pays from that order what
 * comes in during a year); "own" and the plan's own settings for the plan as it is when it is none of the cells. */
export const runKey = (grid, cell) => (cell ? `${cell.key}${cell.order.split ? `|${grid.baseOrder.join(">")}` : ""}` : `own|${JSON.stringify(grid.own.mix)}`);
/** Every run the ranking needs: [{ rk, mix }] (mix null: the plan as it is). */
export const runsNeeded = (grid) => [...grid.cells.map((c) => ({ rk: runKey(grid, c), mix: c })), ...(grid.own.inGrid ? [] : [{ rk: runKey(grid, null), mix: null }])];

/**
 * runMix(plan, mix, { today }) -> { success, failYear, endAfterTaxReal, endBalanceReal, taxesReal, convertedReal } | null
 * project() on buildInputs of the plan with the mix saved (planWith), at the same spending every year. taxesReal and convertedReal
 * are summed in today's dollars year by year, as the two pages sum them.
 */
export function runMix(plan, mix, params = {}) {
  const b = buildInputs(planWith(plan, mix), params);
  if (!b.inputs) return null;
  const r = project({ ...b.inputs, strategy: "fixed-real" });
  let taxesReal = 0, convertedReal = 0;
  for (const x of r.rows) { taxesReal += x.taxes / x.priceLevel; convertedReal += x.conversion / x.priceLevel; }
  return { success: r.success, failYear: r.failYear, endAfterTaxReal: r.endAfterTaxReal, endBalanceReal: r.endBalanceReal, taxesReal, convertedReal };
}

/** Better first: lasts before runs out; more left at the end (or a later year it runs out); less tax; fewer changes; grid order. */
export function better(a, b) {
  if (a.success !== b.success) return a.success ? -1 : 1;
  const d = a.success ? Math.round(b.endAfterTaxReal) - Math.round(a.endAfterTaxReal) : (b.failYear ?? 0) - (a.failYear ?? 0);
  if (d) return d;
  return Math.round(a.taxesReal) - Math.round(b.taxesReal) || a.changes - b.changes || a.i - b.i;
}
/** Two runs the same in effect: the same ending and, within $1, the same left, tax and money converted. */
export const sameInEffect = (a, b) => a.success === b.success && (a.failYear ?? null) === (b.failYear ?? null) && Math.abs(a.endAfterTaxReal - b.endAfterTaxReal) < 1
  && Math.abs(a.taxesReal - b.taxesReal) < 1 && Math.abs(a.convertedReal - b.convertedReal) < 1;

/**
 * rankMixes(grid, runs: Map runKey -> figures) -> { ready, asIs, ranked, top, others (up to 3, best first, the plan as it is left out),
 *   shown (the rows the page lists under the plan as it is), listed (whether the page lists any: not when every mix runs out and
 *   none lasts longer than the plan as it is), tried, convert, converts, lead (the case), gain (left at the end: the
 *   best less the plan as it is, whole dollars), better (Set of keys of the mixes that do more than the plan as it is) }
 * Runs the same in effect are one entry, shown as the simplest of them (the plan as it is, then the fewest changes, then grid
 * order). Each entry: the cell's { key, order, conv } and its figures, `changes` (0 to 2: order, conversions), `asIs`.
 * lead: "better" (the best leaves more than ABOUT_SAME more), "barely", "yours" (none leaves more), "rescues" (the plan as it is
 *   runs out, the best lasts), "fails-longer", "fails-yours", "fails-same" (every mix runs out the same year).
 * shown: the best three when something lasts; when every mix runs out, only those that last longer than the plan as it is (rows
 *   that run out the same year say nothing the first sentence does not).
 * better: a mix does more than the plan as it is when it lasts and the plan does not, leaves $1 or more more at the end, or (both
 *   running out) runs out later; only those are offered "Use this mix".
 */
export function rankMixes(grid, runs) {
  if (!grid?.ready) return { ready: false };
  const own = grid.own;
  const ownOrderKey = own.mix.order.key;
  const items = [];
  grid.cells.forEach((c, i) => {
    const f = runs.get(runKey(grid, c));
    if (!f) return;
    items.push({ key: c.key, order: c.order, conv: c.conv, ...f, i, changes: (c.order.key === ownOrderKey ? 0 : 1) + (c.key.split("|")[1] === own.key.split("|")[1] ? 0 : 1), asIs: false });
  });
  let asIs = own.inGrid ? items.find((x) => x.key === own.key) : null;
  if (asIs) { asIs.asIs = true; asIs.changes = 0; asIs.order = own.mix.order; asIs.conv = own.mix.conv; }
  else {
    const f = runs.get(runKey(grid, null));
    if (!f) return { ready: false };
    asIs = { key: "own", order: own.mix.order, conv: own.mix.conv, ...f, i: -1, changes: 0, asIs: true };
    items.push(asIs);
  }
  const sorted = [...items].sort(better);
  const groups = [];
  for (const x of sorted) {
    const g = groups.find((y) => sameInEffect(y.rep, x));
    if (!g) groups.push({ rep: x });
    else if (x.asIs) g.rep = x;   // the plan as it is stands for its group
  }
  const ranked = groups.map((g) => g.rep);
  const top = ranked[0];
  const others = ranked.filter((x) => !x.asIs).slice(0, 3);
  const converts = items.some((x) => x.convertedReal >= 1);
  const gain = top.success && asIs.success ? Math.round(top.endAfterTaxReal) - Math.round(asIs.endAfterTaxReal) : 0;
  let lead;
  if (!ranked.some((x) => x.success)) lead = ranked.every((x) => x.failYear === top.failYear) ? "fails-same" : top.failYear === asIs.failYear ? "fails-yours" : "fails-longer";
  else if (!asIs.success) lead = "rescues";
  else if (top.asIs) lead = "yours";
  else lead = gain > ABOUT_SAME ? "better" : "barely";
  const does = (x) => (x.success && !asIs.success) || (x.success && asIs.success && Math.round(x.endAfterTaxReal) > Math.round(asIs.endAfterTaxReal)) || (!x.success && !asIs.success && x.failYear > asIs.failYear);
  const shown = lead.startsWith("fails-") ? others.filter((x) => !x.success && x.failYear > asIs.failYear) : others;
  // the list (the plan as it is, then `shown`) only when it says something the first sentence does not
  const listed = !lead.startsWith("fails-") || shown.length > 0;
  return { ready: true, asIs, ranked, top, others, shown, listed, tried: grid.tried, convert: grid.convert, converts, lead, gain, better: new Set(others.filter(does).map((x) => x.key)) };
}

/** mixes(plan, { today }): the grid, every run and the ranking at once (tests, Node; the page runs the same in slices). */
export function mixes(plan, params = {}) {
  const grid = mixGrid(plan, params);
  if (!grid.ready) return { grid, ready: false };
  const runs = new Map();
  for (const { rk, mix } of runsNeeded(grid)) runs.set(rk, runMix(plan, mix, params));
  return { grid, runs, ...rankMixes(grid, runs) };
}

/**
 * chooseMix(draft, mix, { withRates }): what "Use this mix" writes, through the two pages' own save paths and nothing else:
 * - the order: Withdrawal order's chooseOrder (one of the four: `withdrawalOrder`, the share taken off; the share:
 *   `withdrawalSplit`, the order kept); withRates (a flat-rate plan) also sets `taxMode: "brackets"`, as its first button does;
 * - conversions on: Roth conversions' "Use this" (`rothConversion = { ...rc, on: true, fillRate }` and `taxMode: "brackets"`),
 *   and its "Convert until" box (`rothConversion.untilAge`, a number or null) when the stop differs;
 * - conversions off: its "Turn conversions off" (`{ ...rc, on: false }`), only when they were on.
 */
export function chooseMix(draft, mix, { withRates = false } = {}) {
  chooseOrder(draft, mix.order.split ? { split: WITHDRAWAL_SHARE.key } : { order: mix.order.order }, { withRates });
  const rt = draft.retirement;
  const rc = rt.rothConversion ?? {};
  if (mix.conv) {
    rt.rothConversion = { ...rc, on: true, fillRate: mix.conv.fillRate };
    if ((rc.untilAge ? Number(rc.untilAge) : null) !== mix.conv.untilAge) rt.rothConversion.untilAge = mix.conv.untilAge;
    rt.taxMode = "brackets";
  } else if (rc.on) rt.rothConversion = { ...rc, on: false };
}

// ---- the words (one sentence per case, each with a test in module.test.mjs) -------------------------------------------------------
/** What a Roth conversion is, in one sentence, first in the part (critic of x2, P3: no line said it; the Roth conversions page's own
 * sentence, its "regular retirement account" for pre-tax money). */
export const ROTH_WORDS = "Moving money from your regular retirement account to a Roth account is a Roth conversion: you pay tax on it now, and later withdrawals are tax-free.";
/** Until when: "until age 70"; "until age 75, when required withdrawals begin" (the first person's start age, which the engine
 * stops at); with no age at hand, "until required withdrawals begin". */
const stopWords = (untilAge, rmdAge = null) => (untilAge ? `until age ${untilAge}` : rmdAge ? `until age ${rmdAge}, when required withdrawals begin` : "until required withdrawals begin");
/**
 * A conversion setting in a row (critic of x2, P3: "Roth conversions at the 12% rate until required withdrawals begin" was jargon):
 *   "Nothing moved to a Roth" / "Money moved to a Roth each year up to the 12% tax rate, until age 70" /
 *   "Money moved to a Roth each year up to the 12% tax rate, until age 75, when required withdrawals begin"
 */
export function convWords(conv, rmdAge = null) {
  if (!conv) return "Nothing moved to a Roth";
  return `Money moved to a Roth each year up to the ${pct(conv.fillRate)} tax rate, ${stopWords(conv.untilAge, rmdAge)}`;
}
/** A row's title: the order's own name; an order of the plan's own that is none of the five: "Your own order". */
export const orderTitle = (order) => order.label ?? "Your own order";
/** The pill on the best row (critic of x2, P1: a second plain "best" under the hero's best order read as a second answer to the
 * same question): "best with conversions" when it moves money to a Roth, "best mix" when it does not. */
export const bestWords = (x) => (x.conv ? "best with conversions" : "best mix");
/** "1 year" / "3 years". */
const yearsWords = (n) => `${n} year${n === 1 ? "" : "s"}`;
/**
 * A row's line under its title, against the plan as it is (one per case); rmdAge: the first person's required-withdrawal age:
 *   the plan as it is  -> "Nothing moved to a Roth. Tax over the plan $174,664."   (runs out: "Nothing moved to a Roth.")
 *   both last          -> "Money moved to a Roth each year up to the 12% tax rate, until age 70. $37,733 more left at the end; $37,674
 *                         less tax over the plan." ("... less left at the end", "the same left at the end"; "... more tax", "the same
 *                         tax over the plan")
 *   more left for more tax -> "... Pays $7,790 more tax over the plan, yet leaves $18,261 more at the end, after tax." (critic of x2,
 *                         P4: a "best" that raises the tax said why it is best)
 *   it lasts, yours not -> "... Lasts to the end of your plan."
 *   it runs out, yours lasts -> "... Runs out in 2061."
 *   both run out       -> "... Lasts 2 years longer." / "... Runs out 1 year sooner." / "... Runs out the same year."
 */
export function rowWords(x, asIs, money = usd, rmdAge = null) {
  const head = `${convWords(x.conv, rmdAge)}.`;
  if (x.asIs) return x.success ? `${head} Tax over the plan ${money(x.taxesReal)}.` : head;
  if (x.success && asIs.success) {
    const d = Math.round(x.endAfterTaxReal) - Math.round(asIs.endAfterTaxReal), t = Math.round(x.taxesReal) - Math.round(asIs.taxesReal);
    if (d > 0 && t > 0) return `${head} Pays ${money(t)} more tax over the plan, yet leaves ${money(d)} more at the end, after tax.`;
    const left = d > 0 ? `${money(d)} more left at the end` : d < 0 ? `${money(-d)} less left at the end` : "the same left at the end";
    const tax = t < 0 ? `${money(-t)} less tax over the plan` : t > 0 ? `${money(t)} more tax over the plan` : "the same tax over the plan";
    return `${head} ${left.replace(/^./, (c) => c.toUpperCase())}; ${tax}.`;
  }
  if (x.success) return `${head} Lasts to the end of your plan.`;
  if (asIs.success) return `${head} Runs out in ${x.failYear}.`;
  const k = x.failYear - asIs.failYear;
  return `${head} ${k > 0 ? `Lasts ${yearsWords(k)} longer.` : k < 0 ? `Runs out ${yearsWords(-k)} sooner.` : "Runs out the same year."}`;
}
/** A row's figure: what is left at the end, or "runs out 2061" (as The five orders says it). */
export const valueWords = (x, money = usd) => (x.success ? money(x.endAfterTaxReal) : `runs out ${x.failYear}`);

/**
 * The part's first sentence (one per case), r = rankMixes(...):
 *   better       -> "The best of the 50 mixes we tried leaves about $874,277 at the end, after tax and in today's dollars: $37,733 more than your plan as it is."
 *   barely       -> "The best of the 50 mixes we tried leaves about as much as your plan as it is: for this plan the mix barely matters."
 *   yours        -> "None of the 50 mixes we tried leaves more than your plan as it is."
 *   rescues      -> "The best of the 50 mixes we tried lasts to the end of your plan and leaves about $612,400, after tax and in today's dollars; your plan as it is runs out in 2061."
 *   fails-longer -> "None of the 50 mixes we tried lasts to the end of your plan. With the best, the money runs out in 2069 instead of 2067."
 *   fails-yours  -> "None of the 50 mixes we tried lasts to the end of your plan, or longer than your plan as it is: the money runs out in 2067."
 *   fails-same   -> "Every one of the 50 mixes we tried runs out in 2067: the order and Roth conversions cannot change that."
 * and, when no run moved any money to a Roth, a second sentence (moveWords).
 */
export function leadWords(r, money = usd) {
  const n = `${r.tried} mixes we tried`;
  switch (r.lead) {
    case "better": return `The best of the ${n} leaves about ${money(r.top.endAfterTaxReal)} at the end, after tax and in today's dollars: ${money(r.gain)} more than your plan as it is.`;
    case "barely": return `The best of the ${n} leaves about as much as your plan as it is: for this plan the mix barely matters.`;
    case "yours": return `None of the ${n} leaves more than your plan as it is.`;
    case "rescues": return `The best of the ${n} lasts to the end of your plan and leaves about ${money(r.top.endAfterTaxReal)}, after tax and in today's dollars; your plan as it is runs out in ${r.asIs.failYear}.`;
    case "fails-longer": return `None of the ${n} lasts to the end of your plan. With the best, the money runs out in ${r.top.failYear} instead of ${r.asIs.failYear}.`;
    case "fails-yours": return `None of the ${n} lasts to the end of your plan, or longer than your plan as it is: the money runs out in ${r.asIs.failYear}.`;
    case "fails-same": return `Every one of the ${n} runs out in ${r.top.failYear}: the order and Roth conversions cannot change that.`;
    default: return "";
  }
}
/** When there is money to convert and years to do it in, but no run moved $1 or more to a Roth: why, in one sentence ("" otherwise). */
export const moveWords = (r) => (r.converts || !r.convert ? "" : "At these rates your other income already fills the room, so no mix moves money to a Roth.");

/** "a, b or c" */
const orList = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} or ${xs.at(-1)}` : xs[0] ?? "");
/**
 * What was tried, in one paragraph, under "How this is worked out" (critic of x2, P5: in the part it was builder language between the
 * rows and the next part); the grid as it is for this plan:
 *   "For "Try Roth conversions too" we tried 35 mixes: the five orders, each with nothing moved to a Roth or with money moved each
 *    year up to the 10%, 12% or 22% tax rate, until age 70 or until age 75, when required withdrawals begin. Each runs your whole
 *    plan year by year at the real tax rates and the same spending every year, with health insurance priced on that mix's own
 *    income; what is left is counted after tax, in today's dollars."
 *   (", and your plan as it is" before the first full stop when its own setting is none of them; a plan with nothing to convert:
 *    "the five orders, with nothing moved to a Roth")
 * The health clause (critic of x2, F1): the five orders above price that cover once, on the plan's own order, so on a plan with such
 * cover an order's row there can differ a little from the same order with nothing moved here (README).
 */
export function triedWords(grid) {
  const stops = [...grid.stops.filter((a) => a !== null).map((a) => `until age ${a}`), ...(grid.stops.includes(null) ? [stopWords(null, grid.rmdStartAge)] : [])];
  const what = grid.convert ? `the five orders, each with nothing moved to a Roth or with money moved each year up to the ${orList(grid.rates.map(pct))} tax rate, ${orList(stops)}` : "the five orders, with nothing moved to a Roth";
  return `For "${MIX_TITLE}" we tried ${grid.tried} mixes: ${what}${grid.own.inGrid ? "" : ", and your plan as it is"}. Each runs your whole plan year by year at the real tax rates and the same spending every year, with health insurance priced on that mix's own income; what is left is counted after tax, in today's dollars.`;
}
/** Why gains at the 0% rate are not in the search (always said, under "How this is worked out"; the link to Tax, year by year follows it). */
export const GAINS_WORDS = "Taking gains at the 0% rate is not part of this search: your plan counts the same share of every sale as profit, so it cannot see what selling shares and buying them back in a low-income year would save.";
/** Does the plan as it is move money to a Roth once the real rates are on (its own setting, read as a cell's)? */
export const ownConverts = (grid) => !!grid?.own && grid.own.key.split("|")[1] !== "off";
/** On a flat-rate plan whose own setting moves nothing to a Roth: the figures here use the real rates (under "How this is worked out"). */
export const FLAT_MIX_WORDS = "Your plan works out tax at one flat rate. These figures use the real rates, and \"Use this mix\" turns them on too.";
/** On a flat-rate plan with Roth conversions saved (critic of x2, F2): the five orders above leave them out (the engine runs them only
 * at the real rates), "your plan" here has them; said in the part, before the rows, so the two "your plan" figures are explained. */
export const FLAT_CONV_WORDS = "Your plan works out tax at one flat rate, so its Roth conversions do not run yet and the five orders above leave them out. Here they run, at the real rates; \"Use this mix\" turns those on too.";

/** The mix's order inside a sentence: "take money out in the order "Roth, then taxable, then pre-tax"" / "take a share from every account". */
const orderDo = (order, s = "") => (order.split ? `take${s} a share from every account` : `take${s} money out in the order "${orderTitle(order)}"`);
/** The mix's conversions inside a sentence: "move money to a Roth each year up to the 12% tax rate, until age 70" / "move nothing to a Roth". */
const convDo = (conv, rmdAge, s = "") => (conv ? `move${s} money to a Roth each year up to the ${pct(conv.fillRate)} tax rate, ${stopWords(conv.untilAge, rmdAge)}` : `move${s} nothing to a Roth`);
/**
 * The question before "Use this mix" saves (ui.confirm):
 *   "Use this mix? Your plan will take money out in the order "Roth, then taxable, then pre-tax" and move money to a Roth each year up
 *    to the 12% tax rate, until age 75, when required withdrawals begin. It will also work out tax at the real rates, which changes
 *    the figures on every retirement page. You can undo it."
 *   (no conversions: "... and move nothing to a Roth."; the real rates' sentence only when the tap turns them on)
 */
export function confirmMixWords(mix, { withRates = false, rmdAge = null } = {}) {
  return `Use this mix? Your plan will ${orderDo(mix.order)} and ${convDo(mix.conv, rmdAge)}.${withRates ? " It will also work out tax at the real rates, which changes the figures on every retirement page." : ""} You can undo it.`;
}
/**
 * The green line after "Use this mix" (it names the new answer, R7):
 *   "Saved: your plan now takes money out in the order "Roth, then taxable, then pre-tax" and moves money to a Roth each year up to the
 *    12% tax rate, until age 75, when required withdrawals begin. It leaves about $874,277 at the end, after tax and in today's dollars."
 *   runs out: "... The money still runs out, in 2069."; withRates: "... Tax is now worked out at the real rates, so every
 *   retirement page's figures change with it."
 */
export function savedMixWords(mix, { withRates = false, money = usd, rmdAge = null } = {}) {
  const end = mix.success ? `It leaves about ${money(mix.endAfterTaxReal)} at the end, after tax and in today's dollars.` : `The money still runs out, in ${mix.failYear}.`;
  return `Saved: your plan now ${orderDo(mix.order, "s")} and ${convDo(mix.conv, rmdAge, "s")}. ${end}${withRates ? " Tax is now worked out at the real rates, so every retirement page's figures change with it." : ""}`;
}
/** The line after Undo: "Back to your plan as it was." / "Back to your plan as it was, with the flat tax rate." */
export const backMixWords = ({ withRates = false } = {}) => `Back to your plan as it was${withRates ? ", with the flat tax rate" : ""}.`;
/** The line while the runs are worked out: "Trying 50 mixes of order and Roth conversions..." */
export const busyWords = (grid) => `Trying ${grid.tried} mixes of order and Roth conversions...`;
