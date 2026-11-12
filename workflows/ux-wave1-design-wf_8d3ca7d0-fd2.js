export const meta = {
  name: 'ux-wave1-design',
  description: 'Wave 1 of the touch stress-test fixes: design the shell and form-kit mechanisms (place and typing memory; taps, menu and search; form controls), attack each design with three critics, then revise into a build plan',
  phases: [
    { title: 'Design', detail: 'one architect per track reads its verified findings and the code, prototypes the riskiest mechanism' },
    { title: 'Critique', detail: 'three critics per design: break it, a person with a thumb, the maintainer' },
    { title: 'Revise', detail: 'fold the critiques into a final design and ordered build steps' },
  ],
}
const SP = '$SP'
const REPO = '$REPO'
const BASE = (args && args.base) || 'HEAD'
const TH = `${SP}/ux/synth/themes`

const TRACKS = [
  {
    key: 'place', port: 9311,
    title: 'Place and typing memory',
    themes: ['SH-BACK', 'SH-DRAFT', 'SH-REDRAW'],
    files: 'core/app.js (show(), the store.subscribe redraw, echo), core/router.js, index.html, a new small file under core/ if it helps, modules/overview/guide/frame.js (the on-screen back links), core/ui/base.css only for shell selectors',
    brief: `Three causes that share one root: the shell throws the page away and draws it again.
(1) SH-BACK: the phone's Back, Forward and Reload land at the top (or at a clamped spot) with the opened sections shut; on-screen back links ("‹ Your plan", "‹ Back to the check-in", "‹ Quick answers") add history instead of going back.
(2) SH-DRAFT: what was typed but not saved vanishes: on leaving the page any way and coming back, on a reload or a tab the phone dropped, when another part of the same page is saved (severity 5 on the tax pages), when a stray tap opens another row's form; and the phone's Back with a form open leaves the page.
(3) SH-REDRAW: after a save the whole page is rebuilt (core/app.js store.subscribe -> show(current,{keepScroll:true})): sections the person opened snap shut, the thing they tapped moves by up to a screen and a half, the green confirmation and its "what next" link are drawn off screen (the bottom echo has no link and leaves after 3.6 s), and confirmations that remove themselves after 4 s make the page jump under the thumb (the same timer is in about 95 view files).
Starting points to weigh, not conclusions (test them, and weigh at least one real alternative for each): (a) number each history entry (history.state), keep per-entry memory of scroll, open <details> and typed-but-unsaved control values, set history.scrollRestoration = "manual", restore after the page has drawn (pages draw asynchronously and some grow later); (b) keep the page's DOM alive for Back/Forward when the plan has not changed since (a small cache of detached page nodes), falling back to (a) when it has; (c) across a same-page redraw: snapshot which sections are open, which controls hold unsaved typing (value differs from defaultValue; restore only into the same control when its saved value did not change), which control had the focus, and where the tapped control sat on the screen, then put all of that back after the redraw; (d) a sessionStorage mirror so a reload or a dropped tab keeps typing on pages whose boxes are on the page when it draws (Get started's questions); (e) confirmations: shown where the eye is, with their link, and leaving without moving the page. The control "locator" (how the same box or section is recognised after a redraw) is the heart of it: design it and measure how often it finds the same control across the app's 161 pages.`,
  },
  {
    key: 'taps', port: 9312,
    title: 'Taps, menu, search, top bar, addresses, ways back',
    themes: ['SH-TAP', 'SH-SEARCH', 'SH-MENU', 'SH-TOPBAR', 'SH-ADDR', 'SH-WAYBACK'],
    files: 'core/app.js (buildNav, toggleDrawer, openSearch, show()), core/search.js, core/router.js, index.html, core/ui/base.css shell selectors only (#topbar, #sidebar, #scrim, .nav-*), modules/overview/pages (All pages search), modules/overview/guide/frame.js only if a way back belongs there',
    brief: `Six causes in the shell around the page.
(1) SH-TAP: a second tap a moment after the first (120 to 700 ms: a double tap, or an impatient second tap) lands on whatever the redraw or the new page put under the thumb: another page, another form, an answer nobody picked, a second deletion. And after tapping a menu row, slow pages show no sign of life for 1 to 4 seconds (show() runs the page's compute synchronously before anything paints), so people tap again.
(2) SH-SEARCH: typing in the menu's "Find a page" box comes out backwards (buildNav rebuilds the box on every key and focus() puts the cursor at the start), Enter (the keyboard's Go key) does nothing, short words are found inside other words ("car" lists Career, card and Medicare first), and All pages forgets its search on Back.
(3) SH-MENU: with the menu open the phone's Back leaves the page, Escape does nothing, Tab runs on into the page behind, the closed menu still holds 28 invisible tab stops on a phone, the page behind scrolls, reduce-motion is ignored by the drawer and by page-level smooth scrolls, a page change puts the focus nowhere and announces nothing, and a save's confirmation is never read out.
(4) SH-TOPBAR: the page's name is cut off in the top bar: with the status pill's real words ("Saved on this phone") 58 of 159 names are cut at 390 px and 139 at 320 px.
(5) SH-ADDR: an address that names no page, or a page that is switched off, silently shows the Dashboard under the wrong address.
(6) SH-WAYBACK: pages opened from a list (Needs attention, Next best action, Quick answers, the page an answer sends you to for its missing numbers) have no way back on screen, and a home-screen app has no browser Back button. Mind the owner's rule of 2026-11-06 (every page ends with exactly one way on; no bar fixed to the bottom) and the existing guide frame, which already draws "‹ Your plan" style links for pages opened from the path.
Starting points to weigh, not conclusions: a guard that swallows only a second tap that lands near the first tap's spot shortly after the screen under it changed (not a blanket delay); paint the new page's title and a quiet "working it out" line and yield a frame before a heavy compute; rebuild only the menu's list, never its search box; a history entry for the open drawer versus closing on popstate (weigh what Back then does after choosing a page from the menu); inert on what is hidden; a top bar where the name wins the space (the pill's words are an owner decision of 2026-09-15: keep their meaning; how they fit on a narrow screen is yours to design); a plain "that page is not here" card.`,
  },
  {
    key: 'forms', port: 9313,
    title: 'Form controls and answers',
    themes: ['UI-ERR', 'UI-ENTER', 'UI-EDIT', 'UI-UNDO', 'UI-LIVE', 'UI-RESULT', 'UI-TARGET'],
    files: 'core/ui/dom.js (h, field, moneyBox, form, readForm, notice, confirm), core/ui/base.css form and notice selectors, docs/CONVENTIONS.md; the page-by-page adoption is a later wave: list it, do not design each page',
    brief: `Seven causes in how pages ask, check and answer; fix each once in the UI kit (core/ui/dom.js), then pages adopt.
(1) UI-ERR: a rejected Save or Add says why out of sight (the red message goes to the top of the page or form while the button is at the bottom, 300 to 1,800 px away, so the button looks dead), or only through the browser's own bubble ("Please fill out this field.", "Value must be less than or equal to 100."), which is in computer words, vanishes at the next touch and leaves nothing at the box; buttons that do nothing at all when a needed box is empty; values that cannot be right are saved without a word (letters saved as $0 under "Plan saved.", 600 months, a 150% fee, a name with no amounts saved as $0).
(2) UI-ENTER: Enter in a box saves a half-filled form and shuts its section.
(3) UI-EDIT: tapping a row opens its form a screen and a half away, and Save or Cancel leaves the person there instead of at the row; opening, saving or cancelling a form leaves the focus nowhere; a stray tap on another row swaps the half-typed form silently.
(4) UI-UNDO: one tap removes or overwrites with no question and no way back (Remove on the investment pages, "Not a subscription", "Remove the copy", "Use these amounts", "Plan on $6,600 a month", a category pick that also writes a rule), while the rest of the app asks first through window.confirm.
(5) UI-LIVE: boxes that redraw the page the moment they change (what-if boxes) swallow the next tap and drop the focus.
(6) UI-RESULT: after Compare, Work it out or Save the answer is above or below the screen; the person sees nothing change.
(7) UI-TARGET: the only way on is a 16 to 36 px link inside a sentence; buttons called "Open the page" that do not say where they go.
Starting points to weigh, not conclusions: the kit's form takes over validation (novalidate) and says each problem in plain words at its box, brings the first one into view under the top bar and puts the cursor in it; one helper pages with their own checks call to do the same (ui.fieldError or similar); a notice with an Undo button for one-tap removals (and what "undo" means with the store: the draft before the change is at hand); a helper that brings a fresh answer into view without a jump when it is already visible; rules for Enter; an edit form that opens at the row and returns the person and the focus to the row. Another agent designs how the shell keeps open sections, typed values, focus and position across the redraw that follows every store.update (track "place", ${SP}/w1/place/): do not redesign that, but say exactly what your helpers need from it and what they must not fight with.`,
  },
]

