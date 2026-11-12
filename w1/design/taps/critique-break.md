# Critique (breaker): wave 1, track "taps"

Critic: tried to prove the design fails or makes something worse than today. Prototype copied (not edited) to
`scratchpad/w1/taps-break/proto` and served on 127.0.0.1:9323 (stopped). Scripts `w1/taps-break/c*.mjs`, output in
`w1/taps-break/out/`, pictures in `w1/taps-break/shots/`. Chromium, phone 390 x 844, touch, sandbox, real touches.
Households: family, ruth, patLee, samMidSetup, empty. `?w1off=<part>` is the same build with that part switched off.

## Blocking

### X1. Paint-first turns off the tap guard on the heaviest pages (B3 and B1 fail where they matter most)
- **Problem.** M2 adds `await afterPaint()` to `computeRemote`'s local branch (proto `core/app.js` ~L319). 14 heavy
  pages call `ctx.computeRemote(...).then(draw)` without awaiting it (retirement/monte-carlo:23, scenarios/goal-seek:58,
  overview/health-score:32, insurance/life-needs:113, insurance/ltc:31, estate/inheritance:34, estate/legacy:34, the 5
  reports through report-kit `settleReport`). Before M2 the local compute ran synchronously inside `render`, so it
  ended before `show()`'s `finally { taps.drawn() }`. Now `render` returns, `drawn()` runs, and the long compute starts
  one frame later. A tap made during that freeze has `t > drawnAt`, so it is not *stale*. If it comes more than 700 ms
  after the shell's draw, it is not *new-page* either. It is then delivered after the freeze to whatever the results
  put under the finger, which is the exact case B3 promises to drop.
- **Evidence.** `c2-late.mjs` (Will the money last? > "What would change it ›" > Goal seek, CPU 8x, second tap on
  the same spot 800, 1000 and 1150 ms later), `out/c2-x8.txt`:
  - new: compute long task from about +256 ms for 1,622 ms. Swallowed `[]` in **3 of 3**. The second click was
    delivered at +2,011 to +2,402 ms, after the results were drawn.
  - `?w1off=paint`: `stale(...)` in **3 of 3**.

  It landed on text only because of the layout at that spot. On Plan health score the results put three link rows at
  y 524 to 741 (`c1b-map.mjs`). Owner check 5 cannot catch this: on Chance the money lasts the second tap always falls
  on the hero text (`c1-freeze.mjs`: delivered to `p.lede` at 1x and 4x, gaps 0.9 to 2.2 s).
- **Change.**
  - In `computeRemote` call `taps.drawn()` as soon as the local `safeCompute` returns, before returning the result.
    Also call it when the server's answer arrives. That puts every tap made during the compute before `drawnAt`.
  - Set `aria-busy="true"` on `#content` while a `computeRemote` is pending. Touch rule D-TIME(b) accepts only
    "Working / Calculating / Loading / One moment" or aria-busy. Four of the seven pages' own waiting words ("Trying…",
    "Scoring…", "Running…", "Checking…") do not count, so without aria-busy D-TIME(b) does not turn green as section 6
    claims.
  - Rewrite owner check 5 on a page whose results bring links under the thumb (Plan health score from the menu). Tap
    the empty area several times while it works; nothing may open.

### X2. The guard swallows a deliberate tap on a picker that saves when it changes (B2 fails, and it is worse than today)
- **Problem.** The window is measured from `changedAt = max(drawnAt, last.t)`, and SPAN_MS is 4 s. So a redraw caused
  by something other than the tap still counts as "the screen just changed". Example: the picker's `change` event,
  1.5 s after the tap that opened it. The remembered tap is then that earlier tap. Fields are also signed only as
  `type|name|placeholder` (taps.js `sigAt`). Every unnamed select is `select-one||`, so two different selects in the
  same place are "the same control", and the *repeat* rule fires.
- **Evidence.** `c5-select.mjs` (People > "State you live in": tap, pick a row 1.5 s later, the change saves, tap the
  picker again 300 or 600 ms later to fix it), `out/c5-select.txt`:
  - new: `swallowed ["repeat(select-one||)"]`, focus on BODY, no focusin. The picker would not open: **2 of 2**.
  - `?w1off=taps`: focus SELECT, **2 of 2**.

  The same rule hits transactions/categorize:103. Its "Category for <payee>" selects all sign `select-one||`, and the
  next payee's select slides into the place of the one just categorised. The person working down that list loses
  every quick tap.
