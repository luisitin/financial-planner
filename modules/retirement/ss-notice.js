// modules/retirement/ss-notice.js -- DOM only, shared by the retirement pages (projection, monte-carlo, historical,
// withdrawal-strategy). With no Social Security in the plan every one of them looks far worse than it is ("26%: weak",
// "Runs out in 2061") and only a grey sentence said why. This notice says so first, with the two answers: add it, or say
// you will not get it (saved as the setup's own "none", so the Dashboard and these pages agree and it never asks again).
import { ssMissingFor, lastsWithoutSs } from "../overview/setup/compute.js";

let pending = null;   // the confirmation, shown on the next render (the shell re-renders after store.update)

/** Does the notice show its filled "Add Social Security"? (A page passes it on as `quiet` to its own buttons: one filled button.) */
export const ssAsks = (plan) => ssMissingFor(plan).length > 0;

/**
 * ssNotice(ctx, { proj }) -> the notice card, or null. `proj`: the page's own Will the money last? answer, handed in by that page
 * only. When that answer stands without the figure (overview/setup lastsWithoutSs, the one rule every overview page asks), the
 * page does not look worse than it is: the notice says the money lasts even so, in the calm (info) look, with the same two
 * answers (z1 fix round, critic P3: "looks worse than it is" sat right above "The money lasts"). The other pages keep their words:
 * their chances and years still look worse without it.
 */
export function ssNotice(ctx, { proj = null } = {}) {
  const { ui, store, plan } = ctx;
  if (pending) { const msg = pending; pending = null; const n = ui.notice("ok", msg); setTimeout(() => n.remove(), 5000); return n; }
  const missing = ssMissingFor(plan);
  if (!missing.length) return null;
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const self = adults.find((p) => p.role === "self");
  // one missing figure in a household of two: name whose it is, so "I won't" never marks the other person
  const one = missing.length === 1 && adults.length > 1 ? missing[0] : null;
  const isMe = one && self && one.id === self.id;
  const who = one ? `${one.name}'s Social Security is` : "Social Security is";
  const label = !one ? (missing.length === 1 ? "I won't get Social Security" : "We won't get Social Security") : isMe ? "I won't get Social Security" : `${one.name} won't get Social Security`;
  const names = missing.map((m) => m.name).filter(Boolean).join(" and ");
  let stands = null;
  if (proj) { try { stands = lastsWithoutSs(plan, { today: ctx.fmt?.today?.() ?? null, proj }); } catch { stands = null; } }
  const ask = `Add an estimate (ssa.gov shows ${one && !isMe ? "theirs" : "yours"}), or say ${one && !isMe ? `${one.name} will` : "you will"} not get it.`;
  return ui.card(null,
    stands ? ui.notice("info", `${who} not counted yet. The money lasts even without it. ${ask}`) : ui.notice("warn", `${who} not counted yet, so this page looks worse than it is. ${ask}`),
    ui.row(ui.h("a", { class: "btn", href: "#/retirement/social-security" }, "Add Social Security"),
      ui.button(label, () => {
        pending = `Saved: no Social Security for ${names || "you"}. Change it on the Social Security page.`;
        store.update((p) => { p.guide = p.guide ?? {}; p.guide.setup = p.guide.setup ?? {}; p.guide.setup.ss = p.guide.setup.ss ?? {}; for (const m of missing) p.guide.setup.ss[m.id] = "none"; });
      }, { class: "secondary" })));
}
