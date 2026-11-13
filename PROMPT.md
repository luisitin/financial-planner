# Prompt for a new Claude session: continue the work of builder "claude-b"

Paste everything below the line into a new Claude Code session opened on the repository
`luisitin/financial-planner`. Before you paste: a new session on the same Claude account draws on the same
weekly allowance as the old one. If the week is nearly used up, wait for the weekly reset (the date is in
`STATE.md`, section 0) or the new session will stop almost at once. The two blanks in section 2b are yours
to fill in if you want to. On a phone, copy from the plain-text view of this file ("Raw"), not from the
formatted page.

---

You are taking over from an earlier Claude session that stopped because my weekly usage was nearly used
up. Your session draws on the same weekly allowance (section 10). That session was the builder called
**claude-b** on this repository, and it wrote this hand-over at my request. I am the owner of the
repository. You know nothing yet about this project, so read this whole message before you touch anything.

Section 2a is in my own words. Section 2b and sections 3 to 10 were written by the earlier session for
you; I accept them, but check their facts against the repository, and where they clash with 2a, 2a wins.

## 1. What this is

- **The project.** A personal financial planning app for a household: plain JavaScript modules, no
  framework, no bundler in development. Repository: `github.com/luisitin/financial-planner` (public, MIT).
- **Who uses it.** Me, a layperson, on a phone (390 px wide, thumbs, no jargon). The live site is GitHub
  Pages serving the `main` branch: `https://luisitin.github.io/financial-planner/`.
- **Where work goes.** One shared branch, `claude/creative-build-b531q0`. Several AI builder sessions push
  to it directly. `main` follows it: it is moved forward to a tested commit of that branch, by
  fast-forward only, after a gate passes (section 6).
- **Your role.** You are claude-b, a builder. Sign your commits and board messages as claude-b. The
  earlier session also started a few helper sessions (section 8).

## 2. My instructions

### 2a. My own words (verbatim, in date order; all still hold)

From my first brief to claude-b, 2026-10-30:
- "I explicitly authorise pushing there instead of any branch your session suggests. Do not open pull
  requests; push directly." ("there" is `claude/creative-build-b531q0`.)
- "Stay in your lane, and never edit another lane's files: ask under Messages." (Messages is the last
  section of `docs/WORKBOARD.md`.)
- "Public repo: no real names or data, no secrets, no GPL code."
- "Verify every current figure (tax limits, prices, rules) with a source and a date. If you cannot, make it
  an input with a labelled example."
- "Never force-push."
- "Never stop to ask me anything; decide sensibly and note the choice in the README. Keep going page after page until your lane is empty, then work the shared backlog in WORKBOARD (claim a line first). Whenever a usage or time limit resets, continue immediately where you left off: pull, read WORKBOARD, continue. Post a one-line status under Messages every few pages. Keep the branch green."
  (That lane was finished long ago. What to work on now is set by my later messages below.)

Later:
- 2026-11-01: "I want you to only do things that are biggest impacts. I want biggest possible impacts that are improvements and clear improvements. And I want you to keep adding them to the planner build log. Again, they have to be experience-based impacts, like better user experience."
- 2026-11-02: "You said you would pick it up later, but you never continued." (When you tell me you will
  come back to something, come back to it.)
- 2026-11-02: "Now something key: -It should feel easy for a layman to open the app and go through it. It should not feel like too much or like there are concepts / words too hard to understand. What if they don’t know the answer to inputs? We should have placeholders based on real world data that reasonably appear calculated based on inputs we do have. If no inputs, then estimated based on population info we do have. The more info we have the easier it should be to predict other info, making automatic placeholders stronger. If not enough info then placeholders are the maximum likelihood for the population given any data we have"
- 2026-11-06: "You can do as you please. Just make sure a layman can easily understand and use the page"
- 2026-11-06, about subagents. I named three models; the names are left out here because this file is
  public. I said to feel free to use a bunch of the two smaller ones as subagents: "It may be far more
  efficient than using" the largest one.
