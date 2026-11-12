// B2 -- A new page starts at its top: a link, a menu row or the same link again (a new visit, even to a page seen before)
// opens the next page at its top; a fresh visit to Get started draws its folds as the page designs them ("Just want one
// answer?" stays folded even after it was opened on an earlier visit).
import { H, start, swipe, Y, sleep, settle, state, phoneBack, menuTo, openFolds, seen, journeys } from "./_lib.mjs";
const linkOnScreen = (p) => p.evaluate(() => { const a = [...document.querySelectorAll("#content a[href^='#/']")].find((a) => { const r = a.getBoundingClientRect(); return r.top > 90 && r.bottom < innerHeight - 20 && r.width > 0 && !a.closest("details:not([open])") && !a.hasAttribute("data-back"); }); if (!a) return null; const r = a.getClientRects()[0]; return { href: a.getAttribute("href"), t: a.textContent.replace(/\s+/g, " ").trim().slice(0, 30), x: r.left + Math.min(r.width / 2, 150), y: r.top + r.height / 2 }; });
await journeys("B2 a new page starts at its top", [
  ["the same link again after Back", "family", "retirement/projection", async (s, p) => {
    await swipe(s, 1500);
    const l = await linkOnScreen(p); if (!l) throw new Error("no link on the screen");
    const from = (await state(p)).hash;
    await p.touchscreen.tap(l.x, l.y); await sleep(1300); await settle(p);
    if ((await state(p)).hash === from) return { link: l.t, href: l.href, ok: false, why: "the tap on the link did not open a page" };
    const firstAt = await Y(p), where = (await state(p)).hash;
    await swipe(s, 400); const scrolled = await Y(p);
    await phoneBack(s);
    const backAt = await Y(p), backTo = (await state(p)).hash;
    const l2 = await linkOnScreen(p); if (!l2) return { link: l.t, page: where, firstAt, scrolledTo: scrolled, backAt, backTo, ok: false, why: "no link on the screen after Back" };
    await p.touchscreen.tap(l2.x, l2.y); await sleep(1300); await settle(p);
    const againAt = await Y(p);
    return { link: l.t, page: where, firstAt, scrolledTo: scrolled, backAt, backTo, again: l2.t, againAt, ok: firstAt === 0 && againAt === 0 && scrolled > 100 };
  }],
  ["a menu row to a page seen before", "family", "cashflow/income", async (s, p) => {
    await swipe(s, 600); const left = await Y(p);
    await menuTo(s, "Dashboard"); const dash = await Y(p);
    await menuTo(s, "Income"); const again = await Y(p);
    return { leftIncomeAt: left, dashboardAt: dash, incomeAgainAt: again, ok: left > 100 && dash === 0 && again === 0 };
  }],
  ["Get started's folds on a fresh visit", "blank", "overview/start", async (s, p) => {
    const f = await seen(p, "details:not([open]) > summary", {});
    if (!f) return { ok: false, why: "no folded section on Get started" };
    await p.touchscreen.tap(f.x, f.y); await sleep(600);
    const opened = await openFolds(p);
    await menuTo(s, "Dashboard"); await menuTo(s, "Get started");
    const later = await openFolds(p);
    return { opened, onANewVisit: later, ok: opened.length > later.length };
  }],
]);
