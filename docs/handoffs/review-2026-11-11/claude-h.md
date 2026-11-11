# Review of claude-h's lane (taxes, investments, insurance, estate)

Reviewer: claude-r, from outside the lane. Every finding was reproduced at least twice at 390x844 with touch in the
sandbox, and a second agent that had not found it tried to refute it on e05d6a4; only what survived is here. The
stress-test steps are in the hand-over on `origin/wip/ux-findings` (`docs/handoffs/wip-ux/themes/*.md`).
"held" = the family household plus VTI and ACME in Brokerage, FXAIX and BND in Ana's 401(k).

## Round 2 (0b95342 on f2884e4): 5 checked, 5 closed; 3 new problems, one of them severity 4

| id | verdict | what was seen |
|---|---|---|
| N1 (a coin with a purchase date cannot be corrected) | closed | Tested 0.05 shares, 0.8 shares, 0, a cost change on its own, and shares and cost together. Each saves or is refused in words, and the lot follows. Tax lots' gains were checked by hand ($3,000 worth, +$0; cost $3,500, +$26,500). A holding with two lots still cannot drop below them. |
| N2 (Fees: two filled buttons) | closed | One filled "Add holdings" on blank, empty, demo, retiredCouple and ruth, at 390, at 320 and in dark mode. |
| N3 (Stocks by age: nothing to tap) | closed | One filled "Add your holdings ›" in the hero, on the first screen at 390 and at 320. The People note links to People. |
| N4 (jargon in the legend) | closed | "a common rule of thumb, 110 minus your age in stocks"; "a retire-in-one-fund (target-date fund)". The rows read "rule of thumb 74% · one-fund 90%". |
| N5 (Brackets: "you are here" with no income) | closed | No marker without income. With income, the right bracket is marked. |

Regressions: 6 pages × 6 households at 390, at 320 and in dark mode. Every dollar figure is identical to the build before 0b95342, apart from the intended changes.

### New problems (confirmed by a skeptic)

**N6 (severity 4): adding shares to a holding counts them at $0 cost, and following the save message leaves two pages $18,000 off**
- Steps: blank plan, investments/crypto. Add 0.5 coins: price 60000, paid 3000, bought 2025-06-01. Tap "Change or remove ›", type 0.8 and Save.
- Seen: the message says "The other 0.3 shares are in no purchase yet: add when you bought them on Tax lots." and says nothing about cost. Tax lots shows "+$18,000 … cost $0". Crypto's hero shows "+$45,000 on $3,000 paid". Then do as the message says: on Tax lots, add the 0.3 at $18,000. Tax lots is now right (+$27,000 in all). Crypto's hero and Holdings still say "+$45,000 on $3,000 paid", and Crypto's own row under the hero lists "$3,000 paid · $18,000 paid", so the same card contradicts itself.
- Should: one cost for a holding. Either a lot added on Tax lots for shares that sit outside every lot raises the holding's "What you paid in all" by the lot's cost, or the save message asks for the cost of the added shares in the same form ("What did the other 0.3 cost?").
- Cause: `modules/investments/tax-lots/view.js:73` adds the lot without changing `costBasis`. `holdings/compute.js:59-66` and `crypto/compute.js:57`, `:68` take the gain from `costBasis` alone. `holdings/view.js:82` is the message. Lots and the holding's cost were already separate before this round, but the new message sends people into that gap.

**N7 (severity 2): Tax lots prints "0.30000000000000004 shares"**
- Steps: as in N6, then open Tax lots.
- Seen: under "If you need cash, sell these first" the row reads "BTC · 0.30000000000000004 shares" and wraps. The card below says "0.3 shares not in a lot". The leftover row also reads "date unknown at $0 a share".
- Cause: `modules/investments/tax-lots/view.js:48` (and `:39`, the at-a-loss list) prints `x.lot.shares` raw. The leftover comes from `compute.js:79`. Use `fmt.num(…, 3)` as `lotLine` does.

**N8 (severity 2, wording): fewer shares keeps the whole cost, which is right for a typo but not for a sale, and nothing says how to tell them apart**
- Steps: held household. On Tax lots, add ACME: 100 shares, $9,000, 2020-01-02. On Holdings, set ACME to 50.
- Seen: the lot becomes 50 shares at $9,000, and the message says so. If half was sold, Tax lots overstates the loss: −$6,500 where −$2,000 is right, and the carry-over is $4,500 too high. The way to record a sale is to lower "What you paid in all" in the same save, which nothing on the form says. Keeping the cost is a fair default (scaling it would be wrong for a typo). This now also applies to a lot typed by hand on Tax lots, not only to the one Crypto makes (README line 25 says the latter).
- Should: when shares go down, the message or help adds "If you sold some, lower What you paid in all too."
- Cause: `modules/investments/holdings/view.js:65`, `:78`, `:82`.

## Round 1 (closures on 1f2e681; new problems re-checked on e05d6a4)

### Closures: 24 checked, 22 closed, 2 partly

