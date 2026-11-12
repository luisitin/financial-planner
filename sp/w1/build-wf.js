export const meta = {
  name: 'ux-wave1-build',
  description: 'Wave 1 of the touch stress-test fixes: choose between the two designs per question, plan the seams, build the shell and form-kit tracks in parallel worktrees, integrate, verify every finding on screen with skeptics and regression hunters, fix what they confirm, and hand back ordered patches',
  phases: [
    { title: 'Choose', detail: 'a judge per question picks or merges the two designs; a seams planner splits core/app.js and core/ui/dom.js between tracks' },
    { title: 'Build', detail: 'one builder per track in its own worktree, acceptance scripts green' },
    { title: 'Integrate', detail: 'apply the three tracks on the tip, resolve, all tests and acceptance scripts on the combined build' },
    { title: 'Verify', detail: 'skeptics re-run every finding of every cause; regression hunters walk all pages' },
    { title: 'Fix', detail: 'fix what the verifiers confirmed, check again, write the ordered patches' },
  ],
}
const SP = '$SP'
const REPO = '$REPO'
const W1 = `${SP}/w1`
const TH = `${SP}/ux/synth/themes`
const BASE = args.base
const KIT = `${SP}/ux/kit.mjs`

const COMMON = `You are part of claude-b's team on a personal financial planning web app: plain ES modules, no framework, no bundler. Repo ${REPO}, branch claude/creative-build-b531q0, the tip to build on is ${BASE}. The owner opens it on an iPhone (390 px wide, thumbs, Safari, also as a home-screen app); a layperson must be able to use every page. AGENTS.md is in your context; docs/CONVENTIONS.md, docs/DESIGN_LOG.md (the owner's decisions: never undo or re-propose one) and docs/TEAM.md bind every change.

The owner's request (2026-11-11), verbatim: "Be extensive and use tons of agents to stress test every single touch and input for usability, ease, smoothness, choreography, user experience, easy to understand and navigate. Focusing on easy to know next step, to go back, to navigate and to focus correctly while understanding. Quality over quantity."

278 findings were confirmed on screen by testers and skeptics and sorted by cause (one file per cause in ${TH}/, all in one line each in ${SP}/ux/synth/index.tsv; scripts and pictures of a finding "<walker>/<id>" in ${SP}/ux/<walker>/ and ${SP}/ux/<walker>/verify/). Since then six builder sessions fixed the page-level causes on the branch (their commits are in ${BASE}; their notes for wave 1 are under Messages in docs/WORKBOARD.md: read the lines addressed to claude-b or "wave 1"). This is WAVE 1: the causes in the shared shell and form kit, fixed once for every page: core/app.js, core/router.js, core/search.js, index.html, core/ui/dom.js, core/ui/base.css, modules/overview/guide/frame.js, and new small files under core/ if a design calls for them. Those files are claimed for wave 1 in docs/TEAM.md; nothing else is. Page files change in wave 1 only where a design says a page must adopt something and only on claude-b's pages (never claude-a's: goals/emergency-fund, goals/vehicle, goals/travel, goals/charitable, debt/student-loans, debt/consolidation, taxes/state, taxes/self-employment, taxes/filing-status, taxes/documents, balance/projection, balance/statement, cashflow/statement); prefer mechanisms that need no page change.

Tools: the browser kit ${KIT} (read its header: serve(root, port) refuses a port in use, households(root), open({base, plan, route, viewport, dark, reducedMotion, slow, touch}), census, state, act, tapText (pass {scope: "#content"}), tapAt, fillBox, back, kb, shot, PHONE, SMALL_PHONE, LANDSCAPE) and its twelve traps (in ${SP}/wux-handoff/docs/handoffs/wip-ux/README.md, section "Traps"): scroll with real wheel or touch drags, tap at coordinates, type key by key with a delay, test double taps at 120 to 700 ms, try Back more than once per page at a person's pace. Only Chromium is installed; the owner's phone is Safari: prefer standard mechanisms and list what must be tried on the real phone. Always the sandbox. Never edit ${REPO} itself or ${SP}/ux/app; work only in your own worktree. Never kill processes by pattern; stop only servers you started. Rules for every change: no new global CSS outside core/ui/base.css; views write the plan only through ctx.store.update; compute.js stays pure; every pure function gets a node test; the household's view never shows build, PC, AI or sync wording; plain words on screen; npm test, npm run check and node tools/leak-guard.mjs --worktree green; never edit modules/registry.js by hand (npm run registry) or tests/golden/**.`

