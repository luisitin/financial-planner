// tests/guess-ranking.test.mjs -- smart guesses C8, part 2: "Our guesses for you" ranks our guesses by how much they move the
// plan's answers (spec 11.2: overview/guesses rank.js, heavy, the top 8, memoised), and the Dashboard's "Make our guesses
// yours" card (spec 11.3: overview/dashboard makeYours, the static weight until the ranking is here). Nothing is written on
// opening either. Households: qa/fixtures/guess-walk.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmGuess, saveField, setAt, getAt, settle } from "../core/estimate/index.js";
import { rankGuesses, rankWords, swingMoney, offMoney, figuresKey, RANK_MAX, TIER2 } from "../modules/overview/guesses/rank.js";
import { Z } from "../modules/overview/guesses/ranges.js";
import { compute as guesses, lookedOver, newSinceLooked, joinLabel } from "../modules/overview/guesses/compute.js";
import { compute as dashboard, makeYours } from "../modules/overview/dashboard/compute.js";
import { yoursWords } from "../modules/overview/dashboard/view.js";
import { monthOf } from "../modules/overview/next-best-action/compute.js";
import { compute as liquidity } from "../modules/balance/liquidity/compute.js";
import { alex, rivera, WALK_TODAY as T, WALK_REGISTRY as REG } from "../qa/fixtures/guess-walk.mjs";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { guessedPlan } from "../qa/fixtures/guessed-plan.mjs";

const O = { estimators: REG.estimators, tables: REG.tables, today: T };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

test("rankGuesses: each guess moved alone to its middle-half ends; the month, the cushion and retirement worked out again", () => {
  const p = alex();
  const { key, ranks } = rankGuesses(p, { today: T, registry: REG });
  assert.equal(key, figuresKey(p, T));
  assert.ok(Object.keys(ranks).length <= RANK_MAX);
  // the rent alone: the month at rent x e^(+-0.674 x 0.25), the larger change
  const at = (f) => { const q = structuredClone(p); setAt(q, "expenses[setup-x-housing].amount", getAt(q, "expenses[setup-x-housing].amount") * f); return monthOf(q, T).spare.monthly; };
  const mid = monthOf(p, T).spare.monthly, s = p.guesses["expenses[setup-x-housing].amount"].s;
  const side = Math.max(Math.abs(at(Math.exp(Z * s)) - mid), Math.abs(at(Math.exp(-Z * s)) - mid));
  assert.ok(near(ranks["expenses[setup-x-housing].amount"].spare, side));
  assert.equal(ranks["expenses[setup-x-housing].amount"].tier, 2, `$${Math.round(side)} a month: tier 2 at $${TIER2.monthly}`);
  // our checking balance can put the cushion on either side of its target: tier 1
  const c = ranks["accounts[setup-have-checking].balance"];
  assert.equal(c.tier, 1); assert.deepEqual(c.flips, ["cushion"]);
  const q = structuredClone(p), cs = p.guesses["accounts[setup-have-checking].balance"].s;
  setAt(q, "accounts[setup-have-checking].balance", 2900 * Math.exp(Z * cs));
  assert.equal(liquidity(q, { today: T }).status, "ok", "its high end covers the target");
  // a row that moves the month by under $100 and no verdict: tier 3
  assert.equal(ranks["expenses[setup-x-utilities].amount"].tier, 3);
  assert.deepEqual(rankGuesses(familyPlan(T), { today: T, registry: REG }).ranks, {}, "no guess: nothing ranked");
  assert.deepEqual(rankGuesses(guessedPlan(), { today: T, registry: REG }).ranks, {}, "older guesses keep no spread");
});

