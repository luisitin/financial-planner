export const meta = {
  name: 'buildlog-wave2',
  description: 'Bring the build log up to date: plain-words details and an impact score for the 50 new commits of the stress-test fixes (six builder sessions), the page taught about more than two sessions, and a checker that every claim matches the diff',
  phases: [
    { title: 'Write', detail: 'one writer per 10 commits; one agent updates the page for many sessions' },
    { title: 'Check', detail: 'a skeptic checks every summary, number and score against the diff and the reviewer verdicts' },
  ],
}
const SP = '$SP'
const BL = `${SP}/buildlog`
const REPO = '$REPO'
const todo = args.todo
const groups = []
for (let i = 0; i < todo.length; i += 10) groups.push(todo.slice(i, i + 10))

const CTX = `The build log is a private web page the owner (a layperson who reads it on a phone) uses to see what the AI sessions did to their personal financial planner app (repo ${REPO}). Each commit is one entry. An entry's details: summary (one or two sentences, what a person using the app now sees differently, plain words, no code names, no file paths), points (3 to 5 short bullets, concrete: what changed on which page, with a real example of the new words or behavior), numbers (1 to 3 facts that are true and checkable: tests passing from the commit message or the session's report, how many findings it closed, a money check), kind (improvement, fix, new-page, tooling). And an impact score: reach (0-10: how many households and pages it touches), size (0-10: how much it changes what a person can do or understand), trust (0-10: how sure we are it works: independent tester or reviewer confirmation raises it, a reviewer finding a regression lowers it), why (one sentence a layperson understands), score = round(0.3*reach + 0.4*size + 0.3*trust, 1).
Context: on 2026-11-11 the owner asked for a stress test of every touch and input. 26 testers found 278 problems; claude-b sorted them by cause and started builder sessions claude-c (money follow-ups), claude-d (transactions, helpers, settings, reports, career), claude-e (retirement and what-ifs, then Get started), claude-f (Dashboard and the home and check-in pages), claude-g (balance, cash flow, goals, debt, property, household), claude-h (taxes, investments, insurance, estate), and an independent reviewer claude-r, whose verdicts per lane are in ${REPO}/docs/handoffs/review-2026-11-11/<lane>.md. Each session's own reports are under Messages in ${REPO}/docs/WORKBOARD.md. Finding ids like "j-debt-fixer/D1" refer to the stress test; the hand-over with every finding by cause is in ${SP}/wux-handoff/docs/handoffs/wip-ux/themes/*.md. Read the commit with git -C ${REPO} show --stat <id> and git -C ${REPO} show <id> (the message and the diff), and only claim what the diff and the reports support. The repo is public and so is nothing here, but keep it free of real names anyway (the fixture households are invented). Write the way the existing entries in ${BL}/raw/r3b.json are written (read the last five).`

phase('Write')
const ENTRY = { type: 'object', properties: { id: { type: 'string' }, kind: { type: 'string' }, summary: { type: 'string' }, points: { type: 'array', items: { type: 'string' } }, numbers: { type: 'array', items: { type: 'string' } }, reach: { type: 'number' }, size: { type: 'number' }, trust: { type: 'number' }, why: { type: 'string' } }, required: ['id', 'kind', 'summary', 'points', 'reach', 'size', 'trust', 'why'] }
const written = await parallel([
  ...groups.map((g, i) => () => agent(`${CTX}

Write the entries for these ${g.length} commits: ${g.map((c) => `${c.id} (${c.agent}: ${c.title})`).join('; ')}. Return one entry per commit, in the same order.`, { label: `write:${i + 1}`, phase: 'Write', model: 'sonnet', schema: { type: 'object', properties: { entries: { type: 'array', items: ENTRY } }, required: ['entries'] } })),
  () => agent(`${CTX}

Different job: the page itself. ${BL}/index.html was written when only two sessions (claude-a, claude-b) existed: the lede says "the two Claude builder sessions", a "sessions" section has two cards, the session filter has two buttons (#s-a, #s-b), \`who()\` colors only a and b, and the stats count only two. log.json items now also carry the sessions claude-c, claude-d, claude-e, claude-f, claude-g, claude-h and claude-r. Change the page so it works for any number of sessions: the lede and the sessions section say what each one is (claude-a: the lead session; claude-b: this session, which also coordinates the others since 2026-11-11; claude-c: money follow-ups; claude-d..claude-h: the stress-test fixes by area as above; claude-r: the independent reviewer), the filter buttons are built from the sessions present in log.json, every session gets a distinct, accessible color token in light and dark (keep the page's existing palette approach and the two existing colors), and the stats count every session. Keep everything else exactly as it is (layout, impact ordering, search, details). Edit ${BL}/index.html in place and make sure it still parses: run node -e to extract the inline script and check it with new Function. Return what you changed.`, { label: 'page', phase: 'Write', schema: { type: 'object', properties: { changed: { type: 'array', items: { type: 'string' } } }, required: ['changed'] } }),
])
const entries = written.slice(0, groups.length).filter(Boolean).flatMap((w) => w.entries)
log(`${entries.length} of ${todo.length} entries written`)

phase('Check')
const checked = await parallel(groups.map((g, i) => () => agent(`${CTX}

You are a SKEPTIC checking build-log entries written by someone else. For each entry below: read the commit (message and diff), the session's report under Messages in docs/WORKBOARD.md and claude-r's verdicts for that lane. Fix every claim the commit does not support (a page that was not changed, a number not in the message or the reports, a behavior the diff does not do), make the words plain (a layperson on a phone; no file names, no code), and adjust trust: lower it where claude-r found a regression or a not-closed item that this commit claimed, raise it where claude-r confirmed the closures. Keep the same shape. Entries: ${JSON.stringify(entries.filter((e) => g.some((c) => c.id === e.id)))}`, { label: `check:${i + 1}`, phase: 'Check', schema: { type: 'object', properties: { entries: { type: 'array', items: ENTRY }, changed: { type: 'array', items: { type: 'string' } } }, required: ['entries'] } })))
const final = checked.filter(Boolean).flatMap((c) => c.entries)
return { entries: final.length ? final : entries, page: written[groups.length] }