// core/ui/dom.js -- the tiny UI kit every module uses. No framework, no build step.
// Keep it small; a module that needs something fancier adds it to its own view.js.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export const card = (title, ...body) => h("section", { class: "card" }, title ? h("h2", {}, title) : null, ...body);
export const row = (...children) => h("div", { class: "row" }, ...children);
export const muted = (text) => h("p", { class: "muted" }, text);
export const notice = (kind, text) => h("div", { class: `notice ${kind}` }, text);
export const button = (label, onClick, attrs = {}) => h("button", { type: "button", onClick, ...attrs }, label);
// Long figures step down a size and may wrap only after a comma, never inside a digit group
// (design log 2026-09-15, tester F-004).
export const stat = (label, value, sub) => {
  const text = typeof value === "string" ? value : String(value ?? "");
  const size = text.length > 13 ? " xlong" : text.length > 9 ? " long" : "";
  const shown = typeof value === "string" ? value.replace(/,/g, ",\u200b") : value;
  return h("div", { class: "stat" }, h("div", { class: `stat-value${size}` }, shown), h("div", { class: "stat-label" }, label), sub ? h("div", { class: "stat-sub" }, sub) : null);
};

export function field(label, control, help) {
  return h("label", { class: "field" }, h("span", { class: "field-label" }, label), control, help ? h("small", { class: "help" }, help) : null);
}
export function input(attrs = {}) { return h("input", { type: "text", ...attrs }); }
export function select(options, value, attrs = {}) {
  return h("select", attrs, options.map((o) => {
    const opt = typeof o === "string" ? { value: o, label: o } : o;
    return h("option", { value: opt.value, selected: String(opt.value) === String(value) ? true : null }, opt.label ?? opt.value);
  }));
}

/** columns: [{ key, label, render?(row), align? }]  rows: objects */
export function table(columns, rows, opts = {}) {
  const thead = h("thead", {}, h("tr", {}, columns.map((c) => h("th", { class: c.align ? `align-${c.align}` : null }, c.label))));
  const tbody = h("tbody", {}, rows.map((r) => h("tr", { onClick: opts.onRow ? () => opts.onRow(r) : null, class: opts.onRow ? "clickable" : null },
    columns.map((c) => h("td", { class: c.align ? `align-${c.align}` : null }, c.render ? c.render(r) : (r[c.key] ?? ""))))));
  if (!rows.length) tbody.append(h("tr", {}, h("td", { colspan: columns.length, class: "muted" }, opts.empty ?? "Nothing here yet.")));
  return h("div", { class: "table-wrap" }, h("table", {}, thead, tbody));
}

/**
 * Build a form from an input schema (see docs/CONVENTIONS.md "Input schemas").
 * fields: [{ key, label, type: "text"|"number"|"money"|"percent"|"date"|"select"|"checkbox"|"textarea", options?, help?, required?, step?, min?, max? }]
 * values: initial values.  onSubmit(values) is called with typed values.
 */
export function form(fields, values = {}, onSubmit, opts = {}) {
  const controls = {};
  const f = h("form", { class: "form", onSubmit: (e) => { e.preventDefault(); onSubmit(readForm(fields, controls)); if (opts.resetAfter) f.reset(); } });
  for (const fd of fields) {
    let c;
    const v = values[fd.key];
    switch (fd.type) {
      case "select": c = select(fd.options ?? [], v ?? "", { name: fd.key, required: fd.required ? true : null }); break;
      case "checkbox": c = h("input", { type: "checkbox", name: fd.key, checked: v ? true : null }); break;
      case "textarea": c = h("textarea", { name: fd.key, rows: fd.rows ?? 3 }, v ?? ""); break;
      case "date": c = input({ type: "date", name: fd.key, value: v ?? "", required: fd.required ? true : null }); break;
      case "number": case "money": case "percent":
        // percent fields store a fraction (0.219) and show a percentage (21.9), both ways
        c = input({ type: "number", name: fd.key, value: fd.type === "percent" && v !== null && v !== undefined && v !== "" ? Number((Number(v) * 100).toPrecision(10)) : (v ?? ""), step: fd.step ?? (fd.type === "percent" ? "0.01" : fd.type === "money" ? "0.01" : "any"), min: fd.min, max: fd.max, inputmode: "decimal", required: fd.required ? true : null, placeholder: fd.type === "percent" ? "e.g. 7 for 7%" : null }); break;
      default: c = input({ type: "text", name: fd.key, value: v ?? "", required: fd.required ? true : null, placeholder: fd.placeholder });
    }
    controls[fd.key] = c;
    f.append(field(fd.label, c, fd.help));
  }
  f.append(h("div", { class: "form-actions" }, h("button", { type: "submit" }, opts.submitLabel ?? "Save"), opts.onCancel ? button("Cancel", opts.onCancel, { class: "secondary" }) : null));
  return f;
}
function readForm(fields, controls) {
  const out = {};
  for (const fd of fields) {
    const c = controls[fd.key];
    if (fd.type === "checkbox") out[fd.key] = !!c.checked;
    else if (fd.type === "number" || fd.type === "money") out[fd.key] = c.value === "" ? null : Number(c.value);
    else if (fd.type === "percent") out[fd.key] = c.value === "" ? null : Number(c.value) / 100;   // typed 7 -> stored 0.07
    else out[fd.key] = c.value;
  }
  return out;
}
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
export const confirm = (text) => window.confirm(text);
