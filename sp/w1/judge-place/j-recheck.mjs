// j-recheck.mjs <A|B|T> [n] -- the journeys where A and B came out differently, again, n times, with pictures and with
// what the tap really hit: Goals save with a thumb resting (R6), Withholding's save (R8, grey under the page?), a tap on
// the note's words (L5), and the Rules page (R7, B threw "form.contains is not a function").
import fs from "node:fs";
import { H, start, swipe, Y, sleep, settle, state, seen, bring, thumb, type, look, planOf, openFolds, watch, moves, blank, shot, J } from "./lib.mjs";
const who = process.argv[2] ?? "A", N = Number(process.argv[3] ?? 2);
const rows = [];
const SH = `${J}/shots`;
async function run(name, hh, route, fn, { plan = null } = {}) {
  const s = await start(who, plan ?? H[hh](), route);
  try { await sleep(800); rows.push({ name, ...(await fn(s, s.page)), err: s.pageErrors.length ? s.pageErrors[0].slice(0, 100) : 0 }); }
  catch (e) { rows.push({ name, error: String(e.message).split("\n")[0].slice(0, 160), err: s.pageErrors[0]?.slice(0, 100) ?? 0 }); }
  try { await s.close(); } catch { }
}
for (let i = 1; i <= N; i++) {
  // R6: which goal row, what is under the thumb, every 100 ms from the Save to +6 s; the thumb rests from +3.9 s to +5 s
  await run(`R6 goals save, thumb resting #${i}`, "family", "goals/goals", async (s, p) => {
    await sleep(700);
    const row = await p.evaluate(() => { const li = [...document.querySelectorAll("#content li[role=button], #content .records li, #content .page-list li")].filter((li) => li.getClientRects().length && !li.closest(".only-wide"))[1]; return li ? li.textContent.replace(/\s+/g, " ").trim().slice(0, 18) : null; });
    await thumb(s, "li", { text: row }); await sleep(1000); await settle(p);
    await type(s, `form input[name="target"]`, "19000", { clear: true });
    const b = await bring(s, "form button", { text: "Save" });
    const y0 = await Y(p);
    await p.touchscreen.tap(b.x, b.y);
    const marks = p.evaluate(() => new Promise((res) => { const out = []; const t0 = performance.now(); const id = setInterval(() => { const at = document.elementFromPoint(200, 500); const li = at?.closest("li, h2, .card"); out.push([Math.round(performance.now() - t0), Math.round(scrollY), (li?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 20), !!document.querySelector("#content .notice.ok")]); if (performance.now() - t0 > 6200) { clearInterval(id); res(out); } }, 100); }));
    await sleep(3900);
    const cdp = await s.ctx.newCDPSession(p);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 500 }] }); await sleep(1100);
    await shot(p, `${SH}/${who}-R6-thumb-${i}.png`);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const m = await marks;
    const pick = (t) => m.reduce((a, x) => (Math.abs(x[0] - t) < Math.abs(a[0] - t) ? x : a));
    const changes = []; for (let k = 1; k < m.length; k++) if (m[k][1] !== m[k - 1][1] || m[k][2] !== m[k - 1][2]) changes.push(`${m[k][0]}ms y${m[k][1]} "${m[k][2]}"${m[k][3] ? "" : " (no notice)"}`);
    return { row, yBeforeSave: y0, at05: pick(500).slice(1).join("/"), at38: pick(3800).slice(1).join("/"), at50: pick(5000).slice(1).join("/"), at60: pick(6000).slice(1).join("/"), changes: changes.slice(0, 6).join(" | ") };
  });
  // R8: Withholding's first Save: the screen 1 s and 5 s later (grey under the page?)
  await run(`R8 withholding save #${i}`, "family", "taxes/withholding", async (s, p) => {
    const prep = await p.evaluate(() => { const b = [...document.querySelectorAll("#content form button")].find((x) => x.getClientRects().length && /save/i.test(x.textContent)); if (!b) return null; b.dataset.um = "1"; const box = [...b.form.querySelectorAll("input[inputmode=decimal], input[inputmode=numeric]")].find((c) => c.getClientRects().length); if (box) box.dataset.umbox = "1"; return { t: b.textContent.trim(), box: !!box }; });
    if (prep.box) { const bx = await bring(s, "[data-umbox]", {}); await p.touchscreen.tap(bx.x, bx.y); await sleep(150); await p.keyboard.press("Control+A"); await p.keyboard.type("123", { delay: 80 }); }
    const b = await bring(s, "[data-um]", {}); const y0 = await Y(p);
    await p.touchscreen.tap(b.x, b.y); await sleep(1000); await settle(p);
    const a = { y: await Y(p), blank: await blank(p), minH: await p.evaluate(() => document.getElementById("content").style.minHeight || "-"), docH: await p.evaluate(() => document.documentElement.scrollHeight) };
    await shot(p, `${SH}/${who}-R8-1s-${i}.png`);
    await sleep(4000);
    const c = { y: await Y(p), blank: await blank(p), minH: await p.evaluate(() => document.getElementById("content").style.minHeight || "-") };
    await shot(p, `${SH}/${who}-R8-5s-${i}.png`);
    const y1 = await Y(p); const y2 = await swipe(s, -200);
    return { saveAt: b.top, y0, at1s: JSON.stringify(a), at5s: JSON.stringify(c), dragUp200: y1 - y2 };
  });
}
// L5: a tap on the note's words: what did the tap hit?
{
  const plan = H.family(); for (const a of plan.accounts) { a.asOf = "2026-10-09"; if (Array.isArray(a.history)) for (const h of a.history) if (h.date === "2026-11-11") h.date = "2026-10-09"; }
  for (let i = 1; i <= N; i++) await run(`L5 tap on the note's words #${i}`, "family", "overview/dashboard", async (s, p) => {
    await p.evaluate(() => { location.hash = "#/overview/monthly-review"; }); await sleep(1000); await settle(p); await swipe(s, 300);
    const st = await bring(s, "a[href*='balance/update']", {}); await p.touchscreen.tap(st.x, st.y); await sleep(1300); await settle(p);
    await type(s, "input[name=a-chk]", "4650", { clear: true });
    const sv = await bring(s, "button", { text: "Save all balances" }); await p.touchscreen.tap(sv.x, sv.y); await sleep(900); await settle(p);
    const note = await p.evaluate(() => { const e = document.querySelector(".save-echo"); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); const ways = [...e.querySelectorAll("a, button")].map((w) => w.getBoundingClientRect()).map((q) => [q.top, q.bottom]); let wy = null; for (let y = r.top + 6; y < r.bottom - 4; y += 3) if (!ways.some(([t, b]) => y >= t - 2 && y <= b + 2)) { wy = y; break; } return { top: Math.round(r.top), bottom: Math.round(r.bottom), x: Math.round(r.left + r.width * 0.6), y: wy }; });
    if (!note || note.y === null) return { note };
    await p.evaluate(() => { window.__hits = []; addEventListener("click", (e) => window.__hits.push((e.target.closest("a,button,input,select,summary,label,li") ?? e.target).outerHTML.slice(0, 90)), true); });
    const before = await p.evaluate(() => ({ hash: location.hash, active: document.activeElement?.tagName }));
    const plan0 = await planOf(p);
    await p.touchscreen.tap(note.x, note.y); await sleep(1000); await settle(p);
    const plan1 = await planOf(p);
    const diff = Object.keys(plan1).filter((k) => JSON.stringify(plan1[k]) !== JSON.stringify(plan0[k]));
    await shot(p, `${SH}/${who}-L5-after-${i}.png`);
    return { noteBox: `${note.top}-${note.bottom}`, tapAt: `${note.x},${note.y}`, hits: await p.evaluate(() => window.__hits), planKeysChanged: diff.join(","), hash: (await state(p)).hash === before.hash ? "same" : (await state(p)).hash, noteGone: !(await p.evaluate(() => !!document.querySelector(".save-echo")?.getClientRects().length)) };
  }, { plan });
}
// R7: the Rules page, add a rule (B threw)
await run("R7 rules add", "family", "transactions/rules", async (s, p) => {
  const op = await p.evaluate(() => { const b = [...document.querySelectorAll("#content button")].find((x) => /add/i.test(x.textContent) && x.getClientRects().length && !x.form); return b ? b.textContent.trim() : null; });
  if (op && !(await p.evaluate(() => !!document.querySelector("#content form input[name=contains]")))) { const b = await bring(s, "button", { text: op }); await p.touchscreen.tap(b.x, b.y); await sleep(600); }
  const c = await bring(s, "input[name=contains]", {}); await p.touchscreen.tap(c.x, c.y); await sleep(150);
  const errAfterTap = s.pageErrors.length;
  await p.keyboard.type("COFFEE", { delay: 80 });
  const errAfterType = s.pageErrors.length;
  await p.evaluate(() => { const sel = document.querySelector("#content select[name=category]"); const o = [...sel.options].find((x) => x.value); sel.value = o.value; sel.dispatchEvent(new Event("change", { bubbles: true })); });
  const sub = await bring(s, "form button[type=submit], form button:not([type])", {}); await p.touchscreen.tap(sub.x, sub.y); await sleep(1200); await settle(p);
  const rules = ((await planOf(p)).rules ?? (await planOf(p)).transactionRules ?? []).length;
  return { errAfterTap, errAfterType, errTotal: s.pageErrors.length, rulesInPlan: rules, coffeeShown: await p.evaluate(() => /coffee/i.test(document.getElementById("content").textContent)) };
});
fs.writeFileSync(`${J}/out/recheck-${who}.json`, JSON.stringify(rows, null, 1));
for (const r of rows) console.log(who, JSON.stringify(r));
