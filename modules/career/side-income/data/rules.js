// modules/career/side-income/data/rules.js -- the yearly rules a side income runs into, each checked 2026-10-30.
// Information returns: IRC 6041(a) as amended by P.L. 119-21 section 70433 ($2,000 from payments made in 2026, indexed
// from 2027; IRS Instructions for Forms 1099-MISC and 1099-NEC, rev. 12/2026); IRC 6050W(e) as restored by P.L. 119-21
// section 70432 (over $20,000 and over 200 payments, as if part of ARPA section 9674; IRS FAQs on Form 1099-K).
// Business miles: IRS Notice 2026-10 (72.5 cents, IR-2025-128) and Announcement 2026-11 (76 cents from July 1, 2026,
// IRB 2026-29); Notice 2025-5 for 2025.
export const RULES = {
  // form1099K.apps: payment apps and marketplaces (third-party settlement organizations, IRC 6050W(e)); card processors report any amount
  2026: { form1099NEC: 2000, form1099K: { apps: { amount: 20000, payments: 200 }, cards: 0 }, mileage: [{ from: "2026-01-01", cents: 72.5 }, { from: "2026-07-01", cents: 76 }] },
  2025: { form1099NEC: 600, form1099K: { apps: { amount: 20000, payments: 200 }, cards: 0 }, mileage: [{ from: "2025-01-01", cents: 70 }] },
};
/** Self-employment tax starts once net earnings from self-employment, 92.35% of profit, reach $400 (IRC 1402(b), 6017): about $433 of profit. */
export const THRESHOLDS = { seTax: 400, seBase: 0.9235 };
export const rulesFor = (year) => RULES[year] ?? RULES[Math.max(...Object.keys(RULES).map(Number).filter((y) => y <= year))] ?? RULES[Math.min(...Object.keys(RULES).map(Number))];
/** The business mileage rate on a day, in dollars a mile. */
export const mileageOn = (iso) => { const r = rulesFor(Number(String(iso).slice(0, 4))).mileage; return ([...r].reverse().find((m) => String(iso) >= m.from) ?? r[0]).cents / 100; };
