// modules/transactions/import/view.js -- DOM only. Choose the file (or paste its text under More options), check the
// preview, import. Past imports can be undone.
// A bank's "Quicken" / "QuickBooks" download (OFX, QFX, QBO; 2026-11-11) has no columns to check and names its own
// account: the preview says which of the plan's accounts it goes to and why, asks when it cannot tell (never the first
// account in a list, never an account of another kind; round-1 review 2026-11-12), and offers the bank's balance above
// the Import button. A CSV cannot say whose it is, so its account is asked in the preview.
import { compute, prepareImport, importRecord, looksLikeBankFile, prepareOfx, setBalanceFromFile, canUndoBalance, undoBalance, safeFileName, OFX_A, columnChanges } from "./compute.js";
import { isOfx, decodeOfx } from "../../../core/ofx.js";
import { txKey, monthLabel, shortDate, isQuietImport } from "../ledger/compute.js";
import { say as sayOnCategorize } from "../categorize/view.js";
import { parsePositions } from "../../investments/holdings/compute.js";

let pending = null;   // the confirmation shown on the next render (the shell re-renders after store.update)
// folds the person opened on this visit ("See the lines", the columns, "Past imports", ...): the preview is drawn again after
// each choice and the page after each import or undo, and an open fold stays open (simple first, 2026-11-13; never saved).
// A new file starts with the preview's folds closed again (PREVIEW_FOLDS).
const opened = new Set();
const PREVIEW_FOLDS = ["cols", "lines", "acct", "anyway"];