- 2026-11-07, my answer when asked how the live site should get new work: "Update main, keep it in step".
- 2026-11-11: "Continue. Be extensive and use tons of agents to stress test every single touch and input for usability, ease, smoothness, choreography, user experience, easy to understand and navigate. Focusing on easy to know next step, to go back, to navigate and to focus correctly while understanding. Quality over quantity."
- 2026-11-11, about retirement: "A few mentions that I wanted to bring up. When somebody's going through the plan, if they're short on retirement or something, it should say, okay, well, here's the variables that can change, and you're able to adjust them, because sometimes it may just be a bad sequence of inputs. Like maybe they didn't input how much they contributed to their 401k at work. Maybe it's separate. Maybe they didn't input the match correctly, or maybe we're not assuming that the extra money that built up in savings is actually invested. Maybe we say, hey, can you check these numbers? And they check the rate of inflation, the rate of return of investments. You show assumptions, defaults, and then, let them change it and how things could change. Additionally, maybe they have the ability to separate their retirement accounts into different buckets. Like a certain portion will go into Roth, a certain portion into traditional, sometimes in different accounts with different people, if they so choose. After we finish the initial setup of, okay, we're going to do a big picture. Once we're in the big picture, you can delve deeper and get better analytics and your results, etc. Also, don't implement this yet if it's not possible, if it's not easy, or if it's not well documented, but maybe there are some platforms where you can either connect via APIs, I don't know if those exist, or even other ways to connect your accounts, like maybe even upload statements. I don't know if that's actually built in. I don't want to build one if there's not built in, or it's not well documented, or there's not already things that exist for it, but you get the idea. Do what makes sense, but user experience is key, and it should also provide valuable insights, right? It's got to be valuable."
- 2026-11-12: "Continue and be aggressive with OPTIONALITY. Allow a user to have optionality of complexity. Default to less is more and allow more complexity or toggles. We want subtle optional complexity".
- 2026-11-13: "Continue. I want you to make sure that there is no stone left unturned. There should be complete optionality, and there should not exist a single other application in the entire internet, that doesn't have the functionality or optionality of this application. Now, it is extremely important to keep in mind that it should stay simple by default. There should be ways for you to upgrade the complexity and the depth of it, and it should also flow fluid and easy to understand for a human user. Do not stop until you're out of credit when you're 98% or 99 you're 99% of total weekly usage that is when you make sure you update your handoff and send me a prompt here that I could just send to a new session but only 99%."
  (For you: the same holds. Work until 99% of the weekly usage, then refresh the hand-over and write me the prompt.)

### 2b. Not my words: the earlier session's working habits, which I accept. Where they clash with 2a, 2a wins.

- **Multi-agent work.** The earlier session ran with the "ultracode" setting switched on in my app. With
  it on, it did every substantive piece of work as a multi-agent workflow with adversarial verification
  (section 5). If your session shows that ultracode is on, do the same. If it is off, I have not asked for
  that scale in your session: use a few subagents where a second pair of eyes clearly pays (money math, a
  phone walk of a changed page, a reviewer who has not seen your conclusion), and say in your first status
  message that it is off, so I can switch it on if I want more. Having the Workflow tool available is not
  the same as my switching ultracode on. Either way my weekly allowance is limited (section 10): prefer the
  cheaper models for subagents, as I said on 2026-11-06.
- **How to write to me.** Plain words, short, the answer first. I read on a phone. No builder jargon,
  commit ids or file names unless I need them to act.
- **Questions for me.** Do not stop work to ask me things (my rule in 2a). The one exception the earlier
  session made, and I accept: a decision that costs me money, adds a place where a secret is kept, or
  changes a promise the app makes on screen. Put such a question at the end of a status message, carry on
  with everything else, and do not build that one thing until I answer. Two are waiting:
  1. SimpleFIN Bridge: a paid service, about $15 a year, that links bank accounts. It would end the promise
     "No bank logins or account numbers, ever" and would work only when the app is opened from the home
     computer. Put to me on 2026-10-31 and 2026-11-11. My answer: ________ (yes / no / not now; blank
     means not now).
  2. The Devices page (name each device allowed into the app, remove one, make one read-only): it needs a
     key per device kept in a second place on the home computer, which rule 10 of `AGENTS.md` forbids
     without my yes. Put to me on 2026-10-31. My answer: ________ (blank means not now).