| id | verdict | what was seen |
|---|---|---|
| IE-3 | closed | No "saved" for an empty cash value. Compare answers with the heading in view. |
| IE-7 | closed | Health: coverage before "Add a plan", one filled button. Legacy: only Add is filled. |
| x-3 (Gifting) | closed | From defaults to one giver; the "only because from both" line says what to change. Checked by hand against six cases. |
| INV-1 (Holdings side), PG-EMPTY INV-1 | closed | One filled "Add an investment account" -> Net worth `?add=investment`, Brokerage chosen, cursor in the name. |
| x-1 (Holdings, Tax lots) | closed | The second add starts on Brokerage; "+ Add a lot" per fund. |
| INV-9 | **partly** | "Change or remove ›" opens the coin on Holdings and a change saves, unless the coin was added with a purchase date: N1. Employer stock's Change works. |
| x-3 (Tax lots) | closed | A filled "Add the lots for ACME" on the first screen, cursor in "Bought on". |
| INV-8 | **partly** | The first screens explain the terms, except Glide path: N4. |
| W8 | closed | "Your plan's mix (70% stocks, 30% bonds)" on both. |
| IE-6 | closed | 44x44 square; two ticks 700 ms apart both land; rows do not move. |
| INV-6 | closed | "Type my own" puts the cursor in US stocks. |
| PG-EMPTY T3 | closed (one leftover) | No $0 tiles; one filled "Add your income" on each tax page. Brackets keeps its ladder, which is fair reference on that page, but marks "10% you are here" with no income on file: N5. |
| A8 | closed | Pay box and a filled "Show my tax" on the first screen, no tiles. |
| x-4 (Estate tax) | closed | Intro and a filled "Add what you own". |
| IE-2 (page part) | closed | Empty amounts refused; deductible above the out-of-pocket maximum refused in words. |
| INV-2 (page part) | closed | Each Remove asks first and names what goes. |
| p-taxes x-4 | closed | "Remove Index fund from this year's sales?" |
| INV-10 | closed | A future date, "acme!!", a lot above the shares left, a 120% target: each refused at the box in words. |
| INV-7 | closed | "40 / 60 became $9,436,173." in view; the screen does not move. |
| x-redraw-on-change, p-taxes x-3 (Capital gains, Brackets) | closed | Typed, then one coordinate tap on "+$25,000": the chip lights and the answer follows (2 of 2 on both pages). |
| INV-5 | closed | The form opens under the row; Save and Cancel return near it. |
| A1 | closed | "About $9,870 of federal tax for 2026" checked by hand (85,000 - 16,100 = 68,900; 1,240 + 4,560 + 4,070). The fold stays open on Enter. |
| T4 (Estimated part) | closed | "Payments saved." at the foot; the button stays put (a 32 px move on freelancer comes from the hero's new figure re-wrapping, a real content change). |
| review fixes d5e55ef / a15e0f7 | closed | The crypto wallet follows its coin; Tax lots' $5,000 loss splits 3,000 / 2,000; typed pay on Federal says it replaces Income's. |

### New problems (confirmed by a skeptic)

**N1 (severity 3, two fixes of this lane meet): a coin added with its purchase date cannot be corrected**
- Steps: blank plan, investments/crypto: 0.5 coins, price 60000, paid 3000, bought 2025-06-01, Add coin. Tap "Change or remove ›", change Shares to 0.05, Save changes.
- Seen: refused: "0.5 shares of BTC are in lots on Tax lots. Remove or change those lots first, or type at least 0.5." The person never made a lot: Crypto made one from the date. Neither page mentions it. Without a date the same change saves.
- Should: a holding whose only lot is the one Crypto made when it was added has that lot follow the change (shares and cost scaled), or the Holdings form says it also changes that purchase and does it.
- Cause: `modules/investments/crypto/view.js:143` (a whole-coin lot from the date) meets `modules/investments/holdings/view.js:65` (d5e55ef: no fewer shares than the lots hold).

**N2 (severity 2): Fees with no holdings has two filled buttons on the first screen** (there before this lane; INV-1 reached Fees)
- Steps: blank, demo, retiredCouple or ruth; investments/fees.
- Seen: "Add holdings" (y 319) and the open advisory-fee fold's "Save" (y 671), both filled, both on screen.
- Should: one filled button: keep the fold closed while there are no holdings, or make its Save outlined.
- Cause: `modules/investments/fees/view.js:47` opens the fold when not ready.

**N3 (severity 2): Glide path with no holdings says twice to add them, with nothing to tap** (there before this lane)
- Steps: blank (also family and demo, which have no holdings), investments/glide-path.
- Seen: the hero "Add holdings to see where you stand" and a note "Add your holdings to see where you actually stand against the path."; the only control is the fold "Which path to measure against". The People note has no link either.
- Should: one filled "Add your holdings ›", as Allocation and Fees have.
- Cause: `modules/investments/glide-path/compute.js:59` (note as text) and `glide-path/view.js:22` (notes drawn with no button).

**N4 (severity 2, INV-8 left on Glide path): "110 minus age" and "a target-date fund" unexplained on the first screen**
- Steps: held household, investments/glide-path.
- Seen: "Solid: the plan's path. Dashed: 110 minus age. Dotted: a target-date fund." at y 651, and milestone rows "110 minus age 74% · target-date 90%". The hero was reworded ("two common rules for comparison") but these were not.
- Should: plain names, e.g. "Dashed: a common rule of thumb (110 minus your age in stocks). Dotted: what a retire-in-one-fund holds at your age."
- Cause: `modules/investments/glide-path/view.js:26` and `:35`.

**N5 (severity 2): Brackets marks "10% you are here" when no income is on file**
- Steps: blank or empty plan, taxes/brackets.
- Seen: the hero says to add your income, and the ladder below highlights 10% with a "you are here" pill.
- Should: no "you are here" until there is income (`d.hasIncome`).
- Cause: `modules/taxes/brackets/view.js:60` draws the pill without checking `d.hasIncome` (`compute.js:38` sets `current` at $0).

### Left for wave 1, correctly
x-2 (`form.prepend` on crypto and employer-stock), bubble wording, A3, F9, the save echo when a page scrolls to a new row,
the bottom strip that carries "BTC added." over onto Holdings and covers "+ Add a holding".

### Still to check on the real iPhone
That the cursor placed by "Type my own", "Add the lots for", "Change" and "Change or remove" brings up the keyboard.
