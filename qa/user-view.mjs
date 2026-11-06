// qa/user-view.mjs -- drive the app on a phone (Playwright) and check the household's view against the build view.
//   node qa/user-view.mjs [--port 9010] [--shots <dir>] [--demo <planner-demo.html>]
// Needs the app running (npm run serve with server.port in a git-ignored planner.properties) and Playwright
// (/opt/node22/lib/node_modules/playwright). Uses the sandbox with the invented household in qa/fixtures/demo-household.mjs.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { demoHousehold } from "./fixtures/demo-household.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PORT = opt("--port", "9010"), SHOTS = opt("--shots", "shots"), DEMO = opt("--demo", "");
const { chromium } = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
fs.mkdirSync(SHOTS, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
const plan = JSON.stringify(demoHousehold(today));
const bad = [];
const check = (ok, what) => { if (!ok) bad.push(what); console.log(`${ok ? "ok  " : "FAIL"} ${what}`); };

const browser = await chromium.launch();
async function phone(scheme = "light", { seed = true, storage = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
  if (seed) await ctx.addInitScript((p) => { try { if (!localStorage.getItem("planner.plan.sandbox")) localStorage.setItem("planner.plan.sandbox", p); } catch { } }, plan);
  return ctx;
}
const url = (q) => `http://127.0.0.1:${PORT}/?sandbox=1${q}`;
const menuText = (page) => page.evaluate(() => document.getElementById("sidebar").innerText);

for (const scheme of ["light", "dark"]) {
  for (const v of ["user", "build"]) {
    const ctx = await phone(scheme); const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(url(`&view=${v}#/overview/dashboard`)); await page.waitForSelector("#content [data-page]"); await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOTS, `dashboard-${v}-${scheme}.png`), fullPage: true });
    const dash = await page.evaluate(() => document.getElementById("content").innerText);
    await page.click("#nav-toggle"); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, `menu-${v}-${scheme}.png`) });
    const menu = await menuText(page);
    if (scheme === "light") {
      if (v === "user") {
        check(!/\bsoon\b|coming soon|\d+ of \d+ ready|Hide coming|Show coming/i.test(menu), "user view menu: no soon, no N of M ready, no toggle");
        check(!/Diagnostics|\bDocs\b/.test(menu), "user view menu: no builder pages (searching below)");
        check(!/What is coming|ready to use|phases/i.test(dash), "user view dashboard: no What is coming card");
        check(!/Ask a question|Set up your phone|\bPC\b|AI helper/i.test(dash), "user view dashboard: no Ask tile, no phone setup, no PC / AI talk");
        const status = await page.textContent("#status"); check(/Saved on this phone|Sandbox/.test(status), `user view pill says "${status}"`);
        await page.fill(".nav-search", "diagnos"); await page.waitForTimeout(200);
        check(!/Diagnostics/.test(await menuText(page)), "user view search: builder page not found");
        await page.fill(".nav-search", "coming"); await page.waitForTimeout(200);
        check(!/soon/i.test(await menuText(page)), "user view search: no soon pages");
      } else {
        check(/Hide coming soon|Show coming soon/.test(menu) && /\d+ of \d+ pages ready/.test(menu), "build view menu: toggle and counts as before");
        check(/What is coming/.test(dash), "build view dashboard: What is coming card as before");
        await page.fill(".nav-search", "diagnos"); await page.waitForTimeout(200);
        check(/Diagnostics/.test(await menuText(page)), "build view search: finds Diagnostics");
      }
    }
    check(errors.length === 0, `${v}/${scheme}: no page errors ${errors[0] ?? ""}`);
    await ctx.close();
  }
}
{ // a page that is not ready, opened by its address in the household's view: still there, no phases, no link to it
  const ctx = await phone(); const page = await ctx.newPage();
  await page.goto(url("&view=user#/system/devices")); await page.waitForSelector("#content [data-page]"); await page.waitForTimeout(300);
  const t = await page.evaluate(() => document.getElementById("content").innerText);
  check(/Devices/.test(t) && !/phase/i.test(t) && /not ready yet/.test(t), "user view: a coming page opened by address shows a plain placeholder");
  await page.screenshot({ path: path.join(SHOTS, "placeholder-user.png"), fullPage: true });
  await page.goto(url("#/overview/pages")); await page.waitForSelector("#content [data-page]");
  const all = await page.evaluate(() => document.getElementById("content").innerText);
  check(!/\bsoon\b|Ready now|Any phase|Coming soon/.test(all), `user view All pages: no ready/soon filter, no phases ${all.match(/.{20}(\bsoon\b|Ready now|Any phase|Coming soon).{20}/)?.[0] ?? ""}`);
  await page.goto(url("#/system/settings")); await page.waitForSelector("#content [data-page]");
  const set = await page.evaluate(() => document.getElementById("content").innerText);
  check(/Advanced/.test(set) && !/\bdevices?\b.*soon/i.test(set), "user view Settings: technical part folded under Advanced");
  await page.click("summary:has-text('Advanced')"); await page.click("summary:has-text('What is still being built')");
  await page.screenshot({ path: path.join(SHOTS, "settings-advanced-user.png"), fullPage: true });
  check(await page.isVisible("text=Show what is still being built: coming-soon pages, build progress and developer pages"), "Settings: the switch is there, folded");
  await page.check("input[type=checkbox]:near(:text('Show what is still being built'))"); await page.waitForTimeout(600);
  check(/Hide coming soon|Show coming soon/.test(await (async () => { await page.click("#nav-toggle"); return menuText(page); })()), "turning the switch on shows the build view");
  await ctx.close();
}
if (DEMO) {
  const file = pathToFileURL(path.resolve(DEMO)).href;
  { const ctx = await phone("light", { seed: false }); const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(file); await page.waitForSelector("#content [data-page]"); await page.waitForTimeout(800);
    const t = await page.evaluate(() => document.getElementById("content").innerText);
    check(/Hi Ana|Where you stand/.test(t) && /Net worth/.test(t), "demo from file://: opens on the pretend household");
    check(!/demo|\bPC\b|server|sync/i.test(t + await page.textContent("#status")), "demo from file://: says nothing about a demo, a PC or sync");
    await page.screenshot({ path: path.join(SHOTS, "demo-file.png"), fullPage: false });
    check(errors.length === 0, `demo from file://: no page errors ${errors[0] ?? ""}`);
    await ctx.close(); }
  { const ctx = await phone("light", { seed: false }); const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    // the file as a frame's own document (srcdoc), sandboxed like a preview pane: scripts run, storage throws
    await page.goto("about:blank");
    await page.evaluate((h) => { const f = document.createElement("iframe"); f.setAttribute("sandbox", "allow-scripts"); f.style.cssText = "border:0;width:100vw;height:100vh"; f.srcdoc = h; document.body.style.margin = "0"; document.body.append(f); }, fs.readFileSync(path.resolve(DEMO), "utf8"));
    await page.waitForTimeout(2500);
    const fr = page.frames().find((f) => f !== page.mainFrame());
    const t = await fr.evaluate(() => document.getElementById("content")?.innerText ?? "");
    check(/Net worth/.test(t), "demo in a sandboxed frame: shows the pretend household (storage throws, plan kept in memory)");
    check(!/out of space|Boot failed/i.test(t), "demo in a sandboxed frame: no storage-full or boot failure");
    // make a change in the frame: it must stick for the visit
    await fr.evaluate(() => { location.hash = "#/system/settings"; }); await page.waitForTimeout(800);
    await fr.fill("input[name=name]", "Our family plan"); await fr.locator("#content form button[type=submit]").first().click(); await page.waitForTimeout(800);
    await fr.evaluate(() => { location.hash = "#/overview/dashboard"; }); await page.waitForTimeout(600);
    await fr.evaluate(() => { location.hash = "#/system/settings"; }); await page.waitForTimeout(600);
    check((await fr.inputValue("input[name=name]")) === "Our family plan", "demo in a sandboxed frame: a change stays for the visit");
    await page.screenshot({ path: path.join(SHOTS, "demo-iframe.png") });
    check(errors.length === 0, `demo in a sandboxed frame: no page errors ${errors[0] ?? ""}`);
    await ctx.close(); }
}
await browser.close();
console.log(bad.length ? `\n${bad.length} check(s) failed` : "\nall checks passed");
process.exit(bad.length ? 1 : 0);
