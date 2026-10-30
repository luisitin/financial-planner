// modules/overview/benchmarks/view.js -- DOM only. Each comparison as a ruler: where you are, where the
// benchmark is, a word for which side of it you are on, a sentence and its source.
import { compute } from "./compute.js";

const STYLE = `
.bm-root .bm-items { list-style: none; margin: 0; padding: 0; }
.bm-root .bm-item { padding: 14px 0; border-bottom: 1px solid var(--line); }
.bm-root .bm-item:last-child { border-bottom: 0; }
.bm-root .bm-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; min-height: 44px; color: inherit; text-decoration: none; }
.bm-root .bm-head:hover .bm-t { text-decoration: underline; }
.bm-root .bm-t { font-weight: 650; flex: 1; min-width: 0; color: var(--accent-ink); }
.bm-root .bm-chev { color: var(--muted); font-size: 22px; line-height: 1; }
.bm-root .bm-item svg { display: block; width: 100%; max-width: 640px; height: auto; margin: 8px 0 4px; font: 11px system-ui, sans-serif; }
.bm-root .bm-s { color: var(--text-2); font-size: var(--fs-sm); }
.bm-root .bm-src { color: var(--muted); font-size: var(--fs-xs); margin-top: 4px; }
`;
const PILL = { ahead: ["ok", "ahead"], "on par": ["accent", "on par"], behind: ["warn", "behind"], unknown: ["", "not yet"] };

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "bm-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "How am I doing?"),
      ui.h("p", { class: "lede" }, "Your net worth against families of your age, your retirement savings against the usual guideline for your age, and the rules of thumb most planners use. It starts from your age:"),
      ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "People"))));
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.judged ? `Ahead on ${d.ahead} of ${d.judged}` : "How am I doing?"),
    ui.h("p", { class: "lede" }, `Against families whose head is ${d.group.label} (the Federal Reserve's ${d.scfYear} survey) and the rules of thumb most planners use. Benchmarks are a compass, not a grade: your own plan's numbers matter more.`)));
  const show = (x, v) => (v === null ? "-" : x.unit === "money" ? fmt.money(Math.round(v / 100) * 100, cur) : x.unit === "multiple" ? `${v.toFixed(1)}x pay` : x.unit === "months" ? `${v.toFixed(1)} months` : `${Math.round(v * 100)}%`);
  root.append(ui.h("section", { class: "card" }, ui.h("ul", { class: "bm-items" }, d.items.map((x) => {
    const [tone, word] = PILL[x.verdict];
    return ui.h("li", { class: "bm-item" },
      ui.h("a", { class: "bm-head", href: `#/${x.go[0]}/${x.go[1]}` }, ui.h("span", { class: "bm-t" }, x.title), ui.h("span", { class: `pill ${tone}` }, word), ui.h("span", { class: "bm-chev", "aria-hidden": "true" }, "›")),
      x.you !== null && x.benchmark !== null ? ruler(x, show) : null,
      ui.h("div", { class: "bm-s" }, x.sentence),
      ui.h("div", { class: "bm-src" }, x.source));
  }))));
}

function ruler(x, show) {
  const NS = "http://www.w3.org/2000/svg";
  const e = (t, a, txt) => { const n = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) n.setAttribute(k, v); if (txt !== undefined) n.textContent = txt; return n; };
  const W = 360, pad = 10;
  const max = Math.max(x.you, x.benchmark, 0) * 1.3 || 1, min = Math.min(0, x.you);
  const px = (v) => pad + ((v - min) / (max - min)) * (W - 2 * pad);
  const s = e("svg", { viewBox: `0 0 ${W} 46`, role: "img", "aria-label": `${x.title}: you ${show(x, x.you)}, benchmark ${show(x, x.benchmark)}` });
  s.append(e("rect", { x: pad, y: 18, width: W - 2 * pad, height: 8, rx: 4, fill: "var(--line)" }));
  const good = x.verdict === "ahead" ? "var(--ok)" : x.verdict === "behind" ? "var(--warn)" : "var(--accent)";
  s.append(e("rect", { x: px(Math.min(0, x.you)), y: 18, width: Math.max(2, Math.abs(px(x.you) - px(0))), height: 8, rx: 4, fill: good }));
  s.append(e("line", { x1: px(x.benchmark), x2: px(x.benchmark), y1: 12, y2: 32, stroke: "var(--text)", "stroke-width": 2, "stroke-dasharray": "3 2" }));
  const bx = px(x.benchmark), yx = px(x.you);
  s.append(e("text", { x: Math.min(W - pad, Math.max(pad, bx)), y: 44, "text-anchor": bx > W * 0.7 ? "end" : bx < W * 0.3 ? "start" : "middle", fill: "var(--muted)" }, `${x.better === "lower" ? "under " : x.unit === "months" ? "aim " : x.id === "net-worth" ? "median " : "aim "}${show(x, x.benchmark)}`));
  s.append(e("text", { x: Math.min(W - pad, Math.max(pad, yx)), y: 10, "text-anchor": yx > W * 0.7 ? "end" : yx < W * 0.3 ? "start" : "middle", fill: "var(--text)", "font-weight": "700" }, `you ${show(x, x.you)}`));
  return s;
}
