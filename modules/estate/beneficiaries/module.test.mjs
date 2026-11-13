import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, listOf, NAMED } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const item = (d, key) => d.items.find((x) => x.key === key);
const withRows = (rows, policies = []) => { const p = familyPlan(TODAY); p.estate.beneficiaries = rows; p.insurance = { policies }; return p; };

test("listOf: arrays, older plain names, blanks dropped", () => {
  assert.deepEqual(listOf("Bo"), [{ name: "Bo", share: 1 }]);
  assert.deepEqual(listOf([{ name: " Bo ", share: 0.5, personId: "p-bo" }, { name: "" }]), [{ name: "Bo", share: 0.5, personId: "p-bo" }]);
  assert.deepEqual(listOf(null), []);
});

test("an empty plan: nothing to name", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).count, 0);
});

test("the family with nothing on file: every account that takes a form, and the money with no one named", () => {
  const d = compute(withRows([], [{ id: "t", name: "Term", kind: "term", personId: "p-ana", benefit: 500000 }, { id: "h", name: "Home", kind: "home", benefit: 1 }]), { today: TODAY });
  const accounts = familyPlan(TODAY).accounts.filter((a) => NAMED[a.type]);
  assert.equal(d.count, accounts.length + 1, "home insurance takes no beneficiary");
  assert.equal(d.named, 0); assert.equal(d.missingValue, accounts.reduce((s, a) => s + a.balance, 0) + 500000);
  assert.match(item(d, "account:a-401").flags[0], /retirement account left to an estate/);
});

test("the flags: shares, no backup, a minor named directly, the estate, a spouse left off a 401(k), old and before a birth", () => {
  const d = compute(withRows([
    { key: "account:a-401", primary: [{ name: "Bo", personId: "p-bo", share: 0.6 }], contingent: [{ name: "Cy", personId: "p-cy", share: 1 }], reviewedAt: "2025-01-01" },
    { accountId: "a-bk401", primary: [{ name: "Dana", share: 1 }], contingent: [{ name: "Estate", share: 1 }], reviewedAt: "2015-06-01" },
    { accountId: "a-roth", primary: "Ana", contingent: [], reviewedAt: "2026-01-01" },
  ]), { today: TODAY });
  const a = item(d, "account:a-401");
  assert.ok(a.flags.some((f) => f.includes("add up to 60%"))); assert.ok(a.flags.some((f) => f.startsWith("Cy is under 18")));
  const b = item(d, "account:a-bk401");
  assert.ok(b.flags.some((f) => f.includes("Ana is not the main beneficiary"))); assert.ok(b.flags.some((f) => f.includes("the estate is named")));
  assert.ok(b.flags.some((f) => f === "checked 11 years ago")); assert.ok(b.flags.some((f) => f === "Cy was born after it was last checked"));
  const r = item(d, "account:a-roth");
  assert.deepEqual(r.flags, ["no backup (contingent) beneficiary, if the first one dies first"]);
  assert.equal(d.named, 3);
});

test("a clean row: no flags", () => {
  const d = compute(withRows([{ accountId: "a-401", primary: [{ name: "Bo", personId: "p-bo", share: 1 }], contingent: [{ name: "Cy's trust", share: 1 }], reviewedAt: "2026-01-01" }]), { today: TODAY });
  assert.equal(item(d, "account:a-401").ok, true);
  assert.deepEqual(item(d, "account:a-401").minors, []);
});

