// core/router.js -- hash routing. #/<group>/<id>[/<rest...>]
// Deep links work on the phone and survive a reload; the shell maps them to modules.
export const router = {
  parse(hash) {
    const parts = String(hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
    return { group: parts[0] || "overview", id: parts[1] || "dashboard", rest: parts.slice(2) };
  },
  go(group, id, rest = []) { location.hash = `#/${group}/${id}${rest.length ? "/" + rest.join("/") : ""}`; },
  start(onChange) {
    const fire = () => onChange(this.parse(location.hash));
    addEventListener("hashchange", fire);
    fire();
  },
};
