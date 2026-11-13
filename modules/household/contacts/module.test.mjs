import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, saveContact, removeContact, lastFour, ROLES, NO_FIRM } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

function plan() {
  const p = familyPlan("2026-10-31");
  p.insurance = { policies: [{ id: "pol-h", name: "House policy", kind: "home", insurer: "Acme Mutual" }, { id: "pol-a", name: "Car policy", kind: "auto", insurer: "acme mutual" }, { id: "pol-l", name: "Term life", kind: "term" }] };
  return p;
}

test("only the last four digits are kept", () => {
  assert.equal(lastFour("1234"), "1234"); assert.equal(lastFour(" 12-34 "), "1234");
  assert.equal(lastFour("12345"), "", "a longer number is refused, never cut down"); assert.equal(lastFour("12a4"), ""); assert.equal(lastFour(""), ""); assert.equal(lastFour(null), "");
});

test("suggestions: each bank on your accounts and each insurer on your policies, grouped by name, until someone handles them", () => {
  const p = plan();
  const d = compute(p);
  assert.equal(d.empty, true);
  const firms = d.suggestions.map((s) => [s.role, s.firm, s.accountIds.length + s.policyIds.length]);
  assert.ok(firms.some(([r, f]) => r === "bank" && f === "Chase"));
  assert.deepEqual(firms.find(([, f]) => f === "Acme Mutual"), ["insurer", "Acme Mutual", 2], "the same insurer in other capitals is one suggestion");
  assert.equal(d.suggestions.find((s) => s.firm === "Acme Mutual").what, "House policy, Car policy");
  // a contact for the firm (by name) or one that handles the account takes the suggestion away
  saveContact(p, { id: "c1", role: "insurer", firm: "ACME Mutual" });
  saveContact(p, { id: "c2", role: "other", name: "Pat", accountIds: [p.accounts.find((a) => a.institution === "Chase").id] });
  const e = compute(p);
  assert.ok(!e.suggestions.some((s) => s.firm === "Acme Mutual"));
  assert.equal(e.suggestions.find((s) => s.firm === "Chase").what, "Visa card", "Pat handles the checking account; the Chase card is still offered");
});

test("contacts: cleaned, linked to accounts and policies with last four digits, grouped by role in order", () => {
  const p = plan();
  const chk = p.accounts.find((a) => a.institution === "Chase").id;
  const c = saveContact(p, { id: "c1", role: "bank", firm: " Chase ", phone: "555 0100", accountIds: [chk, chk, "gone"], last4: { [chk]: "4321", gone: "1", other: "123456" } });
  assert.deepEqual(c.accountIds, [chk, "gone"]); assert.deepEqual(c.last4, { [chk]: "4321" }, "bad numbers are dropped");
  saveContact(p, { id: "c2", role: "emergency", name: "Sam", email: "sam@example.com" });
  saveContact(p, { id: "c3", role: "nonsense", name: "Lee", policyIds: ["pol-l"] });
  const d = compute(p);
  assert.deepEqual(d.contacts.map((x) => [x.id, x.role]), [["c2", "emergency"], ["c1", "bank"], ["c3", "other"]]);
  assert.deepEqual(d.contacts[1].links, [{ kind: "account", id: chk, name: "Chase checking", what: "Checking", last4: "4321" }], "a link to a removed account is not shown");
  assert.deepEqual(d.contacts[2].links.map((l) => [l.kind, l.name, l.what]), [["policy", "Term life", "Term life"]]);
  assert.deepEqual(d.byRole.map((g) => g.role), ["emergency", "bank", "other"]);
  assert.equal(d.contacts[1].roleLabel, ROLES.bank.label);
  // saving again by id replaces
  saveContact(p, { id: "c1", role: "bank", firm: "Chase", phone: "555 0199" });
  assert.equal(p.contacts.filter((x) => x.id === "c1").length, 1); assert.equal(compute(p).contacts.find((x) => x.id === "c1").phone, "555 0199");
  assert.equal(removeContact(p, "c1"), true); assert.equal(removeContact(p, "c1"), false);
});

test("things worth a look: no one to call in an emergency, no way to reach someone, accounts tied to no one", () => {
  const p = plan();
  p.accounts.push({ id: "x", name: "Cash box", type: "cash" });
  saveContact(p, { id: "c1", role: "advisor", name: "Riley" });
  const d = compute(p);
  assert.deepEqual(d.checks.map((c) => c.id), ["emergency", "reach", "unlinked"]);
  assert.match(d.checks[1].text, /^Riley has no phone or email/);
  assert.match(d.checks[2].text, /^1 account or policy is not tied/, "the term life policy names no insurer; the house and the cash box have no firm behind them (NO_FIRM)");
  saveContact(p, { id: "c2", role: "emergency", name: "Sam", phone: "555 0100", policyIds: ["pol-l"] });
  saveContact(p, { id: "c1", role: "advisor", name: "Riley", email: "r@example.com" });
  assert.deepEqual(compute(p).checks, []);
  assert.deepEqual(NO_FIRM, ["property", "vehicle", "cash", "other_asset"]);
  assert.deepEqual(compute(emptyPlan()), { contacts: [], byRole: [], suggestions: [], checks: [{ id: "emergency", text: compute(emptyPlan()).checks[0].text }], empty: true });
});

