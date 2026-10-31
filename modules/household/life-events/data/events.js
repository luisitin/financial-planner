// modules/household/life-events/data/events.js -- the life events, their steps and the plan changes each can make.
// A step: { key, text, days? (a deadline this many days after the event's day), year10? (December 31 of the 10th year
// after the event's year), go? [group, id], change? (a plan change the page can make on a tap), only? (when it shows) }.
// Sources, each read 2026-10-31:
//   HIPAA special enrollment (30 days after marriage, birth, adoption): U.S. Department of Labor, "Protections for
//     Newborns, Adopted Children, and New Parents" (https://www.dol.gov/node/63379) and its HIPAA FAQs for workers.
//   Marketplace special enrollment (60 days after marriage, a birth, a move, losing job-based cover): HealthCare.gov,
//     "Getting health coverage outside Open Enrollment" (https://www.healthcare.gov/coverage-outside-open-enrollment/special-enrollment-period/).
//   COBRA (at least 60 days to choose; a divorce: tell the plan within 60 days, up to 36 months): U.S. Department of Labor,
//     "A Worker's Guide to Health Benefits Under COBRA" and "FAQs on COBRA Continuation Health Coverage for Workers".
//   Filing status set by your status on December 31: IRS Publication 501.
//   Rollovers (60 days; a direct rollover avoids the 20% withholding): IRS, "Rollovers of retirement plan and IRA distributions".
//   Inherited IRAs (most beneficiaries other than a spouse empty it by December 31 of the year with the 10th anniversary
//     of the death): IRS Publication 590-B. Inherited property's basis is generally its value on the day of death: IRS,
//     "Gifts & inheritances" FAQ; Publication 551.
//   Splitting a workplace retirement plan needs a qualified domestic relations order: U.S. Department of Labor, "QDROs";
//     an IRA moved to a former spouse under the divorce decree is not taxed: IRC 408(d)(6), IRS Publication 590-A.
//   A Social Security number for a baby can be applied for at the hospital with the birth certificate: SSA, "Social
//     Security Numbers for Children". Change of address for the IRS: Form 8822.

