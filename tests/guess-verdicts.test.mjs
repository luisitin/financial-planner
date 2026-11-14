// tests/guess-verdicts.test.mjs -- smart guesses C8, part 1: verdicts that wait, stage 2 (spec 8.2). The range of an answer when
// our guesses move to their middle-half ends (overview/guesses ranges.js on core/estimate rangeOf), the one guess that decides
// it, ranges printed only from measured spreads, and the pages that ask for it behind params.ranges: Next best action's left
// over, Emergency fund's months, Will the money last?'s verdict. A plan with no guess that can move gets nothing: the key stays
// absent and every answer is as before (the invariance tests at the end). Households: qa/fixtures/guess-walk.mjs (Get started
// walked with the unknown boxes left empty).
import { test } from "node:test";
import assert from "node:assert/strict";
import { rangeOf, confirmGuess, guessesInUse, saveField, getAt, setAt } from "../core/estimate/index.js";
import { guessMoves, measure, decidesWords, labelOf, anyMoving, Z, SPEND_SIGMA, MOVE_MAX, SIGMA_MAX } from "../modules/overview/guesses/ranges.js";
import { compute as nba, monthOf, spareRange } from "../modules/overview/next-best-action/compute.js";
import { compute as liquidity, cushionKeep } from "../modules/balance/liquidity/compute.js";
import { compute as projection, retireKeep, RETIRE_MOVES } from "../modules/retirement/projection/compute.js";
import { decidesMonth, waitWords } from "../modules/overview/next-best-action/view.js";
import { cushionLine } from "../modules/balance/liquidity/view.js";
import { decidesRetire } from "../modules/retirement/projection/view.js";
import { alex, rivera, WALK_TODAY as T, WALK_REGISTRY as REG } from "../qa/fixtures/guess-walk.mjs";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { guessedPlan } from "../qa/fixtures/guessed-plan.mjs";

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const typedBills = (p) => { for (const x of p.expenses) confirmGuess(p, `expenses[${x.id}].amount`); return p; };
const LO = Math.exp(-Z * SPEND_SIGMA), HI = Math.exp(Z * SPEND_SIGMA);

// ---- core/estimate rangeOf: what it now hands back (additive keys; the old ones as before)
test("rangeOf hands back fn's own answers at every end and per move, for a number or a { value } answer", () => {
  const p = { expenses: [{ id: "e1", amount: 100 }], income: [{ id: "i1", amount: 1000 }] };
  const moves = [{ paths: ["expenses[e1].amount"], factorLow: 0.5, factorHigh: 2 }, { paths: ["income[i1].amount"], factorLow: 0.9, factorHigh: 1.1 }];
  const left = (q) => q.income[0].amount - q.expenses[0].amount;
  const r = rangeOf(left, p, moves);
  assert.deepEqual(r.ends, { low: 900 - 50, mid: 900, high: 1100 - 200 });
  assert.deepEqual(r.swings, [{ low: 950, high: 800 }, { low: 800, high: 1000 }]);
  assert.equal(r.decisive, 1, "the pay moves it by 200, the bill by 150");
  const o = rangeOf((q) => ({ value: left(q), verdict: left(q) < 850 ? "short" : "fine" }), p, moves);
  assert.equal(o.mid, 900); assert.equal(o.low, 850); assert.equal(o.high, 900);
  assert.deepEqual(o.swings[1], { low: { value: 800, verdict: "short" }, high: { value: 1000, verdict: "fine" } });
  assert.equal(p.expenses[0].amount, 100, "the plan itself is untouched");
});

