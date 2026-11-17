import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, PARTS, BANDS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const part = (d, id) => d.parts.find((p) => p.id === id);

test("the weights add to 100 and the bands cover every score", () => {
  assert.equal(Object.values(PARTS).reduce((s, v) => s + v, 0), 100);
  for (const s of [0, 49, 50, 70, 85, 100]) assert.ok(BANDS.find((b) => s >= b.min));
});

test("an empty plan scores low and every part says what to add", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.ready, true); assert.ok(d.score < 30, String(d.score));
  for (const id of ["cushion", "saving", "retirement", "protection", "goals"]) assert.equal(part(d, id).status, "unknown", id);
  assert.ok(d.parts.every((p) => p.fix || p.points === p.max));
});

test("the family: each part from its page, the total is the sum, the gains largest first", () => {
  const d = compute(familyPlan(), { today: TODAY });
  assert.equal(d.score, Math.round(d.parts.reduce((s, p) => s + p.points, 0)));
  assert.equal(d.band, BANDS.find((b) => d.score >= b.min).label);
  const c = part(d, "cushion"); assert.ok(c.points < 3 && c.status === "bad", "0.9 months of 6");
  assert.equal(part(d, "retirement").points, 25, "133% of planned spending");
  assert.equal(part(d, "saving").points, 15);
  const pr = part(d, "protection"); assert.equal(pr.points, 10, "4 of 6 life shocks"); assert.match(pr.detail, /"Ana can never work again"/);
  // round 8 batch 2: dated goals are funded from today, so the Japan trip (nothing in, due October 2027) waits a one-month
  // turn after the Visa instead of being behind: 1 of 4 goals on track, 5 x 1/4 = 1.25, shown as 1.3
  assert.equal(part(d, "goals").points, 1.3);
  for (let i = 1; i < d.gains.length; i++) assert.ok(d.gains[i - 1].max - d.gains[i - 1].points >= d.gains[i].max - d.gains[i].points);
  assert.equal(d.gains[0].id, "cushion");
});

test("improving the plan raises the score: a full cushion and reviewed assumptions", () => {
  const before = compute(familyPlan(), { today: TODAY }).score;
  const p = familyPlan(); p.accounts.find((a) => a.id === "a-chk").balance = 40000; p.assumptions.reviewedAt = "2026-10-01";
  const d = compute(p, { today: TODAY });
  assert.equal(part(d, "cushion").points, 15); assert.equal(part(d, "knows").points, 10);
  assert.ok(d.score > before + 10, `${before} -> ${d.score}`);
});

test("short on the careful month (review 2026-11-02): the saving part says it counts uneven pay at what you can count on, and what a full month leaves", async () => {
  const { compute: next } = await import("../next-best-action/compute.js");
  // nothing saved yet, so the saving part reads the month itself; the side income ($600) counted at $0
  const plan = () => { const p = familyPlan(); p.retirement.contributions = []; p.goals = []; return p; };
  const at = (leftInFull) => { const p = plan(); p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: next(plan(), { today: TODAY }).spare.monthly - leftInFull, period: "monthly", essential: false }); p.income.find((x) => x.id === "i-side").countOn = 0; return p; };
  const good = at(150), s = next(good, { today: TODAY }).spare;
  assert.ok(s.monthly < 0 && s.held > 0.5);
  assert.match(part(compute(good, { today: TODAY }), "saving").detail, /a month more goes out than comes in after tax, counting uneven pay at what you can count on \(Side income\); a month that brings the Income page's amount leaves about \$150\.$/);
  assert.match(part(compute(at(-120), { today: TODAY }), "saving").detail, /a month that brings the Income page's amount is still about \$120 short\.$/);
  // nothing held back: the plain sentence
  const p = plan(); p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: next(plan(), { today: TODAY }).spare.monthly + 100, period: "monthly", essential: false });
  assert.match(part(compute(p, { today: TODAY }), "saving").detail, /^About \$100 a month more goes out than comes in after tax\.$/);
});