export const EVENTS = {
  marriage: {
    label: "Getting married", icon: "💍", dateLabel: "Wedding day",
    intro: "Two people's money becomes one plan: taxes, health cover, beneficiaries and a shared budget.",
    steps: [
      { key: "partner", text: "Add your partner to People, so the plan counts both of you.", change: "addPartner" },
      { key: "filing", text: "Taxes: you count as married for the whole year if you are married on December 31. Most couples file jointly.", change: "fileJointly" },
      { key: "work-health", text: "Add your partner to your health insurance at work: you have at least 30 days after the wedding.", days: 30, go: ["insurance", "health"] },
      { key: "own-health", text: "If you buy your own health insurance: you can change plans within 60 days of the wedding.", days: 60, go: ["insurance", "health"] },
      { key: "name", text: "Changing your name? Do the Social Security card first, then work, banks and your ID; the tax return's names must match Social Security's." },
      { key: "beneficiaries", text: "Look at who gets each retirement account and life insurance policy if you die.", go: ["estate", "beneficiaries"] },
      { key: "withholding", text: "Check the tax taken from each paycheck now that you file together (a new Form W-4).", go: ["taxes", "withholding"] },
      { key: "budget", text: "Agree on shared bills, savings and goals.", go: ["cashflow", "budget"] },
      { key: "will", text: "Write or update your wills.", go: ["estate", "documents"] },
    ],
  },
  baby: {
    label: "A baby or adoption", icon: "👶", dateLabel: "Birth or adoption day (or the due date)",
    intro: "A new person to protect and plan for: health cover, a guardian, life insurance, child care and taxes.",
    steps: [
      { key: "child", text: "Add the child to People.", change: "addChild" },
      { key: "work-health", text: "Add the child to your health insurance at work: you have at least 30 days after the birth or adoption.", days: 30, go: ["insurance", "health"] },
      { key: "own-health", text: "If you buy your own health insurance: add the child within 60 days.", days: 60, go: ["insurance", "health"] },
      { key: "ssn", text: "Apply for the child's Social Security number (at the hospital, with the birth certificate). You need it for tax credits." },
      { key: "guardian", text: "Name a guardian in your will: who would raise the child if you could not.", go: ["estate", "documents"] },
      { key: "life", text: "Check how much life insurance the family needs now.", go: ["insurance", "life-needs"] },
      { key: "care", text: "Add child care and other new costs to your spending.", go: ["cashflow", "expenses"] },
      { key: "withholding", text: "The child tax credit lowers your tax: update your paycheck withholding.", go: ["taxes", "withholding"] },
      { key: "dcfsa", text: "If your job offers a dependent care account, ask HR how many days you have to join after the birth.", go: ["career", "benefits"] },
      { key: "hoh", text: "Single parent: you may be able to file as head of household, which taxes less than single.", change: "fileHeadOfHousehold", only: "single" },
      { key: "college", text: "Start saving for college if you want to.", go: ["goals", "education"] },
    ],
  },
  job: {
    label: "A new job", icon: "💼", dateLabel: "First day at the new job",
    intro: "New pay, new benefits to choose, health cover in between, and an old retirement account to decide about.",
    steps: [
      { key: "compare", text: "More than one offer? Compare them, benefits and commute included.", go: ["career", "offer-compare"] },
      { key: "pay", text: "Update your pay on Income.", change: "updatePay" },
      { key: "benefits", text: "Sign up for the new job's benefits: ask HR for the deadline.", go: ["career", "benefits"] },
      { key: "cobra", text: "A gap in health cover? COBRA keeps the old job's plan; you have at least 60 days to choose it.", days: 60, go: ["insurance", "health"] },
      { key: "own-health", text: "Or buy your own plan: within 60 days of losing the job's cover.", days: 60, go: ["insurance", "health"] },
      { key: "rollover", text: "The old 401(k): leave it, or move it to the new plan or an IRA. Ask for a direct rollover; money paid to you has 20% held back and must go into the new account within 60 days.", go: ["retirement", "contributions"] },
      { key: "w4", text: "Fill in a new Form W-4 at the new job.", go: ["cashflow", "paycheck"] },
      { key: "contacts", text: "Add the new HR or benefits contact.", go: ["household", "contacts"] },
    ],
  },
  move: {
    label: "Moving", icon: "🚚", dateLabel: "Moving day",
    intro: "A new state can change your taxes, your insurance prices and your health plan.",
    steps: [
      { key: "state", text: "Set your new state, so state taxes are worked out for it.", change: "setState" },
      { key: "address", text: "Tell the post office and the IRS your new address (Form 8822), then your bank, work and insurers.", go: ["household", "contacts"] },
      { key: "own-health", text: "If you buy your own health insurance: moving lets you change plans within 60 days.", days: 60, go: ["insurance", "health"] },
      { key: "insurance", text: "Home or renters insurance for the new place, and car insurance (prices change with the address).", go: ["insurance", "policies"] },
      { key: "taxes", text: "Moving to another state? Check its income tax.", go: ["taxes", "state"] },
      { key: "buy", text: "Buying a home? Plan the down payment.", go: ["goals", "house"] },
    ],
  },
  inheritance: {
    label: "An inheritance", icon: "🕊️", dateLabel: "The day they died",
    intro: "There is rarely a rush. Keep the money safe while you learn the tax rules, then fit it into your plan.",
    steps: [
      { key: "pause", text: "Take your time: keep the money in savings while you decide." },
      { key: "account", text: "Add what you inherited as an account, so the plan counts it.", change: "addAccount" },
      { key: "ira", text: "An inherited IRA or 401(k) from someone who was not your spouse: most people must empty it by December 31 of the 10th year after the death, and withdrawals are taxed. Spreading them out keeps the tax lower.", year10: true, go: ["estate", "inheritance"] },
      { key: "basis", text: "Inherited shares or a house: for tax, their cost is usually their value on the day of death, so selling soon after brings little tax. Ask the executor for those values." },
      { key: "debt", text: "Pay off expensive debt and fill your emergency fund first.", go: ["debt", "payoff"] },
      { key: "plan", text: "See what it does to your plan.", go: ["estate", "inheritance"] },
    ],
  },
  divorce: {
    label: "A divorce", icon: "🧾", dateLabel: "The day it is final",
    intro: "One plan becomes two: taxes, retirement accounts, health cover, beneficiaries and a new budget.",
    steps: [
      { key: "filing", text: "Taxes: if you are divorced on December 31, you count as unmarried for the whole year (single, or head of household with a child living with you).", change: "fileSingle" },
      { key: "people", text: "Remove your former partner on People once the plan should no longer count them.", go: ["household", "people"] },
      { key: "qdro", text: "Splitting a 401(k) or pension needs a court order the plan approves (a qualified domestic relations order). An IRA can be moved to the other person under the divorce papers without tax." },
      { key: "cobra", text: "Health cover: a former spouse can stay on the work plan through COBRA for up to 36 months. Tell the plan within 60 days of the divorce.", days: 60, go: ["insurance", "health"] },
      { key: "beneficiaries", text: "Change who gets each account and policy if you die.", go: ["estate", "beneficiaries"] },
      { key: "will", text: "Update your will and powers of attorney.", go: ["estate", "documents"] },
      { key: "withholding", text: "Fill in a new Form W-4.", go: ["taxes", "withholding"] },
      { key: "budget", text: "Rebuild your budget for one household.", go: ["cashflow", "budget"] },
    ],
  },
};