// ---- the moves
test("guessMoves: our spending rows move together at exp(-+0.674 x 0.25); a measured balance on its own at its own spread", () => {
  const p = alex();
  const moves = guessMoves(p, { registry: REG, today: T });
  const spend = moves.find((m) => m.id === "spending");
  assert.ok(spend, "one move for the spending rows");
  assert.equal(spend.paths.length, 7, "every row Get started guessed (no childcare: no children)");
  assert.ok(near(spend.factorLow, LO) && near(spend.factorHigh, HI));
  assert.ok(near(LO, 0.8449, 1e-3) && near(HI, 1.1835, 1e-3), "the declared 0.25 spread: about -15.5% and +18.4%");
  const cash = moves.find((m) => m.id === "accounts[setup-have-checking].balance");
  const s = p.guesses["accounts[setup-have-checking].balance"].s;
  assert.ok(near(cash.factorLow, Math.exp(-Z * s)) && near(cash.factorHigh, Math.exp(Z * s)));
  assert.equal(cash.measured, true, "the checking balance's spread is measured from its table (mean and median)");
  assert.equal(spend.measured, false, "survey spending's spread is declared");
  // a rate (no spread), the older guesses and a figure with no spread never move
  const r = rivera();
  const ids = guessMoves(r, { registry: REG, today: T, max: 99 }).map((m) => m.id);
  for (const path of ["debts[setup-debt-mortgage].rate", "debts[setup-debt-credit].minPayment", "retirement.spendingMonthly", "retirement.socialSecurity.setup-self.monthlyAtFRA"]) assert.ok(!ids.includes(path), `${path} does not move`);
  assert.equal(guessMoves(guessedPlan(), { registry: REG, today: T }).length, 0, "Get started's older guesses (frozen) keep no spread");
  assert.equal(guessMoves(r, { registry: REG, today: T }).length, MOVE_MAX, "at most eight, the big ones first");
  const all = guessMoves(r, { registry: REG, today: T, max: 99 });
  assert.equal(all[0].weight, "big");
  assert.ok(all.findIndex((m) => m.weight === "small") > all.findLastIndex((m) => m.weight === "big"), "every big one before the small");
});

test("guessMoves: a row read from the person's bank files is theirs and never moves; group: false moves each row alone", () => {
  const p = alex();
  p.guesses["expenses[setup-x-groceries].amount"].s = 0.15;   // the bank files' spread (Expenses' BANK_SPREAD)
  const spend = guessMoves(p, { registry: REG, today: T }).find((m) => m.id === "spending");
  assert.ok(!spend.paths.includes("expenses[setup-x-groceries].amount"));
  const each = guessMoves(alex(), { registry: REG, today: T, group: false, max: 99 });
  assert.ok(each.some((m) => m.id === "expenses[setup-x-housing].amount") && !each.some((m) => m.id === "spending"));
});

test("labelOf: each guess in plain words, with where its real figure is typed", () => {
  const a = alex(), r = rivera();
  const L = (p, path) => labelOf(p, guessesInUse(p).find((e) => e.path === path), REG);
  assert.deepEqual(L(a, "expenses[setup-x-housing].amount"), { label: "your rent", verb: "decides", href: "#/overview/setup/spend?back=done" });
  assert.equal(L(r, "expenses[setup-x-housing].amount").label, "what you spend on home costs");
  assert.equal(L(a, "accounts[setup-have-checking].balance").label, "your checking balance");
  assert.equal(L(r, "accounts[setup-have-savings].balance").label, "your savings balance");
  assert.equal(L(r, "accounts[setup-have-retire-setup-self].balance").label, "your 401(k) balance");
  assert.equal(L(r, "accounts[setup-have-retire-setup-partner].balance").label, "Jo's 401(k) balance");
  assert.equal(L(r, "income[setup-pay-setup-partner].amount").label, "Jo's pay");
  assert.equal(L(r, "accounts[setup-owe-mortgage].balance").label, "what's left on your mortgage");
  assert.equal(L(r, "accounts[setup-owe-credit].balance").label, "what you owe on your cards");
  assert.equal(L(r, "accounts[setup-owe-car-loan].balance").label, "what's left on your car loan");
  assert.equal(L(r, "accounts[setup-have-home].balance").label, "what your home is worth");
  assert.equal(L(r, "retirement.contributions[setup-contrib-setup-partner].amount").label, "what goes into Jo's plan at work");
  assert.equal(L(r, "accounts[setup-have-checking].balance").href, "#/overview/guesses", "a balance is typed on Our guesses for you");
});

