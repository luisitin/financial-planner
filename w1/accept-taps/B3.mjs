// B3. A slow page answers at once. A page picked in the menu (or a link) that takes a while to work out: within about a
// tenth of a second the menu is closed and the top bar shows the new page's name; on a page known to be slow "Working it
// out…" shows. A second tap on the same spot while it works is dropped, also on pages whose answer is worked out after
// they first draw (Goal seek, Plan health score, Chance the money lasts).
// usage: node B3.mjs <base> <root>       (CPU at normal speed for the first answer, 4x slower for the impatient taps)
import { run, say, done, sleep, settle, mid, shell, swallowed } from "./_lib.mjs";
const FRAMES = () => {
  window.__fr = []; const t = () => document.getElementById("page-title")?.textContent ?? "";
  const loop = () => {
    const words = [...document.querySelectorAll("#content p, #content .notice")].some((e) => /Working it out|Trying your plan|Working out|Running your plan/.test(e.textContent) && getComputedStyle(e).opacity !== "0" && e.getClientRects().length);
    window.__fr.push({ t: Math.round(performance.now()), title: t(), open: document.getElementById("sidebar").classList.contains("open"), words, busy: document.getElementById("content").getAttribute("aria-busy") === "true" });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__downs = []; document.addEventListener("pointerdown", (e) => window.__downs.push(Math.round(performance.now())), true);
};
// [household, from, page title in the menu, a word typed in Find a page, heavy page?]
const CASES = [
  ["patLee", "cashflow/income", "Plan health score", "health", true],
  ["family", "cashflow/income", "Chance the money lasts", "chance", true],
  ["ruth", "balance/net-worth", "Stress tests", "stress", true],
  ["family", "balance/net-worth", "Dashboard", null, false],
];
for (const slow of [1, 4]) for (const [who, from, title, word, heavy] of CASES) {
  const id = `${title} x${slow}`;
  await run(id, who, from, async (p) => {
    const tb = await p.locator("#nav-toggle").boundingBox(); await p.touchscreen.tap(tb.x + 22, tb.y + 22); await sleep(500);
    if (word) { const sb = await p.locator("#sidebar .nav-search").boundingBox(); await p.touchscreen.tap(sb.x + 60, sb.y + sb.height / 2); await sleep(150); await p.keyboard.type(word, { delay: 70 }); await sleep(500); }
    const row = p.locator("#sidebar a.nav-link:visible").filter({ hasText: title }).first();
    const [x, y] = await mid(row);
    await p.evaluate(FRAMES); await sleep(300);
    await p.touchscreen.tap(x, y);
    await sleep(600);
    await p.touchscreen.tap(x, y);          // impatient: the same spot again while it is worked out
    await sleep(1500 * slow); await settle(p, 400, 20000);
    const r = await p.evaluate((want) => {
      const t0 = window.__downs[0]; const after = window.__fr.filter((f) => f.t >= t0);
      const answer = after.find((f) => f.title === want && !f.open);
      const words = after.find((f) => f.title === want && (f.words || f.busy));
      return { answer: answer ? answer.t - t0 : null, words: words ? words.t - t0 : null, sawWords: after.some((f) => f.title === want && f.words), title: document.getElementById("page-title").textContent, hash: location.hash };
    }, title);
    const limit = slow === 1 ? 250 : 900;   // "about a tenth of a second" on a phone; this machine is shared, so a margin
    const ok = r.answer !== null && r.answer <= limit && r.title === title && (!heavy || r.sawWords);
    say(id, ok, `${who}: name on screen and menu closed ${r.answer ?? "never"} ms after the tap (limit ${limit})${heavy ? `, "Working it out…" ${r.sawWords ? `shown at ${r.words} ms` : "NOT SHOWN"}` : ""}; a second tap 600 ms later on the same spot -> ended on "${r.title}" (swallowed ${JSON.stringify(await swallowed(p))})`);
  }, { slow });
}
// a page whose answer is worked out after it first draws (computeRemote): a late second tap lands on nothing new
for (const gap of [800, 1150]) await run(`goal-seek late tap ${gap} ms x4`, "family", "retirement/projection", async (p) => {
  const link = p.locator('#content a[href^="#/scenarios/goal-seek"]:visible').first();
  if (!(await link.count())) { say(`goal-seek late tap ${gap} ms x4`, false, "no link to Goal seek on Will the money last?"); return; }
  const [x, y] = await mid(link); await sleep(800);
  const before = await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("planner.plan.sandbox") || "null")?.scenarios ?? null));
  await p.touchscreen.tap(x, y); await sleep(gap); await p.touchscreen.tap(x, y);
  await sleep(6000); await settle(p, 400, 20000);
  const a = await shell(p);
  const after = await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("planner.plan.sandbox") || "null")?.scenarios ?? null));
  say(`goal-seek late tap ${gap} ms x4`, a.hash.startsWith("#/scenarios/goal-seek") && before === after, `link to Goal seek, then the same spot again ${gap} ms later while it works: ended on ${a.hash} "${a.title}", plan ${before === after ? "unchanged" : "CHANGED"} (swallowed ${JSON.stringify(await swallowed(p))})`);
}, { slow: 4, timeout: 20000 });
done("B3 a slow page answers at once");
