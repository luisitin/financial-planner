# State at hand-over (builder claude-b)

**Written:** 2026-11-12 16:10 UTC. This file is rewritten at every milestone; the newest commit on
`wip/claude-b-state` is the truth. Paths below are relative to this package unless they start with a repo folder.

## 0. One-screen summary

| | |
|---|---|
| Shared branch `claude/creative-build-b531q0` | tip `737fb6a` (Design rule: simple first, detail on request) |
| Live site `main` | `737fb6a`, full test + check + leak guard + main gate passed, live-checked 2026-11-12 15:26 UTC (161 pages, kept and fresh profile) |
| Weekly usage when written | 8% of the week used; the week resets 2026-11-19 08:00 UTC |
| Open question for the owner | SimpleFIN Bridge: yes or no (asked once, not answered; do not build without a yes) |
| Next commit spec number used by the old helper | c121 (only a naming habit) |

In flight, most important first:
1. **OPT** simple first, detail on request: discovery running; nothing built. Section 1.
2. **RV** retirement request: L1 to L8 built and criticised, in fix and re-check rounds; not landed. Section 2.
3. **W1** wave 1 of the touch stress test (shell and form kit): three parts built, not combined or verified. Section 3.
4. **TOUCH** the permanent touch check: built, attacked by a breaker, verify stage not run; not landed. Section 4.
5. **W2** wave 2 (page fixes by helper sessions): landed and reviewed; a few small items left. Section 5.
6. **LOG** the owner's build log page: about 77 commits behind. Section 6.

How every stream was run: a Workflow script (multi-agent) per stage. The scripts are in `workflows/`; read one before
writing your own, they show the prompts, the stages and the checks that worked. A new session cannot resume the old
runs (their cache is gone); start the remaining stages as a new run, pointing agents at the files in this package.

## 1. OPT: simple first, detail on request (owner, 2026-11-12)

**The owner's words:** "Continue and be aggressive with OPTIONALITY. Allow a user to have optionality of complexity.
Default to less is more and allow more complexity or toggles. We want subtle optional complexity". The day before:
"After we finish the initial setup of, okay, we're going to do a big picture. Once we're in the big picture, you can
delve deeper and get better analytics and your results".

**Already on the shared branch (737fb6a):** the rule in `docs/DESIGN_LOG.md` (entry 2026-11-12) and as a design rule in
`AGENTS.md`, and a line to all builders in `docs/WORKBOARD.md`. claude-b's reading of the rule, recorded there: the
first view of a page, card or form shows the least a person needs (the answer, a few rows, one action); everything
else is one quiet tap away behind a fold or toggle in plain words; chips or presets before an exact box; a folded part
says when it holds a changed figure or an error (an error opens it); opening or closing never changes the plan; deeper
pages are reached by "Go deeper" links.

**The plan (workflow `workflows/optional-complexity-design-*.js`):**
- Discover (5 agents): `opt/census*.m*` (what each usable page shows on the first 390 px screen, 6 households x about
  160 pages; rerun with `opt/census.mjs`), `opt/inventory.md` (every existing fold, toggle, chip row, "show more";
  the vocabulary in use; what is remembered per device; where a shared helper can live), `opt/research.md`
  (progressive disclosure, simple/advanced modes in other products, accessibility of folds, with sources),
  `opt/walks.md` (three people who want less, two who want more), `opt/constraints.md` (binding design decisions,
  who may edit which page).
- Verify (2 skeptics): `opt/verify-code.md`, `opt/verify-web.md`.
- Design (3 stances): inline folds only / inline plus one device setting "always show the detail" / depth follows the
  person's journey. Each writes `opt/design-<stance>.md` and prototypes one page.
