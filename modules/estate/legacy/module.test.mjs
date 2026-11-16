import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, legacyTarget } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const withLegacy = (legacy) => { const p = familyPlan(TODAY); p.estate.legacy = legacy; return p; };
const BEQ = [{ id: "a", to: "Cy", kind: "person", amount: 900000 }, { id: "b", to: "Food bank", kind: "charity", amount: 50000 }];

test("the target: the bequests' total, less the home when it is part of the legacy", () => {
  assert.deepEqual(legacyTarget(emptyPlan()), { total: 0, home: 0, target: 0 });
  assert.deepEqual(legacyTarget(withLegacy({ bequests: BEQ })), { total: 950000, home: 0, target: 950000 });
  assert.deepEqual(legacyTarget(withLegacy({ bequests: BEQ, includeHome: true })), { total: 950000, home: 380000, target: 570000 });
  assert.equal(legacyTarget(withLegacy({ bequests: [{ id: "a", to: "Cy", amount: 100000 }], includeHome: true })).target, 0, "never below zero");
});

test("nothing to leave: no goal-seek run", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.total, 0); assert.equal(d.levers, null); assert.equal(d.meets, true);
});

test("the family's legacy: shares, by kind, checked against the plan's end and solved by goal seek", () => {
  const d = compute(withLegacy({ bequests: BEQ, includeHome: true }), { today: TODAY });
  assert.equal(d.people, 900000); assert.equal(d.charity, 50000); assert.ok(Math.abs(d.bequests[0].share - 900000 / 950000) < 1e-12);
  assert.equal(d.ready, true); assert.equal(d.meets, d.endReal >= 570000);
  assert.ok(Array.isArray(d.levers) && d.levers.some((l) => l.id === "spending"));
  const big = compute(withLegacy({ bequests: [{ id: "a", to: "Cy", kind: "person", amount: 2000000 }] }), { today: TODAY });
  assert.equal(big.meets, false); assert.ok(big.gap > 0); assert.equal(big.levers.find((l) => l.id === "spending").status, "needs");
});

test("not ready without the plan's basics, the bequests still listed", () => {
  const p = emptyPlan(); p.estate.legacy = { bequests: BEQ };
  const d = compute(p, { today: TODAY });
  assert.equal(d.ready, false); assert.equal(d.total, 950000);
});

// fix round 1 of the owner's request 2026-11-11 (2026-11-12, B3): the return it needs is information on Goal seek, never a change,
// so "Does the plan leave it?" does not list it, and the Social Security card keeps its place in the five
test("fix round 1 (B3): the changes listed leave out the return it needs (information, not a change)", async () => {
  const { listedLevers } = await import("./compute.js");
  // an invented one-adult household like the phone walk's Jamie (short, no match), leaving $20,000
  const p = emptyPlan();
  p.household.people.push({ id: "me", name: "Jamie", role: "self", birthDate: "1982-11-15" });
  p.household.filingStatus = "single";
  p.accounts.push({ id: "k", name: "Jamie's plan at work", type: "401k", balance: 30000, ownerId: "me" }, { id: "chk", name: "Checking", type: "checking", balance: 3000 }, { id: "sav", name: "Savings", type: "savings", balance: 18000 });
  p.income.push({ id: "pay", name: "Pay", type: "salary", personId: "me", amount: 64000, period: "annual" });
  p.retirement.spendingMonthly = 3220;
  p.retirement.socialSecurity = { me: { monthlyAtFRA: 2484 } };
  p.retirement.workPlans = { me: { plan: true, match: false } };
  p.retirement.contributions.push({ id: "row", accountId: "k", personId: "me", period: "monthly", amount: 250, employerMatch: 0 });
  p.estate.legacy = { bequests: [{ id: "a", to: "Cy", kind: "person", amount: 20000 }] };
  const d = compute(p, { today: "2026-11-11" });
  assert.equal(d.meets, false);
  assert.ok(d.levers.some((l) => l.id === "returns" && l.info), "Goal seek still works it out");
  const listed = listedLevers(d.levers);
  assert.ok(listed.length <= 5); assert.ok(!listed.some((l) => l.id === "returns" || l.info));
  assert.ok(listed.some((l) => l.id === "claim"), listed.map((l) => l.id).join());
  // the page
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const t = await pageText(new URL("./view.js", import.meta.url), p, "2026-11-11", { computeRemote: { "estate/legacy": compute } });
  assert.doesNotMatch(t, /The return it needs/); assert.match(t, /When to claim Social Security/);
});

// simple first (owner, 2026-11-12 and 2026-11-13; fix round 2): the first three changes in Goal seek's order, the rest one quiet tap
// away; the add form shows three boxes and folds the optional note, open and saying so when the one being changed has a note
test("simple first (fix round 2): three changes first, the rest folded; the add form's note one tap away, never hiding a note", async () => {
  const { listedLevers } = await import("./compute.js");
  const { firstLevers } = await import("../../scenarios/goal-seek/compute.js");
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const p = withLegacy({ bequests: [{ id: "a", to: "Cy", kind: "person", amount: 2000000, notes: "for a first home" }] });
  const d = compute(p, { today: TODAY });
  assert.equal(d.meets, false);
  // the list is Goal seek's first-view order (firstLevers), at most five, never the return it needs or a "just right"
  const listed = listedLevers(d.levers);
  const { shown, more } = firstLevers(d.levers.filter((l) => !l.info && l.status !== "same"));
  assert.deepEqual(listed.map((l) => l.id), [...shown, ...more].slice(0, 5).map((l) => l.id));
  const r = await renderPage(new URL("./view.js?simple-first", import.meta.url), p, TODAY, { computeRemote: { "estate/legacy": compute } });
  const leave = r.root.querySelectorAll("section").find((x) => /Does the plan leave it\?/.test(x.textContent));
  // gap next-60 #15 drew the fold through core/ui/more.js: the part "changes" ("N more changes"), never a <details> by hand
  const rest = leave.querySelectorAll("details").find((x) => x.dataset?.part === "changes");
  const inRest = rest ? rest.querySelectorAll("li") : [];
  const first = leave.querySelectorAll("li").filter((x) => !inRest.includes(x));
  assert.equal(first.length, Math.min(3, listed.length));
  assert.equal(inRest.length, listed.length - first.length);
  if (rest) { assert.ok(!rest.hasAttribute("open")); assert.match(rest.querySelector("summary").textContent, new RegExp(`^${inRest.length} more change`)); }
  // the bequest listed: the form is folded behind "+ Add someone"; opened, three boxes and the note under the kit's own
  // "More details (optional)", shut (gap next-60 #15: was a fold by hand, "Add a note")
  const addBtn = r.root.querySelectorAll("button").find((b) => b.textContent === "+ Add someone");
  addBtn.click();
  const form = r.root.querySelectorAll("form")[0];
  const note = form.querySelectorAll("details").find((x) => x.classList.contains("form-more"));
  assert.ok(note && !note.hasAttribute("open")); assert.equal(note.querySelector("summary").textContent, "More details (optional)›");
  assert.ok(note.querySelector('[name="notes"]'), "the note's box is inside the fold");
  const outside = ["to", "kind", "amount"].map((k) => form.querySelector(`[name="${k}"]`));
  assert.ok(outside.every((x) => x && !note.all().includes(x)));
  // changing Cy, who has a note: the line is open (nothing of the person's is hidden)
  r.root.querySelectorAll("li").find((x) => x.getAttribute("role") === "button").click();
  const note2 = r.root.querySelectorAll("form")[0].querySelectorAll("details").find((x) => x.classList.contains("form-more"));
  assert.ok(note2.hasAttribute("open"));
  assert.equal(note2.querySelector('[name="notes"]').value, "for a first home");
  // saving reads the note from inside the fold; opening anything saved nothing
  assert.deepEqual(r.saved, []);
  r.root.querySelectorAll("form")[0].dispatch("submit");
  assert.equal(r.saved.length, 1); assert.equal(r.saved[0].estate.legacy.bequests[0].notes, "for a first home");
});

