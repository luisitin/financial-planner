// qa/flows/edit-delete-networth.js -- run after seed-retired-couple.js. Edit one balance through
// the form, delete one account through its Delete button (confirm auto-accepted), and read the
// stat tiles after each step.
window.confirm = () => true;
const leaf = (text) => [...document.querySelectorAll("#content *")].find((e) => e.children.length === 0 && e.textContent.trim() === text);
const rowButton = (rowText, label) => {
  let n = leaf(rowText); if (!n) throw new Error("no row: " + rowText);
  while (n && !(n.querySelectorAll && [...n.querySelectorAll("button")].some((b) => b.textContent.trim() === label))) n = n.parentElement;
  const b = [...n.querySelectorAll("button")].find((b) => b.textContent.trim() === label); b.click();
};
const tiles = () => qa.pageText().split("\n").slice(0, 12).join(" | ");
const out = { before: tiles() };

rowButton("Joint checking", "Edit");
await qa.sleep(300);
out.editHeading = qa.text("#content h2");
qa.fill("Current balance", "9500");
qa.submit();
await qa.sleep(500);
out.afterEdit = tiles();
out.checkingNow = (qa.plan().accounts.find((a) => a.id === "a-chk") || {}).balance;

rowButton("Brokerage", "Delete");
await qa.sleep(500);
out.afterDelete = tiles();
out.accountCount = qa.plan().accounts.length;
return out;
