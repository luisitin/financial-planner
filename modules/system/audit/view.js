// modules/system/audit/view.js -- DOM only. The change log: the PC's copies of the plan (GET /api/plan/backups, then
// each copy from GET /api/plan/backups/<name>) and the plan on the PC now (GET /api/plan), each brought up to date
// once and compared in order by compute.js's entryFor(). Read-only: nothing here changes the plan; Backups is where a
// copy is put back. Each visit starts fresh (the shell runs the cleanup this returns before every redraw and page).
import { listOf, entryFor, firstOf, prepare, asPlan } from "./compute.js";

const FIRST = 10;     // saves shown first, and added by "Show earlier changes"
const AT_ONCE = 4;    // copies asked for at the same time
let visit = 0;        // a new visit ignores answers from the last one
let names = null;     // the copies' names, newest first (null = not asked yet)
let now = null;       // the plan on the PC now, brought up to date
let failed = null;    // why the list, the plan or a copy could not be read
let want = FIRST;     // how many saves to show
let copies = {};      // name -> the copy brought up to date, or null when damaged; dropped once both its saves are known
let saves = {};       // name -> the save made at that copy's time (entryFor), kept for the visit

const STYLE = `
.au-root .au-change { margin: 6px 0 0; }
.au-root .au-change b { font-weight: 600; }
.au-root .au-day { margin: 18px 0 4px; font-size: var(--fs-sm); color: var(--muted); font-weight: 600; }
.au-root .au-day:first-child { margin-top: 4px; }
`;

export function render(page, ctx) {
  draw(page, ctx);
  return () => { visit++; names = null; now = null; failed = null; want = FIRST; copies = {}; saves = {}; };
}

