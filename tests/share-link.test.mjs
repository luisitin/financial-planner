// tests/share-link.test.mjs -- core/share-link.js: a calculator's link carries only the page's own figures, reads back
// exactly, refuses anything else, and makes no request (gap list, next 60, item 33). The three pages' own round trips are
// in their module.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  defineShare, sharedFigures, shareText, readShare, withShared, restOf, planWith, getAt, shareHref, shareLink, copyText, sendLink, reachOf,
  filledWords, restWords, sentWords, keepAsk, namesOf, BANNER, SHARE_LINE, UNREAD, OWN_AGAIN, BACK_WORDS, ALREADY, VISIT_TAIL, NO_LINK,
  REST_MINE, REST_DIFFERS, REACH, MAX_TEXT, MAX_PAIRS,
} from "../core/share-link.js";
import { parse } from "../core/router.js";

const SPEC = defineShare({ page: "goals/house", path: ["whatIfs", "house"], stays: ["saved"], fields: [
  { key: "price", as: "price", unit: "money", min: 0, max: 1e8, name: "the price" },
  { key: "rate", as: "rate", unit: "percent", min: 0, max: 1, name: "the rate" },
  { key: "insuranceRate", as: "insurance", unit: "percent", min: 0, max: 1, name: "the insurance" },
  { key: "termYears", as: "term", unit: "whole", min: 5, max: 40, name: "the length" },
] });
const TEN_DIGITS = "4" + "0".repeat(9);   // a price of four billion, written without a long run of digits in this file

test("the round trip of each kind of figure is exact: money to the cent, a percent as typed, a whole number", () => {
  const saved = { price: 420000.5, rate: 0.0625, insuranceRate: 0.0035, termYears: 30 };
  assert.equal(shareText(SPEC, saved), "price:420000.5,rate:6.25,insurance:0.35,term:30");
  const r = readShare(SPEC, shareText(SPEC, saved));
  assert.deepEqual(r, { figures: saved, used: 4, refused: 0 });
  // the shares a percent box can hold come back as the very same number
  for (const v of [0, 0.001, 0.0035, 0.012, 0.0465, 0.065, 0.06875, 0.1, 0.2, 0.33, 0.999, 1]) {
    assert.equal(readShare(SPEC, shareText(SPEC, { rate: v })).figures.rate, v, `rate ${v}`);
  }
  for (const v of [0, 1, 99.99, 250000, 1234567.89, 1e8]) assert.equal(readShare(SPEC, shareText(SPEC, { price: v })).figures.price, v, `price ${v}`);
  assert.equal(shareText(SPEC, { price: 420000.456 }), "price:420000.46", "money is kept to the cent");
});

test("only typed, finite, in-range figures of the page's own list travel, in the list's order", () => {
  const saved = { termYears: 30, rate: null, price: "", insuranceRate: Number.NaN, name: "Ana", balance: 52000, saved: 30000, notes: "pay day" };
  assert.equal(shareText(SPEC, saved), "term:30");
  assert.equal(shareText(SPEC, { price: true, rate: "0.065", termYears: 30.5 }), "rate:6.5", "a figure stored as text is read as the plan reads it; a whole number with a part is not carried");
  assert.equal(shareText(SPEC, { price: -5, rate: 1.5, termYears: 41 }), "", "out of range: not carried");
  assert.equal(shareText(SPEC, null), "");
  assert.equal(shareText(SPEC, { price: { x: 1 }, rate: [0.05] }), "", "objects and lists are never figures");
  assert.deepEqual(sharedFigures(SPEC, { rate: 0.065, price: 300000 }).map((x) => x.as), ["price", "rate"]);
  // inherited keys are not the page's own figures
  assert.equal(shareText(SPEC, Object.create({ price: 100000 })), "");
});

test("a name that is not the page's own is refused and counted, and reading it touches no prototype", () => {
  const r = readShare(SPEC, "price:300000,evil:1,__proto__:5,constructor:1,toString:2,hasOwnProperty:3,prototype:4,PRICE:9,name:7");
  assert.deepEqual(r.figures, { price: 300000 });
  assert.equal(r.used, 1);
  assert.equal(r.refused, 8);
  assert.equal(Object.getPrototypeOf(r.figures), Object.prototype);
  assert.equal(({}).polluted, undefined);
  assert.equal(readShare(SPEC, "price:1,polluted:1").figures.polluted, undefined);
  // a figure the plan holds under its own key is refused by that key: only the short names travel
  assert.equal(readShare(SPEC, "termYears:30").refused, 1);
});

