// B10 -- I can read the confirmation where I am looking: the page's own line when it can be read; otherwise a short copy
// at the bottom with at most two ways (the line's own link, "See net worth ›"; on a page opened from the check-in, its way
// back). A tap on the note's words closes it and reaches nothing under it; its way back goes Back without a new step.
import { H, Y, sleep, settle, state, swipe, phoneBack, bring, type, confirm, planOf, hist, journeys } from "./_lib.mjs";
const octPlan = () => { const plan = H.family(); for (const a of plan.accounts) { a.asOf = "2026-10-09"; if (Array.isArray(a.history)) for (const h of a.history) if (h.date === "2026-11-11") h.date = "2026-10-09"; } return plan; };
const noteBox = (p) => p.evaluate(() => { const e = document.querySelector(".save-echo"); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); const ways = [...e.querySelectorAll("a, button")].map((w) => { const q = w.getBoundingClientRect(); return { t: w.textContent.replace(/\s+/g, " ").trim().slice(0, 50), x: q.left + 30, y: q.top + q.height / 2, h: Math.round(q.height) }; }); const sp = e.querySelector(".save-echo-words > span") ?? e; const s = sp.getBoundingClientRect(); return { text: e.textContent.replace(/\s+/g, " ").trim().slice(0, 120), top: Math.round(r.top), bottom: Math.round(r.bottom), ways, words: { x: s.left + Math.min(40, s.width / 2), y: s.top + Math.min(10, s.height / 2) } }; });
await journeys("B10 a confirmation I can read where I look", [
  ["Update my balances: Save all balances", "family", "balance/update", async (s, p) => {
    await type(s, "input[name=a-chk]", "3900", { clear: true });
    const b = await bring(s, "button", { text: "Save all balances" }); await p.touchscreen.tap(b.x, b.y); await sleep(900); await settle(p);
    const c = await confirm(p);
    return { ownReadable: c.ownReadable, note: c.note, ok: c.readable && (c.ownReadable || (c.note && c.note.ways.length <= 2 && c.note.ways.every((w) => w.length > 0))) };
  }],
  ["the check-in's balances step: the note's way back, then the phone's Back", "family", "overview/dashboard", async (s, p) => {
    await p.evaluate(() => { location.hash = "#/overview/monthly-review"; }); await sleep(1300); await settle(p); await swipe(s, 300);
    const st = await bring(s, "a[href*='balance/update']", {}); if (!st) throw new Error("no balances step");
    const y0 = await Y(p); await p.touchscreen.tap(st.x, st.y); await sleep(1300); await settle(p);
    await type(s, "input[name=a-chk]", "4650", { clear: true });
    const sv = await bring(s, "button", { text: "Save all balances" }); await p.touchscreen.tap(sv.x, sv.y); await sleep(900); await settle(p);
    const n = await noteBox(p), c = await confirm(p);
    if (!n) return { readable: c.readable, note: null, ok: false, why: "no bottom note with a way back" };
    const w = n.ways.find((x) => x.t.startsWith("‹")); if (!w) return { note: n.text, ok: false, why: "no way back in the note" };
    const h1 = await hist(p);
    await p.touchscreen.tap(w.x, w.y); await sleep(1300); await settle(p);
    const at = (await state(p)).hash, y = await Y(p), h2 = await hist(p), gone = !(await noteBox(p));
    await phoneBack(s); const after = (await state(p)).hash;
    return { note: n.text, ways: n.ways.map((x) => x.t), landed: at, spot: `${y0} -> ${y}`, histGrew: h2 - h1, noteGone: gone, phoneBackThen: after, ok: /monthly-review/.test(at) && h2 === h1 && gone && Math.abs(y - y0) <= 5 && /dashboard/.test(after) && n.ways.every((x) => x.h >= 44) };
  }, { plan: octPlan() }],
  ["a tap on the note's words closes it and reaches nothing under it", "family", "overview/dashboard", async (s, p) => {
    await p.evaluate(() => { location.hash = "#/overview/monthly-review"; }); await sleep(1300); await settle(p); await swipe(s, 300);
    const st = await bring(s, "a[href*='balance/update']", {}); if (!st) throw new Error("no balances step");
    await p.touchscreen.tap(st.x, st.y); await sleep(1300); await settle(p);
    await type(s, "input[name=a-chk]", "4650", { clear: true });
    const sv = await bring(s, "button", { text: "Save all balances" }); await p.touchscreen.tap(sv.x, sv.y); await sleep(900); await settle(p);
    const n = await noteBox(p); if (!n) return { note: null, ok: false, why: "no bottom note" };
    const hash1 = (await state(p)).hash, h1 = await hist(p), plan0 = JSON.stringify(await planOf(p));
    await p.touchscreen.tap(n.words.x, n.words.y); await sleep(1000); await settle(p);
    const gone = !(await noteBox(p)), hashSame = (await state(p)).hash === hash1, histSame = (await hist(p)) === h1, planSame = JSON.stringify(await planOf(p)) === plan0;
    return { note: n.text, noteGone: gone, addressSame: hashSame, historySame: histSame, planSame, ok: gone && hashSame && histSame && planSame };
  }, { plan: octPlan() }],
]);
