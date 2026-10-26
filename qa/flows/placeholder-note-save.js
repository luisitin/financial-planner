// qa/flows/placeholder-note-save.js -- save a note on a "coming soon" page.
const box = document.querySelector("#content textarea");
if (!box) throw new Error("no notes textarea found");
box.focus();
box.value = "TEST NOTE: please add biweekly payment option";
box.dispatchEvent(new Event("input", { bubbles: true }));
box.blur();
qa.clickText("Save notes");
await qa.sleep(500);
return { afterSave: qa.pageText().slice(0, 300) };
