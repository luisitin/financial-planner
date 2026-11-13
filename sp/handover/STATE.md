# State at hand-over (builder claude-b)

**Written:** 2026-11-13 10:55 UTC. **Not final.** The old session went on working on 2026-11-13 after the weekly limit reset to the
seven-day figure (48% at 00:46 UTC), with the owner's new request of 2026-11-13 (PROMPT.md 2a). Section 0b says what
changed since 2026-11-12 18:53 and what was running when this was packaged. Sections 1 to 8 still describe 2026-11-12
unless 0b says otherwise.

Every `$SP/...` path below exists after `unpack.sh` (first steps of PROMPT.md). In the package itself the same file
is `sp/...`, and in-flight code is `code/<worktree path>/`.

## 0. One-screen summary

| | |
|---|---|
| Shared branch `claude/creative-build-b531q0` | tip `f9488e6` (RV L1 to L11, EST C5 and wave 1 landed; claims for C5 follow-ups + L12, C10 plain words, wave 1 recheck, the simple-first stack open) |
| Live site `main` | `f9488e6` since 2026-11-13 09:52 UTC (wave 1; before that `ff0e9dc`, RV L9 to L11, `d4dc4dc`, EST C5, `1cf9f0a`, RV L1 to L8); full test, check, leak guard and main gate passed; live-checked 2026-11-13 09:59 UTC (161 pages, kept and fresh profile) |
| Weekly usage | The system reports two weekly figures. At 2026-11-12 18:51 UTC the one it named as the limit in force stood at 91% (it rose about 22 points an hour with three multi-agent runs going); the plain seven-day figure said 45%. Act on the higher. The week resets 2026-11-19 08:00 UTC. A new session on the same account shares this limit |
| Open questions for the owner | SimpleFIN Bridge (put to the owner 2026-10-31 and 2026-11-11) and the Devices page with a key per device (2026-10-31): neither answered; build neither without a yes. Three older notes to the owner about frozen answer keys are in `docs/WORKBOARD.md` (2026-11-01, 2026-11-06 twice): check whether later work closed them |
| Old session's scheduled task | "Usage watch and hand-over refresh" (hourly) was switched off by the old session at the final hand-over. If you see it enabled, tell the owner |

In flight, newest request first (the owner has not ranked them):
1. **OPT** simple first, detail on request: discovery, skeptics, three designs and three of four judges done; the spec is not written; nothing built. Section 1.
2. **RV** retirement request: L1 to L8 built and criticised; L1 fixed and re-checked; L2 to L8 rebased with their fix round cut off part way; not landed. Section 2.
3. **W1** wave 1 of the touch stress test (shell and form kit): all three parts built and combined as three commits; the checks on the combined code and the verify stage are not done. Section 3.
4. **TOUCH** the permanent touch check: built and attacked by a breaker; two stages left; not landed. Section 4.
5. **W2** wave 2 (page fixes by helper sessions): landed and reviewed; open review items. Section 5.
6. **LOG** the owner's build log page: behind. Section 6.
7. **EST** believable guesses (owner, 2026-11-02): partly open. Section 8.

**What was cut off at 18:53 UTC** (stopped cleanly; their partial work is on disk and in the package):
retirement `fix:ret:1` and `fix:doc:1` (unsaved edits in `$SP/rv/b-ret`, no fix log yet; the doc track's unsaved edits
were left out, see section 2); wave 1
`integrate` (its three commits and patches exist, its report does not); optionality `judge:build` (the maintainer's
judgement; the other three judges finished). A new session cannot resume those runs: their cache lives on the old
machine.

How every stream was run: one Workflow script (multi-agent) per stage, in `$SP/claude-project/workflows/scripts/`.
Read one before writing your own; they hold the prompts, the stages and the checks that worked. To continue a
stream, cut its script down to the stages that are left and start it as a new run.

## 0b. Since 2026-11-12 18:53 (the session went on, 2026-11-13)

- **Build log** caught up: all 496 commits have entries; published version 78 (section 6 is out of date on that).
- **Shared branch** tip `f513aa2`: a claims commit only (smart guesses part C5 claimed in `docs/TEAM.md`; claude-f's
  review claim of 2026-11-11 is older than a day and that session is stopped; told under Messages). `main` unchanged
  (`737fb6a`).
- **The container restarted at about 00:43 UTC** and stopped three runs; they were resumed from their caches with the
  same scripts (`$SP/claude-project/workflows/scripts/`): `wave1-finish-*` (wave 1: integrate on the tip, verify,
  fix, three patches in `$SP/w1/integ-patches`), `retirement-finish-*` (RV fix rounds, simple-first pass, final
  skeptic), `depth-and-breadth-spec-*` (OPT: the maintainer judge and one spec in `$SP/opt/spec.md`; GAP: every
  feature or option other personal-finance apps have that this app lacks, verified and ranked, each designed as
  optional depth; the five research reports are done in `$SP/gap/research-{plan,cash,invest,life,ux}.md`, the merged
  list and designs go to `$SP/gap/spec.md`). A new session cannot resume runs (their cache is on the old machine):
  look at what each left on disk and run only the stages left.
