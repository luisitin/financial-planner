# Optional detail: what the evidence says, and the rules for this app (research)

Written 2026-11-12 for the owner's rule of the same day ("Continue and be aggressive with OPTIONALITY ... Default to
less is more and allow more complexity or toggles. We want subtle optional complexity"). Research and design only:
nothing in the repo or the read-only worktree was edited. Companion to the code inventory `$SP/opt/inventory.md`
(`$SP` = `$SP`): the
inventory says what the app has, this file says what the evidence asks for.

How to read the sources: every claim carries a key like [S7]; the list at the end gives the URL. **Every source was
read on 2026-11-12.** Three marks: no mark = I opened the page and the claim is on it; *(excerpt)* = the page could not
be opened (403/503 or a scanned PDF) and the claim rests on a search excerpt; *(measured)* = I ran it here. Section 6
lists everything thin or unverified, including one widely quoted figure I could not confirm and therefore do not use.

---------------------------------------------------------------------------------------------------------------------

## 0. The answer in twelve lines

1. **Recommendation: option (2)**, inline disclosure everywhere plus **one device preference** that only changes which
   folds start open. Not explicit Simple / Detailed modes (3), and not inline-only (1). Section 4 gives the shape that
   keeps the preference from becoming a mode, and the reasons.
2. The research is one-sided against modes: a level-structured interface frustrates the moment it lacks one needed
   function [S18]; features that live in one mode are harder to find and people slip between modes [S7]; every finance
   product I found with a Lite/Pro split has features that differ by mode [S44][S45][S46] or people stuck in one [S47].
   The planning products (Boldin, ProjectionLab, Wealthfront, Monarch, YNAB) do not have an app-wide mode: they offer
   detail per topic and per form [S38][S39][S40][S41][S42].
3. It is equally one-sided that **settings are not a mechanism**: fewer than 5% of people changed any setting in the
   classic survey [S19]. So the first view must be right by itself, and the preference is a relief valve for the few
   who want everything, not the way the app delivers simplicity.
4. Progressive disclosure works when the split is right and the way in is obvious; it hurts beyond two levels, when
   the label has no scent, and when what is hidden is something most people need or an alarm [S1][S2][S4][S10][S11].
5. On a phone, a fold is the right tool for long pages, but the page must not jump, the marker must say "opens here"
   and Back should not throw the person off the page [S5][S6].
6. Defaults are advice whether we mean them to be or not: half of the people enrolled at a default saving rate were
   still at it three years later [S22]; suggested amounts move what people choose, and too-high suggestions backfire
   [S23]. Guesses must be safe-side, labelled, and one tap from their source.
7. Native `<details>` is the right base: since Safari 26.2 (2025-12-12) a closed one opens itself when the browser's
   find-in-page hits text inside [S33][S34], which a hand-made "Show more" never does. One CSS detail (the `display`
   of `summary`) decides whether VoiceOver on an iPhone says "collapsed": see 1.6.
8. *(measured)* A closed `<details>` does not print in Chromium 153; one print rule fixes it (1.6).
9. Remember what a person opened for the visit (wave 1 does), not for ever (1.7).
10. Two findings about the app as it stands, both small: the fold marker is the same "›" the app uses for links that
    leave the page, which is the one icon NN/g's 136-person test says not to use for folds [S6]; and `summary` is a
    flex box, next door to the `inline-block` case that silences VoiceOver's state on iOS [S30][S32] (untested: 1.6).
11. Fifteen rules (section 2), eight anti-patterns (section 3), the seams with wave 1 and the retirement work
    (section 5).
12. Where the evidence is weak I say so; the two-level limit itself is, in its author's words, an estimate [S2].

---------------------------------------------------------------------------------------------------------------------

## 1. What the evidence says

### 1.1 Progressive and staged disclosure (a)

- **Definitions.** Progressive disclosure "defers advanced or rarely used features to a secondary screen"; staged
  disclosure steps people through a linear sequence (a wizard). NN/g's comparison: with progressive disclosure the
  later display is reached "usually not"; with staged disclosure "yes, unless they abandon the task"; the first helps
  learnability, the second simplicity [S1]. For this app: **the path ("Step 4 of 7") is staged disclosure, folds and
  "Go deeper" pages are progressive disclosure.** That is the owner's own split ("big picture" first, then "delve
  deeper"), and it means anything a person must see cannot live in the progressive part: most never go there.
