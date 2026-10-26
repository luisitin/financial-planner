// qa/flows/tax-figures.js -- Federal estimate: open the folded "Figures the plan cannot see"
// form, type withheld and qualified dividends, save, and check the green line, the refund line
// and the saved plan. Run after seed-sample.js:
//   node tools/drive.mjs taxes/federal --profile p6 --script qa/flows/seed-sample.js --script qa/flows/tax-figures.js --shot tax-figures
const before = qa.pageText().slice(0, 200);
qa.clickText("Figures the plan cannot see", "summary");
await qa.sleep(300);
qa.fill("Qualified dividends", "2500");
qa.fill("Federal tax withheld so far", "15000");
qa.clickText("Save figures");
await qa.waitText("Figures saved.", 4000);
await qa.sleep(700);
const plan = qa.plan() || {};
return {
  before,
  after: qa.pageText().slice(0, 500),
  thisYear: plan.taxes && plan.taxes.thisYear,
  hasRefundLine: /get about .* back|would owe about/.test(qa.pageText()),
  smallTargets: qa.smallTargets(),
  overflow: qa.overflow(),
};