test("a value that is not plain digits with an optional point is refused", () => {
  for (const bad of ["-5", "+5", "1e3", "0x10", "Infinity", "NaN", "5,000", " 5", "5 ", "5.", ".5", "1.2.3", "<b>", "%3C", "5%", "$5", "1_000", "٣", "07", "0500", "00", "00.5"]) {
    const r = readShare(SPEC, `price:${bad}`);
    assert.equal(r.used, 0, JSON.stringify(bad));
    assert.ok(r.refused >= 1, JSON.stringify(bad));
  }
  assert.equal(readShare(SPEC, "price").refused, 1, "no colon");
  assert.deepEqual(readShare(SPEC, "price:5,000,rate:6.5"), { figures: {}, used: 0, refused: 3 }, "a figure written with a comma: none of the link is used (not a $5 home)");
  assert.equal(readShare(SPEC, "price:1:2").refused, 1, "two colons");
  assert.equal(readShare(SPEC, "rate:6.1234567").refused, 1, "a percent with seven decimals");
  assert.equal(readShare(SPEC, "price:10.123").refused, 1, "money with three decimals");
  assert.equal(readShare(SPEC, "term:30.0").refused, 1, "a whole number with a point");
  // a leading zero is not how the app writes a figure (critic F3: "term:07" was read as 7); a plain 0 and 0.x are fine
  assert.deepEqual(readShare(SPEC, "term:07,price:0,rate:0.5"), { figures: { price: 0, rate: 0.005 }, used: 2, refused: 1 });
  assert.equal(readShare(SPEC, "price:10").figures.price, 10);
  // "name:" with nothing after the colon is a box emptied on purpose: blank, neither filled nor refused
  assert.deepEqual(readShare(SPEC, "price:300000,rate:"), { figures: { price: 300000, rate: null }, used: 1, refused: 0 });
  assert.deepEqual(readShare(SPEC, "rate:,rate:6"), { figures: { rate: null }, used: 0, refused: 1 }, "an emptied box counts as its name's one turn");
  assert.deepEqual(readShare(SPEC, "evil:"), { figures: {}, used: 0, refused: 1 }, "an unknown name with no figure is still refused");
});

test("a link is one text: a list or an object (not what the router gives) is refused whole, never joined (critic F3)", () => {
  assert.deepEqual(readShare(SPEC, ["price:1", "rate:6"]), { figures: {}, used: 0, refused: 1 });
  assert.deepEqual(readShare(SPEC, { price: 1 }), { figures: {}, used: 0, refused: 1 });
  assert.deepEqual(readShare(SPEC, 5), { figures: {}, used: 0, refused: 1 });
  // the router itself keeps the last of a name given twice in the address: one text
  const r = parse("#/goals/house?share=price:1&share=rate:6");
  assert.equal(typeof r.query.share, "string");
  assert.deepEqual(readShare(SPEC, r.query.share).figures, { rate: 0.06 });
});

test("a figure outside the page's own range is refused", () => {
  assert.equal(readShare(SPEC, `price:${TEN_DIGITS}`).refused, 1, "a ten-digit price");
  assert.equal(readShare(SPEC, `price:1${"0".repeat(7)}1`).refused, 1, "over 100 million");
  assert.equal(readShare(SPEC, "rate:101").refused, 1);
  assert.equal(readShare(SPEC, "rate:100").figures.rate, 1);
  assert.equal(readShare(SPEC, "term:4").refused, 1);
  assert.equal(readShare(SPEC, "term:41").refused, 1);
  assert.equal(readShare(SPEC, "term:5").figures.termYears, 5);
  const low = defineShare({ page: "debt/refinance", path: ["debtPlan", "refinance"], fields: [{ key: "rate", as: "rate", unit: "percent", min: 0, max: 0.3 }] });
  assert.equal(readShare(low, "rate:30.5").refused, 1, "a page's own top (Refinance's rate stops at 30%, as its box does)");
  assert.equal(readShare(low, "rate:30").figures.rate, 0.3);
});

