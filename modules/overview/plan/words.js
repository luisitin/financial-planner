// modules/overview/plan/words.js -- PURE. Small helpers the path (guide/journeys.js) and "Your plan" (plan/compute.js) share.
// They live here, in the path's own folder, so no other page's compute is touched:
//   goalsWords     the goals line, said once for the Dashboard's Goals tile and Your plan's row (guessedGoals: whose amount is ours)
//   protectionAsks the first test of life-needs' protectionGaps: is there anyone who would need life cover, and pay to replace
//   MONTH_NAMES / monthYear small date words
// (Moves to make later are listed in the build report: alerts/compute.js could export goalsWords, and
// insurance/life-needs/asks.js could hold protectionAsks.)
import { householdRetired } from "../../retirement/projection/compute.js";
import { standing, adults, picks, estimators as SETUP_ESTIMATORS } from "../setup/compute.js";
import { guessTwins, rowOf, estimators as GUESS_ESTIMATORS, TABLES } from "../guesses/compute.js";
import { isGuess, guessesInUse, mergeEstimators } from "../../../core/estimate/index.js";
import { money as fmtMoney } from "../../../core/format.js";

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthYear = (ym) => (/^\d{4}-\d{2}/.test(String(ym ?? "")) ? `${MONTH_NAMES[Number(String(ym).slice(5, 7)) - 1]} ${String(ym).slice(0, 4)}` : "");

/** The goals whose amount is our guess (Get started's home or education goal left blank: `goals[<id>].target` in the ledger). */
export const guessedGoals = (plan) => new Set((plan?.goals ?? []).filter((g) => g && typeof g.id === "string" && isGuess(plan, `goals[${g.id}].target`)).map((g) => g.id));

/**
 * The words for the goals row: "2 reached; 1 goal behind (it needs about $120 more a month)". `gl` is goals/goals' compute,
 * `gb` is goalsBehind(gl, ...). Same sentence as the Dashboard's Goals tile (wording follow-up w017: "3 goals behind (they
 * need about $1,659 more a month); 1 starts in December 2026"); `money` formats a figure. `guessed` (guessedGoals(plan)): the
 * goals whose amount is our guess, so "behind" says it rests on our amount ("1 goal behind by our guess of its amount (it needs
 * about $1,302 more a month)"; C5 hand-off N1). A goal with no amount is never counted as on track: "1 needs an amount" (H1).
 * `short`: the Dashboard's tile, which leaves out a need that rests only on our amounts.
 */
export function goalsWords(gl, gb, money, { guessed = new Set(), short = false } = {}) {
  if (!gl?.count) return "none set yet";
  const behind = gb?.behind ?? [], late = gb?.pastDue?.length ?? 0, queued = gb?.queued ?? [];
  const ours = behind.filter((g) => guessed.has(g.id)).length, blank = (gl.goals ?? []).filter((g) => g.status === "no amount").length;
  const turn = gb?.turn ? monthYear(gb.turn) : "";
  const n = behind.length;
  // `short` (the Dashboard's tile, critic F5: four lines at 320 px): a need worked out only from our amounts is left to Goals and
  // Your plan ("1 goal behind by our guess of its amount; 1 needs an amount"); one on an amount the person gave keeps it (w017)
  const needs = (gb?.need ?? 0) >= 1 && !(short && ours === n) ? ` (${n === 1 ? "it needs" : "they need"} about ${money(gb.need)} more a month)` : "";
  const byOurs = !ours ? "" : ours === n ? ` by our guess of ${n === 1 ? "its amount" : "their amounts"}` : "";
  return [
    gl.done ? `${gl.done} reached` : null,
    n ? `${n} ${n === 1 ? "goal" : "goals"} behind${byOurs}${needs}${ours && ours < n ? `, ${ours} by our guess of ${ours === 1 ? "its amount" : "their amounts"}` : ""}` : null,
    queued.length ? (queued.length === gl.count ? `${gl.count === 1 ? "starts" : "they start"} in ${turn}, after your earlier steps` : `${queued.length} start${queued.length === 1 ? "s" : ""} in ${turn}`) : null,
    late ? `${late} past ${late === 1 ? "its date" : "their dates"}` : null,
    blank ? `${blank} ${blank === 1 ? "needs an amount" : "need amounts"}` : null,
  ].filter(Boolean).join("; ") || "all on track";
}

/**
 * Would anyone need life cover from this household's pay? Not retired, pay on file, and children or a second adult.
 * The same first test life-needs' protectionGaps runs, without the heavy compute behind it.
 */
