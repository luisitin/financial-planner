// B4 -- The page's "‹ Back to ..." links work like the phone's Back: they return to the page I came from at the spot I
// left it and add no step (the phone's Back afterwards goes where I was before); from Your plan's "Next result" walk,
// "‹ Back to your plan" goes back over the whole walk; a page not just behind opens as an ordinary link. The links are
// found by their words, as a person finds them (never by a marker in the page's code).
import { H, swipe, Y, sleep, settle, state, phoneBack, seen, bring, hist, journeys } from "./_lib.mjs";
const tapAt = async (s, e) => { await s.page.touchscreen.tap(e.x, e.y); await sleep(1300); await settle(s.page); };
await journeys("B4 on-screen ways back are the phone's Back", [
  ["check-in step and its way back", "family", "overview/dashboard", async (s, p) => {
    await p.evaluate(() => { location.hash = "#/overview/monthly-review"; }); await sleep(1300); await settle(p);
    const h0 = await hist(p);
    const step = await p.evaluate(() => { const a = [...document.querySelectorAll("#content a[href*='from=review']")].find((a) => a.getClientRects().length && !a.closest("details:not([open])")); if (!a) return null; a.setAttribute("data-b4", "1"); return a.textContent.replace(/\s+/g, " ").trim().slice(0, 40); });
    if (!step) throw new Error("no step link on the check-in");
    const e = await bring(s, "[data-b4]", {}); const yTap = await Y(p); await tapAt(s, e);
    const onStep = (await state(p)).hash, h1 = await hist(p);
    const back = await bring(s, "a", { text: "‹ Back to the" }); if (!back) throw new Error("no way back on the step page");
    await tapAt(s, back);
    const at = (await state(p)).hash, y = await Y(p), h2 = await hist(p);
    await phoneBack(s); const after = (await state(p)).hash;
    return { step, onStep, histGrew: `${h1 - h0} then ${h2 - h1}`, landed: at, spot: `${yTap} -> ${y}`, phoneBackThen: after, ok: /monthly-review/.test(at) && h2 === h1 && h1 - h0 === 1 && Math.abs(y - yTap) <= 5 && /dashboard/.test(after) };
  }],
  ["Quick answers and its way back", "family", "overview/dashboard", async (s, p) => {
    await p.evaluate(() => { location.hash = "#/overview/quick"; }); await sleep(1300); await settle(p);
    await swipe(s, 300);
    const q = await p.evaluate(() => { const a = [...document.querySelectorAll("#content a[href*='from=quick']")].find((a) => { const r = a.getBoundingClientRect(); return r.top > 100 && r.bottom < innerHeight - 40; }); if (!a) return null; a.setAttribute("data-b4", "1"); return a.textContent.replace(/\s+/g, " ").trim().slice(0, 40); });
    if (!q) throw new Error("no quick answer on the screen");
    const h0 = await hist(p), e = await seen(p, "[data-b4]", {}), yTap = await Y(p); await tapAt(s, e);
    const h1 = await hist(p);
    const back = await bring(s, "a", { text: "‹ Quick answers" }); if (!back) throw new Error("no '‹ Quick answers'");
    await tapAt(s, back);
    const at = (await state(p)).hash, y = await Y(p), h2 = await hist(p);
    await phoneBack(s); const after = (await state(p)).hash;
    return { question: q, histGrew: `${h1 - h0} then ${h2 - h1}`, landed: at, spot: `${yTap} -> ${y}`, phoneBackThen: after, ok: /overview\/quick/.test(at) && h2 === h1 && Math.abs(y - yTap) <= 5 && /dashboard/.test(after) };
  }],
  ["Your plan, two Next results, '‹ Back to your plan'", "family", "overview/dashboard", async (s, p) => {
    await p.evaluate(() => { location.hash = "#/overview/plan"; }); await sleep(1300); await settle(p);
    await swipe(s, 300);
    const r = await p.evaluate(() => { const a = [...document.querySelectorAll("#content a[href*='from=plan']")].find((a) => { const r = a.getBoundingClientRect(); return r.top > 100 && r.bottom < innerHeight - 40; }); if (!a) return null; a.setAttribute("data-b4", "1"); return a.textContent.replace(/\s+/g, " ").trim().slice(0, 40); });
    if (!r) throw new Error("no result link on Your plan's screen");
    const h0 = await hist(p), yTap = await Y(p); await tapAt(s, await seen(p, "[data-b4]", {}));
    let walked = 0;
    for (let i = 0; i < 2; i++) { const n = await bring(s, "a", { text: "Next result:" }); if (!n) break; await tapAt(s, n); walked++; }
    const h1 = await hist(p);
    const back = await bring(s, "a", { text: "‹ Back to your plan" }) ?? await bring(s, "a", { text: "Back to your plan" }) ?? await bring(s, "a", { text: "‹ Your plan" });
    if (!back) throw new Error("no way back to Your plan");
    await tapAt(s, back);
    const at = (await state(p)).hash, y = await Y(p), h2 = await hist(p);
    await phoneBack(s); const after = (await state(p)).hash;
    return { result: r, walked, histGrew: `${h1 - h0} then ${h2 - h1}`, landed: at, spot: `${yTap} -> ${y}`, phoneBackThen: after, ok: /overview\/plan/.test(at) && h2 === h1 && Math.abs(y - yTap) <= 5 && /dashboard/.test(after) };
  }],
  ["a way back to a page not just behind is a link", "family", "overview/dashboard", async (s, p) => {
    await p.evaluate(() => { location.hash = "#/balance/update?from=review&review=2026-10"; }); await sleep(1300); await settle(p);
    const h0 = await hist(p);
    const back = await bring(s, "a", { text: "‹ Back to the" }); if (!back) throw new Error("no way back on the step page");
    await tapAt(s, back);
    const at = (await state(p)).hash, h1 = await hist(p);
    return { landed: at, histGrew: h1 - h0, ok: /monthly-review/.test(at) && h1 - h0 === 1 };
  }],
]);
