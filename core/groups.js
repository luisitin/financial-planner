// core/groups.js -- the sidebar sections, in display order. A module's `group`
// must be one of these ids (and its folder must be modules/<group>/<id>/).
// Adding a group: append here, create modules/<group>/, update docs/MODULE_CATALOG.md.
export const GROUPS = [
  { id: "overview",     title: "Overview",                 icon: "🏠" },
  { id: "household",    title: "Household",                icon: "👪" },
  { id: "balance",      title: "Assets and debts",         icon: "⚖️" },
  { id: "cashflow",     title: "Cash flow and budget",     icon: "💵" },
  { id: "transactions", title: "Transactions",             icon: "🧾" },
  { id: "debt",         title: "Debt",                     icon: "💳" },
  { id: "goals",        title: "Goals",                    icon: "🎯" },
  { id: "retirement",   title: "Retirement",               icon: "🌴" },
  { id: "investments",  title: "Investments",              icon: "📈" },
  { id: "taxes",        title: "Taxes",                    icon: "🧮" },
  { id: "insurance",    title: "Insurance and risk",       icon: "🛡️" },
  { id: "estate",       title: "Estate and legacy",        icon: "📜" },
  { id: "property",     title: "Home, cars, big buys",     icon: "🏡" },
  { id: "career",       title: "Career and income",        icon: "💼" },
  { id: "scenarios",    title: "What-if scenarios",        icon: "🔀" },
  { id: "reports",      title: "Reports",                  icon: "📄" },
  { id: "ai",           title: "AI assistant",             icon: "🤖" },
  { id: "system",       title: "System",                   icon: "⚙️" },
];
export const GROUP_IDS = new Set(GROUPS.map((g) => g.id));
