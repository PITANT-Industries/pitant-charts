interface PieFixture {
  names: readonly string[];
  values: readonly number[];
  label?: string;
  size?: number;
  inner?: number;
  padding?: number;
  corner?: number;
  fontSize?: number;
  labelSize?: number;
  currency?: boolean;
}

const sales = {
  names: ["Electronics", "Clothing", "Food", "Home", "Other"],
  values: [4250, 3120, 2100, 1580, 1050],
};

export const pieFixtures: Readonly<Record<string, PieFixture>> = {
  "pie-default": { ...sales, currency: true },
  "pie-pattern": { names: ["Spent", "Committed", "Remaining"], values: [48000, 21500, 30500], currency: true },
  "pie-pattern-presets": { names: ["Compute", "Storage", "Network", "Support"], values: [35, 25, 20, 20] },
  "pie-gradients": { names: ["Annual", "Monthly", "Lifetime"], values: [48200, 36400, 15400], currency: true },
  "pie-center": { label: "Revenue", names: ["Starter", "Pro", "Business", "Enterprise"], values: [18400, 42600, 31200, 27800], inner: 80, currency: true },
  "pie-center-custom": { label: "All lines", names: ["Headphones", "Speakers", "Microphones", "Accessories", "Other"], values: [2310, 1840, 1170, 960, 720], inner: 80, fontSize: 24 },
  "pie-center-share": { label: "Total sales", ...sales, inner: 85, fontSize: 24 },
  "pie-hover-effects": sales,
  "pie-hover-legend": { label: "Orders", names: ["Online store", "Retail", "Marketplace", "Wholesale", "Social"], values: [5820, 3940, 2310, 1480, 950], size: 240, inner: 70, fontSize: 27.28, labelSize: 11.16 },
  "pie-half-donut": { names: ["Direct", "Search", "Social"], values: [4120, 3580, 2460], size: 300, inner: 70, padding: .03, corner: 4 },
  "pie-donut-grow": { label: "Sessions", names: ["Chrome", "Safari", "Firefox", "Edge", "Other"], values: [27500, 20000, 18700, 17300, 9000], inner: 75, fontSize: 29.48 },
  "pie-glow": { label: "Spend", names: ["Compute", "Storage", "Database", "Network"], values: [18420, 9860, 7340, 3120], inner: 80, padding: .04, corner: 6, currency: true },
  "pie-patterns": { label: "Tickets", names: ["Email", "Chat", "Phone", "Forum"], values: [1840, 1320, 760, 480], inner: 70, padding: .03, corner: 4, fontSize: 27.28, labelSize: 11.16 },
  "pie-pattern-tile": { label: "Tickets", names: ["Open", "Pending", "Solved"], values: [128, 214, 642], inner: 70, padding: .03, corner: 4, fontSize: 27.28, labelSize: 11.16 },
};
