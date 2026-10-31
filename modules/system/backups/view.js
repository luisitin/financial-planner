// modules/system/backups/view.js -- DOM only. The copies of the plan the PC keeps before every save: the list (from
// GET /api/plan/backups), what changed between a copy and now (the copy from GET /api/plan/backups/<name>), and a
// restore that replaces the plan with the copy after a confirm (the PC saves the current plan as a copy first).
// Each visit asks the PC afresh (the shell runs the cleanup this returns before every redraw and every new page).
import { listOf, diffCopy, asPlan, sizeOf, changeWords } from "./compute.js";

let pending = null;     // { kind, text } shown on the next render
let names = null;       // the server's list (null = not asked yet)
let failed = null;      // { text, status } why the list could not be read
let picked = null;      // the backup chosen
let copies = {};        // name -> the backup's plan, { loading: true } or { error, status }
let showAll = false;
let restoring = null;   // { before (the newest copy's name then), tries, at (the restored copy's time, in words) }
const FIRST = 10;       // backups shown before "Show all"
const POLL = 600;       // ms between looks for the copy a restore makes
const TRIES = 8;        // looks before giving up on it

const STYLE = `
.bk-root .bk-detail { background: var(--accent-soft); border-radius: var(--radius); padding: 12px; margin-top: 8px; }
.bk-root .bk-detail .records li { padding: 6px 0; border-bottom: 0; min-height: 0; }
.bk-root .bk-detail .rec-value { font-weight: 400; }
.bk-root .bk-detail .rec-sub { margin: 0 0 6px; }
.bk-root .bk-detail .rec-foot { flex-wrap: wrap; justify-content: flex-start; gap: 8px; }
`;

export function render(page, ctx) {
  draw(page, ctx);
  // a new visit (or the redraw after a change elsewhere) asks the PC again; a damaged copy stays known as damaged
  return () => {
    names = null; failed = null; picked = null; showAll = false;
    for (const k of Object.keys(copies)) if (copies[k]?.loading || (copies[k]?.error && copies[k].status !== 422)) delete copies[k];
  };
}

