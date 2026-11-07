// modules/overview/guide/view.js -- DOM only. #/overview/guide: the list of guides. #/overview/guide/<id>: one guide,
// its steps (the whole row is the link; the next step also gets the page's only filled button, as the dashboard's
// setup steps do), and when every numbered step is done, a finish card.
import { compute, journeyById, startGuide, leaveGuide, finishGuide, PATH_ID } from "./compute.js";
import { offKeys, usable, change } from "./act.js";

let pending = null;   // { id, text }: a green line shown once on the next render of that guide

const STYLE = `
.gd-root .gd-kicker { font-size: var(--fs-sm); color: var(--text-2); font-weight: 600; margin-bottom: 4px; }
.gd-root .gd-lede { color: var(--text-2); margin: 6px 0 4px; }
.gd-root .gd-meta { color: var(--text-2); margin: 6px 0 0; }
.gd-root .gd-count { margin-top: 14px; color: var(--text-2); font-variant-numeric: tabular-nums; }
.gd-root .gd-count b { color: var(--text); }
.gd-root .progress { margin: 6px 0 0; }
.gd-root .steps li { align-items: center; padding: 8px 0; }
.gd-root .steps .lbl .hint { display: inline-block; width: 100%; font-size: var(--fs-sm); color: var(--text-2); font-weight: 400; text-decoration: none; }
.gd-root .steps li.skip .lbl, .gd-root .steps li.later .lbl { color: var(--text-2); }
.gd-root .steps li.skip .num { border-style: dashed; }
.gd-root .steps li.extra .num { font-size: 16px; }
.gd-root .steps .st { flex: none; font-size: var(--fs-sm); color: var(--text-2); white-space: nowrap; padding-left: 6px; }
.gd-root h3.gd-extra { font-size: var(--fs); font-weight: 650; margin: 16px 0 2px; }
.gd-root .gd-extra-sub { color: var(--text-2); font-size: var(--fs-sm); margin: 0 0 4px; }
.gd-root .steps-cta { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.gd-root .gd-textbtn { background: none; border: 0; color: var(--accent-ink); padding: 0 2px; min-height: 44px; font-weight: 600; }
.gd-root .gd-done { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--ok-soft); color: var(--ok); border: 1px solid var(--ok); font-weight: 700; margin-bottom: 8px; }
.gd-root .gd-finish p { margin: 4px 0 0; }
.gd-root .gd-finish .gd-extras { color: var(--text-2); font-size: var(--fs-sm); }
.gd-root .gd-finish .steps-cta { margin-top: 14px; }
.gd-root .page-list .row-link { align-items: center; min-height: 60px; padding: 8px 4px; }
.gd-root .page-list .row-link .t { color: var(--text); }
.gd-root .page-list .d { color: var(--text-2); }
.gd-root .page-list .gd-st { color: var(--text-2); font-size: var(--fs-sm); margin-top: 2px; }
.gd-root .page-list .ic { width: 40px; height: 40px; font-size: 20px; border: 1px solid var(--line); }
.gd-root .gd-chev { flex: none; color: var(--muted); font-size: 22px; line-height: 1; padding-left: 4px; }
.gd-root .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
`;

export function render(root, ctx) {
  const wrap = ctx.ui.h("div", { class: "gd-root" }, ctx.ui.h("style", {}, STYLE));
  root.append(wrap);
  const id = ctx.route.rest?.[0];
  if (id) return renderOne(wrap, ctx, id);
  return renderList(wrap, ctx);
}

export const statusLine = (s) => s.finished ? "Done" : s.started ? `In progress: ${s.doneCount} of ${s.total} steps done` : `About ${s.minutes} minutes${s.doneCount ? `. ${s.doneCount} of ${s.total} ${s.total === 1 ? "step" : "steps"} ${s.doneCount === 1 ? "is" : "are"} already in your plan.` : ""}`;

function rowLink(ui, href, icon, title, line, status, onClick) {
  return ui.h("li", {}, ui.h("a", { href, class: "row-link", onClick },
    ui.h("span", { class: "ic", "aria-hidden": "true" }, icon),
    ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, title), line ? ui.h("div", { class: "d" }, line) : null, status ? ui.h("div", { class: "gd-st" }, status) : null),
    ui.h("span", { class: "gd-chev", "aria-hidden": "true" }, "›")));
}