test("no retirement verdict before Social Security is known: not scored, the top fix is to add it; Quick answers and the Timeline say nothing either way (round 4)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { answerFor } = await import("../quick/compute.js");
  const { compute: timeline } = await import("../timeline/compute.js");
  const { compute: next } = await import("../next-best-action/compute.js");
  const T = "2026-11-02";
  const p = familyPlan(T);
  p.retirement.socialSecurity = {};
  const d = compute(p, { today: T });
  const r = d.parts.find((x) => x.id === "retirement"), pr = d.parts.find((x) => x.id === "protection");
  assert.equal(r.status, "unknown"); assert.equal(r.points, 0); assert.match(r.detail, /^Not scored yet/); assert.doesNotMatch(r.detail, /runs out/);
  // one ask (ha2), in short words; what adding it does to the score is said under "How this is worked out" (`unlock`, ha2 fix F2)
  assert.equal(r.fix, "Add a Social Security estimate for Ana and Bo from ssa.gov/myaccount, or say who won't get it."); assert.deepEqual(r.go, ["retirement", "social-security"]);
  // (5 of 7 things shown 7.1, 6 of 7 shown 8.6: the gain as the part shows it, 1.5, ha2 fix F4)
  assert.equal(r.unlock, 'Not in the score yet: Social Security for Ana and Bo. Once added, "The plan knows enough" gains 1.5 points, and "Retirement on track" (out of 25) and "Protection" (out of 15) are scored on what you add.');
  assert.deepEqual(r.query, { show: "person-p-ana" }, "the link opens Ana's row on the Social Security page (ha2 fix P4)");
  assert.equal(pr.status, "unknown");
  assert.equal(d.gains[0].id, "retirement", "the biggest gain is adding Social Security, not spending less");
  assert.equal(answerFor("retire", p, { today: T }), null);
  const tl = timeline(p, { today: T });
  assert.ok(!tl.events.some((e) => e.id === "short" || e.id === "lasts")); assert.ok(tl.events.some((e) => e.id === "needs-ss"));
  // review 2026-11-02: the Timeline's top box says neither "runs out" nor "lasts" until then
  assert.equal(tl.headline.shortYear, null); assert.equal(tl.headline.lastsTo, null); assert.equal(tl.headline.needsSS, true);
  // only a birth date missing: it says that, and goes to People, not the Social Security page
  const nb = familyPlan(T); delete nb.household.people.find((x) => x.id === "p-bo").birthDate;
  const rb = compute(nb, { today: T }).parts.find((x) => x.id === "retirement");
  assert.equal(rb.status, "unknown");
  assert.equal(rb.detail, "Not scored yet: whether the money lasts needs Bo's birth date."); assert.equal(rb.fix, "Add Bo's birth date on People."); assert.deepEqual(rb.go, ["household", "people"]);
  assert.equal(rb.query, undefined, "a birth date: People, no Social Security row to open");
  const tb = timeline(nb, { today: T }).events.find((e) => e.id === "needs-ss");
  assert.match(tb.detail, /Bo's birth date on People/); assert.deepEqual(tb.go, ["household", "people"]);
  // one figure missing: named
  const half = familyPlan(T); delete half.retirement.socialSecurity["p-bo"];
  assert.equal(compute(half, { today: T }).parts.find((x) => x.id === "retirement").fix, "Add Bo's Social Security estimate from ssa.gov/myaccount, or say Bo won't get it.");
  // said as "none" for both, it is judged again
  p.guide = { setup: { ss: { "p-ana": "none", "p-bo": "none" } } };
  assert.notEqual(compute(p, { today: T }).parts.find((x) => x.id === "retirement").status, "unknown");
  // one adult: "An IRA of your own", not "for each of you"
  const one = familyPlan(T);
  one.household.people = one.household.people.filter((x) => x.id !== "p-bo");
  one.income = one.income.filter((x) => x.personId !== "p-bo");
  assert.equal(next(one, { today: T }).steps.find((s) => s.id === "ira")?.title, "An IRA of your own");
  // review 2026-11-02: two adults, one earner: one IRA's room, said the same on Next best action and the Dashboard's move
  const { revealWords } = await import("../setup/compute.js");
  const oneEarner = familyPlan(T); oneEarner.income = oneEarner.income.filter((x) => x.personId !== "p-bo");
  const ira = next(oneEarner, { today: T }).steps.find((s) => s.id === "ira");
  assert.equal(ira.title, "An IRA of your own"); assert.equal(ira.people, 1); assert.doesNotMatch(ira.detail, /each/);
  const w = revealWords(ira, oneEarner, { today: T });
  assert.equal(w.title, "A retirement account of your own (an IRA)"); assert.doesNotMatch(w.detail, /between you/);
});

test("Goals part: a goal waiting its turn on Next best action counts as on track, as on Goals and the Timeline (review 2026-11-02)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-02";
  const p = familyPlan(T);
  p.goals = p.goals.filter((g) => g.id === "g-col" || g.id === "g-car");
  p.goals.find((g) => g.id === "g-col").monthly = 0; p.goals.find((g) => g.id === "g-car").monthly = 900;
  const part = compute(p, { today: T }).parts.find((x) => x.id === "goals");
  assert.equal(part.share, 1);
  assert.match(part.detail, /2 of 2 goals with a date are done or on track, counting one waiting its turn\./);
  assert.equal(part.fix, null);
  assert.doesNotMatch(JSON.stringify(compute(p, { today: T }).parts), /needs more each month/);
});

test("the full-month figure is Next best action's own, to the nearest $10, as every page says it (review 2026-11-02, round 5)", async () => {
  const { compute: next } = await import("../next-best-action/compute.js");
  const plan = () => { const p = familyPlan(); p.retirement.contributions = []; p.goals = []; p.income.find((x) => x.id === "i-side").countOn = 0; return p; };
  const p = plan(); p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: next(plan(), { today: TODAY }).spare.full - 297, period: "monthly", essential: false });
  const s = next(p, { today: TODAY }).spare;
  assert.ok(s.monthly < 0); assert.equal(s.fullAbout, 300);
  assert.match(part(compute(p, { today: TODAY }), "saving").detail, /a month that brings the Income page's amount leaves about \$300\.$/);
});

test("a full month within $5 of $0 'only just about breaks even' in the saving part, never 'about $0' (review 2026-11-02, round 5)", async () => {
  const { compute: next } = await import("../next-best-action/compute.js");
  const plan = () => { const p = familyPlan(); p.retirement.contributions = []; p.goals = []; p.income.find((x) => x.id === "i-side").countOn = 0; return p; };
  const at = (left) => { const p = plan(); p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: next(plan(), { today: TODAY }).spare.full - left, period: "monthly", essential: false }); return p; };
  for (const left of [3, -2]) {
    const detail = part(compute(at(left), { today: TODAY }), "saving").detail;
    assert.match(detail, /a month that brings the Income page's amount only just about breaks even\.$/);
    assert.doesNotMatch(detail, /about \$0\b/);
  }
});

