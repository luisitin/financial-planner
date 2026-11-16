// modules/investments/crypto/staking.js -- PURE, and imports nothing (the Federal estimate's known.js reads it, and Crypto's
// compute reads known.js: no cycle). "Rewards from staking" (gap list, next 60, item 45): coins that staking pays are
// income in the year received, at what they were worth that day (Rev. Rul. 2023-14; Form 1040 instructions, Schedule 1
// line 8v), and that worth is what the new coins cost (digital asset FAQs 59 and 107). A reward recorded here:
//   - is kept in `investments.staking` ({ id, holdingId, accountId, symbol, units, day, value }), which the Federal estimate
//     reads through stakingIn() for its year (known.js stakingStep);
//   - joins the coin's purchases as a lot with that worth as its cost ({ id: the reward's id, date: day, shares: units,
//     cost: value }): the coin's coins and its cost on file go up by as much.
//   - moves the crypto account's balance by what its coins on file moved, at their prices (walletFollows): a part of the
//     balance that is not listed coins (Crypto's "the rest of the balance") stays as it was; a balance left blank stays blank.

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fix = (n) => Number((Number(n) || 0).toFixed(10));   // coins without float dust
const dollars = (n) => `$${Math.round(Math.abs(Number(n) || 0)).toLocaleString("en-US")}`;
/** A day that is on the calendar (2026-02-31 is not). */
const realDay = (iso) => { const t = ISO.test(String(iso ?? "")) ? new Date(`${iso}T00:00:00Z`) : null; return !!t && !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === iso; };
/** A cost typed (0 included), as against one left blank. */
const onFile = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
/** Coins as an exchange shows them: up to eight decimals, commas, trailing zeros dropped (as sales.js unitsText). */
const unitsText = (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(Number(n) || 0);
/** A day as the page says it: "Oct 31, 2026". */
export const dayText = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The smallest reward kept: one satoshi (as a sale, sales.js MIN_UNITS). */
export const MIN_UNITS = 1e-8;
/** How many of a year's rewards the row draws before it says how many more there are. */
export const SHOWN = 12;

/** Every reward on file that can be read (an object with an id, a day on the calendar, coins and a worth of 0 or more). */
export function rewardsOf(plan) {
  const list = plan?.investments?.staking;
  if (!Array.isArray(list)) return [];
  return list.filter((r) => r && typeof r === "object" && typeof r.id === "string" && r.id && realDay(r.day) && Number(r.units) > 0 && Number.isFinite(Number(r.value)) && Number(r.value) >= 0)
    .map((r) => ({ id: r.id, holdingId: r.holdingId ?? null, accountId: r.accountId ?? null, symbol: typeof r.symbol === "string" && r.symbol.trim() ? r.symbol : "coin", units: Number(r.units), day: r.day, value: cents(r.value) }));
}

/**
 * stakingIn(plan, year) -> { year, rewards (that year's, oldest first), count, total (their worth: the year's income),
 *   byAccount ([[accountId, total]] in the order first met: the Federal estimate puts each on its owner's return),
 *   others (rewards on file in other years), any (rewards on file at all) }
 */
export function stakingIn(plan, year) {
  const all = rewardsOf(plan);
  const y = Number(year);
  const rewards = all.filter((r) => Number(r.day.slice(0, 4)) === y).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const by = new Map();
  for (const r of rewards) by.set(r.accountId, cents((by.get(r.accountId) ?? 0) + r.value));
  return { year: y, rewards, count: rewards.length, total: cents(rewards.reduce((s, r) => s + r.value, 0)), byAccount: [...by.entries()], others: all.length - rewards.length, any: all.length };
}

/** The coins a reward can be recorded for: a coin in a crypto account (holdings), by id. */
const coinOf = (plan, id) => {
  const h = (plan?.holdings ?? []).find((x) => x && x.id === id) ?? null;
  const a = h ? (plan.accounts ?? []).find((x) => x && x.id === h.accountId && x.type === "crypto") : null;
  return h && a ? { h, a } : null;
};

/**
 * planReward(plan, { holdingId, units, day, value }, { today }) -> the reward worked out, nothing written:
 *   { ok: true, reward: { holdingId, accountId, symbol, units, day, value } } or { ok: false, field, error } (one sentence each).
 * Any day up to today counts (a reward from last year is that year's income, and its coins still cost what they were worth).
 */
export function planReward(plan, input = {}, params = {}) {
  const today = params.today ?? null;
  const c = coinOf(plan, input.holdingId);
  if (!c) return { ok: false, field: "coin", error: "Choose the coin you received." };
  const units = input.units === null || input.units === undefined || input.units === "" ? NaN : Number(input.units);
  if (!(units > 0)) return { ok: false, field: "units", error: "Type how many coins you received." };
  if (units < MIN_UNITS) return { ok: false, field: "units", error: "Type at least 0.00000001 of a coin, the smallest amount this list keeps." };
  const day = String(input.day ?? "");
  if (!ISO.test(day)) return { ok: false, field: "day", error: "Type the day you received them." };
  if (!realDay(day)) return { ok: false, field: "day", error: "That day is not on the calendar: check the day and the month." };
  if (today && day > today) return { ok: false, field: "day", error: "A reward cannot be dated in the future." };
  const value = input.value === null || input.value === undefined || input.value === "" ? NaN : Number(input.value);
  if (!(value >= 0) || !Number.isFinite(value)) return { ok: false, field: "value", error: "Type what they were worth that day, in dollars." };
  // $0 is a box left at nothing, not a worth: coins at no cost and no income would be recorded
  if (!(cents(value) > 0)) return { ok: false, field: "value", error: "Type what they were worth that day, more than $0." };
  const symbol = String(c.h.symbol ?? "").trim().toUpperCase() || "coin";
  return { ok: true, reward: { holdingId: c.h.id, accountId: c.a.id, symbol, units: fix(units), day, value: cents(value) } };
}

/** A balance left blank (none typed: null, missing, or only spaces), as against one typed, $0 included. A blank balance is not
 *  $0: Net worth counts nothing for it, and a reward recorded or removed leaves it blank (recheck leftover y2 (d), 2026-11-16). */
export const blankBalance = (v) => v === null || v === undefined || (typeof v === "string" && !v.trim());
/** What an account's coins on file are worth: coins x price, each coin. */
const coinsWorth = (draft, accountId) => (draft.holdings ?? []).filter((h) => h && h.accountId === accountId).reduce((s, h) => s + (Number(h.shares) || 0) * (Number(h.price) || 0), 0);
/**
 * walletFollows(draft, accountId, change, today): runs change() (a reward put on or taken off) and, when it did something,
 * moves the crypto account's balance by what its coins on file moved, at their prices on file: new balance = the coins' worth
 * now + the part of the balance that was not listed coins before (Crypto's "the rest of the balance": money the person typed
 * on the account, kept as it was). A balance within a cent of its coins is just its coins: it becomes their worth, as of
 * today (as sales.js syncWallets makes it); a balance with more (or less) in it keeps its own day. A balance left blank
 * (blankBalance) is left as it is, day and all: there is no typed figure to follow.
 */
function walletFollows(draft, accountId, change, today) {
  const a = (draft.accounts ?? []).find((x) => x && x.id === accountId && x.type === "crypto");
  const before = coinsWorth(draft, accountId);
  const done = change();
  // a balance left blank stays blank, and its day as it was (it read $32 after a record and $0 after the removal: y2 (d))
  if (!a || !(done === true || done?.ok) || blankBalance(a.balance)) return done;
  const bal = Number(a.balance);
  const rest = !Number.isFinite(bal) || Math.abs(bal - before) < 0.01 ? 0 : cents(bal - before);
  a.balance = cents(cents(coinsWorth(draft, accountId)) + rest);
  if (today && !rest) a.asOf = today;
  return done;
}

/**
 * applyReward(draft, reward, id, today): writes a reward planReward worked out: the coin gains a purchase { id, date: day,
 * shares: units, cost: value } (put in date order), its coins go up by `units` and its cost on file by `value` (a cost left
 * blank stays blank); the reward goes on `investments.staking` with this id; the wallet's balance goes up by units x the coin's
 * price on file (walletFollows). Returns false when the coin is gone.
 */
export function applyReward(draft, reward, id, today = null) {
  return walletFollows(draft, reward?.accountId, () => putReward(draft, reward, id), today);
}
function putReward(draft, reward, id) {
  const h = (draft.holdings ?? []).find((x) => x && x.id === reward?.holdingId);
  if (!h || !id) return false;
  const lot = { id, date: reward.day, shares: reward.units, cost: reward.value };
  h.lots = Array.isArray(h.lots) ? h.lots : [];
  const at = h.lots.findIndex((l) => l?.date && l.date > reward.day);
  if (at < 0) h.lots.push(lot); else h.lots.splice(at, 0, lot);
  h.shares = fix((Number(h.shares) || 0) + reward.units);
  if (onFile(h.costBasis)) h.costBasis = cents(Number(h.costBasis) + reward.value);
  draft.investments = draft.investments ?? {};
  draft.investments.staking = [...(Array.isArray(draft.investments.staking) ? draft.investments.staking : []), { id, ...reward }];
  return true;
}

/** Why a reward cannot come off by itself: some of its coins were sold since (the sale took part of its purchase). */
export const SOLD_SINCE = "Some of these coins have been sold since, so the reward cannot come off on its own: remove that sale first, under Sales for your tax return, then this reward.";

/**
 * removeReward(draft, id, today) -> { ok: true, reward } | { ok: false, error }: takes a reward back (Remove, and Undo through
 * the page's undoable): its purchase leaves the coin with its coins and its cost, and it leaves `investments.staking` (the list
 * goes when it is empty); the wallet's balance comes down by its coins at the coin's price on file (walletFollows). Refused
 * when the purchase is not whole any more (some of it was sold: SOLD_SINCE).
 */
export function removeReward(draft, id, today = null) {
  const r = (Array.isArray(draft?.investments?.staking) ? draft.investments.staking : []).find((x) => x && x.id === id);
  return walletFollows(draft, r?.accountId, () => takeReward(draft, id), today);
}
function takeReward(draft, id) {
  const list = Array.isArray(draft?.investments?.staking) ? draft.investments.staking : [];
  const r = list.find((x) => x && x.id === id);
  if (!r) return { ok: false, error: "That reward is no longer on file." };
  const h = (draft.holdings ?? []).find((x) => x && x.id === r.holdingId);
  const lot = (h?.lots ?? []).find((l) => l && l.id === id);
  if (!h || !lot || Number(lot.shares) < Number(r.units) - 1e-9) return { ok: false, error: SOLD_SINCE };
  h.lots = h.lots.filter((l) => l !== lot);
  h.shares = fix((Number(h.shares) || 0) - Number(r.units));
  if (onFile(h.costBasis)) h.costBasis = cents(Math.max(0, Number(h.costBasis) - (onFile(lot.cost) ? Number(lot.cost) : Number(r.value) || 0)));
  if (h.shares <= 1e-12) draft.holdings = draft.holdings.filter((x) => x !== h);
  draft.investments.staking = list.filter((x) => x !== r);
  if (!draft.investments.staking.length) delete draft.investments.staking;
  return { ok: true, reward: r };
}

// ---------------------------------------------------------------- the words (one written sentence per case, each tested)
const many = (n, one, more) => `${n} ${n === 1 ? one : more}`;
/** The row's status: "$412 in 2026"; "none in 2026" once a reward of another year is on file; with none at all, "only if you
 *  stake" (most people never stake: the row says it is not one to fill in). */
export const stakingStatus = (s, money = dollars) => (s.count ? `${money(s.total)} in ${s.year}` : s.any ? `none in ${s.year}` : "only if you stake");

/** What the year's rewards come to (R5: three cases, the first the empty one). */
export function stakingSentence(s, money = dollars) {
  if (!s.any) return "No staking rewards recorded yet. When coins you stake earn more coins, record each reward with what it was worth on the day you got it: that worth is income for that year, and the new coins join your list at that cost.";
  if (!s.count) return `No staking rewards recorded for ${s.year} yet. The ${many(s.others, "reward", "rewards")} from other years ${s.others === 1 ? "stays" : "stay"} on your list at ${s.others === 1 ? "its" : "their"} cost; each is income in its own year.`;
  return `Your staking rewards in ${s.year} come to ${money(s.total)}, from ${many(s.count, "reward", "rewards")}: income for ${s.year}, which the Federal estimate counts.`;
}
/** Under it, when the year has rewards and other years do too (empty otherwise). */
export function othersSentence(s) {
  if (!s.count || !s.others) return "";
  return `${many(s.others, "more reward", "more rewards")} from other years: each is income in its own year, not in ${s.year}.`;
}
/** The muted line under the year's rewards: they are added to the Federal estimate, so they must not be typed there too. */
export const TWICE = "The Federal estimate adds them as other income. If you typed them there yourself, under Other income, take them out there, so they are not counted twice.";
/** The rule, in one line (Rev. Rul. 2023-14; digital asset FAQs 59 and 107; README). */
export const RULE = "The IRS counts staking rewards as income in the year you can first sell or move them, at what they are worth then; that worth is also what the new coins cost you.";

/** The worth the chip under "What they were worth that day" fills in, an estimate: the coins typed x the coin's price on the
 *  list, to the cent ("1,000" and "0.004" read as typed); null without coins or a price. Nothing is saved by it. */
export function estimateWorth(units, price) {
  const u = Number(String(units ?? "").replace(/,/g, "").trim() || NaN), p = Number(price);
  return u > 0 && p > 0 && Number.isFinite(u * p) ? cents(u * p) : null;
}
/** That estimate as the box shows it: "400", "31.50", "1,234.56". */
export const estimateText = (n) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
/** The chip's words (the price itself is on the coin's row above; the box shows what it comes to). */
export const ESTIMATE_CHIP = "Estimate it at the price on your list";
/** Said at the coins box when the chip is tapped before it holds any. */
export const ESTIMATE_NEEDS = "Type how many coins you received first.";

/** The line under a reward on the list. */
export const rewardLine = (r, money = dollars) => `on your list at a cost of ${money(r.value)}`;
/** The title of a reward on the list: "0.012 ETH · Oct 31, 2026". */
export const rewardTitle = (r) => `${unitsText(r.units)} ${r.symbol} · ${dayText(r.day)}`;
/** Under the list when the year holds more than SHOWN rewards. */
export const earlierLine = (n) => `and ${many(n, "earlier one", "earlier ones")}, counted in the total above.`;

/** The green line after a reward is recorded (R7: it names the year's new total, or why this year's does not move). */
export function recordedSentence(reward, s, money = dollars) {
  const head = `Recorded: ${unitsText(reward.units)} ${reward.symbol} received ${dayText(reward.day)}, worth ${money(reward.value)}.`;
  const y = Number(reward.day.slice(0, 4));
  if (y === s.year) return `${head} Your ${s.year} staking rewards now come to ${money(s.total)}, counted as income, and the coins are on your list at that cost.`;
  return `Recorded: ${unitsText(reward.units)} ${reward.symbol} received ${dayText(reward.day)}, worth ${money(reward.value)}, on your list at that cost. It is income for ${y}, so the ${s.year} estimate does not change.`;
}
/** What the page asks before it takes a reward back, and what it says after (and after Undo). */
export const removeAsk = (r, money = dollars) => `Remove the reward of ${unitsText(r.units)} ${r.symbol} received ${dayText(r.day)}? Its coins come off your list and its ${money(r.value)} off your income.`;
export const removedSaid = (r) => `Reward removed: ${unitsText(r.units)} ${r.symbol} of ${dayText(r.day)} is off your list and off your income.`;
export const UNDONE_RECORD = "Undone: the reward is off your list and off your income.";
export const UNDONE_REMOVE = "Undone: the reward is back on your list and in your income.";