const PRE = (t) => `You are a senior front-end engineer on a personal financial planning web app: plain ES modules, no framework, no bundler. Repo ${REPO}, branch claude/creative-build-b531q0, tip ${BASE}. The owner opens it on an iPhone (390 px wide, thumbs, Safari, and as a home-screen app); a layperson must be able to use every page. AGENTS.md is in your context; read docs/CONVENTIONS.md, docs/DESIGN_LOG.md (the owner's decisions: never undo or re-propose one) and docs/TEAM.md before you design.

The owner's request (2026-11-11), verbatim: "Be extensive and use tons of agents to stress test every single touch and input for usability, ease, smoothness, choreography, user experience, easy to understand and navigate. Focusing on easy to know next step, to go back, to navigate and to focus correctly while understanding. Quality over quantity."

What has happened: 26 testers walked the app in a phone-sized browser and an independent skeptic reproduced every finding on screen. 243 findings are confirmed and sorted by cause. This is wave 1 of the fixes: the causes that sit in the shared shell and the shared form kit, so one fix covers every page. Page-by-page fixes are wave 2 and will build on what wave 1 provides.

Track "${t.key}": ${t.title}.
${t.brief}

The verified findings for this track (read every one in full: steps, what was seen, the cause with file and line, and often a prototyped fix): ${t.themes.map((x) => `${TH}/${x}.md`).join(', ')}. The reproduction scripts and pictures of a finding "<walker>/<id>" are in ${SP}/ux/<walker>/ and ${SP}/ux/<walker>/verify/ (reuse them). All 243 findings in one line each: ${SP}/ux/synth/index-v1.tsv.
Files this track may change: ${t.files}.

Tools. The shared browser kit is ${SP}/ux/kit.mjs (read its header: serve(root, port), households(root), open({base, plan, route, viewport, dark, reducedMotion, slow, touch}), census, state, act, tapText, tapAt, fillBox, back, kb, shot, PHONE, SMALL_PHONE, LANDSCAPE). Only Chromium is installed; the owner's phone is Safari, so prefer standard, conservative mechanisms and name what must be checked on the real phone. Always the sandbox (?sandbox=1). Never edit ${REPO} itself or ${SP}/ux/app (a shared read-only copy served on 127.0.0.1:9300 for other agents). Never kill processes by pattern; stop only servers you started.
Rules that bind any fix: claude-a's pages are not ours to edit (goals/emergency-fund, goals/vehicle, goals/travel, goals/charitable, debt/student-loans, debt/consolidation, taxes/state, taxes/self-employment, taxes/filing-status, taxes/documents, balance/projection, balance/statement, cashflow/statement): a shell or kit fix may help them, a page edit may not. Until another session lands its work, do not plan edits to modules/overview/setup/compute.js, modules/retirement/projection/compute.js or modules/overview/guesses/estimators/*. No new global CSS outside core/ui/base.css; views write the plan only through ctx.store.update; compute.js stays pure; every pure function gets a node test; the household's view never shows build, PC, AI or sync wording; plain words on screen. A permanent touch check (qa/touch-sweep.mjs with rules in qa/touch-rules.json) is being built by another agent in the worktree ${SP}/wtouch (not on the branch yet): read its rules if present and say which of them your behaviours should turn green.`

