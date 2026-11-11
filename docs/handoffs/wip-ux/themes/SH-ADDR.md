# SH-ADDR: An address that names no page, or a page that is switched off, silently shows the Dashboard

1 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## j-navigator/N2 (severity 3, navigate, scope shell, owner shell, confirmed)
**A link to a page that is switched off (or an address with a typo) silently shows the Dashboard under the wrong address**

- pages: every link to a switched-off page, every address that names no page
- reach: wider than the walker found: not only typed addresses but every in-app link to a page the person switched off in Settings > Pages
- steps: H.family(), Settings > Pages > Assets and debts, switch 'Emergency fund' off. Open Next best action and tap the filled 'Open the page'. Or simply open #/cashflow/incom.
- saw: 'Open the page' lands on the Dashboard: title 'Dashboard', 'Hi Ana.', address still #/balance/liquidity, no message, no menu row highlighted. The Dashboard's own row 'Emergency fund 0.9 months ›' still points at the switched-off page; tapping it only redraws the Dashboard at the top. Typos behave the same: #/cashflow/incom, #/cashflow/Income, #/cashflow, #/Cashflow/income, #/debt/nonexistent all show the Dashboard. Good: #/cashflow/income/, .../extra and ...?x=1 open Income, and a guide with a bad name says so.
- should: The Dashboard may still be shown, but with one line on top saying why: 'Emergency fund is switched off on this device. Turn it back on in Settings › Pages.' or 'We could not find that page. This is your Dashboard; use Find a page in the menu.' The address is corrected to #/overview/dashboard.
- why: The person taps the page's one filled button and gets the home page with no explanation; from the Dashboard the row looks dead. Rare (needs a switched-off page or a stale bookmark), which is why it is a 3 and not a 4.
- cause: core/app.js line 201: `if (!m || !features.enabled(m)) m = modules.get("overview/dashboard")` with no message, and location.hash is left as it was (line 199 keeps the unknown route as `current`, so nothing is highlighted).
- fix: In show() at line 201: remember why the fallback happened; try the lower-cased group/id first; history.replaceState to #/overview/dashboard and set current to it; prepend one ui.notice('warn', ...) with a link to Settings › Pages (switched off) or to All pages (unknown). One shell change covers every link.
- evidence: $SP/ux/j-navigator/verify/n2-badaddr.png, $SP/ux/j-navigator/verify/n2-off-page-nba.png; scripts v2.mjs, v2b.mjs

