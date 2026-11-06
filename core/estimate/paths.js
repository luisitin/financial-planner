// core/estimate/paths.js -- PURE. Where a guess lives in the plan, as a short path (docs/CONVENTIONS.md "Guesses").
//
//   path    := segment ("." segment)*
//   segment := name | name "[" id "]"
//
// `name[id]` is the item of the array `name` whose `id` is `id`; a plain `name` walks an object key
// (`retirement.spendingMonthly`, `retirement.socialSecurity.<personId>.monthlyAtFRA`). Ids come from ui.uid() or the
// setup's own ids (`setup-...`); neither holds ".", "[" or "]", and parsePath throws when one does. No name or id may be
// `__proto__`, `constructor` or `prototype`, so no path reaches an object's prototype.
//
//   parsePath(path)            -> [{ name, id? }]; throws Error("bad guess path: ...") on a malformed path
//   getAt(plan, path)          -> the value there, or undefined when anything on the way is missing
//   setAt(draft, path, value)  -> true, or false when a record or key is missing, the last one included: nothing is ever
//                                 created (a caller that fills an optional field creates it, null, with its record)
//   canonical(plan, path)      -> "debts[<accountId>].x" rewritten to "debts[<debt row id>].x"; anything else unchanged
//   pathOf(list, id, field)    -> `${list}[${id}].${field}`
//
// One spelling is stored: a debt row is named by its own id. Reads accept the account's id too (Liabilities shows one
// row per liability account), so `debts[<accountId>].rate` and `debts[<rowId>].rate` read the same field.

const SEGMENT = /^([^.[\]]+)(?:\[([^.[\]]+)\])?$/;
const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

export function parsePath(path) {
  if (typeof path !== "string" || !path) throw new Error(`bad guess path: ${JSON.stringify(path)}`);
  return path.split(".").map((s) => {
    const m = SEGMENT.exec(s);
    if (!m || FORBIDDEN.has(m[1]) || FORBIDDEN.has(m[2])) throw new Error(`bad guess path: ${path}`);
    return m[2] === undefined ? { name: m[1] } : { name: m[1], id: m[2] };
  });
}

/** The item of `list` with this id; for debts, also the row whose accountId is this id. */
function itemOf(list, name, id) {
  if (!Array.isArray(list)) return undefined;
  return list.find((x) => x && x.id === id) ?? (name === "debts" ? list.find((x) => x && x.accountId === id) : undefined);
}

/** Walk the segments; -> the container holding the last field and that field's name, or null when something is missing. */
function walk(obj, segs) {
  let cur = obj;
  for (let i = 0; i < segs.length; i++) {
    const { name, id } = segs[i];
    if (cur === null || typeof cur !== "object") return null;
    const last = i === segs.length - 1;
    if (id !== undefined) {
      if (last) return null;                            // a path names a field, not a whole record
      cur = itemOf(cur[name], name, id);
      if (cur === undefined) return null;
    } else if (last) return { holder: cur, key: name };
    else {
      if (!Object.prototype.hasOwnProperty.call(cur, name)) return null;
      cur = cur[name];
    }
  }
  return null;
}

export function getAt(plan, path) {
  const w = walk(plan, parsePath(path));
  return w && Object.prototype.hasOwnProperty.call(w.holder, w.key) ? w.holder[w.key] : undefined;
}

export function setAt(draft, path, value) {
  const w = walk(draft, parsePath(path));
  if (!w || Array.isArray(w.holder) || !Object.prototype.hasOwnProperty.call(w.holder, w.key)) return false;   // never created
  w.holder[w.key] = value;
  return true;
}

export function canonical(plan, path) {
  const segs = parsePath(path);
  const first = segs[0];
  if (first.name !== "debts" || first.id === undefined) return path;
  const rows = Array.isArray(plan?.debts) ? plan.debts : [];
  if (rows.some((d) => d && d.id === first.id)) return path;
  const row = rows.find((d) => d && d.accountId === first.id);
  if (!row || typeof row.id !== "string") return path;
  return [`debts[${row.id}]`, ...path.split(".").slice(1)].join(".");
}

export const pathOf = (list, id, field) => `${list}[${id}].${field}`;
