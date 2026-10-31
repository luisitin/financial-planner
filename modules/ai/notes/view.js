// modules/ai/notes/view.js -- DOM only. Say or type a note; the AI helper (or, when it is off, a few plain rules) turns
// it into entries to check: money spent, money in, a reminder, an account balance, a note. Each entry can be changed,
// then added with one tap (through compute.js's applyEntry, which uses the Ledger's, Money calendar's and Account
// detail's own helpers) or skipped. Nothing reaches the plan before Add. The notes kept are shown at the end.
import { compute, quickRead, finish, buildPrompt, readAnswer, applyEntry, accountChoices, notePart, withoutSentences, KINDS } from "./compute.js";
import { REPEATS } from "../../household/calendar/compute.js";

let text = "";          // the note being worked on, kept while the app is open
let entries = [];       // [{ uid, ...proposal }] still to add or skip
let readPart = [];      // the sentences that were read; they leave the box once every entry is handled
let unread = 0;         // sentences of a long note left in the box for the next reading
let source = "";        // "ai" | "rules": who read the note
let model = "";
let pending = [];       // [{ kind, text, go? }] shown on the next render
let advice = null;      // { kind, text } why the plain rules were used
let inflight = null;
let shown = 0;
let listening = false;
let rec = null;         // the browser's speech recognition while it listens; it outlives a redraw
let live = null;        // { box, redraw } of the render on screen, where what the browser hears goes
let focus = null;       // the entry brought back into view on the next render (the next one after an Add or Skip)
let fresh = false;      // a reading just finished: its entries are scrolled into view
let n = 0;              // entry ids in this page
const open = new Set(); // entries whose details are open for changing (an entry that needs a detail is always open)
const typed = new Map(); // uid -> what was typed into an entry's open details, kept across redraws until Add or Skip