const TRACKS = [
  { key: 'place', port: 9411, themes: ['SH-BACK', 'SH-DRAFT', 'SH-REDRAW'], plan: `${W1}/plan-place.md`,
    what: 'place and typing memory: Back, Forward and Reload return to the same spot with the same sections open and typing kept; a save keeps open sections, typing elsewhere on the page, the focus and the thing under the thumb; confirmations seen where the eye is without moving the page' },
  { key: 'taps', port: 9421, themes: ['SH-TAP', 'SH-SEARCH', 'SH-MENU', 'SH-TOPBAR', 'SH-ADDR', 'SH-WAYBACK'], plan: `${W1}/taps/final.md`,
    what: 'taps, menu, search, top bar, addresses and ways back: the second-tap guard, a sign of life on slow pages, the menu search box, the drawer and focus, page titles that fit, an address that names no page, ways back on screen' },
  { key: 'forms', port: 9431, themes: ['UI-ERR', 'UI-ENTER', 'UI-EDIT', 'UI-UNDO', 'UI-LIVE', 'UI-RESULT', 'UI-TARGET'], plan: `${W1}/plan-forms.md`,
    what: 'form controls and answers: errors said at the box in plain words with the first one brought into view, Enter, an edit form that opens at its row and returns there, Undo after a one-tap removal, live boxes that keep the next tap, a fresh answer brought into view, real buttons for the only way on' },
]

phase('Choose')
const JUDGE = (q, a, b) => `${COMMON}

You are the JUDGE for the question "${q}". Two architects designed it independently from opposite starting points, each attacked by three critics and revised:
A: ${W1}/${a}/final.md (critiques ${W1}/${a}/critique-*.md, prototype worktree ${W1}/${a}/proto, scripts and results beside it)
B: ${W1}/${b}/final.md (critiques ${W1}/${b}/critique-*.md, prototype worktree ${W1}/${b}/proto)
If a final.md is missing, use that architect's design.md and say so.
Decide on evidence, not on prose: run both prototypes with the kit (serve each on a port from ${a === 'place' ? 9401 : 9405} to ${a === 'place' ? 9404 : 9408}) on the same journeys from the findings (at least 8, across 3 households and both kinds of page: long pages that draw late, and short forms), at a person's pace, and count which behaviors hold. Weigh: what a person sees (the acceptance behaviors), what can go wrong (races, Safari differences, memory), how many pages need an edit, and how much code the shell has to carry. Then write ${W1}/plan-${a}.md: the chosen design (one of them, or a merge with each borrowed part named and its source), complete and standalone in the same sections as the finals (Behavior B1.., Mechanisms, Adoption list, Risks, iPhone Safari, Build steps, Design log and lanes, Coverage of every finding id in its theme files), plus a section "Why this one" with the measurements. Also ${W1}/plan-${a}-steps.json: [{id, title, files, change, checks, closes}] in build order. Stop every server you started.`
const J_SCHEMA = { type: 'object', properties: { plan_path: { type: 'string' }, chosen: { type: 'string', description: 'A, B or merge, and the parts taken from each' }, measured: { type: 'string' }, risks: { type: 'array', items: { type: 'string' } } }, required: ['plan_path', 'chosen'] }
const [jp, jf] = await parallel([
  () => agent(JUDGE('place and typing memory (Back, Forward, Reload; typing kept; a save that keeps the page as it was)', 'place', 'place2'), { label: 'judge:place', phase: 'Choose', schema: J_SCHEMA }),
  () => agent(JUDGE('form controls and answers (errors at the box, Enter, edit at the row, Undo, live boxes, answers into view, real buttons)', 'forms', 'forms2'), { label: 'judge:forms', phase: 'Choose', schema: J_SCHEMA }),
])
log(`place: ${jp ? jp.chosen : 'judge failed'}; forms: ${jf ? jf.chosen : 'judge failed'}`)

