// modules/overview/pages/view.js -- searchable directory of every page, grouped by topic,
// with status and phase. Routes: #/overview/pages, #/overview/pages/phase-<n>,
// #/overview/pages/ready, #/overview/pages/soon.
import { PHASES, phaseOf } from "../../../core/phases.js";
import { matches } from "../../../core/search.js";

export function render(root, ctx) {
  const { ui, modules, GROUPS, isReady, features, route, derived } = ctx;
  const build = ctx.view.build;   // the household's view lists only pages that work: no ready/soon filter, no phases (core/view.js)
  const initial = route.rest[0] ?? "all";
  let filter = !build ? "all" : initial.startsWith("phase-") ? initial : (["ready", "soon"].includes(initial) ? initial : "all");
  // the search is kept in the address (?q=), so Back to this page finds the same word and results (stress test 2026-11-11,
  // p-overview-home/x-2)
  let q = typeof route.query?.q === "string" ? route.query.q : "";

  const search = ui.h("input", { type: "search", value: q, placeholder: "Search pages, e.g. mortgage, Roth, budget", "aria-label": "Search pages" });
  const chipDefs = [["all", "All"], ["ready", "Ready now"], ["soon", "Coming soon"]];
  const chips = ui.h("div", { class: "chips" });
  const phaseSel = ui.h("select", { "aria-label": "Phase", style: { width: "auto", minHeight: "44px", padding: "4px 10px", borderRadius: "999px", fontSize: "13px", fontWeight: "600" }, onChange: () => { filter = phaseSel.value === "" ? "all" : `phase-${phaseSel.value}`; draw(); } },
    ui.h("option", { value: "" }, "Any phase"), PHASES.map((p) => ui.h("option", { value: String(p.n) }, `Phase ${p.n}: ${p.title}`)));
  const head = ui.h("p", { class: "muted" });
  const list = ui.h("div");

  function draw() {
    chips.innerHTML = "";
    if (build) for (const [k, label] of chipDefs) chips.append(ui.h("button", { type: "button", class: `chip${filter === k ? " on" : ""}`, onClick: () => { filter = k; phaseSel.value = ""; draw(); } }, label));
    if (build) chips.append(phaseSel);
    phaseSel.value = filter.startsWith("phase-") ? filter.slice(6) : "";
    phaseSel.classList.toggle("on", filter.startsWith("phase-"));
    list.innerHTML = "";
    const qq = q.trim().toLowerCase();
    let shown = 0;
    // pages whose own name holds the word come first, in one short card above the topics (x-2: "mortgage" listed Life
    // timeline before the page called Mortgage, which sat under the keyboard)
    if (qq) {
      const best = [...modules.values()].filter((m) => features.enabled(m) && ctx.shown(m) && String(m.title ?? "").toLowerCase().includes(qq))
        .filter((m) => (filter === "ready" ? isReady(m) : filter === "soon" ? !isReady(m) : true)).slice(0, 4);
      if (best.length) list.append(ui.card("Best match", ui.h("ul", { class: "page-list" }, best.map((m) => ui.h("li", {}, ui.h("a", { href: `#/${m.group}/${m.id}`, class: "row-link" },
        ui.h("span", { class: "ic ic-sm" }, m.icon ?? GROUPS.find((g) => g.id === m.group)?.icon ?? ""),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, m.title), ui.h("div", { class: "d" }, m.purpose ?? ""))))))));
    }
    for (const g of GROUPS) {
      const pages = [...modules.values()].filter((m) => m.group === g.id && features.enabled(m) && ctx.shown(m)).sort((a, b) => (a.order ?? 100) - (b.order ?? 100)).filter((m) => {
        if (filter === "ready" && !isReady(m)) return false;
        if (filter === "soon" && isReady(m)) return false;
        if (filter.startsWith("phase-") && Number(m.phase ?? 10) !== Number(filter.slice(6))) return false;
        if (qq && !matches(m, g.title, qq)) return false;   // core/search.js: plain words, first person, aliases
        return true;
      });
      if (!pages.length) continue;
      shown += pages.length;
      list.append(ui.card(`${g.icon} ${g.title}`, ui.h("ul", { class: "page-list" }, pages.map((m) => {
        const key = `${m.group}/${m.id}`;
        const ready = isReady(m);
        // A small icon on every row (the page's own, or its topic's) so titles line up (pass 2).
        // The whole row is the link (tester F-006).
        return ui.h("li", {}, ui.h("a", { href: `#/${key}`, class: "row-link" },
          ui.h("span", { class: "ic ic-sm" }, m.icon ?? g.icon),
          ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, m.title, derived.noted.has(key) ? ui.h("span", { class: "pill accent" }, "your notes") : null), ui.h("div", { class: "d" }, m.purpose ?? "")),
          build ? ui.h("span", { class: "st" }, ready ? ui.h("span", { class: "pill ok" }, "ready") : ui.h("span", { class: "pill" }, `soon · phase ${m.phase ?? "?"}`)) : null));
      }))));
    }
    const shownQ = `“${q.trim()}”`;
    if (!shown) list.append(ui.card(null, ui.muted(qq ? `No page matches ${shownQ}. Try another word, like mortgage, Roth or budget.` : "No pages match this filter.")));
    const p = filter.startsWith("phase-") ? phaseOf(filter.slice(6)) : null;
    head.textContent = qq ? (shown ? `${shown} page${shown === 1 ? "" : "s"} match${shown === 1 ? "es" : ""} ${shownQ}.` : "")
      : p ? `Phase ${p.n}: ${p.title}. ${p.blurb}` : (filter === "ready" ? "Pages you can use today." : filter === "soon" ? "Pages that are planned. Open one to leave notes on what it should do." : `${shown} pages across ${GROUPS.length} topics.`);
  }
  search.addEventListener("input", () => {
    q = search.value; draw();
    try { const base = location.hash.split("?")[0]; history.replaceState(history.state, "", q.trim() ? `${base}?q=${encodeURIComponent(q.trim())}` : base); } catch { /* the address is a nicety */ }
  });
  root.append(ui.card(null, search, ui.h("div", { style: { height: "10px" } }), build ? chips : null, head));
  root.append(list);
  draw();
}
