# Prompts: work for other AI tools

Copy-paste prompts that ask another model (ChatGPT, Gemini, Muse, a second Claude account,
Codex, Grok...) to improve this repo. Each one points at the public repo, names the files to
read (as raw links any model can fetch) and asks for output that can be applied as it comes:
unified diffs, or whole files whose first line is their path, plus a short rationale.

| folder | what | count |
|---|---|---|
| `quick/` | one focused improvement each; any chat model, one answer | 14 |
| `math/` | heavy math, light reasoning: test vectors for every usable page's formulas (`vectors-*`), loan schedules, tax tables for every state, limits, Monte Carlo checks | 75 |
| `reasoning/` | deep reasoning, light math: architecture, data model, flows, method, security | 11 |
| `swarm/` | heavy math and deep reasoning for an orchestrator with worker models; the split plan is inside | 6 |
| `research/` | current figures and law with primary sources, turned into the repo's tables | 11 |
| `build/` | promote one planned page from `docs/MODULE_CATALOG.md` | 88 |
| `audit/` | accessibility, licences, privacy, test gaps, performance, dependencies | 6 |
| `design/` | plain words, empty states, help text, charts, Spanish | 7 |

`index.json` has every prompt with its id, title, category, size (S/M/L/XL), suggested
destinations, output format and full text; the owner's prompt tracker reads it.

## Editing
Hand-written prompts live in `src/<category>.md` (blocks separated by `---`; the header lines
`id`, `title`, `size`, `to`, `output`, `read`, `summary`, then the text). The `build-*` and
`vectors-*` prompts are generated from the catalog and the usable pages. After any change:

```
node tools/gen-prompts.mjs
```

It rebuilds every `<category>/<id>.md` and `index.json`, adds the shared intro, the raw links
and the "How to answer" rules, and refuses a prompt that names a file the repo does not have.

## Answers
Responses come back through the tracker into `ai-responses/<prompt-id>/` on the owner's PC
(git-ignored). Good changes are applied on a branch, tested (`npm test`, `npm run check`),
passed through the leak guard and pushed.