test("a name twice: the first counts; a long text is refused whole; pairs past the cap are refused; stray commas are nothing", () => {
  assert.deepEqual(readShare(SPEC, "price:1,price:2"), { figures: { price: 1 }, used: 1, refused: 1 });
  assert.deepEqual(readShare(SPEC, "price:x,price:2"), { figures: { price: 2 }, used: 1, refused: 1 }, "a refused first does not block a good second");
  const long = "price:1," + "x".repeat(MAX_TEXT);
  assert.deepEqual(readShare(SPEC, long), { figures: {}, used: 0, refused: 1 });
  const many = Array.from({ length: MAX_PAIRS + 6 }, () => "zz:1").join(",");
  assert.equal(readShare(SPEC, many).refused, MAX_PAIRS + 6);
  assert.deepEqual(readShare(SPEC, ",price:1,,"), { figures: { price: 1 }, used: 1, refused: 0 });
  assert.equal(readShare(SPEC, undefined), null, "no link");
  assert.equal(readShare(SPEC, null), null);
  assert.deepEqual(readShare(SPEC, ""), { figures: {}, used: 0, refused: 0 });
});

test("withShared and planWith never change what they are given; the link's keys are the link's, every other key stays this phone's own", () => {
  const plan = { meta: { currency: "USD" }, household: { people: [{ name: "Ana" }] }, whatIfs: { house: { price: 1, rate: 0.07, saved: 30000, monthly: 900 }, other: { a: 1 } } };
  const before = JSON.stringify(plan);
  const merged = withShared(plan.whatIfs.house, { price: 420000, termYears: 15 }, SPEC);
  // critic F1: the visitor's own 7% rate is not blanked by a link that did not carry a rate
  assert.deepEqual(merged, { price: 420000, rate: 0.07, saved: 30000, monthly: 900, termYears: 15 });
  assert.deepEqual(withShared(plan.whatIfs.house, { rate: null }, SPEC), { price: 1, rate: null, saved: 30000, monthly: 900 }, "a box emptied on purpose is emptied");
  assert.deepEqual(withShared(plan.whatIfs.house, { price: 2, evil: 1, saved: 5 }, SPEC), { price: 2, rate: 0.07, saved: 30000, monthly: 900 }, "only the page's listed keys move");
  const view = planWith(plan, SPEC, merged);
  assert.equal(JSON.stringify(plan), before, "nothing changed");
  assert.equal(view.whatIfs.house, merged);
  assert.equal(view.whatIfs.other, plan.whatIfs.other);
  assert.equal(view.household, plan.household);
  assert.equal(planWith(plan, SPEC, null), plan, "no link: the plan itself");
  assert.equal(getAt(plan, SPEC), plan.whatIfs.house);
  assert.equal(getAt({}, SPEC), undefined);
  assert.deepEqual(planWith({ meta: {} }, SPEC, { price: 1 }), { meta: {}, whatIfs: { house: { price: 1 } } }, "the objects on the way are made");
  assert.deepEqual(withShared(undefined, { price: 5 }, SPEC), { price: 5 });
  assert.deepEqual(withShared(undefined, {}, SPEC), {});
});

test("restOf: the boxes a link left to this phone, its own figures or our guesses (critic F2)", () => {
  const own = { price: 1, rate: 0.07, saved: 30000, insuranceRate: null, termYears: "" };
  assert.deepEqual(restOf(SPEC, own, { price: 420000 }), { mine: 2, guess: 2 }, "the rate and the savings are this phone's own; insurance and length are guesses");
  assert.deepEqual(restOf(SPEC, own, { price: 420000, rate: null }), { mine: 1, guess: 3 }, "a rate emptied on purpose is a guess, not the 7%");
  assert.deepEqual(restOf(SPEC, {}, { price: 420000 }), { mine: 0, guess: 3 });
  assert.deepEqual(restOf(SPEC, undefined, { price: 1, rate: 0.05, insuranceRate: 0.01, termYears: 30 }), { mine: 0, guess: 0 });
  assert.deepEqual(restOf(SPEC, { saved: 0 }, { price: 1, rate: 0.05, insuranceRate: 0.01, termYears: 30 }), { mine: 1, guess: 0 }, "$0 saved is a figure of the household's own");
  const tax = defineShare({ page: "property/rent-vs-buy", path: ["whatIfs", "r"], stays: ["itemize"], fields: [{ key: "price", as: "price", unit: "money", min: 0, max: 1 }] });
  assert.deepEqual(restOf(tax, { itemize: true }, { price: 1 }), { mine: 1, guess: 0 });
  assert.deepEqual(restOf(tax, { itemize: false }, { price: 1 }), { mine: 0, guess: 0 }, "not itemizing is the page's own default, said by nobody");
});

