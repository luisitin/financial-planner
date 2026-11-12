// B19 -- Back closes what opened over the page before it leaves the page (the shell's layer: router.layer / ctx.layer).
// A layer opened, then the phone's Back: the layer closes, the address and the scroll stay, the page is not drawn again;
// a layer that closes itself (release()) steps off its entry; the next Back leaves the page; a layer left open and a link
// tapped: the page it was over is one Back away.
import { H, Y, sleep, settle, journeys } from "./_lib.mjs";
await journeys("B19 Back closes what is open over the page", [
  ["router.layer on Income", "family", "overview/dashboard", async (s, p) => {
    await p.evaluate(() => { location.hash = "#/cashflow/income"; }); await sleep(1200); await settle(p);
    await p.evaluate(() => scrollTo(0, 300)); await sleep(300);
    const st = () => p.evaluate(() => ({ hash: location.hash, len: history.length, closed: window.__closed ?? 0, draws: window.__draws ?? 0, y: Math.round(scrollY) }));
    const opened = await p.evaluate(async () => { const { router } = await import("/core/router.js"); if (typeof router.layer !== "function") return false; window.__r = router; new MutationObserver(() => { window.__draws = (window.__draws ?? 0) + 1; }).observe(document.getElementById("content"), { childList: true }); window.__rel = router.layer(() => { window.__closed = (window.__closed ?? 0) + 1; }); return true; });
    if (!opened) return { ok: false, why: "no router.layer" };
    const a = await st();
    await p.goBack(); await sleep(800); const b = await st();
    await p.evaluate(() => { window.__rel2 = window.__r.layer(() => { window.__closed++; }); }); await sleep(200);
    const c0 = await st(); await p.evaluate(() => window.__rel2()); await sleep(800); const c = await st();
    await p.goBack(); await sleep(1200); await settle(p); const d = await st();
    await p.evaluate(() => { location.hash = "#/cashflow/income"; }); await sleep(1200); await settle(p);
    await p.evaluate(() => { window.__r.layer(() => { }); }); await sleep(200);
    await p.evaluate(() => { location.hash = "#/overview/plan"; }); await sleep(1500); await settle(p);
    await p.goBack(); await sleep(1500); await settle(p); const e = await p.evaluate(() => location.hash);
    return { open: a, afterBack: b, afterRelease: c, backAgain: d.hash, forgotRelease: e,
      ok: b.closed === 1 && b.hash === "#/cashflow/income" && b.draws === a.draws && Math.abs(b.y - a.y) <= 2 && c.closed === 1 && c.len === c0.len && c.draws === a.draws && /dashboard/.test(d.hash) && e === "#/cashflow/income" };
  }],
]);
