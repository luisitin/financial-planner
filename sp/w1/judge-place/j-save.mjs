// j-save.mjs <A|B|T> [only] -- a save that keeps the page as it was (SH-REDRAW), the ways back on the screen (B4), and the
// hazards the critics found, the same for every design. A fresh browser per journey; real drags, taps at screen points,
// keys one at a time. Read only what a person sees: where the tapped thing is on the screen, which sections are open,
// whether a confirmation can be read (the page's own line, or the short note at the bottom/top), whether anything moves
// by itself, the address and the history length.
import fs from "node:fs";
import { H, start, swipe, Y, sleep, settle, state, phoneBack, phoneForward, reload, seen, bring, thumb, type, look, menuTo, planOf, openFolds, watch, moves, blank, shot, J } from "./lib.mjs";
const who = process.argv[2] ?? "A", only = process.argv[3] ?? null;
const rows = [];
const hist = (p) => p.evaluate(() => history.length);
const openFold = async (s, text) => { if (await seen(s.page, "details:not([open]) > summary", { text })) { await thumb(s, "details:not([open]) > summary", { text }); await sleep(500); } };
const topOf = (p, sel, text, nth = 0) => p.evaluate(([sel, text, nth]) => { const e = [...document.querySelectorAll("#content " + sel)].filter((e) => e.getClientRects().length && !e.closest("details:not([open])") && (text === null || e.textContent.replace(/\s+/g, " ").trim().includes(text)))[nth]; return e ? Math.round(e.getBoundingClientRect().top) : null; }, [sel, text, nth]);
/** Can the person read a confirmation now? The page's own green/red line (60% of it between the top bar and the bottom), or the short note. */
const confirm = (p) => p.evaluate(() => {
  const tb = document.getElementById("topbar")?.getBoundingClientRect().bottom ?? 0;
  const shut = (n) => !!n.closest("details:not([open])");
  const own = [...document.querySelectorAll("#content .notice.ok, #content .notice.error")].filter((n) => n.getClientRects().length && !shut(n)).map((n) => { const r = n.getBoundingClientRect(); const inn = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, tb)); return { t: n.textContent.replace(/\s+/g, " ").trim().slice(0, 50), read: inn >= Math.min(48, r.height * 0.6) }; });
  const e = document.querySelector(".save-echo"); const er = e?.getBoundingClientRect();
  const note = e && er.height > 0 && er.bottom > 0 && er.top < innerHeight ? { t: e.textContent.replace(/\s+/g, " ").trim().slice(0, 90), at: er.top < innerHeight / 2 ? "top" : "bottom", ways: [...e.querySelectorAll("a, button")].map((w) => w.textContent.replace(/\s+/g, " ").trim().slice(0, 40)) } : null;
  return { own, ownReadable: own.some((n) => n.read), note, readable: own.some((n) => n.read) || !!note };
});
async function run(name, hh, route, fn, { plan = null, slow = 1 } = {}) {
  if (only && !new RegExp(only).test(name)) return;
  const s = await start(who, plan ?? H[hh](), route, { slow });
  try { await sleep(800); const r = await fn(s, s.page); rows.push({ name, ...r, err: s.pageErrors.length ? s.pageErrors[0].slice(0, 80) : 0 }); }
  catch (e) { rows.push({ name, error: String(e.message).split("\n")[0].slice(0, 160) }); }
  try { await s.close(); } catch { }
}
/** Tap the button and measure: did it stay under the thumb, are the sections still open, can a confirmation be read, does anything move for 5 s? */
async function saveAt(s, p, { sel = "button", text = null, nth = 0, fold = null, after = null }) {
  const e = await bring(s, sel, { text, nth }); if (!e) throw new Error("no button " + (text ?? sel));
  const folds0 = await openFolds(p);
  await p.touchscreen.tap(e.x, e.y);
  await sleep(700); await settle(p);
  const now = after ? await topOf(p, after.sel, after.text ?? null, after.nth ?? 0) : await topOf(p, sel, text, nth);
  const c = await confirm(p); const folds1 = await openFolds(p);
  const w = await watch(p, 4500); const later = await confirm(p);
  return { tappedAt: e.top, nowAt: now, moved: now === null ? "gone" : now - e.top, foldKept: fold ? folds1.some((f) => f.startsWith(fold)) : null, foldsLost: folds0.filter((f) => !folds1.includes(f)).length, readable: c.readable, how: c.ownReadable ? "page line" : c.note ? `note ${c.note.at} [${c.note.ways.join(" | ")}]` : "none", movedBy5s: moves(w), stillReadable5s: later.readable, blank: await blank(p) };
}

