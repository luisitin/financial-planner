// modules/reports/if-something-happens/module.test.mjs -- "If something happens to us" (gap design #11): the counts per
// part, one sentence per case, the whitelist (never a password, a full number or a Social Security number), "ending
// 1234", the final wishes saved with a green line, the printed sheet's five parts, and the invariance rule (with
// estate.wishes absent or present, no other page's compute changes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, saveWishes, headlineOf, ledeOf, PARTS, GROUPS, WISHES, STEPS, SSA_PHONE, SSA_LUMP_SUM } from "./compute.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { renterDebtPlan } from "../../../qa/fixtures/renter-debt-plan.mjs";
import { retiredCouplePlan } from "../../../qa/fixtures/retired-couple-plan.mjs";

const T = "2026-11-13";
const by = (d) => Object.fromEntries(d.parts.map((p) => [p.key, p]));
/** Three monthly payments to the power company from the checking account (found by cashflow/recurring), and one shop. */
const powerBills = () => ["2026-08-05", "2026-09-05", "2026-10-05"].map((date, i) => ({ id: `t-pow-${i}`, accountId: "a-chk", date, payee: "City Power", rawPayee: "CITY POWER", amount: -120, category: "utilities" }));
/** The family, with two contacts, two papers placed, a beneficiary named, an online account, the power bill and two wishes. */
function filledPlan() {
  const p = familyPlan(T);
  p.contacts = [
    { id: "k-1", role: "emergency", name: "Dee", firm: "", phone: "555-0100", email: "", notes: "", accountIds: [], policyIds: [], last4: {} },
    { id: "k-2", role: "bank", name: "", firm: "Chase", phone: "555-0101", email: "", notes: "Branch on Main Street", accountIds: ["a-chk"], policyIds: [], last4: { "a-chk": "1234" } },
  ];
  p.papers = [{ key: "birth:p-ana", where: "Fire safe in the hall closet", copy: "", who: "Dee", none: false, notes: "", updatedAt: T }, { key: "taxReturns", where: "Blue box in the attic", copy: "", who: "", none: false, notes: "", updatedAt: T }];
  p.estate.beneficiaries = [{ key: "account:a-401", accountId: "a-401", primary: [{ name: "Bo", personId: "p-bo", share: 1 }], contingent: [{ name: "Cy's trust", share: 1 }], reviewedAt: "2026-01-01" }];
  p.estate.digital = [{ id: "dg-1", kind: "email", name: "Ana's email", access: "legacy", contact: "Bo", notes: "" }, { id: "dg-2", kind: "photos", name: "Photos", access: "none", contact: "", notes: "" }];
  p.transactions = powerBills();
  p.estate.wishes = { funeral: "A small service", written: "", pets: "", tell: "Dee first", letterWhere: "", updatedAt: T };
  return p;
}

// ---------------------------------------------------------------- the page, drawn with the real kit on the fake DOM
const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
const appendOf = FakeElement.prototype.append;
FakeElement.prototype.append = function (...ns) {
  if (ns.some((n) => n === null || n === undefined)) throw new Error(`append(${ns.map((n) => (n == null ? String(n) : typeof n)).join(", ")}): a browser would write it`);
  return appendOf.apply(this, ns);
};
const ui = await import("../../../core/ui/dom.js");
const fmt = await import("../../../core/format.js");
const { render } = await import("./view.js");
function page(plan0, { route = { group: "reports", id: "if-something-happens", rest: [], query: {} } } = {}) {
  let plan = migrate(structuredClone(plan0));
  const s = { saved: [], root: null };
  const ctx = () => ({ ui, fmt: { ...fmt, today: () => T }, plan, route, module: { group: "reports", id: "if-something-happens" },
    store: { get: () => plan, update: (fn) => { const dr = structuredClone(plan); fn(dr); s.saved.push(dr); plan = dr; draw(); } }, redraw: () => draw() });
  const draw = () => { s.root = new FakeElement("main"); render(s.root, ctx()); };
  draw();
  s.plan = () => plan;
  return s;
}
const all_ = (el) => [el, ...el.all()];
const partsOf = (root) => all_(root).filter((e) => e.tagName === "DETAILS" && e.dataset.part);
const partOf = (root, id) => partsOf(root).find((e) => e.dataset.part === id) ?? null;
const opened = (e) => e.hasAttribute("open");
/** The words a person sees without opening anything (a shut part shows its summary; the hidden sheet nothing). */
function seen(el) {
  const walk = (n) => (n.data !== undefined ? n.data : n.hidden ? "" : n.tagName === "DETAILS" && !opened(n) ? walk(n.childNodes.find((c) => c.tagName === "SUMMARY") ?? { data: "" }) : n.tagName === "STYLE" ? "" : n.childNodes.map(walk).join(" "));
  return walk(el).replace(/\s+/g, " ").trim();
}
const filledButtons = (root) => all_(root).filter((e) => (e.tagName === "BUTTON" || (e.tagName === "A" && /\bbtn\b/.test(e.className))) && !/secondary|chip|danger/.test(e.className) && e.getAttribute("type") !== "submit" && !e.closest("details:not([open])") && !(function hid(n) { for (let a = n; a; a = a.parentNode) if (a.hidden) return true; return false; })(e));

