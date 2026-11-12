// B15. An address that names no page says so. A mistyped address: "Page not found", the pages of that topic, a filled "Find a
// page" (opens the menu's search) and an outlined "Go to the Dashboard"; the bar says "Page not found". The wrong case opens
// the page. Pages the household's view does not offer are not found too. A page switched off in Settings › Pages: "<Page>
// is switched off", the reason, "Turn it back on" (then the page opens with "<Page> is on again.") and "Go to the
// Dashboard". (Switched off in the computer's settings: node test tests/address.test.mjs; the stack's server has none.)
// usage: node B15.mjs <base> <root>
import { run, say, done, sleep, settle, tapEl, shell } from "./_lib.mjs";
const go = async (p, h) => { await p.evaluate((h) => { location.hash = h; }, h); await sleep(900); await settle(p); };
const card = (p) => p.evaluate(() => {
  const c = document.querySelector("#content section.card");
  const btns = [...(c?.querySelectorAll("button, a.btn") ?? [])].map((b) => ({ t: b.textContent.trim(), filled: !b.classList.contains("secondary") }));
  return { h1: c?.querySelector("h1")?.textContent ?? null, text: c?.innerText.replace(/\s+/g, " ").trim().slice(0, 220) ?? "", rows: [...(c?.querySelectorAll(".page-list a") ?? [])].map((a) => (a.querySelector(".t") ?? a).textContent.trim()), btns,
    bar: document.getElementById("page-title").textContent, doc: document.title, hash: location.hash };
});
await run("a typo", "family", "overview/dashboard", async (p) => {
  await go(p, "#/cashflow/incom"); const c = await card(p);
  const find = c.btns.find((b) => b.t === "Find a page"), dash = c.btns.find((b) => b.t === "Go to the Dashboard");
  say("a typo", c.h1 === "Page not found" && c.rows.length > 0 && c.rows.includes("Income") && find?.filled && dash && !dash.filled && c.bar === "Page not found" && /Page not found/.test(c.doc),
    `#/cashflow/incom -> "${c.h1}"; ${c.rows.length} pages about the topic (${c.rows.slice(0, 4).join(", ")}...); buttons ${JSON.stringify(c.btns)}; bar "${c.bar}"; tab "${c.doc}"`);
  // "Find a page" opens the menu with the search box ready
  await tapEl(p, p.locator("#content button").filter({ hasText: "Find a page" }));
  const s = await p.evaluate(() => ({ open: document.getElementById("sidebar").classList.contains("open"), focus: document.activeElement?.className }));
  say("Find a page", s.open && /nav-search/.test(s.focus), `tapped -> menu ${s.open ? "open" : "CLOSED"}, focus on ${s.focus}`);
});
await run("a topic's address", "family", "overview/dashboard", async (p) => {
  await go(p, "#/cashflow"); const c = await card(p);
  say("a topic's address", c.h1 === "Page not found" && c.rows.includes("Income"), `#/cashflow -> "${c.h1}" with ${c.rows.length} pages about the topic`);
});
await run("the wrong case", "family", "overview/dashboard", async (p) => {
  const len0 = await p.evaluate(() => history.length);
  await go(p, "#/cashflow/Income"); const s = await shell(p); const len1 = await p.evaluate(() => history.length);
  say("the wrong case", s.hash === "#/cashflow/income" && s.title === "Income", `#/cashflow/Income -> ${s.hash} "${s.title}" (history ${len0} -> ${len1})`);
});
for (const h of ["#/system/devices", "#/ai/critic"]) {
  await run(`not offered: ${h}`, "family", "overview/dashboard", async (p) => {
    await go(p, h); const c = await card(p);
    say(`not offered: ${h}`, c.h1 === "Page not found" && c.bar === "Page not found", `in the household's view ${h} -> "${c.h1}"; bar "${c.bar}"`);
  });
}
await run("switched off", "family", "overview/dashboard", async (p) => {
  // set-up: switch Income off as Settings › Pages does (this device's choice), then come back to the app
  await p.evaluate(() => localStorage.setItem("planner.features", JSON.stringify({ "cashflow/income": false }))); await p.reload(); await sleep(1200); await settle(p);
  const inMenu = await p.evaluate(() => [...document.querySelectorAll("#sidebar .nav-link")].some((a) => a.getAttribute("href") === "#/cashflow/income"));
  await go(p, "#/cashflow/income"); const c = await card(p);
  const on = c.btns.find((b) => b.t === "Turn it back on"), dash = c.btns.find((b) => b.t === "Go to the Dashboard");
  say("switched off", c.h1 === "Income is switched off" && /Settings › Pages, so it is not in the menu/.test(c.text) && on?.filled && dash && !dash.filled && !inMenu,
    `in the menu: ${inMenu ? "YES" : "no"}; #/cashflow/income -> "${c.h1}" "${c.text.slice(c.h1?.length ?? 0, 120)}"; buttons ${JSON.stringify(c.btns)}`);
  await p.evaluate(() => { window.__said = []; new MutationObserver(() => { const t = document.getElementById("announce")?.textContent.trim(); if (t) window.__said.push(t); }).observe(document.getElementById("announce"), { childList: true, characterData: true, subtree: true }); });
  await tapEl(p, p.locator("#content button").filter({ hasText: "Turn it back on" }), 1500);
  const a = await p.evaluate(() => ({ h1: document.querySelector("#content h1, #content h2")?.textContent, ok: [...document.querySelectorAll("#content .notice.ok")].map((n) => n.textContent.trim()), said: [...new Set(window.__said)], hash: location.hash, off: JSON.parse(localStorage.getItem("planner.features") || "{}")["cashflow/income"] }));
  say("Turn it back on", a.ok.some((t) => /Income is on again\./.test(t)) && a.hash === "#/cashflow/income" && a.off === true && a.said.length === 1, `-> ${a.hash} green ${JSON.stringify(a.ok)}; read out ${JSON.stringify(a.said)}; saved switch ${a.off}`);
});
done("B15 an address that names no page says so");
