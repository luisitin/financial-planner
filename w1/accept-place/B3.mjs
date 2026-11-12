// B3 -- A reload keeps my place, my open sections and my typing ("Not saved yet" beside the form's button).
import { H, swipe, Y, sleep, settle, reload, openFolds, type, vals, look, journeys } from "./_lib.mjs";
const openOne = async (p) => { const f = await p.evaluate(() => { const sm = [...document.querySelectorAll("#content details:not([open]) > summary")].find((x) => { const r = x.getBoundingClientRect(); return r.top > 80 && r.bottom < innerHeight - 30 && r.height > 0; }); if (!sm) return null; const r = sm.getBoundingClientRect(); return { t: (sm.querySelector(".fold-title") ?? sm).textContent.replace(/\s+/g, " ").trim().slice(0, 30), x: r.left + Math.min(r.width / 2, 150), y: r.top + r.height / 2 }; }); if (f) { await p.touchscreen.tap(f.x, f.y); await sleep(700); } return f?.t ?? null; };
const placeTrip = (hh, route, dy) => [`${hh} ${route}: place and section`, hh, route, async (s, p) => {
  await swipe(s, dy); const opened = await openOne(p); await sleep(400); const y0 = await Y(p);
  await reload(s);
  const y1 = await Y(p), folds = await openFolds(p);
  const kept = !opened || folds.some((f) => f.startsWith(opened.slice(0, 20)));
  return { leftAt: y0, opened, afterReload: y1, sectionKept: kept, ok: Math.abs(y1 - y0) <= 40 && kept };
}];
await journeys("B3 a reload keeps the place, the sections and the typing", [
  placeTrip("family", "retirement/projection", 1700),
  placeTrip("ruth", "retirement/pensions", 820),
  placeTrip("renterDebt", "debt/credit-cards", 600),
  ["Update my balances: two typed, reload", "family", "balance/update", async (s, p) => {
    await type(s, "input[name=a-chk]", "3900", { clear: true });
    await type(s, "input[name=a-brk]", "18950", { clear: true });
    const sel = "#content input[name=a-chk], #content input[name=a-brk]";
    const before = (await vals(p, sel)).join("|"), y0 = await Y(p);
    await reload(s);
    const after = (await vals(p, sel)).join("|"), l = await look(p), y1 = await Y(p);
    const same = (a, b) => a.replace(/,/g, "") === b.replace(/,/g, "");
    return { before, after, leftAt: y0, afterReload: y1, words: l.kept, ok: same(before, after) && l.notSaved > 0 && Math.abs(y1 - y0) <= 40 };
  }],
]);