// --- round 8 (2026-11-06), renter-debt-4: the retirement hint takes Goal seek's answers, for the target it names --------------
test("round 8: short of lasting, the hint quotes Goal seek's saving for the money to last, never a yearly gap called a monthly cut", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { compute: goalSeek } = await import("../../scenarios/goal-seek/compute.js");
  const today = "2026-11-06";
  // $1 in Riley's 401(k): the answer is known (with nothing saved it is "not known yet": the sweep x3 test at the end)
  const p = renterDebtPlan(); p.accounts.find((a) => a.id === "k401").balance = 1;
  const ret = compute(p, { today }).parts.find((x) => x.id === "retirement");
  // the plan can carry $0 against $2,040 planned: it said "about $2,350 a month less spending", (1.15 x 24,480 - 0) / 12,
  // a yearly gap in retirement spending put as a monthly cut larger than the whole planned spending
  assert.ok(!/2,350|less spending/.test(ret.fix), ret.fix);
  // Goal seek, same plan, the money lasting (leave nothing): about $243.53 a month more saving (shown as $250: a need rounds up, 2026-11-07); spending alone cannot do it and
  // working to 75 does not either, so neither is offered
  // asked the way the score asks it (retirementWays: these three levers, the age by bisection); with $1 saved Goal seek's plain call
  // lands on $290 on its coarser search, where with nothing saved the two agreed at $250
  const gs = goalSeek(p, { today, only: ["spending", "retire", "saving"], retireSearch: "bisect" }).levers;
  const save = gs.find((l) => l.id === "saving");
  assert.equal(Math.ceil((save.value - save.current) / 10) * 10, 250);
  assert.equal(gs.find((l) => l.id === "spending").status, "cannot");
  assert.equal(gs.find((l) => l.id === "retire").status, "cannot");
  assert.match(ret.fix, /^To make the money last: save about \$250 a month more\. Open the Goal seek page to see the amount that just makes it last\./);
  assert.ok(!ret.fix.includes("retire at"));
});
test("round 8: lasting but under 115%, the hint asks Goal seek for 115% and the spending cut is the planned spending less what it can carry / 1.15", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { compute: goalSeek } = await import("../../scenarios/goal-seek/compute.js");
  const { compute: proj } = await import("../../retirement/projection/compute.js");
  const today = "2026-11-06";
  const p = renterDebtPlan();
  p.accounts.find((a) => a.id === "k401").balance = 100000;
  const pr = proj(p, { today });
  const ratio = pr.affordable / pr.spendingYearly;
  assert.ok(ratio > 1 && ratio < 1.15, `in the band: ${ratio}`);   // 26,222 / 24,480 = 1.071
  const ret = compute(p, { today }).parts.find((x) => x.id === "retirement");
  // the cut that gives 115%: 2,040 - (what it can carry a month) / 1.15, from Goal seek's spending lever (by hand from the
  // projection: 2,040 - 26,222 / 12 / 1.15 = 139.9, about $140), not (1.15 x 24,480 - 26,222) / 12 = $161 as before
  const gs = goalSeek(p, { today, spendingScale: 1.15, only: ["spending", "retire", "saving"] });
  const spend = gs.levers.find((l) => l.id === "spending");
  const save = gs.levers.find((l) => l.id === "saving");
  assert.equal(Math.round((2040 - spend.value / 1.15) / 10) * 10, 140);
  const more = Math.ceil((save.value - save.current) / 10 - 1e-9) * 10;
  assert.ok(ret.fix.startsWith(`Full marks at 115% (room for bad luck): save about $${more} a month more`), ret.fix);
  assert.ok(ret.fix.endsWith('or spend about $140 a month less. Open the Goal seek page to see each with "Room for bad luck" on.'), ret.fix);
  assert.deepEqual(ret.query, { target: "badluck" });
  // the page's own call (no new arguments) still works every lever
  assert.deepEqual(goalSeek(p, { today }).levers.map((l) => l.id), ["spending", "retire", "saving", "returns", "lump", "claim"]);
});

test("round 8: the debt part grades a renter's payments on the renters' 20% line", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const debt = compute(renterDebtPlan(), { today: "2026-11-06" }).parts.find((x) => x.id === "debt");
  assert.match(debt.detail, /Required payments take 21% of income before tax; for renters the guideline is 20% or less \(rent not counted\)\./);
  // $9,800 of card debt against a quarter of $39,000 (9,750): no points there; 21% over 20%: half of the third
  assert.equal(debt.points, Math.round(((0 * 2 + 0.5) / 3) * 15 * 10) / 10);
});

// --- round 8 review (2026-11-06) -------------------------------------------------------------------------------------------
test("review D3 and D7: a renter's debt part is of the required payments, graded at the percent shown", async () => {
  const { renterDebtPlan, renterPayingExtraPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  // $400 extra on the Visa: the $320 required is 9.8%, within 20%: the third for payments in full; $9,800 of cards against a
  // quarter of $39,000 ($9,750): nothing there. (0 x 2 + 1) / 3 x 15 = 5 points, as before the batch
  const a = compute(renterPayingExtraPlan(), { today: "2026-11-06" }).parts.find((x) => x.id === "debt");
  assert.match(a.detail, /Required payments take 10% of income before tax; for renters the guideline is 20% or less \(rent not counted\)\./);
  assert.equal(a.points, 5);
  // $660 / $3,250 = 20.3%, shown as 20%: full marks on the third
  const p = renterDebtPlan(); p.debts.find((d) => d.id === "setup-debt-credit").minPayment = 140;
  assert.equal(compute(p, { today: "2026-11-06" }).parts.find((x) => x.id === "debt").points, 5);
});

test("review D5: under a spending rule that never runs out, the hint is worked out on steady spending, the score's own measure", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const p = renterDebtPlan(); p.retirement.strategy = "percent"; p.accounts.find((a) => a.id === "k401").balance = 1;   // $1 saved: an answer
  const fix = compute(p, { today: "2026-11-06" }).parts.find((x) => x.id === "retirement").fix;
  // the same $250 as on steady spending (the plan's own rule gave Goal seek's saving lever $10)
  assert.match(fix, /^To carry the planned spending every year: save about \$250 a month more/);
});

