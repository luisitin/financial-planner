// B8. Cancel takes me back to the row I came from, when the app knows the row for sure: the row comes to the middle of the
// screen if it is off it, and the focus is on it (or its Edit). If the list is drawn differently, nothing moves: no guess.
// Expenses (Groceries), Income (a row), Contacts with eight people (a page that draws itself again on Edit and Cancel).
// usage: node B8.mjs <base> <root>
import { run, say, done, sleep, settle, swipeTap, focusText, topOf, inViewNow, H } from "./_lib.mjs";

const withContacts = () => { const p = H.family(); p.contacts = Array.from({ length: 8 }, (_, i) => ({ id: `ct${i}`, role: "advisor", name: `Helper ${String.fromCharCode(65 + i)}`, firm: `Firm ${i + 1}`, phone: "555-0100", email: "", notes: "", accountIds: [], policyIds: [], last4: {} })); return p; };
const cancelOf = (s) => s.page.locator("#content form").getByRole("button", { name: "Cancel", exact: true }).first();

await run("B8-expenses", "family", "cashflow/expenses", async (s) => {
  const rec = () => s.page.locator("#content ul.page-list li").filter({ hasText: "Groceries" }).first();
  await swipeTap(s, rec()); await settle(s.page); await sleep(1200);
  const away = await topOf(rec());
  await swipeTap(s, cancelOf(s)); await settle(s.page); await sleep(500);
  const top = await topOf(rec()), inView = await inViewNow(rec()), focus = await focusText(s);
  say("B8-expenses", inView && /^LI .*Groceries/.test(focus) && top > 200 && top < 650, `Groceries, then Cancel: the row was at ${away} px, now ${top} px (on screen ${inView}), focus ${focus.slice(0, 40)}`);
});
await run("B8-income", "family", "cashflow/income", async (s) => {
  const rec = () => s.page.locator("#content li").filter({ hasText: "Weekend photography" }).first();
  await swipeTap(s, rec()); await settle(s.page); await sleep(500);
  await swipeTap(s, cancelOf(s)); await settle(s.page); await sleep(500);
  const inView = await inViewNow(rec()), focus = await focusText(s);
  say("B8-income", inView && /Weekend photography/.test(focus), `a row, then Cancel: on screen ${inView}, focus ${focus.slice(0, 40)}`);
});
await run("B8-contacts", withContacts, "household/contacts", async (s) => {
  const edits = s.page.locator("#content li button, #content tr button").filter({ hasText: /^Edit/ });
  const last = edits.nth((await edits.count()) - 1);
  await swipeTap(s, last); await settle(s.page); await sleep(800);
  await swipeTap(s, cancelOf(s)); await settle(s.page); await sleep(800);
  const focus = await focusText(s);
  const row = await s.page.evaluate(() => { const a = document.activeElement; const r = a?.closest?.("li, tr"); return r ? r.textContent.replace(/\s+/g, " ").trim().slice(0, 30) : null; });
  const inView = await s.page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return false; const b = a.getBoundingClientRect(); return b.top >= 56 && b.bottom <= innerHeight; });
  say("B8-contacts", focus === "BUTTON Edit" && /Helper H/.test(row ?? "") && inView, `Edit on the eighth contact, then Cancel (the page draws itself again): focus ${focus} in the row "${row}", on screen ${inView}`);
});
await run("B8-no-guess", withContacts, "household/contacts", async (s) => {
  // the list as it reads at the tap is not the list Cancel draws: one row's words differ (as after a change elsewhere)
  await s.page.evaluate(() => { const li = [...document.querySelectorAll("#content li")].find((x) => /Helper A/.test(x.textContent)); const t = li && [...li.querySelectorAll("*")].find((e) => e.childNodes.length === 1 && e.firstChild.nodeType === 3 && /Helper A/.test(e.textContent)); if (t) t.textContent = "Helper Z"; });
  const edits = s.page.locator("#content li button, #content tr button").filter({ hasText: /^Edit/ });
  await swipeTap(s, edits.nth((await edits.count()) - 1)); await settle(s.page); await sleep(800);
  const cancel = cancelOf(s); await s.page.evaluate(() => { window.__scrolls = 0; const o = window.scrollTo; window.scrollTo = function (...a) { window.__scrolls++; return o.apply(this, a); }; });
  await swipeTap(s, cancel); await settle(s.page); await sleep(800);
  const focus = await focusText(s), kitScrolls = await s.page.evaluate(() => window.__scrolls);
  say("B8-no-guess", focus !== "BUTTON Edit" && kitScrolls === 0, `the list read differently at the tap: after Cancel focus ${focus}, scroll calls ${kitScrolls} (nothing guessed)`);
});
done("B8 Cancel goes back to the row");