// ---------------------------------------------------------------- the counts and the sentences
test("gap #11, test 1: an empty plan gives one sentence and 'Start with who to call ›'", () => {
  const d = compute(emptyPlan(), { today: T });
  assert.equal(d.empty, true);
  assert.equal(d.filled, 0, "no part filled in: the first steps are always there, and fill no part by themselves");
  assert.equal(headlineOf(d), "One packet your family can use if something happens to you.");
  assert.equal(ledeOf(d), "Start with who to call: the people your family would phone first.");
});

test("gap #11, test 2: the counts per part, and the line for each case", () => {
  const d = compute(filledPlan(), { today: T });
  const p = by(d);
  assert.deepEqual(d.parts.map((x) => x.key), ["contacts", "papers", "accounts", "online", "bills", "wishes", "steps"]);
  assert.equal(p.contacts.says, "2 people");
  assert.equal(p.papers.says, "2 of 18 found");
  assert.equal(p.papers.count, 2);
  // 10 accounts on Net worth, no policies; 6 take a beneficiary and one of them has someone named
  assert.equal(p.accounts.says, "5 have no one named");
  assert.equal(p.online.says, "1 has no way in");
  assert.equal(p.bills.says, "1 bill");
  assert.equal(p.bills.note, "About $120 a month in all.");
  assert.equal(p.wishes.says, "2 of 5 written");
  assert.equal(p.steps.says, "6 steps");
  for (const x of d.parts) assert.ok(x.says.length <= 20, `${x.title}: "${x.says}" fits beside the title`);
  // the five parts the page and the sheet show: the first steps with who to call, the bills with the accounts (a phone's
  // first view opens at most five rows, docs/OPTIONAL.md R1); each status is its first filled section's own
  assert.deepEqual(d.groups.map((g) => [g.key, g.title, g.sections.map((x) => x.key), g.says]), [
    ["contacts", "Who to call, and the first steps", ["contacts", "steps"], "2 people"],
    ["papers", "Where the papers are", ["papers"], "2 of 18 found"],
    ["accounts", "Accounts, policies and bills", ["accounts", "bills"], "5 have no one named"],
    ["online", "Online accounts", ["online"], "1 has no way in"],
    ["wishes", "Final wishes", ["wishes"], "2 of 5 written"]]);
  assert.deepEqual(GROUPS.flatMap((g) => g.sections).sort(), PARTS.map((x) => x.key).sort(), "every section in one part, once");
  for (const g of d.groups) assert.ok(g.says.length <= 20, `${g.title}: "${g.says}" fits beside the title`);
  assert.equal(d.filled, 5);
  assert.equal(d.total, 5);
  assert.equal(headlineOf(d), "Ready to print: all 5 parts filled in");
  assert.equal(ledeOf(d), "One packet your family can use if something happens to you. Print it and keep it with your will.");
  // some parts: the family as it comes (accounts only)
  const f = compute(familyPlan(T), { today: T });
  assert.equal(f.filled, 1, "the accounts: the first steps alone fill no part");
  assert.equal(headlineOf(f), "Ready to print: 1 of 5 parts filled in");
  assert.deepEqual(f.groups.map((g) => g.says), ["no one listed yet", "0 of 18 found", "6 have no one named", "none yet", "not set yet"]);
  assert.equal(ledeOf(f), "One packet your family can use if something happens to you. Each part below says what is still missing.");
  const fp = by(f);
  assert.equal(fp.contacts.says, "none yet"); assert.equal(fp.online.says, "none yet"); assert.equal(fp.bills.says, "none found yet"); assert.equal(fp.wishes.says, "not set yet");
  assert.equal(fp.accounts.says, "6 have no one named");
  assert.deepEqual(fp.contacts.missing, ["No one is listed to call in an emergency."]);
  assert.match(fp.bills.missing[0], /^These come from your bank files: bring one in on Import/);
  // a part filled in: a list with at least one row, or wishes with any text
  const one = familyPlan(T); one.accounts = []; one.debts = []; one.estate.wishes = { pets: "The cat goes to Dee" };
  const o = compute(one, { today: T });
  assert.deepEqual(o.parts.filter((x) => x.filled).map((x) => x.key), ["wishes", "steps"]);
  assert.deepEqual(o.groups.filter((g) => g.filled).map((g) => g.key), ["wishes"]);
  assert.equal(o.groups.find((g) => g.key === "accounts").says, "none yet");
  // no accounts or debts on the plan, one bill found in the bank files: the part is filled in, with the bills' status
  const billsOnly = familyPlan(T); billsOnly.accounts = []; billsOnly.debts = []; billsOnly.transactions = powerBills();
  const bo = compute(billsOnly, { today: T }).groups.find((g) => g.key === "accounts");
  assert.deepEqual([bo.filled, bo.says], [true, "1 bill"]);
  assert.equal(by(o).wishes.says, "1 of 5 written");
  assert.deepEqual(by(o).accounts.missing, ["No accounts or policies yet: add them on Net worth and Policies."]);
  // a status is never a bare number: every account named, every online account with a way in, two bills
  const all = filledPlan(); all.estate.digital = all.estate.digital.slice(0, 1);
  all.accounts = all.accounts.filter((a) => a.id === "a-401"); all.debts = []; all.insurance.policies = [];
  all.transactions = [...powerBills(), ...powerBills().map((t, i) => ({ ...t, id: `t-net-${i}`, payee: "Fast Internet", rawPayee: "FAST INTERNET", amount: -60 }))];
  const ad = compute(all, { today: T }), a = by(ad);
  assert.equal(ad.groups.find((g) => g.key === "accounts").says, "1, all named", "the first filled section's status");
  assert.equal(a.accounts.says, "1, all named");
  assert.equal(a.online.says, "1 account");
  assert.equal(a.bills.says, "2 bills");
  for (const x of Object.values(a)) assert.ok(!/^\d+$/.test(x.says), `${x.key}: "${x.says}" says what it counts`);
});