// R1 Will the money last?: Retirement settings, change the spending, Save settings. [j-one-answer/x-2, R-A4, j-first-freelancer/x-1]
await run("R1 projection settings save", "family", "retirement/projection", async (s, p) => {
  await sleep(900); await openFold(s, "Retirement settings");
  await type(s, "input[name=spendingMonthly]", "5100", { clear: true });
  return saveAt(s, p, { text: "Save settings", fold: "Retirement settings" });
});
// R2 Update my balances: one balance typed, "Save all balances". [MR-1, p-balance/B2]
await run("R2 update balances save", "family", "balance/update", async (s, p) => {
  await type(s, "input[name=a-chk]", "3900", { clear: true });
  return saveAt(s, p, { text: "Save all balances" });
});
// R3 Buckets: Save inside "Years in each bucket". [p-retirement-b/RB1, j-first-freelancer/x-1]
await run("R3 buckets years save", "family", "retirement/buckets", async (s, p) => {
  await sleep(600); await openFold(s, "Years in each bucket");
  await type(s, "input[name=cashYears]", "3", { clear: true });
  return saveAt(s, p, { sel: "details[open] button[type=submit]", fold: "Years in each bucket" });
});
// R4 How much to take out: the second "Use this one" (the page brings its own line into view: the page must win). [p-retirement-b/x-1]
await run("R4 withdrawal use this (page wins)", "ruth", "retirement/withdrawal-strategy", async (s, p) => {
  await sleep(900);
  const r = await saveAt(s, p, { text: "Use this one", nth: 1 });
  const dupe = await p.evaluate(() => { const e = document.querySelector(".save-echo"); return !!(e && e.getClientRects().length); });
  return { ...r, noteToo: dupe };
});
// R5 Federal estimate: wages typed in one section, Save in another section. [p-taxes/T1 (b)]
await run("R5 federal two sections", "family", "taxes/federal", async (s, p) => {
  await openFold(s, "Figures the plan cannot see");
  await type(s, "input[name=wages]", "98000", { clear: true });
  await openFold(s, "Year and people");
  await type(s, "input[name=blind]", "1", { clear: true });
  const r = await saveAt(s, p, { sel: "details[open] button[type=submit]", text: "Save", nth: 1, fold: "Figures the plan cannot see" });
  const wages = await p.evaluate(() => document.querySelector("#content input[name=wages]")?.value ?? null);
  return { ...r, wagesKept: wages === "98,000" || wages === "98000", wages };
});
// R6 Goals: edit a goal, Save; a thumb rests on the glass at +3.9 s. Nothing moves under it. [j-first-retiree/x-2, B11/B12]
await run("R6 goals save, thumb resting", "family", "goals/goals", async (s, p) => {
  await sleep(700);
  const row = await p.evaluate(() => { const li = [...document.querySelectorAll("#content li[role=button], #content .records li, #content .page-list li")].filter((li) => li.getClientRects().length && !li.closest(".only-wide"))[1]; return li ? li.textContent.replace(/\s+/g, " ").trim().slice(0, 18) : null; });
  if (!row) throw new Error("no goal row");
  await thumb(s, "li", { text: row }); await sleep(1000); await settle(p);
  const box = await p.evaluate(() => [...document.querySelectorAll("#content form input")].find((c) => c.getClientRects().length && /target|amount|cost/i.test((c.name || "") + (c.closest("label")?.textContent ?? "")))?.name ?? null);
  if (box) await type(s, `form input[name="${box}"]`, "19000", { clear: true });
  const b = await bring(s, "form button", { text: "Save" }); await p.touchscreen.tap(b.x, b.y); await sleep(400);
  const probe = () => p.evaluate(() => { const els = [...document.querySelectorAll("#content li, #content h2, #content button")].filter((e) => { const r = e.getBoundingClientRect(); return r.top > 100 && r.top < 700; }).slice(0, 3); return { y: Math.round(scrollY), tops: els.map((e) => Math.round(e.getBoundingClientRect().top)), notice: !!document.querySelector("#content .notice.ok") }; });
  const a = await probe(); const t0 = Date.now(); while (Date.now() - t0 < 3500) await sleep(50);
  const cdp = await s.ctx.newCDPSession(p);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 500 }] }); await sleep(1100);
  const c = await probe();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(800);
  const d = await probe();
  const mv = Math.max(...a.tops.map((t, i) => Math.abs((c.tops[i] ?? t) - t)), ...a.tops.map((t, i) => Math.abs((d.tops[i] ?? t) - t)));
  return { row, box, rowsMovedUnderThumb: mv, noticeAt04: a.notice, noticeAt50: c.notice, noticeAt58: d.notice };
});
// R7 Rules: add a rule; does "Rule added." stay, and do the rows under it stay put? [p-transactions-helpers/x-notice-jump]
await run("R7 rule added stays", "family", "transactions/rules", async (s, p) => {
  const op = await p.evaluate(() => { const b = [...document.querySelectorAll("#content button")].find((x) => /add/i.test(x.textContent) && x.getClientRects().length && !x.form); return b ? b.textContent.trim() : null; });
  if (op && !(await p.evaluate(() => !!document.querySelector("#content form input[name=contains]")))) { const b = await bring(s, "button", { text: op }); await p.touchscreen.tap(b.x, b.y); await sleep(600); }
  await type(s, "input[name=contains]", "COFFEE");
  await p.evaluate(() => { const sel = document.querySelector("#content select[name=category]"); const o = [...sel.options].find((x) => x.value); sel.value = o.value; sel.dispatchEvent(new Event("change", { bubbles: true })); });
  const sub = await bring(s, "form button[type=submit], form button:not([type])", {}); await p.touchscreen.tap(sub.x, sub.y); await sleep(700); await settle(p);
  const lk = () => p.evaluate(() => { const n = document.querySelector("#content .notice.ok"); const row = [...document.querySelectorAll("#content li, #content tr, #content .rec")].find((x) => /coffee/i.test(x.textContent) && x.getClientRects().length); return { notice: !!n, row: row ? Math.round(row.getBoundingClientRect().top) : null }; });
  const a = await lk(); await sleep(5500); const b = await lk();
  return { noticeAt07: a.notice, noticeAt62: b.notice, rowMoved: a.row !== null && b.row !== null ? b.row - a.row : null };
});
// R8 Withholding: the first Save (the page shuts the section): where is the eye, is the confirmation readable? [p-taxes/x-5]
await run("R8 withholding save", "family", "taxes/withholding", async (s, p) => {
  const prep = await p.evaluate(() => { const b = [...document.querySelectorAll("#content form button")].find((x) => x.getClientRects().length && /save/i.test(x.textContent)); if (!b) return null; b.dataset.um = "1"; const box = [...b.form.querySelectorAll("input[inputmode=decimal], input[inputmode=numeric]")].find((c) => c.getClientRects().length); if (box) box.dataset.umbox = "1"; return { t: b.textContent.trim(), box: !!box }; });
  if (!prep) throw new Error("no Save in a form");
  if (prep.box) { const bx = await bring(s, "[data-umbox]", {}); await p.touchscreen.tap(bx.x, bx.y); await sleep(150); await p.keyboard.press("Control+A"); await p.keyboard.type("123", { delay: 80 }); }
  return saveAt(s, p, { sel: "[data-um]" });
});
// R9 Chance the money lasts: open "How this is done", change Runs. The section stays open. [j-heavy-waiting/W4]
await run("R9 monte carlo runs", "family", "retirement/monte-carlo", async (s, p) => {
  await sleep(900); await openFold(s, "How this is done");
  const before = await openFolds(p);
  const sel = await bring(s, "details[open] select", {}); if (!sel) throw new Error("no select");
  const y0 = await Y(p);
  await p.evaluate(() => { const x = document.querySelector("#content details[open] select"); x.focus(); x.value = x.options[x.options.length - 1].value; x.dispatchEvent(new Event("input", { bubbles: true })); x.dispatchEvent(new Event("change", { bubbles: true })); });
  await sleep(2500); await settle(p, 400, 9000);
  const after = await openFolds(p);
  return { foldKept: after.some((f) => f.startsWith("How this is done")), before: before.length, after: after.length, scroll: `${y0}>${await Y(p)}` };
});
// R10 Stress tests: open "A crash like 2008", tap the "Now" chip. Every open section stays open. [B10 / W4]
await run("R10 stress tests chip", "family", "scenarios/stress-tests", async (s, p) => {
  await sleep(700); await openFold(s, "A crash like 2008");
  const before = await openFolds(p);
  const chip = await bring(s, "button", { text: "Now" }); if (!chip) throw new Error("no Now chip");
  await p.touchscreen.tap(chip.x, chip.y); await sleep(1500); await settle(p);
  const after = await openFolds(p);
  return { before: before.length, after: after.length, kept: before.every((f) => after.includes(f)) };
});

