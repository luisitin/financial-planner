// B6 -- If the form is shut when I come back, one line says my typing is kept, where the form lives: "Not saved yet: what
// you typed in “Add an income”." with "Open it" and "Undo my typing". One tap on "Open it" shows my typing. The bottom
// note says the same only when that line cannot be read once the screen is still.
import { H, Y, sleep, settle, swipe, phoneBack, seen, bring, type, vals, look, menuTo, tapBtn, journeys } from "./_lib.mjs";
const NA = "#content input[name=name], #content input[name=amount]";
const lineOf = (p) => p.evaluate(() => { const top = document.getElementById("topbar")?.getBoundingClientRect().bottom ?? 0; const l = [...document.querySelectorAll("#content .notice")].find((n) => /^Not saved yet: what you typed in “/.test(n.textContent.trim()) && n.getClientRects().length); if (!l) return null; const r = l.getBoundingClientRect(); const b = [...l.querySelectorAll("button")].map((x) => x.textContent.trim()); return { text: l.textContent.replace(/\s+/g, " ").trim().slice(0, 120), buttons: b, readable: Math.min(r.bottom, innerHeight) - Math.max(r.top, top) >= Math.min(48, 0.6 * r.height) }; });
const noteNow = (p) => p.evaluate(() => { const e = document.querySelector(".save-echo"); return e && e.getClientRects().length ? e.textContent.replace(/\s+/g, " ").trim().slice(0, 120) : null; });
await journeys("B6 one line says where my typing is, with Open it", [
  ["Income add form, menu, Back: the line, then Open it", "family", "cashflow/income", async (s, p) => {
    await tapBtn(s, "+ Add another income");
    await type(s, "input[name=name]", "Weekend tutoring"); await type(s, "input[name=amount]", "1200", { clear: true });
    const before = (await vals(p, NA)).join("|");
    await menuTo(s, "Dashboard"); await phoneBack(s); await sleep(1300);
    const line = await lineOf(p), note = await noteNow(p);
    if (!line) return { line: null, ok: false };
    const e = await bring(s, "button", { text: "Open it" }); await p.touchscreen.tap(e.x, e.y); await sleep(900); await settle(p);
    const after = (await vals(p, NA)).join("|");
    const wordsOk = /^Not saved yet: what you typed in “Add an income”\./.test(line.text) && line.buttons.includes("Open it") && line.buttons.includes("Undo my typing");
    return { line: line.text, buttons: line.buttons, lineReadable: line.readable, bottomNote: note, after, ok: wordsOk && after.replace(/,/g, "") === before.replace(/,/g, "") && !(line.readable && note && /not saved yet/i.test(note)) };
  }],
  ["Net worth add form, menu, Back: Undo my typing on the line lets it go", "family", "balance/net-worth", async (s, p) => {
    if (!(await seen(p, "button, a", { text: "+ Add another account" }))) throw new Error("no '+ Add another account'");
    await tapBtn(s, "+ Add another account");
    await type(s, "form input[name=name]", "Brokerage two"); await type(s, "form input[name=balance]", "12000", { clear: true });
    await menuTo(s, "Dashboard"); await phoneBack(s); await sleep(1300);
    const line = await lineOf(p);
    if (!line) return { line: null, ok: false };
    const u = await bring(s, ".notice button", { text: "Undo my typing" }); await p.touchscreen.tap(u.x, u.y); await sleep(600);
    const gone = !(await lineOf(p));
    await menuTo(s, "Dashboard"); await phoneBack(s); await sleep(1200);
    const l2 = await look(p);
    return { line: line.text, goneAfterUndo: gone, wordsOnNextVisit: l2.notSaved, ok: gone && l2.notSaved === 0 && /“/.test(line.text) };
  }],
  ["Net worth add form, read on down the page, menu, Back: the line is out of sight, so the bottom note says it", "family", "balance/net-worth", async (s, p) => {
    await tapBtn(s, "+ Add another account");
    await type(s, "form input[name=name]", "Brokerage two"); await type(s, "form input[name=balance]", "12000", { clear: true });
    await swipe(s, 900); const left = await Y(p);
    await menuTo(s, "Dashboard"); await phoneBack(s); await sleep(1300);
    const line = await lineOf(p), note = await noteNow(p), y = await Y(p);
    if (!line) return { line: null, ok: false };
    const said = !!note && /^.?Not saved yet: what you typed in “Add an account”\./.test(note) && /Open it/.test(note);
    let after = null;
    if (said) { const w = await p.evaluate(() => { const b = [...document.querySelectorAll(".save-echo a, .save-echo button")].find((x) => /Open it/.test(x.textContent)); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); if (w) { await p.touchscreen.tap(w.x, w.y); await sleep(900); await settle(p); after = (await vals(p, "#content form input[name=name], #content form input[name=balance]")).join("|"); } }
    return { leftAt: left, backAt: y, lineReadable: line.readable, bottomNote: note, afterOpenIt: after,
      ok: line.readable ? !note : said && /Brokerage two\|12,?000/.test(after ?? "") };
  }],
]);
