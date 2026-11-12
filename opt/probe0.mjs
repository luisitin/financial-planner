import { serve, households, open, go, state, settle, pages, PHONE } from "$SP/ux/kit.mjs";
const ROOT = "$SP/opt/app";
const srv = await serve(ROOT, 9801);
try {
  const H = await households(ROOT, "2026-11-12");
  console.log(Object.keys(H).map((k) => `${k}:${typeof H[k]}`).join(" "), H.__missing ?? "");
  for (const k of ["family", "renterDebt", "retiredCouple", "freelancer", "samMidSetup", "jordanMidSetup", "patLeeMidSetup", "ruthMidSetup", "sam", "jordan", "demo", "blank"]) {
    try { const p = H[k]?.(); console.log(k, p ? JSON.stringify(p).length : p, p ? `people ${p.household?.people?.length ?? "?"} income ${p.income?.length ?? "?"} accounts ${p.accounts?.length ?? "?"} debts ${p.debts?.length ?? "?"} setup ${JSON.stringify(p.setup ?? p.meta?.setup ?? null).slice(0, 160)}` : ""); } catch (e) { console.log(k, "ERR", e.message); }
  }
  const P = await pages(ROOT); console.log("pages", P.length);
  let t = Date.now();
  const s = await open({ base: srv.base, plan: H.family(), route: "overview/dashboard" });
  console.log("open ms", Date.now() - t);
  const ls = await s.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k).length])));
  console.log("localStorage", ls, await s.page.evaluate(() => Object.keys(sessionStorage)));
  t = Date.now(); await go(s.page, "retirement/fire"); console.log("go ms", Date.now() - t, (await state(s.page)).docH);
  t = Date.now(); await s.page.goto(`${srv.base}/?sandbox=1#/cashflow/budget`, { waitUntil: "load" }); await s.page.waitForSelector("#content [data-page]"); await settle(s.page); console.log("goto(same doc hash) ms", Date.now() - t, (await state(s.page)).hash);
  t = Date.now(); await s.page.reload({ waitUntil: "load" }); await s.page.waitForSelector("#content [data-page]"); await settle(s.page); console.log("reload ms", Date.now() - t, (await state(s.page)).hash);
  t = Date.now(); await s.page.reload({ waitUntil: "load" }); await s.page.waitForSelector("#content [data-page]"); await settle(s.page, 120); console.log("reload ms (quiet 120)", Date.now() - t);
  console.log("errors", s.pageErrors, s.consoleErrors.slice(0, 3));
  await s.close();
} finally { await srv.stop(); }
