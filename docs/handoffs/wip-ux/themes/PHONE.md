# PHONE: Needs a real phone

1 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## j-first-retiree/x-4 (severity 3, focus, scope ui-kit, owner shell, needs-real-phone)
**Large text was not really tested by the walker: the brief's 125% changes nothing in this app, and whether a phone's text-size setting reaches it needs a phone**

- pages: every page
- reach: Every page: all text sizes are fixed in px.
- steps: H.empty() at 320x568. Read four text sizes, set document.documentElement.style.fontSize = '125%', read them again. Then walk the journey at 320x568 and, after each screen draws, multiply every text size by 1.25.
- saw: 125% on the root: heading 26 px, help text 13 px, buttons 15 and 17 px before and after; the root becomes 20 px, the body stays 15 px. So the walker's 'nothing overflows at 125%' tested nothing. What I could test holds: at 320x568 (an iPhone set to Display Zoom, Larger Text), and with every text size 1.25 times larger on top, the 13 question screens, the reveal, the five step pages, Your plan and the Dashboard have no sideways scroll, nothing off the side and nothing clipped (only the top bar title shortens to 'Set up m...').
- should: On an iPhone: Settings > Accessibility > Display & Text Size > Larger Text, two steps from the top; open the app in Safari: does any text grow? Then Safari's aA at 125%: text should grow and nothing clip. On Android: Settings > Accessibility > Font size at the largest, and Chrome > Settings > Accessibility > Text scaling at 130%: does the app's text grow at all?
- why: Ruth has large text set on her phone. If that setting does not reach the app she reads 13 px help lines and 12 px small print; pinch-zoom still works (the viewport does not forbid it).
- cause: core/ui/base.css line 16 (--fs-xs 12px ... --fs-2xl 32px) and line 29 (`html, body { font: var(--fs)/1.5 ...; -webkit-text-size-adjust: 100% }`).
- fix: Only if the phone check shows the setting is ignored: give the tokens in rem (15px = 0.9375rem and so on) and take the px font off html, so the root follows the browser. The owner's 15 px base text stays the default. One change in the UI kit.
- evidence: $SP/ux/j-first-retiree/verify/r-q3-filled.png (scripts r.mjs, r2.mjs)

