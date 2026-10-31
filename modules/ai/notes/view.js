// modules/ai/notes/view.js -- DOM only. Say or type a note; the AI helper (or, when it is off, a few plain rules) turns
// it into entries to check: money spent, money in, a reminder, an account balance, a note. Each entry can be changed,
// then added with one tap (through compute.js's applyEntry, which uses the Ledger's, Money calendar's and Account
// detail's own helpers) or skipped. Nothing reaches the plan before Add. The notes kept are shown at the end.
import { compute, quickRead, finish, buildPrompt, readAnswer, applyEntry, KINDS } from "./compute.js";
import { REPEATS } from "../../household/calendar/compute.js";

let text = "";          // the note being worked on, kept while the app is open
let entries = [];       // [{ uid, ...proposal }] still to add or skip
let source = "";        // "ai" | "rules": who read the note
let model = "";
let pending = null;     // { kind, text, go? } shown on the next render
let advice = null;      // { kind, text } why the plain rules were used
let inflight = null;
let shown = 0;
let listening = false;
let n = 0;              // entry ids in this page
const open = new Set(); // entries whose details are open for changing (an entry that needs a detail is always open)

const CHAT_OPTIONS = { options: { num_ctx: 8192 } };
const GO_LABEL = { "transactions/ledger": "Open the Ledger", "household/calendar": "Open the Money calendar", "ai/notes": null };
const STYLE = `
.vn-root textarea.vn-note { width: 100%; font-size: 17px; min-height: 112px; }
.vn-root .vn-entry { padding: 14px 0; }
.vn-root .vn-entry .form { margin-top: 8px; }
.vn-root .vn-entry .notice { margin: 8px 0 0; }
.vn-root .rec-foot { flex-wrap: wrap; justify-content: flex-start; gap: 8px; }
.vn-root .form-actions { flex-wrap: wrap; gap: 8px; }
.vn-root .pill { margin-left: 0; }
.vn-root .vn-notes { width: 100%; min-height: 120px; }
`;

