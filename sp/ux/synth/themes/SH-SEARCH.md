# SH-SEARCH: The menu's Find a page box: letters come out backwards, Enter does nothing, short words rank badly; All pages forgets its search

11 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## j-hard-conditions/HC-1 (severity 4, input, scope shell, owner shell, confirmed)
**Typing in the menu's Find a page box comes out backwards, so the search finds nothing**

- pages: menu (every page)
- reach: The menu's search box on every page, on every Chromium browser: Chrome on an Android phone, and Chrome or Edge on the PC, where the menu is always open (1280 px wide: typing r-o-t-h gave 'htor'). The other two search boxes are fine (All pages and Glossary: 'roth' stayed 'roth', caret at 4).
- steps: Household family, phone 390x844, Dashboard. Tap the menu button, tap 'Find a page', type s-o-c-i-a-l one key at a time (120 to 150 ms apart). Same at 1280 px with a mouse and keyboard.
- saw: Reproduced three ways in fresh browsers (keyboard.type, one key press at a time, and text inserted the way an on-screen keyboard does): after each key the box held s, os, cos, icos, aicos, laicos, with the caret at 0 every time. The list says: No page matches "laicos". Backspace then deletes nothing (caret is at the start), so the person cannot even correct it. Setting the whole word in one go ('roth' as a paste or an automated fill) works and lists Roth conversions, which is why no earlier automated check saw this.
- should: Typing 'social' shows Social Security as the first result while the same box keeps the focus, the caret and the keyboard. Backspace deletes the last letter typed.
- why: Search is one of the three ways to get anywhere, and for typed input it is dead: the person thinks they mistyped, tries again, and gives up on search. Not a tooling artefact: the letters were sent as plain key presses to whatever had the focus, and the same happened with touch and with a mouse.
- cause: core/app.js buildNav(), lines 71-77: line 73 side.innerHTML = "" throws the search box away on every input event, line 75 builds a new one with value set as an attribute, and line 76 calls .focus() on it. A freshly made box gets the caret at position 0 in Chromium, so each next letter goes in front. Also line 155 (openSearch) and 402 (follow) go through the same rebuild.
- fix: One change in core/app.js fixes it everywhere: make the search box once and keep it. In buildNav: look for side.querySelector('.nav-search'); create and append it only if it is missing (its input listener is just buildNav(search.value), no re-focus); set search.value = filter only when it differs (a page change still clears it); then remove every sibling after the box (while (search.nextSibling) search.nextSibling.remove()) instead of side.innerHTML = "", and build the list below as now. Keeps the search ranking and the menu layout of design log 2026-09-15.
- evidence: $SP/ux/j-hard-conditions/verify/v1-search-typed.png (phone), $SP/ux/j-hard-conditions/verify/v1b-desktop-search.png (PC); scripts v1.mjs, v1b.mjs. Still to check on a real iPhone: Safari is likely to put the caret at the end of a re-made box, so letters may come out in order there, but the box is still thrown away at every letter: check that autocorrect, the suggestion bar, dictation and swipe typing work in Find a page, and that the keyboard does not flicker.

## j-heavy-waiting/x-1 (severity 4, navigate, scope shell, owner shell, confirmed)
**The menu's 'Find a page' box takes letters backwards: typing chance gives 'ecnahc' and 'No page matches'**

- pages: every page (the menu)
- reach: The search box in the menu, on the phone drawer and on the wide-screen sidebar. Other search boxes are fine (All pages 'Search pages', Glossary, Help 'Find a page' all gave 'roth'). Outside the walker's waiting brief, found on the way to the heavy pages; reported because search is how a person reaches one of 150 pages by its words. Every automated walker types with fill(), which sets the whole word at once and hides this.
- steps: H.family(), phone, Dashboard. Tap the menu button, tap 'Find a page', type c h a n c e one letter at a time (node x1-search.mjs; x1b-search.mjs for text sent the way a phone keyboard sends it).
- saw: After each letter the box holds: c, hc, ahc, nahc, cnahc, ecnahc; caret at 0 every time; 'No page matches "ecnahc". Try another word, or browse All pages.' Same with 'roth' -> 'htor', at 80 and 250 ms a letter, with key presses and with inserted text, on the phone and on a 1200 px screen: 5 runs of 5. The same pattern on an empty test page with no app code gives 'ecnahc' when the value is set with setAttribute and 'chance' when set as a property, so it is the browser engine's rule, not the test tool.
- should: Letters appear in the order typed and results narrow as you type.
- why: The person types the word they know, gets nonsense and 'No page matches', and concludes the page does not exist.
- cause: core/app.js buildNav() lines 75 to 76: every keystroke rebuilds the menu with a new <input value=filter> (ui.h uses setAttribute('value'), core/ui/dom.js line 14) and focuses it; a new box focused by script has its caret at 0 in Chromium, so the next letter goes in front.
- fix: core/app.js line 76: after focusing the new box, `const b = side.querySelector('.nav-search'); b.focus(); b.setSelectionRange(b.value.length, b.value.length);` or, better, build the search box once and redraw only the list under it. One line; nothing in docs/DESIGN_LOG.md is touched.
- evidence: $SP/ux/j-heavy-waiting/verify/x1-search-typed-chance.png ; $SP/ux/j-heavy-waiting/verify/x1-search-roth.png ; confirmed in Chromium (Android phones, Chrome and Edge on a computer). On an iPhone: open the menu, type roth in Find a page and read the box (Safari may instead keep only the last letter).