test("a child under 18 named on an account: its own line of what to name instead, matched by the person picked, else by the name typed", () => {
  const d = compute(withRows([
    { accountId: "a-401", primary: [{ name: "Cy", personId: "p-cy", share: 1 }], contingent: [{ name: "Bo", personId: "p-bo", share: 1 }], reviewedAt: "2026-01-01" },
    { accountId: "a-roth", primary: [{ name: "cy", share: 1 }], contingent: [{ name: "Cy", personId: "p-cy", share: 1 }], reviewedAt: "2026-01-01" },
    // picked from the household as Bo, then retyped: the person picked wins over the name
    { accountId: "a-bk401", primary: [{ name: "Cy", personId: "p-bo", share: 1 }], contingent: [{ name: "Ana", personId: "p-ana", share: 1 }], reviewedAt: "2026-01-01" },
  ]), { today: TODAY });
  const a = item(d, "account:a-401");
  assert.deepEqual(a.minors, [{ name: "Cy", personId: "p-cy", level: "primary", text: "Cy is under 18 and can't receive this directly: name a custodian under your state's Uniform Transfers to Minors Act (UTMA), or a trust" }]);
  assert.ok(a.flags.includes(a.minors[0].text)); assert.equal(a.ok, false);
  const r = item(d, "account:a-roth");
  assert.deepEqual(r.minors.map((m) => [m.name, m.level]), [["cy", "primary"], ["Cy", "contingent"]], "by name when no person was picked");
  assert.deepEqual(item(d, "account:a-bk401").minors, []);
  // 18 or over: nothing
  const grown = familyPlan(TODAY); grown.household.people.find((x) => x.id === "p-cy").birthDate = "2000-03-03";
  grown.estate.beneficiaries = [{ accountId: "a-401", primary: [{ name: "Cy", personId: "p-cy", share: 1 }], contingent: [{ name: "Bo", personId: "p-bo", share: 1 }], reviewedAt: "2026-01-01" }];
  assert.deepEqual(item(compute(grown, { today: TODAY }), "account:a-401").minors, []);
});

test("the first adult left unnamed (\"Me\") and the setup's \"My spouse\": the flags say you and your spouse", () => {
  const rows = [{ accountId: "a-bk401", primary: [{ name: "Dana", share: 1 }], contingent: [{ name: "Cy", personId: "p-cy", share: 1 }], reviewedAt: "2015-06-01" }];
  const p = withRows(rows); p.household.people.find((x) => x.id === "p-ana").name = "Me";
  const f = item(compute(p, { today: TODAY }), "account:a-bk401").flags;
  assert.ok(f.includes("you are not the main beneficiary: by federal law a married person's 401(k) goes to the spouse unless you signed a waiver"), f.join(" | "));
  const q = withRows(rows); q.household.people.find((x) => x.id === "p-ana").name = "My spouse";
  assert.ok(item(compute(q, { today: TODAY }), "account:a-bk401").flags.some((x) => x.startsWith("your spouse is not the main beneficiary") && x.endsWith("unless your spouse signed a waiver")));
  // someone the first adult, born after the form was checked (a date typed wrong): "you were born", never "Me was born"
  const r = withRows(rows); const me = r.household.people.find((x) => x.id === "p-ana"); me.name = "Me"; me.birthDate = "2016-01-01";
  assert.ok(item(compute(r, { today: TODAY }), "account:a-bk401").flags.includes("you were born after it was last checked"));
});

// ---------------------------------------------------------------- the page (simple first, docs/OPTIONAL.md): one sentence per case
const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
const ui = await import("../../../core/ui/dom.js");
const fmt = await import("../../../core/format.js");
const { migrate } = await import("../../../core/schema/migrate.js");
const { render, headlineOf, ledeOf } = await import("./view.js");
function draw(plan0) {
  const s = { saved: [], root: null, plan: migrate(structuredClone(plan0)) };
  const go = () => { s.root = new FakeElement("main"); render(s.root, { ui, fmt: { ...fmt, today: () => TODAY }, plan: s.plan, route: { group: "estate", id: "beneficiaries", rest: [], query: {} }, module: { group: "estate", id: "beneficiaries" },
    store: { get: () => s.plan, update: (fn) => { const d = structuredClone(s.plan); fn(d); s.saved.push(d); s.plan = d; go(); } }, redraw: go }); };
  go();
  return s;
}
const all = (el) => [el, ...el.all()];
/** The words on screen (the page's own <style> left out). */
const said = (el) => { const w = (n) => (n.data !== undefined ? n.data : n.tagName === "STYLE" ? "" : n.childNodes.map(w).join(" ")); return w(el).replace(/\s+/g, " ").trim(); };
const filled = (root) => all(root).filter((e) => (e.tagName === "BUTTON" || (e.tagName === "A" && /\bbtn\b/.test(e.className))) && !/secondary|chip|danger|eb-row|eb-x/.test(e.className));
const twoNamed = () => [
  { accountId: "a-401", primary: [{ name: "Bo", personId: "p-bo", share: 1 }], contingent: [{ name: "Cy's trust", share: 1 }], reviewedAt: "2026-01-01" },
  { accountId: "a-roth", primary: [{ name: "Ana", personId: "p-ana", share: 1 }], contingent: [{ name: "Cy's trust", share: 1 }], reviewedAt: "2026-01-01" },
];
/** every account that takes a form has someone named and a backup (no policies) */
const everyone = () => {
  const p = familyPlan(TODAY);
  p.estate.beneficiaries = p.accounts.filter((a) => NAMED[a.type]).map((a) => ({ accountId: a.id, primary: [{ name: a.ownerId === "p-bo" ? "Ana" : "Bo", personId: a.ownerId === "p-bo" ? "p-ana" : "p-bo", share: 1 }], contingent: [{ name: "Cy's trust", share: 1 }], reviewedAt: "2026-01-01" }));
  p.insurance = { policies: [] };
  return p;
};
const usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

