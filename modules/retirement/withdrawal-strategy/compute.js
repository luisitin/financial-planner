// modules/retirement/withdrawal-strategy/compute.js -- PURE. The four ways of deciding how much
// to take out each year, run on this household's own numbers: under the plan's expected returns
// and through the worst real stretch of history. What each gives in the first year, what it
// could fall to, and how the money ends up.
import { project, STRATEGIES, guardRule, shareWords } from "../../../core/math/retirement.js";
import { buildInputs, compute as computeProjection, BUCKET_OF, healthAdded, FLOOR_MONTHLY_CEILING } from "../projection/compute.js";
import { RETURNS } from "../historical/data/returns.js";
// what a required withdrawal adds to the year's federal tax (round 8, widow-2): the same figure as Required withdrawals
import { rowIncome, addedTax, withdrawalTax, payThisYear } from "../rmd/compute.js";

// `short`: the way in a few plain words, for its one line on the page; `how`: the rule, for "How this is worked out"
export const DESCRIPTIONS = {
  "fixed-real": { name: "Same spending every year", short: "the same each year, raised with prices, whatever markets do", how: "Spend the same every year, raised with prices; savings pay what income does not. Steady, but a bad decade can drain savings.", from: "The classic '4% rule' (Bengen 1994, the Trinity study)." },
  "percent": { name: "A share of what is left", short: "a set share of savings each year on top of your income, so it moves with markets", how: "Take the same share of savings each year and spend it on top of your income. It never runs out, but a bad year cuts spending at once.", from: "Percent-of-portfolio rule." },
  // one plain name on every page (UX review 8: "Guardrails" here, another phrase in the settings list, a third in the hero)
  "guardrails": { name: "Trim after bad years", short: "what you plan, trimmed by a tenth after bad years and raised back after good ones", how: "Spend what you plan. Trim it by a tenth when what you take passes 1.2 times the starting share of savings; raise it back, never past your plan, when it falls under 0.8 times. Nothing is trimmed while income pays for everything.", from: "Guyton and Klinger's guardrails (2006), simplified." },
  "vpw": { name: "Spend what the years left can afford", short: "what savings can pay over the years left, on top of your income", how: "Take what would spread savings evenly over the years left and spend it on top of your income. More early on; it moves with markets and never runs out early.", from: "Bogleheads variable percentage withdrawal." },
};
/**
 * "Trim after bad years" in words, for the numbers the plan runs it on (core/math guardRule; gap design #4, 2026-11-13). With
 * the usual numbers these are DESCRIPTIONS.guardrails' own `short` and `how`, letter for letter.
 */
const times = (x) => `${Number(Number(x).toFixed(2))}`;
export function guardWords(guard = null) {
  const g = guardRule(guard);
  const back = Math.abs(g.raise - g.cut) < 1e-9 ? "raise it back" : g.raise > 0 ? `raise it back by ${shareWords(g.raise)}` : null;
  return {
    short: `what you plan, trimmed by ${shareWords(g.cut)} after bad years and raised back after good ones`,
    how: `Spend what you plan. Trim it by ${shareWords(g.cut)} when what you take passes ${times(g.upper)} times the starting share of savings${back ? `; ${back}, never past your plan, when it falls under ${times(g.lower)} times` : ""}. Nothing is trimmed while income pays for everything.`,
  };
}
/** The chips of "Trim after bad years" (Set my own numbers): the usual tenth between a gentler and a firmer step. */
export const TRIM_CHIPS = Object.freeze([{ value: 0.05, label: "by 5%" }, { value: 0.1, label: "by 10% (usual)" }, { value: 0.15, label: "by 15%" }]);
const r4 = (x) => Number(Number(x).toFixed(4));
/**
 * ownNumbers(rt) -> { floor (a month, 0 for none), cut, raise, upperBy, lowerBy (how far above and below the starting share
 * the trim and the raise come: upper - 1, 1 - lower), custom (the rule's numbers are not the usual ones), set (how many of
 * the two the person set: the floor, the rule's numbers), replaced? (only when a stored figure is one the sums refuse, a
 * trim of 80% or a floor past the ceiling, put there by hand: the names of those, each read as the usual figure, or the
 * ceiling, instead; the page says so) }: what "Set my own numbers" shows for the plan as it is.
 */