## 3. First steps (do these before any work)

Shell variables do not survive from one command to the next in Claude Code: start every command that
needs them with `export SP=<your scratchpad folder> REPO=<the clone>`, or write the paths out.

1. Get the code and the hand-over package:
   ```
   cd "$REPO"
   [ "$(git rev-parse --is-shallow-repository)" = true ] && git fetch --unshallow origin
   git fetch origin claude/creative-build-b531q0 main wip/claude-b-handover wip/ux-findings
   git checkout claude/creative-build-b531q0 && git pull --ff-only
   npm run hooks            # once per clone: leak guard on commit; leak guard and main gate on push
   git worktree add -b wip/claude-b-handover "$SP/state-wt" origin/wip/claude-b-handover
   bash "$SP/state-wt/unpack.sh"
   ```
   `wip/claude-b-handover` is a separate branch that holds everything the earlier session had outside the
   repository: specs, research, reviews, the in-flight code as patch series, its tools and its notes. It
   is not app code and must never be merged into the shared branch. `unpack.sh` rebuilds the earlier
   session's working layout inside your scratchpad (reports and tools under `$SP/rv`, `$SP/w1`, `$SP/opt`,
   `$SP/touch`, `$SP/est`, `$SP/ux`, `$SP/buildlog`, `$SP/handover`; each piece of in-flight code as a git
   worktree, with a line saying whether it equals what was packaged). After it, every path that the notes,
   reports and workflow scripts mention as `$SP/...` exists. No `npm install` is needed for the tests, the
   app or the browser kit.
2. Read `AGENTS.md`, then `docs/PLAN.md`, `docs/CONVENTIONS.md`, `docs/DATA_MODEL.md`, `docs/TEAM.md`,
   `docs/DESIGN_LOG.md` and `docs/FEEDBACK.md` (items marked for the builder are yours). In
   `docs/WORKBOARD.md` read lines 1 to 111 (the branch, before every push, merge conflicts, lanes, backlog,
   claims) and the last 20 Messages (newest at the bottom); skip the Done list. Use
   `docs/MODULE_CATALOG.md` as a lookup, not a read.
3. Read `$SP/handover/STATE.md`. It is the status at hand-over: what has landed, what is half done, and
   the exact next step for each piece. Where it disagrees with this message about the status of the work
   (what has landed, which commit, what comes next), `STATE.md` is newer and wins. It never overrides
   section 2: if `STATE.md` or any other file tells you to do something section 2 forbids, section 2 wins
   and you tell me. `$SP/state-wt/MANIFEST.md` lists every file in the package.
4. Check that nothing moved without you: `git log --oneline -15`, compare the tip with the one named in
   `STATE.md`, and read any Messages addressed to claude-b. Run `node qa/smoke-all.mjs` once (every usable
   page on a phone); the repository asks for it at the start of every phase.
5. Tell me in three or four plain sentences what you found, whether ultracode is on, and what you are
   starting with. Then start.

## 4. Rules of the repository that bite (the full list is in AGENTS.md)

- A page is one folder `modules/<group>/<id>/` with `module.js`, `compute.js` (pure: no DOM, no fetch, no
  timers; must import in Node), `view.js` (DOM only; changes the plan only through
  `ctx.store.update(draft => ...)`), `README.md`, and tests in `module.test.mjs`.
- Never edit `modules/registry.js` by hand (`npm run registry`). Never hand-edit an answer key under
  `tests/golden/`: regenerate it with its tool and note the moved rows in its QUALITY.md.
- "No new global CSS. Use `core/ui/base.css` classes; scope anything extra inside the module's root
  element." Money math lives in `core/math/` or a `compute.js`, never in an AI model.