- **EST C5** started (workflow `est-c5-*`, worktree `$SP/est/c5/wt` on `f513aa2`): audit, build, two critics, fix;
  reports `$SP/est/c5/{audit,build,critic-money,critic-person,fix,handoff}.md`, patches `$SP/est/c5/patches/`.
- **01:52 UTC, 53% weekly.** The OPT spec (`$SP/opt/spec.md`) and the GAP spec (`$SP/gap/spec.md`, 40 designs in
  7 batches; map `$SP/gap/map.md`, check `$SP/gap/map-check.md`) are written. Shared branch tip `7567ac2` (claims for
  the helper and gap batch 1). New run `opt-helper-and-gap-b1-*`: opt C1 (`core/ui/more.js`) then C2 (the first-view
  check) in `$SP/opt/build`, and gap commits 1.2 to 1.6 each in `$SP/gap/b1/<key>/wt` (g12 three boxes, g13 one-time
  debt payments, g14 safe to spend, g15 bill changes, g16 the claiming page), each with a critic and a fix stage;
  reports `$SP/opt/c1.md`, `c2.md`, `$SP/gap/b1/<key>{,-critic,-fix}.md`, patches `$SP/gap/b1/<key>/patches`. Their
  base `761fda2` is the tip plus wave 1's three commits as they stood before the restart (rebased by hand, CHANGELOG
  merged): when wave 1 lands in its final form, rebase these onto it (`git rebase --onto <landed> 761fda2`).
  At that hour: wave 1 `integrate` running; RV track scn done (L1 at `a8e0763` in `$SP/rv/b-scn`), ret and doc fix
  rounds running; EST C5 audit done, build running.
- **02:53 UTC, 57% weekly** (about 4 points an hour with five runs; machine load about 19 on 4 cores, so the two
  known speed tests fail under load: rerun them alone). Wave 1 integrated: three commits on `707355c` in `$SP/w1/integ`
  (`cd58a9d` forms, `8c4d0c7` place, `a11f163` taps), main gate OK, every acceptance script holds except taps B17 on
  purpose (the named way back shown once, simple-first); report `$SP/w1/integ.md`; its verify stage is running.
  Opt C1 built: `c5779a2` in `$SP/opt/build` (report `$SP/opt/c1.md`); C2 and gap 1.2 building. RV: scn final
  skeptic done; ret and doc final skeptics running. EST C5: build running.
- **03:07 UTC: a second container restart**, again with machine load near 19 and four runs going. Since then at
  most three runs at a time, and `$SP/mon/mem.sh` logs memory and load every 30 s to `$SP/mon/mem.log` (two runs:
  about 3.5 GB of 16 used, load 19 from test suites). Resumed from cache: wave 1 (verify stage), RV (scn final fix
  done, L1 now one commit in `$SP/rv/b-scn`; doc final fix; re-checks), then opt C1 + gap batch 1 (C1 cached). EST
  C5 waits (its audit is cached; its build agent had started) and resumes when a run finishes. 03:52 UTC: 60% weekly.
- **04:37 UTC, the owner (verbatim): "Be more aggressive with speed by increasing agents that do different tasks".**
  Done: six runs at once (12 agents). Full suites now go through `$SP/locks/fulltest.sh <worktree> <log>` (two
  machine-wide slots). New runs `gap-items-*` (one script, two runs): group `ga` = 2.3 family packet (g23), 3.2
  estimated payment (g32), 2.4 set aside per bill (g24), 3.5 credit score (g35); group `gb` = 2.5 twelve months (g25),
  3.3 HSA receipts (g33), 3.4 how careful (g34), 4.3 shared costs (g43); worktrees `$SP/gap/{ga,gb}/<key>/wt` on
  `c5779a2` (opt C1), reports `<key>.md`, `-critic.md`, `-fix.md`, patches `<key>/patches`. Claims commit `ab51d5b`.
