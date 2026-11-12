// B18 -- My finger always wins: on a slow phone (CPU 4x slower), a drag 300 ms after Back moves the page by about the
// finger's travel and the page stays where the finger left it (nothing pulls it back for 3 s); the same for a drag right
// after a save's redraw. The drag goes the way the page can move (up when the page stands far down, down when it stands
// at its top), so the script measures the finger, not the place (B1 measures the place).
import { H, Y, sleep, settle, swipe, menuTo, bring, type, openFold, journeys } from "./_lib.mjs";
const drag = async (s, p) => {
  const ya = await Y(p), dy = ya > 500 ? -400 : 400;
  await swipe(s, dy);
  const yb = await Y(p); await sleep(3000); const yc = await Y(p);
  return { atDrag: ya, finger: dy, afterDrag: yb, movedBy: yb - ya, threeSecLater: yc, held: Math.abs((yb - ya) - dy) <= 80 && Math.abs(yc - yb) <= 5 };
};
await journeys("B18 my finger always wins", [
  ["Will the money last? (ruth), Back, a drag 300 ms later", "ruth", "retirement/projection", async (s, p) => {
    await sleep(1200); await swipe(s, 1700); const y0 = await Y(p);
    await menuTo(s, "Dashboard"); await sleep(800);
    await p.goBack(); await sleep(300);
    const d = await drag(s, p);
    return { leftAt: y0, ...d, ok: d.held };
  }, { slow: 4 }],
  ["All pages, Back, a drag 300 ms later", "family", "overview/pages", async (s, p) => {
    await sleep(1200); await swipe(s, 2400); const y0 = await Y(p);
    await menuTo(s, "Dashboard"); await sleep(800);
    await p.goBack(); await sleep(300);
    const d = await drag(s, p);
    return { leftAt: y0, ...d, ok: d.held };
  }, { slow: 4 }],
  ["Will the money last?: Save settings, a drag 150 ms after the tap", "family", "retirement/projection", async (s, p) => {
    await sleep(1500); await openFold(s, "Retirement settings");
    await type(s, "input[name=spendingMonthly]", "5100", { clear: true });
    const b = await bring(s, "button", { text: "Save settings" }); if (!b) throw new Error("no Save settings button");
    await p.touchscreen.tap(b.x, b.y); await sleep(150);
    const d = await drag(s, p);
    return { ...d, ok: d.held };
  }, { slow: 4 }],
]);
