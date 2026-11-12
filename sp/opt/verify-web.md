# Skeptic's check of `opt/research.md`: the outside-world claims

Checked 2026-11-12 against the live pages. `$SP` =
`$SP`.
Nothing in the repo or the read-only worktree was touched. No server was started. Working files (downloads,
extracted text, scripts) are in `$SP/opt/vw/`.

## 0. The short answer

- **About 164 claims checked across 52 sources.** I opened 49 of the sources and searched each for the quoted
  words and figures. For 2 ([S24], [S49]) the cited address would not load and I read the same text from another
  official copy. 1 ([S46]) I could read only as a machine summary. Section 5 lists every address that failed.
- **The research mostly holds.** Authors, dates, study sizes and nearly every figure are on the pages. Most of the
  claims the research marked *(excerpt)* I could open, and they are right (Wealthfront, Monarch, Coinbase, the
  two Fidelity threads, GitHub, TurboTax, Iyengar, the iPhone camera).
- **Nine things are wrong or misleading** (section 1). Three of them change a rule, not just a citation:
  1. **Safari's find-in-page support is partial, not full.** The data the research cites marks it so, and the
     WebKit bug is still open today. The "caniuse and WebKit disagree" puzzle in its section 6 is this.
  2. **"More options" is a label the research's own source [S2] says never to use.** R5 and R10 make it a standard.
  3. **Marking only the optional boxes is what Baymard [S16] found to fail.** R10 asks for exactly that.
- **Six more are overstated or stretched** (section 2), and R13's "first five" is below its source's stated floor.
- **Two things the research did not look at** and should have, both about an iPhone (section 4): Safari deletes
  `localStorage` after seven days of not visiting, which bears on the device preference; and the app's
  `summary` already has its marker removed, which O'Hara [S29] names as a cause of lost state announcements.

How I checked: each source URL was downloaded with `curl` (or, where the site refused, opened in a real browser
through a fetch service, or read through WebFetch), converted to text, and searched for the quoted strings and
numbers. I did not read every page end to end; I read the passages around each claim. One fetch result was too
large to read whole (ten pages, 122,000 characters): I split it per page and searched it the same way.

---------------------------------------------------------------------------------------------------------------------

## 1. Wrong or misleading

### 1.1 Safari find-in-page: "supported from 26.2" leaves out that the support is partial (items 7, 1.6, R14, section 6)

- **Claim.** "since Safari 26.2 (2025-12-12) a closed one opens itself when the browser's find-in-page hits text
  inside [S33][S34]"; "WebKit's own release notes and MDN's data say 26.2, and I go with them"; "caniuse and WebKit
  disagree".
- **What the sources say.** The MDN browser-compat-data JSON the research cites [S34], read today, has for Safari
  on both `html.elements.details.search_match_opens` and `html.global_attributes.hidden.until-found`:
  `"version_added": "26.2", "partial_implementation": true, "notes": "The browser does not correctly scroll to
  the matching text. See bug 304174"`. `safari_ios` mirrors it.
- **The bug is open.** WebKit bug 304174, "Find-in-page should scroll to revealed matches", reported 2025-12-15:
  "Right now WebKit doesn't appear to scroll at all." Status **NEW**, last comment 2026-04-08, no assignee.
  https://bugs.webkit.org/show_bug.cgi?id=304174
- **Why caniuse says "not supported".** Its page is built from web-features, which does not count a partial
  implementation. `features/hidden-until-found.yml.dist` today lists Chrome 102 and Firefox 148 for the attribute
  and no Safari; only the `beforematch` event is credited to Safari 26.2. caniuse today shows Safari "3.1 - 27.1
  not supported, 27.2 not supported, 27.3 - TP not supported" and Safari on iOS not supported through 27.2. So
  there is no disagreement to pick a side in: all three sources describe the same partial state.
- **Truth for the app.** On an iPhone the fold opens, but the page does not move to the match. On a long page the
  person sees nothing happen. The benefit is real on Chrome and Firefox (Firefox 139 to 147 had the same fault;
  148 fixed it) and half real on Safari. R14's reason for native `<details>` still stands; the sentence in the
  twelve-line answer oversells it for the owner's phone.
- Everything else in that paragraph checks out: Chrome 97, Firefox 148, Chrome 102 for `until-found`,
  `details name` from Safari 17.2, `::details-content` from Chrome 131 / Firefox 143 / Safari 18.4, the
  `display: none / contents / inline` limit [S35], and the WebKit post of 2025-12-12 [S33].