test("gap #11: the first steps are written out once, with the will and the executor when the plan knows them", () => {
  assert.equal(STEPS.length, 6);
  assert.ok(STEPS[1].includes(SSA_PHONE) && STEPS[1].includes(`$${SSA_LUMP_SUM}`));
  assert.equal(SSA_LUMP_SUM, 255);
  assert.match(STEPS[0], /^Ask the funeral home for 10 to 12 certified copies of the death certificate\./);
  assert.match(STEPS[2], /it tells the other two\.$/);
  const none = by(compute(familyPlan(T), { today: T })).steps.rows[3].lines;
  assert.deepEqual(none, ["Where the will is kept is not written down yet (Estate documents).", "No executor is listed yet (Contacts)."]);
  const p = familyPlan(T);
  p.estate.documents = [{ id: "ed-1", kind: "will", personId: "p-ana", status: "done", done: true, updatedAt: "2025-01-01", where: "Lawyer's office", notes: "" }];
  p.contacts = [{ id: "k-x", role: "executor", name: "Eli", firm: "", phone: "555-0102", email: "", notes: "", accountIds: [], policyIds: [], last4: {} }];
  assert.deepEqual(by(compute(p, { today: T })).steps.rows[3].lines, ["The will is kept: Lawyer's office.", "The executor: Eli, 555-0102."]);
});

// ---------------------------------------------------------------- the whitelist and the last four digits
const SECRETS = ["SECRETVALUE1", "SECRETVALUE2", "SECRETVALUE3", "SECRETVALUE4", "SECRETVALUE5", "SECRETVALUE6", "SECRETVALUE7", "SECRETVALUE8"];
function leakyPlan() {
  const p = filledPlan();
  for (const a of p.accounts) Object.assign(a, { accountNumber: SECRETS[0], routingNumber: SECRETS[1], password: SECRETS[2] });
  for (const k of p.contacts) Object.assign(k, { ssn: SECRETS[3], password: SECRETS[2], accountNumber: SECRETS[0] });
  p.contacts[1].last4 = { "a-chk": "12345678", "a-sav": "5678" };   // a full number typed by mistake is never kept, even cut down
  p.contacts[1].accountIds.push("a-sav");
  for (const x of p.estate.digital) Object.assign(x, { password: SECRETS[4], recoveryPhrase: SECRETS[5] });
  for (const x of p.household.people) Object.assign(x, { ssn: SECRETS[3] });
  p.papers[0].number = SECRETS[6];
  p.insurance = { policies: [{ id: "pol-1", name: "Term life", kind: "term", personId: "p-ana", insurer: "Acme Life", benefit: 500000, premium: 30, period: "monthly", policyNumber: SECRETS[7] }] };
  p.estate.wishes.pin = SECRETS[2];
  return p;
}
test("gap #11, test 3: only whitelisted fields are read: no password, full number or Social Security number reaches the packet", async () => {
  const p = leakyPlan();
  const json = JSON.stringify(compute(p, { today: T }));
  for (const s of SECRETS) assert.ok(!json.includes(s), `${s} never reaches the packet`);
  assert.ok(!json.includes("12345678"), "a full number typed as the last four is not kept");
  const s = page(p);
  const all = textOf(s.root);   // the page and the hidden printed sheet
  for (const x of SECRETS) assert.ok(!all.includes(x), x);
  // a note that looks like a password is left out, and the page says so (never folded)
  const q = filledPlan();
  q.estate.digital[0].notes = "password: hunter22";
  q.contacts[1].notes = "pin = 4821";
  const d = compute(q, { today: T });
  assert.deepEqual(d.secrets.map((x) => x.part), ["contacts", "online"]);
  const sq = page(q);
  assert.ok(!textOf(sq.root).includes("hunter22") && !textOf(sq.root).includes("4821"));
  const warn = all_(sq.root).find((e) => e.className === "notice warn");
  assert.match(textOf(warn), /^Left out of the packet because they look like a password or a recovery phrase: the notes for Chase; the notes for email\./);
  assert.equal(warn.closest("details"), null, "the warning is never inside a shut part");
});

