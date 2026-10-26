// qa/flows/tax-order.js -- Withdrawal order: tap "Use this order" on the first order that is
// not the plan's and check the plan took it.
//   node tools/drive.mjs retirement/withdrawal-order --profile p6 --script qa/flows/tax-order.js --shot tax-order
const before = (qa.plan() || {}).retirement && (qa.plan() || {}).retirement.withdrawalOrder;
qa.clickText("Use this order");
await qa.waitText("The plan now draws", 4000);
await qa.sleep(700);
const plan = qa.plan() || {};
return { before, after: plan.retirement && plan.retirement.withdrawalOrder, headline: qa.text("h1"), smallTargets: qa.smallTargets(), overflow: qa.overflow() };
