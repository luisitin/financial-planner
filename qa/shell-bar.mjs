// qa/shell-bar.mjs -- every page name fits the top bar (core/ui/base.css #topbar). Each name the menu offers, in the real
// bar, at 390 and 320 px, with the pill's four wordings and with the "‹" shown or not: no name cut, the pill on at most two
// lines, no sideways scroll.
//   node qa/shell-bar.mjs [base URL]
import { run, say, done, sleep, family, PHONE, SMALL_PHONE } from "./shell-lib.mjs";
const PILLS = ["Sandbox", "Saved on this phone", "Saved on your computer", "Phone only"];
for (const vp of [PHONE, SMALL_PHONE]) {
  await run(`${vp.width} px`, family(), "overview/dashboard", async (p) => {
    await sleep(300);
    const r = await p.evaluate((PILLS) => {
      const names = [...new Set([...document.querySelectorAll("#sidebar .nav-link")].map((a) => a.querySelector("span:not(.ic):not(.soon):not(.chev)")?.textContent.trim() ?? "").filter(Boolean))];
      const t = document.getElementById("page-title"), pill = document.getElementById("status"), back = document.getElementById("nav-back");
      const keep = { title: t.textContent, pill: pill.textContent, hidden: back?.hidden };
      const out = [];
      for (const words of PILLS) for (const withBack of [false, true]) {
        pill.textContent = words; if (back) back.hidden = !withBack;
        const range = document.createRange(); range.selectNodeContents(pill);
        const pillLines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
        const cut = names.filter((n) => { t.textContent = n; return t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1; });
        out.push({ words, withBack, cut, of: names.length, pillLines });
      }
      t.textContent = keep.title; pill.textContent = keep.pill; if (back) back.hidden = keep.hidden;
      return { out, wide: document.documentElement.scrollWidth, vw: innerWidth };
    }, PILLS);
    for (const o of r.out) say(`${vp.width} "${o.words}" ‹ ${o.withBack ? "on" : "off"}`, o.cut.length === 0 && o.pillLines <= 2, `${o.cut.length} of ${o.of} names cut${o.cut.length ? ` (${o.cut.slice(0, 3).join(" / ")})` : ""}; pill on ${o.pillLines} line(s)`);
    say(`${vp.width} no sideways scroll`, r.wide <= r.vw, `${r.wide} px wide in ${r.vw}`);
  }, { viewport: vp });
}
done("shell-bar: every page name fits the top bar");
