// B1 -- Back and Forward put me back where I was: same spot from the first frame, the section I opened still open, the
// link I tapped where it was, nothing moving by itself for 4 s, no grey under the page; Forward to the other page at the
// spot I left it; Back again. Long pages, five households, one trip at 4x slower CPU.
import { H, start, swipe, Y, sleep, settle, state, phoneBack, phoneForward, openFolds, seen, watch, moves, blank, grey, tapMenu } from "./_lib.mjs";
const TRIPS = [
  ["family", "retirement/projection", 1700, true, 1], ["family", "taxes/federal", 1400, true, 1], ["family", "overview/pages", 3800, false, 1],
  ["ruth", "retirement/projection", 1700, true, 4], ["renterDebt", "debt/payoff", 700, true, 1], ["patLee", "overview/timeline", 2900, false, 1],
  ["freelancer", "career/side-income", 1700, false, 1],
];
const rows = [];
for (const [hh, route, dy, fold, slow] of TRIPS.filter((t, i) => !process.env.TRIP || process.env.TRIP.split(",").includes(String(i + 1)))) {
  const s = await start(H[hh](), route, { slow }); const p = s.page;
  try {
    await sleep(700 * slow); await settle(p);
    await swipe(s, dy);
    let opened = null;
    if (fold) {
      const f = await p.evaluate(() => { const sm = [...document.querySelectorAll("#content details:not([open]) > summary")].find((x) => { const r = x.getBoundingClientRect(); return r.top > 80 && r.bottom < innerHeight - 30 && r.height > 0; }); if (!sm) return null; const r = sm.getBoundingClientRect(); return { t: (sm.querySelector(".fold-title") ?? sm).textContent.replace(/\s+/g, " ").trim().slice(0, 30), x: r.left + Math.min(r.width / 2, 150), y: r.top + r.height / 2 }; });
      if (f) { await p.touchscreen.tap(f.x, f.y); await sleep(600); opened = f.t; }
    }
    await sleep(600);
    const link = await p.evaluate(() => { const a = [...document.querySelectorAll("#content a[href^='#/']")].find((a) => { const r = a.getBoundingClientRect(); return r.top > 90 && r.bottom < innerHeight - 20 && r.width > 0 && !a.closest("details:not([open])") && !a.hasAttribute("data-back") && a.getAttribute("href").split("?")[0] !== location.hash.split("?")[0]; }); if (!a) return null; const r = a.getClientRects()[0]; return { t: a.textContent.replace(/\s+/g, " ").trim().slice(0, 30), x: r.left + Math.min(r.width / 2, 150), y: r.top + r.height / 2, top: Math.round(r.top) }; });
    const y0 = await Y(p);
    if (link) await p.touchscreen.tap(link.x, link.y);
    else { await tapMenu(s); const e = await seen(p, ".nav-link", { text: "Dashboard", within: "#sidebar" }); await p.touchscreen.tap(e.x, e.y); }
    await sleep(1300 * slow); await settle(p);
    const mid = (await state(p)).hash;
    const yMid = await swipe(s, 220);
    await p.goBack();
    await sleep(120); const first = await Y(p);
    const w = await watch(p, 4000); await settle(p);
    const y1 = await Y(p), folds1 = await openFolds(p), h1 = (await state(p)).hash, blank1 = await blank(p), grey1 = await grey(p);
    const linkNow = link ? await p.evaluate((t) => [...document.querySelectorAll("#content a[href^='#/']")].filter((a) => a.textContent.replace(/\s+/g, " ").trim().slice(0, 30) === t).map((a) => Math.round(a.getBoundingClientRect().top)), link.t) : [];
    const atPlace = (y) => Math.abs(y - y0) <= 5 || (link && linkNow.some((t) => Math.abs(t - link.top) <= 5) && Math.abs(y - y1) <= 5);
    await phoneForward(s, 1500 * Math.min(slow, 2)); const yf = await Y(p), hf = (await state(p)).hash;
    await phoneBack(s, 1500 * Math.min(slow, 2)); const y2 = await Y(p), folds2 = await openFolds(p);
    const kept = (fs) => (opened ? fs.some((f) => f.startsWith(opened.slice(0, 20))) : true);
    const r = { hh, route, slow, leftAt: y0, firstFrame: first, backAt: y1, movedBy: moves(w), blankBelow: blank1, greyBelow: grey1, opened, foldKept: kept(folds1), went: mid, fwdAt: yf, fwdWant: yMid, link: link?.t ?? null, linkTop: link?.top ?? null, linkNow, back2At: y2, fold2: kept(folds2), errors: s.pageErrors.length };
    r.ok = !mid.includes(route) && h1.includes(route) && atPlace(y1) && Math.abs(first - y1) <= 5 && r.movedBy <= 10 && grey1 <= 40 && r.foldKept && hf === mid && Math.abs(yf - yMid) <= 5 && atPlace(y2) && r.fold2 && !r.errors;
    rows.push(r);
  } catch (e) { rows.push({ hh, route, ok: false, error: String(e.message).split("\n")[0] }); }
  await s.close();
}
for (const r of rows) console.log(JSON.stringify(r));
const held = rows.filter((r) => r.ok).length;
console.log(`B1 Back and Forward keep the place: ${held} of ${rows.length} trips hold`);
process.exit(held === rows.length ? 0 : 1);