### 1.2 "More options" is named by [S2] as a label to avoid (R5, R10, anti-pattern 4)

- **Claim.** R5 lists "More options" as one of the eight phrases and cites [S2] for "Label the door honestly.
  Avoid labels like 'More...'"; R10 puts everything else in "one 'More options' fold".
- **What [S2] says**, two places:
  "Scanning users often judge a link by its first word or two, so front-load the meaning: 'Advanced color
  settings,' never 'More options…'" and "Label the door honestly. Say what's inside: 'Advanced color settings,'
  never 'More…' A label that survives on its first 11 characters has earned its click."
- **Truth.** The quotation in the research is not on the page (the words "Avoid labels like" do not occur), and
  the source rules out the research's own phrase by name. By [S2]'s test the label should say what is inside
  ("Dates and notes", "Tax details"), and R5's own "N more <things>" form already does that.
- Related: Apple's page [S17] gives "Advanced Options" as its example of a *good* descriptive label; the
  research's anti-pattern 4 lists "Advanced" as a door with no scent. The two sources the research uses do not
  agree with each other on this word.

### 1.3 Baymard's 44% and "(optional)": the source recommends the opposite of R10 (1.2, R10)

- **Claim.** "on a form that marked only its optional boxes, 44% of test users came to a complete stop at a group
  of boxes with no marks [S16], so say '(optional)' in the label".
- **What [S16] says.** "44% of users came to a complete stop when reaching the last section of the shipping
  address form at Amazon, where only optional fields were marked. Users were unsure if the fields were required
  or optional (despite the header 'Optional Delivery Preferences')." The section was the optional one, under a
  heading that said so; it was not "a group of boxes with no marks".
- **The article's point** is its title: "E-Commerce Checkouts Need to Mark Both Required Fields and Optional
  Fields Explicitly". Its section "Why It's Problematic to Mark Only Optional Fields" reports that with only the
  optional fields marked, "32% of users during testing had a validation error because they did not complete a
  required field". Its fix: "Mark Both Optional and Required Fields".
- **Truth.** R10 as written ("Boxes a person may skip say '(optional)' in the label") is the pattern Baymard
  tested and found wanting. The evidence asks for both marks, or for a form where the split is unmistakable.
  The app has about 500 optional boxes and few required ones, the reverse of a checkout, so the transfer is
  uncertain either way; but the source cannot be cited for marking only the optional ones.

### 1.4 "18% of shoppers abandoned": the figure is 17% (1.2)

- All three Baymard pages cited under [S16], and Baymard's cart-abandonment list read today, say **17%**:
  "17% of users have abandoned due to checkout complexity" (checkout-flow article, 2024-06-26); "17% of users
  have abandoned a cart in the previous quarter due to a checkout form that was perceived to be too long or
  complicated" (form-design page); "17% Too long / complicated checkout process"
  (https://baymard.com/lists/cart-abandonment-rate). The 11.3 and 8 box figures are right.

### 1.5 The Word field study does not show that people like "a quiet switch to everything" (1.3, section 4)

- **Claim.** "people accept a quiet switch to 'everything' when nothing is taken away (toggle rated 4.5 of 5;
  13 of 20 preferred having it) [S18]".
- **What [S18] says.** The 13 of 20 "preferred Personal to either form of 2000": they ranked *MSWord Personal*,
  an interface each user built by picking functions, above Word with adaptive menus and Word with full menus.
  The 4.5 is the toggle's "ease of use". "Having two interfaces being a good idea only received a mean rating of
  3.9", and the authors say that question was read two ways.
- **Truth.** The study is evidence for an interface the *user* fills, with the full one a tap away. The
  research's preference is the other way round: the *designer* fixes the simple view and the tap shows more.
  The numbers are quoted correctly; what they are said to show is not what was measured. Also, the sentence used
  against modes ("when an interface is missing even one needed function ... frustration") is in the paper's
  introduction as "Preliminary research suggests ... [11]", a citation of other work, not a result of this study.
- All other figures from [S18] are right: 20 participants, four weeks, 14 of 19, 7 of 20 unaware, 6 of the 7
  who did not favour it gave up on personalising.

### 1.6 Iyengar: "ten or fewer options had the highest participation" (1.5)

