// qa/flows/search-nav.js -- overview/pages: does search find pages by plain, first-person words?
const out = {};

const SEARCH = 'input[aria-label="Search pages"]';
qa.type(SEARCH, "what I owe");
await qa.sleep(300);
out.whatIOwe = { text: qa.pageText().slice(0, 600) };

qa.type(SEARCH, "");
qa.type(SEARCH, "what you owe");
await qa.sleep(300);
out.whatYouOwe = { text: qa.pageText().slice(0, 600) };

qa.type(SEARCH, "");
qa.type(SEARCH, "mortgage");
await qa.sleep(300);
out.mortgage = { text: qa.pageText().slice(0, 400) };

return out;
