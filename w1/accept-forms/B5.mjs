// B5. A real figure is taken as typed; an impossible one is stopped at the box. "1,200", "2.555" and "5%" are taken (a
// percent box shows "%" inside it); "11,200" miles at a step of 500 is taken; "12..5" says "Type a number, like 3.5 for
// 3.5%."; a whole-number box says "Use a whole number, like 12."; a billion or more says "That is more than a billion:
// check for an extra digit."; a year typed as 0026 says "Check the year: type all four digits, like 2026.".
// usage: node B5.mjs <base> <root>
import { run, say, done, sleep, settle, swipeTap, swipeInto, tap, typeIn, look, short, byText, valueOf, planOf, resetLog } from "./_lib.mjs";

const incomeForm = async (s) => {
  await swipeTap(s, byText(s, /^\+ Add another income$/)); await settle(s.page); await sleep(300);
  return s.page.locator("#content form").filter({ has: s.page.locator("[name=growth]") }).first();
};
const wordsUnder = (l, text) => l.fieldErrors.some((x) => x.text === text && x.inView);

await run("B5-taken", "family", "cashflow/income", async (s) => {
  const f = await incomeForm(s);
  await typeIn(s, f.locator("[name=name]"), "Side gig");
  await typeIn(s, f.locator("[name=amount]"), "1,200");
  await typeIn(s, f.locator("[name=growth]"), "5%");
  const pct = await valueOf(f.locator("[name=growth]"));
  const sign = await f.locator("[name=growth]").evaluate((e) => { const u = e.closest(".unit-in")?.querySelector(".unit"); if (!u) return null; const a = e.getBoundingClientRect(), b = u.getBoundingClientRect(); return { text: u.textContent, inside: b.left > a.left && b.right <= a.right && b.top >= a.top && b.bottom <= a.bottom }; });
  say("B5-percent-sign", pct === "5%" && sign?.text === "%" && sign.inside, `"5%" stays as typed ("${pct}"); the "%" inside the box: ${JSON.stringify(sign)}`);
  await typeIn(s, f.locator("[name=growth]"), "2.555");
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]"), 900); await settle(s.page);
  const inc = (((p) => p.incomes ?? p.income ?? [])(await planOf(s))).find((x) => x.name === "Side gig");
  say("B5-saved-as-typed", inc?.amount === 1200 && inc?.growth === 0.02555, `saved ${JSON.stringify(inc ? { amount: inc.amount, growth: inc.growth } : null)} (want 1200 and 0.02555)`);
});
await run("B5-refused", "family", "cashflow/income", async (s) => {
  const f = await incomeForm(s);
  await typeIn(s, f.locator("[name=growth]"), "12..5");
  await swipeTap(s, f.locator("[name=name]"), 700);
  let l = await look(s);
  say("B5-12..5", wordsUnder(l, "Type a number, like 3.5 for 3.5%."), `"12..5" in the raise, then the next box: ${short(l)}`);
  await typeIn(s, f.locator("[name=amount]"), "5,000,000,000");
  await swipeTap(s, f.locator("[name=name]"), 700);
  l = await look(s);
  say("B5-billion", wordsUnder(l, "That is more than a billion: check for an extra digit."), `"5,000,000,000": ${short(l)}`);
  const date = f.locator("[name=startDate]"); await swipeTap(s, date);
  await s.page.keyboard.type("01010026", { delay: 70 }); await sleep(450);
  const typed = await valueOf(date);
  await swipeTap(s, f.locator("[name=name]"), 700);
  l = await look(s);
  say("B5-year-0026", wordsUnder(l, "Check the year: type all four digits, like 2026."), `a date typed with the year 0026 ("${typed}"): ${short(l)}`);
  await typeIn(s, f.locator("[name=name]"), "Side gig");
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]"), 900);
  say("B5-not-saved", !(((p) => p.incomes ?? p.income ?? [])(await planOf(s))).some((x) => x.name === "Side gig"), "Add income with those boxes: nothing saved");
});
await run("B5-whole", "family", "debt/refinance", async (s) => {
  const term = s.page.locator("#content [name=termYears]").first();
  if (!(await term.count())) { say("B5-whole", false, "no New term box on Refinance for this household"); return; }
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=termYears]") }).first();
  const rate = f.locator("[name=rate]"); if (await rate.count()) await typeIn(s, rate, "6.5");
  await typeIn(s, term, "2.5");
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]"), 700);
  const l = await look(s);
  say("B5-whole", wordsUnder(l, "Use a whole number, like 12.") && l.bubbles.length === 0 && l.focus?.name === "termYears", `"2.5" years, then the button: ${short(l)}`);
});
await run("B5-miles", "family", "property/vehicles", async (s) => {
  const opener = s.page.locator("#content summary").filter({ hasText: /^Add a car/ }).first();
  if ((await opener.count()) && !(await opener.evaluate((e) => e.parentElement.open))) { await swipeTap(s, opener); await sleep(300); }
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=milesYear]") }).last();
  await typeIn(s, f.locator("[name=name]"), "Van");
  await typeIn(s, f.locator("[name=milesYear]"), "11,200");
  const shown = await valueOf(f.locator("[name=milesYear]"));
  await typeIn(s, f.locator("[name=value]"), "18000");
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]"), 900); await settle(s.page);
  const van = JSON.stringify(await planOf(s)).match(/"name":"Van"[^}]*"milesYear":(\d+)/)?.[1] ?? null;
  say("B5-miles", shown === "11,200" && van === "11200", `"11,200" miles shown as typed ("${shown}") and saved as ${van}`);
});
done("B5 figures as typed");
