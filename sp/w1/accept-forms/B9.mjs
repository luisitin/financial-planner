// B9. (pages that adopt it, A1) A row's form opens right under the row; Save and Cancel leave me at the row. The screen
// moves just enough to show the row and the form's first box. A half-typed add form elsewhere on the page keeps its
// typing. Net worth, family, Ally savings. Until balance/net-worth adopts ui.openUnder (A1, after the kit is on main),
// this serves accept-forms/pages/net-worth.view.js (the tip's page plus that adoption) in its place, and says so.
// usage: node B9.mjs <base> <root>
import { run, say, done, sleep, settle, swipeTap, swipeInto, tap, typeIn, look, byText, focusText, rect, inViewNow, planOf } from "./_lib.mjs";

await run("B9-networth", "family", "balance/net-worth", async (s) => {
  console.log(`     page: ${s.swapped.join("; ")}`);
  // a half-typed add form
  const add = byText(s, /^\+ Add another account$/);
  if (await add.count()) { await swipeTap(s, add); await settle(s.page); await sleep(300); }
  const addForm = s.page.locator("#content form").filter({ has: s.page.locator("[name=balance]") }).first();
  await typeIn(s, addForm.locator("[name=name]"), "Credit union");
  const rec = () => s.page.locator("#content .only-narrow li").filter({ hasText: "Ally savings" }).first();
  await swipeTap(s, rec().getByRole("button", { name: "Edit" }), 700); await settle(s.page);
  const form = s.page.locator("#content li.rec-form form, #content .rec-form form").first();
  const under = await s.page.evaluate(() => { const h = document.querySelector("#content .rec-form"); const prev = h?.previousElementSibling; return !!h && !!prev && /Ally savings/.test(prev.textContent); });
  const r = await rect(rec()), firstOn = (await form.count()) ? await inViewNow(form.locator("[name=name]")) : false, rowOn = await inViewNow(rec());
  say("B9-opens-under", under && rowOn && firstOn, `Edit on Ally savings: the form's holder right after the row ${under}; row ${r.top}-${r.bottom} on screen ${rowOn}; first box on screen ${firstOn}`);
  await swipeTap(s, form.getByRole("button", { name: "Cancel", exact: true }), 700); await settle(s.page);
  const focus = await focusText(s), rowOn2 = await inViewNow(rec());
  const kept = await addForm.locator("[name=name]").inputValue().catch(() => null);
  say("B9-cancel", rowOn2 && focus === "BUTTON Edit" && !(await s.page.locator("#content .rec-form").count()), `Cancel: row on screen ${rowOn2}, focus ${focus}`);
  say("B9-add-kept", kept === "Credit union", `the half-typed add form after Edit and Cancel: "${kept}"`);
  await swipeTap(s, rec().getByRole("button", { name: "Edit" }), 700); await settle(s.page);
  const form2 = s.page.locator("#content .rec-form form").first();
  await typeIn(s, form2.locator("[name=balance]"), "9100");
  await swipeTap(s, form2.locator("[type=submit]"), 1200); await settle(s.page); await sleep(400);
  const l = await look(s), saved = (await planOf(s)).accounts.find((a) => a.name === "Ally savings")?.balance;
  const rowOn3 = await inViewNow(rec()), r3 = await rect(rec());
  say("B9-save", saved === 9100 && l.okInView.some((t) => /Ally savings/.test(t)), `Save: balance ${saved}; green line on screen ${JSON.stringify(l.okInView)}`);
  // the redraw after a save keeps the place (the place track's half of B9): the row is still on screen
  say("B9-save-row", rowOn3, `after Save the row is at ${r3.top}-${r3.bottom} px (on screen ${rowOn3}; scroll ${l.y})`);
}, { swap: { "balance/net-worth": { file: "net-worth.view.js", marker: "ui.openUnder" } } });
done("B9 a row's form under the row");
