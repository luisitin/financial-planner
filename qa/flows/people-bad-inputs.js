// qa/flows/people-bad-inputs.js -- household/people: blank submit, future birth date, silly
// retirement age.
const out = {};

qa.submit();
await qa.sleep(300);
out.blankSubmit = { text: qa.pageText().slice(0, 300) };

qa.fill("Name", "Future Baby");
qa.fill("Who is this", "dependent");
qa.fill("Birth date", "2099-01-01");
qa.submit();
await qa.sleep(400);
out.futureBirthDate = { text: qa.pageText().slice(0, 500) };

qa.fill("Name", "Silly Retirement");
qa.fill("Birth date", "1990-01-01");
qa.fill("Retirement age", "-5");
qa.submit();
await qa.sleep(400);
out.negativeRetirementAge = { text: qa.pageText().slice(0, 700) };

return out;