const DESIGN_ASK = (t) => `${PRE(t)}

RESUME NOTE: a first architect on this track was cut off by a usage limit before it wrote anything final. Whatever it left is in ${SP}/w1/${t.key}/ (scripts, results/ or out/, shots/, and the proto worktree, possibly with prototype edits). Read it first and reuse what holds up: re-run any measurement you rely on (stop no server you did not start; the old ones are already stopped), keep the proto worktree (do not remove it; if git worktree add says it exists, use it as it is).\n\nYour job now is the DESIGN, not the final code. Work in ${SP}/w1/${t.key}/ (create it). For prototyping make your own worktree: git -C ${REPO} worktree add --detach ${SP}/w1/${t.key}/proto ${BASE}, serve it with the kit on port ${t.port}, and edit files there freely. Prototype the riskiest mechanisms far enough to measure them with the kit on real pages (at least 6 pages across 3 households, phone size, with real swipes and taps at a person's pace, not tool shortcuts: several first-round "works well" notes turned out to be tooling artifacts). Keep your scripts and results in ${SP}/w1/${t.key}/. Leave the proto worktree in place with your prototype edits (uncommitted is fine) and stop your server when done.

Write ${SP}/w1/${t.key}/design.md with these sections:
1. Behavior, in a person's words: for each situation, what they do and what they see after the fix. Number each (B1, B2, ...) and cite the finding ids it closes. This list is the acceptance test.
2. Mechanisms: the smallest set that delivers section 1. For each: where it lives (file, function), what it keeps and for how long, how it fits the existing flow (show(), keepScroll, renderSeq, the store.subscribe redraw, the guide frame, the sync bar, the one reload in core/heal.js, the sandbox, pages that draw late or redraw themselves, heavy pages), the alternative you weighed and why it lost, and what your prototype measured.
3. What the shell or kit cannot do and a page must do (the adoption list for wave 2: page, change, finding id). Keep it short: prefer mechanisms that need no page change.
4. Risks: what could make something worse than today, and the exact check that would catch it.
5. iPhone Safari: where it differs from Chromium for your mechanisms, and a short list for the owner to try on the real phone.
6. Build steps in order, each small enough to verify alone: files, the change, the checks that must pass (kit scripts by name, node tests).
7. Design log and lanes: the owner decisions you rely on or must not undo (quote them), and any choice you made where the owner was not asked (pick the conservative option and say so).
8. Coverage: every finding id in your theme files, each marked closed by B<n>, moved to adoption (section 3), or declined with a reason.

Return a short structured summary.`