test("final fix (rule 7): a 401(k) with nothing going in stays among the first three changes when saving alone cannot get there", async () => {
  const { listedLevers } = await import("./compute.js");
  const { ARCHETYPES, COMMON_PACKS } = await import("../../../qa/households/lib/catalog.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  // the qa couple spending more than comes in: Priya's 401(k) holds $92,000 and nothing goes in
  const p = ARCHETYPES.find((a) => a.id === "02-couple-no-kids").build();
  COMMON_PACKS.expenses.find((v) => v.slug === "spending-above-income").apply(p);
  const plan = migrate(p);
  plan.estate = { ...(plan.estate ?? {}), legacy: { bequests: [{ id: "a", to: "Cy", kind: "person", amount: 50000 }] } };
  const d = compute(plan, { today: TODAY });
  assert.equal(d.meets, false);
  const first = listedLevers(d.levers).slice(0, 3);
  const saving = first.find((l) => l.id === "saving");
  assert.ok(saving, first.map((l) => l.id).join(", "));
  assert.equal(saving.status, "cannot"); assert.match(saving.sentence, /Priya's 401\(k\) holds \$92,000, but nothing goes into it now/);
});

// ---------------------------------------------------------------- who gets what, as one picture (gap list, next 60, item 15)
const W = await import("./compute.js");
const { whoGetsWhat, gapWords, ledeWords, detailWords, unnamedWords, keptWords, debtWords, ruleWords, goalsWords, formShares, MAX_ROWS, UNNAMED, NO_NAMES, NOT_ADVICE } = W;
const phone = await import("../../../qa/fixtures/phone-households.mjs");
const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
const WT = "2026-11-16";
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg ?? ""} ${a} vs ${b}`);
const rowOf = (d, name) => d.rows.find((r) => r.name === name) ?? null;
/** The family (Ana, Bo and Cy, all invented): joint checking $4,200, savings $11,500, brokerage $18,000 and house $380,000;
 * Ana's 401(k) $86,000; Bo's Roth IRA $31,000 and old 401(k) $42,000; a mortgage, a card and a car loan, $285,600 in all. */
const fam = (edit) => { const p = familyPlan(WT); edit?.(p); return p; };
const form = (id, primary, contingent = []) => ({ key: `account:${id}`, accountId: id, primary, contingent, reviewedAt: "" });
/** The wishes on Choices to take to a lawyer; `childrenAge` the age each child gets their share (Cy, six, by the will needs one). */
const wishes = (rest, childrenAge = null, specific = []) => ({ executor: "", executorBackup: "", guardianBackup: "", poaMoney: "", poaHealth: "", notes: "", childrenAge, specific, rest, updatedAt: WT });
const signedWill = (personId) => ({ id: `will-${personId}`, kind: "will", personId, status: "done", done: true, updatedAt: "2026-01-10", where: "", notes: "" });
/** Every rows' amounts and "No one named" add up to the total, and the shares to 1. */
function addsUp(d, label = "") {
  const sum = d.rows.reduce((s, r) => s + r.amount, 0) + (d.unnamed?.amount ?? 0);
  near(sum, d.total, `${label}: the parts add up to the total`);
  if (d.total > 0) near(d.rows.reduce((s, r) => s + r.share, 0) + (d.unnamed?.share ?? 0), 1, `${label}: the shares add up to 100%`);
  for (const r of d.rows) { assert.ok(r.amount > 0, `${label}: ${r.name} gets something`); near(r.amount, r.joint + r.named + r.will, `${label}: ${r.name}'s ways`); }
}

test("who gets what: the shares add up to the total, in every case, for every invented household and the estate variants", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const plans = [...ARCHETYPES.map((a) => a.build()), ...Object.values(phone).filter((f) => typeof f === "function").map((f) => f()), retiredCouplePlan(), emptyPlan(),
    fam((p) => { p.estate.beneficiaries = [form("a-401", [{ name: "Bo", personId: "p-bo", share: 0.6 }, { name: "Cy", personId: "p-cy", share: 0.3 }]), form("a-roth", [{ name: "Dee", personId: "", share: null }, { name: "Eli", personId: "", share: null }])]; p.estate.worksheet = wishes([{ name: "Cy", share: 0.7 }, { name: "A food bank", share: 0.3 }]); })];
  let cases = 0;
  for (const plan of plans) {
    const first = whoGetsWhat(plan, { today: WT });
    for (const dies of first.cases.length ? first.cases.map((c) => c.id) : [""]) { addsUp(whoGetsWhat(plan, { today: WT, dies }), `${plan.meta?.name} ${dies}`); cases++; }
  }
  assert.ok(cases > 40, `${cases} cases`);
  // a form whose shares add up to 90%: the last 10% goes by the will, still inside the total
  const d = whoGetsWhat(fam((p) => { p.estate.beneficiaries = [form("a-401", [{ name: "Bo", personId: "p-bo", share: 0.6 }, { name: "Cy", personId: "p-cy", share: 0.3 }])]; }), { today: WT, dies: "both" });
  addsUp(d, "90%");
  near(rowOf(d, "Cy").named, 86000 * 0.9, "Bo died too: his 60% goes to the other first choice, Cy, who takes the 90% the form gives");
  near(d.unnamed.things.find((x) => x.name === "Ana's 401(k)").value, 8600, "the 10% the form leaves goes by the will");
});

test("who gets what: shares on a form (blank is equal, a sum under 100% leaves the rest, over 100% is scaled)", () => {
  assert.deepEqual(formShares([{ name: "Dee", share: null }, { name: "Eli", share: null }]).list.map((b) => b.s), [0.5, 0.5]);
  near(formShares([{ name: "Dee", share: 0.6 }, { name: "Eli", share: 0.3 }]).sum, 0.9);
  const over = formShares([{ name: "Dee", share: 0.8 }, { name: "Eli", share: 0.4 }]);
  near(over.sum, 1); near(over.list[0].s, 0.8 / 1.2);
  assert.deepEqual(formShares([{ name: " ", share: 1 }]), { list: [], sum: 0 }, "a blank name names no one");
});

test("who gets what: a beneficiary form beats the will's wishes", () => {
  // Ana's 401(k) names Dee (outside the household); the wishes give everything to Cy
  const p = fam((q) => { q.estate.beneficiaries = [form("a-401", [{ name: "Dee", personId: "", share: 1 }])]; q.estate.worksheet = wishes([{ name: "Cy", share: 1 }]); });
  const ana = whoGetsWhat(p, { today: WT });
  assert.equal(ana.dies, "p-ana", "a couple: the first adult's case first");
  near(rowOf(ana, "Dee").named, 86000); assert.equal(rowOf(ana, "Cy"), null, "nothing of Ana's goes by the will: the 401(k) by its form, the rest to Bo");
  const both = whoGetsWhat(p, { today: WT, dies: "both" });
  near(rowOf(both, "Dee").amount, 86000, "the form, whatever the will says");
  near(rowOf(both, "Cy").will, 572700 - 86000, "the wishes cover the rest");
  assert.equal(both.unnamed, null);
  assert.equal(detailWords(rowOf(both, "Cy")), "by your wishes for the will");
  assert.equal(detailWords(rowOf(both, "Dee")), "named on the forms");
});

test("who gets what: a joint account goes to the other owner, whatever its form says; with both gone, the form decides", () => {
  // the joint checking's payable-on-death form names Cy
  const p = fam((q) => { q.estate.beneficiaries = [form("a-chk", [{ name: "Cy", personId: "p-cy", share: 1 }])]; });
  const ana = whoGetsWhat(p, { today: WT, dies: "p-ana" });
  near(rowOf(ana, "Bo").joint, 4200 + 11500 + 18000 + 380000, "checking, savings, brokerage and the house");
  assert.equal(rowOf(ana, "Cy"), null);
  assert.equal(detailWords(rowOf(ana, "Bo")), "as the other owner");
  assert.deepEqual(ana.kept, { names: ["Bo"], amount: 31000 + 42000 }, "Bo's own accounts stay his");
  assert.equal(keptWords(ana), "What Bo owns alone ($73,000) stays with Bo.", "it read \"What is Bo's alone ...\" (critic P3)");
  const bo = whoGetsWhat(p, { today: WT, dies: "p-bo" });
  near(rowOf(bo, "Ana").joint, 413700); near(bo.total, 413700 + 73000);
  const both = whoGetsWhat(p, { today: WT, dies: "both" });
  near(rowOf(both, "Cy").named, 4200, "with both owners gone, the checking's form decides");
  assert.equal(both.kept, null); assert.equal(keptWords(both), "");
  // an older plan whose owner is a name, not an id: Ruth's IRA is Ruth's
  const rc = whoGetsWhat(retiredCouplePlan(), { today: WT });
  assert.ok(rc.unnamed.things.some((x) => x.name === "Ruth's IRA") || rc.kept?.amount > 0);
});

