// B12. A page change puts me at the top of the new page, and things are said once. After a page change the next Tab is the
// page's first control and a screen reader is at the page, named (unless the page put the focus on its own heading). A
// save's green line is read out once.
// usage: node B12.mjs <base> <root>
import { run, say, done, sleep, settle, tapEl } from "./_lib.mjs";
await run("menu row by keyboard", "family", "overview/dashboard", async (p) => {
  await p.locator("#nav-toggle").focus(); await p.keyboard.press("Enter"); await sleep(500);
  await p.locator("#sidebar .nav-search").focus(); await p.keyboard.type("income", { delay: 60 }); await sleep(300);
  const row = p.locator("#sidebar a.nav-link").filter({ hasText: /^Income$/ }).first(); await row.focus(); await p.keyboard.press("Enter"); await sleep(1000); await settle(p);
  const f = await p.evaluate(() => { const a = document.activeElement; return { id: a.id, name: a.getAttribute("aria-label") }; });
  await p.keyboard.press("Tab");
  const t = await p.evaluate(() => ({ inPage: !!document.activeElement.closest("#content"), what: (document.activeElement.textContent || document.activeElement.getAttribute("aria-label") || "").trim().slice(0, 30) }));
  say("menu row by keyboard", (f.id === "content" && f.name === "Income") && t.inPage, `after a menu row: focus on #${f.id} named "${f.name}"; next Tab -> ${t.inPage ? "the page" : "NOT the page"}: "${t.what}"`, { touch: false });
}, { touch: false });
await run("a tile by touch", "family", "overview/dashboard", async (p) => {
  await tapEl(p, p.locator("#content a.stat-link").first());
  const f = await p.evaluate(() => { const a = document.activeElement; return { id: a.id, inPage: !!a.closest("#content"), name: a.getAttribute("aria-label") ?? a.textContent.trim().slice(0, 30), y: Math.round(scrollY) }; });
  say("a tile by touch", f.inPage && f.y === 0, `Dashboard tile -> the focus is ${f.id ? "#" + f.id : "inside the page"} ("${f.name}"), page at the top (${f.y})`);
});
await run("a save is said once", "family", "cashflow/income", async (p) => {
  await tapEl(p, p.locator("#content button").filter({ hasText: "+ Add another income" }).first());
  const box = p.getByLabel("What is it").first(); await tapEl(p, box, 200); await p.keyboard.type("Side gig", { delay: 40 });
  const amt = p.getByLabel("Amount").first(); await tapEl(p, amt, 200); await p.keyboard.type("1200", { delay: 40 }); await sleep(800);
  await p.evaluate(() => {
    window.__said = [];
    const live = () => [...document.querySelectorAll("[aria-live], [role=status], [role=alert]")];
    new MutationObserver(() => { for (const el of live()) { const t = el.textContent.replace(/\s+/g, " ").trim(); if (t) window.__said.push({ who: el.id || el.className || el.getAttribute("role"), t: t.slice(0, 60) }); } }).observe(document.body, { subtree: true, childList: true, characterData: true });
    // a screen reader also reads what the focus lands on: a notice the shell focused is said that way
    document.addEventListener("focusin", (e) => { const el = e.target; if (el.closest?.("#content form")) return; const t = (el.textContent ?? "").replace(/\s+/g, " ").trim(); if (t) window.__said.push({ who: "focus on " + (el.id || el.className || el.tagName), t: t.slice(0, 60) }); }, true);
  });
  const add = p.locator("#content form:visible button[type=submit]").first(); await tapEl(p, add, 2500);
  const said = await p.evaluate(() => window.__said);
  // a live region "says" something each time its words change to new words: count distinct (region, words) changes
  const changes = []; for (const s of said) { const last = changes.filter((c) => c.who === s.who).at(-1); if (!last || last.t !== s.t) changes.push(s); }
  const added = changes.filter((c) => /added/i.test(c.t));
  say("a save is said once", added.length === 1, `after "Add income": read out ${JSON.stringify(changes.map((c) => `${c.who}: ${c.t}`))}`);
});
done("B12 a page change puts me at the top; things are said once");