export function protectionAsks(plan, { today = null } = {}) {
  const people = plan?.household?.people ?? [];
  const kids = people.filter((q) => q.role === "dependent");
  const grown = people.filter((q) => q.role !== "dependent");
  const paid = (plan?.income ?? []).some((x) => ["salary", "bonus", "business"].includes(x?.type) && Number(x.amount) > 0);
  if (!paid || !(kids.length || grown.length > 1)) return false;
  let retired = false;
  try { retired = householdRetired(plan, { today }); } catch { retired = false; }
  return !retired;
}

// ---------------------------------------------------------------- the figures we filled in (moved off setup's reveal screen)
const about = (n) => { const x = Math.abs(Number(n) || 0); if (x < 1000) return Math.round(n / 10) * 10; const step = 10 ** (Math.floor(Math.log10(x)) - 2); return Math.round(n / step) * step; };
const pctOf = (r) => `${(Math.round(r * 1000) / 10).toFixed(1)}%`;
const setupHref = (id) => `#/overview/setup/${id}?back=done&from=plan`;

/** The two modules that make guesses today (the Dashboard's `bigGuessInUse` merges the same pair): each guess's label and weight. */
const OWN = mergeEstimators([{ from: "overview/guesses", estimators: GUESS_ESTIMATORS, tables: TABLES }, { from: "overview/setup", estimators: SETUP_ESTIMATORS }]);
/** Where an estimator's guess comes in the list: its tier and order, as Our guesses for you orders them (999 when unknown). */
const rankOf = (k) => { const d = OWN.estimators[k]; return d ? d.tier * 100 + d.order : 999; };
const LIABILITY = new Set(["mortgage", "credit", "credit_card", "loan", "student_loan", "heloc"]);
/** A guess's figure in words: "about $64,000 a year", "about $450 a month", "about $86,000", "7.2%"; "" for a date or a list. */
function figureWords(e, money) {
  const v = Number(e.v);
  if (!Number.isFinite(v)) return "";
  if (e.u === "rate") return pctOf(v);
  if (e.u === "year") return `about ${money(about(v))} a year`;
  if (e.u === "month") return `about ${money(about(v))} a month`;
  if (e.u === "total") return `about ${money(about(v))}`;
  return "";
}

/**
 * guessList(plan, { today, st? }) -> [{ label, href }]: what we filled in for the person, one plain row each, the ones that matter
 * most first (H2, C2): the month's own figures lead, our pay and then our spending (what the left-over waits for, and what the
 * Dashboard and Needs attention ask for first; critic F4: the spending, nearly all of the month's outgo, came after a card and a
 * 401(k) balance), then a big guess before a small one, in the order Our guesses for you lists them (each estimator's tier and
 * order). Get started's own rows keep their words (the month's spending, a debt or
 * home guessed beside one added later, each home value, each debt's figures, an IRA kind answered "Not sure", Social Security
 * worked out from pay: what setup's done screen listed under "Our guesses for now" before the path); every other guess in use
 * (the pay, retirement savings, what goes in each month, a goal's amount, ...) is one row of its own with its figure. Your plan
 * shows the first three. `st` is setup's standing() when the caller already has it.
 */
