import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { recurringPlan, changesPlan } from "../recurring/module.test.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} != ${b}`);

test("empty plan", () => { assert.equal(compute(emptyPlan(), { today: TODAY }).hasData, false); });
test("found subscriptions (by category or by name), typed ones, no double counting, biggest first", () => {
  const p = recurringPlan();   // Netflix (category subscriptions) and Gym Membership (category fun, name says gym) recur monthly
  p.expenses.push({ id: "s1", name: "Spotify", category: "subscriptions", amount: 10.99, period: "monthly" }, { id: "s2", name: "Netflix plan", category: "subscriptions", amount: 15.49, period: "monthly" });
  const d = compute(p, { today: TODAY });
  const names = d.items.map((i) => i.name);
  assert.deepEqual(names, ["Gym Membership", "Netflix", "Spotify"], "the typed Netflix duplicates the found one and is dropped; 49 > 15.49 > 10.99");
  near(d.items[0].yearly, 588); near(d.yearly, 588 + 15.49 * 12 + 10.99 * 12); near(d.monthly, d.yearly / 12);
  assert.equal(d.items.find((i) => i.name === "Spotify").source, "typed");
  assert.equal(d.count, 3);
});

// ---------------------------------------------------------------- gap #6 (2026-11-13): how to ask for a lower price; simple first
const VIEW = new URL("./view.js", import.meta.url);
const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
const isOpen = (d) => (typeof d.open === "boolean" ? d.open : d.hasAttribute("open"));
const partOf = (root, id) => root.all().find((e) => e.tagName === "DETAILS" && e.dataset?.part === id) ?? null;

test("How to ask for a lower price: a reading part (kind how), shut until asked, its title pinned here (R24), six plain steps", async () => {
  const { root } = await renderPage(VIEW, recurringPlan(), TODAY);
  const lower = partOf(root, "lower");
  assert.ok(lower, "drawn");
  assert.equal(lower.dataset.kind, "how");
  assert.equal(lower.querySelector(".fold-title").textContent, "How to ask for a lower price");
  assert.equal(lower.querySelector(".fold-status").textContent, "6 steps");
  assert.equal(isOpen(lower), false, "shut on the first view");
  const t = textOf(lower);
  for (const step of ["Know your price and a rival's", "ask for the department that keeps customers", "Ask what they can do to lower your bill", "Be ready to cancel", "Write down the new price and the day it ends", "Put a reminder for that day on the Money calendar"]) assert.ok(t.includes(step), step);
  assert.ok(t.includes("Nobody calls a company for you from here"), "no company calls for you (K6 is a service, out)");
  assert.ok(lower.all().some((e) => e.tagName === "A" && e.getAttribute("href") === "#/household/calendar"), "the way to the calendar");
});
test("a link that asks for it (?show=lower, from Bills when a bill went up) opens it, also on a page with no subscription", async () => {
  const withSubs = await renderPage(VIEW, recurringPlan(), TODAY, { route: { rest: [], query: { show: "lower" } } });
  assert.equal(isOpen(partOf(withSubs.root, "lower")), true);
  const none = await renderPage(VIEW, emptyPlan(), TODAY, { route: { rest: [], query: { show: "lower" } } });
  assert.equal(isOpen(partOf(none.root, "lower")), true, "the steps are there with no subscription too");
  assert.ok(textOf(none.root).startsWith("Subscriptions Streaming, phone, gym, apps"));
});
test("the page draws no fold by hand: the payees you hid are a part, with Put back", async () => {
  const p = recurringPlan();
  const { compute: rec } = await import("../recurring/compute.js");
  const net = rec(p, { today: TODAY }).detected.find((r) => r.payee === "Netflix");
  p.recurringIgnored = [net.key];
  const { root, saved } = await renderPage(VIEW, p, TODAY);
  for (const d of root.all().filter((e) => e.tagName === "DETAILS")) assert.ok(d.dataset?.part, `a fold drawn by hand: ${textOf(d.children[0])}`);
  const hid = partOf(root, "hidden");
  assert.equal(hid.querySelector(".fold-title").textContent, "Payees you hid");
  assert.equal(hid.querySelector(".fold-status").textContent, "1 payee");
  hid.all().find((e) => e.tagName === "BUTTON" && textOf(e) === "Put back").click();
  assert.deepEqual(saved[0].recurringIgnored, []);
  const next = await renderPage(VIEW, saved[0], TODAY);
  assert.ok(textOf(next.root).includes("Netflix is back on the list."), "said, where the list is");
});

