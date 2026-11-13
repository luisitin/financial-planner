// modules/cashflow/shared-costs/compute.js -- PURE. How two people who share costs split them (gap design #22): the costs
// both pay (the Expenses page's month, each cost checked as shared unless left out), and each person's part of them by what
// each takes home, half each, or the couple's own split; what each keeps for themselves after it. A what-if: the choices
// live in whatIfs.shareCosts and are never counted in the plan.
import { compute as computeIncome } from "../income/compute.js";
import { compute as computeExpenses } from "../expenses/compute.js";
import { takeHome, hundred } from "../paycheck/compute.js";
import { isYou, nameIn, nameOf, verbFor } from "../../../core/words.js";

/** The three ways to split: by what each takes home (the default), half each, the couple's own shares. */
export const METHODS = Object.freeze(["income", "equal", "own"]);
/** The words on the chips, in this order. */
export const METHOD_LABELS = Object.freeze({ income: "By income", equal: "Half each", own: "Our own split" });

const num = (v) => (v === null || v === undefined || v === "" || typeof v === "boolean" || !Number.isFinite(Number(v)) ? null : Number(v));
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
const idOf = (p) => (p && p.id !== null && p.id !== undefined && p.id !== "" ? String(p.id) : null);

/**
 * coupleOf(plan) -> { a, b, others }: the two adults who share costs. `a` is the adult marked "Me" (role self), else the
 * first adult; `b` the partner (role partner), else the next adult. Children (role dependent) never share. Other adults
 * (a grown child, a parent living with you) are `others`: not in the split. Fewer than two adults: `b` is null.
 */
export function coupleOf(plan) {
  const people = (plan?.household?.people ?? []).filter((p) => obj(p));
  const adults = people.filter((p) => p.role !== "dependent");
  const a = adults.find((p) => p.role === "self") ?? adults[0] ?? null;
  const b = a ? adults.find((p) => p !== a && p.role === "partner") ?? adults.find((p) => p !== a) ?? null : null;
  return { a, b, others: adults.filter((p) => p !== a && p !== b), people };
}

/** whatIfs.shareCosts read with its defaults: { method ("income" unless one of METHODS), own ({ [personId]: fraction }), leaveOut (a Set of cost ids) }. */
export function settingsOf(raw) {
  const s = obj(raw) ?? {};
  return {
    method: METHODS.includes(s.method) ? s.method : "income",
    own: obj(s.own) ?? {},
    leaveOut: new Set((Array.isArray(s.leaveOut) ? s.leaveOut : []).filter((x) => typeof x === "string" && x !== "")),
  };
}

/**
 * ownShares(own, idA, idB) -> [shareA, shareB] adding up to 1, or null. Both typed (fractions 0 to 1, not both 0): scaled
 * so they add up to 1. One typed: the other has the rest. Nothing usable: null (the page splits by income).
 */
export function ownShares(own, idA, idB) {
  const ok = (f) => f !== null && f >= 0 && f <= 1;
  const fa = num(obj(own)?.[idA]), fb = num(obj(own)?.[idB]);
  if (ok(fa) && ok(fb)) return fa + fb > 0 ? [fa / (fa + fb), fb / (fa + fb)] : null;
  if (ok(fa)) return [fa, 1 - fa];
  if (ok(fb)) return [1 - fb, fb];
  return null;
}

/** Whole dollars for each part, adding up to the total rounded to the dollar: each part's floor, then the largest remainders take the dollars left. */
export function dollars(parts, total) {
  const want = Math.round(total);
  const out = parts.map((x) => Math.floor(x));
  let left = want - out.reduce((t, x) => t + x, 0);
  const order = parts.map((x, i) => [x - out[i], i]).sort((p, q) => q[0] - p[0] || p[1] - q[1]);
  for (const [, i] of order) { if (left <= 0) break; out[i] += 1; left -= 1; }
  return out;
}

