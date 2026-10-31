// modules/retirement/contributions/data/limits.js -- IRS contribution limits by year (the
// employee's own money; employer matches do not count against the 401(k) elective limit).
// Sources: IRS notices announcing cost-of-living adjustments (Notice 2024-80 for 2025, Notice
// 2025-67 for 2026); HSAs Rev. Proc. 2024-25 sec. 2.01(1) (2025) and Rev. Proc. 2025-19 sec. 2.01(1) (2026); health FSAs
// Rev. Procs. 2024-40 and 2025-32 (all read 2026-10-31). Check every January and add the new year. The 2027 HSA limits
// ($4,500 / $9,000, Rev. Proc. 2026-24 sec. 3.01(1)) came out in May 2026, before the rest of 2027: they are in
// insurance/health's HDHP_BY_YEAR and career/benefits until the whole 2027 year is added here.
export const LIMITS = {
  2025: {
    kinds: {
      "401k": { label: "401(k) / 403(b)", limit: 23500, catchUpAge: 50, catchUp: 7500, superCatchUp: { from: 60, to: 63, amount: 11250 } },
      ira:    { label: "IRA (traditional and Roth together)", limit: 7000, catchUpAge: 50, catchUp: 1000 },
      hsa:    { label: "HSA (self-only coverage)", limit: 4300, catchUpAge: 55, catchUp: 1000, family: 8550 },
      fsa:    { label: "Health FSA", limit: 3300, carryover: 660 },   // Rev. Proc. 2024-40; no account type feeds it, the HSA/FSA page reads it
    },
    rothPhaseOut: { single: [150000, 165000], married_joint: [236000, 246000], married_separate: [0, 10000], head_of_household: [150000, 165000], qualifying_surviving: [236000, 246000] },   // Roth IRA income limits (MAGI), Notice 2024-80
    giftExclusion: 19000,   // the yearly gift-tax exclusion, the practical limit on 529 gifts per giver per child (Rev. Proc. 2024-40)
  },
  2026: {
    kinds: {
      "401k": { label: "401(k) / 403(b)", limit: 24500, catchUpAge: 50, catchUp: 8000, superCatchUp: { from: 60, to: 63, amount: 11250 } },
      ira:    { label: "IRA (traditional and Roth together)", limit: 7500, catchUpAge: 50, catchUp: 1100 },
      hsa:    { label: "HSA (self-only coverage)", limit: 4400, catchUpAge: 55, catchUp: 1000, family: 8750 },
      fsa:    { label: "Health FSA", limit: 3400, carryover: 680 },   // Rev. Proc. 2025-32
    },
    rothPhaseOut: { single: [153000, 168000], married_joint: [242000, 252000], married_separate: [0, 10000], head_of_household: [153000, 168000], qualifying_surviving: [242000, 252000] },   // Notice 2025-67
    giftExclusion: 19000,   // Rev. Proc. 2025-32
  },
};