test("who gets what: an account with no beneficiary goes by the wishes, or to no one named, and the gap names it", () => {
  // Jamie (one adult): the 401(k) names a brother, the savings and checking name no one
  const named = (q) => { q.estate.beneficiaries = [form("setup-workplan-setup-self", [{ name: "Sam (brother)", personId: "", share: 1 }])]; };
  const bare = phone.jamie(); named(bare);
  const a = whoGetsWhat(bare, { today: WT });
  assert.equal(a.couple, false); assert.deepEqual(a.cases, []);
  near(rowOf(a, "Sam (brother)").named, 30000); near(a.unnamed.amount, 21000);
  assert.deepEqual(a.unnamed.things.map((x) => x.name), ["Savings", "Checking"]);
  assert.equal(unnamedWords(a.unnamed), "by the will or the state's rules: Savings and Checking", "what no one named means, under its bar");
  assert.equal(a.gap.id, "nowill", "with no will at all, the will's whole part is the biggest gap");
  // with wishes and a signed will, the savings goes by the wishes, and the gap is the form that names no one
  const willed = phone.jamie(); named(willed); willed.estate.worksheet = wishes([{ name: "Pat (sister)", share: 1 }]); willed.estate.documents = [signedWill("setup-self")];
  const b = whoGetsWhat(willed, { today: WT });
  assert.equal(b.unnamed, null); near(rowOf(b, "Pat (sister)").will, 21000);
  assert.deepEqual(b.gap, { id: "unnamed", amount: 18000, thing: "Savings" });
  assert.equal(gapWords(b.gap), "Savings ($18,000) names no one, so it would go through the will or the courts: name someone on its form.");
  addsUp(a); addsUp(b);
});

test("who gets what: a plan with no estate data says what to add first", () => {
  const d = whoGetsWhat(phone.robin(), { today: WT });
  assert.equal(d.any, false); assert.equal(d.status, "no names on accounts", "says what is not set (it read \"not set yet\", critic P2; then \"nobody named yet\", z2 critic P2)");
  assert.equal(d.gap.id, "nothing");
  assert.equal(gapWords(d.gap), "No account or policy names anyone yet: Beneficiary audit shows who is named on each.");
  assert.equal(W.GAP_LINKS.nothing, "#/estate/beneficiaries");
  assert.deepEqual(d.rows, []); near(d.unnamed.amount, 185000 + 5000 + 15000 + 280000); near(d.unnamed.share, 1);
  assert.equal(ledeWords(d), "If you died today, $485,000 would go to:");
  // the empty plan: nothing to picture, so the page draws no row for it
  const e = whoGetsWhat(emptyPlan(), { today: WT });
  assert.equal(e.ready, false); assert.equal(e.total, 0);
  assert.equal(ledeWords(e), "Nothing in your plan would pass on in this case.");
});

test("who gets what: one written sentence per gap", () => {
  // gone: Bo's Roth names someone who was in the plan and is no longer
  const gone = whoGetsWhat(fam((q) => { q.estate.beneficiaries = [form("a-roth", [{ name: "Dee", personId: "p-dee", share: 1 }]), form("a-bk401", [{ name: "Ana", personId: "p-ana", share: 1 }])]; q.estate.worksheet = wishes([{ name: "Cy", share: 1 }]); q.estate.documents = [signedWill("p-ana"), signedWill("p-bo")]; }), { today: WT, dies: "p-bo" });
  assert.deepEqual(gone.gap, { id: "gone", amount: 31000, thing: "Bo's Roth IRA", name: "Dee" });
  assert.equal(gapWords(gone.gap), "Bo's Roth IRA names Dee, who is no longer in your plan: check that form on Beneficiary audit.");
  // unnamed: in the earlier test. nobackup: both died and Ana's 401(k) names only Bo
  // (the wishes give Cy, six, the rest: with the age Cy gets it written, the "minorWill" gap is answered and each test keeps to its own)
  const nb = whoGetsWhat(fam((q) => { q.estate.beneficiaries = [form("a-401", [{ name: "Bo", personId: "p-bo", share: 1 }])]; q.estate.worksheet = wishes([{ name: "Cy", share: 1 }], 25); q.estate.documents = [signedWill("p-ana"), signedWill("p-bo")]; }), { today: WT, dies: "both" });
  assert.deepEqual(nb.gap, { id: "nobackup", amount: 86000, thing: "Ana's 401(k)", names: ["Bo"] });
  assert.equal(gapWords(nb.gap), "Ana's 401(k) names only Bo, so if Bo died too it would go through the will or the courts: name a backup on its form.");
  assert.equal(gapWords({ id: "nobackup", thing: "The IRA", names: ["Ana", "Bo"] }), "The IRA names only Ana and Bo, so if they died too it would go through the will or the courts: name a backup on its form.");
  near(rowOf(nb, "Cy").will, 572700, "with no backup it goes by the will, here to Cy");
  // minor: Cy is six, named directly on Bo's Roth
  const mi = whoGetsWhat(fam((q) => { q.estate.beneficiaries = [form("a-roth", [{ name: "Cy", personId: "p-cy", share: 1 }]), form("a-bk401", [{ name: "Ana", personId: "p-ana", share: 1 }])]; }), { today: WT, dies: "p-bo" });
  assert.deepEqual(mi.gap, { id: "minor", amount: 31000, thing: "Bo's Roth IRA", name: "Cy" });
  assert.equal(gapWords(mi.gap), "Cy is under 18 and can't receive Bo's Roth IRA directly: name a custodian or a trust on its form.");
  // nowill: forms written, no wishes, no will; both died
  const nw = whoGetsWhat(fam((q) => { q.estate.beneficiaries = [form("a-401", [{ name: "Cy", personId: "p-cy", share: 1 }])]; }), { today: WT, dies: "both" });
  assert.equal(nw.gap.id, "nowill"); near(nw.gap.amount, 572700 - 86000);
  assert.equal(gapWords(nw.gap), "Without a will, the state's rules decide who gets House, Bo's old 401(k) and 4 more ($486,700): write your wishes on Choices to take to a lawyer.");
  assert.equal(W.GAP_LINKS.nowill, "#/estate/will-worksheet");
  // unsigned: wishes written, Bo's will not signed
  const us = whoGetsWhat(fam((q) => { q.estate.beneficiaries = [form("a-401", [{ name: "Bo", personId: "p-bo", share: 1 }], [{ name: "Cy", personId: "p-cy", share: 1 }])]; q.estate.worksheet = wishes([{ name: "Cy", share: 1 }], 25); q.estate.documents = [signedWill("p-ana")]; }), { today: WT, dies: "both" });
  assert.equal(us.gap.id, "unsigned"); near(us.gap.amount, 572700 - 86000);
  assert.equal(gapWords(us.gap), "Your wishes cover $486,700, but no signed will is on Estate documents: until there is one, the state's rules decide.");
  assert.equal(W.GAP_LINKS.unsigned, "#/estate/documents");
  // okWill: both wills signed, the 401(k) and the house only, the backup a grown-up (Cy, six, as the backup would be the
  // "minor" gap; any account that takes a form and names no one would be the "unnamed" gap)
  const ok = whoGetsWhat(fam((q) => { q.accounts = q.accounts.filter((a) => ["a-401", "a-home", "a-mort"].includes(a.id)); q.estate.beneficiaries = [form("a-401", [{ name: "Bo", personId: "p-bo", share: 1 }], [{ name: "Dee (sister)", personId: "", share: 1 }])]; q.estate.worksheet = wishes([{ name: "Cy", share: 1 }], 25); q.estate.documents = [signedWill("p-ana"), signedWill("p-bo")]; }), { today: WT, dies: "both" });
  assert.equal(ok.gap.id, "okWill");
  assert.equal(gapWords(ok.gap), "Every account here names someone, and the rest goes by a signed will.");
  // ok: everything passes by a form or to the other owner (Ana died: her 401(k) names Bo)
  const all = whoGetsWhat(fam((q) => { q.estate.beneficiaries = [form("a-401", [{ name: "Bo", personId: "p-bo", share: 1 }])]; }), { today: WT, dies: "p-ana" });
  assert.equal(all.gap.id, "ok"); assert.equal(all.unnamed, null);
  assert.equal(gapWords(all.gap), "Everything here passes by its form or to the other owner.");
  assert.equal(detailWords(rowOf(all, "Bo")), "$413,700 as the other owner, $86,000 named on the forms");
  assert.equal(all.status, "1 name");
  // ties go in the fixed order; the most money wins
  assert.deepEqual(W.GAP_ORDER, ["gone", "unnamed", "estate", "nobackup", "minor", "minorWill", "nowill", "unsigned"]);
});

