// B16 -- The shell never breaks a page: no page error and no lost redraw. The Rules page (a box named "contains") and Goals
// (a box named "target") are typed in and saved by a thumb; then every usable page of five groups gets one key in every
// visible box of its first form, its Save, a menu trip away and the phone's Back: 0 page errors.
import { H, sleep, settle, bring, thumb, type, ROOT, start, journeys } from "./_lib.mjs";
import { pages } from "$SP/ux/kit.mjs";
const GROUPS = new Set(["cashflow", "balance", "goals", "transactions", "taxes", "debt", "insurance"]);
const list = (await pages(ROOT)).filter((p) => !p.builderOnly && GROUPS.has(p.group)).map((p) => p.key);
await journeys("B16 the shell never breaks a page", [
  ["Rules: add a rule COFFEE (a box named contains)", "family", "transactions/rules", async (s, p) => {
    const op = await p.evaluate(() => { const b = [...document.querySelectorAll("#content button")].find((x) => /add/i.test(x.textContent) && x.getClientRects().length && !x.form); return b ? b.textContent.trim() : null; });
    if (op && !(await p.evaluate(() => !!document.querySelector("#content form input[name=contains]")))) { const b = await bring(s, "button", { text: op }); await p.touchscreen.tap(b.x, b.y); await sleep(600); }
    await type(s, "input[name=contains]", "COFFEE");
    await p.evaluate(() => { const sel = document.querySelector("#content select[name=category]"); const o = [...sel.options].find((x) => x.value); sel.value = o.value; sel.dispatchEvent(new Event("change", { bubbles: true })); });
    const sub = await bring(s, "form button[type=submit], form button:not([type])", {}); await p.touchscreen.tap(sub.x, sub.y); await sleep(900); await settle(p);
    const shown = await p.evaluate(() => [...document.querySelectorAll("#content li, #content tr, #content .rec")].some((x) => /coffee/i.test(x.textContent) && x.getClientRects().length));
    return { ruleShown: shown, ok: shown };
  }],
  ["Goals: edit a goal (a box named target), Save", "family", "goals/goals", async (s, p) => {
    const row = await p.evaluate(() => { const li = [...document.querySelectorAll("#content li[role=button], #content .records li, #content .page-list li")].filter((li) => li.getClientRects().length && !li.closest(".only-wide"))[0]; return li ? li.textContent.replace(/\s+/g, " ").trim().slice(0, 18) : null; });
    if (!row) throw new Error("no goal row");
    await thumb(s, "li", { text: row }); await sleep(900); await settle(p);
    await type(s, `form input[name="target"]`, "19000", { clear: true });
    const b = await bring(s, "form button", { text: "Save" }); await p.touchscreen.tap(b.x, b.y); await sleep(900); await settle(p);
    const saved = await p.evaluate(() => !!document.querySelector("#content .notice.ok"));
    return { saidSaved: saved, ok: saved };
  }],
  [`${list.length} pages: one key in every box of the first form, Save, away and Back`, "family", "overview/dashboard", async (s, p) => {
    const bad = [];
    for (const key of list) {
      const e0 = s.pageErrors.length;
      await p.evaluate((r) => { location.hash = "#/" + r; }, key); await sleep(150); await settle(p, 250, 6000);
      const n = await p.evaluate(() => { const f = [...document.querySelectorAll("#content form")].find((f) => f.getClientRects().length && !f.closest("details:not([open])")); if (!f) return 0; const bs = [...f.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=submit]):not([type=button]), textarea")].filter((b) => b.getClientRects().length && !b.disabled && !b.readOnly); bs.forEach((b, i) => b.setAttribute("data-b16", String(i))); return bs.length; });
      for (let i = 0; i < n; i++) { if (await p.evaluate((i) => { const b = document.querySelector(`[data-b16="${i}"]`); if (!b) return false; b.focus(); return true; }, i)) await p.keyboard.type("7", { delay: 40 }); }
      if (n) { await p.evaluate(() => { const f = document.querySelector("[data-b16]")?.closest("form"); f?.querySelector("button[type=submit], button:not([type])")?.click(); }); await sleep(300); await settle(p, 250, 4000); }
      await p.evaluate(() => { location.hash = "#/overview/dashboard"; }); await sleep(150); await settle(p, 250, 4000);
      await p.goBack(); await sleep(300); await settle(p, 250, 6000);
      if (s.pageErrors.length > e0) bad.push(`${key}: ${s.pageErrors.at(-1).slice(0, 100)}`);
    }
    return { pages: list.length, withErrors: bad.slice(0, 6), ok: !bad.length };
  }],
]);
