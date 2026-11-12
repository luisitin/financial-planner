// B3. When the page itself refuses, its message is right above the button I tapped, once, and the button stays under my
// thumb, tap after tap; it stays until my next try (no 6-second timer). Your home (year 2099, Save twice, then 7 s) and
// Retirement contributions ("abc", Add twice); and a "no" about one box (ui.fieldError) at that box.
// usage: node B3.mjs <base> <root>
import { run, say, done, sleep, swipeTap, swipeInto, tap, typeIn, look, box, byText, topOf, planOf, settle, resetLog } from "./_lib.mjs";

const lineAbove = (l, re, saveTop) => { const x = l.formErrors.filter((e) => re.test(e.text)); return { n: x.length, ok: x.length === 1 && x[0].inView && saveTop - x[0].bottom >= 0 && saveTop - x[0].bottom <= 24, at: x.map((e) => `${e.top}-${e.bottom}`) }; };

await run("B3-home", "family", "property/home", async (s) => {
  const y = box(s, "Year you bought it"); await typeIn(s, y, "2099");
  const save = s.page.locator("#content form").filter({ has: s.page.getByLabel("Year you bought it") }).locator("[type=submit]");
  await swipeInto(s, save);
  const t0 = await topOf(save);
  await tap(s, save, 150); const t1 = await topOf(save); const l1 = await look(s);
  await sleep(300);
  await tap(s, save, 150); const t2 = await topOf(save); const l2 = await look(s);
  const re = /2099 is still ahead/;
  const a1 = lineAbove(l1, re, t1), a2 = lineAbove(l2, re, t2);
  say("B3-home-line", a1.ok && a2.ok, `the page's words right above Save: after tap 1 ${a1.n} copy at ${a1.at} (Save ${t1}); after tap 2 ${a2.n} at ${a2.at} (Save ${t2})`);
  say("B3-home-still", t0 === t1 && t1 === t2, `Save top ${t0} -> ${t1} -> ${t2}`);
  await sleep(7000);
  const l3 = await look(s), t3 = await topOf(save);
  say("B3-home-stays", lineAbove(l3, re, t3).ok, `7 s later: ${JSON.stringify(l3.formErrors.map((e) => `${e.text.slice(0, 50)} @${e.top}${e.inView ? "" : " (off)"}`))}`);
  const p = await planOf(s);
  say("B3-home-not-saved", JSON.stringify(p).indexOf("2099") < 0, "2099 was not saved");
});
await run("B3-contributions", "family", "retirement/contributions", async (s) => {
  const add = byText(s, /^\+ Add another contribution$/); if (await add.count()) { await swipeTap(s, add); await settle(s.page); await sleep(400); }
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=amount]") }).last();
  await typeIn(s, f.locator("[name=amount]"), "abc");
  const sub = f.locator("[type=submit]"); await swipeInto(s, sub);
  const t0 = await topOf(sub);
  await resetLog(s); await tap(s, sub, 500); const t1 = await topOf(sub); const l1 = await look(s);
  await tap(s, sub, 500); const t2 = await topOf(sub); const l2 = await look(s);
  const re = /isn't an amount/;
  const a1 = lineAbove(l1, re, t1), a2 = lineAbove(l2, re, t2);
  say("B3-contributions-line", a1.ok && a2.ok, `the page's words right above Add: ${a1.n} copy at ${a1.at}, then ${a2.n} at ${a2.at} (button ${t1}, ${t2})`);
  say("B3-contributions-still", t0 === t1 && t1 === t2, `Add top ${t0} -> ${t1} -> ${t2}`);
});
// A page's own "no" about one box, said with the kit's one call: `return ui.fieldError(box, words)`. No page calls it yet,
// so a form is built by the served kit in the running app (a card at the end of Goals), with the two rules pages have:
// a year that is still ahead, and an end before a start (put right by changing the other box).
await run("B3-fieldError", "family", "goals/goals", async (s) => {
  await s.page.evaluate(async () => {
    const src = [...document.querySelectorAll("script[type=module]")].map((x) => x.src).find((x) => /core\/app\.js/.test(x)) ?? `${location.origin}/core/app.js`;
    const ui = await import(new URL("./ui/dom.js", src).href);
    window.__saved = [];
    const f = ui.form([{ key: "what", label: "What you bought", type: "text", required: true }, { key: "bought", label: "Year you bought it", type: "number", whole: true }, { key: "from", label: "From year", type: "number", whole: true }, { key: "to", label: "To year", type: "number", whole: true }], {}, (v) => {
      const b = (k) => f.querySelector(`[name=${k}]`);
      if (v.bought > 2026) return ui.fieldError(b("bought"), `${v.bought} is still ahead. Type the year you bought it, or leave it blank.`);
      if (v.from !== null && v.to !== null && v.to < v.from) return ui.fieldError(b("to"), "Type a year that is not before the first one.");
      window.__saved.push(v);
    }, { submitLabel: "Save purchase", resetAfter: true });
    const card = ui.card("A purchase", f); card.id = "probe-card";
    document.querySelector("#content [data-page]").append(card);
  });
  const f = s.page.locator("#probe-card form"), b = (k) => f.locator(`[name=${k}]`), save = f.locator("[type=submit]");
  await typeIn(s, b("what"), "Roof"); await typeIn(s, b("bought"), "2099");
  await resetLog(s); await swipeTap(s, save, 600);
  const l1 = await look(s); const t1 = await topOf(save);
  await tap(s, save, 600); const l2 = await look(s), t2 = await topOf(save);
  const words = "2099 is still ahead. Type the year you bought it, or leave it blank.";
  const at = (l) => l.bubbles.length === 0 && l.focus?.name === "bought" && l.focus.invalid && l.focus.inView && l.labelShown === true && l.fieldErrors.length === 1 && l.fieldErrors[0].text === words && l.fieldErrors[0].inView && l.fieldErrors[0].red && !l.formErrors.length;
  say("B3-fieldError-at-the-box", at(l1) && at(l2) && t1 === t2 && (await b("what").inputValue()) === "Roof" && (await s.page.evaluate(() => window.__saved.length)) === 0,
    `Save with 2099, twice: ${l1.fieldErrors.map((x) => x.text).join(" | ")} under the box (one copy both times: ${l1.fieldErrors.length}, ${l2.fieldErrors.length}), cursor in ${l2.focus?.name}, Save ${t1} -> ${t2}, "Roof" kept, nothing saved`);
  await s.page.keyboard.press("Backspace"); await sleep(120);
  const l3 = await look(s);
  say("B3-fieldError-goes", !l3.fieldErrors.length && !l3.focus?.invalid, `one key in the box: words left ${JSON.stringify(l3.fieldErrors.map((x) => x.text))}`);
  // an end before a start, put right in the OTHER box: the save goes through and the old words do not linger
  await b("bought").evaluate((e) => { e.value = ""; });
  await typeIn(s, b("from"), "2030"); await typeIn(s, b("to"), "2028");
  await swipeTap(s, save, 600);
  const l4 = await look(s);
  await typeIn(s, b("from"), "2027");
  const stillThere = (await look(s)).fieldErrors.map((x) => x.text);
  await swipeTap(s, save, 900);
  const l5 = await look(s), saved = await s.page.evaluate(() => window.__saved);
  say("B3-fieldError-other-box", l4.fieldErrors.some((x) => /not before the first one/.test(x.text)) && stillThere.length === 1 && saved.length === 1 && saved[0].from === 2027 && saved[0].to === 2028 && !l5.fieldErrors.length && (await b("what").inputValue()) === "",
    `To 2028 before From 2030: "${l4.fieldErrors.map((x) => x.text).join("")}"; From changed to 2027 (the words still under To: ${stillThere.length}); Save: saved ${JSON.stringify(saved.map((v) => [v.from, v.to]))}, words left ${l5.fieldErrors.length}, the form emptied for the next one ${(await b("what").inputValue()) === ""}`);
});
done("B3 the page's refusal at the thumb");
