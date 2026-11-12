// B7. All pages keeps my search and puts the page named for the word first. I search All pages for "mortgage" (typed key by
// key), open a result, press Back: the box still says "mortgage" with the same list; the "Best match" card holds the
// pages named for the word (Mortgage, Debts), never a page that only has the letters inside another word ("car": never
// Medicare). Typing and correcting 40 letters writes the address only a handful of times (Safari allows 100 in 30 s).
// usage: node B7.mjs <base> <root>
import { run, say, done, sleep, settle, mid } from "./_lib.mjs";
const best = (p) => p.evaluate(() => { const c = [...document.querySelectorAll("#content .card")].find((x) => x.querySelector("h2")?.textContent.trim() === "Best match"); return c ? [...c.querySelectorAll(".t")].map((t) => t.textContent.trim()) : []; });
const listed = (p) => p.evaluate(() => [...document.querySelectorAll("#content .page-list .t")].map((t) => t.textContent.replace("your notes", "").trim()));
await run("mortgage, open, Back", "family", "overview/pages", async (p) => {
  const box = p.getByLabel("Search pages"); const [x, y] = await mid(box); await p.touchscreen.tap(x, y); await sleep(200);
  await p.keyboard.type("mortgage", { delay: 90 }); await sleep(700);
  const b0 = await best(p); const l0 = await listed(p);
  await p.evaluate(() => document.activeElement?.blur());
  const res = p.locator("#content .page-list a.row-link").nth(1); const name = (await res.locator(".t").textContent()).trim();
  const [rx, ry] = await mid(res); await p.touchscreen.tap(rx, ry); await sleep(1000); await settle(p);
  const opened = await p.evaluate(() => location.hash);
  await p.evaluate(() => history.back()); await sleep(1000); await settle(p);
  const a = await p.evaluate(() => ({ hash: location.hash, value: document.querySelector('#content input[type=search]')?.value }));
  const l1 = await listed(p);
  const ok = b0[0] === "Mortgage" && b0.includes("Debts") && a.value === "mortgage" && JSON.stringify(l1) === JSON.stringify(l0);
  say("mortgage, open, Back", ok, `Best match: ${b0.join(" / ")}; opened "${name}" (${opened}); Back -> ${a.hash}, box "${a.value}", the same list: ${JSON.stringify(l1) === JSON.stringify(l0)}`);
});
await run("car is never Medicare", "family", "overview/pages", async (p) => {
  const box = p.getByLabel("Search pages"); const [x, y] = await mid(box); await p.touchscreen.tap(x, y); await sleep(200);
  await p.keyboard.type("car", { delay: 90 }); await sleep(700);
  const b = await best(p);
  say("car is never Medicare", b.length > 0 && !b.some((t) => /Medicare/.test(t)) && /Vehicle/.test(b[0]), `Best match for "car": ${b.join(" / ") || "(none)"}`);
});
await run("address writes", "family", "overview/pages", async (p) => {
  await p.evaluate(() => { window.__writes = 0; const r = History.prototype.replaceState, q = History.prototype.pushState; History.prototype.replaceState = function (...a) { window.__writes++; return r.apply(this, a); }; History.prototype.pushState = function (...a) { window.__writes++; return q.apply(this, a); }; });
  const box = p.getByLabel("Search pages"); const [x, y] = await mid(box); await p.touchscreen.tap(x, y); await sleep(200);
  for (const w of ["retirement", "insurance", "college"]) { await p.keyboard.type(w, { delay: 70 }); await sleep(150); for (let i = 0; i < w.length; i++) { await p.keyboard.press("Backspace"); await sleep(60); } }
  await p.keyboard.type("mortgage", { delay: 70 }); await sleep(900);
  const n = await p.evaluate(() => window.__writes); const h = await p.evaluate(() => location.hash);
  say("address writes", n <= 8 && /q=mortgage/.test(h), `typed and corrected ${"retirement insurance college".replace(/ /g, "").length * 2 + 8} keys: the address was written ${n} times; it says ${h}`);
});
done("B7 All pages keeps the search");