test("the headline, one written sentence per case (R3, R5)", () => {
  const none = compute(withRows([]), { today: TODAY });
  assert.equal(headlineOf(none), "6 accounts and policies have no one named");
  // "could" (critic F4): the sum counts every account with no one named, and a joint account may still pass to the other owner
  assert.equal(ledeOf(none, usd), "$192,700 could go through the courts before anyone gets it.");
  const some = compute(withRows(twoNamed()), { today: TODAY });
  assert.equal(headlineOf(some), "4 of 6 accounts and policies have no one named");
  assert.equal(ledeOf(some, usd), "$75,700 could go through the courts before anyone gets it.");
  // nothing in them yet (a new account at $0): the zero is said in words, not "$0 could go ..."
  const empty0 = everyone(); empty0.accounts.push({ id: "a-new", name: "New savings", type: "savings", institution: "Ally", balance: 0, asOf: TODAY, ownerId: "", history: [] });
  const z = compute(empty0, { today: TODAY });
  assert.equal(z.missingValue, 0);
  assert.equal(headlineOf(z), "1 of 7 accounts and policies has no one named");
  assert.equal(ledeOf(z, usd), "Name someone on it now, so it goes straight to the people you choose.");
  const z2 = everyone(); z2.accounts.push({ id: "a-n1", name: "New savings", type: "savings", institution: "Ally", balance: 0, asOf: TODAY, ownerId: "", history: [] }, { id: "a-n2", name: "New checking", type: "checking", institution: "Ally", balance: 0, asOf: TODAY, ownerId: "", history: [] });
  assert.equal(ledeOf(compute(z2, { today: TODAY }), usd), "Name someone on each now, so they go straight to the people you choose.");
  const oneLeft = everyone(); oneLeft.estate.beneficiaries.pop();
  assert.equal(headlineOf(compute(oneLeft, { today: TODAY })), "1 of 6 accounts and policies has no one named");
  const look = everyone(); look.estate.beneficiaries[0].contingent = [];
  const l = compute(look, { today: TODAY });
  assert.equal(headlineOf(l), "Everyone has someone named; 1 needs a look");
  assert.equal(ledeOf(l, usd), "Tap the one marked ⚠️ to see what to fix.");
  const look2 = everyone(); look2.estate.beneficiaries[0].contingent = []; look2.estate.beneficiaries[1].contingent = [];
  assert.equal(headlineOf(compute(look2, { today: TODAY })), "Everyone has someone named; 2 need a look");
  assert.equal(ledeOf(compute(look2, { today: TODAY }), usd), "Tap the ones marked ⚠️ to see what to fix.");
  const ok = compute(everyone(), { today: TODAY });
  assert.equal(headlineOf(ok), "Every account and policy has someone named, and a backup");
  assert.equal(ledeOf(ok, usd), "Check them again every few years, and after a birth, a death, a marriage or a divorce.");
  const solo = familyPlan(TODAY); solo.accounts = solo.accounts.filter((a) => a.id === "a-401"); solo.insurance = { policies: [] };
  assert.equal(headlineOf(compute(solo, { today: TODAY })), "Your one account or policy has no one named");
});

