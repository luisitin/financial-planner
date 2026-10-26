// qa/flows/categorise-first.js -- on the Categorise page (after import-csv.js): file the first
// payee as groceries through the row's select, then look at Rules, Ledger and Spending.
const sel = qa.$("#content .page-list select");
if (!sel) throw new Error("no category select on the page");
const payee = qa.text("#content .page-list li .t");
qa.type(sel, "groceries");
await qa.sleep(900);
const after = qa.pageText().slice(0, 160);
const rules = ((qa.plan() || {}).rules || []).map((r) => `${r.contains} -> ${r.category} (${r.payee})`);
await qa.go("transactions/ledger", 900);
const ledger = qa.pageText().slice(0, 420);
await qa.go("cashflow/spending", 900);
const spending = qa.pageText().slice(0, 300);
await qa.go("transactions/transfers", 900);
const transfers = qa.pageText().slice(0, 300);
return { payee, after, rules, ledger, spending, transfers, errorsOnPage: qa.$$(".notice.error").map((n) => n.textContent) };
