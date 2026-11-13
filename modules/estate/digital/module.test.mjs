import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, looksSecret, KINDS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const withItems = (items, change) => { const p = familyPlan("2026-10-30"); p.estate.digital = items; if (change) change(p); return p; };

test("looksSecret: a recovery phrase or a password note, not ordinary notes", () => {
  assert.equal(looksSecret("abandon ability able about above absent absorb abstract absurd abuse access accident"), true);
  assert.equal(looksSecret("pin: 4821"), true); assert.equal(looksSecret("Password = hunter2"), true);
  assert.equal(looksSecret("the recovery codes are in the fire safe"), false); assert.equal(looksSecret("set up emergency access for Bo"), false);
  assert.equal(looksSecret(""), false);
});

test("nothing listed: email and the password manager still to plan", () => {
  const d = compute(emptyPlan());
  assert.equal(d.count, 0); assert.deepEqual(d.missing, ["email", "manager"]);
});

test("planned means a way in: a manager or legacy contact, or written down with someone who knows", () => {
  const d = compute(withItems([
    { id: "1", kind: "email", name: "Mail", access: "legacy", contact: "Bo" },
    { id: "2", kind: "manager", name: "Vault", access: "none" },
    { id: "3", kind: "photos", name: "Photos", access: "written", contact: "Bo" },
    { id: "4", kind: "phone", name: "Phone", access: "written", contact: "", notes: "pin: 4821" },
    { id: "5", kind: "weird", name: "Thing", access: "bogus" },
  ]));
  const by = Object.fromEntries(d.items.map((x) => [x.id, x]));
  assert.equal(by["1"].planned, true); assert.equal(by["2"].planned, false); assert.equal(by["3"].planned, true); assert.equal(by["4"].planned, false);
  assert.equal(by["5"].kind, "other"); assert.equal(by["5"].access, "none");
  assert.equal(by["4"].secret, true); assert.ok(d.warnings[0].startsWith("Phone: the notes look like a password"));
  assert.deepEqual(d.missing, ["manager"]); assert.equal(d.planned, 2);
  assert.ok(KINDS.email.key && KINDS.manager.key && KINDS.crypto.key);
});

test("crypto on Accounts with no recovery plan here", () => {
  const d = compute(withItems([], (p) => p.accounts.push({ id: "c", name: "Coins", type: "crypto", balance: 3000 })));
  assert.equal(d.cryptoHeld, 3000); assert.ok(d.missing.includes("crypto")); assert.ok(d.warnings.some((w) => w.includes("lost for good")));
  const ok = compute(withItems([{ id: "1", kind: "crypto", name: "Wallet", access: "written", contact: "Bo" }], (p) => p.accounts.push({ id: "c", name: "Coins", type: "crypto", balance: 3000 })));
  assert.ok(!ok.missing.includes("crypto"));
});

// ---------------------------------------------------------------- the page (simple first, docs/OPTIONAL.md), drawn on the fake DOM
const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
// the stand-in DOM has no form reset (the add form empties itself after Add)
FakeElement.prototype.reset ??= function () {};
const ui = await import("../../../core/ui/dom.js");
const fmt = await import("../../../core/format.js");
const { migrate } = await import("../../../core/schema/migrate.js");
const { render } = await import("./view.js");
function draw(plan0) {
  const plan = migrate(structuredClone(plan0));
  const root = new FakeElement("main");
  render(root, { ui, fmt: { ...fmt, today: () => "2026-11-13" }, plan, route: { group: "estate", id: "digital", rest: [], query: {} }, module: { group: "estate", id: "digital" }, store: { get: () => plan, update() {} }, redraw() {} });
  return root;
}
const all = (el) => [el, ...el.all()];
/** The words a person sees without opening anything (a shut part or line shows only its summary). */
function seen(el) {
  const walk = (n) => (n.data !== undefined ? n.data : n.hidden ? "" : n.tagName === "DETAILS" && !n.hasAttribute("open") ? walk(n.childNodes.find((c) => c.tagName === "SUMMARY") ?? { data: "" }) : n.tagName === "STYLE" || n.tagName === "OPTION" ? "" : n.childNodes.map(walk).join(" "));
  return walk(el).replace(/\s+/g, " ").trim();
}
const words = (t) => t.split(" ").filter((w) => /[A-Za-z0-9]/.test(w)).length;

test("simple first: three lines of Start here; the rest, what counts as planned and the tips in How this is worked out", () => {
  const root = draw(emptyPlan());
  const t = seen(root);
  assert.match(t, /Start here Put every login in a password manager and turn on its emergency access\. Name a legacy contact on your main email and phone accounts\. Write the phone passcode and where the crypto recovery phrase is kept in your letter of instruction\./);
  assert.ok(!t.includes("List the accounts below"), "the fourth line waits in How this is worked out");
  const how = all(root).find((e) => e.tagName === "DETAILS" && e.dataset.part === "how");
  assert.ok(how && !how.hasAttribute("open"));
  assert.equal(textOf(how.querySelector(".fold-title")), "How this is worked out");
  const inside = textOf(how);
  assert.match(inside, /List the accounts here so the executor knows they exist\./);
  assert.match(inside, /counts as planned when someone could get in/);
  for (const k of Object.values(KINDS).filter((x) => x.tip)) assert.ok(inside.includes(k.tip), k.label);
  // every fold is a part, or the form's own More details (optional)
  assert.deepEqual(all(root).filter((e) => e.tagName === "DETAILS").map((e) => e.dataset.part ?? (/form-more/.test(e.className) ? "form-more" : "by hand")), ["form-more", "how"]);
  // the add form asks four boxes first; the notes wait under More details (optional)
  const form = all(root).find((e) => e.tagName === "FORM");
  const shown = all(form).filter((e) => ["INPUT", "SELECT", "TEXTAREA"].includes(e.tagName) && !e.closest("details"));
  assert.deepEqual(shown.map((e) => e.getAttribute("name")), ["kind", "name", "access", "contact"]);
  assert.ok(words(t) < 191, `${words(t)} words on the empty plan's first view (191 before)`);
});

test("More on this: the deeper pages as questions, with the family packet", () => {
  const card = all(draw(emptyPlan())).find((e) => e.tagName === "SECTION" && e.dataset.links !== undefined);
  assert.deepEqual(all(card).filter((e) => e.tagName === "A").map((x) => x.getAttribute("href")), ["#/estate/documents", "#/estate/beneficiaries", "#/reports/if-something-happens"]);
  assert.match(textOf(card), /What would your family need if something happened to you\? One packet to print/);
});

test("S11: adding an account saves it and says so; How this is worked out stays as it was", () => {
  let p = migrate(emptyPlan());
  const saved = [];
  let root;
  const go = () => { root = new FakeElement("main"); render(root, { ui, fmt: { ...fmt, today: () => "2026-11-13" }, plan: p, route: { group: "estate", id: "digital", rest: [], query: {} }, module: { group: "estate", id: "digital" },
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); p = d; go(); } }, redraw: go }); };
  go();
  const parts = () => all(root).filter((e) => e.tagName === "DETAILS" && e.dataset.part).map((e) => [e.dataset.part, e.hasAttribute("open")]);
  const before = parts();
  const form = all(root).find((e) => e.tagName === "FORM");
  form.querySelector('[name="name"]').value = "Ana's email";
  form.dispatch("submit");
  assert.equal(saved.length, 1);
  assert.equal(p.estate.digital[0].name, "Ana's email");
  assert.match(textOf(root), /Ana's email added\./);
  assert.deepEqual(parts(), before);
});
