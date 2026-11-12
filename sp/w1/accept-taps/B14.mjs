// B14. The page's name is whole. Every page name the household is offered, in the real top bar, at 390 and 320 px, with the
// pill's four wordings and with the "‹" shown or not: no name cut (two lines at 390, three smaller lines at 320), the pill
// on at most two lines.
// usage: node B14.mjs <base> <root>
import { run, say, done, sleep, PHONE, SMALL_PHONE } from "./_lib.mjs";
const PILLS = ["Sandbox", "Saved on this phone", "Saved on your computer", "Phone only"];
for (const vp of [PHONE, SMALL_PHONE]) {
  await run(`${vp.width} px`, "family", "overview/dashboard", async (p) => {
    await sleep(300);
    const r = await p.evaluate((PILLS) => {
      // the names exactly as the menu offers them (the bar shows the same title)
      const names = [...new Set([...document.querySelectorAll("#sidebar .nav-link")].map((a) => a.querySelector("span:not(.ic):not(.soon):not(.chev)")?.textContent.trim() ?? "").filter(Boolean))];
      const t = document.getElementById("page-title"), pill = document.getElementById("status"), back = document.getElementById("nav-back");
      const keep = { title: t.textContent, pill: pill.textContent, cls: pill.className, hidden: back?.hidden };
      const out = [];
      for (const words of PILLS) for (const withBack of [false, true]) {
        pill.textContent = words; if (back) back.hidden = !withBack;
        const range = document.createRange(); range.selectNodeContents(pill);
        const pillLines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
        const cut = [], lines = [];
        const lh = parseFloat(getComputedStyle(t).lineHeight);
        for (const n of names) {
          t.textContent = n;
          if (t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1) cut.push(n);
          lines.push(Math.round(t.getBoundingClientRect().height / lh));
        }
        const bar = document.getElementById("topbar").getBoundingClientRect();
        out.push({ words, withBack: withBack && !!back, cut, of: names.length, most: Math.max(...lines), nameW: Math.round(t.getBoundingClientRect().width), pillW: Math.round(pill.getBoundingClientRect().width), pillLines, barH: Math.round(bar.height), barW: Math.round(bar.right), fs: getComputedStyle(t).fontSize });
      }
      t.textContent = keep.title; pill.textContent = keep.pill; pill.className = keep.cls; if (back) back.hidden = keep.hidden;
      return { out, scroll: document.documentElement.scrollWidth, vw: innerWidth };
    }, PILLS);
    const maxLines = vp.width < 375 ? 3 : 2;
    for (const o of r.out) {
      const ok = o.cut.length === 0 && o.pillLines <= 2 && o.most <= maxLines && o.barW <= r.vw;
      say(`${vp.width} "${o.words}" ‹ ${o.withBack ? "on" : "off"}`, ok, `${o.cut.length} of ${o.of} names cut${o.cut.length ? " (" + o.cut.slice(0, 3).join(" / ") + ")" : ""}; longest name on ${o.most} line(s) at ${o.fs}; name box ${o.nameW} px; pill ${o.pillW} px on ${o.pillLines} line(s); bar ${o.barH} px high`);
    }
    say(`${vp.width} no sideways scroll`, r.scroll <= r.vw, `page ${r.scroll} px wide in a ${r.vw} px screen`);
  }, { viewport: vp });
}
done("B14 the page's name is whole");
