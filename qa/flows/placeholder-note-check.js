// qa/flows/placeholder-note-check.js -- run after a reload to confirm the note persisted.
const box = document.querySelector("#content textarea");
return { stillThere: box ? box.value : null, text: qa.pageText().slice(0, 300) };
