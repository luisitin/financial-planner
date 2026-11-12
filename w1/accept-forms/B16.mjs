// B16. (pages that adopt it: a field with `more: true`; the owner's 2026-11-12 ask: less first, more one tap away) A long
// form opens short: the boxes most people leave blank wait under one line, "More details (optional)", right above the
// buttons. A tap on the line opens them where they are (the line stays under my thumb); a box in there that is held back
// at Save opens the line by itself with its words at the box; Return never walks into boxes I cannot see; the line stays
// open for the rest of my visit once I opened it, and shut once I shut it; a saved record that uses one of those boxes
// opens with them showing, one that does not opens short. Income, family. Until cashflow/income marks its optional boxes
// (a page change, after the kit is on main), this serves accept-forms/pages/income.view.js (the tip's page with
// `more: true` on Yearly raise, Starts and Ends) in its place, and says so.
// usage: node B16.mjs <base> <root>
import { run, say, done, sleep, settle, swipeTap, swipeInto, tap, typeIn, typeKeys, look, short, byText, rect, inViewNow, planOf, focusText, PACE } from "./_lib.mjs";

const swap = { "cashflow/income": { file: "income.view.js", marker: "more: true" } };
const formOf = (s) => s.page.locator("#content form").filter({ has: s.page.locator("[name=growth]") }).first();
const foldOf = (f) => f.locator("details.form-more");
const isOpen = (f) => foldOf(f).evaluate((d) => d.open);
// a box a person can see and type in (a shut <details> keeps its boxes laid out in Chromium: ask the line, not the layout)
const seen = (f, name) => f.locator(`[name=${name}]`).evaluate((e) => e.getClientRects().length > 0 && !e.closest("details:not([open])") && (e.checkVisibility ? e.checkVisibility() : true));

await run("B16-short", "family", "cashflow/income", async (s) => {
  console.log(`     page: ${s.swapped.join("; ")}`);
  await swipeTap(s, byText(s, /^\+ Add another income$/)); await settle(s.page); await sleep(300);
  const f = formOf(s), line = foldOf(f).locator("summary");
  const closedH = (await rect(f)).h, lineBox = await rect(line);
  const order = await f.evaluate((el) => [...el.children].map((c) => (c.matches(".form-more") ? "more" : c.matches(".form-actions") ? "buttons" : "box")));
  say("B16-opens-short", !(await isOpen(f)) && !(await seen(f, "growth")) && !(await seen(f, "startDate")) && (await seen(f, "amount")) && order.at(-2) === "more" && order.at(-1) === "buttons" && lineBox.h >= 44 && (await line.textContent()).includes("More details (optional)"),
    `a new income: the form is ${closedH} px tall, the line "${(await line.textContent()).replace(/\s+/g, " ").trim()}" ${lineBox.w}x${lineBox.h} right above the buttons, Yearly raise / Starts / Ends not showing`);
  // a tap opens it in place: the line does not move under the thumb
  await swipeInto(s, line, { at: 0.5 }); const t0 = (await rect(line)).top;
  await tap(s, line); const t1 = (await rect(line)).top, openH = (await rect(f)).h;
  say("B16-opens-in-place", (await isOpen(f)) && (await seen(f, "growth")) && Math.abs(t1 - t0) <= 1 && openH > closedH + 150, `a tap on the line: open ${await isOpen(f)}, the line ${t0} -> ${t1} px, the form ${closedH} -> ${openH} px`);
  // shut again, a wrong raise in it: Save opens it with the words at the box
  await typeIn(s, f.locator("[name=name]"), "Side gig"); await typeIn(s, f.locator("[name=amount]"), "1,200"); await typeIn(s, f.locator("[name=growth]"), "150");
  await swipeTap(s, line); const shut = !(await isOpen(f));
  await swipeTap(s, f.locator("[type=submit]"), 700);
  const l = await look(s);
  say("B16-held-box-opens-it", shut && (await isOpen(f)) && l.bubbles.length === 0 && l.focus?.name === "growth" && l.focus.inView && l.fieldErrors.some((x) => x.text === "Use a number from 0% to 100%." && x.inView),
    `shut by hand ${shut}, then Add with a raise of 150 inside: ${short(l)}; open again ${await isOpen(f)}`);
  // put right and saved with the line open: my choice is kept for the next income on this visit
  await typeIn(s, f.locator("[name=growth]"), "3");
  await swipeTap(s, f.locator("[type=submit]"), 1200); await settle(s.page); await sleep(400);
  const saved = (await planOf(s)).income.find((x) => x.name === "Side gig");
  say("B16-saved", saved?.amount === 1200 && saved?.growth === 0.03, `saved: amount ${saved?.amount}, raise ${saved?.growth}`);
  // the last thing I did to the line myself was shut it (the app opened it for the wrong box): the next form opens short
  const addAgain = async () => { const again = byText(s, /^\+ Add another income$/); if (await again.count()) { await swipeTap(s, again); await settle(s.page); await sleep(300); } return formOf(s); };
  const f2 = await addAgain();
  say("B16-own-choice-shut", !(await isOpen(f2)), `I had shut the line myself before that save: the next new income opens ${await isOpen(f2) ? "open" : "short"}`);
  // I open it and add an income: it is open for the next one too, for the rest of this visit
  await swipeTap(s, foldOf(f2).locator("summary")); await sleep(200);
  await typeIn(s, f2.locator("[name=name]"), "Tips"); await typeIn(s, f2.locator("[name=amount]"), "80");
  await swipeTap(s, f2.locator("[type=submit]"), 1200); await settle(s.page); await sleep(400);
  const f3 = await addAgain();
  say("B16-stays-open", (await isOpen(f3)) && (await planOf(s)).income.some((x) => x.name === "Tips"), `opened by hand, an income added, the form again: the line is ${await isOpen(f3) ? "open, as I left it" : "shut again"}`);
  // I shut it: shut from then on
  await swipeTap(s, foldOf(f3).locator("summary")); await sleep(200);
  await swipeTap(s, f3.getByRole("button", { name: "Cancel", exact: true }), 600); await settle(s.page);
  const f4 = await addAgain();
  say("B16-stays-shut", !(await isOpen(f4)), `shut by hand, the form opened again: the line is ${await isOpen(f4) ? "open" : "shut, as I left it"}`);
}, { swap });

