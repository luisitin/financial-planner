// modules/estate/legacy/compute.js -- PURE and heavy. What you want to leave and to whom: people and
// causes, as amounts in today's money. Their total, less the home if it is part of what you leave, is
// the amount the plan aims to still have at its end. Does the plan leave it, and if not, what would:
// each lever solved by Goal seek with that amount as the goal.
import { project } from "../../../core/math/retirement.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { compute as computeGoalSeek, firstLevers } from "../../scenarios/goal-seek/compute.js";
import { countedBalance, isLiability } from "../../balance/net-worth/compute.js";
import { compute as computeBeneficiaries, ESTATE } from "../beneficiaries/compute.js";
import { compute as computeWorksheet } from "../will-worksheet/compute.js";
import { ageOn } from "../../../core/math/dates.js";

export const KINDS = { person: "A person", charity: "A charity or cause" };

/**
 * listedLevers(levers) -> the changes "Does the plan leave it?" lists: Goal seek's levers that are changes a person can make (not
 * `info`: the return it needs is information, never a change; fix round 1, 2026-11-12, B3) and not "same", at most five, in Goal
 * seek's first-view order (firstLevers: what is worth money and what gets there on its own first; fix round 2, 2026-11-13). The page
 * shows the first three and folds the rest.
 */
export const listedLevers = (levers) => { const { shown, more } = firstLevers((levers ?? []).filter((l) => l && !l.info && l.status !== "same")); return [...shown, ...more].slice(0, 5); };

/** The amount the plan should still hold at its end for the legacy: the bequests' total, less the home when it is part of it. Also Goal seek's starting goal. */
export function legacyTarget(plan) {
  const L = plan.estate?.legacy ?? {};
  const total = (L.bequests ?? []).reduce((s, b) => s + Math.max(0, Number(b.amount) || 0), 0);
  const home = L.includeHome ? (plan.accounts ?? []).filter((a) => a.type === "property").reduce((s, a) => s + countedBalance(a), 0) : 0;
  return { total, home, target: Math.max(0, total - home) };
}

/**
 * compute(plan, { today }) -> {
 *   bequests: [{ id, to, kind, kindLabel, amount, share (of the total) }], total, people, charity, home, includeHome, target,
 *   ready, missing, endReal (what the plan leaves in investments, today's dollars), meets, gap, levers (Goal seek's, for the target) | null
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const L = plan.estate?.legacy ?? {};
  const t = legacyTarget(plan);
  const bequests = (L.bequests ?? []).map((b) => ({ id: b.id, to: b.to ?? "", kind: KINDS[b.kind] ? b.kind : "person", kindLabel: KINDS[b.kind] ?? KINDS.person, amount: Math.max(0, Number(b.amount) || 0), notes: b.notes ?? "", share: t.total > 0 ? Math.max(0, Number(b.amount) || 0) / t.total : 0 }));
  const sum = (kind) => bequests.filter((b) => b.kind === kind).reduce((s, b) => s + b.amount, 0);
  const out = { bequests, total: t.total, people: sum("person"), charity: sum("charity"), home: t.home, includeHome: !!L.includeHome, target: t.target };
  const b = buildInputs(plan, { today });
  if (!b.inputs) return { ...out, ready: false, missing: b.missing ?? [] };
  const r = project(b.inputs);
  const endReal = Math.max(0, r.endBalanceReal);
  const meets = r.success && endReal >= t.target - 0.5;
  const gs = t.target > 0 ? computeGoalSeek(plan, { today, legacy: t.target }) : null;
  return { ...out, ready: true, missing: [], endReal, success: r.success, meets, gap: Math.max(0, t.target - endReal), endYear: b.inputs.endYear, levers: gs?.ready ? gs.levers : null };
}

// ---------------------------------------------------------------- who gets what, as one picture (gap list, next 60, item 15)
// What each person or cause would receive from the plan's accounts, property and life policies today: what is held together
// goes to the other owner; then whoever is named on an account's form (it passes outside the will); then the will's wishes
// (Choices to take to a lawyer's "Who gets what") for the rest; what is left is "No one named". Nothing is saved, nothing
// here changes compute() above, and only the view calls it. Information, not legal advice: the README says what is a rule
// and what is this page's own model.

/** The part's title (a title qa/first-view-lib.mjs pins) and the words of the part with no one named (what it means is
 * the line under its bar, `unnamedWords`: a three-line title at 320 px pushed the amount aside). */