const SEAMS = await agent(`${COMMON}

You plan the SEAMS between the three wave-1 tracks before anyone builds:
- place: ${W1}/plan-place.md (+ plan-place-steps.json)
- taps: ${W1}/taps/final.md (+ ${W1}/taps/steps.json)
- forms: ${W1}/plan-forms.md (+ plan-forms-steps.json)
Read all three and the current code at ${BASE} (core/app.js, core/router.js, core/search.js, index.html, core/ui/dom.js, core/ui/base.css, modules/overview/guide/frame.js; also what the page builders changed since 6fc5299 in pages that the plans touch or rely on: git -C ${REPO} log --stat 6fc5299..${BASE}). Write ${W1}/seams.md:
1. Ownership: for every function, block and CSS selector any plan changes, which track changes it; where two plans want the same place, one owner and what the other gets from it (a named function or event, its exact signature and behavior).
2. Shared interfaces: what place gives forms and taps (for example: how a page or the kit marks a box whose typing must be kept or must not be; how a fresh confirmation or answer asks to be shown; the redraw's before/after hooks; the history entry ids; how the second-tap guard knows the screen under the finger changed), with exact names.
3. Conflicts between the plans (behaviors that fight: for example the redraw keeping the scroll vs an answer brought into view; the guard swallowing a tap vs a deliberate second tap on Up; Undo notices vs confirmations that leave) and the rule that settles each.
4. What each builder must NOT touch, and the order in which the three patches apply (each must apply on ${BASE} alone AND on top of the ones before it).
5. Pages the plans ask to change: list them; drop any that is claude-a's (they get the shell fix only); check none is being edited right now by a builder session (docs/TEAM.md "Now editing").
Be exact and short. Return a summary.`, { label: 'seams', phase: 'Choose', schema: { type: 'object', properties: { seams_path: { type: 'string' }, order: { type: 'array', items: { type: 'string' } }, conflicts: { type: 'array', items: { type: 'string' } } }, required: ['seams_path', 'order'] } })

phase('Build')
const built = await parallel(TRACKS.map((t) => () => agent(`${COMMON}

You are the BUILDER for track "${t.key}": ${t.what}. The plan to build: ${t.plan} (its steps json beside it). The seams with the other two tracks, which you must follow exactly: ${W1}/seams.md. The findings it must close: ${t.themes.map((x) => `${TH}/${x}.md`).join(', ')}.
Make your worktree: git -C ${REPO} worktree add --detach ${W1}/build-${t.key} ${BASE} (if it exists from an earlier attempt, read what is there and continue). Serve it with the kit on port ${t.port} (or ${t.port + 1} to ${t.port + 4}).
Build the plan's steps in order. For each step: write the node tests first where the logic is pure (they must fail before and pass after), make the change, run the step's checks, look at the result on the phone with the kit at a person's pace and Read the screenshots. Keep a log in ${W1}/build-${t.key}.md (step, files, checks run and their output, what you saw, deviations from the plan and why). For each acceptance behavior B<n>, write a small kit script ${W1}/accept-${t.key}/B<n>.mjs that takes the app's base URL as its first argument, exits 0 when the behavior holds and 1 when it does not, prints what it measured, and is honest on the real page (real swipes, coordinates, key-by-key typing). They will be run against the combined build by others, so make them self-contained (import the kit by its absolute path, build households from the served tree's root given as the second argument).
Then: npm run registry, npm test (0 failures; two speed tests flake under machine load: rerun them alone), npm run check, node tools/leak-guard.mjs --worktree. Add a CHANGELOG line under Unreleased starting "- [builder:claude-b] " and update docs/CONVENTIONS.md (and the module README of any page you changed) with what pages need to know. Do not commit. Write the patch: git -C ${W1}/build-${t.key} add -A && git -C ${W1}/build-${t.key} diff --cached --binary ${BASE} > ${W1}/patch-${t.key}.diff. Stop your server.`, { label: `build:${t.key}`, phase: 'Build', schema: { type: 'object', properties: { patch: { type: 'string' }, accept_dir: { type: 'string' }, accept: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, holds: { type: 'boolean' }, note: { type: 'string' } }, required: ['id', 'holds'] } }, tests: { type: 'string' }, deviations: { type: 'array', items: { type: 'string' } }, phone_checks: { type: 'array', items: { type: 'string' } } }, required: ['patch', 'accept', 'tests'] } })))
log(`built: ${built.map((b, i) => `${TRACKS[i].key} ${b ? `${b.accept.filter((a) => a.holds).length}/${b.accept.length} behaviors` : 'FAILED'}`).join('; ')}`)