test("the page's address keeps its other keys; the link to send holds the page and the figures only", () => {
  assert.equal(shareHref("goals/house", { guide: "plan", step: "home", share: "old:1" }, "price:1"), "#/goals/house?guide=plan&step=home&share=price:1");
  assert.equal(shareHref("goals/house", { share: "price:1", from: "plan" }, ""), "#/goals/house?from=plan");
  assert.equal(shareHref("goals/house", {}, ""), "#/goals/house");
  assert.equal(shareLink("https://example.org/planner/?sandbox=1#/goals/house?x=1", "goals/house", "price:1"), "https://example.org/planner/#/goals/house?share=price:1");
  assert.equal(shareLink("", "debt/refinance", "rate:5.5"), "#/debt/refinance?share=rate:5.5");
  // the app's own router reads it back as the page and one query key
  const r = parse(new URL(shareLink("https://example.org/p/", "goals/house", "price:420000,rate:6.25")).hash);
  assert.deepEqual([r.group, r.id, Object.keys(r.query), r.query.share], ["goals", "house", ["share"], "price:420000,rate:6.25"]);
  // a message app that writes the colon and comma in percent form: the router decodes them, the figures are the same
  const enc = parse("#/goals/house?share=price%3A420000%2Crate%3A6.25");
  assert.deepEqual(readShare(SPEC, enc.query.share).figures, { price: 420000, rate: 0.0625 });
});

test("copyText: true when the clipboard takes it, false with none or when it refuses", async () => {
  let got = null;
  assert.equal(await copyText("x", { clipboard: { writeText: async (t) => { got = t; } } }), true);
  assert.equal(got, "x");
  assert.equal(await copyText("x", {}), false);
  assert.equal(await copyText("x", null), false);
  assert.equal(await copyText("x", { clipboard: { writeText: async () => { throw new Error("not allowed"); } } }), false);
});

test("sendLink: the phone's share menu first, else the clipboard, else the older copy, else by hand (critic P3)", async () => {
  const shared = [];
  const menu = { share: async (d) => { shared.push(d); }, canShare: () => true, clipboard: { writeText: async () => { throw new Error("unused"); } } };
  assert.equal(await sendLink("https://example.org/#/goals/house?share=price:1", menu, null), "shared");
  assert.deepEqual(shared, [{ url: "https://example.org/#/goals/house?share=price:1" }], "the link and nothing else goes to the menu");
  // the person closes the menu: the link is copied instead
  let copied = null;
  const closed = { share: async () => { const e = new Error("closed"); e.name = "AbortError"; throw e; }, clipboard: { writeText: async (t) => { copied = t; } } };
  assert.equal(await sendLink("L", closed, null), "copied");
  assert.equal(copied, "L");
  assert.equal(await sendLink("L", { share: async () => {}, canShare: () => false, clipboard: { writeText: async () => {} } }, null), "copied", "a menu that cannot take it is skipped");
  // no clipboard (an http address on the home network): the older copy from a hidden box
  const made = [];
  const doc = { body: { append: (t) => made.push(t) }, createElement: () => ({ style: {}, value: "", select() { this.picked = true; }, remove() { this.gone = true; } }), execCommand: (c) => c === "copy" };
  assert.equal(await sendLink("L", {}, doc), "copied");
  assert.equal(made[0].value, "L"); assert.ok(made[0].picked && made[0].gone, "selected, copied and taken away");
  assert.equal(await sendLink("L", {}, { ...doc, execCommand: () => false }), "hand");
  assert.equal(await sendLink("L", undefined, undefined), "hand", "a test with no phone");
});