test("Does the plan leave it?: the room to spend reads as one sentence (it read \"you could spend If markets do ...\")", async () => {
  const { roomWords } = await import("./compute.js");
  assert.equal(roomWords("If markets do as well as average, up to about $8,080 a month on top of health insurance, $1,080 more than the $7,000 the plan spends before health insurance."),
    "While still leaving it, if markets do as well as average, you could spend up to about $8,080 a month on top of health insurance, $1,080 more than the $7,000 the plan spends before health insurance.");
  assert.equal(roomWords("Up to about $5,000 a month."), "While still leaving it, you could spend up to about $5,000 a month.");
  // the family leaving Cy $200,000: the page says it that way
  const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const r = await draw(withLegacy({ bequests: [{ id: "a", to: "Cy", kind: "person", amount: 200000 }] }));
  assert.match(textOf(r.root), /While still leaving it, if markets do as well as average, you could spend up to about \$[\d,]+ a month/);
  assert.doesNotMatch(textOf(r.root), /could spend If/);
});

test("who gets what: the other sentences, one per case", () => {
  const ana = whoGetsWhat(fam(), { today: WT });
  assert.equal(ledeWords(ana), "If Ana died today, $499,700 would go to:");
  assert.equal(ledeWords(whoGetsWhat(fam(), { today: WT, dies: "both" })), "If you both died today, $572,700 would go to:");
  assert.equal(ledeWords(whoGetsWhat(phone.jamie(), { today: WT })), "If you died today, $51,000 would go to:");
  // nothing passes: Bo owns nothing alone and nothing is held together
  const solo = fam((q) => { q.accounts = q.accounts.filter((a) => a.ownerId === "p-ana"); });
  assert.equal(ledeWords(whoGetsWhat(solo, { today: WT, dies: "p-bo" })), "Nothing in your plan would pass on in this case.");
  assert.deepEqual(ana.cases.map((c) => c.label), ["If Ana died", "If Bo died", "If both died"]);
  assert.equal(ruleWords(ana), "What you own together goes to the other owner; whoever is named on an account's form comes next, whatever the will says; the will's wishes cover the rest.");
  assert.equal(ruleWords(whoGetsWhat(phone.jamie(), { today: WT })), "Whoever is named on an account's form gets it, whatever the will says; the will's wishes cover the rest.");
  assert.equal(NOT_ADVICE, "Information, not legal advice: the forms, how each thing is titled and your state's rules decide.");
  assert.equal(debtWords(ana), "What you owe ($285,600) is not taken off: a loan on a home goes with the home, and other debts are usually paid before anyone gets the rest.");
  assert.equal(debtWords(whoGetsWhat(phone.robin(), { today: WT })), "", "no debts: no line");
  assert.equal(UNNAMED, "Nobody named yet", "a short title: \"No one named: goes by the will or the state's rules\" took three lines at 320 px (critic P3)");
  // more than MAX_ROWS people: the smallest fold into one "N others" row
  const many = fam((q) => { q.estate.beneficiaries = [form("a-401", ["Dee", "Eli", "Flo", "Gus", "Hal", "Ivy", "Jo", "Kit"].map((name, i) => ({ name, personId: "", share: (8 - i) / 36 })))]; });
  const m = whoGetsWhat(many, { today: WT });
  assert.equal(m.rows.length, MAX_ROWS);
  const others = m.rows.at(-1);
  assert.equal(others.name, "4 others"); assert.deepEqual(others.others, ["Hal", "Ivy", "Jo", "Kit"]);
  assert.equal(detailWords(others), "Hal, Ivy and 2 more");
  assert.equal(m.status, "9 names", "Bo and the eight on the form");
  addsUp(m, "many");
});

test("who gets what: life policies and the savings inside them; the plan is never changed", () => {
  const p = fam((q) => {
    q.insurance.policies = [{ id: "pol-ana", name: "Ana's term policy", kind: "term", personId: "p-ana", benefit: 500000, premium: 30, period: "monthly" },
      { id: "pol-bo", name: "Bo's whole life", kind: "whole", personId: "p-bo", benefit: 100000, premium: 90, period: "monthly" }];
    q.accounts.push({ id: "a-cv", name: "Bo's policy savings", type: "cash_value_life", balance: 12000, ownerId: "p-bo", asOf: WT, history: [] });
    q.estate.beneficiaries = [{ key: "policy:pol-ana", policyId: "pol-ana", primary: [{ name: "Bo", personId: "p-bo", share: 1 }], contingent: [] }];
  });
  const before = structuredClone(p);
  const ana = whoGetsWhat(p, { today: WT });
  near(rowOf(ana, "Bo").named, 500000, "Ana's policy pays Bo"); near(ana.total, 499700 + 500000, "Bo's policy and its savings are not in Ana's case");
  const bo = whoGetsWhat(p, { today: WT, dies: "p-bo" });
  assert.ok(bo.unnamed.things.some((x) => x.name === "Bo's whole life" && x.value === 100000));
  assert.ok(!bo.unnamed.things.some((x) => x.name === "Bo's policy savings"), "the savings are part of the death benefit, not counted twice");
  for (const dies of ["p-ana", "p-bo", "both"]) addsUp(whoGetsWhat(p, { today: WT, dies }), dies);
  assert.deepEqual(p, before, "reading it changes nothing");
});

// ---------------------------------------------------------------- the critics' round (2026-11-16): each test fails on the code before it
test("who gets what (critic F1): the estate named on a form is no one: it goes by the will, and the gap says so, as Beneficiary audit does", async () => {
  const { compute: audit } = await import("../beneficiaries/compute.js");
  // Jamie (one adult): the 401(k)'s form names "My estate" (Beneficiary audit's quick pick); checking and savings name no one
  const p = phone.jamie(); p.estate.beneficiaries = [form("setup-workplan-setup-self", [{ name: "My estate", personId: "", share: 1 }])];
  assert.ok(audit(p, { today: WT }).items.find((x) => x.key === "account:setup-workplan-setup-self").flags.some((f) => /the estate is named/.test(f)), "Beneficiary audit flags it");
  const d = whoGetsWhat(p, { today: WT });
  assert.deepEqual(d.rows, [], "it was drawn as a person, \"My estate\", who receives $30,000");
  near(d.unnamed.amount, 51000); assert.deepEqual(d.unnamed.things[0], { name: "Jamie's plan at work", value: 30000 }, "with the rest, by the will or the state's rules");
  assert.equal(d.gap.id, "nowill", "the will's whole part ($51,000), the 401(k) in it, is the most money");
  assert.equal(d.status, NO_NAMES, "the estate is no name");
  addsUp(d, "estate");
  // the critic's plan: one IRA ($1,000) whose form names "My estate"; it read "My estate $1,000", the gap "ok", "1 name"
  const one = { household: { filingStatus: "single", people: [{ id: "a", name: "Ana", role: "self" }] }, accounts: [{ id: "x", type: "ira", name: "Ana's IRA", balance: 1000 }], estate: { beneficiaries: [{ key: "account:x", primary: [{ name: "My estate" }] }] } };
  const o = whoGetsWhat(one, { today: WT });
  assert.deepEqual(o.rows, []); near(o.unnamed.amount, 1000); assert.equal(o.status, NO_NAMES);
  assert.deepEqual(o.gap, { id: "estate", amount: 1000, thing: "Ana's IRA" }, "was \"ok\"");
  assert.equal(gapWords(o.gap), "Ana's IRA ($1,000) names your estate, so it would go through the will and the courts (probate): name a person on its form.");
  assert.equal(W.GAP_LINKS.estate, "#/estate/beneficiaries");
  // with wishes written, what the estate gets goes by them: the 401(k) half to the estate, half to a sister, and the checking
  // and savings to the sister on their forms, so the estate's half is the one gap
  const q = phone.jamie(); const pat = [{ name: "Pat (sister)", personId: "", share: 1 }];
  q.estate.beneficiaries = [form("setup-workplan-setup-self", [{ name: "The estate", personId: "", share: 0.5 }, { name: "Pat (sister)", personId: "", share: 0.5 }]), form("setup-have-checking", pat), form("setup-have-savings", pat)];
  q.estate.worksheet = wishes([{ name: "Lee (friend)", share: 1 }]); q.estate.documents = [signedWill("setup-self")];
  const e = whoGetsWhat(q, { today: WT });
  near(rowOf(e, "Pat (sister)").named, 15000 + 21000); near(rowOf(e, "Lee (friend)").will, 15000);
  assert.equal(rowOf(e, "The estate"), null); assert.equal(e.unnamed, null);
  assert.deepEqual(e.gap, { id: "estate", amount: 15000, thing: "Jamie's plan at work" });
  addsUp(e, "estate and wishes");
});