test("review D4: the hint names the target Goal seek must be set to, and the link opens it there", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const one = () => { const p = renterDebtPlan(); p.accounts.find((a) => a.id === "k401").balance = 1; return p; };   // $1 saved: an answer
  const ret = compute(one(), { today: "2026-11-06" }).parts.find((x) => x.id === "retirement");
  assert.match(ret.fix, /^To make the money last: save about \$250 a month more\. Open the Goal seek page to see the amount that just makes it last\./);
  assert.deepEqual(ret.query, { target: "last" });
  // lasting but under 115%: Goal seek has no such target, so the hint says how it was worked out instead of pointing at the page
  const q = renterDebtPlan(); q.accounts.find((a) => a.id === "k401").balance = 100000;
  const r2 = compute(q, { today: "2026-11-06" }).parts.find((x) => x.id === "retirement");
  assert.ok(r2.fix.endsWith('Open the Goal seek page to see it with "Room for bad luck" on.') || r2.fix.endsWith('Open the Goal seek page to see each with "Room for bad luck" on.'), r2.fix);
  assert.deepEqual(r2.query, { target: "badluck" });
  // the page's link carries the target
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const page = await renderPage(new URL("./view.js", import.meta.url), one(), "2026-11-06", { computeRemote: { "overview/health-score": compute } });
  assert.ok(page.root.querySelectorAll("a").some((a) => a.getAttribute("href") === "#/scenarios/goal-seek?target=last"));
});

test("review UX: a spending cut of more than half the planned spending is not offered as a way to full marks", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  // $40,000 saved, retiring at 63, Social Security at 70: it carries about $920 of $2,040; Goal seek's cut is about $1,120
  const p = renterDebtPlan(); p.accounts.find((a) => a.id === "k401").balance = 40000;
  p.household.people[0].retirementAge = 63; p.retirement.socialSecurity["setup-self"].claimAge = 70;
  const fix = compute(p, { today: "2026-11-06" }).parts.find((x) => x.id === "retirement").fix;
  assert.match(fix, /save about \$170 a month more or retire at 68/); assert.ok(!/spend about/.test(fix), fix);
});

test("review UX: 'How the score is worked out' says the debt part in plain words", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const t = await pageText(new URL("./view.js", import.meta.url), renterDebtPlan(), "2026-11-06", { computeRemote: { "overview/health-score": compute } });
  assert.match(t, /Debt: most points for no card-type debt \(10% interest or more\); the rest for payments under 36% of pay before tax, or 20% if you rent\./);
  assert.ok(!/qualified-mortgage|scaled against/.test(t));
});

test("a plan not started is not graded: scored false, and no full marks for debt with nothing to judge (stress test OV-4)", async () => {
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const d = compute(emptyPlan(), { today: "2026-11-11" });
  assert.equal(d.scored, false);
  const debt = d.parts.find((p) => p.id === "debt");
  assert.equal(debt.status, "unknown"); assert.equal(debt.points, 0);
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  assert.equal(compute(familyPlan("2026-11-11"), { today: "2026-11-11" }).scored, true);
});

test("no grade part way through the questions; after them the button names the missing page, never the questions (attack2, 2026-11-11)", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(src.includes('if (d.scored === false || sc?.state === "started")'));
  assert.ok(src.includes('sc?.state === "done" ? gap'));
  assert.ok(src.includes('"Add what you own \\u203a"') && src.includes('"Add what goes out \\u203a"'));
});

test("an empty plan's filled button says what every other page says: Set up my plan (review 2026-11-11 N18)", async () => {
  const fs = await import("node:fs");
  const view = fs.readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(view.includes('["#/overview/setup", "Set up my plan \\u203a"]') && !view.includes("Answer a few easy questions"));
  // with an account the never-opened button is the Dashboard's first step (firstStep basics), not "Set up my plan" (attack on N18)
  assert.ok(view.includes("firstStep(ctx.plan)") && view.includes('fs?.kind === "basics" ? [fs.href'));
});

test("nothing saved for retirement and nothing going in: retirement and protection 'not known yet', never 'The money runs out in 2067' beside Will the money last?'s 'We don't know yet' (whole-app sweep x3, critic F2)", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const personas = await import("../../../qa/fixtures/setup-personas.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { compute: proj, savingsUnknown, unknownWords } = await import("../../retirement/projection/compute.js");
  const T16 = "2026-11-16";
  const sam = migrate(personas.finishSetup("sam", personas.sam(T16), T16));
  for (const [who, plan, nothing] of [["Riley (an empty Work 401(k))", renterDebtPlan(), true], ["Sam (nothing said)", sam, false]]) {
    assert.ok(savingsUnknown(proj(structuredClone(plan), { today: T16 })), `${who}: Will the money last? says "We don't know yet"`);
    const d = compute(structuredClone(plan), { today: T16 });
    const ret = d.parts.find((x) => x.id === "retirement"), pro = d.parts.find((x) => x.id === "protection");
    assert.equal(ret.status, "unknown", who); assert.equal(ret.points, 0);
    // the shared words, apart: the sentence as the part's words, the way on as its fix (unknownWords is the two together)
    assert.equal(`${ret.detail.replace(/^Not scored yet\. /, "")} ${ret.fix}`, unknownWords({ nothingSaved: nothing }, "whether the money lasts"), who);
    assert.deepEqual(ret.go, ["balance", "net-worth"]);
    assert.equal(ret.hint, undefined, `${who}: no way to make it last is worked out`);
    assert.equal(pro.status, "unknown", who); assert.match(pro.detail, /^Not scored yet: the stress tests need what you own first/);
    assert.doesNotMatch(JSON.stringify(d), /runs? out|ran out|runs short/i, who);
  }
  // one dollar saved: scored as before (the money runs out, and the hint says what makes it last)
  const one = renterDebtPlan(); one.accounts.find((a) => a.id === "k401").balance = 1;
  const r1 = compute(one, { today: T16 }).parts.find((x) => x.id === "retirement");
  assert.notEqual(r1.status, "unknown"); assert.match(r1.detail, /^The money runs out in \d{4}/);
});

