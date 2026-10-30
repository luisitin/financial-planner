// modules/taxes/documents/compute.js -- PURE. The forms to expect for a tax year, worked out from the plan:
// a W-2 for each job, 1099s for a business, interest, dividends and sales, a 1098 for mortgage and student
// loan interest, an SSA-1099 for Social Security, a 1099-R for retirement withdrawals, the HSA's forms, the
// marketplace's 1095-A, college's 1098-T; when each should arrive, and which have arrived (ticked by you).
import { compute as computeIncome } from "../../cashflow/income/compute.js";

/** When each form is due to you (IRS instructions for each form; brokers' 1099-B and composite statements by February 15). */
export const DUE = { jan31: "by January 31", feb15: "by February 15", may31: "by May 31 (after the deadline: it confirms the contribution)", mar15: "by March 15 (K-1s often come later)" };

/** The expected forms: [{ key, form, what, from, due, why }]. */
export function expected(plan, { today } = {}) {
  const out = [];
  const add = (key, form, what, from, due, why) => out.push({ key, form, what, from, due, why });
  const inc = computeIncome(plan, { today });
  const people = plan.household?.people ?? [];
  const nameOf = (id) => people.find((p) => p.id === id)?.name ?? "You";
  const accounts = plan.accounts ?? [];
  const typeIs = (...t) => accounts.filter((a) => t.includes(a.type) && Number(a.balance) !== 0);
  for (const x of inc.active.filter((y) => ["salary", "bonus"].includes(y.type))) add(`w2:${x.personId || x.id}`, "W-2", `${nameOf(x.personId)}'s pay and tax withheld`, x.name, DUE.jan31, "there is a job on Income");
  const seen = new Set();
  for (const k of out) seen.add(k.key);
  for (const x of inc.active.filter((y) => y.type === "business")) add(`nec:${x.id}`, "1099-NEC or 1099-K", `${nameOf(x.personId)}'s business income from clients or payment apps`, x.name, DUE.jan31, "there is a business on Income");
  for (const a of typeIs("savings", "checking", "cash")) if (a.type === "savings") add(`int:${a.id}`, "1099-INT", "interest of $10 or more", a.name, DUE.jan31, "you have a savings account");
  for (const a of typeIs("brokerage", "crypto")) add(`b:${a.id}`, a.type === "crypto" ? "1099-DA" : "1099 composite (DIV, INT, B)", "dividends, interest and sales", a.name, DUE.feb15, a.type === "crypto" ? "you hold crypto, and brokers report its sales from 2025" : "you have an investment account");
  for (const a of typeIs("mortgage")) add(`1098:${a.id}`, "1098", "mortgage interest and property tax paid", a.name, DUE.jan31, "you have a mortgage");
  for (const a of typeIs("student_loan")) add(`1098e:${a.id}`, "1098-E", "student loan interest (up to $2,500 deductible)", a.name, DUE.jan31, "you have a student loan");
  for (const x of inc.active.filter((y) => y.type === "social")) add(`ssa:${x.personId || x.id}`, "SSA-1099", `${nameOf(x.personId)}'s Social Security`, "Social Security", DUE.jan31, "Social Security is on Income");
  for (const x of inc.active.filter((y) => y.type === "pension")) add(`1099r:${x.id}`, "1099-R", "pension or retirement-account payments", x.name, DUE.jan31, "a pension is on Income");
  for (const a of typeIs("hsa")) { add(`5498sa:${a.id}`, "5498-SA", "health savings account contributions", a.name, DUE.may31, "you have a health savings account (HSA)"); add(`1099sa:${a.id}`, "1099-SA", "health savings account money spent", a.name, DUE.jan31, "you have a health savings account (HSA)"); }
  for (const a of typeIs("ira", "roth")) add(`5498:${a.id}`, "5498", "IRA contributions and the year-end value", a.name, DUE.may31, "you have an IRA");
  if (inc.active.some((y) => y.type === "rental")) add("rental", "Your own records", "rent received and the property's costs (Schedule E)", "Rental", DUE.jan31, "rent is on Income");
  if ((plan.insurance?.health?.plans ?? []).length || plan.retirement?.aca) add("1095a", "1095-A", "marketplace health cover, if you bought it there", "the marketplace", DUE.jan31, "it settles the marketplace's premium tax credit");
  if (people.some((p) => p.role === "dependent" && p.birthDate && Number(String(today ?? "2026").slice(0, 4)) - Number(p.birthDate.slice(0, 4)) >= 17)) add("1098t", "1098-T", "college tuition paid, for the education credits", "the college", DUE.jan31, "a child is of college age");
  add("property-tax", "Property tax bill", "if you itemize", "the county", "on the bill", "you may itemize deductions");
  if (Number(plan.taxes?.itemized?.charitable) > 0 || plan.whatIfs?.charitable) add("charity", "Gift receipts", "a written receipt for any gift of $250 or more", "each charity", "when you give", "you give to charity");
  add("last-return", "Last year's return", "the starting point, and the adjusted gross income to sign this one", "your files", "now", "every return starts from the last one");
  for (const x of plan.taxes?.extraDocuments ?? []) if (x?.id && x.form) add(`x:${x.id}`, x.form, x.what || "added by you", x.from || "", x.due || "", "you added it");
  return out.filter((x, i, arr) => arr.findIndex((y) => y.key === x.key) === i);
}

/**
 * compute(plan, { today }) -> { year (the tax year), items: [{ ...form, received, own (added by you) }], received (count), total, deadline }
 * The tax year is last year until the filing deadline has passed (April 15), then this year.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const y = today ? Number(String(today).slice(0, 4)) : 2026;
  const md = today ? String(today).slice(5, 10) : "01-01";
  const year = md <= "04-15" ? y - 1 : y;
  const got = plan.taxes?.documents?.[year] ?? {};
  const items = expected(plan, { today }).map((x) => ({ ...x, received: !!got[x.key], own: x.key.startsWith("x:") }));
  return { year, items, received: items.filter((x) => x.received).length, total: items.length, deadline: `${year + 1}-04-15` };
}