test("who gets what (critic F2): the row's line says no one is named when nobody receives anything (it read \"0 names\")", () => {
  // (a) a form whose one name has 0%: no one gets it by the form, and the gap names the form
  const zero = phone.jamie(); zero.estate.beneficiaries = [form("setup-workplan-setup-self", [{ name: "Pat (sister)", personId: "", share: 0 }])];
  const a = whoGetsWhat(zero, { today: WT });
  assert.deepEqual(a.rows, []); assert.equal(a.status, NO_NAMES);
  assert.deepEqual(a.unnamed.things[0], { name: "Jamie's plan at work", value: 30000 }, "0% gives it to no one");
  // with wishes and a signed will the rest is covered, and the gap is the form that gives nothing
  zero.estate.worksheet = wishes([{ name: "Lee (friend)", share: 1 }]); zero.estate.documents = [signedWill("setup-self")];
  assert.deepEqual(whoGetsWhat(zero, { today: WT }).gap, { id: "unnamed", amount: 30000, thing: "Jamie's plan at work" }, "0% names no one");
  // (b) both died and the wishes name only Bo: nothing is written for this case, so the first thing to add is said
  const dead = fam((q) => { q.estate.worksheet = wishes([{ name: "Bo", share: 1 }]); });
  const b = whoGetsWhat(dead, { today: WT, dies: "both" });
  assert.deepEqual(b.rows, []); assert.equal(b.any, false, "the wishes name only someone who died"); assert.equal(b.status, NO_NAMES);
  assert.equal(b.gap.id, "nothing");
  // the same wishes when only Ana died: Bo takes the rest by them, one name
  const c = whoGetsWhat(dead, { today: WT, dies: "p-ana" });
  assert.equal(c.any, true); assert.equal(c.status, "1 name"); near(rowOf(c, "Bo").will, 86000);
});

test("who gets what (critic F3): a child under 18 who gets money by the will is flagged, until the age is written", () => {
  // both died; the wishes give everything else to Cy, six; no age written on Choices to take to a lawyer
  const p = fam((q) => { q.estate.worksheet = wishes([{ name: "Cy", share: 1 }]); q.estate.documents = [signedWill("p-ana"), signedWill("p-bo")]; });
  const d = whoGetsWhat(p, { today: WT, dies: "both" });
  near(rowOf(d, "Cy").will, 572700);
  assert.deepEqual(d.gap, { id: "minorWill", amount: 572700, name: "Cy" }, "was \"okWill\": nothing said a six-year-old would get it");
  assert.equal(gapWords(d.gap), "Cy is under 18 and can't receive $572,700 by the will directly: write the age Cy gets it on Choices to take to a lawyer, and ask the lawyer about a trust.");
  assert.equal(W.GAP_LINKS.minorWill, "#/estate/will-worksheet");
  // with the age written (Choices to take to a lawyer's "Age each child gets their share"), the will says when
  const aged = fam((q) => { q.estate.worksheet = wishes([{ name: "Cy", share: 1 }], 25); q.estate.documents = [signedWill("p-ana"), signedWill("p-bo")]; });
  assert.equal(whoGetsWhat(aged, { today: WT, dies: "both" }).gap.id, "unnamed", "the next gap: an account whose form names no one");
  assert.ok(!whoGetsWhat(aged, { today: WT, dies: "both" }).gap.id.startsWith("minor"));
  // the critic's couple: Kid (16) gets $100,000 as the backup on a form and $360,000 by the will: the larger, by the will, is said
  const kid = fam((q) => { q.estate.beneficiaries = [form("a-401", [{ name: "Bo", personId: "p-bo", share: 1 }], [{ name: "Cy", personId: "p-cy", share: 1 }])]; q.estate.worksheet = wishes([{ name: "Cy", share: 1 }]); q.estate.documents = [signedWill("p-ana"), signedWill("p-bo")]; });
  const k = whoGetsWhat(kid, { today: WT, dies: "both" });
  assert.equal(k.gap.id, "minorWill"); near(k.gap.amount, 572700 - 86000);
});

test("who gets what (critic F4): an empty entry in the plan's lists is skipped, never read (it threw inside Beneficiary audit's compute)", () => {
  const p = fam((q) => { q.household.people.push(null); q.accounts.push(null); q.insurance.policies = [null]; q.estate.beneficiaries = [null, form("a-401", [{ name: "Bo", personId: "p-bo", share: 1 }])]; q.estate.documents = [null]; });
  const before = structuredClone(p);
  for (const dies of ["p-ana", "p-bo", "both"]) addsUp(whoGetsWhat(p, { today: WT, dies }), `nulls ${dies}`);
  near(rowOf(whoGetsWhat(p, { today: WT }), "Bo").named, 86000);
  assert.deepEqual(p, before, "and nothing in the plan is changed");
});

test("who gets what (critic P1): who is on this page's own list and gets nothing in the picture is said, with where to write it", () => {
  // Robin (one adult) wants to leave Cy $50,000 and a food bank $20,000; nothing names either
  const p = phone.robin(); p.estate.legacy = { bequests: [{ id: "a", to: "Cy", kind: "person", amount: 50000 }, { id: "b", to: "a food bank", kind: "charity", amount: 20000 }] };
  const d = whoGetsWhat(p, { today: WT });
  assert.deepEqual(d.goals, [{ name: "Cy", amount: 50000 }, { name: "a food bank", amount: 20000 }]);
  assert.equal(goalsWords(d), "Cy and a food bank ($70,000), on your list above, get nothing here: the list is a goal for the plan, not a will, so write them as special gifts on Choices to take to a lawyer.");
  // a special gift written for Cy: only the food bank is said; once the wishes give it the rest, nothing is said
  p.estate.worksheet = wishes([], null, [{ what: "$50,000", to: "Cy" }]);
  const g = whoGetsWhat(p, { today: WT });
  assert.equal(goalsWords(g), "A food bank ($20,000), on your list above, gets nothing here: the list is a goal for the plan, not a will, so write it as a special gift on Choices to take to a lawyer.");
  p.estate.worksheet = wishes([{ name: "A food bank", share: 1 }], null, [{ what: "$50,000", to: "Cy" }]);
  assert.deepEqual(whoGetsWhat(p, { today: WT }).goals, []); assert.equal(goalsWords(whoGetsWhat(p, { today: WT })), "");
  // a couple's list is for when both are gone: said in "If both died" only, never for someone who died
  const c = fam((q) => { q.estate.legacy = { bequests: [{ id: "a", to: "Dee", kind: "person", amount: 40000 }, { id: "b", to: "Bo", kind: "person", amount: 10000 }] }; });
  assert.deepEqual(whoGetsWhat(c, { today: WT }).goals, []);
  assert.deepEqual(whoGetsWhat(c, { today: WT, dies: "both" }).goals, [{ name: "Dee", amount: 40000 }]);
});

// ---------------------------------------------------------------- the page: one quiet row, nothing saved
const VIEW = new URL("./view.js", import.meta.url).href;
const draw = async (plan, query = {}) => (await import("../../../qa/fixtures/fake-dom.mjs")).renderPage(VIEW, plan, WT, { computeRemote: { "estate/legacy": compute }, route: { rest: [], query } });
const partOf = (root, id) => root.all().find((e) => e.tagName === "DETAILS" && e.dataset?.part === id) ?? null;
const states = (root) => Object.fromEntries(root.all().filter((e) => e.tagName === "DETAILS").map((e) => [e.dataset?.part ?? (e.classList.contains("form-more") ? "form" : "by hand"), e.hasAttribute("open")]));

