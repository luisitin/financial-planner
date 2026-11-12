// B4. Typing works in the menu's Find a page. "social" typed one letter at a time: the box says "social", the cursor stays
// at the end, the box keeps the focus (the keyboard stays up), it is the same box all along, the list narrows as I type,
// Backspace removes the last letter. Also with letters committed the way an on-screen keyboard does (insertText).
// usage: node B4.mjs <base> <root>
import { run, say, done, sleep } from "./_lib.mjs";
for (const [word, how] of [["social", "keys"], ["chance", "keys"], ["net worth", "keys"], ["taxes", "insert"]]) {
  await run(`${word} (${how})`, "family", "overview/dashboard", async (p) => {
    const tb = await p.locator("#nav-toggle").boundingBox(); await p.touchscreen.tap(tb.x + 22, tb.y + 22); await sleep(500);
    const sb = await p.locator("#sidebar .nav-search").boundingBox(); await p.touchscreen.tap(sb.x + 60, sb.y + sb.height / 2); await sleep(200);
    await p.evaluate(() => { const b = document.querySelector("#sidebar .nav-search"); b.__mark = 1; window.__blurs = 0; b.addEventListener("blur", () => window.__blurs++); window.__counts = []; });
    const count = () => p.evaluate(() => window.__counts.push(document.querySelectorAll("#sidebar a.nav-link").length));
    if (how === "keys") { for (const ch of word) { await p.keyboard.type(ch); await sleep(110); await count(); } }
    else { const cdp = await p.context().newCDPSession(p); for (const ch of word) { await cdp.send("Input.insertText", { text: ch }); await sleep(110); await count(); } }
    await sleep(300);
    const a = await p.evaluate(() => { const b = document.querySelector("#sidebar .nav-search"); return { value: b.value, caret: b.selectionStart, same: b.__mark === 1, focused: document.activeElement === b, blurs: window.__blurs, boxes: document.querySelectorAll("#sidebar .nav-search").length, counts: window.__counts, first: document.querySelector("#sidebar a.nav-link")?.textContent.trim() }; });
    await p.keyboard.press("Backspace"); await sleep(250);
    const bs = await p.evaluate(() => document.querySelector("#sidebar .nav-search").value);
    const narrowed = a.counts.length > 1 && a.counts[a.counts.length - 1] <= a.counts[0];
    const ok = a.value === word && a.caret === word.length && a.same && a.focused && a.blurs === 0 && a.boxes === 1 && bs === word.slice(0, -1) && narrowed;
    say(`${word} (${how})`, ok, `box "${a.value}", cursor at ${a.caret} of ${word.length}, ${a.same ? "the same box" : "A NEW BOX"}, ${a.focused ? "focused" : "NOT FOCUSED"}, lost the focus ${a.blurs} times; rows as it narrowed ${JSON.stringify(a.counts)}; first "${a.first}"; Backspace -> "${bs}"`);
  });
}
done("B4 typing works in Find a page");
