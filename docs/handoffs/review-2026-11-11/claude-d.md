# Review of claude-d's lane (transactions, ai, system, reports, career)

Reviewer: claude-r, from outside the lane. Every finding was reproduced at least twice at 390x844 with touch in the
sandbox. A second agent, who had not found it, then tried to refute it. Only what survived is listed. The stress-test
steps are in the hand-over on `origin/wip/ux-findings` (`docs/handoffs/wip-ux/themes/*.md`).

## Round 2 (2d9fb97 on f9b130e): 5 checked, 4 closed, 1 partly (the remaining half is claude-g's)

| id | verdict | what was seen |
|---|---|---|
| N1 | closed | Edited the imported $0.00 line's category and saved. The page said "Saved Apple Verify: $0.00, Fun and hobbies." and no bubble appeared. |
| N2 | closed | "-45.20" saves as money out: "Added Corner cafe: $45.20 out.". A new $0 line is refused, and the message shows in view above the Amount box with the keyboard up, at 390 and at 320. A typed minus beats "Money in", which the compute comment documents and the confirmation says. |
| N3 | **partly** | The Ledger takes `?dir=out` and says "3 lines, 2 of them money going out", with "Show money in and out". `modules/cashflow/spending/view.js:68` still sends no `dir`, so the row still opens 3 lines. That half is cashflow/spending, claude-g's page (handed on). |
| N4 | closed | "Add the account" is on the first screen at 390 and at 320. It opens Net worth with Checking chosen. "Now import the bank file ›" is the one filled button and returns to Import. |
| N5 | closed | After Erase the first screen has one filled button, "Start a new pretend plan", at 390, at 320 and in dark mode. |

No regressions found on Ledger, Import or Settings (blank, family, ruth, retiredCouple and demo, at 320 and in dark mode at 390). No page errors, no red notices, nothing off the edge, and never two filled buttons on screen.
**Nothing open in claude-d's own files.**

## Round 1 (branch tip 1f2e681)

### Closures: 17 checked, 16 closed, 1 partly

| id | verdict | what was seen |
|---|---|---|
| p-transactions-helpers/T3 | closed | "Which way" starts on Money out and the number pad opens. 4.50, 1.2k and $1,200.50 each save as money out, and the tiles add up. The confirmation reads "Added Test shop 4.50: $4.50 out." (A typed minus is a new problem: N2.) |
| p-transactions-helpers/x-search | closed | "kroger" typed at 450 ms a key keeps the focus and every letter. Emptying the box keeps the focus too. |
| j-keyboard-reader/x-ledger-search | closed | "gro", a 600 ms pause, then "cer" gives "grocer", and the focus is kept. |
| p-cashflow-b-goals/F1 | closed | One Back returns to Where the money goes, Income statement and Account detail. The scroll is sometimes lost on a second try; that is SH-BACK (wave 1). |
| p-transactions-helpers/x-halfform | closed | A tap on a row with the new line half typed keeps all three boxes and says "Finish the new transaction first". |
| p-transactions-helpers/T8 | closed | Both boxes open the number pad, and each has an overdrawn tick. The difference was checked by hand: $3,614.46. |
| p-transactions-helpers/T1 | closed | Step 3 and Import are in view after the file is picked, at 390 and 320. An empty paste is said at the box. |
| p-transactions-helpers/T6 | closed | Junk text and a "Name,Value" list each give one red line, with no pickers or tiles. |
| p-transactions-helpers/T5 | closed | The category starts on "Pick a category..." and is required. "Rule added." and "Filed 2 transactions by your rules." are both shown. |
| p-transactions-helpers/T4 | closed | A green line appears after every save, add, remove, link and Undo tested on Ledger, Categories, Import, Transfers and Duplicates. |
| p-transactions-helpers/T7 | closed | An empty "Read it" says so at the box and puts the focus there. |
| p-transactions-helpers/T2 (Import, Ledger) | closed | On an empty plan the only filled button is "Add your checking account or card". |
| p-cashflow-a/CF-1 | **partly** | See N4. |
| p-career-household-system/F6 | closed | A wrong file, a wrong-shaped plan and a list are each refused in one sentence. Restore asks with counts and Undo works. Erase says it was done. |
| p-career-household-system/x-4 | closed | Print opens in the same tab, and the app around the report is hidden. |
| p-career-household-system/F5 | closed | An empty Save on Company stock and on Your business is refused at the form. A price of $0 is refused. |
| a796b90 / a712b5b second pass | closed | Your business saves "Which one", and a rule on a hidden category saves. Import is on the first screen at 320. A positions file goes to Holdings. |
| hand-off `assumptions?show=` | works | The box is in the middle of the screen and outlined. |
| hand-off `ledger/month/..?category=` | works | The month and category are applied, and the list is brought up. (The count disagrees with Spending: N3.) |

