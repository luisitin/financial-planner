// core/ui/undo.js -- what one change did to the plan, and how to take it back. Pure (no DOM): tests/ui-undo.test.mjs.
// From the forms2 design (wave 1 prototype, same repo, MIT). Used by ui.undoable (core/ui/dom.js).
//
// store.update() works on a copy, so the plan before a change is still at hand after it. changesOf(before, after) lists
// what moved, field by field; a list whose rows carry an `id` is compared row by row (a removed row remembers where it
// stood). takeBack(draft, changes) puts back only what has not been changed again since: a field whose value is still
// the one the change wrote, a removed row whose id is not back already, an added row still as it was added. Anything
// else is left alone and counted in `kept`, so an Undo never overwrites a later change (another device, another tab).

const SKIP = new Set(["meta"]);                 // updatedAt and rev move on every change: never taken back
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
export function same(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return Number.isNaN(a) && Number.isNaN(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]));
}
const copy = (x) => (x === undefined ? undefined : structuredClone(x));
/** A list whose every row is an object with its own unique id: compared row by row. */
function byId(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const m = new Map();
  for (const r of list) { if (!isObj(r) || (typeof r.id !== "string" && typeof r.id !== "number") || m.has(r.id)) return null; m.set(r.id, r); }
  return m;
}
/** The changes from `before` to `after`: [{ path, was, now }] (a field) | { path, gone, row, at, prev } | { path, added, row }. */
export function changesOf(before, after, path = [], out = []) {
  if (same(before, after)) return out;
  if (isObj(before) && isObj(after)) {
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (!path.length && SKIP.has(k)) continue;
      changesOf(before[k], after[k], [...path, k], out);
    }
    return out;
  }
  const a = byId(before), b = byId(after);
  if (Array.isArray(before) && Array.isArray(after) && (a || !before.length) && (b || !after.length) && (before.length || after.length)) {
    const A = a ?? new Map(), B = b ?? new Map();
    before.forEach((r, i) => { if (!B.has(r.id)) out.push({ path, gone: r.id, row: copy(r), at: i, prev: i > 0 ? before[i - 1].id : null }); });
    for (const r of after) {
      if (!A.has(r.id)) out.push({ path, added: r.id, row: copy(r) });
      else changesOf(A.get(r.id), r, [...path, { id: r.id }], out);
    }
    return out;
  }
  out.push({ path, was: copy(before), now: copy(after) });
  return out;
}
function holder(root, path) {           // the object or list that holds the last step of `path`, or null
  let x = root;
  for (const step of path.slice(0, -1)) {
    if (x === null || typeof x !== "object") return null;
    x = typeof step === "object" ? (Array.isArray(x) ? x.find((r) => r?.id === step.id) : undefined) : x[step];
  }
  return x !== null && typeof x === "object" ? x : null;
}
function at(root, path) {
  if (!path.length) return root;
  const h = holder(root, path), last = path[path.length - 1];
  if (!h) return undefined;
  return typeof last === "object" ? (Array.isArray(h) ? h.find((r) => r?.id === last.id) : undefined) : h[last];
}
/** Put back what `changes` did, in `draft` (a store.update draft). Returns { done, kept }: how many were put back, and how
 * many were left alone because they were changed again since. */
export function takeBack(draft, changes) {
  let done = 0, kept = 0;
  // fields and added rows last-first; removed rows first-first, so each finds the row that stood before it already back
  const order = [...changes.filter((c) => !("gone" in c)).reverse(), ...changes.filter((c) => "gone" in c)];
  for (const c of order) {
    if ("gone" in c) {                  // a removed row comes back where it stood, unless a row with its id is there again
      let list = at(draft, c.path);
      if (list === undefined && c.path.length) { const h = holder(draft, c.path), last = c.path[c.path.length - 1]; if (h && typeof last !== "object") { h[last] = []; list = h[last]; } }
      if (!Array.isArray(list) || list.some((r) => r?.id === c.gone)) { kept++; continue; }
      const after = c.prev === null ? -1 : list.findIndex((r) => r?.id === c.prev);
      const i = after >= 0 ? after + 1 : c.prev === null ? 0 : Math.min(c.at, list.length);
      list.splice(i, 0, copy(c.row)); done++;
    } else if ("added" in c) {          // an added row goes, unless it was changed since it was added
      const list = at(draft, c.path);
      const i = Array.isArray(list) ? list.findIndex((r) => r?.id === c.added) : -1;
      if (i < 0 || !same(list[i], c.row)) { kept++; continue; }
      list.splice(i, 1); done++;
    } else {                            // a field: put the old value back if it still holds the new one
      if (!same(at(draft, c.path), c.now)) { kept++; continue; }
      const h = holder(draft, c.path), last = c.path[c.path.length - 1];
      if (!h || typeof last === "object") { kept++; continue; }
      if (c.was === undefined) delete h[last]; else h[last] = copy(c.was);
      done++;
    }
  }
  return { done, kept };
}
