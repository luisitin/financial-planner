// qa/flows/edit-people-goals.js -- run after seed-retired-couple.js on household/people.
// 1) Edit Sam's birth date so he is 76 (past his retirement age of 70): age, "retired" and the
//    plan horizon must follow. 2) Edit Ruth's plan-to age from 100 to 80: the horizon must drop
//    to Sam's 90-76 = 14. 3) On Goals, link "Grandkids' trip" to Joint savings: funded should
//    become 3,000 + 45,000 and the goal "reached". 4) On Net worth, delete Joint savings; back
//    on Goals the goal must warn about the missing account and fall back to $3,000.
window.confirm = () => true;
const out = {};
const stats = () => qa.pageText().split("\n").slice(0, 9).join(" | ");
const clickRow = (text) => {
  const all = [...document.querySelectorAll("#content li *")].filter((e) => e.textContent.trim().startsWith(text) && e.textContent.trim().length < text.length + 40);
  const el = all.find((e) => ![...e.children].some((c) => c.textContent.trim().startsWith(text)));
  if (!el) throw new Error("no row " + text);
  (el.closest("li, .rec, .record, [role=button], a, button") ?? el).click();
};

clickRow("Sam");
await qa.sleep(300);
out.heading = qa.text("#content h2");
qa.fill("Birth date", "1950-06-20");
qa.submit();
await qa.sleep(400);
out.afterSam = stats() + " || " + (qa.pageText().match(/Sam Partner\n[^\n]+/) || [""])[0];

clickRow("Ruth");
await qa.sleep(300);
qa.fill("Plan to age", "80");
qa.submit();
await qa.sleep(400);
out.afterRuth = stats();

await qa.go("goals/goals");
await qa.sleep(600);
clickRow("Grandkids' trip");
await qa.sleep(300);
qa.fill("Account it is saved in", "a-sav");
qa.submit();
await qa.sleep(400);
out.goalLinked = (qa.pageText().match(/Grandkids' trip[^\n]*\n[^\n]+/) || [""])[0] + " || " + qa.pageText().split("\n").slice(0, 9).join(" | ");

await qa.go("balance/net-worth");
await qa.sleep(600);
const leaf = [...document.querySelectorAll("#content *")].find((e) => e.children.length === 0 && e.textContent.trim() === "Joint savings");
let n = leaf; while (n && ![...n.querySelectorAll("button")].some((b) => b.textContent.trim() === "Delete")) n = n.parentElement;
[...n.querySelectorAll("button")].find((b) => b.textContent.trim() === "Delete").click();
await qa.sleep(400);

await qa.go("goals/goals");
await qa.sleep(600);
out.goalAfterDelete = (qa.pageText().match(/Grandkids' trip[^\n]*\n[^\n]+/) || [""])[0] + " || " + (qa.pageText().match(/points to an account[^\n]*/) || ["NO WARNING"])[0] + " || " + qa.pageText().split("\n").slice(0, 9).join(" | ");
return out;
