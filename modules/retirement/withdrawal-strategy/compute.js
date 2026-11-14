// modules/retirement/withdrawal-strategy/compute.js -- PURE. The four ways of deciding how much
// to take out each year, run on this household's own numbers: under the plan's expected returns
// and through the worst real stretch of history. What each gives in the first year, what it
// could fall to, and how the money ends up.
import { project, STRATEGIES, guardRule, shareWords } from "../../../core/math/retirement.js";
import { buildInputs, compute as computeProjection, BUCKET_OF, healthAdded, FLOOR_MONTHLY_CEILING, saveSpendingFigure } from "../projection/compute.js";
import { RETURNS } from "../historical/data/returns.js";
// the adults whose Social Security is not in the plan yet (the retirement pages' own notice, ss-notice.js): no trim is asked meanwhile
import { ssMissingFor } from "../../overview/setup/compute.js";
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

// ---- the rule, this year (gap design #31, 2026-11-14): for a household already retired whose plan trims after bad years, does
// the rule say to act now? One calm line and one button on the page, and only then.
const tens = (x) => Math.round(x / 10) * 10;
/** Over twice the trim line, one trim will not bring the share back under it: the line says so (critics' round, P1). */
export const GUARD_FAR = 2;
/**
 * guardNudge({ need, savings, start, guard, monthly, floor, top, rested, spends, unsure }) -> null | { rate, upperAt, lowerAt,
 *   cut, raise, monthly, floor, top, act, to, by, rested, under?, far?, after?, unsure? }
 *   need: what savings pay this year toward spending, health insurance and tax once income has paid what it can (a year; the
 *   tax a Roth conversion adds is not part of it); savings: savings today; start: the starting share of savings (the plan's
 *   `withdrawalRate`); guard: the rule's own numbers (`retirement.guard`, the usual ones when absent); monthly: what the plan
 *   spends a month; floor: the lowest spending the person set a month (0 for none); top: what the plan spent a month before
 *   the page's trim (0 when it never trimmed, or when the figure was changed somewhere else since); rested: the rule was
 *   already followed this year (it acts once a year); spends: what the year really spends a month when income pays for more
 *   than the plan's figure (0 otherwise: the plan's figure is what is spent); unsure: some income is known to be missing
 *   (Social Security not counted yet), so the share is too high and no trim is asked.
 *   rate = need / savings; upperAt = start x upper; lowerAt = start x lower.
 *   act "trim"      rate > upperAt: to = monthly x (1 - cut), to the nearest $10
 *       "trim-floor" ... but the lowest figure set is higher than that: to = the lowest figure
 *       "at-floor"   ... and spending is already at (or, `under`, under) the lowest figure: nothing to do
 *       "raise"     rate < lowerAt and an earlier trim to give back: to = monthly x (1 + raise), to the nearest $10
 *       "raise-top"  ... which would pass the figure before the trim: to = that figure
 *       null        inside the two lines, nothing to raise back to, a raise that would itself pass the trim line
 *                   ((need + 12 x by) / savings > upperAt), a raise to a figure the year already spends (`spends` >= to), a trim
 *                   while `unsure`, a trim whose figure rounds to nothing, or `rested`
 *   by = how far `to` is from `monthly` (a month). For a trim: after = the share once trimmed, (need - 12 x by) / savings, and
 *   far = rate > GUARD_FAR x upperAt. null with no savings, no starting share or no spending figure: no rule to follow.
 */