export function ownNumbers(rt) {
  const g = guardRule(rt?.guard), f = Number(rt?.spendingFloor);
  const floor = f > 0 && Number.isFinite(f) ? Math.min(f, FLOOR_MONTHLY_CEILING) : 0;
  const raw = rt?.guard && typeof rt.guard === "object" ? rt.guard : {};
  const there = (v) => v !== null && v !== undefined && v !== "";
  const replaced = [...(there(rt?.spendingFloor) && !(f >= 0 && f <= FLOOR_MONTHLY_CEILING) ? ["floor"] : []),
    ...["cut", "raise", "upper", "lower"].filter((k) => there(raw[k]) && !(Math.abs(Number(raw[k]) - g[k]) < 1e-12))];
  return { floor, cut: g.cut, raise: g.raise, upperBy: r4(g.upper - 1), lowerBy: r4(1 - g.lower), custom: g.custom, set: (floor > 0 ? 1 : 0) + (g.custom ? 1 : 0), ...(replaced.length ? { replaced } : {}) };
}
/**
 * saveOwnNumbers(draft, { floor, cut, upperBy, lowerBy }): writes `retirement.spendingFloor` and `retirement.guard`, or takes
 * each away when it is what absent means (no floor; the usual numbers). The raise is the same step as the trim (the page
 * asks one step), except that a raise the plan already holds apart from its trim is kept while the trim is left as it is.
 */
export function saveOwnNumbers(draft, { floor, cut, upperBy, lowerBy }) {
  draft.retirement = draft.retirement ?? {};
  const had = guardRule(draft.retirement.guard);
  const f = Number(floor);
  if (f > 0 && Number.isFinite(f)) draft.retirement.spendingFloor = Math.min(f, FLOOR_MONTHLY_CEILING); else delete draft.retirement.spendingFloor;
  const raise = Math.abs(had.raise - had.cut) > 1e-9 && Math.abs(r4(cut) - had.cut) < 1e-9 ? had.raise : r4(cut);
  const g = guardRule({ cut: r4(cut), raise, upper: r4(1 + Number(upperBy)), lower: r4(1 - Number(lowerBy)) });
  if (g.custom) draft.retirement.guard = { cut: g.cut, raise: g.raise, upper: g.upper, lower: g.lower }; else delete draft.retirement.guard;
}
/**
 * What a save of "Set my own numbers" changed, as the clauses of its green line (one per case; module.test.mjs reads each):
 *   a floor set or moved   -> "never under $3,000 a month"
 *   the floor taken away   -> "no lowest figure"
 *   the trim changed       -> "trims by 5% after bad years"
 *   the bands changed      -> "trims 25% above the starting share, raises 20% below"
 * was, now: ownNumbers results. [] when nothing changed.
 */
export function ownChanges(was, now, money = (n) => `$${Math.round(n).toLocaleString("en-US")}`) {
  const out = [], pct = (x) => `${Number((x * 100).toFixed(2))}%`;
  if (Math.abs(was.floor - now.floor) > 0.005) out.push(now.floor > 0 ? `never under ${money(now.floor)} a month` : "no lowest figure");
  if (Math.abs(was.cut - now.cut) > 1e-9) out.push(`trims by ${pct(now.cut)} after bad years`);
  if (Math.abs(was.upperBy - now.upperBy) > 1e-9 || Math.abs(was.lowerBy - now.lowerBy) > 1e-9) out.push(`trims ${pct(now.upperBy)} above the starting share, raises ${pct(now.lowerBy)} below`);
  return out;
}