test("rankGuesses: at most eight, the big ones first; a home's value or a debt's balance moves none of the answers", () => {
  const { ranks } = rankGuesses(rivera(), { today: T, registry: REG });
  const ids = Object.keys(ranks);
  assert.equal(ids.length, RANK_MAX);
  for (const no of ["accounts[setup-have-home].balance", "accounts[setup-owe-mortgage].balance", "accounts[setup-owe-car-loan].balance"]) assert.ok(!ids.includes(no), no);
  assert.equal(ranks["income[setup-pay-setup-partner].amount"].tier, 2);
  assert.ok(ranks["income[setup-pay-setup-partner].amount"].spare > 1000, "Jo's pay, our guess, moves the month by over $1,000");
  assert.ok(ranks["accounts[setup-have-retire-setup-self].balance"].retire >= TIER2.monthly, "Sam's 401(k) moves retirement");
});

test("rankGuesses: kept while the figures are the same (a guess kept as it is); worked out again when one is typed", () => {
  const p = rivera();
  const a = rankGuesses(p, { today: T, registry: REG });
  const q = structuredClone(p);
  confirmGuess(q, "expenses[setup-x-insurance].amount");      // "That's about right": the figure stays, it is theirs
  q.meta.rev = "another";
  assert.equal(figuresKey(q, T), a.key, "the stamps and the ledger are not the figures");
  const b = rankGuesses(q, { today: T, registry: REG, before: a });
  assert.equal(b.ranks["income[setup-pay-setup-partner].amount"], a.ranks["income[setup-pay-setup-partner].amount"], "not worked out again");
  saveField(q, "income[setup-pay-setup-partner].amount", { value: 50000, guessed: false }, null, T);
  const c = rankGuesses(q, { today: T, registry: REG, before: b });
  assert.notEqual(c.key, b.key);
  assert.equal(c.ranks["income[setup-pay-setup-partner].amount"], undefined, "typed: no longer ours");
  assert.notEqual(c.ranks["accounts[setup-have-retire-setup-self].balance"], b.ranks["accounts[setup-have-retire-setup-self].balance"], "worked out again on the new figures");
});

test("rankWords and swingMoney: one sentence per case, the figure to $10 under $100, else to $50", () => {
  assert.equal(swingMoney(47), "$50"); assert.equal(swingMoney(94), "$90"); assert.equal(swingMoney(149), "$150");
  assert.equal(swingMoney(2662), "$2,650"); assert.equal(swingMoney(-180), "$200");
  const r = (x) => ({ tier: 2, spare: 0, months: 0, retire: 0, flips: [], kinds: {}, ...x });
  assert.equal(rankWords(r({ tier: 1, flips: ["month", "cushion"] })), "If it's off, it could decide whether your month comes out short.");
  assert.equal(rankWords(r({ tier: 1, flips: ["cushion"] })), "If it's off, it could decide whether your emergency fund is big enough.");
  assert.equal(rankWords(r({ tier: 1, flips: ["retirement"], kinds: { retirement: ["tight", "short"] } })), "If it's off, it could decide whether the money lasts in retirement.");
  assert.equal(rankWords(r({ tier: 1, flips: ["retirement"], kinds: { retirement: ["on track", "tight"] } })), "If it's off, it could decide whether your retirement is on track.");
  assert.equal(rankWords(r({ spare: 149 })), "If it's off, what's left each month could change by about $150.");
  assert.equal(rankWords(r({ spare: 20, retire: 432 })), "If it's off, what you could spend in retirement could change by about $450 a month.");
  assert.equal(rankWords(r({ months: 1.2 })), "If it's off, your emergency fund could cover about a month more or less.");
  assert.equal(rankWords(r({ months: 2.6 })), "If it's off, your emergency fund could cover about 3 months more or less.");
  assert.equal(rankWords(r({ tier: 3, spare: 40 })), null, "tier 3 says nothing");
  assert.equal(rankWords(null), null);
});