export function guardNudge({ need = 0, savings = 0, start = 0.04, guard = null, monthly = 0, floor = 0, top = 0, rested = false, spends = 0, unsure = false } = {}) {
  if (!(savings > 0) || !(start > 0) || !(monthly > 0) || !Number.isFinite(need)) return null;
  const g = guardRule(guard), rate = Math.max(0, need) / savings, upperAt = start * g.upper, lowerAt = start * g.lower;
  const out = { rate, upperAt, lowerAt, cut: g.cut, raise: g.raise, monthly, floor: floor > 0 ? floor : 0, top: top > monthly + 0.5 ? top : 0, act: null, to: null, by: null, rested: !!rested, ...(unsure ? { unsure: true } : {}) };
  if (rested) return out;
  if (rate > upperAt) {
    if (unsure) return out;
    const least = out.floor > 0 ? Math.min(out.floor, monthly) : 0;
    const want = tens(monthly * (1 - g.cut));
    if (least > 0 && monthly - least < 0.5) return { ...out, act: "at-floor", ...(out.floor > monthly + 0.5 ? { under: true } : {}) };
    const to = Math.max(want, least), by = monthly - to;
    if (!(to > 0) || by < 0.5) return out;   // a figure too small to trim to the nearest $10
    return { ...out, act: to > want + 0.005 ? "trim-floor" : "trim", to, by, after: Math.max(0, Math.max(0, need) - by * 12) / savings, ...(rate > GUARD_FAR * upperAt ? { far: true } : {}) };
  }
  if (rate < lowerAt && g.raise > 0 && out.top > 0) {
    const want = tens(monthly * (1 + g.raise));
    const to = Math.min(want, out.top), by = to - monthly;
    if (by < 0.5 || (Math.max(0, need) + by * 12) / savings > upperAt) return out;
    if (spends > 0 && spends >= to - 0.5) return out;   // income already pays for that much: the page's answer says so
    return { ...out, act: to < want - 0.005 ? "raise-top" : "raise", to, by };
  }
  return out;
}
/** A share of savings in words, to one decimal: "5.5%". */
const sharePct = (x) => `${Number((x * 100).toFixed(1))}%`;
/** The share taken, beside the rule's lines: "about 5.5%"; "just over 4.8%" or "just under 3.2%" when one decimal would print it
 * as the line itself (never "4.8%, over 4.8%"). */
const takenPct = (x, ...lines) => {
  const s = sharePct(x);
  for (const l of lines) if (l !== null && l !== undefined && sharePct(l) === s && Math.abs(x - l) > 1e-12) return `just ${x > l ? "over" : "under"} ${s}`;
  return `about ${s}`;
};
const usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
/** The way's name as the page shows it, in the sentence: your "Trim after bad years" plan (never "your rule", P2). */
const WAY = () => `"${DESCRIPTIONS.guardrails.name}"`;
/**
 * guardNudgeWords(n, money) -> null | { tone: "warn" | "good", text, button: null | "Plan on $4,050 a month" }: the one line the
 * page shows when the rule says to act (one sentence per case; module.test.mjs reads each). Nothing when it does not, or rested.
 *   trim       -> "This year you take about 5.5% of your savings. Your "Trim after bad years" plan cuts spending above 4.8%, so it says spend 10% less: about $450 a month less."
 *   trim, far  -> "... about $800 a month less. You are far over that line, so this trim may not be enough on its own."
 *   trim-floor -> "... cuts spending above 4.8%, but not under the $4,300 a month you set as your lowest: about $200 a month less."
 *   at-floor   -> "... cuts spending above 4.8%, but you already spend the lowest you set, $4,500 a month, so nothing changes."
 *   at-floor, under -> "... cuts spending above 4.8%, but you already spend less than the lowest you set, $9,000 a month, so nothing changes."
 *   raise      -> "This year you take about 2.9% of your savings. Your "Trim after bad years" plan raises spending back under 3.2%, so you could spend 10% more again: about $410 a month more."
 *   raise-top  -> "... raises spending back under 3.2%, so you could go back to the $4,500 a month you planned before the trim."
 *   (a raise with nothing drawn starts "This year your income pays for what you spend. Your "Trim after bad years" plan raises
 *   spending back when you take under 3.2% of your savings, so ..."; a share over all of the savings starts "This year you need
 *   more than all of your savings.")
 */