function draw(page, ctx) {
  const { ui, fmt, store, api, modules } = ctx;
  const root = ui.h("div", { class: "au-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const mine = visit;
  const redraw = () => { if (!root.isConnected || mine !== visit) return; page.replaceChildren(); draw(page, ctx); };
  const get = (p) => fetch(`${api.base()}${p}`, { headers: api.headers(), cache: "no-store" });

  root.append(ui.h("section", { class: "card" }, ui.h("h1", {}, "What changed in your plan"),
    ui.h("p", { class: "lede" }, "Each time your plan is saved, your PC keeps a copy of how it was just before. Putting the copies in order shows what every save changed, newest first."),
    store.sandbox() ? ui.notice("warn", "You are in the sandbox (a pretend plan). The changes listed are your real plan's, not the pretend one's.") : null));

  // the sandbox keeps its pretend plan in this browser, so the store is "local" there; the PC may still answer
  if (store.backend() !== "server" && !store.sandbox()) {
    root.append(ui.card("Not connected to your PC", ui.h("p", { class: "muted" }, "Your PC keeps the record of changes, and this device is not connected to it right now. Until it is, your changes are saved on this device only and do not show here."),
      ui.row(ui.h("a", { class: "btn", href: "#/system/settings" }, "Connect to your PC"))));
    return;
  }
  if (failed) {
    root.append(ui.card("Changes", ui.notice("error", "Your PC did not send the record of changes. Make sure the PC is on and the planner is running on it, then tap Try again."),
      ui.h("details", {}, ui.h("summary", {}, "Show details"), ui.h("p", { class: "muted small" }, failed)),
      ui.row(ui.button("Try again", () => { failed = null; redraw(); }))));
    return;
  }
  if (names === null || now === null) {
    root.append(ui.card("Changes", ui.h("p", { class: "muted" }, "Asking your PC for its copies…")));
    // the plan is asked for only when there are copies (a fresh PC has neither, and its 404 would be noise)
    get("/api/plan/backups").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`the list: the PC answered ${r.status}`))))
      .then((l) => (listOf(l.backups ?? []).length ? get("/api/plan").then((r) => (r.ok ? r.json() : r.status === 404 ? {} : Promise.reject(new Error(`the plan: the PC answered ${r.status}`)))) : Promise.resolve({}))
        .then((p) => { if (mine !== visit) return; names = l.backups ?? []; now = prepare(p); }))
      .catch((e) => { if (mine === visit) failed = String(e.message ?? e); })
      .finally(redraw);
    return;
  }

  const list = listOf(names);   // newest first
  if (!list.length) {
    root.append(ui.card("Changes", ui.h("p", { class: "muted" }, "Nothing recorded yet. The first change shows here after your plan is saved twice: change something on any page, then come back.")));
    return;
  }
  const slice = list.slice(0, Math.min(want, list.length));
  // the plans needed: a save's own copy and the one after it (the plan now for the newest), until the save is known
  const need = new Set();
  slice.forEach((b, i) => { if (!(b.name in saves)) { need.add(b.name); if (i > 0) need.add(slice[i - 1].name); } });
  const missing = slice.filter((b) => need.has(b.name) && !(b.name in copies));
  if (missing.length) {
    const one = (b) => get(`/api/plan/backups/${encodeURIComponent(b.name)}`).then(async (r) => {
      if (mine !== visit) return;
      if (r.ok) { const p = asPlan(await r.json().catch(() => null)); copies[b.name] = p ? prepare(p) : null; return; }
      if (r.status === 422) { copies[b.name] = null; return; }   // damaged
      if (r.status === 404) { names = null; saves = {}; copies = {}; return; }   // removed as newer copies came: start the list again
      throw new Error(`a copy: the PC answered ${r.status}`);
    });
    (async () => { for (let i = 0; i < missing.length && mine === visit && names !== null; i += AT_ONCE) await Promise.all(missing.slice(i, i + AT_ONCE).map(one)); })()
      .catch((e) => { if (mine === visit) failed = String(e.message ?? e); })
      .finally(redraw);
  } else {
    slice.forEach((b, i) => {
      if (b.name in saves) return;
      saves[b.name] = entryFor({ when: b.when, plan: copies[b.name] }, { plan: i === 0 ? now : copies[slice[i - 1].name] });
    });
    // a copy's plan is dropped once both saves it belongs to are known; the oldest shown is kept for the next ones
    slice.slice(0, -1).forEach((b) => { if (copies[b.name]) delete copies[b.name]; });
  }

  const known = slice.filter((b) => b.name in saves).map((b) => saves[b.name]);
  if (!known.length) {
    root.append(ui.card("Changes", ui.h("p", { class: "muted" }, "Reading the copies your PC keeps…")));
    return;
  }
  const entries = known.filter((e) => e.unreadable || e.count);
  const quiet = known.length - entries.length;

  // the time of a save; with seconds when another save shown has the same minute
  const minute = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const minutes = entries.filter((e) => e.when).map((e) => `${e.when.slice(0, 10)} ${minute(e.when)}`);
  const at = (iso) => (minutes.filter((m) => m === `${iso.slice(0, 10)} ${minute(iso)}`).length > 1 ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }) : minute(iso));
  const dayOf = (iso) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const cur = ctx.plan?.meta?.currency;
  const more = (n) => (n > 0 ? ` and ${n} more` : "");
  const name = (l) => [l.text, Number.isFinite(l.amount) ? fmt.money(l.amount, cur, undefined, 2) : null, l.date ? fmt.date(l.date) : null].filter(Boolean).join(", ")
    + (l.fields?.length ? ` (${l.fields.slice(0, 3).join(", ")}${more(l.fields.length - 3)})` : "");
  const names3 = (labels) => { const f = firstOf(labels); return f.shown.map(name).join("; ") + (f.more ? `; and ${f.more} more` : ""); };
  const pageTitle = (key) => modules?.get?.(key)?.title ?? key;
  const line = (c) => {
    const parts = [];
    if (c.added.length) parts.push(`added ${names3(c.added)}`);
    if (c.removed.length) parts.push(`removed ${names3(c.removed)}`);
    if (c.changed.length) parts.push(`changed ${names3(c.changed)}`);
    const details = c.pages ? c.details.map((k) => `your note on ${pageTitle(k)}`) : c.details;
    if (details.length && !(details.length === 1 && details[0] === "changed")) parts.push(`changed ${details.slice(0, 4).join(", ")}${more(details.length - 4)}`);
    else if (details.length) parts.push("changed");
    return ui.h("p", { class: "rec-sub au-change" }, ui.h("b", {}, `${c.label}: `), parts.join(". "));
  };

  // grouped by day, a heading above each day's saves
  const days = [];
  entries.forEach((e, i) => {
    const d = e.when ? dayOf(e.when) : "";
    if (!days.length || days[days.length - 1].d !== d) days.push({ d, saves: [] });
    const twin = e.unreadable && entries[i - 1]?.unreadable;   // one damaged copy spoils the saves on both sides of it
    days[days.length - 1].saves.push(ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, e.when ? at(e.when) : "A save"),
        ui.h("span", { class: "rec-value" }, e.unreadable ? ui.h("span", { class: "pill warn" }, "can't show") : `${e.count} ${e.count === 1 ? "change" : "changes"}`)),
      e.by ? ui.h("div", { class: "rec-sub" }, `On ${e.by}`) : null,
      e.unreadable ? ui.h("p", { class: "rec-sub au-change" }, twin ? "See the save above." : "A saved copy from about this time is damaged, so this save's changes can't be shown. Your plan itself is fine.") : e.changes.map(line)));
  });
  const items = days.flatMap((x) => [ui.h("h3", { class: "au-day" }, x.d), ui.h("ul", { class: "records" }, x.saves)]);
  const shownSaves = known.length;
  const loadingMore = missing.length > 0;
  root.append(ui.card(shownSaves === 1 ? "Your last save" : `Your last ${shownSaves} saves`,
    entries.length ? ui.h("div", {}, items) : ui.h("p", { class: "muted" }, shownSaves === 1 ? "Your plan was saved, but nothing in it changed." : "Your plan was saved, but nothing in it changed in these saves."),
    quiet && entries.length ? ui.h("p", { class: "muted small" }, `${quiet} ${quiet === 1 ? "save" : "saves"} changed nothing you can see and ${quiet === 1 ? "is" : "are"} left out.`) : null,
    loadingMore ? ui.h("p", { class: "muted" }, "Loading earlier changes…")
      : list.length > slice.length ? ui.row(ui.button("Show earlier changes", () => { want += FIRST; redraw(); }, { class: "secondary" }))
      : ui.h("p", { class: "muted small" }, `That's everything. Your PC keeps only the most recent copies of your plan, so changes from before ${dayOf(list[list.length - 1].when)} no longer show.`)));

  root.append(ui.card("Undo a change", ui.h("p", { class: "muted" }, "Open Backups (Earlier copies of your plan) and put back the copy with the same time as the change. It holds your plan as it was just before it. This also undoes every change saved after it. Your plan as it is now is kept as a copy first, so you can switch back."),
    ui.row(ui.h("a", { class: "btn secondary", href: "#/system/backups" }, "Open Backups"))));
}
