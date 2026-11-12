// repro.mjs -- look at one instance of a sweep finding on a 390 x 844 phone, in the sandbox, against my own server.
//   node repro.mjs <file.json>   where the file is [{ name, household, route, steps: [...] }, ...]
// steps: { tap: "text" [, nth] } | { tapSel: "css" [, nth] } | { fill: ["label", "value"], enter?, leave? } | { type: "text" }
//        | { key: "Enter" } | { openFolds: true } | { back: true } | { forward: true } | { scroll: y } | { scrollTo: "css"|text }
//        | { kb: true } | { wait: ms } | { shot: "name" } | { state: "label" } | { eval: "js" } | { go: "route" }
// Writes shots to touch/look/<name>-<shot>.png and prints the state records as JSON.
import fs from "node:fs";
import path from "node:path";
import { open, state, settle, sleep, act, tapText, fillBox, back, kb, shot } from "$SP/ux/kit.mjs";
import { households } from "$SP/wtouch/qa/touch-lib.mjs";
const BASE = "http://127.0.0.1:9325";
const OUT = "$SP/touch/look";
fs.mkdirSync(OUT, { recursive: true });
const H = Object.fromEntries((await households("2026-11-11")).map((h) => [h.id, h]));
const jobs = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const report = [];
for (const job of jobs) {
  const h = H[job.household];
  const s = await open({ base: BASE, plan: h.plan(), route: job.route, slow: job.slow ?? 1 });
  const rec = { name: job.name, log: [] };
  try {
    for (const st of job.steps ?? []) {
      if (st.tap !== undefined) { const r = await act(s.page, () => tapText(s.page, st.tap, { nth: st.nth ?? 0 }), `tap ${st.tap}`); rec.log.push({ tap: st.tap, ms: r.ms, moved: { ...r.moved, filledOnScreen: undefined }, after: { hash: r.after.hash, scrollY: r.after.scrollY, focus: r.after.focus } }); }
      else if (st.tapSel) { const loc = s.page.locator(st.tapSel).nth(st.nth ?? 0); await loc.scrollIntoViewIfNeeded(); const r = await act(s.page, () => loc.tap(), `tap ${st.tapSel}`); rec.log.push({ tapSel: st.tapSel, moved: { ...r.moved, filledOnScreen: undefined }, after: { hash: r.after.hash, scrollY: r.after.scrollY, focus: r.after.focus } }); }
      else if (st.fill) { await fillBox(s.page, st.fill[0], st.fill[1], { enter: !!st.enter, leave: st.leave ?? !st.enter, nth: st.nth ?? 0 }); await settle(s.page); rec.log.push({ fill: st.fill, after: await state(s.page) }); }
      else if (st.type !== undefined) { await s.page.keyboard.type(st.type, { delay: 30 }); await settle(s.page); }
      else if (st.key) { const r = await act(s.page, () => s.page.keyboard.press(st.key), `key ${st.key}`); rec.log.push({ key: st.key, moved: { ...r.moved, filledOnScreen: undefined } }); }
      else if (st.openFolds) { await s.page.evaluate(() => document.querySelectorAll("#content details").forEach((d) => { d.open = true; })); await settle(s.page); }
      else if (st.back || st.forward) { const r = await back(s.page, st.back ? "back" : "forward"); rec.log.push({ [st.back ? "back" : "forward"]: { to: r.to, scrollY: r.scrollY, title: r.title } }); }
      else if (st.scroll !== undefined) { await s.page.evaluate((y) => scrollTo(0, y), st.scroll); await sleep(150); }
      else if (st.scrollTo) { await s.page.evaluate((t) => { const el = document.querySelector(t) ?? [...document.querySelectorAll("#content *")].find((e) => e.children.length === 0 && e.textContent.trim().startsWith(t)); el?.scrollIntoView({ block: "center" }); }, st.scrollTo); await sleep(200); }
      else if (st.kb) { rec.log.push({ kb: await kb(s.page, st.kb !== "down") }); }
      else if (st.twice) { const loc = s.page.getByRole("button", { name: st.twice, exact: true }).nth(st.nth ?? 0); await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); await s.page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(st.gap ?? 30); await s.page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(400); await settle(s.page); rec.log.push({ twice: st.twice }); }
      else if (st.wait) await sleep(st.wait);
      else if (st.go) { await s.page.evaluate((r) => { location.hash = "#/" + r; }, st.go); await sleep(80); await settle(s.page); }
      else if (st.eval) rec.log.push({ eval: await s.page.evaluate(st.eval) });
      else if (st.state) rec.log.push({ state: st.state, s: await state(s.page) });
      else if (st.shot) { const f = path.join(OUT, `${job.name}-${st.shot}.png`); await shot(s.page, f, { full: !!st.full }); rec.log.push({ shot: f }); }
    }
  } catch (e) { rec.error = String(e.message).split("\n")[0]; }
  rec.pageErrors = s.pageErrors;
  report.push(rec);
  await s.close();
}
console.log(JSON.stringify(report, (k, v) => (k === "filledOnScreen" || k === "notices" && Array.isArray(v) && v.length > 4 ? undefined : v), 1));