test("gap #11, test 4: 'ending 1234': the last four digits only, on the account and on the contact who handles it", () => {
  const d = compute(leakyPlan(), { today: T });
  const p = by(d);
  const chk = p.accounts.rows.find((r) => r.title === "Chase checking");
  assert.deepEqual(chk.lines, ["At Chase", "No one named to receive it"], "12345678 is not four digits: nothing is shown");
  const sav = p.accounts.rows.find((r) => r.title === "Ally savings");
  assert.ok(sav.lines.includes("Number ending 5678"));
  const chase = p.contacts.rows.find((r) => r.title === "Chase");
  assert.ok(chase.lines.includes("Handles: Chase checking, Ally savings (ending 5678)"), chase.lines.join(" | "));
  const pol = p.accounts.rows.find((r) => r.title === "Term life");
  assert.deepEqual(pol.lines, ["With Acme Life", "Covers: Ana", "Death benefit: $500,000", "No one named to receive it"]);
  // the 401(k) with someone named, and a backup
  assert.ok(p.accounts.rows.find((r) => r.title === "Ana's 401(k)").lines.includes("Goes to: Bo; then Cy's trust"));
  // a debt's payment, so the family can keep it paid
  assert.ok(p.accounts.rows.find((r) => r.title === "Visa card").lines.includes("Payment about $400 a month"));
});

test("gap #11, test 1 (page): the empty plan's first view is one sentence and one filled way to start", () => {
  const s = page(emptyPlan());
  const t = seen(s.root);
  assert.match(t, /^One packet your family can use if something happens to you\. Start with who to call: the people your family would phone first\. Start with who to call ›/);
  assert.deepEqual(filledButtons(s.root).map((b) => [b.textContent, b.getAttribute("href")]), [["Start with who to call ›", "#/household/contacts"]]);
  assert.ok(!t.includes("Print the packet"), "nothing to print yet");
  const words = t.split(" ").filter((w) => /[A-Za-z0-9]/.test(w)).length;
  assert.ok(words <= 100, `${words} words on the empty plan's first view (opt R1: 100)`);
  assert.ok(!t.includes("More on this"), "the empty plan keeps to one way to start");
});

