// judge-forms/journeys.mjs -- the same journeys on today (ee09f6e), A (forms final) and B (forms2 final), at a person's
// pace: real touch taps at a control's centre, real finger drags to find it, typing key by key (70 ms), 450 ms between
// actions; keyboard journeys with touch off. Usage: node journeys.mjs <target> [journey ...]. Output: out/j-<target>.json
import fs from "node:fs";
import { households, openT, sleep, settle, shot, swipeInto, swipeTap, tap, typeIn, drag, box, btn, look, planOf, focusText, topOf, resetLog, ROOT, J } from "./jlib.mjs";
const H = await households(ROOT);
const [target, ...only] = process.argv.slice(2);
const want = (x) => !only.length || only.includes(x);
const out = [];
const log = (r) => { out.push(r); console.log(JSON.stringify(r)); };
const SH = `${J}/shots`;
const withContacts = () => { const p = H.family(); p.contacts = Array.from({ length: 8 }, (_, i) => ({ id: `ct${i}`, role: "advisor", name: `Helper ${String.fromCharCode(65 + i)}`, firm: `Firm ${i + 1}`, phone: "555-0100", email: "", notes: "", accountIds: [], policyIds: [], last4: {} })); return p; };
const run = async (name, hh, route, fn, more = {}) => {
  if (!want(name)) return;
  const s = await openT(target, hh === "familyContacts" ? withContacts() : H[hh](), route, more);
  const r = { j: name, target, hh, route };
  try { await settle(s.page); await sleep(600); await fn(s, r); } catch (e) { r.error = String(e.message).split("\n")[0].slice(0, 200); }
  r.pageErrors = s.errors.slice(0, 3);
  log(r); await s.close();
};
const rect = (loc) => loc.evaluate((e) => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) }; });
const inViewNow = (loc) => loc.evaluate((e) => { const tb = document.getElementById("topbar").getBoundingClientRect().bottom; const vb = window.visualViewport ? visualViewport.offsetTop + visualViewport.height : innerHeight; const b = e.getBoundingClientRect(); return b.height > 0 && b.top >= tb - 1 && b.bottom <= vb + 1; });
const valueOf = (loc) => loc.inputValue().catch(() => null);
const typeKeys = async (s, text) => { await s.page.keyboard.type(String(text), { delay: 70 }); await sleep(450); };
const clearFocused = (s) => s.page.evaluate(() => { const a = document.activeElement; if (a && "value" in a) a.value = ""; });