// ---- measure
test("measure: one move gives its exact ends; several add up each at its own worse and better end", () => {
  const p = { a: [{ id: "x", v: 100 }, { id: "y", v: 10 }] };
  const f = (q) => q.a[0].v - 3 * q.a[1].v;                  // 70 as it is
  const one = { label: "x", verb: "decides", measured: true };
  const m1 = measure(f, p, [{ id: "x", paths: ["a[x].v"], factorLow: 0.5, factorHigh: 2, ...one }]);
  assert.deepEqual([m1.low, m1.mid, m1.high], [20, 70, 170]);
  const m2 = measure(f, p, [{ id: "x", paths: ["a[x].v"], factorLow: 0.5, factorHigh: 2, ...one }, { id: "y", paths: ["a[y].v"], factorLow: 0.5, factorHigh: 2, label: "y", verb: "decides", measured: false }]);
  // x: 20..170 (-50, +100); y at 5 or 20: 85 or 40 (+15, -30): 70 - 50 - 30 = -10 up to 70 + 100 + 15 = 185
  assert.deepEqual([m2.low, m2.high], [-10, 185]);
  assert.equal(m2.decisive.id, "x", "the larger swing");
  assert.equal(m2.printable, false, "y's spread is declared: never printed");
  assert.equal(m1.printable, true);
  assert.deepEqual(m2.labels, ["x", "y"]);
  // a verdict that flips beats a bigger swing that does not
  const k = measure(f, p, [{ id: "x", paths: ["a[x].v"], factorLow: 0.99, factorHigh: 1.01, label: "x", verb: "decides" }, { id: "y", paths: ["a[y].v"], factorLow: 1.5, factorHigh: 5, label: "y", verb: "decides" }],
    { kindOf: (r) => (r < 70.5 ? "short" : "fine") });
  assert.equal(k.crosses, true);
  assert.equal(k.decisive.id, "x", "x turns 70 into 71: the verdict changes; y moves it 120 further down, on the same side");
  assert.equal(measure(f, p, []), null, "no move: no range");
  assert.equal(measure(() => null, p, [{ id: "x", paths: ["a[x].v"], factorLow: 0.5, factorHigh: 2 }]), null, "no answer: no range");
});

test("decidesWords: one sentence per case", () => {
  assert.deepEqual(decidesWords({ label: "your rent", verb: "decides", href: "#/overview/setup/spend?back=done" }), { says: "Your rent decides it", ask: "Type your rent", href: "#/overview/setup/spend?back=done" });
  assert.deepEqual(decidesWords({ label: "your spending", verb: "decides", ask: "Type what you spend", href: "#/x" }), { says: "Your spending decides it", ask: "Type what you spend", href: "#/x" });
  assert.equal(decidesWords({ label: "Jo's pay", verb: "decides" }).says, "Jo's pay decides it");
  assert.equal(decidesWords(null), null);
});

// ---- Next best action: the month's left over
test("NBA: with params.ranges the left over gains its range; one move's ends are the month worked out with it moved", () => {
  const p = alex();
  const d = nba(p, { today: T, ranges: REG });
  const r = d.spare.range;
  assert.ok(r && r.moves === 1, "the spending rows, together");
  const scaled = (f) => { const q = structuredClone(p); for (const x of q.expenses) setAt(q, `expenses[${x.id}].amount`, x.amount * f); return monthOf(q, T).spare.monthly; };
  assert.ok(near(r.low, scaled(HI)) && near(r.high, scaled(LO)) && near(r.mid, d.spare.monthly));
  assert.equal(r.decisive.label, "your spending", "no one row is 40% of the spending: the spending as a whole");
  assert.equal(r.crosses, false, `about $${Math.round(r.low)} to $${Math.round(r.high)} spare: never short`);
  assert.equal(r.printable, false, "a spending range is never printed");
  assert.equal(nba(p, { today: T }).spare.range, undefined, "only when a page asks");
  assert.deepEqual(decidesMonth(r), { says: "Your spending decides it", ask: "Type what you spend", href: "#/overview/setup/spend?back=done", whether: "Your spending decides whether your month comes out short" });
});

