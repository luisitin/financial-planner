// qa/shell-taps.mjs -- a second tap does what one tap does (core/taps.js). Real touches on a phone, in the sandbox:
//   a double tap on "+ Add another income" opens the form once; a double tap on its Add saves one income; a double tap on
//   a Dashboard tile opens one page (one step of history); a second tap on the same picker still opens it (a picker is
//   never a repeat); a button inside [data-taps="repeat"] is never held back.
//   node qa/shell-taps.mjs [base URL]
import { run, say, done, sleep, settle, tap, family, planOf, shell } from "./shell-lib.mjs";
const twice = async (p, loc, gap) => {
  await loc.scrollIntoViewIfNeeded(); await sleep(250);
  const b = await loc.boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await p.touchscreen.tap(x, y); await sleep(gap); await p.touchscreen.tap(x, y); await sleep(1200); await settle(p);
};
for (const gap of [150, 400]) {
  await run(`add form, ${gap} ms`, family(), "cashflow/income", async (p) => {
    const n0 = (await planOf(p)).income.length;
    await twice(p, p.locator("#content button").filter({ hasText: "+ Add another income" }).first(), gap);
    const forms = await p.locator("#content form:visible").count();
    await tap(p, p.getByLabel("What is it").first(), 200); await p.keyboard.type("Side gig", { delay: 30 });
    await tap(p, p.getByLabel("Amount").first(), 200); await p.keyboard.type("900", { delay: 30 });
    await p.evaluate(() => document.activeElement?.blur()); await sleep(300);
    await twice(p, p.locator("#content form:visible button[type=submit]").first(), gap);
    const n1 = (await planOf(p)).income.length;
    say(`add form, ${gap} ms`, forms === 1 && n1 === n0 + 1, `two taps ${gap} ms apart: ${forms} form(s) open; two taps on Add: ${n1 - n0} income added`);
  });
  await run(`a tile, ${gap} ms`, family(), "overview/dashboard", async (p) => {
    const a = await shell(p);
    await twice(p, p.locator("#content a.stat-link").first(), gap);
    const b = await shell(p);
    const c = await p.evaluate(() => history.back()).then(() => sleep(900)).then(() => shell(p));
    say(`a tile, ${gap} ms`, b.hash !== a.hash && c.hash === a.hash, `two taps ${gap} ms apart -> ${b.hash}; one Back -> ${c.hash}`);
  });
}
await run("a picker tapped again", family(), "cashflow/income", async (p) => {
  await tap(p, p.locator("#content button").filter({ hasText: "+ Add another income" }).first());
  const sel = p.locator("#content form:visible select").first();
  const seen = await p.evaluate(() => { window.__qaTaps = 0; document.addEventListener("click", (e) => { if (e.target.closest?.("select")) window.__qaTaps++; }, true); return true; });
  await twice(p, sel, 400);
  const got = await p.evaluate(() => window.__qaTaps);
  say("a picker tapped again", seen && got === 2, `two taps on the same picker 400 ms apart: ${got} reached it`);
});
await run("data-taps=repeat", family(), "cashflow/income", async (p) => {
  await p.evaluate(() => {
    const box = document.createElement("div"); box.dataset.taps = "repeat"; box.style.cssText = "position:fixed;left:20px;top:300px;z-index:50";
    const b = document.createElement("button"); b.type = "button"; b.textContent = "+1"; b.style.cssText = "width:88px;height:44px"; window.__qaCount = 0; b.addEventListener("click", () => window.__qaCount++);
    box.append(b); document.body.append(box);
  });
  for (let i = 0; i < 3; i++) { await p.touchscreen.tap(64, 322); await sleep(200); }
  const n = await p.evaluate(() => window.__qaCount);
  say("data-taps=repeat", n === 3, `three taps 200 ms apart on a button inside [data-taps="repeat"]: ${n} counted`);
});
done("shell-taps: a second tap does what one tap does");