// ---- ways back on the screen (B4) ----
const goTo = async (p, route) => { await p.evaluate((r) => { location.hash = "#/" + r; }, route); await sleep(1000); await settle(p); };
const tapEl = async (s, sel, opts = {}) => { const e = await bring(s, sel, opts); if (!e) throw new Error("not found: " + sel + " " + (opts.text ?? "")); const y = await Y(s.page); await s.page.touchscreen.tap(e.x, e.y); await sleep(1300); await settle(s.page); return { ...e, yAtTap: y }; };
const octPlan = () => { const plan = H.family(); for (const a of plan.accounts) { a.asOf = "2026-10-09"; if (Array.isArray(a.history)) for (const h of a.history) if (h.date === "2026-11-11") h.date = "2026-10-09"; } return plan; };
// L1 the check-in: a step link, then "‹ Back to the ... check-in", then the phone's Back. [j-monthly-return/x-backlink-history, x-back-top]
await run("L1 check-in step and back link", "family", "overview/dashboard", async (s, p) => {
  await goTo(p, "overview/monthly-review"); await swipe(s, 300);
  const h0 = await hist(p);
  const st = await tapEl(s, "a[href*='from=review']");
  const onStep = (await state(p)).hash;
  await tapEl(s, "nav.gb-compact a", { text: "Back to the" });
  const r = { step: onStep.slice(2, 30), back: (await state(p)).hash.slice(2, 40), yAtTap: st.yAtTap, yBack: await Y(p), histGrew: (await hist(p)) - h0 };
  await phoneBack(s, 1300);
  return { ...r, atPlace: Math.abs(r.yBack - r.yAtTap) <= 5, thenPhoneBack: (await state(p)).hash };
}, { plan: octPlan() });
// L2 Quick answers: an answer lower down, then "‹ Quick answers", then the phone's Back. [j-one-answer/x-4, A5]
await run("L2 quick answers back link", "patLee", "overview/dashboard", async (s, p) => {
  await goTo(p, "overview/quick"); await swipe(s, 900);
  const h0 = await hist(p);
  const a = await tapEl(s, "a[href*='from=quick']");
  const onAnswer = (await state(p)).hash;
  const back = await seen(p, "a.gb-back") ? "a.gb-back" : "nav.gb-compact a";
  await tapEl(s, back);
  const r = { answer: onAnswer.slice(2, 30), back: (await state(p)).hash, yAtTap: a.yAtTap, yBack: await Y(p), histGrew: (await hist(p)) - h0 };
  await phoneBack(s, 1300);
  return { ...r, atPlace: Math.abs(r.yBack - r.yAtTap) <= 5, thenPhoneBack: (await state(p)).hash };
});
// L3 Your plan: a row half way down, "Next result", then "‹ Back to your plan" (the whole walk). [j-navigator/N1, person S4]
await run("L3 your plan, next result, back", "family", "overview/dashboard", async (s, p) => {
  await goTo(p, "overview/plan"); await swipe(s, 870);
  const h0 = await hist(p);
  const a = await tapEl(s, "a[href*='from=plan']");
  const first = (await state(p)).hash;
  const nx = await seen(p, "a", { text: "Next result" });
  if (nx) await tapEl(s, "a", { text: "Next result" });
  const second = (await state(p)).hash;
  const bl = (await seen(p, "nav.gb-compact a", { text: "your plan" })) ? ["nav.gb-compact a", "your plan"] : (await seen(p, "a", { text: "‹ Back to your plan" })) ? ["a", "‹ Back to your plan"] : ["a", "Your plan"];
  await tapEl(s, bl[0], { text: bl[1] });
  const r = { first: first.slice(2, 30), second: second.slice(2, 30), back: (await state(p)).hash, yAtTap: a.yAtTap, yBack: await Y(p), histGrew: (await hist(p)) - h0 };
  await phoneBack(s, 1300);
  return { ...r, atPlace: Math.abs(r.yBack - r.yAtTap) <= 5, thenPhoneBack: (await state(p)).hash };
});
// L4 Check-in > "Update the balances" step > type > Save all balances: the note's way back, then the phone's Back;
// and (L5) a tap on the note's words. [j-monthly-return/MR-1, x-backlink-history; break K4/blocking 4; person 4]
for (const what of ["L4 note's way back", "L5 tap on the note's words"]) {
  await run(what, "family", "overview/dashboard", async (s, p) => {
    await goTo(p, "overview/monthly-review"); await swipe(s, 300);
    const st = await bring(s, "a[href*='balance/update']", {}); if (!st) throw new Error("no balances step");
    const y0 = await Y(p); const h0 = await hist(p);
    await p.touchscreen.tap(st.x, st.y); await sleep(1300); await settle(p);
    await type(s, "input[name=a-chk]", "4650", { clear: true });
    const sv = await bring(s, "button", { text: "Save all balances" }); await p.touchscreen.tap(sv.x, sv.y); await sleep(900); await settle(p);
    const c = await confirm(p);
    const note = await p.evaluate(() => { const e = document.querySelector(".save-echo"); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); const ways = [...e.querySelectorAll("a, button")].map((w) => { const q = w.getBoundingClientRect(); return { t: w.textContent.replace(/\s+/g, " ").trim().slice(0, 50), x: q.left + 30, y: q.top + q.height / 2, h: Math.round(q.height) }; }); const wr = [...ways.map((w) => w.y)]; let wy = r.top + 10; for (let y = r.top + 8; y < r.bottom - 4; y += 4) { if (!ways.some((w) => Math.abs(w.y - y) < w.h / 2 + 2)) { wy = y; break; } } return { top: Math.round(r.top), bottom: Math.round(r.bottom), ways, words: { x: r.left + 40, y: wy } }; });
    if (!note) return { readable: c.readable, how: c.ownReadable ? "page line" : "none", note: null };
    const h1 = await hist(p), hash1 = (await state(p)).hash;
    if (what.startsWith("L4")) {
      const w = note.ways.find((x) => x.t.startsWith("‹"));
      if (!w) return { note: note.ways.map((x) => x.t).join(" | "), wayBack: null };
      await p.touchscreen.tap(w.x, w.y); await sleep(1300); await settle(p);
      const r = { note: note.ways.map((x) => x.t).join(" | "), after: (await state(p)).hash.slice(2, 40), yLeft: y0, yBack: await Y(p), histGrew: (await hist(p)) - h1, noteGone: !(await p.evaluate(() => !!document.querySelector(".save-echo")?.getClientRects().length)) };
      await phoneBack(s, 1300);
      return { ...r, thenPhoneBack: (await state(p)).hash };
    }
    const under = await p.evaluate(([x, y]) => { const e = document.querySelector(".save-echo"); const old = e.style.visibility; e.style.visibility = "hidden"; const h = document.elementFromPoint(x, y); e.style.visibility = old; const c = h?.closest("a, button, input, select, textarea, summary, label, li[role=button]"); return c ? c.tagName + ":" + c.textContent.replace(/\s+/g, " ").trim().slice(0, 30) : h ? h.tagName : null; }, [note.words.x, note.words.y]);
    const plan0 = JSON.stringify(await planOf(p));
    await p.touchscreen.tap(note.words.x, note.words.y); await sleep(1000); await settle(p);
    return { note: note.ways.map((x) => x.t).join(" | "), underTheWords: under, hashChanged: (await state(p)).hash !== hash1, histGrew: (await hist(p)) - h1, planChanged: JSON.stringify(await planOf(p)) !== plan0, noteGone: !(await p.evaluate(() => !!document.querySelector(".save-echo")?.getClientRects().length)), focus: await p.evaluate(() => document.activeElement?.tagName) };
  }, { plan: octPlan() });
}

