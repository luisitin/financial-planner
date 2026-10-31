// core/router.js -- hash routing. #/<group>/<id>[/<rest...>][?key=value&...]
// Deep links work on the phone and survive a reload; the shell maps them to modules.
// The optional query rides inside the hash (location.search holds ?sandbox=1 and changing it
// reloads the page), e.g. #/balance/liabilities?guide=debt&step=rates for a step-by-step guide.
export const router = {
  parse(hash) {
    const raw = String(hash || "").replace(/^#\/?/, "");
    const q = raw.indexOf("?");
    const path = q < 0 ? raw : raw.slice(0, q);
    const query = {};
    if (q >= 0) {
      for (const part of raw.slice(q + 1).split("&")) {
        if (!part) continue;
        const eq = part.indexOf("=");
        const k = decode(eq < 0 ? part : part.slice(0, eq)), v = eq < 0 ? "" : decode(part.slice(eq + 1));
        if (k) query[k] = v;
      }
    }
    const parts = path.split("/").filter(Boolean);
    return { group: parts[0] || "overview", id: parts[1] || "dashboard", rest: parts.slice(2), query };
  },
  /** "#/group/id[/rest...][?k=v&...]"; empty, null and undefined query values are left out. */
  href(group, id, rest = [], query = {}) {
    const qs = Object.entries(query ?? {}).filter(([, v]) => v !== "" && v !== null && v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
    return `#/${group}/${id}${rest?.length ? "/" + rest.join("/") : ""}${qs ? "?" + qs : ""}`;
  },
  go(group, id, rest = [], query = {}) { location.hash = this.href(group, id, rest, query); },
  start(onChange) {
    const fire = () => onChange(this.parse(location.hash));
    addEventListener("hashchange", fire);
    fire();
  },
};
function decode(s) { try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch { return s; } }
