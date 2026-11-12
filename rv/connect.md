# Connecting accounts: what is possible, easy and well documented (research, 2026-11-11)

Scope: the owner asked whether accounts can be connected by API or by uploading statements, "only if it is possible,
easy and well documented". This report covers the services, the file formats, the law, what this repo already does,
and an order to build. Every outside claim carries a source and the day it was read (all read **2026-11-11**).
Claims marked **measured** were checked by a request from this session on that day, not just read.

Repo state read: `$REPO` (HEAD c6fb730 on claude/creative-build-b531q0). The shared app copy
walked on a 390 px phone (sandbox, family household) was the kit's copy at 1dd3773.

---

## 0. The answer in plain words

| Way to bring data in | Possible? | Easy? | Well documented? | Phone copy (GitHub Pages, no PC)? | Verdict |
|---|---|---|---|---|---|
| **Bank/card files: OFX, QFX, QBO** (the "Quicken / QuickBooks download") | yes | yes (small pure-JS parser, tested here) | yes (open spec, MIT parsers) | **yes**, read in the browser | **Build first** |
| **Brokerage/401(k) positions in OFX/QFX** (same file, `INVPOSLIST`) | yes | yes | yes | **yes** | Build with the above |
| CSV from banks and brokerages | already built (Import, Holdings) | - | - | yes | keep |
| **PDF statements with a text layer** (most bank, brokerage and 401(k) statements) | yes | medium: summary lines are reliable, holdings tables less so | pdf.js is Apache-2.0, well documented | **yes if pdf.js runs in the browser** (today only on the PC) | Build second, aimed at the retirement inputs |
| **SimpleFIN Bridge** (paid aggregator, $15/yr to the person, read-only) | yes | yes: one token, one GET | short but clear protocol + developer guide; Actual Budget (MIT) uses it | technically yes (CORS is open, **measured**), but only by keeping a bank-read secret in the phone's `github.io` storage: rule 10 and a shared-origin risk say **no by default** | Build third, **through the PC server**, after the owner says yes to paying |
| Plaid | yes for a hobbyist (free Trial: 10 accounts-logins for life) | no: needs a server holding a secret, a developer account, and coverage of Fidelity/401(k)s is uncertain | yes | **no** (API has no CORS, **measured**; secret must stay server-side) | Not now |
| Teller | yes (free developer tier, 100 live connections) | no: client certificate (mTLS) on a server | yes | **no** | Not now: banks and cards only, no investment or 401(k) accounts |
| MX, Finicity (Mastercard Open Finance), Akoya, Yodlee | sandbox only for an individual | no: production needs a company, contract, review | yes, for businesses | no | Not for a personal app |
| OFX Direct Connect (Quicken-style live download) | dying | - | the directory (ofxhome) is gone | no | **Do not build** |
| CFPB section 1033 "open banking" rights | rule exists on paper, enforcement blocked by a court, rewrite pending | - | - | - | Nothing to build against yet |

What the phone copy cannot do without a server, honestly:
- It cannot use Plaid or Teller at all (secret / client certificate must live on a server).
- It can call SimpleFIN directly, but only by keeping the long-lived access address on the phone; on GitHub Pages
  that storage is shared by every project site of the same GitHub account (docs/PLAN.md, "On a static host"), and
  AGENTS.md rule 10 forbids a new place to keep a token. So: not without the owner's explicit yes.
- It cannot reach the PC server either, unless the PC is served over HTTPS: the Pages copy is `https://`, the PC is
  `http://`, and browsers block `fetch()` from an HTTPS page to an `http://` address as mixed content (MDN, read
  2026-11-11, https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content). "Through the server on your PC"
  therefore means: open the app from the PC's own address (home Wi-Fi or Tailscale), as docs/NETWORK.md describes.
- It cannot read photos or scanned PDFs (that needs the vision model on the PC).
- It **can** read every file format above (CSV, OFX/QFX/QBO, text PDFs once pdf.js is loaded in the browser).

---

## 1. SimpleFIN Bridge

**What it is.** A small paid service that sits between a person's bank logins and the apps they choose. The person
signs up, adds their banks, and gets a one-time *setup token* to paste into an app. SimpleFIN outsources the bank
connections to MX: "We outsource to MX to securely store and access your financial institutions" and "No bank account
credentials ever touch our servers" (https://beta-bridge.simplefin.org/info/security, read 2026-11-11). The same page
reports an MX incident on 2026-05-28 that may have let up to 39 users see each other's transaction data, balances and
names for about four hours; no bank credentials were exposed.

