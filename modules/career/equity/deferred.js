// modules/career/equity/deferred.js -- PURE, imports nothing. Pay held for later: deferred pay plans from work (pay the
// employer keeps back now and pays out later, in one year or in equal yearly parts; taxed as pay when paid). The years each
// plan pays out and what, in today's dollars. Shared by Equity compensation (the page, with the tax on each year) and Will
// the money last? (retirement/projection buildInputs: each payout as income in its year). README "Pay held for later".
//
// equity.deferred: [{ id, name, personId, balance, yearly, untilYear, years, startYear, growth }]
//   balance    what is in it now (today's dollars)
//   yearly     what goes in each year, from next year (this year's is taken as in the balance)
//   untilYear  the last year it goes in (absent: the year before it starts paying)
//   years      the yearly parts it pays in (1 = all in one year; absent = 1; at most DEFERRED_MAX_YEARS)
//   startYear  the first year it pays (absent or null: the year its owner stops work)
//   growth     a year, after prices (absent = 0: it keeps up with prices only)
//   personId   whose plan (absent: equity.personId, else the first adult)

export const DEFERRED_MAX_YEARS = 30;
export const DEFERRED_GROWTH = { min: -0.1, max: 0.15 };
// stored data the form cannot make (an import, a hand edit): a first year at most this many years ahead, and at most this much in
// it or going in a year (the form's money boxes stop under a billion), so every figure stays finite and the work stays short
// (a start year of 2,000,000,000 looped two billion contribution years: ten seconds a draw; $1e308 grew to Infinity)
export const DEFERRED_AHEAD = 100;
export const DEFERRED_MAX_MONEY = 1e12;
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const pos = (v) => Math.min(DEFERRED_MAX_MONEY, Math.max(0, num(v) ?? 0));

/**
 * The adults the way Will the money last? reads them (buildInputs): a birth date, a retirement age (theirs, else the
 * plan's, else 65); stopYear = birth year + retirement age, the first year they no longer work.
 */
export function adultsOf(plan) {
  const a = plan?.assumptions ?? {};
  return (plan?.household?.people ?? []).filter((p) => p && p.role !== "dependent").map((p) => {
    const birthYear = p.birthDate ? Number(String(p.birthDate).slice(0, 4)) : null;
    const retireAge = Number(p.retirementAge ?? a.retirementAge ?? 65);
    return { id: p.id, name: p.name ?? "", role: p.role, birthYear: Number.isFinite(birthYear) ? birthYear : null, retireAge, stopYear: Number.isFinite(birthYear) && Number.isFinite(retireAge) ? birthYear + retireAge : null };
  });
}

/** An entry that holds something: money in it now or money going in. */
export const holdsMoney = (e) => !!e && typeof e === "object" && (pos(e.balance) > 0 || pos(e.yearly) > 0);

/**
 * payouts(entry, { year, stopYear }) -> { startYear, placed, atStop, late, years, growth, contributions, value, part, rows: [{ year, amount }] }
 * Y0 = year; S = the start year (the entry's, or stopYear when it pays from leaving work), never before Y0 (`late` when
 * moved) nor after Y0 + DEFERRED_AHEAD; N = years; g = growth; B = balance and C = yearly (each at most DEFERRED_MAX_MONEY);
 * U = untilYear (absent: S - 1).
 *   contributions k = max(0, min(U, S - 1) - Y0) (0 when nothing goes in)
 *   value V = B (1 + g)^(S - Y0) + sum over y = Y0+1 .. Y0+k of C (1 + g)^(S - y)
 *   part  P = V / a, a = sum over j = 0 .. N-1 of (1 + g)^(-j) (N when g = 0): equal yearly parts, what is left growing
 * Not placed (no start year: it pays from leaving work and its owner has no birth date): no rows.
 */
export function payouts(entry, { year, stopYear = null } = {}) {
  const B = pos(entry?.balance), C = pos(entry?.yearly);
  const N = Math.min(DEFERRED_MAX_YEARS, Math.max(1, Math.round(num(entry?.years) ?? 1)));
  const g = Math.min(DEFERRED_GROWTH.max, Math.max(DEFERRED_GROWTH.min, num(entry?.growth) ?? 0));
  const atStop = num(entry?.startYear) === null;
  const wanted = atStop ? stopYear : Math.round(num(entry.startYear));
  if (wanted === null || !Number.isFinite(wanted)) return { startYear: null, placed: false, atStop, late: false, years: N, growth: g, contributions: 0, value: 0, part: 0, rows: [] };
  const S = Math.min(year + DEFERRED_AHEAD, Math.max(year, wanted));
  const U = num(entry?.untilYear) === null ? S - 1 : Math.round(num(entry.untilYear));
  const k = C > 0 ? Math.max(0, Math.min(U, S - 1) - year) : 0;
  let V = B * Math.pow(1 + g, S - year);
  for (let y = year + 1; y <= year + k; y++) V += C * Math.pow(1 + g, S - y);
  let a = 0;
  for (let j = 0; j < N; j++) a += Math.pow(1 + g, -j);
  const P = V / a;
  const rows = Array.from({ length: N }, (_, j) => ({ year: S + j, amount: P }));
  return { startYear: S, placed: true, atStop, late: S > wanted, years: N, growth: g, contributions: k, value: V, part: P, rows };
}

/** Whose plan: the entry's person, else the person Equity compensation is about, else the first adult. */
export function ownerOf(plan, entry, adults = adultsOf(plan)) {
  const want = entry?.personId || plan?.equity?.personId || "";
  return adults.find((p) => p.id === want) ?? adults.find((p) => p.role === "self") ?? adults[0] ?? null;
}

/** The plans that hold something, each with its owner and its payouts (rows in today's dollars). */
export function deferredPlans(plan, { year } = {}) {
  const list = Array.isArray(plan?.equity?.deferred) ? plan.equity.deferred.filter(holdsMoney) : [];
  if (!list.length) return [];
  const adults = adultsOf(plan);
  return list.map((e) => {
    const owner = ownerOf(plan, e, adults);
    return { id: e.id, name: String(e.name ?? "").trim(), personId: owner?.id ?? null, owner, entry: e, ...payouts(e, { year, stopYear: owner?.stopYear ?? null }) };
  });
}

/**
 * The payouts as Will the money last?'s income lines (core/math/retirement.js `incomes`), one per placed plan: in today's
 * dollars, raised with prices (`cola`), from its first year to its last; `pretax`: taxed like money out of a pre-tax account
 * (the plan's one simple rate, or ordinary income with the brackets); `notInMonth`: new money today's month does not hold,
 * so a payout before the household retires is saved after its tax; `deferred`: the plan's id (true for one stored without an
 * id), the mark Retire early and "Income counted" read these lines by. No plan, no line.
 */
export function deferredIncomes(plan, { year } = {}) {
  return deferredPlans(plan, { year }).filter((d) => d.placed && d.part > 0).map((d) => ({
    name: `Pay held for later${d.name ? `: ${d.name}` : ""}`, yearly: d.part, personId: d.personId, startAge: 0,
    fromYear: d.startYear, untilYear: d.startYear + d.years - 1, cola: true, taxable: true, pretax: true, notInMonth: true, type: "other", deferred: d.id || true,
  }));
}
