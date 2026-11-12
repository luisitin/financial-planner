// j-draft.mjs <A|B|T> [only] -- typing memory on short forms (SH-DRAFT), at a person's pace, the same for every design.
// A fresh browser per journey. Real finger drags, taps at screen points, keys one at a time (80 ms). Only what a person
// sees is read: the values in the boxes, the words "not saved yet" on the screen or in the bottom note, the address,
// and (for the guards) what the saved plan holds and whether a typed secret reached the tab's storage.
import fs from "node:fs";
import { H, start, swipe, Y, sleep, settle, state, phoneBack, phoneForward, reload, seen, bring, thumb, type, look, menuTo, planOf, shot, J } from "./lib.mjs";
const who = process.argv[2] ?? "A", only = process.argv[3] ?? null;
const rows = [];
const vis = (p, sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((c) => c.getClientRects().length && !c.closest("details:not([open])")).map((c) => (c.type === "checkbox" ? String(c.checked) : c.value)), sel);
const tapRow = async (s, text) => { const e = await thumb(s, "li, [role=button], .rec, tr, a, button", { text }); await sleep(800); await settle(s.page); return e; };
const tapBtn = async (s, text, sel = "button, a") => { const e = await thumb(s, sel, { text }); await sleep(800); await settle(s.page); return e; };
const openFold = async (s, text) => { if (await seen(s.page, "details:not([open]) > summary", { text })) { await thumb(s, "details:not([open]) > summary", { text }); await sleep(450); } };
/** The form is shut on return: do what a person does. Tap a button that says "Open it" if the screen offers one, else the opener. */
async function reopen(s, opener) {
  const open = await seen(s.page, "button, a", { text: "Open it" });
  if (open) { await bring(s, "button, a", { text: "Open it" }); const e = await seen(s.page, "button, a", { text: "Open it" }); await s.page.touchscreen.tap(e.x, e.y); await sleep(900); await settle(s.page); return "Open it"; }
  await tapRow(s, opener); return opener;
}
async function run(name, hh, route, fn, { plan = null } = {}) {
  if (only && !new RegExp(only).test(name)) return;
  const s = await start(who, plan ?? H[hh](), route);
  try { await sleep(700); const r = await fn(s, s.page); rows.push({ name, ...r, err: s.pageErrors.length ? s.pageErrors[0].slice(0, 80) : 0 }); }
  catch (e) { rows.push({ name, error: String(e.message).split("\n")[0].slice(0, 160) }); }
  try { await s.close(); } catch { }
}
const NA = "#content input[name=name], #content input[name=amount]";

