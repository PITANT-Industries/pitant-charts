export const waffleFixtures = {
  "waffle-default": { names: ["Chrome", "Safari", "Edge", "Firefox", "Other"], values: [18420, 9870, 3410, 2380, 1120], label: "Visitors", unit: "", foot: "35,200 visitors this month · one cell per percentage point" },
  "waffle-progress": { names: ["Early bird", "General", "VIP", "Still on sale"], values: [1200, 2650, 410, 1740], label: "Sold", unit: " seats", foot: "Each dot is 40 seats · 1,740 still on sale" },
  "waffle-columns": { names: ["Wind", "Solar", "Hydro", "Nuclear", "Gas"], values: [31.4, 18.2, 12.6, 17.9, 19.9], label: "Generated", unit: " TWh", foot: "Renewables generated 62% · one cell is half a terawatt-hour" },
  "waffle-loading": { names: ["Card", "Wallet", "Bank transfer", "Buy now, pay later"], values: [6120, 2840, 1460, 780], label: "Payments", unit: "", foot: "11,200 payments · 55% by card" },
} as const;

export const mekkoFixtures = {
  "marimekko-default": { categories: ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East"], series: [
    { name: "Enterprise", values: [420, 310, 180, 60, 40] }, { name: "Mid-market", values: [260, 190, 150, 50, 30] }, { name: "SMB", values: [140, 120, 170, 70, 30] },
  ], foot: "$2.22B across five regions and three segments" },
  "marimekko-legend": { categories: ["United States", "India", "Germany", "Brazil", "Japan"], series: [
    { name: "Desktop", values: [4400, 600, 1900, 700, 1300] }, { name: "Mobile", values: [3800, 3100, 1500, 1900, 1000] }, { name: "Tablet", values: [1000, 200, 300, 200, 300] },
  ], foot: "22,200 sessions from five countries" },
  "marimekko-loading": { categories: ["Email", "Chat", "Phone", "Social"], series: [
    { name: "Low", values: [1840, 1260, 380, 510] }, { name: "Normal", values: [2310, 1980, 920, 430] }, { name: "Urgent", values: [420, 610, 540, 90] },
  ], foot: "11,290 tickets · 40% by email" },
} as const;
