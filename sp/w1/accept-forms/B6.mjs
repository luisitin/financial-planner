// B6. In a text, phone or email box, Return goes to the next box I type in; only the last box saves. The key reads
// "next", and "done" in the last box. A choice list or tick box in between is skipped; a notes box is not. Two quick
// Returns save once. A what-if box in no form (Capital gains' Gain, step 1000) holding 1250: Return says nothing, the
// keyboard goes down and the answer uses 1250. Keyboard journeys (no touch), keys pressed at a person's pace.
// usage: node B6.mjs <base> <root>
import { run, say, done, sleep, settle, typeKeys, keyWalk, look, planOf, focusText, PACE } from "./_lib.mjs";

await run("B6-contacts", "family", "household/contacts", async (s) => {
  const add = s.page.locator("#content button").filter({ hasText: /^Add someone$/ }).first(); await add.focus(); await s.page.keyboard.press("Enter"); await sleep(600);
  const first = s.page.locator("#content form input[name=name]").first(); if (!(await first.evaluate((e) => e === document.activeElement))) await first.focus();
  await typeKeys(s, "Dr Lee");
  const walk = await keyWalk(s, 8);
  const saved = JSON.stringify((await planOf(s)).contacts ?? []).includes("Dr Lee");
  say("B6-contacts", walk.join(" ") === "name:next firm:next phone:next email:next notes:-" && !saved, `Return walk: ${walk.join(" -> ")}; saved early: ${saved}`);
}, { touch: false });
await run("B6-gifting", "family", "estate/gifting", async (s) => {
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=to]") }).first();
  await f.locator("[name=to]").focus(); await typeKeys(s, "Sam");
  const walk = await keyWalk(s, 8, async (st) => { if (st.n === "amount") await typeKeys(s, "500"); });
  const gifts = ((await planOf(s)).estate?.gifts ?? []).filter((g) => /Sam/.test(g.to ?? g.name ?? "")).length;
  say("B6-gifting", walk[0] === "to:next" && walk.includes("amount:next") && /^notes:/.test(walk[walk.length - 1]) && !walk.some((w) => /^(from|giver)/i.test(w)) && gifts === 0,
    `Return walk (choices skipped): ${walk.join(" -> ")}; gifts to Sam saved: ${gifts}`);
}, { touch: false });
await run("B6-networth-twice", "family", "balance/net-worth", async (s) => {
  const before = (await planOf(s)).accounts.length;
  const add = s.page.locator("#content button").filter({ hasText: /^\+ Add another account$/ }).first(); await add.focus(); await s.page.keyboard.press("Enter"); await sleep(600);
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=balance]") }).first();
  await f.locator("[name=name]").focus(); await typeKeys(s, "Credit union");
  const walk = [];
  for (let i = 0; i < 8; i++) {
    const st = await s.page.evaluate(() => ({ n: document.activeElement?.name || document.activeElement?.tagName, hint: document.activeElement?.enterKeyHint, tag: document.activeElement?.tagName }));
    walk.push(`${st.n}:${st.hint || "-"}`);
    if (st.n === "balance") await typeKeys(s, "2500");
    if (st.hint === "done") { await s.page.keyboard.press("Enter"); await sleep(300); await s.page.keyboard.press("Enter"); await sleep(1000); break; }
    if (st.tag !== "INPUT") break;
    await s.page.keyboard.press("Enter"); await sleep(PACE);
  }
  await settle(s.page);
  const acc = (await planOf(s)).accounts;
  say("B6-networth-twice", walk[walk.length - 1].endsWith(":done") && acc.length - before === 1 && acc.filter((a) => a.name === "Credit union").length === 1,
    `Return walk: ${walk.join(" -> ")}, then Return twice 300 ms apart: ${acc.length - before} account added`);
}, { touch: false });
await run("B6-capital-gains", "family", "taxes/capital-gains", async (s) => {
  const gain = s.page.locator("#content").getByLabel("Gain", { exact: true }).first();
  if (!(await gain.count())) { say("B6-capital-gains", false, "no Gain box on Capital gains"); return; }
  await gain.focus(); await gain.evaluate((e) => { e.value = ""; }); await typeKeys(s, "1250");
  const answerBefore = await s.page.locator("#content").innerText();
  await s.page.keyboard.press("Enter"); await sleep(700); await settle(s.page);
  const l = await look(s), focus = await focusText(s), text = await s.page.locator("#content").innerText();
  say("B6-capital-gains", !l.fieldErrors.length && focus !== "INPUT " && !/^INPUT .*Gain/.test(focus) && text !== answerBefore && /1,250/.test(text),
    `1250 in Gain (step 1000), Return: words ${JSON.stringify(l.fieldErrors.map((x) => x.text))}, focus now ${focus}, the answer mentions $1,250: ${/1,250/.test(text)}`);
}, { touch: false });
done("B6 Return walks the boxes");
