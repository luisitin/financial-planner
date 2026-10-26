// qa/flows/export-import.js -- Settings: does "Download a copy" produce a real plan file?
qa.clickText("Download a copy");
await qa.sleep(500);
return { text: qa.pageText().slice(0, 400), console: "see top-level console array" };