test("z1: Social Security the only gap and the money lasting without it: the retirement part is scored on that answer", async () => {
  const { compute: score } = await import("./compute.js");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const T = "2026-11-16";
  const part = (d, id) => d.parts.find((x) => x.id === id);
  // Ruth and Sam: Sam has no Social Security figure; Will the money last? says the money lasts without it (256% carried)
  const d = score(retiredCouplePlan(T), { today: T });
  assert.deepEqual([part(d, "retirement").points, part(d, "retirement").status, part(d, "retirement").fix], [25, "ok", null]);
  assert.equal(part(d, "retirement").detail, "The plan can carry about $7,120 a month; you plan to spend $2,780. Sam's Social Security is not counted yet.");
  // the stress tests still wait for Sam's figure, and no longer say "like the retirement part"; said in plain words on the first
  // view, where this is the one ask (ha2 fix P3: "the stress tests" read as jargon there)
  assert.deepEqual([part(d, "protection").share, part(d, "protection").detail], [null, "Not scored yet: checking life's shocks, like a death or a long life, needs Social Security for Sam."]);
  assert.equal(part(d, "protection").fix, "Add Sam's Social Security estimate from ssa.gov/myaccount, or say Sam won't get it.");
  assert.equal(d.score, 76);
  // spending three times as high: short without it, so neither part is scored, as before
  const high = retiredCouplePlan(T); for (const x of high.expenses) x.amount *= 3;
  const h = score(high, { today: T });
  assert.deepEqual([part(h, "retirement").share, part(h, "retirement").detail], [null, "Not scored yet: whether the money lasts needs Social Security for Sam."]);
  assert.equal(part(h, "protection").detail, "Not scored yet: the stress tests need Social Security for Sam first, like the retirement part.");
  assert.equal(part(h, "protection").fix, "Scored as soon as the retirement part above is.");
  assert.equal(part(h, "protection").askedIn, "retirement", "its points wait on the retirement part's ask (ha2)");
  // Sam's figure typed: scored, with no sentence about it
  const typed = retiredCouplePlan(T); typed.retirement.socialSecurity = { "p-sam": { monthlyAtFRA: 1500 } };
  assert.doesNotMatch(part(score(typed, { today: T }), "retirement").detail, /not counted yet/);
});