test("simple first: the sentence, one filled way on (the next one to fill in), the list, and More on this as questions", () => {
  const s = draw(withRows(twoNamed()));
  const t = said(s.root);
  // no busier than the two tiles it replaced (critic F3): the sentence, the way on, then straight to the list; how to
  // copy the names waits in the form, where it is used
  assert.match(t, /^4 of 6 accounts and policies have no one named \$75,700 could go through the courts before anyone gets it\. Name someone on Chase checking Accounts and policies ⬜ Chase checking/);
  assert.ok(!t.includes("Copy each name"), "the copying hint is in the form, not on the first view");
  const words = (x) => x.split(" ").filter((w) => /[A-Za-z0-9$]/.test(w)).length;
  // the family with nothing named: 97 words before this page opened simple first, 141 with the long lede, the hint and
  // the questions; now the hint is in the form and the lede is short (the rest is the packet's row in More on this)
  assert.ok(words(said(draw(withRows([])).root)) <= 110, `${words(said(draw(withRows([])).root))} words on the first view`);
  assert.deepEqual(filled(s.root).map((b) => textOf(b)), ["Name someone on Chase checking"], "one filled button");
  assert.ok(!all(s.root).some((e) => /\bstat\b/.test(e.className)), "the two tiles became the sentence");
  // the filled button opens that row's form, which starts with where to copy the names from; while a form is open its
  // Save is the one filled button
  filled(s.root)[0].click();
  assert.deepEqual(filled(s.root).map((b) => textOf(b)), ["Save"]);
  assert.match(textOf(all(s.root).find((e) => /\beb-edit\b/.test(e.className))), /No one is named: .* Copy each name from this account's own beneficiary form, on the provider's site under beneficiaries\./);
  all(s.root).find((e) => e.tagName === "BUTTON" && textOf(e) === "Cancel").click();
  assert.deepEqual(filled(s.root).map((b) => textOf(b)), ["Name someone on Chase checking"], "Cancel: the way on is back");
  const card = all(s.root).find((e) => e.tagName === "SECTION" && e.dataset.links !== undefined);
  assert.deepEqual(all(card).filter((e) => e.tagName === "A").map((x) => x.getAttribute("href")), ["#/estate/documents", "#/estate/legacy", "#/reports/if-something-happens"]);
  assert.match(textOf(card), /^More on this Are the will and the other papers signed\? Estate documents › Who should get what you leave\? Legacy goals › What would your family need if something happened to you\? One packet to print ›$/);
  // all named and clean: no filled button at all (nothing to do)
  assert.deepEqual(filled(draw(everyone()).root).map((b) => textOf(b)), []);
});

test("S11: after a save, the green line names the new answer (R7) and no fold opens or shuts", () => {
  const s = draw(withRows(twoNamed()));
  filled(s.root)[0].click();   // opens Chase checking
  const before = all(s.root).filter((e) => e.tagName === "DETAILS").map((e) => [e.dataset.part, e.hasAttribute("open")]);
  all(s.root).find((e) => e.tagName === "BUTTON" && textOf(e) === "+ Bo").click();
  all(s.root).find((e) => e.tagName === "BUTTON" && textOf(e) === "Save").click();
  assert.equal(s.saved.length, 1);
  assert.equal(textOf(all(s.root).find((e) => e.className === "notice ok")), "Chase checking saved. 3 of 6 accounts and policies have no one named.");
  assert.deepEqual(all(s.root).filter((e) => e.tagName === "DETAILS").map((e) => [e.dataset.part, e.hasAttribute("open")]), before);
});

test("a long list shows six rows, then the rest under one quiet row; a row with something to fix is never hidden (R19)", () => {
  const p = everyone();
  for (let i = 0; i < 6; i++) { p.accounts.push({ id: `a-x${i}`, name: `Savings ${i + 1}`, type: "savings", institution: "Ally", balance: 100, asOf: TODAY, ownerId: "", history: [] }); p.estate.beneficiaries.push({ accountId: `a-x${i}`, primary: [{ name: "Bo", personId: "p-bo", share: 1 }], contingent: [{ name: "Cy's trust", share: 1 }], reviewedAt: "2026-01-01" }); }
  p.accounts.push({ id: "a-new", name: "New savings", type: "savings", institution: "Ally", balance: 100, asOf: TODAY, ownerId: "", history: [] });
  const root = draw(p).root;
  const more = all(root).find((e) => e.tagName === "DETAILS" && e.dataset.part === "rows");
  assert.ok(more && !more.hasAttribute("open"));
  assert.equal(textOf(more.querySelector(".fold-title")), "6 more accounts and policies");
  const shown = all(root).filter((e) => e.className === "eb-t" && !e.closest("details")).map((e) => textOf(e));
  assert.equal(shown.length, 7);
  assert.ok(shown.includes("New savings"), "the one with no one named is kept in sight");
});
