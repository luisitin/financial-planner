# Skeptic's check of connect.md and ux.md against primary sources (2026-11-11)

Scope: the outside-world claims in `rv/connect.md` (connecting accounts) and `rv/ux.md` (retirement levers UX):
prices, who can get access, CORS, licences, CFPB section 1033 in 2026, and product features of Boldin,
ProjectionLab, Empower, Fidelity, Vanguard (plus T. Rowe Price and MaxiFi, which share the same table).
Every source below was **read or measured on 2026-11-11** (UTC 22:09-22:22). "Measured" means a request
from this session. A claim whose source I could not open is listed as unverified, even if it is likely true.
Nothing in the repo was edited. Scratch evidence: `scratchpad/vw/` (npm metadata, licence files, Actual
source, extracted PDFs).

Tally: **93 claims checked**. **17 need a correction** (6 matter for the recommendations, 11 are minor).
**19 stay unverified.** The rest held up.

---

## 1. Corrections that change a recommendation or a sentence the owner would read

| # | File | Claim | What is true | Evidence (read 2026-11-11) |
|---|---|---|---|---|
| W1 | ux.md 4.11 | "Even Boldin lists account linking as 'Coming soon'." | **Wrong.** Boldin links accounts today, through Meld, which uses "Plaid, MX, and Finicity (Mastercard)". It syncs "automatically twice a day". It has its own Fidelity and **Fidelity NetBenefits** instructions (PlannerPlus only). The release notes' "Coming soon" item is *Plan sharing*. It mentions "you stay in control of your subscription and account linking" only in passing. | help.boldin.com/en/articles/9518903 (dateModified 2026-10-26); help.boldin.com/en/articles/15363178 (2026-09-03); boldin.com/retirement/release-notes/ |
| W2 | connect.md 0, 2, 7 | Plaid: "coverage of Fidelity/401(k)s is uncertain"; "whether Plaid reaches it now is unconfirmed". | **Too weak.** Plaid's own OAuth page names Fidelity as an OAuth institution: "some institutions, such as Fidelity and Charles Schwab, may take longer" after registration. So Plaid does reach Fidelity. NetBenefits/401(k) coverage is still not stated by Plaid. A consumer product (Boldin, through Meld: Plaid/MX/Finicity) does link NetBenefits (W1). The point that a hobbyist cannot easily get this stands. "Nobody reaches it" is false. | plaid.com/docs/link/oauth/; help.boldin.com/en/articles/15363178 |
| W3 | connect.md 0 | "browsers block `fetch()` from an HTTPS page to an `http://` address as mixed content", so the Pages copy "cannot reach the PC server". | **Incomplete.** MDN confirms the general rule and the loopback exemption. Chrome's Local Network Access exempts requests from mixed-content checks when "the request hostname is a private IP literal (e.g., [address removed])", "a .local domain", or the fetch carries `targetAddressSpace: "local"`. This needs the user to grant the local-network permission, in a secure context. So on Chrome (desktop/Android) the GitHub Pages copy *can* call `http://192.168.x.x:8787` after a permission prompt, if the server also sends CORS headers. I found no source that Safari/iOS does the same. Treat iPhone as blocked: unverified, but the safe assumption. | developer.mozilla.org/en-US/docs/Web/Security/Mixed_content; developer.chrome.com/blog/local-network-access (published 2025-06-09) |
| W4 | ux.md 2 (table) | T. Rowe Price Retirement Income Calculator: "Inflation 3%, **500 simulations, money lasts to 95**, Social Security from 70"; "Income estimates are the 80th-percentile ones". | **Two different tools are mixed.** The Retirement Income Calculator methodology PDF says "Monte Carlo analysis to generate **1,000** hypothetical market scenarios". Retirement lasts to **92** (men under 71) or **94** (women under 72). Inflation is 3%, Social Security starts at 70, and the Confidence Zone is 70-95% at 44 or younger and 80-95% at 45 or older. "Play Zone" is confirmed. The **500** scenarios, the **80th percentile** and "through age 95" come from the separate *workplace participant* methodology page (© 2026). The PDF is not simply "dated December 2023": it was created then, last modified April 2025, and carries footer code 202502. It still assumes the "TCJA sunset in 2026". | troweprice.com/content/dam/iinvestor/Forms/retirement-income-calculator-methodology.pdf (text extracted); troweprice.com/workplace/en/participant/home/methodology-and-assumptions.html |
| W5 | ux.md 2 (table) | Empower Retirement Planner: "'Adjust the sliders to see how changes affect your savings in real time.'" | **Wrong attribution.** That sentence is from a workplace-plan participant flyer, under "Know your estimated monthly retirement income" (the plan's income estimate). The same flyer lists "a Retirement Planner" separately in the "toolbox". For the Retirement Planner, Empower says "a probability-of-success ranking of low, medium or high" and "a side-by-side comparison" (both confirmed). Rob Berger (2026-11-02) mentions no sliders. | empower.com/client/ducks/resources/docs/Personalized-Web-Experience-Flyer.pdf (text extracted); empower.com/the-currency/money/how-much-do-i-need-to-retire (2025-07-22); robberger.com/best-retirement/ |
| W6 | connect.md 7 | Fidelity FAQ: "You cannot download NetBenefits 401(k), 403(b), 457 accounts" through its QuickBooks route. | **Cannot be opened now, and it leaves out the other half.** The FAQ URL 301-redirects to a generic customer-service page. The search snippet of that FAQ says the QuickBooks restriction is paired with "We recommend utilizing Quicken for these account types", and that NetBenefits 401(k)/403(b)/457 data can be downloaded "if your plan permits". Whether that Quicken route still produces a .QFX file the app could read is unknown (Quicken community threads show recurring NetBenefits download failures). Do not cite it as "no file route for NetBenefits". | fidelity.com/customer-service/faqs-exporting-account-information (301 to digital.fidelity.com/prgw/digital/customer-service/); WebSearch summary of the same FAQ |

## 2. Minor corrections (facts slightly off; conclusions unchanged)

| # | File | Claim | What is true | Evidence |
|---|---|---|---|---|
| M1 | connect.md 5 | Compliance "was to start 2026-04-01" and "The April 2026 date passed without binding enforcement". | The rule's first date was 2026-04-01, but the E.D. Ky. court tolled compliance dates twice: 30 days on 2025-02-25 ("from April 1 to May 1 for each phase") and 60 more days on 2025-03-27. The first date was therefore about 2026-06-30 before the 2025-10-29 injunction. The outcome is the same: no binding date in 2026. | huschblackwell.com (2025-02-26 alert); bankingjournal.aba.com/2025/11/kentucky-federal-court-enjoins-cfpb-from-enforcing-current-1033-final-rule/ |
| M2 | connect.md 4 | "American Express discontinued Direct Connect (Moneydance support, Feb 2026, banktivity...)". | Banktivity's article "American Express no longer supports Direct Connect/OFX" is dated **2023-08-30**. It is older than implied, which strengthens "Direct Connect is over". | banktivity.com/support/articles/tag/american-express/ |
| M3 | connect.md 4 | "Merrill was 'the last' Direct Connect institution for one KMyMoney user". | The post says Merrill "is now the last of my institutions to **stop** providing OFX direct connect, as of two weeks ago" (post 2025-11-04). Merrill stopped too; it is not the last one still working. | mail.kde.org/pipermail/kmymoney-devel/2025-November/035359.html |
| M4 | connect.md 6 | ofx4js: "MIT". | npm says MIT, but the repo has no LICENSE file. Its README says files from ofx4j stay **Apache-2.0** and only the port's own files are MIT. Both are permissive; copying needs the Apache notice kept. | raw.githubusercontent.com/arolson101/ofx4js/master/Readme.md; registry.npmjs.org/ofx4js |
| M5 | connect.md 6 | ofx-js "MIT (LICENSE file)". | MIT is confirmed. The copyright line is "Copyright 2012-2017 **Apps Attic Ltd.**" (it descends from chilts/node-ofx), so a README credit should name Apps Attic Ltd as well as the repo. | raw.githubusercontent.com/bradenmacdonald/ofx-js/master/LICENSE |
| M6 | connect.md 2 | Limited Production "closed to new **US/CA** teams since 2026-04-15". | The glossary says "For Plaid teams created on or after April 15, 2026, Limited Production is no longer offered", with no region qualifier. The US/Canada limit applies to the *Trial* plan. | plaid.com/docs/quickstart/glossary/; plaid.com/docs/account/billing/ |
| M7 | ux.md 2 | Fidelity: "Input tabs (accounts, savings rate, asset mix, time and expenses)"; "250 simulations on historical returns". | The cited review lists the sections as "Expenses, Accounts, Retirement Income, Taxes, and Projections". The 250 historical simulations come from that review (2026-01-05). Fidelity's own score page gives no count; its examples use "90 out of the 100 market scenarios". Zones, the 90% confidence level, the 50/75/90% markets and PDF-snapshot comparison are confirmed. | thefinancebuff.com/fidelity-retirement-calculator-review.html; nb.fidelity.com/.../WorkspaceAboutYourScore (© 1996-2024) |
| M8 | ux.md 2 | Boldin: "One blended return per account (for example 6%); volatility set by the model." | Boldin lets you "set a nominal rate of return at the account level". The 6% is only an illustration in the article. Volatility is not described. Confirmed: 1,000 simulations, the optimistic/pessimistic/average toggle and the 5-8% band. | boldin.com/retirement/what-rates-of-return-should-you-use-for-retirement-planning/ (2026-04-15) |
| M9 | ux.md L13 | FP Canada: "U.S. stocks 6.4%, inflation 2.1%, before fees", set beside Vanguard and J.P. Morgan forecasts. | The figures are confirmed, as are the ±0.5% deviation and "not be prudent to increase return assumptions to 'force' a projection". But FP Canada's equity figures already have a 0.5% safety margin taken off. They are deliberately careful, not a like-for-like forecast. | institutpf.org 2026 PAG release; fpcanada.ca 2024-pag---english.pdf (text extracted) |
| M10 | ux.md L15 | Vanguard, "A BETR approach to Roth conversions" (2022-03) supports "a mix of pre-tax and Roth". | The page is dated 2025-08-28 and covers break-even tax rates for **conversions**. It does not discuss mixing pre-tax and Roth. The "mix" point rests on Brown, Cederburg and O'Doherty alone (not opened). | corporate.vanguard.com/.../betr-way-assess-roth-ira-conversions.html |
| M11 | ux.md L17 | "From 2026 ... catch-up contributions as Roth" (final rules TD 10033). | Mostly right. TD 10033 was published 2025-09-16 and the release is IR-2025-91 of 2025-09-15. The final regulations "generally apply to contributions in taxable years beginning after Dec. 31, 2026". For 2026, plans follow the statute in good faith. Vanguard says "Starting in January 2026 ... earned more than $150,000 in the previous year". Word it as "the rule applies from 2026" and leave the regulation date out. | irs.gov newsroom IR-2025-91; Vanguard *How America Saves 2026* PDF (text extracted) |

## 3. Confirmed (same day, primary source unless marked)

**SimpleFIN Bridge.** Price "$1.50 + tax per month, or $15.00 + tax per year"; "Connect up to 25 institutions and 25 apps"
(beta-bridge.simplefin.org). MX outsourcing, "No bank account credentials ever touch our servers". The 2026-05-28 incident
(4 hours, up to 39 users, transaction data, balances, names; no credentials) is on /info/security. Developer guide:
"24 requests or fewer per day", "90 days at a time", about 5-day overlap, random minute, demo token. It says nothing about
developer registration, cost or CORS. Protocol v2.0.0-draft: Account and Transaction fields as stated; **no** `holdings`,
`payee`, `memo` or `mcc` in the spec; 402 = payment required; 403 = auth failed or revoked; Access URL "is just a URL with
included Basic Auth credentials". Actual's docs: "$1.50 / mo, or $15 / year", subscribe before the first account, keys
"saved on the server", "one time / day", "at most 90 days". Institution search re-run (POST form): Fidelity Investments,
Vanguard, Vanguard Retirement - Ascensus, Empower Retirement, Principal Financial - Retirement, Charles Schwab Retirement,
Schwab - Retirement Plan Login are listed; no entry named NetBenefits; no total count published.
**Measured CORS (22:09 UTC):** `OPTIONS /simplefin/accounts` with `Origin: https://example.github.io` gives 200, origin
reflected, `allow-credentials: true`, `allow-headers: authorization`, `allow-methods: GET`. `GET` with Basic auth gives the same
headers. `POST` claim gives 200 with the same origin and returns `https://demo:[email removed]/simplefin`. Demo
`/accounts?version=2` has transaction keys `amount, description, id, mcc, memo, payee, posted, transacted_at` and holdings keys
`cost_basis, created, currency, description, id, market_value, purchase_price, shares, symbol` (one more field, `id`,
than connect.md lists). **Measured:** `new Request('https://demo:demo@...')` throws "Request cannot be constructed from a URL that
includes credentials" (Node 22 fetch, which follows the WHATWG Fetch spec as browsers do).

**Actual Budget (MIT).** `app-simplefin.js` is 548 lines: `secretsService`/`SecretName.simplefin_token|simplefin_accessKey`,
`decodeClaimUrl`, `claimAccessKey` with `redirect: 'manual'` "for SSRF safety", `parseAccessKey`, `getAccounts` with Basic
auth, `pending=1`, `balances-only=1`, `MAX_REDIRECTS = 5`, Authorization dropped on cross-origin redirect, pending kept apart.
`ofx2json.ts` is 190 lines: `xml2js`, STMTRS/CCSTMTRS/INVSTMTRS with only INVBANKTRAN cash lines (no positions), CHARSET 1252
via TextDecoder. LICENSE.txt "Copyright James Long" (MIT text). `@actual-app/api` 26.11.0 published 2026-11-02.

**Plaid.** Trial: "new Plaid teams (US/Canada only) created on or after April 15, 2026"; "Limited to 10 Items"; removing
Items "will not allow you to create more Items"; products include Transactions, Investments, Liabilities, Balance, Statements
(also Assets, Auth, Identity); "Most appropriate for hobbyist use"; Pay-as-you-go likewise; "A price list is not available
in the documentation". Development retired 2024-06-20. OAuth: "Access to Production (via either a paid plan or a trial) is a
prerequisite"; Trial skips the Chase questionnaire and other registration requirements "until you upgrade"; Schwab "up to 5
business days". Investments: "up to 24 months", `tax_lots`, US/Canada investment-type accounts, no mention of 401(k).
Quickstart: server calls `/item/public_token/exchange`; "securely store your access_token". **Measured CORS:** `OPTIONS`
to production `/accounts/get` and sandbox `/link/token/create` gives 404 JSON with no `Access-Control-Allow-Origin`; `POST` gives 400
"missing fields: client_id, secret" with no ACAO header. A browser cannot call it.

**Teller.** "free for independent developers and teams prototyping ideas"; "developer tier includes 100 live connections";
Verify $1.50/account, Balance $0.10/call, Transactions $0.30/enrollment/month, Identity $1.75/call; "more than 7,000
financial institutions". mTLS "required for all API requests that involve end-user data, i.e. all requests in development
and production"; "never share or distribute your private key". Account `type` is "Either depository or credit": no
investment or retirement types.

**Finicity / Mastercard (US).** "Test Drive Premium is a free, 30-day limited-duration plan"; "After the 30-day period, you
will automatically be transitioned to the Production (billable) plan"; production credentials active only after Mastercard
"reviews and approves". **Stronger than connect.md says:** "Access to these plans will only be approved if a contract between
you and Mastercard has been executed" (developer.mastercard.com/open-finance-us/documentation/onboarding/).
**Yodlee.** Sandbox "5 registered test users" (developer.yodlee.com .../client-credentials-authorization/docs/environments).
**Akoya.** /docs/requirements: "Your company should maintain one Data Recipient Hub team account". The production process
(questionnaire, security and risk review, legal agreement) comes from a search summary of Akoya's production guide.
**JPMorgan fees.** Deals with Plaid (Sept 2025), Yodlee, Morningstar, Akoya (Nov 2025); terms undisclosed (multiple
trade-press reports via search: thepaypers, paymentexpert, crowdfundinsider).

**CFPB section 1033.** Federal Register API (queried 22:13 UTC): final rule 2024-25079 published 2024-11-18 ("effective
January 17, 2025"); ANPR 2025-16139 of 2025-08-22, "Advance notice of proposed rulemaking", four issues (representative,
fees, security, privacy). **No proposed rule published**, none on today's public-inspection list; the newest CFPB item on
the topic is the 2026-08-14 Regulatory Agenda; the newest CFPB document of any kind is a 2026-11-06 notice. reginfo.gov:
RIN 3170-AB39 "Personal Financial Data Rights Reconsideration", Proposed Rule, **received 08/04/2026, Pending Review**, no
concluded date. Injunction: *Forcht Bank* E.D. Ky. 5:24-cv-00304, order 2025-10-29 (ABA Banking Journal). Cozen alert
2026-04-09 confirmed. The Sixth Circuit abeyance (2026-03-30, Nos. 25-6164/26-5005, 60-day status reports, last listed
report 2026-05-29) comes from a search summary of Orrick InfoBytes and the Justia docket, not opened. 12 CFR 1033.301(b)
machine-readable file: confirmed (Cornell LII).

**OFX Direct Connect.** GnuCash list 2025-12-02: "OFX Direct Connect is effectively dead in the US"; ofxhome.com "no longer
exists". Bank of America "OFX Discontinued" 9/30/25 (Quicken community). Vanguard stopped OFX (Banktivity, 2025-03-12).

**Parsers and licences** (LICENSE files from raw.githubusercontent.com; npm registry):
ofx-js 1.1.2 (2026-09-30) MIT, "Work in any JS environment (no dependencies at all)", QFX, TypeScript; ofx-data-extractor
1.5.0 (2026-03-24) MIT, no deps; node-ofx-parser 0.5.1 (2021-03-01) MIT; ofx/chilts 0.5.0 (2020-02-13) MIT; banking 1.2.0
(2018-10-15), no LICENSE file, README "(The MIT License)"; ofxparse MIT; **ofxtools GPL v3** ("either version 3 of the License,
or (at your option) any later version"); Papa Parse 5.7.1 MIT (published 2026-11-11 16:33 UTC); pdfjs-dist 6.5.438
(2026-11-01) Apache-2.0, cdnjs 6.5.438. **Measured** jsDelivr 6.3.289: `pdf.min.mjs` 458,705 bytes, `pdf.worker.min.mjs` 1,265,413
bytes. The repo pins `^6.3.289`.

**Law.** 29 U.S.C. 1025: quarterly for participant-directed plans; "total benefits accrued", nonforfeitable benefits, "value of
each investment"; **no** required breakdown by source (confirmed).

**GitHub Pages origin.** Project sites live at "http(s)://<owner>.github.io/<repositoryname>", one origin for all of an
account's project sites, so `localStorage` is shared, as connect.md says. Not mentioned there: a custom domain would give the app
its own origin.

**Product features (ux.md).**
- Fidelity: "percentage of your average estimated retirement expenses"; "90% confidence level"; zones 95+/80-95/65-80/<65.
- T. Rowe Price: Play Zone (retirement age, living expenses, saving, other income); Confidence Zone 70-95% / 80-95% by age;
  inflation 3%; Social Security at 70. (Corrections in W4.)
- Vanguard Nest Egg: "100,000" Monte Carlo simulations; balance, allocation, years, withdrawals on "a sliding scale"; fixed
  withdrawals; "may understate stock risk"; "aiming for a probability in the 80 percent range" (CRR, 2019-01-31).
- Empower: low/medium/high; side-by-side (2025-07-22); "reports the likelihood of the plan's success" (Berger 2026-11-02).
- Boldin: "1000 paths"; "a probability of needing to make adjustments" (2025-07-04); "A 70% score doesn't mean failure"
  (2025-09-05); optimistic/pessimistic/average toggle and 5-8% band (2026-04-15); release notes 2026-08-04 (Boldin AI can change
  the plan), 2026-09-17 Document Vault, "Boldin AI can then parse and reference these files", 2026-09-24 "Explore-only for now;
  Apply to Plan is coming soon"; Roth Conversion Explorer sentence, page © 2026.
- ProjectionLab: "Save anything left over" / "Spend anything left over", "a helpful default", "add any extra income to your cash
  holdings", page updated 2026-07-28; "up to 2,000 trials" (help page 2025-04-11); "adjust the thresholds, names, and colors"
  (blog 2023-02-22).
- MaxiFi: "highest annual spending level that your household income and assets can support"; "an 80% chance of success means a
  20% chance of going broke"; consumption smoothing; © 2025.
- Vanguard forecasts as of 2026-09-30 (page 2026-10-21): U.S. equities 4.8%-6.8%, U.S. aggregate bonds 5.1%-6.1%.
- J.P. Morgan 2026 LTCMA (2025-10-20): U.S. large cap 6.7%, 60/40 6.4%.
- Damodaran (updated 2026-01-05): $100 in 1928 grew to $1,157,598.95 by end-2025, which works out to about 10.0% a year.
- Vanguard *How America Saves 2026*: "At year-end 2025, 98% of Vanguard plans offered a Roth feature ... 18% had elected"
  (*HAS 2025*: 86% at year-end 2024, 18%).
- TIAA-GFLEC P-Fin 2025: "only 49% ... the same as in 2017".
- Natixis 2025: investors expect "10.7% above inflation"; advisers suggest "around 8.3%"; 7,050 investors, 21 countries,
  February-March 2025.

## 4. Unverified (no source I could open)

1. Teller API CORS: the probe to api.teller.io was reset by this session's proxy again; not measured.
2. Plaid support "pick 'Personal use'" (support.plaid.com returned 403 before; not retried).
3. MX: development capped at 100 users, production through dashboard, then billing and a representative. MX doc URLs return 404 or
   do not contain this; search summary only.
4. Yodlee 90-day production trial and no public prices: the pricing page returns 404 to fetch; search summary only.
5. Akoya: "free sandbox" not stated on the page read.
6. Fidelity "API-only through Akoya" since 2023 (riabiz): not opened. Fidelity's own API is "Fidelity Access", and Plaid lists
   Fidelity as OAuth (W2), so "through Akoya" alone is likely too narrow.
7. Anecdotes: Fidelity via MX "spotty"; Monarch NetBenefits failures (Jan 2026); Principal blocking aggregators (summer 2025).
8. Fidelity export FAQ text (W6): the URL redirects.
9. Vanguard Nest Egg "historical returns": the calculator page returned 503; CRR 2019 does not say so. All Vanguard calculator facts
   rest on a 2019 article.
10. ProjectionLab "plan-level and per-account growth rates": not found on the pages read.
11. Boldin "Social Security Explorer" (Roth one confirmed).
12. ux.md's absence claims: "None of the seven ... marks which inputs are the tool's defaults", "no tornado chart in any of the
    seven". These rest on a limited search and cannot be proven from public pages. Keep them as "we found none".
13. SSA 2025 Trustees CPI 2.4% intermediate: ssa.gov returned 403.
14. Financial Engines "Missing Out" (1 in 4, $1,336): businesswire returned 403.
15. IRS Notice 2025-67 as the source of the $150,000 figure: plansponsor redirected. The figure itself is confirmed by Vanguard HAS 2026.
16. Rob Berger 2024-05-21 (3% return / 6% inflation example), Kitces 2022-06-29, IMI PROTECT, Nielsen, and the academic papers
    in ux.md L2-L11, L14, L15, L18, L19: not re-read (outside this check's named scope).
17. Safari/iOS behaviour for Local Network Access (W3): no source found either way.
18. Bank of America ended "all OFX services": the Quicken thread says "OFX Discontinued" without saying Web Connect files too.
19. Sixth Circuit abeyance details: search summary of Orrick/Justia only (see section 3).

## 5. What this changes for the plan

- **Account linking (connect.md section 9).** The order to build (OFX/QFX files first, PDF statements aimed at the retirement
  inputs, SimpleFIN through the PC last) still stands. Two sentences must change:
  - connect.md's "whether Plaid reaches [Fidelity] now is unconfirmed" should become "Plaid lists Fidelity as an OAuth bank,
    and Boldin links Fidelity NetBenefits through Meld (Plaid/MX/Finicity); a hobby app cannot easily get that access."
    connect.md's main point still holds: no aggregator returns the deferral rate or the match formula.
  - ux.md 4.11's "Even Boldin lists account linking as Coming soon" must be deleted. The Document Vault point stands.
- **Phone copy to PC server.** On Android/Chrome, the Pages copy *could* call the PC by its LAN IP after a permission prompt.
  The server would need CORS for the Pages origin and would need to accept the token over plain HTTP on the LAN. On iPhone,
  assume no. The recommendation "open the app from the PC's own address" stays the simple, cross-browser answer.
- **Competitor table (ux.md section 2).**
  - Fix the T. Rowe Price row: 1,000 scenarios, to 92/94, not 500/95. Move the 80th-percentile income to a separate
    "T. Rowe Price workplace" mention.
  - Fix the Empower row: the sliders belong to the workplace income estimate, not the Retirement Planner.
  - Mark Vanguard as a 2019 description.
- **Section 1033.** The status is accurate for 2026-11-11, and stronger than written: the proposal is still pending at OIRA,
  and the Federal Register shows no proposed rule and nothing on public inspection.
- **Licences.** Nothing found blocks the plan. ofxtools is the only GPL item and is already marked "never copy". If any ofx4js
  file is copied, keep its Apache-2.0 notice. Credit ofx-js to Apps Attic Ltd.
