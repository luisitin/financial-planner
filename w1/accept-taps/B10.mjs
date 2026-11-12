// B10. The page behind the open menu stays put. Mid-page, I open the menu, swipe on the dim side both ways and past both ends
// of the menu's list, close it: I see the screen I left. Real touch drags.
// usage: node B10.mjs <base> <root>
import { run, say, done, sleep, swipe, still, tapBar } from "./_lib.mjs";
for (const [who, route] of [["family", "balance/net-worth"], ["ruth", "retirement/projection"], ["patLee", "overview/dashboard"]]) {
  await run(`${who} ${route}`, who, route, async (p) => {
    await swipe(p, 200, 650, 350); const y0 = await still(p);
    await tapBar(p, "#nav-toggle", 500);
    const ys = [];
    await swipe(p, 350, 700, 250); ys.push(await still(p));        // the dim side, finger up
    await swipe(p, 350, 250, 700); ys.push(await still(p));        // the dim side, finger down
    for (let i = 0; i < 4; i++) await swipe(p, 130, 750, 200); ys.push(await still(p));   // the menu's list to its end and on
    for (let i = 0; i < 4; i++) await swipe(p, 130, 200, 750); ys.push(await still(p));   // and back to its top and on
    await tapBar(p, "#nav-toggle", 500); const y1 = await still(p);
    say(`${who} ${route}`, y0 > 100 && ys.every((y) => y === y0) && y1 === y0, `page at ${y0}; while the menu was open ${ys.join(", ")}; after closing ${y1}`);
  });
}
done("B10 the page behind the open menu stays put");