test("rankWords says how far off it means: the guess at the end that moves that answer, in its own unit (critic F6)", () => {
  assert.equal(offMoney(46048), "$46,000"); assert.equal(offMoney(6133), "$6,100"); assert.equal(offMoney(248), "$250"); assert.equal(offMoney(23), "$20");
  const g = { v: 66000, u: "year", factorLow: Math.exp(-Z * 0.785), factorHigh: Math.exp(Z * 0.785) };
  const r = (x) => ({ tier: 2, spare: 0, months: 0, retire: 0, flips: [], kinds: {}, ...g, ...x });
  assert.equal(rankWords(r({ spare: 2662, ends: { month: "high" } })), "If it's off by about $46,000 a year, what's left each month could change by about $2,650.");
  assert.equal(rankWords(r({ spare: 900, ends: { month: "low" } })), "If it's off by about $27,000 a year, what's left each month could change by about $900.");
  assert.equal(rankWords(r({ tier: 1, flips: ["cushion"], ends: { cushion: "high" }, v: 2900, u: "total", factorLow: Math.exp(-Z * 1.68), factorHigh: Math.exp(Z * 1.68) })), "If it's off by about $6,100, it could decide whether your emergency fund is big enough.");
  assert.equal(rankWords(r({ spare: 248, ends: { month: "high" }, v: 1050, u: "month", factorLow: Math.exp(-Z * 0.3), factorHigh: Math.exp(Z * 0.3) })), "If it's off by about $250 a month, what's left each month could change by about $250.");
  // the Riveras: Jo's pay, our guess of $66,000 a year with its measured spread; the middle half reaches about $112,000
  const p = rivera();
  const { ranks } = rankGuesses(p, { today: T, registry: REG });
  const pay = ranks["income[setup-pay-setup-partner].amount"];
  const e = p.guesses["income[setup-pay-setup-partner].amount"];
  assert.equal(pay.ends.month, "high");
  assert.ok(near(pay.v * (pay.factorHigh - 1), e.v * (Math.exp(Z * e.s) - 1)));
  assert.match(rankWords(pay), /^If it's off by about \$46,000 a year, what's left each month could change by about \$2,\d50\.$/);
  // a ranking kept from before the end was recorded says it as it did
  assert.equal(rankWords(r({ spare: 149, ends: undefined })), "If it's off, what's left each month could change by about $150.");
});

test("guesses compute: with the ranking, tier 1 and 2 lead by how much they move and make up Matters most", () => {
  const p = rivera();
  const { ranks } = rankGuesses(p, { today: T, registry: REG });
  const d = guesses(p, { ...O, ranked: ranks });
  const tiers = d.big.map((r) => ranks[r.path]?.tier ?? 2.5);
  assert.deepEqual([...tiers].sort((a, b) => a - b), tiers, "in tier order");
  assert.equal(d.big[0].path, "income[setup-pay-setup-partner].amount", "the guess that moves the most first");
  assert.ok(d.small.some((r) => r.path === "expenses[setup-x-housing].amount"), "a big estimator that moves little matters less");
  assert.ok(d.big.some((r) => r.path === "accounts[setup-have-home].balance"), "a big guess the ranking does not reach keeps its static place");
  // without it, the page is exactly as before
  const plain = guesses(p, O);
  assert.deepEqual(plain.big.map((r) => r.path), plain.rows.filter((r) => !r.fromBank && (r.weight === "big" || r.frozen || r.stale)).map((r) => r.path));
});

test("Make our guesses yours: the static weight until the ranking is here, then tiers 1 and 2; gone once looked over", () => {
  assert.equal(makeYours(familyPlan(T), { estimators: REG.estimators }), null, "no guess");
  const p = rivera();
  const s = makeYours(p, { estimators: REG.estimators });
  assert.equal(s.from, "weight");
  assert.ok(s.count > 3);
  const { ranks } = rankGuesses(p, { today: T, registry: REG });
  const r = makeYours(p, { estimators: REG.estimators, ranked: ranks });
  assert.equal(r.from, "ranked");
  assert.equal(r.count, Object.values(ranks).filter((x) => x.tier <= 2).length);
  p.guide.guessesLookedAt = T;                                  // "These look fine" today (a plan from before guessesSeen)
  assert.equal(makeYours(p, { estimators: REG.estimators, ranked: ranks }), null, "looked over: the card rests");
  p.guide.guessesLookedAt = "2026-11-01";                       // looked over before these were made
  assert.ok(makeYours(p, { estimators: REG.estimators, ranked: ranks }), "a guess made since: it is back");
});

