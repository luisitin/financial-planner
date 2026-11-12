// B13. With VoiceOver, the words are read with the box: a wrong box is marked invalid and its words are its description;
// the line above the buttons is read once at the refusal (role="alert"); a red notice a page draws on every redraw is
// read once per visit, not after every redraw. Words drawn after I left a wrong box are said aloud once (I am elsewhere).
// usage: node B13.mjs <base> <root>
import { run, say, done, sleep, settle, swipeTap, swipeInto, tap, typeIn, byText, box, resetLog } from "./_lib.mjs";

await run("B13-box", "family", "goals/goals", async (s) => {
  await swipeTap(s, byText(s, /^\+ Add another goal$/)); await settle(s.page); await sleep(300);
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=name]") }).first();
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]"), 700);
  const a = await s.page.evaluate(() => { const b = document.activeElement; const ids = (b.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean); return { invalid: b.getAttribute("aria-invalid"), described: ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" | "), alert: [...document.querySelectorAll("#content .form-error")].map((n) => `${n.getAttribute("role")}: ${n.textContent}`) }; });
  say("B13-box", a.invalid === "true" && a.described.includes("Fill this in first."), `the box with the cursor: aria-invalid ${a.invalid}, its description "${a.described}"`);
  say("B13-count-alert", a.alert.length === 1 && a.alert[0].startsWith("alert: 2 boxes need a fix"), `the line above the buttons: ${JSON.stringify(a.alert)}`);
});
await run("B13-left-box", "family", "cashflow/income", async (s) => {
  // words drawn after I left the box are said aloud (I am somewhere else); at Save the box has the cursor and its words
  // are its description (not said twice); back in the box, typing does not say them again
  await swipeTap(s, byText(s, /^\+ Add another income$/)); await settle(s.page); await sleep(300);
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=growth]") }).first();
  const role = () => s.page.evaluate(() => { const b = document.querySelector("#content form [name=growth]"); const id = (b.getAttribute("aria-describedby") || "").split(/\s+/)[0]; const m = id && document.getElementById(id); return m ? `${m.getAttribute("role") ?? "none"}: ${m.textContent}` : "no words"; });
  await typeIn(s, f.locator("[name=growth]"), "150");
  const next = f.locator("[name=startDate]"); await swipeInto(s, next); await tap(s, next, 700);
  const left = await role();
  await swipeTap(s, f.locator("[name=growth]"), 500);
  const back = await role();
  await typeIn(s, f.locator("[name=name]"), "Side gig"); await typeIn(s, f.locator("[name=amount]"), "900");
  await swipeTap(s, f.locator("[type=submit]"), 700);
  const atSave = await role(), focus = await s.page.evaluate(() => document.activeElement?.name);
  say("B13-left-box", left === "alert: Use a number from 0% to 100%." && back === "none: Use a number from 0% to 100%." && atSave === "none: Use a number from 0% to 100%." && focus === "growth",
    `raise 150, then a tap on Starts: the words are ${JSON.stringify(left)}; back in the box: ${JSON.stringify(back)}; held at Save with the cursor in ${focus}: ${JSON.stringify(atSave)}`);
});
await run("B13-refusal", "family", "property/home", async (s) => {
  await typeIn(s, box(s, "Year you bought it"), "2099");
  const save = s.page.locator("#content form").filter({ has: s.page.getByLabel("Year you bought it") }).locator("[type=submit]");
  await swipeInto(s, save); await tap(s, save, 600);
  const lines = await s.page.evaluate(() => [...document.querySelectorAll("#content .form-error")].map((n) => `${n.getAttribute("role")}: ${n.textContent.slice(0, 40)}`));
  say("B13-refusal-alert", lines.length === 1 && lines[0].startsWith("alert: 2099 is still ahead"), `the page's refusal above Save: ${JSON.stringify(lines)}`);
});
await run("B13-once-per-visit", "family", "overview/guide/no-such-guide", async (s) => {
  const roles = async () => s.page.evaluate(() => [...document.querySelectorAll("#content .notice.error")].map((n) => n.getAttribute("role") ?? "none"));
  const first = await roles();
  await s.page.evaluate(() => window.dispatchEvent(new Event("planner:view"))); await sleep(500); await settle(s.page);   // the shell draws the page again
  const redrawn = await roles();
  await s.page.evaluate(() => { location.hash = "#/overview/dashboard"; }); await sleep(700); await settle(s.page);
  await s.page.evaluate(() => { location.hash = "#/overview/guide/no-such-guide"; }); await sleep(700); await settle(s.page);
  const again = await roles();
  say("B13-once-per-visit", first[0] === "alert" && redrawn.length === 1 && redrawn[0] === "none" && again[0] === "alert",
    `a page's red line ("There is no guide called ..."): first draw ${JSON.stringify(first)}, drawn again ${JSON.stringify(redrawn)}, after leaving and coming back ${JSON.stringify(again)}`);
});
done("B13 read with the box");