test("S11: after a save only the saved part changes: Not a subscription opens no part; Put back keeps Payees you hid open and the steps as they were", async () => {
  const states = (root) => Object.fromEntries(root.all().filter((e) => e.tagName === "DETAILS" && e.dataset?.part).map((e) => [e.dataset.part, isOpen(e)]));
  const { compute: rec } = await import("../recurring/compute.js");
  const p = recurringPlan();
  p.expenses.push({ id: "s1", name: "Spotify", category: "subscriptions", amount: 10.99, period: "monthly" });   // the list stays drawn
  p.recurringIgnored = [rec(p, { today: TODAY }).detected.find((r) => r.payee === "Netflix").key];
  // a save outside every part: "Not a subscription" on a row of the list; the green line is in the list's card
  const a = await renderPage(VIEW, p, TODAY);
  assert.deepEqual(states(a.root), { lower: false, hidden: false });
  a.root.all().find((e) => e.tagName === "BUTTON" && e.getAttribute("aria-label") === "Gym Membership is not a subscription").click();
  assert.equal(a.saved.length, 1);
  const b = await renderPage(VIEW, a.saved[0], TODAY);
  assert.deepEqual(states(b.root), { lower: false, hidden: false }, "no part opens or shuts");
  assert.ok(!partOf(b.root, "hidden").all().some((e) => /\bnotice\b/.test(e.className ?? "")), "the green line is not in Payees you hid");
  assert.ok(textOf(b.root).includes("Gym Membership taken off this list"));
  // a save inside a part: Put back under Payees you hid (two payees there now) keeps that part open, and the steps shut
  const li = partOf(b.root, "hidden").all().find((e) => e.tagName === "LI" && textOf(e).startsWith("Netflix"));
  li.all().find((e) => e.tagName === "BUTTON" && textOf(e) === "Put back").click();
  assert.deepEqual(b.saved[0].recurringIgnored, [rec(p, { today: TODAY }).detected.find((r) => r.payee === "Gym Membership").key], "Netflix back, the gym still hidden");
  const c = await renderPage(VIEW, b.saved[0], TODAY);
  assert.deepEqual(states(c.root), { lower: false, hidden: true }, "only the part saved in is open");
  assert.ok(textOf(partOf(c.root, "hidden")).includes("Netflix is back on the list."), "its green line is in it");
  // the confirmation is said once: the next draw is the plain page again
  const d = await renderPage(VIEW, b.saved[0], TODAY);
  assert.deepEqual(states(d.root), { lower: false, hidden: false });
});

// ---------------------------------------------------------------- the critic of gap #6 (2026-11-13)
const NOW = "2026-11-13";
const rowOf = (root, name) => root.all().find((e) => e.tagName === "LI" && e.all().some((x) => x.className === "t" && textOf(x).startsWith(name))) ?? null;
test("a subscription that went up says its new price beside the usual one, as Bills and regular payments does (critic F2)", async () => {
  const { root } = await renderPage(VIEW, changesPlan(), NOW);   // Netflix $15.49 four times, then $17.99 in October and November
  const net = textOf(rowOf(root, "Netflix"));
  assert.ok(net.includes("$15.49 every month · now $17.99 · next"), net);
  assert.ok(net.includes("$186 a year"), "the year still counts the usual charge, as the total on both pages does");
  for (const name of ["Gym Co", "Verizon Wireless"]) assert.ok(!textOf(rowOf(root, name)).includes("now $"), `${name} did not go up`);
});
test("with no subscription the page is as short as before: the steps are drawn only when a link asks for them (critic F5)", async () => {
  const none = await renderPage(VIEW, emptyPlan(), TODAY);
  assert.equal(partOf(none.root, "lower"), null, "no row for the steps");
  assert.equal(none.root.all().some((e) => e.dataset && "parts" in e.dataset), false, "no parts card at all");
  assert.ok(textOf(none.root).endsWith("Import a bank file Type them on Expenses"), textOf(none.root));
  const asked = await renderPage(VIEW, emptyPlan(), TODAY, { route: { rest: [], query: { show: "lower" } } });
  assert.equal(isOpen(partOf(asked.root, "lower")), true, "Bills' link still lands on them");
  assert.ok(partOf((await renderPage(VIEW, recurringPlan(), TODAY)).root, "lower"), "with a subscription the steps are one tap away");
});
// Hand-over (compute.js is not in claude-b's files for gap #6): the typed and found copies of one bill are counted once.
const HANDOFF = "hand-over: modules/cashflow/subscriptions/compute.js line 30 (see this README, Ideas)";
const keyOfNet = async (p) => (await import("../recurring/compute.js")).compute(p, { today: NOW }).detected.find((r) => r.payee === "Netflix").key;
test("after Use $17.99 on Bills (the row carries the bill's key), Subscriptions counts Netflix once (critic F1)", { todo: HANDOFF }, async () => {
  const p = changesPlan();
  p.expenses.push({ id: "e-net", name: "Netflix", category: "subscriptions", amount: 17.99, period: "monthly", essential: false, inflates: true, payeeKey: await keyOfNet(p) });
  assert.equal(compute(p, { today: NOW }).items.filter((i) => /netflix/i.test(i.name)).length, 1);
});
test("a bill typed by hand at its new price after a rise, or added with a short name, is counted once (critic F1)", { todo: HANDOFF }, async () => {
  const p = changesPlan();
  p.expenses.push({ id: "e-net", name: "Netflix", category: "subscriptions", amount: 17.99, period: "monthly", essential: false, inflates: true });
  assert.equal(compute(p, { today: NOW }).items.filter((i) => /netflix/i.test(i.name)).length, 1, "by name, at the new price");
  const q = changesPlan();
  q.expenses.push({ id: "e-max", name: "Max", category: "subscriptions", amount: 15.49, period: "monthly", essential: false, inflates: true, payeeKey: await keyOfNet(q) });
  assert.equal(compute(q, { today: NOW }).count, compute(changesPlan(), { today: NOW }).count, "by key, with no word in common");
});
