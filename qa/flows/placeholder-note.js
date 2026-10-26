// qa/flows/placeholder-note.js -- a "coming soon" placeholder page: does it show phase/purpose
// and save a note?
return { title: qa.pageTitle(), text: qa.pageText().slice(0, 500), smallTargets: qa.smallTargets(44), overflow: qa.overflow() };
