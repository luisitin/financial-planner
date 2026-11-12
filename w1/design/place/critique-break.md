# Critique (breaker): wave 1, track "place"

Method. A private copy of the prototype (`crit-break/app`, a byte copy of `proto/` without `.git`), served on
127.0.0.1:9321; `proto/` itself was not touched. Scripts in `crit-break/s/` (lib.mjs is the architect's lib pointed at
9321: real touch drags, taps at screen coordinates, keys one at a time, `?sandbox=1`); output and pictures in
`crit-break/out/`. "today" = the same copy with `?place=off`. Paths below are relative to `$SP/w1/place/`.

---------------------------------------------------------------------------------------------------------------------

## Blocking

### K1. Typing is poured into another person's form and saved there (R2's "0 false matches" does not hold)
- Evidence. `identity()` (place.js 155-159) is the boxes' keys + drawn values + button words; it holds neither the
  form's title nor its place. Two forms of the same shape with the same (often empty) saved values are one identity, and
  `refill()` (255-261) fills every form that matches. `s/dupe-forms.mjs` over 159 pages: cashflow/paycheck ("Ana: W-4
  and deductions" / "Bo: ...", family and patLee) and career/salary ("Raises and promotions" x2, family and patLee).
  `s/paycheck-cross2.mjs` (family, Paycheck; 120 typed in Ana's "Health, dental and vision insurance", menu > Dashboard >
  menu > Paycheck):
  ```
  1 typed in Ana's       Ana health=120, Bo health=""            plan {}
  2 back by the menu     Ana 120 "Not saved yet." | Bo 120 "Not saved yet." (Bo's fold opened by refill)
  3 after Save in Ana's  Bo still 120 "Not saved yet."           plan {p-ana:120}
  4 after Save in Bo's                                         plan {p-ana:120, p-bo:120}
  ```
  The same after a reload (`s/paycheck-cross.mjs reload fix`). Today nothing comes back; here a figure the person never
  typed for Bo is offered as "Not saved yet." and saved with one tap. Picture: `crit-break/out/paycheck-cross-after-ana-save.png`.
- Change. A form's identity must include where it is: its title (`formTitle`) and its section key (`sectOf`), plus
  its index among same-identity forms. When more than one form on the page matches a record, fill none (unsure, as the
  locator already does) and say so. Add to the census and to the touch check: "typing in form X never appears in form Y"
  (index ground truth cannot see this: both forms are "found").

### K2. After a save, the shell anchors a button the page has folded away: the screen goes blank, then jumps ~1,000 px by itself
- Evidence. `after()` (place.js 320) takes the first locator that is found, with no check that it is drawn. When the
  page closes the section that holds the tapped button (its own choice, kept by design), the button is still found
  ("exact") inside the closed `<details>`; Chromium reports a layout box for it far below, the hold borrows height to
  reach it (383) and stands there until the 8 s cap (392). `s/phantom.mjs` (Will the money last? on a plan half way
  through Get started: the page opens "Retirement settings" itself; type 4,000; Save settings):
  ```
  samMidSetup fix: button top 654, y 695 -> 2129, fold shut, summary at -289; anchor {save settings, exact, now 2088}
    next 8 s: y2129 minH2918px x5 ... then y1174 (jump of 955 px, no touch)
  ruthMidSetup fix: y 695 -> 2761 ... then y1806 (955 px)
  samMidSetup off: y 695 -> 695 (the page above the fold, with the bottom note)
  ```
  Picture `crit-break/out/phantom-samMidSetup-fix.png`: the whole screen is empty except the "saved" note, for about
  six seconds. This is step 4 of the new person's path (guide step "Will the money last?"). On Safari the closed
  section's content may report a zero box instead; then `want()` steps the screen up by the old top on every mutation:
  wrong either way, so this must be checked on the phone.
- Change. A locator target counts only when drawn (`getClientRects().length` and not inside a closed `<details>` other
  than its summary); otherwise use the summary of the closed section that holds it, then the next chain entry. On the
  same-page redraw never borrow height beyond the page's own height once render has resolved.

### K3. Back to a page that got shorter while away: borrowed blank space for ~7.5 s, then the screen jumps by itself (or under the finger)
- Evidence. `s/shorter-back.mjs` (family, Expenses swiped to 1,075, menu > Dashboard, 10 expenses removed there as a
  stand-in for removing rows on another page, Back):
  ```
  fix:  0..7.1 s  y1075 doc1921 minH1864px blank368   7.6 s  y828 doc1672 minH-  (jumps 247 px by itself)
  off:  0..8.6 s  y828  doc1672 minH-      blank121
  ```
  Picture `crit-break/out/shorter-back-fix-1s.png`: the page ends mid-screen over empty grey. The hold only "settles"
  without borrowed height (392), so it runs to the cap; `stop()` (386) drops min-height at the first touchstart, so a
  person who reaches for the screen in those seconds gets the 247 px jump under the finger. Breaks B11 and R4/R5's
  promise; today clamps at once. The common journey is "fix an item on its page, come Back to the list": the list is
  shorter.
- Change. Borrow height only while the page is still drawing (render not resolved) and for a short grace after the last
  growth (about 1 s); then accept the clamp at once. Never release borrowed height inside a touchstart.

### K4. The bottom note's "‹ Back to the ... check-in" adds a step again (j-monthly-return/x-backlink-history comes back)
- Evidence. `echo()` builds a new `<a href>` from the frame's link (app.js 324 and 369); its click only removes the note,
  so the frame's `ctx.back` never runs. `s/echo-way.mjs` (family with month-old balances; check-in at 285 > step
  "Update the balances" > type > Save all balances > the note's way back > the phone's Back):
  ```
  echo: way "‹ Back to the November 2026 check-in"
  after the note's way back: #/overview/monthly-review?month=2026-11, y 0, history +1
  then the phone's Back: #/balance/update?from=review&review=2026-11   (into the step again)
  ```
  This is the design's own iPhone check 7 failing. D-BACK cannot catch it (Back does return to where the tap was made).
