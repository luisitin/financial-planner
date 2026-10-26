// modules/overview/alerts/view.js -- DOM only. The list of what needs attention, worst first,
// each row opening the page where it is fixed.
import { compute, LEVELS } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const d = compute(plan, { today: fmt.today() });

  if (d.allClear) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "All clear"),
      ui.h("p", { class: "lede" }, "Nothing needs your attention right now. This page fills up on its own when a balance gets old, the emergency fund runs thin, spending passes income, a debt turns expensive or a goal slips."),
    ));
    return;
  }

  const n = d.total;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `${n} ${n === 1 ? "thing" : "things"} to look at`),
    ui.h("p", { class: "lede" }, [d.counts.bad ? `${d.counts.bad} to fix` : null, d.counts.warn ? `${d.counts.warn} to check` : null, d.counts.info ? `${d.counts.info} to do` : null].filter(Boolean).join(", ") + ". Worst first; tap one to open the page where it is handled."),
  ));

  const pillClass = { bad: "pill warn", warn: "pill warn", info: "pill" };
  const dot = { bad: "var(--bad)", warn: "var(--warn)", info: "var(--muted)" };
  root.append(ui.card(null,
    ui.h("ul", { class: "page-list" }, d.alerts.map((a) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
      onClick: () => ctx.go(a.go[0], a.go[1]),
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      ui.h("span", { class: "ic", style: { background: "transparent" } }, ui.h("span", { style: { display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", background: dot[a.level] } })),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, a.title, " ", ui.h("span", { class: pillClass[a.level] }, LEVELS[a.level].label)), ui.h("div", { class: "muted small", style: { lineHeight: "1.35" } }, a.detail)),
      ui.h("span", { class: "st muted" }, "Open ›"),
    ))),
  ));
}