/**
 * The costs to share: every cost on the Expenses page's month going now (each at what it comes to a month,
 * core/math/periods.js), and each payment the Debts page adds to that month (a debt with no bill of its own on Expenses),
 * id "debt:<id>" (one line "debts" when the Debts page's payments are counted together). Taxes not withheld are left out
 * (`taxes`): they come off the income of whoever earns it. One-time costs are not monthly. Largest first.
 * -> { rows: [{ id, name, category, monthly, fromDebts }], taxes }
 */
export function costsOf(plan, { today } = {}) {
  const exp = computeExpenses(plan, { today });
  const rows = [];
  let taxes = 0;
  exp.items.forEach((x, i) => {
    if (!x.active || !(x.monthly > 0.005)) return;
    if (x.category === "taxes") { taxes += x.monthly; return; }
    rows.push({ id: idOf(x) ?? `#${i}`, name: x.name || x.categoryLabel, category: x.categoryLabel, monthly: x.monthly, fromDebts: false });
  });
  if ((exp.fromDebts ?? []).length) for (const r of exp.fromDebts) rows.push({ id: `debt:${r.id}`, name: `${r.name || "Loan"} payment`, category: "From the Debts page", monthly: r.monthly, fromDebts: true });
  else if (exp.debtFromDebts > 0.005) rows.push({ id: "debts", name: "Loan and card payments", category: "From the Debts page", monthly: exp.debtFromDebts, fromDebts: true });
  rows.sort((p, q) => q.monthly - p.monthly);
  return { rows, taxes };
}

