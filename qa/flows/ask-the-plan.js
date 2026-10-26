// qa/flows/ask-the-plan.js -- Ask the plan: send a question, see if it replies and doesn't crash.
const box = document.querySelector("#content textarea");
if (!box) throw new Error("no question textarea found");
box.focus();
box.value = "What is my net worth?";
box.dispatchEvent(new Event("input", { bubbles: true }));
box.blur();
qa.clickText("Send");
await qa.sleep(35000);
return { text: qa.pageText().slice(0, 1200) };
