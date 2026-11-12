// qa/shell-search.mjs -- the menu's search box keeps what I type and Go opens the best page (core/app.js searchBox,
// core/search.js). Real touches and key-by-key typing on a phone, in the sandbox:
//   "social" typed one key at a time stays "social" in one box with the caret at the end; Go (Enter) opens the first
//   page shown, closes the menu and puts the focus on the page; plain words find the page a person means; a word that
//   finds nothing says so; a new page empties the box.
//   node qa/shell-search.mjs [base URL]
import { run, say, done, sleep, settle, tapBar, family, shell } from "./shell-lib.mjs";
const typeIn = async (p, words) => {
  await tapBar(p, "#nav-toggle", 500);
  const b = await p.locator("#sidebar .nav-search").boundingBox(); await p.touchscreen.tap(b.x + 60, b.y + b.height / 2); await sleep(150);
  await p.keyboard.type(words, { delay: 90 }); await sleep(350);
};
const firstRow = (p) => p.evaluate(() => [...document.querySelectorAll("#sidebar a.nav-link")].find((a) => a.getClientRects().length)?.textContent.replace(/\s+/g, " ").trim() ?? null);
await run("typing is kept", family(), "cashflow/income", async (p) => {
  await typeIn(p, "social");
  const r = await p.evaluate(() => { const boxes = document.querySelectorAll("#sidebar .nav-search"); const b = boxes[0]; return { n: boxes.length, v: b.value, caret: b.selectionStart, focus: document.activeElement === b, hint: b.getAttribute("enterkeyhint") }; });
  say("typing is kept", r.n === 1 && r.v === "social" && r.caret === 6 && r.focus && r.hint === "go", `one box: ${r.n}; it holds "${r.v}", caret ${r.caret}, focused ${r.focus}, keyboard key "${r.hint}"`);
});
await run("Go opens the first page", family(), "cashflow/income", async (p) => {
  await typeIn(p, "social"); const first = await firstRow(p);
  await p.keyboard.press("Enter"); await sleep(1200); await settle(p); const s = await shell(p);
  say("Go opens the first page", !!first && first.includes(s.title) && !s.open && s.focus === "content", `first row "${first}"; Go -> "${s.title}" (${s.hash}), menu ${s.open ? "OPEN" : "closed"}, focus ${s.focus}`);
});
for (const [words, want, never] of [["car", /car|vehicle/i, /medicare/i], ["retire at 62", /will the money last/i, null], ["mortgage", /mortgage/i, null]]) {
  await run(`"${words}"`, family(), "overview/dashboard", async (p) => {
    await typeIn(p, words); const first = await firstRow(p);
    say(`"${words}"`, !!first && want.test(first) && !(never && never.test(first)), `the first page shown: "${first}"`);
  });
}
await run("nothing found", family(), "overview/dashboard", async (p) => {
  await typeIn(p, "zzqx");
  const r = await p.evaluate(() => { const e = document.querySelector("#sidebar .nav-empty"); return { t: e?.textContent.trim() ?? null, role: e?.getAttribute("role") ?? null }; });
  say("nothing found", !!r.t && r.role === "status", `"zzqx" -> "${r.t}" (role ${r.role})`);
});
await run("a new page empties the box", family(), "cashflow/income", async (p) => {
  await typeIn(p, "social"); await p.keyboard.press("Enter"); await sleep(1200); await settle(p);
  await tapBar(p, "#nav-toggle", 500);
  const v = await p.evaluate(() => document.querySelector("#sidebar .nav-search").value);
  say("a new page empties the box", v === "", `the menu opened again on the new page: the box holds "${v}"`);
});
done("shell-search: the menu's search keeps my words and Go opens the page");