test("NBA: Jo's pay, our guess, decides whether the Riveras' month comes out short once their bills are typed", () => {
  const p = typedBills(rivera());
  const r = nba(p, { today: T, ranges: REG }).spare.range;
  assert.equal(r.decisive.label, "Jo's pay");
  assert.equal(r.crosses, true);
  assert.ok(r.low < -5 && r.high > 5);
  assert.equal(decidesMonth(r).whether, "Jo's pay decides whether your month comes out short");
  assert.equal(decidesMonth(r).ask, "Type Jo's pay");
  // typed: the pay is theirs, it no longer moves, and the month's range rests on the rest
  saveField(p, "income[setup-pay-setup-partner].amount", { value: 66000, guessed: false }, null, T);
  const r2 = spareRange(p, T, REG);
  assert.ok(!r2 || r2.decisive?.label !== "Jo's pay");
});

// ---- Emergency fund: the months
test("Emergency fund: the bills typed, our checking balance (a measured spread) prints its range and the card waits", () => {
  const p = typedBills(alex());
  const d = liquidity(p, { today: T, ranges: REG });
  const r = d.range;
  assert.equal(d.waits, undefined, "stage 1 does not wait: none of the bills is ours");
  const s = p.guesses["accounts[setup-have-checking].balance"].s;
  const at = (f) => { const q = structuredClone(p); setAt(q, "accounts[setup-have-checking].balance", getAt(q, "accounts[setup-have-checking].balance") * f); return liquidity(q, { today: T }).runwayMonths; };
  assert.ok(near(r.low, at(Math.exp(-Z * s))) && near(r.high, at(Math.exp(Z * s))));
  assert.equal(r.printable, true);
  assert.equal(r.crosses, true, `${r.low.toFixed(1)} to ${r.high.toFixed(1)} months against a target of 3`);
  const months = (m) => (m < 2 ? (Math.floor(m * 10) / 10).toFixed(1) : String(Math.round(m)));
  const monthsOf = (m) => `${months(m)} months`;
  const line = cushionLine(d, monthsOf, months);
  assert.equal(line.kind, "waits");
  assert.equal(line.says, "Your checking balance is our guess for now, so whether your cash covers 3 months isn't known yet.");
  assert.equal(line.text, `Between ${months(r.low)} and ${monthsOf(r.high)}, depending on your checking balance (our guess).`);
  assert.equal(line.ask, "Type your checking balance");
  // only the must-pay bills move the months: a guessed bill that is not a must-pay one is not a move
  assert.equal(cushionKeep({ path: "expenses[setup-x-dining].amount" }, p), false);
  assert.equal(cushionKeep({ path: "expenses[setup-x-groceries].amount" }, p), true);
  assert.equal(cushionKeep({ path: "accounts[setup-have-checking].balance" }, p), true);
});

test("Emergency fund: the bills mostly ours (stage 1 waits), the checking balance named as the guess that decides it most", () => {
  const d = liquidity(alex(), { today: T, ranges: REG });
  assert.equal(d.waits, true);
  const line = cushionLine(d, (m) => `${m} months`, (m) => String(m));
  assert.deepEqual(line, { kind: "too", text: "Your checking balance is our guess too, and it decides it most.", ask: "Type your checking balance", href: "#/overview/guesses" });
  // no registry: nothing is known to be measured, so nothing is printed (the spread still makes the card wait)
  const bare = liquidity(typedBills(alex()), { today: T, ranges: true });
  assert.equal(bare.range.printable, false);
  assert.equal(cushionLine(bare, (m) => `${m} months`, (m) => String(m)).text, null);
});

test("Emergency fund: a range that stays on one side of the target and is measured is said, and does not wait", () => {
  const p = typedBills(alex());
  p.assumptions.emergencyMonths = 0.1;                         // any cash at all covers it
  const d = liquidity(p, { today: T, ranges: REG });
  assert.equal(d.range.crosses, false);
  const months = (m) => m.toFixed(1), monthsOf = (m) => `${m.toFixed(1)} months`;
  assert.equal(cushionLine(d, monthsOf, months).kind, "range");
});

