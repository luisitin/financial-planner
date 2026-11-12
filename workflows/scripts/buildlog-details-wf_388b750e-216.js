export const meta = {
  name: 'buildlog-details',
  description: 'Write plain-words details and pick screenshots for each build-log entry, in batches',
  phases: [{ title: 'Details' }, { title: 'Check' }],
}
const ROOT = '$REPO'
const ENTRY = { type: 'object', properties: {
  id: { type: 'string' },
  summary: { type: 'string', description: '2-3 plain sentences: what was built or changed and why it matters to the owner' },
  points: { type: 'array', items: { type: 'string' }, description: '2-5 short concrete bullets in plain words' },
  numbers: { type: 'array', items: { type: 'string' }, description: '0-4 concrete figures seen in the commit, changelog or README' },
  kind: { type: 'string', enum: ['new-page', 'answer-key', 'fix', 'improvement', 'tooling'] },
  shots: { type: 'array', items: { type: 'object', properties: { file: { type: 'string', description: 'absolute path of a PNG under ROOT/shots/ that you opened and checked' }, caption: { type: 'string' } }, required: ['file', 'caption'] } },
}, required: ['id', 'summary', 'points', 'kind', 'shots'] }
const OUT = { type: 'object', properties: { entries: { type: 'array', items: ENTRY } }, required: ['entries'] }
const CHECK = { type: 'object', properties: { entries: { type: 'array', items: ENTRY }, changes: { type: 'array', items: { type: 'string' } } }, required: ['entries', 'changes'] }
const brief = (items) => `You are writing entries for a build log of a public personal-finance app whose repo is at ${ROOT}. Read ${ROOT}/AGENTS.md for orientation; read only what else you need. The reader is the app's owner, a layperson reading on a phone: plain words, no jargon (explain a tax term in passing), no file paths, code names or commit hashes in summary/points/numbers; name pages in plain words ("the Crypto page"). An "answer key" is an independent program written from the law, without reading the app, that works thousands of example households; a test compares the app with it. Write about what the commit did, not about the agent.

For each commit below:
1. Run \`git -C ${ROOT} show --stat <id>\` and \`git -C ${ROOT} show <id> -- CHANGELOG.md\` (the changelog line written with it); read the message; skim the touched page's README.md (modules/<group>/<id>/README.md) only if needed.
2. summary, points, numbers, kind as the schema says. Numbers only if you saw them in the commit, its changelog line or README; never invent or estimate.
3. shots: 1-3 pictures. List ${ROOT}/shots/ and look for screenshots of the page(s) the commit touched: qa-smoke-<group>-<id>-phone.png exists for every working page (taken today with a sample household); feature shots have short prefixes (open several to find them). Open candidates with the Read tool and pick the ones that best show what this commit built or changed; prefer phone shots; caption each in plain words (what the reader sees). If nothing existing shows it and the page is usable, you may take ONE new screenshot: \`cd ${ROOT} && node tools/drive.mjs <group>/<id> --script qa/flows/seed-family.js --shot bl-<id>\` (add a qa/flows/seed-*.js after seed-family if the page needs data: seed-crypto, seed-rental, seed-home, seed-equity, seed-holdings, seed-policies, seed-health ... list qa/flows; never --real); it writes ${ROOT}/shots/qa-bl-<id>-phone.png; open it to check. For an answer key, picture the page it checks. For commits with no page (docs, tools, the server), shots may be empty.
Do not edit any file in the repo (only shots/, which is git-ignored, may receive a new screenshot). Return every commit in the list.

Commits (id, date, title, guessed kind, pages touched):
${items.map((i) => `- ${i.id} | ${i.date} | ${i.title} | ${i.kind} | ${i.pages.join(', ') || 'no page'}`).join('\n')}`
const results = await pipeline(
  args,
  (items, _, k) => agent(brief(items), { label: `details:${k + 1}`, phase: 'Details', schema: OUT }),
  (res, items, k) => agent(`Check a batch of build-log entries written for the owner of the personal-finance app at ${ROOT} (a layperson reading on a phone). For each entry: verify every figure in summary/points/numbers against \`git -C ${ROOT} show <id>\` and its changelog line (\`git -C ${ROOT} show <id> -- CHANGELOG.md\`); remove or correct anything not supported; replace jargon, file paths and code names with plain words; make sure the kind is right; open each listed screenshot with the Read tool and drop any that does not exist or does not show the page the caption claims. Keep entries that are right as they are. Do not edit any repo file. Return all entries (corrected) and a list of the changes you made.\n\nEntries: ${JSON.stringify(res?.entries ?? [])}\n\nThe commits they must cover: ${items.map((i) => i.id).join(', ')}`, { label: `check:${k + 1}`, phase: 'Check', schema: CHECK }),
)
return results.filter(Boolean).map((r) => ({ entries: r.entries, changes: r.changes }))