/**
 * floorRisk({ floor, planMonthly, failAge }) -> "" | the warning under "Lowest spending you'd accept" (one sentence per case;
 * module.test.mjs reads each; critic of gap design #4, P1: $15,000 a month on a $7,000 plan was saved with a plain "Saved").
 * floor, planMonthly: a month, today's dollars; failAge: the youngest age a way that takes a share runs out of savings holding
 * the floor when it would not without it (compute's `floorWarn`), or null.
 *   over the plan, savings run out  -> "$15,000 a month is more than the $7,000 a month your plan spends. Holding it, savings run out at 73, even if markets do as well as average."
 *   over the plan                   -> "$7,500 a month is more than the $7,000 a month your plan spends."
 *   under the plan, savings run out -> "Holding at least $6,500 a month, one of the ways above runs out of savings at 88, even if markets do as well as average."
 *   neither                         -> ""
 */
export function floorRisk({ floor, planMonthly, failAge = null } = {}, money = (n) => `$${Math.round(n).toLocaleString("en-US")}`) {
  if (!(floor > 0)) return "";
  const over = planMonthly > 0 && floor > planMonthly + 0.5;
  const fails = failAge !== null && failAge !== undefined;
  if (over) return `${money(floor)} a month is more than the ${money(planMonthly)} a month your plan spends.${fails ? ` Holding it, savings run out at ${failAge}, even if markets do as well as average.` : ""}`;
  return fails ? `Holding at least ${money(floor)} a month, one of the ways above runs out of savings at ${failAge}, even if markets do as well as average.` : "";
}

/** The worst start year in history for this horizon: the one whose fixed-real run fails first or ends lowest. */
export function worstWindow(inputs) {
  const years = inputs.endYear - inputs.startYear + 1;
  let worst = null;
  for (let s = 0; s + years <= RETURNS.length; s++) {
    const seq = RETURNS.slice(s, s + years).map((r) => ({ stocks: r.stocks, bonds: r.bonds, cash: r.bills, inflation: r.inflation }));
    const r = project({ ...inputs, strategy: "fixed-real" }, { sequence: seq });
    const score = (r.failAge ?? 999) * 1e9 + r.endBalanceReal;
    if (!worst || score < worst.score) worst = { score, startYear: RETURNS[s].year, seq };
  }
  return worst;
}
/** The ways that set what you spend (the plan's figure, then raised or cut) and the ways that set a share of savings to take out. */
export const RULE_OF = { "fixed-real": "spend", guardrails: "spend", percent: "share", vpw: "share" };

/**
 * The first retirement year of one way, in the words "take $X from savings; with your $G of income, that pays for ..." (round 8,
 * widow-1; review D6, D7 and UX 1), all in today's dollars, from the way's own run with the plan's expected returns (row r):
 *   spend = the year's spending (the row's own figure, the one shown beside the way), health = its health cover, other = its
 *   other one-off costs, tax = the year's tax, take = everything that comes out of savings that year (a required withdrawal
 *   beyond the need included), short = what savings could not pay that year, need = what savings pay toward spending, health
 *   cover and one-off costs before tax, back = the part of the withdrawal the engine puts back into savings (core/math/retirement.js:
 *   the same spending every year puts back withdrawn - need - tax, its income beyond the need unspent; the other ways spend all of
 *   their income, so they put back withdrawn - (spend + health + one-offs + tax - income)). With nothing short and nothing back,
 *   take + income = spend + health + other + tax, unless the same spending every year leaves income unspent.
 * -> { year (the first retirement year), rule, take, spend, health, other, tax, short, back, need, income, required }
 */
function firstOf(key, r) {
  if (!r) return null;
  const pl = r.priceLevel || 1, real = (n) => (Number(n) || 0) / pl;
  const income = r.incomeReal, required = real(r.rmd);
  const out = Object.values(r.withdrawn ?? {}).reduce((t, x) => t + (Number(x) || 0), 0);
  const other = r.eventOut - r.eventSpending;
  // what savings pay toward the year (before tax), and with its tax: the same spending every year leaves income above its need unspent
  const fixed = key === "fixed-real";
  const need = fixed ? Math.max(0, r.spending + r.eventSpending - r.income) + other : Math.max(0, r.spending + r.eventSpending + other - r.income);
  // (the same spending every year keeps its own expression, out - need - tax, so its figure stays identical to the bit)
  const back = fixed ? out - need - r.taxes : out - Math.max(0, r.spending + r.eventSpending + other + r.taxes - r.income);
  return { year: r.year, rule: RULE_OF[key] ?? "spend", take: real(out), spend: r.spendingReal, health: real(r.eventSpending), other: real(other), tax: real(r.taxes),
    short: real(r.shortfall), back: Math.max(0, real(back)), need: real(need), income, required };
}

