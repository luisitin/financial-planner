// modules/overview/health-score/view.js -- DOM only. The score as a ring with its band, where the
// missing points are (biggest first, each with the step that earns them), then all seven parts.
// Runs on the PC when connected (it runs the stress tests).
import { PARTS, BANDS } from "./compute.js";

const STYLE = `
.hs-root .hs-hero { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
.hs-root .hs-ring { flex: none; width: 132px; height: 132px; }
.hs-root .hs-ring text { font: 700 34px system-ui, sans-serif; }
.hs-root .hs-ring .sub { font: 600 12px system-ui, sans-serif; }
.hs-root .hs-lede { flex: 1 1 200px; min-width: 0; }
.hs-root .hs-parts { list-style: none; margin: 0; padding: 0; }
.hs-root .hs-part > a { display: block; padding: 12px 0; border-bottom: 1px solid var(--line); color: inherit; text-decoration: none; min-height: 44px; }
.hs-root .hs-part:last-child > a { border-bottom: 0; }
.hs-root .hs-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.hs-root .hs-t { font-weight: 650; }
.hs-root .hs-pts { font-weight: 700; white-space: nowrap; }
.hs-root .hs-pts small { color: var(--muted); font-weight: 500; }
.hs-root .hs-meter { height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; margin: 6px 0; }
.hs-root .hs-meter span { display: block; height: 100%; border-radius: 999px; }
.hs-root .hs-d { color: var(--text-2); font-size: var(--fs-sm); }
.hs-root .hs-fix { font-size: var(--fs-sm); font-weight: 600; color: var(--accent-ink); margin-top: 4px; }
`;
const TONE = { ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)", unknown: "var(--line-2)" };

export function render(page, ctx) {
  const { ui, fmt } = ctx;
  const root = ui.h("div", { class: "hs-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const host = ui.h("div", {}, ui.notice("info", "Scoring your plan (this runs the stress tests too)..."));
  root.append(host);
  ctx.computeRemote("overview/health-score", { today: fmt.today() }).then((d) => {
    host.replaceChildren();
    if (!d || !d.ready) { host.append(ui.notice("warn", `The score needs ${(d?.missing ?? []).join(", ")}.`)); return; }
    const tone = d.score >= 85 ? "var(--ok)" : d.score >= 50 ? "var(--accent)" : "var(--warn)";
    host.append(ui.h("section", { class: "card accent hero" },
      ui.h("div", { class: "hs-hero" }, ring(d.score, d.band, tone),
        ui.h("div", { class: "hs-lede" },
          ui.h("h1", {}, `${d.band}: ${d.score} out of 100`),
          ui.h("p", { class: "lede" }, d.gains.length ? `The most points are waiting in ${d.gains[0].title.toLowerCase()}${d.gains[1] ? ` and ${d.gains[1].title.toLowerCase()}` : ""}.` : "Every part is at full marks."))),
      ui.h("p", { class: "muted small" }, `Seven parts, each scored by the page that works it out: ${Object.entries(PARTS).map(([k, v]) => `${label(k)} ${v}`).join(", ")}. ${BANDS.slice(0, 3).map((b) => `${b.label} from ${b.min}`).join(", ")}.`)));
    if (d.gains.length) host.append(ui.card("Where the points are",
      ui.h("ol", { class: "steps" }, d.gains.slice(0, 3).map((p, i) => ui.h("li", { class: i === 0 ? "next" : null },
        ui.h("a", { class: "step-link", href: `#/${p.go[0]}/${p.go[1]}` }, ui.h("span", { class: "num" }, `+${Math.round(p.max - p.points)}`), ui.h("span", { class: "lbl" }, ui.h("strong", {}, p.title), ui.h("br"), ui.h("span", { class: "muted small" }, p.fix ?? p.detail)), ui.h("span", { class: "chev" }, "›")))))));
    host.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "All seven parts"),
      ui.h("ul", { class: "hs-parts" }, d.parts.map((p) => ui.h("li", { class: "hs-part" }, ui.h("a", { href: `#/${p.go[0]}/${p.go[1]}` },
        ui.h("div", { class: "hs-head" }, ui.h("span", { class: "hs-t" }, p.title), ui.h("span", { class: "hs-pts" }, fmtPts(p.points), ui.h("small", {}, ` / ${p.max}`))),
        ui.h("div", { class: "hs-meter", role: "img", "aria-label": `${p.title}: ${fmtPts(p.points)} of ${p.max}` }, ui.h("span", { style: { width: `${(p.points / p.max) * 100}%`, background: TONE[p.status] } })),
        ui.h("div", { class: "hs-d" }, p.detail),
        p.fix ? ui.h("div", { class: "hs-fix" }, p.fix) : null))))));
    host.append(ui.h("details", { class: "card fold fold-card" },
      ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "How the score is worked out"), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("div", { class: "fold-body" }, ui.h("ul", {},
        ui.h("li", {}, "Cash cushion: months of must-pay bills in usable cash, against the plan's target (Emergency fund)."),
        ui.h("li", {}, "Saving: retirement saving, goal saving and what is left over, as a share of income after federal and payroll tax; 20% earns full marks (the 20 of the 50/30/20 rule)."),
        ui.h("li", {}, "Debt: two thirds for having no debt at 10% or more (scaled against a quarter of a year's income), one third for payments under 36% of gross income (half marks to 43%, the qualified-mortgage line)."),
        ui.h("li", {}, "Retirement: the steady spending the plan can carry against what it plans: nothing at 60%, full marks at 115% (room for bad luck)."),
        ui.h("li", {}, "Protection: the share of the stress tests' life shocks the money survives (a job loss, never working again, a death, a long life, a care home)."),
        ui.h("li", {}, "Goals: the share of dated goals done or on track. The plan knows enough: seven things filled in and current."),
        ui.h("li", {}, "A part the plan cannot judge yet scores nothing and says what to add: filling it in is the quickest way up."),
      ))));
  });
}

function ring(score, band, tone) {
  const NS = "http://www.w3.org/2000/svg";
  const e = (t, a, txt) => { const x = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) x.setAttribute(k, v); if (txt !== undefined) x.textContent = txt; return x; };
  const r = 54, c = 2 * Math.PI * r;
  const s = e("svg", { viewBox: "0 0 132 132", class: "hs-ring", role: "img", "aria-label": `Score ${score} out of 100, ${band}` });
  s.append(e("circle", { cx: 66, cy: 66, r, fill: "none", stroke: "var(--line)", "stroke-width": 12 }));
  s.append(e("circle", { cx: 66, cy: 66, r, fill: "none", stroke: tone, "stroke-width": 12, "stroke-linecap": "round", "stroke-dasharray": `${(score / 100) * c} ${c}`, transform: "rotate(-90 66 66)" }));
  s.append(e("text", { x: 66, y: 74, "text-anchor": "middle", fill: "var(--text)" }, String(score)));
  s.append(e("text", { x: 66, y: 94, "text-anchor": "middle", fill: "var(--muted)", class: "sub" }, "of 100"));
  return s;
}
const fmtPts = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const label = (k) => ({ cushion: "cash cushion", saving: "saving", debt: "debt", retirement: "retirement", protection: "protection", goals: "goals", knows: "a complete plan" })[k];