test("Make our guesses yours quotes the guesses page's own numbers (critic F5, F8)", () => {
  for (const [name, mk] of [["alex", alex], ["rivera", rivera]]) {
    const p = mk();
    const { ranks } = rankGuesses(p, { today: T, registry: REG });
    const page = guesses(p, { ...O, ranked: ranks });
    const y = makeYours(p, { ...O, ranked: ranks });
    assert.equal(y.total, page.big.length + page.small.length, `${name}: the page's "N to look over"`);
    assert.equal(y.top, [...page.big, ...page.small].filter((r) => ranks[r.path]?.tier <= 2).length, `${name}: the rows that say what they move`);
    // before the page has ranked them: the same total, no count of the ones that matter
    const w = makeYours(p, O);
    assert.equal(w.total, guesses(p, O).big.length + guesses(p, O).small.length);
    assert.equal("top" in w, false);
  }
  assert.equal(yoursWords({ total: 32, top: 6 }), "32 figures are our guesses; 6 of them change your answers the most.");
  assert.equal(yoursWords({ total: 12, top: 1 }), "12 figures are our guesses; one of them changes your answers the most.");
  assert.equal(yoursWords({ total: 32 }), "32 figures are our guesses; the ones that change your answers most come first.");
  assert.equal(yoursWords({ total: 3, top: 3 }), "3 figures are our guesses; the ones that change your answers most come first.");
  assert.equal(yoursWords({ total: 1, top: 1 }), "One figure is our guess, and it can change your answers.");
});

test("These look fine, then a guess made or moved later the same day: the card comes back (critic F5)", () => {
  const p = alex();
  const { ranks } = rankGuesses(p, { today: T, registry: REG });
  lookedOver(p, T);
  assert.equal(p.guide.guessesLookedAt, T);
  assert.ok(Object.keys(p.guide.guessesSeen).length > 0, "the same day's guesses, as they were");
  assert.equal(makeYours(p, { ...O, ranked: ranks }), null, "looked over: the card rests");
  // our guess of the rent moves later that day (a new answer it follows): new since the look
  const k = "expenses[setup-x-housing].amount";
  p.guesses[k] = { ...p.guesses[k], v: p.guesses[k].v + 100, at: T };
  setAt(p, k, p.guesses[k].v);
  assert.equal(newSinceLooked(p, { ...p.guesses[k], path: k }), true);
  assert.ok(makeYours(p, { ...O, ranked: ranks }), "back the same day");
  // a guess made later that day on a path not looked at: new too; one from an earlier day: not
  assert.equal(newSinceLooked(p, { path: "accounts[x].balance", at: T, v: 1 }), true);
  assert.equal(newSinceLooked(p, { path: "accounts[x].balance", at: "2026-11-01", v: 1 }), false);
  assert.equal(newSinceLooked(p, { path: "accounts[x].balance", at: "2026-11-20", v: 1 }), true);
  assert.equal(newSinceLooked({ guide: {} }, { path: "a", at: T, v: 1 }), true, "never looked over");
});

test("a row's name and its figure's label read as one name (critic F9)", () => {
  assert.equal(joinLabel("Jo's pay", "Pay before tax"), "Jo's pay before tax");
  assert.equal(joinLabel("Car loan", "Still owed"), "Car loan: still owed");
  assert.equal(joinLabel("Pay", "Pay"), "Pay: pay");
  const d = guesses(rivera(), O);
  assert.ok(d.rows.some((r) => r.label === "Jo's pay before tax"));
  assert.ok(!d.rows.some((r) => /: pay before tax/.test(r.label)));
});