function renderList(wrap, ctx) {
  const { ui, route } = ctx;
  const d = compute(ctx.plan, { off: offKeys(ctx), today: ctx.fmt.today() });
  let list = d.journeys;
  const more = route.query?.more === "1";
  const lifeRow = { guideHref: "#/household/life-events", icon: "👪", title: "Something big is happening", line: "Marriage, a baby, a new job, a move, an inheritance or a divorce, step by step.", status: null };
  const lifeFirst = more && usable(ctx, "household/life-events");
  // from Get started's "More guides: taxes, protecting your family, a baby or a move": those three first
  if (more) list = [...list.filter((j) => ["taxes", "protect"].includes(j.id)), ...(lifeFirst ? [lifeRow] : []), ...list.filter((j) => !["taxes", "protect"].includes(j.id))];
  wrap.append(ui.h("section", { class: "card" },
    ui.h("h1", {}, "Step-by-step guides"),
    ui.h("p", { class: "gd-lede" }, "Each guide takes you through a few pages in order, one at a time. Stop any time; it remembers where you were."),
    ui.h("ul", { class: "page-list" }, list.map((s) => rowLink(ui, s.guideHref, s.icon, s.title, s.line, s === lifeRow ? null : statusLine(s))))));
  const others = [
    usable(ctx, "household/life-events") && !lifeFirst ? ["#/household/life-events", "👪", "Something big is happening", "Marriage, a baby, a new job, a move, an inheritance or a divorce, step by step."] : null,
    usable(ctx, "overview/monthly-review") && (ctx.plan.accounts ?? []).length ? ["#/overview/monthly-review", "🗓️", "Check in on the month", "Ten minutes to bring the numbers up to date."] : null,
    usable(ctx, "overview/quick") ? ["#/overview/quick", "⚡", "Get a quick answer", "Work out one thing, like paying cash for a car or borrowing, or which health plan costs least. Nothing to set up."] : null,
  ].filter(Boolean);
  if (others.length) wrap.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Other places to start"), ui.h("ul", { class: "page-list" }, others.map((o) => rowLink(ui, ...o)))));
}