// ---- Will the money last?
test("Will the money last?: at most four guesses move (balances it draws on, pay, saving at work), each two runs of the plan", () => {
  const p = rivera();
  const d = projection(p, { today: T, ranges: REG });
  assert.ok(d.range, "the Riveras' 401(k)s, savings and Jo's pay are ours");
  assert.ok(d.range.moves <= RETIRE_MOVES);
  assert.equal(d.range.kinds[0], d.verdict, "the verdict as it is comes first");
  assert.equal(retireKeep({ path: "accounts[setup-have-home].balance" }, p), false, "not the home's value");
  assert.equal(retireKeep({ path: "accounts[setup-owe-mortgage].balance" }, p), false, "not a debt");
  assert.equal(retireKeep({ path: "expenses[setup-x-dining].amount" }, p), false, "a figure for retirement spending is set");
  assert.equal(retireKeep({ path: "expenses[setup-x-dining].amount" }, p, true), true, "spending taken from today's bills");
  const one = { decisive: { label: "your 401(k) balance", verb: "decides", href: "#/overview/guesses" } };
  assert.equal(decidesRetire({ ...one, crosses: false, kinds: ["on track", "tight"] }), null, "no line unless the verdict could change");
  assert.deepEqual(decidesRetire({ ...one, crosses: true, kinds: ["tight", "short"] }), { text: "Your 401(k) balance decides whether the money lasts: it is our guess for now.", ask: "Type your 401(k) balance", href: "#/overview/guesses" });
  assert.equal(decidesRetire({ ...one, crosses: true, kinds: ["on track", "tight"] }).text, "Your 401(k) balance decides whether the plan is on track or only just lasts: it is our guess for now.");
});

// ---- invariance: a plan with no guess that can move gets nothing new
test("invariance: no catalog household, fixture or older-guesses plan has a guess that can move; their answers are the same with ranges", () => {
  const plans = [...ARCHETYPES.map((a) => ({ name: a.id, plan: a.build() })), { name: "family", plan: familyPlan(T) }, { name: "guessedPlan", plan: guessedPlan() }];
  for (const { name, plan } of plans) {
    assert.equal(anyMoving(plan), false, name);
    for (const [f, label] of [[nba, "next best action"], [liquidity, "emergency fund"], [projection, "will the money last"]]) {
      assert.equal(JSON.stringify(f(plan, { today: T, ranges: REG })), JSON.stringify(f(plan, { today: T })), `${name}: ${label}`);
    }
  }
});

test("invariance: with guesses, ranges add only their own key (while the month already waits on the spending)", () => {
  for (const p of [alex(), rivera()]) {
    const strip = (d, at) => { const q = structuredClone(d); if (at === "spare") delete q.spare.range; else delete q.range; return JSON.stringify(q); };
    assert.equal(strip(nba(p, { today: T, ranges: REG }), "spare"), JSON.stringify(nba(p, { today: T })));
    assert.equal(strip(liquidity(p, { today: T, ranges: REG })), JSON.stringify(liquidity(p, { today: T })));
    assert.equal(strip(projection(p, { today: T, ranges: REG })), JSON.stringify(projection(p, { today: T })));
  }
});