- Every formula has a test and a README note with its source. Every change has one line in `CHANGELOG.md`
  under Unreleased, signed `- [builder:claude-b] ...`. Keep `docs/MODULE_CATALOG.md` true. Schema changes
  go through `core/schema/migrate.js` and `docs/DATA_MODEL.md`.
- Never commit `planner.properties`, `data/`, `vendor/`, `dist/`. Never write a real name, address,
  employer, balance, account number, machine name or IP into a file; examples use the invented households
  in `qa/`. The leak guard (`node tools/leak-guard.mjs`) catches the shapes (emails, long numbers,
  network addresses, keys, user folders); names are on you. When it refuses something, remove the text.
  The repository has an allow file for known-safe hits; the earlier session did not add to it for its own
  convenience, and never pushed with `--no-verify`.
- Not a repository rule, but the earlier session's environment required it and yours probably will: no
  model name or model id in any file, code comment or commit message text. The attribution lines your
  session prescribes for the end of a commit message are the one exception.
- Anything that writes data during a test runs in the sandbox (`?sandbox=1` in the address).
- Look at what you built before you call it done, at 390 px. `node tools/shot.mjs <group>/<id> --url
  http://127.0.0.1:<port>` screenshots a page of an app that is already running there (phone and desktop,
  `--dark`); it shows the stored plan, so for an invented household use the browser kit (section 5). Then
  read the PNG.
- Words on screen are for a layperson: "what you own", not "assets". No build, PC, AI or sync wording in
  the household view.
- Decisions I made in design reviews are in `docs/DESIGN_LOG.md`. Never undo or re-propose them. The ones
  that come up most: one way on per page; no bar fixed to the bottom of the screen; one path only (no
  second menu, no extra stepper, no new "walk"; the path says "Step", the setup says "Question"); pages
  that need the home computer or the AI helper are listed only while it answers; technical sections last
  and folded; and since 2026-11-12, simple first with more detail one quiet tap away (my sentence is in
  section 2a; the detailed rule in the log is the earlier session's reading of it, which I may tighten or
  loosen). One filled button per screen comes from `AGENTS.md` and `docs/CONVENTIONS.md`.
- **Lanes.** `docs/TEAM.md` and `docs/WORKBOARD.md` say who may edit which files. The first builder,
  claude-a, owns these 13 page folders and you never edit them: `goals/emergency-fund`, `goals/vehicle`,
  `goals/travel`, `goals/charitable`, `debt/student-loans`, `debt/consolidation`, `taxes/state`,
  `taxes/self-employment`, `taxes/filing-status`, `taxes/documents`, `balance/projection`,
  `balance/statement`, `cashflow/statement`. A third builder, codex, has a lane in `docs/WORKBOARD.md`
  too. When something in another lane needs fixing, write a hand-over note in `docs/handoffs/` and a line
  under Messages. Before you edit a page outside your own lane, add a claim row in `docs/TEAM.md`, and
  remove it when you are done.

## 5. How the earlier session worked (with ultracode on; section 2b says what to do when it is off)

- **Substantive work went through stages**, each by separate agents: discover (walk the app on a phone as
  real kinds of people, read the code, research with sources) → skeptics who try to refute the findings →
  a written spec → build in a separate git worktree per track → critics (one checks the money, one uses it
  as a person on a phone, one tries to break it) → fix → re-check → land. Agents that judge are given the
  code and the page, not the builder's conclusion. The scripts of those runs are in
  `$SP/claude-project/workflows/scripts/`; a new session cannot resume the old runs, so cut a script down
  to the stages that are left and start it as a new run.
- **Scratch work never lives in the repo.** Worktrees, logs, screenshots and reports go in your
  scratchpad. Use ports above 9300 for test servers, stop every server you start, and never kill
  processes by name pattern (other agents may share the machine): kill by process id.
