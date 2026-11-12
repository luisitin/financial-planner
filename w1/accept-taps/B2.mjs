// B2. Taps I mean always land: a stepper's + three times counts three; two neighbouring tiles tapped quickly both tick; a
// fold opens; a box tapped twice keeps the cursor; "+ Add another" a second after Add; a swipe that starts where I just
// tapped scrolls; the next box after typing; the menu button twice opens and closes; a page's first control a second after
// it opened; a picker I just changed opens again at once; the next row's picker that slid up after I chose a category.
// usage: node B2.mjs <base> <root>
import { H, run, say, done, sleep, settle, state, tapText, fillBox, mid, under, bringTo, swipe, swallowed, shell } from "./_lib.mjs";
const tapXY = (p, x, y) => p.touchscreen.tap(x, y);
const focusIs = (p) => p.evaluate(() => { const a = document.activeElement; return a && a !== document.body ? `${a.tagName.toLowerCase()} ${a.getAttribute("aria-label") || a.name || a.id || ""}`.trim() : "body"; });
// Get started: past the welcome to the first question with a "More:" stepper
async function toQuestions(p) { await tapText(p, "Let's go", { scope: "#content" }); await settle(p); await sleep(900); }

await run("P1-stepper", null, "overview/setup", async (p) => {
  await toQuestions(p);
  const plus = p.locator('#content button[aria-label^="More:"]').first();
  const [x, y] = await mid(plus); await sleep(600);
  for (let i = 0; i < 3; i++) { await tapXY(p, x, y); await sleep(200); }
  await sleep(400);
  const v = await p.evaluate(() => document.querySelector('#content button[aria-label^="More:"]').parentElement.textContent.replace(/\s+/g, " ").trim().slice(0, 40));
  say("P1-stepper", /\b3\b/.test(v), `three taps on + 200 ms apart -> "${v}" (swallowed ${JSON.stringify(await swallowed(p))})`);
});
await run("P2-neighbours", null, "overview/setup", async (p) => {
  await toQuestions(p);
  const multi = () => p.evaluate(() => document.querySelectorAll('#content [aria-pressed]').length >= 4);
  for (let i = 0; i < 10 && !(await multi()); i++) {
    const next = p.locator("#content button:visible", { hasText: /^(Continue|Skip this question)/ }).first(); if (!(await next.count())) break;
    await bringTo(p, next, 600); const [sx, sy] = await mid(next); await tapXY(p, sx, sy); await settle(p); await sleep(1000); await p.evaluate(() => scrollTo(0, 0)); await sleep(300);
  }
  const tiles = p.locator('#content [aria-pressed]:visible');
  const a = tiles.nth(0), b = tiles.nth(1); const [ax, ay, ab] = await mid(a); const [bx, by, bb] = await mid(b);
  const sameRow = Math.abs(ay - by) < 10;
  const p1 = sameRow ? [ab.x + ab.width - 8, ay] : [ax, ab.y + ab.height - 8], p2 = sameRow ? [bb.x + 8, by] : [bx, bb.y + 8];
  await sleep(600); await tapXY(p, ...p1); await sleep(300); await tapXY(p, ...p2); await sleep(500);
  const on = await p.evaluate(() => document.querySelectorAll('#content [aria-pressed="true"]').length);
  say("P2-neighbours", on === 2, `two tiles ${Math.round(Math.hypot(p1[0] - p2[0], p1[1] - p2[1]))} px apart, 300 ms apart -> ${on} ticked (swallowed ${JSON.stringify(await swallowed(p))})`);
});
await run("P3-fold", "family", "system/help", async (p) => {
  const s0 = p.locator("#content details > summary").first(); const [x, y] = await mid(s0); const open0 = await s0.evaluate((e) => e.parentElement.open);
  await tapXY(p, x, y); await sleep(700); const open1 = await s0.evaluate((e) => e.parentElement.open);
  await tapXY(p, x, y); await sleep(700); const open2 = await s0.evaluate((e) => e.parentElement.open);
  say("P3-fold", open1 !== open0 && open2 === open0, `a fold tapped, then tapped again 700 ms later: ${open0} -> ${open1} -> ${open2}`);
});
await run("P4-meant-later", null, "overview/setup", async (p) => {
  await toQuestions(p);
  const c = p.locator("#content button:visible").filter({ hasText: /^Continue/ }).last(); const [x, y] = await mid(c); await sleep(600);
  await tapXY(p, x, y); await sleep(1100); const h1 = (await shell(p)).hash; const hit = await under(p, x, y);
  await tapXY(p, x, y); await sleep(900); await settle(p); const h2 = (await shell(p)).hash;
  say("P4-meant-later", h2 !== h1 || (await swallowed(p)).length === 0, `Continue, then a meant tap 1100 ms later on ${hit}: ${h1} -> ${h2} (swallowed ${JSON.stringify(await swallowed(p))})`);
});
await run("P5-box-twice", "family", "cashflow/income", async (p) => {
  await tapText(p, "+ Add another income", { scope: "#content" }); await sleep(900);
  const box = p.getByLabel("What is it").first(); const [x, y] = await mid(box);
  await tapXY(p, x, y); await sleep(250); await tapXY(p, x, y); await sleep(400);
  const f = await focusIs(p);
  say("P5-box-twice", /^input/.test(f), `a box tapped twice 250 ms apart: focus on ${f}`);
});
await run("P6-add-then-add", "family", "cashflow/income", async (p) => {
  await tapText(p, "+ Add another income", { scope: "#content" }); await sleep(400); await fillBox(p, "What is it", "Tips"); await fillBox(p, "Amount", "250");
  const b = p.locator("#content form:visible button[type=submit]").first(); await bringTo(p, b, 600); await sleep(900); const [x, y] = await mid(b);
  await tapXY(p, x, y); await sleep(1100); await settle(p);
  const again = p.locator("#content button:visible", { hasText: "+ Add another income" }).first();
  const forms0 = await p.locator("#content form:visible").count();
  const [ax, ay] = await mid(again); await tapXY(p, ax, ay); await sleep(700);
  const forms1 = await p.locator("#content form:visible").count();
  say("P6-add-then-add", forms1 > forms0, `Add, then "+ Add another income" a second later: open forms ${forms0} -> ${forms1}`);
});
await run("P7-swipe-after-tap", "family", "balance/net-worth", async (p) => {
  const y0 = (await shell(p)).y;
  await tapXY(p, 195, 600); await sleep(250); await swipe(p, 195, 600, 250); await sleep(300);
  const y1 = (await shell(p)).y;
  say("P7-swipe-after-tap", y1 - y0 > 150, `a tap, then a swipe from the same spot 250 ms later: page ${y0} -> ${y1}`);
});
await run("P8-next-box", "family", "balance/update", async (p) => {
  const boxes = p.locator('#content input[type=text]:visible, #content input[inputmode]:visible'); const a = boxes.nth(0), b = boxes.nth(1);
  const [x0, y0] = await mid(a); await tapXY(p, x0, y0); await sleep(200); await p.keyboard.type("4321", { delay: 60 });
  const name1 = await b.evaluate((e) => e.getAttribute("aria-label") || e.name || e.id);
  const [x, y] = await mid(b); await tapXY(p, x, y); await sleep(500);
  const f = await focusIs(p);
  say("P8-next-box", /^input/.test(f) && f.includes(name1 || ""), `typed in box 1, tapped box 2 ("${name1}"): focus on ${f}`);
});
await run("P9-menu-twice", "family", "overview/dashboard", async (p) => {
  const b = await p.locator("#nav-toggle").boundingBox(); const x = b.x + 22, y = b.y + 22;
  await tapXY(p, x, y); await sleep(350); const a = await shell(p); await tapXY(p, x, y); await sleep(500); const c = await shell(p);
  say("P9-menu-twice", a.open && !c.open, `the menu button twice 350 ms apart: open ${a.open} -> ${c.open}`);
});
await run("P11-first-tap-on-new-page", "family", "overview/dashboard", async (p) => {
  const tile = p.locator("#content a.stat-link").first(); const [x, y] = await mid(tile);
  await tapXY(p, x, y); await sleep(1100); await settle(p); const h0 = (await shell(p)).hash;
  const first = p.locator("#content a:visible, #content button:visible").first(); const what = (await first.textContent()).replace(/\s+/g, " ").trim().slice(0, 30);
  const [fx, fy] = await mid(first); await sleep(200);
  const before = await shell(p); await tapXY(p, fx, fy); await sleep(900); await settle(p); const after = await shell(p);
  say("P11-first-tap-on-new-page", after.hash !== before.hash || after.text !== before.text || after.focus !== before.focus, `opened ${h0}; its first control "${what}" tapped 1.1 s later: ${before.hash} -> ${after.hash}`);
});
// a picker that saves on change, changed and tapped again at once to fix the choice (People: the state you live in)
for (const gap of [300, 600]) await run(`P12-picker-again-${gap}`, "family", "household/people", async (p) => {
  const sel = p.locator("#content select").filter({ has: p.locator("option", { hasText: "Choose a state" }) }).first();
  const [x, y] = await mid(sel); await sleep(500);
  await tapXY(p, x, y); await sleep(1200);                    // opens the picker; turning the wheel
  await sel.selectOption({ index: 5 });                       // it lands one row off: a change, saved at once (the page is drawn again)
  await sleep(gap);
  await p.evaluate(() => { window.__fin = []; document.addEventListener("focusin", (e) => window.__fin.push(e.target.tagName), true); document.activeElement?.blur?.(); });
  await tapXY(p, x, y); await sleep(500);
  const got = await p.evaluate(() => window.__fin);
  say(`P12-picker-again-${gap}`, got.includes("SELECT"), `changed, then tapped again ${gap} ms later: the picker took the tap: ${got.includes("SELECT")} (focus went to ${JSON.stringify(got)}; swallowed ${JSON.stringify(await swallowed(p))})`);
});
// the next row's picker slides up under the thumb after a category is chosen (Categorize: one row per payee)
const withTxns = () => { const pl = H.family(); const acct = (pl.accounts ?? [])[0]?.id ?? "chk"; pl.transactions = [...(pl.transactions ?? []), ...["Corner Bakery", "Lakeside Hardware", "Blue Pine Books", "Harbor Pharmacy"].map((payee, i) => ({ id: `w1t${i}`, accountId: acct, date: `2026-10-0${i + 1}`, amount: -(12 + i), payee, category: "" }))]; return pl; };
async function nextRow(id, p, { pick, tap, gap }) {
  const sels = p.locator('#content select[aria-label^="Category for"]:visible');
  const n0 = await sels.count();
  if (n0 < 2) { say(id, false, `needs two payees to file; the page shows ${n0}`); return; }
  const first = sels.nth(0); const label0 = await first.getAttribute("aria-label"); const [x, y] = await mid(first); await sleep(500);
  await tap(x, y); await sleep(900);
  await pick(first); await sleep(gap);                         // a category picked: the row is filed and leaves
  // the next row's picker: under the finger when the list slid up, else where the page put it (no scrolling)
  const next = await p.evaluate(([x, y, l0]) => { const ss = [...document.querySelectorAll('#content select[aria-label^="Category for"]')].filter((s) => s.getAttribute("aria-label") !== l0); const r = ss.map((s) => ({ l: s.getAttribute("aria-label"), r: s.getBoundingClientRect() })).filter((o) => o.r.top > 60 && o.r.bottom < innerHeight).sort((a, b) => Math.hypot(a.r.left + a.r.width / 2 - x, a.r.top + a.r.height / 2 - y) - Math.hypot(b.r.left + b.r.width / 2 - x, b.r.top + b.r.height / 2 - y))[0]; return r ? { l: r.l, x: r.r.left + r.r.width / 2, y: r.r.top + r.r.height / 2 } : null; }, [x, y, label0]);
  if (!next) { say(id, false, `filed "${label0}"; no other picker on the screen`); return; }
  await p.evaluate(() => { window.__fin = []; document.addEventListener("focusin", (e) => window.__fin.push(e.target.getAttribute("aria-label") || e.target.tagName), true); document.activeElement?.blur?.(); });
  await tap(next.x, next.y); await sleep(500);
  const got = await p.evaluate(() => window.__fin);
  const d = Math.round(Math.hypot(next.x - x, next.y - y));
  say(id, got.includes(next.l), `filed "${label0}"; ${gap} ms later the next picker "${next.l}" is ${d < 40 ? "under the finger" : `${d} px away (the page moved its list)`}; the tap on it focused ${JSON.stringify(got)} (swallowed ${JSON.stringify(await swallowed(p))})`);
}
// on a phone, at a person's pace (the pick itself is made by the test, so the browser does not see it as the person's)
await run("P13a-next-row-picker-touch", withTxns, "transactions/categorize", (p) => nextRow("P13a-next-row-picker-touch", p, { gap: 1000, tap: (x, y) => p.touchscreen.tap(x, y), pick: (sel) => sel.selectOption({ index: 2 }) }));
// a real pick (the keyboard's, which the browser counts as the person's) and a quick second click 400 ms after it
await run("P13b-next-row-picker-quick", withTxns, "transactions/categorize", (p) => nextRow("P13b-next-row-picker-quick", p, { gap: 400, tap: (x, y) => p.mouse.click(x, y), pick: async () => { await p.keyboard.press("Escape"); await p.keyboard.press("ArrowDown"); await p.keyboard.press("Tab"); } }), { touch: false });
done("B2 taps I mean always land");