- **Two things must be right** [S1]: the split ("everything users frequently need up front", the first list short
  enough to focus) and the way in ("It must be obvious how users progress from the primary to the secondary
  disclosure levels", with "strong information scent" in the label).
- **Two levels.** "Designs that go beyond 2 disclosure levels typically have low usability" because people get lost
  between levels; if you need three, simplify [S1]. Nielsen's 2026 restatement keeps "Stop at 2" and says plainly it
  is an estimate, not a measurement [S2]. NN/g's accordion guidance repeats it from the other side: nested accordions
  make people "lose track of where they are" [S4].
- **When it helps.** It improves learnability, efficiency and error rate, and it also serves experienced people, who
  no longer scan past things they rarely use [S1]. The training-wheels study behind it (Carroll and Carrithers, 1984)
  blocked the advanced functions of a word processor for new users: the control group spent almost a quarter of its
  time recovering from errors the blocked version could not reach [S2].
- **When it hurts.** (i) The wrong split: a daily-use thing behind a fold is an "interaction tax" on every visit
  [S2]. (ii) A label with no scent: "Label the door honestly. Avoid labels like 'More...'" [S2]. (iii) Hiding what
  decides: "Never hide decision-critical information such as price, requirements, risks", and "A hidden convenience
  costs a click; a hidden alarm costs an incident" [S2]; "Avoid hiding any crucial information within the collapsed
  panels" [S4]. (iv) Features nobody finds: GOV.UK's own components warn "Accordions hide content from the user. Not
  all users will notice them or understand how they work" and "Do not use the details component to hide information
  that the majority of your users will need" [S10][S11]. ProjectionLab shipped a release note that reads as the same
  lesson learned: "Reorganized advanced options for Withdrawal Strategy mode to improve discoverability" [S39].
- **Self-sufficiency test.** Nielsen's rule of thumb: level 1 should finish about 80% of tasks without opening
  anything (the "workbench test": can a first-time user finish the top task without opening a drawer?) [S2].
- **Split tasks, not people.** "Progressive disclosure splits tasks by frequency, not people by skill" [S2]. This is
  the sentence that separates inline disclosure from a Simple/Detailed mode.

### 1.2 Accordions and "show more" on a phone (a)

- **Use them when** people need only a few of the sections, the sections are independent, and the screen is small:
  on a phone people stop scrolling before the end of a very long page, and collapsed headings double as a table of
  contents [S3][S4][S5]. **Avoid them when** people need most of the content ("show all the content at once"), when
  there is little content (a page of collapsed rows looks empty and suggests there is nothing of value), and for
  continuous reading [S3][S4]. Readers "treat clicks like currency" [S3].
- **Phone problems NN/g observed** [S5]: an opened section that scrolls itself to the top of the screen looks like a
  new page, people then press Back to "go back" and leave the page instead; long opened content forces a long scroll
  to shut it or reach the next one; an unfamiliar "Collapse" control went unused; a page that opened its first section
  by default hid the overview and some people left thinking the page covered only that section. Its guidelines: do not
  move the page on opening; treat Back as "close" where an opening fills the screen; keep the heading reachable in a
  long section; do not open sections by default; use familiar controls.
- **Many open at once; state stays.** "Give people the capability to open multiple sections at a time" and "Items
  that are opened or closed should remain in that state until the user changes it" [S3]; auto-closing the others stops
  people comparing two sections [S4].
- **The marker.** NN/g tested 136 people on phone prototypes: a **caret** gave a significantly stronger expectation of
  staying on the page than no icon or a nonsense icon; a **right-facing arrow** was no better than the nonsense icon
  and "should not be used for accordions"; with no icon people expected to leave the page; 29% of taps on a caret row
  landed on the label, so label and icon must do the same thing [S6]. GOV.UK's research note on its details component
  agrees from the field: "some users avoid clicking the link to show more details" because they think it will take
  them away from the page [S11].
- **"Show more" on lists** (Baymard's truncation tests, filter lists) [S14]: truncating beat both showing everything
  and inner scroll areas, but only when people could tell the list was cut; show about 6 to 10 before cutting; make
  the link look like a link and sit with its list; add a marker; "Never truncate a single value" (hiding one row saves
  nothing). When people mistook a cut list for the whole list they abandoned.
- **Tabs are worse than folds on a phone.** Baymard's testing: people repeatedly overlooked content in horizontal
  tabs (they look down, not sideways; tabs scroll off); it recommends expanded sections for short pages and vertically
  collapsed sections for long ones [S13]. The app has no tabs (inventory 1.3): keep it that way.
- **Forms.** Baymard: hide rarely needed boxes behind a link (in eye tracking every participant noticed the "Address
  line 2" link; the box itself made people stop and wonder), but only when most people do not need the box [S15];
  the number of boxes hurts more than the number of steps, the average checkout shows 11.3 boxes where 8 would do, and
  18% of shoppers abandoned a checkout that looked too long or complicated *(excerpt)* [S16]; on a form that marked
  only its optional boxes, 44% of test users came to a complete stop at a group of boxes with no marks *(excerpt)*
  [S16], so say "(optional)" in the label and do not rely on grey help text. Apple: "Use no more than one disclosure
  button in a single view" and give it a label that says what it holds [S17].

### 1.3 Mode switches versus inline disclosure: the research (b)

- **What a mode is.** "Same input, different results." Two costs: mode slips (people act for the mode they think they
  are in) and low discoverability (what lives in one mode is harder to find and remember). If a mode is unavoidable:
  at least two visible indicators, plain names, and no modes where a slip costs money or data [S7].
- **Level-structured interfaces** (pick Simple or Full; the designer decides what each holds): "when an interface is
  missing even one needed function, the user is forced to the next level of the interface, which results in
  frustration" [S18]. The same paper tested the alternative in a four-week field study with 20 Word users: a
  *personal* interface each user filled, with a one-tap toggle to the full one. 14 of 19 spent half or more of their
  time in the personal one; 13 of 20 ranked it first against both forms of standard Word; the toggle scored 4.5 of 5
  for ease; "two interfaces are a good idea" scored only 3.9. And the people who did not like it mostly "expressed
  frustration with the time required to personalize" and gave up [S18]. Read for this app: people accept a quiet
  switch to "everything" when nothing is taken away; they do not want to do set-up work to get simplicity.
- **Adaptive hiding failed at scale.** Office 2000's personalized menus hid what you had not used. Microsoft's own
  account: "There was no way to get the default 'short' menu right ... one person's ideal default 'short' menu was
  exactly the wrong thing for someone else"; scanning took two passes; "Auto-customization, unless it does a perfect
  job, is usually worse than no customization at all ... What people experienced is a sense [of] randomness and
  unpredictability"; "most customers ... turn both of these features off" [S20]. Office 12 turned them off by default
  [S21]. In the field study above, 7 of 20 users had not realised the menus were adapting [S18].
- **People do not change settings.** Several hundred Word users sent in their settings file: "less than 5%" had
  changed anything; the reason given was "Microsoft must know what they are doing"; programmers and designers were the
  exception (40 to 80% of options changed) [S19]. Nielsen: users "rarely utilize fancy customization features" [S8].
  Two consequences that pull against each other and are both true: a preference cannot be how most people get
  simplicity, and the people who build and test apps (the exception group) will overrate how much a preference is used.
- **Do not ask people to classify themselves.** Nielsen calls "expert mode" a fantasy and separate lite and pro
  editions a split of code, documents and budget [S2].

### 1.4 What products do (b)

| product | what it has | scope | what it shows us |
|---|---|---|---|
| **Boldin** (planner) | Basic Budgeter "allows you to enter an aggregate amount for expenses"; Detailed Budgeter splits by category with must-spend and like-to-spend [S38]. First month is 12 milestones in order: profile, accounts, income, spending, a first look; only then assumptions, Social Security choices, scenarios, tax, guardrails [S38]. | per topic | detail is chosen **per input**, not per app; the deeper material is staged after the big picture, the owner's own order. Its help does not say what happens to the one number when a person switches to the detailed budget: a gap to avoid (rule 8). |
| **ProjectionLab** (planner) | no app-wide simple mode found. An "advanced options toggle" on income and expense forms (v4.1.0, 2024-11-01); forms in "a compact view and a full view" (v3.4.0, 2022); "Sandbox mode for new users to skip onboarding" (v3.0.0); later "Reorganized advanced options ... to improve discoverability" (v4.3.0, 2025-06-23) [S39] | per form | inline, per form; and hidden advanced options had to be reorganised to be found. Reviewers still describe both planners as having a learning curve *(excerpt)*. |
| **Wealthfront Path** | sets inflation, returns and Social Security itself; the person can change a few things (retirement age, other income, life expectancy, Social Security counted at 100%, 50% or 0%) *(excerpt)* [S42] | per input | defaults carry the plan; a three-way preset instead of an exact box. |
| **Monarch** | two budgeting methods, Flex (the default: one number for flexible spending) and Category; switch any time under Budget > Settings *(excerpt)* [S40] | account, per feature | a "one number or every category" choice with the simple one as the default. |
| **YNAB** | no beginner mode. Display options: progress bars shown or hidden, Focused Views that show a subset of categories [S41]; the web setting resets when browser storage is cleared, so it lives on the device [S41] | device, presentation only | a presentation preference that changes no numbers, kept per device. |
| **Fidelity** (app) | retired its "Classic" experience in June 2024 over loud objection from people who wanted the denser view *(excerpt)*; in September 2025 added "Fidelity Trader+ mode", "compact views for faster analysis", turned on "in General settings" [S43] | app mode, in settings | simplifying for everyone angered the detail-seeking minority; the answer was an opt-in denser view. A third-party review analysis puts 27% of recent reviews on the redesign itself *(excerpt, one source)*. |
| **Robinhood / Legend** | Legend is a separate platform; "Some of the capabilities of Robinhood Legend may be different or absent" from the app [S44] | separate product | features split in two. |
| **Coinbase** | merged Coinbase Pro into the main app as "Advanced" (2023), reached by a toggle in the profile; it says it remembers the preferred view *(excerpt)*. Fees differ by mode and money placed in a portfolio "can only be traded on Advanced" *(excerpt)* [S45] | account mode | even after merging to end "two platforms" confusion, what you can do and what it costs depends on the mode. |
| **Binance** | Lite drops the order book and advanced charts; Earn, P2P and Futures are in Professional; switch from the profile menu [S46] | app mode | the level-structured trap: one missing function forces the switch [S18]. |
| **TurboTax Desktop** | guided "Step-by-Step" and direct "Forms" mode over the same return *(excerpt)*; a 2026 community thread: "Got into Forms Mode - how do I switch back", navigation gone from the screen [S47] | app mode | a layperson stuck in the wrong mode. |
| **GitHub** | split or unified diff: "the mode you last used will become your preferred default" *(excerpt, 2014)*; whitespace preference now saved across pull requests *(excerpt, 2026-10-22)* [S48] | account, presentation | last-used view choices are remembered; no feature differs. |
| **Gmail** | display density (Default, Comfortable, Compact) *(excerpt)* [S49] | account, presentation | the model for a density preference; I found no data on how many people change it. |

Pattern: **planning apps disclose inline and per topic; trading apps have modes, because their "pro" surface is a
different product (order books, charts).** Wherever there is a mode, features or prices differ by mode, or someone is
stuck. Where a preference changes presentation only (YNAB, GitHub, Gmail), I found no such reports. What users say is
thin outside Fidelity: section 6.

### 1.5 Defaults, presets and anchoring for laypeople (c)

- **Defaults do two jobs**: a "representative value" (it shows what kind of answer the box wants) and a "frequent
  value" (what most people need). Pre-fill the most common value when it can be predicted; do not default to the
  option that suits the provider, "or you'll lose credibility" [S8]. In a planner the equivalent of the provider's
  favourite is the flattering assumption.
- **Defaults stick.** Under automatic enrolment 401(k) participation passed 85% at three firms, but "participants
  tend to anchor at a low default savings rate"; half of them were still at the default rate and in the default fund
  three years later; the gain from joining and the loss from the low rate were "roughly offsetting on average" [S22].
  A default in a money tool is taken as advice.
- **Presets move choices, and can backfire.** New York taxi screens: "default tip suggestions have a large impact on
  tip amounts", and "a higher proportion of customers opt to leave no credit card tip when presented with the higher
  suggested amounts" [S23]. So presets are not neutral, the set shown frames what "normal" is, and an aggressive set
  pushes people out of choosing at all.
- **More choices, fewer deciders.** In 401(k) plans, every ten funds added to the menu went with a 1.5 to 2 point
  drop in participation; plans with ten or fewer options had the highest participation *(excerpt)* [S24].
- **A preset is also an accessibility feature**: WCAG 2.5.7 (AA) requires that anything done by dragging can be done
  with a single tap; chips, or a box beside a slider, satisfy it [S27].

### 1.6 Accessibility of `<details>`, toggles, find-in-page and print (d)

- **Tap size.** WCAG 2.2 SC 2.5.8 (AA): at least 24 by 24 CSS px, with exceptions for spacing and for links inside a
  sentence; for important controls the guidance points to 2.5.5's 44 by 44 [S25]. The app's own rule is 44 px and
  `.fold > summary` has `min-height: 44px`; **`.notice-details summary` is 32 px** (`core/ui/base.css:150`): above the
  AA floor, below the app's rule [S52].
- **Focus not hidden.** SC 2.4.11 (AA): a focused control must not be entirely hidden by author content such as a
  sticky header; CSS `scroll-padding` is a listed technique [S26]. The app already has
  `html { scroll-padding-top: calc(var(--topbar) + 12px) }` (`base.css:28`) [S52]; the bottom save note is
  `pointer-events: none` and transient. An error that opens a fold must still bring its box into view below the bar.
- **Same thing, same name.** SC 3.2.4 (AA): "Components that have the same functionality within a set of web pages
  are identified consistently" [S28]. Twenty-three titles for "how this is worked out" (inventory 1.1) is the gap.
- **VoiceOver on iOS Safari.** History: iOS 15 and 16 announced neither role nor state for `summary` [S31]; the
  long-standing WebKit bug on exposing `<details>` as a disclosure was closed as fixed on 2023-11-04 [S31]; a tester
  on iOS 17.1 (2023-10-25) reports that VoiceOver now "always announces the name and state for the default `display`
  and `display: block` versions" of `summary`, but with **`display: inline-block` the state is dropped or wrong, and
  that bug is still open** [S30]. GOV.UK was audited on exactly this in 2024 and fixed it by changing the
  summary from `inline-block` to `display: block` with `width: fit-content`; fixed on iOS 17 and 18, not fixable on
  older versions [S32][S11]. O'Hara's survey adds: headings inside `summary` "are not consistently exposed"; do not
  add `role=button`; do not put links or buttons inside `summary`; native is still the right choice where these quirks
  are acceptable [S29]. A separate regression on iOS 18.1 and macOS 15 affected `aria-expanded` announcements on
  custom buttons *(excerpt)*, which is one more reason to prefer the native element.
  **For this app**: `.fold > summary` is `display: flex` and `.notice-details summary` is `inline-flex` [S52]. Neither
  value is covered by the bug reports I found; `inline-flex` is the nearer cousin of the failing case. Not tested here
  (no iPhone, no VoiceOver). The safe shape is the one GOV.UK shipped: `summary` stays `display: block`, and an inner
  `<span>` is the flex row. 85 folds put an `<h2>` inside `summary` (inventory 1.1): do not count on the heading rotor
  reaching them. 107 of 143 chevrons are not `aria-hidden` (inventory 1.1) and are read as a character or skipped,
  by luck.
- **Find-in-page.** A closed `<details>` opens itself when the browser's find hits text inside it: Chrome 97, Firefox
  148, **Safari 26.2 (released 2025-12-12), and Safari on iOS follows the same version** [S33][S34]. The same
  releases brought `hidden="until-found"` (Chrome 102, Firefox 148, Safari 26.2) with a `beforematch` event; it works
  only on elements that are not `display: none`, `contents` or `inline` [S34][S35]. caniuse's page for the feature
  showed Safari as unsupported when I read it [S36]; WebKit's own release notes and MDN's data say 26.2, and I go with
  them. Consequences: an iPhone not yet on iOS 26.2 finds nothing inside a closed fold; **a hand-made "Show more" that
  hides with `hidden` or `display: none` is never found on any browser**; and because a search can open a
  `<details>`, it must never be the base for a menu or a dialog [S29]. `details name="..."` (only one open at a time)
  exists from Safari 17.2 [S34] and should not be used (1.2).
- **Print** *(measured, Chromium 153 headless, `$SP/opt/printtest/t.mjs`)* [S51]: a closed `<details>` is **not**
  printed; an open one is; `hidden="until-found"` content is not. Two fixes both worked: the print rule
  `@media print { details::details-content { content-visibility: visible !important; display: block !important } }`
  (`::details-content` exists from Chrome 131, Firefox 143, Safari 18.4 [S34]), and a `beforeprint` listener that
  opens every shut fold and shuts them again on `afterprint`. Opening by script fires the `toggle` event (2 events
  for open then shut), so anything that records "what the person opened" from `toggle` would record the print. Safari
  was not measured. NN/g asks for exactly this: "Expand All" or automatic expansion at print [S4]. The app prints
  only its report sheets (`modules/reports/report-kit.js`, `.rp-sheet`), and a person can still use the browser's own
  Print on any page.
- **Toggles.** "Toggle switches should take immediate effect" and "should not require the user to click Save or
  Submit"; do not put one inside a form that has a Save button (use a tick box there); the label says what is on when
  it is on, and is never neutral [S9]. The app's `.toggle-row` is a tick box with words, used only in Settings
  (inventory 1.3), which is the right place.

### 1.7 Remembering what was opened (e)

- **Within the visit: yes.** NN/g: state stays until the person changes it [S3]. GOV.UK's accordion keeps open
  sections in session storage "if a user leaves and returns within the same session", with a switch to turn that off
  [S10]. Wave 1 does this per history entry (inventory 2.4).
- **Across visits: only explicit, presentation-only choices.** GitHub keeps the last diff view as the default
  *(excerpt)* [S48];
  YNAB keeps progress bars per browser [S41]; Coinbase keeps the preferred experience *(excerpt)* [S45]. None of these
  remembers which individual sections were open.
- **Where remembering goes wrong.** GOV.UK's step-by-step component warns that remembered steps combined with a
  step opened by default "is not recommended as it could confuse users" [S12]: two rules deciding what is open make
  the page unpredictable. The iPhone camera goes back to Photo mode every time unless the person turns on "Preserve
  Settings" for that item *(excerpt)* [S50]: Apple's default is a predictable start, with remembering as an opt-in.
  Office's adaptive menus are the extreme case: the interface changed by itself from what you had done before and
  people experienced "randomness and unpredictability" [S20].
- **Per device or per account.** The products that remember presentation do it per account when they have accounts
  and per browser when they do not. This app has no accounts: the plan is one file shared by the phone and the PC, the
  screens differ, and the owner's rule says opening or closing never changes the plan. That leaves the device
  (`localStorage`), as `core/view.js` already does for the build view.
- **My reading** (inference, not a study): per-fold memory that never expires would wear the owner's rule away, since
  every fold a person ever opened would stay open and the first view would drift back to the wall; and a fold opened
  three weeks ago for one check is state the person no longer knows about. So: per fold for the visit, one explicit
  preference for the device, nothing in between.

---------------------------------------------------------------------------------------------------------------------

## 2. Fifteen rules for this app

Each rule: what to do, where it bites in the app today (file and count from the inventory or from the tip 737fb6a),
and the evidence. "Fold" means a native `<details>`; "first view" means what a page, card or form shows before any tap.

**R1. The first view answers by itself.** The answer as a sentence or a `ui.stat`, about five rows that explain it, one
filled button. A person who never opens anything still leaves with a true verdict and their next step. The test for
every page: *can a first-time person do this page's job without opening a fold?* If not, the split is wrong: move the
thing up; do not reword the fold.
- In the app: the pages on the path come first, because the path is staged disclosure and everyone reaches them (1.1).
- Evidence: the split must be right [S1]; level 1 self-sufficient, about 80% of tasks [S2]; under 5% of people ever
  change or seek out more [S19]; "Not all users will notice them" [S10].

**R2. Alarms, verdict-changers and the insight are never folded.** A red or amber notice, an error, a missing figure
the answer waits on, a cost or tax that changes the verdict, and the one sentence of insight the page exists for stay
on the first view. Fold explanations and conveniences.
- In the app: on "What this rests on" (the retirement request) the two or three figures that move the answer most are
  rows of the first view; "N more numbers" holds the rest. A fold's status may *repeat* an alarm; it never replaces it.
- Evidence: "A hidden convenience costs a click; a hidden alarm costs an incident" [S2]; "Avoid hiding any crucial
  information within the collapsed panels" [S4]; the owner: "It's got to be valuable".

**R3. Two levels: the first view, then one fold. Never a fold inside a fold; the third level is a page.**
- In the app: one standing exception, Settings > "Advanced" with three folds inside it (inventory 1.4): flatten it when
  that page is next touched; it is technical and low priority. "More options" never contains "Advanced".
- Evidence: beyond two levels "typically have low usability" [S1]; "Stop at 2" (an estimate) [S2]; nested accordions
  lose people [S4].

**R4. Fold, or a "Go deeper" page?** A fold when it explains or adjusts *this* answer, opens to no more than about a
screen and a half (roughly 1,200 px at 390 px wide), and the person goes straight back to the answer. A page when it
is a different question, has inputs of its own, or is longer. A row does one thing: it opens here, or it goes to a
page, never both. "Go deeper" links sit in one card after the answer, are never filled, are never a step of the path,
and each is worded as the question it answers ("How would a bad first ten years change this? ›").
- Evidence: long opened sections on a phone force scrolling to get out and disorient [S5]; one behaviour per row
  [S6]; progressive disclosure is "usually not" reached, staged is [S1]; the owner's "big picture ... delve deeper".

**R5. One vocabulary, and the label says what is inside and how much.** The inventory's eight phrases (its 1.6), each
with one job: "N more <things>", "More options", "Set my own numbers" / "Type my own", "The figures", "How this is
worked out", "+ Add another <thing>", "Show details", "Go deeper". Put the number in the label when there is one.
Never a bare "More", "Details", "Other", "Learn more". The title is fixed; what changes goes in the status.
- In the app: 23 different titles for "how this is worked out", 9 spellings of "not set", 8 of "who set it"
  (inventory 1.1, 1.2). Renaming a fold that a guide step opens by title breaks that step (inventory 1.5).
- Evidence: "strong information scent" [S1]; "Label the door honestly. Avoid labels like 'More...'" [S2]; "short and
  descriptive so users can quickly work out if they need to click" [S11]; consistent identification, WCAG 3.2.4 (AA)
  [S28]; an unfamiliar "Collapse" label went unused in testing [S5].

**R6. One look, one behaviour: it opens in place, the page stays still, nothing else shuts.** The whole 44 px row is
the control, title left, status, marker right. The marker for "opens here" is a caret that points down (up when
open); "›" is kept for things that leave the page. No `name=` groups, no auto-scroll on opening.
- In the app: the fold marker is "›" (U+203A) in 143 places, turned a quarter when open (`core/ui/base.css:137-138`),
  and "›" also ends "See your plan ›", "Add ›", "Edit ›" (the design log uses the chevron for "opens its page").
  Two CSS lines would point the shut marker down and the open one up with no view edited. This is a designer-lane
  proposal for a design review, not a decision: the fold look came out of the 2026-09 reviews.
- Evidence: caret safest, right-facing arrow "should not be used for accordions", no icon reads as leaving, 29% of
  taps land on the label (136 people) [S6]; some people avoid opening because they expect to be taken away [S11]; do
  not move the page [S5]; several open at once [S3][S4]; target size [S25].

**R7. A fold never hides the person's own state.** Its status says, in one spelling each: "yours" or "our guess",
"2 changed", "not set yet", "needs a look". An error inside opens the fold, puts the focus on the box and lands it
below the top bar. A fold holding typing that is not saved says so (wave 1 does this).
- In the app: no fold says "changed" in one way and none says it holds an error (inventory fact 2); wave 1's form kit
  already opens every shut ancestor of a failing box.
- Evidence: hidden state is what causes slips [S7]; focus not obscured, WCAG 2.4.11 (AA) [S26]; the owner's rule.

**R8. Looking is free; changing the plan is a different control.** Opening or closing never writes the plan, never
asks to save, never loses typing. What changes the plan is a chip, a tick box or a box, with Save and a
`ui.notice("ok", ...)`. Where an input has a simple and an exact form ("one number" and "each bill"), moving between
them keeps both, and the page says which one the plan is using.
- Evidence: the owner's rule; toggles act at once and do not belong in forms that have a Save [S9]; Boldin's help
  describes its one-number and detailed budgets and does not say what happens to the first when you move to the
  second [S38]: the question a person will ask.

**R9. Remember for the visit, not for ever.** Per fold: this tab and this history entry, across a save, Back and a
reload (wave 1). Across days: only the one device preference of R15. No new module-level "open" variable except "the
one just saved" and "holds an error". Nothing about open or shut in the plan file.
- Evidence: state stays until the person changes it [S3]; session-scoped memory in GOV.UK's accordion [S10]; two
  rules for what is open "could confuse users" [S12]; the camera's predictable start, with remembering as an opt-in
  [S50]; self-rearranging menus felt random [S20].

**R10. A form asks first only what the answer needs.** The first view of an add or edit form is what fits one phone
screen with its Save button in sight: about five boxes. Everything else goes in one "More options" fold directly
above Save. Boxes a person may skip say "(optional)" in the label. The fold's status counts what is in it
("2 filled in"); a box in it with an error opens it. One such fold per form.
- In the app: about 500 optional boxes, 12 labelled so; 120 help lines say "leave blank"; `ui.form` has no "more"
  (inventory facts 5 and 6, and its section 3 for the 30 worst forms).
- Evidence: hide rarely needed boxes behind a link, every eye-tracked participant saw the link [S15]; the count of
  boxes hurts more than the count of steps, and marking only some boxes stops people *(excerpt)* [S16]; one disclosure
  control per view [S17]; ProjectionLab's per-form "advanced options toggle" [S39].

**R11. A simple choice before an exact figure.** Three or four chips taken from real reference points, each saying
what it is ("cautious 4%", "typical 5%"), low to high; then "Type my own" opens one box. The value the plan holds now
is always the selected chip, also when it is none of the presets ("Yours: 5.5%") or when it is ours ("our guess").
Never a slider as the only way.
- In the app: presets as chips on 3 pages, "Type my own" on 2 (inventory fact 7); the retirement pages in flight
  already do this.
- Evidence: Wealthfront's 100% / 50% / 0% for Social Security *(excerpt)* [S42]; suggested amounts move choices and
  high ones push people out [S23]; a single-tap alternative to dragging, WCAG 2.5.7 (AA) [S27]; fewer options, more
  people decide *(excerpt)* [S24].

**R12. A guess is advice: safe-side, labelled, sourced, counted.** Every figure the app fills in leans to the
cautious side for the person, is marked "our guess" where it is used, has its source one tap away, and an answer that
rests on guesses says how many ("rests on 3 of our guesses"). Replacing a guess with your own figure never takes more
than one fold.
- Evidence: over 95% keep what they are given, because "Microsoft must know what they are doing" [S19]; half still at
  the default saving rate after three years [S22]; do not default to what suits the provider [S8].

**R13. Lists: the first five, then "N more".** Never cut a list to hide one row. The label counts ("12 more years").
It opens in place. A long year-by-year table is a fold when it fits R4, otherwise a deeper page; never a sideways
scroll.
- Evidence: cut lists beat full lists and inner scrolling only when the cut is obvious; 6 to 10 short values before
  cutting; "Never truncate a single value" [S14]. Five rather than ten because the app's rows are two lines tall.

**R14. Every fold is a native `<details>` drawn by one helper, with four details right.** (1) `summary` stays
`display: block`; an inner `<span>` is the flex row. (2) The marker is `aria-hidden`. (3) No link or button inside
`summary`, and no reliance on a heading inside it for navigation. (4) The open state is set before the element goes
into the page, so no `toggle` fires for a fold the page opened. A hand-made "Show more" either becomes a `<details>`
or carries `aria-expanded` and hides with `hidden="until-found"`. One print rule opens every fold; a report sheet
holds no folds.
- In the app: 153 fold sites in 5 markup variants and no helper (inventory fact 1); `summary` is `display: flex`,
  `.notice-details summary` is `inline-flex` and 32 px tall; 107 of 143 markers are not `aria-hidden`; four views use
  `aria-expanded` rows and about ten hide boxes with `hidden` (inventory 1.3).
- Evidence: VoiceOver state with `display: block` but not `inline-block` [S30]; GOV.UK's fix [S32]; O'Hara on
  headings, roles and nested controls [S29]; find-in-page opens a closed `<details>` in Safari 26.2, Chrome 97,
  Firefox 148 [S33][S34]; print *(measured)* [S51]; expand at print [S4].

**R15. One device preference, never a mode; and never ask "beginner or expert?".** Section 4.

---------------------------------------------------------------------------------------------------------------------

## 3. Eight anti-patterns

1. **A Simple / Detailed (Lite / Pro) switch.** Two versions of every page to design, word, test and keep in step;
   something will exist in only one; someone will be in the wrong one. Evidence: one missing function forces the
   switch and frustrates [S18]; mode slips and features nobody finds [S7]; Robinhood, Coinbase and Binance all have
   features that differ by mode [S44][S45][S46]; a TurboTax user stuck in Forms mode [S47]; "splits tasks by frequency,
   not people by skill" [S2].
2. **The app deciding what to show from what you did before.** Hiding what has not been used, opening what was
   opened last month, reordering by use. Evidence: Office's personalized menus, "worse than no customization at all",
   switched off by default in the next version [S20][S21]; 7 of 20 users never realised the menus adapted [S18].
3. **A fold in a fold; "Advanced" inside "More options".** Evidence: [S1][S2][S4].
4. **A door with no scent.** "More", "Details", "Advanced", "Other", an icon alone, or the "leaves the page" marker on
   something that opens in place. Evidence: [S1][S2][S6][S11].
5. **Hiding the alarm or the answer.** A warning, an error, a figure the person changed or the figure that flips the
   verdict inside a shut fold; a first view of zeros or an empty table with the value folded below. Evidence:
   [S2][S4][S7].
6. **Accordion tricks.** Opening one shuts the others; the page scrolls itself when something opens; the first
   section is open by default on a page of folds; every card folded so the page is a column of chevrons; a fold around
   two lines. Evidence: comparing needs several open [S3][S4]; the opened section that looks like a new page, and the
   default-open section that hid the overview [S5]; a page of collapsed rows looks empty [S4].
7. **A fold or switch that changes the plan, or a switch that waits for Save.** Also: moving from the simple to the
   exact form of an input and silently dropping what was typed in the other. Evidence: [S9]; the owner's rule.
8. **Presets and guesses that steer.** A flattering chip selected for you, a row of presets whose middle is what we
   would like you to pick, a guess with no label, a slider with no box. Evidence: [S22][S23][S8][S27].

---------------------------------------------------------------------------------------------------------------------

## 4. Recommendation: (2) inline disclosure plus one device preference

| option | for | against | verdict |
|---|---|---|---|
| **(1) inline only** | one version of every page; nothing to forget; matches what the planning apps do [S38][S39][S42] | a person who wants the figures on every page pays a tap per fold per page per visit, the "interaction tax" [S2]; NN/g: when someone needs most of the content, show it [S3][S4]; Fidelity is what it looks like when the detail-seeking minority has no way out *(excerpt)* [S43]; and the owner asked for "optionality of complexity", not only for less | necessary, not sufficient |
| **(2) inline plus one device preference** | keeps one version of every page (the preference only changes which folds start open); people accept a quiet switch to "everything" when nothing is taken away (toggle rated 4.5 of 5; 13 of 20 preferred having it) [S18]; presentation-only preferences are the kind that are remembered without complaint (YNAB, GitHub, Gmail) [S41][S48][S49]; per device suits a household with a phone and a PC | few will ever turn it on [S19], so it must cost almost nothing and must never be the way simplicity is delivered; one more state for the smoke run | **recommended** |
| **(3) Simple / Detailed modes** | none that (2) does not also give | anti-pattern 1 in full: features split, slips, a second copy of 159 pages' first views to keep true; asks people to classify themselves [S2]; the layperson owner on one phone gains nothing from a mode they must remember | no |

**What keeps the preference from being a mode** (all seven, or it is option 3 by another name):

1. **Presentation only.** It sets which folds *start* open. No figure, verdict, word, button, page list or route
   differs; `compute.js` never sees it; every fold is still there, in the same place, and can be shut. NN/g's test for
   a mode is "same input, different results" [S7]: here the same tap does the same thing in both states.
2. **Off by default, on every device.** "Default to less is more." Not switched on by screen width: two devices that
   differ without anyone choosing is the unpredictability of [S20].
3. **It opens only what its words promise.** Plain words: **"Open the extra numbers and options on every page"**,
   help line "For when you like to see everything. On this device only; nothing in your plan changes." That covers the
   folds named "N more numbers", "The figures", "Set my own numbers" and "More options". It does **not** open "How this
   is worked out", one-fold-per-item lists (people, months, glossary words), add forms (design log 2026-09-15), long
   tables, anything over R4's screen and a half, error details or the technical folds.
4. **The person's own tap still wins**, and wave 1's memory is untouched: a fold they shut stays shut for that visit.
5. **Stored on the device, never in the plan**: one more field beside the build view in `core/view.js`
   (inventory fact 8 and its section 7), `localStorage` with the same in-memory fallback. A phone and a PC can differ.
6. **It is a tick-box row in Settings that acts at once and confirms** ("Pages on this device now open with their
   extra numbers and options showing."), in an everyday card above "Your data", not inside "Advanced" [S9].
7. **Never asked during setup, never a "beginner or expert?" question.** It may be mentioned once, quietly, on "Your
   plan" after the plan exists, which is where the owner put going deeper.

**Considered and not recommended now.** A per-page "open everything on this page" control: it adds a control to every
page, which is the opposite of the rule; revisit only if a review shows people opening three or more folds on the same
page as a habit. Three levels (simple / standard / everything): more levels, same level-structure problem [S18][S2].
Per-fold memory across days: 1.7.

**Cost.** One field and its test in `core/view.js`; one row in `modules/system/settings`; one argument in the fold
helper; the phone smoke run a second time with the preference on (390 and 320 px: overflow and tap targets).

**How to know it worked** (cheap, in this order): (a) the R1 test on every path page with the invented households:
the page's job done with no fold opened; (b) a first-tap check on fold labels with two or three laypeople ("where
would you tap to change how fast the plan assumes your savings grow?"); (c) VoiceOver on a real iPhone says
"collapsed" and "expanded" on a fold and on a notice's "Show details"; (d) Safari's own Print on a page with shut
folds; (e) with the preference on, no page of the path grows a horizontal scroll or a second filled button.

---------------------------------------------------------------------------------------------------------------------

## 5. Seams with the work in flight

- **Wave 1 place memory** (`$SP/w1/plan-place.md`) keeps only native `<details>`, named by the summary's title with
  the status stripped: R5's "fixed title, changing status" and R14's helper are what make it work. Wave 1 records only
  folds "the person opened or shut by tapping their summary"; the preference and the print rule open folds without a
  tap, and *(measured)* opening by script does fire `toggle`, so the helper should set `open` before insertion and the
  print rule should be CSS first, script only as a fallback. "The page wins" already covers a fold the preference
  opens.
- **Wave 1 form kit**: a failing box opens its shut ancestors and the Return-key walk skips boxes in a shut fold;
  both are what R7 and R10 need. A `more` option inside `ui.form` is listed there as a follow-up, not built: until it
  lands, "More options" is drawn outside `ui.form` (the `goals/goals` recipe, inventory fact 5).
- **Back.** NN/g's "Back should close it" [S5] comes from sections that jump to the top and look like a new page.
  With R6 (the page does not move) that trigger goes away, so folds should **not** become history entries; wave 1's
  `router.layer` stays for the menu and for edit forms opened from a row.
- **The retirement request (L1 to L8)** already ships "N more numbers" and presets as chips: R2 (the biggest levers
  stay on the first view), R11 and R13 are the ones to check it against; its wording wins where it differs from the
  inventory's list.
- **Guide steps open folds by title** (inventory 1.5): any rename under R5 goes with `journeys.js` (claude-f).
- **claude-a's 13 folders**: rules by hand-over note, not by edit.
- **Owner decisions this raises** (design review, not builder's call): the fold marker (R6), "Go deeper" against the
  2026-11-06 "More on this" (inventory open point 1), and the words of the preference.

---------------------------------------------------------------------------------------------------------------------

## 6. Thin or unverified

- **Not used: "27% overlook horizontal tabs, 8% collapsed sections".** A search excerpt of a mirrored Baymard article
  gave these figures; Baymard's own page, read today, does not contain them [S13]. Only its qualitative finding is
  cited.
- **The two-level limit** is expert judgement repeated for twenty years; its author calls it an estimate [S2].
- **What users say** is well documented only for Fidelity, and that through search excerpts of Reddit threads I could
  not open (503) and one third-party review analysis. For Robinhood, Binance and Coinbase I found vendor and
  reviewer text, not user research. For Gmail density I found no usage data.
- **Boldin and ProjectionLab**: neither has the "basic vs detailed planner" or "quick vs advanced settings" switch the
  brief supposed. What exists is in 1.4. Boldin's budgeter article is from 2023-10-18; an older review describes a
  quick and a comprehensive onboarding path *(excerpt)*, its current first-month guide (2026-09-15) does not.
- **Wealthfront, Monarch, Coinbase, GitHub, Copilot**: vendor pages returned 403 or were not found; claims marked
  *(excerpt)* rest on search excerpts. I found nothing usable on Copilot Money's optional detail.
- **VoiceOver with a `display: flex` summary**: not covered by any report I found and not testable here. The
  `inline-block` failure is documented and still open [S30]; `inline-flex` (the notice's "Show details") is my
  inference by nearness. Needs one check on a real iPhone.
- **Printing in Safari and Firefox**: only Chromium 153 was measured.
- **caniuse and WebKit disagree** on Safari's `hidden="until-found"` support [S36][S33]; I follow WebKit's release
  notes and MDN's data [S34]. An iPhone below iOS 26.2 does not open folds on find-in-page.
- **The field study behind "people like a quiet switch to everything"** is 20 Word users in 2002 on a desktop [S18];
  the settings survey is Word users before 2011 [S19]; the default-saving and tipping studies are not about planning
  apps [S22][S23]. They agree with each other and with current guidance, but none is a test of this app.
- **"About five rows", "about five boxes", "a screen and a half"** are my sizes for a 390 by 844 phone, chosen to fit
  one screen; the evidence gives the direction (fewer; never hide just one), not the number.
- Madrian and Shea (2001), the usual citation for default saving rates, has no figures in its abstract; I cite Choi,
  Laibson, Madrian and Metrick's abstract instead [S22].

---------------------------------------------------------------------------------------------------------------------

## Sources (all read 2026-11-12)

- [S1] Nielsen, "Progressive Disclosure", NN/g, 2006-12-03. https://www.nngroup.com/articles/progressive-disclosure/
- [S2] Nielsen, "Progressive Disclosure: From Training Wheels to Week-Long AI Agents", 2026-07-09.
  https://jakobnielsenphd.substack.com/p/progressive-disclosure
- [S3] Loranger, "Accordions Are Not Always the Answer for Complex Content on Desktops", NN/g, 2014-05-18.
  https://www.nngroup.com/articles/accordions-complex-content/
- [S4] Wang, "Accordions on Desktop: When and How to Use", NN/g, 2023-07-30.
  https://www.nngroup.com/articles/accordions-on-desktop/
- [S5] Budiu, "Accordions on Mobile", NN/g, 2015-05-31. https://www.nngroup.com/articles/mobile-accordions/
- [S6] Laubheimer and Budiu, "Accordion Icons: Which Signifiers Work Best?", NN/g, 2020-08-23.
  https://www.nngroup.com/articles/accordion-icons/
- [S7] Laubheimer, "Modes in User Interfaces: When They Help and When They Hurt Users", NN/g, 2019-04-14.
  https://www.nngroup.com/articles/modes/
- [S8] Nielsen, "The Power of Defaults", NN/g, 2005-09-25. https://www.nngroup.com/articles/the-power-of-defaults/
- [S9] Kendrick, "Toggle-Switch Guidelines", NN/g, 2018-07-29.
  https://www.nngroup.com/articles/toggle-switch-guidelines/
- [S10] GOV.UK Design System, Accordion. https://design-system.service.gov.uk/components/accordion/
- [S11] GOV.UK Design System, Details. https://design-system.service.gov.uk/components/details/
- [S12] GOV.UK publishing components, step-by-step navigation, "remember last opened step".
  https://components.publishing.service.gov.uk/component-guide/step_by_step_nav/remember_last_opened_step
- [S13] Baymard, "Avoid horizontal tabs", 2018-10-17, updated 2026-07-08. https://baymard.com/blog/avoid-horizontal-tabs
  (also read: https://baymard.com/research-articles/avoid-horizontal-tabs)
- [S14] Holst, "6 Guidelines for Truncation Design", Baymard, 2014-05-21. https://baymard.com/blog/truncation-design
- [S15] Scott, "Address Line 2", Baymard, 2022-10-04. https://baymard.com/blog/address-line-2
- [S16] Baymard, checkout and form research *(excerpts)*. https://baymard.com/blog/checkout-flow-average-form-fields ,
  https://baymard.com/blog/required-optional-form-fields , https://baymard.com/learn/form-design
- [S17] Apple, Human Interface Guidelines, "Disclosure controls".
  https://developer.apple.com/design/human-interface-guidelines/disclosure-controls
- [S18] McGrenere, Baecker and Booth, "An Evaluation of a Multiple Interface Design Solution for Bloated Software",
  CHI 2002 (text extracted locally from the PDF). https://www.dgp.toronto.edu/public_user/RMB/papers/p28.pdf
- [S19] Spool, "Do users change their settings?", UIE, 2011-09-14.
  https://archive.uie.com/brainsparks/2011/09/14/do-users-change-their-settings/
- [S20] Harris, "Combating the Perception of Bloat (Why the UI, Part 3)", Microsoft, 2006-03-31.
  https://learn.microsoft.com/en-us/archive/blogs/jensenh/combating-the-perception-of-bloat-why-the-ui-part-3
- [S21] Harris, "The End of Personalized Menus", Microsoft, 2006-01-20.
  https://learn.microsoft.com/en-us/archive/blogs/jensenh/the-end-of-personalized-menus
- [S22] Choi, Laibson, Madrian and Metrick, "For Better or For Worse: Default Effects and 401(k) Savings Behavior",
  NBER Working Paper 8651, December 2001 (abstract). https://www.nber.org/papers/w8651
  (also read, no figures in the abstract: Madrian and Shea, https://www.nber.org/papers/w7682)
- [S23] Haggag and Paci, "Default Tips", American Economic Journal: Applied Economics 6(3), 2014 (abstract).
  https://www.aeaweb.org/articles?id=10.1257/app.6.3.1
- [S24] Iyengar, Huberman and Jiang, "How Much Choice is Too Much? Contributions to 401(k) Retirement Plans", 2004
  *(excerpts)*. https://repository.upenn.edu/prc_papers/426 ; summary:
  https://www.tiaa.org/content/dam/tiaa/institute/pdf/full-report/2017-02/effectsofchoiceproliferation.pdf
- [S25] W3C, Understanding SC 2.5.8 Target Size (Minimum).
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- [S26] W3C, Understanding SC 2.4.11 Focus Not Obscured (Minimum).
  https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- [S27] W3C, Understanding SC 2.5.7 Dragging Movements.
  https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- [S28] W3C, Understanding SC 3.2.4 Consistent Identification.
  https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html
- [S29] O'Hara, "The details and summary elements, again", 2022-09-12.
  https://www.scottohara.me/blog/2022/09/12/details-summary.html
- [S30] WebKit bug 230408, "iOS VoiceOver doesn't correctly announce expanded state of details element if summary has
  display: inline-block" (status NEW; comment of 2023-10-25 on iOS 17.1). https://bugs.webkit.org/show_bug.cgi?id=230408
- [S31] WebKit bug 108979 (resolved fixed 2023-11-04) and bug 241401 (iOS 15 and 16, duplicate of 108979).
  https://bugs.webkit.org/show_bug.cgi?id=108979 , https://bugs.webkit.org/show_bug.cgi?id=241401
- [S32] GOV.UK Design System issue 4030 (closed 2024-10-09) and govuk-frontend pull request 5089.
  https://github.com/alphagov/govuk-design-system/issues/4030 , https://github.com/alphagov/govuk-frontend/pull/5089
- [S33] WebKit, "WebKit Features for Safari 26.2", 2025-12-12.
  https://webkit.org/blog/17640/webkit-features-for-safari-26-2/
- [S34] MDN browser-compat-data, raw JSON read today: `html/global_attributes.json` (hidden.until-found),
  `html/elements/details.json` (name, search_match_opens), `css/selectors/details-content.json`.
  https://github.com/mdn/browser-compat-data
- [S35] MDN, `hidden` and `<details>`.
  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/hidden ,
  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details
- [S36] caniuse, hidden="until-found" (showed Safari unsupported). https://caniuse.com/wf-hidden-until-found
- [S37] CSS Working Group, issue 2084, message of 2024-09-07 (print styling of closed details; no decision).
  https://lists.w3.org/Archives/Public/public-css-archive/2024Sep/0276.html
- [S38] Boldin help: "What is the difference between the Basic and PlannerPlus Budgeter" (2023-10-18) and "Your First
  Month with Boldin: A Milestone Guide" (2026-09-15).
  https://help.boldin.com/en/articles/4303030-what-is-the-difference-between-the-basic-and-plannerplus-budgeter ,
  https://help.boldin.com/en/articles/16963882-your-first-month-with-boldin-a-milestone-guide
- [S39] ProjectionLab changelog and account set-up help (2026-05-28). https://projectionlab.com/changelog ,
  https://cdn.projectionlab.com/help/account-setup
- [S40] Monarch, Flex and Category budgeting *(excerpts; help page returned 403)*.
  https://www.monarch.com/blog/flex-vs-category-budgeting-how-to-choose-whats-right-for-you ,
  https://help.monarch.com/hc/en-us/articles/[number removed]
- [S41] YNAB support, "Progress Bars" (read) and "Focused Views" *(excerpt)*.
  https://support.ynab.com/en_us/progress-bars-a-guide-SkDEhot09 ,
  https://support.ynab.com/en_us/focused-views-a-guide-BksnNYqLh
- [S42] Wealthfront support *(excerpts; page returned 403)*.
  https://support.wealthfront.com/hc/en-us/articles/[number removed]-What-inputs-can-I-change-for-my-retirement-goal ,
  https://support.wealthfront.com/hc/en-us/articles/[number removed]-What-assumptions-are-made-on-life-expectancy-for-my-retirement-goal
- [S43] Fidelity, "What's new in the Fidelity app" (read); Reddit r/fidelityinvestments threads of May and June 2024
  on the Classic experience *(excerpts; the search returned them through a Reddit mirror that answered 503; the
  addresses below are the same threads on reddit.com, not opened)*; a third-party review analysis *(excerpt)*.
  https://www.fidelity.com/mobile/whats-new-fidelity-app ,
  https://www.reddit.com/r/fidelityinvestments/comments/1cxdi74/classic_view_is_gone_after_june/ ,
  https://www.reddit.com/r/fidelityinvestments/comments/1d04u1c/quit_dummying_down_the_interface/ ,
  https://unstar.app/blog/fidelity-app-not-working-activity-freeze-4-38-2026
- [S44] Robinhood support, "Get started with Robinhood Legend".
  https://robinhood.com/us/en/support/articles/get-started-with-robinhood-legend/
- [S45] Coinbase *(excerpts; blog returned 403)*. https://www.coinbase.com/blog/coinbase-advanced-is-getting-an-upgrade ,
  https://www.coinbase.com/blog/hello-advanced-trade-goodbye-coinbase-pro ,
  https://help.coinbase.com/en/coinbase/trading-and-funding/advanced-trade/multiple-portfolios
- [S46] Binance, "Binance Lite vs Professional: Which Mode Is Right for You?", 2021-05-25.
  https://www.binance.com/en-IN/blog/ecosystem/binance-lite-vs-professional-which-mode-is-right-for-you-[number removed]
- [S47] TurboTax community, "How to exit Forms mode" (2026-03-20, read) and "What is Forms mode?" *(excerpt)*.
  https://ttlc.intuit.com/community/get-your-taxes-done-using-turbotax-6/how-to-exit-forms-mode-138365 ,
  https://ttlc.intuit.com/community/using-turbotax/help/what-is-forms-mode/00/25900
- [S48] GitHub *(excerpts)*: "Introducing split diffs" (2014-09-03) and the changelog of 2026-10-22.
  https://github.blog/2014-09-03-introducing-split-diffs/ ,
  https://github.blog/changelog/2026-10-22-pull-requests-saved-whitespace-preferences-and-improved-split-view
- [S49] Gmail display density *(excerpts of third-party help pages; the 2011 Gmail blog post's body could not be
  retrieved)*. https://gmail.googleblog.com/2011/11/changing-information-density-in-gmails.html
- [S50] iPhone Camera, "Preserve Settings" *(excerpts)*. https://discussions.apple.com/thread/[number removed] ,
  https://www.tapsmart.com/tips-and-tricks/preserve-camera-controls/
- [S51] Local measurement: Chromium 153 headless through Playwright 1.63, script and PDFs in `$SP/opt/printtest/`
  (`t.mjs`). Result: `plain` closed fold not printed; `cssContent` printed; `beforeprint` printed and shut again;
  2 `toggle` events for a scripted open and shut.
- [S52] The app at tip 737fb6a (read-only worktree `$SP/opt/app`): `core/ui/base.css` lines 28, 41, 130-152;
  `core/view.js`; `modules/reports/report-kit.js`; `docs/DESIGN_LOG.md`; and the inventory `$SP/opt/inventory.md`.
