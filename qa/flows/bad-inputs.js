// qa/flows/bad-inputs.js -- net-worth: blank submit, negative balance, huge number, letters in money.
const out = {};

qa.submit();
await qa.sleep(300);
out.blankSubmit = { text: qa.pageText().slice(0, 300), accountsAfter: ((qa.plan() || {}).accounts || []).length };

qa.fill("Account name", "Negative Test");
qa.fill("Current balance", "-500");
qa.submit();
await qa.sleep(500);
out.negativeBalance = { text: qa.pageText().slice(0, 500), plan: (qa.plan() || {}).accounts || [] };

qa.fill("Account name", "Huge Number Test");
qa.fill("Current balance", "1000000000000");
qa.submit();
await qa.sleep(500);
out.hugeNumber = { text: qa.pageText().slice(0, 700), plan: (qa.plan() || {}).accounts || [] };

qa.fill("Account name", "Letters Test");
qa.fill("Current balance", "abc");
qa.submit();
await qa.sleep(500);
out.lettersInMoney = { text: qa.pageText().slice(0, 900), plan: (qa.plan() || {}).accounts || [] };

return out;
