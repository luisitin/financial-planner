// modules/retirement/careful.js -- the view side, shared by the pages that show a 9-in-10-markets answer: the spending that
// lasts (Will the money last?, How much to take out, Goal seek: monte-carlo/compute.js carefulSteps) and the age to stop work
// (Financial independence: fire/compute.js carefulAgeSteps). Each is thousands of runs of the projection, half a second or
// more here and longer on a phone. So the page is drawn first and the answer filled in after the first paint: on the PC when
// it is connected (the page stays free), else on this device a slice at a time between frames, so taps and scrolling never
// wait for it (round 5, 2026-11-02: the page froze for about a second).
import { buildInputs } from "./projection/compute.js";
import { carefulSteps } from "./monte-carlo/compute.js";

/** fn() once the page has been painted: after the next frame, not before it. */
export function afterPaint(fn) {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(fn, 0));
  else setTimeout(fn, 0);
}

/**
 * whenWorked(ctx, el, { remote: [key, params], pick, steps }, done): after the first paint, done(answer). With the PC connected
 * it asks the PC for `remote` (a heavy module's compute) and done(pick(result)); else it drives the generator `steps()`
 * (a pure *Steps function) a slice of about 24 ms at a time and done(its return value). done(null) when it cannot be worked
 * out. Nothing runs, and done is never called, once `el` has left the page (the page was redrawn or left).
 */
export function whenWorked(ctx, el, { remote, pick = (x) => x, steps }, done) {
  const alive = () => el.isConnected;
  afterPaint(() => {
    if (!alive()) return;
    if (remote && ctx.store.backend?.() === "server") {
      ctx.computeRemote(remote[0], remote[1]).then((out) => { if (alive()) done(pick(out) ?? null); }, () => { if (alive()) done(null); });
      return;
    }
    let it;
    try { it = steps(); if (!it) { done(null); return; } } catch (e) { console.warn("[planner] careful answer", e); done(null); return; }
    const slice = () => {
      if (!alive()) return;
      const t0 = performance.now();
      let r;
      try { do r = it.next(); while (!r.done && performance.now() - t0 < 24); } catch (e) { console.warn("[planner] careful answer", e); done(null); return; }
      if (r.done) done(r.value ?? null); else setTimeout(slice, 0);
    };
    slice();
  });
}

/**
 * whenCareful(ctx, el, done, { legacy }): Monte Carlo's `careful` object for the plan ({ yearly, rate, planned, average, ... }:
 * the spending that lasts in 9 of 10 markets, leaving `legacy`), or null; worked out as whenWorked says.
 */
export function whenCareful(ctx, el, done, { legacy = 0 } = {}) {
  const today = ctx.fmt.today();
  whenWorked(ctx, el, {
    // the PC runs the same search on the same draw (paths: 100 keeps the rest of its run small; the figure is settled on 2,000)
    remote: ["retirement/monte-carlo", { today, paths: 100, legacy }],
    pick: (mc) => (mc?.ready ? mc.careful ?? null : null),
    steps: () => { const b = buildInputs(ctx.store.get(), { today }); return b.inputs ? carefulSteps(b.inputs, { legacy }) : null; },
  }, done);
}

/** Whole $100s a month that never add up to more than the yearly figure ($110,100 a year is $9,100 a month, not $9,200). */
export const monthlyOf = (yearly) => Math.floor(yearly / 1200) * 100;

/** A soft grey bar as wide as the text that will take its place (`like`, its expected length), for an answer still being worked out. */
export const slot = (ui, like) => ui.h("span", { "aria-hidden": "true", style: { display: "inline-block", width: `${String(like).length * 0.55}em`, height: "0.8em", borderRadius: "4px", background: "var(--line-2)", verticalAlign: "-0.05em" } });