test("the page: \"Who gets what\" is one shut row just above More on this; its line says how many names, or no names on accounts", async () => {
  const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const r = await draw(fam((q) => { q.estate.beneficiaries = [form("a-401", [{ name: "Bo", personId: "p-bo", share: 1 }])]; }));
  const who = partOf(r.root, "who");
  assert.ok(who && !who.hasAttribute("open"));
  assert.equal(textOf(who.querySelector("summary")).replace(/\s+/g, " ").trim(), "Who gets what 1 name ›");
  const sections = r.root.all().filter((e) => e.tagName === "SECTION");
  const at = sections.findIndex((s) => s.all().includes(who));
  assert.match(textOf(sections[at + 1]), /^\s*More on this/, "the parts card sits just above More on this");
  // inside: the lede, the bars, the gap, the order and the caveat said once
  const body = textOf(who);
  assert.match(body, /If Ana died today, \$499,700 would go to:/);
  assert.match(body, /Everything here passes by its form or to the other owner\./);
  assert.equal(body.split("not legal advice").length, 2, "said once");
  assert.equal(textOf(r.root).split("not legal advice").length, 2, "said once on the page");
  assert.equal(who.querySelectorAll("li").length, 1, "one bar: Bo");
  // nothing set: "no names on accounts", and the first thing to add
  const bare = await draw(fam());
  assert.equal(textOf(partOf(bare.root, "who").querySelector("summary")).replace(/\s+/g, " ").trim(), "Who gets what no names on accounts ›");
  assert.match(textOf(partOf(bare.root, "who")), /Nobody named yet\s*\$86,000\s*17% · by the will or the state's rules: Ana's 401\(k\)/);
  assert.ok(partOf(bare.root, "who").all().some((e) => e.tagName === "A" && e.getAttribute("href") === "#/estate/beneficiaries"));
  // the hero's line, one per case: with the row to point to, and without (the empty plan: no row at all)
  assert.match(textOf(bare.root), /A planning goal, not a will: Who gets what, below, shows what passes today\./);
  const empty = await draw(emptyPlan());
  assert.equal(partOf(empty.root, "who"), null);
  assert.match(textOf(empty.root), /This is a planning goal, not a will: the will \(or the beneficiary forms\) is what actually passes it on\./);
});

test("the page: a chip pictures another case in place and saves nothing; the choice survives a redraw", async () => {
  const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const r = await draw(fam());
  const who = partOf(r.root, "who");
  const chips = who.all().filter((e) => e.tagName === "BUTTON" && e.classList.contains("chip"));
  assert.deepEqual(chips.map((c) => textOf(c)), ["If Ana died", "If Bo died", "If both died"]);
  assert.deepEqual(chips.map((c) => c.getAttribute("aria-pressed")), ["true", "false", "false"]);
  const line = () => textOf(who.querySelector(".fold-status"));
  assert.equal(line(), NO_NAMES);
  chips[2].click();
  assert.match(textOf(who), /If you both died today, \$572,700 would go to:/);
  assert.equal(r.saved.length, 0, "a chip changes nothing in the plan");
  const again = await draw(fam());
  assert.match(textOf(partOf(again.root, "who")), /If you both died today/, "kept while the app is open");
  // the row's line follows the case drawn: Ana's 401(k) names Bo, backup Dee
  const named = await draw(fam((q) => { q.estate.beneficiaries = [form("a-401", [{ name: "Bo", personId: "p-bo", share: 1 }], [{ name: "Dee", personId: "", share: 1 }])]; }));
  const w2 = partOf(named.root, "who");
  assert.equal(textOf(w2.querySelector(".fold-status")), "1 name", "both gone (kept from before): Dee alone is named");
  w2.all().find((e) => e.tagName === "BUTTON" && textOf(e) === "If Ana died").click();
  assert.equal(textOf(w2.querySelector(".fold-status")), "1 name", "Ana: Bo");
  w2.all().find((e) => e.tagName === "BUTTON" && textOf(e) === "If Bo died").click();
  assert.equal(textOf(w2.querySelector(".fold-status")), NO_NAMES, "Bo: nothing of his names anyone");
  assert.equal(named.saved.length, 0);
  partOf(again.root, "who").all().find((e) => e.tagName === "BUTTON" && textOf(e) === "If Ana died").click();
  assert.equal(again.saved.length, 0);
});

test("the page (critic P4): the case picked survives a reload of the tab (sessionStorage, this tab only), and Back (the app's own memory)", async () => {
  const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const mem = new Map();
  const had = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } } });
  try {
    const r = await draw(fam());
    partOf(r.root, "who").all().find((e) => e.tagName === "BUTTON" && textOf(e) === "If Bo died").click();
    assert.equal(mem.get("planner.legacy.whose"), "p-bo", "an adult's id, never a name or a figure");
    // a reload: the page's module is loaded again (its variable gone); the tab still knows the case
    const fresh = (await import("../../../qa/fixtures/fake-dom.mjs")).renderPage(`${VIEW}?reload`, fam(), WT, { computeRemote: { "estate/legacy": compute }, route: { rest: [], query: {} } });
    const after = partOf((await fresh).root, "who");
    assert.equal(after.all().find((e) => e.tagName === "BUTTON" && e.classList.contains("on")) && textOf(after.all().find((e) => e.tagName === "BUTTON" && e.classList.contains("on"))), "If Bo died");
    assert.match(textOf(after), /If Bo died today, \$486,700 would go to:/);
    assert.equal(r.saved.length, 0, "nothing in the plan");
    // a case this plan does not have (another household's id) draws the first
    mem.set("planner.legacy.whose", "p-nobody");
    const other = await (await import("../../../qa/fixtures/fake-dom.mjs")).renderPage(`${VIEW}?reload-2`, fam(), WT, { computeRemote: { "estate/legacy": compute }, route: { rest: [], query: {} } });
    assert.match(textOf(partOf(other.root, "who")), /If Ana died today/);
    partOf(r.root, "who").all().find((e) => e.tagName === "BUTTON" && textOf(e) === "If Ana died").click();   // as the tests before left it
  } finally {
    if (had) Object.defineProperty(globalThis, "sessionStorage", had); else delete globalThis.sessionStorage;
  }
});

test("the page (critic P1, F4): the list's people the picture leaves out are said in the part; an empty entry in the plan leaves the page drawn", async () => {
  const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const robin = phone.robin(); robin.estate.legacy = { bequests: [{ id: "a", to: "Cy", kind: "person", amount: 50000 }] };
  const r = await draw(robin);
  const who = partOf(r.root, "who");
  assert.match(textOf(who), /Nobody named yet[\s\S]*Cy \(\$50,000\), on your list above, gets nothing here: the list is a goal for the plan, not a will, so write it as a special gift on Choices to take to a lawyer\.\s*No account or policy names anyone yet/, "under the bars, before the gap");
  assert.equal(textOf(r.root).split("on your list above").length, 2, "said once");
  // a null form row and a null policy (they pass the plan's checks): the old code threw drawing the page; the row is drawn
  const p = fam((q) => { q.estate.beneficiaries = [null, form("a-401", [{ name: "Bo", personId: "p-bo", share: 1 }])]; q.insurance.policies = [null]; });
  const n = await draw(p);
  assert.match(textOf(partOf(n.root, "who").querySelector("summary")), /Who gets what\s*1 name/);
  assert.match(textOf(n.root), /More on this/, "the rest of the page as before");
});

test("S11: after a save only the saved part changes: adding someone or checking the home leaves Who gets what and N more changes as they were", async () => {
  const p = withLegacy({ bequests: [{ id: "a", to: "Cy", kind: "person", amount: 2000000 }] });
  p.estate.beneficiaries = [form("a-401", [{ name: "Bo", personId: "p-bo", share: 1 }])];
  const a = await draw(p);
  const before = states(a.root);
  assert.equal(before.who, false); assert.ok(!Object.keys(before).includes("by hand"), "no fold by hand");
  // change Cy's amount (the form's Save): the plan changes, and on the redraw every part is as it was
  a.root.querySelectorAll("li").find((x) => x.getAttribute("role") === "button").click();
  const f = a.root.querySelectorAll("form")[0];
  f.querySelector('[name="amount"]').value = "1500000";
  f.dispatch("submit");
  assert.equal(a.saved.length, 1); assert.equal(a.saved[0].estate.legacy.bequests[0].amount, 1500000);
  const b = await draw(a.saved[0]);
  assert.deepEqual(states(b.root), before, "no part opened or shut");
  assert.match(b.root.textContent, /Changes saved\./, "the green line");
  // the home's tick box saves and confirms under itself; the parts stay as they were
  const tick = b.root.all().find((e) => e.tagName === "INPUT" && e.getAttribute("name") === "includeHome");
  tick.checked = true; tick.dispatch("change");
  assert.equal(b.saved.at(-1).estate.legacy.includeHome, true);
  const c = await draw(b.saved.at(-1));
  assert.deepEqual(states(c.root), before);
});

