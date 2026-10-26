// qa/flows/tax-sale.js -- Capital gains: add one long-term sale through the form and check
// the list, the tax line and the saved plan.
//   node tools/drive.mjs taxes/capital-gains --profile p6 --script qa/flows/tax-sale.js --shot tax-sale
qa.fill("What you sold", "TEST 50 shares of VTI");
qa.fill("Sold for", "15000");
qa.fill("Cost (what you paid)", "9000");
qa.fill("How long you held it", "long");
qa.submit();
await qa.waitText("Sale added.", 4000);
await qa.sleep(700);
const plan = qa.plan() || {};
return {
  after: qa.pageText().slice(0, 500),
  gains: (plan.taxes && plan.taxes.gains || []).map((g) => ({ name: g.name, proceeds: g.proceeds, basis: g.basis, held: g.held })),
  headline: qa.text("h1"),
  smallTargets: qa.smallTargets(),
  overflow: qa.overflow(),
};
