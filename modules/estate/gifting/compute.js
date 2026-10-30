// modules/estate/gifting/compute.js -- PURE. Gifts you plan or have made, against the yearly amount each
// giver can give each person tax-free (the annual exclusion): what is over it (a gift tax return, Form
// 709, and part of the lifetime exemption used; no tax until that is gone), a couple splitting gifts,
// and a 529 college plan front-loaded with five years of gifts at once.
import { annualExclusionFor, exclusionFor, SUPERFUND_YEARS, ANNUAL_EXCLUSION } from "./data/transfer-tax.js";

export const KINDS = { cash: "Money", "529": "529 college plan", other: "Something else (property, shares)" };

/**
 * compute(plan, { today }) -> {
 *   year, annualExclusion, lifetimeExclusion, givers: [{ id, name }], couple,
 *   gifts: [{ ...gift, givers: [{ id, name, share }], years: [year...], perYearByGiver: { [giverId]: [the amount counted in each of those years] }, spread }],
 *   byYear: [{ year, rows: [{ to, giverId, giverName, counted, room, over }], overTotal, needs709 }],
 *   thisYear: { rows, overTotal, needs709 } | null,
 *   lifetimeUsed: { [giverId]: taxable gifts so far }, lifetimeLeft: { [giverId] },
 *   superfund: { perGiver, couple } (the most a 529 can take at once without using the lifetime exemption),
 *   count, warnings
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
  const warnings = [];
  const gifts = (plan.estate?.gifts ?? []).map((g) => {
    const amount = Math.max(0, Number(g.amount) || 0);
    const y0 = Number(g.year) || year;
    // who gives: one person, or both (a couple can split any gift, half each, on Form 709)
    const from = g.from === "both" && couple ? givers.slice(0, 2).map((x) => ({ id: x.id, name: x.name, share: 0.5 })) : [{ id: g.from && givers.some((x) => x.id === g.from) ? g.from : givers[0]?.id ?? "", name: nameOf(g.from && givers.some((x) => x.id === g.from) ? g.from : givers[0]?.id), share: 1 }];
    const spread = g.kind === "529" && g.superfund ? SUPERFUND_YEARS : 1;
    const years = Array.from({ length: spread }, (_, k) => y0 + k);
    // a 529 spread over five years: up to five times the first year's exclusion is counted a fifth a year; anything above it counts in the first year
    const cap = SUPERFUND_YEARS * annualExclusionFor(y0);
    const perYearByGiver = Object.fromEntries(from.map((f) => {
      const mine = amount * f.share;
      if (spread === 1) return [f.id, [mine]];
      const spreadable = Math.min(mine, cap);
      return [f.id, years.map((_, k) => spreadable / spread + (k === 0 ? mine - spreadable : 0))];
    }));
    return { ...g, amount, year: y0, givers: from, years, perYearByGiver, spread };
  });
  // every year with a gift: per recipient and giver, what counts against that year's exclusion
  const allYears = [...new Set(gifts.flatMap((g) => g.years))].sort((a, b) => a - b);
  const lifetimeUsed = Object.fromEntries(givers.map((g) => [g.id, 0]));
  const byYear = allYears.map((y) => {
    const ex = annualExclusionFor(y);
    const map = new Map();
    for (const g of gifts) if (g.years.includes(y)) for (const f of g.givers) {
      const k = `${String(g.to ?? "").trim().toLowerCase()}|${f.id}`;
      const e = map.get(k) ?? { to: String(g.to ?? "").trim() || "Someone", giverId: f.id, giverName: f.name, counted: 0 };
      e.counted += g.perYearByGiver[f.id][y - g.year]; map.set(k, e);
    }
    const rows = [...map.values()].map((r) => ({ ...r, room: Math.max(0, ex - r.counted), over: Math.max(0, r.counted - ex) }));
    for (const r of rows) if (r.over > 0 && lifetimeUsed[r.giverId] !== undefined) lifetimeUsed[r.giverId] += r.over;
    const overTotal = rows.reduce((s, r) => s + r.over, 0);
    return { year: y, annualExclusion: ex, rows, overTotal, needs709: overTotal > 0 || gifts.some((g) => g.years[0] === y && (g.from === "both" || g.spread > 1)) };
  });
  const lifetimeLeft = Object.fromEntries(givers.map((g) => [g.id, Math.max(0, lifetimeExclusion - lifetimeUsed[g.id])]));
  for (const g of gifts) if (g.kind === "529" && g.superfund && g.amount / g.givers.length > SUPERFUND_YEARS * annualExclusionFor(g.year)) warnings.push(`${g.to}'s 529: only ${SUPERFUND_YEARS} x the yearly limit per giver can be spread over five years; the rest counts in the first year.`);
  const thisYear = byYear.find((b) => b.year === year) ?? null;
  return {
    year, annualExclusion, lifetimeExclusion, givers, couple, gifts, byYear, thisYear,
    lifetimeUsed, lifetimeLeft,
    superfund: { perGiver: SUPERFUND_YEARS * annualExclusion, couple: SUPERFUND_YEARS * annualExclusion * Math.min(2, Math.max(1, givers.length)) },
    count: gifts.length, warnings,
  };
}