function renderOne(wrap, ctx, id) {
  const { ui, fmt, modules } = ctx;
  const today = fmt.today();
  if (!journeyById(id)) {
    wrap.append(ui.notice("error", `There is no guide called “${id}”.`), ui.h("a", { href: "#/overview/guide", class: "btn secondary" }, "See all guides"));
    return;
  }
  const d = compute(ctx.plan, { id, off: offKeys(ctx), today });
  const s = d.detail;
  const active = ctx.plan.guide?.active === id;
  const follow = () => change(ctx, (q) => startGuide(q, id, today));
  if (pending?.id === id) { const n = ui.notice("ok", pending.text); n.setAttribute("role", "status"); wrap.append(n); }
  pending = null;

  // header
  const pct = s.total ? Math.round(100 * s.doneCount / s.total) : 0;
  wrap.append(ui.h("section", { class: "card" },
    ui.h("div", { class: "gd-kicker" }, id === PATH_ID ? "Your plan" : "Step-by-step guide"),
    ui.h("h1", {}, s.title),
    ui.h("p", { class: "gd-lede" }, s.line),
    ui.h("p", { class: "gd-meta" }, `About ${s.minutes} minutes. Stop any time; what you have saved stays in your plan.`),
    s.haveReady ? ui.h("p", { class: "gd-meta" }, `Have ready: ${s.haveReady[0].toLowerCase()}${s.haveReady.slice(1)}`) : null,
    ui.h("div", { class: "gd-count" }, ui.h("b", {}, `${s.doneCount} of ${s.total}`), " steps done",
      !s.started && s.doneCount ? ui.h("span", {}, ` from what is already in your plan`) : null),
    ui.h("div", { class: "progress", "aria-hidden": "true" }, ui.h("span", { style: { width: `${Math.max(pct ? 2 : 0, pct)}%` } }))));

  // the steps
  const STATE_WORDS = { done: "Done.", none: "Does not apply.", later: "Skipped for now.", todo: "" };
  const stepRow = (st) => {
    const isNext = s.next?.key === st.key;
    const cls = [st.state === "done" ? "done" : st.state === "none" ? "skip" : st.state === "later" ? "later" : "", isNext ? "next" : "", st.optional ? "extra" : ""].filter(Boolean).join(" ");
    const num = st.state === "done" ? "✓" : st.state === "none" ? "–" : st.optional ? "+" : String(st.index);
    const status = st.state === "none" ? "Does not apply" : st.state === "later" ? "Skipped for now" : st.blockedBy && st.state === "todo" ? (st.blockedBy.index ? `Needs step ${st.blockedBy.index}` : "Needs an earlier step") : null;
    const hint = st.optional && st.why ? st.why : null;
    return ui.h("li", { class: cls },
      ui.h("a", { href: st.href, class: "step-link", "aria-current": isNext ? "step" : null, onClick: () => follow() },
        ui.h("span", { class: "num", "aria-hidden": "true" }, num),
        ui.h("span", { class: "lbl" }, st.title, ui.h("span", { class: "vh" }, ` ${isNext ? "Next step." : status ? "" : STATE_WORDS[st.state]}`), hint ? ui.h("span", { class: "hint" }, hint) : null),
        status ? ui.h("span", { class: "st" }, status) : null,
        ui.h("span", { class: "chev", "aria-hidden": "true" }, "›")));
  };
  const numbered = s.steps.filter((x) => !x.optional), extras = s.steps.filter((x) => x.optional);
  const stepsBody = () => [
    ui.h("ol", { class: "steps" }, numbered.map(stepRow)),
    extras.length ? [ui.h("h3", { class: "gd-extra" }, "Extra steps for you"), ui.h("p", { class: "gd-extra-sub" }, "Not needed to finish; worth a look when they apply."), ui.h("ul", { class: "steps" }, extras.map(stepRow))] : null,
  ];
  const stopBtn = active && id !== PATH_ID ? ui.h("button", { type: "button", class: "gd-textbtn", onClick: () => { pending = { id, text: "You stopped following this guide. Your steps are kept; start it again from here or from Get started." }; change(ctx, (q) => leaveGuide(q)); } }, "Stop following this guide") : null;

  if (s.complete) {
    const extrasLine = s.extrasLeft ? `${s.extrasLeft} extra step${s.extrasLeft === 1 ? " is" : "s are"} left if you want ${s.extrasLeft === 1 ? "it" : "them"}.` : null;
    const fin = s.finish;
    wrap.append(ui.h("section", { class: "card gd-finish", "aria-labelledby": "gd-fin-h" },
      ui.h("div", { class: "gd-done", "aria-hidden": "true" }, "✓"),
      ui.h("h2", { id: "gd-fin-h" }, id === PATH_ID ? "Every step is done" : "Guide finished"),
      ui.h("p", {}, fin.text),
      extrasLine ? ui.h("p", { class: "gd-extras" }, extrasLine) : null,
      ui.h("div", { class: "steps-cta" },
        usable(ctx, fin.page) ? ui.h("a", { href: `#/${fin.page}`, class: "btn", onClick: () => change(ctx, (q) => finishGuide(q, id, today)) }, fin.label) : null,
        ui.h("a", { href: id === PATH_ID ? "#/overview/start" : "#/overview/guide", class: "btn secondary", onClick: () => change(ctx, (q) => finishGuide(q, id, today)) }, id === PATH_ID ? "Do something else" : "Pick another guide"),
        ui.h("button", { type: "button", class: "gd-textbtn", onClick: () => { const f = wrap.querySelector("details.gd-all"); if (f) { f.open = true; f.scrollIntoView({ block: "start" }); } } }, "Show all the steps"))));
    wrap.append(ui.h("details", { class: "card fold fold-card gd-all" },
      ui.h("summary", {}, ui.h("h2", {}, s.extrasLeft ? "Main steps done ✓" : `All ${s.total + s.extrasTotal} steps done ✓`), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("div", { class: "fold-body" }, stepsBody())));
  } else {
    const nx = s.next;
    wrap.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Steps"), stepsBody(),
      ui.h("div", { class: "steps-cta" },
        nx ? ui.h("a", { href: nx.href, class: "btn", onClick: () => follow() }, `Do step ${nx.index}: ${nx.short}`) : null,
        usable(ctx, "overview/start") ? ui.h("a", { href: "#/overview/start", class: "btn secondary" }, "Do something else") : null,
        stopBtn)));
  }

  // more on this
  const more = s.more.filter((m) => usable(ctx, m.page));
  if (more.length) wrap.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, s.moreTitle), ui.h("span", { class: "fold-status" }, `${more.length} pages`), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("ul", { class: "page-list" }, more.map((m) => rowLink(ui, `#/${m.page}`, modules.get(m.page)?.icon ?? "📄", m.title, null, null))))));
}