- **04:52 UTC, 65% weekly.** Wave 1 verify found regressions that must be fixed before it lands (severity 4: after
  "Use this one" a sibling's same-named button lands under the thumb and a re-tap saves the wrong choice; severity 3:
  ai/* pages say "Page not found", the menu on a scrolled page hides the top bar, the bottom note swallows a tap); its
  fix stage follows the verify stage. Do not land wave 1 before that. RV: final fixes done on all three tracks,
  re-checks running. EST C5: built (`3d94706`...), critics running. Gap 1.2 built (`f560f40` in `$SP/gap/b1/g12/wt`),
  1.3 and 1.4 building; opt C2 built or building in `$SP/opt/build`.
- **06:40 UTC: RV L1 to L8 LANDED and LIVE.** Shared branch and `main` at `1cf9f0a` (eight commits picked from
  `$SP/rv/b-{scn,ret,doc}` with their CHANGELOG lines, one DATA_MODEL conflict merged by hand, claim row released);
  full suite green (the two speed tests pass alone), main gate OK, live-check OK (161 pages, kept and fresh profile).
  Then claims `2a9f04e` and a new run `retirement-engine-l9-l11-*` for L9 to L11 (worktree `$SP/rv/eng/wt` on
  `1cf9f0a`, reports `$SP/rv/eng/{build,critic-law,critic-engine,fix,golden}.md`, patches `$SP/rv/eng/patches`). L12
  waits for the EST C5 run (it holds `overview/setup`) and claude-f's stale claim. 05:52 UTC: 72% weekly, about 7
  points an hour.
- **06:52 UTC, 77% weekly** (about 5 points an hour). Wave 1: verify done, its fix stage running (`$SP/w1/integ`).
  EST C5: critics done (a severity-5 money finding M1 on the pay guess among them), fix running. Gap: g13 fixed
  (`e064257`), g12 and g14 in fix; ga g23 built (`6c8385b`), g24 in fix; gb g25/g33 built, g34 and g43 building.
  L9-L11 building. Landing plan once wave 1's fix is done: land wave 1, then rebase C1, C2 and every gap commit onto
  it in one landing worktree, one full suite, one gate, push; bisect only if red.
- **08:05 UTC: EST C5 LANDED and LIVE** at `d4dc4dc` (ten commits from `$SP/est/c5/wt`, 20 of 21 critic findings
  fixed, hand-off `docs/handoffs/2026-11-13-guesses-c5.md`, claim released; suite green, gate OK, live-check OK).
  07:24 UTC: 80% weekly. Claims `5bc622b` and a new run `guesses-followups-and-l12-*` (worktree `$SP/est/fu/wt` on
  `5bc622b`; reports `$SP/est/fu/{build,critic,fix}.md`, patches `$SP/est/fu/patches`): the overview rows of the
  hand-off and RV L12, on claude-f's stale claim (asked under Messages). Lands on its own, not after wave 1.
- **07:55 UTC, 82% weekly.** Gap group `ga` finished (g23 `6bc6ec1`, g24 `4b91ba4`, g32 `5c1b88e`, g35 `c0f64e3`,
  each with its fix report). THE STACK: worktree `$SP/integ2` on `761fda2` (provisional wave 1) holds opt C1, C2, g12,
  g13, g14, g23, g24, g32, g35 picked in that order (`$SP/pick.sh` picks with CHANGELOG union, registry regenerated and
  one-row docs merges by `$SP/rowmerge.py`); run `stack-reconcile-*` fixes the first-view check failures in it
  (report `$SP/integ2-reconcile.md`, review `$SP/integ2-check.md`). Still to add to the stack: g15, g16 (b1 run), gb's
  four. When wave 1's fix stage is done: land wave 1 (its three commits from `$SP/w1/integ` cherry-picked onto the tip),
  then `git rebase --onto <landed wave 1> 761fda2` the stack, one suite, one gate, push.
- **The owner's request of 2026-11-13** (PROMPT.md 2a): no stone unturned; every feature and option other apps have;
  simple by default with depth on request; work until 99% weekly usage, then refresh this package and send the prompt.
  The plan: land wave 1, RV and C5 as they finish; build the OPT helper and page batches on top of wave 1; then the
  GAP items in ranked batches (parallel worktrees, critics, land), each as optional depth behind a simple default.

- **2026-11-13 08:50:** build log republished (v79, 521 entries). Claimed and launched C10 plain words (claim d37ae4b;
  workflow wyfzrunmw, run wf_17012936-9f6, worktrees $SP/est/c10/{a,b}/wt: a = net-worth, liabilities, liquidity;
  b = benchmarks, assumptions, mortgage, next-best-action compute; patches in $SP/est/c10/{a,b}/patches). Wave 1 dry run
  onto d37ae4b ($SP/w1dry): clean except one union in modules/overview/guide/README.md (pick.sh now unions README.md,
  CONVENTIONS.md and OPTIONAL.md conflicts and prints "union ... (review it)"). Still running: wave1 fix:1 (final test),
  stack reconcile pass 2 (wf_d0a2790a-0dd), L9-L11 fix (wf_f09c017f-129), C5 follow-ups + L12 build (wf_0ccdd0bd-510).
- **2026-11-13 09:32:** retirement L9-L11 LANDED and LIVE: 70b1965 (Roth match), ae0ee4b (hopeful return), b47db04 (pay
  pays its own tax, also with an RMD), ff0e9dc (claim released, hand-offs under Messages); main = ff0e9dc, live-check OK.
  Owner switches off by default in retirement/projection/compute.js SWITCHES (incomePaysTaxFirst, newIncomeSaved,
  partnerPayNet; $SP/rv/eng/golden.md says what each would move). Disk was 98% full: landed work folders removed, their
  .md reports kept in $SP/archive-md. Stack: g25 (e08ad18) and g34 (418d75c) picked onto ee1d195; reconcile pass 2 green;
  stack-fix-3 running (wf_9980ef37-d51: 3 first-view failures + open check items, report $SP/integ2-fix3.md).
- **2026-11-13 09:59:** WAVE 1 LANDED and LIVE: 34a7359 forms, 73469f7 place, 0c55300 taps (from $SP/w1/integ bd2cc32,
  2e55551, 7963428 after fix round 1, report $SP/w1/fix-1.md), f9488e6 Workboard message; main = f9488e6, live-check OK.
  The wave 1 claim row stays while its skeptic recheck runs (wf_721d379d-c22); stop that workflow before a round-2 fix
  starts (it would edit w1/integ after landing); its findings become follow-ups ($SP/w1/verify/recheck-1.md). NEXT for the
  stack: when stack-fix-3 (wf_9980ef37-d51) ends, in $SP/integ2: git rebase --onto f9488e6 761fda2 (wave 1 landed with
  fixes, so expect small conflicts in core/ files the stack did not touch; the stack's own files win), registry, first-view
  tests, full suite, push, gate, live-check; release the helper and gap claim rows. Usage 0.91 at 09:58.
- **2026-11-13 10:55:** container restart (down about 10:22 to 10:52). Resumed with args: C5 follow-ups (wf_0ccdd0bd-510,
  base 5bc622b; build 10bfc03 and critic cached, fix reruns), C10 (wf_17012936-9f6, base d37ae4b; group a cached at
  f2ea1ff, group b build reruns in $SP/est/c10/b/wt, which had 4 unsaved files), stack-fix-3 (wf_9980ef37-d51; fix cached at
  integ2 9945cb4, critic reruns). NOT resumed: wave 1's recheck (wf_721d379d-c22; its fixer had not returned, fix-1.md is
  written and wave 1 is live; the skeptic recheck of fix round 1 is still owed: a new session can run it on main).
  C10a picked onto f9488e6 in $SP/land (5286285, 77acced, 58418a1), full suite rerunning. Stack rebased onto f9488e6 in
  $SP/stackland (0bad809; one hand resolution in qa/fixtures/fake-dom.mjs: keep the stack's selector helper, then wave 1's
  textOf comment; rerere is on now). Usage 0.92 at 10:52.
## 1. OPT: simple first, detail on request (owner, 2026-11-12)

**The owner's words** are in PROMPT.md section 2a (2026-11-12, and the "big picture ... delve deeper" sentence of
2026-11-11).

**Already on the shared branch (737fb6a):** the rule in `docs/DESIGN_LOG.md` (entry 2026-11-12) and as a design rule
in `AGENTS.md`, and a line to all builders in `docs/WORKBOARD.md`. The detailed rule there is claude-b's reading, and
says so: the first view of a page, card or form shows the least a person needs (the answer, a few rows, one action);
everything else is one quiet tap away behind a fold or toggle in plain words; chips or presets before an exact box;
a folded part says when it holds a changed figure or an error (an error opens it); opening or closing never changes
the plan; deeper pages are reached by "Go deeper" links.

**The plan (workflow `optional-complexity-design-*.js`), with what exists in `$SP/opt/`:**
- Discover, done: `census.md` + `census-notes.md` + `census-tables.md` (what each usable page shows on the first
  390 px screen, 6 households x about 160 pages; the data file is too big for the package: rerun
  `node census.mjs --root <worktree at the tip>`, about 3 minutes), `inventory.md` (every existing fold, toggle, chip
  row and "show more"; the vocabulary in use; what is remembered per device; where a shared helper can live),
  `research.md` (progressive disclosure, simple and advanced modes in other products, accessibility of folds, with
  sources), `walks.md` (three people who want less, two who want more), `constraints.md` (binding design decisions,
  who may edit which page).
- Verify, done: `verify-code.md`, `verify-web.md` (a correction there overrides a report).
- Design, done: three stances, `design-inline.md` (folds only), `design-dial.md` (folds plus one device setting
  "always show the detail"), `design-stages.md` (depth follows the person's journey), each with one prototyped page
  (worktrees `$SP/opt/proto-*`).
- Judge, three of four done (`judge-less.md`, `judge-more.md`, `judge-owner.md`; the maintainer's was cut off). Scores
  out of 10: the layperson judge: stages 8, inline 7, dial 5; the detail-lover judge: dial 8, inline 7, stages 4; the
  owner's advocate: inline 8, dial 6, stages 5. No design won outright; inline has the best total (22, dial 19, stages
  17) and is nobody's last choice. Points the judges agree on, to carry into the spec: a hint a person can act on,
  above all money they could claim, is never folded; what a person opened by hand stays as they left it and the hand
  beats any device setting; a form part shuts again on the next visit and says when it holds a figure "set by you";
  one narrowed device choice in Settings, default off, answers the owner's word "toggles" (the owner's advocate says
  that choice is the owner's); do not ship the "stages" second level as prototyped. Still to do: the maintainer's
  judgement (run it again), then one spec
  `spec.md`: rules, the shared helper's API and storage, the vocabulary, a first-view budget test with known counts
  that may only go down, a page-by-page plan (A fine / B small fold or reorder / C rework), hand-over lists for other
  lanes.
- Then build in small batches, critics after each, land.

**Facts to carry into the design:**
- `core/ui/` holds only `base.css`, `dom.js`, `placeholder.js`; device toggles live in localStorage
  (`core/features.js` key "planner.features", `core/app.js` NAV_KEY); there are 153 `<details>` folds in 97 `view.js`
  files with inconsistent summary wording.
- Wave 1's forms part (section 3) already ships one optional-detail mechanism: `ui.form` fields marked `more: true`
  fold under "More details (optional)" (`opts.moreLabel`), with a paragraph in `docs/CONVENTIONS.md` ("Less first:
  optional boxes wait under one line") and an acceptance script (`$SP/w1/accept-forms/B16.mjs`). The inventory was
  written before it. Build on it and use its wording.
- Wave 1 owns `core/app.js`, `core/router.js`, `core/search.js`, `index.html`, `core/ui/dom.js`, `core/ui/base.css`,
  `modules/overview/guide/frame.js` and adds "place memory" (open sections survive a redraw, Back and reload). A
  shared helper for optional detail should be a new file that builds on that memory, after wave 1 lands.
- Design decisions in the way of one candidate design ("depth follows the journey"): one path only, no second menu,
  no extra stepper, no new "walk" (DESIGN_LOG 2026-11-06).
- The rule also applies to the retirement parts before they land (their fix rounds include an "optional detail" pass).

## 2. RV: the retirement request (owner, 2026-11-11)

**The owner's words** are in PROMPT.md section 2a (2026-11-11, about retirement), in full.

**Spec:** `$SP/rv/spec.md` (parts A to E, decisions, build order L1 to L12, risks). Discovery reports beside it:
`walk.md`, `engine.md`, `pages.md`, `connect.md`, `ux.md`; skeptics: `verify-code.md`, `verify-web.md` (their
corrections are already in the spec). The five households every critic walked: `$SP/rv/walk/out/gs/*.real.plan.json`.

**Built, not on the shared branch (worktrees rebuilt by `unpack.sh`):**

| track | worktree | parts | head and base at packaging | fix work in it | critic reports (`$SP/rv/<track>/`) | left |
|---|---|---|---|---|---|---|
| scn | `$SP/rv/b-scn` | L1 Goal seek and Sensitivity stop treating a higher return as a fix | one commit on 7297bfb, clean | fix round 1 folded into L1 (`fix-1.md`); re-check 1 done (`recheck-1.md`): 15 of 18 findings closed; open: P6 (the menu search types backwards: `core/app.js`, wave 1's file) and the engine half of M5 (the run is not monotone in the retirement age: `projection/compute.js`), both outside this track; one sentence on Contributions belongs to L3 | `critic-money.md`, `critic-person.md`, `critic-break.md` | optional-detail pass, final skeptic, land |
| ret | `$SP/rv/b-ret` | L2 "What this rests on" on Will the money last? (new `modules/retirement/levers.js`); L3 Contributions (links land on the box, the match check, the answer after a save); L4 the money left over counted the way the person says (`retirement.leftover`); L5 Assumptions (careful, middle, hopeful, and what a change does); L6 pay the tax later or now, per row | five commits on 7297bfb, one per L (`rebase.md` has the table: the old `fixup!` commit and the earlier unsaved work were folded into them) + unsaved edits | the unsaved edits are fix round 1, cut off part way; there is no fix log: read the diff against the critic files to see which findings it closes | `critic-money.md` and `critic-person.md` are round 2; `critic-break.md`; round 1 of the money critic is `money/critic-money-round1-*.md` | finish the fixes (severity 2 and up), re-check, optional-detail pass, final skeptic, land |
| doc | `$SP/rv/b-doc` | L7 Document reader: a pay stub fills and checks the 401(k), the Roth part and the match; L8 Import: the bank's Quicken or QuickBooks file (OFX, QFX, QBO) with the app's own parser `core/ofx.js` | two commits on 7297bfb (`rebase.md`), packaged clean | fix round 1 was cut off part way (12 files, no fix log) and is NOT in the package: its new test and comments hold made-up account-style numbers, which the leak guard refuses, and there was no usage left to rewrite them. Redo the doc fixes from the critic files. In tests for bank files, build such numbers from pieces: the guard refuses any run of 9 or more digits | `critic-money.md` (round 2), `critic-person.md`, `critic-break.md` | finish the fixes, re-check, optional-detail pass, final skeptic, land |

The confirmed findings are the ones in the critic files (id, severity, steps, evidence, fix). The old run's log is
not a source: a re-check that was cut off by the usage limit was recorded as "0 open". The bank files the doc critics
used were invented and are not in the package (their made-up ids look like account numbers to the leak guard);
each critic's steps say what the file held, so write a new one from those lines.

**Per part:** `L<n>.changelog` is the CHANGELOG line to use when landing; `L<n>.msg` the commit message (for L7 and
L8 the messages are inside the two patches; L8's carries `Prompt: quick-ofx-import`).

**Moving a track onto the tip.** All three tracks now sit on 7297bfb; the shared branch has only documentation
commits after it, so a rebase onto the tip should be clean. Commit unsaved edits first as one commit
`wip: fix round 1, cut off at hand-over` (a rebase refuses a dirty tree). If `docs/DATA_MODEL.md` conflicts: its
`retirement` row is one very long line; merge it word by word (not "both sides", which doubles the row) and keep one
description of `leftover?`.

**Landing a ready track.** A track is ready when its final skeptic's report is clean. On the tip of the shared
branch: one commit per L part in order, each with its CHANGELOG line. Land ret as L2, L3, L4, L5, L6 and then one more commit, "Retirement:
fixes from the critics (L2 to L6)", holding the fix rounds, with its own CHANGELOG line (or fold each fix into its L
commit before landing, as was done for scn). `npm run registry`; full test; push; then move `main` (PROMPT.md section 6).

**Claims.** claude-b's row in `docs/TEAM.md` for this request covers levers.js, core/ofx.js, the views of
retirement/projection, contributions, scenarios/goal-seek, sensitivity, system/assumptions, ai/reader,
transactions/import, cashflow/paycheck and career/benefits compute, and DATA_MODEL. The patches also touch files it
did not name at first: `modules/estate/legacy/**`, `modules/career/benefits/view.js` and README, one line on
`modules/transactions/connect` (codex's lane, asked under Messages), `docs/MODULE_CATALOG.md`, `docs/RESOURCES.md`.
The row was extended in 707355c. Release it when the request is done.

**After L1 to L8:**
- L9: a match on a Roth row counts as pay-the-tax-later unless the row says `matchRoth` (projection compute, federal
  compute, DATA_MODEL, golden check).
- L10: a hopeful return above 8% never turns `savingVerdict` green.
- L11: check whether claude-c's commit `cb820f2` already closed it (it fixed the tax-from-savings half; claude-c
  showed that "income before retirement is dropped" was wrong: that income is held by the monthly leftover, and
  counting it would double count).
- L12: "check before fix" wording along the path, on claude-f's pages; claim them once released.
- The spec's section 4 has a "later" list (OFX positions, pdf.js on the phone, leftover against the bank, and so on).

**Account connection verdicts (sourced in the spec, section 3):** build now: pay stub (L7), OFX/QFX/QBO import (L8).
Later: OFX positions, pdf.js on the phone. Only on the owner's explicit yes: SimpleFIN. Not: Plaid, Teller, MX,
Finicity, Akoya, Yodlee, OFX Direct Connect.

**Engine facts worth knowing (verified):** the projection ignores the monthly leftover unless told (cash bucket at 2%,
spent first); the account type decides Roth or pre-tax; a match goes where its row goes; Assumptions has one
`reviewedAt`; one `project()` run takes 0.1 to 0.8 ms; `chanceShown(planChance, copyChance, known)` in
`modules/scenarios/compare/compute.js` and `knownChance(ctx)`, `rememberChance`, `chanceKey` in
`modules/retirement/careful.js` give one "chance it lasts" across pages.

## 3. W1: wave 1 of the touch stress test (owner, 2026-11-11)

Discovery walked the app as a phone, found and verified 278 touch and input problems, and split them: wave 1 fixes
the shared shell and form kit once; wave 2 fixed pages by area (section 5); "wave 3" is each page adopting the new
helpers after wave 1 lands.

**The findings.** `$SP/ux/synth/index.tsv` (278 lines) and `$SP/ux/synth/themes/*.md` (one file per cause; the 16
SH-* and UI-* files are what wave 1's verify skeptics are each given). The same files are on the remote branch
`wip/ux-findings` under `docs/handoffs/wip-ux/` (with a README of the kit's twelve traps); never merge that branch.

**Designs and plans:** `$SP/w1/plan-place.md` (+ `plan-place-steps.json`): the page keeps your place (scroll, open
sections, focus) across a redraw, Back and reload. `plan-forms.md` (+ steps): forms (errors where the eye is,
keyboards, Enter, Cancel). `taps/final.md` (+ `taps/steps.json`): taps (targets, double taps, feedback). `seams.md`:
where the three touch each other and who owns each seam. Earlier design rounds with their critiques:
`$SP/w1/{place,place2,forms,forms2,taps}/`.

**Built, each in its own worktree on ee09f6e (17 commits behind the tip), unsaved:** `$SP/w1/build-taps` (done: 17 of
17 behaviours), `$SP/w1/build-forms` (done; `patch-forms-code.diff` and `patch-forms-docs.diff` beside the logs),
`$SP/w1/build-place` (done 2026-11-12 17:00; `patch-place-code.diff` beside the logs). Builder logs: `build-place.md`,
`build-taps.md`, `build-forms.md`.

**Acceptance scripts:** `$SP/w1/accept-place/` (B1 to B19), `accept-taps/` (B1 to B17), `accept-forms/` (B1 to B16;
B9, B10, B11 and B16 serve throwaway page copies from `accept-forms/pages/`). The behaviours are defined in
`plan-place.md` section 1, `plan-forms.md` section 1 plus B16's header, and `taps/final.md` section 1. Run one with
`node B<n>.mjs <app address> <folder that address serves>` after starting the app from that folder (the kit's
`serve(folder, port)`); exit 0 means it holds. They were passed on the parts stacked, not on each part alone: on
taps alone only B10 and B12 hold (B16 gives 1 of 7 until place's router is under it).

**Combined, not yet checked.** The worktree `$SP/w1/integ` holds the three parts as three commits on 7297bfb:
  - `e75efa2 Wave 1, forms: every form speaks in plain words at the box`
  - `313b1ca Wave 1, place: Back returns to the same spot; typing and open sections are kept`
  - `6764778 Wave 1, taps: a second tap does one thing; the menu, its search and the ways back`
The same three as patches: `$SP/w1/integ-patches/`. The agent that made them was cut off before it wrote its report,
so treat these as unproven: nothing records that the acceptance scripts, the journey suites, the main gate or the
simple-first check were run on the combined code.

**Stages left (workflow `$SP/w1/build-wf.js`):**
1. Finish the integrate stage on `$SP/w1/integ`: rebase onto the tip if it moved; run every acceptance script (they
   were written for the parts stacked, which is what this worktree is), the journey suites
   (`$SP/w1/judge-place/j-*.mjs`, `$SP/w1/bf/journeys.mjs` with `jlib.mjs`, `walk-all.mjs`), the full test, the
   check, the main gate, and look at the simple-first rule; write the docs once (`docs/CONVENTIONS.md`, READMEs,
   CHANGELOG lines) if the commits do not carry them. `seams.md` section 4 has the order and the owners of each seam.
2. Verify: 16 skeptics by theme plus 3 regression hunters over the whole app on a phone.
3. Fix rounds, then land the commits, full test, move `main`, live-check.

**Claims.** claude-b's wave 1 row in `docs/TEAM.md` says "no view.js in this wave"; the code also edits
`modules/overview/pages/view.js` and README, `modules/overview/guide/README.md`, `docs/CONVENTIONS.md` and
`tools/check.mjs`. The row was extended in 707355c; release it after landing.

**After landing:** tell the other sessions (Messages) to adopt the new helpers on their pages; follow-ups:
`modules/overview/guide/frame.js` bottom row repeats the page's filled button (claude-r's round 5 for claude-f); the
top bar cuts off the title "What changes your answer".

## 4. TOUCH: the permanent touch check

A sweep that judges every page for touch problems, so they cannot come back: `qa/touch-rules.json` (23 rules as
data, each with its source), `qa/touch-sweep.mjs` (browser), `qa/touch-page.mjs`, `qa/touch-lib.mjs`,
`qa/touch-static.mjs`, `tests/touch-rules.test.mjs` (inside `npm test`), docs. Built on c385e41 (144 commits behind
the tip): worktree `$SP/wtouch`, unsaved. Reports: `$SP/touch/build.md` (what it is; its count table is from the
first harness and is superseded), `$SP/touch/break.md` (a breaker seeded defects and sampled 40 findings: 9 false
alarms, all fixed; three seeds are still missed after the fixes: S02, S18, S21). The Node test's known counts are in
the diff (T-NAME 0, T-KEYBOARD 16, T-ONE-WAY 54, T-LINK 195, T-HEAD 16, T-CANCEL 4). Workflow:
`ux-touch-sweep-harness-*.js`, phases Build, Break, Sweep, Verify.

**Left: two stages.** Sweep (run the final harness over every page and group the breaks by cause into a findings
list; the last raw run found about 3,000 breaks, most of them one rule, D-BACK) and Verify (independent agents
re-check determinism: two runs give the same counts; no false alarm in a fresh sample). Rebase onto the tip first and
re-take the known counts after wave 1 lands, so they are taken once. Then land as one tools/tests/docs commit.

## 5. W2 and the helper sessions

All in the owner's account, started by the old claude-b session on 2026-11-11. Each wake-up costs weekly usage; do
not start new ones. Before waking one, confirm the id with your session tools (its title names the lane).

| name | session id | lane | state when written |
|---|---|---|---|
| claude-c | session_01FKTjPHjyXD1JLQswvVKjXT | money follow-ups: loans, Social Security + guesses, left over each month, static site | all four landed (658c5b8, ee09f6e, cb820f2, 5614682), hand-overs to claude-a written |
| claude-d | session_01FKTjPHeoTuTSTxKZSmKbED | touch fixes: transactions, ai, system, reports, career | closed clean after review |
| claude-e | session_01FKTjPHsiM56gu7323NSoxD | touch fixes: retirement, scenarios | idle; open from claude-r's round 4: N10, severity 2: Financial independence holds an 82 px blank band under a short answer (`modules/retirement/fire/view.js` near lines 112 and 129) |
| claude-f | session_01FKTjPHAKhmyWM2Ez6uoqtM | touch fixes: dashboard, plan, start, check-in, alerts, next step, health score | stopped by the usage limit after answering round 7 in 941dedd; claude-r's round 8 not written |
| claude-g | session_01FKTjPEkAbY4duPHyCq5kDQ | touch fixes: balance, cash flow, goals, debt, property, household (not claude-a's) | closed clean after review |
| claude-h | session_01FKTjPGHeTuFQAUM21kT4o3 | touch fixes: taxes (not claude-a's), investments, insurance, estate | idle, and has not seen claude-r's round 4: N10, severity 4 (a holding's cost and its lots can still disagree after two saves; `modules/investments/holdings/view.js:74`, `modules/investments/tax-lots/compute.js:183-187`) and N11, severity 3 (`holdings/view.js:66`) |
| claude-r | session_01FKTjPJMoYW8SiMqzyTw8Wu | independent reviewer, no code edits | idle; owes round 8 for claude-f |

Review rounds are in the repo: `docs/handoffs/review-2026-11-11/<lane>.md`. Hand-overs to claude-a (its 13 folders):
`docs/handoffs/2026-11-11-touch-claude-a.md` (37 touch problems), `...-loans-...`, `...-ssg-...`, `...-left2-...`.
Small item from claude-c: the caption on `reports/statements` names only four sources.

**Claim rows.** Commit 707355c removed the finished rows (claude-c's four, claude-f's MR-7 row, claude-b's old
line in the workboard's Claims table) and extended claude-b's two rows in `docs/TEAM.md` to every file the in-flight
code touches (sections 2 and 3). claude-f's review-rounds row stays. A message to codex covers the one line changed
on its planned page `transactions/connect`.

## 6. LOG: the build log page

The page is titled "Planner Build Log" in the owner's Claude account (find it with the artifact tool's list; its
address is deliberately not in this public file). Generator and data: `$SP/buildlog/`.

- **How it is built.** `gen.py` builds `log.json` from `git log` plus `enrich.json` (per commit: `summary`,
  `points`, `numbers`, optional pictures) and `impact.json` (rank). `enrich.json` reproduces all 450 entries of the
  live page exactly, and `index.html` equals the live page.
- **Behind.** The page lists 450 commits up to fe678cb (2026-11-11 20:51); the 45 after it are not listed. The 75
  commits after 45534e7 (2026-11-11 19:34) have no plain-words entry yet (58 real changes, 17 coordination lines).
  Then whatever you land.
- **To rebuild.** Set `REPO` in `gen.py` and `build.py` to a clean worktree on the tip of the shared branch with full
  history; make `$SP/buildlog/img/`; write the new entries as `raw/<name>.json` (a list of
  `{id, kind, summary, points, numbers}`); run `build.py`. Before publishing, check that `log.json` has at least as
  many items as the live one and that `tests` is the last full run's count (about 189,000): `gen.py` reads it from
  `$SP/wt-test.log`, which a quick commit overwrites with a small number.
- **Entry style.** Two or three plain sentences on what changed for the person using the app, real numbers, no
  builder words. Coordination commits (workboard lines, review notes) get a one-line entry. The scripts of the runs
  that wrote and checked earlier entries are `buildlog-*.js` in the workflows folder.
- **A known fault to fix.** The impact data mixes two scales. The page defines impact out of 100 (reach up to 35,
  size up to 40, trust up to 25). The 92 scored entries dated 2026-11-05 22:29 and later were scored 0 to 10 (highest
  9.6), so on the page they read like "8.3 of 100" and all fall under "Behind the scenes". Rescale those 92 to the
  100 scale (or re-score them by the rubric) and score new entries on the 100 scale.
- **Publishing.** Read the page first, then publish `index.html` to the same address with `log.json` as its data
  file. Pictures already on the page stay when you leave them out; new pictures go in `img/` and are published with
  `log.json`. `impact-merge.py` and `swap.py` belong to earlier runs and need inputs that may be missing.

## 7. Smaller things

- `docs/WORKBOARD.md`: post a one-line status under Messages every few pages (last one by claude-b: 2026-11-12 14:55
  UTC, the new design rule).
- Remote branches: `wip/ux-findings` holds the findings (section 3); keep it. `wip/fu-loans`, `wip/fu-ssg`,
  `wip/fu-left2`, `wip/fu-static2` are old backups of work that has since landed in other commits; the owner was told
  on 2026-11-11 they would be deleted once the fixes landed. `wip/claude-b-state` is the first, superseded version of
  this package: ignore it. The old session's tools were not allowed to delete remote branches (2026-11-12), so it told
  the owner, who can delete these five on GitHub. Do not use them.
- A private copy of the app for the phone was published for the owner on 2026-11-06 and last rebuilt that day; the
  live site replaced it. It is out of date and not maintained. Tell the owner; delete it only if the owner asks.
- The old session's record of the owner's earlier answers: `$SP/owner-decisions.md`. Its running notes, the usage
  recipe and the refresh routine: `$SP/ux/sessions.md`.
- The browser kit builds its invented households for the date 2026-11-11 unless told (`households(root, today)`).
- Known flaky under load: `tests/estimate-perf.test.mjs` and one timing test in
  `modules/transactions/ledger/module.test.mjs`.
- A main-gate failure on 2026-11-12 came from a check that expected the words "Not connected to your PC" while pages
  say "your computer"; fixed in a58b4fd. If the gate fails, reproduce on a quiet machine before believing it.

## 8. EST: believable guesses (owner, 2026-11-02, "something key"): partly open

Spec: `$SP/est/design/SPEC.md` (build order C1 to C10), with `design-ux.md`, `design-stats.md`, `design-eng.md`
beside it. Landed: C1, C2, C3, C4, C7 (debts and spending part), the guess sanity check (c804ed0) and "guesses give
the most likely value" (ee09f6e). Listed as still to do on 2026-11-07 and never closed: C5 (the questions and the
reveal tell the truth), C6 (the form kit and the pages outside setup), C8 (verdicts that wait; "Make our guesses
yours"), C9 (calculator previews and coverage), C10 (plain words). Not verified at hand-over: check each against the
code first. `npm run check` prints the coverage ("guess coverage: 61 of 191 unknown inputs handled");
`modules/overview/guesses/README.md` has a "Next" list. On 737fb6a `guessLine`, `pctBox` and "Make our guesses
yours" are not in the code; C10 may be covered by the wording sweeps (79dd6ab, 6fc5299). C6 edits `core/ui/dom.js`
and `base.css`, which wave 1 holds: do it after wave 1 lands.