// ---------------------------------------------------------------- the page (simple first, docs/OPTIONAL.md), drawn on the fake DOM
const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
// the stand-in DOM has no insertBefore yet (the contact form puts its links above its buttons)
FakeElement.prototype.insertBefore ??= function (n, ref) { if (n.parentNode) n.remove(); n.parentNode = this; const i = ref ? this.childNodes.indexOf(ref) : -1; if (i < 0) this.childNodes.push(n); else this.childNodes.splice(i, 0, n); return n; };
const ui = await import("../../../core/ui/dom.js");
const fmt = await import("../../../core/format.js");
const { migrate } = await import("../../../core/schema/migrate.js");
const { render } = await import("./view.js");
function draw(plan0, query = {}) {
  const plan = migrate(structuredClone(plan0));
  const root = new FakeElement("main");
  render(root, { ui, fmt: { ...fmt, today: () => "2026-11-13" }, plan, route: { group: "household", id: "contacts", rest: [], query }, module: { group: "household", id: "contacts" }, store: { get: () => plan, update() {} }, redraw() {} });
  return root;
}
const all = (el) => [el, ...el.all()];
const details = (root) => all(root).filter((e) => e.tagName === "DETAILS");

test("simple first: the suggestions from your accounts are one part (no hand-written fold), open while short or while no one is listed", () => {
  const p = plan();
  const root = draw(p);
  const ds = details(root);
  assert.deepEqual(ds.map((e) => [e.dataset.part, e.dataset.kind]), [["suggestions", "item"]], "every fold is a part");
  const s = ds[0];
  assert.equal(textOf(s.querySelector(".fold-title")), "From your accounts and policies");
  assert.equal(textOf(s.querySelector(".fold-status")), `${compute(p).suggestions.length} to add`);
  assert.ok(s.hasAttribute("open"), "no one listed yet: the quickest way to start is open");
  // with contacts on file and more than three suggestions, it waits shut
  saveContact(p, { id: "c1", role: "emergency", name: "Dee", phone: "555-0100" });
  const d = compute(p);
  assert.ok(d.suggestions.length > 3);
  assert.ok(!details(draw(p))[0].hasAttribute("open"));
});

test("More on this: the family packet, as the question it answers, once someone is listed (no busier while empty: critic F3)", () => {
  const links = (root) => all(root).find((e) => e.tagName === "SECTION" && e.dataset.links !== undefined) ?? null;
  assert.equal(links(draw(plan())), null, "no one listed yet: the page keeps to its one way to start");
  assert.equal(links(draw(emptyPlan())), null);
  const p = plan();
  saveContact(p, { id: "c1", role: "emergency", name: "Dee", phone: "555-0100" });
  const card = links(draw(p));
  assert.ok(card, "a More on this card");
  const a = all(card).filter((e) => e.tagName === "A");
  assert.deepEqual(a.map((x) => x.getAttribute("href")), ["#/reports/if-something-happens"]);
  assert.match(textOf(card), /^More on this What would your family need if something happened to you\? One packet to print ›$/);
});

test("one or two suggestions are simply shown: a fold is worth a tap only with three rows or more", () => {
  const p = familyPlan("2026-10-31");
  p.accounts = p.accounts.filter((a) => a.institution === "Chase" || !a.institution);
  p.insurance = { policies: [] };
  const root = draw(p);
  assert.equal(compute(p).suggestions.length, 1);
  assert.equal(details(root).length, 0);
  assert.match(textOf(root), /From your accounts and policies These banks, lenders and insurers come from/);
});

test("S11: adding a firm from the suggestions saves it, says so, and the suggestions stay as they were (open)", () => {
  let p = migrate(structuredClone(plan()));
  const saved = [];
  let root;
  const go = () => { root = new FakeElement("main"); render(root, { ui, fmt: { ...fmt, today: () => "2026-11-13" }, plan: p, route: { group: "household", id: "contacts", rest: [], query: {} }, module: { group: "household", id: "contacts" },
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); p = d; go(); } }, redraw: go }); };
  go();
  const before = details(root).map((e) => [e.dataset.part, e.hasAttribute("open")]);
  assert.deepEqual(before, [["suggestions", true]]);
  const firm = compute(p).suggestions[0].firm;
  all(root).find((e) => e.tagName === "BUTTON" && textOf(e) === `Add ${firm}`).click();
  assert.equal(saved.length, 1);
  assert.equal(p.contacts[0].firm, firm);
  assert.match(textOf(all(root).find((e) => e.className === "notice ok")), new RegExp(`^Added ${firm}\\.`));
  assert.deepEqual(details(root).map((e) => [e.dataset.part, e.hasAttribute("open")]), before, "the part the person was in stays open; nothing else opens or shuts");
});