// ---- hazards ----
// X1 Back to a page that got 10 rows shorter while away: no grey, no jump by itself, a light drag moves normally. [break K3]
await run("X1 back to a shorter page", "family", "cashflow/expenses", async (s, p) => {
  await swipe(s, 6000); const y0 = await Y(p);
  await menuTo(s, "Dashboard"); await sleep(500);
  await p.evaluate(async () => { const { store } = await import("/core/store.js"); store.update((d) => { d.expenses = (d.expenses ?? []).slice(0, Math.max(2, (d.expenses ?? []).length - 10)); }); });
  await sleep(800);
  await p.goBack(); await sleep(150);
  const w = await watch(p, 6000);
  const y1 = await Y(p), bl = await blank(p);
  const yb = await Y(p); const y2 = await swipe(s, -120);
  return { leftAt: y0, firstY: w[0][1], at6s: y1, movedBy6s: moves(w.slice(4)), blankAt6s: bl, dragUp120: yb - y2 };
});
// X2 The "changed in two places" bar is up when Back arrives: the bar stays on the screen at the top. [place2 break 5]
await run("X2 conflict bar on Back", "family", "overview/dashboard", async (s, p) => {
  await goTo(p, "overview/pages"); await swipe(s, 2400); const left = await Y(p);
  await goTo(p, "cashflow/expenses");
  await p.evaluate(() => { const bar = document.createElement("div"); bar.id = "sync-bar"; bar.style.height = "120px"; bar.textContent = "Your plan was changed in two places"; document.getElementById("content").before(bar); });
  await p.evaluate(() => history.back()); await p.waitForSelector("#content [data-page]"); await sleep(2800);
  const r = await p.evaluate(() => ({ y: Math.round(scrollY), barTop: Math.round(document.getElementById("sync-bar")?.getBoundingClientRect().top ?? -9999) }));
  return { left, ...r, barSeen: r.barTop > -60 && r.barTop < 300 };
});
// X3 A finger takes over: Back to a long page at 4x slower CPU, a drag up 300 ms after Back: the page goes where the finger took it. [R3 / break should-fix 3]
await run("X3 drag right after Back (slow phone)", "ruth", "retirement/projection", async (s, p) => {
  await sleep(1200); await swipe(s, 1700); const y0 = await Y(p);
  await menuTo(s, "Dashboard"); await sleep(800);
  await p.goBack(); await sleep(300);
  const ya = await Y(p);
  await swipe(s, -400);
  const yb = await Y(p); await sleep(3000); const yc = await Y(p);
  return { leftAt: y0, atDrag: ya, afterDrag: yb, threeSecLater: yc, followedFinger: yb < ya - 150, stayed: Math.abs(yc - yb) <= 5 };
}, { slow: 4 });

fs.mkdirSync(`${J}/out`, { recursive: true });
fs.writeFileSync(`${J}/out/save-${who}.json`, JSON.stringify(rows, null, 1));
for (const r of rows) console.log(who, JSON.stringify(r));
