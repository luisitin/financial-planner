// qa/flows/verify-f004.js -- re-check F-004: does a $1e12 balance still wrap mid-digit?
qa.fill("Account name", "Huge Number Test");
qa.fill("Current balance", "1000000000000");
qa.submit();
await qa.sleep(500);
return { text: qa.pageText().slice(0, 500) };
