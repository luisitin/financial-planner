// B2. Leaving a box I typed wrong says so once my tap has landed; the tap is not lost and the box I am now in does not
// move. An empty box says nothing until Save. While I type, a page that quietly checks the box (Pay off debts' preview)
// draws nothing.
// usage: node B2.mjs <base> <root>
import { run, say, done, sleep, settle, swipeTap, swipeInto, tap, typeIn, look, short, byText, valueOf, topOf, focusText, planOf, btn, resetLog } from "./_lib.mjs";

await run("B2-income-leave", "family", "cashflow/income", async (s) => {
  await swipeTap(s, byText(s, /^\+ Add another income$/)); await settle(s.page); await sleep(300);
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=growth]") }).first();
  // an empty box left: nothing said
  await swipeTap(s, f.locator("[name=name]"));
  const amount = f.locator("[name=amount]"); await swipeInto(s, amount); await tap(s, amount, 600);
  const l0 = await look(s);
  say("B2-empty-quiet", !l0.fieldErrors.length, `leaving "What is it" empty: words ${JSON.stringify(l0.fieldErrors.map((x) => x.text))}`);
  await typeIn(s, f.locator("[name=growth]"), "150");
  const next = f.locator("[name=startDate]"); await swipeInto(s, next);
  const t0 = await topOf(next); await tap(s, next, 700);
  const moved = (await topOf(next)) - t0, focus = await focusText(s), l = await look(s);
  // at most 1 px: half a CSS pixel of rounding on a 2x screen when the page scrolls by the height of the words drawn above
  say("B2-tap-lands", focus === "INPUT startDate" && Math.abs(moved) <= 1, `tap on Starts after typing 150: focus ${focus}, Starts moved ${moved} px`);
  say("B2-words-after", l.fieldErrors.some((x) => x.text === "Use a number from 0% to 100%." && x.inView && x.red), `words under the raise: ${short(l)}`);
  // back in the box, still wrong but in another way: the words under it follow what is typed; right: they go
  const g = f.locator("[name=growth]");
  await swipeTap(s, g); await s.page.keyboard.press("End");
  await s.page.keyboard.type("o", { delay: 70 }); await sleep(300);
  const wrong = (await look(s)).fieldErrors.map((x) => x.text), typed = await valueOf(g);
  await s.page.keyboard.press("Backspace"); await sleep(100); await s.page.keyboard.press("Backspace"); await sleep(300);
  const right = (await look(s)).fieldErrors.map((x) => x.text), typed2 = await valueOf(g);
  say("B2-words-follow", typed === "150o" && wrong.length === 1 && wrong[0] === "Type a number, like 3.5 for 3.5%." && typed2 === "15" && right.length === 0, `"${typed}": ${JSON.stringify(wrong)}; "${typed2}": ${JSON.stringify(right)}`);
});
await run("B2-payoff-typing", "renterDebt", "debt/payoff", async (s) => {
  const extra = s.page.locator("#content").getByLabel("Extra each month").first();
  const before = JSON.stringify((await planOf(s)).debtPlan ?? {});
  await swipeTap(s, extra); await extra.evaluate((e) => { e.value = ""; });
  const seen = [];
  for (const k of "50..") { await s.page.keyboard.type(k); await sleep(70); const n = await s.page.evaluate(() => document.querySelectorAll("#content .field-error, #content [aria-invalid=true]").length); seen.push(n); }
  await sleep(400);
  say("B2-nothing-while-typing", seen.every((n) => n === 0), `red drawn after each key of "50..": ${JSON.stringify(seen)} (value "${await valueOf(extra)}")`);
  const order = s.page.locator("#content").getByLabel("Order").first(); await swipeInto(s, order);
  const t0 = await topOf(order); await tap(s, order, 700);
  const moved = (await topOf(order)) - t0, focus = await focusText(s), l = await look(s);
  await s.page.keyboard.press("Escape").catch(() => { });
  say("B2-order-lands", /^SELECT/.test(focus) && Math.abs(moved) <= 1, `tap on Order: focus ${focus}, Order moved ${moved} px`);
  say("B2-payoff-words", l.fieldErrors.some((x) => /Type an amount in numbers/.test(x.text)), `words under Extra after the tap: ${short(l)}`);
  await resetLog(s); await swipeTap(s, btn(s, "Save plan"), 700);
  const l2 = await look(s);
  say("B2-payoff-kept", JSON.stringify((await planOf(s)).debtPlan ?? {}) === before && l2.bubbles.length === 0 && l2.focus?.name === "extra", `Save plan with "50..": plan unchanged, ${short(l2)}`);
});
done("B2 leaving a box");
