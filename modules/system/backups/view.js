// modules/system/backups/view.js -- DOM only. The copies of the plan the PC keeps before every save: the list (from
// GET /api/plan/backups), what changed between a copy and now (the copy from GET /api/plan/backups/<name>), and a
// restore that replaces the plan with the copy after a confirm (the PC saves the current plan as a copy first).
import { listOf, diffPlans, sizeOf, changeWords } from "./compute.js";

let pending = null;     // { kind, text } shown on the next render
let names = null;       // the server's list (null = not asked yet)
let failed = null;      // why the list could not be read
let picked = null;      // the backup chosen
let copies = {};        // name -> the backup's plan (or { error })
let showAll = false;
const FIRST = 10;       // backups shown before "Show all"
const SAVE_WAIT = 1200; // ms to wait after a restore before reading the list again
let restoring = false;

export function render(page, ctx) {
  const { ui, fmt, plan, store, api } = ctx;
  const root = ui.h("div", { class: "bk-root" });
  page.append(root);
  // the confirmation waits for the list (a restore reloads it), so the redraw after loading does not wipe it
  if (pending && (names !== null || failed)) { const n = ui.notice(pending.kind, pending.text); root.append(n); if (pending.kind === "ok") setTimeout(() => n.remove(), 8000); pending = null; }
  const redraw = () => { if (!root.isConnected) return; page.replaceChildren(); render(page, { ...ctx, plan: store.get() }); };
  const at = (iso) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  root.append(ui.h("section", { class: "card" }, ui.h("h1", {}, "Earlier copies of your plan"),
    ui.h("p", { class: "lede" }, "Your PC keeps a copy of your plan each time it is saved, the most recent first. If something went wrong, pick a copy, see what is different from now, and put it back."),
    store.sandbox() ? ui.notice("warn", "You are in the sandbox (a pretend plan). The copies listed are your real plan's; putting one back changes only the pretend plan.") : null));

  if (store.backend() !== "server") {
    root.append(ui.card("Not connected to your PC", ui.h("p", { class: "muted" }, "The copies are kept by the app's server on your PC. This browser is not connected to it right now, so your plan is saved here only. System > Settings shows how to connect."),
      ui.row(ui.h("a", { class: "btn secondary", href: "#/system/settings" }, "Open Settings"))));
    return;
  }
  if (names === null && !failed) {
    root.append(ui.card("Copies", ui.h("p", { class: "muted" }, "Asking your PC for the list…")));
    const wait = restoring ? SAVE_WAIT : 0;   // after a restore, let the store's save (400 ms) reach the PC first
    restoring = false;
    setTimeout(() => fetch(`${api.base()}/api/plan/backups`, { headers: api.headers(), cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`the PC answered ${r.status}`))))
      .then((j) => { names = j.backups ?? []; }).catch((e) => { failed = String(e.message ?? e); }).finally(redraw), wait);
    return;
  }
  if (failed) {
    root.append(ui.card("Copies", ui.notice("error", "Your PC did not send the list of copies. Check that the app's server is running, then try again."),
      ui.h("details", {}, ui.h("summary", {}, "Show details"), ui.h("p", { class: "muted small" }, failed)),
      ui.row(ui.button("Try again", () => { failed = null; names = null; redraw(); }, { class: "secondary" }))));
    return;
  }

  const list = listOf(names);
  if (!list.length) {
    root.append(ui.card("Copies", ui.h("p", { class: "muted" }, "No copies yet. The first one is made the next time your plan is saved after a change.")));
    return;
  }
  const shown = showAll ? list : list.slice(0, FIRST);
  root.append(ui.card(`Copies (${list.length})`,
    ui.h("ul", { class: "records" }, shown.map((b, i) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, at(b.when)), ui.h("span", { class: "rec-value" }, i === 0 ? ui.h("span", { class: "pill" }, "newest") : "")),
      b.name === picked ? detail(b) : ui.h("div", { class: "rec-foot" }, ui.button("See what is different", () => { picked = b.name; redraw(); }, { class: "secondary small" }))))),
    list.length > FIRST && !showAll ? ui.row(ui.button(`Show all ${list.length}`, () => { showAll = true; redraw(); }, { class: "secondary" })) : null));

  function detail(b) {
    const box = ui.h("div", {});
    const copy = copies[b.name];
    if (!copy) {
      box.append(ui.h("p", { class: "muted small" }, "Getting this copy from your PC…"));
      fetch(`${api.base()}/api/plan/backups/${encodeURIComponent(b.name)}`, { headers: api.headers(), cache: "no-store" })
        .then(async (r) => (r.ok ? r.json() : { error: r.status === 422 ? "This copy is damaged and cannot be read." : "Your PC could not send this copy." }))
        .catch(() => ({ error: "Your PC could not send this copy." }))
        .then((j) => { copies[b.name] = j; redraw(); });
      return box;
    }
    if (copy.error) { box.append(ui.notice("error", copy.error)); return box; }
    const diff = diffPlans(copy, plan);
    const then = sizeOf(copy), now = sizeOf(plan);
    box.append(ui.h("p", { class: "rec-sub" }, `This copy: ${then.people} ${then.people === 1 ? "person" : "people"}, ${then.accounts} accounts, ${then.transactions} transactions, ${then.goals} goals. Now: ${now.people} ${now.people === 1 ? "person" : "people"}, ${now.accounts} accounts, ${now.transactions} transactions, ${now.goals} goals.`));
    if (!diff.length) box.append(ui.h("p", { class: "rec-sub" }, "Nothing is different from your plan now."));
    else box.append(ui.h("p", { class: "rec-sub" }, "Since this copy:"), ui.h("ul", { class: "records" }, diff.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.label), ui.h("span", { class: "rec-value" }, changeWords(x)))))));
    box.append(ui.h("div", { class: "rec-foot" },
      diff.length ? ui.button("Put this copy back", () => {
        if (!ui.confirm(`Replace your plan with the copy from ${at(b.when)}? Your plan as it is now is saved as a new copy first, so you can come back to it.`)) return;
        pending = { kind: "ok", text: `Your plan is back to the copy from ${at(b.when)}. The plan you had a moment ago is the newest copy in the list.` };
        picked = null; names = null; copies = {}; restoring = true;
        store.replace(copy);
      }) : null,
      ui.button("Close", () => { picked = null; redraw(); }, { class: "secondary small" })));
    return box;
  }
}