- **Change.**
  - Forget the remembered tap on any trusted `change`, `input` or `keydown` that comes after it. Something happened
    between the taps, so the next tap is not a double tap. The double taps of D-TWICE have nothing in between: the blur
    `change` of the first tap fires before its click records it.
  - Never return *repeat* for input, select or textarea.
  - Put `aria-label` and `id` in a field's signature.
  - Add a picker re-tap and a categorize row to `t2-allowed.mjs`.

### X3. The "‹" shows on the first page of a visit and leaves the app after any address replace (B15 fails)
- **Problem.** `stampEntry` gives every entry without a state `previous n + 1` (proto `core/app.js` stampEntry). That
  is right for a push and wrong for a replace. Two pages replace the address:
  - modules/overview/setup/view.js:377: `location.replace('#/overview/setup/<prev>')` in the page's own "‹".
  - modules/ai/explain/view.js:80: `history.replaceState(null, …)`, which also wipes `n` on the entry; a later Back
    into that entry re-stamps it as new.

  Because the place track is to reuse this numbering for "the page of entry n-1", the error spreads.
- **Evidence.** `c6-replace.mjs` (open `#/overview/setup/ages` as the first page, tap the page's own ‹),
  `out/c6-replace.txt`, family and ruth alike:
  - before the tap: `n=1 history.length=2`, top-bar ‹ hidden;
  - after: `n=2 … history.length=2 top-bar ‹ SHOWN "Back to Set up my plan"`;
  - tapping it goes to `about:blank`. In a home-screen app, where there is no page before, the button does nothing.

  Away from the first page the same replace gives a wrong name: "Back to Set up my plan" while Back goes to the page
  before Get started.
- **Change.**
  - Add `router.replace(href)`, which marks the next stamp as a replace (keeps `n` and `from`). The shell's
    `openFromMenu` uses it, and wave 2 adopts it at setup/view.js:377 and ai/explain/view.js:80 (spread
    `history.state`).
  - As a safety net in the numbering rule, treat an unnumbered entry as a replace when `history.length` did not grow and
    the entry it follows was the newest known (`n === highest n seen`).
  - The rule's node test gets the replace cases: replace at the first entry, replace after a Back.

## Should fix

- **S1. Two "‹" one above the other on every Get started question.** `shots/c3-A1-two-backs.png`: the top bar's
  outlined ‹ ("Back to Dashboard") and the page's own blue ‹ 60 px below it. They do not always go to the same place.
  On Question 1 the page's ‹ goes *forward* to Get started (`toStart` = `ctx.go`, a push), while the bar's ‹ goes back.
  On a replace (X3) they differ again. Hide `#nav-back` on pages that draw their own back at the top (overview/setup
  screens with `.su-top`; a list in the shell, or a manifest flag), or let the designer choose one. This is not a design
  log rule, but it is two ways back on the most-walked flow.
- **S2. M8 still shows pages the household's view must not offer.** `c9-addr.mjs` (`out/c9-addr.txt`): `#/system/devices`
  and `#/transactions/connect` (planned) and `#/ai/critic` ("The AI helper reads…", no AI) all render in the
  household's view, old and new alike. Owner decision 2026-11-06: the household's view "never shows … 'soon' pages, or
  PC / AI helper / sync wording". `missing()` is the place for it: a page that is not offered in this view gets the
  same plain "That page is not here" card.
- **S3. A computeRemote yield computes pages that are already gone.** After `await afterPaint()` (proto app.js ~L319)
  nothing checks `renderSeq`. Leave a heavy page within that frame and its 1 to 4 s compute still runs and freezes the
  next page. Return without computing when the page is no longer current.
- **S4. All pages writes the address on every key.** Safari allows 100 `pushState`/`replaceState` calls per 30 s and
  then throws a SecurityError (WebKit History). Typing and correcting a long search on All pages can use that up. The
  `try/catch` then hides three failures for the rest of the window: the word stops riding in the address; the drawer's
  `pushState` fails (`drawerEntry = false`, so Back with the menu open leaves the page again: B8); and `stampEntry`'s
  `replaceState` fails. Write the word on `change` or after 400 ms without typing.
- **S5. Ranking: a page named exactly for the word must beat an alias phrase.** `c8-search.mjs` (`out/c8-search.txt`):
  "budget" lists Expenses before Budget. B6 says "the plain word finds the page named for it first". An exact name
  should score 0 and an exact phrase 0.1. Also, "care" no longer finds Healthcare before 65 or Medicare now that
  in-word hits do not count: add "health care" to `PLAIN`.
- **S6. *stale* trusts `event.timeStamp` to be the moment the finger went down.** If WebKit on iOS stamps the touch
  pointer event when it is dispatched (after the freeze), *stale* never fires on the iPhone. Section 5 handles only the
  date-versus-page-clock case. Make the reworked owner check 5 (X1) the gate for *stale*. Name a fallback if it fails,
  for example a "busy" flag the shell sets around its own draws and `computeRemote`, which any `pointerdown` dispatched
  while it is set reads as stale.
- **S7. Reload with the menu open: two unexplained hangs.** `c7-drawer.mjs` and `c7b-reload.mjs` stayed on "Opening your
  plan…" with the title "Planner" for over 30 s (the menu's rows never came) in 2 of the first 8 reloads with the menu
  open. Afterwards it was 0 of 12 (`out/c7-loop.txt`), and `?w1off=menu` was 0 of 7. The cause is not pinned; it may
  be load on this machine. The only drawer code that runs during boot is the step-off `history.back()` (proto app.js
  ~L673), which may be a cross-document traversal right after a reload. Rerun 20 reloads with the menu open under
  network latency before landing, and consider stepping off after the first draw.
- **S8. Owner checks to add.**
  - Find a page: type "morgage" and press Go (does iOS commit the autocorrection before Enter is read?).
  - Open the menu on a half-scrolled page, tap Find a page (the keyboard comes up), then close: same place? (B9 with
    visualViewport.)
  - Pull to refresh with the menu open.

## What I tried that held up
- **Two removals with "Are you sure?" answered in between** (`c4-confirm.mjs`, Net worth totals, family). The next
  Remove is 65 px from the first tap (the green line pushes it down), so the guard never looks at it. Both removals
  went through, nothing was swallowed, new and old alike.
- **Late second tap on Chance the money lasts and Plan summary** (`c1-freeze.mjs`, 1x and 4x, gaps 0.9 to 2.2 s). It
  always ends on text and nothing opens: harmless here, but see X1.
- **The menu's history entry** (`c7-drawer.mjs`, `c7b-reload.mjs`, patLee and family):
  - a reload with the menu open boots with the menu closed and the entry stepped off (12 of 12 in the loop);
  - Forward onto the menu's old entry steps straight back off;
  - Back after it goes to the Dashboard;
  - the "‹" is hidden while the menu is open and named "Back to Dashboard" after.
- **Get started walked by Continue** (`c3b-setup.mjs`, samMidSetup and empty). The numbers, the `from` and the bar's
  label are right, and the page's own ‹ steps back one question each time.
- **Find a page typed key by key** (`c8-search.mjs`, 15 words). Every word stays in order in the box. Sensible first
  rows for tax, loan, pension, medicare, ss, insurance, pay off, long term care, house. Old shell: every word reversed.
- **Addresses** (`c9-addr.mjs`). `#/cashflow/incom` shows the card with the Cash flow pages (old: the Dashboard).
- **Memory.** Nothing grows without bound except the prototype's `window.__swallowed`. The remembered tap holds 17
  detached elements until the next tap: drop `el` from stored signatures.

Touch sweep rules: with X1 changed, **D-TIME(b)** turns green through aria-busy and **D-TWICE** and **D-ANSWERS** stay
green; with X2, `t2-allowed.mjs` gains the picker case (no rule covers a re-tap today: D-FOCUS-KEPT taps once); with X3,
**D-BACK** should add "replace navigations keep the Back button's name and visibility".
