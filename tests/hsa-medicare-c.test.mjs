// Round 8 HSA follow-up, second check (verify): the Medicare note says why the month is what it is without contradicting its
// own limit, the Health page does not say "saves no tax" when part of the year still counts, the catch-up note does not
// blame a Medicare excess on the catch-up rule, and "I get it now" on Get started, a dependent's Social Security line
// and a one-time Social Security payment are read as the Social Security page reads them. Invented households only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyPlan } from "../core/schema/migrate.js";
import { compute } from "../modules/taxes/hsa-fsa/compute.js";
import { compute as health } from "../modules/insurance/health/compute.js";
import { widowPlan } from "../qa/fixtures/widow-plan.mjs";

const T = "2026-11-06";
const near = (a, b, tol = 0.011) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);
const HP = { tier: "self", expected: 5000, plans: [{ id: "x", name: "HDHP", premium: 300, deductible: 3400, oopMax: 7000, coinsurance: 0.2, hsa: true, employerHsa: 0 }] };

function one({ birth, pay = 80000, ss = null, ssPeriod = "annual", hsa = 4400 }) {
  const p = emptyPlan();
  p.household.filingStatus = "single";
  p.household.people = [{ id: "a", name: "Ada", role: "self", birthDate: birth }];
  p.income = [];
  if (pay) p.income.push({ id: "pay", name: "Pay", type: "salary", personId: "a", amount: pay, period: "annual", growth: 0, taxable: true });
  if (ss !== null) p.income.push({ id: "ss", name: "Social Security", type: "social", personId: "a", amount: ssPeriod === "once" ? 255 : 24000, period: ssPeriod, growth: 0, startDate: ss, taxable: true });
  p.accounts = [{ id: "h", name: "HSA", type: "hsa", balance: 3000, ownerId: "a" }];
  p.retirement.contributions = [];
  p.taxes.hsa = { coverage: "self", contribution: hsa, employer: 0, fsa: 0, fsaSpent: 0 };
  p.insurance.health = HP;
  return p;
}
const noteOf = (d) => d.notes.find((n) => /on Medicare/.test(n)) ?? "";

test("the six-month backdating is said only when a later Social Security start sets the month", () => {
  // 65 in March 2026 and on Social Security since 62: Part A from the 65th-birthday month, nothing to backdate or apply for
  const before = noteOf(compute(one({ birth: "1961-03-20", ss: "2023-04-01" }), { today: T }));
  assert.match(before, /on Medicare from March/);
  assert.ok(!/goes back six months|applying earlier/i.test(before), before);
  // Social Security from October, after the March birthday: backdated to April, and the note says from when
  const after = noteOf(compute(one({ birth: "1961-03-20", ss: "2026-10-01" }), { today: T }));
  assert.ok(/on Medicare from April/.test(after) && /Social Security starts in October/.test(after) && /goes back six months/.test(after), after);
  // starting next year: the year is said
  const next = noteOf(compute(one({ birth: "1960-02-20", ss: "2027-03-01" }), { today: T }));
  assert.ok(/on Medicare from September/.test(next) && /starts in March 2027/.test(next), next);
});

test("the note never says money added from the Medicare month on is not allowed: the limit is by months, paid in any time to April", () => {
  // 65 in July with Social Security: 6 months count, 2,700 with the catch-up; 4,400 spread over the year would put only
  // 2,200 in from July, so "money added from July on is not allowed" would contradict the 1,700 too much it states
  const d = compute(one({ birth: "1961-07-15", ss: "2026-07-01" }), { today: T });
  const n = noteOf(d);
  assert.ok(!/added from \w+ on is not allowed/.test(n), n);
  assert.ok(/Only the 6 months before July count/.test(n) && /only 2,700/.test(n) && /1,700 too much/.test(n), n);
});

test("Health page, Medicare part of the year: it does not say the HSA plan saves no tax while some still goes in", () => {
  const h = health(one({ birth: "1961-07-15", ss: "2026-07-01" }), { today: T });
  near(h.hsaLimit, 2200);
  const w = h.warnings.find((x) => /Medicare/.test(x)) ?? "";
  assert.ok(!/saves no tax/.test(w), w);
  assert.ok(/From July/.test(w) && /only \$2,200 can go in/.test(w), w);
  // on Medicare all year it still says it saves no tax
  const all = health(one({ birth: "1952-03-15", ss: "" }), { today: T });
  assert.ok(all.warnings.some((x) => /saves no tax/.test(x)), all.warnings.join("|"));
});

