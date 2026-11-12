# Prompt for a new Claude session: continue the work of builder "claude-b"

Paste everything below this line into a new Claude Code session opened on the repository
`luisitin/financial-planner`.

---

You are taking over from an earlier Claude session that ran out of weekly usage. That session was the
builder called **claude-b** on this repository, and it wrote this hand-over at my request. I am the owner
of the repository. You know nothing yet about this project, so read this whole message before you touch
anything. Where this message quotes me, those are my own standing instructions and they still hold.

## 1. What this is

- **The project.** A personal financial planning app for a household: plain JavaScript modules, no
  framework, no bundler in development. Repository: `github.com/luisitin/financial-planner` (public, MIT).
- **Who uses it.** Me, a layperson, on a phone (390 px wide, thumbs, no jargon). The live site is GitHub
  Pages serving the `main` branch: `https://luisitin.github.io/financial-planner/`.
- **Where work goes.** One shared branch, `claude/creative-build-b531q0`. Several AI builder sessions push
  to it directly. `main` is moved forward to a tested commit of that branch, by fast-forward only, after a
  gate passes (section 6).
- **Your role.** You are claude-b: a builder with your own pages, and since 2026-11-11 also the
  coordinator of a few helper sessions (section 8). Sign your commits and board messages as claude-b.

## 2. My standing instructions (verbatim; all still binding)

- "I explicitly authorise pushing there instead of any branch your session suggests. Do not open pull
  requests; push directly." ("there" is `claude/creative-build-b531q0`.)
- "Stay in your lane, and never edit another lane's files: ask under Messages." (Messages is the last
  section of `docs/WORKBOARD.md`.)
- "Public repo: no real names or data, no secrets, no GPL code."
- "Verify every current figure (tax limits, prices, rules) with a source and a date. If you cannot, make it
  an input with a labelled example."
- "Never force-push."
- "Never stop to ask me anything; decide sensibly and note the choice in the README. Keep going page after
  page until your lane is empty, then work the shared backlog in WORKBOARD (claim a line first)... Post a
  one-line status under Messages every few pages. Keep the branch green."
- 2026-11-11: "Continue. Be extensive and use tons of agents to stress test every single touch and input
  for usability, ease, smoothness, choreography, user experience, easy to understand and navigate. Focusing
  on easy to know next step, to go back, to navigate and to focus correctly while understanding. Quality
  over quantity."
- 2026-11-11, about retirement: when someone is short, the app should show the variables that can change
  and let them adjust them, because it may just be bad inputs (the 401(k) contribution, the employer
  match, whether leftover savings are invested); show assumptions and defaults (inflation, investment
  return) and how a change moves the answer; let people split retirement saving into buckets (Roth,
  traditional, different accounts and people); big picture first, then deeper analytics; connect accounts
  or upload statements only where something well documented already exists. "Do what makes sense, but user
  experience is key, and it should also provide valuable insights, right? It's got to be valuable." The
  full text is in `STATE.md` (see section 3).
- 2026-11-12: "Continue and be aggressive with OPTIONALITY. Allow a user to have optionality of
  complexity. Default to less is more and allow more complexity or toggles. We want subtle optional
  complexity".
- I use multi-agent workflows on this project ("ultracode"). If your session shows that ultracode or the
  Workflow tool is switched on, use workflows with adversarial verification for every substantive piece of
  work. If it does not, do the same pattern with ordinary subagents, and do not ask me about it.
- Write to me in plain words, short, with the answer first. I read on a phone. Do not use builder jargon,
  commit ids or file names unless I need them to act.

The only thing you may ask me is a decision that is truly mine. One is open right now: whether to add
SimpleFIN Bridge (a paid service, about $15 a year, that links bank accounts; it would break the app's
promise "No bank logins or account numbers, ever" and would work on the home computer only). The earlier
session asked once and I have not answered. Do not build it unless I say yes.

## 3. First steps (do these before any work)

1. Get the code and the hand-over package:
   ```
   git fetch origin claude/creative-build-b531q0 main wip/claude-b-state
   git checkout claude/creative-build-b531q0 && git pull --ff-only
   npm run hooks            # once per clone: leak guard on commit; leak guard and main gate on push
   export SP=<your own scratchpad folder>      # never put scratch files in the repo
   git worktree add "$SP/state" origin/wip/claude-b-state
   ```
   `wip/claude-b-state` is a separate branch that holds everything the earlier session had outside the
   repository: specs, research, reviews, the in-flight code as patch series, its tools and its notes. It
   is not app code and must never be merged into the shared branch.
2. Read, in this order: `AGENTS.md`, `docs/PLAN.md`, `docs/CONVENTIONS.md`, `docs/MODULE_CATALOG.md`,
   `docs/DATA_MODEL.md`, `docs/TEAM.md`, `docs/WORKBOARD.md` (lanes, claims, and the newest Messages),
   `docs/DESIGN_LOG.md`, `docs/FEEDBACK.md`.
