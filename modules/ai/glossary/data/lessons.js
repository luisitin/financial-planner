// modules/ai/glossary/data/lessons.js -- "A two-minute lesson" behind the 20 words people meet on the most pages (gap
// list item 13, 2026-11-15), and behind Velocity banking (item 59; its sums are velocity() in compute.js). Each lesson:
// about 250 to 350 plain words in three parts (what it is, why it matters to you, an example with an invented
// household's round figures), one page of the app to try it on, and the public sources of its rules. Written in the app's own words; no text copied. No yearly dollar
// limit (they change every year and live on the pages that use them): only rates fixed in law, figures labelled as an
// example, and the app's own assumptions (system/assumptions README). Which source backs which sentence, with the read
// dates, is in the README ("Lessons"); module.test.mjs checks every sum in an example and the word counts.
// Fields: id (the word's id in data/terms.js), page ("group/id", the one page linked), what, why, example (paragraphs),
// sources ([{ name, url }], shown under the lesson); optional: tryIt (the line above the page's button, when "Try it with
// your own numbers:" would promise too much), withData (the button only when that page works out its answer for the
// plan: compute.js tryItOf) and notYet ({ figures: the line above the button when the page first asks for figures of
// the account the plan holds, none: the line alone when the plan holds no such account}).
const IRS = (name, path) => ({ name: `IRS: ${name}`, url: `https://www.irs.gov/${path}` });
const S = {
  taxable: IRS("Taxable income", "filing/taxable-income"),
  agi: IRS("Definition of adjusted gross income", "e-file-providers/definition-of-adjusted-gross-income"),
  credits: IRS("Credits and deductions for individuals", "credits-and-deductions-for-individuals"),
  brackets: IRS("Federal income tax rates and brackets", "filing/federal-income-tax-rates-and-brackets"),
  k401: IRS("401(k) plans", "retirement-plans/401k-plans"),
  early: IRS("Topic no. 558, Additional tax on early distributions from retirement plans", "taxtopics/tc558"),
  tradIra: IRS("Traditional IRAs", "retirement-plans/traditional-iras"),
  rothIra: IRS("Roth IRAs", "retirement-plans/roth-iras"),
  gains: IRS("Topic no. 409, Capital gains and losses", "taxtopics/tc409"),
  itemize: IRS("Topic no. 501, Should I itemize?", "taxtopics/tc501"),
  hsa: IRS("Publication 969, Health Savings Accounts and Other Tax-Favored Health Plans", "publications/p969"),
  status: IRS("Publication 501, Dependents, Standard Deduction, and Filing Information", "publications/p501"),
  fica: IRS("Topic no. 751, Social Security and Medicare withholding rates", "taxtopics/tc751"),
  extraMedicare: IRS("Topic no. 560, Additional Medicare tax", "taxtopics/tc560"),
  invest: IRS("Publication 550, Investment Income and Expenses", "publications/p550"),
  bls: { name: "BLS glossary (constant dollars)", url: "https://www.bls.gov/bls/glossary.htm" },
  cpi: { name: "BLS: Consumer Price Index frequently asked questions", url: "https://www.bls.gov/cpi/questions-and-answers.htm" },
  stocks: { name: "Investor.gov (SEC): Stocks", url: "https://www.investor.gov/introduction-investing/investing-basics/investment-products/stocks" },
  bonds: { name: "Investor.gov (SEC): Bonds", url: "https://www.investor.gov/introduction-investing/investing-basics/investment-products/bonds-or-fixed-income-products/bonds" },
  finraTrade: { name: "FINRA: Buying and Selling", url: "https://www.finra.org/investors/investing/investing-basics/buying-and-selling" },
  netWorth: { name: "FINRA: Know your net worth", url: "https://www.finra.org/investors/personal-finance/know-your-net-worth" },
  rate: { name: "CFPB: What is the difference between a mortgage interest rate and an APR?", url: "https://www.consumerfinance.gov/ask-cfpb/what-is-the-difference-between-a-mortgage-interest-rate-and-an-apr-en-135/" },
  cushion: { name: "CFPB: An essential guide to building an emergency fund", url: "https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/" },
  grossNet: { name: "CFPB financial terms glossary", url: "https://www.consumerfinance.gov/consumer-tools/educator-tool/youth-financial-education/glossary/" },
  heloc: { name: "CFPB: What is a home equity line of credit (HELOC)?", url: "https://www.consumerfinance.gov/ask-cfpb/what-is-a-home-equity-line-of-credit-heloc-en-107/" },
};

