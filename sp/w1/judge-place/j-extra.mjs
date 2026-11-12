// j-extra.mjs <A|B|T> -- what the person sees at the moments where A and B differ (pictures), the stray-tap note's
// timing, and what a Back costs on long pages at 4x slower CPU (long tasks, time until the page is still).
import fs from "node:fs";
import { H, start, swipe, Y, sleep, settle, state, phoneBack, seen, bring, thumb, type, look, menuTo, shot, J } from "./lib.mjs";
const who = process.argv[2] ?? "A";
const rows = [];
const SH = `${J}/shots`;
async function run(name, hh, route, fn, opts = {}) {
  const s = await start(who, H[hh](), route, opts);
  try { await sleep(700); rows.push({ name, ...(await fn(s, s.page)), err: s.pageErrors.length ? s.pageErrors[0].slice(0, 80) : 0 }); }
  catch (e) { rows.push({ name, error: String(e.message).split("\n")[0].slice(0, 160) }); }
  try { await s.close(); } catch { }
}
const tapRow = async (s, text) => { await thumb(s, "li, [role=button], .rec, tr, a, button", { text }); await sleep(150); };
// E1 the stray tap: what is on the screen in the 3 s after it (a note, a line), sampled every 250 ms
await run("E1 stray tap: what the screen says", "family", "cashflow/income", async (s, p) => {
  await tapRow(s, "Ana's salary"); await sleep(900); await settle(p);
  await type(s, "input[name=amount]", "4100", { clear: true }); await sleep(400);
  await tapRow(s, "Bo's salary");
  const seenAt = [];
  for (let t = 0; t < 12; t++) { const l = await look(p); seenAt.push(`${t * 250}ms:${l.notSavedOnScreen}${l.note ? "+note" : ""}`); await sleep(250); }
  await shot(p, `${SH}/${who}-E1-stray.png`);
  const l = await look(p);
  return { samples: seenAt.join(" "), note: l.note, lines: l.kept.join(" / ").slice(0, 160) };
});
// E2 back on Income after the add form was typed and left by the menu: the picture
await run("E2 kept line on return", "family", "cashflow/income", async (s, p) => {
  await thumb(s, "button, a", { text: "+ Add another income" }); await sleep(800);
  await type(s, "input[name=name]", "Weekend tutoring"); await type(s, "input[name=amount]", "1200", { clear: true });
  await menuTo(s, "Dashboard"); await phoneBack(s, 1500); await sleep(1500);
  await shot(p, `${SH}/${who}-E2-return.png`);
  const l = await look(p);
  return { y: await Y(p), lines: l.kept.join(" / ").slice(0, 160), onScreen: l.notSavedOnScreen, note: l.note };
});
// E3 Update my balances saved: the picture with the confirmation
await run("E3 update balances saved", "family", "balance/update", async (s, p) => {
  await type(s, "input[name=a-chk]", "3900", { clear: true });
  const b = await bring(s, "button", { text: "Save all balances" }); await p.touchscreen.tap(b.x, b.y); await sleep(1100); await settle(p);
  await shot(p, `${SH}/${who}-E3-saved.png`);
  return { note: (await look(p)).note };
});
// E4 the cost of a Back on long pages at 4x slower CPU: long tasks and time until nothing changes
for (const [hh, route, dy] of [["family", "overview/pages", 3600], ["family", "transactions/ledger", 2400], ["ruth", "retirement/projection", 1700]]) {
  await run(`E4 cost of Back x4 ${route}`, hh, route, async (s, p) => {
    await sleep(1500); await swipe(s, dy); const y0 = await Y(p);
    await menuTo(s, "Dashboard"); await sleep(1200);
    const l0 = (await state(p)).long;
    const t0 = Date.now(); await p.goBack(); await sleep(100); const quiet = await settle(p, 300, 15000); const ms = Date.now() - t0;
    const st = await state(p);
    return { leftAt: y0, backAt: st.scrollY, msToStill: ms, longTaskMs: st.long - l0 };
  }, { slow: 4 });
}
fs.writeFileSync(`${J}/out/extra-${who}.json`, JSON.stringify(rows, null, 1));
for (const r of rows) console.log(who, JSON.stringify(r));