export function guardNudgeWords(n, money = usd) {
  if (!n || !n.act || n.rested) return null;
  const pct = (x) => `${Number((x * 100).toFixed(2))}%`;
  const button = n.to ? `Plan on ${money(n.to)} a month` : null;
  if (n.act === "raise" || n.act === "raise-top") {
    // (income pays for everything: "about 0% of your savings" read oddly on the phone)
    const lead = n.rate < 0.0005 ? `This year your income pays for what you spend. Your ${WAY()} plan raises spending back when you take under ${sharePct(n.lowerAt)} of your savings`
      : `This year you take ${takenPct(n.rate, n.lowerAt)} of your savings. Your ${WAY()} plan raises spending back under ${sharePct(n.lowerAt)}`;
    return { tone: "good", button, text: n.act === "raise" ? `${lead}, so you could spend ${pct(n.raise)} more again: about ${money(n.by)} a month more.`
      : `${lead}, so you could go back to the ${money(n.to)} a month you planned before the trim.` };
  }
  const lead = `${n.rate > 1 ? "This year you need more than all of your savings." : `This year you take ${takenPct(n.rate, n.upperAt)} of your savings.`} Your ${WAY()} plan cuts spending above ${sharePct(n.upperAt)}`;
  if (n.act === "at-floor") return { tone: "warn", button: null, text: `${lead}, but you already spend ${n.under ? "less than " : ""}the lowest you set, ${money(n.floor)} a month, so nothing changes.` };
  const far = n.far ? " You are far over that line, so this trim may not be enough on its own." : "";
  if (n.act === "trim-floor") return { tone: "warn", button, text: `${lead}, but not under the ${money(n.to)} a month you set as your lowest: about ${money(n.by)} a month less.${far}` };
  return { tone: "warn", button, text: `${lead}, so it says spend ${pct(n.cut)} less: about ${money(n.by)} a month less.${far}` };
}
/**
 * guardHowWords(n, year) -> the line of "How this is worked out" for a retired household on this rule (one sentence per case):
 *   as usual -> "This year you take about 4.1% of your savings. Your "Trim after bad years" plan trims above 4.8% and raises spending back under 3.2%."
 *   rested   -> "... under 3.2%. You followed it in 2026, so it looks again next year."
 *   nothing drawn -> "This year your income pays for what you spend, so your spending takes nothing from savings. Your ..."
 *   unsure, over the trim line -> "... under 3.2%. Social Security is not counted yet, so this share may be too high and no trim is asked."
 */
export function guardHowWords(n, year = null) {
  if (!n) return "";
  const base = `${n.rate < 0.0005 ? "This year your income pays for what you spend, so your spending takes nothing from savings." : n.rate > 1 ? "This year you need more than all of your savings." : `This year you take ${takenPct(n.rate, n.upperAt, n.lowerAt)} of your savings.`} Your ${WAY()} plan trims above ${sharePct(n.upperAt)} and raises spending back under ${sharePct(n.lowerAt)}.`;
  if (n.rested) return `${base} You followed it${year ? ` in ${year}` : ""}, so it looks again next year.`;
  return n.unsure && n.rate > n.upperAt ? `${base} Social Security is not counted yet, so this share may be too high and no trim is asked.` : base;
}
/**
 * The green line after the nudge's button, and after its "Put it back" (one sentence each):
 *   done   -> "Your plan now spends $4,050 a month (it was $4,500). "Trim after bad years" looks again next year."
 *   done, still over the trim line after the trim -> "Your plan now spends $7,200 a month (it was $8,000). That still takes
 *             more than 4.8% of your savings; "Trim after bad years" looks again next year."
 *   undone -> "Back to $4,500 a month, as before."
 */
export function guardDoneWords(n, money = usd) {
  const still = n.after > n.upperAt && n.to < n.monthly;
  return `Your plan now spends ${money(n.to)} a month (it was ${money(n.monthly)}). ${still ? `That still takes more than ${sharePct(n.upperAt)} of your savings; ${WAY()}` : WAY()} looks again next year.`;
}
export function guardUndoneWords(n, money = usd) { return `Back to ${money(n.monthly)} a month, as before.`; }
/**
 * applyGuardStep(draft, n, { year, shown }): the nudge's button. Writes the plan's spending figure the way Retirement settings
 * does (`saveSpendingFigure`; shown: the figure that page shows now) and `retirement.guardStep = { year, top?, at? }`: the year
 * the rule was followed (it rests until the next), and, after a trim, the figure before it (the most a later raise gives back;
 * an earlier, higher one is kept) with `at`, the figure this tap set: `top` counts only while the plan still spends `at`, so a
 * figure changed somewhere else since is never "raised back" to an old one. A raise that reaches `top` takes both away.
 * Nothing for a case with no figure.
 */