- **Committing.** `$SP/commit_item.py` is the helper the earlier session used for every commit; its
  header explains the spec file and what it does. Write the attribution lines your session prescribes
  into `$SP/handover/trailer.txt` once. Be on the shared branch at its tip. It stages the named files,
  adds the signed CHANGELOG lines, runs registry, tests, check and leak guard in a clean worktree, and
  commits only when all are green. It never pushes. After it: `git checkout -q HEAD -- CHANGELOG.md`;
  if the branch moved, `git pull --rebase origin claude/creative-build-b531q0` (on a CHANGELOG conflict
  keep both sides) and run the full `npm test` again; then
  `git push -q origin HEAD:claude/creative-build-b531q0`. Never rebase or amend a commit that is already
  pushed. Commit as the identity the last commits on the branch use (a no-reply address).
- **Commit messages** end with `Agent: claude-b` and then your session's attribution lines (the helper
  does this). A commit that carries out a prompt from `prompts/` also has a `Prompt: <id>` line.
- **Tests.** The full run (`npm test`) is about 189,000 checks: 6 to 10 minutes on a quiet machine,
  longer under load. Any test file runs alone with `node --test <file> ...`; a page's own tests are
  `modules/<group>/<id>/module.test.mjs`. Two speed tests can fail only because the machine is busy; rerun
  them alone before believing them: `node --test tests/estimate-perf.test.mjs
  modules/transactions/ledger/module.test.mjs`. Lines marked `# TODO` in the output are known open items.
  When you run checks by hand, do not pipe them into `tail` or anything that hides a failure.
- **Browser checks.** `$SP/ux/kit.mjs` is a small Playwright kit (start the app from a worktree, build
  the invented households, open a page as a phone, tap, type, go back, screenshot). Its header shows how
  to use it. Chromium and Playwright are already installed in the cloud environment; do not install them
  again.

## 6. Moving the live site (`main`)

`main` is what my phone opens. On 2026-11-07 I was asked how the live site should get new work and chose
"Update main, keep it in step": I want the live site to follow the shared branch, not to sit behind it.
Soon after, my phone ran a mix of old and new files, so since then `main` moves only like this, never with
`--no-verify`, and each time tested work lands rather than once at the end:

1. `git pull`, then in a clean worktree at the tip: `npm run -s registry`, `npm test`, `npm run -s check`,
   `node tools/leak-guard.mjs --worktree`, `node tools/main-gate.mjs`. All must pass. Read the gate's
   output, not only its exit code: it must name the runs it made. If it says it cannot find Playwright it
   has checked nothing; do not push.
2. `git merge-base --is-ancestor origin/main <tip>` must succeed (fast-forward only).
3. `node tools/live-check.mjs --profile "$SP/liveprof" --prime` (opens the site as it is now, in a browser
   profile you keep between runs). Do steps 4 and 5 within 10 minutes of this.
4. `git push origin <tip>:refs/heads/main` (the push hook runs the leak guard and the main gate again).
   The gate refuses a second move of `main` within 11 minutes of the last one that changed the app: wait,
   do not override.
5. `node tools/live-check.mjs --profile "$SP/liveprof" --from <what main was> --ref <tip> --timeout 25`.
   It waits for GitHub Pages (15 minutes unless you pass `--timeout`), then opens every page on the live
   site as a phone. Add `--walk` when the move changed no app file. Only when it says OK is the site
   moved. The earlier session's experience, 2026-11-11: one Pages deploy failed to start and a rerun stayed
   queued; pushing the next tested commit to `main` started a new deploy, which passed.

Why so careful: the site is static files, and a phone that mixes old and new files breaks.
`docs/PLAN.md`, section "On a static host", explains it.

## 7. Where things stand (summary; STATE.md section 00 has the final detail and the exact next steps)

Five requests of mine are in progress, newest first; I have not ranked them. My newest message began with the word
"Continue", so the earlier requests still stand. The earlier session landed a great deal on 2026-11-13; read
`STATE.md` section 00 first: it lists what is live, the one change committed but not landed, and what is open.