// ---- the pages, drawn as the shell draws them (qa/first-view-lib: the real kit on the stand-in DOM)
const textOf = (el) => (el.data !== undefined && !el.tagName ? el.data : el.tagName === "STYLE" ? "" : (el.childNodes ?? []).map(textOf).join(" ")).replace(/\s+/g, " ");
const found = (el, sel) => { const out = []; const walk = (n) => { if (n.getAttribute?.(sel) !== null && n.getAttribute?.(sel) !== undefined) out.push(n); for (const c of n.childNodes ?? []) walk(c); }; walk(el); return out; };
async function drawn(key, plan) {
  const L = await import("../qa/first-view-lib.mjs");
  const app = await L.loadApp();
  app.plans.c8 = app.migrate(plan);
  const d = await L.draw(key, "c8");
  assert.ok(!d.error, `${key}: ${d.error}`);
  return d.root;
}
test("pages: Next best action names the guess that decides the month, waiting or not; no line without a guess", async () => {
  // waiting on the spending (all ours), Jo's pay deciding it most: the hero and the card's button ask for the spending, and Jo's
  // pay is one quiet line; nothing promises the figure turns real when Jo's pay is typed (critic F1)
  const root = await drawn("overview/next-best-action", rivera());
  const waits = textOf(root);
  assert.match(waits, /^ ?Next, for your spare money Type what you really spend /);
  assert.match(waits, /With our guesses about \$1,960 spare Jo's pay is our guess too, and it decides it most\. Type Jo's pay › Type what you spend ›/);
  assert.doesNotMatch(waits, /Jo's pay decides it\. Type it and this becomes your real figure/);
  assert.doesNotMatch(waits, /\$1,964/, "about: to the $10, as the hero says it (critic F2)");
  // the bills typed: the month waits on Jo's pay (stage 2), and the hero, the step and the card all ask for it
  const typed = textOf(await drawn("overview/next-best-action", typedBills(rivera())));
  assert.match(typed, /^ ?Next, for your spare money Type Jo's pay Jo's pay is our guess for now, so whether your month comes out short is not known yet\. With our guesses it would be about \$1,960 spare\. Type it to see what's really left\. Open Our guesses for you ›/);
  assert.match(typed, /Spending - \$7,930 .* With our guesses about \$1,960 spare Jo's pay is our guess for now, so whether your month comes out short isn't known yet\. Type Jo's pay ›/);
  assert.doesNotMatch(typed, /Left over each month/);
  const plain = textOf(await drawn("overview/next-best-action", familyPlan(T)));
  assert.doesNotMatch(plain, /decides|our guess/);
});

test("NBA: a left over whose range crosses the line waits on the guess that decides it (spec 8.1 stage 2; critic F2)", () => {
  const p = typedBills(rivera());
  const d = nba(p, { today: T, ranges: REG });
  assert.equal(d.spare.waits, true);
  assert.equal(d.spare.waitsOn, "guess");
  assert.equal(d.spare.range.crosses, true);
  assert.deepEqual([d.next.id, d.next.title, d.next.go, d.next.waits], ["bills", "Type Jo's pay", ["overview", "guesses"], true]);
  assert.ok(d.steps.every((s) => !s.startDate && (!s.doneDate || s.doneDate === T)), "no step is dated from a month that waits");
  // without the ranges, stage 1 alone: the typed spending does not wait (the Dashboard and Get started read this)
  const plain = nba(p, { today: T });
  assert.equal(plain.spare.waits, false);
  assert.equal("waitsOn" in plain.spare, false);
  // stage 1 sets no waitsOn, and a range that does not cross adds no waiting
  const a = nba(alex(), { today: T, ranges: REG });
  assert.equal(a.spare.waits, true); assert.equal("waitsOn" in a.spare, false);
  const fam = nba(familyPlan(T), { today: T, ranges: REG });
  assert.equal("waits" in fam.spare, false);
  // Jo's pay typed: nothing that is left crosses the line, so the month is the household's figure again
  saveField(p, "income[setup-pay-setup-partner].amount", { value: 66000, guessed: false }, null, T);
  const after = nba(p, { today: T, ranges: REG });
  if (!after.spare.range?.crosses) assert.notEqual(after.spare.waits, true);
});

test("NBA: the month card's words while it waits, one case each (waitWords)", () => {
  const spend = { label: "your spending", verb: "decides", ask: "Type what you spend", href: "#/overview/setup/spend?back=done", kind: "spend" };
  const rent = { label: "your rent", verb: "decides", href: "#/overview/setup/spend?back=done", kind: "spend" };
  const pay = { label: "Jo's pay", verb: "decides", href: "#/overview/guesses", kind: "one" };
  const real = "Type what you really spend and this becomes your real figure.";
  assert.equal(waitWords({ waits: false, range: { decisive: pay } }), null);
  assert.deepEqual(waitWords({ waits: true }), { says: real, ask: "Type what you spend", href: "#/overview/setup/spend?back=done" });
  assert.deepEqual(waitWords({ waits: true, range: { decisive: spend } }), { says: real, ask: "Type what you spend", href: "#/overview/setup/spend?back=done" });
  assert.deepEqual(waitWords({ waits: true, range: { decisive: rent } }), { says: `Your rent decides it most. ${real}`, ask: "Type your rent", href: "#/overview/setup/spend?back=done" });
  assert.deepEqual(waitWords({ waits: true, range: { decisive: pay } }), { says: null, too: { says: "Jo's pay is our guess too, and it decides it most.", ask: "Type Jo's pay", href: "#/overview/guesses" }, ask: "Type what you spend", href: "#/overview/setup/spend?back=done" });
  assert.deepEqual(waitWords({ waits: true, waitsOn: "guess", range: { decisive: pay } }), { says: "Jo's pay is our guess for now, so whether your month comes out short isn't known yet.", ask: "Type Jo's pay", href: "#/overview/guesses" });
});
test("pages: Emergency fund waits on a range that crosses the target, prints a measured one, names the guess", async () => {
  const root = await drawn("balance/liquidity", typedBills(alex()));
  const t = textOf(root);
  assert.match(t, /About 1\.\d months by our guesses; target: 3 months/);
  assert.match(t, /Your checking balance is our guess for now, so whether your cash covers 3 months isn't known yet\. Type it and we'll tell you how much more you need\./);
  assert.match(t, /Between 0\.\d and \d+ months, depending on your checking balance \(our guess\)\./);
  assert.doesNotMatch(t, /\bthin\b|getting there/, "no pill while it waits (P7)");
  const both = textOf(await drawn("balance/liquidity", alex()));
  assert.match(both, /Most of the bills you have to pay are our guesses for now/);
  assert.match(both, /Your checking balance is our guess too, and it decides it most\. Type your checking balance ›/);
  assert.doesNotMatch(textOf(await drawn("balance/liquidity", familyPlan(T))), /our guess/);
});

test("a spread wider than any estimator gives (a hand edit, an import) is taken at SIGMA_MAX, so a range stays readable (critic F6)", () => {
  const p = alex();
  const k = Object.keys(p.guesses).find((x) => /checking/.test(x));
  p.guesses[k].s = 40;
  const m = guessMoves(p, { registry: REG, today: T }).find((x) => x.id === k);
  assert.ok(near(m.factorHigh, Math.exp(Z * SIGMA_MAX)) && near(m.factorLow, Math.exp(-Z * SIGMA_MAX)));
  const r = liquidity(p, { today: T, ranges: REG }).range;
  assert.ok(r.high < 100 && r.low >= 0, `${r.low} to ${r.high} months`);
  // the estimators' own spreads are all under it, so a real guess is never cut
  for (const e of guessesInUse(rivera())) if (typeof e.s === "number") assert.ok(e.s < SIGMA_MAX, `${e.path}: ${e.s}`);
});

test("Emergency fund: two guesses' ends added up are said as what it could be, one guess's middle half as Between (critic F6)", () => {
  const months = (x) => `${Math.round(x * 10) / 10}`, monthsOf = (x) => `${months(x)} months`;
  const two = cushionLine(liquidity(typedBills(rivera()), { today: T, ranges: REG }), monthsOf, months);
  assert.match(two.text, /^It could be from 0\.6 to 7\.6 months, depending on your checking balance and your savings balance \(our guesses\)\.$/);
  const one = cushionLine(liquidity(typedBills(alex()), { today: T, ranges: REG }), monthsOf, months);
  assert.match(one.text, /^Between 0\.\d and \d+(\.\d)? months, depending on your checking balance \(our guess\)\.$/);
});
