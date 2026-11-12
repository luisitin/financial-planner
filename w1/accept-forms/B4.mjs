// B4. Every form speaks the same way, the hand-built ones and boxes in no form too, with no change to those pages:
// Update my balances ("abc"), Pay off debts ("50.." in Extra, Save plan), Employer stock (its own words), Holdings
// ("abc" shares), People (Add person with no name). Each: the words right under the box, red, in view, the cursor in that
// box, no grey bubble.
// usage: node B4.mjs <base> <root>
import { run, say, done, sleep, settle, swipeTap, typeIn, look, short, byText, btn, resetLog } from "./_lib.mjs";

const atBox = (l, words, name) => l.bubbles.length === 0 && !!l.focus?.invalid && l.focus.inView && (!name || l.focus.name === name) && l.fieldErrors.some((x) => x.text === words && x.inView && x.red && x.bold);
const check = (id, l, words, name, what) => say(id, atBox(l, words, name), `${what}: ${short(l)}`);

await run("B4-update", "renterDebt", "balance/update", async (s) => {
  const first = s.page.locator("#content form input[type=text]").first();
  const name = await first.getAttribute("name");
  await typeIn(s, first, "abc");
  await resetLog(s); await swipeTap(s, s.page.locator("#content form [type=submit]").first(), 700);
  check("B4-update", await look(s), "Type an amount in numbers, like 4,500.", name, `Update my balances, "abc", Save`);
});
await run("B4-payoff", "renterDebt", "debt/payoff", async (s) => {
  const extra = s.page.locator("#content").getByLabel("Extra each month").first();
  await typeIn(s, extra, "50..");
  await resetLog(s); await swipeTap(s, btn(s, "Save plan"), 700);
  check("B4-payoff", await look(s), "Type an amount in numbers, like 4,500.", "extra", `Pay off debts, "50.." in Extra, Save plan`);
});
await run("B4-employer-stock", "blank", "investments/employer-stock", async (s) => {
  const sym = s.page.locator("#content input[name=symbol]").first();
  await typeIn(s, sym, "acme!!");
  await resetLog(s); await swipeTap(s, s.page.locator("#content form").filter({ has: s.page.locator("input[name=symbol]") }).first().locator("[type=submit]"), 700);
  check("B4-employer-stock", await look(s), "A symbol is letters, like ACME.", "symbol", `Employer stock, "acme!!", Save (the page's own words)`);
});
await run("B4-holdings", "family", "investments/holdings", async (s) => {
  const add = byText(s, /^\+ Add a holding$/); if (await add.count()) { await swipeTap(s, add); await settle(s.page); await sleep(300); }
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=shares]") }).last();
  const acct = f.locator("select[name=accountId]");
  if (await acct.count()) { const opts = await acct.locator("option").evaluateAll((o) => o.map((x) => x.value).filter(Boolean)); if (opts.length) await acct.selectOption(opts[0]); }
  await typeIn(s, f.locator("[name=symbol]"), "VTI");
  await typeIn(s, f.locator("[name=shares]"), "abc");
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]"), 700);
  check("B4-holdings", await look(s), "Type a number, like 12.", "shares", `Holdings, "abc" shares, Add holding`);
});
await run("B4-people", "family", "household/people", async (s) => {
  const add = byText(s, /^\+ Add another person$/); if (await add.count()) { await swipeTap(s, add); await settle(s.page); await sleep(300); }
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=birthDate]") }).last();
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]"), 700);
  check("B4-people", await look(s), "Fill this in first.", "name", "People, Add person with no name");
});
done("B4 every form speaks the same way");