// D1 Income: "+ Add another income", type, leave by the menu, phone Back; then a person gets the typing back. [CF-2, INV-4, FF2 leaving]
await run("D1 income add, menu, Back", "family", "cashflow/income", async (s, p) => {
  await tapBtn(s, "+ Add another income");
  await type(s, "input[name=name]", "Weekend tutoring");
  await type(s, "input[name=amount]", "1200", { clear: true });
  const before = (await vis(p, NA)).join("|");
  await menuTo(s, "Dashboard"); await phoneBack(s, 1500);
  const l = await look(p); const shown = (await vis(p, NA)).join("|");
  let how = "shown", after = shown;
  if (!shown.includes("tutoring")) { how = await reopen(s, "+ Add another income"); after = (await vis(p, NA)).join("|"); }
  const l2 = await look(p);
  return { before, onReturn: shown || "(form shut)", words: l.notSavedOnScreen + "/" + l.notSaved, how, after, kept: after === before, hint: l2.notSaved > 0, note: l.note };
});
// D2 Update my balances: type two, "Continue" under Save, phone Back. [p-balance/B1, j-navigator/x-2]
await run("D2 update, continue, Back", "family", "balance/update", async (s, p) => {
  await type(s, "input[name=a-chk]", "3900", { clear: true });
  await type(s, "input[name=a-sav]", "9999", { clear: true });
  const sel = "#content input[name=a-chk], #content input[name=a-sav]";
  const before = (await vis(p, sel)).join("|");
  const row = await bring(s, "nav.gb-cont a", {}); if (!row) throw new Error("no continue row");
  await p.touchscreen.tap(row.x, row.y); await sleep(1100); await settle(p);
  const mid = (await state(p)).hash;
  await phoneBack(s, 1500);
  const after = (await vis(p, sel)).join("|"); const l = await look(p);
  return { before, mid, after, kept: after === before, hint: l.notSaved > 0, words: l.notSavedOnScreen + "/" + l.notSaved };
});
// D3 Update my balances: type two, reload the tab. [j-monthly-return/x-typed-lost (reload), j-navigator/N1 reload]
await run("D3 update, reload", "family", "balance/update", async (s, p) => {
  await type(s, "input[name=a-chk]", "3900", { clear: true });
  await type(s, "input[name=a-brk]", "18950", { clear: true });
  const sel = "#content input[name=a-chk], #content input[name=a-brk]";
  const y0 = await Y(p); const before = (await vis(p, sel)).join("|");
  await reload(s);
  const after = (await vis(p, sel)).join("|"); const l = await look(p);
  return { before, after, kept: after === before, y0, y1: await Y(p), hint: l.notSaved > 0 };
});
// D4 Health: type in "Add a plan", then Save the coverage form. [p-insurance-estate/x-1]
await run("D4 health, save the other form", "family", "insurance/health", async (s, p) => {
  await type(s, "input[name=name]", "Silver PPO");
  await type(s, "input[name=premium]", "250", { clear: true });
  const sel = "#content form input[name=name], #content form input[name=premium]";
  const before = (await vis(p, sel)).join("|");
  await openFold(s, "Your coverage");
  await bring(s, "select[name=tier]", {});
  await p.selectOption("#content select[name=tier]", { index: 1 }); await sleep(250);
  await thumb(s, "details[open] button[type=submit]", { text: "Save" }); await sleep(900); await settle(p);
  const after = (await vis(p, sel)).join("|"); const l = await look(p);
  return { before, after, kept: after === before, hint: l.notSaved > 0, plans: (await planOf(p)).insurance?.health?.plans?.length ?? null };
});
// D5 Estimated payments: a quarter typed, then Save "Last year's return"; then "Undo my typing" if offered. [p-taxes/T1, person 2]
await run("D5 estimated, save the other form, undo", "family", "taxes/estimated", async (s, p) => {
  const drawn = (await vis(p, "#content input[name=q0]")).join("|");
  await type(s, "input[name=q0]", "1000", { clear: true });
  await openFold(s, "Last year");
  await type(s, "input[name=tax]", "9000", { clear: true });
  const before = (await vis(p, "#content input[name=q0]")).join("|");
  await thumb(s, "details[open] button[type=submit]", {}); await sleep(900); await settle(p);
  const after = (await vis(p, "#content input[name=q0]")).join("|"); const l = await look(p);
  let undo = null;
  if (await seen(p, "button", { text: "Undo my typing" })) { await thumb(s, "button", { text: "Undo my typing" }); await sleep(700); await settle(p); undo = (await vis(p, "#content input[name=q0]")).join("|") === drawn ? "back to drawn" : "NOT back: " + (await vis(p, "#content input[name=q0]")).join("|"); }
  return { drawn, before, after, kept: after === before, hint: l.notSaved > 0, undo, paid: JSON.stringify((await planOf(p)).taxes?.estimated?.paid ?? null).slice(0, 40) };
});
// D6 Income: Ana's salary form, change Amount and Yearly raise, a stray tap on Bo's row: Bo's form must show Bo's saved
// figures; Bo's new amount saved; then Ana's row again: her typing back? [j-fat-fingers/FF2, break K1/B-blocking 1]
await run("D6 income stray row", "family", "cashflow/income", async (s, p) => {
  const plan0 = await planOf(p); const bo0 = plan0.income.find((i) => /^Bo/.test(i.name));
  await tapRow(s, "Ana's salary");
  await type(s, "input[name=amount]", "4100", { clear: true });
  const hasGrowth = !!(await seen(p, "input[name=growth]"));
  if (hasGrowth) await type(s, "input[name=growth]", "6", { clear: true });
  await tapRow(s, "Bo's salary");
  const boForm = await p.evaluate(() => { const f = document.querySelector("#content form"); return f ? { amount: f.amount?.value, growth: f.growth?.value } : null; });
  const l = await look(p);
  await type(s, "input[name=amount]", "5400", { clear: true });
  await tapBtn(s, "Save", "button");
  const bo1 = (await planOf(p)).income.find((i) => /^Bo/.test(i.name));
  await tapRow(s, "Ana's salary");
  const ana = await p.evaluate(() => { const f = document.querySelector("#content form"); return f ? { amount: f.amount?.value, growth: f.growth?.value } : null; });
  const l2 = await look(p);
  return { bo0: `${bo0.amount}/${bo0.growth}`, boFormAtStray: JSON.stringify(boForm), noteAtStray: l.note, boSaved: `${bo1.amount}/${bo1.growth}`, boGrowthKept: bo1.growth === bo0.growth, anaAgain: JSON.stringify(ana), anaKept: ana?.amount?.replace(/,/g, "") === "4100", hint: l2.notSaved > 0 };
});
// D7 Debts (renter): Store card form, type rate and minimum, phone Back (leaves), Forward. [j-debt-fixer/x-2, CF-3]
await run("D7 debt form, Back, Forward", "renterDebt", "balance/liabilities", async (s, p) => {
  await tapRow(s, "Store card");
  await type(s, "input[name=rate]", "19.9", { clear: true });
  await type(s, "input[name=minPayment]", "95", { clear: true });
  const sel = "#content input[name=rate], #content input[name=minPayment]";
  const before = (await vis(p, sel)).join("|");
  await phoneBack(s, 1500); const mid = (await state(p)).hash;
  await phoneForward(s, 1500);
  const shown = (await vis(p, sel)).join("|"); const l = await look(p);
  let how = "shown", after = shown;
  if (!shown) { how = await reopen(s, "Store card"); after = (await vis(p, sel)).join("|"); }
  return { before, mid, onReturn: shown || "(form shut)", words: l.notSavedOnScreen + "/" + l.notSaved, how, after, kept: after === before };
});
// D8 Monthly check-in: a note typed on October, the November chip, back on October. [j-monthly-return/x-typed-lost]
{
  const plan = H.family(); for (const a of plan.accounts) { a.asOf = "2026-10-09"; if (Array.isArray(a.history)) for (const h of a.history) if (h.date === "2026-11-11") h.date = "2026-10-09"; }
  await run("D8 check-in note across month chips", "family", "overview/monthly-review", async (s, p) => {
    const chips = () => p.evaluate(() => [...document.querySelectorAll("#content .chips .chip")].map((c) => c.textContent + (c.classList.contains("on") ? "*" : "")));
    const note = () => p.evaluate(() => { const t = [...document.querySelectorAll("#content textarea")].find((x) => x.getClientRects().length); return t ? t.value : null; });
    let ok = (await note()) !== null;
    for (const c of await chips()) { if (ok) break; const e = await bring(s, ".chips .chip", { text: c.replace("*", "") }); await p.touchscreen.tap(e.x, e.y); await sleep(900); await settle(p); ok = (await note()) !== null; }
    if (!ok) throw new Error("no note box on any month");
    const first = (await chips()).find((c) => c.endsWith("*")).replace("*", "");
    const t = await bring(s, "textarea", {}); await p.touchscreen.tap(t.x, t.y); await sleep(200);
    await p.keyboard.type("Car repair 800", { delay: 80 }); await sleep(500);
    const other = (await chips()).find((c) => !c.endsWith("*"));
    let e = await bring(s, ".chips .chip", { text: other }); await p.touchscreen.tap(e.x, e.y); await sleep(1000); await settle(p);
    const onOther = await note(); const lo = await look(p);
    e = await bring(s, ".chips .chip", { text: first }); await p.touchscreen.tap(e.x, e.y); await sleep(1000); await settle(p);
    const back = await note(); const l = await look(p);
    return { month: first, other, onOther: JSON.stringify(onOther), wordsOnOther: lo.notSaved, back: JSON.stringify(back), kept: back === "Car repair 800", hint: l.notSaved > 0 };
  }, { plan });
}
// D9 Update my balances: three typed, menu away, the house's value saved elsewhere, Back. [break K5b: one changed figure]
await run("D9 one figure changed elsewhere", "family", "balance/update", async (s, p) => {
  const all = () => p.evaluate(() => [...document.querySelectorAll("#content form input")].filter((i) => i.getClientRects().length).slice(0, 5).map((i) => i.value).join("|"));
  const drawn = await all();
  const typeIn = async (nth, v) => { const e = await p.evaluate((nth) => { const i = [...document.querySelectorAll("#content form input")].filter((i) => i.getClientRects().length)[nth]; const r = i.getBoundingClientRect(); return { y: r.top + r.height / 2, x: r.left + 40 }; }, nth); if (e.y < 120 || e.y > 640) { await swipe(s, e.y - 400); } const f = await p.evaluate((nth) => { const i = [...document.querySelectorAll("#content form input")].filter((i) => i.getClientRects().length)[nth]; const r = i.getBoundingClientRect(); return { y: r.top + r.height / 2, x: r.left + 40 }; }, nth); await p.touchscreen.tap(f.x, f.y); await sleep(150); await p.keyboard.press("Control+A"); await p.keyboard.press("Delete"); await p.keyboard.type(v, { delay: 80 }); };
  await typeIn(1, "91000"); await typeIn(2, "43000"); await typeIn(3, "32000"); await sleep(500);
  const typed = await all();
  await menuTo(s, "Dashboard"); await sleep(500);
  await p.evaluate(async () => { const { store } = await import("/core/store.js"); store.update((d) => { const h = d.accounts.find((a) => /house|home/i.test(a.name)); if (h) h.balance = 395000; }); });
  await sleep(900);
  await phoneBack(s, 1500);
  const after = await all(); const l = await look(p);
  const t = typed.split("|"), a = after.split("|");
  return { drawn, typed, after, typedKept: [1, 2, 3].filter((i) => a[i] === t[i]).length + "/3", hint: l.notSaved > 0, words: l.kept.join(" / ").slice(0, 100), note: l.note };
});
// D10 Net worth: "+ Add another account" typed, then "Save today's totals" (another save on the page). [p-balance/x-1]
await run("D10 net worth add form, other save", "family", "balance/net-worth", async (s, p) => {
  if (!(await seen(p, "button, a", { text: "+ Add another account" }))) throw new Error("no '+ Add another account'");
  await tapBtn(s, "+ Add another account");
  await type(s, "form input[name=name]", "Brokerage two");
  await type(s, "form input[name=balance]", "12000", { clear: true });
  const sel = "#content form input[name=name], #content form input[name=balance]";
  const before = (await vis(p, sel)).join("|");
  if (!(await seen(p, "button", { text: "Save today" }))) throw new Error("no 'Save today's totals'");
  await tapBtn(s, "Save today", "button");
  const shown = (await vis(p, sel)).join("|"); const l = await look(p);
  let how = "shown", after = shown;
  if (!shown.includes("Brokerage")) { how = await reopen(s, "+ Add another account"); after = (await vis(p, sel)).join("|"); }
  return { before, onSave: shown || "(form shut)", words: l.notSaved, how, after, kept: after === before };
});
// D11 No phantom: Income, Ana's form typed, phone Back to the Dashboard: no "not saved" words there; Forward; the
// Dashboard again by the menu. [person B1 / break 3]
await run("D11 no phantom words", "family", "overview/dashboard", async (s, p) => {
  await p.evaluate(() => { location.hash = "#/cashflow/income"; }); await sleep(1200); await settle(p);
  await tapRow(s, "Ana's salary");
  await type(s, "input[name=amount]", "9999", { clear: true }); await sleep(600);
  await phoneBack(s, 1500); const d1 = await look(p);
  await phoneForward(s, 1500); const inc = await look(p);
  await menuTo(s, "Dashboard"); const d2 = await look(p);
  return { dashOnBack: d1.notSaved + (d1.note && /not saved/i.test(d1.note) ? "+note" : ""), incomeOnForward: inc.notSaved, dashByMenu: d2.notSaved, phantom: d1.notSaved + d2.notSaved > 0 };
});
// D12 Secrets: Settings' key box typed, leave by the menu, back: box empty, nothing in the tab's storage. [break K6, AGENTS 10]
await run("D12 secret never kept", "family", "system/settings", async (s, p) => {
  const box = "apiKey";
  for (let k = 0; k < 4; k++) {
    const sm = await p.evaluate(() => { const ds = []; for (let d = document.querySelector("#content input[name=apiKey]")?.closest("details"); d; d = d.parentElement?.closest("details")) ds.unshift(d); const d = ds.find((x) => !x.open); if (!d) return null; const r = d.querySelector(":scope > summary").getBoundingClientRect(); return { y: r.top + r.height / 2 + scrollY }; });
    if (!sm) break;
    const y = await Y(p); if (sm.y - y < 120 || sm.y - y > 640) await swipe(s, sm.y - y - 400);
    const y2 = await Y(p); await p.touchscreen.tap(120, sm.y - y2); await sleep(600);
  }
  for (const name of ["apiKey"]) { const e = await bring(s, `input[name=${name}]`, {}); if (!e) throw new Error("no box " + name); await s.page.touchscreen.tap(e.x, e.y); await sleep(200); await p.keyboard.type("sk-test-SECRET123", { delay: 60 }); await sleep(400); }
  await sleep(500);
  await menuTo(s, "Dashboard"); await phoneBack(s, 1500);
  const stored = await p.evaluate(() => { let hit = false; for (let i = 0; i < sessionStorage.length; i++) if ((sessionStorage.getItem(sessionStorage.key(i)) ?? "").includes("SECRET123")) hit = true; return hit; });
  const shown = await p.evaluate(() => [...document.querySelectorAll("#content input")].some((c) => c.value.includes("SECRET123")));
  return { box, storedInTab: stored, shownAgain: shown, ok: !stored && !shown };
});
// D13 Get started (mid-setup), a question with boxes, typed, the tab reloads: no false claim, figures back. [j09, F2]
await run("D13 get started reload", "samMidSetup", "overview/setup/have-amounts", async (s, p) => {
  const boxes = await p.evaluate(() => [...document.querySelectorAll("#content input:not([type=hidden]):not([type=checkbox]):not([type=radio])")].filter((c) => c.getClientRects().length).map((c) => c.getAttribute("aria-label") || c.name || c.id).filter(Boolean).slice(0, 3));
  if (!boxes.length) throw new Error("no boxes on " + (await state(p)).hash);
  for (const [i, b] of boxes.entries()) await type(s, `input[aria-label="${b}"], input[name="${b}"]`, String([5200, 12000, 90000][i]), { clear: true });
  const sel = boxes.map((b) => `#content input[aria-label="${b}"], #content input[name="${b}"]`).join(", ");
  const before = (await vis(p, sel)).join("|"); const at = (await state(p)).hash;
  await reload(s);
  const after = (await vis(p, sel)).join("|"); const l = await look(p);
  return { at, before, after, kept: after === before, words: l.kept.join(" / ").slice(0, 90) || null };
});
// D14 Paycheck (two W-4 forms alike): 120 in Ana's health box, menu away and back by the menu, Save Ana's, Save Bo's:
// the plan holds only Ana's 120. [break K1, twins]
await run("D14 paycheck twins", "family", "cashflow/paycheck", async (s, p) => {
  const read = () => p.evaluate(() => [...document.querySelectorAll("#content details")].filter((d) => /W-4/.test(d.querySelector("summary")?.textContent ?? "")).map((d) => ({ who: (d.querySelector("summary h2, summary .fold-title")?.textContent ?? d.querySelector("summary").textContent).trim().slice(0, 3), open: d.open, health: [...d.querySelectorAll("input")].find((i) => /Health, dental/i.test(i.closest("label")?.textContent ?? ""))?.value ?? null })));
  await thumb(s, "details > summary", { text: "W-4" }); await sleep(500);
  const tapHealth = async (nth) => { const e = await p.evaluate((nth) => { const i = [...document.querySelectorAll("#content details[open] input")].filter((i) => /Health, dental/i.test(i.closest("label")?.textContent ?? ""))[nth]; if (!i) return null; const r = i.getBoundingClientRect(); return { y: r.top + r.height / 2, x: r.left + 20 }; }, nth); if (!e) throw new Error("no health box"); if (e.y < 120 || e.y > 640) await swipe(s, e.y - 400); const f = await p.evaluate((nth) => { const i = [...document.querySelectorAll("#content details[open] input")].filter((i) => /Health, dental/i.test(i.closest("label")?.textContent ?? ""))[nth]; const r = i.getBoundingClientRect(); return { y: r.top + r.height / 2, x: r.left + 20 }; }, nth); await p.touchscreen.tap(f.x, f.y); await sleep(150); };
  await tapHealth(0); await p.keyboard.press("Control+A"); await p.keyboard.type("120", { delay: 80 }); await sleep(500);
  const typed = JSON.stringify(await read());
  await menuTo(s, "Dashboard"); await sleep(400); await menuTo(s, "Paycheck"); await sleep(800);
  const back = await read();
  const saveIn = async (i) => { const b = await p.evaluate((i) => { const d = [...document.querySelectorAll("#content details")].filter((d) => /W-4/.test(d.querySelector("summary")?.textContent ?? ""))[i]; if (!d) return null; d.open = true; const b = d.querySelector("form button[type=submit], form button:not([type])"); b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; }, i); if (!b) return; await sleep(300); await p.touchscreen.tap(b.x, b.y); await sleep(1200); await settle(p); };
  await saveIn(0); await saveIn(1);
  const plan = await planOf(p);
  const pc = Object.fromEntries(Object.entries(plan.whatIfs?.paycheck ?? {}).map(([k, v]) => [k, v.health ?? null]));
  return { typed: typed.slice(0, 90), backByMenu: JSON.stringify(back).slice(0, 110), plan: JSON.stringify(pc), boClean: !Object.entries(pc).some(([k, v]) => !/ana|p-?1|a$/i.test(k) && Number(v) === 120) };
});
// D15 Import: paste a bank file, Import (the tap saves and leaves), a new visit: no "not saved" over what was imported. [break should-fix 4]
await run("D15 import then new visit", "family", "transactions/import", async (s, p) => {
  const csv = fs.readFileSync(`${J}/T/qa/fixtures/chase-checking.csv`, "utf8");
  const ta = await bring(s, "textarea", {}); if (!ta) throw new Error("no paste box");
  await p.touchscreen.tap(ta.x, ta.y); await sleep(200); await p.keyboard.insertText(csv); await sleep(400);
  await tapBtn(s, "Use the pasted text", "button");
  await tapBtn(s, "Import ", "button"); await sleep(600);
  const n1 = ((await planOf(p)).transactions ?? []).length;
  await menuTo(s, "Dashboard"); await menuTo(s, "Import");
  const l = await look(p);
  const paste = await p.evaluate(() => [...document.querySelectorAll("#content textarea")].map((t) => t.value.length).join(","));
  return { imported: n1, pasteBoxLen: paste, words: l.notSaved, ok: l.notSaved === 0 && !/[1-9]/.test(paste) };
});

fs.mkdirSync(`${J}/out`, { recursive: true });
fs.writeFileSync(`${J}/out/draft-${who}.json`, JSON.stringify(rows, null, 1));
for (const r of rows) console.log(who, JSON.stringify(r));
