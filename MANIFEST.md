# Manifest (2026-11-13 10:03 UTC)

Shared branch tip when this was made: f9488e6; main: f9488e6

## In-flight code (each folder: BASE.txt, commits/, uncommitted.diff)

### code/rv/b-doc
worktree: $SP/rv/b-doc
base (a commit on the shared branch): 707355c
head when packaged: 257e754
commits above base: 2 (commits/*.patch, in order, git am -3)
files with unsaved edits: 0 (uncommitted.diff, on top, git apply --index)
tree: ac8d-96fc-8ee5-73bd-f167-0f36-4a18-edf0-8d3d-6c3c
  257e754 Import: the bank's Quicken or QuickBooks file (OFX, QFX, QBO), no columns to check
  d7be064 Document reader: a pay stub fills and checks the 401(k), Roth part and match

### code/w1/build-forms
worktree: $SP/w1/build-forms
base (a commit on the shared branch): ee09f6e
head when packaged: ee09f6e
commits above base: 0 (commits/*.patch, in order, git am -3)
files with unsaved edits: 9 (uncommitted.diff, on top, git apply --index)
tree: 83ba-6ef6-efa5-0bba-8b3a-276d-7f9b-7850-c3fe-461c

### code/w1/build-place
worktree: $SP/w1/build-place
base (a commit on the shared branch): ee09f6e
head when packaged: ee09f6e
commits above base: 0 (commits/*.patch, in order, git am -3)
files with unsaved edits: 10 (uncommitted.diff, on top, git apply --index)
tree: 84b0-0008-5c91-ac98-c3c3-e55e-5d1f-e363-427f-d587

### code/w1/build-taps
worktree: $SP/w1/build-taps
base (a commit on the shared branch): ee09f6e
head when packaged: ee09f6e
commits above base: 0 (commits/*.patch, in order, git am -3)
files with unsaved edits: 22 (uncommitted.diff, on top, git apply --index)
tree: 43ae-8f66-5ce9-aad2-4b53-dbd5-3cf3-19fa-6a5c-4d53

### code/w1/integ
worktree: $SP/w1/integ
base (a commit on the shared branch): 707355c
head when packaged: 7963428
commits above base: 3 (commits/*.patch, in order, git am -3)
files with unsaved edits: 0 (uncommitted.diff, on top, git apply --index)
tree: 5709-6cb7-9e21-c214-81e6-079f-4dd2-1e56-2dfd-ad5a
  7963428 Wave 1, taps: a second tap does one thing; the menu, its search and the ways back
  2e55551 Wave 1, place: Back returns to the same spot; typing and open sections are kept
  bd2cc32 Wave 1, forms: every form speaks in plain words at the box

### code/wtouch
worktree: $SP/wtouch
base (a commit on the shared branch): c385e41
head when packaged: c385e41
commits above base: 0 (commits/*.patch, in order, git am -3)
files with unsaved edits: 9 (uncommitted.diff, on top, git apply --index)
tree: 2a68-616e-867c-0e2a-1b62-1168-d659-34a4-34ea-d795

## Files
- MANIFEST.md
- PROMPT.md
- README.md
- STATE.md
- code/rv/b-doc/BASE.txt
- code/rv/b-doc/commits/0001-Document-reader-a-pay-stub-fills-and-checks-the-401-.patch
- code/rv/b-doc/commits/0002-Import-the-bank-s-Quicken-or-QuickBooks-file-OFX-QFX.patch
- code/w1/build-forms/BASE.txt
- code/w1/build-forms/uncommitted.diff
- code/w1/build-place/BASE.txt
- code/w1/build-place/uncommitted.diff
- code/w1/build-taps/BASE.txt
- code/w1/build-taps/uncommitted.diff
- code/w1/integ/BASE.txt
- code/w1/integ/commits/0001-Wave-1-forms-every-form-speaks-in-plain-words-at-the.patch
- code/w1/integ/commits/0002-Wave-1-place-Back-returns-to-the-same-spot-typing-an.patch
- code/w1/integ/commits/0003-Wave-1-taps-a-second-tap-does-one-thing-the-menu-its.patch
- code/wtouch/BASE.txt
- code/wtouch/uncommitted.diff
- sp/buildlog/build.py
- sp/buildlog/enrich.json
- sp/buildlog/gen.py
- sp/buildlog/impact-merge.py
- sp/buildlog/impact-raw.json
- sp/buildlog/impact-verified.json
- sp/buildlog/impact.json
- sp/buildlog/index.html
- sp/buildlog/pair.py
- sp/buildlog/raw/catchup-1.json
- sp/buildlog/raw/catchup-2.json
- sp/buildlog/raw/catchup-3.json
- sp/buildlog/raw/r21.json
- sp/buildlog/raw/r2batch.json
- sp/buildlog/raw/r3.json
- sp/buildlog/raw/r3b.json
- sp/buildlog/raw/reader16.json
- sp/buildlog/raw/review-fixes.json
- sp/buildlog/raw/self-1.json
- sp/buildlog/raw/self-2.json
- sp/buildlog/raw/self-3.json
- sp/buildlog/raw/self-4.json
- sp/buildlog/raw/self-5.json
- sp/buildlog/raw/self-6.json
- sp/buildlog/raw/self-7.json
- sp/buildlog/raw/setup-2026-11-01.json
- sp/buildlog/raw/ux-1.json
- sp/buildlog/raw/ux-2.json
- sp/buildlog/raw/ux-3.json
- sp/buildlog/raw/ux-5-6.json
- sp/buildlog/raw/ux-7.json
- sp/buildlog/raw/ux10.json
- sp/buildlog/raw/ux11.json
- sp/buildlog/raw/ux4.json
- sp/buildlog/raw/ux5m.json
- sp/buildlog/raw/ux8.json
- sp/buildlog/raw/w2stress.json
- sp/buildlog/raw/wave1-1.json
- sp/buildlog/raw/wave1-2.json
- sp/buildlog/raw/wave1-3.json
- sp/buildlog/raw/wave1-4.json
- sp/buildlog/raw/wave1-5.json
- sp/buildlog/raw/wave1-6.json
- sp/buildlog/raw/wave2-1.json
- sp/buildlog/raw/wave2-2.json
- sp/buildlog/raw/wave2-3.json
- sp/buildlog/raw/wave2-4.json
- sp/buildlog/raw/wave2-5.json
- sp/buildlog/raw/wave2-6.json
- sp/buildlog/swap.py
- sp/commit_item.py
- sp/est/design/SPEC.md
- sp/est/design/design-eng.md
- sp/est/design/design-stats.md
- sp/est/design/design-ux.md
- sp/handover/PROMPT.md
- sp/handover/README.md
- sp/handover/STATE.md
- sp/handover/make.sh
- sp/handover/push.sh
- sp/handover/redact.py
- sp/handover/unpack.sh
- sp/handover/verify.sh
- sp/opt/c1-smoke.mjs
- sp/opt/c1.md
- sp/opt/c2.md
- sp/opt/census-notes.md
- sp/opt/census-report.mjs
- sp/opt/census-tables.md
- sp/opt/census.md
- sp/opt/census.mjs
- sp/opt/cmp.mjs
- sp/opt/constraints.md
- sp/opt/design-dial.md
- sp/opt/design-inline.md
- sp/opt/design-stages.md
- sp/opt/diff1.mjs
- sp/opt/fx.mjs
- sp/opt/hh.mjs
- sp/opt/inventory.md
- sp/opt/judge-build.md
- sp/opt/judge-less.md
- sp/opt/judge-more.md
- sp/opt/judge-owner.md
- sp/opt/late.mjs
- sp/opt/look.mjs
- sp/opt/research.md
- sp/opt/spec.md
- sp/opt/verify-code.md
- sp/opt/verify-web.md
- sp/opt/walks.md
- sp/owner-decisions.md
- sp/rv/build-wf.js
- sp/rv/connect.md
- sp/rv/engine.md
- sp/rv/pages.md
- sp/rv/spec.md
- sp/rv/team-now.md
- sp/rv/ux.md
- sp/rv/verify-code.md
- sp/rv/verify-web.md
- sp/rv/walk.md
- sp/rv/walk/out/gs/couple2k.real.plan.json
- sp/rv/walk/out/gs/nearRetiree.real.plan.json
- sp/rv/walk/out/gs/noContrib.real.plan.json
- sp/rv/walk/out/gs/noMatch.real.plan.json
- sp/rv/walk/out/gs/renter.real.plan.json
- sp/rv/wb-now.md
- sp/touch/break.md
- sp/touch/build.md
- sp/touch/cdp.mjs
- sp/touch/chunks.mjs
- sp/touch/cross.mjs
- sp/touch/explore.mjs
- sp/touch/explore1.mjs
- sp/touch/explore2.mjs
- sp/touch/explore3.mjs
- sp/touch/filled.mjs
- sp/touch/listpages.mjs
- sp/touch/merge.mjs
- sp/touch/mkbuild.mjs
- sp/touch/mkreport.mjs
- sp/touch/pages.mjs
- sp/touch/prof.mjs
- sp/touch/prof2.mjs
- sp/touch/prof3.mjs
- sp/touch/prof4.mjs
- sp/touch/race1.mjs
- sp/touch/race2.mjs
- sp/touch/repro.mjs
- sp/touch/same-part.mjs
- sp/touch/same.mjs
- sp/touch/subset.mjs
- sp/touch/verify1.mjs
- sp/touch/verify2.mjs
- sp/touch/verify3.mjs
- sp/touch/verify4.mjs
- sp/touch/verify5.mjs
- sp/touch/yearbox.mjs
- sp/ux/kit.mjs
- sp/ux/sessions.md
- sp/ux/synth/flatten.py
- sp/ux/synth/index-v1.tsv
- sp/ux/synth/index.tsv
- sp/ux/synth/missed.tsv
- sp/ux/synth/other.tsv
- sp/ux/synth/themes.py
- sp/ux/synth/themes/A-LANE.md
- sp/ux/synth/themes/FL-CHECKIN.md
- sp/ux/synth/themes/FL-HOME.md
- sp/ux/synth/themes/FL-SETUP.md
- sp/ux/synth/themes/PG-BALCASH.md
- sp/ux/synth/themes/PG-DEBT.md
- sp/ux/synth/themes/PG-EMPTY.md
- sp/ux/synth/themes/PG-RETIRE.md
- sp/ux/synth/themes/PG-TAXINV.md
- sp/ux/synth/themes/PG-TXN.md
- sp/ux/synth/themes/PHONE.md
- sp/ux/synth/themes/SH-ADDR.md
- sp/ux/synth/themes/SH-BACK.md
- sp/ux/synth/themes/SH-DRAFT.md
- sp/ux/synth/themes/SH-MENU.md
- sp/ux/synth/themes/SH-REDRAW.md
- sp/ux/synth/themes/SH-SEARCH.md
- sp/ux/synth/themes/SH-TAP.md
- sp/ux/synth/themes/SH-TOPBAR.md
- sp/ux/synth/themes/SH-WAYBACK.md
- sp/ux/synth/themes/UI-EDIT.md
- sp/ux/synth/themes/UI-ENTER.md
- sp/ux/synth/themes/UI-ERR.md
- sp/ux/synth/themes/UI-LIVE.md
- sp/ux/synth/themes/UI-RESULT.md
- sp/ux/synth/themes/UI-TARGET.md
- sp/ux/synth/themes/UI-UNDO.md
- sp/ux/walk-wf.js
- sp/w1/accept-forms/B1.mjs
- sp/w1/accept-forms/B10.mjs
- sp/w1/accept-forms/B11.mjs
- sp/w1/accept-forms/B12.mjs
- sp/w1/accept-forms/B13.mjs
- sp/w1/accept-forms/B14.mjs
- sp/w1/accept-forms/B15.mjs
- sp/w1/accept-forms/B16.mjs
- sp/w1/accept-forms/B2.mjs
- sp/w1/accept-forms/B3.mjs
- sp/w1/accept-forms/B4.mjs
- sp/w1/accept-forms/B5.mjs
- sp/w1/accept-forms/B6.mjs
- sp/w1/accept-forms/B7.mjs
- sp/w1/accept-forms/B8.mjs
- sp/w1/accept-forms/B9.mjs
- sp/w1/accept-forms/_lib.mjs
- sp/w1/accept-forms/pages/income.view.js
- sp/w1/accept-forms/pages/net-worth.view.js
- sp/w1/accept-forms/pages/rent-vs-buy.view.js
- sp/w1/accept-forms/pages/withdrawal-strategy.view.js
- sp/w1/accept-place/B1.mjs
- sp/w1/accept-place/B10.mjs
- sp/w1/accept-place/B11.mjs
- sp/w1/accept-place/B12.mjs
- sp/w1/accept-place/B13.mjs
- sp/w1/accept-place/B14.mjs
- sp/w1/accept-place/B15.mjs
- sp/w1/accept-place/B16.mjs
- sp/w1/accept-place/B17.mjs
- sp/w1/accept-place/B18.mjs
- sp/w1/accept-place/B19.mjs
- sp/w1/accept-place/B2.mjs
- sp/w1/accept-place/B3.mjs
- sp/w1/accept-place/B4.mjs
- sp/w1/accept-place/B5.mjs
- sp/w1/accept-place/B6.mjs
- sp/w1/accept-place/B7.mjs
- sp/w1/accept-place/B8.mjs
- sp/w1/accept-place/B9.mjs
- sp/w1/accept-place/_lib.mjs
- sp/w1/accept-taps/B1.mjs
- sp/w1/accept-taps/B10.mjs
- sp/w1/accept-taps/B11.mjs
- sp/w1/accept-taps/B12.mjs
- sp/w1/accept-taps/B13.mjs
- sp/w1/accept-taps/B14.mjs
- sp/w1/accept-taps/B15.mjs
- sp/w1/accept-taps/B16.mjs
- sp/w1/accept-taps/B17.mjs
- sp/w1/accept-taps/B2.mjs
- sp/w1/accept-taps/B3.mjs
- sp/w1/accept-taps/B4.mjs
- sp/w1/accept-taps/B5.mjs
- sp/w1/accept-taps/B6.mjs
- sp/w1/accept-taps/B7.mjs
- sp/w1/accept-taps/B8.mjs
- sp/w1/accept-taps/B9.mjs
- sp/w1/accept-taps/_lib.mjs
- sp/w1/bf/accept-all.sh
- sp/w1/bf/jlib.mjs
- sp/w1/bf/journeys.mjs
- sp/w1/bf/serve.mjs
- sp/w1/bf/walk-all.mjs
- sp/w1/build-forms.md
- sp/w1/build-place.md
- sp/w1/build-taps.md
- sp/w1/build-wf.js
- sp/w1/design-alt-wf.js
- sp/w1/fix-1.md
- sp/w1/forms/critique-break.md
- sp/w1/forms/critique-person.md
- sp/w1/forms/critique-scope.md
- sp/w1/forms/design.md
- sp/w1/forms/final.md
- sp/w1/forms/notes-before-forms2.md
- sp/w1/forms/steps.json
- sp/w1/forms2/critique-break.md
- sp/w1/forms2/critique-person.md
- sp/w1/forms2/critique-scope.md
- sp/w1/forms2/design.md
- sp/w1/forms2/final.md
- sp/w1/forms2/steps.json
- sp/w1/integ.md
- sp/w1/judge-place/j-back.mjs
- sp/w1/judge-place/j-draft.mjs
- sp/w1/judge-place/j-extra.mjs
- sp/w1/judge-place/j-recheck.mjs
- sp/w1/judge-place/j-save.mjs
- sp/w1/judge-place/lib.mjs
- sp/w1/judge-place/probe.mjs
- sp/w1/judge-place/probe2.mjs
- sp/w1/judge-place/serve.mjs
- sp/w1/place/critique-break.md
- sp/w1/place/critique-person.md
- sp/w1/place/critique-scope.md
- sp/w1/place/design.md
- sp/w1/place/final.md
- sp/w1/place/steps.json
- sp/w1/place2/critique-break.md
- sp/w1/place2/critique-person.md
- sp/w1/place2/critique-scope.md
- sp/w1/place2/design.md
- sp/w1/place2/final.md
- sp/w1/place2/steps.json
- sp/w1/plan-forms-steps.json
- sp/w1/plan-forms.md
- sp/w1/plan-place-steps.json
- sp/w1/plan-place.md
- sp/w1/rep.py
- sp/w1/resolve-cl.py
- sp/w1/seams.md
- sp/w1/taps/critique-break.md
- sp/w1/taps/critique-person.md
- sp/w1/taps/critique-scope.md
- sp/w1/taps/design.md
- sp/w1/taps/final.md
- sp/w1/taps/steps.json
- sp/w1/undo-dom-part.mjs
- unpack.sh
- workflows/scripts/buildlog-details-wf_388b750e-216.js
- workflows/scripts/buildlog-impact-wf_610bb48f-be3.js
- workflows/scripts/buildlog-wave2-wf_abc886ef-604.js
- workflows/scripts/buildlog-why-verify-wf_4f3a666b-d25.js
- workflows/scripts/handover-cold-read-wf_9d1bd85f-501.js
- workflows/scripts/optional-complexity-design-wf_47d548ba-6e2.js
- workflows/scripts/retirement-levers-build-wf_d7ce29ec-259.js
- workflows/scripts/ux-touch-sweep-harness-wf_9a476a9c-f0f.js
- workflows/scripts/ux-wave1-design-wf_8d3ca7d0-fd2.js
