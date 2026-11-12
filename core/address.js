// core/address.js -- an address that names no page (wave 1, track "taps"; the touch stress test of 2026-11-11, finding
// j-navigator/N2: a mistyped or old address showed the Dashboard under the wrong address, with no word about it). PURE:
// tests/address.test.mjs. core/app.js draws the card ("Page not found", "<Page> is switched off") from what this says.

/**
 * Why an address shows no page, or null when it shows one.
 *   route  { group, id } (core/router.js parse)
 *   opts   { modules: Map("group/id" -> manifest), groups: GROUPS, userView: bool, enabled(m), offered(m), sourceOf(m) }
 *          ready(m): the page is built (not a "soon" page)
 * Returns { kind: "unknown", group } for no such page; `group` is its topic when the address names one (else null).
 * { kind: "off", key, by } for a page switched off, `by` "properties" when the computer's settings switched it off (it
 * cannot be turned on here), else "device". Any other page that is in the app opens by its address, whatever the view
 * offers in its menu and lists (core/view.js: "a page opened by its address always works"; docs/CONVENTIONS.md "View"):
 * a "soon" page as its plain placeholder, a builder's page as itself (Back onto Diagnostics after the view switch:
 * regress-break 6), a page that waits for your computer or its helper saying so itself (waitsForComputer: topways new
 * problem 1). "Not in the app" is never said of a page that is. `userView`, `offered` and `ready` are accepted as before.
 */
export function missing(route, { modules, groups = [], enabled = () => true, sourceOf = () => "default" } = {}) {
  const key = `${route?.group}/${route?.id}`;
  const m = modules?.get?.(key) ?? null;
  const topic = groups.find((g) => g.id === String(route?.group ?? "").toLowerCase()) ?? null;
  if (!m) return { kind: "unknown", group: topic };
  if (!enabled(m)) return { kind: "off", key, by: sourceOf(m) === "properties" ? "properties" : "device" };
  return null;
}

/**
 * A page the household's view offers whenever your computer answers (`requires: "pc"`: Backups, the record of changes,
 * bank statements) or its helper does (`requires: "ai"`: Ask the plan, Explain a page, ...), built and not a builder's
 * page. While they do not answer it is not in the menu, but its address still opens it, and the page says so itself, in
 * the household's words ("Not connected to your computer", "The helper is not answering"): a reload on it (drawn before
 * the helper's state is known), or the computer going to sleep while it is open, must not turn it into "Page not found"
 * (topways new problem 1). The gate before main moves opens two of them on the phone's site (qa/flows/static-stall.mjs
 * "no-pc").
 */
export const waitsForComputer = (m, ready = (x) => x.status !== "planned") => !!m && (m.requires === "pc" || m.requires === "ai") && !m.builderOnly && !!ready(m);

/** The address in the wrong case (#/cashflow/Income) is the page it names: the corrected route, or null when there is nothing to fix. */
export function fixCase(route, has) {
  const key = `${route?.group}/${route?.id}`;
  if (has(key)) return null;
  const group = String(route?.group ?? "").toLowerCase(), id = String(route?.id ?? "").toLowerCase();
  return has(`${group}/${id}`) ? { ...route, group, id } : null;
}
