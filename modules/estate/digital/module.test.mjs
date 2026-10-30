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
