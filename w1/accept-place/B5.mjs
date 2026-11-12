// B5 -- What I typed and did not save waits for me: I leave by the menu, the phone's Back, "Continue your plan" or Back
// then Forward; when I come back (Back, Forward, the menu again) my typing is in its boxes with "Not saved yet" and
// "Undo my typing" beside the form's button (a shut form opens with one tap on "Open it"). Typed figures come back
// formatted ("1200" as "1,200").
import { H, sleep, settle, state, phoneBack, phoneForward, seen, bring, thumb, type, vals, look, menuTo, tapRow, tapBtn, journeys } from "./_lib.mjs";
const same = (a, b) => a.replace(/,/g, "") === b.replace(/,/g, "");
async function reopen(s, opener) {
  const open = await seen(s.page, "button, a", { text: "Open it" });
  if (open) { const e = await bring(s, "button, a", { text: "Open it" }); await s.page.touchscreen.tap(e.x, e.y); await sleep(900); await settle(s.page); return "Open it"; }
  await tapRow(s, opener); return opener;
}
const undoNear = (p) => p.evaluate(() => [...document.querySelectorAll("#content form")].some((f) => /not saved yet/i.test(f.textContent) && [...f.querySelectorAll("button")].some((b) => /undo my typing/i.test(b.textContent))));
const NA = "#content input[name=name], #content input[name=amount]";
await journeys("B5 typing waits for me", [
  ["Income add form, menu, Back", "family", "cashflow/income", async (s, p) => {
    await tapBtn(s, "+ Add another income");
    await type(s, "input[name=name]", "Weekend tutoring"); await type(s, "input[name=amount]", "1200", { clear: true });
    const before = (await vals(p, NA)).join("|");
    await menuTo(s, "Dashboard"); await phoneBack(s);
    let after = (await vals(p, NA)).join("|"), how = "shown";
    if (!after.includes("tutoring")) { how = await reopen(s, "+ Add another income"); after = (await vals(p, NA)).join("|"); }
    return { before, after, how, cue: await undoNear(p), ok: same(before, after) && await undoNear(p) };
  }],
  ["Income add form, menu, the menu again", "family", "cashflow/income", async (s, p) => {
    await tapBtn(s, "+ Add another income");
    await type(s, "input[name=name]", "Weekend tutoring"); await type(s, "input[name=amount]", "1200", { clear: true });
    const before = (await vals(p, NA)).join("|");
    await menuTo(s, "Dashboard"); await menuTo(s, "Income");
    let after = (await vals(p, NA)).join("|"), how = "shown";
    if (!after.includes("tutoring")) { how = await reopen(s, "+ Add another income"); after = (await vals(p, NA)).join("|"); }
    return { before, after, how, ok: same(before, after) && await undoNear(p) };
  }],
  ["Update my balances, 'Continue your plan', Back", "family", "balance/update", async (s, p) => {
    await type(s, "input[name=a-chk]", "3900", { clear: true }); await type(s, "input[name=a-sav]", "9999", { clear: true });
    const sel = "#content input[name=a-chk], #content input[name=a-sav]", before = (await vals(p, sel)).join("|");
    const row = await bring(s, "nav.gb-cont a", {}); if (!row) throw new Error("no continue row");
    await p.touchscreen.tap(row.x, row.y); await sleep(1100); await settle(p);
    const mid = (await state(p)).hash;
    await phoneBack(s);
    const after = (await vals(p, sel)).join("|");
    return { before, mid, after, ok: same(before, after) && mid !== "#/balance/update" && await undoNear(p) };
  }],
  ["renter's Store card form, Back out of the app, Forward", "renterDebt", "balance/liabilities", async (s, p) => {
    await tapRow(s, "Store card");
    await type(s, "input[name=rate]", "19.9", { clear: true }); await type(s, "input[name=minPayment]", "95", { clear: true });
    const sel = "#content input[name=rate], #content input[name=minPayment]", before = (await vals(p, sel)).join("|");
    await phoneBack(s); const mid = (await state(p)).hash;
    await phoneForward(s);
    let after = (await vals(p, sel)).join("|"), how = "shown";
    if (!after) { how = await reopen(s, "Store card"); after = (await vals(p, sel)).join("|"); }
    return { before, mid, after, how, ok: same(before, after) && await undoNear(p) };
  }],
  ["renter's Store card form (reached from All pages), Back, Forward", "renterDebt", "overview/dashboard", async (s, p) => {
    await menuTo(s, "All pages"); await thumb(s, "a[href='#/balance/liabilities']"); await sleep(1200); await settle(p);
    await tapRow(s, "Store card");
    await type(s, "input[name=rate]", "19.9", { clear: true }); await type(s, "input[name=minPayment]", "95", { clear: true });
    const sel = "#content input[name=rate], #content input[name=minPayment]", before = (await vals(p, sel)).join("|");
    await phoneBack(s); const mid = (await state(p)).hash;
    await phoneForward(s);
    let after = (await vals(p, sel)).join("|"), how = "shown";
    if (!after) { how = await reopen(s, "Store card"); after = (await vals(p, sel)).join("|"); }
    return { before, mid, after, how, ok: /overview\/pages/.test(mid) && same(before, after) && await undoNear(p) };
  }],
]);
