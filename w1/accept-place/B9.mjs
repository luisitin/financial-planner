// B9 -- After a save or a choice the page stays still under my thumb: the sections I opened stay open, the button I tapped
// stays where it was (within 8 px), the box I was typing in keeps the focus; if the page shuts the section that held the
// button, that section's heading stands where the button was and no grey shows under the page; a page that brings its
// answer into view itself wins.
import { H, Y, sleep, settle, seen, bring, thumb, type, openFold, openFolds, topOf, blank, grey, watch, moves, journeys } from "./_lib.mjs";
async function saveAt(s, p, { sel = "button", text = null, nth = 0, fold = null }) {
  const e = await bring(s, sel, { text, nth }); if (!e) throw new Error("no button " + (text ?? sel));
  const folds0 = await openFolds(p);
  await p.touchscreen.tap(e.x, e.y); await sleep(700); await settle(p);
  const now = await topOf(p, sel, text, nth), folds1 = await openFolds(p);
  const w = await watch(p, 3000);
  return { tappedAt: e.top, nowAt: now, moved: now === null ? "gone" : now - e.top, foldKept: fold ? folds1.some((f) => f.startsWith(fold)) : true, foldsLost: folds0.filter((f) => !folds1.some((g) => g.slice(0, 20) === f.slice(0, 20))), movedBy3s: moves(w), grey: await grey(p) };
}
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
await journeys("B9 the page stays still under my thumb", [
  ["Will the money last?: Save settings", "family", "retirement/projection", async (s, p) => {
    await sleep(900); await openFold(s, "Retirement settings");
    await type(s, "input[name=spendingMonthly]", "5100", { clear: true });
    const r = await saveAt(s, p, { text: "Save settings", fold: "Retirement settings" });
    return { ...r, ok: r.moved !== "gone" && Math.abs(r.moved) <= 8 && r.foldKept && r.movedBy3s <= 10 && r.grey <= 40 };
  }],
  ["Buckets: Save inside 'Years in each bucket'", "family", "retirement/buckets", async (s, p) => {
    await sleep(600); await openFold(s, "Years in each bucket");
    await type(s, "input[name=cashYears]", "3", { clear: true });
    const r = await saveAt(s, p, { sel: "details[open] button[type=submit]", fold: "Years in each bucket" });
    return { ...r, ok: r.moved !== "gone" && Math.abs(r.moved) <= 8 && r.foldKept && r.movedBy3s <= 10 && r.grey <= 40 };
  }],
  ["Withholding: the first Save shuts its section", "family", "taxes/withholding", async (s, p) => {
    const prep = await p.evaluate(() => { const b = [...document.querySelectorAll("#content form button")].find((x) => x.getClientRects().length && /save/i.test(x.textContent)); if (!b) return null; b.dataset.um = "1"; const box = [...b.form.querySelectorAll("input[inputmode=decimal], input[inputmode=numeric]")].find((c) => c.getClientRects().length); if (box) box.dataset.umbox = "1"; const d = b.closest("details"); return { box: !!box, fold: d ? (d.querySelector("summary .fold-title") ?? d.querySelector("summary")).textContent.trim().slice(0, 30) : null }; });
    if (!prep) throw new Error("no Save in a form");
    if (prep.box) { const bx = await bring(s, "[data-umbox]", {}); await p.touchscreen.tap(bx.x, bx.y); await sleep(150); await p.keyboard.press("Control+A"); await p.keyboard.type("123", { delay: 80 }); }
    const b = await bring(s, "[data-um]", {}); const y0 = await Y(p);
    await p.touchscreen.tap(b.x, b.y); await sleep(1000); await settle(p);
    const head = prep.fold ? await p.evaluate((t) => { const s = [...document.querySelectorAll("#content details > summary")].find((x) => x.textContent.includes(t)); return s ? Math.round(s.getBoundingClientRect().top) : null; }, prep.fold) : null;
    const minH = await p.evaluate(() => document.getElementById("content").style.minHeight);
    const w = await watch(p, 4000); const g = await grey(p);
    const shut = prep.fold ? !(await openFolds(p)).some((f) => f.startsWith(prep.fold.slice(0, 20))) : false;
    return { tappedAt: b.top, section: prep.fold, sectionShut: shut, headingAt: head, roomLeft1s: minH, movedBy4s: moves(w), grey: g,
      ok: !minH && g <= 40 && moves(w) <= 10 && (!shut || (head !== null && Math.abs(head - b.top) <= 60)) };
  }],
  ["Stress tests: the 'Now' chip keeps every open section", "family", "scenarios/stress-tests", async (s, p) => {
    await sleep(700); await openFold(s, "A crash like 2008");
    const before = await openFolds(p);
    const chip = await bring(s, "button", { text: "Now" }); if (!chip) throw new Error("no Now chip");
    await p.touchscreen.tap(chip.x, chip.y); await sleep(1500); await settle(p);
    const after = await openFolds(p), now = await topOf(p, "button", "Now");
    return { before: before.length, after: after.length, chipMoved: now === null ? "gone" : now - chip.top, ok: before.every((f) => after.includes(f)) && now !== null && Math.abs(now - chip.top) <= 8 };
  }],
  ["How much to take out: 'Use this one' (the page brings its line into view: it wins)", "ruth", "retirement/withdrawal-strategy", async (s, p) => {
    await sleep(900);
    const e = await bring(s, "button", { text: "Use this one", nth: 1 }); if (!e) throw new Error("no second 'Use this one'");
    await p.touchscreen.tap(e.x, e.y); await sleep(1200); await settle(p);
    const own = await p.evaluate(() => { const top = document.getElementById("topbar")?.getBoundingClientRect().bottom ?? 0; return [...document.querySelectorAll("#content .notice.ok")].some((n) => { const r = n.getBoundingClientRect(); return n.getClientRects().length && Math.min(r.bottom, innerHeight) - Math.max(r.top, top) >= Math.min(48, 0.6 * r.height); }); });
    const note = await p.evaluate(() => !!document.querySelector(".save-echo")?.getClientRects().length);
    const w = await watch(p, 2500);
    return { ownLineReadable: own, bottomNoteToo: note, movedAfter: moves(w), ok: own && !note && moves(w) <= 10 };
  }],
  ["Chance the money lasts: Runs changed, its section stays open and the page stays where it was", "family", "retirement/monte-carlo", async (s, p) => {
    await sleep(900); await openFold(s, "How this is done");
    const before = await openFolds(p);
    const sel = await bring(s, "details[open] select", {}); if (!sel) throw new Error("no select in the open section");
    const y0 = await Y(p), v0 = await p.evaluate(() => document.querySelector("#content details[open] select").value);
    // a finger on the box, then the picker's keys (a trusted change, as a phone's picker sends)
    await p.touchscreen.tap(sel.x, sel.y); await sleep(400);
    await p.keyboard.press("ArrowDown"); await sleep(120); await p.keyboard.press("ArrowDown"); await sleep(120); await p.keyboard.press("Enter");
    await sleep(2500); await settle(p, 400, 9000);
    const v1 = await p.evaluate(() => document.querySelector("#content details[open] select")?.value ?? null);
    const after = await openFolds(p), focus = await p.evaluate(() => document.activeElement?.tagName ?? null), y1 = await Y(p);
    // the page draws itself again here (not through the shell): the focus is reported, wave 2 moves the page to ctx.redraw
    return { runs: `${v0} -> ${v1}`, before: before.length, after: after.length, scroll: `${y0} -> ${y1}`, focus, ok: v1 !== v0 && after.some((f) => f.startsWith("How this is done")) && Math.abs(y1 - y0) <= 5 };
  }],
].filter((j) => !ONLY || ONLY.test(j[0])));
