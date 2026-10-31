// modules/retirement/contributions/data/limits.js -- IRS contribution limits by year (the
// employee's own money; employer matches do not count against the 401(k) elective limit).
// Sources: IRS notices announcing cost-of-living adjustments (Notice 2024-80 for 2025, Notice
// 2025-67 for 2026); HSAs Rev. Proc. 2024-25 sec. 2.01(1) (2025), Rev. Proc. 2025-19 sec. 2.01(1) (2026) and Rev. Proc.
// 2026-24 sec. 3.01(1) (2027, dated 2026-05-29, https://www.irs.gov/pub/irs-drop/rp-26-24.pdf); health FSAs
// Rev. Procs. 2024-40 and 2025-32 (all read 2026-10-31). Check every January and add the new year.
// A year can be partial: the IRS publishes the HSA limits in the spring and the rest in October and November, so a
// year holds only the kinds published so far (2027: the HSA only; the 2027 401(k), IRA, FSA, Roth IRA and gift figures
// were not published by 2026-10-31). Read the table only through limitsFor(year) in ../compute.js, which takes each kind
// from the newest year that has it and says which year that is.
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
  2027: {   // partial: only the HSA was published by 2026-10-31
    kinds: {
      // Rev. Proc. 2026-24 sec. 3.01(1): "For calendar year 2027, the annual limitation on deductions under section
      // 223(b)(2)(A) for an individual with self-only coverage under a high deductible health plan is $4,500. ... family
      // coverage ... is $9,000." The catch-up stays $1,000 from 55 (IRC 223(b)(3)(B), not indexed).
      hsa:    { label: "HSA (self-only coverage)", limit: 4500, catchUpAge: 55, catchUp: 1000, family: 9000 },
    },
  },
};
