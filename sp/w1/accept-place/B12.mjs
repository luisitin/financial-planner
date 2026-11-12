// B12 -- My typing never lands in someone else's form, and a figure changed elsewhere lets go of that box only: on
// Paycheck (two W-4 forms alike) what I typed in Ana's is never put in Bo's; on Update my balances, a balance saved
// elsewhere meanwhile shows its new figure, said once, and the other typed balances keep their typing.
import { H, Y, sleep, settle, swipe, phoneBack, menuTo, thumb, look, planOf, journeys } from "./_lib.mjs";
await journeys("B12 typing never crosses forms", [
  ["Paycheck: 120 in Ana's health box, away and back by the menu, save both W-4 forms", "family", "cashflow/paycheck", async (s, p) => {
    await thumb(s, "details > summary", { text: "W-4" }); await sleep(500);
    const box = await p.evaluate(() => { const i = [...document.querySelectorAll("#content details[open] input")].filter((i) => /Health, dental/i.test(i.closest("label")?.textContent ?? ""))[0]; if (!i) return null; i.scrollIntoView({ block: "center" }); const r = i.getBoundingClientRect(); return { y: r.top + r.height / 2, x: r.left + 20 }; });
    if (!box) throw new Error("no health box");
    await sleep(300); await p.touchscreen.tap(box.x, box.y); await sleep(200);
    await p.keyboard.press("Control+A"); await p.keyboard.type("120", { delay: 80 }); await sleep(500);
    await menuTo(s, "Dashboard"); await sleep(400); await menuTo(s, "Paycheck"); await sleep(800);
    for (let i = 0; i < 2; i++) {
      const b = await p.evaluate((i) => { const d = [...document.querySelectorAll("#content details")].filter((d) => /W-4/.test(d.querySelector("summary")?.textContent ?? ""))[i]; if (!d) return null; d.open = true; const b = d.querySelector("form button[type=submit], form button:not([type])"); b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
      if (!b) continue; await sleep(300); await p.touchscreen.tap(b.x, b.y); await sleep(900); await settle(p);
    }
    const plan = await planOf(p);
    const pc = Object.fromEntries(Object.entries(plan.whatIfs?.paycheck ?? {}).map(([k, v]) => [k, v.health ?? null]));
    const with120 = Object.values(pc).filter((v) => Number(v) === 120).length;
    return { saved: pc, formsWith120: with120, ok: with120 <= 1 };
  }],
  ["Update my balances: three typed, the house's value saved elsewhere, Back", "family", "balance/update", async (s, p) => {
    const all = () => p.evaluate(() => [...document.querySelectorAll("#content form input")].filter((i) => i.getClientRects().length).slice(0, 5).map((i) => i.value));
    const drawn = await all();
    const typeIn = async (nth, v) => { const e = await p.evaluate((nth) => { const i = [...document.querySelectorAll("#content form input")].filter((i) => i.getClientRects().length)[nth]; const r = i.getBoundingClientRect(); return { y: r.top + r.height / 2 + scrollY }; }, nth); const y = await Y(p); if (e.y - y < 120 || e.y - y > 640) await swipe(s, e.y - y - 400); const f = await p.evaluate((nth) => { const i = [...document.querySelectorAll("#content form input")].filter((i) => i.getClientRects().length)[nth]; const r = i.getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2 }; }, nth); await p.touchscreen.tap(f.x, f.y); await sleep(150); await p.keyboard.press("Control+A"); await p.keyboard.type(v, { delay: 80 }); };
    await typeIn(1, "91000"); await typeIn(2, "43000"); await typeIn(3, "32000"); await sleep(500);
    const typed = await all();
    await menuTo(s, "Dashboard"); await sleep(500);
    const house = await p.evaluate(async () => { const { store } = await import("/core/store.js"); let name = null; store.update((d) => { const h = d.accounts.find((a) => /house|home/i.test(a.name)); if (h) { h.balance = 395000; name = h.name; } }); return name; });
    await sleep(900);
    await phoneBack(s);
    const after = await all(), l = await look(p);
    const plain = (v) => String(v).replace(/,/g, "");
    const kept = [1, 2, 3].filter((i) => plain(after[i]) === plain(typed[i])).length;
    const shows395 = after.some((v) => plain(v) === "395000");
    return { house, drawn, typed, after, typedKept: `${kept}/3`, houseShows395: shows395, words: l.kept, note: l.note, ok: kept === 3 && (!house || shows395) && l.notSaved > 0 };
  }],
]);