test("Dashboard compute: `yours` only while it applies; a plan without guesses computes as before", () => {
  const fam = familyPlan(T);
  const d = dashboard(fam, { today: T, estimators: REG.estimators, tables: REG.tables });
  assert.equal("yours" in d, false);
  assert.ok(dashboard(rivera(), { today: T, estimators: REG.estimators, tables: REG.tables }).yours);
  const p = rivera();
  const before = JSON.stringify(p);
  rankGuesses(p, { today: T, registry: REG }); guesses(p, O); dashboard(p, { today: T, estimators: REG.estimators });
  assert.ok(JSON.stringify(p) === before, "nothing is written by ranking or by either card");
});

// ---- the pages, drawn as the shell draws them
const textOf = (el) => (el.data !== undefined && !el.tagName ? el.data : el.tagName === "STYLE" ? "" : (el.childNodes ?? []).map(textOf).join(" ")).replace(/\s+/g, " ");
async function drawn(key, plan) {
  const L = await import("../qa/first-view-lib.mjs");
  const app = await L.loadApp();
  app.plans.c8r = app.migrate(plan);
  const d = await L.draw(key, "c8r");
  assert.ok(!d.error, `${key}: ${d.error}`);
  return { root: d.root, calls: d.calls };
}
test("pages: each ranked row says what it moves; the Dashboard's card links to them; opening writes nothing", async () => {
  const g = await drawn("overview/guesses", rivera());
  const t = textOf(g.root);
  assert.match(t, /Jo's pay before tax \$66,000 a year Our guess: [^.]+\. If it's off by about \$46,000 a year, what's left each month could change by about \$2,\d50\./);
  assert.match(t, /If it's off by about \$[\d,]+, what you could spend in retirement could change by about \$\d+ a month\./);
  assert.match(t, /(\d+) to look over/);
  const left = Number(/(\d+) to look over/.exec(t)[1]);
  assert.equal(g.calls.update, 0, "the page writes nothing on opening");
  const dash = await drawn("overview/dashboard", rivera());
  // the card and the page say the same number (critic F5)
  assert.match(textOf(dash.root), new RegExp(`Make our guesses yours ${left} figures are our guesses; (\\d+ of them change your answers the most|the ones that change your answers most come first)\\. Look at them ›`));
  assert.equal(dash.calls.update, 0);
  assert.doesNotMatch(textOf((await drawn("overview/dashboard", familyPlan(T))).root), /Make our guesses yours/);
});

test("the guesses page: the spending row's button is outlined under a card with its own filled button (critic F1)", async () => {
  const filledIn = (root) => { const out = []; const walk = (n) => { if ((n.tagName === "BUTTON" || (n.tagName === "A" && /\bbtn\b/.test(n.className ?? ""))) && !/secondary|chip|link|ghost|danger/.test(n.className ?? "")) out.push(textOf(n).trim()); for (const c of n.childNodes ?? []) walk(c); }; walk(root); return out; };
  // Jo's pay typed: the spending and the cushion target follow it, and "Better guesses are ready" offers the older guess's new figure
  const p = rivera();
  saveField(p, "income[setup-pay-setup-partner].amount", { value: 90000, guessed: false }, null, T);
  settle(p, O);                                                 // as the store does after a save
  const { root } = await drawn("overview/guesses", p);
  assert.match(textOf(root), /Better guesses are ready .* Use the new guesses Keep the old ones Matters most .* Type yours ›/);
  assert.deepEqual(filledIn(root), ["Use the new guesses"], "one filled button");
  // no card above: the spending row's ask is the page's one filled button, as before
  const plain = await drawn("overview/guesses", rivera());
  assert.doesNotMatch(textOf(plain.root), /Better guesses are ready|Fill in what you skipped|the same loan/);
  assert.deepEqual(filledIn(plain.root), ["Type yours ›"]);
});
