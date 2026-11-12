// B7. Opened with the keyboard, a form has the cursor in its first box; a tap opens no keyboard by itself; a key on a chip
// does not hand the cursor to some other form.
// usage: node B7.mjs <base> <root>
import { run, say, done, sleep, settle, swipeTap, byText, typeKeys, focusText } from "./_lib.mjs";

await run("B7-key-open", "family", "cashflow/income", async (s) => {
  const b = s.page.locator("#content button").filter({ hasText: /^\+ Add another income$/ }).first();
  await b.focus(); await s.page.keyboard.press("Enter"); await sleep(700);
  const focus = await focusText(s); await typeKeys(s, "Side gig");
  const typed = await s.page.locator("#content input[name=name]").first().inputValue().catch(() => null);
  say("B7-key-open", focus === "INPUT name" && typed === "Side gig", `Enter on "+ Add another income": focus ${focus}; typed "${typed}" into What is it`);
}, { touch: false });
await run("B7-touch-open", "family", "cashflow/income", async (s) => {
  await swipeTap(s, byText(s, /^\+ Add another income$/), 700);
  const focus = await focusText(s), formShown = await s.page.locator("#content input[name=name]").count();
  say("B7-touch-open", formShown > 0 && !/^(INPUT|SELECT|TEXTAREA)/.test(focus), `a tap on "+ Add another income": the form is open, focus ${focus} (no keyboard)`);
});
await run("B7-chip-key", "family", "taxes/capital-gains", async (s) => {
  const chip = s.page.locator("#content button").filter({ hasText: /^\+\$25,000$/ }).first();
  if (!(await chip.count())) { say("B7-chip-key", false, 'no "+$25,000" chip on Capital gains'); return; }
  await chip.focus(); await sleep(250);
  const y0 = await s.page.evaluate(() => scrollY); await s.page.keyboard.press("Enter"); await sleep(800); await settle(s.page);
  const dy = (await s.page.evaluate(() => scrollY)) - y0, focus = await focusText(s);
  await s.page.keyboard.type("5"); await sleep(300);
  const into = await s.page.evaluate(() => [...document.querySelectorAll("#content form input")].filter((i) => /5/.test(i.value) && i === document.activeElement).map((i) => i.name));
  say("B7-chip-key", dy === 0 && /^BUTTON/.test(focus) && !into.length, `Enter on the "+$25,000" chip: scroll ${dy}, focus ${focus}, typed into a form box: ${JSON.stringify(into)}`);
}, { touch: false });
done("B7 a keyboard open");