test("ha2: Ruth and Sam: Sam's missing Social Security is ONE ask, which says what it unlocks; nothing says 'as above'", async () => {
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const T = "2026-11-16";
  const d = compute(retiredCouplePlan(T), { today: T });
  const part = (id) => d.parts.find((x) => x.id === id);
  // the ask itself: Protection, the biggest gain, says how in short words (ha2 fix P2); what it does to the score is `unlock`, for
  // "How this is worked out": the one sure gain, 1 of the 7 things "The plan knows enough" counts (5.7 -> 7.1, "1.4"), and
  // Protection scored on what is added (ha2 fix F2: "This unlocks up to 15 points" read as the prize); its link opens Sam's row
  assert.equal(d.gains[0].id, "protection");
  assert.equal(part("protection").fix, "Add Sam's Social Security estimate from ssa.gov/myaccount, or say Sam won't get it.");
  assert.equal(part("protection").unlock, 'Not in the score yet: Social Security for Sam. Once added, "The plan knows enough" gains 1.4 points, and "Protection" (out of 15) is scored on what you add.');
  assert.deepEqual([part("protection").go, part("protection").query], [["retirement", "social-security"], { show: "person-p-sam" }]);
  // the completeness part does not ask again (it said "add Sam's Social Security (as above)"); its points and count are the same
  assert.equal(part("knows").fix, "Still to do: say what you will spend in retirement; look over your assumptions (once a year).");
  assert.equal(part("knows").detail, "4 of 7 things the score depends on are filled in and up to date.");
  assert.deepEqual([part("knows").points, part("knows").askedIn], [5.7, undefined], "two other things to do: its own row");
  // one ask on the whole output: Sam's Social Security is asked for once, and no part says "as above"
  const json = JSON.stringify(d.parts);
  assert.equal((json.match(/Sam's Social Security estimate/g) ?? []).length, 1);
  assert.doesNotMatch(json, /as above|add Sam's Social Security|a Social Security figure for every adult|unlocks up to/);
  assert.equal(d.score, 76);
  // a plan whose answer waits for the figure (spending three times as high): the retirement part asks, with both parts' points
  const high = retiredCouplePlan(T); for (const x of high.expenses) x.amount *= 3;
  const h = compute(high, { today: T }), hp = (id) => h.parts.find((x) => x.id === id);
  assert.equal(hp("retirement").fix, "Add Sam's Social Security estimate from ssa.gov/myaccount, or say Sam won't get it.");
  assert.equal(hp("retirement").unlock, 'Not in the score yet: Social Security for Sam. Once added, "The plan knows enough" gains 1.4 points, and "Retirement on track" (out of 25) and "Protection" (out of 15) are scored on what you add.');
  assert.equal(hp("protection").askedIn, "retirement");
  assert.doesNotMatch(hp("knows").fix, /Social Security/);
  // Sam's figure typed: nothing to add, and the completeness part counts it (5 of 7)
  const typed = retiredCouplePlan(T); typed.retirement.socialSecurity = { "p-sam": { monthlyAtFRA: 1500 } };
  const t = compute(typed, { today: T });
  assert.doesNotMatch(JSON.stringify(t.parts), /Social Security for Sam|Sam's Social Security|"unlock"|"show"/);
  assert.equal(t.parts.find((x) => x.id === "knows").points, 7.1);
});

test("ha2: 'won't get it' on the Social Security page counts as known for 'The plan knows enough', as every retirement page counts it", async () => {
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const T = "2026-11-16";
  const none = retiredCouplePlan(T); none.guide = { ...(none.guide ?? {}), setup: { ...(none.guide?.setup ?? {}), ss: { "p-sam": "none" } } };
  const d = compute(none, { today: T }), k = d.parts.find((x) => x.id === "knows");
  // the ask offered "or say there that Sam will not get it": saying it earns the 1.4 the ask promised, and nothing asks again
  assert.equal(k.points, 7.1); assert.equal(k.detail, "5 of 7 things the score depends on are filled in and up to date.");
  assert.doesNotMatch(JSON.stringify(d.parts), /Social Security for Sam|Sam's Social Security|a Social Security figure|"unlock"/);
  assert.notEqual(d.parts.find((x) => x.id === "protection").status, "unknown", "Protection is scored now");
});

test("ha2: the one ask, case by case: Social Security, a birth date, both; the completeness clause only when the ask fills it", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-16";
  const ask = (plan) => { const d = compute(plan, { today: T }); return Object.fromEntries(d.parts.map((p) => [p.id, p])); };
  // 01-single-adult (no Social Security, short or not known without it): the retirement part asks; Protection waits on it
  const one = ask(ARCHETYPES.find((a) => a.id === "01-single-adult").build());
  assert.equal(one.retirement.fix, "Add your Social Security estimate from ssa.gov/myaccount, or say you won't get it.");
  assert.equal(one.retirement.unlock, 'Not in the score yet: your Social Security. Once added, "The plan knows enough" gains 1.4 points, and "Retirement on track" (out of 25) and "Protection" (out of 15) are scored on what you add.');
  assert.deepEqual([one.protection.askedIn, one.protection.fix], ["retirement", "Scored as soon as the retirement part above is."]);
  assert.equal(one.knows.fix, "Still to do: say what you will spend in retirement; look over your assumptions (once a year).");
  // a birth date and Social Security both missing: one ask, two of the seven things (2 x 10 / 7 = 2.86, "2.9")
  const both = familyPlan(T); both.retirement.socialSecurity = {}; delete both.household.people.find((x) => x.id === "p-bo").birthDate;
  const b = ask(both);
  assert.equal(b.retirement.fix, "Add a Social Security estimate for Ana and Bo from ssa.gov/myaccount, or say who won't get it. Add Bo's birth date on People.");
  assert.match(b.retirement.unlock, /^Not in the score yet: Social Security for Ana and Bo and Bo's birth date\. Once added, "The plan knows enough" gains 2\.9 points, and /);
  assert.doesNotMatch(b.knows.fix ?? "", /birth date|Social Security/);
  // Bo's figure missing and Ana said "won't get it": the ask fills the completeness part's Social Security thing too (both known)
  const mixed = familyPlan(T); delete mixed.retirement.socialSecurity["p-ana"]; delete mixed.retirement.socialSecurity["p-bo"];
  mixed.guide = { ...(mixed.guide ?? {}), setup: { ...(mixed.guide?.setup ?? {}), ss: { "p-ana": "none" } } };
  assert.equal(ask(mixed).retirement.fix, "Add Bo's Social Security estimate from ssa.gov/myaccount, or say Bo won't get it.");
  assert.match(ask(mixed).retirement.unlock, /"The plan knows enough" gains 1\.5 points, and "Retirement on track" \(out of 25\) and "Protection" \(out of 15\) are scored on what you add\.$/);
  // nothing else missing in the completeness part: its points wait on the ask (no fix of its own, askedIn), never a second row
  const lone = familyPlan(T); lone.retirement.socialSecurity = {}; lone.assumptions.reviewedAt = T;
  const l = ask(lone);
  assert.deepEqual([l.knows.points, l.knows.detail, l.knows.fix, l.knows.askedIn], [8.6, "6 of 7 things the score depends on are filled in and up to date.", null, "retirement"]);
});

test("ha2: unlockWords: the sure gain as a figure, the parts that wait scored on what is added; askWords, one adult, one of several, several, a birth date", async () => {
  const { unlockWords, askWords } = await import("./compute.js");
  const K = "The plan knows enough";
  assert.equal(unlockWords({ what: "Social Security for Sam", sure: [{ title: K, points: 1.4 }], scored: [{ title: "Protection", max: 15 }] }), 'Not in the score yet: Social Security for Sam. Once added, "The plan knows enough" gains 1.4 points, and "Protection" (out of 15) is scored on what you add.');
  assert.equal(unlockWords({ what: "your Social Security", sure: [{ title: K, points: 1.5 }], scored: [{ title: "Retirement on track", max: 25 }, { title: "Protection", max: 15 }] }), 'Not in the score yet: your Social Security. Once added, "The plan knows enough" gains 1.5 points, and "Retirement on track" (out of 25) and "Protection" (out of 15) are scored on what you add.');
  // the completeness thing not filled by the ask: no figure at all; whole points and one point
  assert.equal(unlockWords({ what: "Social Security for Bo", sure: [], scored: [{ title: "Protection", max: 15 }] }), 'Not in the score yet: Social Security for Bo. Once added, "Protection" (out of 15) is scored on what you add.');
  assert.equal(unlockWords({ what: "x", sure: [{ title: K, points: 1 }] }), 'Not in the score yet: x. Once added, "The plan knows enough" gains 1 point.');
  // nowhere a figure that reads as the prize (ha2 fix F2)
  assert.doesNotMatch(unlockWords({ what: "x", sure: [], scored: [{ title: "Protection", max: 15 }] }), /up to|unlocks|\b15 points/);
  assert.equal(askWords({ ss: ["you"], dates: [] }, true), "Add your Social Security estimate from ssa.gov/myaccount, or say you won't get it.");
  assert.equal(askWords({ ss: ["Sam"], dates: [] }, false), "Add Sam's Social Security estimate from ssa.gov/myaccount, or say Sam won't get it.");
  assert.equal(askWords({ ss: ["you"], dates: [] }, false), "Add your Social Security estimate from ssa.gov/myaccount, or say you won't get it.");
  assert.equal(askWords({ ss: ["Ana", "Bo"], dates: ["Bo"] }, false), "Add a Social Security estimate for Ana and Bo from ssa.gov/myaccount, or say who won't get it. Add Bo's birth date on People.");
  assert.equal(askWords({ ss: [], dates: ["Ana", "Bo"] }, false), "Add the birth dates of Ana and Bo on People.");
  assert.equal(askWords({ ss: ["you"], dates: ["you"] }, true), "Add your Social Security estimate from ssa.gov/myaccount, or say you won't get it. Add your birth date on People.");
});

test("ha2 fix F1: a Social Security line on Income that ended in the past is missing for the ask too: one ask naming everyone it lacks, never asked again", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const T = "2026-11-16";
  const base = () => { const p = ARCHETYPES.find((a) => a.id === "02-couple-no-kids").build(); p.retirement = { ...(p.retirement ?? {}), socialSecurity: {} }; p.income = p.income.filter((i) => i.type !== "social"); return p; };
  const adults = (p) => p.household.people.filter((x) => x.role !== "dependent");
  const line = (p, who, endDate) => ({ id: `i-ss-${who.id}`, name: "Social Security", type: "social", personId: who.id, amount: 1800, period: "monthly", growth: 0, taxable: true, endDate });
  for (const [label, ended] of [["both lines ended", [0, 1]], ["one line ended, the other adult none", [0]]]) {
    const p = base(); const [a, b] = adults(p);
    for (const i of ended) p.income.push(line(p, [a, b][i], "2025-01-01"));
    const d = compute(p, { today: T }), part = (id) => d.parts.find((x) => x.id === id);
    // it said "Add Social Security on the Social Security page." with nothing named (both ended), or named only the adult with no line
    assert.equal(part("retirement").detail, `Not scored yet: whether the money lasts needs Social Security for ${a.name} and ${b.name}.`, label);
    assert.equal(part("retirement").fix, `Add a Social Security estimate for ${a.name} and ${b.name} from ssa.gov/myaccount, or say who won't get it.`, label);
    assert.ok(part("retirement").unlock, label);
    assert.equal(part("protection").askedIn, "retirement", label);
    // "The plan knows enough" no longer asks "add a Social Security figure for every adult" beside it
    assert.doesNotMatch(part("knows").fix ?? "", /Social Security/, label);
    assert.equal(JSON.stringify(d.parts).match(/Social Security estimate/g).length, 1, label);
  }
  // a line still going counts, as before: nothing asked
  const going = base(); for (const x of adults(going)) going.income.push(line(going, x, "2060-01-01"));
  assert.doesNotMatch(JSON.stringify(compute(going, { today: T }).parts), /Social Security estimate|"unlock"/);
});

test("ha2 fix F3, P5: no adult with a birth date: the retirement part asks for one in plain words, and 'The plan knows enough' does not ask again", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const T = "2026-11-16";
  const plans = [...ARCHETYPES.map((a) => [a.id, a.build()]), ["Ruth and Sam", retiredCouplePlan(T)]];
  for (const [name, p] of plans) {
    for (const x of p.household.people) if (x.role !== "dependent") delete x.birthDate;
    const d = compute(p, { today: T }), part = (id) => d.parts.find((x) => x.id === id);
    assert.equal(part("retirement").detail, "We can't tell yet whether your money lasts.", name);   // it said "The plan cannot be run yet."
    assert.match(part("retirement").fix, /birth date/, name);
    // the birth date is asked once: it said "add a birth date for every adult" here too, in every household
    assert.doesNotMatch(part("knows").fix ?? "", /birth date/, name);
    assert.equal((JSON.stringify(d.parts).match(/birth date/g) ?? []).length, 1, name);
    // no sentence on what it unlocks (more may be missing, and one date of two fills nothing there yet)
    assert.equal(part("retirement").unlock, undefined, name);
  }
});

test("ha2 fix F4: the sure gain the ask states is what the part's shown points move by once the figure is in", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-16";
  const noSs = (p) => { p.retirement = { ...(p.retirement ?? {}), socialSecurity: {} }; p.income = (p.income ?? []).filter((i) => i.type !== "social"); return p; };
  const plans = [...ARCHETYPES.map((a) => [a.id, noSs(a.build())]), ["Ruth and Sam", retiredCouplePlan(T)], ["family", noSs(familyPlan(T))],
    ["family, assumptions looked over", (() => { const p = noSs(familyPlan(T)); p.assumptions.reviewedAt = T; return p; })()]];
  let seen = new Set();
  for (const [name, p] of plans) {
    const d = compute(p, { today: T }), ask = d.parts.find((x) => x.unlock);
    if (!ask) continue;
    const stated = /"The plan knows enough" gains ([\d.]+) point/.exec(ask.unlock);
    if (!stated) continue;
    // the figure typed for every adult it names ("won't get it" fills the same thing)
    const filled = structuredClone(p); filled.guide = { ...(filled.guide ?? {}), setup: { ...(filled.guide?.setup ?? {}), ss: Object.fromEntries(filled.household.people.filter((x) => x.role !== "dependent").map((x) => [x.id, "none"])) } };
    const k0 = d.parts.find((x) => x.id === "knows").points, k1 = compute(filled, { today: T }).parts.find((x) => x.id === "knows").points;
    assert.equal(Number(stated[1]), Math.round((k1 - k0) * 10) / 10, `${name}: ${k0} -> ${k1}`);
    seen.add(stated[1]);
  }
  assert.ok(seen.has("1.4") && seen.has("1.5"), [...seen].join(", "));
});

test("ha2: the retirement part's sentences, one per case: lasts (no percent; the share is `ratio`), runs out (as before)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const T = "2026-11-16";
  const r = compute(familyPlan(T), { today: T }).parts.find((x) => x.id === "retirement");
  assert.equal(r.detail, "The plan can carry about $8,430 a month; you plan to spend $7,000.");
  assert.ok(Math.abs(r.ratio - 1.2) < 0.01 && Math.round(r.ratio * 100) === 120, String(r.ratio));
  assert.doesNotMatch(r.detail, /%/);
  // short of lasting: the same sentence as before, and the share for "How this is worked out"
  const one = renterDebtPlan(); one.accounts.find((a) => a.id === "k401").balance = 1;
  const s = compute(one, { today: T }).parts.find((x) => x.id === "retirement");
  assert.match(s.detail, /^The money runs out in \d{4}: it can carry about \$[\d,]+ a month against the \$[\d,]+ planned\.$/);
  assert.ok(s.ratio < 1);
  // not scored: no share
  const e = compute(renterDebtPlan(), { today: T }).parts.find((x) => x.id === "retirement");
  assert.equal(e.ratio, undefined);
});

// ---------------------------------------------------------------- invariance (ha2, gap spec 3.5)
// One ask for a missing Social Security figure and the retirement part in plain words (ha2, 2026-11-17) change words only. Over
// every invented household (qa/fixtures *-plan.mjs, the 14 households' base plans, the phone-built ones, round 8, the four Get
// started personas after the questions, the demo and the empty plan), with nothing new typed: the score's whole output, and the
// yearly review's steps that quote it, with 452408a's words put back (tests/health-score-words.mjs), is byte for byte what
// 452408a gave (digests in ./invariance.json, written from that code: PRINT=1 node --test on it); the score, the band and every
// part's points are the same without putting anything back.
test("invariance: with 452408a's words put back, the score's output is 452408a's over every invented household", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const crypto = await import("node:crypto");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const { migrate, emptyPlan: empty } = await import("../../../core/schema/migrate.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const phone = await import("../../../qa/fixtures/phone-households.mjs");
  const round8 = await import("../../../qa/fixtures/round8-households.mjs");
  const personas = await import("../../../qa/fixtures/setup-personas.mjs");
  const { demoHousehold } = await import("../../../qa/fixtures/demo-household.mjs");
  const { compute: annual } = await import("../../reports/annual-review/compute.js");
  const back = await import("../../../tests/health-score-words.mjs");
  const T = "2026-11-16";
  const plans = [];
  const dir = fileURLToPath(new URL("../../../qa/fixtures/", import.meta.url));
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) plans.push({ name: `fixture ${f}:${name}`, plan: fn(T) });
  }
  for (const a of ARCHETYPES) plans.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") plans.push({ name: `phone ${name}`, plan: fn() });
  for (const [name, fn] of Object.entries(round8)) if (typeof fn === "function" && /Plan$/.test(name)) plans.push({ name: `round8 ${name}`, plan: fn() });
  for (const n of ["sam", "jordan", "patLee", "ruth"]) plans.push({ name: `persona ${n}`, plan: personas.finishSetup(n, personas[n](T), T) });
  plans.push({ name: "demo", plan: demoHousehold(T) });
  plans.push({ name: "empty plan", plan: empty() });
  const dig = (v) => crypto.createHash("sha256").update(JSON.stringify(v) ?? "undefined").digest("base64url").slice(0, 22);
  const run = (f) => { try { return f(); } catch (e) { return { threw: String(e.message) }; } };
  const now = {}, scores = {};
  for (const { name, plan: raw } of plans) {
    const plan = migrate(structuredClone(raw));
    const h = run(() => compute(structuredClone(plan), { today: T }));
    const steps = run(() => annual(structuredClone(plan), { today: T, year: 2026 }).ahead?.steps ?? null);
    now[name] = { health: dig(back.healthBack(h, plan, T)), annualSteps: dig(back.stepsBack(steps, plan, T)) };
    scores[name] = h?.ready ? [h.score, h.band, h.parts.map((p) => `${p.id} ${p.points}`).join(", ")] : null;
  }
  const file = new URL("./invariance.json", import.meta.url);
  if (process.env.PRINT) { fs.writeFileSync(file, `${JSON.stringify({ note: "Plan health score at 452408a (ha2), today 2026-11-16; PRINT=1 writes them again: only on that code", today: T, plans: now, scores }, null, 1)}\n`); return; }
  const was = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.ok(plans.length >= 45, `${plans.length} households`);
  assert.deepEqual(Object.keys(now), Object.keys(was.plans));
  for (const name of Object.keys(now)) {
    assert.deepEqual(scores[name], was.scores[name], `${name}: the score, its band and every part's points`);
    assert.deepEqual(now[name], was.plans[name], `${name}: the output with 452408a's words put back`);
  }
});