// J1 goals: Add goal with nothing typed, then fix the first box (short form; F3, FF5)
await run("J1-goals-empty", "family", "goals/goals", async (s, r) => {
  await swipeTap(s, byTextLoc(s, /^\+ Add another goal$/)); await settle(s.page); await sleep(300);
  const sub = s.page.locator("#content form [type=submit]").first();
  await swipeTap(s, sub); await sleep(600);
  const l = await look(s); r.after = trim(l);
  await typeKeys(s, "New roof"); await sleep(300);
  const l2 = await look(s); r.afterFix = { fieldErrors: l2.fieldErrors.map((x) => x.text), formErrors: l2.formErrors.map((x) => x.text) };
  await shot(s.page, `${SH}/J1-${target}.png`);
});
// J2 income: raise 150 then tap the next box; then 12..5; then 2.555 and an amount "1,200", Add (short form; CF-7, IE-4, T6)
await run("J2-income-raise", "family", "cashflow/income", async (s, r) => {
  await swipeTap(s, byTextLoc(s, /^\+ Add another income$/)); await settle(s.page); await sleep(300);
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=growth]") }).first();
  await typeIn(s, f.locator("[name=name]"), "Side gig");
  await typeIn(s, f.locator("[name=amount]"), "1,200");
  await typeIn(s, f.locator("[name=growth]"), "150");
  r.raiseValueTyped = await valueOf(f.locator("[name=growth]"));
  const next = f.locator("[name=startDate]"); await swipeInto(s, next);
  const t0 = await topOf(next); await tap(s, next); await sleep(500);
  r.nextBoxMoved = (await topOf(next)) - t0; r.focusAfterLeave = await focusText(s);
  r.leaveWords = (await look(s)).fieldErrors.map((x) => `${x.text} [${x.inView ? "in view" : "off"}]`);
  await resetLog(s);
  await swipeTap(s, f.locator("[type=submit]")); await sleep(600);
  const l = await look(s); r.save150 = trim(l);
  // 12..5
  await typeIn(s, f.locator("[name=growth]"), "12..5"); r.raise125Typed = await valueOf(f.locator("[name=growth]"));
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]")); await sleep(600);
  r.save125 = trim(await look(s));
  // 5%
  await typeIn(s, f.locator("[name=growth]"), "5%"); r.raise5pctTyped = await valueOf(f.locator("[name=growth]"));
  // 2.555
  await typeIn(s, f.locator("[name=growth]"), "2.555"); r.raise2555Typed = await valueOf(f.locator("[name=growth]"));
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]")); await sleep(900); await settle(s.page);
  const l3 = await look(s); r.saveOk = trim(l3);
  const p = await planOf(s); const inc = (p.incomes ?? p.income ?? []).find?.((x) => x.name === "Side gig");
  r.saved = inc ? { amount: inc.amount, growth: inc.growth } : null;
  await shot(s.page, `${SH}/J2-${target}.png`);
});
// J2b income: what a percent box takes as typed: "5%", then "2.555" with an amount "1,200", Add (CF-7, W6)
await run("J2b-income-figures", "family", "cashflow/income", async (s, r) => {
  await swipeTap(s, byTextLoc(s, /^\+ Add another income$/)); await settle(s.page); await sleep(300);
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=growth]") }).first();
  await typeIn(s, f.locator("[name=name]"), "Side gig");
  await typeIn(s, f.locator("[name=amount]"), "1,200");
  await typeIn(s, f.locator("[name=growth]"), "5%"); r.raise5pctTyped = await valueOf(f.locator("[name=growth]"));
  await typeIn(s, f.locator("[name=growth]"), "2.555"); r.raise2555Typed = await valueOf(f.locator("[name=growth]"));
  r.percentSignShown = await f.locator("[name=growth]").evaluate((e) => !!e.closest(".unit-in")?.querySelector(".unit"));
  r.raiseType = await f.locator("[name=growth]").evaluate((e) => `${e.type}/${e.inputMode}`);
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]")); await sleep(900); await settle(s.page);
  r.after = trim(await look(s));
  const p = await planOf(s); const inc = (p.incomes ?? p.income ?? []).find?.((x) => x.name === "Side gig");
  r.saved = inc ? { amount: inc.amount, growth: inc.growth } : null;
});
// J3 home: year 2099, Save twice (page's own refusal; FF1, DP-2)
await run("J3-home-year-twice", "family", "property/home", async (s, r) => {
  const y = box(s, "Year you bought it"); await typeIn(s, y, "2099");
  const save = s.page.locator("#content form").filter({ has: s.page.getByLabel("Year you bought it") }).locator("[type=submit]");
  await swipeInto(s, save); r.save0 = await topOf(save);
  await tap(s, save); await sleep(150); r.save1 = await topOf(save);
  r.after1 = trim(await look(s));
  await tap(s, save); await sleep(150); r.save2 = await topOf(save);
  await sleep(7000); const l = await look(s); r.after7s = { formErrors: l.formErrors, fieldErrors: l.fieldErrors.map((x) => x.text) }; r.save7s = await topOf(save);
  r.savedYear = (await planOf(s)).property?.home?.boughtYear ?? (await planOf(s)).home?.boughtYear ?? null;
  await shot(s.page, `${SH}/J3-${target}.png`);
});
// J4 Return walk (keyboard): Contacts and Gifting; nothing saved until the last box (x-2 career, x-2 insurance, T2)
await run("J4a-contacts-return", "family", "household/contacts", async (s, r) => {
  const add = s.page.locator("#content button").filter({ hasText: /^Add someone$/ }).first(); await add.focus(); await s.page.keyboard.press("Enter"); await sleep(500);
  r.focusOnOpen = await focusText(s);
  const first = s.page.locator("#content form input[name=name]").first(); if (!(await first.evaluate((e) => e === document.activeElement))) await first.focus();
  await typeKeys(s, "Dr Lee");
  const walk = [];
  for (let i = 0; i < 7; i++) { const st = await s.page.evaluate(() => ({ n: document.activeElement?.name || document.activeElement?.tagName, hint: document.activeElement?.enterKeyHint, tag: document.activeElement?.tagName })); walk.push(`${st.n}:${st.hint || "-"}`); if (st.tag === "TEXTAREA" || st.tag === "SELECT" || st.tag === "BODY" || st.tag === "BUTTON") break; await s.page.keyboard.press("Enter"); await sleep(450); }
  r.walk = walk; r.savedEarly = JSON.stringify((await planOf(s)).contacts ?? []).includes("Dr Lee");
}, { touch: false });
await run("J4b-gifting-return", "family", "estate/gifting", async (s, r) => {
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=to]") }).first();
  await f.locator("[name=to]").focus(); await typeKeys(s, "Sam");
  const walk = [];
  for (let i = 0; i < 8; i++) { const st = await s.page.evaluate(() => ({ n: document.activeElement?.name || document.activeElement?.tagName, hint: document.activeElement?.enterKeyHint, tag: document.activeElement?.tagName })); walk.push(`${st.n}:${st.hint || "-"}`); if (st.tag === "TEXTAREA" || st.tag === "BODY" || i === 6) break; if (st.n === "amount") await typeKeys(s, "500"); await s.page.keyboard.press("Enter"); await sleep(450); }
  r.walk = walk;
  r.gifts = ((await planOf(s)).estate?.gifts ?? []).filter((g) => /Sam/.test(g.to ?? g.name ?? "")).length;
  r.look = trim(await look(s));
}, { touch: false });
// J4c double Return on the last box of an add form (net worth add, family): one account added
await run("J4c-networth-double-return", "family", "balance/net-worth", async (s, r) => {
  const before = (await planOf(s)).accounts.length;
  const add = s.page.locator("#content button").filter({ hasText: /^\+ Add another account$/ }).first(); await add.focus(); await s.page.keyboard.press("Enter"); await sleep(500);
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=balance]") }).first();
  await f.locator("[name=name]").focus(); await typeKeys(s, "Credit union");
  const walk = [];
  for (let i = 0; i < 8; i++) {
    const st = await s.page.evaluate(() => ({ n: document.activeElement?.name || document.activeElement?.tagName, hint: document.activeElement?.enterKeyHint, tag: document.activeElement?.tagName }));
    walk.push(`${st.n}:${st.hint || "-"}`);
    if (st.n === "balance") await typeKeys(s, "2500");
    if (st.hint === "done") { await s.page.keyboard.press("Enter"); await sleep(300); await s.page.keyboard.press("Enter"); await sleep(900); break; }
    if (st.tag === "SELECT" || st.tag === "BODY") { await s.page.keyboard.press("Enter"); await sleep(450); walk.push(`after Enter on ${st.tag}: ${await focusText(s)}`); break; }
    await s.page.keyboard.press("Enter"); await sleep(450);
  }
  r.walk = walk; await settle(s.page);
  const acc = (await planOf(s)).accounts; r.added = acc.length - before; r.creditUnion = acc.filter((a) => a.name === "Credit union").length;
}, { touch: false });
// J5 keyboard open: "+ Add another income" with Enter; Capital gains chip with Enter while the sale form is open (K4)
await run("J5a-income-open-key", "family", "cashflow/income", async (s, r) => {
  const b = s.page.locator("#content button").filter({ hasText: /^\+ Add another income$/ }).first(); await b.focus(); await s.page.keyboard.press("Enter"); await sleep(600);
  r.focus = await focusText(s); await typeKeys(s, "Side gig");
  r.whatIsIt = await s.page.locator("#content input[name=name]").first().inputValue().catch(() => null);
}, { touch: false });
await run("J5b-income-open-touch", "family", "cashflow/income", async (s, r) => {
  await swipeTap(s, byTextLoc(s, /^\+ Add another income$/)); await sleep(400); r.focus = await focusText(s);
});
await run("J5c-capgains-chip-key", "family", "taxes/capital-gains", async (s, r) => {
  const chip = s.page.locator("#content button").filter({ hasText: /^\+\$25,000$/ }).first(); await chip.focus(); await sleep(200);
  const y0 = await s.page.evaluate(() => scrollY); await s.page.keyboard.press("Enter"); await sleep(700); await settle(s.page);
  r.scrollBy = (await s.page.evaluate(() => scrollY)) - y0; r.focus = await focusText(s);
  await s.page.keyboard.type("5"); await sleep(300);
  r.typedInto = await s.page.evaluate(() => [...document.querySelectorAll("#content form input")].filter((i) => i.value.includes("5")).map((i) => `${i.name}=${i.value}`));
}, { touch: false });
// J6 Cancel back to the row (long lists): Expenses (no data-key, page redraws) and Income; Net worth with openUnder (both trees)
await run("J6a-expenses-cancel", "family", "cashflow/expenses", async (s, r) => {
  const rec = () => s.page.locator("#content ul.page-list li").filter({ hasText: "Groceries" }).first();
  await swipeTap(s, rec()); await settle(s.page); await sleep(1500);
  r.rowTopAfterOpen = await topOf(rec()); r.focusAfterOpen = await focusText(s);
  await swipeTap(s, s.page.locator("#content form").getByRole("button", { name: "Cancel", exact: true })); await settle(s.page); await sleep(500);
  r.rowTopAfterCancel = await topOf(rec()); r.rowInView = await inViewNow(rec()); r.focus = await focusText(s);
  await shot(s.page, `${SH}/J6a-${target}.png`);
});
await run("J6b-income-cancel", "family", "cashflow/income", async (s, r) => {
  const rec = () => s.page.locator("#content li").filter({ hasText: "Weekend photography" }).first();
  await swipeTap(s, rec()); await settle(s.page); await sleep(500);
  r.rowTopAfterOpen = await topOf(rec()); r.formTop = await topOf(s.page.locator("#content form").first());
  await swipeTap(s, s.page.locator("#content form").getByRole("button", { name: "Cancel", exact: true })); await settle(s.page); await sleep(500);
  r.rowTopAfterCancel = await topOf(rec()); r.rowInView = await inViewNow(rec()); r.focus = await focusText(s);
});
await run("J6d-contacts-cancel", "familyContacts", "household/contacts", async (s, r) => {
  const edits = s.page.locator("#content li button, #content tr button").filter({ hasText: /^Edit/ });
  r.edits = await edits.count(); if (!r.edits) { r.note = "no Edit on rows"; return; }
  const last = edits.nth(r.edits - 1); const rowText = (await last.evaluate((e) => e.closest("li, tr").textContent.trim().slice(0, 40)));
  r.row = rowText;
  await swipeTap(s, last); await settle(s.page); await sleep(800);
  r.focusAfterOpen = await focusText(s); r.yAfterOpen = await s.page.evaluate(() => Math.round(scrollY));
  await swipeTap(s, s.page.locator("#content form").getByRole("button", { name: "Cancel", exact: true }).first()); await settle(s.page); await sleep(800);
  r.focus = await focusText(s); r.yAfterCancel = await s.page.evaluate(() => Math.round(scrollY));
  r.rowInView = await s.page.locator("#content li, #content tr").filter({ hasText: rowText.slice(0, 20) }).first().evaluate((e) => { const b = e.getBoundingClientRect(); return b.top >= 56 && b.bottom <= innerHeight; }).catch(() => null);
  r.sameNode = await s.page.evaluate(() => document.activeElement?.isConnected ?? null);
});
await run("J6c-networth-under", "family", "balance/net-worth", async (s, r) => {
  const rec = () => s.page.locator("#content .only-narrow li").filter({ hasText: "Ally savings" }).first();
  await swipeTap(s, rec().getByRole("button", { name: "Edit" })); await settle(s.page); await sleep(500);
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=balance]") }).first();
  r.rowAfterEdit = await rect(rec()); r.firstBoxInView = await inViewNow(f.locator("[name=name]")); r.rowInView = await inViewNow(rec());
  await swipeTap(s, f.getByRole("button", { name: "Cancel", exact: true })); await settle(s.page); await sleep(500);
  r.rowInViewAfterCancel = await inViewNow(rec()); r.focus = await focusText(s);
  await swipeTap(s, rec().getByRole("button", { name: "Edit" })); await settle(s.page); await sleep(500);
  await typeIn(s, f.locator("[name=balance]"), "9100");
  await swipeTap(s, f.locator("[type=submit]")); await settle(s.page); await sleep(900);
  r.rowInViewAfterSave = await inViewNow(rec()); r.okInView = (await look(s)).okInView; r.saved = (await planOf(s)).accounts.find((a) => a.name === "Ally savings")?.balance;
});
// J7 Undo: How much to take out, "Plan on $X a month" in the middle of the screen (long page, late draw; x-3)
for (const vh of [844, 664]) await run(`J7-withdrawal-undo-${vh}`, "family", "retirement/withdrawal-strategy", async (s, r) => {
  await sleep(2500); await settle(s.page);
  const planOn = s.page.locator("#content button").filter({ hasText: /^Plan on .* a month$/ }).first();
  if (!(await planOn.count())) { r.note = "no Plan on button"; return; }
  r.button = (await planOn.textContent()).trim();
  const was = (await planOf(s)).retirement?.spendingMonthly ?? (await planOf(s)).retirement?.spending ?? null; r.planBefore = JSON.stringify((await planOf(s)).retirement ?? {}).slice(0, 160);
  await swipeInto(s, planOn, { at: 0.55 }); r.buttonTop = await topOf(planOn);
  await tap(s, planOn); await sleep(1800); await settle(s.page);
  const undo = s.page.locator("#content .notice.ok button").filter({ hasText: /^Undo$/ }).first();
  r.undoShown = (await undo.count()) > 0;
  if (r.undoShown) { r.undoRect = await rect(undo); r.undoInView = await inViewNow(undo); r.noteText = (await undo.evaluate((e) => e.closest(".notice").textContent)).trim().slice(0, 160); r.noteTop = await undo.evaluate((e) => Math.round(e.closest(".notice").getBoundingClientRect().top)); }
  r.planAfter = JSON.stringify((await planOf(s)).retirement ?? {}).slice(0, 160);
  await shot(s.page, `${SH}/J7-${vh}-${target}.png`);
  await sleep(5000); r.undoStillAfter5s = (await undo.count()) > 0;
  if (r.undoShown) { await swipeTap(s, undo); await sleep(1500); await settle(s.page); r.planAfterUndo = JSON.stringify((await planOf(s)).retirement ?? {}).slice(0, 160); r.okInView = (await look(s)).okInView; r.restored = r.planAfterUndo === r.planBefore; }
}, { viewport: { width: 390, height: vh } });
// J8 Rent or buy, Compare twice with a new price (long page; the answer above the form; F6, DP-1)
await run("J8-rentvsbuy-compare", "renterDebt", "property/rent-vs-buy", async (s, r) => {
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=price]") }).first();
  const fold = s.page.locator("#content details.fold").filter({ has: s.page.locator("[name=price]") }).first();
  if (!(await fold.evaluate((d) => d.open))) { await swipeTap(s, fold.locator("summary")); await sleep(400); }
  for (const price of ["350000", "420000"]) {
    if (!(await fold.evaluate((d) => d.open))) { await swipeTap(s, fold.locator("summary")); await sleep(400); }
    await typeIn(s, f.locator("[name=price]"), price);
    await swipeTap(s, f.locator("[type=submit]")); await sleep(1500); await settle(s.page);
    const card = s.page.locator("#content section.card").filter({ hasText: /^After \d+ years/ }).first();
    const c = { price, cardTop: await topOf(card), cardInView: await card.evaluate((e) => { const tb = document.getElementById("topbar").getBoundingClientRect().bottom; const b = e.getBoundingClientRect(); return b.top >= tb - 1 && b.top < innerHeight - 100; }), savedInCard: (await card.textContent()).includes("Saved."), figuresOpen: await fold.evaluate((d) => d.open), y: await s.page.evaluate(() => Math.round(scrollY)) };
    r[`compare_${price}`] = c;
    await shot(s.page, `${SH}/J8-${price}-${target}.png`);
    await drag(s, 500);
  }
  r.savedPrice = (await planOf(s)).whatIfs?.rentVsBuy?.price ?? null;
});
// J9 Pay off debts: "50.." typed key by key in a box in no form, tap the next control, then Save plan (D2, x-1, x-3)
await run("J9-payoff-junk", "renterDebt", "debt/payoff", async (s, r) => {
  const extra = s.page.locator("#content").getByLabel("Extra each month").first();
  const savedBefore = JSON.stringify((await planOf(s)).debtPlan ?? (await planOf(s)).debt ?? {}).slice(0, 120);
  await swipeTap(s, extra); await clearFocused(s); await s.page.keyboard.type("50..", { delay: 70 }); await sleep(450);
  r.whileTyping = { fieldErrors: (await look(s)).fieldErrors.map((x) => x.text), focus: await focusText(s), value: await valueOf(extra) };
  const order = s.page.locator("#content").getByLabel("Order").first(); await swipeInto(s, order); const t0 = await topOf(order);
  await tap(s, order); await sleep(600);
  r.afterTapNext = { focus: await focusText(s), orderMoved: (await topOf(order)) - t0, fieldErrors: (await look(s)).fieldErrors.map((x) => `${x.text} [${x.inView ? "in view" : "off"}]`) };
  await s.page.keyboard.press("Escape").catch(() => {});
  await resetLog(s); await swipeTap(s, btn(s, "Save plan")); await sleep(700);
  r.afterSave = trim(await look(s));
  r.planUnchanged = JSON.stringify((await planOf(s)).debtPlan ?? (await planOf(s)).debt ?? {}).slice(0, 120) === savedBefore;
  await shot(s.page, `${SH}/J9-${target}.png`);
});
// J10 Update my balances: "abc" then Save (a hand-built form; T6, INV-3)
await run("J10-update-abc", "renterDebt", "balance/update", async (s, r) => {
  const first = s.page.locator("#content form input[type=text]").first(); await typeIn(s, first, "abc");
  await resetLog(s); await swipeTap(s, s.page.locator("#content form [type=submit]").first()); await sleep(600);
  r.after = trim(await look(s));
  await shot(s.page, `${SH}/J10-${target}.png`);
});
// J11 Vehicles: Add car with a name only; miles "11,200" typed (DP-2, W6)
await run("J11-vehicles", "family", "property/vehicles", async (s, r) => {
  const opener = s.page.locator("#content summary").filter({ hasText: /^Add a car/ }).first(); if ((await opener.count()) && !(await opener.evaluate((e) => e.parentElement.open))) { await swipeTap(s, opener); await sleep(400); }
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=milesYear]") }).last();
  await typeIn(s, f.locator("[name=name]"), "Van");
  await typeIn(s, f.locator("[name=milesYear]"), "11,200"); r.milesTyped = await valueOf(f.locator("[name=milesYear]"));
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]")); await sleep(600);
  r.addNameOnly = trim(await look(s));
  await typeIn(s, f.locator("[name=value]"), "18000");
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]")); await sleep(900); await settle(s.page);
  r.afterValue = trim(await look(s));
  const p = await planOf(s); const van = JSON.stringify(p).match(/"name":"Van"[^}]*/)?.[0] ?? null; r.savedVan = van ? van.slice(0, 200) : null;
  await shot(s.page, `${SH}/J11-${target}.png`);
});
// J12 Employer stock: a page's own words (setCustomValidity) on symbol "acme!!" (blank household; INV-10 kept)
await run("J12-employer-stock-symbol", "blank", "investments/employer-stock", async (s, r) => {
  const sym = s.page.locator("#content input[name=symbol]").first();
  if (!(await sym.count())) { r.note = "no symbol box"; r.buttons = await s.page.evaluate(() => [...document.querySelectorAll("#content button, #content summary")].map((b) => b.textContent.trim().slice(0, 30)).slice(0, 12)); return; }
  await typeIn(s, sym, "acme!!");
  const f = s.page.locator("#content form").filter({ has: s.page.locator("input[name=symbol]") }).first();
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]")); await sleep(600);
  r.after = trim(await look(s));
});

