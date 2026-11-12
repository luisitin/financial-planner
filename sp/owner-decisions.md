- 2026-11-06 ~11:05 UTC, owner, verbatim: "You can do as you please. Just make sure a layman can easily understand and use the page"
  Asked about: changing the frozen key tests/golden/retirement/withdrawal-strategy.csv (R8 item 4: withdrawal = rate x savings, spending = income + withdrawal - tax).
  Taken as: yes to the engine change + regenerated key (core/math/retirement.js, tools/golden_retirement/withdrawal_strategy.py, the CSV, README), on condition the page is easy for a layman. Do it as batch 5b after batch 5 lands; record in WORKBOARD.

## 2026-11-07: the live site
The owner said "When I open the GitHub page not much seems changed": GitHub Pages (luisitin.github.io/financial-planner)
serves `main`, last moved 2026-10-26; all work was on claude/creative-build-b531q0 (333 commits ahead). Asked; the owner
chose "Update main, keep it in step": after every push to the branch, fast-forward main to it (never force). Script:
$SP/push.sh.

2026-11-07 01:10 UTC: main held (main-hold file) after the owner hit mixed old/new files on the phone; resume when the static-site fix (workflow wjjfkow7s, $SP/skew) is pushed and live-checked.

2026-11-07 06:34 UTC: main-hold removed; static-site fix 885aefe live and checked (kept profile clean 06:32); main moved to the merged branch.