test("the page follows the helper: no fold by hand, and the structure checks find nothing", async () => {
  const { structure, handWritten } = await import("../../../qa/first-view-lib.mjs");
  const p = withLegacy({ bequests: [{ id: "a", to: "Cy", kind: "person", amount: 2000000, notes: "for a first home" }] });
  p.estate.beneficiaries = [form("a-401", [{ name: "Bo", personId: "p-bo", share: 1 }])];
  for (const plan of [p, fam(), phone.jamie(), retiredCouplePlan()]) {
    const r = await draw(plan);
    assert.deepEqual(handWritten(r.root), []);
    assert.deepEqual(structure(r.root, { key: "estate/legacy" }), []);
  }
});

// ---------------------------------------------------------------- invariance (gap spec 3.5)
// No field is added and compute() is not touched: over every qa/fixtures plan, the 14 households' base plans, the phone-built
// ones, the empty plan and three invented households with estate data, Legacy goals, Beneficiary audit, Choices to take to a
// lawyer, Estate tax and Net worth give the very output the code before this change gave (7d9ca39). Digests in invariance.json;
// to write them again after a deliberate change: PRINT=1 node --test modules/estate/legacy/module.test.mjs
test("invariance: every compute() this touches gives the output of 7d9ca39 over every invented household", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const crypto = await import("node:crypto");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const INV_TODAY = "2026-11-16";
  const PAGES = ["estate/legacy", "estate/beneficiaries", "estate/will-worksheet", "estate/estate-tax", "balance/net-worth"];
  const digest = (x) => crypto.createHash("sha256").update(JSON.stringify(x)).digest("base64url").slice(0, 22);
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const plans = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) plans.push({ name: `fixture ${f}:${name}`, plan: fn() });
  }
  for (const a of ARCHETYPES) plans.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") plans.push({ name: `phone ${name}`, plan: fn() });
  plans.push({ name: "empty plan", plan: emptyPlan() });
  const famForms = () => {
    const p = familyPlan(INV_TODAY);
    p.estate.beneficiaries = [
      { key: "account:a-401", accountId: "a-401", primary: [{ name: "Bo", personId: "p-bo", share: 1 }], contingent: [{ name: "Cy", personId: "p-cy", share: 1 }], reviewedAt: "2023-02-01" },
      { key: "account:a-bk401", accountId: "a-bk401", primary: [{ name: "Dana (mother)", personId: "", share: 1 }], contingent: [], reviewedAt: "2015-06-01" },
      { key: "account:a-roth", accountId: "a-roth", primary: [{ name: "Cy", personId: "p-cy", share: 1 }], contingent: [], reviewedAt: "2024-05-01" },
    ];
    return p;
  };
  plans.push({ name: "family with forms", plan: famForms() });
  plans.push({ name: "family with forms, wishes and wills", plan: (() => { const p = famForms(); p.estate.worksheet = { executor: "Bo", executorBackup: "", guardianBackup: "", poaMoney: "", poaHealth: "", notes: "", childrenAge: 25, specific: [], rest: [{ name: "Cy", share: 1 }], updatedAt: "2026-11-01" }; p.estate.documents = [{ id: "w1", kind: "will", personId: "p-ana", status: "done", done: true, updatedAt: "2026-01-10", where: "", notes: "" }, { id: "w2", kind: "will", personId: "p-bo", status: "started", done: false, updatedAt: "", where: "", notes: "" }]; return p; })() });
  plans.push({ name: "retired couple with wishes", plan: (() => { const p = retiredCouplePlan(); p.estate = { ...(p.estate ?? {}), worksheet: { executor: "", executorBackup: "", guardianBackup: "", poaMoney: "", poaHealth: "", notes: "", childrenAge: null, specific: [], rest: [{ name: "Lee", share: 0.5 }, { name: "A food bank", share: 0.5 }], updatedAt: "2026-11-01" } }; return p; })() });
  const computes = {};
  for (const k of PAGES) computes[k] = (await import(pathToFileURL(path.join(ROOT, "modules", k, "compute.js")).href)).compute;
  // z2 (2026-11-16): Legacy goals adds `unknown` for a plan with nothing saved for retirement (the projection's own gate): compared
  // without it here, and it must be the projection's answer (the z2 invariance test below checks it for every household)
  const { retirementUnknown } = await import("../../retirement/projection/compute.js");
  const sansUnknown = (k, d, plan) => { if (k !== "estate/legacy" || !d || !("unknown" in d)) return d; assert.deepEqual(d.unknown, retirementUnknown(structuredClone(plan), { today: INV_TODAY })); const { unknown: _u, ...rest } = d; return rest; };
  const now = { today: INV_TODAY, compute: {} };
  for (const { name, plan } of plans) {
    now.compute[name] = {};
    for (const k of PAGES) now.compute[name][k] = digest(sansUnknown(k, computes[k](structuredClone(plan), { today: INV_TODAY }), plan));
    // and the picture reads only: the plan it is given is the same after
    const copy = structuredClone(plan);
    for (const dies of ["", "both", ...((plan.household?.people ?? []).map((x) => x.id))]) whoGetsWhat(copy, { today: INV_TODAY, dies });
    assert.deepEqual(copy, plan, `${name}: whoGetsWhat changed the plan`);
  }
  const file = new URL("./invariance.json", import.meta.url);
  if (process.env.PRINT) fs.writeFileSync(file, JSON.stringify(now, null, 1) + "\n");
  const was = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(Object.keys(now.compute).length, 36);
  assert.deepEqual(now, was);
});

// ---------------------------------------------------------------- z2 (b): not known yet, by the projection's gate (2026-11-16)
// Riley (qa/fixtures renter-debt: 24, an empty Work 401(k), nothing going in) with a $100,000 gift read "As it stands the money runs
// out before the end of the plan, before any legacy." while Will the money last? and Goal seek say they can't say yet.
const { verdictWords, UNKNOWN_WHAT } = W;
const giftOf = (p, amount = 100000) => { p.estate = { ...(p.estate ?? {}), legacy: { bequests: [{ id: "g", to: "A food bank", kind: "charity", amount }] } }; return p; };
const riley = async () => giftOf((await import("../../../qa/fixtures/renter-debt-plan.mjs")).renterDebtPlan());
const samPersona = async () => { const P = await import("../../../qa/fixtures/setup-personas.mjs"); return giftOf(P.finishSetup("sam", P.sam(WT), WT)); };

test("z2 (b): the gate is the projection's own: Riley and Sam not known yet, the family and the retired couple as before", async () => {
  const { retirementUnknown } = await import("../../retirement/projection/compute.js");
  const r = compute(await riley(), { today: WT });
  assert.deepEqual(r.unknown, { nothingSaved: true }); assert.deepEqual(r.unknown, retirementUnknown(await riley(), { today: WT }));
  assert.equal(r.ready, true); assert.equal(r.target, 100000);
  const s = compute(await samPersona(), { today: WT });
  assert.deepEqual(s.unknown, { nothingSaved: false }, "Sam told us nothing about savings");
  for (const p of [giftOf(fam()), giftOf(retiredCouplePlan(WT)), fam(), emptyPlan()]) assert.ok(!("unknown" in compute(p, { today: WT })));
  // one dollar in the 401(k) is an answer again: the old verdict
  const one = await riley(); one.accounts.find((a) => a.type === "401k").balance = 1;
  const o = compute(one, { today: WT });
  assert.ok(!("unknown" in o)); assert.equal(o.success, false);
});