- Judge (4 judges: a layperson, a detail lover, a maintainer, the owner's advocate), then one spec `opt/spec.md`:
  rules, the shared helper's API and storage, the vocabulary, a first-view budget test with known counts that may only
  go down, a page-by-page plan (A fine / B small fold or reorder / C rework), hand-over lists for other lanes.
- Then build in small batches, critics after each, land.

**Status when written:** census and inventory written; research, walks and constraints running; no design yet. Files
present in `opt/` show how far it got; anything missing has to be run again.

**Facts already found (verified by reading code):** `core/ui/` holds only `base.css`, `dom.js`, `placeholder.js`;
device toggles live in localStorage (`core/features.js` key "planner.features", `core/app.js` NAV_KEY); there are 153
`<details>` folds in 97 `view.js` files with inconsistent summary wording. Wave 1 (section 3) owns `core/app.js`,
`core/router.js`, `core/search.js`, `index.html`, `core/ui/dom.js`, `core/ui/base.css` and
`modules/overview/guide/frame.js` and adds "place memory" (open sections survive a redraw, Back and reload), so a new
shared helper for optional detail should be a new file and should build on that memory once wave 1 lands.

**Also required by the rule:** the retirement work (section 2) must follow it before it lands (its fix rounds include
an "optional detail" pass).

## 2. RV: the retirement request (owner, 2026-11-11)

**The owner's words, in full:** "A few mentions that I wanted to bring up. When somebody's going through the plan, if
they're short on retirement or something, it should say, okay, well, here's the variables that can change, and you're
able to adjust them, because sometimes it may just be a bad sequence of inputs. Like maybe they didn't input how much
they contributed to their 401k at work. Maybe it's separate. Maybe they didn't input the match correctly, or maybe
we're not assuming that the extra money that built up in savings is actually invested. Maybe we say, hey, can you
check these numbers? And they check the rate of inflation, the rate of return of investments. You show assumptions,
defaults, and then, let them change it and how things could change. Additionally, maybe they have the ability to
separate their retirement accounts into different buckets. Like a certain portion will go into Roth, a certain portion
into traditional, sometimes in different accounts with different people, if they so choose. After we finish the
initial setup of, okay, we're going to do a big picture. Once we're in the big picture, you can delve deeper and get
better analytics and your results, etc. Also, don't implement this yet if it's not possible, if it's not easy, or if
it's not well documented, but maybe there are some platforms where you can either connect via APIs, I don't know if
those exist, or even other ways to connect your accounts, like maybe even upload statements. I don't know if that's
actually built in. I don't want to build one if there's not built in, or it's not well documented, or there's not
already things that exist for it, but you get the idea. Do what makes sense, but user experience is key, and it should
also provide valuable insights, right? It's got to be valuable."

**Spec:** `rv/spec.md` (parts A to E, decisions, build order L1 to L12, risks). Discovery reports beside it:
`rv/walk.md`, `rv/engine.md`, `rv/pages.md`, `rv/connect.md`, `rv/ux.md`; skeptics: `rv/verify-code.md`,
`rv/verify-web.md` (their corrections are already in the spec).

**Built (not on the shared branch):**

| part | what | track | code in this package |
|---|---|---|---|
| L1 | Goal seek and Sensitivity stop treating a higher return as a fix | scn | `rv/scn/code/` (already rebased onto 7297bfb) |
| L2 | "What this rests on" on Will the money last? (new `modules/retirement/levers.js`) | ret | `rv/ret/code/` (on fa2026e) |
| L3 | Contributions: links land on the box, the match check, the answer after a save | ret | same |
| L4 | The money left over each month counted the way the person says (`retirement.leftover`) | ret | same |
| L5 | Assumptions: careful, middle, hopeful, and what a change does | ret | same |
| L6 | Pay the tax later or now, per row at work | ret | same |
| L7 | Document reader: a pay stub fills and checks the 401(k), the Roth part and the match | doc | `rv/doc/code/` (on fa2026e) |
| L8 | Import: the bank's Quicken or QuickBooks file (OFX, QFX, QBO) with the app's own parser `core/ofx.js` | doc | same |

Each `code/` folder has `BASE.txt` (base commit, list of commits), `commits/*.patch` (apply in order with
`git am -3`) and, when the track had unsaved edits, `uncommitted.diff` (apply on top with `git apply --index`). To
rebuild a track: `git worktree add --detach "$SP/b-<track>" <base>`, apply, then rebase onto the tip of the shared
branch. `tools/verify-state.sh` proved on 2026-11-12 that each rebuild equals the original tree.

Per track there is also: `rv/<track>/build.md` (the builder's log), `critic-money.md`, `critic-person.md`,
`critic-break.md` (what the three critics found), `L<n>.changelog` (the CHANGELOG line to use when landing) and
`L<n>.msg` (commit message), plus later files from the fix rounds when they exist (`fix*.md`, `rebase.md`,
`optional.md`, `final*.md`).

**Stages left (workflow `workflows/retirement-levers-build-*.js`, stage 3):** per track: rebase onto the tip → fix
every confirmed critic finding with a failing-first test → re-check (at most 2 rounds) → apply the simple-first rule
(log `optional.md`) → a final skeptic → fix what it finds. A track is ready to land when its `final` report is clean.

**To land a ready track:** on the tip of the shared branch, one commit per L part in order; add its CHANGELOG line;
resolve overlaps in `docs/DATA_MODEL.md` and `docs/MODULE_CATALOG.md` by keeping both sides; L8's commit carries
`Prompt: quick-ofx-import`; `npm run registry`; full test; push; then move `main` (the prompt's section 6).

**After L1 to L8:**
- L9: a match on a Roth row counts as pay-the-tax-later unless the row says `matchRoth` (projection compute, federal
  compute, DATA_MODEL, golden check).
- L10: a hopeful return above 8% never turns `savingVerdict` green.
- L11: check whether claude-c's commit `cb820f2` already closed it (it fixed the tax-from-savings half; claude-c
  showed that "income before retirement is dropped" was wrong: that income is held by the monthly leftover, and
  counting it would double count).
- L12: "check before fix" wording along the path, on claude-f's pages; ask claude-f or claim them once released.
- Later list in the spec's section 4 (OFX positions, pdf.js on the phone, leftover against the bank, and so on).

**Account connection verdicts (sourced in the spec, section 3):** build now: pay stub (L7), OFX/QFX/QBO import (L8).
Later: OFX positions, pdf.js on the phone. Only on the owner's explicit yes: SimpleFIN. Not: Plaid, Teller, MX,
Finicity, Akoya, Yodlee, OFX Direct Connect.

**Engine facts worth knowing (verified):** the projection ignores the monthly leftover unless told (cash bucket at 2%,
spent first); the account type decides Roth or pre-tax; a match goes where its row goes; Assumptions has one
`reviewedAt`; one `project()` run takes 0.1 to 0.8 ms; `chanceShown(planChance, copyChance, known)` in
`modules/scenarios/compare/compute.js` and `knownChance(ctx)`, `rememberChance`, `chanceKey` in
`modules/retirement/careful.js` give one "chance it lasts" across pages.

**Claim:** claude-b holds a row in `docs/TEAM.md` for this request (levers.js, core/ofx.js, the views of
retirement/projection, contributions, scenarios/goal-seek, sensitivity, system/assumptions, ai/reader,
transactions/import; cashflow/paycheck and career/benefits compute; DATA_MODEL). Release it when the request is done.

## 3. W1: wave 1 of the touch stress test (owner, 2026-11-11)

Discovery walked the app as a phone, found and verified 278 touch and input problems, and split them: wave 1 fixes the
shared shell and form kit once; wave 2 fixes pages by area (section 5).

**Designs and plans:** `w1/plan-place.md` (+ `plan-place-steps.json`): the page keeps your place (scroll, open
sections, focus) across a redraw, Back and reload. `w1/plan-forms.md` (+ steps): forms (errors where the eye is,
keyboards, Enter, Cancel). `w1/design/taps/final.md`: taps (targets, double taps, feedback). `w1/seams.md`: where the
three touch each other and who owns each seam. Earlier design rounds with their critiques are in `w1/design/*/`.

**Built, each in its own worktree on ee09f6e, uncommitted:** `w1/code-place/`, `w1/code-taps/`, `w1/code-forms/`
(each `uncommitted.diff` + `BASE.txt`). Builder logs: `w1/build-place.md`, `w1/build-taps.md`, `w1/build-forms.md`.
Acceptance scripts each part must pass: `w1/accept-place/`, `w1/accept-taps/`, `w1/accept-forms/` (B1 to B16, kit
scripts).

**Stages left (workflow `workflows/wave1-build-wf.js`):** integrate: one worktree on the tip, the three parts as three
commits in the order place, taps, forms (resolve the seams as `w1/seams.md` says), run all acceptance scripts and the
main gate, apply the simple-first rule, write `git format-patch -3` into an `integ-patches/` folder → verify: 16
skeptics by theme plus 3 regression hunters over the whole app on a phone → fix rounds → land the three commits, full
test, move `main`, live-check.

**After landing:** release the wave 1 claim row in `docs/TEAM.md`; tell the other sessions (Messages) to adopt the new
helpers on their pages; follow-ups: `modules/overview/guide/frame.js` bottom row repeats the page's filled button
(claude-r's round 5 for claude-f); the top bar cuts off the title "What changes your answer".

## 4. TOUCH: the permanent touch check

A sweep that judges every page for touch problems, so they cannot come back: `qa/touch-rules.json` (23 rules as data,
each with its source), `qa/touch-sweep.mjs` (browser), `qa/touch-page.mjs`, `qa/touch-lib.mjs`,
`tests/touch-rules.test.mjs` (inside `npm test`), docs. Built on c385e41: `touch/code/uncommitted.diff`. Reports:
`touch/build.md` (what it is and its full-sweep counts), `touch/break.md` (a breaker seeded 25+ defects and sampled
40 findings: 9 false alarms, all fixed; missed seeds fixed). Workflow: `workflows/ux-touch-sweep-harness-*.js`.

**Left:** rebase onto the tip (the known counts must be re-taken after wave 1 and wave 2 changed pages), run its
verify stage (independent agents re-check determinism: two runs give the same counts; no false alarm in a fresh
sample), then land as one tools/tests/docs commit. Land it after wave 1 so the counts are taken once.

## 5. W2 and the helper sessions

All in the owner's account, children of the old claude-b session. Model and usage: each wake-up costs weekly usage.

| name | session id | lane | state when written |
|---|---|---|---|
| claude-c | session_01FKTjPHjyXD1JLQswvVKjXT | money follow-ups: loans, Social Security + guesses, left over each month, static site | all four landed (658c5b8, ee09f6e, cb820f2, 5614682), claims released, hand-overs to claude-a written |
| claude-d | session_01FKTjPHeoTuTSTxKZSmKbED | touch fixes: transactions, ai, system, reports, career | closed clean after review |
| claude-e | session_01FKTjPHsiM56gu7323NSoxD | touch fixes: retirement, scenarios | idle; one item left from claude-r's round 4: Financial independence holds an 82 px blank band under a short answer (`modules/retirement/fire/view.js` near lines 112 and 129) |
| claude-f | session_01FKTjPHAKhmyWM2Ez6uoqtM | touch fixes: dashboard, plan, start, check-in, alerts, next step, health score | stopped by the usage limit after answering round 7 in 941dedd; waits for claude-r's round 8 |
| claude-g | session_01FKTjPEkAbY4duPHyCq5kDQ | touch fixes: balance, cash flow, goals, debt, property, household (not claude-a's) | closed clean after review |
| claude-h | session_01FKTjPGHeTuFQAUM21kT4o3 | touch fixes: taxes (not claude-a's), investments, insurance, estate | idle; claude-r's round 4 left "two ways to split a holding's cost" (see the review file) |
| claude-r | session_01FKTjPJMoYW8SiMqzyTw8Wu | independent reviewer, no code edits | idle; owes round 8 for claude-f |

Review rounds are in the repo: `docs/handoffs/review-2026-11-11/<lane>.md`. Hand-overs to claude-a (its 13 folders):
`docs/handoffs/2026-11-11-touch-claude-a.md` (37 touch problems), `...-loans-...`, `...-ssg-...`, `...-left2-...`.
Small item from claude-c: the caption on `reports/statements` names only four sources.

The verified findings behind both waves and the discovery method: `ux/` notes and `notes/sessions.md`.

## 6. LOG: the build log page

Page: https://claude.ai/artifact/VuiHL1TY6VC1CYpTR9mNzK (version 77 when written). Generator and data: `buildlog/`.
- `gen.py` builds `log.json` from `git log` plus `enrich.json` (per commit: `summary`, `points`, `numbers`, optional
  pictures) and `impact.json` (rank). Its paths at the top point at the old machine: change them.
- New entries were written in batches as `buildlog/raw/*.json` (a list of `{id, kind, summary, points, numbers}`)
  and merged into `enrich.json`. Style: two or three plain sentences on what changed for the person using the app,
  real numbers, no builder words. Coordination commits (workboard lines, review notes) get a one-line entry.
- Publishing: read the artifact first, then publish `index.html` to the same address with `log.json` as its data file.
  The pictures already on the page stay when you leave them out.
- Behind: every commit after `fe678cb`'s neighbours on 2026-11-11 evening (about 77), then whatever you land.

## 7. Smaller things

- `docs/WORKBOARD.md`: post a one-line status under Messages every few pages (last one by claude-b: 2026-11-12 14:55
  UTC, the new design rule).
- Remote branches `wip/fu-*` and `wip/ux-findings` are old backups of landed work; leave them.
- The old session's decisions about the owner's earlier answers: `notes/owner-decisions.md`. Its running notes:
  `notes/sessions.md`.
- Known flaky under load: `tests/estimate-perf.test.mjs` and one timing test in
  `modules/transactions/ledger/module.test.mjs`.
- A main-gate failure on 2026-11-12 came from a check that expected the words "Not connected to your PC" while pages
  say "your computer"; fixed in a58b4fd. If the gate fails, reproduce on a quiet machine before believing it.
