# SH-MENU: The menu drawer and focus: Back and Escape do not close it, focus runs behind it, hidden menu stops, page behind scrolls, reduce motion, nothing announced on a page change or a save

7 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## j-keyboard-reader/K2 (severity 3, focus, scope shell, owner shell, confirmed)
**With the menu closed on a phone-width screen, 28 invisible menu stops sit between the top bar and the page; there is no way to skip them**

- pages: every page at widths under 960 px (checked overview/dashboard, cashflow/income, system/settings, debt/payoff)
- reach: every page, for a keyboard or screen-reader user; no effect on a thumb
- steps: family household, 390x844, keyboard (touch off). Open Dashboard and press Tab 45 times, noting where the focus is each time. Repeat on Income, Settings, Pay off debts, and at 1280x800.
- saw: Same on all four pages: Tab 1 Menu, Tab 2 the status pill, then 28 stops inside the closed menu (Find a page, 9 links, 18 topic buttons) at x = -262, off the left edge, with nothing marked on screen; the page's first control is stop 31 (the walker wrote 33 stops and stop 36; I measured 28 and 31). After 8 Tabs the screen shows no focus at all, and pressing Enter there opened 'Set up my plan', a page whose link was never visible. The closed menu is only moved aside: visibility visible, not inert, no aria-hidden. No skip link exists. At 1280 the same 28 stops come before the page, but there the menu is visible, so it is only slow.
- should: A closed menu takes no focus. The first Tab stop is 'Skip to the page', which jumps past the menu at any width.
- why: Someone on a keyboard presses Tab 28 times and sees nothing move, and Enter opens a page they could not see was chosen. A screen reader on a phone reads the 28 hidden menu items before every page. A thumb never meets this, so 3, not 4. To check on an iPhone: the keyboard's up arrow from the first box of a form may jump into the hidden Find a page box, because it is the first form box in the page (I confirmed the order, not the iPhone behaviour).
- cause: core/ui/base.css:49 (#sidebar is closed with transform: translateX(-100%) only, so its controls stay focusable) and index.html:81-89 (no skip link; the menu comes before the page in the order).
- fix: base.css: #sidebar { visibility: hidden; transition: transform .18s ease, visibility 0s linear .18s } and #sidebar.open { visibility: visible; transition-delay: 0s }, plus visibility: visible inside the 960 px rule. index.html: a first link <a class="skip" href="#content">Skip to the page</a> shown only while focused, and tabindex="-1" on <main id="content">. No design-log decision is touched (the cross on the menu button and the drawer stay as chosen 2026-09-15).
- evidence: verify/k2.mjs, verify/k2b.mjs, verify/k2-phone-8tabs.png (8 Tabs in: nothing on screen is marked)

## j-keyboard-reader/K3 (severity 3, navigate, scope shell, owner shell, confirmed)
**The open menu ignores Escape, keeps the focus on its button, and lets Tab run on to the page hidden behind it**

- pages: every page at widths under 960 px (checked on cashflow/income)
- reach: every page, keyboard or screen reader at phone width; no effect on a thumb
- steps: family household, 390x844, keyboard. Open Income. Tab once (Menu), Enter. Press Escape. Then Tab 45 times.
- saw: Enter opens the menu and the focus stays on the button (now 'Close menu'). Escape: the menu is still open (also with the focus in Find a page). The next Tab goes to the status pill, then through the 28 menu stops, and from stop 30 on to the Income rows behind the menu while it is still open: those rows are under the 272 px drawer and the dim layer. The menu button has no aria-expanded, none of the 18 topic buttons has it, and the current page's link is marked only by colour (no aria-current). Enter on a topic button opens it correctly.
- should: Escape closes the menu and puts the focus back on the Menu button. While the menu is open, Tab stays inside it. The button says whether the menu is open; the current page's link says it is the current page.
- why: A keyboard user's first instinct to leave a menu is Escape, and nothing happens; tabbing on puts the focus on things covered by the menu. It is a hesitation, not a dead end (Enter on the cross closes it), and a thumb is not affected.
- cause: core/app.js:145-157 (setToggleIcon, closeDrawer, openSearch, toggleDrawer) and :142-144 markActive: no keydown handler anywhere, no aria-expanded, no aria-current; nothing stops focus leaving the open drawer.
- fix: core/app.js only: in toggleDrawer/closeDrawer set aria-expanded on #nav-toggle and toggle `inert` on #content while the drawer is open; one document keydown listener: Escape with the drawer open calls closeDrawer() and focuses #nav-toggle; markActive() also sets aria-current="page"; the topic button sets aria-expanded when toggled. Do not move the focus into Find a page on a touch open (the keyboard would cover the menu); when the menu was opened with Enter or Space (click event detail 0), focus the first link.
- evidence: verify/k3.mjs, verify/k3-open-after-escape.png (menu still open after Escape, focus ring on the cross)

## j-keyboard-reader/K6 (severity 3, navigate, scope shell, owner shell, confirmed)
**A page change puts the focus nowhere and says nothing; on desktop, choosing a page from the menu by keyboard leaves 29 to 41 Tabs before the page's first control**

- pages: overview/dashboard, cashflow/income, cashflow/expenses, balance/liabilities, balance/net-worth, goals/goals, retirement/projection, debt/payoff, system/settings, overview/guesses
- reach: every page except Get started, Your plan and the setup questions; keyboard and screen-reader users
- steps: family household, keyboard. (a) 390x844: open each of the 11 pages by its address and read the headings and the focus. (b) 1280x800: Tab to 'Our guesses for you' in the menu, Enter, then Tab until the focus is inside the page. (c) Same with the Cash flow topic open and Income.
- saw: (a) After the change the focus is on nothing on 9 of 11 pages (Dashboard, Income, Expenses, Debts, Net worth, Goals, Will the money last?, Pay off debts, Settings); only Get started and Your plan focus their heading. #announce is empty every time. Income, Expenses, Debts, Net worth, Goals and Settings have no h1 at all; the page's name is a span in the top bar. The browser tab's title does change. (b) After Enter on the menu link the focus is on nothing and the first Tab lands on Find a page, the top of the menu: 29 Tabs to reach the page's first control (41 with one topic open). Same at 390 wide, where those stops are also invisible. A link inside a page is fine: the next Tab goes to the new page's first control.
- should: After any page change the focus is at the top of the new page (so the next Tab is the page's first control) and the page's name is read out.
- why: A keyboard user who picks a page from the menu is sent back to the top of the menu and must Tab through all of it again, every time; a screen-reader user hears nothing after following a link. A thumb is not affected. The walker missed the 29 Tabs, which is the part that costs the most.
- cause: core/app.js show(): line 214 buildNav() rebuilds the whole menu on every page change, destroying the focused link; nothing after render (lines 236-246) moves the focus or calls announce(); index.html:84 the page name is a <span>.
- fix: core/app.js show(), new address only (not keepScroll): after the page has drawn, if the focus is not already inside #content (Get started, Your plan and the questions focus their own heading: keep that), focus <main id="content" tabindex="-1"> with preventScroll and call announce(m.title); set main's aria-label to the page title. Make #page-title an <h1> only if the pages' own hero h1s are then stepped down; otherwise leave it and rely on the label. One shell change, every page.
- evidence: verify/k6.mjs, verify/k6b.mjs, verify/k6c.mjs, verify/k6-desktop-first-tab-after-menu.png (Income is showing; the first Tab is on Find a page)

## j-navigator/N3 (severity 3, back, scope shell, owner shell, confirmed)
**With the menu open, the phone's Back leaves the page instead of closing the menu (and leaves the app from the first page); Escape does nothing**

- pages: every page on a phone
- reach: every page; three pages and the first page of a visit tried
- steps: H.family(), Dashboard, then Income, tap Menu, press the phone's Back.
- saw: Income with the menu open -> Back -> Dashboard, menu closed. Same from Net worth and Federal estimate (each scrolled to 470). On the first page of a visit, Back with the menu open left the app altogether (about:blank in the test; on a phone the previous site or the home screen). Escape leaves the menu open. Focus stays on the 'Close menu' button when the menu opens. With the menu closed, the Tab key still walks through its hidden rows (the first 8 stops were menu rows at x = -262), which is also what a screen reader would read.
- should: Back closes the menu and stays on the page; Escape closes it too; the closed menu is not reachable by keyboard or screen reader.
- why: An Android habit and the iPhone's edge swipe both mean 'close this'; the person loses the page they were on (and, with x-2, anything half typed). One Forward recovers it, hence 3.
- cause: core/app.js lines 151-157 (closeDrawer, toggleDrawer) and 382-383: opening the drawer adds no history entry, there is no keydown handler, and the closed drawer is only moved off screen (core/ui/base.css line 49), not made inert.
- fix: In toggleDrawer() on open: history.pushState({ drawer: true }, ''); a popstate listener closes the drawer when it is open (the hash does not change, so no page is redrawn); closing by the cross or the dimmed area calls history.back() when history.state?.drawer; a menu link replaces that entry (location.replace) so Back from the new page still returns to the old one. Add keydown Escape -> closeDrawer() and focus #nav-toggle; set side.inert = !open under 960 px. Keeps the owner's cross button (design log 2026-09-15, Menu drawer round 2, finding 4).
- evidence: $SP/ux/j-navigator/verify/n3-after-back.png; scripts v2.mjs, w1.mjs

## j-navigator/x-4 (severity 3, smoothness, scope ui-kit, owner shell, confirmed)
**The page behind the open menu still scrolls, so closing the menu leaves you somewhere else on the page**

- pages: every page on a phone
- reach: every page with the drawer open
- steps: H.family(), Net worth, swipe down to 570, tap Menu, swipe up once on the dimmed strip to the right of the menu, then swipe the menu list up five times, then close the menu.
- saw: The swipe on the dimmed strip moved the page behind from 570 to 955 with the menu still open. Swiping the menu list: the list reached its end (608 of 608) and the next swipes moved the page behind from 955 to 1,262. After closing the menu the page is 692 px from where it was.
- should: While the menu is open the page behind does not move; closing the menu shows exactly the screen that was there.
- why: Browsing the menu to its last topics (System is at the bottom) and then deciding to stay costs you your place, with nothing to explain why the page moved.
- cause: core/ui/base.css lines 49-52: #sidebar is overflow-y: auto with no overscroll-behavior, #scrim is a plain fixed layer that lets a swipe through, and nothing locks the page while the drawer is open.
- fix: CSS only, in core/ui/base.css under the phone width: `#sidebar { overscroll-behavior: contain; }`, `#scrim { touch-action: none; }`, and `html:has(#sidebar.open) { overflow: hidden; }` (or a class set in toggleDrawer/closeDrawer). Check on the iPhone that the page behind no longer moves.
- evidence: $SP/ux/j-navigator/verify/x2-menu-bottom.png; script x2.mjs

## j-hard-conditions/HC-5 (severity 2, smooth, scope ui-kit, owner shell, confirmed)
**With the phone's 'reduce motion' on, the menu still slides and pages still glide to a form**

- pages: menu (every page), goals/goals, goals/travel, taxes/capital-gains, transactions/categories, overview/dashboard, ai/notes, ai/explain, ai/assistant
- reach: Wider than reported. The drawer and the two chevrons (base.css lines 49, 61, 137) on every page; and ten places where a page scrolls itself with behavior 'smooth' whatever the setting (goals/goals/view.js 40 and 109, goals/travel/view.js 67, taxes/capital-gains/view.js 73, transactions/categories/view.js 72 and 84, overview/dashboard/view.js 83, ai/notes 152, ai/explain 165, ai/assistant 38, overview/setup/view.js 1436). The setup questions and the guide frame do it right (they ask reduced() first).
- steps: open({reducedMotion: true}), family, Dashboard: tap the menu button and sample the drawer's left edge every frame. Then Goals: tap the row 'Japan trip' and sample the scroll position every frame.
- saw: prefers-reduced-motion is on, yet #sidebar still has transition: transform 0.18s: the drawer was part-way open in 10 frames and fully open at 197 ms, exactly as with motion allowed (196 ms). On Goals the page glided from 442 to beyond 928 px through 25 different scroll positions, the same as with motion allowed.
- should: With reduce motion on: the menu appears at once, chevrons turn at once, and a page that brings a form into view jumps there without gliding.
- why: A person who told the phone to stop animations still gets a full-width slide at every menu open and a half-screen glide when opening a goal. Nobody is slowed by it, so it sits at the bottom, but the app already means to honour the setting (.save-echo, the setup card, the guide ring) and the fix is a couple of lines.
- cause: core/ui/base.css line 129: the reduced-motion rule names only .save-echo. The page scrolls pass behavior: 'smooth' unconditionally.
- fix: core/ui/base.css line 129: @media (prefers-reduced-motion: reduce) { .save-echo { animation: none; transition: none; } #sidebar, .nav-group-head .chev, .fold .fold-chev, .scroll-hint::after { transition: none; } }. For the scrolls, one helper in core/ui/dom.js, ui.reveal(el, block = 'start'), that picks 'auto' when matchMedia('(prefers-reduced-motion: reduce)').matches, used in the ten places (claude-a's lane for goals/travel, the rest claude-b). Note for a real phone: Chrome may already drop smooth scrolling itself when the system setting is on; Safari may not.
- evidence: $SP/ux/j-hard-conditions/verify/v5-drawer-reduced.png (the end state; the measurement is the frame samples printed by v5.mjs and v5b.mjs).

## j-keyboard-reader/K5 (severity 2, understand, scope shell, owner shell, confirmed)
**A save's confirmation is never read out to a screen reader (the part about errors not being tied to their box is refuted)**

- pages: every page that saves through a redraw (96 page views use ui.notice("ok")); checked on cashflow/income
- reach: screen-reader users only
- steps: family household, 390x844, keyboard. Income: open the add form, What is it 'Side gig', Amount 'abc', Enter. Then Amount '1,200', Enter. Watch every live region on the page during both.
- saw: Confirmed: 'Side gig added.' is a plain div.notice.ok with no role and no aria-live; the shell's #announce region stayed empty; the only live text during the whole run was the form's 'That's $14,400 a year' line. ctx.announce() exists (core/app.js:165) but only the setup questions call it. Refuted: the bad amount IS tied to its box. Enter with 'abc' kept the form, left the focus in Amount, and the box carried the message 'Type an amount in numbers, like 4,500.'; Chrome's accessibility tree reports the box as invalid=true and names it 'Amount what arrives each time, before taxes if you know it'. aria-invalid is not needed for that.
- should: After a save the confirmation text is read out once. An error notice is read out at once.
- why: A blind user presses Save and hears nothing, and (with K4) the focus is on nothing, so they cannot tell the save worked. Sighted users are not affected, so 2.
- cause: core/ui/dom.js:25 notice() adds no role; core/app.js:256-264 finds this save's fresh notices but only uses them for the bottom echo; no page calls ctx.announce.
- fix: core/app.js show(), after `fresh` is computed (line 258): if (fresh.length) announce(fresh.map((n) => n.textContent).join(" ")). core/ui/dom.js:25: give kind "error" role="alert". One shell change covers every page that confirms through the redraw.
- evidence: verify/k5.mjs, verify/k5-saved.png ('Side gig added.' on screen; nothing was sent to a live region)