- I opened the paper itself (Pension Research Council working paper 2003-10, the Wharton copy).
  "every ten funds added was associated with 1.5 percent to 2 percent drop in participation rate": **right**.
  But: "If there were only two funds offered, participation rates peaked at 75 percent, but when there were 59
  funds offered, participation rates dipped to a low of approximately 60 percent", and the abstract says
  participation "is higher in plans offering a handful of funds, as compared to plans offering ten or more".
- **Truth.** The peak is at two funds and the contrast is "a handful" against "ten or more". "Ten or fewer" puts
  the line on the wrong side.

### 1.7 "27% of recent reviews" is 27% of the low-star reviews (1.4, Fidelity)

- The unstar.app piece (2026-08-14): "We read 217 recent 1-3 star reviews ... 59 reviews, 27.2%, are about the
  redesign itself". It is a share of complaints, not of reviews. The research flagged the source as thin; the
  base is still stated wrongly.
- The same piece has a finding the research did not use and that cuts against R9: "13 reviews describe settings
  that do not persist across sessions. Column layouts, sort order, view preferences ... all reset." People
  complain when view choices are forgotten.

### 1.8 Six quotations are not the words on the page

Meaning is kept in each; none should stay in quotation marks.

| research | on the page |
|---|---|
| [S1] "yes, unless they abandon the task" | "Yes — unless users stop the task before completing the sequence" |
| [S1] "everything users frequently need up front" | "You have to disclose everything that users frequently need up front" |
| [S2] "Label the door honestly. Avoid labels like 'More...'" | see 1.2 |
| [S2] "Never hide decision-critical information such as price, requirements, risks" | "Never hide decision-critical information. Price, requirements, risks, and privacy terms stay on level 1, before commitment." |
| [S10] "if a user leaves and returns within the same session" | "if the user leaves and then returns to the page within the same page session" |
| [S45] "can only be traded on Advanced" | "you can only trade them on Coinbase Advanced" |

### 1.9 Gmail: the cited post names different options (1.4)