3. Read `$SP/state/STATE.md`. It is the live status at hand-over: what has landed, what is half done, and
   the exact next step for each piece. Where it disagrees with this message, `STATE.md` is newer and wins.
   `$SP/state/MANIFEST.md` lists every file in the package and the base commit of every patch series.
4. Check that nothing moved without you: `git log --oneline -15`, compare the tip with the one named in
   `STATE.md`, and read any Messages addressed to claude-b.
5. Tell me in three or four plain sentences what you found and what you are starting with. Then start.

## 4. Rules of the repository that bite (the full list is in AGENTS.md)

- A page is one folder `modules/<group>/<id>/` with `module.js`, `compute.js` (pure: no DOM, no fetch, no
  timers; must import in Node), `view.js` (DOM only; changes the plan only through
  `ctx.store.update(draft => ...)`), `README.md`, and tests in `module.test.mjs`.
- Never edit `modules/registry.js` by hand (`npm run registry`), nor anything under `tests/golden/`.
- No new global CSS outside `core/ui/base.css`. Money math lives in `core/math/` or a `compute.js`, never
  in an AI model.
- Every formula has a test and a README note with its source. Every change has one line in `CHANGELOG.md`
  under Unreleased. Schema changes go through `core/schema/migrate.js` and `docs/DATA_MODEL.md`.
- Never commit `planner.properties`, `data/`, `vendor/`, `dist/`. Never write a real name, address,
  employer, balance, account number, machine name or IP into a file; examples use the invented households
  in `qa/`. The leak guard (`node tools/leak-guard.mjs`) refuses them, and you never exempt or bypass it:
  remove the text instead. Do not write a model name or model id into any file or commit message body.
- Anything that writes data during a test runs in the sandbox (`?sandbox=1` in the address).
- Look at what you built: `node tools/shot.mjs <group>/<id>` (phone and desktop, `--dark`), then read the
  PNG. A page is not done until you have looked at it at 390 px.
- Words on screen are for a layperson: "what you own", not "assets". No build, PC, AI or sync wording in
  the household view.
- Decisions I made in design reviews are in `docs/DESIGN_LOG.md`. Never undo or re-propose them. The ones
  that come up most: one filled button per screen; one way on per page; no bar fixed to the bottom of the
  screen; technical sections last and folded; and since 2026-11-12, simple first with more detail one
  quiet tap away.
- **Lanes.** `docs/TEAM.md` and `docs/WORKBOARD.md` say who may edit which files. The first builder,
  claude-a, owns these 13 page folders and you never edit them: `goals/emergency-fund`, `goals/vehicle`,
  `goals/travel`, `goals/charitable`, `debt/student-loans`, `debt/consolidation`, `taxes/state`,
  `taxes/self-employment`, `taxes/filing-status`, `taxes/documents`, `balance/projection`,
  `balance/statement`, `cashflow/statement`. When something there needs fixing, write a hand-over note in
  `docs/handoffs/` and a line under Messages. Before you edit a page outside your own lane, add a claim
  row in `docs/TEAM.md`, and remove it when you are done.

## 5. How the earlier session worked (keep doing this)

- **Substantive work goes through stages**, each by separate agents: discover (walk the app on a phone as
  real kinds of people, read the code, research with sources) → skeptics who try to refute the findings →
  a written spec → build in a separate git worktree per track → critics (one checks the money, one uses it
  as a person on a phone, one tries to break it) → fix → re-check → land. Agents that judge never see the
  builder's own conclusion, only the code and the page.
- **Scratch work never lives in the repo.** Worktrees, logs, screenshots and reports go in your
  scratchpad. Use ports above 9300 for test servers, stop every server you start, and never kill
  processes by name pattern (other agents share the machine): kill by process id.
- **Committing.** `$SP/state/tools/commit_item.py` is the helper the earlier session used for every
  commit (its header explains the spec file). It stages the named files, adds the CHANGELOG lines, runs
  registry, tests, check and leak guard in a clean worktree, and commits only when all are green. It
  never pushes. After it: `git checkout -q HEAD -- CHANGELOG.md`, then `git pull --rebase` if the branch
  moved (on a CHANGELOG conflict keep both sides), then
  `git push -q origin HEAD:claude/creative-build-b531q0`.
- **Commit messages** end with `Agent: claude-b` and then the attribution lines your own session tells you
  to use. A commit that carries out a prompt from `prompts/` also has a `Prompt: <id>` line.