phase('Integrate')
const integ = await agent(`${COMMON}

You INTEGRATE the three wave-1 tracks. Patches: ${TRACKS.map((t) => `${W1}/patch-${t.key}.diff (log ${W1}/build-${t.key}.md, acceptance scripts ${W1}/accept-${t.key}/)`).join('; ')}. The apply order and the seams: ${W1}/seams.md.
Make ${W1}/integ: git -C ${REPO} worktree add --detach ${W1}/integ ${BASE} (if it exists, remove it first). Apply the patches one by one in the seams' order with git apply -3 --index, resolving every conflict by the seams' ownership rules (keep both behaviors; never drop one track's behavior to make another's apply). After each patch: npm run registry && npm test (0 failures apart from the two known speed flakes, rerun alone), and commit it locally in the worktree with a plain message naming the track, so the three changes stay separate. Then serve the combined build (port 9441 to 9445) and run every acceptance script of all three tracks against it (node <script> <base> ${W1}/integ). Fix any behavior that held in its own track and fails combined (the cause is almost always a seam): fix it in the commit of the track that owns that code (git commit --fixup and git rebase -i --autosquash is not available; use git reset --soft, re-stage, and recommit in order, or amend the right commit before committing the next).
THEN move the three commits onto the branch's newest tip ${args.tip} (the branch moved on while this was built: among others claude-c's commit 5614682 changed sw.js, index.html and core/app.js so the phone link opens on a weak connection and never runs two versions at once, and cb820f2 changed retirement and left-over pages; see git -C ${REPO} log --stat ${BASE}..${args.tip}): in ${W1}/integ run git rebase --onto ${args.tip} ${BASE} (detached HEAD is fine). Resolve every conflict by keeping BOTH behaviors (the newer commits' behavior is the owner's too: never drop it; read docs/PLAN.md "On a static host" before touching sw.js or the opening guard in index.html). After the rebase: npm run registry, the whole npm test, npm run check, node tools/leak-guard.mjs --worktree, node tools/main-gate.mjs (it must say main may move), and run every acceptance script again on the rebased build. The owner also asked on 2026-11-12: "be aggressive with OPTIONALITY ... Default to less is more and allow more complexity or toggles. We want subtle optional complexity": check that nothing wave 1 adds on screen is more than a person needs by default (notes, bars, lines); anything extra must be quiet and opt-in. Say in integ.md what you changed for that, if anything.
Write ${W1}/integ.md (each patch: conflicts and how resolved; the rebase onto ${args.tip}: conflicts and how resolved; each acceptance script on the combined, rebased build: holds or not, with output), and the three ordered patches: rm -rf ${W1}/integ-patches && git -C ${W1}/integ format-patch -3 -o ${W1}/integ-patches ${args.tip}. Stop your server.`, { label: 'integrate', phase: 'Integrate', schema: { type: 'object', properties: { report: { type: 'string' }, patches_dir: { type: 'string' }, accept_failing: { type: 'array', items: { type: 'string' } }, tests: { type: 'string' } }, required: ['report', 'patches_dir', 'accept_failing'] } })