**Cost to the person.** "$1.50 + tax per month, or $15.00 + tax per year"; "Connect up to 25 institutions and 25 apps
for either" (https://beta-bridge.simplefin.org/, read 2026-11-11; bridge.simplefin.org redirects there). Actual Budget's
docs say the same, and that a subscription is needed before the first account can be added
(https://actualbudget.org/docs/advanced/bank-sync/simplefin/, read 2026-11-11). The app developer pays nothing and does
not register: the developer guide only describes the user generating a token
(https://beta-bridge.simplefin.org/info/developers, read 2026-11-11).

**How many banks.** No total is published. The site has a search (https://beta-bridge.simplefin.org/search-institutions,
**queried** 2026-11-11, US/Canadian institutions only). Retirement-relevant entries found: "Fidelity Investments",
"Vanguard", "Vanguard Retirement - Ascensus", "Empower Retirement", "Principal Financial - Retirement",
"Charles Schwab Retirement", "Schwab - Retirement Plan Login", "Chase Bank". No separate "NetBenefits" entry. Being
listed is not the same as working well: community reports call Fidelity via MX "spotty" or needing MFA again every few
weeks (search summary of r/liquidbudget and Google Groups beancount threads, read 2026-11-11; anecdotal).

**The flow (from the protocol, https://www.simplefin.org/protocol.html, read 2026-11-11; v2.0.0-draft).**
1. The person copies a setup token: Base64 of a claim URL.
2. The app decodes it and sends `POST` to the claim URL. `200` returns the *Access URL*, "just a URL with included
   Basic Auth credentials". `403` = token unknown or already used ("may indicate the user's data is compromised").
3. The app keeps the Access URL (it is the secret) and calls `GET <access>/accounts`.
   Parameters: `start-date`, `end-date` (Unix seconds), `pending=1`, `account=<id>` (repeatable), `balances-only=1`,
   `version=2`.
4. Response: `errlist` (structured errors `gen.*`, `con.*`, `act.*`), `connections` (`conn_id`, `name`, `org_id`,
   `org_url`, `sfin_url`), `accounts[]` with `id`, `name`, `conn_id`, `currency`, `balance`, `available-balance`,
   `balance-date`, `transactions[]` (`id`, `posted`, `amount`, `description`, optional `transacted_at`, `pending`,
   `extra`). HTTP `402` = payment required, `403` = access revoked.

**Measured with the public demo token** (the developer page gives one; claimed and fetched 2026-11-11):
- Claim returned `https://demo:[email removed]/simplefin`.
- `/accounts?version=2` returned 3 accounts; each transaction had `id`, `posted`, `amount`, `description`, **`payee`**,
  **`memo`**, `transacted_at`, **`mcc`** (merchant category code); each account had a **`holdings`** array
  (`symbol`, `shares`, `market_value`, `cost_basis`, `purchase_price`, `description`, `created`, `currency`).
  `holdings` is **not in the protocol spec**: treat it as a Bridge extension whose real coverage depends on MX.
- `x-api-message`: "Provide a 'start-date' parameter to receive transactions prior to yesterday".

**Limits (developer guide, read 2026-11-11).** "24 requests or fewer per day"; each request spans at most "90 days at a
time"; total history "varies for each institution"; data is meant as "daily updates"; schedule at a random minute;
overlap windows by about 5 days; always show `errlist` to the user; a setup token works once.
Actual's docs: updates "one time / day, roughly every 24 hours"; "at most 90 days of data".

**Browser or server? Measured 2026-11-11** with `Origin: https://example.github.io`:
- `OPTIONS /simplefin/accounts` -> `200`, `access-control-allow-origin: https://example.github.io` (origin reflected),
  `access-control-allow-credentials: true`, `access-control-allow-headers: authorization`,
  `access-control-allow-methods: GET`.
- `POST` claim -> `200` with the same `access-control-allow-origin`. (A bodiless POST needs no preflight.)
- So a browser *can* claim and read directly. One detail: `fetch()` refuses URLs that carry `user:pass@`, so the page
  must split the Access URL and send `Authorization: Basic ...` itself (Actual does the same split on its server).
- The protocol and guide say nothing about CORS: it is observed behaviour, not a promise.
- The reason not to do it on the phone is the secret, not the network (section 0).

**How Actual Budget (MIT) integrates it.** Server side, file
`packages/sync-server/src/app-simplefin/app-simplefin.js` (548 lines, read from
https://raw.githubusercontent.com/actualbudget/actual/master/packages/sync-server/src/app-simplefin/app-simplefin.js,
2026-11-11; licence MIT, "Copyright James Long", https://raw.githubusercontent.com/actualbudget/actual/master/LICENSE.txt).
What it does, in order: keeps the setup token and the Access URL in its server secrets store (`secretsService`,
`SecretName.simplefin_token` / `simplefin_accessKey`); `decodeClaimUrl` (Base64 -> URL, http/https only);
`claimAccessKey` (POST, `redirect: 'manual'` and an allow-list check against SSRF); `parseAccessKey` (split
`scheme//user:pass@rest`); `getAccounts` (Basic auth header, `start-date`/`end-date`/`pending=1`, or `balances-only=1`
on first link; follows at most 5 redirects by hand and drops the Authorization header when a redirect leaves the
origin); pending transactions are kept apart. Actual needs its server for this ("The keys from this value will be saved
on the server", docs page above). Latest Actual release on npm: `@actual-app/api` 26.11.0, published 2026-11-02
(https://registry.npmjs.org/@actual-app/api, read 2026-11-11). This is the pattern to copy (MIT, note it in the README).

---

## 2. Plaid

- **Individual access.** Since 2026-04-15, new US/Canada teams get a free **Trial** plan: "Limited to 10 Items; upgrade
  to a paid plan to access more Items"; removing Items does not free slots; Trial products include Transactions,
  Investments, Liabilities, Balance, Statements (https://plaid.com/docs/account/billing/, read 2026-11-11). The billing
  page names "hobbyist use" as a fit for Trial and Pay-as-you-go. Plaid support says to pick "Personal use" at
  dashboard sign-up (support.plaid.com article [number removed], seen in search results 2026-11-11; the page itself
  returned 403 to a direct read). The old free Development environment was retired on 2024-06-20, replaced by Limited
  Production, which is closed to new US/CA teams since 2026-04-15 (https://plaid.com/docs/quickstart/glossary/ via
  search, read 2026-11-11).
- **Pricing after Trial.** No dollar figures in the docs; Transactions and Investments are monthly subscriptions per
  linked login; Balance is per request; prices shown after applying for Production (billing page above).
- **A server holding a secret is required.** Link (the browser widget) needs a `link_token` made with `/link/token/create`,
  and the `public_token` it returns is exchanged on a server for the long-lived `access_token`
  (https://plaid.com/docs/link/web/ and https://plaid.com/docs/quickstart/, read 2026-11-11: "on the server side, the
  Quickstart calls /item/public_token/exchange"; "you'll need to securely store your access_token").
  **Measured:** `OPTIONS https://production.plaid.com/accounts/get` and `https://sandbox.plaid.com/link/token/create`
  with a foreign Origin -> `404`, no `Access-Control-Allow-Origin`: a browser cannot call the API.
- **OAuth banks.** "Access to Production (via either a paid plan or a trial) is a prerequisite for supporting OAuth";
  Trial teams skip the security questionnaire until they upgrade; Schwab "may take up to 5 business days"
  (https://plaid.com/docs/link/oauth/, read 2026-11-11). Whether every OAuth bank actually links on Trial is not stated.
- **Investments.** Holdings (with `tax_lots`), securities, and up to 24 months of investment transactions, US/Canada
  "investment-type accounts"; no statement of 401(k) coverage (https://plaid.com/docs/investments/, read 2026-11-11).
- **Verdict.** Possible for one household on the PC server (10 logins, free), but not easy (developer account, server
  secret, Link flow, OAuth registration) and the retirement coverage that matters most here is uncertain (Fidelity moved
  to API-only access through Akoya in 2023; whether Plaid reaches it now is unconfirmed: riabiz.com 2023-10-19 article
  and Lunch Money feedback thread, via search 2026-11-11).

## 3. Teller, MX, Finicity, Akoya, Yodlee

- **Teller.** "Teller is free for independent developers and teams prototyping ideas"; "Our developer tier includes 100
  live connections"; production prices Verify $1.50/account, Balance $0.10/call, Transactions $0.30/enrollment/month,
  Identity $1.75/call; "more than 7,000 financial institutions" (https://teller.io/, read 2026-11-11). Every call with
  real data needs mTLS with a Teller client certificate, and "You must never share or distribute your private key"
  (https://teller.io/docs/api/authentication, read 2026-11-11): server only. Account types are `depository` and
  `credit` only (https://teller.io/docs/api/accounts, read 2026-11-11): **no brokerage, IRA or 401(k)**.
  (A CORS probe to api.teller.io was reset by this session's proxy; not measured.)
- **MX.** Development environment capped at 100 users and some institutions; production is requested from the dashboard,
  billing first, then a representative, several days (https://docs.mx.com/api-reference/platform-api/overview/architecture-and-security
  and https://docs.mx.com/resources/atrium/going-to-production, via search 2026-11-11). Business-oriented; no individual tier found.
- **Finicity / Mastercard Open Finance.** Free sandbox; "Test Drive Premium" is 30 days of free production, then the
  billable Production plan; production credentials only after Mastercard reviews the request
  (https://developer.mastercard.com/open-finance-us/documentation/quick-start-guide/, via search 2026-11-11). Not
  practical for a personal app; Principal reportedly tightened aggregator access in summer 2025
  (https://meetbeagle.com/resources/articles/connecting-principal-401k-mint-ynab-monarch-finicity-changes-2025, via search; vendor blog).
- **Akoya** (bank-owned network: Fidelity, large banks, The Clearing House). Free sandbox; production asks how "your
  company" will consume data, expected volume and security documentation; every recipient passes security and risk
  review (https://docs.akoya.com/docs/requirements, via search 2026-11-11). For companies, not individuals.
- **Yodlee.** Free sandbox with five test users; production by 90-day trial then paid plans without public prices
  (https://developer.yodlee.com/pricing and .../docs/environments, via search 2026-11-11). Sales-led.
- **Context.** JPMorgan now charges aggregators (Plaid, Yodlee, Morningstar, Akoya) for data pulls under deals reported
  Sept-Nov 2025 (https://thepaypers.com/fintech/news/jpmorgan-chase-reaches-paid-data-access-agreements-with-aggregators,
  https://www.emarketer.com/content/jpmorgan-open-banking-fees-plaid-yodlee-morningstar, via search 2026-11-11). Prices
  to end users may rise; SimpleFIN's flat $15/yr is the person's only visible cost today.

## 4. OFX Direct Connect (Quicken-style live download) in 2026

Effectively over for the large US institutions:
- Bank of America ended all OFX services on 2025-09-30 (https://community.quicken.com/discussion/7966609/9-30-25-bank-of-america-web-connect-discontinued, read via search 2026-11-11).
- American Express discontinued Direct Connect (Moneydance support, Feb 2026, https://www.banktivity.com/support/articles/tag/american-express/ and infinitekind threads, via search).
- Merrill was "the last" Direct Connect institution for one KMyMoney user, Nov 2025 (https://mail.kde.org/pipermail/kmymoney-devel/2025-November/035359.html).
- Fidelity, Vanguard and Schwab have dropped or are dropping it in favour of aggregator connections (Moneydance "Fidelity Access" thread; https://www.banktivity.com/support/articles/tag/vanguard/; Quicken community, via search 2026-11-11).
- GnuCash list, Dec 2025: Direct Connect "effectively dead in the US"; the bank directory ofxhome.com no longer exists (https://lists.gnucash.org/pipermail/gnucash-user/2025-December/118449.html).
- The **file** download (Web Connect: a .QFX/.OFX file from the bank's site) still exists at many institutions; that is
  what to support. Do not build a Direct Connect client (banking.js is mostly that, and it is dormant: see 6).

## 5. CFPB section 1033 (Personal Financial Data Rights) in November 2026

- Final rule published 2024-11-18 (https://www.federalregister.gov/documents/2024/11/18/2024-25079/required-rulemaking-on-personal-financial-data-rights).
  Compliance was to start 2026-04-01 for the largest providers and run to 2030 by size (Cozen O'Connor alert, 2026-04-09,
  https://www.cozen.com/news-resources/publications/2026/section-1033-compliance-date-open-banking-rule-enjoined-and-under-reconsideration).
- *Forcht Bank v. CFPB*, E.D. Ky. No. 5:24-cv-00304: preliminary injunction **2025-10-29** barring enforcement until the
  CFPB finishes reconsidering the rule (order: https://infobytes.orrick.com/wp-content/uploads/2025-10-29-Order-Granting-Injunction-1.pdf;
  https://bankingjournal.aba.com/2025/11/kentucky-federal-court-enjoins-cfpb-from-enforcing-current-1033-final-rule/, via search 2026-11-11).
  The April 2026 date "passed without binding enforcement" (Cozen, above). Sixth Circuit appeals are reported held in
  abeyance with 60-day status reports (openbankingtracker summary via search; secondary).
- Reconsideration: ANPR 2025-08-22 on four issues: who may act as the consumer's representative, fees, security, privacy
  (https://www.federalregister.gov/documents/2025/08/22/2025-16139/personal-financial-data-rights-reconsideration).
  A new proposed rule went to White House review (OIRA) around 2026-08-04
  (https://www.consumerfinancemonitor.com/2026/08/06/cfpb-sends-new-section-1033-open-banking-proposal-to-oira-for-review/).
  **Federal Register API queried 2026-11-11: no proposed rule published yet**; the newest CFPB item on the topic is the
  regulatory agenda of 2026-08-14.
- The 2024 rule also has data providers give consumers a machine-readable file on request
  (12 CFR 1033.301(b), https://www.law.cornell.edu/cfr/text/12/1033.301, read 2026-11-11), but nothing enforces it now.
- **What it means for this app:** nothing to build against. No free, standard consumer API is coming in 2026; access
  stays through aggregators (with bank fees possibly allowed in the rewrite) or through files the person downloads.
  Files are the durable path; revisit if a final rule lands with a consumer file or personal-use access.

## 6. Statement files: formats and open-source parsers

Formats: **OFX** (SGML 1.x or XML 2.x), **QFX** (Quicken's OFX with an Intuit header), **QBO** (QuickBooks Web Connect,
also OFX). One parser reads all three. Inside: bank/card statements (`STMTRS`/`CCSTMTRS` with `STMTTRN`: `FITID` stable
id, `DTPOSTED`, `TRNAMT`, `NAME`, `MEMO`; `LEDGERBAL` balance and date) and investment statements (`INVSTMTRS` with
`INVPOSLIST` positions: units, price, market value; `INVBAL` cash; `SECLIST` names and tickers). CSV exports vary by
institution (already handled by `core/csv.js` + `detectMapping`, and `parsePositions` for Fidelity/Schwab/Vanguard
positions).

| Parser | Licence (checked) | Last release | Notes |
|---|---|---|---|
| **ofx-js** (github.com/bradenmacdonald/ofx-js) | MIT (LICENSE file) | 1.1.2, 2026-09-30 (npm) | "Work in any JS environment (no dependencies at all)", OFX + QFX, TypeScript types. Best library candidate if one is wanted. |
| **ofx-data-extractor** (github.com/Fabiopf02/ofx-data-extractor) | MIT | 1.5.0, 2026-03-24 | Node and browser builds, ESM, no deps. |
| **Actual Budget `ofx2json.ts`** (packages/loot-core/src/server/transactions/import/ofx2json.ts, 190 lines) | MIT | in Actual 26.11.0 | SGML->XML fix-up + `xml2js`; bank, card, and only the cash part of investment statements (no positions). Good reference for encoding (`CHARSET:1252`) and quirks. |
| node-ofx-parser (LucasBremm) | MIT | 0.5.1, 2021-03-01 | uses fast-xml-parser |
| ofx (chilts/node-ofx) | MIT | 0.5.0, 2020-02-13 | uses xml2json (native build) |
| ofx4js | MIT | 2.1.0, 2019-02-26 | large, client-oriented |
| banking.js (euforic) | MIT (README; no LICENSE file) | 1.2.0, 2018-10-15 | mostly a Direct Connect client, Node-only (xml2js). Skip. |
| ofxparse (Python) | MIT | - | reference only (Python) |
| **ofxtools** (Python) | **GPL v3** (LICENSE header "This program is free software...") | - | **never copy** (rule 11) |
| **Papa Parse** | MIT | 5.7.1 (npm, 2026-11-11) | not needed: `core/csv.js` already works |
| **pdf.js / pdfjs-dist** | **Apache-2.0** | 6.5.438 (npm 2026-11-01; cdnjs lists 6.5.438) | repo already depends on ^6.3.289 for the PC. Browser build on jsDelivr **measured**: `build/pdf.min.mjs` 458,705 bytes + `build/pdf.worker.min.mjs` 1,265,413 bytes (6.3.289). |

(npm metadata from https://registry.npmjs.org/<name>; licence files from raw.githubusercontent.com; all read 2026-11-11.)

**Easy, proven here.** A pure OFX reader (no DOM, no dependencies, importable in Node, so it fits `compute.js` rule 3)
took **32 lines** in a scratch prototype and read both an OFX 1.x SGML file (checking account + 401(k)-style positions
with `SECLIST` names) and an OFX 2.x XML credit-card file correctly: balances, dates, `FITID`s, payees (with `&amp;`
decoded), positions with ticker, shares, price, value.
Files: `$SP/rv/ofxproto/ofx.mjs`,
`.../ofxproto/sample.qfx`, `.../ofxproto/sample2.ofx` (invented data). Either write our own like this (no licence note
needed) or copy ofx-js (MIT, note it in the README).

**PDF statements: how reliable is text extraction?** (engineering judgment from this repo's own reader, not a cited study)
- Statements generated by the provider's system (nearly all bank, card, brokerage and 401(k) e-statements) have a text
  layer. pdf.js returns positioned text runs, not tables; `server/statements.mjs` already rebuilds lines from glyph
  positions, and `parseStatementText` reads transaction rows from them.
- **Reliable:** label-value lines: "Ending balance", "Statement period", "Vested balance", "Your contributions",
  "Employer contributions", "Year-to-date", "Contribution rate". `ai/reader` already reads "ending balance / statement
  period" this way.
- **Less reliable:** multi-column holdings and "balance by source" tables (columns drift, wrapped fund names, totals
  rows). Workable with the line rebuild plus per-provider tolerance, and always shown for the person to check.
- **Unreliable without the PC:** scans and photos (need the vision model; `transactions/statements` already does this on the PC).
- What a 401(k) statement must contain: quarterly for participant-directed plans; total benefits accrued, the vested
  (nonforfeitable) part, and "the value of each investment" (29 U.S.C. 1025(a)(1)(A) and (a)(2),
  https://www.law.cornell.edu/uscode/text/29/1025, read 2026-11-11). A breakdown by source (pre-tax, Roth, employer
  match) is common on recordkeepers' statements but **not** required by that section: treat it as "read it when present".

## 7. Retirement accounts (401(k), 403(b), IRAs) specifically

- Aggregator coverage of employer plans is the weakest part of every service. Community and vendor reports (all via
  search 2026-11-11, mostly anecdotal): Fidelity NetBenefits fails across Plaid, MX and Finicity for some Monarch users
  (Jan 2026); Empower, Principal, TIAA, Transamerica "varying connection quality"; Principal blocked many aggregators in
  summer 2025; Fidelity ended screen scraping in 2023 and routes through Akoya.
- SimpleFIN lists Fidelity Investments, Vanguard, Vanguard Retirement (Ascensus), Empower Retirement, Principal
  Retirement and Schwab Retirement (**queried** 2026-11-11), with no promise of holdings or contribution detail.
- Files: Fidelity's export FAQ says the History page can download CSV, but "You cannot download NetBenefits 401(k),
  403(b), 457 accounts" through its QuickBooks route (https://www.fidelity.com/customer-service/faqs-exporting-account-information,
  via search 2026-11-11); users report NetBenefits transaction CSVs exist in practice. Many recordkeepers offer only PDF statements.
- **Conclusion:** for the owner's retirement questions (did they enter the contribution, the match, the Roth/pre-tax
  split), the dependable sources are the **pay stub** (deferral per paycheck, pre-tax vs Roth lines, employer match on
  some stubs) and the **quarterly 401(k) statement PDF** (balance, vested balance, contributions by source). No
  aggregator returns "your deferral rate" or "your match formula". Reading those two documents well is worth more for
  retirement than any live connection.

---

## 8. What this repo already does (read 2026-11-11)

| Piece | State | Phone copy? |
|---|---|---|
| `modules/transactions/import` | usable, CSV/TSV/pasted text; `detectMapping`, dedupe by `key` = account+date+amount+payee, gap warnings, profiles. README: "OFX/QFX/JSON are not read yet"; file picker accepts `.csv,.txt,.tsv`. | yes |
| `modules/investments/holdings` | usable; `parsePositions` for Fidelity, Schwab, Vanguard positions CSV (`qa/fixtures/positions-*.csv`) | yes |
| `modules/transactions/statements` | usable on the PC only: `POST /api/statement/read`, pdf.js text layer -> rows, else text model, else vision model. On the phone it says "This page needs your computer". | **no** |
| `modules/ai/reader` | usable: pasted text or `.txt`; PDFs only through the PC (`POST /api/document/text`). Reads pay stubs (incl. 401(k) amount), statements (ending balance, period), Social Security statements, advisor plans; proposals applied one by one. On the walked phone page: "Pick a text file" only. | text only |
| `modules/transactions/connect` | **planned placeholder** (phase 3): "Connects your bank accounts through SimpleFIN or Plaid so transactions sync automatically through the server on your computer." Shows "This page is not ready yet." | - |
| `server/server.mjs` | zero dependencies, Node 20 `fetch`; `planner.properties` re-read on `GET /api/config`; `publicConfig()` only copies `ai.*` (minus `ai.apiKey`) and `feature.*`, so a new `simplefin.accessUrl` key would never reach a browser; static `DENY` list blocks `planner.properties` and `data/`. No bank routes. | - |
| `vendor/` | not present in this clone (git-ignored); `docs/RESOURCES.md` lists SimpleFIN (~$15/yr), Plaid ("free development tier": **outdated**, retired 2024-06-20), banking.js and "ofx-js" (the link points at `Reactive-Extensions/ofx-js`; the maintained package is `bradenmacdonald/ofx-js`), pdf.js. | - |
| Device secrets precedent | `core/api.js` keeps `planner.connection` in localStorage: `{ serverUrl, token, ai: { ..., apiKey } }`. So a device already holds the PC token and an optional AI key. | - |
| `docs/WORKBOARD.md` 2026-10-31 03:01 (claude-b) | already proposed the SimpleFIN design: `POST /api/bank/simplefin/claim` (server exchanges the token, writes `simplefin.accessUrl` to planner.properties, never returns it), `GET /api/bank/simplefin/accounts?since=`; link each SimpleFIN account to a plan account; import through `transactions/import`'s duplicate check. Waiting on two owner decisions: pay for SimpleFIN, and may the server write planner.properties. | - |

---

## 9. Recommendation and order to build

Principle: the owner's real worry is a retirement answer built on wrong inputs (401(k) contribution missed, match
wrong, savings not counted as invested). Data import earns its place when it **fills or checks those inputs**, shows
where each number came from, and lets the person correct it. Live bank feeds mostly help spending, which is secondary
for that worry.

1. **OFX / QFX / QBO in Import (bank and card), phone and PC.** Pure parser in `transactions/import/compute.js`
   (own ~30-60 lines or ofx-js, MIT). Accept `.ofx,.qfx,.qbo`. Use `FITID` as a stable duplicate key (new optional
   field, e.g. `transactions[].extId`; optional = no version bump, update DATA_MODEL.md, rule 7). The file names its
   own account (last 4 digits) and dates, so the account box can be pre-picked and the gap warning works as today.
   Offer the file's `LEDGERBAL` as "Update the balance to $X as of <date>?" (one tap, Update my balances logic).
   Decode by the header's `CHARSET` (1252) as Actual does. Effort: small. Value: medium (many banks and every brokerage
   offer "Quicken/QuickBooks" downloads; no column guessing at all).
2. **Positions from OFX in Holdings**, same parser: `INVPOSLIST` + `SECLIST` -> `mergePositions`. Gives 401(k) and IRA
   holdings where the provider offers a QFX download. Effort: small.
3. **Retirement statement and pay stub reading aimed at the retirement levers.** Extend `ai/reader`: a "retirement
   statement" kind (ending and vested balance, period, contributions this period and year to date by source: pre-tax,
   Roth, employer match) and stronger pay-stub lines (401(k) pre-tax vs Roth deduction, employer match when printed).
   Each figure becomes a proposal on the exact input the retirement page says drives the answer ("Your statement says
   the employer put in $1,240 this quarter; the plan counts $0 a year for the match. Use $4,960 a year?"). This feeds
   the owner's Roth/traditional split per person and account directly. Effort: medium. Value: **highest** for the
   owner's request.
4. **pdf.js in the browser** so items 3 and the text path of the Statement reader work on the phone copy: load
   `pdfjs-dist` pinned from jsDelivr on demand inside the module's view (AGENTS.md allows cdnjs/jsdelivr scripts; keep
   `core/` dependency-free), pass the positioned text items to a pure line-rebuild function in `compute.js` (move the
   one in `server/statements.mjs`). About 1.7 MB the first time (less gzipped), nothing kept. Scans and photos stay
   PC-only and the page says so. Effort: medium.
5. **SimpleFIN through the PC server (`transactions/connect`)**, after the owner says yes to $15/yr and to the server
   writing `planner.properties` (or pasting the line by hand). Follow claude-b's 2026-10-31 design and Actual's
   `app-simplefin.js` (MIT, credit it): claim on the server (https only, host allow-list, no redirects), keep
   `simplefin.accessUrl` only in planner.properties (never in `publicConfig`, never returned), `balances-only=1` to link
   accounts, then at most a few fetches a day with 5-day overlap and 90-day windows, `pending` left out by default.
   Balances update `accounts[].balance/asOf/history`; transactions go through Import's rules and duplicate check
   (SimpleFIN `id` as `extId`); `holdings`, when present, through `mergePositions`. Show `errlist` in plain words;
   402 = "Your SimpleFIN subscription has lapsed"; 403 = "SimpleFIN no longer lets this plan read your banks: make a new
   setup token". New optional field such as `accounts[].link = { source: "simplefin", id, lastSync }`.
   Works for the phone only when the app is opened from the PC (home Wi-Fi or Tailscale), not from the Pages copy.
   Effort: medium-large. Value: medium (daily balances and spending without downloads; 401(k) detail not guaranteed).
6. **Not now:** Plaid (server secret, Trial is 10 logins for life, retirement coverage uncertain), Teller (no investment
   accounts; mTLS), MX / Finicity / Akoya / Yodlee (business contracts), OFX Direct Connect (dead), in-browser OCR of
   photos (heavy, weak on tables), a SimpleFIN token kept on the phone (rule 10; `github.io` storage shared across the
   account's project sites). Revisit section 1033 if a final rule lands.

**Owner decisions to ask (plain words):**
- "Linking banks automatically costs $15 a year, paid to a service called SimpleFIN, and needs your computer on. Do you
  want it?" If yes: "May the app write the key it gets into your computer's settings file, or will you paste it there?"
- "On the phone-only copy, may the app keep that key on the phone? It would sit in storage that other pages on the same
  GitHub site can read. We recommend no."

**Plain-words copy for the screens** (rule 14): page "Bring in your accounts" with three choices in this order:
"A file from your bank or card (CSV, or the 'Quicken' / 'QuickBooks' download)", "A statement (PDF)", "Link your
banks (SimpleFIN, $15 a year, needs your computer)". On the retirement page, next to each input that drives the
answer: "From your 401(k) statement of Sep 30" / "Guessed" / "Typed by you" with "Check it with a statement".

**Docs to correct when building:** `docs/RESOURCES.md` (Plaid's "free development tier" ended 2024-06-20; ofx-js link
should be bradenmacdonald/ofx-js); `transactions/connect` purpose drops "or Plaid".

## 10. Uncertainties

- SimpleFIN's CORS behaviour is observed, not documented; holdings are observed in the demo, not in the spec.
- Real institution reliability through SimpleFIN/MX for 401(k) recordkeepers is anecdotal; it should be tried with the
  owner's own accounts before promising anything on screen.
- Section 1033 appeal status details come from secondary summaries; the Federal Register check (no NPRM) is direct.
- PDF reliability for holdings tables is judgment from this repo's statement reader, not measured on real 401(k) PDFs
  (none in `qa/fixtures`; an invented 401(k) statement fixture would be needed).