/**
 * compute(plan, { today }) -> { ready: false, why: "one-adult" } | {
 *   ready: true, case ("no-costs" | "none-shared" | "no-income" | "one-earner" | "income" | "equal" | "own": which sentence),
 *   method (as worked: "own" without usable shares is "income"), asked (as saved), basis ("take-home" | "income"),
 *   costs: [{ id, name, category, monthly, fromDebts, shared }], count, sharedCount, shared (a month), taxes (left out, a month),
 *   people: [{ key ("a" | "b"), id, income (a month: take-home, or as typed), gross (a month, before the Paycheck page's
 *     take-outs), scaled (true: some of it is the Paycheck page's take-home), share, percent (whole, the two add up to 100),
 *     part (share x shared), dollars (whole, the two add up to shared to the dollar), keeps (income - part) }],
 *   total (both incomes, a month), household (income of the household's own, counted half each), leftOut (income of others
 *   in the household), others (how many other adults), byIncome ([shareA, shareB] | null), byIncomeDollars,
 *   over (shared - total when the costs are more than both incomes, else 0), short ([key] whose part is more than their income)
 * }
 * Formulas (README "Formulas"): shared = sum of the checked costs a month; by income share_i = income_i / (income_a + income_b),
 * where income_i is the person's take-home from the Paycheck page's takeHome() (each salary times its earner's take-home
 * share; a bonus less the flat 22%, Social Security, Medicare and state; other income as typed) plus half the household's
 * own income; half each 1/2; own as typed (ownShares); part_i = share_i x shared; keeps_i = income_i - part_i.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? `${new Date().getFullYear()}-01-01`;
  const { a, b, others, people } = coupleOf(plan);
  if (!a || !b) return { ready: false, why: "one-adult" };
  const s = settingsOf(plan.whatIfs?.shareCosts);
  const { rows, taxes } = costsOf(plan, { today });
  const costs = rows.map((r) => ({ ...r, shared: !s.leaveOut.has(r.id) }));
  const shared = costs.filter((r) => r.shared).reduce((t, r) => t + r.monthly, 0);

  // each person's income a month: the Paycheck page's take-home where it has one, else as typed on Income
  const inc = computeIncome(plan, { today });
  let ratio = {};
  try { ratio = takeHome(plan, { today }).ratio ?? {}; } catch { ratio = {}; }
  const ids = new Set(people.map(idOf).filter(Boolean));
  const ia = idOf(a), ib = idOf(b);
  const who = { a: { income: 0, gross: 0, scaled: false }, b: { income: 0, gross: 0, scaled: false } };
  let household = 0, leftOut = 0, scaled = false;
  for (const x of inc.active) {
    if (x.period === "once" || !(x.monthly > 0.005)) continue;
    const r = num(ratio[x.id]);
    const net = x.monthly * (r === null ? 1 : Math.max(0, Math.min(1, r)));
    const pid = x.personId === null || x.personId === undefined || x.personId === "" ? null : String(x.personId);
    const k = pid && pid === ia ? "a" : pid && pid === ib ? "b" : pid === null || !ids.has(pid) ? "both" : null;
    if (k === null) { leftOut += net; continue; }   // a child's pay, or another adult's
    if (r !== null) scaled = true;
    if (k === "both") {
      household += net;
      for (const w of [who.a, who.b]) { w.income += net / 2; w.gross += x.monthly / 2; if (r !== null) w.scaled = true; }
    } else { who[k].income += net; who[k].gross += x.monthly; if (r !== null) who[k].scaled = true; }
  }
  const total = who.a.income + who.b.income;
  const byIncome = total > 0.005 ? [who.a.income / total, who.b.income / total] : null;

  let method = s.method, shares = null;
  if (method === "equal") shares = [0.5, 0.5];
  if (method === "own") { shares = ownShares(s.own, ia, ib); if (!shares) method = "income"; }
  if (method === "income") shares = byIncome;
  const pct = shares ? hundred({ a: shares[0], b: shares[1] }, 1) : null;
  const whole = shares ? dollars(shares.map((f) => f * shared), shared) : null;
  const out = ["a", "b"].map((key, i) => {
    const w = who[key], share = shares ? shares[i] : null, part = shares ? share * shared : null;
    return { key, id: key === "a" ? ia : ib, income: w.income, gross: w.gross, scaled: w.scaled, share, percent: pct ? pct[key] : null, part, dollars: whole ? whole[i] : null, keeps: part === null ? null : w.income - part };
  });

  const sharedCount = costs.filter((r) => r.shared).length;
  const kind = !costs.length ? "no-costs" : !(shared > 0.005) ? "none-shared" : method !== "income" ? method : !byIncome ? "no-income" : byIncome.some((f) => f <= 1e-9) ? "one-earner" : "income";
  const over = total > 0.005 && shared > total + 0.5 ? shared - total : 0;
  const short = shares && method !== "income" ? out.filter((p) => p.part > p.income + 0.5).map((p) => p.key) : [];
  return {
    ready: true, case: kind, method, asked: s.method, basis: scaled ? "take-home" : "income",
    costs, count: costs.length, sharedCount, shared, taxes,
    people: out, total, household, leftOut, others: others.length,
    byIncome, byIncomeDollars: byIncome ? dollars(byIncome.map((f) => f * shared), shared) : null,
    over, short,
  };
}

/** The two names as a sentence uses them: the first adult as typed ("Me" is "you"); a partner with no name is "your partner". */
export function namesOf(plan) {
  const { a, b } = coupleOf(plan);
  const na = a?.name ?? "", nb = b?.name ?? "";
  return { a: na, b: isYou(nb) && isYou(na) ? "My partner" : nb };
}

