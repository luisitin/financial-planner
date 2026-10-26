// modules/overview/dashboard/view.js -- DOM only. Welcome, start-here actions, setup
// steps, and what is coming. Money numbers appear once there is money in the plan.
import { PHASES } from "../../../core/phases.js";

export function render(root, ctx) {
  const { ui, fmt, plan, derived: d, computeOf, modules, isReady, store, go } = ctx;
  const cur = plan.meta.currency;
  const all = [...modules.values()];
  const readyN = all.filter(isReady).length;

  // ---- welcome / money
  if (!d.hasMoney) {
    // The hero says what to do first; the build progress bar lives in "What is coming"
    // (design log 2026-09-15).
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Your financial plan"),
      ui.h("p", { class: "lede" }, "Everything about your money in one place, on your own computer. Nothing here goes to the cloud."),
      ui.h("p", { class: "lede", style: { marginTop: "10px", fontWeight: "600" } }, "Start by adding your accounts. It takes about five minutes."),
    ));
  } else {
    const nw = computeOf("balance/net-worth");
    const gl = computeOf("goals/goals", { today: fmt.today() }) ?? {};
    const behind = (gl.goals ?? []).filter((g) => g.status === "behind" || g.status === "past due").length;
    const goalsLine = !gl.count ? "none set yet" : [gl.done ? `${gl.done} reached` : null, behind ? `${behind} behind` : null].filter(Boolean).join(", ") || "all on track";
    // Each tile is a link to its page (design log 2026-09-15, pass 2).
    const tile = (href, ...args) => { const t = ui.stat(...args); t.append(ui.h("span", { class: "stat-chev", "aria-hidden": "true" }, "\u203a")); return ui.h("a", { href, class: "stat-link" }, t); };
    root.append(ui.card(null, ui.row(
      tile("#/balance/net-worth", "Net worth", fmt.money(nw.netWorth, cur), nw.change ? (nw.change.since === fmt.today() ? "saved today" : `${fmt.signed(nw.change.sinceLast, cur)} since ${fmt.date(nw.change.since)}`) : "what you own minus what you owe"),
      tile("#/balance/net-worth", "You own", fmt.money(nw.assets, cur), `${fmt.money(nw.liquid, cur)} of it is cash or easy to sell`),
      tile("#/balance/liabilities", "You owe", fmt.money(nw.liabilities, cur), nw.liabilities ? "loans, cards, mortgage" : "nothing on file"),
      tile("#/goals/goals", "Goals", String(gl.count ?? plan.goals?.length ?? 0), goalsLine),
    )));
  }

  // ---- start here
  // Before the first account: how to start. After it: what to do now (design log 2026-09-15, pass 2).
  const al = d.hasMoney ? computeOf("overview/alerts", { today: fmt.today() }) : null;
  const alN = al?.total ?? 0;
  const actions = !d.hasMoney ? [
    { icon: "💰", t: "Add your accounts", d: "Checking, savings, retirement, loans. This is where the numbers start.", go: ["balance", "net-worth"] },
    { icon: "💬", t: "Ask a question", d: "Chat with the plan. It runs on your PC and only sees a summary.", go: ["ai", "assistant"] },
    { icon: "📱", t: "Set up your phone", d: "Connect this device to the PC and add the app to your home screen.", go: ["system", "settings"] },
  ] : [
    { icon: "🔔", t: "Needs attention", d: alN ? `${alN} thing${alN === 1 ? "" : "s"} to look at, worst first.` : "Nothing needs your attention right now.", go: ["overview", "alerts"] },
    { icon: "📥", t: "Import a bank file", d: "Three months of transactions keeps the numbers real.", go: ["transactions", "import"] },
    { icon: "💬", t: "Ask a question", d: "Chat with the plan. It runs on your PC and only sees a summary.", go: ["ai", "assistant"] },
  ];
  root.append(ui.card(d.hasMoney ? "What to do now" : "Start here", ui.h("div", { class: "grid" }, actions.map((a) => ui.h("a", { href: `#/${a.go.join("/")}`, class: "action" },
    ui.h("span", { class: "ic" }, a.icon), ui.h("span", {}, ui.h("div", { class: "t" }, a.t), ui.h("div", { class: "d" }, a.d)))))));

  // ---- setup steps
  // Every step row is one tappable link with a chevron; the next step also gets the
  // page's only filled button (design log 2026-09-15).
  const next = d.next;
  const nextIdx = next ? d.steps.indexOf(next) : -1;
  const shortLabel = { accounts: "Add your accounts", people: "Add your household", income: "Enter what comes in", expenses: "Enter what goes out", goals: "Set your first goal", assumptions: "Check the assumptions" };
  const stepsList = () => ui.h("ol", { class: "steps" }, d.steps.map((s, i) => {
      const m = modules.get(s.go.join("/"));
      const soon = m && !isReady(m);
      return ui.h("li", { class: s.done ? "done" : (s === next ? "next" : "") },
        ui.h("a", { href: `#/${s.go.join("/")}`, class: "step-link" },
          ui.h("span", { class: "num" }, s.done ? "✓" : String(i + 1)),
          ui.h("span", { class: "lbl" }, s.label, soon ? ui.h("span", { class: "pill warn" }, "coming soon") : null),
          ui.h("span", { class: "chev", "aria-hidden": "true" }, "›")));
    }));
  if (!next) {
    // All done: one folded line (design log 2026-09-15, pass 2).
    root.append(ui.h("details", { class: "card fold fold-card" },
      ui.h("summary", {}, ui.h("h2", {}, `Set up your plan: all ${d.total} steps done \u2713`), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("div", { class: "fold-body" }, stepsList())));
  } else {
    root.append(ui.card(`Set up your plan: ${d.doneCount} of ${d.total} done`, stepsList(),
      ui.h("div", { class: "steps-cta" }, ui.h("a", { href: `#/${next.go.join("/")}`, class: "btn" }, `Do step ${nextIdx + 1}: ${shortLabel[next.key] ?? next.label}`))));
  }

  // ---- what is coming
  const byPhase = new Map(PHASES.map((p) => [p.n, { ready: 0, total: 0 }]));
  for (const m of all) { const b = byPhase.get(Number(m.phase ?? 10)) ?? byPhase.get(10); b.total++; if (isReady(m)) b.ready++; }
  const nowPhase = PHASES.find((p) => { const b = byPhase.get(p.n); return b.total > b.ready; })?.n;
  const bar = ui.h("div", { class: "progress" }, ui.h("span", { style: { width: `${Math.max(2, Math.round(100 * readyN / all.length))}%` } }));
  root.append(ui.card("What is coming",
    ui.h("p", { class: "muted small" }, "The app is being built in phases. Tap a phase to see its pages."),
    bar,
    ui.h("div", { class: "small muted", style: { marginBottom: "10px" } }, `${readyN} of ${all.length} pages are ready to use. The rest are marked "soon" and you can leave notes on them.`),
    ui.h("div", {}, PHASES.map((p) => {
      const b = byPhase.get(p.n);
      const done = b.total > 0 && b.ready === b.total;
      return ui.h("a", { href: `#/overview/pages/phase-${p.n}`, class: `phase${done ? " done" : ""}${p.n === nowPhase ? " now" : ""}`, style: { color: "inherit", textDecoration: "none" } },
        ui.h("span", { class: "num" }, done ? "✓" : String(p.n)),
        ui.h("span", {}, ui.h("div", { class: "t" }, p.title), ui.h("div", { class: "d" }, p.blurb)),
        ui.h("span", { class: "n" }, b.total ? `${b.ready}/${b.total}` : ""));
    })),
    ui.row(ui.h("a", { href: "#/overview/pages", class: "btn secondary" }, "Browse all pages"), d.noteCount ? ui.h("span", { class: "muted small", style: { alignSelf: "center" } }, `You have left notes on ${d.noteCount} page${d.noteCount === 1 ? "" : "s"}.`) : null),
  ));
}