export const WHO_TITLE = "Who gets what";
export const UNNAMED = "Nobody named yet";
/** The row's line when nobody is named in the case drawn (was "not set yet", which did not say what; three words, as before). */
export const NO_NAMES = "nobody named yet";
/** Rows of people drawn before the rest fold into one "N others" row. */
export const MAX_ROWS = 6;
/** Said once on the page, under the picture. */
export const NOT_ADVICE = "Information, not legal advice: the forms, how each thing is titled and your state's rules decide.";
/** Ties between gaps of the same amount go in this order. */
export const GAP_ORDER = ["gone", "unnamed", "estate", "nobackup", "minor", "minorWill", "nowill", "unsigned"];

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const dollars = (n) => `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
/** "A", "A and B", "A, B and 3 more" (at most two names, then a count). */
export function fewNames(names) {
  const l = names.filter(Boolean);
  if (l.length <= 2) return l.join(" and ");
  return `${l.slice(0, 2).join(", ")} and ${l.length - 2} more`;
}
const andAll = (l) => (l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} and ${l[l.length - 1]}`);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** A list from the plan without its empty entries (a null person, account or row is skipped, never read). */
const listIn = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);

/** A will of this adult marked signed on Estate documents (its own `status`, or the older `done` tick). */
function willSigned(plan, adultId, single) {
  return (plan.estate?.documents ?? []).some((r) => r && r.kind === "will" && ((r.personId ?? "") === adultId || (single && !(r.personId ?? "")))
    && (r.status === "done" || (!["done", "started", "none"].includes(r.status) && !!r.done)));
}

/**
 * Shares of one list of names on a form, as fractions: every share blank -> equal; a blank among typed ones -> 0; a sum over
 * 100% is scaled down to 100%. -> { list: [{ name, personId, s }], sum (at most 1) }
 */
export function formShares(list) {
  const l = (list ?? []).filter((b) => b && clean(b.name));
  if (!l.length) return { list: [], sum: 0 };
  const blank = l.every((b) => b.share === null || b.share === undefined || b.share === "");
  let out = l.map((b) => ({ name: clean(b.name), personId: b.personId ?? "", s: blank ? 1 / l.length : Math.max(0, Number(b.share) || 0) }));
  const sum = out.reduce((t, b) => t + b.s, 0);
  if (sum > 1) out = out.map((b) => ({ ...b, s: b.s / sum }));
  return { list: out, sum: Math.min(1, sum) };
}

/**
 * whoGetsWhat(plan, { today, dies }) -> {
 *   ready (something to picture), couple, cases: [{ id, label }] (a couple: one per adult, then "both"; one adult: none),
 *   dies (the case drawn: an adult's id, "both", or "" for one adult), dead: [{ id, name }], total,
 *   rows: [{ key, name, amount, share, joint, named, will, others? }] (largest first; at most MAX_ROWS, the rest as one "N others" row),
 *   unnamed: { amount, share, things: [{ name, value }] } | null, kept: { names, amount } | null (what a survivor owns alone),
 *   debts (what the household owes, not taken off), any (a form in the picture names someone or the estate, wishes are
 *   written for someone alive in this case, or a will of someone who died is signed),
 *   wishes (the wishes split the rest), signed (every person who died has a signed will), gap: { id, amount, thing, name, names, things },
 *   goals: [{ name, amount }] (one adult, or everyone died: the people and causes on this page's own list who get nothing in
 *   the picture and have no special gift written for them), status (the part's line: "2 names" or "no one named yet")
 * }
 * Pure: reads the plan, never changes it. `dies` is a view choice, never stored. An empty entry in a list of the plan (a
 * null person, account, policy or form) is skipped, never read.
 */