const D_SCHEMA = { type: 'object', properties: {
  design_path: { type: 'string' }, proto_path: { type: 'string' },
  summary: { type: 'string', description: 'the mechanisms in 5 to 10 lines' },
  measured: { type: 'string', description: 'what the prototype measured, with numbers' },
  open_risks: { type: 'array', items: { type: 'string' } },
}, required: ['design_path', 'summary'] }

const LENSES = [
  { key: 'break', ask: (t) => `You are trying to prove this design fails or makes something worse than today. Attack lifecycles and races (a second navigation while a page still draws; the redraw 50 ms after store.update; pages that grow after drawing; pages that redraw themselves; a save in another tab; the sync bar; the one self-reload in core/heal.js; the sandbox; storage that is full or blocked), the control locator or any matching rule (two boxes with the same name, lists that reorder after a save, rows added or removed), memory growth, and iPhone Safari differences (the back-forward cache, no scroll anchoring, popstate and hashchange order, the on-screen keyboard and visualViewport, home-screen mode, focus() without a tap). Run the architect's prototype (worktree ${SP}/w1/${t.key}/proto: serve it on a port from ${t.port + 10} to ${t.port + 12}; do not edit it, copy it if you must change something) with the kit, at a person's pace, on pages and households the architect did not use. For each behavior B<n> in the design, look for a journey from the findings where it would not hold.` },
  { key: 'person', ask: (t) => `You are a layperson with a thumb and no patience, and also the owner's design conscience. Take 12 journeys from the findings files and walk each against the design's Behavior section and the prototype (worktree ${SP}/w1/${t.key}/proto: serve it on a port from ${t.port + 13} to ${t.port + 15}; do not edit it). For each: does the person know what just happened, where they are, what comes next and how to go back; does the focus sit where they are looking; does anything move under the thumb. Flag: anything that would surprise; any new on-screen words that are not plain; any behavior that is clever where a simpler visible thing would be clearer; anything that conflicts with docs/DESIGN_LOG.md (quote the entry) or re-proposes what the owner already decided; anything the design leaves worse for the person than today.` },
  { key: 'scope', ask: (t) => `You are the maintainer who has to live with this. Check: is it the smallest change that closes the findings, or could a simpler mechanism close the same ones; file ownership and lanes (docs/TEAM.md claims and designer lane for core/ui/*, docs/WORKBOARD.md claims by claude-a and claude-c); AGENTS.md rules (core stays dependency-free, no new global CSS outside base.css, tests for every pure function, the static site: what adding or changing a core file means for sw.js and tools/main-gate.mjs, npm run check); testability (what is asserted by node tests, what by kit scripts, what by the touch-sweep rules in ${SP}/wtouch/qa/touch-rules.json if present, what only on a real phone); the build steps (is each verifiable alone, is the order right, what conflicts with the other two wave-1 tracks in ${SP}/w1/: read their design.md if present, they also change core/app.js or core/ui/dom.js); and coverage: write a small script that lists every finding id in the track's theme files and checks the design's section 8 accounts for each. Name every finding that is waved through without a real behavior.` },
]
const C_SCHEMA = { type: 'object', properties: {
  critique_path: { type: 'string' },
  blocking: { type: 'array', items: { type: 'string' }, description: 'each: the problem, the evidence, the change you want' },
  should: { type: 'array', items: { type: 'string' } },
  held_up: { type: 'array', items: { type: 'string' } },
}, required: ['critique_path', 'blocking'] }

