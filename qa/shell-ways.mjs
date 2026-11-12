// qa/shell-ways.mjs -- there is a way back on screen, and an address that names no page says so. Real touches, sandbox:
//   no "‹" on the first page of a visit; the Dashboard's tile -> "‹" named "Back to Dashboard"; a double tap on it goes
//   back one page; a Needs attention row -> "‹ Back to Needs attention" once, at the bottom (the bar's "‹" is the top's),
//   going Back (history not grown); a mistyped address -> "Page not found" with the topic's pages; the wrong case opens the page.
//   The "‹" needs the router's entry numbers (core/router.js entry()); without them those two checks say so and fail.
//   node qa/shell-ways.mjs [base URL]
import { run, say, done, sleep, settle, tap, family, shell } from "./shell-lib.mjs";
await run("the bar's ‹", family(), "overview/dashboard", async (p) => {
  const a0 = await shell(p);
  await tap(p, p.locator("#content a.stat-link").filter({ hasText: /Net worth/ }).first()); const a = await shell(p);
  say("the bar's ‹", a0.back === null && a.back === "Back to Dashboard", `first page: ‹ ${a0.back === null ? "not there" : `"${a0.back}"`}; Net worth tile -> ‹ "${a.back}"`);
  const b = await p.locator("#nav-back").boundingBox();
  if (!b || !a.back) { say("a double tap on ‹", false, "no ‹ to tap"); return; }
  await p.touchscreen.tap(b.x + 22, b.y + 22); await sleep(300); await p.touchscreen.tap(b.x + 22, b.y + 22); await sleep(1200); await settle(p);
  const c = await shell(p);
  say("a double tap on ‹", c.hash === "#/overview/dashboard" && c.back === null, `two taps 300 ms apart -> ${c.hash}, ‹ ${c.back === null ? "hidden" : `"${c.back}"`}`);
});
await run("Needs attention names the way back", family(), "overview/alerts", async (p) => {
  await tap(p, p.locator("#content .page-list > li[role=button], #content .page-list a").first(), 1200);
  const a = await shell(p); const top = a.ways.filter((t) => t === "‹ Back to Needs attention").length;
  const foot = p.locator("#content .gb-foot-back a");
  let b = null; if (await foot.count()) { await tap(p, foot.first(), 1200); b = await shell(p); }
  say("Needs attention names the way back", top === 1 && a.back === "Back to Needs attention" && b?.hash === "#/overview/alerts" && b.len === a.len, `-> ${a.hash}: "‹ Back to Needs attention" ${top} time(s) (the bottom one only); bar ‹ "${a.back}"; the bottom one -> ${b?.hash}, history ${a.len} -> ${b?.len}`);
});
await run("a mistyped address", family(), "overview/dashboard", async (p) => {
  await p.evaluate(() => { location.hash = "#/cashflow/incom"; }); await sleep(900); await settle(p);
  const r = await p.evaluate(() => ({ h1: document.querySelector("#content h1")?.textContent, rows: document.querySelectorAll("#content .page-list a").length, bar: document.getElementById("page-title").textContent, btns: [...document.querySelectorAll("#content section.card button, #content section.card a.btn")].map((b) => b.textContent.trim()) }));
  say("a mistyped address", r.h1 === "Page not found" && r.rows > 0 && r.bar === "Page not found" && r.btns.includes("Find a page") && r.btns.includes("Go to the Dashboard"), `#/cashflow/incom -> "${r.h1}", ${r.rows} pages about the topic, bar "${r.bar}", buttons ${JSON.stringify(r.btns)}`);
});
await run("the wrong case", family(), "overview/dashboard", async (p) => {
  await p.evaluate(() => { location.hash = "#/cashflow/Income"; }); await sleep(900); await settle(p); const s = await shell(p);
  say("the wrong case", s.hash === "#/cashflow/income" && s.title === "Income", `#/cashflow/Income -> ${s.hash} "${s.title}"`);
});
done("shell-ways: a way back on screen; an address that names no page says so");