export function applyGuardStep(draft, n, { year, shown = null } = {}) {
  if (!n || !(n.to > 0) || !n.act) return;
  saveSpendingFigure(draft, n.to, shown);
  const step = { year };
  const top = n.act === "trim" || n.act === "trim-floor" ? Math.max(n.top || 0, n.monthly) : n.top > n.to + 0.5 ? n.top : 0;
  if (top > 0) { step.top = top; step.at = n.to; }
  draft.retirement.guardStep = step;
}
/**
 * What the plan holds of the rule's last step: { year, top } (0 for none), read with defaults. With `yearNow`, a year after it
 * (a clock that was wrong, a figure typed by hand) is no step at all; with `monthly` (what the plan spends a month now), `top`
 * counts only while that is still the figure the step set (`at`, to the dollar).
 */
export function guardStepOf(rt, { yearNow = null, monthly = null } = {}) {
  const s = rt?.guardStep && typeof rt.guardStep === "object" ? rt.guardStep : {};
  const year = Number(s.year), top = Number(s.top), at = Number(s.at);
  if (!(Number.isInteger(year) && year > 0) || (yearNow !== null && year > yearNow)) return { year: 0, top: 0 };
  const stale = monthly !== null && !(Math.abs(at - monthly) < 1);
  return { year, top: top > 0 && Number.isFinite(top) && !stale ? top : 0 };
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
 *   way that takes a share: one more run of the engine for each such way that runs out), guardNow? ({ year, ...guardNudge }:
 *   the rule this year, only for a household already retired whose plan trims after bad years and is not held) }
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
  let guardRun = null;
  const rows = Object.keys(STRATEGIES).map((key) => {
    const run = project({ ...byWay[key], strategy: key });
    if (key === "guardrails") guardRun = run;
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
  // the rule this year (gap design #31): only for a household already retired whose plan trims after bad years
  let guardNow = null;
  const g0 = guardRun?.rows[0];
  if (b.inputs.strategy === "guardrails" && !chosenRow?.held && g0?.retired) {
    const bal = byWay.guardrails.balances ?? {}, savings = ["cash", "taxable", "deferred", "free"].reduce((t, k) => t + (Number(bal[k]) || 0), 0);
    const monthly = (b.figureMonthly ?? 0) > 0 ? b.figureMonthly : planned / 12;
    const step = guardStepOf(plan.retirement, { yearNow: g0.year, monthly });
    // the year's tax before any Roth conversion: the conversion's own tax comes from savings on top and is no reason to spend
    // less (the engine tests the rule the same way, `taxSpend`): the first year of the same run with no conversion in it
    const tax = g0.conversion > 0 ? (project({ ...byWay.guardrails, strategy: "guardrails", rothConversion: null, endYear: byWay.guardrails.startYear }).rows[0]?.taxes ?? g0.taxes) : g0.taxes;
    const gap = g0.spending + (g0.eventSpending ?? 0) + tax - g0.income;
    // (income that pays for more than the plan's figure sets what the year spends: no raise to a figure already spent, P3;
    // Social Security not counted yet: the share is too high, so no trim is asked, M2)
    const n = guardNudge({ need: Math.max(0, gap), savings, start: b.inputs.withdrawalRate, guard: b.inputs.guard, monthly, floor: own.floor, top: step.top, rested: step.year === g0.year,
      spends: gap < 0.5 ? g0.spending / 12 : 0, unsure: ssMissingFor(plan).length > 0 });
    if (n) guardNow = { year: g0.year, ...n };
  }
  return { ready: true, rows, worstStartYear: worst?.startYear ?? null, chosen: b.inputs.strategy, chosenHeld: chosenRow?.held ?? null, spendingYearly: planned, withdrawalRate: b.inputs.withdrawalRate, endYear: b.inputs.endYear, figureMonthly: b.figureMonthly ?? null,
    ...(own.set ? { own } : {}), ...(floorWarn ? { floorWarn } : {}), ...(guardNow ? { guardNow } : {}) };
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
