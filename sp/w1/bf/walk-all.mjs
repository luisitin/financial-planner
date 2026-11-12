// walk-all.mjs <base> <root> [part i/n] -- every usable page, the family: one key typed in every visible box of every
// form on the page as it opens (and the first form a "+ Add" button opens), then a tap on that form's Save or Add.
// Counts page errors (the seams' all-pages walk: Rules and Goals included, whose boxes are named `contains` and `target`).
import fs from "node:fs";
import { open, households, pages, sleep, settle } from "$SP/ux/kit.mjs";
const [BASE, ROOT, PART = "0/1", HH = "family"] = process.argv.slice(2);
const [pi, pn] = PART.split("/").map(Number);
const H = await households(ROOT);
const list = (await pages(ROOT)).filter((p) => !p.builderOnly).map((p) => p.key).filter((_, i) => i % pn === pi);
const out = [];
for (const key of list) {
  const s = await open({ base: BASE, plan: H[HH](), route: key });
  const rec = { key, forms: 0, typed: 0, saves: 0, bubbles: 0, errors: [] };
  try {
    s.page.setDefaultTimeout(4000);
    await s.page.evaluate(() => { window.confirm = () => false; window.__b = 0; document.addEventListener("invalid", (e) => { if (!e.defaultPrevented) window.__b++; }, true); });
    // a form behind a "+ Add ..." button: open the first one
    const add = s.page.locator("#content button:visible").filter({ hasText: /^\+ Add/ }).first();
    if (await add.count()) { await add.tap().catch(() => { }); await sleep(250); }
    const forms = s.page.locator("#content form:visible");
    const n = Math.min(await forms.count(), 3);
    for (let i = 0; i < n; i++) {
      const f = forms.nth(i);
      if (!(await f.count())) break;
      rec.forms++;
      const boxes = f.locator("input:visible:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]):not([type=submit]), textarea:visible");
      const m = Math.min(await boxes.count(), 14);
      for (let j = 0; j < m; j++) {
        const b = boxes.nth(j);
        try { await b.tap({ timeout: 1500 }); const t = await b.getAttribute("type"); await s.page.keyboard.type(t === "date" ? "1" : /decimal|numeric/.test((await b.getAttribute("inputmode")) ?? "") || t === "number" ? "7" : "a", { delay: 30 }); rec.typed++; } catch { }
      }
      const save = f.locator("[type=submit]:visible").first();
      if (await save.count()) { try { await save.tap({ timeout: 2000 }); rec.saves++; } catch { } await sleep(350); }
    }
    await settle(s.page);
    rec.bubbles = await s.page.evaluate(() => window.__b ?? 0).catch(() => -1);
  } catch (e) { rec.errors.push("walk: " + String(e.message).split("\n")[0].slice(0, 120)); }
  rec.errors.push(...s.pageErrors.map((e) => "page: " + e.slice(0, 200)));
  out.push(rec);
  if (rec.errors.length || rec.bubbles) console.log(JSON.stringify(rec));
  await s.close();
}
const bad = out.filter((r) => r.errors.some((e) => e.startsWith("page:")));
console.log(`part ${PART} (${HH}): ${out.length} pages, ${out.reduce((t, r) => t + r.forms, 0)} forms, ${out.reduce((t, r) => t + r.typed, 0)} boxes typed in, ${out.reduce((t, r) => t + r.saves, 0)} Save taps, ${bad.length} pages with page errors, ${out.reduce((t, r) => t + Math.max(0, r.bubbles), 0)} browser bubbles`);
fs.writeFileSync(`$SP/w1/bf/out/walk-${HH}-${pi}of${pn}-${new URL(BASE).port}.json`, JSON.stringify(out, null, 1));
process.exit(bad.length ? 1 : 0);