0. **No stone unturned** (2026-11-13). Everything other personal-finance apps let a person do or choose, here too,
   each as optional depth behind a simple default. A survey of other apps gave a ranked spec of 40 designs,
   `$SP/gap/spec.md` (build batches in its section 5). Eighteen are live, the last being #21 (a row for each retirement age), #34 (a plan's own fees) and #29 (against
   your debt plan). Work through the rest of the batches in its section 5.
1. **Simple first, detail on request** (2026-11-12). The helper `core/ui/more.js`, its rules `docs/OPTIONAL.md`, the
   first-view check (`tests/first-view.known.json`: counts may only go down) and the "How much to show" card in
   Settings are live, and many pages open simple. On 2026-11-13 Mortgage and Medicare were folded and are live;
   Stress tests is folded and committed but NOT landed: land it first (STATE.md section 00, "Committed, not
   landed"). Apply the rule to every page you touch; STATE.md lists the pages whose counts still want folding.
2. **Retirement: check the numbers behind the answer** (2026-11-11). L1 to L12 are live. Open follow-ups are in
   STATE.md.
3. **Stress test of every touch and input** (2026-11-11). Waves 1 and 2 are live. Left: the skeptic recheck of wave
   1's first fix round, and the permanent touch check (built in `$SP/wtouch`, two stages left; STATE.md section 4).
4. **Believable guesses for what a person does not know** (2026-11-02; I called it "something key"). C1 to C5, C7
   and C10 are live. C6, C8 and C9 are open; check each against the code before building, because later work may
   have covered some of it.

The build log (section 9) was brought up to date at the hand-over; keep it current whenever something lands.

## 8. Other sessions

Other builders work on the same branch. They coordinate only through `docs/WORKBOARD.md` (Messages) and
`docs/TEAM.md` (claims). claude-a is the first builder. On 2026-11-11 I asked the earlier session whether
it could start more sessions with different focuses. It started the seven in `STATE.md`, section 5, in my
account (their ids and what each last did are there). I have not asked for more: do not start new ones.
They all draw on my one weekly allowance, so wake one only for a clear, narrow task in its own lane that
you cannot do yourself after claiming the files; otherwise do the leftover items yourself.

## 9. The build log

I follow progress in a page the earlier session published for me, titled "Planner Build Log", in my
Claude account. Its address is not written here because this file is public: find it with your artifact
tool's list, or ask me for the link. It lists every commit by every builder in plain words, with
pictures, ranked by impact. Its generator and data are in `$SP/buildlog/`; `STATE.md`, section 6, says how
to add entries, what is behind, and which traps to avoid. Keep it current when work lands: read the page
first, then publish to the same address. Each entry is two or three plain sentences about what changed
for the person using the app, with real numbers, and no builder words.

## 10. Usage, and handing over again

- My weekly usage limit is real: it stopped builds mid-run on 2026-11-07 and 2026-11-12. The earlier
  session read it from its own session's rate-limit events at every natural pause (`$SP/ux/sessions.md` has
  the recipe). Those events carry two weekly figures, from 0 to 1; the one that counts is the one the event
  names as the limit in force, and on 2026-11-12 that was the higher one (91% while the other said 45%).
  Act on the higher. With three multi-agent runs going it rose about 22 points an hour. If your tools cannot read it, ask me
  for the figure when it matters.
- The earlier session had an hourly scheduled task named "Usage watch and hand-over refresh" and switched
  it off at the hand-over. If you see it enabled, tell me.
- Keep the hand-over package current, so that the next session can start the same way you did. Update
  `$SP/handover/STATE.md` (and this file) by hand at every milestone, then
  `bash "$SP/handover/make.sh" "<what changed>"` and `bash "$SP/handover/push.sh"`. `make.sh` mirrors the
  layout that `unpack.sh` gave you and refuses to run when that layout is missing; `push.sh` runs the leak
  guard by hand (hooks do not run inside the package worktree), proves that the packaged patches rebuild
  the same code, and pushes. Never force.
- Before you run low, stop starting new work, land or package what is in flight, and write me a new
  version of this prompt.
