// B10. (pages that adopt it, A2 to A4) A one-tap change can be taken back from its own green line: the line is drawn where
// the button was, says what changed, and carries an outlined 44 px "Undo" on a line of its own, on my screen; it stays (no
// timer); Undo puts back exactly what the tap changed and says so in the page's words. How much to take out, family,
// "Plan on $X a month" swiped to mid-screen, at 390 x 844 and 390 x 664. Until retirement/withdrawal-strategy adopts
// ui.undoable (A2, after the kit is on main), this serves accept-forms/pages/withdrawal-strategy.view.js in its place.
// usage: node B10.mjs <base> <root>
import { run, say, done, sleep, settle, swipeInto, swipeTap, tap, look, rect, inViewNow, planOf, topOf } from "./_lib.mjs";

for (const vh of [844, 664]) await run(`B10-${vh}`, "family", "retirement/withdrawal-strategy", async (s) => {
  if (vh === 844) console.log(`     page: ${s.swapped.join("; ")}`);
  await sleep(2500); await settle(s.page);
  const planOn = s.page.locator("#content button").filter({ hasText: /^Plan on .* a month$/ }).first();
  if (!(await planOn.count())) { say(`B10-${vh}`, false, 'no "Plan on $X a month" button for this household'); return; }
  const label = (await planOn.textContent()).trim();
  const before = JSON.stringify((await planOf(s)).retirement ?? {});
  await swipeInto(s, planOn, { at: 0.55 }); const bTop = await topOf(planOn);
  await tap(s, planOn, 1800); await settle(s.page);
  const undo = s.page.locator("#content .notice.ok button").filter({ hasText: /^Undo$/ }).first();
  if (!(await undo.count())) { say(`B10-${vh}-undo-shown`, false, `"${label}" tapped: no Undo on the green line`); return; }
  const u = await rect(undo), on = await inViewNow(undo);
  const line = await undo.evaluate((e) => { const n = e.closest(".notice"); const b = n.getBoundingClientRect(); const words = n.cloneNode(true); words.querySelector(".notice-actions")?.remove(); return { top: Math.round(b.top), text: words.textContent.replace(/\s+/g, " ").trim(), ownLine: !!e.closest(".notice-actions") && e.getBoundingClientRect().top >= n.querySelector(".notice-actions").getBoundingClientRect().top, outlined: e.classList.contains("secondary") }; });
  const changed = JSON.stringify((await planOf(s)).retirement ?? {}) !== before;
  say(`B10-${vh}-undo-shown`, on && u.h >= 44 && line.ownLine && line.outlined && changed && Math.abs(line.top - bTop) < 260,
    `"${label}" tapped at ${bTop} px: the green line at ${line.top} px says "${line.text.slice(0, 90)}"; Undo ${u.w}x${u.h} at ${u.top}-${u.bottom} on screen ${on}, own line ${line.ownLine}, outlined ${line.outlined}`);
  await sleep(5000);
  say(`B10-${vh}-stays`, (await undo.count()) > 0 && (await inViewNow(undo)), "5 s later the Undo is still there and on screen");
  await swipeTap(s, undo, 1500); await settle(s.page);
  const after = JSON.stringify((await planOf(s)).retirement ?? {}), l = await look(s);
  say(`B10-${vh}-undone`, after === before && l.okInView.some((t) => /^Back to .* a month, as before\./.test(t)), `Undo: the plan's retirement figures as before ${after === before}; green line on screen ${JSON.stringify(l.okInView)}`);
}, { viewport: { width: 390, height: vh }, swap: { "retirement/withdrawal-strategy": { file: "withdrawal-strategy.view.js", marker: "ui.undoable" } } });
done("B10 Undo after a one-tap change");
