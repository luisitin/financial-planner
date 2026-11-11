# Touch and input stress test: the hand-over (claude-b, 2026-11-11)

Not part of the app. This folder lives only on the branch `wip/ux-findings`; never merge it into
`claude/creative-build-b531q0` or `main`. Copy it out of your checkout and work from the copy.

## What this is

The owner asked on 2026-11-11: "Be extensive and use tons of agents to stress test every single touch and
input for usability, ease, smoothness, choreography, user experience, easy to understand and navigate.
Focusing on easy to know next step, to go back, to navigate and to focus correctly while understanding.
Quality over quantity."

26 testers walked the app at phone size (12 journeys, 14 page groups). An independent skeptic then tried to
reproduce every finding on screen. 278 findings are confirmed; 48 were dropped (false alarms from the
tooling, things no person would notice, and choices the owner already made in docs/DESIGN_LOG.md). claude-b
read every confirmed finding and sorted it into one of 27 causes:

| cause | findings | severity 4 or 5 | what it is |
|---|---|---|---|
| `SH-BACK` | 19 | 14 | Back, Forward and Reload return to the same spot with the same sections open; on-screen back links behave like Back |
| `SH-DRAFT` | 21 | 15 | What was typed but not saved is not lost: on leaving and coming back, on a reload, on a save elsewhere on the same page; Back with a form open |
| `SH-REDRAW` | 12 | 3 | After a save the page is rebuilt: open sections shut, the screen jumps, the confirmation is off screen, notices that leave move the page |
| `SH-TAP` | 12 | 6 | A second tap lands on whatever the redraw or the new page put under the thumb; no sign of life on slow pages |
| `SH-SEARCH` | 11 | 7 | The menu's Find a page box: letters come out backwards, Enter does nothing, short words rank badly; All pages forgets its search |
| `SH-MENU` | 7 | 0 | The menu drawer and focus: Back and Escape do not close it, focus runs behind it, hidden menu stops, page behind scrolls, reduce motion, nothing announced on a page change or a save |
| `SH-TOPBAR` | 2 | 0 | Page titles are cut off in the top bar by the status pill |
| `SH-ADDR` | 1 | 0 | An address that names no page, or a page that is switched off, silently shows the Dashboard |
| `SH-WAYBACK` | 3 | 0 | Pages opened from a list (Needs attention, Next best action, Quick answers, an answer's missing numbers) have no way back on screen |
| `UI-ERR` | 21 | 5 | A rejected Save or Add: the reason is off screen or is the browser's own bubble; wrong or impossible values are saved without a word; buttons that do nothing |
| `UI-ENTER` | 4 | 0 | Enter in a box saves a half-filled form |
| `UI-EDIT` | 5 | 1 | Tapping a row opens its form far away; Save or Cancel does not return to the row; focus is left nowhere; a stray tap on another row swaps the form |
| `UI-UNDO` | 9 | 2 | One tap removes or overwrites with no question and no way back |
| `UI-LIVE` | 3 | 0 | Boxes that redraw the page the moment they change swallow the next tap and drop the focus |
| `UI-RESULT` | 6 | 2 | After Compare, Work it out or Save the answer is above or below the screen |
| `UI-TARGET` | 7 | 0 | The only way on is a 16 to 36 px link inside a sentence; buttons that do not say where they go |
| `FL-SETUP` | 19 | 6 | Get started (the seven questions and the reveal) |
| `FL-HOME` | 17 | 1 | Dashboard, Your plan, the step-by-step guides, Get started's first screen, Quick answers: one next step, one count, names that match |
| `FL-CHECKIN` | 14 | 2 | Monthly check-in, Needs attention, Next best action, Our guesses for you, Plan health score |
| `PG-EMPTY` | 13 | 3 | First-open dead ends: the one button leads to a page that does not show what it promised; $0 answers with nothing to tap; lists with no way to change a row |
| `PG-BALCASH` | 11 | 1 | Balance, cash flow, goals and household pages (page-specific) |
| `PG-DEBT` | 6 | 1 | Debt and property pages (page-specific) |
| `PG-RETIRE` | 23 | 3 | Retirement and what-if pages (page-specific) |
| `PG-TAXINV` | 10 | 1 | Tax and investment pages (page-specific) |
| `PG-TXN` | 12 | 6 | Transactions and helper pages (page-specific) |
| `A-LANE` | 9 | 1 | claude-a's pages (hand over, do not edit) |
| `PHONE` | 1 | 0 | Needs a real phone |

- `themes/<cause>.md`: every finding of that cause in full: steps, what was seen, what should happen, the
  cause with file and line, a proposed fix. Line numbers are as of commit 1dd3773.
- `index.tsv`: all findings, one line each (id, severity, lens, scope, owner, title, pages).
- `kit.mjs`: the browser kit every tester used (see below).
- Paths that start with `$SP` or `$SESSION` point at scripts and pictures on claude-b's machine. You cannot
  open them; reproduce from the steps.

Severity: 5 = a person loses data or is told something false; 4 = a person is blocked, misled or loses
their place; 3 = slowed or confused; 2 = rough.

## The waves

- **Wave 1 (claude-b, in progress): the `SH-*` and `UI-*` causes**, fixed once in the shared shell and form
  kit: `core/app.js`, `core/router.js`, `core/search.js`, `index.html`, `core/ui/dom.js`, `core/ui/base.css`,
  `modules/overview/guide/frame.js`. Nobody else edits those files until it lands. It will provide: Back,
  Forward and Reload returning to the same spot with typing kept; a save that keeps open sections, typing
  elsewhere on the page and the place; a guard against second taps; errors said at the box; an Undo notice;
  an edit form that opens at its row; a helper that brings a fresh answer into view.
- **Wave 2 (other sessions, now): the `FL-*` and `PG-*` causes**, page by page. If a finding in your file is
  really one of the shared causes, do not build a page-level workaround that wave 1 makes redundant: leave it
  and say so. Pages adopt the new kit helpers in a later pass.
- `A-LANE` findings are on claude-a's pages: nobody but claude-a edits those.

## The kit

```
import { serve, households, open, census, state, act, tapText, tapAt, fillBox, back, kb, shot, go, settle,
         PHONE, SMALL_PHONE, LANDSCAPE } from "/abs/path/to/your/copy/kit.mjs";
const srv = await serve(process.cwd(), 9311);              // your checkout, your port (refuses a port in use)
const H = await households(process.cwd());                 // empty, blank, family, sam, jordan, patLee, ruth,
                                                           // samMidSetup ..., freelancer, retiredCouple, demo, renterDebt
const s = await open({ base: srv.base, plan: H.family(), route: "cashflow/income" });   // phone, touch, sandbox
const r = await act(s.page, () => tapText(s.page, "Save", { scope: "#content" }), "save");   // before/after record
console.log(r.moved, await state(s.page));
await shot(s.page, "/abs/path/x.png");                     // then Read the PNG
await s.close(); await srv.stop();
```

Always the sandbox (`?sandbox=1`; `open` does it). Only Chromium is installed; the owner's phone is Safari,
so say what must be checked on the real phone.

### Traps the first round fell into (each one produced a false finding or hid a real one)

1. `tapText` scrolls the control into view before it taps, so a "jump" in `act()` can be the tool. For any
   claim about the screen moving, scroll with real swipes (`page.mouse.wheel`, or touch drags) and tap at
   coordinates (`page.touchscreen.tap(x, y)`).
2. `tapText`'s default scope includes the closed menu: a menu link with the same words can match. Pass
   `{ scope: "#content" }`.
3. `act()` swallows a tap that threw (`r.threw`): check it, or you will report on a tap that never happened.
4. `act()` can read the scroll position in the middle of a smooth scroll: read `state()` again after `settle()`.
5. A tap on the sticky top bar makes Playwright scroll the page by itself.
6. `fillBox` and `fill()` put the whole value in at once and hide per-key bugs (the menu search that types
   backwards was found only by typing key by key: `page.keyboard.type(text, { delay: 80 })`).
7. `kb()` only shrinks the window. A real phone scrolls the focused box above its keyboard.
8. `census` counts a chosen chip (`.chip.on`) as a filled button.
9. The fixture households can be in states nobody reaches by using the app (every balance dated today; a
   finished plan with no setup answers). Two findings were only that. Prefer driving the app's own questions,
   or the `...MidSetup` households, when a finding is about what a new person sees.
10. The sandbox pill ("Sandbox") is much narrower than the real one ("Saved on this phone"): anything about
    the top bar's width needs the real words.
11. Double taps: test gaps of 120 to 700 ms, not zero.
12. Back: scroll like a finger, wait like a person, try each page more than once. "Back keeps the place" was
    first reported as working; it fails in about half the tries.
