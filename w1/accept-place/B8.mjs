// B8 -- Saving one part of a page keeps my typing in another part: the other form's boxes keep their typing, its section
// stays open, "Not saved yet" beside its button. A tap that only redraws (a month chip) lets go of nothing.
import { H, sleep, settle, seen, bring, thumb, type, vals, look, planOf, openFold, openFolds, tapBtn, topOf, journeys } from "./_lib.mjs";
const same = (a, b) => a.replace(/,/g, "") === b.replace(/,/g, "");
const octPlan = () => { const plan = H.family(); for (const a of plan.accounts) { a.asOf = "2026-10-09"; if (Array.isArray(a.history)) for (const h of a.history) if (h.date === "2026-11-11") h.date = "2026-10-09"; } return plan; };
await journeys("B8 a save elsewhere keeps my typing", [
  ["Health: 'Add a plan' typed, the coverage form saved", "family", "insurance/health", async (s, p) => {
    await type(s, "input[name=name]", "Silver PPO"); await type(s, "input[name=premium]", "250", { clear: true });
    const sel = "#content form input[name=name], #content form input[name=premium]", before = (await vals(p, sel)).join("|");
    await openFold(s, "Your coverage");
    await bring(s, "select[name=tier]", {}); await p.selectOption("#content select[name=tier]", { index: 1 }); await sleep(250);
    await thumb(s, "details[open] button[type=submit]", { text: "Save" }); await sleep(900); await settle(p);
    const after = (await vals(p, sel)).join("|"), l = await look(p);
    return { before, after, hint: l.notSaved, ok: same(before, after) && l.notSaved > 0 };
  }],
  ["Estimated payments: a quarter typed, last year saved", "family", "taxes/estimated", async (s, p) => {
    await type(s, "input[name=q0]", "1000", { clear: true });
    await openFold(s, "Last year"); await type(s, "input[name=tax]", "9000", { clear: true });
    const before = (await vals(p, "#content input[name=q0]")).join("|");
    await thumb(s, "details[open] button[type=submit]", {}); await sleep(900); await settle(p);
    const after = (await vals(p, "#content input[name=q0]")).join("|"), l = await look(p);
    return { before, after, hint: l.notSaved, ok: same(before, after) && l.notSaved > 0 };
  }],
  ["Federal estimate: wages typed in one section, Save in another", "family", "taxes/federal", async (s, p) => {
    await openFold(s, "Figures the plan cannot see"); await type(s, "input[name=wages]", "98000", { clear: true });
    await openFold(s, "Year and people"); await type(s, "input[name=blind]", "1", { clear: true });
    const b = await bring(s, "details[open] button[type=submit]", { text: "Save", nth: 1 }); if (!b) throw new Error("no second Save");
    await p.touchscreen.tap(b.x, b.y); await sleep(900); await settle(p);
    const wages = await p.evaluate(() => document.querySelector("#content input[name=wages]")?.value ?? null), folds = await openFolds(p);
    return { wages, open: folds, ok: (wages === "98,000" || wages === "98000") && folds.some((f) => f.startsWith("Figures the plan cannot see")) };
  }],
  ["Monthly check-in: a note on one month, another month's chip, back", "family", "overview/monthly-review", async (s, p) => {
    const chips = () => p.evaluate(() => [...document.querySelectorAll("#content .chips .chip")].map((c) => c.textContent + (c.classList.contains("on") ? "*" : "")));
    const note = () => p.evaluate(() => { const t = [...document.querySelectorAll("#content textarea")].find((x) => x.getClientRects().length); return t ? t.value : null; });
    let ok = (await note()) !== null;
    for (const c of await chips()) { if (ok) break; const e = await bring(s, ".chips .chip", { text: c.replace("*", "") }); await p.touchscreen.tap(e.x, e.y); await sleep(900); await settle(p); ok = (await note()) !== null; }
    if (!ok) throw new Error("no note box on any month");
    const first = (await chips()).find((c) => c.endsWith("*")).replace("*", "");
    const t = await bring(s, "textarea", {}); await p.touchscreen.tap(t.x, t.y); await sleep(200);
    await p.keyboard.type("Car repair 800", { delay: 80 }); await sleep(500);
    const other = (await chips()).find((c) => !c.endsWith("*"));
    let e = await bring(s, ".chips .chip", { text: other }); await p.touchscreen.tap(e.x, e.y); await sleep(1000); await settle(p);
    const onOther = await note(), lo = await look(p);
    e = await bring(s, ".chips .chip", { text: first }); await p.touchscreen.tap(e.x, e.y); await sleep(1000); await settle(p);
    const back = await note();
    return { month: first, other, onOther, wordsOnOther: lo.notSaved, back, ok: back === "Car repair 800" && onOther !== "Car repair 800" };
  }, { plan: octPlan() }],
  ["Net worth: '+ Add another account' typed, 'Save today's totals'", "family", "balance/net-worth", async (s, p) => {
    if (!(await seen(p, "button, a", { text: "+ Add another account" }))) throw new Error("no '+ Add another account'");
    await tapBtn(s, "+ Add another account");
    await type(s, "form input[name=name]", "Brokerage two"); await type(s, "form input[name=balance]", "12000", { clear: true });
    const sel = "#content form input[name=name], #content form input[name=balance]", before = (await vals(p, sel)).join("|");
    if (!(await seen(p, "button", { text: "Save today" }))) throw new Error("no 'Save today's totals'");
    await tapBtn(s, "Save today", "button");
    let after = (await vals(p, sel)).join("|"), how = "shown";
    if (!after.includes("Brokerage")) { const o = await bring(s, "button", { text: "Open it" }) ?? await bring(s, "button, a", { text: "+ Add another account" }); how = o?.text ?? "nothing"; if (o) { await p.touchscreen.tap(o.x, o.y); await sleep(900); await settle(p); } after = (await vals(p, sel)).join("|"); }
    // kept in its boxes, or (the save shut the form) said by the line with "Open it" (B6)
    return { before, after, how, ok: same(before, after) && (how === "shown" || how === "Open it") };
  }],
]);
