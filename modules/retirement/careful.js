// modules/retirement/careful.js -- the view side, shared by the pages that show the spending that lasts in 9 of 10 markets
// (Will the money last?, How much to take out, Goal seek). The figure is Monte Carlo's (monte-carlo/compute.js carefulSteps):
// about 4,000 runs of the projection, half a second here and more on a phone. So the page is drawn first and the figure
// filled in after the first paint: on the PC when it is connected (the page stays free), else on this device a slice at a
// time between frames, so taps and scrolling never wait for it (round 5, 2026-11-02: the page froze for about a second).
import { buildInputs } from "./projection/compute.js";
import { carefulSteps } from "./monte-carlo/compute.js";

/** fn() once the page has been painted: after the next frame, not before it. */
export function afterPaint(fn) {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(fn, 0));
  else setTimeout(fn, 0);
}

/**
 * whenCareful(ctx, el, done, { legacy }): works out the careful figure for the plan and calls done(careful) with Monte Carlo's
 * `careful` object ({ yearly, rate, planned, average, ... }), or done(null) when it cannot be worked out. Nothing runs, and
 * done is never called, once `el` has left the page (the page was redrawn or left).
 */
export function whenCareful(ctx, el, done, { legacy = 0 } = {}) {
  const alive = () => el.isConnected;
  afterPaint(() => {
    if (!alive()) return;
    const today = ctx.fmt.today();
    if (ctx.store.backend?.() === "server") {
      // the PC runs the same search on the same draw (paths: 100 keeps the rest of its run small; the figure is settled on 2,000)
      ctx.computeRemote("retirement/monte-carlo", { today, paths: 100, legacy }).then((mc) => { if (alive()) done(mc?.ready ? mc.careful ?? null : null); }, () => { if (alive()) done(null); });
      return;
    }
    let it;
    try { const b = buildInputs(ctx.store.get(), { today }); if (!b.inputs) { done(null); return; } it = carefulSteps(b.inputs, { legacy }); } catch (e) { console.warn("[planner] careful figure", e); done(null); return; }
    const slice = () => {
      if (!alive()) return;
      const t0 = performance.now();
      let r;
      try { do r = it.next(); while (!r.done && performance.now() - t0 < 24); } catch (e) { console.warn("[planner] careful figure", e); done(null); return; }
      if (r.done) done(r.value); else setTimeout(slice, 0);
    };
    slice();
  });
}

/** Whole $100s a month that never add up to more than the yearly figure ($110,100 a year is $9,100 a month, not $9,200). */
export const monthlyOf = (yearly) => Math.floor(yearly / 1200) * 100;