export function whoGetsWhat(plan, params = {}) {
  const today = params.today ?? null;
  const people = listIn(plan.household?.people);
  // the two pages read through their own computes get the same lists without the empty entries (a null person threw inside
  // Beneficiary audit's, and the whole Legacy goals page with it)
  const tidy = { ...plan, household: { ...(plan.household ?? {}), people }, accounts: listIn(plan.accounts), insurance: { ...(plan.insurance ?? {}), policies: listIn(plan.insurance?.policies) },
    estate: { ...(plan.estate ?? {}), beneficiaries: listIn(plan.estate?.beneficiaries), documents: listIn(plan.estate?.documents) } };
  const grown = people.filter((p) => p.role !== "dependent");
  const adults = grown.length ? grown : [{ id: "", name: "", role: "self" }];
  const couple = adults.length >= 2;
  const byId = new Map(people.filter((p) => p.id).map((p) => [p.id, p]));
  const byName = (name) => { const n = norm(name); const hits = people.filter((p) => n && norm(p.name) === n); return hits.length === 1 ? hits[0] : null; };
  const ownerOf = (ownerId) => (!ownerId ? null : adults.find((a) => a.id && a.id === ownerId) ?? adults.find((a) => norm(a.name) && norm(a.name) === norm(ownerId)) ?? null);
  const first = adults.find((a) => a.role === "self") ?? adults[0];
  const cases = couple ? [...adults.map((a) => ({ id: a.id, label: `If ${clean(a.name) || "one of you"} died` })), { id: "both", label: adults.length === 2 ? "If both died" : "If all of you died" }] : [];
  const dies = couple ? (cases.some((c) => c.id === params.dies) ? params.dies : first.id) : "";
  const dead = !couple ? [adults[0]] : dies === "both" ? adults : adults.filter((a) => a.id === dies);
  const deadIds = new Set(dead.map((a) => a.id));
  const alive = adults.filter((a) => !deadIds.has(a.id));
  const single = !couple;

  // who a name on a form or in the wishes is: the estate (Beneficiary audit's own words for it: it is no one, and what it
  // gets goes by the will, through the courts), a person of the household (by id, else by the same name), else the name typed
  const whoIs = (name, personId) => {
    if (ESTATE.test(clean(name))) return { key: "estate", name: clean(name), person: null, gone: false, estate: true };
    const p = (personId && byId.get(personId)) || byName(name);
    if (p) return { key: `p:${p.id}`, name: clean(p.name) || clean(name), person: p, gone: false };
    return { key: `n:${norm(name)}`, name: clean(name), person: null, gone: !!personId };
  };
  const isDead = (r) => !!r.person && deadIds.has(r.person.id) && r.person.role !== "dependent";
  const minorNow = (r) => !!r.person && r.person.role === "dependent" && !!r.person.birthDate && !!today && ageOn(r.person.birthDate, today) < 18;

  // the things: accounts worth something, and the life policies Beneficiary audit lists (its own values and names)
  const ben = computeBeneficiaries(tidy, { today });
  const formOf = new Map(ben.items.map((x) => [x.key, x]));
  const wholeOn = tidy.insurance.policies.filter((x) => x.kind === "whole" && !(x.endDate && today && x.endDate < today)).map((x) => x.personId ?? "");
  const things = [];
  let kept = 0, debts = 0;
  for (const a of tidy.accounts) {
    if (isLiability(a.type)) { debts += countedBalance(a); continue; }
    const value = Math.max(0, countedBalance(a));
    if (!(value > 0)) continue;
    const owner = ownerOf(a.ownerId);
    // the savings inside a whole life policy are part of its death benefit, already counted with the policy
    if (a.type === "cash_value_life" && wholeOn.some((pid) => !pid || !owner || pid === owner.id)) continue;
    const together = couple && !owner;
    if (!together && couple && !deadIds.has(owner.id)) { kept += value; continue; }
    const form = formOf.get(`account:${a.id}`) ?? null;
    things.push({ key: `account:${a.id}`, name: clean(a.name) || "An account", value, together, form });
  }
  for (const x of ben.items.filter((i) => i.source === "policy")) {
    const value = Math.max(0, Number(x.value) || 0);
    if (!(value > 0)) continue;
    const insured = ownerOf(x.ownerId);
    if (insured && !deadIds.has(insured.id)) continue;
    things.push({ key: x.key, name: clean(x.name) || "Life insurance", value, together: false, form: x });
  }

  const rows = new Map();
  const give = (r, amount, way) => {
    if (!(amount > 0)) return;
    const row = rows.get(r.key) ?? { key: r.key, name: r.name, joint: 0, named: 0, will: 0 };
    row[way] += amount;
    rows.set(r.key, row);
  };
  const willParts = [];             // [{ thing, amount }] what goes by the will
  const found = [];                 // gap candidates
  let named = false;                // a form in the picture names someone (alive or not) or the estate: something is written
  for (const t of things) {
    // a. held together: the owners who are alive take it, in equal parts (joint with right of survivorship)
    if (t.together && alive.length) { for (const a of alive) give({ key: `p:${a.id}`, name: clean(a.name) || "The other owner" }, t.value / alive.length, "joint"); continue; }
    // b. a form names someone: the first choices alive, then the backups, by their shares
    const prim = formShares(t.form?.primary);
    // a form that names no one, or only at 0%, gives it to no one
    if (t.form && !(prim.sum > 0)) found.push({ id: "unnamed", amount: t.value, thing: t.name });
    if (prim.list.length) {
      named = true;
      const pass = (fs) => {
        const who = fs.list.map((b) => ({ ...b, r: whoIs(b.name, b.personId) }));
        const live = who.filter((b) => !isDead(b.r) && b.s > 0);
        const liveSum = live.reduce((s, b) => s + b.s, 0);
        if (!live.length || !(liveSum > 0)) return null;
        return live.map((b) => ({ r: b.r, s: (b.s / liveSum) * fs.sum }));
      };
      let got = pass(prim);
      if (!got) {
        const back = formShares(t.form.contingent);
        got = back.list.length ? pass({ list: back.list, sum: prim.sum }) : null;
        if (!got && !back.list.length) found.push({ id: "nobackup", amount: t.value * prim.sum, thing: t.name, names: prim.list.map((b) => whoIs(b.name, b.personId).name) });
      }
      if (got) {
        let given = 0;
        for (const g of got) {
          const amount = t.value * g.s;
          // the estate on a form is no one: its share goes by the will, through the courts (probate), left in willParts below
          if (g.r.estate) { found.push({ id: "estate", amount, thing: t.name }); continue; }
          given += amount;
          give(g.r, amount, "named");
          if (g.r.gone) found.push({ id: "gone", amount, thing: t.name, name: g.r.name });
          if (minorNow(g.r)) found.push({ id: "minor", amount, thing: t.name, name: g.r.name });
        }
        if (t.value - given > 0.005) willParts.push({ thing: t, amount: t.value - given });
        continue;
      }
    }
    // c. everything else: by the will
    willParts.push({ thing: t, amount: t.value });
  }

  // the will's wishes for the rest (Choices to take to a lawyer), without anyone who died; else no one named
  const sheet = computeWorksheet(tidy, { today }).values;
  const wishList = (sheet.rest ?? []).map((w) => ({ r: whoIs(w.name, ""), s: Math.max(0, Number(w.share) || 0) })).filter((w) => w.r.name && !w.r.estate && w.s > 0);
  const liveWishes = wishList.filter((w) => !isDead(w.r));
  const wishSum = liveWishes.reduce((s, w) => s + w.s, 0);
  const W = willParts.reduce((s, p) => s + p.amount, 0);
  const wishes = liveWishes.length > 0 && wishSum > 0;
  let unnamed = null;
  if (W > 0 && wishes) for (const w of liveWishes) {
    const amount = W * (w.s / wishSum);
    give(w.r, amount, "will");
    // a child under 18 by the will: the will (Choices to take to a lawyer's "Age each child gets their share") says when
    if (minorNow(w.r) && !sheet.childrenAge) found.push({ id: "minorWill", amount, name: w.r.name });
  }
  else if (W > 0) {
    const by = new Map();
    for (const p of willParts) by.set(p.thing.key, { name: p.thing.name, value: (by.get(p.thing.key)?.value ?? 0) + p.amount });
    unnamed = { amount: W, things: [...by.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)) };
  }

  const total = things.reduce((s, t) => s + t.value, 0);
  const signed = dead.every((a) => willSigned(tidy, a.id ?? "", single));
  // something written for this case: a form in the picture names someone, wishes name someone alive, or a will is signed
  const any = named || wishes || dead.some((a) => willSigned(tidy, a.id ?? "", single));
  // the rows: largest first; past MAX_ROWS the smallest fold into one "N others"
  let list = [...rows.values()].map((r) => ({ ...r, amount: r.joint + r.named + r.will })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  if (list.length > MAX_ROWS) {
    const rest = list.slice(MAX_ROWS - 1);
    const sum = (k) => rest.reduce((s, r) => s + r[k], 0);
    list = [...list.slice(0, MAX_ROWS - 1), { key: "others", name: `${rest.length} others`, joint: sum("joint"), named: sum("named"), will: sum("will"), amount: sum("amount"), others: rest.map((r) => r.name) }];
  }
  list = list.map((r) => ({ ...r, share: total > 0 ? r.amount / total : 0 }));
  if (unnamed) unnamed.share = total > 0 ? unnamed.amount / total : 0;

  // the people and causes on this page's own list (what you want to leave) who get nothing here: one adult, or everyone died
  // (the list is for the end of the plan), leaving out anyone who died and anyone with a special gift written for them
  const goals = new Map();
  if (alive.length === 0) {
    const gifted = new Set((sheet.specific ?? []).filter((g) => clean(g.to)).map((g) => whoIs(g.to, "").key));
    for (const b of listIn(plan.estate?.legacy?.bequests)) {
      const amount = Math.max(0, Number(b.amount) || 0), r = whoIs(b.to, "");
      if (!r.name || !(amount > 0) || r.estate || isDead(r) || rows.has(r.key) || gifted.has(r.key)) continue;
      goals.set(r.key, { name: goals.get(r.key)?.name ?? r.name, amount: (goals.get(r.key)?.amount ?? 0) + amount });
    }
  }

  // the biggest gap: nothing written at all first (when something here takes a form: else the will's part is the gap); else
  // the most money; else all is well
  let gap;
  if (!any && things.some((t) => t.form)) gap = { id: "nothing", amount: total };
  else {
    if (W > 0 && !wishes && !signed) found.push({ id: "nowill", amount: W, things: unnamed ? unnamed.things.map((x) => x.name) : [] });
    if (W > 0 && wishes && !signed) found.push({ id: "unsigned", amount: W });
    const best = found.filter((c) => c.amount > 0.005).sort((a, b) => b.amount - a.amount || GAP_ORDER.indexOf(a.id) - GAP_ORDER.indexOf(b.id))[0];
    gap = best ?? { id: W > 0 ? "okWill" : "ok", amount: 0 };
  }
  const names = list.reduce((n, r) => n + (r.others ? r.others.length : 1), 0);
  return {
    ready: total > 0 || kept > 0, couple, cases, dies, dead: dead.map((a) => ({ id: a.id ?? "", name: clean(a.name) })), total, rows: list, unnamed,
    kept: couple && kept > 0 && alive.length ? { names: alive.map((a) => clean(a.name)), amount: kept } : null,
    debts, any, wishes, signed, gap, goals: [...goals.values()],
    // the line counts who gets something; with no one (nothing written, or every name given nothing or gone in this case) it says so
    status: any && names > 0 ? `${names} ${names === 1 ? "name" : "names"}` : NO_NAMES,
  };
}