phase('Verify')
const THEMES = ['SH-BACK', 'SH-DRAFT', 'SH-REDRAW', 'SH-TAP', 'SH-SEARCH', 'SH-MENU', 'SH-TOPBAR', 'SH-ADDR', 'SH-WAYBACK', 'UI-ERR', 'UI-ENTER', 'UI-EDIT', 'UI-UNDO', 'UI-LIVE', 'UI-RESULT', 'UI-TARGET']
const VERDICT = { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, verdict: { type: 'string', enum: ['closed', 'partly', 'not-closed', 'worse', 'page-adoption', 'needs-real-phone'] }, saw: { type: 'string' }, cause: { type: 'string' }, fix: { type: 'string' } }, required: ['id', 'verdict', 'saw'] } }, new_problems: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, severity: { type: 'number' }, steps: { type: 'string' }, saw: { type: 'string' }, should: { type: 'string' }, cause: { type: 'string' } }, required: ['title', 'severity', 'steps', 'saw'] } } }, required: ['items', 'new_problems'] }
const vPrompt = (th, port) => `${COMMON}

You are a SKEPTIC checking wave 1 against the findings of cause ${th}: ${TH}/${th}.md. The combined build is the worktree ${W1}/integ (report ${W1}/integ.md; do not edit it; copy it if you must try something). Serve it with the kit on port ${port} (or the next four).
For EVERY finding in that file: run its steps on the combined build, at a person's pace with real swipes and taps and the traps in mind, on the households it names and one other. Verdict: closed (the person now gets what "should" says), partly (say what is left), not-closed, worse, page-adoption (the shell or kit now offers the fix but this page still has to adopt it: name the page and the helper), or needs-real-phone. Default to not-closed when you cannot show it closed. Also report any NEW problem you meet on the way (something that moves, a lost tap, a lost focus, a doubled or missing confirmation, a page error), with steps. Write ${W1}/verify/${th}.md and stop your server.`
const REGR = [
  { key: 'all-pages', port: 9551, ask: `Run every usable page for 4 households (empty, family, a renter with debt, a retired couple) at 390x844 and 320x568 and in dark mode: no page error, no red notice, nothing off the right edge, nothing under the top bar, every page reachable from the menu and back. Use node qa/smoke-all.mjs if it fits, and the kit for the rest.` },
  { key: 'person', port: 9561, ask: `Be three laypeople with thumbs (a first-time renter, a family mid-month doing the check-in, a retiree) and walk 12 journeys from ${SP}/ux/synth/index.tsv across the whole app (Get started, Dashboard, a long page, a form, the menu and its search, Back and Forward, a reload mid-form, a double tap): does each person know what just happened, where they are, what comes next and how to go back; does the focus sit where they look; does anything move under the thumb; is anything new confusing or clever where something plain would do? Compare with the same journeys on ${BASE} (serve a second worktree of it on another port: git -C ${REPO} worktree add --detach ${W1}/verify/base ${BASE}).` },
  { key: 'break', port: 9571, ask: `Try to break the shell: two navigations while a page still draws; a save while another page draws; the redraw 50 ms after a save; pages that grow late (Will the money last?, Goal seek, Chance the money lasts, Stress tests); pages that redraw themselves; a save in another tab; the sync bar; a full or blocked storage (sessionStorage and localStorage throwing); a plan reset or restore; the guide frame (?guide=); the claude-d, claude-e, claude-f, claude-g and claude-h page changes that use the address (Ledger replacing its address, ?add=, ?edit=, ?back=, ?from=, ?show=, Compare's cache); memory over 200 page changes; the menu opened and closed fast; Escape; Back from the first page; the household view vs the build view; a slow phone (CPU x4).` },
]
const ver = await parallel([
  ...THEMES.map((th, i) => () => agent(vPrompt(th, 9451 + i * 5), { label: `verify:${th}`, phase: 'Verify', schema: VERDICT })),
  ...REGR.map((r) => () => agent(`${COMMON}

You are a REGRESSION HUNTER for wave 1. The combined build is the worktree ${W1}/integ (report ${W1}/integ.md; do not edit it). Serve it with the kit on port ${r.port} (or the next four). ${r.ask}
Report only what you reproduced twice, with exact steps, what you saw and what should happen, and the cause with file and line if you can find it. Write ${W1}/verify/regress-${r.key}.md. Stop your servers.`, { label: `regress:${r.key}`, phase: 'Verify', schema: VERDICT })),
])
const vAll = ver.filter(Boolean)
const open = vAll.flatMap((v) => v.items.filter((x) => ['partly', 'not-closed', 'worse'].includes(x.verdict)))
const fresh = vAll.flatMap((v) => v.new_problems || [])
const adopt = vAll.flatMap((v) => v.items.filter((x) => x.verdict === 'page-adoption'))
log(`verify: ${vAll.reduce((n, v) => n + v.items.filter((x) => x.verdict === 'closed').length, 0)} closed, ${open.length} open, ${adopt.length} page adoption, ${fresh.length} new problems (${ver.length - vAll.length} verifiers failed)`)

