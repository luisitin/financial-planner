// modules/estate/gifting/compute.js -- PURE. Gifts you plan or have made, against the yearly amount each
// giver can give each person tax-free (the annual exclusion): what is over it (a gift tax return, Form
// 709, and part of the lifetime exemption used; no tax until that is gone), a couple splitting gifts,
// and a 529 college plan front-loaded with five years of gifts at once.
import { annualExclusionFor, exclusionFor, SUPERFUND_YEARS, ANNUAL_EXCLUSION } from "./data/transfer-tax.js";

export const KINDS = { cash: "Money", "529": "529 college plan", other: "Something else (property, shares)" };

/**
 * compute(plan, { today }) -> {
 *   year, annualExclusion, lifetimeExclusion, givers: [{ id, name }], couple,
 *   gifts: [{ ...gift, givers: [{ id, name, share }], split (halved: the couple split that year), splitByElection (split only because
 *     another gift that year is from both), years: [year...] (five when its 529 total is spread), spread (1 or 5) }],
 *   splitYears: [year...] (years with a gift from both: every gift by either of you that year is halved),
 *   elections: [{ year, giverId, giverName, to, total, elected, excess, fifth, years }] (529 totals spread over five years),
 *   byYear: [{ year, annualExclusion, rows: [{ to, giverId, giverName, counted, room, over }], overTotal, needs709 }],
 *   thisYear: { rows, overTotal, needs709 } | null,
 *   lifetimeUsed: { [giverId]: taxable gifts so far }, lifetimeLeft: { [giverId] },
 *   superfund: { perGiver, couple } (the most a 529 can take at once without using the lifetime exemption),
 *   count, warnings, notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : Math.max(...Object.keys(ANNUAL_EXCLUSION).map(Number));
  const people = plan.household?.people ?? [];
  const givers = people.filter((p) => p.role !== "dependent").map((p) => ({ id: p.id, name: p.name }));
  const couple = givers.length >= 2;
  const nameOf = (id) => givers.find((g) => g.id === id)?.name ?? "You";
  const annualExclusion = annualExclusionFor(year), lifetimeExclusion = exclusionFor(year);
  const warnings = [], notes = [];
  const $ = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  const toKey = (to) => String(to ?? "").trim().toLowerCase();
  const toName = (to) => String(to ?? "").trim() || "Someone";
  const raw = (plan.estate?.gifts ?? []).map((g) => ({ g, amount: Math.max(0, Number(g.amount) || 0), y0: Number(g.year) || year, both: g.from === "both" && couple, giverId: g.from && givers.some((x) => x.id === g.from) ? g.from : givers[0]?.id ?? "" }));
  // a gift from both is the couple's consent to split gifts for that year, and the consent covers every gift either of
  // them made to others that year: each is counted half each (IRC 2513(a)(2); 26 CFR 25.2513-1(b)(5); Form 709)
  const splitYears = [...new Set(raw.filter((r) => r.both).map((r) => r.y0))].sort((a, b) => a - b);
  const gifts = raw.map(({ g, amount, y0, both, giverId }) => {
    const split = couple && splitYears.includes(y0);
    const from = split ? givers.slice(0, 2).map((x) => ({ id: x.id, name: x.name, share: 0.5 })) : [{ id: giverId, name: nameOf(giverId), share: 1 }];
    return { ...g, amount, year: y0, givers: from, split, splitByElection: split && !both, years: [y0], spread: 1 };
  });
  // 529 gifts: one total per giver, child and year (IRC 529(c)(2)(B), "such aggregate amount"). With the five-year
  // election ticked on any of them and the total over that year's allowance, up to 5 x the allowance is counted a fifth a
  // year for five years and the rest in the first year (proposed 26 CFR 1.529-5(b)(2); Form 709); at or under the
  // allowance there is nothing to spread: it counts in its own year.
  const groups = new Map();
  for (const g of gifts) if (g.kind === "529") for (const f of g.givers) {
    const k = `${f.id}|${toKey(g.to)}|${g.year}`;
    const e = groups.get(k) ?? { giverId: f.id, giverName: f.name, to: toName(g.to), year: g.year, total: 0, marked: false, gifts: [] };
    e.total += g.amount * f.share; e.marked = e.marked || !!g.superfund; e.gifts.push(g); groups.set(k, e);
  }
  const elections = [];
  const entries = [];   // { year, to, giverId, giverName, amount }: what counts against each year's allowance
  for (const g of gifts) if (g.kind !== "529") for (const f of g.givers) entries.push({ year: g.year, to: toName(g.to), giverId: f.id, giverName: f.name, amount: g.amount * f.share });
  for (const e of groups.values()) {
    const ex = annualExclusionFor(e.year), cap = SUPERFUND_YEARS * ex;
    if (e.marked && e.total > ex) {
      const elected = Math.min(e.total, cap), years = Array.from({ length: SUPERFUND_YEARS }, (_, k) => e.year + k);
      const el = { year: e.year, giverId: e.giverId, giverName: e.giverName, to: e.to, total: e.total, elected, excess: e.total - elected, fifth: elected / SUPERFUND_YEARS, years };
      elections.push(el);
      years.forEach((y, k) => entries.push({ year: y, to: e.to, giverId: e.giverId, giverName: e.giverName, amount: el.fifth + (k === 0 ? el.excess : 0) }));
      for (const g of e.gifts) if (g.superfund) { g.spread = SUPERFUND_YEARS; g.years = years; }
      if (el.excess > 0) warnings.push(`${e.to}'s 529 from ${couple ? e.giverName : "you"} in ${e.year}: only ${SUPERFUND_YEARS} x the yearly limit (${$(cap)}) can be spread over five years; the other ${$(el.excess)} counts in ${e.year}.`);
    } else {
      entries.push({ year: e.year, to: e.to, giverId: e.giverId, giverName: e.giverName, amount: e.total });
      if (e.marked) notes.push(`${e.to}'s 529 from ${couple ? e.giverName : "you"} in ${e.year} is ${$(e.total)}, within the yearly ${$(ex)}, so there is nothing to spread over five years: it simply counts in ${e.year}.`);
    }
  }
  // every year with a gift: per recipient and giver, what counts against that year's allowance
  const allYears = [...new Set(entries.map((x) => x.year))].sort((a, b) => a - b);
  const lifetimeUsed = Object.fromEntries(givers.map((g) => [g.id, 0]));
  const byYear = allYears.map((y) => {
    const ex = annualExclusionFor(y);
    const map = new Map();
    for (const x of entries) if (x.year === y) {
      const k = `${toKey(x.to)}|${x.giverId}`;
      const r = map.get(k) ?? { to: x.to, giverId: x.giverId, giverName: x.giverName, counted: 0 };
      r.counted += x.amount; map.set(k, r);
    }
    const rows = [...map.values()].map((r) => ({ ...r, room: Math.max(0, ex - r.counted), over: Math.max(0, r.counted - ex) }));
    for (const r of rows) if (r.over > 0 && lifetimeUsed[r.giverId] !== undefined) lifetimeUsed[r.giverId] += r.over;
    const overTotal = rows.reduce((s, r) => s + r.over, 0);
    // a return (Form 709): anything over, a year the couple splits gifts, or a 529 election starting
    return { year: y, annualExclusion: ex, rows, overTotal, needs709: overTotal > 0 || splitYears.includes(y) || elections.some((el) => el.year === y) };
  });
  const lifetimeLeft = Object.fromEntries(givers.map((g) => [g.id, Math.max(0, lifetimeExclusion - lifetimeUsed[g.id])]));
  if (gifts.some((g) => g.splitByElection)) notes.push("In a year with a gift from both of you, every other gift either of you made to someone else that year is split half each too: the choice to split covers the whole year.");
  const thisYear = byYear.find((b) => b.year === year) ?? null;
  return {
    year, annualExclusion, lifetimeExclusion, givers, couple, gifts, splitYears, elections, byYear, thisYear,
    lifetimeUsed, lifetimeLeft,
    superfund: { perGiver: SUPERFUND_YEARS * annualExclusion, couple: SUPERFUND_YEARS * annualExclusion * Math.min(2, Math.max(1, givers.length)) },
    count: gifts.length, warnings, notes,
  };
}