test("reachOf: where a link to this address opens (critic P2: never \"any phone\" for one only this device or the home network opens)", () => {
  const home = (...o) => `http://${o.join(".")}:8787/#/goals/house`;
  assert.equal(reachOf("https://example.github.io/planner/#/goals/house"), "");
  assert.equal(reachOf("http://127.0.0.1:9702/#/goals/house"), "here");
  assert.equal(reachOf("http://localhost:8787/"), "here");
  assert.equal(reachOf("http://[::1]:8787/"), "here");
  assert.equal(reachOf("file:///C:/planner/dist/planner.html#/goals/house"), "here");
  assert.equal(reachOf(home("192", "168", "1", "20")), "home");
  assert.equal(reachOf(home("10", "0", "0", "5")), "home");
  assert.equal(reachOf(home("172", "20", "1", "1")), "home");
  assert.equal(reachOf(home("172", "40", "1", "1")), "", "outside the private block");
  assert.equal(reachOf(home("100", "100", "1", "1")), "home", "a tailnet's own block");
  assert.equal(reachOf("http://homepc:8787/"), "home");
  assert.equal(reachOf("http://homepc.local:8787/"), "home");
  assert.equal(reachOf(""), "");
  assert.equal(reachOf("#/goals/house"), "");
});

test("the words, one sentence per case", () => {
  assert.equal(BANNER, "Figures from a shared link: nothing in your plan has changed.");
  // critic P4: short, before the tap; the rest is said after it
  assert.equal(SHARE_LINE, "Only these figures go in the link; nothing is sent until you send it.");
  assert.equal(filledWords(9), "The link filled in 9 figures on this page.");
  assert.equal(filledWords(1), "The link filled in 1 figure on this page.");
  assert.equal(filledWords(7, 2), "The link filled in 7 figures on this page; 2 could not be read and were left out.");
  assert.equal(filledWords(3, 1), "The link filled in 3 figures on this page; 1 could not be read and was left out.");
  // critic F2, P1: whose the other boxes are, under the banner
  assert.equal(restWords({ mine: 0, guess: 0 }), "");
  assert.equal(restWords(null), "");
  assert.equal(restWords({ mine: 0, guess: 3 }), "The rest are our guesses for you.");
  assert.equal(restWords({ mine: 2, guess: 0 }), "The rest are your own figures.");
  assert.equal(REST_MINE, "The rest are your own figures.");
  assert.equal(restWords({ mine: 2, guess: 3 }), "The rest are your own figures and our guesses.");
  assert.equal(restWords({ mine: 0, guess: 1 }, { none: "Anything it left out starts as on a new offer." }), "Anything it left out starts as on a new offer.");
  assert.equal(restWords({ mine: 1, guess: 1 }, { mixed: "The rest are your own figures, or start as on a new offer." }), "The rest are your own figures, or start as on a new offer.");
  assert.deepEqual(SPEC.rest, { none: "The rest are our guesses for you.", mixed: "The rest are your own figures and our guesses." });
  // critic P1, P2, P3, F3: after the tap, which figures, that the other phone fills in the rest, where it opens
  const f = SPEC.fields;
  assert.equal(namesOf([f[0]]), "the price");
  assert.equal(namesOf([f[0], f[1]]), "the price and the rate");
  assert.equal(namesOf(f.slice(0, 3)), "the price, the rate and the insurance");
  assert.equal(sentWords({ how: "copied", figs: [f[0], f[1]], differs: true, reach: "here" }),
    "Link copied: paste it into a message. It carries the price and the rate, nothing else. The other phone fills in the rest with its own figures, so its answer can differ. It opens only on this device.");
  assert.equal(sentWords({ how: "hand", figs: f, reach: "home" }),
    "Copy this link and paste it into a message. It carries the price, the rate and 2 more figures, nothing else. It opens only on phones on your home network.");
  assert.equal(sentWords({ how: "shared", figs: [f[1]], left: [f[0]], note: "The other phone compares the offer with its own mortgage.", differs: true }),
    "Shared. It carries the rate, nothing else. The price could not go in the link. The other phone compares the offer with its own mortgage. The other phone fills in the rest with its own figures, so its answer can differ.");
  assert.equal(sentWords({ how: "copied", figs: f.slice(0, 3), left: [f[3]] }), "Link copied: paste it into a message. It carries the price, the rate and the insurance, nothing else. The length could not go in the link.");
  assert.equal(REST_DIFFERS, "The other phone fills in the rest with its own figures, so its answer can differ.");
  assert.deepEqual(REACH, { here: "It opens only on this device.", home: "It opens only on phones on your home network." });
  // critic F1: Keep names the figures and says the others stay
  assert.equal(keepAsk(SPEC, readShare(SPEC, "price:1,rate:6")), "Keep the price and the rate in your plan? They take the place of yours on this page; your other figures stay as they are. Undo puts yours back.");
  assert.equal(keepAsk(SPEC, readShare(SPEC, "price:1")), "Keep the price in your plan? It takes the place of yours on this page; your other figures stay as they are. Undo puts yours back.");
  assert.equal(keepAsk(SPEC, readShare(SPEC, "price:1,rate:6,insurance:1,term:30")), "Keep these 4 figures in your plan? They take the place of yours on this page; your other figures stay as they are. Undo puts yours back.", "the savings stay");
  const all = defineShare({ page: "debt/refinance", path: ["d", "r"], fields: [{ key: "rate", as: "rate", unit: "percent", min: 0, max: 1, name: "the offered rate" }] });
  assert.equal(keepAsk(all, readShare(all, "rate:5")), "Keep the offered rate in your plan? It takes the place of yours on this page. Undo puts yours back.", "nothing else on the page: nothing to say stays");
  assert.equal(NO_LINK, "A shared link cannot hold this figure.");
  assert.equal(UNREAD, "This link's figures could not be read, so the page shows your own.");
  assert.equal(OWN_AGAIN, "Your own figures again. Nothing from the link was kept.");
  assert.equal(BACK_WORDS, "Back to your own figures, as before.");
  assert.equal(ALREADY, "Your plan already has these figures.");
  assert.equal(VISIT_TAIL, "Nothing in your plan has changed.");
});

