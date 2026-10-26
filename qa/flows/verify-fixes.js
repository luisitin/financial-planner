// qa/flows/verify-fixes.js -- verify F-001 and F-003 fixes on Net worth.
const out = {};

qa.fill("Account name", "Verify Negative");
qa.fill("Current balance", "-500");
qa.submit();
await qa.sleep(500);
out.afterNegative = { text: qa.pageText().slice(0, 500), plan: (qa.plan() || {}).accounts || [] };

qa.fill("Account name", "Verify Checking");
qa.fill("Current balance", "2500");
qa.submit();
await qa.sleep(500);
out.afterPlainChecking = { text: qa.pageText().slice(0, 700) };

return out;