test("z2 (b): Does the plan leave it?, one written sentence per case", async () => {
  const m = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  assert.equal(UNKNOWN_WHAT, "whether the plan leaves it");
  assert.deepEqual(verdictWords(compute(await riley(), { today: WT }), m), { text: "Nothing is saved for retirement, so we can't say whether the plan leaves it yet. Once you start saving, add it and we can answer.", tone: "", unknown: true });
  assert.deepEqual(verdictWords(compute(await samPersona(), { today: WT }), m), { text: "You haven't told us about retirement savings, so we can't say whether the plan leaves it yet. Add what you own and we can answer.", tone: "", unknown: true });
  assert.deepEqual(verdictWords({ meets: true, endReal: 871400, endYear: 2085 }, m), { text: "Your plan leaves about $871,000 in 2085: enough.", tone: "ok", unknown: false });
  assert.deepEqual(verdictWords({ meets: false, success: true, endReal: 871400, endYear: 2085, gap: 1128600 }, m), { text: "Your plan leaves about $871,000 in 2085: $1,128,600 short.", tone: "bad", unknown: false });
  assert.deepEqual(verdictWords({ meets: false, success: false }, m), { text: "As it stands the money runs out before the end of the plan, before any legacy.", tone: "bad", unknown: false });
});

test("z2 (b): the page for Riley and Sam says the shared sentence, lists no changes and points to what you own; with $1 saved, as before", async () => {
  const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const L = await import("../../../qa/first-view-lib.mjs");
  const cases = [[await riley(), /Nothing is saved for retirement, so we can't say whether the plan leaves it yet\. Once you start saving, add it and we can answer\./],
    [await samPersona(), /You haven't told us about retirement savings, so we can't say whether the plan leaves it yet\. Add what you own and we can answer\./]];
  for (const [plan, sentence] of cases) {
    const r = await draw(plan);
    const t = textOf(r.root).replace(/\s+/g, " ");
    assert.match(t, sentence);
    assert.doesNotMatch(t, /runs out|money does not last/i, "never that the money runs out");
    assert.equal(r.root.querySelectorAll(".lg-levers").length, 0, "no list of changes");
    assert.equal(partOf(r.root, "changes"), null, "and no fold of more changes");
    const card = r.root.all().find((e) => e.tagName === "SECTION" && /Does the plan leave it\?/.test(textOf(e)));
    const verdict = card.querySelector(".lg-verdict");
    assert.equal(verdict.className, "lg-verdict", "not in amber: it is not bad news, it is not known");
    const links = card.all().filter((e) => e.tagName === "A");
    assert.deepEqual(links.map((a) => [textOf(a).trim(), a.getAttribute("href"), a.className]), [["Add what you own ›", "#/balance/net-worth", "btn secondary"]]);
    assert.equal(r.root.all().filter((e) => L.isFilled(e) && !L.unseen(e)).length, 0, "no filled button");
  }
  const one = await riley(); one.accounts.find((a) => a.type === "401k").balance = 1;
  const t1 = textOf((await draw(one)).root).replace(/\s+/g, " ");
  assert.match(t1, /As it stands the money runs out before the end of the plan, before any legacy\./);
  assert.match(t1, /Goal seek/);
});

// ---------------------------------------------------------------- z2 invariance (2026-11-16)
// "Does the plan leave it?" asks the projection's own gate (retirement/projection retirementUnknown): for a plan with nothing saved
// for retirement and nothing going in, compute adds `unknown`, as the twelve retirement pages do. Over every qa/fixtures/*-plan.mjs
// plan, the 14 households' base plans, the phone-built ones, the round 8 households, the four personas (finished and mid-setup),
// the demo and the empty plan, each with no gift and with a $100,000 gift to a cause, compute without that one field gives byte for
// byte what it gave at e223a42 (z2-invariance.json, written by this test on that code), and the field is there exactly where the
// projection answers it, equal to its answer.
// To write the digests down again (only on the code before a deliberate change): PRINT=1 node --test modules/estate/legacy/module.test.mjs
test("z2 invariance: Legacy goals is e223a42's for every household, with `unknown` only where the projection's gate says so", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const crypto = await import("node:crypto");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const { retirementUnknown } = await import("../../retirement/projection/compute.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const T = "2026-11-16";
  const dig = (x) => crypto.createHash("sha256").update(JSON.stringify(x) ?? "undefined").digest("base64url").slice(0, 22);
  const plans = [];
  const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) plans.push({ name: `fixture ${f}:${name}`, plan: fn(T) });
  }
  const { ARCHETYPES } = await imp("qa/households/lib/catalog.mjs");
  for (const a of ARCHETYPES) plans.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(await imp("qa/fixtures/phone-households.mjs"))) if (typeof fn === "function") plans.push({ name: `phone ${name}`, plan: fn() });
  for (const [name, fn] of Object.entries(await imp("qa/fixtures/round8-households.mjs"))) if (typeof fn === "function" && /Plan$/.test(name)) plans.push({ name: `round8 ${name}`, plan: fn() });
  const P = await imp("qa/fixtures/setup-personas.mjs");
  for (const n of ["sam", "jordan", "patLee", "ruth"]) { plans.push({ name: `persona ${n}`, plan: P.finishSetup(n, P[n](T), T) }); plans.push({ name: `persona ${n} mid`, plan: P[n](T) }); }
  plans.push({ name: "demo", plan: (await imp("qa/fixtures/demo-household.mjs")).demoHousehold(T) });
  plans.push({ name: "empty plan", plan: emptyPlan() });
  const run = (f) => { try { return f(); } catch (e) { return { threw: e.message }; } };
  const gift = (p) => { const q = structuredClone(p); q.estate = { ...(q.estate ?? {}), legacy: { ...(q.estate?.legacy ?? {}), bequests: [{ id: "z2", to: "A food bank", kind: "charity", amount: 100000 }] } }; return q; };
  const now = {}, gated = [];
  for (const { name, plan } of plans) {
    const p = migrate(structuredClone(plan));
    const u = run(() => retirementUnknown(structuredClone(p), { today: T }));
    now[name] = {};
    for (const [k, q] of [["none", p], ["gift", gift(p)]]) {
      const d = run(() => compute(structuredClone(q), { today: T }));
      if (d && "unknown" in d) { assert.ok(u, `${name}: unknown only where the projection says so`); assert.deepEqual(d.unknown, u, `${name}: the projection's own answer`); }
      else if (d?.ready && !process.env.PRINT) assert.equal(u, null, `${name} (${k}): the projection says unknown, the page does not`);
      const { unknown: _u, ...rest } = d ?? {};
      now[name][k] = dig(d && "unknown" in d ? rest : d);
    }
    if (u) gated.push(name);
  }
  const file = new URL("./z2-invariance.json", import.meta.url);
  if (process.env.PRINT) { fs.writeFileSync(file, `${JSON.stringify({ note: "Legacy goals at e223a42 (z2), with no gift and with a $100,000 gift; PRINT=1 writes them again: only on that code", today: T, plans: now }, null, 1)}\n`); return; }
  const was = JSON.parse(fs.readFileSync(file, "utf8")).plans;
  assert.ok(Object.keys(now).length >= 50, `${Object.keys(now).length} households`);
  assert.deepEqual(now, was);
  assert.deepEqual(gated, ["fixture renter-debt-plan.mjs:renterDebtPlan", "fixture renter-debt-plan.mjs:renterPayingExtraPlan", "persona sam", "persona jordan"]);
});

// ---------------------------------------------------------------- z2 fix round (2026-11-17), critic P2
// Riley with a $100,000 gift to "A food bank" and no account form: "To whom" listed "A food bank $100,000" just above "Who gets
// what  nobody named yet", which read as a contradiction. The row's line is about the accounts' forms, and now says so.
test("z2 fix (P2): beside a named gift, the Who gets what row says the accounts name no one, never nobody named", async () => {
  const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  assert.equal(NO_NAMES, "no names on accounts");
  assert.ok(NO_NAMES.length <= 20, "a part's line is at most 20 characters");
  const r = await draw(await riley());
  const t = textOf(r.root).replace(/\s+/g, " ");
  assert.match(t, /A food bank A charity or cause \$100,000/);
  const who = partOf(r.root, "who");
  assert.ok(who, "the row is there: Riley has something to pass on");
  const row = textOf(who.querySelector("summary")).replace(/\s+/g, " ").trim();
  assert.equal(row, "Who gets what no names on accounts ›");
  assert.doesNotMatch(row, /nobody/i);
});