## j-keyboard-reader/K1 (severity 4, input, scope shell, owner shell, confirmed)
**Typing in the menu's Find a page box writes the letters backwards**

- pages: every page (the menu's Find a page box, also when a page opens it through ctx.openSearch)
- reach: every page; phone and desktop
- steps: family household, phone 390x844, touch. Open Dashboard. Tap Menu, tap Find a page, press i n c o m e one key at a time. Same at 1280x800 with a keyboard.
- saw: Reproduced 3 times (touch phone, keyboard phone, desktop 1280). After each key the caret is at 0: i, ni, cni, ocni, mocni, emocni. The menu shows 'No page matches "emocni"'. Text sent the way an on-screen keyboard commits it (insertText) does the same: 'taxes' becomes 'sexat'. A whole word put in at once and then one more letter: 'deb' + t = 'tdeb'. Backspace at the end of 'income' deletes nothing (caret 0). The other search boxes type correctly (All pages 'income', Glossary 'roth', Help 'retire'), so it is only the menu's box.
- should: Typing 'income' shows 'income' and lists Income. The box is never replaced while someone types in it.
- why: Search is the way to reach any of 150 pages by your own words; typed letters come out reversed, so it finds nothing and says 'No page matches'. Confirmed in Chromium (Chrome on Android and on a PC). On an iPhone the result may differ (Safari selects the whole box when a script focuses a new one, so each letter may replace the last and leave only 'e'): check on the phone by typing 'income' in the menu; anything other than 'income' is this bug.
- cause: core/app.js:71-77. buildNav() empties the menu (line 73 side.innerHTML = "") and makes a NEW search input with the text as its value attribute (line 75); the input handler (line 76) calls buildNav(search.value) on every keystroke and then focuses the new box, whose caret starts at 0.
- fix: One change in core/app.js buildNav(): make the search box once and keep that same element in place. Instead of side.innerHTML = "", remove only what follows the box (while (search.nextSibling) search.nextSibling.remove()), set search.value = filter only when it differs, and drop the .focus() call in the handler. The box then never loses focus or its caret, also when show() or the view/live events rebuild the menu. Fixes every page.
- evidence: verify/k1.mjs, verify/k1-touch.png (box reads 'emocni', 'No page matches')

## j-navigator/x-1 (severity 4, input focus, scope shell, owner shell, confirmed)
**Typing in the menu's 'Find a page' box comes out backwards ('net worth' becomes 'htrow ten'), so the search finds nothing**

- pages: menu search on every page (phone drawer and the always-open menu on the PC)
- reach: every page, in Chrome-family browsers (Android phones, Chrome and Edge on the PC); the iPhone must be checked by hand
- steps: H.family(), any page, tap Menu, tap 'Find a page...', type n-e-t-space-w-o-r-t-h on the keyboard one key at a time (do not paste and do not use the tool's fill()).
- saw: The box reads 'htrow ten', the cursor sits at position 0 after every letter, and the menu says 'No page matches “htrow ten”'. Letters inserted the way a phone keyboard does it: 'budget' -> 'tegdub'. Desktop 1280 px: 'car' -> 'rac'. Three Backspaces delete nothing (the cursor is at the start). A word that arrives in one piece (paste, a suggestion) is fine, which is why the walker's fill() and qa/user-view.mjs never saw it. The All pages search box types correctly ('budget', cursor at 6).
- should: The box keeps what is typed, in order, with the cursor where the person left it; results update under it without the box being replaced.
- why: Search is the way to reach 150 pages by your own words. A person types a word, sees gibberish and 'No page matches', and concludes the search is broken.
- cause: core/app.js lines 75-76: every 'input' event calls buildNav(search.value), which wipes the whole menu (line 73) and builds a NEW search box, then focuses it. core/ui/dom.js line 14 sets `value` as an attribute, and a newly focused box whose text is only a default value has its cursor at 0 in Chromium, so the next letter goes in front.
- fix: Keep the one search box alive: build it once and let the input listener redraw only the list under it (in buildNav, reuse the existing .nav-search node and replace its following siblings). That also keeps the phone keyboard, autocorrect and a cursor placed mid-word. Minimum patch if that is too much: after focus(), box.setSelectionRange(box.value.length, box.value.length). Add a typed (key by key) search to qa/user-view.mjs.
- evidence: $SP/ux/j-navigator/verify/n4-typed.png, $SP/ux/j-navigator/verify/x1-budget-typed.png, $SP/ux/j-navigator/verify/x1-desktop-car.png; scripts v4.mjs, x1.mjs. Check on the owner's iPhone: type 'car' in Find a page; does the box read 'car', 'rac' or just 'r', and does the keyboard flicker at each letter?

## j-one-answer/x-1 (severity 4, input, scope shell, owner shell, confirmed)
**The menu's 'Find a page' box types backwards, so asking by search is impossible**

- pages: every page (menu search), overview/quick ('Not here? Search by a word')
- reach: Every page: the menu's search and the search button on Quick answers and All pages.
- steps: H.patLee() -> overview/quick -> scroll to the end -> tap 'Not here? Search by a word' -> type r-e-t-i-r-e, one key every 150 ms. Also H.empty() -> Menu -> type 'retire at 62'.
- saw: The box reads 'eriter' (caret at 0 after every key) and the list says 'No page matches "eriter"'. 'retire at 62' becomes '26 ta eriter'. Same at 10 ms and 150 ms per key. Enter in the box does nothing.
- should: Letters appear in the order typed; 'retire' lists Will the money last? first.
- why: The walker's brief was to try each question by search; it filled the box in one go and never typed. Same defect as HC-1, K1 and OP-1 from other walkers: one fix. Measured in Chromium (the engine of Chrome on Android); the caret may land elsewhere in Safari, but the box is rebuilt under the thumb either way.
- cause: core/app.js:71-77 buildNav(): each 'input' event empties the whole menu and builds a new search box (value set as an attribute, :75), then focuses the new box (:76), which puts the caret at the start.
- fix: Build the search box once and rebuild only the list under it (keeps the caret, the phone keyboard and autocorrect). On an iPhone also check that the keyboard stays up between letters.
- evidence: $SP/ux/j-one-answer/verify/v26-search-typed-retire.png; v6-search-retire-at-62.png (scripts v26.mjs, v6.mjs)

## p-overview-path/OP-1 (severity 4, input, scope shell, owner shell, confirmed)
**The menu's "Find a page" box types backwards (tax becomes xat)**

- pages: every page (the menu's search box), overview/quick: "Not here? Search by a word" opens the same box
- reach: every page; phone and desktop; any Chromium browser (Chrome and Edge on the PC, Chrome on Android)
- steps: Household: empty (or family). Open #/overview/start, tap Menu, tap Find a page, press t, a, x one key at a time. Same from #/overview/quick > Not here? Search by a word (r, o, t, h), and at 1280 px wide with a real keyboard (b-u-d-g-e-t).
- saw: Reproduced 5 times on 4 pages with my own script (v1.mjs, v1b.mjs, x5.mjs), keys 80, 150 and 300 ms apart: after each key the caret is at position 0 (selectionStart 0), so t-a-x reads "xat", r-o-t-h reads "htor", b-u-d-g-e-t reads "tegdub", and the list says No page matches "xat". The input element is a new one after every key. Cause proven in the browser: putting the caret back at the end after each rebuild makes r-o-t-h read "roth" and lists Retirement contributions, Withdrawal order, Roth conversions.
- should: Typing t-a-x shows "tax" and the Taxes pages; the box, the caret and the keyboard stay as they are while the list under it changes.
- why: Search is the only by-the-words way to a page, and Quick answers sends people to it. Whoever types a word sees nonsense and "No page matches". Still to check on an iPhone, which this Chromium cannot show: type t-a-x in Find a page in Safari and see whether the box reads tax, xat or only x, and whether the keyboard stays up between letters (Safari places the caret differently in a freshly made box; the box is still thrown away and rebuilt on every letter there).
- cause: core/app.js:75-76 buildNav(): every input event calls buildNav(search.value), which empties the sidebar and builds a new <input value=...> (the value set as an attribute by ui.h, core/ui/dom.js:14) and focuses it; a never-focused box takes the caret at 0 in Chromium, so each next letter goes in front.
- fix: One change in core/app.js buildNav(): keep the search input (build it once, or leave it in place) and rebuild only the list after it (while (search.nextSibling) search.nextSibling.remove(); then append the results). Minimum patch if that is too much: after the refocus, el.setSelectionRange(el.value.length, el.value.length). The 30-second follow() rebuild at app.js:402 should use the same path. No design-log decision is touched (search ranking and the no-match words of 2026-09-15 stay).
- evidence: $SP/ux/p-overview-path/verify/op1-quick-roth.png (also op1-overview-start.png, op1-desktop.png)

## p-retirement-c-scenarios/x-search-backwards (severity 4, navigate, scope shell, owner shell, confirmed)
**The menu's "Find a page" box writes what you type backwards, so it finds nothing**

- pages: every page (the menu)
- reach: The menu on every page, phone and desktop.
- steps: H.family(), any page. Tap the menu button, tap "Find a page...", type annuity on the keyboard at a normal pace (I used 120, 180 and 250 ms a key).
- saw: The box reads "ytiunna" and the menu says: No page matches "ytiunna". Every word comes out reversed (compare -> erapmoc, what if -> fi tahw, medicare -> eracidem). Same at 1280 px with a mouse. When the same words arrive in one piece (pasted) the search is good: annuity -> Annuities, what if -> Scenario compare, how long -> How long to plan for.
- should: Letters appear in the order typed and the list narrows under the box as you type.
- why: Search is the way a layperson reaches these pages by their own words, and it returns nothing for anything typed. Seen in Chromium (the engine of Chrome and Edge on a PC and on Android). I could not run Safari here: on an iPhone, type three letters in the menu's search box and check that they stay in order, that the keyboard stays up and that the caret stays at the end.
- cause: core/app.js:75-76: every keystroke calls buildNav(search.value), which empties the sidebar and builds a NEW search box from a value attribute, then focuses it. A box built that way is focused with the caret at position 0 (measured: selectionStart 0), so the next letter goes in front.
- fix: Keep the one search box alive and rebuild only the list under it (or, smallest: remember search.selectionStart before buildNav and call setSelectionRange on the new box after focus). One change in the shell.
- evidence: $SP/ux/p-retirement-c-scenarios/verify/x6d-typed-annuity.png (script x6d.mjs; engine check wk.mjs, wk2.mjs)

## j-navigator/N4 (severity 3, input focus, scope shell, owner shell, confirmed)
**In the menu search, Enter (the keyboard's Go key) does nothing**

- pages: menu search on every page
- reach: menu search; the All pages search shows its results on the page itself, so Enter matters less there
- steps: H.family(), Menu, put 'net worth' in 'Find a page...', press Enter.
- saw: Address unchanged (#/overview/dashboard), menu still open, focus still in the box. The box has no enterkeyhint and is not in a form, so the phone shows a plain return key.
- should: Enter opens the first result and closes the menu; the key reads 'Go'. With no result it does nothing (the 'No page matches' line is already there).
- why: People finish a search with the keyboard's key; here it looks dead and they have to notice the list above the keyboard and tap in it.
- cause: core/app.js lines 75-76: the box has only an 'input' listener.
- fix: Same lines: add enterkeyhint: 'go' and a keydown listener: on Enter, take the first visible #sidebar .nav-link and set location.hash to its href. Do it together with x-1 (the box must stop being rebuilt).
- evidence: $SP/ux/j-navigator/verify/n4-typed.png; scripts v2.mjs, v4.mjs

## j-navigator/N5 (severity 3, navigate, scope shell, owner shell, confirmed)
**Short words are found inside other words: 'car' lists Career, card and Medicare pages before the car pages**

- pages: menu search, overview/pages
- reach: narrowed and widened. Narrowed: showing results under their topics, topics ordered by best hit, is the owner's choice (design log 2026-09-15, Menu drawer round 2, finding 1) and stays. Widened: the All pages search has the same fault and shows it worse.
- steps: H.family(), Menu, search 'car'. Then Menu > All pages, search 'car'.
- saw: Menu: 31 pages; the first 7 rows are the Career and income topic (Salary and raises first); Vehicles is 8th at y 524 and the car goal 29th at y 1,760. All pages: '31 pages match “car”', first row Life timeline (its description says Medicare), then Asset register, Debts ('card'), Paycheck ('Medicare'). '401k': 5 pages on one screen, Retirement contributions last. 'will': 'Will the money last?' first, the page about wills in the fourth topic. The other 15 of the walker's 20 words put a right page first.
- should: A whole-word hit comes before a hit at the start of a longer word, and a hit in the middle of a word ('Medicare' for 'car') does not count.
- why: The person types the plainest word for what they want and gets a screen of unrelated pages, so they stop trusting the search.
- cause: core/search.js matchRank lines 123-125: title.includes(q), group.includes(q), purpose.includes(q) are plain substring tests. core/app.js line 112: the tie-break `named` is also a substring test, which puts the topic 'Career and income' first. modules/overview/pages/view.js lines 32-36 keep the fixed topic order and do not rank at all.
- fix: In core/search.js matchRank: rank 0/1/2 only when the query equals a word (or stem) of the title or alias / topic / purpose; a hit only at the start of a longer word ranks after those (so typing 'car' on the way to 'career' still finds it, lower down); no hit inside a word. Use the same test for `named` in core/app.js line 112. One change fixes the menu and All pages; the 2026-09-15 order rule and the topic grouping stay.
- evidence: $SP/ux/j-navigator/verify/n5-car.png, $SP/ux/j-navigator/verify/n5-allpages-car.png; scripts v5.mjs, w1.mjs

## p-career-household-system/x-3 (severity 3, navigate, scope shell, owner shell (core/search.js), confirmed)
**The menu's search cannot find these pages by their own headings or the obvious word**

- pages: household/contacts, household/documents, system/settings, household/calendar
- reach: four pages of this group
- steps: H.family(), open the menu, type in "Find a page...": who to call; phone; lawyer; papers; paperwork; reminder; erase; delete; reset; currency.
- saw: "who to call" (the Contacts page's own heading) -> "No page has every word", closest: Your plan, Beneficiary audit. "phone" -> Settings only. "lawyer" -> nothing. "papers" and "where your papers are" (the Documents page's own heading) -> Estate documents only. "paperwork", "erase", "delete", "reset", "currency", "language" -> nothing. "reminder" -> Needs attention, Voice notes, not Money calendar (which has "Your reminders").
- should: Each page is found by its on-page heading and its everyday words.
- why: Reproduced twice. The walker did not try the search. The menu names here are also not the words on the page (Contacts / "Who to call", Document vault index / "Where your papers are", Equity compensation / "Stock from work").
- cause: core/search.js PLAIN table (line 40 on) has no entry for household/contacts, household/documents, system/settings or household/calendar, and their manifests have no `aliases`; matchRank (:117-126) only sees title, topic, purpose and aliases.
- fix: Add to PLAIN in core/search.js: household/contacts [who to call, phone, phone numbers, lawyer, emergency contact]; household/documents [papers, where your papers are, paperwork, passport, birth certificate]; system/settings [erase, delete, reset, currency, language, download a copy]; household/calendar [reminder, reminders, due dates].
- evidence: $SP/ux/p-career-household-system/verify/x-search-whotocall.png, $SP/ux/p-career-household-system/verify/x-search-phone.png (v10.mjs, v12.mjs)

## p-overview-home/x-2 (severity 3, back, scope page, owner claude-b, confirmed)
**All pages forgets the search when you come Back, and the page named for the word is not the first result**

- pages: overview/pages
- reach: All pages. The other filters on these pages keep their state across Back (Life timeline's chips and Monthly review's month both did), so this is the one that loses it.
- steps: family household: All pages, type 'mortgage', tap the second result (Debts), press Back. Script: verify/v16-final.mjs (pages-search), two words; pictures from v9-misc.mjs.
- saw: After Back the box is empty, all 150 pages are listed again and the screen is at the top (same for 'retire'). While searching, '4 pages match mortgage' lists Life timeline first, then Debts, then Mortgage: with the keyboard up (508 px of screen) only Life timeline is visible; the page called Mortgage is at y=627, under the keyboard.
- should: Back returns to the same search with the same results. Pages whose name contains the word come first, then the pages that only mention it.
- why: A person who opens the wrong result has to type the word again, and the obvious result is hidden behind two that merely mention the word.
- cause: modules/overview/pages/view.js line 12: 'let q = ""' lives inside render and is never kept in the address or anywhere else, so every draw starts empty; line 32 lists matches in menu order (group, then order) with no title-first sort.
- fix: On input, history.replaceState to '#/overview/pages?q=<word>' and start from route.query.q on render (the router already parses a query inside the hash). In draw(), when q is set, sort matches so a title match precedes a description match, or show a first group 'Best match'.
- evidence: $SP/ux/p-overview-home/verify/pages-search-kb.png, $SP/ux/p-overview-home/verify/pages-search-after-back.png