test("a page's list is checked when it is made: a name twice, a bad unit or range is a builder's slip", () => {
  const f = (fields, page = "goals/house") => () => defineShare({ page, path: ["whatIfs", "x"], fields });
  assert.throws(f([{ key: "a", as: "a", unit: "money", min: 0, max: 1 }, { key: "b", as: "a", unit: "money", min: 0, max: 1 }]));
  assert.throws(f([{ key: "a", as: "a", unit: "money", min: 0, max: 1 }, { key: "a", as: "b", unit: "money", min: 0, max: 1 }]));
  assert.throws(f([{ key: "a", as: "a", unit: "text", min: 0, max: 1 }]));
  assert.throws(f([{ key: "a", as: "a", unit: "money", min: -1, max: 1 }]));
  assert.throws(f([{ key: "a", as: "A", unit: "money", min: 0, max: 1 }]));
  assert.throws(f([]));
  assert.throws(f([{ key: "a", as: "a", unit: "money", min: 0, max: 1 }], "bad page"));
  assert.throws(f([{ key: "a", as: "a", unit: "money", min: 0, max: 1, name: "" }]), "an empty name");
  assert.throws(() => defineShare({ page: "goals/house", path: ["w", "x"], stays: ["a"], fields: [{ key: "a", as: "a", unit: "money", min: 0, max: 1 }] }), "a key both carried and staying");
  assert.equal(defineShare({ page: "goals/house", path: ["w", "x"], fields: [{ key: "a", as: "a", unit: "money", min: 0, max: 1 }] }).fields[0].name, "the a", "a name by default");
  assert.ok(Object.isFrozen(SPEC) && Object.isFrozen(SPEC.fields) && Object.isFrozen(SPEC.fields[0]) && Object.isFrozen(SPEC.path));
});

test("the helper makes no request and stores nothing: no network call, no storage, no timer, no import", () => {
  const src = fs.readFileSync(new URL("../core/share-link.js", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).map((l) => l.replace(/(^|\s)\/\/\s.*$/, "")).join("\n");
  for (const w of ["fetch", "XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource", "localStorage", "sessionStorage", "indexedDB", "document.cookie", "setTimeout", "setInterval", "postMessage", "import("])
    assert.ok(!code.includes(w), `core/share-link.js uses ${w}`);
  assert.ok(!/^\s*import\s/m.test(code), "it imports nothing");
});
