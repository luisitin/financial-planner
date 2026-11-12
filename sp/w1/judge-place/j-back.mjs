// j-back.mjs <A|B|T> [cpu] -- Back, Forward, Back again, Reload on long pages, at a person's pace (SH-BACK).
// A fresh browser per trip: finger drags to a place, open a closed section that is on the screen, tap a link that is on the
// screen (else the menu), read a little of the other page (a drag), phone Back, Forward, Back again, Reload.
// Also: does anything move by itself in the 4 s after Back, and is there grey under the page?
import fs from "node:fs";
import { H, start, swipe, Y, sleep, settle, state, phoneBack, phoneForward, reload, openFolds, tapMenu, seen, watch, moves, blank, J } from "./lib.mjs";
const who = process.argv[2] ?? "A", slow = Number(process.argv[3] ?? 1);
const TRIPS = [
  ["family", "retirement/projection", 1700, true], ["family", "overview/plan", 900, true], ["family", "taxes/federal", 1400, true],
  ["family", "overview/pages", 3800, false], ["family", "system/settings", 300, true],
  ["ruth", "retirement/projection", 1700, true], ["ruth", "retirement/withdrawal-strategy", 780, false], ["ruth", "retirement/pensions", 820, true],
  ["renterDebt", "debt/payoff", 700, true], ["renterDebt", "debt/credit-cards", 600, true],
  ["patLee", "overview/guide/retire", 350, true], ["patLee", "overview/timeline", 2900, false],
  ["freelancer", "career/side-income", 1700, false],
];
const rows = [];
for (const [hh, route, dy, fold] of TRIPS) {
  const s = await start(who, H[hh](), route, { slow });
  const p = s.page;
  try {
    await sleep(700);
    await swipe(s, dy);
    let opened = null;
    if (fold) {
      const f = await p.evaluate(() => { const sm = [...document.querySelectorAll("#content details:not([open]) > summary")].find((x) => { const r = x.getBoundingClientRect(); return r.top > 80 && r.bottom < innerHeight - 30 && r.height > 0; }); if (!sm) return null; const r = sm.getBoundingClientRect(); return { t: (sm.querySelector(".fold-title") ?? sm).textContent.replace(/\s+/g, " ").trim().slice(0, 30), x: r.left + Math.min(r.width / 2, 150), y: r.top + r.height / 2 }; });
      if (f) { await p.touchscreen.tap(f.x, f.y); await sleep(600); opened = f.t; }
    }
    await sleep(600);
    const link = await p.evaluate(() => { const a = [...document.querySelectorAll("#content a[href^='#/']")].find((a) => { const r = a.getBoundingClientRect(); return r.top > 90 && r.bottom < innerHeight - 20 && r.width > 0 && !a.closest("details:not([open])") && !a.hasAttribute("data-back"); }); if (!a) return null; const r = a.getBoundingClientRect(); return { t: a.textContent.replace(/\s+/g, " ").trim().slice(0, 30), x: r.left + Math.min(r.width / 2, 150), y: r.top + r.height / 2, top: Math.round(r.top) }; });
    const y0 = await Y(p), folds0 = await openFolds(p);
    if (link) await p.touchscreen.tap(link.x, link.y);
    else { await tapMenu(s); const e = await seen(p, ".nav-link", { text: "Dashboard", within: "#sidebar" }); await p.touchscreen.tap(e.x, e.y); }
    await sleep(1300); await settle(p);
    const mid = (await state(p)).hash, midTop = await Y(p);
    const yMid = await swipe(s, 220);
    // Back, sampled from the first moment: where does the screen stand, does it move by itself, is there grey?
    await p.goBack();
    const first = await (async () => { await sleep(120); return { y: await Y(p), blank: await blank(p) }; })();
    const w = await watch(p, 4000);
    await settle(p);
    const y1 = await Y(p), folds1 = await openFolds(p), h1 = (await state(p)).hash, blank1 = await blank(p);
    const linkNow = link ? await p.evaluate((t) => [...document.querySelectorAll("#content a[href^='#/']")].filter((a) => a.textContent.replace(/\s+/g, " ").trim().slice(0, 30) === t).map((a) => Math.round(a.getBoundingClientRect().top)), link.t) : [];
    await phoneForward(s, 1500); const yf = await Y(p), hf = (await state(p)).hash;
    await phoneBack(s, 1500); const y2 = await Y(p), folds2 = await openFolds(p);
    await reload(s);
    const y3 = await Y(p), folds3 = await openFolds(p), h3 = (await state(p)).hash;
    const kept = (fs_) => (opened ? fs_.some((f) => f.startsWith(opened.slice(0, 20))) : null);
    rows.push({
      hh, route, leftAt: y0, opened, via: link ? link.t : "menu", midTop,
      backAt: y1, backOk: h1.includes(route) && (Math.abs(y1 - y0) <= 5 || (link && linkNow.some((t) => Math.abs(t - link.top) <= 5))), firstY: first.y, firstBlank: first.blank,
      movedAfterBack: moves(w), blankAfter: blank1, foldKept: kept(folds1), linkWas: link?.top ?? null, linkNow: linkNow.find((t) => Math.abs(t - (link?.top ?? 0)) <= 5) ?? linkNow[0] ?? null,
      fwdAt: yf, fwdOk: hf === mid && Math.abs(yf - yMid) <= 5, midAt: yMid,
      back2At: y2, back2Ok: Math.abs(y2 - y0) <= 5 || (link && Math.abs(y2 - y1) <= 5), fold2: kept(folds2),
      reloadAt: y3, reloadOk: h3.includes(route) && Math.abs(y3 - y0) <= 40, reloadFold: kept(folds3), errors: s.pageErrors.length,
    });
  } catch (e) { rows.push({ hh, route, error: String(e.message).split("\n")[0] }); }
  await s.close();
}
fs.mkdirSync(`${J}/out`, { recursive: true });
fs.writeFileSync(`${J}/out/back-${who}-x${slow}.json`, JSON.stringify(rows, null, 1));
console.table(rows.map((r) => ({ hh: r.hh, route: r.route, left: r.leftAt, first: r.firstY, back: r.backAt, ok: r.backOk, mv: r.movedAfterBack, blank: r.blankAfter, fold: r.foldKept, link: `${r.linkWas}>${r.linkNow}`, fwd: r.fwdOk, b2: r.back2Ok, rl: r.reloadAt, rlOk: r.reloadOk, rlF: r.reloadFold, err: r.error ?? r.errors })));
const n = (f) => rows.filter(f).length;
console.log(who, "x" + slow, JSON.stringify({ trips: rows.length, backOk: n((r) => r.backOk), firstFrameAtPlace: n((r) => r.backOk && Math.abs(r.firstY - r.backAt) <= 5), movedBy10: n((r) => r.movedAfterBack > 10), blankAfter: n((r) => r.blankAfter > 40), foldTrips: n((r) => r.foldKept !== null && r.foldKept !== undefined), foldKept: n((r) => r.foldKept === true), fwdOk: n((r) => r.fwdOk), back2Ok: n((r) => r.back2Ok), fold2: n((r) => r.fold2 === true), reloadOk: n((r) => r.reloadOk), reloadFold: n((r) => r.reloadFold === true), errors: n((r) => r.error || r.errors) }));