/**
 * The guard on one way's expected run, kept as a safety net (round 8, widow-1; review D2). Until the owner's answer of 2026-11-06
 * ("You can do as you please. Just make sure a layman can easily understand and use the page") the engine took a share or
 * guardrail way's figure as all of the year's spending and counted guaranteed income only afterwards, so a widow with $50,400
 * of income was planned on $16,880. The engine now spends the income on top of the way's withdrawal (core/math/retirement.js),
 * so no way should leave any of the year's guaranteed income unused. A way other than the same spending every year is still held
 * (not offered) if, in any retired year of its expected run, its spending, health cover and tax together come to less than that
 * year's guaranteed income ("below-income"). -> { held, under: { year, spending, income } | null }
 */
export function guardOf(key, run) {
  if (key === "fixed-real") return { held: null, under: null };
  const u = run.rows.find((x) => x.retired && (x.spending + (x.eventSpending ?? 0) + x.taxes) / (x.priceLevel || 1) < x.incomeReal - 0.5);
  return u ? { held: "below-income", under: { year: u.year, spending: u.spendingReal, income: u.incomeReal } } : { held: null, under: null };
}

/**
 * inputsByWay(plan, params, built) -> { [way]: inputs } | null: the inputs the plan would have with each way saved (review D2).
 * The health cover before 65 is priced on the plan's own income, and that income depends on the way (a way that takes less can
 * put the household under the line where the help with health insurance stops, or over the one where it ends), so each way is
 * run on its own build: the figure beside "Use this one" is the run the plan gets once that way is saved. `built`: the plan's own
 * buildInputs result, reused for the way already saved.
 */
export function inputsByWay(plan, params = {}, built = null) {
  const b = built ?? buildInputs(plan, params);
  if (!b?.inputs) return null;
  return Object.fromEntries(Object.keys(STRATEGIES).map((key) => [key, key === b.inputs.strategy ? b.inputs
    : buildInputs({ ...plan, retirement: { ...(plan.retirement ?? {}), strategy: key } }, params).inputs ?? b.inputs]));
}
/** The inputs of one way from a map of them, or the same inputs for every way (one inputs object). */
const wayInputs = (byWay, key) => (byWay && typeof byWay.startYear === "number" ? byWay : byWay?.[key]);

/** heldWays(byWay | inputs) -> { [way]: null | "below-income" }: the guard on each way's expected run, on its own inputs (three runs of the engine). */
export function heldWays(byWay) {
  return Object.fromEntries(Object.keys(STRATEGIES).map((key) => [key, key === "fixed-real" ? null : guardOf(key, project({ ...wayInputs(byWay, key), strategy: key })).held]));
}

/**
 * wayOptions(plan, { today }, built) -> [{ value, label }]: the ways the Projection page's settings offer (round 8 review UX 7: its
 * list set the ways this page does not offer, with no reason given): the ones not held, and the one the plan already uses, by the
 * names this page gives them (UX review 8: one name for each way on every page).
 */
export function wayOptions(plan, params = {}, built = null) {
  const byWay = inputsByWay(plan, params, built);
  return wayOptionsFor(byWay, plan.retirement?.strategy ?? "fixed-real");
}
/** wayOptionsFor(byWay | inputs | null, chosen) -> the same, from inputs already built; every way when there are none. */
export function wayOptionsFor(byWay, chosen = "fixed-real") {
  const held = byWay ? heldWays(byWay) : {};
  const mine = STRATEGIES[chosen] ? chosen : "fixed-real";
  return Object.keys(STRATEGIES).filter((k) => k === mine || !held[k]).map((value) => ({ value, label: DESCRIPTIONS[value].name }));
}