phase('Fix')
let round = 0
let still = { open: open.length, fresh: fresh.length }
while (round < 2 && (still.open + still.fresh) > 0) {
  round++
  const fx = await agent(`${COMMON}

You FIX what wave 1's verifiers found (round ${round}). The combined build is the worktree ${W1}/integ with three local commits (place, taps, forms; ${W1}/integ.md; seams ${W1}/seams.md). The verifiers' reports: ${W1}/verify/*.md${round > 1 ? ` and the re-check of round ${round - 1}: ${W1}/verify/recheck-${round - 1}.md` : ''}. Fix every finding marked partly, not-closed or worse and every new problem, in the commit of the track that owns the code (rewrite the local commits in order; keep them three). Reproduce each one first; if you cannot reproduce it twice, say so and leave it. Page-adoption items are not yours: list them. Then npm run registry, npm test, npm run check, the leak guard, and every acceptance script in ${W1}/accept-*/ against the combined build. Write ${W1}/fix-${round}.md (each item: reproduced or not, the change, the check that now passes) and regenerate ${W1}/integ-patches (format-patch -3).`, { label: `fix:${round}`, phase: 'Fix', schema: { type: 'object', properties: { fixed: { type: 'array', items: { type: 'string' } }, not_reproduced: { type: 'array', items: { type: 'string' } }, left: { type: 'array', items: { type: 'string' } } }, required: ['fixed', 'left'] } })
  const re = await agent(`${COMMON}

You are a SKEPTIC re-checking round ${round} of wave 1's fixes. The combined build: ${W1}/integ (do not edit it). What was fixed: ${W1}/fix-${round}.md. For every item there marked fixed, run the original steps (from ${W1}/verify/*.md${round > 1 ? ` and ${W1}/verify/recheck-${round - 1}.md` : ''}) again at a person's pace and say closed or not, with what you saw; also look for anything the fixes broke on the pages they touched. Serve on port 9601 to 9605. Write ${W1}/verify/recheck-${round}.md.`, { label: `recheck:${round}`, phase: 'Fix', schema: VERDICT })
  still = { open: re ? re.items.filter((x) => x.verdict !== 'closed').length : 99, fresh: re ? (re.new_problems || []).length : 0 }
  log(`round ${round}: ${fx ? fx.fixed.length : 0} fixed; re-check: ${still.open} still open, ${still.fresh} new`)
}
return { choose: { place: jp, forms: jf, seams: SEAMS }, built, integ, verify: { open: open.length, fresh: fresh.length, adopt: adopt.map((a) => `${a.id}: ${a.fix || a.saw}`) }, after: still }
