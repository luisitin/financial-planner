// qa/flows/goals-bad-inputs.js -- goals/goals: blank submit, negative target, target date in the past.
const out = {};

qa.submit();
await qa.sleep(300);
out.blankSubmit = { text: qa.pageText().slice(0, 300) };

qa.fill("What are you saving for", "Negative Goal");
qa.fill("Amount needed", "-1000");
qa.submit();
await qa.sleep(400);
out.negativeTarget = { text: qa.pageText().slice(0, 500) };

qa.fill("What are you saving for", "Past Due Goal");
qa.fill("Amount needed", "5000");
qa.fill("By when", "2020-01-01");
qa.submit();
await qa.sleep(400);
out.pastDate = { text: qa.pageText().slice(0, 700) };

return out;
