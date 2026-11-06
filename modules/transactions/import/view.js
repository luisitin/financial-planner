// modules/transactions/import/view.js -- DOM only. Pick the account, pick the file (or paste
// the text), check the columns and the preview, import. Past imports can be undone.
import { compute, prepareImport } from "./compute.js";
import { txKey, monthLabel, shortDate, isQuietImport } from "../ledger/compute.js";

let pending = null;   // the confirmation shown on the next render (the shell re-renders after store.update)

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan);
  // opened from the Monthly review's "Bring in the Visa file" (?accountId=a-visa): that account, as if picked by hand, so a
  // file laid out like another account's only warns instead of switching the box (2026-11-02)
  const qa = ctx.route?.query?.accountId ?? "";
  const asked = d.accounts.some((a) => a.id === qa) ? qa : "";
  let accountId = asked || (d.accounts[0]?.id ?? "");
  let picked = !!asked;   // the account box was changed by hand: a saved file layout no longer picks the account
  let text = "", fileName = "", prep = null, mapping = null, flipSign = null;   // null = decide from the file and the account type

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Import a bank file"),
    ui.h("p", { class: "lede" }, "Download transactions from your bank or card as a CSV file (most sites: Activity > Download > CSV, last 90 days), then bring it here. The page works out the columns, skips anything already on file, and applies your rules."),
    ui.h("p", { class: "muted small" }, "Nothing is sent anywhere: the file is read on this device and the transactions are stored with your plan on the PC."),
  ));
  if (pending) { root.append(ui.notice(...pending)); pending = null; }
  if (!d.accounts.length) { root.append(ui.notice("warn", ui.h("span", {}, "Add the account first (the checking account or card the file belongs to): ", ui.h("a", { href: "#/balance/net-worth" }, "Net worth")))); return; }

  // ---- step 1: account + file
  const acctSel = ui.select(d.accounts.map((a) => ({ value: a.id, label: `${a.name}${a.count ? ` (${a.count} on file)` : ""}` })), accountId, { onChange: (e) => { accountId = e.target.value; picked = true; if (text) prepare(); } });
  // App-style picker instead of the browser's file control (design log 2026-09-16, pass 3).
  const file = ui.h("input", { type: "file", accept: ".csv,.txt,.tsv,text/csv,text/plain", "aria-label": "Bank file", style: { display: "none" } });
  const chosen = ui.h("span", { class: "muted small", style: { alignSelf: "center" } }, "No file chosen yet");
  file.addEventListener("change", () => {
    const f = file.files?.[0]; if (!f) return;
    fileName = f.name; chosen.textContent = `${f.name} (${Math.max(1, Math.round(f.size / 1024))} KB)`;
    const reader = new FileReader();
    reader.onload = () => { text = String(reader.result ?? ""); mapping = null; prepare(); };
    reader.readAsText(f);
  });
  const paste = ui.h("textarea", { rows: 4, placeholder: "...or paste the CSV text here (the header line and the rows)", "aria-label": "Pasted CSV" });
  const pasteBtn = ui.button("Use the pasted text", () => { text = paste.value; fileName = "pasted text"; mapping = null; prepare(); }, { class: "secondary" });
  // opened for days an account's files miss (the Monthly review's "Bring in the Chase checking file", ?need=from..to): the
  // days the file must cover, and whether the usual "last 90 days" reaches them (re-check 4, 2026-11-02)
  const need = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(ctx.route?.query?.need ?? "");
  const needNote = (() => {
    if (!need || !asked) return null;
    const [, from, to] = need, md = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`, today = fmt.today();
    const ninety = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)) - 90)).toISOString().slice(0, 10);
    const name = d.accounts.find((a) => a.id === asked)?.name ?? "that account";
    return ui.notice("info", `Bring in a ${name} file that covers ${from === to ? md(from) : `${md(from)} to ${md(to)}`}. On your bank's site pick those dates (or a span around them)${from < ninety ? `: a "last 90 days" file starts on ${md(ninety)}, too late` : ""}.`);
  })();
  root.append(ui.card("1. Which account is the file from?", needNote, ui.h("div", { class: "form" }, ui.field("Account", acctSel))));
  root.append(ui.card("2. The file",
    ui.row(ui.button("Choose the file", () => file.click(), { class: "secondary" }), chosen), file,
    ui.h("div", { class: "form", style: { marginTop: "12px" } }, ui.field("Or paste", paste)), ui.row(pasteBtn)));

  // ---- step 3: mapping + preview
  const previewCard = ui.card("3. Check and import");
  const previewHost = ui.h("div");
  previewCard.append(previewHost);
  const colOptions = (headers, allowNone) => [...(allowNone ? [{ value: "", label: "(none)" }] : []), ...headers.map((h, i) => ({ value: String(i), label: h }))];
  const idx = (v) => (v === "" ? null : Number(v));
  const prepare = () => {
    previewHost.innerHTML = "";
    if (!text.trim()) { previewHost.append(ui.muted("Pick a file or paste text first.")); return; }
    try { prep = prepareImport(plan, text, { accountId, mapping, flipSign, importId: "preview" }); }
    catch (e) { previewHost.append(ui.notice("error", `Could not read the file: ${e.message}`)); return; }
    // a file laid out like one imported before goes to the account it went to then, until the account is picked by hand
    const was = plan.importProfiles?.[prep.headerKey]?.accountId;
    const wasName = d.accounts.find((a) => a.id === was)?.name ?? null;
    if (wasName && !picked && was !== accountId) { accountId = was; acctSel.value = was; mapping = null; return prepare(); }
    mapping = prep.mapping;
    const H = prep.parsed.headers;
    const acctName = d.accounts.find((a) => a.id === accountId)?.name ?? "this account";
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
    previewHost.append(
      ui.h("p", { class: "muted small" }, `${fileName}: ${prep.parsed.rows.length} rows${prep.parsed.skipped ? ` (${prep.parsed.skipped} line${prep.parsed.skipped === 1 ? "" : "s"} above the header skipped)` : ""}${prep.parsed.headerless ? " (no header row in this file; columns are numbered)" : ""}. Columns found: ${H.join(", ")}.`),
      ui.h("details", { class: "fold", open: missing ? true : null },
        ui.h("summary", {}, ui.h("span", { class: "fold-title" }, missing ? "Some columns could not be found: pick them" : "Columns worked out for you. Change them"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("div", { class: "form fold-body" },
        ui.field("Date column", sel("date", false)),
        ui.field("Date order", orderSel),
        ui.field("Description column", sel("payee", true)),
        ui.field("Amount column (one signed column)", sel("amount", true), "leave (none) if the file has separate money-out and money-in columns"),
        twoCol ? ui.field("Money out column", sel("debit", true)) : null,
        twoCol ? ui.field("Money in column", sel("credit", true)) : null,
        ui.field("Debit/credit type column", sel("type", true), "only if the amounts are all positive and another column says which way"),
        ui.field("Amounts look backwards", flip, prep.flipAuto ? "ticked for you: this is a card file that lists charges as positive numbers" : "tick if spending shows as positive in the preview below"),
      )),
    );
    const ok = prep.add.length, dup = prep.skip.length, bad = prep.bad.length, needCat = prep.add.filter((t) => !t.category).length;
    previewHost.append(ui.row(
      ui.stat("Will be added", String(ok), prep.dateFrom ? `${fmt.date(prep.dateFrom)} to ${fmt.date(prep.dateTo)}` : "nothing new"),
      ui.stat("Already on file", String(dup), "skipped as duplicates"),
      ui.stat("Filed by your rules", String(ok - needCat), `${needCat} will need a category`),
      bad ? ui.stat("Could not read", String(bad), prep.bad.slice(0, 3).map((b) => `row ${b.row}: ${b.why}`).join(", ")) : null,
    ));
    // where the file starts and stops: a month it cuts is only partly in your spending and budget pages
    // with days missing before the file (the warning below says which), only the month it stops in is still said here (2026-11-02)
    const startCut = prep.fileFrom && prep.fileFrom.slice(8, 10) > "04" && !prep.gap ? monthLabel(prep.fileFrom) : null;
    const endCut = prep.fileTo && prep.fileTo.slice(8, 10) < "28" ? monthLabel(prep.fileTo) : null;
    const cut = [startCut, endCut].filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);
    // nothing new but it spans days the account's files missed: one plain message below, never "only partly in it" (re-check 4)
    const fillsOnly = !ok && !bad && !!prep.fileFrom && (prep.fills ?? []).length > 0;
    if (prep.fileFrom && !fillsOnly) previewHost.append(ui.h("p", { class: "small", style: { margin: "10px 0 0" } }, `This file covers ${fmt.date(prep.fileFrom)} to ${fmt.date(prep.fileTo)}.${cut.length ? ` ${cut.join(" and ")} ${cut.length > 1 ? "are" : "is"} only partly in it; the spending and budget pages say so.` : ""}`));
    // days between this account's last lines and this file: said before importing, with the usual payments that fall in them
    if (prep.gap) previewHost.append(ui.h("div", { style: { marginTop: "10px" } }, ui.notice("warn", prep.gap.text)));
    if (ok) previewHost.append(
      ui.h("p", { class: "small", style: { margin: "10px 0 4px" } }, `Money in ${fmt.money(prep.inTotal, cur)}, money out ${fmt.money(prep.outTotal, cur)}. Check the first rows read right:`),
      ui.h("ul", { class: "page-list" }, prep.add.slice(0, 6).map((t) => ui.h("li", {},
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, t.payee), ui.h("div", { class: "d" }, `${fmt.date(t.date)} · bank wrote: ${t.rawPayee}`)),
        ui.h("span", { class: "st", style: { fontWeight: "600", color: t.amount > 0 ? "var(--ok)" : "inherit" } }, (t.amount > 0 ? "+" : "-") + fmt.money(Math.abs(t.amount), cur, undefined, 2))))),
      ui.row(ui.button(`Import ${ok} transaction${ok === 1 ? "" : "s"}`, () => {
        const importId = ui.uid();
        const acct = accountId, m = mapping, key = prep.headerKey, name = fileName, when = new Date().toISOString(), flipUsed = prep.flipSign;
        store.update((p) => {
          p.transactions = p.transactions ?? [];
          const fresh = prepareImport(p, text, { accountId: acct, mapping: m, flipSign: flipUsed, importId });
          for (const t of fresh.add) { t.id = ui.uid(); t.key = txKey(t); p.transactions.push(t); }
          p.imports = p.imports ?? [];
          p.imports.push({ id: importId, at: when, accountId: acct, fileName: name, rows: fresh.parsed.rows.length, added: fresh.add.length, skipped: fresh.skip.length, bad: fresh.bad.length, from: fresh.fileFrom, to: fresh.fileTo });
          p.importProfiles = p.importProfiles ?? {};
          p.importProfiles[key] = { accountId: acct, mapping: m, flipSign: flipUsed };
          for (const r of p.rules ?? []) r.hits = (r.hits ?? 0) + (fresh.ruleHits[r.id] ?? 0);
        });
        ctx.go("transactions", "categorize");
      })),
    );
    // nothing new, but the file spans days the account's files were missing: nothing happened then, so record the file and
    // those days count as checked (a gap with no lines in it could never be closed otherwise, 2026-11-02)
    else if (!bad && prep.fileFrom && (prep.fills ?? []).length) {
      const f = prep.fills, span = (s) => (s.from === s.to ? shortDate(s.from) : `${shortDate(s.from)} to ${shortDate(s.to)}`);
      previewHost.append(ui.notice("info", `Everything in this file is already on file. It covers ${span({ from: prep.fileFrom, to: prep.fileTo })}, so it shows nothing happened on ${f.map(span).join(" and ")}, the ${f.length === 1 && f[0].days === 1 ? "day" : "days"} your ${acctName} files were missing.`),
        ui.row(ui.button(`Count ${f.map(span).join(" and ")} as checked`, () => {
          const acct = accountId, name = fileName, when = new Date().toISOString(), rows = prep.parsed.rows.length, skipped = prep.skip.length, from = prep.fileFrom, to = prep.fileTo, key = prep.headerKey, m = mapping, flipUsed = prep.flipSign;
          store.update((p) => {
            p.imports = p.imports ?? [];
            p.imports.push({ id: ui.uid(), at: when, accountId: acct, fileName: name, rows, added: 0, skipped, bad: 0, from, to });
            p.importProfiles = p.importProfiles ?? {};
            p.importProfiles[key] = { accountId: acct, mapping: m, flipSign: flipUsed };
          });
          pending = ["ok", `${acctName}: ${f.map(span).join(" and ")} counted as checked. Undo it under Past imports.`];
        })));
    }
    else if (!bad) previewHost.append(ui.notice("info", "Everything in this file is already on file. Nothing to do."));
  };
  prepare();
  root.append(previewCard);

  // ---- history
  if (d.imports.length) {
    const acctName = (id) => d.accounts.find((a) => a.id === id)?.name ?? "account";
    root.append(ui.card("Past imports",
      ui.h("ul", { class: "page-list" }, d.imports.slice(0, 20).map((im) => ui.h("li", {},
        // days marked "nothing happened" on the Monthly review (ledger markQuiet): no file, no lines, only the days (2026-11-02)
        isQuietImport(im) && im.from && im.to
          ? ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, `Nothing happened ${im.from === im.to ? `on ${shortDate(im.from)}` : `${shortDate(im.from)} to ${shortDate(im.to)}`}`), ui.h("div", { class: "d" }, `${fmt.date(String(im.at).slice(0, 10))} · ${acctName(im.accountId)} · marked by you`))
          : ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, im.fileName || "file"), ui.h("div", { class: "d" }, `${fmt.date(String(im.at).slice(0, 10))} · ${acctName(im.accountId)} · ${im.added} added, ${im.skipped} skipped${im.bad ? `, ${im.bad} unreadable` : ""}`)),
        ui.h("span", { class: "st" }, ui.button("Undo", () => {
          if (!ui.confirm(im.added ? `Remove the ${im.added} transactions from ${im.fileName || "this import"}?` : `Forget that ${im.from && im.to ? `${shortDate(im.from)} to ${shortDate(im.to)}` : "these days"} ${im.from === im.to ? "was" : "were"} checked?`)) return;
          store.update((p) => { p.transactions = (p.transactions ?? []).filter((t) => t.importId !== im.id); p.imports = (p.imports ?? []).filter((x) => x.id !== im.id); });
        }, { class: "secondary small" }))))),
    ));
  }
}
