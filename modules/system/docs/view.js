// modules/system/docs/view.js -- reads the project's own Markdown docs from the server
// (they are static files) and renders them. Route: #/system/docs/<docId>.
// Picker, plain names and the end-of-document controls per docs/DESIGN_LOG.md 2026-09-15.
import { markdownToHtml } from "./compute.js";

// Plain names for the picker, grouped: the owner's documents first, then the builder's.
// Anything compute.js lists that is not named here lands in the builder group unchanged.
const FOR_YOU = [
  ["feedback", "What the tester found"], ["design-log", "What you decided"], ["changelog", "What changed"],
  ["roadmap", "Build phases"], ["network", "Phone at home and away"], ["readme", "About this app"],
];
const FOR_BUILDERS = [
  ["agents", "How to edit this project"], ["plan", "The blueprint"], ["conventions", "Module contract"],
  ["data-model", "Data model"], ["catalog", "Every page (module catalog)"], ["resources", "Open-source starting points"],
  ["vendor", "What is inside each vendored clone"], ["team", "Three sessions, one folder"],
];

export function render(root, ctx) {
  const { ui, api, derived, route, go } = ctx;
  const current = derived.docs.find((d) => d.id === route.rest[0]) ?? derived.current;
  const byId = new Map(derived.docs.map((d) => [d.id, d]));
  const named = new Set([...FOR_YOU, ...FOR_BUILDERS].map(([id]) => id));
  const group = (label, pairs) => {
    const og = ui.h("optgroup", { label });
    for (const [id, name] of pairs) if (byId.has(id)) og.append(ui.h("option", { value: id, selected: id === current.id ? true : null }, name));
    return og;
  };
  const extra = derived.docs.filter((d) => !named.has(d.id)).map((d) => [d.id, d.title]);
  const picker = () => {
    const sel = ui.h("select", { "aria-label": "Which document", onChange: (e) => go("system", "docs", [e.target.value]) },
      group("For you", FOR_YOU), group("For builders", [...FOR_BUILDERS, ...extra]));
    return ui.h("label", { class: "field" }, ui.h("span", { class: "field-label" }, "Which document"), sel);
  };

  root.append(ui.card(null, picker()));
  const body = ui.h("div", { class: "doc" }, ui.muted("Loading..."));
  const foot = ui.h("div", { class: "doc-foot" });
  root.append(ui.card(null, body, foot));
  const base = api.base();
  if (!base) { body.textContent = "Documents are read from the PC. Open the app from the PC's address (or set it in Settings > PC connection) to read them here."; return; }
  fetch(`${base}/${current.path}`, { cache: "no-cache" }).then(async (r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    body.innerHTML = markdownToHtml(await r.text());
    for (const a of body.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      const m = derived.docs.find((d) => href.endsWith(d.path) || href.endsWith(d.path.split("/").pop()));
      if (m) { a.setAttribute("href", `#/system/docs/${m.id}`); }
    }
    // Wide code boxes and tables: a soft fade on the right while there is more to see.
    for (const box of body.querySelectorAll("pre, .table-wrap")) {
      const wrap = ui.h("div", { class: "scroll-hint" });
      box.replaceWith(wrap); wrap.append(box);
      const update = () => wrap.classList.toggle("more", box.scrollWidth - box.clientWidth - box.scrollLeft > 4);
      box.addEventListener("scroll", update, { passive: true }); update();
    }
    foot.append(
      ui.row(ui.h("a", { href: "#top", class: "btn secondary", onClick: (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); } }, "Back to top")),
      picker(),
    );
  }).catch((e) => { body.innerHTML = ""; body.append(ui.notice("error", `Could not load this document (${e.message}). Check the PC connection in Settings and try again.`)); });
}
