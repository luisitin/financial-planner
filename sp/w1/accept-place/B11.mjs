// B11 -- Nothing on the page moves by itself: a green confirmation stays until I act (a page that used to take it away
// after 4 s no longer does), so the rows under my resting thumb never jump; no borrowed blank under the page after it drew;
// and at the very end of a page, a form or a section that opens there leaves the screen where it is.
import { H, Y, sleep, settle, bring, thumb, type, blank, grey as greyOf, watch, moves, journeys } from "./_lib.mjs";
await journeys("B11 nothing moves by itself", [
  ["Goals: edit a goal, Save, a thumb resting from +3.9 s to +5 s", "family", "goals/goals", async (s, p) => {
    await sleep(700);
    const row = await p.evaluate(() => { const li = [...document.querySelectorAll("#content li[role=button], #content .records li, #content .page-list li")].filter((li) => li.getClientRects().length && !li.closest(".only-wide"))[1]; return li ? li.textContent.replace(/\s+/g, " ").trim().slice(0, 18) : null; });
    if (!row) throw new Error("no goal row");
    await thumb(s, "li", { text: row }); await sleep(1000); await settle(p);
    await type(s, `form input[name="target"]`, "19000", { clear: true });
    const b = await bring(s, "form button", { text: "Save" }); await p.touchscreen.tap(b.x, b.y); await sleep(400);
    const probe = () => p.evaluate(() => { const els = [...document.querySelectorAll("#content li, #content h2, #content button")].filter((e) => { const r = e.getBoundingClientRect(); return r.top > 100 && r.top < 700; }).slice(0, 3); return { y: Math.round(scrollY), tops: els.map((e) => Math.round(e.getBoundingClientRect().top)), notice: !!document.querySelector("#content .notice.ok") }; });
    const a = await probe(); await sleep(3500);
    const cdp = await s.ctx.newCDPSession(p);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 500 }] }); await sleep(1100);
    const c = await probe();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }); await sleep(300);
    const mv = Math.max(0, ...a.tops.map((t, i) => Math.abs((c.tops[i] ?? t) - t)));
    return { row, rowsMovedUnderThumb: mv, noticeAt04: a.notice, noticeAt50: c.notice, ok: mv <= 2 && a.notice && c.notice };
  }],
  ["Rules: 'Rule added.' is still there at +6 s and the rows stay", "family", "transactions/rules", async (s, p) => {
    const op = await p.evaluate(() => { const b = [...document.querySelectorAll("#content button")].find((x) => /add/i.test(x.textContent) && x.getClientRects().length && !x.form); return b ? b.textContent.trim() : null; });
    if (op && !(await p.evaluate(() => !!document.querySelector("#content form input[name=contains]")))) { const b = await bring(s, "button", { text: op }); await p.touchscreen.tap(b.x, b.y); await sleep(600); }
    await type(s, "input[name=contains]", "COFFEE");
    await p.evaluate(() => { const sel = document.querySelector("#content select[name=category]"); const o = [...sel.options].find((x) => x.value); sel.value = o.value; sel.dispatchEvent(new Event("change", { bubbles: true })); });
    const sub = await bring(s, "form button[type=submit], form button:not([type])", {}); await p.touchscreen.tap(sub.x, sub.y); await sleep(700); await settle(p);
    const lk = () => p.evaluate(() => { const n = document.querySelector("#content .notice.ok"); const row = [...document.querySelectorAll("#content li, #content tr, #content .rec")].find((x) => /coffee/i.test(x.textContent) && x.getClientRects().length); return { notice: !!n, row: row ? Math.round(row.getBoundingClientRect().top) : null }; });
    const a = await lk(); await sleep(5500); const b = await lk();
    return { noticeAt07: a.notice, noticeAt62: b.notice, ruleShown: a.row !== null, rowMoved: a.row !== null && b.row !== null ? b.row - a.row : null, ok: a.notice && b.notice && a.row !== null && b.row === a.row };
  }],
  ["Expenses: Back to a page made 10 rows shorter elsewhere: no grey, no jump, a drag moves", "family", "cashflow/expenses", async (s, p) => {
    const { swipe, menuTo } = await import("./_lib.mjs");
    await swipe(s, 6000); const y0 = await Y(p);
    await menuTo(s, "Dashboard"); await sleep(500);
    // the plan made shorter elsewhere (another window, or the Budget page): ten spending rows fewer
    await p.evaluate(async () => { const { store } = await import("/core/store.js"); store.update((d) => { d.expenses = (d.expenses ?? []).slice(0, Math.max(2, (d.expenses ?? []).length - 10)); }); });
    await sleep(800);
    await p.goBack(); await sleep(150);
    const w = await watch(p, 6000); const grey = await greyOf(p), blankAt6s = await blank(p);
    const yb = await Y(p); const y2 = await swipe(s, -120);
    return { leftAt: y0, movedBy6s: moves(w.slice(4)), greyAt6s: grey, blankAt6s, dragUp120: yb - y2, ok: moves(w.slice(4)) <= 10 && grey <= 40 && yb - y2 > 60 };
  }],
  // standing at the very end of a page, a tap that makes the page longer (a form or a section opening there) leaves the
  // screen where it is: the new part opens under the thumb, the screen is not thrown to the page's new end
  ...[["family", "cashflow/income", "+ Add another income"], ["family", "balance/net-worth", "+ Add another account"], ["family", "goals/goals", "+ Add another goal"], ["renterDebt", "debt/credit-cards", null]].map(([hh, route, text]) =>
    [`${route}: at the page's very end, ${text ? `"${text}"` : "a section opened"} does not throw the screen to the new end`, hh, route, async (s, p) => {
      const { swipe, seen } = await import("./_lib.mjs");
      await sleep(900); await settle(p); await swipe(s, 6000);
      const end = () => p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const max0 = await end(), y0 = await Y(p);
      const e = text ? await seen(p, "button", { text }) : await p.evaluate(() => { const x = [...document.querySelectorAll("#content details:not([open]) > summary")].filter((x) => { const r = x.getBoundingClientRect(); return r.top > 100 && r.bottom < innerHeight - 20; }).at(-1); if (!x) return null; const r = x.getBoundingClientRect(); return { x: r.left + 60, y: r.top + r.height / 2, top: Math.round(r.top) }; });
      if (!e || e.top < 70 || e.top > 800) throw new Error("nothing to open on the page's last screen");
      await p.touchscreen.tap(e.x, e.y); await sleep(900); await settle(p);
      const y1 = await Y(p), max1 = await end();
      return { atEnd: Math.abs(y0 - max0) <= 2, pageGrewBy: max1 - max0, screenMovedBy: y1 - y0, ok: Math.abs(y0 - max0) <= 2 && max1 - max0 > 100 && Math.abs(y1 - y0) <= 5 };
    }]),
]);