- Change. The note's way must act through the original control: `e.preventDefault(); way.click()` for links as for
  buttons (the frame link's handler then goes Back), or call `ctx.back` with the link's href and `loose`. Add a touch
  rule: an on-screen way back (frame or note) does not grow `history.length`.

### K5. Typing is still let go without a word in the journeys B5 says it closes
- (a) A tap that only redraws is taken as a save of the whole page. `saved()` (place.js 183-199) treats any store
  change within 4 s of a button tap as that button's save, and `scopeOf()` (201) widens to the first ancestor holding
  any box: for the check-in's month chip that is the page root. `s/checkin-note.mjs` (the x-typed-lost step "type a
  note, tap the November chip and back"):
  ```
  typed on October 2026 {"v":"Car repair 800, plan for it","card":"Done with October 2026?"}
  back on October 2026  {"v":""}   typing kept: {}
  ```
  (the chips call `store.update(() => {})` to redraw; so does annual-review, and A1 proposes the same for every list page)
- (b) One unrelated figure changing lets go of every box in the form. `s/one-changed.mjs` (Update my balances: three
  balances typed, leave, the house's value is saved elsewhere, Back):
  ```
  typed  380,000 | 91,000 | 43,000 | 32000 | 18,000
  Back   395,000 | 86,000 | 42,000 | 31,000 | 18,000 | hint false | note null | kept []
  ```
  B6 says the typing goes only when "I saved the same row elsewhere"; the code (`tell()` 230-233, identity of all boxes)
  lets go on any box. This is x-typed-lost's own case (balances looked up in bank apps).
- Change. Treat as saved only when the plan really changed (compare the plan without its `meta` stamp before and after
  the update) and only inside the tapped button's own form or card, never wider than one card. Keep typing per box: let a
  box go only when its own drawn value changed, keep the rest. Whenever typing is let go, say so once ("What you typed in
  … was not put back: its figures changed on another page.").

### K6. An API key typed in Settings is written to sessionStorage (AGENTS rule 10)
- Evidence. `SECRET = /token|password|passcode|secret/i` tests only the `name` (place.js 16-17). Settings' "API key
  (for another service)" box is `name="apiKey"`, type text. `s/secret.mjs`: `{"found":true,"type":"text","keys":["planner.typing.sandbox"],"stored":true}`.
  Because `identity()` also embeds the drawn value of every non-secret box, a saved key in that form becomes part of a
  record key as soon as any other box of the form is typed in. Rule 10: "Do not add another place to store a token."
- Change. Never keep anything under `#/system/*` (or mark Settings' connection and AI sections `data-no-keep`), match
  `key|token|password|passcode|secret|pin` on name, aria-label and label text, and leave secret-like boxes out of
  `identity()`. Node test with the Settings field list.

---------------------------------------------------------------------------------------------------------------------

## Should fix

- S1. Typing is keyed by the full hash, so it is stranded behind presentation keys. `s/key-split.mjs`: typed on
  `#/balance/update?from=review&review=2026-11`, then menu > Update my balances (`#/balance/update`): saved figures shown,
  no hint, no note; kept keys `["#/balance/update?from=review&review=2026-11"]`. The check-in, the path (`guide`, `step`)
  and quick answers (`from`) open most form pages with such keys, while B5 promises "the menu again". Key by group/id/rest
  plus only the query keys that change what is drawn (month, year); form identity already keeps months apart.
- S2. Typing outside a form never expires: `rec.loose` entries carry no time (place.js 177) and the 24 h filter (151) only
  prunes forms; the in-memory record is filtered only at load, so a tab suspended for days still refills. Stamp loose
  entries and check the age at refill time (R3, B14).
- S3. A1 tells list pages to close an edit form with `store.update(() => {})`. That touches the plan, schedules a send to
  the PC (store.js 292-305) on every Back that closes a form, and with K5(a) counts as a save. Offer `ctx.redraw()` (the
  shell's keepScroll redraw without a plan write) and use it in A1.
- S4. When the tapped Save goes away with its edit form, the fallback is the card's heading, brought just under the top
  bar: family Expenses, edit Groceries, Save: anchor `A|H2|expenses`, moved -593 px (`s/parked-timer.mjs` log). On a
  long list the row just saved is then off screen. Put the edited row (the form's subject) in the chain before the card
  heading (the page knows it; wave 2 can mark it `data-subject`).
- S5. `modules/ai/explain/view.js:80` calls `history.replaceState(null, ...)`, wiping n/l/p: the next arrival on that
  entry is read as a new visit (lands at the top). Say in CONVENTIONS that pages spread `history.state`; have `sync()` treat
  a numberless entry reached by popstate as "back/forward to unknown" rather than "new".
- S6. Opening the menu pushes an entry, which drops the Forward entries; closing it leaves a dead `l:1` entry that the
  router steps off. After A > B > Back > menu open and shut, Forward never reaches B again. Small, but B1 promises
  Forward.
- S7. The census's ground truth ("element i before is element i after") cannot see a wrong but well-formed match: K1's
  forms and any same-shape rows that reorder pass as "found". Add a signature check per match (title, row words) and a
  duplicate-identity count per page to `loc-census`.
- S8. To check on the iPhone before trusting B9/B10: rects of content inside a closed `<details>` (K2); `focus({preventScroll})`
  without a tap after the old box was removed (keyboard, cursor); the fixed bottom note while the keyboard is up
  (layout vs visual viewport: the note can sit behind the keyboard); the edge-swipe snapshot vs the drawn page with
  `scrollRestoration = "manual"`; sessionStorage after Safari drops and reloads a tab; the home-screen app has no Back, so
  K4 is its only way back from a step.
- S9. Touch rules: K2 and K3 show a screen with no page content; no rule sees it. Add "after a tap or a Back settles,
  page content covers the screen between the top bar and the bottom edge (no borrowed blank over 150 px)", and K4's
  "an on-screen way back does not grow history". K1 needs "typing in one form never shows in another".

---------------------------------------------------------------------------------------------------------------------

## Tried and held up

- B1 on pages and households the architect did not use, CPU x4 (`s/trip.mjs`): patLee scenarios/sensitivity, swiped to
  1,521, "How it is worked out" opened, "Assumptions", Back: 1,521, link top 578 -> 578, section open (today: same spot
  but the section shut).
- A second navigation while the next page draws (`s/fast-back.mjs`, ruth, Your plan with a section open, tap "Your
  retirement", Back 150 ms later, x4): 632 with the section open; Forward at 0 (B2); Back again 632, open. No page errors.
- No page updates the plan by itself on a new visit (`s/self-update.mjs`, 159 pages, family: 0), so the 5 s tap anchor
  is not replayed onto a newly opened page by the pages themselves (other tabs and PC syncs remain, outside the sandbox).
- Tap cost of the capture-phase locator work (`s/tapcost.mjs`, family, 159 pages, x4): worst 56 ms (ai/glossary, 980
  elements), none over 100 ms. A ledger with a large bank import was not measured.
- Kept page whose 4 s notice timer fires while parked (`s/parked-timer.mjs`): the tapped link came back at 738 -> 738.
- Save-on-change select with typing in another form (`s/people-state.mjs`, p-career-household-system/x-1 a): plan
  unchanged (Bo 62), the cue "We kept what you typed in “Edit Bo”" shown, page "Saved." on screen.
- The note's tappable row covers no control on Update my balances (elementFromPoint under it: page background).
- Get started's own history (`suFrom` via `replaceState(history.state, ...)`) keeps the entry number; only ai/explain
  drops it (S5).