export const LESSONS = [
  {
    id: "todays-dollars", page: "retirement/projection",
    what: [
      "Prices rise over the years, so a dollar later buys less than a dollar today.",
      "To put a future amount in today's dollars, the app divides it by how much prices will have grown by then. What is left is the same buying power, priced as things cost now.",
    ],
    why: [
      "Plans run for decades, and big future numbers can fool you. A million dollars in 30 years sounds like plenty, but it will not buy what a million buys today.",
      "Showing everything in today's dollars lets you hold a future figure up against your life now. When a page says you could spend $50,000 a year in today's dollars, picture what $50,000 buys this year, whatever the price tags say by then.",
      "Amounts from past years can be shown the same way, as what they would buy now. Unless you change it on the Assumptions page, the app counts on prices rising 3% a year, about their long-run average.",
    ],
    example: [
      "Ana and Bo expect to have $1,000,000 saved in 30 years. At 3% a year, prices grow about 2.43 times in 30 years: 1.03 multiplied by itself 30 times.",
      "So their $1,000,000 then buys about what $412,000 buys today: $1,000,000 divided by 2.43.",
      "It works the other way too. If they want to spend $60,000 a year at today's prices once they retire, the price tags in 30 years will add up to about $146,000 a year: $60,000 times 2.43. Both are the same spending; today's dollars just let them think about it in prices they know.",
    ],
    sources: [S.bls],
  },
  {
    id: "federal-income-tax", page: "taxes/federal",
    what: [
      "Pay is only part of it: side work, interest, dividends, gains when you sell investments, retirement withdrawals and some benefits count too, unless a law leaves them out.",
      "It is worked out in steps. Start with all your income. Take off a short list of adjustments to get your adjusted gross income. Take off your deduction to get your taxable income. The tax brackets turn that into a tax, and credits come off the tax.",
    ],
    why: [
      "For most people it is the biggest tax on their pay. What is taken from each paycheck is only a running estimate; the real amount is settled when you file your return. Too little taken out means a bill, too much a refund.",
      "Knowing the steps shows what lowers it. Money put into a pre-tax 401(k) is left out of your taxable pay. A deduction lowers the income that is taxed. A credit lowers the tax itself. The Federal estimate walks through these steps with your own numbers.",
    ],
    example: [
      "Riley earns $39,000 and has $100 of bank interest: $39,100 of income. Riley puts $2,000 of pay into a pre-tax 401(k), so $37,100 is left to tax.",
      "Say the deduction is $15,000 (a round figure; the Federal estimate uses this year's). That leaves $22,100 of taxable income.",
      "Say the first $12,000 is taxed at 10% and the rest at 12% (round figures; the real lines move each year). That is $1,200 plus 12% of $10,100, which is $1,212: $2,412 in all. A $500 credit, if Riley had one, would bring it down to $1,912.",
    ],
    sources: [S.taxable, S.agi, S.credits, S.k401],
  },
  {
    id: "tax-bracket", page: "taxes/brackets",
    what: [
      "Think of the bands as a stack of glasses: your income fills the bottom one first, and only what spills over goes into the next.",
      "Only the dollars inside a band pay that band's rate. When your income reaches a higher band, the dollars below it keep their lower rates. The federal rates are 10%, 12%, 22%, 24%, 32%, 35% and 37%. Where each band starts depends on your filing status and moves up with inflation each year.",
    ],
    why: [
      "It clears up a common worry. A raise never leaves you with less after federal income tax because it reaches a higher band: only the new dollars pay the higher rate.",
      "Your top band, often called your marginal rate, tells you what tax the next dollar of income costs and what the next dollar of deduction saves. Your average rate, the whole tax divided by your taxable income, is lower than your top rate once you reach a second band.",
    ],
    example: [
      "Say the bands for Riley are 10% up to $12,000, 12% up to $48,000 and 22% above that (round figures close to a single person's real ones).",
      "With $40,000 of taxable income, Riley pays 10% on the first $12,000, which is $1,200, and 12% on the next $28,000, which is $3,360: $4,560 in all. That is an average of 11.4%, though the top rate is 12%.",
      "Now a raise takes taxable income to $50,000. The $8,000 up to $48,000 pays 12%, which is $960, and only the last $2,000 pays 22%, which is $440. The $10,000 raise costs $1,400 of tax, and Riley keeps the other $8,600.",
    ],
    sources: [S.brackets],
  },
  {
    id: "health-savings-account", page: "taxes/hsa-fsa",
    what: [
      "To add money you need a high-deductible health plan, which pays little until your medical bills in the year pass a set amount, and no other health coverage. Once you are on Medicare, you can no longer add any.",
      "Money you put in is taken off your income for tax, or skips the tax when it comes straight from your paycheck. What it earns grows untaxed, and money taken out for medical costs is not taxed at all.",
    ],
    why: [
      "It is the one account where money can go in, grow and come out without tax. Unspent money carries over from year to year, and the account stays with you if you change jobs or stop working.",
      "Money taken out for anything other than medical costs is taxed as income, plus an extra 20% tax. From 65 on, or if you become disabled, the extra 20% no longer applies, so an unused balance can work like a retirement account. How much can go in each year has a limit; the Contribution limits page shows this year's.",
    ],
    example: [
      "Ana puts $3,000 a year into her HSA from her paycheck. If her top tax rate is 22%, that saves her about $660 of income tax a year.",
      "When she pays a $1,000 doctor's bill from the account, no tax is due on that $1,000.",
      "If at 40 she took $1,000 out for a vacation instead, she would owe income tax on it, $220 at 22%, and the extra 20%, which is $200. That is $420 of the $1,000 gone. At 65 the same withdrawal would cost only the $220 of income tax.",
    ],
    sources: [S.hsa],
  },
  {
    id: "tax-deduction", page: "taxes/federal",
    what: [
      "The deduction most people think of is one choice made on the return: a set amount, or a list of your own costs.",
      "Most people take the standard deduction, a set amount that depends on your filing status. It is larger at 65 or older, and the IRS raises it for inflation each year.",
      "If your deductible costs add up to more, you can list them instead, which is called itemizing. They include state and local taxes, mortgage interest, gifts to charity and large medical bills, each with its own limits. You take whichever is larger.",
    ],
    why: [
      "A deduction saves your tax rate times the deduction, not the whole amount. At a 12% rate, a $1,000 deduction saves $120.",
      "It also explains a common surprise: when the standard deduction is larger than everything you could list, costs such as mortgage interest save nothing extra, because you are not listing them. A credit is worth more: it comes off the tax, dollar for dollar.",
    ],
    example: [
      "Ruth and Sam file jointly, and their mortgage is paid off. Say their standard deduction is $34,000 (a round figure; the Federal estimate uses this year's, with the extra for being 65 or older).",
      "This year they paid $9,000 of state and property tax and gave $6,000 to charity: $15,000 they could list. That is well under $34,000, so they take the standard deduction.",
      "With $90,000 of income, their taxable income is $90,000 minus $34,000, which is $56,000. If their top rate is 12%, each $1,000 more of deduction would save them $120 of tax; a $1,000 credit would save the full $1,000.",
    ],
    sources: [S.credits, S.itemize],
  },
  {
    id: "stock", page: "investments/allocation",
    what: [
      "A share's price goes up and down with how the company and the market are doing, and the profit some companies pay their owners is called a dividend.",
      "Most people own stocks through funds, which hold hundreds or thousands of companies at once, so one company's trouble barely moves them.",
    ],
    why: [
      "Over long stretches, stocks have grown more than bonds or savings, which is why money for retirement is often mostly in stocks. The price of that growth is the drops along the way: in some years stocks lose a large part of their value.",
      "So money you will need in the next few years is usually kept out of stocks, while money for decades can ride out the drops. The app counts on stocks growing 7% a year on average before inflation, with ups and downs of about 15% in a typical year; you can change both on the Assumptions page.",
    ],
    example: [
      "Bo puts $10,000 into a stock fund. In a good year it might rise 20%, to $12,000; in a bad year it might fall 30%, to $7,000.",
      "If Bo had to sell in the bad year, the $3,000 loss would be real. If he can wait, he still owns the same shares, and their price can recover, though nothing promises it will.",
      "Over 30 years at the app's 7% a year, $10,000 grows to about $76,000. In today's dollars, with prices rising 3% a year, that is about $31,000 of buying power: still about three times what he put in.",
    ],
    sources: [S.stocks],
  },
  {
    id: "taxable-account", page: "investments/asset-location",
    what: [
      "It is often called a brokerage account. You can put in as much as you like and take money out at any time, with no extra tax for taking it early.",
      "Each year you pay tax on the interest and dividends it earns, even when they are reinvested. When you sell something for more than you paid, you pay tax on the gain.",
    ],
    why: [
      "It is the most flexible place for money: no yearly limit and no age rules, unlike a 401(k), an IRA or an HSA. The cost is that taxes nibble at its growth every year.",
      "That is why people often fill the accounts with a tax break first, and keep in the taxable account the investments that pay out the least taxable income each year. The Asset location page works out which holdings belong where. Shares held more than a year before you sell are taxed at the lower long-term rates.",
    ],
    example: [
      "Ana and Bo have $18,000 in a brokerage account. Say it pays $360 of dividends this year, which is 2%. That $360 goes on this year's tax return, even though it was reinvested; the same $360 inside Bo's Roth IRA would not.",
      "Three years ago they bought shares for $5,000. If they sell them now for $8,000, the $3,000 gain is long-term, because they held the shares more than a year. At a 15% gains rate, a common one, the tax is $450; sold within a year, the gain would be taxed like pay. Either way, the $18,000 stays theirs to use at any age.",
    ],
    sources: [S.finraTrade, S.invest, S.gains],
  },
  {
    id: "filing-status", page: "taxes/filing-status",
    what: [
      "Whether you count as married is decided by where things stand on the last day of the year, December 31 for most people.",
      "Your status is the box you check near the top of the return, and only one can be checked. A married couple can file one return together, or one return each.",
    ],
    why: [
      "Your filing status sets your standard deduction and the bands of your tax brackets, and it decides some credits and deductions. If more than one status fits you, you may pick the one that gives the lowest tax.",
      "Head of household is the one people miss. It is for someone unmarried who paid more than half the cost of keeping up a home where a qualifying person, such as their child, lived for more than half the year. It usually has lower tax rates and a larger standard deduction than single.",
    ],
    example: [
      "Riley lives alone and files as single. Ana and Bo are married on December 31, so they can file jointly or separately; the Filing status compare page works out their tax both ways.",
      "Now take a friend of theirs, divorced by December 31, whose daughter lives with her all year and who pays most of the home's costs. She can file as head of household instead of single.",
      "Say the 10% band runs to $12,000 for single and to $17,000 for head of household (round figures; the real ones change each year). Those $5,000 are taxed at 10% instead of 12%: $100 less tax from that band alone, before her larger standard deduction.",
    ],
    sources: [S.status, S.brackets],
  },
  {
    id: "social-security-and-medicare-tax", page: "cashflow/paycheck",
    what: [
      "On a pay stub it is often shown as FICA, after the Federal Insurance Contributions Act. You pay 6.2% of your pay for Social Security and 1.45% for Medicare, 7.65% in all, and your employer pays the same again.",
      "Together they pay for retirement, disability and survivor benefits, and for Medicare's hospital insurance. If you work for yourself, you pay both halves, as self-employment tax.",
    ],
    why: [
      "It comes out of your pay on top of income tax, before you ever see the money. Unlike income tax, it is not lowered by money you put into a 401(k): that money still counts as pay for these two taxes.",
      "The Social Security part stops each year at the cap, the wage base; the Medicare part has none. Once one job pays you more than $200,000 in a year, your employer also takes out an extra 0.9% for Medicare on the pay above that, with no employer share. What you owe in the end depends on your filing status. It starts above $250,000 of a married couple's combined pay if they file jointly, $125,000 each if they file separately, and $200,000 for anyone else. Your tax return settles any difference.",
    ],
    example: [
      "Ana is paid $3,900 every two weeks and puts $390 of each paycheck into her 401(k). Income tax is worked out on $3,510, but Social Security and Medicare are worked out on the full $3,900.",
      "Social Security takes 6.2%, which is $241.80, and Medicare takes 1.45%, which is $56.55: $298.35 a paycheck. Her employer pays another $298.35 on top, and that share never comes out of her pay.",
      "Over 26 paychecks that is $7,757.10 from Ana's pay. Her yearly pay of $101,400 is under the cap, so the Social Security part is taken all year.",
    ],
    sources: [S.fica, S.extraMedicare],
  },
  {
    id: "bond", page: "investments/allocation",
    what: [
      "Owning a bond is lending, not owning a piece of a company: you get only the interest promised and your money back at the end, if the borrower can pay.",
      "Many people own bonds through funds that hold a great many of them at once.",
    ],
    why: [
      "Bond prices usually swing less than stock prices, so bonds steady a mix and are a common place for money needed in the next few years. The trade-off is slower growth: the app counts on 4% a year for bonds against 7% for stocks, before inflation, as the Assumptions page shows.",
      "One thing surprises people: a bond's price moves when interest rates move. When rates rise, older bonds that pay less are worth less to a buyer; when rates fall, they are worth more.",
    ],
    example: [
      "Ruth lends $10,000 to the US government for 10 years at 4%. She gets $400 a year, $4,000 over the 10 years, and her $10,000 back at the end.",
      "Over the 10 years Ruth gets $14,000 back for her $10,000: the $4,000 of interest plus the loan itself.",
      "A year later new bonds pay 5%, which is $500 a year on $10,000. A buyer would not pay her the full $10,000 for a bond that pays only $400, so if she sold hers early she would get less than she paid.",
      "If she keeps it to the end, the price in between does not matter: she still gets every $400 and her $10,000 back, as long as the borrower can pay. That is why bonds you plan to hold to the end are calmer than their prices look.",
    ],
    sources: [S.bonds],
  },
  {
    id: "interest-rate", page: "debt/payoff",
    what: [
      "The rate is a yearly figure, even on a card that bills you every month. It leaves out the fees for getting the loan; the annual percentage rate (APR) adds those in, so two loans at the same rate can cost different amounts.",
      "On most loans and cards, interest is worked out each month: what you owe times the yearly rate, divided by 12. Savings earn interest the same way, in the other direction.",
    ],
    why: [
      "Interest is the price of borrowing, charged month after month until the balance is gone. On a card with a high rate, the minimum payment can go mostly to interest, so the balance barely moves.",
      "When you have several debts, each extra dollar does the most good on the one with the highest rate. That is the highest-rate-first order, often called the avalanche, which the Pay off debts page uses. Every dollar above the minimum lowers the balance that next month's interest is worked out on.",
    ],
    example: [
      "Riley owes $4,500 on a card at 29%. This month's interest is $4,500 times 29%, divided by 12: $108.75.",
      "Riley pays the $150 minimum, so only $41.25 lowers the balance. Paying $250 instead, $141.25 would lower it, more than three times as much.",
      "At $150 a month the card takes about 4 years and 7 months to clear and costs about $3,610 of interest. At $250 a month it is gone in about 2 years, for about $1,480.",
      "Riley also has a car loan at 9%. An extra $100 on the card stops about $2.42 of interest a month; the same $100 on the car loan stops 75 cents. So the card comes first.",
    ],
    sources: [S.rate],
  },
  {
    id: "inflation-and-cpi", page: "system/assumptions",
    what: [
      "The CPI works like a price tag on one basket of goods and services, checked again and again over the years. When the basket costs more, prices have risen, and the rise, in percent, is the inflation rate.",
      "When people say inflation was 3% last year, they mean the index rose 3%: the basket cost $103 for what $100 bought the year before.",
    ],
    why: [
      "Inflation quietly shrinks money that sits still and any amount fixed in dollars. It is why the app shows future figures in today's dollars, and why a pension that does not rise with prices buys less each year. It is also why long-term money is usually invested to grow faster than prices.",
      "Unless you change it, the app counts on prices rising 3% a year, about the long-run average of the CPI; the Assumptions page also offers 2.5% and 4%.",
    ],
    example: [
      "Ruth and Sam spend $5,000 a month. If prices rise 3% a year, the same groceries, bills and outings cost about $6,720 a month in 10 years and about $9,030 a month in 20 years. In 30 years it is about $12,140 a month.",
      "Say part of their income is a pension of $20,000 a year that never rises. After 10 years it still pays $20,000, but that buys only what about $14,880 buys today.",
      "So a plan has to count each year's spending as rising with prices, or it will look better than it is. A gap that looks small today can grow large over a long retirement. Their savings face the same: money earning less than 3% a year loses buying power.",
    ],
    sources: [S.cpi],
  },
  {
    id: "emergency-fund", page: "goals/emergency-fund",
    what: [
      "It is cash, not investments, and a savings account is the usual place for it: safe, easy to reach and not swinging with the markets. Kept apart from the money you spend each month, it is less tempting to dip into.",
    ],
    why: [
      "Without it, a surprise goes on a credit card at a high rate, or forces you to sell investments at a bad moment. With it, a lost job or a broken furnace is a problem, not a crisis. It is not an investment: its job is to be there, not to grow.",
      "The app sizes it from your must-pay bills, not all your spending. It suggests 3 months of them when two or more people in the home earn a salary, and 6 months with one paycheck or none. It adds 3 months when pay goes up and down, as with a business, commission or bonus, and never suggests more than 12.",
    ],
    example: [
      "Riley lives alone on one salary, so the app suggests 6 months. Riley's must-pay bills (rent, utilities, groceries, the car, insurance and the minimum debt payments) come to about $2,400 a month. Six months of that is $14,400.",
      "Riley has $1,000 in the bank. Setting aside $300 a month, the other $13,400 takes about 45 months, almost four years, and a little less with the interest the savings earn.",
      "If Riley lost the job, the $14,400 would pay six months of must-pay bills while Riley looked for the next one; eating out and shopping would wait. A first $1,000 already helps: it can pay for a small car repair without a new card balance.",
    ],
    sources: [S.cushion],
  },
  {
    id: "taxable-income", page: "taxes/federal",
    what: [
      "It is reached in two steps. Your adjusted gross income comes first; then your deduction comes off it, the standard deduction or your itemized deductions, with a few others, such as the deduction for some business income.",
      "It is usually well below your pay, because money for a pre-tax 401(k), the adjustments and the deduction have all come off first.",
    ],
    why: [
      "It is the figure that decides which tax bands you reach. Lowering it by $1,000 saves your top tax rate on that $1,000, which is why saving before tax lowers this year's tax.",
      "It also explains why two people with the same pay can owe different amounts: one may save more before tax, have a larger deduction or file under a different status. It is only for income tax: Social Security and Medicare tax are worked out on pay before the 401(k) comes off.",
    ],
    example: [
      "Ana and Bo earn about $164,000 in pay together; leave Bo's weekend photography aside. They put $12,000 into pre-tax 401(k)s, so $152,000 of pay is left to tax. With no adjustments, that is also their adjusted gross income.",
      "Say their standard deduction is $32,000 (a round figure; the Federal estimate uses this year's). Their taxable income is $152,000 minus $32,000: $120,000. The brackets are applied to $120,000, not to $164,000.",
      "Each band's rate is then applied to its share of the $120,000; the Bracket explorer shows where their last dollar lands. If Bo put $2,000 more into his 401(k) and their top rate is 22%, their taxable income would fall to $118,000 and their tax by about $440.",
    ],
    sources: [S.agi, S.itemize, S.k401],
  },
  {
    id: "net-worth", page: "balance/net-worth",
    what: [
      "What you own includes your cash, investments, retirement accounts, your home and other things of value. What you owe includes your mortgage, other loans and card balances.",
      "A home or a car counts at what it would sell for today, not at what you paid for it.",
    ],
    why: [
      "It is one number for the whole picture, and the way it moves over months and years says more than any single day. It grows when you spend less than you earn, when investments gain or when your home gains value.",
      "Paying off a loan does not change it on the day you pay: your cash falls and your debt falls by the same amount. The gain comes over the following months, as less of your money goes to interest. A home counts in it, but it is not money you can spend without selling or borrowing against it.",
    ],
    example: [
      "Ana and Bo have $15,700 in checking and savings, $159,000 in retirement accounts, $18,000 in a brokerage account and a house worth $380,000: $572,700 in all.",
      "They owe $265,000 on the mortgage, $6,400 on a card and $14,200 on the car: $285,600. Their net worth is $572,700 minus $285,600, which is $287,100.",
      "If they pay the $6,400 card off from savings, they own $566,300 and owe $279,200. Their net worth is still $287,100, but the $6,400 is no longer charging them interest every month. Next year their net worth grows by whatever they save, plus what their investments and house gain, minus what any of them lose.",
    ],
    sources: [S.netWorth],
  },
  {
    id: "tax-credit", page: "taxes/federal",
    what: [
      "Some credits are refundable: what is left of the credit once your tax reaches zero is paid to you, as part of your refund.",
      "There are credits for children and other dependents, child care, college costs, saving for retirement and health insurance bought through the marketplace, among others. Some depend on your income. To claim one, you answer a few questions in your tax software, or fill in a form with a paper return.",
    ],
    why: [
      "Dollar for dollar, a credit is worth more than a deduction. A $1,000 credit saves $1,000; a $1,000 deduction saves only your tax rate times $1,000, such as $120 at 12%. A credit that is not refundable can bring your tax down to zero, but not below.",
      "A credit you qualify for but do not claim is money left behind, so it is worth checking each year which ones fit your family. The Federal estimate counts the ones it can see in your plan, such as the child tax credit.",
    ],
    example: [
      "Ana and Bo owe $9,000 of federal income tax before credits. Say they can claim $2,000 for their son Cy (a round figure; the Federal estimate uses this year's). Then they owe $7,000.",
      "A $2,000 deduction instead would have saved them $440 at a 22% rate, and only $240 at 12%. The credit saves the full $2,000 whatever their rate.",
      "Refundable credits can go further. If Riley owed $300 of tax and had a $500 refundable credit, the $300 would be wiped out and the other $200 paid to Riley as a refund.",
    ],
    sources: [S.credits],
  },
  {
    id: "adjusted-gross-income", page: "taxes/federal",
    what: [
      "The few things taken off first are called adjustments, and they come off your income from all sources. They include student loan interest, money you put into a health savings account or a deductible traditional IRA on your own, and the employer's half of self-employment tax.",
      "It comes before the standard or itemized deduction. On the federal return, Form 1040, it is line 11a on the 2025 form (line 11 on earlier years' forms). Tax software works it out for you, and last year's figure is on last year's return.",
    ],
    why: [
      "Many tax breaks look at it. It decides whether you can deduct money put into an IRA, how much you may put into a Roth IRA and whether you qualify for some credits. Some of these use a version of it with a few amounts added back.",
      "So lowering it can do more than save tax at your rate: it can keep you under a line where a break starts to shrink. It is also a figure you may be asked for to confirm who you are when you file online.",
    ],
    example: [
      "Say Jordan, a teacher, earns $52,000 in pay, $6,000 from renting out a room and $500 of bank interest: $58,500 of income.",
      "Jordan paid $2,000 of student loan interest and spent $250 of her own money on classroom supplies. Both are adjustments: $2,250 in all. Neither needs Jordan to itemize.",
      "Jordan's adjusted gross income is $58,500 minus $2,250: $56,250. Her deduction comes off after that, to give her taxable income. Had she also put $3,000 into a deductible IRA, her adjusted gross income would be $53,250.",
    ],
    sources: [S.agi, S.tradIra, S.rothIra],
  },
  {
    id: "gross-and-net", page: "cashflow/paycheck",
    what: [
      "Gross pay is the salary in your offer letter. Net pay, or take-home pay, is what lands in your bank account. The same words are used for a business: gross income is the money coming in, and net is what is left after costs.",
    ],
    why: [
      "Budgets run on net pay, because that is the money you can actually spend. Lenders and many rules of thumb use gross pay: a lender's debt-to-income ratio divides your monthly debt payments by your gross monthly pay.",
      "The gap between the two is taxes: federal and state income tax, Social Security and Medicare. It also holds what you choose to put aside before you are paid, such as a 401(k) or health insurance. Part of that gap is still yours: the 401(k) money is savings, not a cost. Your pay stub lists each amount, line by line.",
    ],
    example: [
      "Bo earns $5,200 a month gross. Before his pay reaches the bank, $312 goes to his 401(k), which is 6%, and say $420 goes to federal income tax. Social Security and Medicare take $397.80: 7.65% of the full $5,200, since a 401(k) does not lower them.",
      "His net pay is $5,200 minus $1,129.80: $4,070.20. In a year his gross pay is $62,400 and his net pay about $48,840.",
      "So about $1,130 of his gross pay never reaches his account, but $312 of that is still his, growing in his 401(k). A raise is quoted gross too: $100 more a month adds less than $100 to his net pay, because the taxes and the 401(k) take their share.",
    ],
    sources: [S.grossNet, S.fica],
  },
  {
    id: "401k", page: "retirement/contributions",
    what: [
      "You choose a share of each paycheck to put in, and it goes in before income tax, so it is left out of this year's taxable pay. Your employer can add money too, often as a match.",
      "The money grows with no yearly tax, and what comes out in retirement is taxed as income. Many plans also have a Roth version: no tax break going in, but withdrawals that follow the rules come out tax-free.",
    ],
    why: [
      "It is often the easiest and biggest way to save, because it happens before the money reaches you. An employer match is extra pay you get only if you put money in yourself. When you leave the job, the money can usually be moved to an IRA or the next job's plan without tax.",
      "It is meant for retirement: money taken out before age 59½ usually costs an extra 10% tax on top of income tax, with some exceptions. How much you can put in each year has a limit; the Contribution limits page shows this year's.",
    ],
    example: [
      "Ana earns about $100,000 and puts 6% of her pay into her 401(k): $6,000 a year. Say her employer adds 50 cents for each dollar she puts in, up to 6% of pay: another $3,000.",
      "If her top tax rate is 22%, her $6,000 saves about $1,320 of income tax this year. So her take-home pay falls by only about $4,680, while $9,000 goes into her account. The match alone, $3,000, is like a 3% raise she gets only by saving.",
      "Taking $10,000 out at 45 instead would cost income tax plus the extra 10%, which is $1,000, unless an exception applies.",
    ],
    sources: [S.k401, S.early],
  },
  {
    id: "ira", page: "retirement/contributions",
    what: [
      "You open it yourself, at a bank or a brokerage, and it stays yours whatever job you have.",
      "In a traditional IRA, what you put in may be deductible, depending on your filing status and income, and nothing is taxed until you take money out. In a Roth IRA, what you put in is not deductible, but withdrawals that follow the rules are tax-free, and you can leave the money in as long as you live. One yearly limit covers all your IRAs together.",
    ],
    why: [
      "It is how someone with no plan at work can save for retirement with a tax break, and how anyone can save more on top of a 401(k). When you leave a job, an old 401(k) can be rolled over into an IRA without tax when it is done by the rules.",
      "Like a 401(k), money taken out before age 59½ usually costs an extra 10% tax, with some exceptions. The Contribution limits page shows this year's limit.",
    ],
    example: [
      "Riley puts $4,000 into a traditional IRA. If it is deductible and Riley's top rate is 12%, it cuts this year's tax by $480; every dollar that comes out later is taxed as income.",
      "If Riley picks a Roth IRA instead, there is no $480 now. But if the $4,000 grows 7% a year for 34 years, to about $40,000, all of it can come out tax-free in retirement, following the rules.",
      "Either way, the money grows without a yearly tax bill while it stays in the account. Which is better depends mostly on whether Riley's tax rate is higher now or later.",
    ],
    sources: [S.tradIra, S.rothIra, S.early],
  },
  {
    id: "velocity-banking", page: "debt/mortgage", tryIt: "Try an extra payment on your own mortgage:", withData: true,
    notYet: { figures: "First add your mortgage's rate and payment:", none: "No mortgage is owed in your plan, so there is nothing to try here." },
    what: [
      "It runs in a loop. Your whole paycheck goes into a line of credit, often one borrowed against your home, and your bills are paid from that line.",
      "Every so often you borrow a large amount from the line at once, often called a chunk, and pay it onto the mortgage. Your pay then brings the line back down, and the loop starts again. This is information, not advice.",
    ],
    why: [
      "Only money left over after your spending pays any debt down. Moving debt onto the line does not lower it; it only moves it, usually to a higher rate. An extra payment on the mortgage, made with the same leftover money, pays it off about as soon.",
      "The line also brings risks the mortgage does not have: its rate usually changes, and not repaying it can cost you the home.",
    ],
    example: [
      "In short, the line itself changes the result by a few dollars a month. Take a $200,000 mortgage over 30 years at 6%, a line of credit at 9%, $5,000 of everyday spending a month and $1,000 left over.",
      "Sent to the mortgage as an extra payment, the $1,000 a month ends it in about 10 years instead of 30 and saves about $164,000 of interest, with or without the line.",
      "With velocity banking, you borrow $10,000 from the line at once and pay it onto the mortgage; the $1,000 left over clears the line in 10 months. Meanwhile you owe $5,500 on the line on average, at 9% instead of the mortgage's 6%: about $138 of extra interest.",
      "Your pay also sits on the line until you spend it, so you owe about $2,500 less on average. If the line charges interest on each day's balance, that saves about $188.",
      "So after 10 months you are about $50 better off than sending the $1,000 straight to the mortgage, about $5 a month, before any fee for the line. With the mortgage at 4%, you would be about $42 worse off. Either way, it is tiny next to the $164,000.",
    ],
    sources: [S.heloc],
  },
];