// ---------------------------------------------------------------- the words, one written sentence per case (R5)
/** The sentence over the picture: nothing passes; one adult; one of a couple; both (or all). */
export function ledeWords(d, money = dollars) {
  if (!(d.total > 0)) return "Nothing in your plan would pass on in this case.";
  if (!d.couple) return `If you died today, ${money(d.total)} would go to:`;
  if (d.dies === "both") return `If ${d.cases.length > 3 ? "you all" : "you both"} died today, ${money(d.total)} would go to:`;
  return `If ${d.dead[0]?.name || "one of you"} died today, ${money(d.total)} would go to:`;
}
/** How a row gets what it gets, in words: one way alone, or each way with its amount. */
export function detailWords(row, money = dollars) {
  if (row.others) return fewNames(row.others);
  const ways = [["joint", "as the other owner"], ["named", "named on the forms"], ["will", "by your wishes for the will"]].filter(([k]) => row[k] > 0.005);
  if (ways.length === 1) return ways[0][1];
  return ways.map(([k, w]) => `${money(row[k])} ${w}`).join(", ");
}
/** The line under "No one named yet": what it means, then the biggest things in it. */
export const unnamedWords = (u) => {
  const things = fewNames((u?.things ?? []).map((x) => x.name));
  return things ? `by the will or the state's rules: ${things}` : "by the will or the state's rules";
};
/** The biggest gap, one written sentence per case. */
export function gapWords(gap, money = dollars) {
  switch (gap?.id) {
    case "nothing": return "No account or policy names anyone yet: Beneficiary audit shows who is named on each.";
    case "gone": return `${gap.thing} names ${gap.name}, who is no longer in your plan: check that form on Beneficiary audit.`;
    case "unnamed": return `${gap.thing} (${money(gap.amount)}) names no one, so it would go through the will or the courts: name someone on its form.`;
    case "estate": return `${gap.thing} (${money(gap.amount)}) names your estate, so it would go through the will and the courts (probate): name a person on its form.`;
    case "nobackup": return `${gap.thing} names only ${andAll(gap.names)}, so if ${gap.names.length === 1 ? gap.names[0] : "they"} died too it would go through the will or the courts: name a backup on its form.`;
    case "minor": return `${gap.name} is under 18 and can't receive ${gap.thing} directly: name a custodian or a trust on its form.`;
    case "minorWill": return `${gap.name} is under 18 and can't receive ${money(gap.amount)} by the will directly: write the age ${gap.name} gets it on Choices to take to a lawyer, and ask the lawyer about a trust.`;
    case "nowill": return `Without a will, the state's rules decide who gets ${fewNames(gap.things)} (${money(gap.amount)}): write your wishes on Choices to take to a lawyer.`;
    case "unsigned": return `Your wishes cover ${money(gap.amount)}, but no signed will is on Estate documents: until there is one, the state's rules decide.`;
    case "okWill": return "Every account here names someone, and the rest goes by a signed will.";
    default: return "Everything here passes by its form or to the other owner.";
  }
}
/** The page each gap's sentence sends the person to, or null. */
export const GAP_LINKS = { nothing: "#/estate/beneficiaries", gone: "#/estate/beneficiaries", unnamed: "#/estate/beneficiaries", estate: "#/estate/beneficiaries", nobackup: "#/estate/beneficiaries", minor: "#/estate/beneficiaries", minorWill: "#/estate/will-worksheet", nowill: "#/estate/will-worksheet", unsigned: "#/estate/documents" };
/** One of a couple died: what the other owns alone stays theirs. */
export function keptWords(d, money = dollars) {
  if (!d.kept) return "";
  return d.kept.names.length === 1 ? `What ${d.kept.names[0]} owns alone (${money(d.kept.amount)}) stays with ${d.kept.names[0]}.` : `What the others own alone (${money(d.kept.amount)}) stays with them.`;
}
/**
 * The people and causes on this page's own list who get nothing in the picture (one adult, or everyone died): the list is a
 * goal for the plan, not a will; a sum of money for one person is a special gift on Choices to take to a lawyer. "" for none.
 */
export function goalsWords(d, money = dollars) {
  const l = d?.goals ?? [];
  if (!l.length) return "";
  const amount = money(l.reduce((s, g) => s + g.amount, 0));
  if (l.length === 1) return `${cap(l[0].name)} (${amount}), on your list above, gets nothing here: the list is a goal for the plan, not a will, so write it as a special gift on Choices to take to a lawyer.`;
  return `${cap(fewNames(l.map((g) => g.name)))} (${amount}), on your list above, get nothing here: the list is a goal for the plan, not a will, so write them as special gifts on Choices to take to a lawyer.`;
}
/** Debts are not taken off the picture. */
export const debtWords = (d, money = dollars) => (d.debts > 0 ? `What you owe (${money(d.debts)}) is not taken off: a loan on a home goes with the home, and other debts are usually paid before anyone gets the rest.` : "");
/** The order things pass in: a couple (what is held together first) or one adult. */
export const ruleWords = (d) => (d.couple
  ? "What you own together goes to the other owner; whoever is named on an account's form comes next, whatever the will says; the will's wishes cover the rest."
  : "Whoever is named on an account's form gets it, whatever the will says; the will's wishes cover the rest.");
