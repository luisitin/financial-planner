// B1. A Save or Add that cannot go through says why at the box: the box comes up under the top bar with its name showing,
// the cursor in it, a red edge, the words right under it in red; no grey bubble; the words stay until the box is right and
// go the moment it is; two wrong boxes give "2 boxes need a fix: A; B." above the buttons, counted again as each is fixed;
// nothing typed is lost. Pages: Goals (empty Add), Income (raise 150 at Save), Update my balances ("abc"), Vehicles (name
// only), Employer stock (the page's own words for "acme!!").
// usage: node B1.mjs <base> <root>
import { run, say, done, sleep, settle, swipeTap, swipeInto, tap, typeIn, typeKeys, look, short, resetLog, byText, valueOf, planOf } from "./_lib.mjs";

const atBox = (l, words) => l.bubbles.length === 0 && !!l.focus?.invalid && l.focus.inView && l.labelShown === true && l.fieldErrors.some((x) => x.text === words && x.inView && x.red);

await run("B1-goals", "family", "goals/goals", async (s) => {
  await swipeTap(s, byText(s, /^\+ Add another goal$/)); await settle(s.page); await sleep(300);
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=name]") }).first();
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]"), 700);
  const l = await look(s);
  const count = l.formErrors.find((x) => /boxes need a fix/.test(x.text))?.text ?? null;
  say("B1-goals-words", atBox(l, "Fill this in first.") && l.focus.name === "name" && l.fieldErrors.length === 2 && l.fieldErrors.some((x) => x.text === "Type an amount first."),
    `Add goal with nothing typed: ${short(l)}`);
  say("B1-goals-count", count === "2 boxes need a fix: What are you saving for; Amount needed." && l.formErrors.find((x) => x.text === count)?.role === "alert", `the line above the buttons: ${JSON.stringify(count)}`);
  await typeKeys(s, "New roof");
  const l2 = await look(s);
  say("B1-goals-recount", l2.fieldErrors.length === 1 && l2.fieldErrors[0].text === "Type an amount first." && !l2.formErrors.some((x) => /boxes need a fix/.test(x.text)),
    `after typing the first box: words ${JSON.stringify(l2.fieldErrors.map((x) => x.text))}, lines ${JSON.stringify(l2.formErrors.map((x) => x.text))}`);
  say("B1-goals-kept", (await valueOf(f.locator("[name=name]"))) === "New roof", `what was typed is still there: "${await valueOf(f.locator("[name=name]"))}"`);
});
await run("B1-income-150", "family", "cashflow/income", async (s) => {
  await swipeTap(s, byText(s, /^\+ Add another income$/)); await settle(s.page); await sleep(300);
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=growth]") }).first();
  await typeIn(s, f.locator("[name=name]"), "Side gig");
  await typeIn(s, f.locator("[name=amount]"), "1,200");
  await typeIn(s, f.locator("[name=growth]"), "150");
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]"), 700);
  const l = await look(s);
  say("B1-income-150", atBox(l, "Use a number from 0% to 100%.") && l.focus.name === "growth", `raise 150 then Add income: ${short(l)}`);
  const p = await planOf(s);
  say("B1-income-not-saved", !(p.incomes ?? p.income ?? []).some((x) => x.name === "Side gig") && (await valueOf(f.locator("[name=name]"))) === "Side gig", "nothing saved, the name still typed");
  await typeIn(s, f.locator("[name=growth]"), "3");
  const l2 = await look(s);
  say("B1-income-goes", !l2.fieldErrors.length, `typing 3: words left ${JSON.stringify(l2.fieldErrors.map((x) => x.text))}`);
});
await run("B1-update-abc", "renterDebt", "balance/update", async (s) => {
  const first = s.page.locator("#content form input[type=text]").first();
  await typeIn(s, first, "abc");
  await resetLog(s); await swipeTap(s, s.page.locator("#content form [type=submit]").first(), 700);
  const l = await look(s);
  say("B1-update-abc", l.bubbles.length === 0 && !!l.focus?.invalid && l.focus.inView && l.fieldErrors.some((x) => x.text === "Type an amount in numbers, like 4,500." && x.inView && x.red), `"abc" then Save: ${short(l)}`);
});
await run("B1-vehicles", "family", "property/vehicles", async (s) => {
  const opener = s.page.locator("#content summary").filter({ hasText: /^Add a car/ }).first();
  if ((await opener.count()) && !(await opener.evaluate((e) => e.parentElement.open))) { await swipeTap(s, opener); await sleep(300); }
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=milesYear]") }).last();
  await typeIn(s, f.locator("[name=name]"), "Van");
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]"), 700);
  const l = await look(s);
  say("B1-vehicles", atBox(l, "Type an amount first."), `a name only, then Add: ${short(l)}`);
});
await run("B1-employer-stock", "blank", "investments/employer-stock", async (s) => {
  const sym = s.page.locator("#content input[name=symbol]").first();
  if (!(await sym.count())) { const open = byText(s, /Add|company stock/i); if (await open.count()) { await swipeTap(s, open); await sleep(400); } }
  await typeIn(s, sym, "acme!!");
  const f = s.page.locator("#content form").filter({ has: s.page.locator("input[name=symbol]") }).first();
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]"), 700);
  const l = await look(s);
  say("B1-employer-stock", atBox(l, "A symbol is letters, like ACME."), `"acme!!" then Save (the page's own words): ${short(l)}`);
});
done("B1 errors at the box");