const R_SCHEMA = { type: 'object', properties: {
  final_path: { type: 'string' }, steps_path: { type: 'string' },
  answered: { type: 'array', items: { type: 'string' }, description: 'each blocking item and how it was resolved (changed the design, or refuted with evidence)' },
  steps: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, closes: { type: 'array', items: { type: 'string' } } }, required: ['id', 'title'] } },
  adoption_count: { type: 'number' },
  phone_checks: { type: 'array', items: { type: 'string' } },
  summary: { type: 'string' },
}, required: ['final_path', 'steps', 'summary'] }

const results = await pipeline(
  TRACKS,
  (t) => agent(DESIGN_ASK(t), { label: `design:${t.key}`, phase: 'Design', schema: D_SCHEMA }),
  async (d, t) => {
    if (!d) return null
    const crits = await parallel(LENSES.map((l) => () => agent(
      `${PRE(t)}

An architect has written a design for this track: ${SP}/w1/${t.key}/design.md (scripts and results beside it; prototype worktree ${SP}/w1/${t.key}/proto). You are a critic. ${l.ask(t)}

Write ${SP}/w1/${t.key}/critique-${l.key}.md: blocking problems first (each with the evidence: a script you ran and what it printed, a file and line, or a quoted rule; and the change you want), then should-fix, then what you tried that held up. Be specific and brief; do not rewrite the design. Return the structured summary.`,
      { label: `critic:${t.key}:${l.key}`, phase: 'Critique', schema: C_SCHEMA })))
    return { d, crits: crits.filter(Boolean) }
  },
  async (x, t) => {
    if (!x) return null
    const r = await agent(
      `${PRE(t)}

An architect wrote ${SP}/w1/${t.key}/design.md (prototype worktree ${SP}/w1/${t.key}/proto, scripts beside the design). Three critics attacked it: ${SP}/w1/${t.key}/critique-break.md, critique-person.md, critique-scope.md. You now own the design. Read all four and the findings. For every blocking item: change the design, or refute it with evidence you produce yourself (run the prototype on port ${t.port + 16}; you may edit the proto worktree to try the changed mechanism). Take the should-fix items that make the result better for the person or simpler to maintain; say which you declined and why. Read the other two tracks' design.md in ${SP}/w1/ if present and make the seams explicit (who changes which function of core/app.js or core/ui/dom.js, in what order, and what each provides to the other).

Write ${SP}/w1/${t.key}/final.md: the complete, standalone final design in the same eight sections (a builder will read only this file and the findings), plus a section 9 "Answers to the critics". Write ${SP}/w1/${t.key}/steps.json: the ordered build steps as [{id, title, files, change, checks, closes}], each verifiable alone. Stop any server you started. Return the structured summary.`,
      { label: `revise:${t.key}`, phase: 'Revise', schema: R_SCHEMA })
    return { track: t.key, design: x.d, critiques: x.crits.map((c) => ({ path: c.critique_path, blocking: c.blocking.length, should: (c.should || []).length })), final: r }
  },
)
return results.filter(Boolean)