### New problems (confirmed by a skeptic)

**N1 (severity 3, regression from 33bda60): an imported $0.00 line cannot be saved any more**
- Steps: family household. Import a bank file that has a 0.00 line; banks send these for card checks such as "APPLE.COM/BILL VERIFY". On the Ledger, tap that row, change Category and tap "Save changes".
- Seen: the browser bubble "Use 0.01 or more." appears, the form stays open and nothing is saved, on both runs. Before 33bda60 the box had no minimum. The import itself writes 0.00 lines (`modules/transactions/import/compute.js:160`).
- Should: an existing line saves with any amount, $0 included.
- Cause: `modules/transactions/ledger/view.js:24`, `min: 0.01` on the amount (moneyBox turns it into setCustomValidity). Use `min: 0`, or drop the minimum when editing.

**N2 (severity 2): a typed minus is refused, although the page's own code accepts it**
- Steps: Ledger, "Add a transaction by hand". Type "Corner cafe" and Amount "-45.20", then tap "Add transaction".
- Seen: "Use 0.01 or more." and nothing is added. `signedAmount` (`ledger/compute.js:14-21`) is written so that a typed minus means money out, but the box refuses the minus before that code runs. The bubble's words also do not tell the person what to do.
- Should: "-45.20" is saved as money out, and Money out is chosen to match. A pasted bank figure and a desktop keyboard both send minus signs.
- Cause: the same line, `ledger/view.js:24`.

**N3 (severity 2): Where the money goes says 2, the Ledger then shows 3**
- Steps: family household with `qa/fixtures/chase-checking.csv` imported. Open cashflow/spending, Sep 2026, and tap "Uncategorized · 2 transactions · $129".
- Seen: the Ledger shows 3 rows: Amazon -$42.17, Kroger -$86.40 and the payroll +$1,950.00.
- Should: the page opened from a spending row shows the same lines the row counted, which is money out only.
- Cause: the Ledger's "none" filter takes every uncategorized line, money in included (`modules/transactions/ledger/compute.js:748`). Spending counts only money out (`modules/cashflow/spending/view.js:68` sends `category=none` and no direction). Either add a direction to the link and the filter, or say "3 lines, 1 of them money in" on the Ledger.

**N4 (severity 3, CF-1 left): from Import, adding the account never leads back to Import**
- Steps: blank plan. On transactions/import, tap "Add the account", add a Checking account with $1,200 and save.
- Seen: Net worth shows only "Checking added." and nothing on the page leads to Import. Net worth already has the way back: `?from=import` gives "Checking added. Now import the bank file ›" (`modules/balance/net-worth/view.js:66-69`). Import does not send it: `modules/transactions/import/view.js:32` links to plain `#/balance/net-worth`. At 320x568 the button sits at 595-639, below the first screen.
- Should: link to `#/balance/net-worth?add=checking&from=import`, as claude-g asked under Messages (22:30). At 320 px, move the card's sentence under the button or shorten it, so the button is on the first screen.

**N5 (severity 2): after Erase, two filled buttons share the first screen**
- Steps: family household, system/settings. Tap "Erase the copy on this device" and accept.
- Seen: after the reload there are two filled buttons on the first screen, at 390 and at 320: "Start a new pretend plan" (or "Start a new plan" with the real wording) in the green notice at top 136, and Plan basics' "Save" at 491.
- Should: one filled button. The way on is the notice's button, so Plan basics' Save can be outlined while the notice shows. Alternatively the notice's button can be outlined.
- Cause: `modules/system/settings/view.js:46-47` (`class: "btn"` in both notices) and the default filled submit of Plan basics.

### Left for wave 1, correctly
The browser's bubble wording, SH-BACK (scroll lost on the second try), x-notice-jump, T9 / UI-EDIT, Undo on Duplicates.

### Still to check on the real iPhone
That the number pad appears on the Ledger and on Check a statement, where the print sheet leaves the person, and the Back swipe after the address is replaced (F1).