test("a Medicare excess is not blamed on the catch-up rule", () => {
  const p = emptyPlan();
  p.household.filingStatus = "married_joint";
  p.household.people = [{ id: "e", name: "Eve", role: "self", birthDate: "1968-04-10" }, { id: "m", name: "Mo", role: "partner", birthDate: "1961-07-15" }];
  p.income = [{ id: "pe", name: "Pay", type: "salary", personId: "e", amount: 90000, period: "annual", growth: 0, taxable: true }, { id: "ss", name: "SS", type: "social", personId: "m", amount: 20000, period: "annual", growth: 0, startDate: "", taxable: true }];
  p.accounts = [{ id: "he", name: "HSA Eve", type: "hsa", balance: 0, ownerId: "e" }, { id: "hm", name: "HSA Mo", type: "hsa", balance: 0, ownerId: "m" }];
  p.retirement.contributions = [{ id: "ce", accountId: "he", personId: "e", period: "annual", amount: 5000, employerMatch: 0 }, { id: "cm", accountId: "hm", personId: "m", period: "annual", amount: 5000, employerMatch: 0 }];
  p.taxes.hsa = { coverage: "family", contribution: 0, employer: 0, fsa: 0, fsaSpent: 0 };
  const d = compute(p, { today: T });
  near(d.hsa.excess, 125);   // Mo: 4,375 of the family limit (6 of 12 months) + 500 of catch-up = 4,875; 5,000 in
  assert.ok(!d.notes.some((n) => /In all .* can go only into that person's own HSA/.test(n)), d.notes.join("|"));
  assert.ok(d.notes.some((n) => /125 too much/.test(n)), d.notes.join("|"));
});

test("Get started's 'I get it now' with no amount counts as getting Social Security, as on the Social Security page", () => {
  const w = widowPlan();
  w.income = w.income.filter((x) => x.type !== "social");
  w.accounts.push({ id: "h", name: "HSA", type: "hsa", balance: 3000, ownerId: "p-ruth" });
  w.taxes.hsa = { coverage: "self", contribution: 4400, employer: 0, fsa: 0, fsaSpent: 0 };
  assert.equal(w.guide.setup.ss["p-ruth"], "getting");
  const d = compute(w, { today: T });
  assert.equal(d.hsa.limit, 0); near(d.hsa.excess, 4400);
  // an Income line of their own wins over the answer (it says when it starts)
  const later = one({ birth: "1959-06-20", pay: 0, ss: "2028-01-01" });
  later.guide = { ...(later.guide ?? {}), setup: { ...(later.guide?.setup ?? {}), ss: { a: "getting" } } };
  assert.equal(compute(later, { today: T }).hsa.people[0].medicareMonths, 0);
});

test("a dependent's Social Security line does not stop the adult's typed Social Security from counting", () => {
  const p = one({ birth: "1956-05-10", pay: 0 });
  p.household.people.push({ id: "k", name: "Kid", role: "dependent", birthDate: "2012-05-10" });
  p.income.push({ id: "pen", name: "Pension", type: "pension", personId: "a", amount: 30000, period: "annual", growth: 0, taxable: true });
  p.income.push({ id: "kss", name: "Kid's benefit", type: "social", personId: "k", amount: 6000, period: "annual", growth: 0, startDate: "", taxable: true });
  p.taxes.thisYear = { ...(p.taxes.thisYear ?? {}), socialSecurity: 30000 };
  assert.equal(compute(p, { today: T }).hsa.limit, 0);
});

test("a one-time Social Security payment (the $255 death payment) is not a benefit that starts Medicare", () => {
  const d = compute(one({ birth: "1960-05-10", ss: "2026-02-01", ssPeriod: "once" }), { today: T });
  assert.equal(d.hsa.people[0].medicareMonths, 0); near(d.hsa.limit, 5400);
});
