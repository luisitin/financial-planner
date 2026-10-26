// qa/flows/add-account.js -- example flow for tools/drive.mjs (sandbox by default).
// Adds one account through the form, waits for the page to re-render, and returns what a
// person would now see, plus the saved plan for checking the numbers by hand.
//   node tools/drive.mjs balance/net-worth --script qa/flows/add-account.js --shot add-account
const before = qa.pageText().slice(0, 120);
qa.fill("Account name", "TEST Checking");
qa.fill("Type", "checking");
qa.fill("Current balance", "2500");
qa.submit();
await qa.waitText("TEST Checking", 4000);
await qa.sleep(700);                       // the store saves 400 ms after an update
const plan = qa.plan() || {};
return {
  before,
  after: qa.pageText().slice(0, 400),
  status: qa.status(),
  accounts: (plan.accounts || []).map((a) => ({ name: a.name, type: a.type, balance: a.balance })),
  smallTargets: qa.smallTargets(),
  overflow: qa.overflow(),
};