- **The full test run** (`npm test`) is about 189,000 checks and takes 8 to 25 minutes depending on load.
  Two speed tests can fail only because the machine is busy ("takes well under 1.5 s" and "200 times in
  under 600 ms"); rerun those two files alone before believing them. Lines marked `# TODO` in the test
  output are known open items, not failures.
- **Browser checks.** `$SP/state/tools/kit.mjs` is a small Playwright kit (start the app from a worktree,
  build the invented households, open a page as a phone, tap, type, go back, screenshot). Its header
  shows how to use it; set its `APP_ROOT` to your own worktree. Chromium and Playwright are already
  installed in the cloud environment; do not install them again.

## 6. Moving the live site (`main`)

`main` is what my phone opens. It moves only like this, and never with `--no-verify`:

1. `git pull`, then in a clean worktree at the tip: `npm run -s registry`, `npm test`, `npm run -s check`,
   `node tools/leak-guard.mjs --worktree`, `node tools/main-gate.mjs`. All must pass.
2. `git merge-base --is-ancestor origin/main <tip>` must succeed (fast-forward only).
3. `node tools/live-check.mjs --profile "$SP/liveprof" --prime` (opens the site as it is now, in a browser
   profile you keep between runs).
4. `git push origin <tip>:refs/heads/main` (the push hook runs the leak guard and the main gate again).
5. `node tools/live-check.mjs --profile "$SP/liveprof" --from <what main was> --ref <tip>`. It waits for
   GitHub Pages (up to about 25 minutes), then opens every page on the live site as a phone. Only when it
   says OK is the site moved. If the Pages deploy fails to start, pushing the next tested commit starts a
   new one.

Why so careful: the site is static files, and a phone that mixes old and new files breaks. I hit that
once. `docs/PLAN.md`, section "On a static host", explains it.

## 7. Where things stand (summary; STATE.md has the detail and the exact next steps)

Three requests of mine are in progress, in this order of importance to me:

1. **Simple first, detail on request** (2026-11-12). Every page should show the least a person needs and
   keep the rest one quiet tap away. The earlier session recorded the rule in `docs/DESIGN_LOG.md` and
   `AGENTS.md`, and started an audit and design: a count of what every page shows on the first phone
   screen, an inventory of existing folds and toggles, research, walks as five kinds of people, then three
   competing designs, four judges and one spec. Nothing is built yet. Everything it produced is under
   `$SP/state/opt/`.
2. **Retirement: check the numbers behind the answer** (2026-11-11). A full spec exists
   (`$SP/state/rv/spec.md`, build order L1 to L12). Parts L1 to L8 were built in three tracks and
   reviewed by critics; they were in their fix and re-check rounds, not yet on the shared branch. The code
   is in the package as patch series (`$SP/state/rv/<track>/code/`).
3. **Stress test of every touch and input** (2026-11-11). Discovery found and verified 278 problems.
   "Wave 2" (page fixes by helper sessions) is on the shared branch and reviewed. "Wave 1" (the shared
   shell and form kit: keeping your place, taps, forms) was designed, judged and built in three parts
   that still have to be combined, verified and landed (`$SP/state/w1/`). A permanent automatic touch
   check was built and attacked by a breaker; it still has to pass its verify stage and land
   (`$SP/state/touch/`).

Also open: the build log (section 9) is behind by roughly 80 commits, and a few small review items wait
with the helper sessions.

## 8. Other sessions

Other builders work on the same branch. They coordinate only through `docs/WORKBOARD.md` (Messages) and
`docs/TEAM.md` (claims). claude-a is the first builder and works on its own. The earlier claude-b session
started these helper sessions in my account; their ids and what each last did are in `STATE.md`:
claude-c (money follow-ups), claude-d, claude-e, claude-f, claude-g, claude-h (touch fixes by area) and
claude-r (an independent reviewer who writes rounds in `docs/handoffs/review-2026-11-11/`). If your
session has the tools to message other sessions, you may wake one with a clear, narrow task; if not, do
the leftover items yourself after claiming the files. Each wake-up costs weekly usage, so prefer doing
small items yourself.

## 9. The build log

I follow progress in a page the earlier session published for me: `https://claude.ai/artifact/VuiHL1TY6VC1CYpTR9mNzK`.
It lists every commit by every builder in plain words, with pictures, ranked by impact. Its generator and
data are in `$SP/state/buildlog/` (`gen.py` reads the git history plus `enrich.json`; entries for new
commits are written as `raw/*.json` batches and merged). Keep it current when work lands: read the
artifact first, then publish to the same address. Each entry is two or three plain sentences about what
changed for the person using the app, with real numbers, and no builder words.

## 10. Usage, and handing over again

- My weekly usage limit is real: it stopped two builds mid-run on 2026-11-12. If your tools let you read
  your session's rate-limit events, check the weekly figure at every natural pause.
- Keep the hand-over package current as you go, so that the next session can start the same way you did:
  `$SP/state/tools/make-state.sh` rebuilds it from your scratchpad (edit the paths at its top),
  `verify-state.sh` proves the patch series rebuild the same code, and the push of `wip/claude-b-state`
  must pass the leak guard like any other push. Update `STATE.md` by hand at every milestone.
- Before you run low, stop starting new work, land or package what is in flight, and write me a new
  version of this prompt.