const CHAT_OPTIONS = { options: { num_ctx: 8192 } };
const GO_LABEL = { "transactions/ledger": "Open the Ledger", "household/calendar": "Open the Money calendar", "ai/notes": null };
const OFF = "The AI helper is turned off, so the app read your note with a few simple rules. Check each entry; turning the AI helper on in Settings reads notes better.";
const NO_MODELS = "The AI helper is running but has no AI model to use yet, so the app read your note with a few simple rules. Check each entry. For the AI helper, a model has to be downloaded on the PC first; in Settings, “Show available models” tells you when it is there.";
const NO_ANSWER = "The AI helper did not answer, so the app read your note with a few simple rules. Check each entry. If the AI helper runs on your PC, check that the PC is on and the helper is running; Settings shows how it is set up.";
const STYLE = `
.vn-root textarea.vn-note { width: 100%; font-size: 17px; min-height: 112px; }
.vn-root .vn-clear { display: flex; justify-content: flex-end; margin: -4px 0 12px; }
.vn-root .vn-found, .vn-root .vn-entry { scroll-margin-top: calc(var(--topbar) + 8px); }
.vn-root .vn-found > .row { margin-top: 12px; }
.vn-root .vn-entry { padding: 14px 0; }
.vn-root .vn-entry .form { margin-top: 8px; }
.vn-root .vn-entry .notice { margin: 8px 0 0; }
.vn-root .vn-entry > .notice { margin: 0 0 12px; }
.vn-root .vn-entry .notice p { margin: 0 0 8px; }
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

  // a message about an entry sits above the next entry, where the person is; any other at the top
  const notices = pending.map((m) => {
    const go = m.go && m.go.startsWith("balance/accounts/") ? "Open the account" : GO_LABEL[m.go] ?? null;
    const box = ui.notice(m.kind, ui.h("span", {}, m.text, go ? " " : "", go ? ui.h("a", { href: `#/${m.go}` }, go) : null));
    if (m.kind === "ok") setTimeout(() => box.remove(), 8000);
    return box;
  });
  pending = [];
  const near = focus !== null && entries.some((e) => e.uid === focus) ? focus : null;
  focus = null;
  if (near === null) root.append(...notices);

  root.append(ui.h("section", { class: "card" }, ui.h("h1", {}, "Voice notes"),
    ui.h("p", { class: "lede" }, "Say or type what happened, the way you would tell a friend: \"spent 42 dollars at Corner Market yesterday\", \"my savings is at 12,400\", \"remind me to pay the car registration on December 1\". The app turns it into entries for you to check. Nothing is saved until you tap Add.")));

  // the note
  const box = ui.h("textarea", { class: "vn-note", rows: 4, "aria-label": "Your note", placeholder: "Type or speak your note here", onInput: (e) => { text = e.target.value; } });
  box.value = text;
  live = { box, redraw };
  const readBtn = ui.button(inflight ? "Reading your note…" : "Read my note", () => read());
  readBtn.disabled = !!inflight;
  const hint = ui.h("p", { class: "muted small", hidden: !inflight }, "With the AI helper, this can take a minute or two.");
  const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  let speakBtn = null;
  if (SR) {
    speakBtn = ui.button(listening ? "Listening… tap to stop" : "Speak instead", () => {
      if (listening) { rec?.stop(); return; }
      const r = new SR();
      r.lang = "en-US"; r.interimResults = false; r.continuous = false;
      // the page can be drawn again while it listens (a reading finishing): what is heard goes to the box on screen
      r.onresult = (e) => { const said = [...e.results].map((x) => x[0]?.transcript ?? "").join(" ").trim(); if (said) { text = [text.trim(), said].filter(Boolean).join(text.trim() && !/[.!?]$/.test(text.trim()) ? ". " : " "); if (live) live.box.value = text; } };
      r.onerror = () => { pending.push({ kind: "warn", text: "Your browser could not hear the note. Check that it may use the microphone, or tap the microphone on your keyboard instead." }); };
      r.onend = () => { listening = false; rec = null; live?.redraw(); };
      rec = r; listening = true; speakBtn.textContent = "Listening… tap to stop";
      try { r.start(); } catch { listening = false; rec = null; redraw(); }
    }, { class: "secondary" });
  }
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Your note"),
    ui.field("What happened", box, "On a phone, tap the microphone on your keyboard and speak. One thing per sentence works best."),
    text.trim() && !inflight ? ui.h("div", { class: "vn-clear" }, ui.button("Clear the box", () => { text = ""; redraw(); }, { class: "secondary small" })) : null,
    ui.row(readBtn, speakBtn), hint,
    SR ? ui.h("p", { class: "muted small" }, "\"Speak instead\" uses your browser's own speech to text; some browsers, Chrome among them, send the sound to their maker's servers to do it. The keyboard's microphone works on any phone.") : null,
    advice && !entries.length ? ui.notice(advice.kind, advice.text) : null));

  function read() {
    if (inflight) return;
    const note = text.trim();
    if (!note) { pending.push({ kind: "warn", text: "Type or say a note first." }); redraw(); return; }
    advice = null;
    const part = notePart(note);
    inflight = (async () => {
      let st = "unreachable";
      try { st = String(await ai.status()); } catch { /* not answering */ }
      const found = (list, by, m = "") => { entries = list.map((p) => ({ uid: ++n, ...p })); source = by; model = m; readPart = part.read; unread = part.rest.length; open.clear(); typed.clear(); fresh = entries.length > 0; };
      const rules = (why) => { found(quickRead(note, plan, today), "rules"); advice = why; };
      if (!st.startsWith("on")) { rules({ kind: "info", text: st === "off" ? OFF : st === "no models" ? NO_MODELS : NO_ANSWER }); return; }
      try {
        const q = buildPrompt(note, plan, today);
        const r = await ai.chat(q.messages, CHAT_OPTIONS);
        const got = readAnswer(r?.content, plan, today, note, q);
        if (got === null) { rules({ kind: "info", text: "The AI helper's answer came back jumbled, so the app read your note with a few simple rules instead. Check each entry." }); return; }
        if (!got.length) {
          // the AI saw nothing to add; money, reminders and balances the plain rules find are still worth a look
          const plain = quickRead(note, plan, today).filter((p) => p.kind !== "note");
          if (plain.length) { found(plain, "rules"); advice = { kind: "info", text: "The AI helper found nothing to add in this note, so the app read it with a few simple rules as well. Check each entry." }; return; }
          found([], "ai", r?.model ?? "");
          advice = { kind: "info", text: "The AI helper found nothing to add in this note. Try saying the amount, the day and who was paid, for example \"spent 42 dollars at Corner Market yesterday\"." };
          return;
        }
        found(got, "ai", r?.model ?? "");
      } catch (e) {
        console.warn("[ai/notes] the AI did not answer", e);
        rules({ kind: "info", text: NO_ANSWER });
      }
    })().finally(() => { inflight = null; });
    readBtn.disabled = true; readBtn.textContent = "Reading your note…"; hint.hidden = false;
    inflight.finally(redraw);
  }
  if (inflight) inflight.finally(redraw);

  // the entries found
  if (entries.length) {
    const ready = entries.filter((e) => e.ready);
    const list = ui.h("ul", { class: "records" }, entries.map((e) => ui.h("li", { class: "vn-entry", dataset: { uid: String(e.uid) } }, e.uid === near ? notices : null, entryView(e))));
    const card = ui.h("section", { class: "card vn-found" }, ui.h("h2", {}, `What the app found (${entries.length})`),
      advice ? ui.notice(advice.kind, advice.text) : ui.h("p", { class: "muted small" }, source === "ai" ? `Read by the AI helper${model ? ` (${model})` : ""}, which can get things wrong: check each entry, change anything, then tap Add.` : "Read with simple rules: check each entry, change anything, then tap Add."),
      unread ? ui.notice("info", `Your note is long, so the app read its first ${readPart.length} sentences. The other ${unread === 1 ? "one stays" : `${unread} stay`} in the box: once these are done, tap Read my note again.`) : null,
      list,
      ui.row(ready.length >= 2 ? ui.button(`Add all ${ready.length} that are ready`, () => addAll()) : null,
        ui.button("Skip all", () => { entries = []; open.clear(); typed.clear(); advice = null; redraw(); }, { class: "secondary" })));
    root.append(card);
    if (fresh) { fresh = false; requestAnimationFrame(() => card.scrollIntoView({ block: "start", behavior: "smooth" })); }
  }
  // after an Add the shell has scrolled to the top: back to where the person was (as on ai/categorizer)
  if (near !== null) setTimeout(() => root.querySelector(`li[data-uid="${near}"]`)?.scrollIntoView({ block: notices.length ? "center" : "nearest" }), 0);

  function fieldsFor(kind) {
    const accounts = [{ value: "", label: "Pick an account" }, ...accountChoices(plan, kind)];
    const kinds = Object.entries(KINDS).map(([value, label]) => ({ value, label }));
    const k = { key: "kind", label: "This is", type: "select", options: kinds };
    if (kind === "spend" || kind === "income") return [k, { key: "amount", label: "Amount", type: "money" }, { key: "date", label: "Day", type: "date" }, { key: "payee", label: kind === "spend" ? "Paid to" : "From" }, { key: "accountId", label: "Account", type: "select", options: accounts }];
    if (kind === "reminder") return [k, { key: "name", label: "What to remember" }, { key: "date", label: "Day", type: "date" }, { key: "amount", label: "Amount, if any", type: "money" }, { key: "repeat", label: "Repeats", type: "select", options: Object.entries(REPEATS).map(([value, label]) => ({ value, label })) }];
    if (kind === "balance") return [k, { key: "accountId", label: "Account", type: "select", options: accounts }, { key: "amount", label: "Balance", type: "money", help: "for a card or loan: what you owe" }, { key: "date", label: "Day", type: "date" }];
    return [k, { key: "text", label: "Note", type: "textarea", rows: 3 }];
  }

  function summary(e) {
    const acct = d.accounts.find((a) => a.id === e.accountId)?.name;
    // typed amounts in whole dollars, cents only when the note gave them (design log pass 2, round 9)
    const money = e.amount !== null ? fmt.money(e.amount, cur, undefined, Number.isInteger(e.amount) ? 0 : 2) : null;
    if (e.kind === "spend") return [money ? `−${money}` : null, e.payee ? `to ${e.payee}` : null, e.date ? fmt.date(e.date) : null, acct ? `from ${acct}` : null].filter(Boolean).join(", ");
    if (e.kind === "income") return [money ? `+${money}` : null, e.payee ? `from ${e.payee}` : null, e.date ? fmt.date(e.date) : null, acct ? `into ${acct}` : null].filter(Boolean).join(", ");
    if (e.kind === "reminder") return [e.name, e.date ? fmt.date(e.date) : null, money, e.repeat !== "none" ? REPEATS[e.repeat].toLowerCase() : null].filter(Boolean).join(", ");
    if (e.kind === "balance") return [acct, money, e.date ? `on ${fmt.date(e.date)}` : null].filter(Boolean).join(", ");
    return e.text;
  }
  /** An entry named in a message: "Money spent (Target)". */
  const labelOf = (e) => { const what = e.payee || e.name || d.accounts.find((a) => a.id === e.accountId)?.name || e.text.slice(0, 40); return what ? `${KINDS[e.kind]} (${what})` : KINDS[e.kind]; };

  function entryView(e) {
    const values = { kind: e.kind, amount: e.amount, date: e.date, payee: e.payee, accountId: e.accountId, name: e.name, repeat: e.repeat, text: e.text, ...typed.get(e.uid) };
    const skip = ui.button("Skip", () => skipOne(e), { class: "secondary small" });
    const editing = !e.ready || open.has(e.uid);
    let form = null;
    if (editing) {
      form = ui.form(fieldsFor(e.kind), values, (v) => add(e, v), { submitLabel: e.kind === "note" ? "Keep this note" : "Add" });
      // what is typed is kept until Add or Skip: a redraw (another entry added) or "Add all" does not lose it
      const keep = (ev) => { if (ev.target.name !== "kind") typed.set(e.uid, readValues(form)); };
      form.addEventListener("input", keep);
      form.addEventListener("change", keep);
      // changing what it is redraws the entry with that kind's fields, keeping what was typed; a note gets the
      // sentence it came from (or what the AI read), not the whole note
      form.querySelector("select[name=kind]")?.addEventListener("change", (ev) => {
        const at = entries.findIndex((x) => x.uid === e.uid);
        if (at >= 0) { entries[at] = { uid: e.uid, ...finish({ ...e, ...readValues(form), kind: ev.target.value, text: e.text || e.source || summary(e) }, plan, today, text) }; typed.delete(e.uid); open.add(e.uid); focus = e.uid; redraw(); }
      });
      form.querySelector(".form-actions")?.append(skip);
    }
    const noAccounts = e.problems.includes("the account") && !d.accounts.length;
    return ui.h("div", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, ui.h("span", { class: `pill ${e.ready ? "ok" : "warn"}` }, KINDS[e.kind])), ui.h("span", { class: "rec-value" }, e.ready ? "ready" : "needs a detail")),
      ui.h("div", { class: "rec-sub" }, summary(e) || "Nothing filled in yet"),
      e.problems.length ? ui.notice("warn", `Still needed: ${e.problems.join(", ")}.`) : null,
      noAccounts ? ui.h("div", { class: "notice warn" }, ui.h("p", {}, "Your plan has no accounts yet, so this cannot be added. Add your accounts on Net worth first, or change \"This is\" to Note to keep it as a note."), ui.row(ui.h("a", { class: "btn secondary small", href: "#/balance/net-worth" }, "Open Net worth"))) : null,
      e.warnings.map((w) => ui.notice("warn", w)),
      editing ? form : ui.h("div", { class: "rec-foot" },
        ui.button(e.kind === "note" ? "Keep this note" : "Add", () => add(e, {})),
        ui.button("Change", () => { open.add(e.uid); focus = e.uid; redraw(); }, { class: "secondary small" }), skip));
  }

  function readValues(form) {
    const out = {};
    for (const el of form.querySelectorAll("[name]")) out[el.name] = el.type === "number" ? (el.value === "" ? null : Number(el.value)) : el.value;
    return out;
  }

  // what was added leaves the box, so reading the note again cannot add it twice; once every entry is handled the
  // sentences read go too, and only what was not read yet (or was typed since) stays
  function tidy(added) {
    text = withoutSentences(text, added.map((p) => p.source));
    if (!entries.length) { text = withoutSentences(text, readPart); readPart = []; unread = 0; advice = null; }
  }
  // one full stop at the end of a message, even when it ends with "Acme Inc."
  const stop = (t) => `${t.replace(/[.!?]+$/, "")}.`;
  const leftOver = () => (!entries.length && text.trim() ? " What is left of your note is still in the box: tap Read my note to read it." : "");

  function skipOne(e) {
    const at = entries.findIndex((x) => x.uid === e.uid);
    focus = (entries[at + 1] ?? entries[at - 1])?.uid ?? null;
    entries = entries.filter((x) => x.uid !== e.uid);
    open.delete(e.uid); typed.delete(e.uid);
    redraw();
  }

  function add(e, v) {
    const p = finish({ ...e, ...v }, plan, today, text);
    const at = entries.findIndex((x) => x.uid === e.uid);
    typed.delete(e.uid);
    focus = e.uid;
    if (!p.ready) { if (at >= 0) entries[at] = { uid: e.uid, ...p }; redraw(); return; }
    // the shell redraws the page as soon as the plan changes, so the message is set inside the change
    store.update((draft) => {
      const r = applyEntry(draft, p, { id: ui.uid(), today });
      if (!r.ok) { if (at >= 0) entries[at] = { uid: e.uid, ...p }; pending.push({ kind: "error", text: `${r.text} Check the entry and try again.` }); return; }
      focus = (entries[at + 1] ?? entries[at - 1])?.uid ?? null;
      entries = entries.filter((x) => x.uid !== e.uid);
      open.delete(e.uid);
      tidy([p]);
      pending.push({ kind: "ok", text: `Added. ${stop(r.text)}${leftOver()}`, go: r.go });
    });
  }

  function addAll() {
    // each one checked again with what was typed into it, against the plan as it is now (an account may be gone)
    const todo = [], missed = [];
    entries = entries.map((e) => {
      if (!e.ready) return e;
      const p = { uid: e.uid, ...finish({ ...e, ...typed.get(e.uid) }, plan, today, text) };
      typed.delete(e.uid);
      (p.ready ? todo : missed).push(p);
      return p;
    });
    const notAdded = () => ({ kind: "error", text: `Not added: ${missed.map(labelOf).join("; ")}. Each one says below what it needs; fill it in, then tap Add.` });
    if (!todo.length) { pending.push(notAdded()); focus = missed[0]?.uid ?? null; redraw(); return; }
    store.update((draft) => {
      const done = [], added = [];
      for (const p of todo) { const r = applyEntry(draft, p, { id: ui.uid(), today }); if (r.ok) { done.push(r.text); added.push(p); } else missed.push(p); }
      const gone = new Set(added.map((p) => p.uid));
      entries = entries.filter((x) => !gone.has(x.uid));
      for (const uid of gone) open.delete(uid);
      tidy(added);
      if (done.length) pending.push({ kind: "ok", text: `Added ${done.length} ${done.length === 1 ? "entry" : "entries"}: ${stop(done.join("; "))}${leftOver()}` });
      if (missed.length) pending.push(notAdded());
      focus = entries[0]?.uid ?? null;
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
      ui.row(ui.button("Save notes", () => { pending.push({ kind: "ok", text: "Notes saved." }); store.update((draft) => { draft.notes = notes.value.trim(); }); }, { class: "secondary" })))));
  return leave;
}
