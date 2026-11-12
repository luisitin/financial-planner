// tests/address.test.mjs -- wave 1 (taps, the touch stress test: j-navigator/N2): an address that names no page says so
// instead of showing the Dashboard under the wrong address (core/address.js missing, fixCase).
import { test } from "node:test";
import assert from "node:assert/strict";
import { missing, fixCase, waitsForComputer } from "../core/address.js";
import { GROUPS } from "../core/groups.js";

const page = (group, id, extra = {}) => ({ group, id, title: id, status: "usable", ...extra });
const MODS = new Map([
  ["cashflow/income", page("cashflow", "income")],
  ["goals/emergency-fund", page("goals", "emergency-fund")],
  ["system/devices", page("system", "devices", { builderOnly: true })],
  ["ai/critic", page("ai", "critic", { requires: "ai" })],
  ["reports/annual", page("reports", "annual", { status: "planned" })],
  ["system/backups", page("system", "backups", { requires: "pc" })],
  ["system/later", page("system", "later", { requires: "pc", status: "planned" })],
]);
const opts = (over = {}) => ({
  modules: MODS, groups: GROUPS, userView: true,
  enabled: () => true, sourceOf: () => "default",
  offered: (m) => m.status !== "planned" && !m.builderOnly && !m.requires,
  ...over,
});
const route = (group, id) => ({ group, id, rest: [], query: {} });

test("a page that is here and offered opens: nothing is missing", () => {
  assert.equal(missing(route("cashflow", "income"), opts()), null);
});
test("a mistyped address names no page; its topic is known when the first part is a topic", () => {
  assert.deepEqual(missing(route("cashflow", "incom"), opts()), { kind: "unknown", group: GROUPS.find((g) => g.id === "cashflow") });
  assert.deepEqual(missing(route("cashfow", "income"), opts()), { kind: "unknown", group: null });
  assert.equal(missing(route("CashFlow", "incom"), opts()).group?.id, "cashflow", "the topic is found whatever the case");
});
test("the same address in the wrong case is the page it names (fixCase), and a right one needs no fixing", () => {
  const has = (k) => MODS.has(k);
  assert.deepEqual(fixCase({ group: "cashflow", id: "Income", rest: [], query: { from: "x" } }, has), { group: "cashflow", id: "income", rest: [], query: { from: "x" } });
  assert.deepEqual(fixCase(route("CASHFLOW", "INCOME"), has), route("cashflow", "income"));
  assert.equal(fixCase(route("cashflow", "income"), has), null);
  assert.equal(fixCase(route("cashflow", "Incom"), has), null, "a typo stays a typo");
});
test("a page switched off on this device: 'off', said to be switched off here (it can be turned back on)", () => {
  const o = opts({ enabled: (m) => m.id !== "emergency-fund", sourceOf: () => "device" });
  assert.deepEqual(missing(route("goals", "emergency-fund"), o), { kind: "off", key: "goals/emergency-fund", by: "device" });
  assert.equal(missing(route("goals", "emergency-fund"), { ...o, sourceOf: () => "default" }).by, "device", "off by default: Settings › Pages turns it on too");
});
test("a page switched off in the computer's settings: 'off', said to be switched off there", () => {
  const o = opts({ enabled: (m) => m.id !== "emergency-fund", sourceOf: () => "properties" });
  assert.deepEqual(missing(route("goals", "emergency-fund"), o), { kind: "off", key: "goals/emergency-fund", by: "properties" });
});
test("the household's view: a page it does not offer in its menu ('soon', a builder's page) still opens by its address (regress-break 6)", () => {
  for (const [g, id] of [["system", "devices"], ["reports", "annual"]]) assert.equal(missing(route(g, id), opts()), null, `${g}/${id}`);
  assert.equal(missing(route("system", "devices"), opts({ enabled: () => false, sourceOf: () => "device" })).kind, "off", "switched off is still said");
  assert.equal(missing(route("system", "nothing-here"), opts()).kind, "unknown", "an address that names no page is not found");
});
test("the build view opens every page by its address, as before", () => {
  for (const [g, id] of [["system", "devices"], ["ai", "critic"], ["reports", "annual"]]) assert.equal(missing(route(g, id), opts({ userView: false })), null, `${g}/${id}`);
});
test("a page that only waits for your computer opens by its address (it says 'Not connected to your computer' itself)", () => {
  // the household's view, the computer not answering: Backups is not offered in the menu (opts().offered), yet its address opens it
  assert.equal(opts().offered(MODS.get("system/backups")), false, "not in the menu while the computer does not answer");
  assert.equal(missing(route("system", "backups"), opts()), null, "the page opens");
  assert.equal(missing(route("system", "later"), opts()), null, "a page not built yet opens as its plain placeholder");
  assert.equal(opts().offered(MODS.get("ai/critic")), false, "a helper's page is not in the menu while the helper does not answer");
  assert.equal(missing(route("ai", "critic"), opts()), null, "but its address opens it (it says the helper is not answering itself; topways new problem 1)");
  assert.equal(missing(route("system", "backups"), opts({ enabled: () => false, sourceOf: () => "device" })).kind, "off", "switched off is still said");
  assert.equal(waitsForComputer({ requires: "pc", status: "usable" }), true);
  assert.equal(waitsForComputer({ requires: "pc", status: "usable", builderOnly: true }), false);
  assert.equal(waitsForComputer({ requires: "ai", status: "usable" }), true);
  assert.equal(waitsForComputer({ requires: "ai", status: "planned" }), false);
  assert.equal(waitsForComputer({ status: "usable" }), false);
  assert.equal(waitsForComputer(null), false);
});
