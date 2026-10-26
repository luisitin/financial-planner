// modules/system/docs/compute.js -- PURE. The list of documents the Docs page can show,
// and a small Markdown -> HTML converter (headings, lists, tables, code, links, emphasis)
// so the project's own docs are readable on a phone without any library.
export const DOCS = [
  { id: "readme", title: "README", path: "README.md" },
  { id: "agents", title: "AGENTS (how to edit this project)", path: "AGENTS.md" },
  { id: "plan", title: "PLAN (the blueprint)", path: "docs/PLAN.md" },
  { id: "conventions", title: "CONVENTIONS (module contract)", path: "docs/CONVENTIONS.md" },
  { id: "data-model", title: "DATA MODEL", path: "docs/DATA_MODEL.md" },
  { id: "catalog", title: "MODULE CATALOG (every page)", path: "docs/MODULE_CATALOG.md" },
  { id: "resources", title: "RESOURCES (open-source starting points)", path: "docs/RESOURCES.md" },
  { id: "vendor", title: "VENDOR map (what is inside each clone)", path: "vendor/README.md" },
  { id: "roadmap", title: "ROADMAP (phases)", path: "ROADMAP.md" },
  { id: "network", title: "NETWORK (phone at home and away)", path: "docs/NETWORK.md" },
  { id: "design-log", title: "DESIGN LOG (what you decided)", path: "docs/DESIGN_LOG.md" },
  { id: "feedback", title: "FEEDBACK (what the tester found)", path: "docs/FEEDBACK.md" },
  { id: "team", title: "TEAM (three sessions, one folder)", path: "docs/TEAM.md" },
  { id: "changelog", title: "CHANGELOG", path: "CHANGELOG.md" },
];

export function compute(plan, params = {}) {
  return { docs: DOCS, current: DOCS.find((d) => d.id === params.doc) ?? DOCS[0] };
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => `<a href="${u}" ${/^https?:/.test(u) ? 'target="_blank" rel="noopener"' : ""}>${t}</a>`);
}
/** Minimal Markdown to HTML. Good enough for this project's docs; not a general parser. */
export function markdownToHtml(md) {
  const lines = String(md).replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0, list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) { closeList(); const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^\|/.test(line) && /^\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      closeList();
      const cells = (l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line); i += 2; const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const li = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (li) { const kind = /\d/.test(li[1]) ? "ol" : "ul"; if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; } out.push(`<li>${inline(li[2])}</li>`); i++; continue; }
    if (/^\s*$/.test(line)) { closeList(); i++; continue; }
    closeList();
    const para = [line]; i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#|```|\||\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  closeList();
  return out.join("\n");
}
