// B14 -- My typing stays private and apart: kept only in this browser tab (sessionStorage, never the plan or
// localStorage), the pretend plan's memory apart from the real plan's; a box for a key, token, password or PIN is never
// kept, nor anything on a System page.
import { H, Y, sleep, settle, swipe, bring, type, phoneBack, menuTo, tapBtn, journeys } from "./_lib.mjs";
const where = (p, needle) => p.evaluate((needle) => { const hit = []; for (const [n, st] of [["session", sessionStorage], ["local", localStorage]]) for (let i = 0; i < st.length; i++) { const k = st.key(i); if ((st.getItem(k) ?? "").includes(needle)) hit.push(`${n}:${k}`); } return hit; }, needle);
await journeys("B14 typing stays private and apart", [
  ["Settings: a key typed, menu away, Back: never kept", "family", "system/settings", async (s, p) => {
    for (let k = 0; k < 4; k++) {
      const sm = await p.evaluate(() => { const ds = []; for (let d = document.querySelector("#content input[name=apiKey]")?.closest("details"); d; d = d.parentElement?.closest("details")) ds.unshift(d); const d = ds.find((x) => !x.open); if (!d) return null; const r = d.querySelector(":scope > summary").getBoundingClientRect(); return { y: r.top + r.height / 2 + scrollY }; });
      if (!sm) break;
      const y = await Y(p); if (sm.y - y < 120 || sm.y - y > 640) await swipe(s, sm.y - y - 400);
      const y2 = await Y(p); await p.touchscreen.tap(120, sm.y - y2); await sleep(600);
    }
    const e = await bring(s, "input[name=apiKey]", {}); if (!e) throw new Error("no key box on Settings");
    await p.touchscreen.tap(e.x, e.y); await sleep(200); await p.keyboard.type("sk-test-SECRET123", { delay: 60 }); await sleep(800);
    await menuTo(s, "Dashboard"); await phoneBack(s);
    const stored = await where(p, "SECRET123");
    const shown = await p.evaluate(() => [...document.querySelectorAll("#content input")].some((c) => c.value.includes("SECRET123")));
    return { storedIn: stored, shownAgain: shown, ok: !stored.length && !shown };
  }],
  ["Income: typing kept in this tab only, under the pretend plan's own key", "family", "cashflow/income", async (s, p) => {
    await tapBtn(s, "+ Add another income");
    await type(s, "input[name=name]", "Zebra tutoring"); await sleep(900);
    await menuTo(s, "Dashboard");
    const stored = await where(p, "Zebra tutoring");
    const plan = await p.evaluate(() => (localStorage.getItem("planner.plan.sandbox") ?? "").includes("Zebra tutoring"));
    return { storedIn: stored, inThePlan: plan, ok: stored.length > 0 && stored.every((k) => k.startsWith("session:") && /\.sandbox$/.test(k)) && !plan };
  }],
]);
