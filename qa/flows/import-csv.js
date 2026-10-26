// qa/flows/import-csv.js -- end to end: paste the fixture CSV on the Import page, import it,
// land on Categorise. Run after seed-sample.js (it needs an account):
//   node tools/drive.mjs transactions/import --script qa/flows/seed-sample.js --script qa/flows/import-csv.js --shot import
const csv = await (await fetch("/qa/fixtures/chase-checking.csv")).text();
qa.type("#content textarea", csv);
qa.clickText("Use the pasted text");
await qa.sleep(400);
const preview = qa.pageText();
const btn = qa.$$("#content button").find((b) => /^Import \d+ transaction/.test(b.textContent.trim()));
if (!btn) throw new Error("no Import button; preview says: " + preview.slice(0, 400));
const label = btn.textContent.trim();
btn.click();
await qa.sleep(1000);
return { label, previewHead: preview.slice(0, 700), landedOn: qa.pageTitle(), categorise: qa.pageText().slice(0, 500), status: qa.status().text };
