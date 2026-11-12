// B17. A page opened to fix one thing names the way back, at the top and where I finish. From Needs attention: "‹ Back to
// Needs attention" at the top and the same link at the bottom, which goes Back (nothing added to the history). From a link
// that passes ?back= (Pay off debts' "Add <loan>'s rate and payment ›"): "‹ Back to Pay off debts". From the check-in:
// "‹ Back to the ... check-in" carried one page further (Net worth > "Update all balances at once"). Picked in the menu:
// only the bar's "‹".
// usage: node B17.mjs <base> <root>
import { run, say, done, sleep, settle, tapEl, tapBar, shell, H } from "./_lib.mjs";
const named = (s, words) => s.ways.filter((t) => t === `‹ ${words}`).length;
const foot = (p) => p.locator("#content .gb-foot-back a");
await run("Needs attention", "family", "overview/alerts", async (p) => {
  const rows = p.locator("#content .page-list > li[role=button], #content .page-list a"); const n = Math.min(await rows.count(), 3);
  for (let i = 0; i < n; i++) {
    const a0 = await shell(p); await tapEl(p, rows.nth(i), 1200); const a = await shell(p);
    const top = named(a, "Back to Needs attention"); const f = await foot(p).count();
    // the bottom link sits just above the one way on, at the end of the page
    const order = await p.evaluate(() => { const f = document.querySelector("#content .gb-foot-back"); if (!f) return null; const after = [...document.querySelectorAll("#content > *")].slice(-3).map((e) => e.className || e.tagName); return { below: Math.round(document.documentElement.scrollHeight - (f.getBoundingClientRect().bottom + scrollY)), after }; });
    let b = null;
    if (f) { await tapEl(p, foot(p).first(), 1200); b = await shell(p); } else { await p.evaluate(() => history.back()); await sleep(900); await settle(p); }
    say(`Needs attention row ${i + 1}`, a.hash !== a0.hash && top >= 2 && a.back === "Back to Needs attention" && b?.hash === "#/overview/alerts" && b.len === a.len,
      `-> ${a.hash}: "‹ Back to Needs attention" ${top} time(s) (top and bottom); bar ‹ "${a.back}"; bottom link ${order ? `${order.below} px from the end` : "MISSING"} -> ${b?.hash}, history ${a.len} -> ${b?.len}`);
  }
});
const noCarRate = () => { const pl = H.family(); pl.debts = pl.debts.filter((d) => d.accountId !== "a-car"); return pl; };
await run("?back= from Pay off debts", noCarRate, "debt/payoff", async (p) => {
  const link = p.locator("#content a").filter({ hasText: /rate and payment/ }).first();
  const label = (await link.textContent()).trim(); const href = await link.getAttribute("href");
  await tapEl(p, link, 1200); const a = await shell(p); const top = named(a, "Back to Pay off debts");
  let b = null; if (await foot(p).count()) { await tapEl(p, foot(p).first(), 1200); b = await shell(p); }
  say("?back= from Pay off debts", /back=debt\/payoff/.test(a.hash) && top >= 2 && b?.hash === "#/debt/payoff" && b.len === a.len,
    `"${label}" (${href}) -> "‹ Back to Pay off debts" ${top} time(s); bar ‹ "${a.back}"; the bottom link -> ${b?.hash}, history ${a.len} -> ${b?.len}`);
});
await run("picked in the menu", "family", "overview/alerts", async (p) => {
  await tapBar(p, "#nav-toggle", 500);
  const sb = await p.locator("#sidebar .nav-search").boundingBox(); await p.touchscreen.tap(sb.x + 60, sb.y + sb.height / 2); await sleep(150);
  await p.keyboard.type("emergency", { delay: 70 }); await sleep(300); await p.keyboard.press("Enter"); await sleep(1300); await settle(p);
  const a = await shell(p);
  say("picked in the menu", a.hash !== "#/overview/alerts" && a.ways.every((t) => !/Back to Needs attention/.test(t)) && a.back === "Back to Needs attention",
    `from Needs attention, the menu's "emergency" + Go -> ${a.hash}: named rows ${JSON.stringify(a.ways)}; bar ‹ "${a.back}"`);
});
await run("the check-in, one page further", "family", "overview/monthly-review", async (p) => {
  await tapEl(p, p.locator("#content a").filter({ hasText: /Update the balances/ }).first(), 1200);
  const a = await shell(p); const ci = a.ways.find((t) => /^‹ Back to the .*check-in/.test(t));
  const up = p.locator("#content a").filter({ hasText: /Update all balances/ }).first();
  if (!(await up.count())) { say("the check-in, one page further", false, `on ${a.hash}: no "Update all balances at once" link`); return; }
  await tapEl(p, up, 1200); const b = await shell(p); const ci2 = b.ways.find((t) => /^‹ Back to the .*check-in/.test(t));
  await tapEl(p, p.locator("#content a").filter({ hasText: /^‹ Back to the .*check-in/ }).first(), 1200); const c = await shell(p);
  say("the check-in, one page further", !!ci && !!ci2 && /monthly-review/.test(c.hash), `check-in step -> ${a.hash.split("?")[0]} "${ci}"; "Update all balances at once" -> ${b.hash.split("?")[0]} "${ci2}"; tapped -> ${c.hash}`);
});
done("B17 a page opened to fix one thing names the way back");
