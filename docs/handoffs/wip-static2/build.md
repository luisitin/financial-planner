# Lane 4: static-site follow-ups (claude-b, base c804ed0, 2026-11-07)

Patch: <scratch>/static2/patch.diff (25 files, +1147/-48, includes the two hook mode changes 100644 -> 100755; apply with `git apply --index`). Worktree (kept): .../scratchpad/wstatic2. No commit, no push, no CHANGELOG line, live site not touched. Ports used 9230-9232 (all stopped by PID).
Evidence folder: .../scratchpad/static2/ (before-api.txt, before-api-local-nosandbox.txt, after-api-local*.txt, before-stall-start.txt, before-stall-mid.txt, gate-demo.txt, final/*.log, final/stall/report.json, shots/).

## (1) api.base() asks for no PC on a static host
BEFORE (c804ed0): live site, fresh phone context, one open + one navigation: `404 https://luisitin.github.io/api/config` and `404 .../api/health` (2 per open; store.js asks /api/health again on every sync, hence the "13 per open" seen when walking pages). Same tree served by the Pages-like harness: 2 bad requests (before-api-local-nosandbox.txt).
AFTER: same open, 0 bad requests, 572 files (after-api-local-nosandbox.txt). PC server (port 9231, scratch data): `/api/config` 200 and `/api/health` 200, import map present, unchanged (pc-after).
Decision: `api.base()` = typed PC address, else the page's own origin only if the PC served the page (its import map, the same signal core/app.js `servedByPc` uses), else "". Every PC call goes through `api.url()` which throws "No PC is set up" (nothing goes to the site). Chosen over a host-name list because it also works for the harness, a PC on any name, and any other static host. live-check and static-skew `--check` now treat ANY domain-root /api/ request as a problem (an old A phase only warns).
Files: core/api.js, tools/live-check.mjs, qa/flows/static-skew.mjs, tests/api-base.test.mjs (new, 4), tests/live-check.test.mjs, tests/static-skew.test.mjs, tests/store-sync.test.mjs and store-settle.test.mjs (their pretend "PC served the page" gets the import map stub).
Residual (not changed, designer lane): modules/system/backups/view.js and audit/view.js call `fetch(api.base() + "/api/...")` directly; in the sandbox on a static host base is "" so they request `/api/...` at the domain root (404). They should use `api.url(...)` (throws, caught by their own error paths). Say so in a message.

## (2) Hooks executable
BEFORE: `git ls-files -s .githooks` = 100644 both, so git skipped pre-push: the main gate and the commit-range leak guard never ran.
AFTER: 100755 (patch carries the mode change). `npm run hooks` is now `node tools/install-hooks.mjs` (sets core.hooksPath, chmod 755, fails loudly if the repo records anything else); `npm run check` fails on a hook recorded as not 100755 (not enforced on Windows disk mode, and skipped in an exported copy); tests in tests/main-gate.test.mjs (scratch repo included).
Note for the owner's clone: after pulling, run `npm run hooks` once; git applies the mode on checkout.

## (3) R3: the 11-minute wait in the gate
BEFORE: tools/main-gate.mjs had no age check.
AFTER: before any browser check, a push that changes app files (live-check `touchesApp`) is refused while main last moved < 11 minutes ago. "Last moved" = later of the commit date of what main is now and this clone's last "update by push" of that commit (reflog of origin/main; a fetch does not count). Plain message with minutes left and the clock time; override `PLANNER_MAIN_WAIT=skip git push` or `node tools/main-gate.mjs --no-wait <from> <to>`. Docs-only pushes and `npm run skew` by hand never wait. Demonstrated in a scratch clone (gate-demo.txt): "main-gate: wait 11 more minutes. main last moved less than a minute ago ... Push again at 09:29 UTC or later ... PLANNER_MAIN_WAIT=skip git push", exit 1; docs-only and override go on to the browser check. Documented in docs/PLAN.md "The gate". Limit: a push from another clone is seen only by the commit date.
Files: tools/main-gate.mjs, tests/main-gate.test.mjs (3 tests for the wait).

## (4) R2: saved whole copy (built and shipped in the patch)
BEFORE (c804ed0 sw.js, same harness, 390x844): site silent from the start of an open: navigation did not start in 45 s, blank page, page hung (before-stall-start.txt). Site answers the page then goes silent after 30 requests: after 40 s still "Opening your plan..." with 6 requests held (before-stall-mid.txt). Healthy reopen: every file revalidated (~570 requests).
AFTER (final/stall.log, Chromium, one scenario per fresh profile; "ran A/B" = byte comparison of 7 files with the two trees, a mix would show MIXED and a red notice since B' crashes on A's shell):
- unchanged: 1 request, 1.3 s (was ~575 requests).
- stalled (site silent): draws after 5.1 s from the saved copy, A whole, 0 answered requests, no red notice.
- transition (deploy, healthy): 2.8 s, B whole (579 requests from the site), becomes the saved copy; then stalled: 5.1 s, B whole.
- old-whole (deploy, then stalled): 5.3 s, A whole (the last whole set), B' never partly used.
- mid-open (30 answered, then silence): the guard's one reload after 30 s, opens the saved copy: A whole after 35.4 s total, no red notice.
- flaky (deploy, core/app.js dropped): honest "The app could not open. Reload to try again.", no A file under B' files.
static-skew `--check`: PASS (0 PC-address requests); `--check --flaky core/app.js`: PASS; `--check --a c804ed0 --b worktree --how reopen` (the real pair the gate runs): PASS; `--check --no-sw`: FAIL as it must (4 old / 3 new MIXED).
Design (also in sw.js header and docs/PLAN.md "The saved whole copy"): 
- Deploy stamp = the Last-Modified GitHub Pages gives every file of one deploy. Verified 2026-11-07 on the live site: index.html, sw.js, core/app.js, core/math/tax.js, modules/registry.js, core/ui/base.css, a page view.js all `Sat, 07 Nov 2026 07:43:39 GMT`, ETag prefix 6aeed6ab. Not documented by GitHub, so it is verified, not assumed: a copy is saved only from one open whose every file had the same stamp.
- A copy = the files of one open that drew (the page sends `{type:"opened"}` through core/heal.js `announceOpened`, only when no red notice or opening screen shows), complete (shell + every module the registry names, >= 50 files), and whose stamp still matched when asked once more.
- Open: ask the site for the page alone (<= 4 s). Same stamp -> whole open from the copy; other stamp -> from the site, saved as the next copy; no answer / no network / 5xx -> the copy, whole. A page from the copy takes every file from it (pin kept in Cache Storage, survives a worker restart); a missing file is asked of the site and kept only with the copy's stamp, else code gets a 404 and data passes. A page from the site never touches the copy.
- Fail-safe to the old behaviour: no stamp, stamp not within 90 days before the open (a host with a fixed date), no Cache Storage, no resultingClientId, copy older than 24 h (checked again), anything throwing. Unfinished copies are deleted (promote failure, 64-entry cap, tidy at worker start).
- Guard in index.html: still "Opening your plan..." after 30 s -> the one self-heal reload (not in the sandbox).
- Trade-off written in PLAN.md: on a stalled network the owner sees the previous version, not a wait. Retiring the worker leaves its caches (~12 MB) to the browser.
Unverified: Safari/WebKit (only Chromium here); Cache Storage eviction (Safari 7-day cap in a tab, not for a Home Screen app) just falls back to today's behaviour.
Files: sw.js, core/heal.js (announceOpened), core/app.js (one line), index.html (watchdog), qa/flows/static-stall.mjs (new; 6 scenarios), qa/flows/static-skew.mjs (server `stall`/`stallAfter`, exports exportTree), tests/sw-copy.test.mjs (new, 16), tests/sw.test.mjs, tests/heal.test.mjs, tests/static-skew.test.mjs.
Gate advice: when sw.js changes, also run `node qa/flows/static-stall.mjs --out <dir>` (about 3 minutes). This is a worker change, so the push follows the one-at-a-time rule (the wait now enforces it). The push that ships it is not a transition (c804ed0 already has sw.js), so the normal gate applies.

## Tests / checks
- New/changed test files pass alone: api-base 4, sw-copy 16, sw 13, heal 13, main-gate 9, live-check 7, static-skew 9, store-sync/settle 33.
- `npm test`: 188,424 pass; the only non-TODO failure was a timing test ("three years of daily lines ... under 1.5 s", known load-sensitive) because shots ran at the same time; it passes alone (35/35). 629 TODO = known student-loan gaps, not mine.
- `npm run registry`: 161 modules, no change. `npm run check`: OK. `node tools/leak-guard.mjs --worktree`: OK (an IP in my first test draft was caught and replaced by planner-pc.example). Wording test (copied in, not in patch): none of my files in its 344 slips (those are other lanes' pages).

## Shots (390x844, dsf 2; read all) in .../static2/shots/
1 stalled open from the saved copy (Get started, "Saved on this phone"); 2 mid-open silence mended; 3 flaky: honest red notice with one Reload button; 4 new version saved then opened with the site silent; 5 Settings on the PC server, light; 6 Dashboard on the PC server, dark. No page layout changed (no view.js or core/ui edit), so shots 5-6 only confirm the PC path still draws.

## KNOWN changes (tests/guess-sanity.test.mjs)
None.

## TEAM.md
Row added (claude-b, 2026-11-07): no view.js of a usable page edited; shell files index.html, core/app.js, core/heal.js, core/api.js; no core/ui change.

## For claude-a's pages (not touched)
Nothing for their pages from this lane. Only: none of their view.js uses api.base() (grep: only system/backups, system/audit, system/docs, system/settings, system/diagnostics do); the two direct fetches above (backups, audit) belong to the system pages, which are designer/claude-b lane.
