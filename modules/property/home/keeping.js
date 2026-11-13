// modules/property/home/keeping.js -- PURE, and a leaf: it reads no page's compute. The Home page's usual figures, the gain
// that is tax-free on a sale, and the lines of a year of keeping the home. modules/property/home/compute.js draws the page from
// them; modules/retirement/happenings.js reads them for a home that will be sold ("Things that will happen", 2026-11-13). It
// must stay free of any import that leads back to the retirement projection: the Home page's own compute does (through the
// federal estimate), and a file the projection reads at load cannot.
import { escrowParts, escrowSaid, usualParts } from "../../overview/guesses/estimators/home.js";

/** Upkeep is often put at 1% of the value a year (more for older homes); selling costs about 6% (agent and closing); values about 3.5% a year over the long run. */
export const DEFAULTS = { maintenance: 0.01, sellCosts: 0.06, appreciation: 0.035 };
/** Gain on a main home that is tax-free when sold (IRC 121(b)(1)-(2)): $250,000, $500,000 on a joint return. */
export const EXCLUSION = { single: 250000, married_joint: 500000 };

/**
 * keepingLines(plan, e, m, value, today) -> the lines of a year of keeping the home, before the mortgage's interest: property
 * tax and home insurance (typed on the page, the part of the mortgage payment, our guess of what is paid apart, or the tax
 * return's), association dues and upkeep. `e`: the home's entry, `m`: its mortgage (the mortgage page's) or null, `value`:
 * what it is worth. The Home page adds the interest and drops the empty lines; retirement/happenings.js reads the same lines for
 * what running the home costs when it is sold (one sum, two readers).
 */
export function keepingLines(plan, e, m, value, today = null) {
  const n = (v, d) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? d : Number(v));
  const itemized = plan.taxes?.itemized ?? {};
  // the tax and insurance inside the mortgage payment (escrowParts: what Debts takes out of it), counted here once: a figure typed
  // on this page is the one, else the part of the payment (2026-11-07, HD-ESCROW-ONCE: a guessed payment held them and this page
  // left them out). A payment that holds none: the figures typed here, as before
  const inPay = m ? escrowParts(plan, (plan.accounts ?? []).find((a) => a.id === m.id), (plan.debts ?? []).find((x) => x.accountId === m.id), today) : null;
  const typedTax = n(e.propertyTax, null), typedIns = n(e.insurance, null);
  const both = inPay && inPay.tax === null;   // no split to go by: one line for the two
  // "No, I pay them myself" and nothing typed here: the usual tax and insurance for the home, as our guess of what is paid apart
  // (fix round 1, 2026-11-11: the one answer that hid them; about $8,200 a year went missing from the cost of owning)
  const debtRow = m ? (plan.debts ?? []).find((x) => x.accountId === m.id) : null;
  const apart = m && !inPay && debtRow && escrowSaid(plan, debtRow) === "no" ? usualParts(plan, m.id, today) : null;
  const taxLine = typedTax !== null ? { amount: typedTax } : inPay && !both ? { amount: inPay.tax * 12, inPayment: true } : apart && !(n(itemized.propertyTax, 0) > 0) ? { amount: apart.tax * 12, guessed: true } : { amount: n(itemized.propertyTax, 0) };
  const insLine = typedIns !== null ? { amount: typedIns } : inPay && !both ? { amount: inPay.insurance * 12, inPayment: true } : apart ? { amount: apart.insurance * 12, guessed: true } : { amount: 0 };
  return [
    ...(both && typedTax === null && typedIns === null ? [{ key: "tax", label: "Property tax and home insurance, in your mortgage payment", amount: inPay.total * 12, inPayment: true }]
      : [{ key: "tax", label: taxLine.inPayment ? "Property tax, in your mortgage payment" : taxLine.guessed ? "Property tax, paid by you (our guess)" : "Property tax", ...taxLine }, { key: "insurance", label: insLine.inPayment ? "Home insurance, in your mortgage payment" : insLine.guessed ? "Home insurance, paid by you (our guess)" : "Home insurance", ...insLine }]),
    { key: "hoa", label: "Association dues", amount: n(e.hoaMonthly, 0) * 12 },
    { key: "maintenance", label: "Upkeep and repairs", amount: value * n(e.maintenance, DEFAULTS.maintenance) },
  ];
}