export function render(page, ctx) {
  const me = ++shown;
  const leave = () => { shown++; };
  const { ui, fmt, plan, store, ai } = ctx;
  const d = compute(plan);
  const today = fmt.today();
  const cur = plan.meta?.currency;
  const root = ui.h("div", { class: "vn-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const redraw = () => { if (me === shown) { root.remove(); render(page, ctx); } };

  if (pending) {
    const go = pending.go && pending.go.startsWith("balance/accounts/") ? "Open the account" : GO_LABEL[pending.go] ?? null;
    const box = ui.notice(pending.kind, ui.h("span", {}, pending.text, go ? " " : "", go ? ui.h("a", { href: `#/${pending.go}` }, go) : null));
    root.append(box);
    if (pending.kind === "ok") setTimeout(() => box.remove(), 8000);
    pending = null;
  }

  root.append(ui.h("section", { class: "card" }, ui.h("h1", {}, "Voice notes"),
    ui.h("p", { class: "lede" }, "Say or type what happened, the way you would tell a friend: \"spent 42 dollars at Corner Market yesterday\", \"my savings is at 12,400\", \"remind me to pay the car registration on December 1\". The app turns it into entries for you to check. Nothing is saved until you tap Add.")));

  // the note
  const box = ui.h("textarea", { class: "vn-note", rows: 4, "aria-label": "Your note", placeholder: "Type or speak your note here", onInput: (e) => { text = e.target.value; } });
  box.value = text;
  const readBtn = ui.button(inflight ? "Reading your note…" : "Read my note", () => read());
  readBtn.disabled = !!inflight;
  const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  let speakBtn = null;
  if (SR) {
    speakBtn = ui.button(listening ? "Listening… tap to stop" : "Speak instead", () => {
      if (listening) { speakBtn.rec?.stop(); return; }
      const rec = new SR();
      rec.lang = "en-US"; rec.interimResults = false; rec.continuous = false;
      rec.onresult = (e) => { const said = [...e.results].map((r) => r[0]?.transcript ?? "").join(" ").trim(); if (said) { text = [text.trim(), said].filter(Boolean).join(text.trim() && !/[.!?]$/.test(text.trim()) ? ". " : " "); box.value = text; } };
      rec.onerror = () => { pending = { kind: "warn", text: "Your browser could not hear the note. Check that it may use the microphone, or tap the microphone on your keyboard instead." }; };
      rec.onend = () => { listening = false; redraw(); };
      speakBtn.rec = rec; listening = true; speakBtn.textContent = "Listening… tap to stop";
      try { rec.start(); } catch { listening = false; redraw(); }
    }, { class: "secondary" });
  }
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Your note"),
    ui.field("What happened", box, "On a phone, tap the microphone on your keyboard and speak. One thing per sentence works best."),
    ui.row(readBtn, speakBtn, text.trim() && !inflight ? ui.button("Clear", () => { text = ""; redraw(); }, { class: "secondary" }) : null),
    SR ? ui.h("p", { class: "muted small" }, "\"Speak instead\" uses your browser's own speech to text; some browsers, Chrome among them, send the sound to their maker's servers to do it. The keyboard's microphone works on any phone.") : null,
    advice ? ui.notice(advice.kind, advice.text) : null));

  function read() {
    if (inflight) return;
    const note = text.trim();
    if (!note) { pending = { kind: "warn", text: "Type or say a note first." }; redraw(); return; }
    advice = null;
    inflight = (async () => {
      let st = "unreachable";
      try { st = String(await ai.status()); } catch { /* not answering */ }
      const rules = (why) => { entries = quickRead(note, plan, today).map((p) => ({ uid: ++n, ...p })); source = "rules"; model = ""; advice = why; };
      if (!st.startsWith("on")) { rules({ kind: "info", text: st === "off" ? "The AI helper is turned off, so the app read your note with a few simple rules. Check each entry; turning the AI helper on in Settings reads notes better." : "The AI helper did not answer, so the app read your note with a few simple rules. Check each entry." }); return; }
      try {
        const q = buildPrompt(note, plan, today);
        const r = await ai.chat(q.messages, CHAT_OPTIONS);
        const got = readAnswer(r?.content, plan, today, note, q);
        if (got === null) { rules({ kind: "info", text: "The AI's answer came back jumbled, so the app read your note with a few simple rules instead. Check each entry." }); return; }
        entries = got.map((p) => ({ uid: ++n, ...p })); source = "ai"; model = r?.model ?? "";
        if (!entries.length) advice = { kind: "info", text: "The AI found nothing to add in this note. Try saying the amount, the day and who it was with." };
      } catch (e) {
        console.warn("[ai/notes] the AI did not answer", e);
        rules({ kind: "info", text: "The AI helper did not answer, so the app read your note with a few simple rules. Check each entry." });
      }
    })().finally(() => { inflight = null; });
    readBtn.disabled = true; readBtn.textContent = "Reading your note…";
    inflight.finally(redraw);
  }
  if (inflight) inflight.finally(redraw);

  // the entries found
  if (entries.length) {
    const ready = entries.filter((e) => e.ready);
    const list = ui.h("ul", { class: "records" }, entries.map((e) => ui.h("li", { class: "vn-entry" }, entryView(e))));
    root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, `What the app found (${entries.length})`),
      ui.h("p", { class: "muted small" }, source === "ai" ? `Read by the AI helper${model ? ` (${model})` : ""}, which can get things wrong: check each entry, change anything, then tap Add.` : "Read with simple rules: check each entry, change anything, then tap Add."),
      list,
      ready.length >= 2 ? ui.row(ui.button(`Add all ${ready.length} that are ready`, () => addAll())) : null,
      ui.row(ui.button("Skip them all", () => { entries = []; advice = null; redraw(); }, { class: "secondary" }))));
  }

  function fieldsFor(kind) {
    const accounts = [{ value: "", label: "Pick an account" }, ...d.accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.label})` }))];
    const kinds = Object.entries(KINDS).map(([value, label]) => ({ value, label }));
    const k = { key: "kind", label: "This is", type: "select", options: kinds };
    if (kind === "spend" || kind === "income") return [k, { key: "amount", label: "Amount", type: "money" }, { key: "date", label: "Day", type: "date" }, { key: "payee", label: kind === "spend" ? "Paid to" : "From" }, { key: "accountId", label: "Account", type: "select", options: accounts }];
    if (kind === "reminder") return [k, { key: "name", label: "What to remember" }, { key: "date", label: "Day", type: "date" }, { key: "amount", label: "Amount, if any", type: "money" }, { key: "repeat", label: "Repeats", type: "select", options: Object.entries(REPEATS).map(([value, label]) => ({ value, label })) }];
    if (kind === "balance") return [k, { key: "accountId", label: "Account", type: "select", options: accounts }, { key: "amount", label: "Balance", type: "money", help: "for a card or loan: what you owe" }, { key: "date", label: "Day", type: "date" }];
    return [k, { key: "text", label: "Note", type: "textarea", rows: 3 }];
  }

  function summary(e) {
    const acct = d.accounts.find((a) => a.id === e.accountId)?.name;
    const money = e.amount !== null ? fmt.money(e.amount, cur, undefined, 2) : null;
    if (e.kind === "spend") return [money ? `−${money}` : null, e.payee ? `to ${e.payee}` : null, e.date ? fmt.date(e.date) : null, acct ? `from ${acct}` : null].filter(Boolean).join(", ");
    if (e.kind === "income") return [money ? `+${money}` : null, e.payee ? `from ${e.payee}` : null, e.date ? fmt.date(e.date) : null, acct ? `into ${acct}` : null].filter(Boolean).join(", ");
    if (e.kind === "reminder") return [e.name, e.date ? fmt.date(e.date) : null, money, e.repeat !== "none" ? REPEATS[e.repeat].toLowerCase() : null].filter(Boolean).join(", ");
    if (e.kind === "balance") return [acct, money, e.date ? `on ${fmt.date(e.date)}` : null].filter(Boolean).join(", ");
    return e.text;
  }

  function entryView(e) {
    const values = { kind: e.kind, amount: e.amount, date: e.date, payee: e.payee, accountId: e.accountId, name: e.name, repeat: e.repeat, text: e.text };
    const skip = ui.button("Skip", () => { entries = entries.filter((x) => x.uid !== e.uid); open.delete(e.uid); redraw(); }, { class: "secondary small" });
    const editing = !e.ready || open.has(e.uid);
    let form = null;
    if (editing) {
      form = ui.form(fieldsFor(e.kind), values, (v) => add(e, v), { submitLabel: e.kind === "note" ? "Keep this note" : "Add" });
      // changing what it is redraws the entry with that kind's fields, keeping what was typed
      form.querySelector("select[name=kind]")?.addEventListener("change", (ev) => {
        const at = entries.findIndex((x) => x.uid === e.uid);
        if (at >= 0) { entries[at] = { uid: e.uid, ...finish({ ...e, ...readValues(form), kind: ev.target.value, text: e.text || text.trim() }, plan, today, text) }; open.add(e.uid); redraw(); }
      });
      form.querySelector(".form-actions")?.append(skip);
    }
    return ui.h("div", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, ui.h("span", { class: `pill ${e.ready ? "ok" : "warn"}` }, KINDS[e.kind])), ui.h("span", { class: "rec-value" }, e.ready ? "ready" : "needs a detail")),
      ui.h("div", { class: "rec-sub" }, summary(e) || "Nothing filled in yet"),
      e.problems.length ? ui.notice("warn", `Still needed: ${e.problems.join(", ")}.`) : null,
      e.warnings.map((w) => ui.notice("warn", w)),
      editing ? form : ui.h("div", { class: "rec-foot" },
        ui.button(e.kind === "note" ? "Keep this note" : "Add", () => add(e, {})),
        ui.button("Change", () => { open.add(e.uid); redraw(); }, { class: "secondary small" }), skip));
  }

  function readValues(form) {
    const out = {};
    for (const el of form.querySelectorAll("[name]")) out[el.name] = el.type === "number" ? (el.value === "" ? null : Number(el.value)) : el.value;
    return out;
  }

  function add(e, v) {
    const p = finish({ ...e, ...v }, plan, today, text);
    const at = entries.findIndex((x) => x.uid === e.uid);
    if (!p.ready) { if (at >= 0) entries[at] = { uid: e.uid, ...p }; redraw(); return; }
    entries = entries.filter((x) => x.uid !== e.uid);
    open.delete(e.uid);
    if (!entries.length) { text = ""; advice = null; }
    // the shell redraws the page as soon as the plan changes, so the message is set inside the change
    store.update((draft) => {
      const r = applyEntry(draft, p, { id: ui.uid(), today });
      pending = r.ok ? { kind: "ok", text: `Added. ${r.text}.`, go: r.go } : { kind: "error", text: `${r.text} Check the entry and try again.` };
    });
  }

  function addAll() {
    const ready = entries.filter((x) => x.ready);
    const done = [];
    entries = entries.filter((x) => !x.ready);
    if (!entries.length) { text = ""; advice = null; }
    store.update((draft) => {
      for (const p of ready) { const r = applyEntry(draft, p, { id: ui.uid(), today }); if (r.ok) done.push(r.text); }
      pending = { kind: "ok", text: `Added ${done.length} ${done.length === 1 ? "entry" : "entries"}: ${done.join("; ")}.` };
    });
  }

  // the notes kept so far (the plan's notes), editable
  const notes = ui.h("textarea", { class: "vn-notes", rows: 5, "aria-label": "Your notes" });
  notes.value = d.notes;
  const lines = d.notes.split("\n").filter((l) => l.trim()).length;
  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "Notes you kept"), ui.h("span", { class: "fold-status" }, lines ? `${lines} ${lines === 1 ? "line" : "lines"}` : "none yet"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "fold-body" },
      ui.h("p", { class: "muted small" }, "Entries you keep as a note land here with their day. Change or delete anything, then save."),
      ui.field("Your notes", notes),
      ui.row(ui.button("Save notes", () => { pending = { kind: "ok", text: "Notes saved." }; store.update((draft) => { draft.notes = notes.value.trim(); }); }, { class: "secondary" })))));
  return leave;
}
