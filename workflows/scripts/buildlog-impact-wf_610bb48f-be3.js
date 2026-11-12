export const meta = {
  name: 'buildlog-impact',
  description: 'Score every build-log entry for its impact on the app owner, calibrate across batches, and have a skeptic check the ranking',
  phases: [{ title: 'Score' }, { title: 'Calibrate' }, { title: 'Challenge' }],
}
const ROOT = '$REPO'
const FILE = '$SP/buildlog/entries-for-impact.json'
const RUBRIC = `IMPACT = how much a change matters to the app's owner: a layperson who uses this personal-finance planner (on a phone) to run their household's money and taxes. Score 0-100 as the sum of three parts:
- REACH (0-35): how many households and how often. Pages nearly everyone uses (the federal tax estimate and the engine under many pages, paychecks, budget, net worth, retirement projections, Social Security, debts, emergency fund, goals) score high; common but not universal (mortgage/home, college saving, insurance needs, HSA/FSA, contribution limits, estimated taxes) middle; niche (crypto, rental property, employer stock, estate tax, a small business, AI helpers, reports) lower; internal tooling, tests and repo housekeeping 0-5.
- SIZE (0-40): how much it changes what the person sees or decides. Highest: a capability that did not exist (a new working page), or money figures that were WRONG and are now right by large amounts or in many cases (look for dollar amounts and counts in the entry). Middle: a meaningful new figure, a clearer answer, a fix to a less common case. Low: wording, layout, small edge cases, a follow-up polish. Near zero: code hygiene, tool fixes.
- TRUST (0-25): whether it makes the money figures demonstrably right or removes a misleading figure: an answer key (an independent program written from the law that checks thousands of example households) that found and fixed errors scores high, a figure checked against an official source, a fix to something that told people the wrong amount. A baseline answer key commit (the key and its to-do list, before the fixes) gets trust but little size; the commit that fixed what the key found carries the size.
Tiers by the total: 80-100 "biggest", 60-79 "big", 40-59 "medium", 20-39 "small", 0-19 "behind".
Calibration anchors (use them to keep scores consistent): the 12,000-return federal tax answer key and its fixes to the engine under every tax figure ~ 90; a new Paycheck page (every earner's take-home with the IRS tables) ~ 80; married filing separately becoming two returns in the federal engine ~ 72; a new niche page such as Crypto or Rental analysis ~ 55; review fixes to a niche page ~ 35-45; a full-size button instead of a small link on one page ~ 15; a tool finding the browser on Linux ~ 5; rewording a code comment to pass a check ~ 2.
The WHY line is for the owner: one plain sentence (at most 25 words, no jargon, no file or code names) saying what it changed for them, leading with the most concrete effect (a dollar figure or count when the entry has one).`
const ENTRY = { type: 'object', properties: {
  id: { type: 'string' }, reach: { type: 'number' }, size: { type: 'number' }, trust: { type: 'number' }, score: { type: 'number' },
  tier: { type: 'string', enum: ['biggest', 'big', 'medium', 'small', 'behind'] }, why: { type: 'string' },
}, required: ['id', 'reach', 'size', 'trust', 'score', 'tier', 'why'] }
const LIST = { type: 'object', properties: { entries: { type: 'array', items: ENTRY } }, required: ['entries'] }
const CAL = { type: 'object', properties: { entries: { type: 'array', items: ENTRY }, notes: { type: 'array', items: { type: 'string' } } }, required: ['entries', 'notes'] }
const ADJ = { type: 'object', properties: { adjustments: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, score: { type: 'number' }, why: { type: 'string' }, reason: { type: 'string' } }, required: ['id', 'score', 'reason'] } } }, required: ['adjustments'] }

phase('Score')
const scored = await parallel(args.map((ids, k) => () => agent(`Rate the impact of ${ids.length} entries of a build log for a personal-finance web app (repo at ${ROOT}; read ${ROOT}/AGENTS.md only if you need orientation).
${RUBRIC}
The entries are in ${FILE} (a JSON array; each has id, date, session, kind, title, summary, points, numbers, pages, files). Rate exactly these ids: ${ids.join(', ')}. Read each entry's summary, points and numbers; if an entry is unclear, run \`git -C ${ROOT} show --stat <id>\` or read its changelog line (\`git -C ${ROOT} show <id> -- CHANGELOG.md\`). Do not edit any file. Score each part honestly against the rubric and anchors, with score = reach + size + trust and the tier from the score. Return every id.`, { label: `score:${k + 1}`, phase: 'Score', schema: LIST })))
const all = scored.filter(Boolean).flatMap((r) => r.entries)
log(`${all.length} entries scored`)

phase('Calibrate')
const compact = all.map((e) => `${e.id} | ${e.score} (${e.reach}/${e.size}/${e.trust}) | ${e.tier} | ${e.why}`).join('\n')
const cal = await agent(`Seven raters each scored a share of a build log's ${all.length} entries for impact on the app's owner. Different raters drift: make the whole list consistent on one scale.
${RUBRIC}
The entries themselves are in ${FILE} (id, title, kind, summary, points, numbers, pages). Here are the raw scores (id | score (reach/size/trust) | tier | why):
${compact}
Read the entries (all of them, quickly: titles and summaries) and compare like with like across raters: new pages against new pages (by how central the page is), fixes against fixes (by how wrong the figures were and for how many), answer keys against answer keys, polish against polish. Move scores so equal impact gets equal scores and the anchors hold; keep the three parts and the tier consistent with the total; sharpen any WHY that is vague, jargon-laden or not the most concrete effect (keep it true to the entry: never invent a figure). Return ALL ${all.length} entries with final values, and notes listing the main moves you made and why.`, { label: 'calibrate', phase: 'Calibrate', schema: CAL })
const final = new Map((cal?.entries ?? all).map((e) => [e.id, e]))
for (const e of all) if (!final.has(e.id)) final.set(e.id, e)

phase('Challenge')
const ranked = [...final.values()].sort((a, b) => b.score - a.score)
const view = ranked.map((e, i) => `${i + 1}. ${e.id} | ${e.score} | ${e.tier} | ${e.why}`).join('\n')
const adj = await agent(`You are a skeptic checking a ranking of a personal-finance app's build log by impact on its owner (a layperson running their household's money). Try to find entries that are ranked too high or too low.
${RUBRIC}
The entries are in ${FILE} (read the summary, points and numbers of every entry you challenge; use \`git -C ${ROOT} show --stat <id>\` when in doubt). The ranking (rank. id | score | tier | why):
${view}
Check especially: the top 30 (does each truly change more for the owner than the ones below it? is any a baseline, a follow-up or a narrow fix inflated by big numbers?), new pages ranked below polish, fixes of wrong money figures ranked as small, and WHY lines that are untrue to the entry or vague. Propose only adjustments you can justify from the entry: { id, score (the new total), why (only if it should change), reason }. Do not edit any file.`, { label: 'challenge', phase: 'Challenge', schema: ADJ })
const tierOf = (s) => (s >= 80 ? 'biggest' : s >= 60 ? 'big' : s >= 40 ? 'medium' : s >= 20 ? 'small' : 'behind')
for (const a of adj?.adjustments ?? []) {
  const e = final.get(a.id); if (!e) continue
  final.set(a.id, { ...e, score: a.score, tier: tierOf(a.score), why: a.why || e.why, adjusted: a.reason })
}
return { entries: [...final.values()].map((e) => ({ ...e, tier: tierOf(e.score) })), notes: cal?.notes ?? [], adjustments: adj?.adjustments ?? [] }