// modules/career/business/costs.js -- PURE. Costs a self-employed person often forgets to count (gap list, next 60, item 6;
// map P10): nine rows, each saying what counts in one line, and whether the page already counts it (with the figure) or
// where it goes (the box or the kind of expense, one tap away). Nothing here is counted: it reads compute()'s result
// and the page's own boxes. The rules are read from the IRS (README, "Costs people often forget to count"), 2026-11-16.
import { homeOffice } from "./compute.js";
import { HOME_OFFICE } from "./data/business.js";

export const MISSED_TITLE = "Costs people often forget to count";
export const MISSED_INTRO = "Costs the tax law lets a self-employed person count that are easy to leave out. Nothing here is counted by itself: tap one that applies to put it where it goes.";
export const MISSED_SOURCES = "From the IRS's tax guide for small business (Publication 334, 2025, which replaced Publication 535) and its guides to the home office, cars, education and health insurance.";

/**
 * The rows, in the order a person meets them. `counts`: what counts, in one line. `go`: where the person puts it: a box
 * of "The business" (`box`), a kind of expense (`kind`, its add form opens with that kind picked), another page
 * (`href`), or nothing (counted by itself). `label`: the button's words.
 */
export const CHECKLIST = Object.freeze([
  { key: "office", title: "Home office", counts: "A space used only and regularly for the business: $5 a square foot, up to 300 square feet.", go: { box: "homeOfficeSqft" }, label: "Type the square feet" },
  { key: "miles", title: "Business miles", counts: "Driving for the work at the IRS rate a mile, not the drive from home to a regular workplace; parking and tolls count on top.", go: { box: "miles" }, label: "Type the miles" },
  { key: "health", title: "Health insurance you pay", counts: "Medical, dental and long-term care insurance for you and your family, for months no employer's plan could cover you.", go: { box: "healthPremiums" }, label: "Type what you pay" },
  { key: "retire", title: "Retirement savings", counts: "What you put into a SEP-IRA, a solo 401(k) or a SIMPLE IRA for yourself comes off income.", go: { href: "#/retirement/contributions" }, label: "Retirement contributions" },
  { key: "seHalf", title: "Half the self-employment tax", counts: "Half of the Social Security and Medicare tax on the profit comes off income; there is nothing to do.", go: null, label: "" },
  { key: "phone", title: "Phone and internet", counts: "The business share of your phone and internet bills; never the base rate of a home's first landline.", go: { kind: "phone" }, label: "Add the bill" },
  { key: "supplies", title: "Supplies and software", counts: "Supplies, materials and postage used up in the year, and the software or subscriptions that run the business.", go: { kind: "supplies" }, label: "Add supplies" },
  { key: "professional", title: "Accountant and lawyer", counts: "Fees for an accountant, a lawyer or tax advice for the business, and preparing the business part of your tax return.", go: { kind: "professional" }, label: "Add the fees" },
  { key: "education", title: "Courses for your work", counts: "Courses, books and seminars that keep up or improve a skill for the work you do now; not training for a new line of work.", go: { kind: "education" }, label: "Add a course" },
]);
/** The expense kinds each row reads (what is typed under them is what the row counts). */
export const ROW_KINDS = Object.freeze({ phone: ["phone"], supplies: ["supplies", "software"], professional: ["professional"], education: ["education"] });

const pos = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const whole = (n) => Math.round(n).toLocaleString("en-US");

/** What is typed on the page a year for each kind of expense (the Self-employment page's one figure is not a kind). */
export function typedByKind(d) {
  const out = {};
  for (const e of d?.expenses ?? []) if (!e.fromSelfEmployment) out[e.category] = (out[e.category] ?? 0) + (Number(e.yearly) || 0);
  return out;
}

/**
 * checklist(d, s) -> { items: [{ key, title, counts, state, amount, said, go, label }], missing }
 *   d: compute()'s result; s: plan.whatIfs.business (the boxes as typed).
 *   state: "counted" (the page counts it; amount is the figure), "limited" (typed, counted only up to the profit: the
 *   home office or the health insurance, with what was typed allowed beside it),
 *   "typedNone" (typed, none counts this year: no profit for it), "add" (not counted yet: the button), "elsewhere" (not
 *   part of the profit: it comes off income on another page), "auto" (counted by itself), "none" (nothing to count).
 *   missing: how many rows are "add"; ready: the page has a business (missedStatus counts nothing before it has).
 */
export function checklist(d, s = {}, money = (n) => `$${whole(n)}`) {
  const ready = !!d?.ready;
  const typed = typedByKind(d);
  const items = CHECKLIST.map((row) => {
    let state = "add", amount = 0, said = "Not counted yet.";
    if (row.key === "office") {
      // the square feet that count (300 at most) and what they would allow; the profit can cut it (money critic F5)
      const sq = Math.min(pos(s.homeOfficeSqft), HOME_OFFICE.maxSqft), full = homeOffice(sq);
      if (ready && d.homeOffice > 0.5 && d.homeOffice < full - 0.5) { state = "limited"; amount = d.homeOffice; said = `Counted: ${money(amount)} of the ${money(full)} for ${whole(sq)} square feet: it counts only up to the profit.`; }
      else if (ready && d.homeOffice > 0.5) { state = "counted"; amount = d.homeOffice; said = `Counted: ${money(amount)} for ${whole(sq)} square feet.`; }
      else if (pos(s.homeOfficeSqft) > 0) { state = "typedNone"; said = "It counts only up to the profit, so none this year."; }
    } else if (row.key === "miles") {
      if (ready && d.miles?.amount > 0.5) { state = "counted"; amount = d.miles.amount; said = `Counted: ${money(amount)} for ${whole(d.miles.miles)} miles.`; }
    } else if (row.key === "health") {
      const paid = pos(s.healthPremiums), off = ready ? pos(d.tax?.health) : 0;
      if (off > 0.5 && off < paid - 0.5) { state = "limited"; amount = off; said = `Counted: ${money(off)} of the ${money(paid)}: it counts only up to the profit.`; }
      else if (off > 0.5) { state = "counted"; amount = off; said = `Counted: ${money(off)} off the income you pay tax on.`; }
      else if (paid > 0) { state = "typedNone"; said = "It counts only up to the profit, so none this year."; }
    } else if (row.key === "retire") {
      if (ready && d.earned > 0.5) { state = "elsewhere"; said = "This lowers the income you pay tax on; it is not a business cost. The plans and the tax each saves are above."; }
      else { state = "none"; said = "No earnings from the business this year, so nothing can go in from it."; }
    } else if (row.key === "seHalf") {
      if (ready && d.tax?.se > 0.5) { state = "auto"; amount = d.tax.se / 2; said = `The page already takes ${money(amount)} off the income you pay tax on.`; }
      else { state = "none"; said = "No self-employment tax this year, so nothing to take off."; }
    } else {
      const sum = ROW_KINDS[row.key].reduce((t, k) => t + (typed[k] ?? 0), 0);
      if (sum > 0.5) { state = "counted"; amount = sum; said = `Counted: ${money(sum)} a year.`; }
    }
    return { key: row.key, title: row.title, counts: row.counts, state, amount, said, go: state === "add" || state === "elsewhere" ? row.go : null, label: row.label };
  });
  return { items, missing: items.filter((x) => x.state === "add").length, ready };
}

/**
 * The row's status (at most 20 characters): how many are not counted yet; with no business yet, nothing is "not counted"
 * (person critic P2: someone with no business was told 7 costs were missed).
 */
export const missedStatus = (c) => (!c.ready ? "a short list" : c.missing > 0 ? `${c.missing} not counted yet` : "nothing missing");
