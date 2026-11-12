# SH-TOPBAR: Page titles are cut off in the top bar by the status pill

2 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## j-hard-conditions/x-2 (severity 3, navigate, scope shell, owner shell, confirmed)
**On the real phone the page's name is cut off in the top bar ('Will the mone...') because the status pill is much wider than the test pill**

- pages: every page (top bar)
- reach: Every page. With the pill reading 'Saved on this phone' (what a phone without the PC shows, core/app.js line 317): 390 px wide, 58 of 159 page names are cut, among them Will the money last?, Update my balances, Life insurance needs, Federal estimate, Emergency fund, How much to take out. With 'Saved on your computer' (line 324): 89 of 159, adding Social Security, Needs attention, Next best action. At 320 px: 139 of 159, including Dashboard, Settings, Net worth, Expenses, Your plan. In the test sandbox the pill says 'Sandbox' (95 px) and only 1 of 159 is cut at 390 px, which is why no walker saw it; at 320 px even the sandbox cuts 54 of 159.
- steps: Family, 390x844, sandbox. Put the real words in the pill (display only): document.getElementById('status').textContent = 'Saved on this phone'. Open Will the money last? Then walk all 159 pages and compare the title's scrollWidth with its clientWidth. Repeat at 320x568 and with 'Saved on your computer'.
- saw: Top bar at 390 px: menu button 44 px, pill 167 px, which leaves 135 px for the name: 'Will the mone...'. With 'Saved on your computer' the pill is 194 px and the name gets 108 px. At 320 px the name gets 65 px: 'Das...'. On many of these pages the first heading in the page is a verdict ('The money lasts', 'Good: 76 out of 100'), not the page's name, so the bar is the only place that says where you are.
- should: The whole page name is readable in the bar at 390 px and at 320 px, with the pill keeping its words.
- why: 'Do I know where I am' fails on a third of the pages on the owner's own phone, and on nearly all of them on a small one: after a tap in the menu or on a link the person cannot confirm they landed on the page they asked for.
- cause: core/ui/base.css line 42: #page-title is one line with an ellipsis; line 44: #status is flex: none and nowrap, so the pill always wins the space. The words themselves are the owner's choice (design log 2026-09-15 round 10 and 2026-11-06) and stay.
- fix: One change in core/ui/base.css fixes every page: let both wrap to two lines inside the 56 px bar instead of cutting. #topbar #page-title { white-space: normal; line-height: 1.2; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; text-wrap: balance; } and under @media (max-width: 420px) { #status { white-space: normal; line-height: 1.15; max-width: 104px; text-align: left; font-size: var(--fs-xs); } } ('Saved on / this phone' on two lines, still 44 px high, same words). Then re-run the 159-page check with each of the three pill texts at 390 and 320.
- evidence: $SP/ux/j-hard-conditions/verify/x3b-title-390-real-pill.png; scripts x3.mjs, x3b.mjs. The widths were measured with this browser's font; confirm on the phone that the count is of the same order.

## p-taxes/T8 (severity 3, navigate, scope ui-kit, owner shell, confirmed)
**Page titles are cut off in the top bar: one in the sandbox, about 58 with the words the owner's phone shows in the status pill**

- pages: taxes/documents, taxes/federal, taxes/withholding, taxes/estimated, taxes/filing-status, taxes/brackets, taxes/projection, taxes/self-employment, cashflow/recurring, retirement/projection
- reach: sandbox pill ('Sandbox', 95 px): 207 px for the title, 2 titles cut. Pill 'Saved on this phone' (167 px, what core/app.js:317 shows on a phone with no PC): 135 px for the title, 58 of the household's page titles cut, 8 of the 11 tax pages among them. 'Saved on your computer': 108 px, 89 cut.
- steps: Any household, taxes/documents: read the top bar. For the real words: on the owner's phone (not the sandbox) open Federal estimate or Will the money last? and read the top bar.
- saw: Sandbox: 'Tax documents checkl…'. With the pill's words set to 'Saved on this phone' (set in the page for the measurement, since the sandbox cannot show them): 'Federal estim…'; 'Will the money last?' needs 167 px and has 135. The full list per pill is printed by t8.mjs.
- should: The whole title is readable at 390 px with any of the pill's wordings.
- why: The top bar is the only 'where am I' once the page is scrolled; half a title next to a wide status pill does not answer it.
- cause: core/ui/base.css:42 keeps #page-title on one line with an ellipsis while #status (base.css:44) never shrinks and its words grew (design log 2026-09-15 round 10 and 2026-11-06 chose the words; keep them).
- fix: core/ui/base.css:42: let the title use two lines on a phone (white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.15; the 56 px bar holds two 17 px lines). The pill's words stay. Optionally shorten modules/taxes/documents/module.js:7 to 'Tax papers', the page's own heading.
- evidence: p-taxes/verify/t7-documents-end.png and p-taxes/verify/t4b-shifted.png ('Tax documents checkl…'), p-taxes/verify/t8-federal-realpill.png ('Federal estim…', pill words set by the script); script p-taxes/verify/t8.mjs. Check the count on the owner's phone: the sandbox always shows 'Sandbox'.

