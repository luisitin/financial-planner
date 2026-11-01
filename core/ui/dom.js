// core/ui/dom.js -- the tiny UI kit every module uses. No framework, no build step.
// Keep it small; a module that needs something fancier adds it to its own view.js.
import { readAmount, amountText } from "../format.js";
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
// (design log 2026-09-15, tester F-004). { link: true }: a tile in a two-across row with a chevron (the Dashboard's),
// which has less room, so a figure steps down from 8 characters ("$572,700"), one size earlier.
export const stat = (label, value, sub, { link = false } = {}) => {
  const text = typeof value === "string" ? value : String(value ?? "");
  const size = text.length > (link ? 12 : 13) ? " xlong" : text.length > (link ? 7 : 9) ? " long" : "";
  const shown = typeof value === "string" ? value.replace(/,/g, ",\u200b") : value;
  return h("div", { class: "stat" }, h("div", { class: `stat-value${size}` }, shown), h("div", { class: "stat-label" }, label), sub ? h("div", { class: "stat-sub" }, sub) : null);
};

export function field(label, control, help) {
  return h("label", { class: "field" }, h("span", { class: "field-label" }, label), control, help ? h("small", { class: "help" }, help) : null);
}
export function input(attrs = {}) { return h("input", { type: "text", ...attrs }); }

// The plan's currency sign in front of every money box; the shell sets it from plan.meta.currency.
let moneySign = "$";
export const setMoneySign = (sign) => { moneySign = sign || "$"; };
/**
 * A money box: the sign sits in front, the phone shows its number pad, and "4,500", "$4,500", "4500.50" and "72k" are
 * all understood (a number box refuses a comma or a pasted "$", and on an iPhone silently saves nothing). Leaving the
 * box puts the commas back ("380,000"), so an extra zero shows. Something that is not an amount, or is outside
 * min/max, holds the form with a plain message. Returns { box, input }: put `box` on the page, read `input`.
 */
export function moneyBox({ name, value, required, min, max, placeholder, label } = {}) {
  const c = h("input", { type: "text", name, value: typeof value === "number" || (value !== "" && value !== null && value !== undefined && readAmount(value) !== null) ? amountText(readAmount(value)) : (value ?? ""), inputmode: "decimal", autocomplete: "off", required: required ? true : null, placeholder, "aria-label": label });
  const check = () => {
    const n = readAmount(c.value);
    let why = "";
    if (c.value.trim() && n === null) why = "Type an amount in numbers, like 4,500.";
    else if (n !== null && min !== undefined && min !== null && min !== "" && n < Number(min)) why = `Use ${amountText(Number(min))} or more.`;
    else if (n !== null && max !== undefined && max !== null && max !== "" && n > Number(max)) why = `Use ${amountText(Number(max))} or less.`;
    c.setCustomValidity(why);
    return why ? null : n;
  };
  c.addEventListener("input", check);
  c.addEventListener("blur", () => { const n = check(); if (n !== null) c.value = amountText(n); });
  check();
  const box = h("span", { class: "money-in" }, h("span", { class: "money-sign", "aria-hidden": "true" }, moneySign), c);
  c.style.paddingLeft = `${16 + moneySign.length * 9}px`;
  return { box, input: c };
}
/** The number in a money box, rounded to cents; blank or not an amount is null. */
export const moneyValue = (el) => { const n = readAmount(el?.value); return n === null ? null : Math.round(n * 100) / 100; };
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
      case "money": { const m = moneyBox({ name: fd.key, value: v, required: fd.required, min: fd.min, max: fd.max, placeholder: fd.placeholder }); c = m.input; controls[fd.key] = c; f.append(field(fd.label, m.box, fd.help)); continue; }
      case "number": case "percent":
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
    else if (fd.type === "money") out[fd.key] = moneyValue(c);
    else if (fd.type === "number") out[fd.key] = c.value === "" ? null : Number(c.value);
    else if (fd.type === "percent") out[fd.key] = c.value === "" ? null : Number(c.value) / 100;   // typed 7 -> stored 0.07
    else out[fd.key] = c.value;
  }
  return out;
}
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
export const confirm = (text) => window.confirm(text);