test("gap #11: the cover, then five shut rows with their counts; one filled button, Print the packet", () => {
  const s = page(familyPlan(T));
  const t = seen(s.root);
  assert.match(t, /^Ready to print: 1 of 5 parts filled in One packet your family can use if something happens to you\. Each part below says what is still missing\. Print the packet What the packet holds Who to call, and the first steps no one listed yet › Where the papers are 0 of 18 found › Accounts, policies and bills 6 have no one named › Online accounts none yet › Final wishes not set yet ›/);
  assert.deepEqual(partsOf(s.root).map((e) => [e.dataset.part, e.dataset.kind, opened(e)]), GROUPS.map((g) => [g.key, "item", false]));
  assert.ok(partsOf(s.root).length <= 5, "a report opens at most five rows (docs/OPTIONAL.md R1)");
  // a part of two sections names each inside, in the packet's order
  const first = partOf(s.root, "contacts");
  assert.deepEqual(all_(first).filter((e) => e.tagName === "H3").map((e) => textOf(e)), ["Who to call", "First steps for your family"]);
  assert.match(textOf(first), /Who to call The people and firms your family would phone first.* First steps for your family What to do in the first days, in order\./);
  assert.ok(textOf(first).includes(SSA_PHONE));
  assert.deepEqual(all_(partOf(s.root, "accounts")).filter((e) => e.tagName === "H3").map((e) => textOf(e)), ["Accounts and policies", "Bills that pay themselves"]);
  assert.match(textOf(partOf(s.root, "accounts")), /Bills that pay themselves Payments that leave your accounts by themselves/);
  assert.equal(all_(partOf(s.root, "papers")).filter((e) => e.tagName === "H3").length, 0, "one section: no heading inside");
  assert.deepEqual(filledButtons(s.root).map((b) => b.textContent), ["Print the packet"]);
  // each row opens to its list, what is missing and the page where it is kept
  const acc = textOf(partOf(s.root, "accounts"));
  assert.match(acc, /Every account and policy, the firm that holds it/);
  assert.match(acc, /6 have no one named to receive them: Chase checking, Ally savings, Ana's 401\(k\), Bo's Roth IRA, Bo's old 401\(k\) and 1 more\./);
  assert.match(acc, /Mortgage Mortgage At Wells Fargo Payment about \$1,980 a month/);
  assert.match(acc, /Who is named: Beneficiary audit ›/);
  // a part is worth a tap (opt R14): two figures, three rows or forty words, in every part of every household
  for (const plan of [emptyPlan(), familyPlan(T), filledPlan(), renterDebtPlan(), retiredCouplePlan()]) {
    for (const e of partsOf(page(plan).root)) {
      const body = e.children.find((c) => /fold-body/.test(c.className));
      const words = textOf(body).split(" ").filter((w) => /[A-Za-z0-9]/.test(w)).length;
      const rows = all_(body).filter((x) => x.tagName === "LI" || /\bfield\b/.test(x.className)).length;
      assert.ok(words >= 40 || rows >= 3, `${e.dataset.part}: ${words} words, ${rows} rows`);
      assert.ok(!all_(body).some((x) => /\bnotice\b/.test(x.className) && !opened(e)), `${e.dataset.part}: no notice behind a shut row`);
    }
  }
});

test("gap #11, test 5, S11: final wishes are saved through store.update with a green line naming the new answer; the part stays open", () => {
  const s = page(familyPlan(T));
  const w = partOf(s.root, "wishes");
  const form = all_(w).find((e) => e.tagName === "FORM");
  assert.deepEqual(all_(form).filter((e) => e.getAttribute?.("name")).map((e) => e.getAttribute("name")), WISHES.map((f) => f.key), "five boxes");
  assert.ok(!all_(form).some((e) => e.hasAttribute?.("required")), "nothing is required");
  form.querySelector('[name="funeral"]').value = "A small service";
  form.querySelector('[name="pets"]').value = "The cat goes to Dee";
  form.dispatch("submit");
  assert.equal(s.saved.length, 1);
  assert.deepEqual(s.plan().estate.wishes, { funeral: "A small service", written: "", pets: "The cat goes to Dee", tell: "", letterWhere: "", updatedAt: T });
  const after = partOf(s.root, "wishes");
  assert.ok(opened(after), "the part just saved stays open (R17)");
  assert.deepEqual(partsOf(s.root).filter(opened).map((e) => e.dataset.part), ["wishes"], "no other part opens");
  const ok = all_(after).find((e) => e.className === "notice ok");
  assert.equal(textOf(ok), "Saved your final wishes. Ready to print: 2 of 5 parts filled in.");
  assert.match(seen(s.root), /^Ready to print: 2 of 5 parts filled in/);
  assert.match(seen(s.root), /Final wishes 2 of 5 written ›/);
  // saved again with the same headline: the line says only that it saved
  const f2 = all_(partOf(s.root, "wishes")).find((e) => e.tagName === "FORM");
  f2.querySelector('[name="tell"]').value = "My brother first";
  f2.dispatch("submit");
  assert.equal(textOf(all_(partOf(s.root, "wishes")).find((e) => e.className === "notice ok")), "Saved your final wishes.");
  // a password in a box is held, nothing saved
  const f3 = all_(partOf(s.root, "wishes")).find((e) => e.tagName === "FORM");
  f3.querySelector('[name="written"]').value = "password: hunter22";
  f3.dispatch("submit");
  assert.equal(s.saved.length, 2, "not saved");
  // every box emptied: the wishes go from the plan
  const f4 = all_(partOf(s.root, "wishes")).find((e) => e.tagName === "FORM");
  for (const f of WISHES) f4.querySelector(`[name="${f.key}"]`).value = "";
  f4.dispatch("submit");
  assert.equal(s.plan().estate.wishes, undefined);
  assert.equal(textOf(all_(partOf(s.root, "wishes")).find((e) => e.className === "notice ok")), "Cleared your final wishes.");
});

test("gap #11: saveWishes trims every box and drops the wishes when all are empty", () => {
  const p = emptyPlan();
  assert.deepEqual(saveWishes(p, { funeral: "  A  small service ", pets: "" }, T), { funeral: "A small service", written: "", pets: "", tell: "", letterWhere: "", updatedAt: T });
  assert.equal(saveWishes(p, {}, T), null);
  assert.equal(p.estate.wishes, undefined);
});

test("gap #11, test 6: the printed sheet holds the five parts and their seven sections, hidden on screen; the letter's place falls back on Estate documents", () => {
  const p = filledPlan();
  p.estate.documents = [{ id: "ed-l", kind: "letter", personId: "", status: "done", done: true, updatedAt: "2025-01-01", where: "Top desk drawer", notes: "" }];
  const s = page(p);
  const sheet = all_(s.root).find((e) => e.tagName === "ARTICLE" && /rp-sheet/.test(e.className));
  assert.ok(sheet, "the sheet is drawn");
  let n = sheet; let hidden = false; for (; n; n = n.parentNode) if (n.hidden) hidden = true;
  assert.ok(hidden, "hidden on screen: only the printer shows it");
  assert.deepEqual(all_(sheet).filter((e) => e.tagName === "H2").map((e) => textOf(e)), GROUPS.map((x) => x.title));
  assert.deepEqual(all_(sheet).filter((e) => e.tagName === "H3").map((e) => textOf(e)), ["Who to call", "First steps for your family", "Accounts and policies", "Bills that pay themselves"]);
  const t = textOf(sheet);
  assert.match(t, /^If something happens to us Prepared November 13, 2026\. Keep it with your will, where your family can find it\. Never in it: passwords, full account numbers or Social Security numbers\./);
  assert.match(t, /Dee Someone to call in an emergency Phone 555-0100/);
  assert.match(t, /Birth certificate \(Ana\) Kept: Fire safe in the hall closet · Also knows: Dee/);
  assert.match(t, /City Power \$120 \$120 every month · From Chase checking · Next about Nov 5/);
  assert.match(t, /Where a letter to your family is kept Top desk drawer \(from Estate documents\)/);
  assert.ok(t.includes(SSA_PHONE));
  assert.ok(!seen(s.root).includes("Prepared November 13"), "the sheet's words are not on the first view");
  // the page's own print button is the hero's, not the kit's
  assert.ok(!all_(s.root).some((e) => e.tagName === "BUTTON" && textOf(e) === "Print or save as PDF"));
});

test("gap #11, test 7: no run of nine or more digits and no Social Security number shape in any packet of the qa households", async () => {
  const { ARCHETYPES, COMMON_PACKS, SPECIAL_PACKS } = await import("../../../qa/households/lib/catalog.mjs");
  const plans = [familyPlan(T), renterDebtPlan(), retiredCouplePlan(), emptyPlan(), filledPlan()];
  for (const a of ARCHETYPES) { plans.push(a.build()); for (const v of (SPECIAL_PACKS[a.id] ?? []).slice(0, 2)) { const q = structuredClone(a.build()); v.apply(q); plans.push(q); } }
  for (const plan of plans) {
    const d = compute(migrate(structuredClone(plan)), { today: T });
    const words = d.parts.flatMap((p) => [p.says, p.note, ...p.missing, ...p.rows.flatMap((r) => [r.title, r.value, ...r.lines])]).join(" | ");
    assert.ok(!/(?<![\d,.$])\d{9,}/.test(words), `a long number in: ${words.match(/\d{9,}/)?.[0]}`);
    assert.ok(!/\b\d{3}-\d{2}-\d{4}\b/.test(words));
    for (const p of d.parts) assert.ok(p.says.length <= 20, `${p.key}: "${p.says}"`);
  }
  assert.ok(plans.length > 14 && COMMON_PACKS);
});

// ---------------------------------------------------------------- a long number typed anywhere (critic F1, F2)
// built here, never written out: the repo's leak guard refuses nine digits in a row in any file
const SSN = ["123", "45", "6789"].join("-");
const CARD = ["4111", "1111", "1111", "1111"];
const ACCT = ["98765", "4321"].join("");
const PHONE = ["555", "010", "0123"].join("-");
const ZIP4 = ["12345", "6789"].join("-");
/** The family with a Social Security number, a card number and an account number typed into every kind of box the packet reads. */
function numberPlan() {
  const p = filledPlan();
  p.contacts[0].notes = `SSN ${SSN}, card ${CARD.join("")}`;
  p.contacts[0].phone = PHONE;
  p.contacts[1].firm = `Chase acct ${ACCT}`;
  p.contacts[1].phone = ["555", "010", "0199"].join("");
  p.accounts.find((a) => a.id === "a-chk").name = `Chase ${CARD.join(" ")}`;
  p.accounts.find((a) => a.id === "a-sav").institution = `Ally ${CARD.join("-")}`;
  p.papers[0].where = `Fire safe, Main St, ${ZIP4}`;
  p.papers[1].where = `Box ${ACCT} at the bank`;
  p.estate.beneficiaries[0].primary[0].name = `Bo ${SSN}`;
  p.estate.digital[0].contact = `Bo, card ${CARD.join(" ")}`;
  p.transactions = powerBills().map((t) => ({ ...t, payee: `City Power ${ACCT}`, rawPayee: `CITY POWER ${ACCT}` }));
  p.estate.documents = [{ id: "ed-w", kind: "will", personId: "p-ana", status: "done", done: true, updatedAt: "2025-01-01", where: `Deposit box ${ACCT}`, notes: "" }];
  p.estate.wishes = { funeral: `SSN ${SSN}`, written: "", pets: "", tell: `Dee at ${PHONE}`, letterWhere: "", updatedAt: T };
  return p;
}
const NUMBERS = [SSN, SSN.replace(/-/g, ""), CARD.join(""), CARD.join(" "), CARD.join("-"), ACCT];
const packetWords = (d) => d.parts.flatMap((p) => [p.says, p.note, ...p.missing, ...p.rows.flatMap((r) => [r.title, r.value, ...r.lines])]).join(" | ");

test("critic F1: a Social Security, card or account number typed in any box never reaches the packet; phones, ZIP codes and 'ending 1234' do", () => {
  const d = compute(numberPlan(), { today: T });
  const words = packetWords(d);
  for (const n of NUMBERS) assert.ok(!words.includes(n), `${n} reaches the packet: ${words}`);
  // what is left out is named, as a number (not as a password)
  // what is left out is named once each, as a number (not as a password), in the packet's order of reading
  assert.deepEqual(d.secrets.map((x) => [x.part, x.what, x.why]), [
    ["accounts", "an account's name (Checking)", "number"],
    ["contacts", "the notes for Dee", "number"],
    ["contacts", "a contact's firm", "number"],
    ["papers", "the place for Tax returns", "number"],
    ["papers", "the place for Will (Ana)", "number"],
    ["accounts", "an account's firm (Savings or money market)", "number"],
    ["accounts", "a beneficiary's name", "number"],
    ["online", "who can get in", "number"],
    ["bills", "a bill's name", "number"],
    ["wishes", "funeral or burial wishes", "number"],
    ["steps", "where the will is kept", "number"],
  ]);
  const p = by(d);
  // each row keeps what it can: the account by its kind wherever it is named, a plain "A payment", the will's place said honestly
  const chk = p.accounts.rows.find((r) => r.title === "Checking");
  assert.ok(chk && chk.lines.includes("No one named to receive it"), "the checking account is still listed, by its kind");
  assert.ok(p.contacts.rows.some((r) => r.lines.includes("Handles: Checking (ending 1234)")), "the contact who handles it names it the same way");
  assert.match(p.accounts.missing[0], /: Checking, Ally savings, Bo's Roth IRA/);
  assert.ok(p.accounts.rows.find((r) => r.title === "Ally savings").lines.every((l) => !l.startsWith("At ")), "the firm with a number is left out");
  assert.ok(p.accounts.rows.find((r) => r.title === "Ana's 401(k)").lines.includes("Goes to: someone named on the form; then Cy's trust"));
  assert.deepEqual(p.contacts.rows.find((r) => r.value === "Bank, lender or investment firm").title, "Someone");
  assert.ok(p.online.rows[0].lines.includes("A legacy contact is named on the account"), "how in, without who");
  assert.equal(p.bills.rows[0].title, "A payment");
  assert.ok(p.bills.rows[0].lines.includes("From Checking"));
  assert.ok(p.papers.rows.find((r) => r.title === "Tax returns").lines.includes("Kept: left out of this packet"));
  assert.equal(p.steps.rows[3].lines[0], "Where the will is kept is left out of this packet.");
  assert.equal(p.wishes.says, "1 of 5 written", "the funeral box is left out and not counted");
  // a phone number, a ZIP+4 code and a last four are not full numbers
  assert.ok(p.contacts.rows.find((r) => r.title === "Dee").lines.includes(`Phone ${PHONE}`));
  assert.ok(p.contacts.rows.some((r) => r.lines.includes(`Phone ${["555", "010", "0199"].join("")}`)), "ten digits in the phone box is a phone");
  assert.ok(p.papers.rows.some((r) => r.lines.includes(`Kept: Fire safe, Main St, ${ZIP4}`)));
  assert.equal(p.wishes.rows.find((r) => r.title === "Who to tell first").lines[0], `Dee at ${PHONE}`);
  assert.ok(by(compute(leakyPlan(), { today: T })).accounts.rows.find((r) => r.title === "Ally savings").lines.includes("Number ending 5678"));
});

test("critic F1: longNumber, case by case: what is a full number and what is not", async () => {
  const { longNumber, heldOut } = await import("./compute.js");
  for (const t of [`SSN ${SSN}`, SSN.replace(/-/g, ""), SSN.replace(/-/g, " "), CARD.join(""), CARD.join(" "), CARD.join("-"), `acct ${ACCT}`, ["1234", "5678", "90"].join(" ")]) assert.equal(longNumber(t), true, t);
  for (const t of [PHONE, `1-${PHONE}`, `1 ${PHONE.replace(/-/g, " ")}`, ZIP4, "$1,250,000", "ending 1234", "555-0100", "Signed 2026-03-02 2 copies", "Renewed 03-02-2026 12 months", "Box 12, shelf 3", ""]) assert.equal(longNumber(t), false, t);
  // a phone box takes ten digits typed together, brackets and a number from abroad; nine digits there are still refused
  for (const t of [["555", "010", "0199"].join(""), `(555) ${["010", "0199"].join("-")}`, "+44 20 7946 0958"]) assert.equal(longNumber(t, { phone: true }), false, t);
  assert.equal(longNumber(SSN.replace(/-/g, ""), { phone: true }), true);
  assert.equal(heldOut("password: x"), "secret");
  assert.equal(heldOut(`card ${CARD.join(" ")}`), "number");
  assert.equal(heldOut("The cat goes to Dee"), "");
});

test("critic F1: the page says what was left out for a long number, and the printed sheet holds none of them", () => {
  const s = page(numberPlan());
  const warns = all_(s.root).filter((e) => e.className === "notice warn");
  assert.equal(warns.length, 1, "no password here: only the line for long numbers");
  assert.match(textOf(warns[0]), /^Left out of the packet because they hold a long number, like a full account or Social Security number: an account's name \(Checking\); the notes for Dee; a contact's firm; .*; funeral or burial wishes; where the will is kept\. Write only the last four digits of a number\.$/);
  assert.equal(warns[0].closest("details"), null, "never inside a shut part");
  const sheet = all_(s.root).find((e) => e.tagName === "ARTICLE" && /rp-sheet/.test(e.className));
  for (const n of NUMBERS) assert.ok(!textOf(sheet).includes(n), `${n} on the printed sheet`);
  for (const n of NUMBERS) assert.ok(!seen(s.root).includes(n), `${n} on the first view`);
  // one of each: a password and a long number get a line each, one sentence per case
  const q = numberPlan(); q.contacts[1].notes = "pin = 4821"; q.contacts[0].notes = `card ${CARD.join("")}`;
  assert.deepEqual(compute(q, { today: T }).secrets.filter((x) => x.why === "secret").map((x) => x.what), ["the notes for a contact"]);
  const both = all_(page(q).root).filter((e) => e.className === "notice warn").map((e) => textOf(e));
  assert.equal(both.length, 2);
  assert.match(both[0], /^Left out of the packet because it looks like a password or a recovery phrase: the notes for a contact\. Write where a secret is kept, never the secret itself\.$/);
  assert.match(both[1], /^Left out of the packet because they hold a long number/);
  const single = filledPlan(); single.contacts[0].notes = `SSN ${SSN}`;
  assert.equal(textOf(all_(page(single).root).find((e) => e.className === "notice warn")), "Left out of the packet because it holds a long number, like a full account or Social Security number: the notes for Dee. Write only the last four digits of a number.");
});

test("critic F1: the wishes form refuses a long number at its box, and takes a phone number", () => {
  const s = page(familyPlan(T));
  const f = all_(partOf(s.root, "wishes")).find((e) => e.tagName === "FORM");
  f.querySelector('[name="funeral"]').value = `SSN ${SSN}`;
  f.dispatch("submit");
  assert.equal(s.saved.length, 0, "not saved");
  const f2 = all_(partOf(s.root, "wishes")).find((e) => e.tagName === "FORM");
  f2.querySelector('[name="funeral"]').value = "A small service";
  f2.querySelector('[name="tell"]').value = `Dee at ${PHONE}`;
  f2.dispatch("submit");
  assert.equal(s.saved.length, 1);
  assert.equal(s.plan().estate.wishes.tell, `Dee at ${PHONE}`);
});

test("critic F2: 'N of 5 written' counts only the boxes the packet prints", () => {
  const p = familyPlan(T);
  p.estate.wishes = { funeral: "A small service", pets: "password: abc" };
  const w = by(compute(p, { today: T })).wishes;
  assert.equal(w.rows.length, 1);
  assert.equal(w.says, "1 of 5 written");
  assert.equal(compute(p, { today: T }).wishesSet, 1);
  // only a secret: the part is not filled in
  p.estate.wishes = { pets: "password: abc", funeral: `SSN ${SSN}` };
  const d = compute(p, { today: T });
  assert.equal(by(d).wishes.says, "not set yet");
  assert.equal(by(d).wishes.filled, false);
  assert.equal(d.filled, 1, "the accounts only");
});

// ---------------------------------------------------------------- invariance (gap spec 3.5)
test("gap #11: with estate.wishes absent or present, every other page that reads the estate gives byte-identical output", async () => {
  const { default: REGISTRY } = await import("../../registry.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const mods = await Promise.all(REGISTRY.map(async (e) => (await e.load()).default));
  // Choices to take to a lawyer (estate/will-worksheet, gap #14) shows and saves the same pets line by design: its own
  // test "pets are the same line as Final wishes" holds it to that, and to nothing else in the wishes
  const shares = (m) => (m.group === "reports" && m.id === "if-something-happens") || (m.group === "estate" && m.id === "will-worksheet");
  const readers = mods.filter((m) => (m.needs ?? []).includes("estate") && !shares(m) && !m.placeholder);
  assert.ok(readers.length >= 10, readers.map((m) => `${m.group}/${m.id}`).join(", "));
  const fixtures = [familyPlan(T), renterDebtPlan(), retiredCouplePlan(), emptyPlan()];
  const plans = [...fixtures, ...ARCHETYPES.map((a) => a.build())];
  for (const plan of plans) {
    const a = migrate(structuredClone(plan));
    const b = structuredClone(a); saveWishes(b, { funeral: "A small service", pets: "The cat goes to Dee" }, T);
    for (const m of readers.filter((x) => !x.heavy || fixtures.includes(plan))) {
      let x, y;
      // Diagnostics measures the plan file's size: a longer plan is a bigger file, and that is all it may say
      const out = (q) => { const r = m.compute(q, { today: T }); if (m.id === "diagnostics" && r?.size) delete r.size; return JSON.stringify(r); };
      try { x = out(a); } catch (e) { x = `THROW ${e.message}`; }
      try { y = out(b); } catch (e) { y = `THROW ${e.message}`; }
      assert.equal(y, x, `${m.group}/${m.id}`);
    }
  }
});