function draw(page, ctx) {
  const { ui, plan, store, api } = ctx;
  const sandbox = store.sandbox();
  const root = ui.h("div", { class: "bk-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  // the confirmation waits for the list (a restore reloads it), so the redraw after loading does not wipe it
  if (pending && (names !== null || failed)) { const n = ui.notice(pending.kind, pending.text); root.append(n); if (pending.kind === "ok") setTimeout(() => n.remove(), 8000); pending = null; }
  const redraw = () => { if (!root.isConnected) return; page.replaceChildren(); draw(page, { ...ctx, plan: store.get() }); };
  // a copy's time; with seconds when another copy has the same minute (saves come seconds apart)
  const short = (iso) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const at = (iso) => (listOf(names).filter((b) => short(b.when) === short(iso)).length > 1 ? new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" }) : short(iso));

  root.append(ui.h("section", { class: "card" }, ui.h("h1", {}, "Earlier copies of your plan"),
    ui.h("p", { class: "lede" }, "Every time your plan changes, your PC first keeps a copy of how it was. The newest are at the top, and only the most recent ones are kept. If something went wrong, open a copy, see what changed since, and put it back. To keep a copy for good, use Download a copy in Settings."),
    sandbox ? ui.notice("warn", "You are in the sandbox (a pretend plan). The copies listed are your real plan's; putting one back changes only the pretend plan.") : null));

  // the sandbox keeps its pretend plan in this browser, so the store is "local" there; the PC may still answer
  if (store.backend() !== "server" && !sandbox) {
    root.append(ui.card("Not connected to your PC", ui.h("p", { class: "muted" }, "Your PC keeps these copies, but this device is not connected to your PC right now, so your plan is only saved here. Tap Open Settings and look under PC connection."),
      ui.row(ui.h("a", { class: "btn", href: "#/system/settings" }, "Open Settings"))));
    return;
  }
  if (names === null && !failed) {
    root.append(ui.card("Copies", ui.h("p", { class: "muted" }, restoring ? "Your plan is back. Waiting for your PC to keep a copy of the plan you had…" : "Asking your PC for the list…")));
    const look = () => fetch(`${api.base()}/api/plan/backups`, { headers: api.headers(), cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(Object.assign(new Error(`the PC answered ${r.status}`), { status: r.status }))))
      .then((j) => {
        const list = j.backups ?? [];
        // after a restore, look again until the PC has kept the plan from before it (the store saves 400 ms later)
        if (restoring && !sandbox && listOf(list)[0]?.name === restoring.before && ++restoring.tries < TRIES) return new Promise((ok) => setTimeout(ok, POLL)).then(look);
        if (restoring) {
          const made = !sandbox && listOf(list)[0]?.name !== restoring.before;
          pending = { kind: "ok", text: sandbox ? `Your pretend plan is now the copy from ${restoring.at}. Your real plan and its copies are unchanged.`
            : made ? `Your plan is back to the copy from ${restoring.at}. The plan you had a moment ago is now the newest copy in the list.`
            : `Your plan is back to the copy from ${restoring.at}. The plan you had a moment ago will show in this list once your PC has saved it.` };
          restoring = null;
        }
        names = list;
      })
      .catch((e) => { failed = { text: String(e.message ?? e), status: e.status ?? 0 }; restoring = null; });
    setTimeout(() => look().finally(redraw), restoring ? POLL : 0);
    return;
  }
  if (failed) {
    const code = failed.status === 401;
    root.append(ui.card("Copies", ui.notice("error", code ? "Your PC asks for its access code. Open Settings, then PC connection, and type it in." : "Your PC did not send the list of copies. Check that the PC is on and the planner is running on it, then tap Try again."),
      ui.h("details", {}, ui.h("summary", {}, "Show details"), ui.h("p", { class: "muted small" }, failed.text)),
      ui.row(ui.button("Try again", () => { failed = null; names = null; redraw(); }), code ? ui.h("a", { class: "btn secondary", href: "#/system/settings" }, "Open Settings") : null)));
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
    const box = ui.h("div", { class: "bk-detail" });
    const close = ui.button("Close", () => { picked = null; redraw(); }, { class: "secondary small" });
    const copy = copies[b.name];
    if (!copy || copy.loading) {
      box.append(ui.h("p", { class: "rec-sub" }, "Getting this copy from your PC…"), ui.h("div", { class: "rec-foot" }, close));
      if (!copy) {
        copies[b.name] = { loading: true };   // asked once; a redraw while it comes does not ask again
        fetch(`${api.base()}/api/plan/backups/${encodeURIComponent(b.name)}`, { headers: api.headers(), cache: "no-store" })
          .then(async (r) => (r.ok ? (asPlan(await r.json().catch(() => null)) ?? { error: "damaged", status: 422 }) : { error: "status", status: r.status }))
          .catch(() => ({ error: "network", status: 0 }))
          .then((j) => { if (copies[b.name]?.loading) copies[b.name] = j; redraw(); });
      }
      return box;
    }
    if (copy.error) {
      if (copy.status === 422) box.append(ui.notice("error", "This copy is damaged and cannot be opened. Pick another copy from the list."), ui.h("div", { class: "rec-foot" }, close));
      else if (copy.status === 404) box.append(ui.notice("warn", "This copy is no longer on your PC (older copies are removed as new ones are made)."),
        ui.h("div", { class: "rec-foot" }, ui.button("Read the list again", () => { names = null; picked = null; delete copies[b.name]; redraw(); }, { class: "secondary small" }), close));
      else box.append(ui.notice("error", "Your PC did not send this copy. Check that the PC is on and the planner is running on it, then tap Try again."),
        ui.h("div", { class: "rec-foot" }, ui.button("Try again", () => { delete copies[b.name]; redraw(); }, { class: "secondary small" }), close));
      return box;
    }
    const diff = diffCopy(copy, plan);
    const n = (k, one, many) => (k === 0 ? `no ${many}` : `${k} ${k === 1 ? one : many}`);
    const size = (s) => `${n(s.people, "person", "people")}, ${n(s.accounts, "account", "accounts")}, ${n(s.transactions, "transaction", "transactions")}, ${n(s.goals, "goal", "goals")}`;
    box.append(ui.h("p", { class: "rec-sub" }, `${sandbox ? "This copy of your real plan" : "Then"}: ${size(sizeOf(copy))}.`),
      ui.h("p", { class: "rec-sub" }, `${sandbox ? "Your pretend plan now" : "Now"}: ${size(sizeOf(plan))}.`));
    if (!diff.length) box.append(ui.h("p", { class: "rec-sub" }, sandbox ? "Your pretend plan is the same as this copy." : "Nothing is different from your plan now."));
    else box.append(ui.h("p", { class: "rec-sub" }, ui.h("b", {}, sandbox ? "How your pretend plan differs from this copy:" : "Changed since this copy:")), ui.h("ul", { class: "records" }, diff.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.label), ui.h("span", { class: "rec-value" }, changeWords(x)))))));
    box.append(ui.h("div", { class: "rec-foot" },
      diff.length ? ui.button("Put this copy back", () => {
        const ask = sandbox ? `Fill your pretend plan with the copy from ${at(b.when)}? Your real plan does not change. The pretend plan you have now is not kept.`
          : `Put back the copy from ${at(b.when)}? Your plan as it is now is kept as a new copy at the top of the list, so you can undo this.`;
        if (!ui.confirm(ask)) return;
        restoring = { before: list[0]?.name ?? null, tries: 0, at: at(b.when) };
        picked = null; names = null; copies = {};
        store.replace(copy);
      }) : null,
      close));
    return box;
  }
}