- [S49] is the 2011 Gmail blog post. Its text (read through the official blog's Google Groups mirror) says
  "Comfortable, Cozy, or Compact". "Default, Comfortable, Compact" is today's Gmail, confirmed on Google's
  support page (support.google.com/a/users/answer/11339703: "Under Density, choose an option: Default,
  Comfortable, Compact"). The claim is right for today; the citation is to the wrong page.

---------------------------------------------------------------------------------------------------------------------

## 2. Overstated or stretched (true on the page, more than the page supports)

1. **R13 "the first five" sits below the floor in its own source.** [S14]: "including at least 6 filtering values
   before truncating the rest seemed to be the lower limit (displaying less would confuse users, as they didn't
   see any logic in truncating such a short list and therefore simply assumed the list to be displayed in its
   entirety)". The research says five is its own choice; the source says what goes wrong below six.
2. **WCAG 3.2.4 and the 23 titles (1.6).** The Understanding page limits the criterion to repeated components
   and says "Consistent identification does not require identical labels, names, or text alternatives ...
   differences may be appropriate when they better reflect the component's purpose or context". 23 titles for
   one job is a consistency problem worth fixing; calling it "the gap" against an AA criterion is not secure.
3. **R1 "under 5% of people ever change or seek out more [S19]".** Spool's figure is people who changed any
   setting in a Word settings file. Nothing in it is about opening a fold or looking for more.
4. **"The two-level limit is, in its author's words, an estimate [S2]".** The sentence reads: "Stop at 2 levels.
   Each additional level multiplies clicks and halves discoverability. (My estimate, not a measurement ...)".
   The estimate is most naturally the multiply-and-halve claim. The 2006 article [S1] grounds the limit in
   practice ("In practice, designs that go beyond 2 disclosure levels typically have low usability").
5. **Modes [S7].** "no modes where a slip costs money or data": the page lists "accidental loss of work,
   deletion of data, embarrassment, or physical-safety consequences"; money is not there. More important, the
   same article has a section "Not Different Views of the Data Space: Modes are not different ways of looking at
   the same data." So [S7]'s costs apply to a Simple/Detailed switch only where a feature or an input's meaning
   differs between the two. That supports section 4 point 1 of the research and weakens [S7] as a blanket
   citation in anti-pattern 1.
6. **Apple [S17].** "Use no more than one disclosure button in a single view" is about the *disclosure button*
   (the control beside the Save field), not about labelled folds; the label advice is for *disclosure
   triangles*. And the page says "A disclosure triangle points inward from the leading edge when its content is
   hidden and down when its content is visible", which is the turn the app's marker makes today. The research's
   point about "›" still holds on NN/g's evidence [S6] and because the app puts it at the trailing edge, where
   an iPhone uses a chevron for "goes to another screen"; but the platform convention is not as one-sided as
   item 10 of the twelve-line answer reads. Apple does say a disclosure *button* "points down when its content
   is hidden and up when its content is visible", which is R6's proposal.

Smaller notes, no change needed:
- [S6] was run on mobile *navigation menus* with the icon at the right edge; the authors add that results "may
  not generalize" to a left-placed icon. It also found the right-facing arrow "was NOT significantly associated
  with an expectation of going directly to a new page": it is no better than a nonsense icon, not worse.
- [S13] has an exception the research omits: "'Horizontal Tabs' Can Work for Secondary Content Subsections".
- Boldin's detailed budget is a paid feature: the pricing page lists "Detailed future budgeting" under
  PlannerPlus and not under the free Basic tier (read through WebFetch, not raw text). "Detail per input, not
  per app" is right about the screens and silent about the price split. ProjectionLab likewise has Basic and
  Premium tiers. Neither page mentions a simple or advanced mode.
- Monarch's switch changes a number: its help has a question "Why does my 'Left to Budget' amount change when I
  switch between Flex Budgeting and Category Budgeting?" It is also the model for R8: "any settings saved with
  one option will be preserved in case you decide to switch back".
- In one Fidelity thread a user asks for exactly the thing the research rejects: "I don't see why we couldn't
  have 1. 'simple' mode & advanced mode. Tap button to switch between them, the end." Fidelity's own answer
  (Trader+ mode in General settings) is a mode.
- WebKit bug 284804 (the `aria-expanded` regression): opened and confirmed, on macOS 15.1.1 and iOS 18.1.1; a
  tester reports it working again on macOS 15.4 / Safari 18.4; status still NEW.
- Coinbase: Advanced Trade was announced 2022-06-22; the move off Coinbase Pro finished 2023-11-20.

---------------------------------------------------------------------------------------------------------------------

## 3. Verified (opened, and the claim is on the page)

| source | what I confirmed |
|---|---|
| [S1] NN/g 2006-12-03 | definition; "usually not"; the two requirements; "strong information scent"; "beyond 2 disclosure levels typically have low usability"; three of five usability components; helps advanced users too |
| [S2] Nielsen 2026-07-09 | page exists with that date; training wheels 1984, "almost 1/4"; "interaction tax"; "A hidden convenience costs a click; a hidden alarm costs an incident"; 80% and the workbench test; "splits tasks by frequency, not people by skill"; "expert mode" fantasies; lite and pro editions split "your codebase, your documentation, and your budget" |
| [S3] | "treat clicks like currency"; open several at once; state stays until the user changes it; show all when most is needed |
| [S4] 2023-07-30 | nested: "lose track of where they are"; "Avoid hiding any crucial information within the collapsed panels"; little content looks empty; auto-collapse blocks comparing; Expand All or expand at print |
| [S5] 2015-05-31 | the jump to the top read as a new page, then Back leaves; long sections; "Collapse" unused; first section open hid the overview; Back as close; do not scroll on opening |
| [S6] 2020-08-23 | 136 participants; caret best; arrow "should not be used for accordions"; no icon read as leaving; 29% of taps on the label |
| [S7] 2019-04-14 | "Same input, different results"; mode slips and low discoverability; "at least two visual indicators" |
| [S8] [S9] | representative and frequent values; "rarely utilize fancy customization features"; toggles act at once, not inside a form with Submit, labels not neutral |
| [S10] [S11] [S12] | all quotations; session storage and `rememberExpanded: false`; "some users avoid clicking the link"; "could confuse users" |
| [S13] | dates; repeatedly overlooked; expanded sections for short pages, collapsed for long; the 27% and 8% figures are indeed not on the page |
| [S14] [S15] | truncation beat full lists and inner scroll; 6 to 10; "Never Truncate a Single Value"; all eye-tracked participants noted the link; only when most do not need the box |
| [S16] | fields matter more than steps; 11.3 against 8 (the 18% and the 44% context: section 1) |
| [S17] | "Use no more than one disclosure button in a single view" (read from Apple's page data; scope: section 2) |
| [S18] | all figures (reading: 1.5) |
| [S19] [S20] [S21] | "Less than 5%"; "Microsoft must know what they are doing"; 40% to 80% for programmers and designers; every Office quotation; Office 12 off by default |
| [S22] [S23] | 85%; "anchor at a low default savings rate"; half after three years; "roughly offsetting on average"; both taxi quotations; Madrian and Shea's abstract has no figures |
| [S24] | 1.5 to 2 points per ten funds, in the paper itself (the rest: 1.6) |
| [S25] to [S28] | 2.5.8 is AA, 24 by 24, exceptions for spacing and inline; "For important links/controls, consider aiming for the stricter 2.5.5"; 2.5.5 uses 44 by 44; 2.4.11 is AA, "not entirely hidden due to author-created content"; technique C43 "Using CSS scroll-padding to un-obscure content" is listed as sufficient; 2.5.7 is AA and "an input beside a slider" is named as an alternative; 3.2.4 is AA with the quoted text |
| [S29] | headings in `summary` "not consistently exposed"; `role=button` drops state on macOS Safari; nested controls; not a base for menus or dialogs |
| [S30] [S31] | bug 230408 is NEW; the comment of 2023-10-25 on iOS 17.1 as quoted; bug 108979 fixed 2023-11-04; 241401 a duplicate, iOS 15 and 16 |
| [S32] | DAC audit July 2024; closed 2024-10-09; "fixed ... for VoiceOver on iOS versions 17 and 18", not older; pull request 5089 merged: `display: block` with `width: fit-content` |
| [S33] [S34] [S35] [S36] | section 1.1 |
| [S37] | message of 2024-09-07 exists |
| [S38] | "allows you to enter an aggregate amount for expenses"; 2023-10-18; Must Spend and Like to Spend; says nothing about what happens to the one number; 12 milestones in the stated order; 2026-09-15 |
| [S39] | all four entries with the stated versions and dates (4.1.0 2024-11-01, 3.4.0 2022-10-10, 3.0.0, 4.3.0 2025-06-23); no "simple mode" anywhere in the changelog |
| [S40] | Flex is the default; "one number"; switch in Budget > Settings (blog opened directly; help page opened in a browser) |
| [S41] | progress bars can be shown or hidden; "will reset when cookies or local storage are cleared"; Focused Views; the selected view is "device and browser-specific" |
| [S42] | "You can choose to include 100%, 50% or 0% of estimated social security benefits"; retirement age, life expectancy and other income can be changed (page opened in a browser) |
| [S43] | Trader+ mode, September 2025, "compact views for faster analysis", "Turn on Fidelity Trader+ mode in General settings"; both Reddit threads opened on reddit.com (2024-05-21 and 2024-05-25), strong objection to losing Classic after June |
| [S44] | "Some of the capabilities of Robinhood Legend may be different or absent" |
| [S45] | toggle from the user profile; "Coinbase will remember trading preferences"; "Fees on the two experiences vary"; funds in portfolios trade only on Advanced (all three pages opened in a browser) |
| [S46] | 2021-05-25; Lite "shed the order book information and advanced charting features"; Earn, P2P and Futures listed under Professional (WebFetch summary only) |
| [S47] | "Got into Forms Mode - how do I switch back to the online screens?" 2026-03-20; Step-by-Step and Forms on TurboTax Desktop |
| [S48] | "The mode you last used will become your preferred default" (2014-09-03); whitespace preference saved across pull requests (2026-10-22) |
| [S50] | Apple's iPhone User Guide: settings are saved "so they're not reset the next time you open Camera" only under Settings > Camera > Preserve Settings |
| [S51] | I re-ran `$SP/opt/printtest/t.mjs` into `$SP/opt/vw/print/`: same result. HeadlessChrome 153.0.8010.12: closed fold not printed, open one printed, `until-found` not printed, both fixes print it, 2 `toggle` events from a scripted open and shut |
| [S52] | `core/ui/base.css`: `scroll-padding-top` on `html`, `.fold > summary` is `display: flex` with `min-height: 44px`, `.notice-details summary` is `inline-flex` with `min-height: 32px` |

---------------------------------------------------------------------------------------------------------------------

## 4. Not in the research, and it matters on the owner's iPhone

1. **Safari deletes `localStorage` after seven days away.** WebKit, 2020-03-24: Intelligent Tracking Prevention
   deletes "all of a website's script-writable storage after seven days of Safari use without user interaction
   on the site", and `LocalStorage` is on the list; a web app added to the Home Screen has its own counter and is
   not expected to lose its data. https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
   Section 4 point 5 of the research stores the one device preference in `localStorage`. If the owner opens the
   app in Safari less than weekly, the preference can turn itself off. That is the "it changed by itself" the
   research warns about in [S20]. YNAB's own FAQ shows the symptom: "Why do my progress bars keep resetting?"
   I confirmed the 2020 policy at its source; I did not confirm that Safari 27 still applies it unchanged.
2. **The app's `summary` has no default marker** (`list-style: none`, `::-webkit-details-marker { display:
   none }`, and `display: flex`). O'Hara [S29], 2022: "VoiceOver, JAWS and NVDA all have an issue with
   consistently announcing the toggled state of the disclosure widget if this marker is removed." The research
   says neither `flex` value "is covered by the bug reports I found"; its own source covers the marker. This
   may be fixed since (iOS 17 changed a great deal), and GOV.UK's working fix also hides the marker (its
   stylesheet today: `display: block`, `width: fit-content`, `::-webkit-details-marker { display: none }`, its
   own `::before`), so it is a reason to test on a real iPhone, as the research already asks, not a finding.

---------------------------------------------------------------------------------------------------------------------

## 5. Unverified (could not open, or no source to open)

- **[S24] as cited**: the Penn repository page is a script-only shell and returned no content; the TIAA PDF failed
  twice (stream error, then 503). The claim was checked in the Wharton copy of the paper instead (1.6).
- **[S50] Apple discussions thread**: stopped by a "verify you are human" page. Checked against Apple's iPhone
  User Guide instead. The wording "goes back to Photo mode every time" is from third-party pages; Apple's page
  says only that settings are otherwise "reset".
- **[S49] the 2011 Gmail post at its own address**: the body does not load without scripts. Read through the
  Google Groups mirror (1.9).
- **[S46] Binance**: refused a browser fetch ("bot_blocked"); WebFetch returned a summary, not the text. "Switch
  from the profile menu" could not be confirmed: the steps are in images. That Earn, P2P and Futures are absent
  from Lite is the summary's inference from their being listed under Professional.
- **Wealthfront "sets inflation, returns and Social Security itself"**: not on either support page. The second
  page says only that life expectancy defaults to 92 for men and 95 for women and can be changed.
- **"Reviewers still describe both planners as having a learning curve"** and **"an older review describes a
  quick and a comprehensive onboarding path" (Boldin)**: no address given.
- **Boldin and ProjectionLab pricing tiers** (section 2): read through a summarising fetch, not raw text.
- **Carroll and Carrithers (1984)**: the "almost a quarter" figure is Nielsen's retelling [S2]; the paper itself
  was not opened.
- **VoiceOver today**: bug 230408 has had no comment since 2023-10-25 and nothing I found tests iOS 26 or 27, or
  a `flex` / `inline-flex` summary. The research says the same.
- **Print in Safari and Firefox**: still unmeasured.
- **"No app-wide mode" for YNAB, ProjectionLab, Boldin, Wealthfront**: a negative. I found nothing against it
  (no such word in ProjectionLab's changelog or either pricing page), which is not proof.
- **Whether find-in-page exists at all when the app runs from the Home Screen**: not checked.

---------------------------------------------------------------------------------------------------------------------

## 6. What this means for the fifteen rules

| rule | effect |
|---|---|
| R5, R10 | drop "More options" as a standard label, or accept that it goes against [S2]; a label that names the contents satisfies both [S2] and [S17] |
| R10 | "(optional)" alone is not what [S16] supports; decide how required boxes are shown too |
| R13 | six is the tested floor for a cut list, not five |
| R14 | native `<details>` stays the right base; on Safari the find-in-page gain is "opens, does not scroll to it" until bug 304174 closes |
| R15 / section 4 | the reasoning from [S18] is weaker than stated, and a `localStorage` preference can reset on an iPhone used through Safari; the recommendation can still stand on [S19], [S7]'s "different views are not modes" and the product evidence |
| R1, R2, R3, R4, R6, R7, R8, R9, R11, R12 | evidence as cited holds (with the notes in section 2 for R3 and R6) |