// J13 Contributions (long page): the page's own refusal "That isn't an amount" for "abc" (FF1 pattern, form.prepend)
await run("J13-contributions-refusal", "family", "retirement/contributions", async (s, r) => {
  const add = byTextLoc(s, /^\+ Add another contribution$/); if (await add.count()) { await swipeTap(s, add); await settle(s.page); await sleep(400); }
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=amount]") }).last();
  r.amountType = await f.locator("[name=amount]").evaluate((e) => e.type);
  await typeIn(s, f.locator("[name=amount]"), "abc");
  const sub = f.locator("[type=submit]"); await swipeInto(s, sub); r.save0 = await topOf(sub);
  await resetLog(s); await tap(s, sub); await sleep(500); r.save1 = await topOf(sub);
  r.after = trim(await look(s));
  await tap(s, sub); await sleep(500); r.save2 = await topOf(sub); r.after2 = trim(await look(s));
  await shot(s.page, `${SH}/J13-${target}.png`);
});
// J14 Advisor's plan (heavy: draws its answer late): Compare with nothing typed, then wait for the late draw (RC-1 kept)
await run("J14-advisor-empty", "family", "scenarios/advisor-plan", async (s, r) => {
  await sleep(2500); await settle(s.page);
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[type=submit]") }).last();
  r.submit = (await f.locator("[type=submit]").textContent().catch(() => "")).trim();
  r.fields = await f.evaluate((x) => [...x.elements].filter((e) => e.name).map((e) => `${e.name}:${e.type}${e.required ? "*" : ""}`).join(", ")).catch(() => null);
  await resetLog(s); await swipeTap(s, f.locator("[type=submit]")); await sleep(500);
  r.after = trim(await look(s));
  await sleep(4000); await settle(s.page);
  r.after4s = trim(await look(s));
  await shot(s.page, `${SH}/J14-${target}.png`);
});
function byTextLoc(s, re) { return s.page.locator("#content button, #content summary").filter({ hasText: re }).first(); }
function trim(l) { return { y: l.y, focus: l.focus, labelShown: l.labelShown, bubbles: l.bubbles, invalidEvents: l.invalidEvents, fieldErrors: l.fieldErrors.map((x) => `${x.text} [${x.inView ? "in view" : "off"}${x.color === "rgb(185, 28, 28)" ? ", red" : ""}]`), formErrors: l.formErrors.map((x) => `${x.text} [${x.inView ? "in view" : "off"} @${x.top}]`), okInView: l.okInView }; }
fs.writeFileSync(`${J}/out/j-${target}${only.length ? "-" + only.join("+") : ""}.json`, JSON.stringify(out, null, 1));