const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const usd = (n) => `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;

/**
 * answerFor(d, names, money) -> { head, say }: the headline and the one sentence under it, written out for every case
 * (docs/OPTIONAL.md R3, R5). names: { a, b } as namesOf gives them; money(n) -> "$1,234".
 */
export function answerFor(d, names = {}, money = usd) {
  if (!d?.ready) return { head: "Sharing costs as a couple", say: "This is for two people who share costs." };
  const na = names.a ?? "", nb = names.b ?? "";
  const A = nameIn(na), B = nameIn(nb);
  const [pa, pb] = d.people;
  const puts = (n) => verbFor(n, "puts", "put");
  switch (d.case) {
    case "no-costs": return { head: "No costs to share yet", say: "List the bills you pay each month on Expenses, and this page splits them between you." };
    case "none-shared": return { head: "No costs are checked as shared", say: "Check the ones you share under \"Which costs are shared\" below." };
    case "no-income": return { head: "Neither of you has pay on Income yet", say: "Add what each of you earns on Income to split by it, or pick Half each." };
    case "one-earner": {
      const [x, y] = pa.share > 0 ? [na, nb] : [nb, na];
      const covers = verbFor(x, "covers", "cover");
      return { head: `Splitting by income: ${nameIn(x)} ${covers} all ${money(Math.round(d.shared))} a month.`, say: `${cap(nameIn(y))} ${verbFor(y, "has", "have")} no pay on Income, so ${nameIn(x)} ${covers} it all. Or pick Half each.` };
    }
    case "income": return {
      head: `Splitting by income: ${A} ${puts(na)} in ${money(pa.dollars)} a month, ${B} ${money(pb.dollars)}.`,
      say: d.basis === "take-home" ? `That is ${pa.percent}% and ${pb.percent}%, the same shares as your take-home pay.` : `That is ${pa.percent}% and ${pb.percent}%, the same shares as your income.`,
    };
    case "equal": {
      const head = pa.dollars === pb.dollars ? `Half each: ${A} and ${B} each put in ${money(pa.dollars)} a month.` : `Half each: ${A} ${puts(na)} in ${money(pa.dollars)} a month, ${B} ${money(pb.dollars)}.`;
      const differs = d.byIncome && Math.abs(d.byIncome[0] - 0.5) >= 0.005;
      return { head, say: differs ? `Split by income, ${A} would put in ${money(d.byIncomeDollars[0])} and ${B} ${money(d.byIncomeDollars[1])}.` : `That splits ${money(Math.round(d.shared))} of shared costs a month down the middle.` };
    }
    default: return {   // "own"
      head: `Your own split: ${A} ${puts(na)} in ${money(pa.dollars)} a month, ${B} ${money(pb.dollars)}.`,
      say: `That is ${pa.percent}% and ${pb.percent}% of ${money(Math.round(d.shared))} of shared costs a month.`,
    };
  }
}

/**
 * alarmFor(d, names, money) -> the amber line, never folded (R9), or null: the shared costs are more than both incomes;
 * else, half each or your own split, neither has pay (all of it from savings) or one person's part is more than their income.
 */
export function alarmFor(d, names = {}, money = usd) {
  if (!d?.ready || !(d.shared > 0.005)) return null;
  const take = d.basis === "take-home";
  if (d.over > 0) return `Your shared costs, ${money(Math.round(d.shared))} a month, are more than the ${money(Math.round(d.total))} you both ${take ? "take home" : "bring in"}. Spend less, or check the amounts on Expenses.`;
  const key = d.short[0];
  if (!key) return null;
  // neither has pay (half each, or your own split): no one can help the other, so all of it comes from savings
  if (d.people.every((x) => !(x.income > 0.005))) return `Neither of you has pay on Income, so all ${money(Math.round(d.shared))} a month of shared costs has to come from savings.`;
  const p = d.people.find((x) => x.key === key), y = key === "a" ? names.a ?? "" : names.b ?? "", x = key === "a" ? names.b ?? "" : names.a ?? "";
  if (!(p.income > 0.005)) return `${cap(nameIn(y))} ${verbFor(y, "has", "have")} no pay on Income, so ${nameOf(y)} part, ${money(p.dollars)} a month, has to come from savings or from ${nameIn(x)}.`;
  return `${cap(nameOf(y))} part, ${money(p.dollars)} a month, is more than ${nameIn(y)} ${take ? verbFor(y, "takes", "take") : verbFor(y, "brings", "bring")} ${take ? "home" : "in"} (${money(Math.round(p.income))}).`;
}