/**
 * compute(plan, { today }) -> { ready, rows: [{ key, name, short, how, from, expected: { firstYear, lowest, highest, endReal, success, failAge },
 *   worst: { ... }, first (firstOf), offer ("Use this one" is shown), held: null | "below-income", under (guardOf) }], worstStartYear,
 *   chosen, chosenHeld, spendingYearly, withdrawalRate, endYear (the plan's last year), figureMonthly (what Retirement settings
 *   shows a month, before health cover: buildInputs' own, for "Plan on $X a month"), own? (ownNumbers, only when the person
 *   set a lowest figure or the trim's numbers: with none set the output is what it was), floorWarn? (floorRisk's facts,
 *   { floor, planMonthly, failAge }, only with a lowest figure that is over the plan's spending or that empties savings in a
 *   way that takes a share: one more run of the engine for each such way that runs out) }
 * Amounts are real (today's dollars) yearly spending.
 * Each way is the engine's own run of it: the share and years-left ways take their withdrawal and spend it on top of guaranteed
 * income, guardrails spend what the plan spends while savings allow (owner's answer, 2026-11-06). guardOf stays as a safety net;
 * the same spending every year is never held.
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  if (!b.inputs) return { ready: false, missing: b.missing };
  // each way on the inputs the plan would have with it saved (review D2: its own health cover before 65)
  const byWay = inputsByWay(plan, params, b);
  const years = b.inputs.endYear - b.inputs.startYear + 1;
  const worst = years <= RETURNS.length ? worstWindow(byWay["fixed-real"]) : null;
  const summarise = (r) => { const ret = r.rows.filter((x) => x.retired); return { firstYear: ret[0]?.spendingReal ?? 0, lowest: ret.length ? Math.min(...ret.map((x) => x.spendingReal)) : 0, highest: ret.length ? Math.max(...ret.map((x) => x.spendingReal)) : 0, endReal: r.endBalanceReal, success: r.success, failAge: r.failAge }; };
  const planned = b.inputs.spending.yearly;
  // the person's own numbers for the ways that move (gap design #4): the lowest spending accepted and the trim's numbers
  const own = ownNumbers(plan.retirement);
  const rows = Object.keys(STRATEGIES).map((key) => {
    const run = project({ ...byWay[key], strategy: key });
    const r0 = run.rows.find((x) => x.retired) ?? null;
    const { held, under } = guardOf(key, run);
    return {
      key, ...DESCRIPTIONS[key], ...(key === "guardrails" && own.custom ? guardWords(b.inputs.guard) : {}),
      expected: summarise(run),
      worst: worst ? summarise(project({ ...byWay[key], strategy: key }, { sequence: worst.seq })) : null,
      first: firstOf(key, r0), held, under, offer: key !== b.inputs.strategy && !held,
    };
  });
  const chosenRow = rows.find((r) => r.key === b.inputs.strategy);
  // a lowest figure that asks for more than the plan spends, or that empties savings (P1): a way that takes a share and runs
  // out is run again without the floor, to see that the floor is why
  let floorWarn = null;
  if (own.floor > 0) {
    const ages = rows.filter((r) => (r.key === "percent" || r.key === "vpw") && !r.expected.success && r.expected.failAge !== null && r.expected.failAge !== undefined)
      .filter((r) => { const { spendingFloor, ...bare } = byWay[r.key]; return project({ ...bare, strategy: r.key }).success; }).map((r) => r.expected.failAge);
    const failAge = ages.length ? Math.min(...ages) : null, planMonthly = (b.figureMonthly ?? 0) > 0 ? b.figureMonthly : planned / 12;
    if (failAge !== null || own.floor > planMonthly + 0.5) floorWarn = { floor: own.floor, planMonthly, failAge };
  }
  return { ready: true, rows, worstStartYear: worst?.startYear ?? null, chosen: b.inputs.strategy, chosenHeld: chosenRow?.held ?? null, spendingYearly: planned, withdrawalRate: b.inputs.withdrawalRate, endYear: b.inputs.endYear, figureMonthly: b.figureMonthly ?? null,
    ...(own.set ? { own } : {}), ...(floorWarn ? { floorWarn } : {}) };
}

/**
 * firstYear(plan, { today }) -> null | { year, thisYear, ages, spending, health (the plan's health cover that year, 2026-11-02), healthAdded (the plan adds health cover on top of spending in some year), income, sources: ["Social Security", "a pension", ...],
 *   fromSavings, need, required, requiredTax (what the required withdrawal adds to that year's federal tax: rmd/compute.js addedTax),
 *   extra, taxes, other (one-off costs other than health cover), short (what savings could not pay that year: the engine's
 *   shortfall), buckets: [{ bucket, amount, accounts: [names] }], affordable, verdict, shortAge }:
 * the plain answer to "how much do we take out?" for the first year of retirement (this year, for a household already
 * retired), from Will the money last?'s own year-by-year engine with the chosen way of spending. All in today's dollars.
 *   need = spending + one-off costs (the health cover among them) + the year's tax - guaranteed income (floor 0): what savings must pay for.
 *   fromSavings = everything taken out that year (the required withdrawal included); extra = fromSavings - need, the part of a
 *   required withdrawal not needed for spending (the engine puts it back into the taxable account).
 *   buckets: where it comes from, in the order the engine takes it (cash first, then the plan's withdrawal order), with the
 *   names of the accounts of that kind.
 * Round 4, 2026-11-02: the page showed four "first year" spending figures and never an amount to take out.
 */
