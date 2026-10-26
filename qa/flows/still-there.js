// qa/flows/still-there.js -- run AFTER add-account.js in the same command; drive.mjs reloads the
// page between scripts, so this checks the account survived a refresh (same browser profile).
//   node tools/drive.mjs balance/net-worth --script qa/flows/add-account.js --script qa/flows/still-there.js
return { title: qa.pageTitle(), stillThere: qa.pageText().includes("TEST Checking"), accounts: ((qa.plan() || {}).accounts || []).length };