await run("B16-records", "family", "cashflow/income", async (s) => {
  // a record that uses one of the boxes (Ana's salary, a 3% raise) opens with them showing; one that does not opens short
  const row = (name) => s.page.locator("#content li").filter({ hasText: name }).first();
  await swipeTap(s, row("Ana's salary")); await settle(s.page); await sleep(500);
  const a = await isOpen(formOf(s)), raise = await formOf(s).locator("[name=growth]").inputValue();
  await swipeTap(s, formOf(s).getByRole("button", { name: "Cancel", exact: true }), 600); await settle(s.page);
  await swipeTap(s, row("Weekend photography")); await settle(s.page); await sleep(500);
  const b = await isOpen(formOf(s));
  say("B16-record-with", a && raise === "3", `Edit Ana's salary (a 3% raise): the line is ${a ? "open" : "shut"}, Yearly raise shows "${raise}"`);
  say("B16-record-without", !b, `Edit Weekend photography (no raise, no dates): the line is ${b ? "open" : "shut"}`);
  // someone who wants every box on screen: the kit's one switch (the shell is to set it from a device setting; none yet)
  await swipeTap(s, formOf(s).getByRole("button", { name: "Cancel", exact: true }), 600); await settle(s.page);
  const flip = (on) => s.page.evaluate(async (v) => { const src = [...document.querySelectorAll("script[type=module]")].map((x) => x.src).find((x) => /core\/app\.js/.test(x)) ?? `${location.origin}/core/app.js`; (await import(new URL("./ui/dom.js", src).href)).setMoreOpen(v); }, on);
  await flip(true);
  await swipeTap(s, byText(s, /^\+ Add another income$/)); await settle(s.page); await sleep(300);
  const all = await isOpen(formOf(s));
  await swipeTap(s, formOf(s).getByRole("button", { name: "Cancel", exact: true }), 600); await settle(s.page);
  await flip(false);
  await swipeTap(s, byText(s, /^\+ Add another income$/)); await settle(s.page); await sleep(300);
  const short = !(await isOpen(formOf(s)));
  say("B16-every-box", all && short, `the kit's switch on: a new income opens with every box ${all ? "showing" : "not showing"}; off again: it opens ${short ? "short" : "long"}`);
}, { swap });

await run("B16-return", "family", "cashflow/income", async (s) => {
  // a keyboard: Return walks only the boxes I can see; the last of them saves, and the hidden boxes are saved blank
  const add = s.page.locator("#content button").filter({ hasText: /^\+ Add another income$/ }).first(); await add.focus(); await s.page.keyboard.press("Enter"); await sleep(600);
  const f = formOf(s);
  const first = await focusText(s);
  await typeKeys(s, "Tutoring");
  const hint1 = await s.page.evaluate(() => document.activeElement.enterKeyHint);
  await s.page.keyboard.press("Enter"); await sleep(PACE);
  const second = await focusText(s), hint2 = await s.page.evaluate(() => document.activeElement.enterKeyHint);
  await typeKeys(s, "250");
  const before = (await planOf(s)).income.length;
  await s.page.keyboard.press("Enter"); await sleep(1200); await settle(s.page);
  const inc = (await planOf(s)).income, got = inc.find((x) => x.name === "Tutoring");
  say("B16-return-walk", /name/.test(first) && hint1 === "next" && /amount/.test(second) && hint2 === "done" && inc.length === before + 1 && got?.amount === 250 && !got?.growth && !got?.startDate,
    `Enter on "+ Add another income": cursor in ${first} (key "${hint1}") -> ${second} (key "${hint2}") -> saved ${inc.length - before} income: amount ${got?.amount}, raise ${got?.growth}, starts "${got?.startDate ?? ""}"`);
}, { swap, touch: false });
done("B16 a long form opens short");
