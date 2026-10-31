// modules/system/audit/view.js -- DOM only. The change log: the PC's copies of the plan (GET /api/plan/backups, then
// each copy from GET /api/plan/backups/<name>) and the plan on the PC now (GET /api/plan), compared in order by
// compute.js's timeline(). Read-only: nothing here changes the plan; Backups is where a copy is put back.
import { listOf, timeline, firstOf } from "./compute.js";

const FIRST = 10;     // saves shown first, and added by "Show earlier changes"
const AT_ONCE = 4;    // copies asked for at the same time
let visit = 0;        // a new visit (the shell's cleanup) starts fresh and ignores answers from the last one
let names = null;     // the copies' names, newest first (null = not asked yet)
let now = null;       // the plan on the PC now
let failed = null;    // why the list or the plan could not be read
let want = FIRST;     // how many saves to show
const copies = {};    // name -> the copy's plan, or null when it could not be read (copies never change, so kept)

const STYLE = `
.au-root .au-change { margin: 6px 0 0; }
.au-root .au-change b { font-weight: 600; }
.au-root .au-day { margin: 18px 0 4px; font-size: var(--fs-sm); color: var(--muted); font-weight: 600; }
.au-root .au-day:first-child { margin-top: 4px; }
`;

export function render(page, ctx) {
  const { ui, fmt, store, api } = ctx;
  const root = ui.h("div", { class: "au-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const mine = visit;
  const redraw = () => { if (!root.isConnected || mine !== visit) return; page.replaceChildren(); render(page, ctx); };
  const get = (p) => fetch(`${api.base()}${p}`, { headers: api.headers(), cache: "no-store" });
  const cleanup = () => { visit++; names = null; now = null; failed = null; want = FIRST; };

  root.append(ui.h("section", { class: "card" }, ui.h("h1", {}, "What changed in your plan"),
    ui.h("p", { class: "lede" }, "Each time your plan is saved, your PC keeps a copy of how it was just before. Putting the copies in order shows what every save changed, newest first."),
    store.sandbox() ? ui.notice("warn", "You are in the sandbox (a pretend plan). The changes listed are your real plan's, not the pretend one's.") : null));

  // the sandbox keeps its pretend plan in this browser, so the store is "local" there; the PC may still answer
  if (store.backend() !== "server" && !store.sandbox()) {
    root.append(ui.card("Not connected to your PC", ui.h("p", { class: "muted" }, "The copies are kept by the app's server on your PC. This browser is not connected to it right now, so your plan is saved here only and no changes are recorded. System > Settings shows how to connect."),
      ui.row(ui.h("a", { class: "btn secondary", href: "#/system/settings" }, "Open Settings"))));
    return cleanup;
  }
  if (failed) {
    root.append(ui.card("Changes", ui.notice("error", "Your PC did not send its copies of the plan. Check that the app's server is running, then try again."),
      ui.h("details", {}, ui.h("summary", {}, "Show details"), ui.h("p", { class: "muted small" }, failed)),
      ui.row(ui.button("Try again", () => { failed = null; names = null; now = null; redraw(); }, { class: "secondary" }))));
    return cleanup;
  }
  if (names === null || now === null) {
    root.append(ui.card("Changes", ui.h("p", { class: "muted" }, "Asking your PC for its copies…")));
    Promise.all([
      get("/api/plan/backups").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`the list: the PC answered ${r.status}`)))),
      get("/api/plan").then((r) => (r.ok ? r.json() : r.status === 404 ? {} : Promise.reject(new Error(`the plan: the PC answered ${r.status}`)))),
    ]).then(([l, p]) => { if (mine !== visit) return; names = l.backups ?? []; now = p; })
      .catch((e) => { if (mine === visit) failed = String(e.message ?? e); })
      .finally(redraw);
    return cleanup;
  }

  const list = listOf(names);   // newest first
  if (!list.length) {
    root.append(ui.card("Changes", ui.h("p", { class: "muted" }, "Nothing recorded yet. The first change shows here after your plan is saved twice: change something on any page, then come back.")));
    return cleanup;
  }
  const slice = list.slice(0, Math.min(want, list.length));
  const missing = slice.filter((b) => !(b.name in copies));
  if (missing.length) {
    root.append(ui.card("Changes", ui.h("p", { class: "muted" }, `Reading ${slice.length} ${slice.length === 1 ? "copy" : "copies"} of your plan… ${slice.length - missing.length} of ${slice.length} done.`)));
    const one = (b) => get(`/api/plan/backups/${encodeURIComponent(b.name)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((p) => { copies[b.name] = p; });
    (async () => { for (let i = 0; i < missing.length; i += AT_ONCE) await Promise.all(missing.slice(i, i + AT_ONCE).map(one)); })().finally(redraw);
    return cleanup;
  }

  const t = timeline([...slice].reverse().map((b) => ({ name: b.name, when: b.when, plan: copies[b.name] })).concat([{ plan: now }]));
  // the time of a save; with seconds when another save shown has the same minute
  const minute = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const minutes = t.entries.filter((e) => e.when).map((e) => `${e.when.slice(0, 10)} ${minute(e.when)}`);
  const at = (iso) => (minutes.filter((m) => m === `${iso.slice(0, 10)} ${minute(iso)}`).length > 1 ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }) : minute(iso));
  const dayOf = (iso) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const name = (l) => [l.text, Number.isFinite(l.amount) ? fmt.money(l.amount, ctx.plan?.meta?.currency, undefined, 2) : null, l.date ? fmt.date(l.date) : null].filter(Boolean).join(", ")
    + (l.fields?.length ? ` (${l.fields.slice(0, 3).join(", ")}${l.fields.length > 3 ? "…" : ""})` : "");
  const names3 = (labels) => { const f = firstOf(labels); return f.shown.map(name).join("; ") + (f.more ? `; and ${f.more} more` : ""); };
  const line = (c) => {
    const parts = [];
    if (c.added.length) parts.push(`added ${names3(c.added)}`);
    if (c.removed.length) parts.push(`removed ${names3(c.removed)}`);
    if (c.changed.length) parts.push(`changed ${names3(c.changed)}`);
    if (c.details.length && !(c.details.length === 1 && c.details[0] === "changed")) parts.push(`changed ${c.details.slice(0, 4).join(", ")}${c.details.length > 4 ? ` and ${c.details.length - 4} more` : ""}`);
    else if (c.details.length) parts.push("changed");
    return ui.h("p", { class: "rec-sub au-change" }, ui.h("b", {}, `${c.label}: `), parts.join(". "));
  };

  // grouped by day, a heading above each day's saves
  const days = [];
  for (const e of t.entries) {
    const d = e.when ? dayOf(e.when) : "";
    if (!days.length || days[days.length - 1].d !== d) days.push({ d, saves: [] });
    days[days.length - 1].saves.push(ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, e.when ? at(e.when) : "A save"),
        ui.h("span", { class: "rec-value" }, e.unreadable ? ui.h("span", { class: "pill warn" }, "not readable") : `${e.count} ${e.count === 1 ? "change" : "changes"}`)),
      e.by ? ui.h("div", { class: "rec-sub" }, `On ${e.by}`) : null,
      e.unreadable ? ui.h("p", { class: "rec-sub" }, "One of the copies around this save is damaged, so what it changed cannot be shown.") : e.changes.map(line)));
  }
  const items = days.flatMap((x) => [ui.h("h3", { class: "au-day" }, x.d), ui.h("ul", { class: "records" }, x.saves)]);
  const shownSaves = slice.length;
  root.append(ui.card(`Changes in the last ${shownSaves} ${shownSaves === 1 ? "save" : "saves"}`,
    t.entries.length ? ui.h("div", {}, items) : ui.h("p", { class: "muted" }, "These saves changed nothing you can see (only the time of the save)."),
    t.quiet && t.entries.length ? ui.h("p", { class: "muted small" }, `${t.quiet} ${t.quiet === 1 ? "save" : "saves"} changed nothing you can see and ${t.quiet === 1 ? "is" : "are"} left out.`) : null,
    list.length > shownSaves ? ui.row(ui.button("Show earlier changes", () => { want += FIRST; redraw(); }, { class: "secondary" }))
      : ui.h("p", { class: "muted small" }, `That is everything your PC has kept: the oldest copy is from ${dayOf(list[list.length - 1].when)}. Changes before it are not recorded.`)));

  root.append(ui.card("Undo a change", ui.h("p", { class: "muted" }, "Backups lists the same copies. Put back the copy from just before a change to undo it; your plan as it is now is kept as a copy first."),
    ui.row(ui.h("a", { class: "btn secondary", href: "#/system/backups" }, "Open Backups"))));
  if (!t.entries.some((e) => e.by)) root.append(ui.h("p", { class: "muted small" }, "The app does not note yet which phone or computer made each change."));
  return cleanup;
}