export function firstYear(plan, params = {}) {
  let p = null;
  try { p = computeProjection(plan, params); } catch { p = null; }
  if (!p?.ready) return null;
  const r = p.rows.find((x) => x.retired);
  if (!r) return null;
  const pl = r.priceLevel || 1, real = (n) => (Number(n) || 0) / pl;
  const w = r.withdrawn ?? {};
  const order = ["cash", ...(p.inputs.withdrawalOrder ?? ["taxable", "deferred", "free"]).filter((b) => b !== "cash")];
  const names = (b) => (plan.accounts ?? []).filter((a) => BUCKET_OF[a.type] === b && (Number(a.balance) || 0) > 0).map((a) => a.name).filter(Boolean);
  const buckets = order.filter((b) => (w[b] ?? 0) > 0.5).map((b) => ({ bucket: b, amount: real(w[b]), accounts: names(b) }));
  const fromSavings = buckets.reduce((t, b) => t + b.amount, 0);
  const taxes = real(r.taxes), spending = r.spendingReal, income = r.incomeReal;
  const need = Math.max(0, spending + real(r.eventOut) + taxes - income);
  // what the required withdrawal adds to that year's federal tax, at the brackets (round 8, widow-2: "after about $2,412 of tax
  // on it" was the plan's quick 15%; for her it is $3,429, since it also makes $13,666 more of Social Security taxable)
  // (verify 2026-11-06: in this year's row, on top of the first adult's own pay this year, which the projection does not hold)
  const todayYear = Number(String(params.today ?? "").slice(0, 4)) || null;
  const i = p.rows.indexOf(r), bt = withdrawalTax(plan);
  const requiredTax = r.rmd > 0 ? addedTax(rowIncome(r, p.inputs, bt, i > 0 ? p.rows[i - 1].balances.taxable : p.inputs.balances.taxable, r.year === todayYear ? payThisYear(plan, params.today) : 0), r.rmd, r, bt).added / pl : 0;
  const lines = r.incomeLines ?? [];
  const sources = [];
  if (lines.some((x) => /social security/i.test(x.name ?? ""))) sources.push("Social Security");
  if (lines.some((x) => /pension/i.test(x.name ?? ""))) sources.push("pension");
  if (lines.some((x) => !/social security|pension/i.test(x.name ?? ""))) sources.push("other income");
  return {
    year: r.year, thisYear: r.year === todayYear, ages: r.ages, spending, health: real(r.eventSpending), healthAdded: healthAdded(p.health), income, sources,
    fromSavings, need, required: real(r.rmd), requiredTax, extra: Math.max(0, fromSavings - need), taxes, other: real(r.eventOut - r.eventSpending), short: real(r.shortfall), buckets,
    affordable: p.affordable, verdict: p.verdict, shortAge: p.shortAge ?? null,
  };
}
