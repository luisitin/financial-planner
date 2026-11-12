// tests/ways-back.test.mjs -- wave 1 (taps): which page a page opened to fix one thing names as its way back, once, just
// above the one way on at the bottom; at the top the bar's "‹" is the way back (modules/overview/guide/frame.js namedBack;
// findings j-monthly-return/MR-4, j-one-answer/A3).
import { test } from "node:test";
import assert from "node:assert/strict";
import { namedBack, HUBS } from "../modules/overview/guide/frame.js";

test("the address says where the page was sent from (?back=<group/id>): that page, at the link's own address", () => {
  assert.deepEqual(namedBack({ page: "balance/liabilities", query: { back: "debt/payoff" } }), { key: "debt/payoff", href: "#/debt/payoff" });
  assert.deepEqual(namedBack({ page: "balance/net-worth", query: { back: "balance/accounts/a1" } }), { key: "balance/accounts", href: "#/balance/accounts/a1" });
});
test("?back=done (Get started's own), a bad value, the page itself or a page not offered: nothing", () => {
  assert.equal(namedBack({ page: "overview/setup", query: { back: "done" } }), null);
  assert.equal(namedBack({ page: "cashflow/income", query: { back: "<script>" } }), null);
  assert.equal(namedBack({ page: "cashflow/income", query: { back: "javascript:alert(1)/x" } }), null);
  assert.equal(namedBack({ page: "debt/payoff", query: { back: "debt/payoff" } }), null);
  assert.equal(namedBack({ page: "cashflow/income", query: { back: "ai/critic" }, offered: () => false }), null);
});
test("opened from Needs attention or Next best action (not from the menu): that list", () => {
  assert.deepEqual(HUBS, ["overview/alerts", "overview/next-best-action"]);
  for (const hub of HUBS) assert.deepEqual(namedBack({ page: "balance/liquidity", came: { key: hub, menu: false } }), { key: hub, href: `#/${hub}` });
  assert.equal(namedBack({ page: "balance/liquidity", came: { key: "overview/alerts", menu: true } }), null, "picked in the menu: the bar's ‹ only");
  assert.equal(namedBack({ page: "balance/liquidity", came: { key: "overview/dashboard", menu: false } }), null, "any other page: the bar's ‹ only");
  assert.equal(namedBack({ page: "overview/alerts", came: { key: "overview/alerts", menu: false } }), null, "never back to the page on screen");
  assert.equal(namedBack({ page: "balance/liquidity", came: { key: "overview/alerts", menu: false }, offered: () => false }), null);
});
test("the address wins over the history", () => {
  assert.equal(namedBack({ page: "household/people", query: { back: "retirement/projection" }, came: { key: "overview/alerts" } }).key, "retirement/projection");
});
