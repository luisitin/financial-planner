// B16. There is always a way back on screen. A "‹" in the top bar whenever the phone's Back would stay in the app: none on
// the first page of a visit, "Back to Dashboard" after the Net worth tile, a double tap goes back one page, none on Get
// started's questions (they draw their own), still in its place but not tappable while the menu is open, still there after
// a reload. A first page whose own "‹" replaces its address never gets a "‹" that leaves the app.
// usage: node B16.mjs <base> <root>
import { run, say, done, sleep, settle, tapEl, tapBar, shell, mid } from "./_lib.mjs";
const tile = (p) => p.locator("#content a.stat-link").filter({ hasText: /Net worth/ }).first();
await run("first page, a tile, a double tap", "family", "overview/dashboard", async (p) => {
  const a0 = await shell(p); await tapEl(p, tile(p)); const a = await shell(p);
  const b = await p.locator("#nav-back").boundingBox();
  await p.touchscreen.tap(b.x + 22, b.y + 22); await sleep(300); await p.touchscreen.tap(b.x + 22, b.y + 22); await sleep(1200); await settle(p);
  const c = await shell(p);
  say("first page: no ‹", a0.back === null, `Dashboard opened first: ‹ ${a0.back === null ? "not there" : `"${a0.back}"`}`);
  say("‹ names where", a.hash === "#/balance/net-worth" && a.back === "Back to Dashboard" && Math.round(b.y) < 56, `Net worth tile -> ${a.hash}, ‹ "${a.back}" at the top (y ${Math.round(b.y)})`);
  say("a double tap = one page", c.hash === "#/overview/dashboard" && c.back === null && c.len === a.len, `two taps 300 ms apart -> ${c.hash}, ‹ ${c.back === null ? "hidden" : `"${c.back}"`}, history ${a.len} -> ${c.len}`);
});
await run("the ‹ stays on screen", "family", "overview/dashboard", async (p) => {
  await tapEl(p, tile(p)); await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await sleep(500);
  const r = await p.evaluate(() => { const b = document.getElementById("nav-back").getBoundingClientRect(); return { y: Math.round(scrollY), top: Math.round(b.top), at: document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest("#nav-back") ? "‹" : "something else" }; });
  say("the ‹ stays on screen", r.y > 300 && r.top >= 0 && r.top < 56 && r.at === "‹", `scrolled to ${r.y}: ‹ at y ${r.top}, under the finger: ${r.at}`);
});
await run("covered while the menu is open", "family", "overview/dashboard", async (p) => {
  await tapEl(p, tile(p));
  const before = await p.evaluate(() => Math.round(document.getElementById("page-title").getBoundingClientRect().left));
  await tapBar(p, "#nav-toggle", 600);
  const r = await p.evaluate(() => { const nb = document.getElementById("nav-back"); const b = nb.getBoundingClientRect(); return { vis: getComputedStyle(nb).visibility, left: Math.round(document.getElementById("page-title").getBoundingClientRect().left), hit: document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest("#nav-back") ? "‹" : "not the ‹" }; });
  const bb = await p.locator("#nav-back").boundingBox(); await p.touchscreen.tap(bb.x + 22, bb.y + 22); await sleep(900);
  const s = await shell(p);
  say("covered while the menu is open", r.vis === "hidden" && r.left === before && r.hit !== "‹" && s.hash === "#/balance/net-worth", `menu open: ‹ ${r.vis}, the name stays at x ${before} -> ${r.left}; a tap there -> ${r.hit}, still on ${s.hash}`);
});
await run("after a reload", "family", "overview/dashboard", async (p) => {
  await tapEl(p, tile(p)); await p.reload(); await sleep(1200); await settle(p); const s = await shell(p);
  say("after a reload", s.hash === "#/balance/net-worth" && s.back === "Back to Dashboard", `reloaded on ${s.hash}: ‹ "${s.back}"`);
});
await run("Get started's questions", "family", "overview/dashboard", async (p) => {
  await p.evaluate(() => { location.hash = "#/overview/setup/ages"; }); await sleep(1200); await settle(p); const s = await shell(p);
  const own = await p.locator("#content button[aria-label='Back']").count();
  say("Get started's questions", s.back === null && own > 0, `a link to a question: bar ‹ ${s.back === null ? "hidden" : `"${s.back}"`}, the page's own ‹ ${own ? "there" : "MISSING"}`);
});
for (const who of ["family", "ruth"]) {
  await run(`${who}: a first page that replaces its address`, who, "overview/setup/ages", async (p) => {
    const own = p.locator("#content button.su-icon[aria-label='Back']");
    if (!(await own.count())) { say(`${who}: a first page that replaces its address`, false, "no own ‹ on the question"); return; }
    const len0 = await p.evaluate(() => history.length);
    const [x, y] = await mid(own.first()); await p.touchscreen.tap(x, y); await sleep(1000); await settle(p);
    const a = await shell(p);
    await p.evaluate(() => { location.hash = "#/balance/net-worth"; }); await sleep(1200); await settle(p);
    const b = await shell(p);
    let c = { hash: "(not tapped)", back: null };
    if (b.back) { await tapBar(p, "#nav-back", 1200); await settle(p); c = await shell(p); }
    say(`${who}: a first page that replaces its address`, a.back === null && b.back && c.hash === a.hash && c.back === null,
      `question's own ‹ -> ${a.hash} (history ${len0} -> ${a.len}), bar ‹ ${a.back === null ? "hidden" : `"${a.back}" (would leave the app)`}; a link to Net worth: ‹ "${b.back}"; tapped -> ${c.hash}, ‹ ${c.back === null ? "hidden" : `"${c.back}"`}`);
  });
}
done("B16 there is always a way back on screen");
