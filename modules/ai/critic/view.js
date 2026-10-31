// modules/ai/critic/view.js -- DOM only. "What could go wrong with my plan?": the AI reads a fact sheet the app's own
// pages work out (no names, no account names; shown in full before you ask) and lists the gaps and risks it sees, each
// with a button to the page where you can fix it. Its answer is labelled as the AI's view and is never saved.
import { compute, factSheet, allowedPages, buildPrompt, readAnswer, LEVELS } from "./compute.js";

let result = null;   // { at (the plan's updatedAt when asked), points, model } kept while the app is open

const STYLE = `
.cr-root .cr-facts { margin: 8px 0 0; padding-left: 18px; font-size: var(--fs-sm); color: var(--text-2); }
.cr-root .cr-facts li { margin: 4px 0; overflow-wrap: anywhere; }
.cr-root .pill { margin-left: 0; white-space: nowrap; }
.cr-root .rec-title { overflow-wrap: anywhere; }
.cr-root .rec-foot { flex-wrap: wrap; justify-content: flex-start; }
`;
const LEVEL_PILL = { high: "warn", medium: "", low: "" };

export function render(page, ctx) {
  const { ui, fmt, plan, ai, modules } = ctx;
  const d = compute(plan);
  const root = ui.h("div", { class: "cr-root" }, ui.h("style", {}, STYLE));
  page.append(root);

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "What could go wrong with my plan?"),
      ui.h("p", { class: "lede" }, "Once your plan has your household, what you earn, spend and own, the AI helper can read a summary of it and list the gaps and risks it sees, each with the page where you can fix it."),
      ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "Add the people"))));
    return;
  }

  const pages = allowedPages([...(modules?.values?.() ?? [])].map((m) => ({ key: `${m.group}/${m.id}`, title: m.title, purpose: m.purpose, status: m.status })));
  const titleOf = (key) => modules?.get?.(key)?.title ?? key;
  const at = plan.meta?.updatedAt ?? "";
  const status = ui.h("div", {});
  const askBtn = ui.button(result ? "Ask again" : "Ask the AI to look over my plan", () => ask(), { class: result ? "secondary" : null });

  // what the AI will read, built when the fold opens or when asking
  let sheet = null;
  const getSheet = () => (sheet ??= factSheet(plan, { today: fmt.today() }));
  const factsList = ui.h("ul", { class: "cr-facts" });
  const fold = ui.h("details", { class: "fold" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "What the AI will read"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "These lines and the list of the app's pages, nothing else: names become \"Adult 1\" or \"Child 1\" and accounts are called by their kind. The AI runs where Settings says (on your PC unless you chose another)."), factsList));
  fold.addEventListener("toggle", () => { if (fold.open && !factsList.childElementCount) factsList.append(...getSheet().lines.map((l) => ui.h("li", {}, l))); });

  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "What could go wrong with my plan?"),
    ui.h("p", { class: "muted small" }, "The AI helper reads a summary of what the app's own pages work out (your health score, your next steps, your estate papers) and lists the gaps and risks it sees, most important first, each with the page where you can fix it. It changes nothing."),
    ui.row(askBtn), status, ui.h("div", { class: "folds" }, fold)));

  async function ask() {
    status.replaceChildren();
    let st = "off";
    try { st = await ai.status(); } catch { st = "unreachable"; }
    if (!String(st).startsWith("on")) {
      status.append(ui.h("div", { class: "notice warn" }, ui.h("p", {}, st === "off" ? "The AI helper is turned off. Turn it on in Settings, then come back. Meanwhile the Plan health score and Next best action pages check your plan without it." : "The AI helper does not answer. Is it running on your PC? Settings shows how it is set up."),
        ui.row(ui.h("a", { class: "btn secondary small", href: "#/system/settings" }, "Open Settings"), ui.h("a", { class: "btn secondary small", href: "#/overview/health-score" }, "Plan health score"))));
      return;
    }
    askBtn.disabled = true; askBtn.textContent = "Reading your plan…";
    try {
      const s = getSheet();
      const p = buildPrompt(s.lines, pages);
      const r = await ai.chat([{ role: "system", content: p.system }, { role: "user", content: p.user }]);
      const points = readAnswer(r?.content, pages, s.names);
      result = { at, points, model: r?.model ?? "", empty: !points.length };
    } catch (e) {
      askBtn.disabled = false; askBtn.textContent = "Ask the AI to look over my plan";
      status.append(ui.notice("error", `The AI did not answer (${e?.message ?? e}). Check the AI section in Settings, or try again.`));
      return;
    }
    page.replaceChildren(); render(page, ctx);
  }

  if (!result) return;
  if (result.empty) { status.append(ui.notice("info", "The AI's answer could not be read as a list. Ask again; a larger model in Settings may do better.")); return; }
  const list = ui.h("ul", { class: "records" }, result.points.map((x) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.title), ui.h("span", { class: "rec-value" }, ui.h("span", { class: `pill ${LEVEL_PILL[x.level]}` }, LEVELS[x.level]))),
    x.why ? ui.h("div", { class: "rec-sub" }, x.why) : null,
    x.page ? ui.h("div", { class: "rec-foot" }, ui.h("a", { class: "btn secondary small", href: `#/${x.page}` }, `Open ${titleOf(x.page)}`)) : null)));
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "The AI's view of your plan"),
    result.at !== at ? ui.notice("info", "Your plan has changed since the AI looked. Ask again to see what it thinks now.") : null,
    ui.h("p", { class: "muted small" }, `${result.points.length} ${result.points.length === 1 ? "point" : "points"}, most important first${result.model ? `, from ${result.model}` : ""}. This is the AI's reading, not checked by the app: the figures on each page are the ones to trust.`),
    list));
}