// scoped to this page's cards: a chip that is a link sits like the buttons beside it
const STYLE = `
.im-root a.chip { display: inline-flex; align-items: center; text-decoration: none; }
.im-root .im-ask { margin: 8px 0 6px; font-weight: 600; }
.im-root .im-bal { display: flex; gap: 12px; align-items: center; min-height: 44px; margin: 10px 0 4px; cursor: pointer; }
.im-root .im-bal input { flex: none; }
/* a fold whose summary has a status ("See the lines" and its counts, the columns and what was changed): the title keeps its
   words whole and the status wraps at the right, so the line never runs off a 320 px screen (fix round 3, F2) */
.im-root .im-st > summary .fold-title { flex: 0 1 auto; }
.im-root .im-st > summary .fold-status { flex: 1 1 0; white-space: normal; text-align: right; }
`;
// accounts a bank's CSV can belong to come first in its account box; things (a home, a car) are left out unless lines are on them
const CSV_FIRST = ["checking", "savings", "cash", "credit"];
const CSV_NEVER = ["property", "vehicle", "other_asset"];

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan);
  const today = fmt.today();
  root.classList.add("im-root");
  root.append(ui.h("style", {}, STYLE));
  // opened from the Monthly review's "Bring in the Visa file" (?accountId=a-visa): that account, as if picked by hand, so a
  // file laid out like another account's only warns instead of switching the box (2026-11-02)
  const qa = ctx.route?.query?.accountId ?? "";
  const asked = d.accounts.some((a) => a.id === qa) ? qa : "";
  // a CSV's account box: bank and card accounts first; never a 401(k) or a home by default
  const csvAccounts = [...d.accounts.filter((a) => CSV_FIRST.includes(a.type)), ...d.accounts.filter((a) => !CSV_FIRST.includes(a.type) && (!CSV_NEVER.includes(a.type) || a.count || a.id === asked))];
  let accountId = asked || (csvAccounts[0]?.id ?? d.accounts[0]?.id ?? "");
  let picked = !!asked;   // the account box was changed by hand: a saved file layout no longer picks the account
  let text = "", fileName = "", prep = null, mapping = null, flipSign = null;   // null = decide from the file and the account type
  let which = null;   // an OFX file with several accounts: the one to bring in (null = the first with new lines)
  // an OFX file's account, tapped in the preview (null = the page's guess, or the account the page was opened for); `force`:
  // "bring it in anyway" to an account of another kind; `creditIs`: the answer to "is that what you owe, or a credit?"
  let chosen = null, force = false, creditIs = null;
  const nameOf = (id) => d.accounts.find((a) => a.id === id)?.name ?? "this account";
  // a quiet fold: its summary line says what it holds; one opened on this visit stays open when it is drawn again
  const fold = (key, title, status, body, { cls = "fold", h2 = false, style = null } = {}) => {
    const el = ui.h("details", { class: `${cls}${status && !h2 ? " im-st" : ""}`, open: opened.has(key) ? true : null, ...(style ? { style } : {}) },
      ui.h("summary", {}, h2 ? ui.h("h2", {}, title) : ui.h("span", { class: "fold-title" }, title), status ? ui.h("span", { class: "fold-status" }, status) : null, ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("div", { class: "fold-body" }, ...[].concat(body)));
    el.addEventListener("toggle", () => { if (el.open) opened.add(key); else opened.delete(key); });
    return el;
  };
  // the tiles, the totals and the first lines of a file: one tap away under "See the lines" (its summary says how many)
  const linesFold = (status, body) => fold("lines", "See the lines", status, body, { style: { marginTop: "10px" } });

  // no account yet: the first step is a full-size button, not a 19 px link named after a page (stress test CF-1, T2)
  if (!d.accounts.length) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Import a bank file"),
      ui.h("p", { class: "lede" }, "Download your transactions from your bank or card's site, then bring the file here. The app reads it, skips anything already on file, and applies your rules.")));
    if (pending) { root.append(ui.notice(...pending)); pending = null; }
    root.append(ui.card("First, add the account this file comes from",
      // the add form opens on Net worth, and its green line leads back here: "Now import the bank file" (review N4);
      // the button comes before the sentence so it is on the first screen at 320 px
      ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth?add=checking&from=import" }, "Add the account")),
      ui.h("p", { class: "small", style: { margin: "10px 0 0" } }, "Your checking account or card, so the app knows whose lines these are. After saving it, tap “Now import the bank file” to come back here.")));
    return;
  }

  // ---- the file: one filled button; pasting sits behind More options (simple first)
  // App-style picker instead of the browser's file control (design log 2026-09-16, pass 3). The list is broad (an iPhone
  // greys out a file whose kind it does not know) and the file itself says what it is: OFX by its content, not its name.
  const file = ui.h("input", { type: "file", accept: ".csv,.txt,.tsv,.ofx,.qfx,.qbo,text/csv,text/plain,application/x-ofx,application/vnd.intu.qfx", "aria-label": "Bank file", style: { display: "none" } });
  const chosenFile = ui.h("span", { class: "muted small", style: { alignSelf: "center" } }, "");
  const pickBtn = ui.button("Choose the file", () => file.click());
  // a new file or new text starts over: nothing tapped for the file before it carries on (review N1)
  const fresh = () => { mapping = null; flipSign = null; which = null; chosen = null; force = false; creditIs = null; picked = !!asked; if (!asked) accountId = csvAccounts[0]?.id ?? d.accounts[0]?.id ?? ""; for (const k of PREVIEW_FOLDS) opened.delete(k); pickBtn.classList.add("secondary"); pickBtn.textContent = "Choose another file"; };
  file.addEventListener("change", () => {
    const f = file.files?.[0]; if (!f) return;
    fileName = f.name; chosenFile.textContent = `${safeFileName(f.name)} (${Math.max(1, Math.round(f.size / 1024))} KB)`;
    const reader = new FileReader();
    // read as bytes: an OFX file names its own character set (CHARSET:1252 at most U.S. banks), anything else is UTF-8
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result ?? new ArrayBuffer(0));
      let head = ""; for (let i = 0; i < Math.min(bytes.length, 4096); i++) head += String.fromCharCode(bytes[i]);
      text = isOfx(head) ? decodeOfx(bytes) : new TextDecoder("utf-8").decode(bytes);
      fresh(); pasteMsg.replaceChildren(); prepare(); bringUp();
    };
    reader.readAsArrayBuffer(f);
    file.value = "";   // the same file can be chosen again (a browser fires no change for the file already in the box)
  });
  const paste = ui.h("textarea", { rows: 4, placeholder: "Paste the file's text here (all of it, from the first line)", "aria-label": "Pasted file text", style: { width: "100%", font: "inherit", fontSize: "max(16px, var(--fs))" } });
  const pasteMsg = ui.h("div");
  // an empty box says so at the box and leaves a chosen file alone (stress test T1, T6)
  const pasteBtn = ui.button("Use the pasted text", () => {
    if (!paste.value.trim()) { pasteMsg.replaceChildren(ui.notice("warn", "Paste the file's text in the box first.")); paste.focus(); return; }
    pasteMsg.replaceChildren();
    text = paste.value; fileName = "pasted text"; chosenFile.textContent = ""; fresh(); prepare(); bringUp();
  }, { class: "secondary" });
  // opened for days an account's files miss (the Monthly review's "Bring in the Chase checking file", ?need=from..to): the
  // days the file must cover, and whether the usual "last 90 days" reaches them (re-check 4, 2026-11-02)
  const need = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(ctx.route?.query?.need ?? "");
  const needNote = (() => {
    if (!need || !asked) return null;
    const [, from, to] = need, md = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
    const ninety = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)) - 90)).toISOString().slice(0, 10);
    return ui.notice("info", `Bring in a ${nameOf(asked)} file that covers ${from === to ? md(from) : `${md(from)} to ${md(to)}`}. On your bank's site pick those dates (or a span around them)${from < ninety ? `: a "last 90 days" file starts on ${md(ninety)}, too late` : ""}.`);
  })();
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, asked ? `Import a ${nameOf(asked)} file` : "Import a bank file"),
    ui.h("p", { class: "lede" }, "Download your transactions from your bank or card's site (most sites: Activity > Download, last 90 days), then choose the file here. Anything already on file is skipped."),
    needNote,
    ui.row(pickBtn, chosenFile), file,
    ui.h("p", { class: "small", style: { margin: "10px 0 0" } }, "If your bank offers “Quicken” or “QuickBooks” (.qfx, .qbo), take that one: nothing to set up. Otherwise take CSV."),
    fold("paste", "More options", null, [ui.h("p", { class: "small", style: { margin: "0 0 8px" } }, "No file to choose? Open it, select all, copy, and paste its text."), paste, pasteMsg, ui.row(pasteBtn)], { style: { marginTop: "6px" } }),
    ui.h("p", { class: "muted small" }, `Nothing is sent anywhere: the file is read on this device and the transactions are stored with your plan${ctx.view.build ? " on the PC" : ""}. No bank login, and no account number is kept.`),
  ));
  if (pending) { root.append(ui.notice(...pending)); pending = null; }

  // ---- check and import: shown once a file is read (or text used)
  const previewCard = ui.card("Check and import");
  previewCard.hidden = true;
  // a file read (or text used): its result comes to the top of the screen, with the Import button on that first screen
  const bringUp = () => requestAnimationFrame(() => previewCard.scrollIntoView({ behavior: "smooth", block: "start" }));
  const previewHost = ui.h("div");
  previewCard.append(previewHost);
  const colOptions = (headers, allowNone) => [...(allowNone ? [{ value: "", label: "(none)" }] : []), ...headers.map((h, i) => ({ value: String(i), label: h }))];
  const idx = (v) => (v === "" ? null : Number(v));
  // a CSV does not say whose it is: its account is asked here, above its preview
  const acctSel = ui.select(csvAccounts.map((a) => ({ value: a.id, label: `${a.name}${a.count ? ` (${a.count} on file)` : ""}` })), accountId, { "aria-label": "Which account is this file from?", onChange: (e) => { accountId = e.target.value; picked = true; if (text) prepare(); } });
  const acctField = ui.h("div", { class: "form" }, ui.field("Which account is this file from?", acctSel));
  const prepare = () => {
    previewHost.innerHTML = "";
    previewCard.hidden = !text.trim();
    if (!text.trim()) return;
    if (isOfx(text)) return prepareOfxPreview();
    acctSel.value = accountId;
    previewHost.append(acctField);
    try { prep = prepareImport(plan, text, { accountId, mapping, flipSign, importId: "preview" }); }
    catch (e) { previewHost.append(ui.notice("error", `Could not read the file: ${e.message}`)); return; }
    // a file laid out like one imported before goes to the account it went to then, until the account is picked by hand
    const was = plan.importProfiles?.[prep.headerKey]?.accountId;
    const wasName = d.accounts.find((a) => a.id === was)?.name ?? null;
    if (wasName && !picked && was !== accountId) { accountId = was; acctSel.value = was; mapping = null; return prepare(); }
    mapping = prep.mapping;
    const H = prep.parsed.headers;
    // text that is not a bank file: one plain line, no column pickers and no tiles of 0 (stress test T6, 2026-11-11)
    if (!prep.add.length && !prep.skip.length && !looksLikeBankFile(prep.parsed)) {
      // a brokerage's positions file has amounts but no dates: it belongs on Holdings, not here (attack, 2026-11-11)
      const pos = parsePositions(text);
      // a symbol column, or shares with a price: a plain "Name,Value" list is not a brokerage file
      if (pos.rows.length && (pos.mapping.symbol >= 0 || (pos.mapping.shares >= 0 && pos.mapping.price >= 0))) {
        previewHost.append(ui.notice("info", "This is a list of investments (a positions file), not bank activity. Bring it in on the Holdings page instead."),
          ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Go to Holdings")));
        return;
      }
      previewHost.append(ui.notice("error", "That does not look like a bank file: no dates or amounts were found. A bank file has one line per transaction. Download it again from your bank (Activity > Download > CSV), or paste the whole file with its first line."));
      return;
    }
    const acctName = nameOf(accountId);
    if (wasName && was === accountId) previewHost.append(ui.h("p", { class: "small", style: { margin: "0 0 8px" } }, `Last time a file laid out like this went to ${wasName}, so it is picked above.`));
    else if (wasName) previewHost.append(ui.notice("warn", `Last time a file laid out like this went to ${wasName}. Check the account above: this one goes to ${acctName}.`));
    if (prep.elsewhere) previewHost.append(ui.notice("warn", `${prep.elsewhere.count} of these ${prep.elsewhere.of} lines are already on ${d.accounts.find((a) => a.id === prep.elsewhere.accountId)?.name ?? "another account"} (same day, amount and description). If this file was imported there by mistake, undo that import below first, or the spending is counted twice.`));
    const sel = (key, allowNone) => ui.select(colOptions(H, allowNone), mapping[key] === null || mapping[key] === undefined ? "" : String(mapping[key]), { onChange: (e) => { mapping = { ...mapping, [key]: idx(e.target.value) }; if (key === "amount" && mapping.amount !== null) { mapping.debit = null; mapping.credit = null; } prepare(); } });
    const orderSel = ui.select([{ value: "MDY", label: "month/day/year (US)" }, { value: "DMY", label: "day/month/year" }], mapping.dateOrder ?? "MDY", { onChange: (e) => { mapping = { ...mapping, dateOrder: e.target.value }; prepare(); } });
    const flip = ui.h("input", { type: "checkbox", checked: prep.flipSign ? true : null, onChange: (e) => { flipSign = e.target.checked; prepare(); } });
    const twoCol = mapping.amount === null || mapping.amount === undefined;
    // Columns were worked out automatically: they sit behind a fold, open only when one is missing
    // (design log 2026-09-16, pass 3).
    const colName = (k) => (mapping[k] === null || mapping[k] === undefined) ? null : ((H ?? [])[mapping[k]] ?? `column ${Number(mapping[k]) + 1}`);
    const missing = !colName("date") || (!colName("amount") && !colName("debit") && !colName("credit"));
    // a choice changed by hand is said in the fold's summary; one that leaves more rows unreadable than the app's own choices
    // opens it, says so there with a way back, and the Import button steps back to outlined (fix round 3, F4)
    const changes = columnChanges(prep), worse = changes.length > 0 && prep.bad.length > prep.auto.bad;
    const COL = { date: "date column", payee: "description column", type: "debit/credit column" };
    const header = (i) => (H ?? [])[i] ?? `column ${Number(i) + 1}`;
    const changeWords = (c) => (c.key === "dateOrder" ? `dates ${c.to === "DMY" ? "day/month/year" : "month/day/year"}`
      : c.key === "flip" ? (c.to ? "amounts turned around" : "amounts as in the file")
      : c.key === "amount" ? (typeof c.to === "number" ? `amounts from ${header(c.to)}` : "money out and in columns")
      : `${COL[c.key]}: ${c.to === null ? "none" : header(c.to)}`);
    const colsFold = fold("cols", missing ? "Some columns could not be found: pick them" : changes.length ? "Columns: changed by you" : "Columns worked out for you. Change them",
      missing || !changes.length ? null : changes.length === 1 ? changeWords(changes[0]) : `${changes.length} changes`, [
      ui.h("div", { class: "form" },
        ui.h("p", { class: "muted small", style: { margin: "0 0 8px" } }, `${fileName}: ${prep.parsed.rows.length} rows${prep.parsed.skipped ? ` (${prep.parsed.skipped} line${prep.parsed.skipped === 1 ? "" : "s"} above the header skipped)` : ""}${prep.parsed.headerless ? " (no header row in this file; columns are numbered)" : ""}. Columns found: ${H.join(", ")}.`),
        ui.field("Date column", sel("date", false)),
        ui.field("Date order", orderSel),
        ui.field("Description column", sel("payee", true)),
        ui.field("Amount column (one signed column)", sel("amount", true), "leave (none) if the file has separate money-out and money-in columns"),
        twoCol ? ui.field("Money out column", sel("debit", true)) : null,
        twoCol ? ui.field("Money in column", sel("credit", true)) : null,
        ui.field("Debit/credit type column", sel("type", true), "only if the amounts are all positive and another column says which way"),
        ui.field("Amounts look backwards", flip, prep.flipAuto ? "checked for you: this is a card file that lists charges as positive numbers" : "check this box if spending shows as positive in the preview below"),
      ),
      worse ? ui.h("div", { style: { marginTop: "10px" } }, ui.notice("warn", `With ${changes.length === 1 ? "this change" : "these changes"}, ${prep.bad.length} row${prep.bad.length === 1 ? "" : "s"} could not be read; the app's own choices read ${prep.auto.bad ? `all but ${prep.auto.bad}` : "every row"}.`),
        ui.row(ui.button("Put back what the app worked out", () => { mapping = null; flipSign = null; prepare(); }, { class: "secondary" }))) : null]);
    if (missing || worse) colsFold.open = true;
    previewHost.append(colsFold);
    const ok = prep.add.length, dup = prep.skip.length, bad = prep.bad.length, needCat = prep.add.filter((t) => !t.category).length;
    const importBtn = ok ? ui.row(ui.button(`Import ${ok} transaction${ok === 1 ? "" : "s"}`, () => {
      const importId = ui.uid();
      const acct = accountId, m = mapping, key = prep.headerKey, name = fileName, when = new Date().toISOString(), flipUsed = prep.flipSign;
      let added = 0;
      store.update((p) => {
        p.transactions = p.transactions ?? [];
        const fresh = prepareImport(p, text, { accountId: acct, mapping: m, flipSign: flipUsed, importId });
        for (const t of fresh.add) { t.id = ui.uid(); t.key = txKey(t); p.transactions.push(t); }
        added = fresh.add.length;
        p.imports = p.imports ?? [];
        p.imports.push(importRecord(fresh, { id: importId, at: when, accountId: acct, fileName: name }));
        p.importProfiles = p.importProfiles ?? {};
        p.importProfiles[key] = { accountId: acct, mapping: m, flipSign: flipUsed };
        for (const r of p.rules ?? []) r.hits = (r.hits ?? 0) + (fresh.ruleHits[r.id] ?? 0);
      });
      // said on the page it lands on (stress test T4)
      sayOnCategorize(`Added ${added} transaction${added === 1 ? "" : "s"} from ${name === "pasted text" ? "the pasted text" : name}.${needCat ? " Now give them a category." : ""}`);
      ctx.go("transactions", "categorize");
    }, worse ? { class: "secondary" } : {})) : null;
    // where the file starts and stops: a month it cuts is only partly in your spending and budget pages
    // with days missing before the file (the warning below says which), only the month it stops in is still said here (2026-11-02)
    const startCut = prep.fileFrom && prep.fileFrom.slice(8, 10) > "04" && !prep.gap ? monthLabel(prep.fileFrom) : null;
    const endCut = prep.fileTo && prep.fileTo.slice(8, 10) < "28" ? monthLabel(prep.fileTo) : null;
    const cut = [startCut, endCut].filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);
    // nothing new but it spans days the account's files missed: one plain message below, never "only partly in it" (re-check 4)
    const fillsOnly = !ok && !bad && !!prep.fileFrom && (prep.fills ?? []).length > 0;
    const covers = prep.fileFrom && !fillsOnly ? ui.h("p", { class: "small", style: { margin: "10px 0 0" } }, `This file covers ${fmt.date(prep.fileFrom)} to ${fmt.date(prep.fileTo)}.${cut.length ? ` ${cut.join(" and ")} ${cut.length > 1 ? "are" : "is"} only partly in it; the spending and budget pages say so.` : ""}`) : null;
    // a file in another currency (its Currency column): the amounts come in as they are, not converted, so say it before
    // importing. Its import record keeps the currency, and our guesses use no U.S. figures for the plan then (core/estimate
    // applies; guesses spec 4.8)
    if (prep.currency && prep.currency !== (cur || "USD")) previewHost.append(ui.h("div", { style: { marginTop: "10px" } }, ui.notice("warn", `This file is in ${prep.currency}, and your plan counts in ${cur || "USD"}. The amounts come in as they are, not converted.`)));
    // days between this account's last lines and this file: said before importing, with the usual payments that fall in them
    if (prep.gap) previewHost.append(ui.h("div", { style: { marginTop: "10px" } }, ui.notice("warn", prep.gap.text)));
    // the Import button (it carries the count) before the tiles and the sample rows, so it is on the first screen
    // even at 320 px, where the tiles stack one per row (stress test T1 and its attack, 2026-11-11)
    if (importBtn) { importBtn.style.marginTop = "12px"; previewHost.append(importBtn); }
    const csvTiles = ui.row(
      ui.stat("Will be added", String(ok), prep.dateFrom ? `${fmt.date(prep.dateFrom)} to ${fmt.date(prep.dateTo)}` : "nothing new"),
      ui.stat("Already on file", String(dup), "skipped as duplicates"),
      ui.stat("Filed by your rules", String(ok - needCat), `${needCat} will need a category`),
      bad ? ui.stat("Could not read", String(bad), prep.bad.slice(0, 3).map((b) => `row ${b.row}: ${b.why}`).join(", ")) : null,
    );
    // simple first (2026-11-13): the counts, the days, the totals and the first rows wait one tap away; rows that could not be
    // read are said in the fold's summary line, and open it
    const csvLines = [csvTiles, covers, ...(ok ? [
      ui.h("p", { class: "small", style: { margin: "10px 0 4px" } }, `Money in ${fmt.money(prep.inTotal, cur)}, money out ${fmt.money(prep.outTotal, cur)}. Check the first rows read right:`),
      ui.h("ul", { class: "page-list" }, prep.add.slice(0, 6).map((t) => ui.h("li", {},
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, t.payee), ui.h("div", { class: "d" }, `${fmt.date(t.date)} · bank wrote: ${t.rawPayee}`)),
        ui.h("span", { class: "st", style: { fontWeight: "600", color: t.amount > 0 ? "var(--ok)" : "inherit" } }, (t.amount > 0 ? "+" : "-") + fmt.money(Math.abs(t.amount), cur, undefined, 2)))))] : [])].filter(Boolean);
    const csvFold = linesFold([`${ok} new`, dup ? `${dup} already on file` : "", bad ? `${bad} could not be read` : ""].filter(Boolean).join(" · "), csvLines);
    if (bad) csvFold.open = true;
    // nothing new, but the file spans days the account's files were missing: nothing happened then, so record the file and
    // those days count as checked (a gap with no lines in it could never be closed otherwise, 2026-11-02)
    if (!ok && !bad && prep.fileFrom && (prep.fills ?? []).length) {
      const f = prep.fills, span = (s) => (s.from === s.to ? shortDate(s.from) : `${shortDate(s.from)} to ${shortDate(s.to)}`);
      previewHost.append(ui.notice("info", `Everything in this file is already on file. It covers ${span({ from: prep.fileFrom, to: prep.fileTo })}, so it shows nothing happened on ${f.map(span).join(" and ")}, the ${f.length === 1 && f[0].days === 1 ? "day" : "days"} your ${acctName} files were missing.`),
        ui.row(ui.button(`Count ${f.map(span).join(" and ")} as checked`, () => {
          const acct = accountId, name = fileName, when = new Date().toISOString(), record = importRecord(prep, { id: ui.uid(), at: when, accountId: acct, fileName: name, checkedOnly: true }), key = prep.headerKey, m = mapping, flipUsed = prep.flipSign;
          store.update((p) => {
            p.imports = p.imports ?? [];
            p.imports.push(record);
            p.importProfiles = p.importProfiles ?? {};
            p.importProfiles[key] = { accountId: acct, mapping: m, flipSign: flipUsed };
          });
          pending = ["ok", `${acctName}: ${f.map(span).join(" and ")} counted as checked. Undo it under Past imports.`];
        })));
    }
    else if (!ok && !bad && dup) previewHost.append(ui.notice("info", "Everything in this file is already on file. Nothing to do."));
    previewHost.append(csvFold);
  };
  // ---- a bank's Quicken / QuickBooks file (OFX, QFX, QBO): nothing to set up; the account it goes to is said, or asked
  function prepareOfxPreview() {
    const given = chosen ?? (asked || null);
    try { prep = prepareOfx(plan, text, { accountId: given, which, importId: "preview", today, force }); }
    catch (e) { previewHost.append(ui.notice("error", `Could not read the file: ${e.message}`)); return; }
    if (!prep.ok) {
      previewHost.append(prep.investment
        ? ui.notice("info", "This file is for an investment account. This page brings in bank and card lines only. For what you hold, bring in a positions CSV on the Holdings page.")
        : ui.notice("error", "That file has no bank or card lines in it. Download it again from your bank (Activity > Download), for checking, savings or a card."));
      if (prep.investment) previewHost.append(ui.row(ui.h("a", { class: "btn secondary", href: "#/investments/holdings" }, "Go to Holdings")));
      return;
    }
    which = prep.which;
    if (prep.accountId) accountId = prep.accountId;
    const fa = prep.fileAccounts[prep.which];
    const acctName = nameOf(prep.accountId ?? given);
    const rows = prep.parsed.rows, days = rows.map((r) => r.date).sort();
    const many = (n) => `${n} transaction${n === 1 ? "" : "s"}`;
    const covers = fa.to && days.length && fa.to > days[days.length - 1] ? ui.h("p", { class: "small", style: { margin: "10px 0 0" } }, `The file covers ${fmt.date(prep.fileFrom ?? days[0])} to ${fmt.date(fa.to > today ? today : fa.to)}, a few quiet days included.`) : null;
    previewHost.append(ui.h("p", { class: "small", style: { margin: "0 0 8px" } }, `${fa.label}${prep.org ? ` (${prep.org})` : ""}: ${many(fa.count)}${days.length ? `, ${fmt.date(days[0])} to ${fmt.date(days[days.length - 1])}` : ""}. Nothing to set up; the account number is not kept.`));
    // a download cut short, lines that could not be read, a file with nothing in it: said before anything else
    if (!prep.complete) previewHost.append(ui.notice("warn", "This file looks cut short: it stops before its end. Download it again from your bank to get every line."));
    if (prep.bad.length) previewHost.append(ui.notice("warn", `${prep.bad.length} line${prep.bad.length === 1 ? "" : "s"} in this file could not be read (${prep.bad.slice(0, 3).map((x) => `line ${x.row}: ${x.why}`).join(", ")}${prep.bad.length > 3 ? ", ..." : ""}) and ${prep.bad.length === 1 ? "is" : "are"} left out. Check ${prep.bad.length === 1 ? "it" : "them"} against your bank's site.`));
    // nothing in it at all (no lines, no balance, no days it says it covers): one plain line, no tiles of 0
    if (!rows.length && !prep.bad.length && !fa.hasBalance && !(fa.from && fa.to)) { previewHost.append(ui.notice("error", "This file has no lines the app can read. Download it again, or try the CSV.")); return; }
    if (prep.fileAccounts.length > 1) {
      const fileSel = ui.select(prep.fileAccounts.map((x) => ({ value: String(x.i), label: x.label })), String(prep.which), { "aria-label": "Which account in the file", onChange: (e) => { which = Number(e.target.value); chosen = null; force = false; creditIs = null; prepare(); } });
      previewHost.append(ui.h("div", { class: "form" }, ui.field(`This file holds ${prep.fileAccounts.length} accounts. Bring in`, fileSel, "One at a time: choose the file again for the next one.")));
    }
    // ---- which of the plan's accounts: said with its reason, or asked. Only accounts this kind of file may go to are offered.
    const kindA = OFX_A[fa.kind] ?? "an account", kindWord = kindA.replace(/^an? /, "");
    const options = prep.guess.options.map((id) => d.accounts.find((a) => a.id === id)).filter(Boolean);
    const addKey = { card: "credit", savings: "savings", "credit line": "debt" }[fa.kind] ?? "checking";
    const pick = (id) => { chosen = id; force = false; creditIs = null; prepare(); };
    const chips = (label) => ui.h("div", { class: "chips", role: "group", "aria-label": label, style: { marginBottom: "4px" } },
      options.map((a) => ui.h("button", { type: "button", class: `chip${a.id === prep.accountId ? " on" : ""}`, "aria-pressed": a.id === prep.accountId ? "true" : "false", onClick: () => pick(a.id) }, a.name)),
      ui.h("a", { class: "chip", href: `#/balance/net-worth?add=${addKey}&from=import` }, "It is not on my plan yet"));
    const sample = () => (rows.length ? [ui.h("p", { class: "small", style: { margin: "0 0 4px" } }, "The first lines in the file:"),
      ui.h("ul", { class: "page-list" }, rows.slice(0, 4).map((r) => ui.h("li", {},
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, r.payee || "(no description)"), ui.h("div", { class: "d" }, fmt.date(r.date))),
        ui.h("span", { class: "st", style: { fontWeight: "600", color: r.amount > 0 ? "var(--ok)" : "inherit" } }, (r.amount > 0 ? "+" : "-") + fmt.money(Math.abs(r.amount), cur, undefined, 2)))))] : []);
    if (!prep.accountId) {
      const ob = prep.guess.otherBank;
      if (prep.mismatch) {
        const mine = d.accounts.find((a) => a.id === prep.mismatch.accountId);
        previewHost.append(ui.notice("warn", `This file is from ${kindA}${fa.last4 ? ` (ending ${fa.last4})` : ""}. ${mine?.name ?? "The account picked"} is not ${kindA}.${options.length ? " Pick the account it belongs to." : ""}`));
      }
      if (!options.length) {
        previewHost.append(ui.h("p", { class: "im-ask" }, `You have no ${kindWord} on your plan yet.`),
          ui.h("p", { class: "small", style: { margin: "0 0 8px" } }, "Add it, then choose the file again. Nothing has been brought in."),
          ui.row(ui.h("a", { class: "btn", href: `#/balance/net-worth?add=${addKey}&from=import` }, fa.kind === "card" ? "Add this card" : "Add this account")));
      } else {
        if (ob && !prep.mismatch) previewHost.append(ui.notice("warn", `This file is from ${ob.org}; ${ob.name} ${ob.at ? `is at ${ob.at}` : "does not say so"}. Is it this account?`));
        const q = `Which of your accounts is ${fa.label}?`;
        previewHost.append(ui.h("p", { class: "im-ask" }, q), chips(q), ui.h("p", { class: "muted small", style: { margin: "0 0 4px" } }, "Nothing is brought in until you pick one."));
      }
      if (prep.mismatch) {
        const mine = nameOf(prep.mismatch.accountId);
        // (named for what it holds: the landing above already has a "More options")
        // (worded as the person's choice, not the page's verdict: final review F5)
        previewHost.append(fold("anyway", `It is my ${mine} file after all`, null, [ui.h("p", { class: "small", style: { margin: "0 0 8px" } }, `Sure these lines belong on ${mine}? Its balance is left alone.`),
          ui.row(ui.button(`Bring it in to ${mine} anyway`, () => { chosen = prep.mismatch.accountId; force = true; prepare(); }, { class: "secondary" }))]));
      }
      if (rows.length) previewHost.append(linesFold(many(rows.length), sample()));
      return;
    }
    const why = prep.guess.accountId === prep.accountId ? prep.guess.why : null;
    const reason = prep.forced ? "" : chosen ? "" : asked === prep.accountId ? ", the account you opened this page for" : why === "holds" ? ", where its earlier lines already are"
      : why === "kind" ? (prep.guess.lump ? ", the only card line on your plan" : `, your only ${kindWord}`) : why === "name" ? `, your ${kindWord} at ${prep.org}` : "";
    previewHost.append(ui.h("p", { class: "im-ask" }, `This goes to ${acctName}${reason}.`));
    if (prep.forced) previewHost.append(ui.notice("warn", `This file says it is ${kindA}, and ${acctName} is not. You chose to bring it in anyway; the balance of ${acctName} is left alone.`));
    else if (prep.otherKind) previewHost.append(ui.notice("warn", `This file says it is ${kindA}; ${acctName} is another kind of account. Check it is the right one. Its balance is left alone.`));
    if (options.length > 1 || prep.forced || (options.length === 1 && options[0].id !== prep.accountId)) previewHost.append(fold("acct", "Not this account? Change it", null, chips("Change the account")));
    else previewHost.append(ui.h("p", { class: "small", style: { margin: "0 0 6px" } }, ui.h("a", { href: `#/balance/net-worth?add=${addKey}&from=import` }, `Not ${acctName}? Add the account it belongs to ›`)));
    if (prep.elsewhere) previewHost.append(ui.notice("warn", `${prep.elsewhere.count} of these ${prep.elsewhere.of} lines are already on ${nameOf(prep.elsewhere.accountId)} (same day, amount and description). If this file was imported there by mistake, undo that import below first, or the spending is counted twice.`));
    if (prep.currency && prep.currency !== (cur || "USD")) previewHost.append(ui.h("div", { style: { marginTop: "10px" } }, ui.notice("warn", `This file is in ${prep.currency}, and your plan counts in ${cur || "USD"}. The amounts come in as they are, not converted.`)));
    if (prep.gap) previewHost.append(ui.h("div", { style: { marginTop: "10px" } }, ui.notice("warn", prep.gap.text)));
    const ok = prep.add.length, dup = prep.skip.length, needCat = prep.add.filter((t) => !t.category).length;
    const offer = prep.balance;
    const owed = (x) => (offer?.debt ? `${fmt.money(x, cur, undefined, 2)} owed` : fmt.money(x, cur, undefined, 2));
    const offerWords = offer ? `set the balance of ${acctName} to ${owed(offer.amount)}, the bank's figure on ${fmt.date(offer.date)} (on file: ${owed(offer.was)}).` : "";
    const lumpWords = offer?.lump ? ` ${acctName} may stand for more than this one card: do this only if it is your only card.` : "";
    // the figure to save for the answer to "what you owe, or a credit?": a card in credit is saved as nothing owed
    const answered = (o) => (o?.ask ? (creditIs === "owe" ? o : creditIs === "credit" ? { ...o, amount: 0 } : null) : o);
    const creditAsk = () => {
      const q = `The file says ${fmt.money(offer.amount, cur, undefined, 2)} for ${acctName}. Is that what you owe, or a credit (the card owes you)?`;
      return [ui.h("p", { class: "small", style: { margin: "10px 0 6px" } }, q),
        ui.h("div", { class: "chips", role: "group", "aria-label": q, style: { marginBottom: "4px" } },
          [["owe", `I owe ${fmt.money(offer.amount, cur, undefined, 2)}`], ["credit", "It is a credit"]].map(([v, label]) => ui.h("button", { type: "button", class: `chip${creditIs === v ? " on" : ""}`, "aria-pressed": creditIs === v ? "true" : "false", onClick: () => { creditIs = creditIs === v ? null : v; prepare(); } }, label))),
        ui.h("p", { class: "muted small", style: { margin: "0 0 4px" } }, creditIs === "owe" ? `The balance of ${acctName} will be set to ${owed(offer.amount)} (on file: ${owed(offer.was)}).` : creditIs === "credit" ? `The balance of ${acctName} will be set to ${owed(0)}: the plan does not count a credit on a card (on file: ${owed(offer.was)}).` : `Left as it is unless you say (on file: ${owed(offer.was)}).`)];
    };
    // with lines to add, the balance comes along on the same tap when its box is ticked: ticked for you only when the
    // account is sure (its lines are already there, or the bank's name picks it), above the button it changes
    const balBox = offer && ok && !offer.ask ? ui.h("input", { type: "checkbox", checked: offer.tick ? true : null }) : null;   // named by the label around it
    const shown = safeFileName(fileName, prep.fileAccounts.map((x) => x.last4));
    const others = prep.fileAccounts.filter((x) => x.i !== prep.which).map((x) => x.label);
    if (ok) {
      if (offer?.ask) previewHost.append(...creditAsk());
      else if (balBox) previewHost.append(ui.h("label", { class: "im-bal" }, balBox, ui.h("span", { class: "small" }, `Also ${offerWords}${lumpWords}`)));
      const importBtn = ui.row(ui.button(`Import ${many(ok)}`, () => {
        const importId = ui.uid();
        const acct = prep.accountId, w = prep.which, name = fileName, when = new Date().toISOString(), forced = prep.forced;
        const withBalance = offer?.ask ? creditIs !== null : !!balBox?.checked;
        let added = 0, balanced = null;
        store.update((p) => {
          p.transactions = p.transactions ?? [];
          const now = prepareOfx(p, text, { accountId: acct, which: w, importId, today, force: forced });
          for (const t of now.add) { t.id = ui.uid(); t.key = txKey(t); p.transactions.push(t); }
          added = now.add.length;
          const use = withBalance ? answered(now.balance) : null;
          const undo = use ? setBalanceFromFile(p, use) : null;
          if (undo) balanced = use;
          p.imports = p.imports ?? [];
          p.imports.push(importRecord(now, { id: importId, at: when, accountId: acct, fileName: name, balance: undo }));
          for (const r of p.rules ?? []) r.hits = (r.hits ?? 0) + (now.ruleHits[r.id] ?? 0);
        });
        sayOnCategorize(`Added ${many(added)} from ${name === "pasted text" ? "the pasted text" : shown} to ${acctName}.${balanced ? ` The balance of ${acctName} is now ${owed(balanced.amount)} as of ${fmt.date(balanced.date)}.` : ""}${others.length ? ` The file also holds ${others.join(" and ")}: choose it again on Import to bring that in.` : ""}${needCat ? " Now give them a category." : ""}`);
        ctx.go("transactions", "categorize");
      }));
      importBtn.style.marginTop = "8px";
      previewHost.append(importBtn);
    } else {
      // nothing new: the days it spans that the account's files missed can count as checked (as for a CSV), and the bank's
      // balance, when newer than the plan's, is the other thing to do here; the first of the two is the filled button
      const f = prep.fills ?? [], spanOf = (x) => (x.from === x.to ? shortDate(x.from) : `${shortDate(x.from)} to ${shortDate(x.to)}`);
      const canFill = f.length && prep.fileFrom && !prep.bad.length && prep.complete;
      if (canFill) {
        previewHost.append(ui.notice("info", `${dup ? "Everything in this file is already on file" : "This file has no lines in it"}. It covers ${spanOf({ from: prep.fileFrom, to: prep.fileTo })}, so it shows nothing happened on ${f.map(spanOf).join(" and ")}, the ${f.length === 1 && f[0].days === 1 ? "day" : "days"} your ${acctName} files were missing.`),
          ui.row(ui.button(`Count ${f.map(spanOf).join(" and ")} as checked`, () => {
            const record = importRecord(prep, { id: ui.uid(), at: new Date().toISOString(), accountId: prep.accountId, fileName, checkedOnly: true });
            store.update((p) => { p.imports = p.imports ?? []; p.imports.push(record); });
            pending = ["ok", `${acctName}: ${f.map(spanOf).join(" and ")} counted as checked. Undo it under Past imports.`];
          })));
      } else if (dup) previewHost.append(ui.notice("info", `Everything in this file is already on file.${offer ? "" : " Nothing to do."}`));
      else if (!prep.bad.length) previewHost.append(ui.notice("info", `This file has no new lines for ${acctName}.${offer ? "" : " Nothing to do."}`));
      const setNow = (use) => { store.update((p) => { setBalanceFromFile(p, use); }); pending = ["ok", `The balance of ${acctName} is now ${owed(use.amount)} as of ${fmt.date(use.date)}.`]; };
      if (offer?.ask) previewHost.append(...creditAsk(), creditIs ? ui.row(ui.button(`Update the balance to ${owed(answered(offer).amount)}`, () => setNow(answered(offer)), canFill ? { class: "secondary" } : {})) : null);
      else if (offer) previewHost.append(ui.h("p", { class: "small", style: { margin: "10px 0 4px" } }, `You can ${offerWords}${lumpWords}`), ui.row(ui.button(`Update the balance to ${owed(offer.amount)}`, () => setNow(offer), canFill || !offer.tick ? { class: "secondary" } : {})));
    }
    const tiles = ui.row(
      ui.stat("Will be added", String(ok), prep.dateFrom ? `${fmt.date(prep.dateFrom)} to ${fmt.date(prep.dateTo)}` : "nothing new"),
      ui.stat("Already on file", String(dup), "skipped as duplicates"),
      ui.stat("Filed by your rules", String(ok - needCat), `${needCat} will need a category`),
      prep.bad.length ? ui.stat("Could not read", String(prep.bad.length), prep.bad.slice(0, 3).map((x) => `line ${x.row}: ${x.why}`).join(", ")) : null,
    );
    // simple first (2026-11-13): the counts, the totals and the first rows wait one tap away (lines that could not be read are
    // said above, in a notice, and in the fold's summary line)
    previewHost.append(linesFold([`${ok} new`, dup ? `${dup} already on file` : "", prep.bad.length ? `${prep.bad.length} could not be read` : ""].filter(Boolean).join(" · "), [tiles, covers, ...(ok ? [
      ui.h("p", { class: "small", style: { margin: "10px 0 4px" } }, `Money in ${fmt.money(prep.inTotal, cur)}, money out ${fmt.money(prep.outTotal, cur)}. Check the first rows read right:`),
      ui.h("ul", { class: "page-list" }, prep.add.slice(0, 6).map((t) => ui.h("li", {},
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, t.payee), ui.h("div", { class: "d" }, `${fmt.date(t.date)} · bank wrote: ${t.rawPayee}`)),
        ui.h("span", { class: "st", style: { fontWeight: "600", color: t.amount > 0 ? "var(--ok)" : "inherit" } }, (t.amount > 0 ? "+" : "-") + fmt.money(Math.abs(t.amount), cur, undefined, 2)))))] : [])].filter(Boolean)));
  }

  prepare();
  root.append(previewCard);

  // ---- history
  if (d.imports.length) {
    const acctName = (id) => d.accounts.find((a) => a.id === id)?.name ?? "account";
    const moneyOf = (id, x) => { const debt = ["credit", "loan", "mortgage", "student_loan", "other_liability"].includes(d.accounts.find((a) => a.id === id)?.type); return `${fmt.money(x, cur, undefined, 2)}${debt ? " owed" : ""}`; };
    // simple first (2026-11-13): the list waits one tap away; Undo is inside it
    root.append(fold("past", "Past imports", `${d.imports.length} file${d.imports.length === 1 ? "" : "s"}`, [
      ui.h("ul", { class: "page-list" }, d.imports.slice(0, 20).map((im) => ui.h("li", {},
        // days marked "nothing happened" on the Monthly review (ledger markQuiet): no file, no lines, only the days (2026-11-02)
        isQuietImport(im) && im.from && im.to
          ? ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, `Nothing happened ${im.from === im.to ? `on ${shortDate(im.from)}` : `${shortDate(im.from)} to ${shortDate(im.to)}`}`), ui.h("div", { class: "d" }, `${fmt.date(String(im.at).slice(0, 10))} · ${acctName(im.accountId)} · marked by you`))
          : ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, im.fileName || "file"), ui.h("div", { class: "d" }, `${fmt.date(String(im.at).slice(0, 10))} · ${acctName(im.accountId)} · ${im.added} added, ${im.skipped} skipped${im.bad ? `, ${im.bad} unreadable` : ""}${im.balance ? ", balance set" : ""}`)),
        ui.h("span", { class: "st" }, ui.button("Undo", () => {
          // an import that also set the account's balance puts the old one back, while the account still holds what it set
          const back = canUndoBalance(plan, im);
          const backWords = back ? `${acctName(im.accountId)}'s balance back to ${moneyOf(im.accountId, back.was)}${back.wasAsOf ? ` (${fmt.date(back.wasAsOf)})` : ""}` : "";
          const kept = im.balance && !back ? ` The balance of ${acctName(im.accountId)} has changed since, so it stays as it is.` : "";
          if (!ui.confirm(im.added ? `Remove the ${im.added} transaction${im.added === 1 ? "" : "s"} from ${im.fileName || "this import"}${back ? ` and put ${backWords}` : ""}?${kept}` : `Forget that ${im.from && im.to ? `${shortDate(im.from)} to ${shortDate(im.to)}` : "these days"} ${im.from === im.to ? "was" : "were"} checked?`)) return;
          pending = ["ok", im.added ? `Removed the ${im.added} transaction${im.added === 1 ? "" : "s"} from ${im.fileName || "that import"}.${back ? ` ${acctName(im.accountId)}'s balance is back to ${moneyOf(im.accountId, back.was)}.` : kept}` : "Those days are no longer counted as checked."];
          store.update((p) => { undoBalance(p, im); p.transactions = (p.transactions ?? []).filter((t) => t.importId !== im.id); p.imports = (p.imports ?? []).filter((x) => x.id !== im.id); });
        }, { class: "secondary small" })))))], { cls: "card fold fold-card", h2: true }));
  }
}