export function guessList(plan, { today = null, st = null } = {}) {
  const cur = plan?.meta?.currency ?? "USD";
  const money = (n) => fmtMoney(Math.round(Number(n) || 0), cur);
  const s = st ?? (today ? standing(plan, { today }) : null);
  if (!s) return [];
  const ad = adults(plan);
  const rows = [];
  // the paths a row of Get started's covers, so a guess is never listed twice
  const covered = [];
  // `month`: a row of the month's own figures (the pay, the spending), listed before every other guess
  const add = (label, href, rank, big = true, month = false) => rows.push({ label, href, rank, big, month, i: rows.length });
  if (s.spendGuessed) { add(`Spending: about ${money(about(s.spendGuessed.monthly))} a month${s.spendGuessed.typed > 0 ? `, besides the ${money(s.spendGuessed.typed)} you typed` : ""}`, setupHref("spend"), rankOf("spend.housing"), true, true); covered.push((e) => /^expenses\[setup-x-/.test(e.path)); }
  for (const t of guessTwins(plan)) add(`Is ${t.twinName} the ${t.name.toLowerCase()} we guessed? Tell us, so it counts once`, "#/overview/guesses", rankOf("home.value") - 1);
  for (const a of (plan?.accounts ?? []).filter((x) => x.type === "property" && typeof x.id === "string" && isGuess(plan, `accounts[${x.id}].balance`))) { add(`${a.name}: worth about ${money(a.balance)}`, "#/overview/guesses", rankOf("home.value")); covered.push((e) => e.path === `accounts[${a.id}].balance`); }
  for (const g of s.guessed ?? []) {
    const parts = [g.owed !== undefined ? `still owed about ${money(g.owed)}` : null, g.rate !== null ? `rate ${pctOf(g.rate)}` : null, g.payment !== null ? `${money(g.payment)} a month` : null].filter(Boolean);
    // a mortgage says how long it has to run and from when (the year bought, typed or our guess): "about 28 years left (bought 2024, our guess)"
    if (g.yearsLeft) parts.push(`about ${g.yearsLeft} ${g.yearsLeft === 1 ? "year" : "years"} left (${g.boughtVia === "tap" ? `loan from about ${g.bought}` : g.boughtVia === "stale" ? `loan from about ${g.bought}, our guess` : `bought ${g.bought}${g.boughtVia === "guess" ? ", our guess" : ""}`})`);
    add(`${g.name}: ${parts.join(", ")}`, "#/overview/guesses", rankOf("debt.mortgage.rate"));
  }
  if ((s.guessed ?? []).length) {
    // each debt's rate, payment and what is still owed are in its row above (and a home's year bought, when the row says it)
    const owes = new Set((plan?.accounts ?? []).filter((a) => LIABILITY.has(a.type)).map((a) => `accounts[${a.id}].balance`));
    const bought = (s.guessed ?? []).some((g) => g.boughtVia === "guess" || g.boughtVia === "stale");
    covered.push((e) => /^debts\[[^\]]+\]\.(rate|minPayment)$/.test(e.path) || owes.has(e.path) || (bought && e.k === "home.boughtYear"));
  }
  for (const x of s.iraGuessed ?? []) add(`${ad.length > 1 ? x.name : "Your retirement"}: counted as a regular IRA. Tell us if it is the tax-free kind`, setupHref("have-amounts"), rankOf("account.ira.balance"));
  const ssLine = (s.later ?? []).find((l) => l.key === "ss-estimate");
  if (ssLine) { add(ssLine.label, ssLine.href, rankOf("overview/setup:ss")); covered.push((e) => /^retirement\.socialSecurity\./.test(e.path) || e.k === "overview/setup:ssPaid"); }
  // every other guess in use, one row each, in the words Our guesses for you gives it, with its figure
  let inUse = [];
  try { inUse = guessesInUse(plan); } catch { inUse = []; }
  for (const e of inUse) {
    if (covered.some((c) => c(e))) continue;
    let r = null;
    try { r = rowOf(plan, e, { estimators: OWN.estimators, tables: OWN.tables, today }); } catch { r = null; }
    if (!r || r.fromBank) continue;   // read from the person's own bank files: theirs in all but name (Our guesses lists them apart)
    // the pay: "Your pay before tax" (the line's own name, "Ana's pay", before tax), never "Your pay: pay before tax"
    const label = /^pay\./.test(e.k) ? `${r.record ?? "Your pay"} before tax` : /^goals\[/.test(e.path) && r.record ? `${r.record}${/goal$/i.test(r.record) ? "" : " goal"}` : r.label;
    const fig = /\b(a month|a year)$/.test(label) ? figureWords({ ...e, u: "total" }, money) : figureWords(e, money);
    // a question of Get started's opens with Back and Save leading here again, as the rows above do
    const href = r.href && /^#\/overview\/setup\/[\w-]+$/.test(r.href) ? `${r.href}?back=done&from=plan` : r.href ?? "#/overview/guesses";
    add(fig ? `${label}: ${fig}` : label, href, r.order ?? 999, r.weight === "big", /^pay\./.test(e.k));
  }
  // the pay comes before the spending by its rank (tier 1 against the spending's 3)
  return rows.sort((a, b) => (b.month - a.month) || (b.big - a.big) || (a.rank - b.rank) || (a.i - b.i)).map(({ label, href }) => ({ label, href }));
}

/**
 * notCounted(plan, { today, st? }) -> [{ label, href }]: what is left out of the figures so far (setup's "Not counted yet"):
 * the state's income tax, childcare, tax filed as two returns, and a car loan whose car is not in yet.
 */
export function notCounted(plan, { today = null, st = null } = {}) {
  const s = st ?? (today ? standing(plan, { today }) : null);
  if (!s) return [];
  const rows = (s.later ?? []).filter((l) => !["income", "spend", "accounts", "retire", "ss-estimate"].includes(l.key)).map((l) => ({ label: l.label, href: l.href }));
  const carLoan = (plan?.accounts ?? []).some((a) => a.type === "loan" && (a.id === "setup-owe-car-loan" || /car|auto|vehicle|truck/i.test(a.name ?? "")) && Math.abs(Number(a.balance) || 0) > 0);
  const carIn = (plan?.accounts ?? []).some((a) => a.type === "vehicle" && Number(a.balance) > 0);
  if (carLoan && !carIn) rows.unshift({ label: "Your car: type what it would sell for, so it counts beside its loan", href: setupHref(picks(plan, "have").includes("car") ? "have-amounts" : "have") });
  return rows;
}
