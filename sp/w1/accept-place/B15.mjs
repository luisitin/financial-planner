// B15 -- What a save has used is not offered again as "not saved": Import's "Import 10 transactions" saves and goes on to
// Categorize; the next visit to Import shows an empty paste box and no "Not saved yet".
import fs from "node:fs";
import path from "node:path";
import { H, sleep, settle, bring, look, planOf, menuTo, tapBtn, ROOT, journeys } from "./_lib.mjs";
await journeys("B15 a save that left the page used its typing", [
  ["Import: paste a bank file, import it, Import again by the menu", "family", "transactions/import", async (s, p) => {
    const csv = fs.readFileSync(path.join(ROOT, "qa/fixtures/chase-checking.csv"), "utf8");
    const ta = await bring(s, "textarea", {}); if (!ta) throw new Error("no paste box");
    await p.touchscreen.tap(ta.x, ta.y); await sleep(200); await p.keyboard.insertText(csv); await sleep(400);
    await tapBtn(s, "Use the pasted text", "button");
    await tapBtn(s, "Import ", "button"); await sleep(600);
    const n1 = ((await planOf(p)).transactions ?? []).length, at = await p.evaluate(() => location.hash);
    await menuTo(s, "Dashboard"); await menuTo(s, "Import");
    const l = await look(p);
    const paste = await p.evaluate(() => [...document.querySelectorAll("#content textarea")].map((t) => t.value.length));
    return { imported: n1, wentTo: at, pasteBoxLength: paste, words: l.notSaved, ok: n1 > 0 && l.notSaved === 0 && paste.every((n) => n === 0) };
  }],
]);
